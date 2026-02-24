package com.o11ynews.telemetry;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.o11ynews.telemetry.Dash0ApiClient.Dash0Log;
import com.o11ynews.telemetry.Dash0ApiClient.Dash0Span;
import com.o11ynews.telemetry.Dash0ApiClient.PrometheusResponse;
import com.o11ynews.telemetry.Dash0ApiClient.PrometheusResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

/**
 * Local telemetry client that queries Jaeger (traces) and Prometheus (metrics)
 * instead of the Dash0 cloud API.
 *
 * Used when DASH0_API_TOKEN is not configured. The OTel Java agent on the backend
 * sends OTLP to the in-cluster otelcol, which fans out to Jaeger and Prometheus.
 */
@Component
public class LocalTelemetryClient {

    private static final Logger log = LoggerFactory.getLogger(LocalTelemetryClient.class);

    private final RestClient jaeger;
    private final RestClient prometheus;

    public LocalTelemetryClient(
            @Value("${local.otel.jaeger-url:http://jaeger:16686}") String jaegerUrl,
            @Value("${local.otel.prometheus-url:http://prometheus:9090}") String prometheusUrl) {
        this.jaeger     = RestClient.builder().baseUrl(jaegerUrl).build();
        this.prometheus = RestClient.builder().baseUrl(prometheusUrl).build();
    }

    // =========================================================================
    // Spans — queried from Jaeger REST API
    // =========================================================================

