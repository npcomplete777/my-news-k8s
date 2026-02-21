/** Summary of a distributed trace — groups all spans with the same traceId. */
export interface TraceDTO {
  traceId: string;
  rootSpanName: string;
  serviceName: string;
  startTime: string;   // ISO-8601 instant
  durationMs: number;
  spanCount: number;
  hasError: boolean;
  mySession: boolean;  // true when trace originated from this browser session
}

/** Detail for a single span within a trace. PII is redacted server-side. */
export interface SpanDTO {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  serviceName: string;
  startTime: string;   // ISO-8601 instant
  durationMs: number;
  status: string;      // "OK" | "ERROR" | "UNSET"
  attributes: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
}

/** Aggregated live metrics from Prometheus/Dash0. Null fields mean data unavailable. */
export interface MetricsSummaryDTO {
  requestRate: number | null;        // requests per second
  errorRate: number | null;          // percentage 0–100
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
  jvmHeapUsedMb: number | null;
  activeDbConnections: number | null;
  pollerStatuses: Record<string, string>;
  updatedAt: string;                 // ISO-8601 instant
}

/** A single structured log entry. PII is redacted server-side. */
export interface LogEntryDTO {
  timestamp: string;   // ISO-8601 instant
  severity: string;    // "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL"
  body: string;
  traceId: string | null;
  spanId: string | null;
  attributes: Record<string, unknown>;
}

/** Service topology derived from recent span data. */
export interface ServiceMapDTO {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
}

export interface ServiceNode {
  id: string;
  displayName: string;
  type: string;   // "SERVICE" | "DATABASE" | "EXTERNAL"
}

export interface ServiceEdge {
  from: string;
  to: string;
  callCount: number;
}
