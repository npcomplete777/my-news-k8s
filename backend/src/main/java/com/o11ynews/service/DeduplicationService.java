package com.o11ynews.service;

import com.o11ynews.repository.ArticleRepository;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Service
public class DeduplicationService {

    private static final Logger log = LoggerFactory.getLogger(DeduplicationService.class);

    private final ArticleRepository articleRepository;

    public DeduplicationService(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    /**
     * Normalizes a URL by stripping protocol, "www." prefix, trailing slash,
     * query parameters, and fragment identifiers, then lowercasing.
     */
    public String normalizeUrl(String url) {
        if (url == null || url.isBlank()) {
            return "";
        }

        String normalized = url.strip().toLowerCase();

        // Strip protocol
        if (normalized.startsWith("https://")) {
            normalized = normalized.substring(8);
        } else if (normalized.startsWith("http://")) {
            normalized = normalized.substring(7);
        }

        // Strip www. prefix
        if (normalized.startsWith("www.")) {
            normalized = normalized.substring(4);
        }

        // Strip fragment
        int fragmentIdx = normalized.indexOf('#');
        if (fragmentIdx >= 0) {
            normalized = normalized.substring(0, fragmentIdx);
        }

        // Strip query params
        int queryIdx = normalized.indexOf('?');
        if (queryIdx >= 0) {
            normalized = normalized.substring(0, queryIdx);
        }

        // Strip trailing slash
        if (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        return normalized;
    }

    /**
     * Computes the SHA-256 hex hash of a normalized URL string.
     */
    public String computeHash(String normalizedUrl) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(normalizedUrl.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * Checks if an article with the same normalized URL already exists.
     */
    @WithSpan("article.deduplicate")
    public boolean isDuplicate(String url) {
        String normalized = normalizeUrl(url);
        String hash = computeHash(normalized);
        return articleRepository.existsByDedupHash(hash);
    }

    /**
     * Checks for fuzzy title duplicates within the last 7 days using
     * Levenshtein distance. A title is considered a duplicate if its
     * edit distance is less than 20% of the title length.
     */
    @WithSpan("article.deduplicate")
    public boolean isTitleDuplicate(String title, Instant since) {
        if (title == null || title.isBlank()) {
            return false;
        }

        Instant cutoff = since != null ? since : Instant.now().minus(7, ChronoUnit.DAYS);
        String normalizedTitle = title.strip().toLowerCase();
        int maxDistance = Math.max(1, normalizedTitle.length() / 5); // 20% threshold

        // Fetch recent articles and check Levenshtein distance
        var recentArticles = articleRepository.findAllByOrderByPublishedAtDesc(
                org.springframework.data.domain.PageRequest.of(0, 500));

        return recentArticles.getContent().stream()
                .filter(a -> a.getPublishedAt() != null && a.getPublishedAt().isAfter(cutoff))
                .anyMatch(a -> {
                    String existingTitle = a.getTitle().strip().toLowerCase();
                    int distance = levenshteinDistance(normalizedTitle, existingTitle);
                    return distance < maxDistance;
                });
    }

    /**
     * Computes the Levenshtein (edit) distance between two strings.
     */
    static int levenshteinDistance(String a, String b) {
        int lenA = a.length();
        int lenB = b.length();

        // Optimization: if length difference exceeds any reasonable threshold, skip
        if (Math.abs(lenA - lenB) > Math.max(lenA, lenB) / 3) {
            return Math.max(lenA, lenB);
        }

        int[] prev = new int[lenB + 1];
        int[] curr = new int[lenB + 1];

        for (int j = 0; j <= lenB; j++) {
            prev[j] = j;
        }

        for (int i = 1; i <= lenA; i++) {
            curr[0] = i;
            for (int j = 1; j <= lenB; j++) {
                int cost = (a.charAt(i - 1) == b.charAt(j - 1)) ? 0 : 1;
                curr[j] = Math.min(
                        Math.min(curr[j - 1] + 1, prev[j] + 1),
                        prev[j - 1] + cost
                );
            }
            int[] tmp = prev;
            prev = curr;
            curr = tmp;
        }

        return prev[lenB];
    }
}
