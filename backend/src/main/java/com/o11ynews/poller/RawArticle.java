package com.o11ynews.poller;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record RawArticle(
    String externalId,
    String title,
    String url,
    String author,
    String contentSnippet,
    Instant publishedAt,
    int score,
    List<String> tags,
    Map<String, Object> metadata
) {}
