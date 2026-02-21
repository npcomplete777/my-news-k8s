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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * HTTP client for the Dash0 REST API.
 *
 * Endpoints used:
 *   Spans:   GET  /api/v1/datasets/{dataset}/telemetry/spans
 *   Logs:    GET  /api/v1/datasets/{dataset}/telemetry/logs
 *   Metrics: GET  /api/v1/datasets/{dataset}/prometheus/api/v1/query  (PromQL instant query)
 *
 * Authentication: Authorization: Bearer {DASH0_API_TOKEN}
 *
 * NOTE: If the Dash0 REST API paths differ from the above, update the *_PATH constants.
 * Response models use @JsonIgnoreProperties(ignoreUnknown=true) to tolerate schema
 * differences without failing hard.
 */
@Component
public class Dash0ApiClient {

    private static final Logger log = LoggerFactory.getLogger(Dash0ApiClient.class);

    // API path templates — update if Dash0 REST API paths differ from these
    private static final String SPANS_PATH   = "/api/v1/datasets/{dataset}/telemetry/spans";
    private static final String LOGS_PATH    = "/api/v1/datasets/{dataset}/telemetry/logs";
    private static final String METRICS_PATH = "/api/v1/datasets/{dataset}/prometheus/api/v1/query";

    private final RestClient client;
    private final Dash0Properties properties;

