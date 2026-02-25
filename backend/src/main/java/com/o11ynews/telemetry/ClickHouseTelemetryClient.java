package com.o11ynews.telemetry;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.o11ynews.telemetry.Dash0ApiClient.Dash0Log;
import com.o11ynews.telemetry.Dash0ApiClient.Dash0Span;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.*;

/**
 * Telemetry backend that reads directly from the in-cluster ClickHouse instance.
 *
 * Data is written by the OTel Collector via a Null-engine ingest table (traces_raw,
 * logs_raw, metrics_gauge_raw) which triggers Materialized Views that transform,
 * extract hot attributes, and write to optimized MergeTree target tables (traces,
 * logs, metrics_gauge). This gives extracted top-level columns (HttpMethod,
 * K8sNamespace, HttpStatusCode, etc.) for primary-key-level query performance.
 *
 * This client replaces LocalTelemetryClient (Jaeger + Prometheus) when
 * LOCAL_OTEL_CLICKHOUSE_URL is set. It uses the ClickHouse HTTP API (port 8123)
 * with FORMAT JSONEachRow — no extra JDBC dependency needed.
 *
 * ClickHouse → Dash0Span field mapping:
 *   StatusCode: "Unset"→"UNSET", "Ok"→"OK", "Error"→"ERROR"
 *   SpanKind:   "Server"→"SERVER", "Client"→"CLIENT", etc.
 *   Duration:   nanoseconds → divide by 1_000_000 for ms
 */
@Component
public class ClickHouseTelemetryClient {

    private static final Logger log = LoggerFactory.getLogger(ClickHouseTelemetryClient.class);

    private static final String SERVICE = "o11y-news";
    // Metric windows (minutes) used for derived metrics
    private static final int RATE_WINDOW_MINUTES  = 5;
    private static final int GAUGE_LOOKBACK_MINUTES = 2;

    private final RestClient http;
    private final ObjectMapper mapper;
    private final boolean enabled;

