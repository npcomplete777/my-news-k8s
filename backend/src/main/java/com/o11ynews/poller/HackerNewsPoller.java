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
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Polls Hacker News Firebase API for top stories.
 * Fetches story IDs, then fan-out fetches individual items using virtual threads
 * with a concurrency limit of 10.
 */
@Component
@ConditionalOnProperty(name = "poller.hackernews.enabled", havingValue = "true", matchIfMissing = true)
public class HackerNewsPoller extends BasePoller {

    private static final String TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
    private static final String ITEM_URL_TEMPLATE = "https://hacker-news.firebaseio.com/v0/item/{id}.json";
    private static final int MAX_STORIES = 50;
    private static final int CONCURRENCY = 10;

    private final RestClient restClient;

    public HackerNewsPoller(ArticleRepository articleRepository,
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
        return "hackernews";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return true;
    }

    @Override
    @WithSpan("poller.hackernews.fetch")
    @CircuitBreaker(name = "hackernews")
    @RateLimiter(name = "hackernews")
    List<RawArticle> fetchArticles() {
        // 1. Fetch top story IDs
        List<Long> storyIds = restClient.get()
                .uri(TOP_STORIES_URL)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});

        if (storyIds == null || storyIds.isEmpty()) {
            log.warn("HackerNews returned empty story list");
            return List.of();
        }

        // 2. Take first N stories
        List<Long> batch = storyIds.subList(0, Math.min(storyIds.size(), MAX_STORIES));

        // 3. Fan-out fetch with virtual thread executor (bounded concurrency)
        List<RawArticle> results = Collections.synchronizedList(new ArrayList<>());
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            // Process in chunks of CONCURRENCY
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < batch.size(); i++) {
                final Long storyId = batch.get(i);

                // Simple semaphore via batching: submit CONCURRENCY at a time
                futures.add(executor.submit(() -> {
                    try {
                        RawArticle article = fetchStory(storyId);
                        if (article != null) {
                            results.add(article);
                        }
                    } catch (Exception e) {
                        log.debug("Failed to fetch HN story {}: {}", storyId, e.getMessage());
                    }
                }));

                // Wait for current batch when we reach concurrency limit
                if (futures.size() >= CONCURRENCY) {
                    waitForFutures(futures);
                    futures.clear();
                }
            }
            // Wait for remaining
            waitForFutures(futures);
        }

        return results;
    }

    private RawArticle fetchStory(Long storyId) {
        JsonNode item = restClient.get()
                .uri(ITEM_URL_TEMPLATE, storyId)
                .retrieve()
                .body(JsonNode.class);

        if (item == null || item.isNull() || !"story".equals(nodeText(item, "type"))) {
            return null;
        }

        String url = nodeText(item, "url");
        // Some HN stories are "Ask HN" / "Show HN" with no URL; use HN item page
        if (url == null || url.isBlank()) {
            url = "https://news.ycombinator.com/item?id=" + storyId;
        }

        String title = nodeText(item, "title");
        if (title == null || title.isBlank()) {
            return null;
        }

        Instant publishedAt = item.has("time")
                ? Instant.ofEpochSecond(item.get("time").asLong())
                : null;

        return new RawArticle(
                String.valueOf(storyId),
                title,
                url,
                nodeText(item, "by"),
                nodeText(item, "text"),  // text is the body for Ask HN posts
                publishedAt,
                item.has("score") ? item.get("score").asInt() : 0,
                List.of("hackernews"),
                Map.of(
                        "descendants", item.has("descendants") ? item.get("descendants").asInt() : 0,
                        "hn_type", Objects.requireNonNullElse(nodeText(item, "type"), "story")
                )
        );
    }

    private static String nodeText(JsonNode node, String field) {
        if (node.has(field) && !node.get(field).isNull()) {
            return node.get(field).asText();
        }
        return null;
    }

    private static void waitForFutures(List<Future<?>> futures) {
        for (Future<?> f : futures) {
            try {
                f.get();
            } catch (Exception e) {
                // Individual failures are already logged in the task
            }
        }
    }

    @Scheduled(fixedDelayString = "${poller.hackernews.interval:300}000")
    public void scheduledPoll() {
        poll();
    }
}
