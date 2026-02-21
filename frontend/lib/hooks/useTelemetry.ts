'use client';

import useSWR from 'swr';
import type {
  TraceDTO,
  SpanDTO,
  MetricsSummaryDTO,
  LogEntryDTO,
  ServiceMapDTO,
} from '@/lib/telemetry-types';
import {
  getTelemetryTraces,
  getTelemetryTrace,
  getTelemetryMetrics,
  getTelemetryLogs,
  getTelemetryServiceMap,
} from '@/lib/api';
import { useSSE } from './useSSE';

const SSE_URL =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') +
  '/api/telemetry/traces/stream';

/** SSE stream of recent traces — updates every ~3 s from the backend. */
export function useLiveTraces() {
  return useSSE<TraceDTO[]>(SSE_URL);
}

/** Polled snapshot of recent traces (refreshes every 10 s). */
export function useTraces(
  params: { minutes?: number; errorOnly?: boolean; limit?: number } = {}
) {
  const minutes = params.minutes ?? 5;
  const errorOnly = params.errorOnly ?? false;
  const limit = params.limit ?? 50;
  const key = `/api/telemetry/traces?minutes=${minutes}&errorOnly=${errorOnly}&limit=${limit}`;

  const { data, error, isLoading, mutate } = useSWR<TraceDTO[]>(
    key,
    () => getTelemetryTraces({ minutes, errorOnly, limit }),
    { refreshInterval: 10_000, revalidateOnFocus: false }
  );

  return { traces: data ?? [], error, isLoading, mutate };
}

/** Span detail for a single trace. */
export function useTraceDetail(traceId: string | null) {
  const { data, error, isLoading } = useSWR<SpanDTO[]>(
    traceId ? `/api/telemetry/traces/${traceId}` : null,
    () => getTelemetryTrace(traceId!),
    { revalidateOnFocus: false }
  );
  return { spans: data ?? [], error, isLoading };
}

/** Live metrics snapshot — refreshes every 5 s. */
export function useMetrics() {
  const { data, error, isLoading } = useSWR<MetricsSummaryDTO>(
    '/api/telemetry/metrics',
    getTelemetryMetrics,
    { refreshInterval: 5_000, revalidateOnFocus: false }
  );
  return { metrics: data ?? null, error, isLoading };
}

/** Recent log entries — refreshes every 10 s. */
export function useLogs(
  params: { minutes?: number; minSeverity?: string; limit?: number } = {}
) {
  const minutes = params.minutes ?? 10;
  const minSeverity = params.minSeverity ?? '';
  const limit = params.limit ?? 100;
  const key = `/api/telemetry/logs?minutes=${minutes}&minSeverity=${minSeverity}&limit=${limit}`;

  const { data, error, isLoading } = useSWR<LogEntryDTO[]>(
    key,
    () => getTelemetryLogs({ minutes, minSeverity: minSeverity || undefined, limit }),
    { refreshInterval: 10_000, revalidateOnFocus: false }
  );
  return { logs: data ?? [], error, isLoading };
}

/** Service topology derived from recent spans — refreshes every 30 s. */
export function useServiceMap(minutes = 30) {
  const { data, error, isLoading } = useSWR<ServiceMapDTO>(
    `/api/telemetry/service-map?minutes=${minutes}`,
    () => getTelemetryServiceMap(minutes),
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );
  return { serviceMap: data ?? null, error, isLoading };
}