    public ClickHouseTelemetryClient(
            @Value("${local.otel.clickhouse-url:}") String clickhouseUrl,
            ObjectMapper objectMapper) {
        this.mapper  = objectMapper;
        this.enabled = !clickhouseUrl.isBlank();
        this.http    = RestClient.builder()
                .baseUrl(enabled ? clickhouseUrl : "http://localhost:8123")
                .build();
        if (enabled) {
            log.info("ClickHouseTelemetryClient enabled — endpoint: {}", clickhouseUrl);
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    // =========================================================================
    // Spans
    // =========================================================================

    /**
     * Returns spans from otel_traces for the given time window.
     * SpanKind and StatusCode values are normalised to uppercase to match
     * the Dash0Span contract used by TelemetryService.
     */
    public List<Dash0Span> querySpans(int timeRangeMinutes, boolean errorOnly, int limit) {
        String errorFilter = errorOnly ? " AND StatusCode = 'Error'" : "";
        String sql = """
                SELECT
                    TraceId,
                    SpanId,
                    ParentSpanId,
                    SpanName,
                    SpanKind,
                    ServiceName,
                    toUnixTimestamp64Nano(Timestamp) AS StartNano,
                    Duration,
                    StatusCode,
                    SpanAttributes,
                    Events.Name,
                    Events.Timestamp,
                    Events.Attributes
                FROM traces
                WHERE Timestamp >= now() - INTERVAL %d MINUTE
                  AND ServiceName = '%s'
                  %s
                ORDER BY Timestamp DESC
                LIMIT %d
                """.formatted(timeRangeMinutes, SERVICE, errorFilter, limit);

        List<Map<String, Object>> rows = queryRows(sql);
        List<Dash0Span> spans = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            try {
                spans.add(rowToSpan(row));
            } catch (Exception e) {
                log.debug("Skipping malformed span row: {}", e.getMessage());
            }
        }
        return spans;
    }

    private Dash0Span rowToSpan(Map<String, Object> r) {
        String traceId      = str(r, "TraceId");
        String spanId       = str(r, "SpanId");
        String parentSpanId = str(r, "ParentSpanId");
        String name         = str(r, "SpanName");
        String kind         = normaliseKind(str(r, "SpanKind"));
        String serviceName  = str(r, "ServiceName");
        Long startNano      = toLong(r.get("StartNano"));
        Long durationNs     = toLong(r.get("Duration"));
        long durationMs     = durationNs != null ? durationNs / 1_000_000L : 0L;
        String statusCode   = normaliseStatus(str(r, "StatusCode"));

        // SpanAttributes is a Map<String, String> in ClickHouse JSON output
        Map<String, Object> attrs = toObjectMap(r.get("SpanAttributes"));

        // Events are stored as parallel arrays; reconstruct into list-of-maps
        List<Map<String, Object>> events = reconstructEvents(r);

        return new Dash0Span(
                traceId, spanId, parentSpanId, name, kind, serviceName,
                startNano, durationMs, statusCode, attrs, events
        );
    }

    // =========================================================================
    // Logs
    // =========================================================================

    /**
     * Returns log records from otel_logs. This previously returned an empty
     * list from LocalTelemetryClient (Jaeger doesn't store logs) — now it works.
     */
    public List<Dash0Log> queryLogs(int timeRangeMinutes, String minSeverity, int limit) {
        int minSevNum = parseSeverityNumber(minSeverity);
        String sevFilter = minSevNum > 0
                ? " AND SeverityNumber >= " + minSevNum
                : "";
        String sql = """
                SELECT
                    toString(toUnixTimestamp64Nano(Timestamp)) AS TimeUnixNano,
                    SeverityText,
                    SeverityNumber,
                    Body,
                    TraceId,
                    SpanId,
                    ServiceName,
                    LogAttributes
                FROM logs
                WHERE Timestamp >= now() - INTERVAL %d MINUTE
                  AND ServiceName = '%s'
                  %s
                ORDER BY Timestamp DESC
                LIMIT %d
                """.formatted(timeRangeMinutes, SERVICE, sevFilter, limit);

        List<Map<String, Object>> rows = queryRows(sql);
        List<Dash0Log> logs = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            try {
                logs.add(rowToLog(row));
            } catch (Exception e) {
                log.debug("Skipping malformed log row: {}", e.getMessage());
            }
        }
        return logs;
    }

    private Dash0Log rowToLog(Map<String, Object> r) {
        return new Dash0Log(
                str(r, "TimeUnixNano"),
                str(r, "SeverityText"),
                toInt(r.get("SeverityNumber")),
                str(r, "Body"),
                str(r, "TraceId"),
                str(r, "SpanId"),
                str(r, "ServiceName"),
                toObjectMap(r.get("LogAttributes"))
        );
    }

    // =========================================================================
    // Metrics — derived from otel_traces and otel_metrics_* tables
    // =========================================================================

    /**
     * Request rate in req/sec derived from server-side spans over the last
     * RATE_WINDOW_MINUTES minutes.
     */
    public double getRequestRate() {
        String sql = """
                SELECT count() / (%d * 60.0) AS rate
                FROM traces
                WHERE Timestamp >= now() - INTERVAL %d MINUTE
                  AND ServiceName = '%s'
                  AND SpanKind = 'Server'
                """.formatted(RATE_WINDOW_MINUTES, RATE_WINDOW_MINUTES, SERVICE);
        return scalarDouble(sql, "rate");
    }

    /**
     * Error rate as a fraction (0.0–1.0) of server spans that are ERROR,
     * over the last RATE_WINDOW_MINUTES minutes. Returns 0.0 when no traffic.
     */
    public double getErrorRate() {
        String sql = """
                SELECT
                    countIf(StatusCode = 'Error') AS errors,
                    count()                        AS total
                FROM traces
                WHERE Timestamp >= now() - INTERVAL %d MINUTE
                  AND ServiceName = '%s'
                  AND SpanKind = 'Server'
                """.formatted(RATE_WINDOW_MINUTES, SERVICE);

        List<Map<String, Object>> rows = queryRows(sql);
        if (rows.isEmpty()) return 0.0;
        Map<String, Object> row = rows.getFirst();
        double total  = toDouble(row.get("total"));
        double errors = toDouble(row.get("errors"));
        return total > 0 ? errors / total : 0.0;
    }

