package com.anonnews.poller;

import com.anonnews.filter.KeywordRelevanceFilter;
import com.anonnews.repository.ArticleRepository;
import com.anonnews.repository.SourceRepository;
import com.anonnews.service.DeadLetterService;
import com.anonnews.service.DeduplicationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Polls Reddit using OAuth2 app-only (client_credentials) flow.
 * Fetches hot posts from configured subreddits and maps them to RawArticle.
 * Token is cached and refreshed proactively before expiry.
 */
@Component
@ConditionalOnProperty(name = "poller.reddit.enabled", havingValue = "true", matchIfMissing = true)
public class RedditPoller extends BasePoller {

    private static final String TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
    private static final String OAUTH_BASE = "https://oauth.reddit.com";
    private static final long TOKEN_REFRESH_BUFFER_SECONDS = 600; // refresh 10 min before expiry

    @Value("${REDDIT_CLIENT_ID:}")
    private String clientId;

    @Value("${REDDIT_CLIENT_SECRET:}")
    private String clientSecret;

    @Value("${poller.reddit.user-agent:anon-news-bot/0.1}")
    private String userAgent;

    @Value("${poller.reddit.subreddits:kubernetes,devops,cloudnative,CNCF}")
    private List<String> subreddits;

    @Value("${poller.reddit.limit:25}")
    private int limit;

    private final RestClient restClient;

    // Cached OAuth2 token state
    private volatile String accessToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    public RedditPoller(ArticleRepository articleRepository,
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
        return "reddit";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return true;
    }

    @Override
    @WithSpan("poller.reddit.fetch")
    @CircuitBreaker(name = "reddit")
    @RateLimiter(name = "reddit")
    List<RawArticle> fetchArticles() {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            log.warn("Reddit client credentials not configured, skipping");
            return List.of();
        }

        ensureValidToken();

        List<RawArticle> articles = new ArrayList<>();
        for (String subreddit : subreddits) {
            try {
                List<RawArticle> subArticles = fetchSubreddit(subreddit);
                articles.addAll(subArticles);
            } catch (Exception e) {
                log.warn("Failed to fetch subreddit r/{}: {}", subreddit, e.getMessage());
            }
        }
        return articles;
    }

    private List<RawArticle> fetchSubreddit(String subreddit) {
        JsonNode response = restClient.get()
                .uri(OAUTH_BASE + "/r/{sub}/hot.json?limit={limit}", subreddit, limit)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .header(HttpHeaders.USER_AGENT, userAgent)
                .retrieve()
                .body(JsonNode.class);

        if (response == null || !response.has("data") || !response.get("data").has("children")) {
            return List.of();
        }

        List<RawArticle> articles = new ArrayList<>();
        for (JsonNode child : response.get("data").get("children")) {
            JsonNode data = child.get("data");
            if (data == null) continue;

            // Skip stickied/pinned posts and self-text-only posts without meaningful content
            if (data.has("stickied") && data.get("stickied").asBoolean()) continue;

            String url = nodeText(data, "url");
            String title = nodeText(data, "title");
            if (url == null || title == null) continue;

            // Use the permalink for self posts
            if (url.startsWith("/r/") || "self".equals(nodeText(data, "post_hint"))) {
                url = "https://www.reddit.com" + nodeText(data, "permalink");
            }

            Instant publishedAt = data.has("created_utc")
                    ? Instant.ofEpochSecond(data.get("created_utc").asLong())
                    : null;

            String selftext = nodeText(data, "selftext");
            String contentSnippet = (selftext != null && !selftext.isBlank()) ? selftext : null;

            articles.add(new RawArticle(
                    nodeText(data, "id"),
                    title,
                    url,
                    nodeText(data, "author"),
                    contentSnippet,
                    publishedAt,
                    data.has("score") ? data.get("score").asInt() : 0,
                    List.of("reddit", "r/" + subreddit),
                    Map.of(
                            "subreddit", subreddit,
                            "num_comments", data.has("num_comments") ? data.get("num_comments").asInt() : 0,
                            "upvote_ratio", data.has("upvote_ratio") ? data.get("upvote_ratio").asDouble() : 0.0
                    )
            ));
        }
        return articles;
    }

    /**
     * Obtains or refreshes the OAuth2 app-only access token.
     * Uses client_credentials grant type with HTTP Basic auth.
     */
    private synchronized void ensureValidToken() {
        if (accessToken != null && Instant.now().isBefore(tokenExpiresAt)) {
            return;
        }

        log.info("Refreshing Reddit OAuth2 token");

        String credentials = Base64.getEncoder()
                .encodeToString((clientId + ":" + clientSecret).getBytes());

        JsonNode tokenResponse = restClient.post()
                .uri(TOKEN_URL)
                .header(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
                .header(HttpHeaders.USER_AGENT, userAgent)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body("grant_type=client_credentials")
                .retrieve()
                .body(JsonNode.class);

        if (tokenResponse == null || !tokenResponse.has("access_token")) {
            throw new IllegalStateException("Failed to obtain Reddit OAuth2 token");
        }

        this.accessToken = tokenResponse.get("access_token").asText();
        int expiresIn = tokenResponse.has("expires_in")
                ? tokenResponse.get("expires_in").asInt() : 3600;
        // Refresh proactively before actual expiry
        this.tokenExpiresAt = Instant.now().plusSeconds(expiresIn - TOKEN_REFRESH_BUFFER_SECONDS);

        log.info("Reddit OAuth2 token refreshed, expires in {}s", expiresIn);
    }

    private static String nodeText(JsonNode node, String field) {
        if (node.has(field) && !node.get(field).isNull()) {
            String text = node.get(field).asText();
            return text.isEmpty() ? null : text;
        }
        return null;
    }

    @Scheduled(fixedDelayString = "${poller.reddit.interval:600}000")
    public void scheduledPoll() {
        poll();
    }
}
