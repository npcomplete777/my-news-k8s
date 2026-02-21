package com.o11ynews.telemetry;

import java.time.Instant;
import java.util.Map;

/**
 * Aggregated live metrics returned by GET /api/telemetry/metrics.
 * Derived from PromQL queries against the Dash0 Prometheus-compatible API.
 */
public record MetricsSummaryDTO(
        double requestRate,           // requests per second (past 5m window)
        double latencyP50Ms,          // p50 latency in milliseconds
        double latencyP95Ms,          // p95 latency in milliseconds
        double latencyP99Ms,          // p99 latency in milliseconds
        double errorRate,             // fraction 0.0–1.0 (5xx / total)
        Map<String, String> pollerStatuses,  // {"reddit": "CLOSED", "hackernews": "OPEN", ...}
        double jvmHeapUsedMb,         // JVM heap used in MiB
        long activeDbConnections,     // HikariCP active connection count
        Instant updatedAt
) {}
