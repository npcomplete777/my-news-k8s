package com.o11ynews.telemetry;

import com.o11ynews.telemetry.Dash0ApiClient.Dash0Log;
import com.o11ynews.telemetry.Dash0ApiClient.Dash0Span;
import com.o11ynews.telemetry.Dash0ApiClient.PrometheusResult;
import com.o11ynews.telemetry.ServiceMapDTO.ServiceEdge;
import com.o11ynews.telemetry.ServiceMapDTO.ServiceNode;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Business logic for the Telemetry API.
 * Queries the Dash0ApiClient, transforms raw spans/logs into frontend DTOs,
 * applies PII redaction, and flags traces belonging to the current browser session.
 */
@Service
public class TelemetryService {

    // PromQL queries (service_name label uses underscore per OTel Prometheus bridge convention)
    private static final String SERVICE = "o11y-news";
    private static final String PROM_REQUEST_RATE =
            "sum(rate(http_server_request_duration_seconds_count{service_name=\"" + SERVICE + "\"}[5m]))";
    private static final String PROM_ERROR_RATE =
            "sum(rate(http_server_request_duration_seconds_count{service_name=\"" + SERVICE + "\",http_response_status_code=~\"5..\"}[5m]))"
            + " / sum(rate(http_server_request_duration_seconds_count{service_name=\"" + SERVICE + "\"}[5m]))";
    private static final String PROM_LATENCY_P50 =
            "histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"" + SERVICE + "\"}[5m])) by (le)) * 1000";
    private static final String PROM_LATENCY_P95 =
            "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"" + SERVICE + "\"}[5m])) by (le)) * 1000";
    private static final String PROM_LATENCY_P99 =
            "histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"" + SERVICE + "\"}[5m])) by (le)) * 1000";
    private static final String PROM_JVM_HEAP =
            "sum(jvm_memory_used_bytes{service_name=\"" + SERVICE + "\",area=\"heap\"}) / 1048576";
    private static final String PROM_DB_CONNECTIONS =
            "hikaricp_connections_active{service_name=\"" + SERVICE + "\"}";
    private static final String PROM_CIRCUIT_BREAKERS =
            "resilience4j_circuitbreaker_state{service_name=\"" + SERVICE + "\"}";

    private final Dash0ApiClient dash0ApiClient;
    private final PiiRedactionService piiRedactionService;
    private final SessionCorrelationService sessionCorrelationService;
    private final Dash0Properties properties;

    public TelemetryService(Dash0ApiClient dash0ApiClient,
                            PiiRedactionService piiRedactionService,
                            SessionCorrelationService sessionCorrelationService,
                            Dash0Properties properties) {
        this.dash0ApiClient = dash0ApiClient;
        this.piiRedactionService = piiRedactionService;
        this.sessionCorrelationService = sessionCorrelationService;
        this.properties = properties;
    }

    // -------------------------------------------------------------------------
    // Traces
    // -------------------------------------------------------------------------

    /**
     * Returns recent traces (grouped from spans), sorted newest-first.
     * Traces belonging to the current browser session are flagged with isCurrentSession=true.
     */
    @WithSpan
    public List<TraceDTO> getRecentTraces(String sessionId, int timeRangeMinutes) {
        int limit = properties.getTelemetry().getMaxTraces() * 4; // fetch more spans than traces needed
        List<Dash0Span> spans = dash0ApiClient.querySpans(timeRangeMinutes, false, limit);
        return buildTraceDTOs(spans, sessionId);
    }

    /**
     * Returns recent error-only traces.
     */
    @WithSpan
    public List<TraceDTO> getRecentErrorTraces(String sessionId, int timeRangeMinutes) {
        int limit = properties.getTelemetry().getMaxTraces() * 4;
        List<Dash0Span> spans = dash0ApiClient.querySpans(timeRangeMinutes, true, limit);
        return buildTraceDTOs(spans, sessionId);
    }

    private List<TraceDTO> buildTraceDTOs(List<Dash0Span> spans, String sessionId) {
        // Group spans by traceId
        Map<String, List<Dash0Span>> byTrace = spans.stream()
                .filter(s -> s.traceId() != null)
                .collect(Collectors.groupingBy(Dash0Span::traceId));

        return byTrace.values().stream()
                .map(traceSpans -> buildTraceDTO(traceSpans, sessionId))
                .sorted(Comparator.comparing(TraceDTO::startTime).reversed())
                .limit(properties.getTelemetry().getMaxTraces())
                .toList();
    }

