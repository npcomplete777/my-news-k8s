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
import org.springframework.http.HttpHeaders;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Polls GitHub release pages for tracked repositories.
 * Uses a personal access token for higher rate limits (5000 req/hr).
 * Fan-out fetches repos concurrently with virtual threads.
 */
@Component
@ConditionalOnProperty(name = "poller.github-releases.enabled", havingValue = "true", matchIfMissing = true)
public class GitHubPoller extends BasePoller {

    private static final String RELEASES_URL_TEMPLATE = "https://api.github.com/repos/{owner}/{repo}/releases?per_page=5";

    @Value("${GITHUB_TOKEN:}")
    private String githubToken;

    @Value("${poller.github-releases.repos:kubernetes/kubernetes,prometheus/prometheus,grafana/grafana}")
    private List<String> repos;

    private final RestClient restClient;

    public GitHubPoller(ArticleRepository articleRepository,
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
        return "github";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return false;
    }

    @Override
    @WithSpan("poller.github.fetch")
    @CircuitBreaker(name = "github")
    @RateLimiter(name = "github")
    List<RawArticle> fetchArticles() {
        if (githubToken.isBlank()) {
            log.warn("GITHUB_TOKEN not configured, skipping GitHub release polling");
            return List.of();
        }

        List<RawArticle> results = Collections.synchronizedList(new ArrayList<>());

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<?>> futures = new ArrayList<>();

            for (String repoFullName : repos) {
                futures.add(executor.submit(() -> {
                    try {
                        List<RawArticle> releases = fetchRepoReleases(repoFullName);
                        results.addAll(releases);
                    } catch (Exception e) {
                        log.warn("Failed to fetch GitHub releases for {}: {}", repoFullName, e.getMessage());
                    }
                }));
            }

            // Wait for all
            for (Future<?> f : futures) {
                try {
                    f.get();
                } catch (Exception e) {
                    // Individual failures already logged
                }
            }
        }

        return results;
    }

    private List<RawArticle> fetchRepoReleases(String repoFullName) {
        String[] parts = repoFullName.split("/");
        if (parts.length != 2) {
            log.warn("Invalid repo format '{}', expected 'owner/repo'", repoFullName);
            return List.of();
        }
        String owner = parts[0];
        String repo = parts[1];

        JsonNode releases = restClient.get()
                .uri(RELEASES_URL_TEMPLATE, owner, repo)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + githubToken)
                .header(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .retrieve()
                .body(JsonNode.class);

        if (releases == null || !releases.isArray()) {
            return List.of();
        }

        List<RawArticle> articles = new ArrayList<>();
        for (JsonNode release : releases) {
            // Skip drafts and pre-releases
            if (release.has("draft") && release.get("draft").asBoolean()) continue;

            String tagName = nodeText(release, "tag_name");
            String releaseName = nodeText(release, "name");
            String htmlUrl = nodeText(release, "html_url");
            if (htmlUrl == null) continue;

            // Build a descriptive title
            String title = releaseName != null && !releaseName.isBlank()
                    ? repoFullName + " " + tagName + ": " + releaseName
                    : repoFullName + " " + tagName;

            // Truncate body for snippet
            String body = nodeText(release, "body");

            Instant publishedAt = null;
            String publishedStr = nodeText(release, "published_at");
            if (publishedStr != null) {
                try {
                    publishedAt = Instant.parse(publishedStr);
                } catch (Exception e) {
                    log.debug("Failed to parse published_at '{}' for release {}", publishedStr, htmlUrl);
                }
            }

            String authorLogin = null;
            if (release.has("author") && release.get("author").has("login")) {
                authorLogin = release.get("author").get("login").asText();
            }

            boolean isPrerelease = release.has("prerelease") && release.get("prerelease").asBoolean();

            articles.add(new RawArticle(
                    nodeText(release, "id"),
                    title,
                    htmlUrl,
                    authorLogin,
                    body,
                    publishedAt,
                    0,
                    List.of("release", repo),
                    Map.of(
                            "repo", repoFullName,
                            "tag_name", tagName != null ? tagName : "",
                            "prerelease", isPrerelease
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

    @Scheduled(fixedDelayString = "${poller.github.interval:900}000")
    public void scheduledPoll() {
        poll();
    }
}
