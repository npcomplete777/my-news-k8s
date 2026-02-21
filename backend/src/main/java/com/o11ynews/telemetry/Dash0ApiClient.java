package com.o11ynews.telemetry;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

/**
 * HTTP client for the Dash0 REST API.
 *
 * Endpoints used (verified Feb 2026):
 *   Spans:   POST /api/spans   — OTLP JSON response (resourceSpans array)
 *   Logs:    POST /api/logs    — OTLP JSON response (resourceLogs array)
 *   Metrics: GET  /api/prometheus/api/v1/query  — Prometheus-compatible instant query
 *
 * Authentication: Authorization: Bearer {DASH0_API_TOKEN}
 *
 * NOTE: This class uses only opentelemetry-api interfaces (@WithSpan, Span.current(), etc.).
 * The actual OTel implementation is injected by the Dash0 operator's auto-instrumentation
 * agent — no OTel SDK is bundled in this application.
 */
@Component
public class Dash0ApiClient {

    private static final Logger log = LoggerFactory.getLogger(Dash0ApiClient.class);

    private static final String SPANS_PATH   = "/api/spans";
    private static final String LOGS_PATH    = "/api/logs";
    private static final String METRICS_PATH = "/api/prometheus/api/v1/query";

    // OTLP span kind int → human-readable string (index = kind value)
    private static final String[] SPAN_KINDS   = {"UNSET", "INTERNAL", "SERVER", "CLIENT", "PRODUCER", "CONSUMER"};
    // OTLP status code int → string used by TelemetryService (index = code value)
    private static final String[] STATUS_CODES = {"UNSET", "OK", "ERROR"};

    private final RestClient client;
    private final Dash0Properties properties;

