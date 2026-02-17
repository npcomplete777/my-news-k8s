package com.anonnews.poller;

import com.anonnews.filter.KeywordRelevanceFilter;
import com.anonnews.repository.ArticleRepository;
import com.anonnews.repository.SourceRepository;
import com.anonnews.service.DeadLetterService;
import com.anonnews.service.DeduplicationService;
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
import java.util.List;
import java.util.Map;

/**
 * Polls the CNCF blog RSS 2.0 feed for new posts.
 * Uses ROME library to parse the feed at https://www.cncf.io/blog/feed/
 * Extracts dc:creator for author attribution.
 * No keyword filtering is needed since the feed is entirely on-topic.
 */
@Component
@ConditionalOnProperty(name = "poller.cncfblog.enabled", havingValue = "true", matchIfMissing = true)
public class CncfBlogPoller extends BasePoller {

    private static final String FEED_URL = "https://www.cncf.io/blog/feed/";

    public CncfBlogPoller(ArticleRepository articleRepository,
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
        return "cncfblog";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return false;
    }

    @Override
    @WithSpan("poller.cncfblog.fetch")
    @CircuitBreaker(name = "rss")
    @RateLimiter(name = "rss")
    List<RawArticle> fetchArticles() {
        try {
            return parseFeed(FEED_URL);
        } catch (Exception e) {
            log.error("Failed to fetch CNCF blog feed: {}", e.getMessage(), e);
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
            if (url == null || url.isBlank()) {
                url = entry.getUri();
            }
            if (url == null) continue;

            // Use URI or link as stable external ID
            String externalId = entry.getUri() != null ? entry.getUri() : url;

            // Extract author from dc:creator module (common in WordPress RSS feeds)
            String author = extractDcCreator(entry);
            if (author == null && entry.getAuthor() != null && !entry.getAuthor().isBlank()) {
                author = entry.getAuthor();
            }

            // Content snippet from description, strip HTML
            String contentSnippet = null;
            if (entry.getDescription() != null && entry.getDescription().getValue() != null) {
                contentSnippet = entry.getDescription().getValue()
                        .replaceAll("<[^>]+>", "")
                        .strip();
            }

            // Published date
            Instant publishedAt = null;
            if (entry.getPublishedDate() != null) {
                publishedAt = entry.getPublishedDate().toInstant();
            } else if (entry.getUpdatedDate() != null) {
                publishedAt = entry.getUpdatedDate().toInstant();
            }

            // Tags from categories
            List<String> tags = new ArrayList<>();
            tags.add("cncf");
            tags.add("cncfblog");
            if (entry.getCategories() != null) {
                for (SyndCategory cat : entry.getCategories()) {
                    if (cat.getName() != null && !cat.getName().isBlank()) {
                        tags.add(cat.getName().toLowerCase());
                    }
                }
            }

            articles.add(new RawArticle(
                    externalId,
                    title,
                    url,
                    author,
                    contentSnippet,
                    publishedAt,
                    0,
                    tags,
                    Map.of("feed", "cncf.io/blog/feed/")
            ));
        }

        return articles;
    }

    /**
     * Extracts the dc:creator element from a feed entry using ROME's DCModule.
     */
    private String extractDcCreator(SyndEntry entry) {
        DCModule dcModule = (DCModule) entry.getModule(DCModule.URI);
        if (dcModule != null && dcModule.getCreator() != null && !dcModule.getCreator().isBlank()) {
            return dcModule.getCreator();
        }
        return null;
    }

    @Scheduled(fixedDelayString = "${poller.cncfblog.interval:1800}000")
    public void scheduledPoll() {
        poll();
    }
}
