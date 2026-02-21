package com.o11ynews.dto;

import java.time.Instant;
import java.util.Map;

public record UserDTO(
    Long id,
    String username,
    Map<String, Object> preferences,
    Instant createdAt
) {}
