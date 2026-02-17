package com.anonnews.dto;

import java.util.Map;

public record FeedSourceDTO(
    Long id,
    String name,
    String slug,
    int pollInterval,
    boolean enabled,
    Map<String, Object> configJson
) {}