    public Dash0ApiClient(RestClient restClient, Dash0Properties properties) {
        this.properties = properties;
        this.client = restClient.mutate()
                .baseUrl(properties.getApi().getBaseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApi().getAuthToken())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // =========================================================================
    // Spans
    // =========================================================================

    /**
     * Queries recent spans from Dash0 via POST /api/spans.
     *
     * @param timeRangeMinutes look-back window
     * @param errorOnly        client-side filter: only ERROR spans returned when true
     * @param limit            max spans to request
     */
    public List<Dash0Span> querySpans(int timeRangeMinutes, boolean errorOnly, int limit) {
        if (properties.getApi().getAuthToken().isBlank()) {
            log.debug("DASH0_API_TOKEN not configured — skipping spans query");
            return Collections.emptyList();
        }
        try {
            Instant now  = Instant.now();
            Instant from = now.minusSeconds((long) timeRangeMinutes * 60);
            OtlpRequest req = new OtlpRequest(Map.of(), new TimeRange(from.toString(), now.toString()), limit);

            OtlpSpansResponse response = client.post()
                    .uri(SPANS_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(req)
                    .retrieve()
                    .body(OtlpSpansResponse.class);

            if (response == null || response.resourceSpans() == null) return Collections.emptyList();

            return response.resourceSpans().stream()
                    .flatMap(rs -> {
                        String svc = extractServiceName(rs.resource());
                        if (rs.scopeSpans() == null) return Stream.empty();
                        return rs.scopeSpans().stream()
                                .filter(ss -> ss.spans() != null)
                                .flatMap(ss -> ss.spans().stream().map(s -> toSpan(s, svc)));
                    })
                    .filter(s -> !errorOnly || "ERROR".equals(s.statusCode()))
                    .toList();

        } catch (RestClientException e) {
            log.warn("Dash0 spans query failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    // =========================================================================
    // Logs
    // =========================================================================

    /**
     * Queries recent log records from Dash0 via POST /api/logs.
     *
     * @param timeRangeMinutes look-back window
     * @param minSeverity      minimum severity text; null returns all
     * @param limit            max log records to request
     */
    public List<Dash0Log> queryLogs(int timeRangeMinutes, String minSeverity, int limit) {
        if (properties.getApi().getAuthToken().isBlank()) {
            log.debug("DASH0_API_TOKEN not configured — skipping logs query");
            return Collections.emptyList();
        }
        try {
            Instant now  = Instant.now();
            Instant from = now.minusSeconds((long) timeRangeMinutes * 60);
            OtlpRequest req = new OtlpRequest(Map.of(), new TimeRange(from.toString(), now.toString()), limit);

            OtlpLogsResponse response = client.post()
                    .uri(LOGS_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(req)
                    .retrieve()
                    .body(OtlpLogsResponse.class);

            if (response == null || response.resourceLogs() == null) return Collections.emptyList();

            int minSevNum = parseSeverityNumber(minSeverity);

            return response.resourceLogs().stream()
                    .flatMap(rl -> {
                        String svc = extractServiceName(rl.resource());
                        if (rl.scopeLogs() == null) return Stream.empty();
                        return rl.scopeLogs().stream()
                                .filter(sl -> sl.logRecords() != null)
                                .flatMap(sl -> sl.logRecords().stream().map(lr -> toLog(lr, svc)));
                    })
                    .filter(l -> l.severityNumber() == null || l.severityNumber() >= minSevNum)
                    .toList();

        } catch (RestClientException e) {
            log.warn("Dash0 logs query failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    // =========================================================================
    // Metrics — Prometheus-compatible instant query
    // =========================================================================

    /** Executes a PromQL instant query and returns the first scalar value, or empty. */
    public Optional<Double> queryInstantMetric(String promQuery) {
        if (properties.getApi().getAuthToken().isBlank()) return Optional.empty();
        try {
            long now = Instant.now().getEpochSecond();
            PrometheusResponse resp = client.get()
                    .uri(b -> b.path(METRICS_PATH)
                               .queryParam("query", promQuery)
                               .queryParam("time", now)
                               .build())
                    .retrieve()
                    .body(PrometheusResponse.class);
            return extractFirstScalar(resp);
        } catch (RestClientException e) {
            log.warn("Dash0 metrics query failed for '{}': {}", promQuery, e.getMessage());
            return Optional.empty();
        }
    }

    /** Executes a PromQL instant query and returns all result series (for multi-label queries). */
    public List<PrometheusResult> queryInstantMetrics(String promQuery) {
        if (properties.getApi().getAuthToken().isBlank()) return Collections.emptyList();
        try {
            long now = Instant.now().getEpochSecond();
            PrometheusResponse resp = client.get()
                    .uri(b -> b.path(METRICS_PATH)
                               .queryParam("query", promQuery)
                               .queryParam("time", now)
                               .build())
                    .retrieve()
                    .body(PrometheusResponse.class);
            if (resp == null || resp.data() == null || resp.data().result() == null) return Collections.emptyList();
            return resp.data().result();
        } catch (RestClientException e) {
            log.warn("Dash0 metrics query failed for '{}': {}", promQuery, e.getMessage());
            return Collections.emptyList();
        }
    }

    // =========================================================================
    // Conversion helpers — OTLP → Dash0Span / Dash0Log
    // =========================================================================

    private String extractServiceName(OtlpResource resource) {
        if (resource == null || resource.attributes() == null) return null;
        return resource.attributes().stream()
                .filter(a -> "service.name".equals(a.key()))
                .findFirst()
                .map(OtlpAttribute::stringValue)
                .orElse(null);
    }

    private Dash0Span toSpan(OtlpSpan s, String serviceName) {
        long startNano  = parseLong(s.startTimeUnixNano());
        long endNano    = parseLong(s.endTimeUnixNano());
        long durationMs = (endNano > startNano) ? (endNano - startNano) / 1_000_000L : 0L;

        return new Dash0Span(
                b64ToHex(s.traceId()),
                b64ToHex(s.spanId()),
                b64ToHex(s.parentSpanId()),
                s.name(),
                kindToString(s.kind()),
                serviceName,
                startNano > 0 ? startNano : null,
                durationMs,
                statusToString(s.status()),
                toAttributeMap(s.attributes()),
                s.events()
        );
    }

    private Dash0Log toLog(OtlpLogRecord lr, String serviceName) {
        return new Dash0Log(
                lr.timeUnixNano(),
                lr.severityText(),
                lr.severityNumber(),
                bodyToString(lr.body()),
                b64ToHex(lr.traceId()),
                b64ToHex(lr.spanId()),
                serviceName,
                toAttributeMap(lr.attributes())
        );
    }

    /** Decodes a base64 byte string to lowercase hex. Returns null for blank input. */
    private String b64ToHex(String base64) {
        if (base64 == null || base64.isBlank()) return null;
        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (IllegalArgumentException e) {
            return base64; // already hex or non-base64 format
        }
    }

    private long parseLong(String s) {
        if (s == null || s.isBlank()) return 0L;
        try { return Long.parseLong(s); } catch (NumberFormatException e) { return 0L; }
    }

    private String kindToString(int kind) {
        return (kind >= 0 && kind < SPAN_KINDS.length) ? SPAN_KINDS[kind] : "UNSET";
    }

    private String statusToString(OtlpStatus status) {
        if (status == null) return "UNSET";
        int code = status.code();
        return (code >= 0 && code < STATUS_CODES.length) ? STATUS_CODES[code] : "UNSET";
    }

    private Map<String, Object> toAttributeMap(List<OtlpAttribute> attrs) {
        if (attrs == null || attrs.isEmpty()) return Map.of();
        Map<String, Object> map = new LinkedHashMap<>(attrs.size());
        for (OtlpAttribute a : attrs) {
            if (a.key() != null) map.put(a.key(), a.getValue());
        }
        return map;
    }

    /** OTLP log body is often {"stringValue": "..."} — extracts text, falls back to toString. */
    private String bodyToString(Object body) {
        if (body == null) return null;
        if (body instanceof Map<?, ?> m) {
            Object sv = m.get("stringValue");
            if (sv != null) return sv.toString();
        }
        return body.toString();
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

    private Optional<Double> extractFirstScalar(PrometheusResponse response) {
        if (response == null || response.data() == null || response.data().result() == null
                || response.data().result().isEmpty()) {
            return Optional.empty();
        }
        PrometheusResult first = response.data().result().getFirst();
        if (first.value() != null && first.value().size() >= 2) {
            try {
                return Optional.of(Double.parseDouble(first.value().get(1).toString()));
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    // =========================================================================
    // Internal request/response POJOs — OTLP JSON format
    // =========================================================================

    record OtlpRequest(
            @JsonProperty("filters")   Map<String, Object> filters,
            @JsonProperty("timeRange") TimeRange timeRange,
            @JsonProperty("limit")     int limit
    ) {}

    record TimeRange(
            @JsonProperty("from") String from,
            @JsonProperty("to")   String to
    ) {}

    // — spans —

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpSpansResponse(
            @JsonProperty("resourceSpans") List<OtlpResourceSpans> resourceSpans
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpResourceSpans(
            @JsonProperty("resource")   OtlpResource resource,
            @JsonProperty("scopeSpans") List<OtlpScopeSpans> scopeSpans
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpScopeSpans(
            @JsonProperty("spans") List<OtlpSpan> spans
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpSpan(
            @JsonProperty("traceId")           String traceId,
            @JsonProperty("spanId")            String spanId,
            @JsonProperty("parentSpanId")      String parentSpanId,
            @JsonProperty("name")              String name,
            @JsonProperty("kind")              int kind,
            @JsonProperty("status")            OtlpStatus status,
            @JsonProperty("startTimeUnixNano") String startTimeUnixNano,
            @JsonProperty("endTimeUnixNano")   String endTimeUnixNano,
            @JsonProperty("attributes")        List<OtlpAttribute> attributes,
            @JsonProperty("events")            List<Map<String, Object>> events
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpStatus(
            @JsonProperty("code")    int code,
            @JsonProperty("message") String message
    ) {}

    // — logs —

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpLogsResponse(
            @JsonProperty("resourceLogs") List<OtlpResourceLogs> resourceLogs
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpResourceLogs(
            @JsonProperty("resource")  OtlpResource resource,
            @JsonProperty("scopeLogs") List<OtlpScopeLogs> scopeLogs
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpScopeLogs(
            @JsonProperty("logRecords") List<OtlpLogRecord> logRecords
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpLogRecord(
            @JsonProperty("timeUnixNano")   String timeUnixNano,
            @JsonProperty("severityText")   String severityText,
            @JsonProperty("severityNumber") Integer severityNumber,
            @JsonProperty("body")           Object body,
            @JsonProperty("traceId")        String traceId,
            @JsonProperty("spanId")         String spanId,
            @JsonProperty("attributes")     List<OtlpAttribute> attributes
    ) {}

    // — shared —

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpResource(
            @JsonProperty("attributes") List<OtlpAttribute> attributes
    ) {}

    /** OTLP attribute: key + typed value map (stringValue / intValue / boolValue / doubleValue). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record OtlpAttribute(
            @JsonProperty("key")   String key,
            @JsonProperty("value") Map<String, Object> value
    ) {
        /** Returns the scalar value from the OTLP value map. */
        public Object getValue() {
            if (value == null || value.isEmpty()) return null;
            return value.values().iterator().next();
        }

        /** Returns the stringValue if the attribute value is a string, null otherwise. */
        public String stringValue() {
            if (value == null) return null;
            Object sv = value.get("stringValue");
            return sv != null ? sv.toString() : null;
        }
    }

    // =========================================================================
    // Public output records — consumed by TelemetryService (interface kept stable)
    // =========================================================================

    /** Flattened span record derived from OTLP resourceSpans. */
    public record Dash0Span(
            String traceId,
            String spanId,
            String parentSpanId,
            String name,
            String kind,
            String serviceName,
            Long startTimeUnixNano,
            Long durationMs,
            String statusCode,
            Map<String, Object> attributes,
            List<Map<String, Object>> events
    ) {
        /** Converts startTimeUnixNano to Instant; returns Instant.EPOCH if unavailable. */
        public Instant startTime() {
            if (startTimeUnixNano == null || startTimeUnixNano == 0L) return Instant.EPOCH;
            return Instant.ofEpochSecond(0, startTimeUnixNano);
        }

        /** Returns durationMs, defaulting to 0 if null. */
        public long durationMsSafe() {
            return durationMs != null ? durationMs : 0L;
        }
    }

    /** Flattened log record derived from OTLP resourceLogs. */
    public record Dash0Log(
            String timeUnixNano,
            String severityText,
            Integer severityNumber,
            String body,
            String traceId,
            String spanId,
            String serviceName,
            Map<String, Object> attributes
    ) {
        /** Parses timeUnixNano (nanoseconds as string) to Instant; falls back to ISO parse; returns EPOCH on failure. */
        public Instant parsedTimestamp() {
            if (timeUnixNano == null) return Instant.EPOCH;
            try {
                return Instant.ofEpochSecond(0, Long.parseLong(timeUnixNano));
            } catch (NumberFormatException e) {
                try { return Instant.parse(timeUnixNano); } catch (Exception ex) { return Instant.EPOCH; }
            }
        }
    }

    // =========================================================================
    // Prometheus response models (standard Prometheus JSON format)
    // =========================================================================

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PrometheusResponse(
            @JsonProperty("status") String status,
            @JsonProperty("data")   PrometheusData data
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PrometheusData(
            @JsonProperty("resultType") String resultType,
            @JsonProperty("result")     List<PrometheusResult> result
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PrometheusResult(
            @JsonProperty("metric") Map<String, String> metric,
            @JsonProperty("value")  List<Object> value
    ) {}
}
