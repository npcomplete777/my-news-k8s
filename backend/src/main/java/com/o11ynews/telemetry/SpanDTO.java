package com.o11ynews.telemetry;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Detail for a single span, returned as part of trace detail queries.
 * PII attributes are redacted before this DTO is populated.
 */
public record SpanDTO(
        String spanId,
        String parentSpanId,
        String traceId,
        String name,
        String serviceName,
        Instant startTime,
        long durationMs,
        String status,          // "OK", "ERROR", "UNSET"
        String kind,            // "SERVER", "CLIENT", "INTERNAL", "PRODUCER", "CONSUMER"
        Map<String, Object> attributes,
        List<Map<String, Object>> events
) {}
