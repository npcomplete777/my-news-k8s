package com.o11ynews.telemetry;

import java.time.Instant;
import java.util.Map;

/**
 * A single structured log record returned by GET /api/telemetry/logs.
 * PII attributes are redacted before this DTO is populated.
 */
public record LogEntryDTO(
        Instant timestamp,
        String severity,        // "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"
        String body,
        String traceId,
        String spanId,
        String serviceName,
        Map<String, Object> attributes
) {}
