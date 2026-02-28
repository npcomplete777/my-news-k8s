import type { NextRequest } from 'next/server';

export interface TelemetryCounts {
  windowMinutes: number;
  spans: number;
  logRecords: number;
  metricDataPoints: number;
  ratePerMinute: {
    spans: number;
    logRecords: number;
    metricDataPoints: number;
  };
  updatedAt: string;
  source: 'clickhouse' | 'unavailable';
}

async function queryClickHouse(sql: string): Promise<number> {
  const url = process.env.CLICKHOUSE_URL ?? 'http://clickhouse:8123';
  const res = await fetch(`${url}/?output_format_json_quote_64bit_integers=0`, {
    method: 'POST',
    body: sql,
    headers: { 'Content-Type': 'text/plain' },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`CH ${res.status}: ${await res.text()}`);
  const text = (await res.text()).trim();
  const n = parseInt(text, 10);
  if (isNaN(n)) throw new Error(`Non-numeric response: ${text}`);
  return n;
}

const WINDOW_MINUTES = 30;
const WHERE_TIMESTAMP = `Timestamp > now() - INTERVAL ${WINDOW_MINUTES} MINUTE`;
const WHERE_TIME_UNIX = `TimeUnix > now() - INTERVAL ${WINDOW_MINUTES} MINUTE`;

export async function GET(_req: NextRequest) {
  // Run all table queries independently — each has its own .catch so a
  // missing table never zeros out the others.
  const [
    tracesLocal,
    tracesOtel,
    logs,
    metricsGauge,
    metricsSum,
    metricsHist,
  ] = await Promise.all([
    queryClickHouse(`SELECT count() FROM otel.traces WHERE ${WHERE_TIMESTAMP}`).catch(() => 0),
    queryClickHouse(`SELECT count() FROM otel.otel_traces WHERE ${WHERE_TIMESTAMP}`).catch(() => 0),
    queryClickHouse(`SELECT count() FROM otel.logs WHERE ${WHERE_TIMESTAMP}`).catch(() => 0),
    queryClickHouse(`SELECT count() FROM otel.otel_metrics_gauge WHERE ${WHERE_TIME_UNIX}`).catch(() => 0),
    queryClickHouse(`SELECT count() FROM otel.otel_metrics_sum WHERE ${WHERE_TIME_UNIX}`).catch(() => 0),
    queryClickHouse(`SELECT count() FROM otel.otel_metrics_histogram WHERE ${WHERE_TIME_UNIX}`).catch(() => 0),
  ]);

  const spans = tracesLocal + tracesOtel;
  const metricDataPoints = metricsGauge + metricsSum + metricsHist;

  // If everything is zero, ClickHouse may be unreachable or tables don't exist yet
  const source: TelemetryCounts['source'] =
    spans === 0 && logs === 0 && metricDataPoints === 0 ? 'unavailable' : 'clickhouse';

  const counts: TelemetryCounts = {
    windowMinutes: WINDOW_MINUTES,
    spans,
    logRecords: logs,
    metricDataPoints,
    ratePerMinute: {
      spans: Math.round(spans / WINDOW_MINUTES),
      logRecords: Math.round(logs / WINDOW_MINUTES),
      metricDataPoints: Math.round(metricDataPoints / WINDOW_MINUTES),
    },
    updatedAt: new Date().toISOString(),
    source,
  };

  return Response.json(counts, { headers: { 'Cache-Control': 'no-store' } });
}