    public List<Dash0Span> querySpans(int timeRangeMinutes, boolean errorOnly, int limit) {
        Instant now   = Instant.now();
        long endUs    = toMicros(now);
        long startUs  = toMicros(now.minusSeconds((long) timeRangeMinutes * 60));

        try {
            JaegerTracesResponse resp = jaeger.get()
                    .uri(b -> b.path("/api/traces")
                               .queryParam("service", "o11y-news")
                               .queryParam("start",  startUs)
                               .queryParam("end",    endUs)
                               .queryParam("limit",  limit)
                               .build())
                    .retrieve()
                    .body(JaegerTracesResponse.class);

            if (resp == null || resp.data() == null) return Collections.emptyList();

            return resp.data().stream()
                    .flatMap(t -> convertTrace(t).stream())
                    .filter(s -> !errorOnly || "ERROR".equals(s.statusCode()))
                    .toList();

        } catch (RestClientException e) {
            log.warn("Jaeger spans query failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public List<Dash0Log> queryLogs(int timeRangeMinutes, String minSeverity, int limit) {
        // Logs are not stored in Jaeger in a queryable way; return empty.
        return Collections.emptyList();
    }

    // =========================================================================
    // Metrics — queried from Prometheus REST API (same format as Dash0's PromQL proxy)
    // =========================================================================

    public Optional<Double> queryInstantMetric(String promQuery) {
        try {
            long now = Instant.now().getEpochSecond();
            PrometheusResponse resp = prometheus.get()
                    .uri(b -> b.path("/api/v1/query")
                               .queryParam("query", "{q}")
                               .queryParam("time",  "{t}")
                               .build(promQuery, now))
                    .retrieve()
                    .body(PrometheusResponse.class);
            return extractFirstScalar(resp);
        } catch (RestClientException e) {
            log.warn("Prometheus query failed for '{}': {}", promQuery, e.getMessage());
            return Optional.empty();
        }
    }

    public List<PrometheusResult> queryInstantMetrics(String promQuery) {
        try {
            long now = Instant.now().getEpochSecond();
            PrometheusResponse resp = prometheus.get()
                    .uri(b -> b.path("/api/v1/query")
                               .queryParam("query", "{q}")
                               .queryParam("time",  "{t}")
                               .build(promQuery, now))
                    .retrieve()
                    .body(PrometheusResponse.class);
            if (resp == null || resp.data() == null || resp.data().result() == null)
                return Collections.emptyList();
            return resp.data().result();
        } catch (RestClientException e) {
            log.warn("Prometheus multi query failed for '{}': {}", promQuery, e.getMessage());
            return Collections.emptyList();
        }
    }

    // =========================================================================
    // Jaeger → Dash0Span conversion
    // =========================================================================

    private List<Dash0Span> convertTrace(JaegerTrace trace) {
        if (trace.spans() == null || trace.processes() == null) return Collections.emptyList();

        return trace.spans().stream().map(span -> {
            // Resolve service name from the process map
            String serviceName = Optional.ofNullable(trace.processes())
                    .map(p -> p.get(span.processID()))
                    .map(JaegerProcess::serviceName)
                    .orElse("o11y-news");

            // Parent span id from CHILD_OF reference
            String parentSpanId = null;
            if (span.references() != null) {
                parentSpanId = span.references().stream()
                        .filter(r -> "CHILD_OF".equals(r.refType()))
                        .map(JaegerRef::spanID)
                        .findFirst()
                        .orElse(null);
            }

            // Jaeger stores time in microseconds; OTel uses nanoseconds
            long startNano  = span.startTime() * 1_000L;
            long durationMs = span.duration()  / 1_000L;

            // Extract tags into attribute map; pick out span.kind and otel.status_code specially
            Map<String, Object> attrs = new LinkedHashMap<>();
            String statusCode = "UNSET";
            String kind       = "INTERNAL";

            if (span.tags() != null) {
                for (JaegerTag tag : span.tags()) {
                    switch (tag.key()) {
                        case "otel.status_code" -> statusCode = tag.value().toString().toUpperCase();
                        case "span.kind"         -> kind       = tag.value().toString().toUpperCase();
                        case "error" -> {
                            // Jaeger error=true tag → ERROR status
                            if ("true".equalsIgnoreCase(tag.value().toString())) statusCode = "ERROR";
                            attrs.put(tag.key(), tag.value());
                        }
                        default -> attrs.put(tag.key(), tag.value());
                    }
                }
            }

            // Merge process (resource) tags — service.name etc.
            JaegerProcess proc = trace.processes().get(span.processID());
            if (proc != null && proc.tags() != null) {
                for (JaegerTag tag : proc.tags()) {
                    attrs.putIfAbsent(tag.key(), tag.value());
                }
            }

            return new Dash0Span(
                    span.traceID(),
                    span.spanID(),
                    parentSpanId,
                    span.operationName(),
                    kind,
                    serviceName,
                    startNano,
                    durationMs,
                    statusCode,
                    attrs,
                    null
            );
        }).toList();
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private long toMicros(Instant instant) {
        return instant.getEpochSecond() * 1_000_000L + instant.getNano() / 1_000L;
    }

    private Optional<Double> extractFirstScalar(PrometheusResponse response) {
        if (response == null || response.data() == null || response.data().result() == null
                || response.data().result().isEmpty()) return Optional.empty();
        PrometheusResult first = response.data().result().getFirst();
        if (first.value() != null && first.value().size() >= 2) {
            try { return Optional.of(Double.parseDouble(first.value().get(1).toString())); }
            catch (NumberFormatException ignored) {}
        }
        return Optional.empty();
    }

    // =========================================================================
    // Jaeger REST API response POJOs
    // =========================================================================

    @JsonIgnoreProperties(ignoreUnknown = true)
    record JaegerTracesResponse(
            @JsonProperty("data") List<JaegerTrace> data
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record JaegerTrace(
            @JsonProperty("traceID")   String traceID,
            @JsonProperty("spans")     List<JaegerSpan> spans,
            @JsonProperty("processes") Map<String, JaegerProcess> processes
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record JaegerSpan(
            @JsonProperty("traceID")       String traceID,
            @JsonProperty("spanID")        String spanID,
            @JsonProperty("operationName") String operationName,
            @JsonProperty("references")    List<JaegerRef> references,
            @JsonProperty("startTime")     long startTime,   // microseconds since epoch
            @JsonProperty("duration")      long duration,    // microseconds
            @JsonProperty("tags")          List<JaegerTag> tags,
            @JsonProperty("processID")     String processID
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record JaegerRef(
            @JsonProperty("refType") String refType,
            @JsonProperty("traceID") String traceID,
            @JsonProperty("spanID")  String spanID
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record JaegerTag(
            @JsonProperty("key")   String key,
            @JsonProperty("type")  String type,
            @JsonProperty("value") Object value
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record JaegerProcess(
            @JsonProperty("serviceName") String serviceName,
            @JsonProperty("tags")        List<JaegerTag> tags
    ) {}
}
