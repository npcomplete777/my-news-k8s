package com.o11ynews.poller;

import com.o11ynews.filter.KeywordRelevanceFilter;
import com.o11ynews.repository.ArticleRepository;
import com.o11ynews.repository.SourceRepository;
import com.o11ynews.service.DeadLetterService;
import com.o11ynews.service.DeduplicationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Polls Lobste.rs JSON endpoints for hottest and newest stories.
 * Lobsters has a public JSON API with no authentication required.
 * Results are deduplicated by short_id across both endpoints.
 */
@Component
@ConditionalOnProperty(name = "poller.lobsters.enabled", havingValue = "true", matchIfMissing = true)
public class LobstersPoller extends BasePoller {

    private static final String HOTTEST_URL = "https://lobste.rs/hottest.json";
    private static final String NEWEST_URL = "https://lobste.rs/newest.json";

    private final RestClient restClient;

    public LobstersPoller(ArticleRepository articleRepository,
                          SourceRepository sourceRepository,
                          DeduplicationService deduplicationService,
                          DeadLetterService deadLetterService,
                          KeywordRelevanceFilter keywordFilter,
                          ObjectMapper objectMapper,
                          RestClient restClient) {
        super(articleRepository, sourceRepository, deduplicationService,
                deadLetterService, keywordFilter, objectMapper);
        this.restClient = restClient;
    }

    @Override
    String getSourceSlug() {
        return "lobsters";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return true;
    }

    @Override
    @WithSpan("poller.lobsters.fetch")
    @CircuitBreaker(name = "lobsters")
    @RateLimiter(name = "lobsters")
    List<RawArticle> fetchArticles() {
        Set<String> seen = new LinkedHashSet<>();
        List<RawArticle> articles = new ArrayList<>();

        // Fetch hottest
        try {
            List<RawArticle> hottest = fetchEndpoint(HOTTEST_URL, seen);
            articles.addAll(hottest);
        } catch (Exception e) {
            log.warn("Failed to fetch Lobsters hottest: {}", e.getMessage());
        }

        // Fetch newest
        try {
            List<RawArticle> newest = fetchEndpoint(NEWEST_URL, seen);
            articles.addAll(newest);
        } catch (Exception e) {
            log.warn("Failed to fetch Lobsters newest: {}", e.getMessage());
        }

        return articles;
    }

    private List<RawArticle> fetchEndpoint(String url, Set<String> seen) {
        JsonNode response = restClient.get()
                .uri(url)
                .retrieve()
                .body(JsonNode.class);

        if (response == null || !response.isArray()) {
            return List.of();
        }

        List<RawArticle> articles = new ArrayList<>();
        for (JsonNode story : response) {
            String shortId = nodeText(story, "short_id");
            if (shortId == null || !seen.add(shortId)) {
                continue; // skip duplicates across endpoints
            }

            String title = nodeText(story, "title");
            String storyUrl = nodeText(story, "url");
            if (title == null) continue;

            // Some Lobsters stories have no URL (they are text posts)
            if (storyUrl == null || storyUrl.isBlank()) {
                storyUrl = nodeText(story, "short_id_url");
                if (storyUrl == null) {
                    storyUrl = "https://lobste.rs/s/" + shortId;
                }
            }

            Instant publishedAt = null;
            String createdAt = nodeText(story, "created_at");
            if (createdAt != null) {
                try {
                    publishedAt = Instant.parse(createdAt);
                } catch (Exception e) {
                    log.debug("Failed to parse Lobsters created_at: {}", createdAt);
                }
            }

            // Extract tags
            List<String> tags = new ArrayList<>();
            tags.add("lobsters");
            if (story.has("tags") && story.get("tags").isArray()) {
                for (JsonNode tag : story.get("tags")) {
                    tags.add(tag.asText());
                }
            }

            // Author from submitter_user
            String author = null;
            if (story.has("submitter_user") && story.get("submitter_user").has("username")) {
                author = story.get("submitter_user").get("username").asText();
            }

            articles.add(new RawArticle(
                    shortId,
                    title,
                    storyUrl,
                    author,
                    nodeText(story, "description"),
                    publishedAt,
                    story.has("score") ? story.get("score").asInt() : 0,
                    tags,
                    Map.of(
                            "comment_count", story.has("comment_count")
                                    ? story.get("comment_count").asInt() : 0,
                            "short_id_url", storyUrl
                    )
            ));
        }

        return articles;
    }

    private static String nodeText(JsonNode node, String field) {
        if (node.has(field) && !node.get(field).isNull()) {
            String text = node.get(field).asText();
            return text.isEmpty() ? null : text;
        }
        return null;
    }

    @Scheduled(fixedDelayString = "${poller.lobsters.interval:600}000")
    public void scheduledPoll() {
        poll();
    }
}