    private TraceDTO buildTraceDTO(List<Dash0Span> traceSpans, String sessionId) {
        // Root span: no parentSpanId or the one with the earliest start time
        Dash0Span root = traceSpans.stream()
                .filter(s -> s.parentSpanId() == null || s.parentSpanId().isBlank())
                .findFirst()
                .orElse(traceSpans.stream()
                        .min(Comparator.comparing(s -> s.startTimeUnixNano() != null ? s.startTimeUnixNano() : 0L))
                        .orElse(traceSpans.getFirst()));

        // Aggregate error status: if any span has ERROR, the trace is ERROR
        boolean hasError = traceSpans.stream()
                .anyMatch(s -> "ERROR".equalsIgnoreCase(s.statusCode()));

        // Total trace duration: from earliest start to latest end
        long minNano = traceSpans.stream()
                .mapToLong(s -> s.startTimeUnixNano() != null ? s.startTimeUnixNano() : 0L)
                .min().orElse(0L);
        long totalDurationMs = traceSpans.stream()
                .mapToLong(Dash0Span::durationMsSafe)
                .max().orElse(0L);

        // Check if this trace belongs to the current browser session
        boolean isCurrentSession = sessionId != null && traceSpans.stream()
                .anyMatch(s -> s.attributes() != null
                        && sessionCorrelationService.isCurrentSession(
                                sessionId, s.attributes().get("app.session.id")));

        return new TraceDTO(
                root.traceId(),
                root.name(),
                root.serviceName() != null ? root.serviceName() : SERVICE,
                totalDurationMs,
                traceSpans.size(),
                hasError ? "ERROR" : "OK",
                Instant.ofEpochSecond(0, minNano > 0 ? minNano : Instant.now().toEpochMilli() * 1_000_000L),
                isCurrentSession
        );
    }

    /**
     * Returns span details for a single trace (all spans with the given traceId).
     * PII attributes are redacted.
     */
    @WithSpan
    public List<SpanDTO> getTraceSpans(String traceId, int timeRangeMinutes) {
        List<Dash0Span> spans = dash0ApiClient.querySpans(timeRangeMinutes, false,
                properties.getTelemetry().getMaxTraces() * 8);
        return spans.stream()
                .filter(s -> traceId.equals(s.traceId()))
                .map(this::toSpanDTO)
                .sorted(Comparator.comparing(SpanDTO::startTime))
                .toList();
    }

    private SpanDTO toSpanDTO(Dash0Span s) {
        return new SpanDTO(
                s.spanId(),
                s.parentSpanId(),
                s.traceId(),
                s.name(),
                s.serviceName() != null ? s.serviceName() : SERVICE,
                s.startTime(),
                s.durationMsSafe(),
                s.statusCode() != null ? s.statusCode() : "UNSET",
                s.kind() != null ? s.kind() : "INTERNAL",
                piiRedactionService.redact(s.attributes() != null ? s.attributes() : Map.of()),
                s.events() != null ? s.events() : List.of()
        );
    }

    // -------------------------------------------------------------------------
    // Metrics
    // -------------------------------------------------------------------------

    /**
     * Returns a live metrics snapshot from PromQL queries against Dash0.
     */
    @WithSpan
    public MetricsSummaryDTO getMetricsSummary() {
        double requestRate = dash0ApiClient.queryInstantMetric(PROM_REQUEST_RATE).orElse(0.0);
        double errorRate   = dash0ApiClient.queryInstantMetric(PROM_ERROR_RATE).orElse(0.0);
        double p50         = dash0ApiClient.queryInstantMetric(PROM_LATENCY_P50).orElse(0.0);
        double p95         = dash0ApiClient.queryInstantMetric(PROM_LATENCY_P95).orElse(0.0);
        double p99         = dash0ApiClient.queryInstantMetric(PROM_LATENCY_P99).orElse(0.0);
        double heapMb      = dash0ApiClient.queryInstantMetric(PROM_JVM_HEAP).orElse(0.0);
        long activeDb      = dash0ApiClient.queryInstantMetric(PROM_DB_CONNECTIONS)
                                 .map(Double::longValue).orElse(0L);

        Map<String, String> pollerStatuses = resolvePollerStatuses();

        return new MetricsSummaryDTO(
                requestRate,
                p50,
                p95,
                p99,
                Double.isNaN(errorRate) ? 0.0 : errorRate,
                pollerStatuses,
                heapMb,
                activeDb,
                Instant.now()
        );
    }

    /**
     * Resolves each resilience4j circuit breaker's current state by finding the
     * state gauge with value=1 across all circuit breaker series.
     */
    private Map<String, String> resolvePollerStatuses() {
        List<PrometheusResult> results = dash0ApiClient.queryInstantMetrics(PROM_CIRCUIT_BREAKERS);
        Map<String, String> statuses = new LinkedHashMap<>();

        for (PrometheusResult result : results) {
            Map<String, String> labels = result.metric();
            if (labels == null) continue;

            String name  = labels.get("name");
            String state = labels.get("state");
            if (name == null || state == null) continue;

            // The gauge is 1 for the currently active state, 0 for others
            double value = 0.0;
            if (result.value() != null && result.value().size() >= 2) {
                try { value = Double.parseDouble(result.value().get(1).toString()); }
                catch (NumberFormatException ignored) {}
            }

            if (value == 1.0) {
                statuses.put(name, state.toUpperCase());
            } else {
                // Ensure the poller appears in the map even if only 0-value entries seen so far
                statuses.putIfAbsent(name, "UNKNOWN");
            }
        }
        return statuses;
    }