    /**
     * Returns [p50, p95, p99] latency in milliseconds, derived from server spans.
     * Duration column is stored in nanoseconds by the OTel ClickHouse exporter.
     */
    public double[] getLatencyPercentiles() {
        String sql = """
                SELECT
                    quantile(0.50)(Duration) / 1000000.0 AS p50,
                    quantile(0.95)(Duration) / 1000000.0 AS p95,
                    quantile(0.99)(Duration) / 1000000.0 AS p99
                FROM traces
                WHERE Timestamp >= now() - INTERVAL %d MINUTE
                  AND ServiceName = '%s'
                  AND SpanKind = 'Server'
                """.formatted(RATE_WINDOW_MINUTES, SERVICE);

        List<Map<String, Object>> rows = queryRows(sql);
        if (rows.isEmpty()) return new double[]{0, 0, 0};
        Map<String, Object> row = rows.getFirst();
        return new double[]{
                toDouble(row.get("p50")),
                toDouble(row.get("p95")),
                toDouble(row.get("p99"))
        };
    }

    /**
     * JVM heap used in megabytes from the most recent gauge data point.
     * OTel Java agent emits jvm.memory.used with jvm.memory.type=heap.
     */
    public double getJvmHeapMb() {
        // Try OTel semantic convention name first, fall back to Micrometer name
        for (String metricName : List.of("jvm.memory.used", "jvm_memory_used_bytes")) {
            String sql = """
                    SELECT Value / 1048576.0 AS heapMb
                    FROM metrics_gauge
                    WHERE MetricName = '%s'
                      AND (Attributes['jvm.memory.type'] = 'heap'
                           OR Attributes['area'] = 'heap')
                      AND TimeUnix >= now() - INTERVAL %d MINUTE
                    ORDER BY TimeUnix DESC
                    LIMIT 1
                    """.formatted(metricName, GAUGE_LOOKBACK_MINUTES);
            double val = scalarDouble(sql, "heapMb");
            if (val > 0) return val;
        }
        return 0.0;
    }

    /**
     * Active HikariCP database connections from the most recent gauge.
     * Tries OTel naming (db.client.connections.usage) and Micrometer naming.
     */
    public long getActiveDbConnections() {
        for (String metricName : List.of("db.client.connections.usage", "hikaricp.connections",
                                         "hikaricp.connections.active")) {
            String stateFilter = metricName.equals("db.client.connections.usage")
                    ? "AND (Attributes['state'] = 'used' OR Attributes['state'] = 'active')"
                    : "";
            String sql = """
                    SELECT Value AS connections
                    FROM metrics_gauge
                    WHERE MetricName = '%s'
                      %s
                      AND TimeUnix >= now() - INTERVAL %d MINUTE
                    ORDER BY TimeUnix DESC
                    LIMIT 1
                    """.formatted(metricName, stateFilter, GAUGE_LOOKBACK_MINUTES);
            double val = scalarDouble(sql, "connections");
            if (val > 0) return Math.round(val);
        }
        return 0L;
    }

    /**
     * Circuit breaker states from resilience4j.circuitbreaker.state gauge.
     * Returns a map of circuit-breaker name → active state (e.g. "CLOSED", "OPEN").
     * The gauge value is 1.0 for the currently active state, 0.0 for others.
     */
    public Map<String, String> getCircuitBreakerStates() {
        String sql = """
                SELECT
                    Attributes['name']  AS cbName,
                    Attributes['state'] AS cbState,
                    Value
                FROM metrics_gauge
                WHERE (MetricName = 'resilience4j.circuitbreaker.state'
                    OR MetricName = 'resilience4j_circuitbreaker_state')
                  AND TimeUnix >= now() - INTERVAL %d MINUTE
                ORDER BY TimeUnix DESC
                LIMIT 100
                """.formatted(GAUGE_LOOKBACK_MINUTES);

        List<Map<String, Object>> rows = queryRows(sql);
        Map<String, String> statuses = new LinkedHashMap<>();

        for (Map<String, Object> row : rows) {
            String name  = str(row, "cbName");
            String state = str(row, "cbState");
            double value = toDouble(row.get("Value"));
            if (name == null || state == null) continue;
            if (value == 1.0) {
                statuses.put(name, state.toUpperCase());
            } else {
                statuses.putIfAbsent(name, "UNKNOWN");
            }
        }
        return statuses;
    }

