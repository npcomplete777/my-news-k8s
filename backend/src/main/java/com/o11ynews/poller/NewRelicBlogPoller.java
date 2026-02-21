package com.o11ynews.poller;

import com.o11ynews.filter.KeywordRelevanceFilter;
import com.o11ynews.repository.ArticleRepository;
import com.o11ynews.repository.SourceRepository;
import com.o11ynews.service.DeadLetterService;
import com.o11ynews.service.DeduplicationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rometools.rome.feed.module.DCModule;
import com.rometools.rome.feed.synd.SyndCategory;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Polls the New Relic Blog RSS feed.
 * Feed URL: https://newrelic.com/blog/feed
 */
@Component
@ConditionalOnProperty(name = "poller.newrelicblog.enabled", havingValue = "true", matchIfMissing = true)
public class NewRelicBlogPoller extends BasePoller {

    private static final String FEED_URL = "https://newrelic.com/blog/feed";

    public NewRelicBlogPoller(ArticleRepository articleRepository,
                              SourceRepository sourceRepository,
                              DeduplicationService deduplicationService,
                              DeadLetterService deadLetterService,
                              KeywordRelevanceFilter keywordFilter,
                              ObjectMapper objectMapper) {
        super(articleRepository, sourceRepository, deduplicationService,
                deadLetterService, keywordFilter, objectMapper);
    }

    @Override
    String getSourceSlug() {
        return "newrelicblog";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return false;
    }

    @Override
    @WithSpan("poller.newrelicblog.fetch")
    @CircuitBreaker(name = "rss")
    @RateLimiter(name = "rss")
    List<RawArticle> fetchArticles() {
        try {
            return parseFeed(FEED_URL);
        } catch (Exception e) {
            log.error("Failed to fetch New Relic blog feed: {}", e.getMessage(), e);
            return List.of();
        }
    }

    private List<RawArticle> parseFeed(String feedUrl) throws Exception {
        SyndFeedInput input = new SyndFeedInput();
        SyndFeed feed;
        try (XmlReader reader = new XmlReader(URI.create(feedUrl).toURL())) {
            feed = input.build(reader);
        }

        List<RawArticle> articles = new ArrayList<>();
        for (SyndEntry entry : feed.getEntries()) {
            String title = entry.getTitle();
            if (title == null || title.isBlank()) continue;

            String url = entry.getLink();
            if (url == null || url.isBlank()) url = entry.getUri();
            if (url == null) continue;

            String externalId = entry.getUri() != null ? entry.getUri() : url;

            String author = null;
            DCModule dc = (DCModule) entry.getModule(DCModule.URI);
            if (dc != null && dc.getCreator() != null && !dc.getCreator().isBlank()) {
                author = dc.getCreator();
            }
            if (author == null && entry.getAuthor() != null) author = entry.getAuthor();

            String contentSnippet = null;
            String thumbnailUrl = null;
            if (entry.getDescription() != null && entry.getDescription().getValue() != null) {
                String html = entry.getDescription().getValue();
                thumbnailUrl = extractFirstImageUrl(html);
                contentSnippet = html.replaceAll("<[^>]+>", "").strip();
            }

            Instant publishedAt = null;
            if (entry.getPublishedDate() != null) {
                publishedAt = entry.getPublishedDate().toInstant();
            } else if (entry.getUpdatedDate() != null) {
                publishedAt = entry.getUpdatedDate().toInstant();
            }

            List<String> tags = new ArrayList<>();
            tags.add("newrelic");
            tags.add("observability");
            if (entry.getCategories() != null) {
                for (SyndCategory cat : entry.getCategories()) {
                    if (cat.getName() != null && !cat.getName().isBlank()) {
                        tags.add(cat.getName().toLowerCase());
                    }
                }
            }

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("feed", "newrelic.com/blog/feed");
            if (thumbnailUrl != null) metadata.put("thumbnailUrl", thumbnailUrl);

            articles.add(new RawArticle(externalId, title, url, author, contentSnippet,
                    publishedAt, 0, tags, metadata));
        }

        return articles;
    }

    @Scheduled(fixedDelayString = "${poller.newrelicblog.interval:3600}000")
    public void scheduledPoll() {
        poll();
    }
}
