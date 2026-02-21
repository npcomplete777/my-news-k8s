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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Polls Dev.to API for articles by tag.
 * Fetches top articles from the last 7 days for each configured tag.
 * Optionally uses an API key for higher rate limits.
 */
@Component
@ConditionalOnProperty(name = "poller.devto.enabled", havingValue = "true", matchIfMissing = true)
public class DevToPoller extends BasePoller {

    private static final String ARTICLES_URL = "https://dev.to/api/articles";

    @Value("${DEVTO_API_KEY:}")
    private String apiKey;

    @Value("${poller.devto.tags:kubernetes,devops,cloud,docker,observability}")
    private List<String> tags;

    @Value("${poller.devto.per-page:30}")
    private int perPage;

    private final RestClient restClient;

    public DevToPoller(ArticleRepository articleRepository,
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
        return "devto";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return true;
    }

    @Override
    @WithSpan("poller.devto.fetch")
    @CircuitBreaker(name = "devto")
    @RateLimiter(name = "devto")
    List<RawArticle> fetchArticles() {
        List<RawArticle> articles = new ArrayList<>();

        for (String tag : tags) {
            try {
                List<RawArticle> tagArticles = fetchByTag(tag);
                articles.addAll(tagArticles);
            } catch (Exception e) {
                log.warn("Failed to fetch DevTo articles for tag '{}': {}", tag, e.getMessage());
            }
        }

        return articles;
    }

    private List<RawArticle> fetchByTag(String tag) {
        RestClient.RequestHeadersSpec<?> request = restClient.get()
                .uri(ARTICLES_URL + "?tag={tag}&per_page={perPage}&top=7", tag, perPage);

        // Add optional API key
        if (apiKey != null && !apiKey.isBlank()) {
            request = request.header("api-key", apiKey);
        }

        JsonNode response = request.retrieve().body(JsonNode.class);

        if (response == null || !response.isArray()) {
            return List.of();
        }

        List<RawArticle> articles = new ArrayList<>();
        for (JsonNode article : response) {
            String title = nodeText(article, "title");
            String url = nodeText(article, "url");
            if (title == null || url == null) continue;

            Instant publishedAt = null;
            String publishedStr = nodeText(article, "published_at");
            if (publishedStr != null) {
                try {
                    publishedAt = Instant.parse(publishedStr);
                } catch (Exception e) {
                    log.debug("Failed to parse published_at '{}' for DevTo article", publishedStr);
                }
            }

            // Extract tag list
            List<String> articleTags = new ArrayList<>();
            articleTags.add("devto");
            if (article.has("tag_list") && article.get("tag_list").isArray()) {
                for (JsonNode t : article.get("tag_list")) {
                    articleTags.add(t.asText());
                }
            }

            String author = null;
            if (article.has("user") && article.get("user").has("username")) {
                author = article.get("user").get("username").asText();
            }

            articles.add(new RawArticle(
                    nodeText(article, "id"),
                    title,
                    url,
                    author,
                    nodeText(article, "description"),
                    publishedAt,
                    article.has("positive_reactions_count")
                            ? article.get("positive_reactions_count").asInt() : 0,
                    articleTags,
                    Map.of(
                            "reading_time_minutes", article.has("reading_time_minutes")
                                    ? article.get("reading_time_minutes").asInt() : 0,
                            "comments_count", article.has("comments_count")
                                    ? article.get("comments_count").asInt() : 0,
                            "source_tag", tag
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

    @Scheduled(fixedDelayString = "${poller.devto.interval:600}000")
    public void scheduledPoll() {
        poll();
    }
}
