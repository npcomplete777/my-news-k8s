package com.o11ynews.controller;

import com.o11ynews.dto.ArticleDTO;
import com.o11ynews.dto.BookmarkRequest;
import com.o11ynews.entity.User;
import com.o11ynews.service.BookmarkService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bookmarks")
public class BookmarkController {

    private final BookmarkService bookmarkService;

    public BookmarkController(BookmarkService bookmarkService) {
        this.bookmarkService = bookmarkService;
    }

    @GetMapping
    public ResponseEntity<Page<ArticleDTO>> listBookmarks(
            @PageableDefault(size = 25) Pageable pageable,
            HttpServletRequest request) {

        User user = getAuthenticatedUser(request);
        Page<ArticleDTO> bookmarks = bookmarkService.getBookmarks(user.getId(), pageable);
        return ResponseEntity.ok(bookmarks);
    }

    @PostMapping
    public ResponseEntity<Void> addBookmark(
            @RequestBody BookmarkRequest bookmarkRequest,
            HttpServletRequest request) {

        User user = getAuthenticatedUser(request);
        bookmarkService.addBookmark(user.getId(), bookmarkRequest.articleId());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{articleId}")
    public ResponseEntity<Void> removeBookmark(
            @PathVariable Long articleId,
            HttpServletRequest request) {

        User user = getAuthenticatedUser(request);
        bookmarkService.removeBookmark(user.getId(), articleId);
        return ResponseEntity.noContent().build();
    }

    private User getAuthenticatedUser(HttpServletRequest request) {
        return (User) request.getAttribute("authenticatedUser");
    }
}
