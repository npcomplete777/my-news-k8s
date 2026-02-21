package com.o11ynews.controller;

import com.o11ynews.dto.ArticleDTO;
import com.o11ynews.dto.ArticleDetailDTO;
import com.o11ynews.entity.User;
import com.o11ynews.service.ArticleService;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/articles")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @WithSpan
    @GetMapping
    public ResponseEntity<Page<ArticleDTO>> listArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "publishedAt,desc") String sort,
            @RequestParam(required = false) List<String> source,
            @RequestParam(required = false) List<String> tag,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @PageableDefault(size = 25, sort = "publishedAt", direction = org.springframework.data.domain.Sort.Direction.DESC) Pageable pageable,
            HttpServletRequest request) {

        User user = getAuthenticatedUser(request);
        Long userId = user != null ? user.getId() : null;
        Page<ArticleDTO> articles = articleService.getArticles(source, tag, unreadOnly, userId, pageable);
        return ResponseEntity.ok(articles);
    }

    @WithSpan
    @GetMapping("/{id}")
    public ResponseEntity<ArticleDetailDTO> getArticle(
            @PathVariable Long id,
            HttpServletRequest request) {

        User user = getAuthenticatedUser(request);
        Long userId = user != null ? user.getId() : null;
        ArticleDetailDTO article = articleService.getArticle(id, userId);
        return ResponseEntity.ok(article);
    }

    @WithSpan
    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long id,
            HttpServletRequest request) {

        User user = getAuthenticatedUser(request);
        articleService.markAsRead(id, user.getId());
        return ResponseEntity.noContent().build();
    }

    private User getAuthenticatedUser(HttpServletRequest request) {
        return (User) request.getAttribute("authenticatedUser");
    }
}
