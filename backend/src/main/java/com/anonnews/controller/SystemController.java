package com.anonnews.controller;

import com.anonnews.entity.DeadLetter;
import com.anonnews.service.DeadLetterService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class SystemController {

    private final DeadLetterService deadLetterService;

    public SystemController(DeadLetterService deadLetterService) {
        this.deadLetterService = deadLetterService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    @GetMapping("/dead-letters")
    public ResponseEntity<Page<DeadLetter>> listDeadLetters(
            @RequestParam(defaultValue = "PENDING") String status,
            @PageableDefault(size = 25) Pageable pageable) {

        Page<DeadLetter> deadLetters = deadLetterService.getDeadLetters(status, pageable);
        return ResponseEntity.ok(deadLetters);
    }

    @PostMapping("/dead-letters/{id}/retry")
    public ResponseEntity<Void> retryDeadLetter(@PathVariable Long id) {
        deadLetterService.retryDeadLetter(id);
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
}
