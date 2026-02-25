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
 *
 * Backend selection priority (highest to lowest):
 *   1. ClickHouse  — when LOCAL_OTEL_CLICKHOUSE_URL is set (local stack with ClickHouse)
 *   2. Dash0       — when DASH0_API_TOKEN is non-blank (cloud SaaS)
 *   3. Local       — Jaeger (traces) + Prometheus (metrics), legacy local stack
 */
@Service
public class TelemetryService {

    // PromQL queries used by the Jaeger+Prometheus / Dash0 backends
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
    private final LocalTelemetryClient localClient;
    private final ClickHouseTelemetryClient clickHouseClient;
    private final PiiRedactionService piiRedactionService;
    private final SessionCorrelationService sessionCorrelationService;
    private final Dash0Properties properties;

    public TelemetryService(Dash0ApiClient dash0ApiClient,
                            LocalTelemetryClient localClient,
                            ClickHouseTelemetryClient clickHouseClient,
                            PiiRedactionService piiRedactionService,
                            SessionCorrelationService sessionCorrelationService,
                            Dash0Properties properties) {
        this.dash0ApiClient            = dash0ApiClient;
        this.localClient               = localClient;
        this.clickHouseClient          = clickHouseClient;
        this.piiRedactionService       = piiRedactionService;
        this.sessionCorrelationService = sessionCorrelationService;
        this.properties                = properties;
    }

    /** ClickHouse takes priority over both Dash0 and legacy local (Jaeger+Prometheus). */
    private boolean useClickHouse() {
        return clickHouseClient.isEnabled();
    }

    /** Legacy Jaeger+Prometheus path — only when no ClickHouse and no Dash0 token. */
    private boolean useLocal() {
        return !useClickHouse() && properties.getApi().getAuthToken().isBlank();
    }

    // -------------------------------------------------------------------------
    // Traces
    // -------------------------------------------------------------------------

    @WithSpan
    public List<TraceDTO> getRecentTraces(String sessionId, int timeRangeMinutes) {
        int limit = properties.getTelemetry().getMaxTraces() * 4;
        List<Dash0Span> spans = useClickHouse()
                ? clickHouseClient.querySpans(timeRangeMinutes, false, limit)
                : useLocal()
                        ? localClient.querySpans(timeRangeMinutes, false, limit)
                        : dash0ApiClient.querySpans(timeRangeMinutes, false, limit);
        return buildTraceDTOs(spans, sessionId);
    }

    @WithSpan
    public List<TraceDTO> getRecentErrorTraces(String sessionId, int timeRangeMinutes) {
        int limit = properties.getTelemetry().getMaxTraces() * 4;
        List<Dash0Span> spans = useClickHouse()
                ? clickHouseClient.querySpans(timeRangeMinutes, true, limit)
                : useLocal()
                        ? localClient.querySpans(timeRangeMinutes, true, limit)
                        : dash0ApiClient.querySpans(timeRangeMinutes, true, limit);
        return buildTraceDTOs(spans, sessionId);
    }

