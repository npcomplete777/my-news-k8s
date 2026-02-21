package com.o11ynews.poller;

import com.o11ynews.filter.KeywordRelevanceFilter;
import com.o11ynews.repository.ArticleRepository;
import com.o11ynews.repository.SourceRepository;
import com.o11ynews.service.DeadLetterService;
import com.o11ynews.service.DeduplicationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.jdom2.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Polls YouTube channel RSS feeds for new videos.
 * Uses YouTube's public Atom feeds (no API key required for RSS).
 * Each configured channel ID produces a feed URL:
 * https://www.youtube.com/feeds/videos.xml?channel_id={id}
 */
@Component
@ConditionalOnProperty(name = "poller.youtube.enabled", havingValue = "true", matchIfMissing = true)
public class YouTubePoller extends BasePoller {

    private static final String FEED_URL_TEMPLATE = "https://www.youtube.com/feeds/videos.xml?channel_id=%s";

    @Value("${poller.youtube.channel-ids:}")
    private List<String> channelIds;

    public YouTubePoller(ArticleRepository articleRepository,
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
        return "youtube";
    }

    @Override
    boolean requiresKeywordFiltering() {
        return true;
    }

    @Override
    @WithSpan("poller.youtube.fetch")
    @CircuitBreaker(name = "rss")
    @RateLimiter(name = "rss")
    List<RawArticle> fetchArticles() {
        if (channelIds == null || channelIds.isEmpty()) {
            log.info("No YouTube channel IDs configured, skipping");
            return List.of();
        }

        List<RawArticle> articles = new ArrayList<>();
        for (String channelId : channelIds) {
            if (channelId.isBlank()) continue;
            try {
                List<RawArticle> channelArticles = fetchChannel(channelId.strip());
                articles.addAll(channelArticles);
            } catch (Exception e) {
                log.warn("Failed to fetch YouTube channel {}: {}", channelId, e.getMessage());
            }
        }
        return articles;
    }

    private List<RawArticle> fetchChannel(String channelId) throws Exception {
        String feedUrl = String.format(FEED_URL_TEMPLATE, channelId);

        SyndFeedInput input = new SyndFeedInput();
        SyndFeed feed;
        try (XmlReader reader = new XmlReader(URI.create(feedUrl).toURL())) {
            feed = input.build(reader);
        }

        String channelTitle = feed.getTitle();
        List<RawArticle> articles = new ArrayList<>();

        for (SyndEntry entry : feed.getEntries()) {
            String title = entry.getTitle();
            if (title == null || title.isBlank()) continue;

            // Extract videoId from yt:videoId foreign markup element
            String videoId = extractVideoId(entry);
            String url = videoId != null
                    ? "https://www.youtube.com/watch?v=" + videoId
                    : entry.getLink();

            if (url == null) continue;

            // Extract media:description from foreign markup
            String description = extractMediaDescription(entry);

            Instant publishedAt = null;
            if (entry.getPublishedDate() != null) {
                publishedAt = entry.getPublishedDate().toInstant();
            } else if (entry.getUpdatedDate() != null) {
                publishedAt = entry.getUpdatedDate().toInstant();
            }

            articles.add(new RawArticle(
                    videoId != null ? videoId : entry.getUri(),
                    title,
                    url,
                    channelTitle,
                    description,
                    publishedAt,
                    0,
                    List.of("youtube", "video"),
                    Map.of(
                            "channel_id", channelId,
                            "channel_title", channelTitle != null ? channelTitle : ""
                    )
            ));
        }

        return articles;
    }

    /**
     * Extracts the yt:videoId element from the entry's foreign markup.
     */
    private String extractVideoId(SyndEntry entry) {
        List<Element> foreignMarkup = entry.getForeignMarkup();
        if (foreignMarkup != null) {
            for (Element elem : foreignMarkup) {
                if ("videoId".equals(elem.getName())
                        && "yt".equals(elem.getNamespacePrefix())) {
                    return elem.getTextTrim();
                }
            }
        }
        // Fallback: try to extract from the entry link
        String link = entry.getLink();
        if (link != null && link.contains("watch?v=")) {
            int idx = link.indexOf("watch?v=") + 8;
            int end = link.indexOf('&', idx);
            return end > 0 ? link.substring(idx, end) : link.substring(idx);
        }
        return null;
    }

    /**
     * Extracts the media:description or media:group/media:description element.
     */
    private String extractMediaDescription(SyndEntry entry) {
        List<Element> foreignMarkup = entry.getForeignMarkup();
        if (foreignMarkup != null) {
            for (Element elem : foreignMarkup) {
                // Direct media:description
                if ("description".equals(elem.getName())
                        && "media".equals(elem.getNamespacePrefix())) {
                    return elem.getTextTrim();
                }
                // media:group containing media:description
                if ("group".equals(elem.getName())
                        && "media".equals(elem.getNamespacePrefix())) {
                    for (Element child : elem.getChildren()) {
                        if ("description".equals(child.getName())) {
                            return child.getTextTrim();
                        }
                    }
                }
            }
        }
        // Fallback to standard description
        if (entry.getDescription() != null) {
            return entry.getDescription().getValue();
        }
        return null;
    }

    @Scheduled(fixedDelayString = "${poller.youtube.interval:1800}000")
    public void scheduledPoll() {
        poll();
    }
}
