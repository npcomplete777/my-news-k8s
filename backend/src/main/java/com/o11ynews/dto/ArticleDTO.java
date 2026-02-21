package com.o11ynews.dto;

import java.time.Instant;
import java.util.List;

public record ArticleDTO(
    Long id,
    String source,
    String title,
    String url,
    String author,
    String contentSnippet,
    Instant publishedAt,
    int score,
    List<String> tags,
    boolean read,
    boolean bookmarked,
    String thumbnailUrl
) {}