    private List<TraceDTO> buildTraceDTOs(List<Dash0Span> spans, String sessionId) {
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
        Dash0Span root = traceSpans.stream()
                .filter(s -> s.parentSpanId() == null || s.parentSpanId().isBlank())
                .findFirst()
                .orElse(traceSpans.stream()
                        .min(Comparator.comparing(s -> s.startTimeUnixNano() != null ? s.startTimeUnixNano() : 0L))
                        .orElse(traceSpans.getFirst()));

        boolean hasError = traceSpans.stream()
                .anyMatch(s -> "ERROR".equalsIgnoreCase(s.statusCode()));

        long minNano = traceSpans.stream()
                .mapToLong(s -> s.startTimeUnixNano() != null ? s.startTimeUnixNano() : 0L)
                .min().orElse(0L);
        long totalDurationMs = traceSpans.stream()
                .mapToLong(Dash0Span::durationMsSafe)
                .max().orElse(0L);

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

    @WithSpan
    public List<SpanDTO> getTraceSpans(String traceId, int timeRangeMinutes) {
        int limit = properties.getTelemetry().getMaxTraces() * 8;
        List<Dash0Span> spans = useClickHouse()
                ? clickHouseClient.querySpans(timeRangeMinutes, false, limit)
                : useLocal()
                        ? localClient.querySpans(timeRangeMinutes, false, limit)
                        : dash0ApiClient.querySpans(timeRangeMinutes, false, limit);
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

    @WithSpan
    public MetricsSummaryDTO getMetricsSummary() {
        if (useClickHouse()) {
            return getMetricsSummaryFromClickHouse();
        }
        return getMetricsSummaryFromPromQL();
    }

    /**
     * Derives RED metrics from otel_traces (request rate, error rate, latency)
     * and infra metrics from otel_metrics_* tables (JVM heap, DB connections,
     * circuit breakers). Falls back gracefully to 0 when tables are empty.
     */
    private MetricsSummaryDTO getMetricsSummaryFromClickHouse() {
        double requestRate         = clickHouseClient.getRequestRate();
        double errorRate           = clickHouseClient.getErrorRate();
        double[] latency           = clickHouseClient.getLatencyPercentiles();
        double heapMb              = clickHouseClient.getJvmHeapMb();
        long activeDb              = clickHouseClient.getActiveDbConnections();
        Map<String, String> pollerStatuses = clickHouseClient.getCircuitBreakerStates();

        return new MetricsSummaryDTO(
                requestRate,
                latency[0],
                latency[1],
                latency[2],
                Double.isNaN(errorRate) ? 0.0 : errorRate,
                pollerStatuses,
                heapMb,
                activeDb,
                Instant.now()
        );
    }

    /** Original PromQL path — used for Dash0 cloud and legacy Jaeger+Prometheus. */
    private MetricsSummaryDTO getMetricsSummaryFromPromQL() {
        double requestRate = metric(PROM_REQUEST_RATE);
        double errorRate   = metric(PROM_ERROR_RATE);
        double p50         = metric(PROM_LATENCY_P50);
        double p95         = metric(PROM_LATENCY_P95);
        double p99         = metric(PROM_LATENCY_P99);
        double heapMb      = metric(PROM_JVM_HEAP);
        long activeDb      = (long) metric(PROM_DB_CONNECTIONS);
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

    private double metric(String promQuery) {
        return useLocal()
                ? localClient.queryInstantMetric(promQuery).orElse(0.0)
                : dash0ApiClient.queryInstantMetric(promQuery).orElse(0.0);
    }

    private Map<String, String> resolvePollerStatuses() {
        List<PrometheusResult> results = useLocal()
                ? localClient.queryInstantMetrics(PROM_CIRCUIT_BREAKERS)
                : dash0ApiClient.queryInstantMetrics(PROM_CIRCUIT_BREAKERS);
        Map<String, String> statuses = new LinkedHashMap<>();

        for (PrometheusResult result : results) {
            Map<String, String> labels = result.metric();
            if (labels == null) continue;
            String name  = labels.get("name");
            String state = labels.get("state");
            if (name == null || state == null) continue;

            double value = 0.0;
            if (result.value() != null && result.value().size() >= 2) {
                try { value = Double.parseDouble(result.value().get(1).toString()); }
                catch (NumberFormatException ignored) {}
            }
            if (value == 1.0) {
                statuses.put(name, state.toUpperCase());
            } else {
                statuses.putIfAbsent(name, "UNKNOWN");
            }
        }
        return statuses;
    }

    // -------------------------------------------------------------------------
    // Logs
    // -------------------------------------------------------------------------

    @WithSpan
    public List<LogEntryDTO> getRecentLogs(int timeRangeMinutes, String minSeverity) {
        int limit = properties.getTelemetry().getMaxLogs();
        List<Dash0Log> logs = useClickHouse()
                ? clickHouseClient.queryLogs(timeRangeMinutes, minSeverity, limit)
                : useLocal()
                        ? localClient.queryLogs(timeRangeMinutes, minSeverity, limit)
                        : dash0ApiClient.queryLogs(timeRangeMinutes, minSeverity, limit);
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

    @WithSpan
    public ServiceMapDTO getServiceMap() {
        int limit = properties.getTelemetry().getMaxTraces() * 8;
        List<Dash0Span> spans = useClickHouse()
                ? clickHouseClient.querySpans(15, false, limit)
                : useLocal()
                        ? localClient.querySpans(15, false, limit)
                        : dash0ApiClient.querySpans(15, false, limit);

        Map<String, ServiceNode> nodes = new LinkedHashMap<>();
        nodes.put(SERVICE, new ServiceNode(SERVICE, "o11y-news (backend)", "backend"));
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
            if ("ERROR".equalsIgnoreCase(span.statusCode())) edgeCounts.get(edgeKey)[1]++;
        }

        double windowMinutes = 15.0;
        List<ServiceEdge> edges = edgeCounts.entrySet().stream()
                .map(e -> {
                    long[] counts  = e.getValue();
                    double rpm     = counts[0] / windowMinutes;
                    double errRate = counts[0] > 0 ? (double) counts[1] / counts[0] : 0.0;
                    String[] parts = e.getKey().split("->");
                    return new ServiceEdge(parts[0], parts[1], rpm, errRate);
                })
                .toList();

        return new ServiceMapDTO(new ArrayList<>(nodes.values()), edges);
    }

    private String resolveTarget(Map<String, Object> attrs) {
        if (attrs.containsKey("db.system")) {
            Object dbSystem = attrs.get("db.system");
            Object dbName   = attrs.get("db.name");
            return dbName != null ? dbSystem + ":" + dbName : dbSystem.toString();
        }
        if (attrs.containsKey("peer.service"))  return attrs.get("peer.service").toString();
        if (attrs.containsKey("server.address")) return attrs.get("server.address").toString();
        if (attrs.containsKey("http.host"))      return attrs.get("http.host").toString();
        return null;
    }
}
