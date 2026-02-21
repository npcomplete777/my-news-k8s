package com.o11ynews.telemetry;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.util.List;

/**
 * Public REST endpoints for the Live Telemetry Tab.
 * No authentication required — returns redacted, read-only observability data.
 *
 * All endpoints are under /api/telemetry/** which is in the ApiKeyAuthFilter public-paths list.
 */
@RestController
@RequestMapping("/api/telemetry")
public class TelemetryController {

    private final TelemetryService telemetryService;
    private final SessionCorrelationService sessionCorrelationService;
    private final Dash0Properties properties;

    public TelemetryController(TelemetryService telemetryService,
                               SessionCorrelationService sessionCorrelationService,
                               Dash0Properties properties) {
        this.telemetryService = telemetryService;
        this.sessionCorrelationService = sessionCorrelationService;
        this.properties = properties;
    }

    /**
     * GET /api/telemetry/traces
     *
     * Returns recent traces grouped from span data, newest-first.
     * Traces matching the caller's browser session are flagged with isCurrentSession=true.
     *
     * @param timeRangeMinutes look-back window (default 15, max 60)
     * @param errorOnly        if true, only return traces with ERROR status
     */
    @WithSpan
    @GetMapping("/traces")
    public ResponseEntity<List<TraceDTO>> getTraces(
            @RequestParam(defaultValue = "15") int timeRangeMinutes,
            @RequestParam(defaultValue = "false") boolean errorOnly,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId) {

        int window = Math.min(timeRangeMinutes, 60);
        List<TraceDTO> traces = errorOnly
                ? telemetryService.getRecentErrorTraces(sessionId, window)
                : telemetryService.getRecentTraces(sessionId, window);

        return ResponseEntity.ok(traces);
    }

    /**
     * GET /api/telemetry/traces/{traceId}
     *
     * Returns all spans for a specific trace, sorted by start time.
     * PII attributes are redacted.
     */
    @WithSpan
    @GetMapping("/traces/{traceId}")
    public ResponseEntity<List<SpanDTO>> getTraceSpans(
            @PathVariable String traceId,
            @RequestParam(defaultValue = "60") int timeRangeMinutes) {

        int window = Math.min(timeRangeMinutes, 60);
        List<SpanDTO> spans = telemetryService.getTraceSpans(traceId, window);
        return ResponseEntity.ok(spans);
    }

    /**
     * GET /api/telemetry/traces/stream
     *
     * SSE endpoint that pushes recent traces every {@code refreshIntervalSeconds}.
     * Clients should connect and handle {@code event: traces} events.
     *
     * Uses a virtual thread per connection (Spring Boot virtual-threads enabled).
     */
    @GetMapping(value = "/traces/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamTraces(
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId) {

        SseEmitter emitter = new SseEmitter(600_000L); // 10-minute server-side timeout

        int intervalSeconds = properties.getTelemetry().getRefreshIntervalSeconds();

        Thread.ofVirtual().start(() -> {
            try {
                while (!Thread.currentThread().isInterrupted()) {
                    List<TraceDTO> traces = telemetryService.getRecentTraces(sessionId, 5);
                    emitter.send(SseEmitter.event()
                            .name("traces")
                            .data(traces, MediaType.APPLICATION_JSON));
                    Thread.sleep(Duration.ofSeconds(intervalSeconds));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                // Client disconnected or emitter already complete — exit cleanly
            } finally {
                emitter.complete();
            }
        });

        emitter.onTimeout(emitter::complete);
        emitter.onError(ignored -> emitter.complete());

        return emitter;
    }

    /**
     * GET /api/telemetry/metrics
     *
     * Returns a live metrics snapshot: request rate, latency percentiles, error rate,
     * poller circuit breaker states, JVM heap usage, active DB connections.
     */
    @WithSpan
    @GetMapping("/metrics")
    public ResponseEntity<MetricsSummaryDTO> getMetrics() {
        MetricsSummaryDTO summary = telemetryService.getMetricsSummary();
        return ResponseEntity.ok(summary);
    }

    /**
     * GET /api/telemetry/logs
     *
     * Returns recent structured log entries, newest-first.
     *
     * @param timeRangeMinutes look-back window (default 15, max 60)
     * @param minSeverity      minimum severity to include (default INFO)
     */
    @WithSpan
    @GetMapping("/logs")
    public ResponseEntity<List<LogEntryDTO>> getLogs(
            @RequestParam(defaultValue = "15") int timeRangeMinutes,
            @RequestParam(defaultValue = "INFO") String minSeverity) {

        int window = Math.min(timeRangeMinutes, 60);
        List<LogEntryDTO> logs = telemetryService.getRecentLogs(window, minSeverity);
        return ResponseEntity.ok(logs);
    }

    /**
     * GET /api/telemetry/service-map
     *
     * Returns service topology derived from recent span data:
     * nodes (services) and edges (call relationships with traffic rates).
     */
    @WithSpan
    @GetMapping("/service-map")
    public ResponseEntity<ServiceMapDTO> getServiceMap() {
        ServiceMapDTO serviceMap = telemetryService.getServiceMap();
        return ResponseEntity.ok(serviceMap);
    }
}