    // -------------------------------------------------------------------------
    // Logs
    // -------------------------------------------------------------------------

    /**
     * Returns recent structured log entries with PII attributes redacted.
     */
    @WithSpan
    public List<LogEntryDTO> getRecentLogs(int timeRangeMinutes, String minSeverity) {
        int limit = properties.getTelemetry().getMaxLogs();
        List<Dash0Log> logs = dash0ApiClient.queryLogs(timeRangeMinutes, minSeverity, limit);
        return logs.stream()
                .map(this::toLogEntryDTO)
                .sorted(Comparator.comparing(LogEntryDTO::timestamp).reversed())
                .toList();
    }

    private LogEntryDTO toLogEntryDTO(Dash0Log l) {
        return new LogEntryDTO(
                l.parsedTimestamp(),
                l.severityText() != null ? l.severityText() : severityFromNumber(l.severityNumber()),
                l.body(),
                l.traceId(),
                l.spanId(),
                l.serviceName() != null ? l.serviceName() : SERVICE,
                piiRedactionService.redact(l.attributes() != null ? l.attributes() : Map.of())
        );
    }

    private String severityFromNumber(Integer severityNumber) {
        if (severityNumber == null) return "INFO";
        if (severityNumber >= 21) return "FATAL";
        if (severityNumber >= 17) return "ERROR";
        if (severityNumber >= 13) return "WARN";
        if (severityNumber >= 9)  return "INFO";
        if (severityNumber >= 5)  return "DEBUG";
        return "TRACE";
    }

    // -------------------------------------------------------------------------
    // Service Map
    // -------------------------------------------------------------------------

    /**
     * Derives a service topology graph from recent span data.
     *
     * Nodes:
     *   - Always includes "o11y-news" (the backend)
     *   - CLIENT/PRODUCER spans with db.system attribute → database nodes
     *   - CLIENT spans with http.url/server.address → external API nodes
     *
     * Edges: one per (source, target) pair, with aggregated request count and error fraction.
     */
    @WithSpan
    public ServiceMapDTO getServiceMap() {
        List<Dash0Span> spans = dash0ApiClient.querySpans(15, false,
                properties.getTelemetry().getMaxTraces() * 8);

        Map<String, ServiceNode> nodes = new LinkedHashMap<>();
        nodes.put(SERVICE, new ServiceNode(SERVICE, "o11y-news (backend)", "backend"));

        // edge key → [total, errors]
        Map<String, long[]> edgeCounts = new LinkedHashMap<>();

        for (Dash0Span span : spans) {
            Map<String, Object> attrs = span.attributes() != null ? span.attributes() : Map.of();
            String kind = span.kind();
            if (!"CLIENT".equalsIgnoreCase(kind) && !"PRODUCER".equalsIgnoreCase(kind)) continue;

            String target = resolveTarget(attrs);
            if (target == null) continue;

            String nodeType = attrs.containsKey("db.system") ? "database" : "external";
            nodes.putIfAbsent(target, new ServiceNode(target, target, nodeType));

            String edgeKey = SERVICE + "->" + target;
            edgeCounts.computeIfAbsent(edgeKey, k -> new long[]{0, 0});
            edgeCounts.get(edgeKey)[0]++;
            if ("ERROR".equalsIgnoreCase(span.statusCode())) {
                edgeCounts.get(edgeKey)[1]++;
            }
        }

        // Convert edge counts to rates (assuming 15m window)
        double windowMinutes = 15.0;
        List<ServiceEdge> edges = edgeCounts.entrySet().stream()
                .map(e -> {
                    long[] counts = e.getValue();
                    double rpm = counts[0] / windowMinutes;
                    double errRate = counts[0] > 0 ? (double) counts[1] / counts[0] : 0.0;
                    String[] parts = e.getKey().split("->");
                    return new ServiceEdge(parts[0], parts[1], rpm, errRate);
                })
                .toList();

        return new ServiceMapDTO(new ArrayList<>(nodes.values()), edges);
    }

    private String resolveTarget(Map<String, Object> attrs) {
        // Database spans
        if (attrs.containsKey("db.system")) {
            Object dbSystem = attrs.get("db.system");
            Object dbName = attrs.get("db.name");
            return dbName != null ? dbSystem + ":" + dbName : dbSystem.toString();
        }
        // HTTP client spans — use peer.service if available, otherwise server.address
        if (attrs.containsKey("peer.service")) {
            return attrs.get("peer.service").toString();
        }
        if (attrs.containsKey("server.address")) {
            return attrs.get("server.address").toString();
        }
        if (attrs.containsKey("http.host")) {
            return attrs.get("http.host").toString();
        }
        return null;
    }
}