    // =========================================================================
    // ClickHouse HTTP query execution
    // =========================================================================

    /**
     * Executes a SQL query via ClickHouse HTTP API and returns rows as a list
     * of maps. The query must NOT include FORMAT — it is appended automatically.
     */
    private List<Map<String, Object>> queryRows(String sql) {
        if (!enabled) return List.of();
        try {
            String body = sql.strip() + "\nFORMAT JSONEachRow";
            String response = http.post()
                    .uri("/?database=otel&max_execution_time=10")
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            if (response == null || response.isBlank()) return List.of();

            List<Map<String, Object>> rows = new ArrayList<>();
            for (String line : response.split("\n")) {
                if (line.isBlank()) continue;
                try {
                    rows.add(mapper.readValue(line, new TypeReference<>() {}));
                } catch (Exception e) {
                    log.debug("Could not parse ClickHouse row: {}", e.getMessage());
                }
            }
            return rows;
        } catch (RestClientException e) {
            log.warn("ClickHouse query failed: {}", e.getMessage());
            return List.of();
        }
    }

    /** Executes a query and returns the named scalar column from the first row. */
    private double scalarDouble(String sql, String column) {
        List<Map<String, Object>> rows = queryRows(sql);
        if (rows.isEmpty()) return 0.0;
        return toDouble(rows.getFirst().get(column));
    }

    // =========================================================================
    // Conversion helpers
    // =========================================================================

    /** "Ok" → "OK", "Error" → "ERROR", "Unset" → "UNSET" */
    private static String normaliseStatus(String s) {
        if (s == null) return "UNSET";
        return switch (s) {
            case "Ok"    -> "OK";
            case "Error" -> "ERROR";
            default      -> "UNSET";
        };
    }

    /** "Server" → "SERVER", "Client" → "CLIENT", etc. */
    private static String normaliseKind(String s) {
        return s != null ? s.toUpperCase() : "INTERNAL";
    }

    private static String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        try { return Long.parseLong(v.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    private static double toDouble(Object v) {
        if (v == null) return 0.0;
        try { return Double.parseDouble(v.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }

    private static Integer toInt(Object v) {
        if (v == null) return null;
        try { return Integer.parseInt(v.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    /**
     * ClickHouse returns Map(String,String) columns as JSON objects.
     * Cast values to Object for compatibility with Dash0Span/Log attribute maps.
     */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> toObjectMap(Object v) {
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> result = new LinkedHashMap<>();
            m.forEach((k, val) -> result.put(k.toString(), val));
            return result;
        }
        return Map.of();
    }

    /**
     * ClickHouse Nested arrays are returned as parallel arrays per column.
     * Reconstruct into a list of {"name": ..., "attributes": ...} maps.
     */
    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> reconstructEvents(Map<String, Object> row) {
        Object namesObj = row.get("Events.Name");
        if (!(namesObj instanceof List<?> names)) return List.of();

        Object attrsObj = row.get("Events.Attributes");
        List<?> attrsList = attrsObj instanceof List<?> l ? l : List.of();

        List<Map<String, Object>> events = new ArrayList<>(names.size());
        for (int i = 0; i < names.size(); i++) {
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("name", names.get(i));
            if (i < attrsList.size()) event.put("attributes", attrsList.get(i));
            events.add(event);
        }
        return events;
    }

    private static int parseSeverityNumber(String minSeverity) {
        if (minSeverity == null || minSeverity.isBlank()) return 0;
        return switch (minSeverity.toUpperCase()) {
            case "FATAL" -> 21;
            case "ERROR" -> 17;
            case "WARN"  -> 13;
            case "INFO"  ->  9;
            case "DEBUG" ->  5;
            case "TRACE" ->  1;
            default      ->  0;
        };
    }
}
