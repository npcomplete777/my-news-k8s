package com.anonnews.poller;

import com.anonnews.entity.Article;
import com.anonnews.entity.Source;
import com.anonnews.filter.KeywordRelevanceFilter;
import com.anonnews.repository.ArticleRepository;
import com.anonnews.repository.SourceRepository;
import com.anonnews.service.DeadLetterService;
import com.anonnews.service.DeduplicationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Abstract base class for all feed pollers. Handles the common workflow of
 * fetching raw articles, filtering, deduplicating, and persisting them.
 * Concrete subclasses implement source-specific fetch logic.
 */
public abstract class BasePoller {

    protected final Logger log = LoggerFactory.getLogger(getClass());

    protected final ArticleRepository articleRepository;
    protected final SourceRepository sourceRepository;
    protected final DeduplicationService deduplicationService;
    protected final DeadLetterService deadLetterService;
    protected final KeywordRelevanceFilter keywordFilter;
    protected final ObjectMapper objectMapper;

    protected BasePoller(ArticleRepository articleRepository,
                         SourceRepository sourceRepository,
                         DeduplicationService deduplicationService,
                         DeadLetterService deadLetterService,
                         KeywordRelevanceFilter keywordFilter,
                         ObjectMapper objectMapper) {
        this.articleRepository = articleRepository;
        this.sourceRepository = sourceRepository;
        this.deduplicationService = deduplicationService;
        this.deadLetterService = deadLetterService;
        this.keywordFilter = keywordFilter;
        this.objectMapper = objectMapper;
    }

    /**
     * Returns the slug identifying this poller's source in the database.
     */
    abstract String getSourceSlug();

    /**
     * Fetches raw articles from the external API. Implementations should handle
     * pagination, rate limiting, and transient errors internally.
     */
    abstract List<RawArticle> fetchArticles();

    /**
     * Whether fetched articles must pass the keyword relevance filter before
     * being persisted. Sources like HN, Reddit, DevTo, Lobsters, and YouTube
     * pull from broad feeds, so filtering is needed. Curated feeds like the
     * Kubernetes blog or CNCF blog are already on-topic.
     */
    abstract boolean requiresKeywordFiltering();

    /**
     * Main poll loop. Looks up the source, calls {@link #fetchArticles()},
     * applies filtering and deduplication, then persists new articles.
     */
    @WithSpan("poller.execute")
    @Transactional
    public void poll() {
        String slug = getSourceSlug();
        log.info("Starting poll for source: {}", slug);

        Source source = sourceRepository.findBySlug(slug).orElse(null);
        if (source == null || !source.isEnabled()) {
            log.warn("Source {} not found or disabled, skipping", slug);
            return;
        }

        try {
            List<RawArticle> rawArticles = fetchArticles();
            log.info("Fetched {} raw articles from {}", rawArticles.size(), slug);

            int persisted = 0;
            int duplicates = 0;
            int filtered = 0;

            for (RawArticle raw : rawArticles) {
                try {
                    // Keyword filtering for broad-spectrum sources
                    if (requiresKeywordFiltering()
                            && !keywordFilter.isRelevant(raw.title(), raw.contentSnippet())) {
                        filtered++;
                        continue;
                    }

                    // Deduplication check
                    if (deduplicationService.isDuplicate(raw.url())) {
                        duplicates++;
                        continue;
                    }

                    // Build and persist the article
                    Article article = new Article();
                    article.setSource(source);
                    article.setExternalId(raw.externalId());
                    article.setTitle(truncate(raw.title(), 500));
                    article.setUrl(truncate(raw.url(), 2000));
                    article.setAuthor(truncate(raw.author(), 255));
                    article.setContentSnippet(raw.contentSnippet() != null
                            ? truncate(raw.contentSnippet(), 500) : null);
                    article.setPublishedAt(raw.publishedAt());
                    article.setFetchedAt(Instant.now());
                    article.setScore(raw.score());
                    article.setTags(raw.tags() != null ? raw.tags() : List.of());
                    article.setDedupHash(deduplicationService.computeHash(
                            deduplicationService.normalizeUrl(raw.url())));
                    article.setMetadataJson(raw.metadata() != null
                            ? objectMapper.writeValueAsString(raw.metadata()) : "{}");

                    articleRepository.save(article);
                    persisted++;
                } catch (Exception e) {
                    log.warn("Failed to persist article '{}' from {}: {}",
                            raw.title(), slug, e.getMessage());
                }
            }

            log.info("Poll complete for {}: {} persisted, {} duplicates, {} filtered",
                    slug, persisted, duplicates, filtered);

        } catch (Exception e) {
            log.error("Poll failed for {}: {}", slug, e.getMessage(), e);
            deadLetterService.recordFailure(source, e.getMessage(), null);
        }
    }

    /**
     * Truncates a string to the given maximum length, returning null for null input.
     */
    protected static String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
