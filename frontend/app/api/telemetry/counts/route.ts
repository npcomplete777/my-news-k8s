import type { NextRequest } from 'next/server';

export interface TelemetryCounts {
  window: '5min';
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
    signal: AbortSignal.timeout(4000),
    next: { revalidate: 0 }, // no caching — always fresh
  });
  if (!res.ok) throw new Error(`CH error ${res.status}`);
  const text = (await res.text()).trim();
  const n = parseInt(text, 10);
  return isNaN(n) ? 0 : n;
}

export async function GET(_req: NextRequest) {
  try {
    // Query all signal types in parallel — gracefully handle missing tables
    const [spans, logRecords, metricDataPoints] = await Promise.all([
      // Spans: sum across both trace tables written by otelcol and Dash0 operator
      queryClickHouse(
        `SELECT (SELECT count() FROM otel.traces WHERE Timestamp > now() - INTERVAL 5 MINUTE) + (SELECT count() FROM otel.otel_traces WHERE Timestamp > now() - INTERVAL 5 MINUTE)`
      ).catch(() => 0),

      // Logs: default OTel collector ClickHouse exporter table
      queryClickHouse(
        `SELECT count() FROM otel.otel_logs WHERE Timestamp > now() - INTERVAL 5 MINUTE`
      ).catch(() => 0),

      // Metrics: sum across gauge, sum, histogram tables (standard otelcol exporter schema)
      queryClickHouse(
        `SELECT ` +
        `(SELECT count() FROM otel.otel_metrics_gauge WHERE TimeUnix > now() - INTERVAL 5 MINUTE) + ` +
        `(SELECT count() FROM otel.otel_metrics_sum WHERE TimeUnix > now() - INTERVAL 5 MINUTE) + ` +
        `(SELECT count() FROM otel.otel_metrics_histogram WHERE TimeUnix > now() - INTERVAL 5 MINUTE)`
      ).catch(() => 0),
    ]);

    const counts: TelemetryCounts = {
      window: '5min',
      spans,
      logRecords,
      metricDataPoints,
      ratePerMinute: {
        spans: Math.round(spans / 5),
        logRecords: Math.round(logRecords / 5),
        metricDataPoints: Math.round(metricDataPoints / 5),
      },
      updatedAt: new Date().toISOString(),
      source: 'clickhouse',
    };

    return Response.json(counts, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    // Fallback: return zeros rather than erroring — UI handles gracefully
    const empty: TelemetryCounts = {
      window: '5min',
      spans: 0, logRecords: 0, metricDataPoints: 0,
      ratePerMinute: { spans: 0, logRecords: 0, metricDataPoints: 0 },
      updatedAt: new Date().toISOString(),
      source: 'unavailable',
    };
    return Response.json(empty, { headers: { 'Cache-Control': 'no-store' } });
  }
}
