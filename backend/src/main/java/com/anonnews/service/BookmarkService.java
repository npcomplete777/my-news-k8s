package com.anonnews.service;

import com.anonnews.dto.ArticleDTO;
import com.anonnews.entity.Article;
import com.anonnews.entity.Bookmark;
import com.anonnews.entity.User;
import com.anonnews.repository.ArticleRepository;
import com.anonnews.repository.BookmarkRepository;
import com.anonnews.repository.UserRepository;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookmarkService {

    private final BookmarkRepository bookmarkRepository;
    private final ArticleRepository articleRepository;
    private final UserRepository userRepository;
    private final ArticleService articleService;

    public BookmarkService(BookmarkRepository bookmarkRepository,
                           ArticleRepository articleRepository,
                           UserRepository userRepository,
                           ArticleService articleService) {
        this.bookmarkRepository = bookmarkRepository;
        this.articleRepository = articleRepository;
        this.userRepository = userRepository;
        this.articleService = articleService;
    }

    @WithSpan("bookmarks.list")
    @Transactional(readOnly = true)
    public Page<ArticleDTO> getBookmarks(Long userId, Pageable pageable) {
        Page<Bookmark> bookmarks = bookmarkRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        return bookmarks.map(bookmark -> articleService.toDTO(bookmark.getArticle(), userId));
    }

    @WithSpan("bookmarks.add")
    @Transactional
    public void addBookmark(Long userId, Long articleId) {
        if (bookmarkRepository.existsByUserIdAndArticleId(userId, articleId)) {
            return; // Already bookmarked
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        Article article = articleRepository.findById(articleId)
                .orElseThrow(() -> new IllegalArgumentException("Article not found: " + articleId));

        var bookmark = new Bookmark();
        bookmark.setUser(user);
        bookmark.setArticle(article);
        bookmarkRepository.save(bookmark);
    }

    @WithSpan("bookmarks.remove")
    @Transactional
    public void removeBookmark(Long userId, Long articleId) {
        bookmarkRepository.deleteByUserIdAndArticleId(userId, articleId);
    }
}
