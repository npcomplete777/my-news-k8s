package com.o11ynews.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ArticleDetailDTO(
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
    Map<String, Object> metadata
) {}
