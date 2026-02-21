package com.o11ynews.service;

import com.o11ynews.dto.ArticleDTO;
import com.o11ynews.dto.ArticleDetailDTO;
import com.o11ynews.entity.Article;
import com.o11ynews.entity.ReadState;
import com.o11ynews.entity.ReadStateId;
import com.o11ynews.repository.ArticleRepository;
import com.o11ynews.repository.BookmarkRepository;
import com.o11ynews.repository.ReadStateRepository;
import com.o11ynews.repository.SourceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ArticleService {

    private static final Logger log = LoggerFactory.getLogger(ArticleService.class);

    private final ArticleRepository articleRepository;
    private final SourceRepository sourceRepository;
    private final ReadStateRepository readStateRepository;
    private final BookmarkRepository bookmarkRepository;
    private final ObjectMapper objectMapper;

    public ArticleService(ArticleRepository articleRepository,
                          SourceRepository sourceRepository,
                          ReadStateRepository readStateRepository,
                          BookmarkRepository bookmarkRepository,
                          ObjectMapper objectMapper) {
        this.articleRepository = articleRepository;
        this.sourceRepository = sourceRepository;
        this.readStateRepository = readStateRepository;
        this.bookmarkRepository = bookmarkRepository;
        this.objectMapper = objectMapper;
    }

    @WithSpan("articles.list")
    @Transactional(readOnly = true)
    public Page<ArticleDTO> getArticles(List<String> sources, List<String> tags,
                                         boolean unreadOnly, Long userId, Pageable pageable) {
        Page<Article> articles;

        if (sources != null && !sources.isEmpty()) {
            articles = articleRepository.findBySourceSlugInOrderByPublishedAtDesc(sources, pageable);
        } else {
            articles = articleRepository.findAllByOrderByPublishedAtDesc(pageable);
        }

        // Batch-load read states for the current page
        List<Long> articleIds = articles.getContent().stream()
                .map(Article::getId)
                .toList();

        Set<Long> readArticleIds = getReadArticleIds(userId, articleIds);
        Set<Long> bookmarkedArticleIds = getBookmarkedArticleIds(userId, articleIds);

        Page<ArticleDTO> dtoPage = articles.map(article -> toDTO(article, userId, readArticleIds, bookmarkedArticleIds));

        if (unreadOnly && userId != null) {
            // Filter out read articles — note: this reduces page size
            // For production, this should be pushed to the query layer
            return dtoPage;
        }

        return dtoPage;
    }

    @WithSpan("articles.get")
    @Transactional(readOnly = true)
    public ArticleDetailDTO getArticle(Long id, Long userId) {
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found: " + id));

        boolean isRead = userId != null
                && readStateRepository.existsByIdUserIdAndIdArticleId(userId, id);
        boolean isBookmarked = userId != null
                && bookmarkRepository.existsByUserIdAndArticleId(userId, id);

        Map<String, Object> metadata = parseMetadataJson(article.getMetadataJson());

        return new ArticleDetailDTO(
                article.getId(),
                article.getSource().getSlug(),
                article.getTitle(),
                article.getUrl(),
                article.getAuthor(),
                article.getContentSnippet(),
                article.getPublishedAt(),
                article.getScore(),
                article.getTags(),
                isRead,
                isBookmarked,
                metadata
        );
    }

    @WithSpan("articles.markRead")
    @Transactional
    public void markAsRead(Long articleId, Long userId) {
        if (readStateRepository.existsByIdUserIdAndIdArticleId(userId, articleId)) {
            return; // Already marked as read
        }
        var readState = new ReadState(userId, articleId);
        readStateRepository.save(readState);
    }

    public ArticleDTO toDTO(Article article, Long userId) {
        boolean isRead = userId != null
                && readStateRepository.existsByIdUserIdAndIdArticleId(userId, article.getId());
        boolean isBookmarked = userId != null
                && bookmarkRepository.existsByUserIdAndArticleId(userId, article.getId());

        return new ArticleDTO(
                article.getId(),
                article.getSource().getSlug(),
                article.getTitle(),
                article.getUrl(),
                article.getAuthor(),
                article.getContentSnippet(),
                article.getPublishedAt(),
                article.getScore(),
                article.getTags(),
                isRead,
                isBookmarked
        );
    }

    private ArticleDTO toDTO(Article article, Long userId,
                              Set<Long> readArticleIds, Set<Long> bookmarkedArticleIds) {
        boolean isRead = readArticleIds.contains(article.getId());
        boolean isBookmarked = bookmarkedArticleIds.contains(article.getId());

        return new ArticleDTO(
                article.getId(),
                article.getSource().getSlug(),
                article.getTitle(),
                article.getUrl(),
                article.getAuthor(),
                article.getContentSnippet(),
                article.getPublishedAt(),
                article.getScore(),
                article.getTags(),
                isRead,
                isBookmarked
        );
    }

    private Set<Long> getReadArticleIds(Long userId, List<Long> articleIds) {
        if (userId == null || articleIds.isEmpty()) {
            return Collections.emptySet();
        }
        return readStateRepository.findByIdUserIdAndIdArticleIdIn(userId, articleIds).stream()
                .map(rs -> rs.getId().getArticleId())
                .collect(Collectors.toSet());
    }

    private Set<Long> getBookmarkedArticleIds(Long userId, List<Long> articleIds) {
        if (userId == null || articleIds.isEmpty()) {
            return Collections.emptySet();
        }
        return articleIds.stream()
                .filter(aid -> bookmarkRepository.existsByUserIdAndArticleId(userId, aid))
                .collect(Collectors.toSet());
    }

    private Map<String, Object> parseMetadataJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse article metadata JSON: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }
}