    public Dash0ApiClient(RestClient restClient, Dash0Properties properties) {
        this.properties = properties;
        // Use .mutate() to copy existing configuration (timeouts, etc.) and add Dash0-specific headers.
        // This avoids mutating the shared RestClient.Builder singleton.
        this.client = restClient.mutate()
                .baseUrl(properties.getApi().getBaseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApi().getAuthToken())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // -------------------------------------------------------------------------
    // Spans
    // -------------------------------------------------------------------------

    /**
     * Queries recent spans for the o11y-news service from Dash0.
     *
     * @param timeRangeMinutes look-back window
     * @param errorOnly        if true, returns only ERROR-status spans
     * @param limit            max number of spans to return
     */
    public List<Dash0Span> querySpans(int timeRangeMinutes, boolean errorOnly, int limit) {
        if (properties.getApi().getAuthToken().isBlank()) {
            log.debug("DASH0_API_TOKEN not configured — skipping spans query");
            return Collections.emptyList();
        }
        try {
            String dataset = properties.getApi().getDataset();
            Instant from = Instant.now().minusSeconds((long) timeRangeMinutes * 60);

            Dash0SpansResponse response = client.get()
                    .uri(builder -> {
                        var b = builder
                                .path(SPANS_PATH)
                                .queryParam("service.name", "o11y-news")
                                .queryParam("from", from.toString())
                                .queryParam("limit", limit);
                        if (errorOnly) {
                            b = b.queryParam("error", true);
                        }
                        return b.build(dataset);
                    })
                    .retrieve()
                    .body(Dash0SpansResponse.class);

            return response != null && response.spans() != null ? response.spans() : Collections.emptyList();

        } catch (RestClientException e) {
            log.warn("Dash0 spans query failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    // -------------------------------------------------------------------------
    // Logs
    // -------------------------------------------------------------------------

    /**
     * Queries recent structured logs for the o11y-news service from Dash0.
     *
     * @param timeRangeMinutes look-back window
     * @param minSeverity      minimum severity ("INFO", "WARN", "ERROR", etc.); null for all
     * @param limit            max number of log entries to return
     */
    public List<Dash0Log> queryLogs(int timeRangeMinutes, String minSeverity, int limit) {
        if (properties.getApi().getAuthToken().isBlank()) {
            log.debug("DASH0_API_TOKEN not configured — skipping logs query");
            return Collections.emptyList();
        }
        try {
            String dataset = properties.getApi().getDataset();
            Instant from = Instant.now().minusSeconds((long) timeRangeMinutes * 60);

            Dash0LogsResponse response = client.get()
                    .uri(builder -> {
                        var b = builder
                                .path(LOGS_PATH)
                                .queryParam("service.name", "o11y-news")
                                .queryParam("from", from.toString())
                                .queryParam("limit", limit)
                                .queryParamIfPresent("min_severity",
                                        minSeverity != null ? Optional.of(minSeverity) : Optional.empty());
                        return b.build(dataset);
                    })
                    .retrieve()
                    .body(Dash0LogsResponse.class);

            return response != null && response.logs() != null ? response.logs() : Collections.emptyList();

        } catch (RestClientException e) {
            log.warn("Dash0 logs query failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    // -------------------------------------------------------------------------
    // Metrics (PromQL instant query)
    // -------------------------------------------------------------------------

    /**
     * Executes a PromQL instant query against the Dash0 Prometheus-compatible API.
     * Returns the first scalar result value, or empty if no data or an error occurs.
     */
    public Optional<Double> queryInstantMetric(String promQuery) {
        if (properties.getApi().getAuthToken().isBlank()) {
            return Optional.empty();
        }
        try {
            String dataset = properties.getApi().getDataset();
            long now = Instant.now().getEpochSecond();

            PrometheusResponse response = client.get()
                    .uri(builder -> builder
                            .path(METRICS_PATH)
                            .queryParam("query", promQuery)
                            .queryParam("time", now)
                            .build(dataset))
                    .retrieve()
                    .body(PrometheusResponse.class);

            return extractFirstScalar(response);

        } catch (RestClientException e) {
            log.warn("Dash0 metrics query failed for '{}': {}", promQuery, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Executes a PromQL instant query and returns all result series.
     * Useful for multi-label queries such as circuit breaker state gauges.
     */
    public List<PrometheusResult> queryInstantMetrics(String promQuery) {
        if (properties.getApi().getAuthToken().isBlank()) {
            return Collections.emptyList();
        }
        try {
            String dataset = properties.getApi().getDataset();
            long now = Instant.now().getEpochSecond();

            PrometheusResponse response = client.get()
                    .uri(builder -> builder
                            .path(METRICS_PATH)
                            .queryParam("query", promQuery)
                            .queryParam("time", now)
                            .build(dataset))
                    .retrieve()
                    .body(PrometheusResponse.class);

            if (response == null || response.data() == null || response.data().result() == null) {
                return Collections.emptyList();
            }
            return response.data().result();

        } catch (RestClientException e) {
            log.warn("Dash0 metrics query failed for '{}': {}", promQuery, e.getMessage());
            return Collections.emptyList();
        }
    }

    private Optional<Double> extractFirstScalar(PrometheusResponse response) {
        if (response == null || response.data() == null || response.data().result() == null
                || response.data().result().isEmpty()) {
            return Optional.empty();
        }
        PrometheusResult first = response.data().result().getFirst();
        // "vector" result: value = [unixTimestamp, "valueString"]
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
    // Raw Dash0 API response models (internal — never exposed directly to frontend)
    // =========================================================================

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Dash0SpansResponse(
            @JsonProperty("spans") List<Dash0Span> spans,
            @JsonProperty("nextPageToken") String nextPageToken
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Dash0Span(
            @JsonProperty("traceId") String traceId,
            @JsonProperty("spanId") String spanId,
            @JsonProperty("parentSpanId") String parentSpanId,
            @JsonProperty("name") String name,
            @JsonProperty("kind") String kind,
            @JsonProperty("serviceName") String serviceName,
            @JsonProperty("startTimeUnixNano") Long startTimeUnixNano,
            @JsonProperty("durationMs") Long durationMs,
            @JsonProperty("statusCode") String statusCode,
            @JsonProperty("attributes") Map<String, Object> attributes,
            @JsonProperty("events") List<Map<String, Object>> events
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

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Dash0LogsResponse(
            @JsonProperty("logs") List<Dash0Log> logs
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Dash0Log(
            @JsonProperty("timestamp") String timestamp,
            @JsonProperty("severityText") String severityText,
            @JsonProperty("severityNumber") Integer severityNumber,
            @JsonProperty("body") String body,
            @JsonProperty("traceId") String traceId,
            @JsonProperty("spanId") String spanId,
            @JsonProperty("serviceName") String serviceName,
            @JsonProperty("attributes") Map<String, Object> attributes
    ) {
        /** Parses the ISO-8601 timestamp string; returns Instant.EPOCH on failure. */
        public Instant parsedTimestamp() {
            if (timestamp == null) return Instant.EPOCH;
            try {
                return Instant.parse(timestamp);
            } catch (Exception e) {
                return Instant.EPOCH;
            }
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PrometheusResponse(
            @JsonProperty("status") String status,
            @JsonProperty("data") PrometheusData data
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PrometheusData(
            @JsonProperty("resultType") String resultType,
            @JsonProperty("result") List<PrometheusResult> result
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PrometheusResult(
            @JsonProperty("metric") Map<String, String> metric,
            @JsonProperty("value") List<Object> value    // [unixTimestamp, "valueString"] for vector resultType
    ) {}
}
