package com.anonnews.controller;

import com.anonnews.dto.ArticleDTO;
import com.anonnews.entity.User;
import com.anonnews.service.SearchService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public ResponseEntity<Page<ArticleDTO>> search(
            @RequestParam String q,
            @PageableDefault(size = 25) Pageable pageable,
            HttpServletRequest request) {

        if (q == null || q.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        User user = getAuthenticatedUser(request);
        Long userId = user != null ? user.getId() : null;
        Page<ArticleDTO> results = searchService.search(q, userId, pageable);
        return ResponseEntity.ok(results);
    }

    private User getAuthenticatedUser(HttpServletRequest request) {
        return (User) request.getAttribute("authenticatedUser");
    }
}
