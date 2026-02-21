package com.o11ynews.telemetry;

import java.time.Instant;

/**
 * Summary of a distributed trace returned by GET /api/telemetry/traces.
 * Groups all spans with the same traceId into a single record.
 */
public record TraceDTO(
        String traceId,
        String rootSpanName,
        String serviceName,
        long durationMs,
        int spanCount,
        String status,          // "OK", "ERROR", "UNSET"
        Instant startTime,
        boolean isCurrentSession
) {}
