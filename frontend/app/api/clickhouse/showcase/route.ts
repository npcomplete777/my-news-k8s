import { NextRequest } from 'next/server';

// ─── Whitelisted read-only showcase queries ────────────────────────────────

const QUERIES: Record<string, { sql: string; database?: string }> = {

  // Benchmark: old Map access
  'bench-old': {
    database: 'otel',
    sql: `SELECT
    SpanAttributes['http.method'] AS method,
    count() AS spans,
    round(avg(Duration) / 1e6, 2) AS avg_ms
FROM otel_traces
WHERE Timestamp > now() - INTERVAL 6 HOUR
GROUP BY method
ORDER BY spans DESC
LIMIT 10`,
  },

  // Benchmark: extracted column
  'bench-new': {
    database: 'otel',
    sql: `SELECT
    HttpMethod AS method,
    count() AS spans,
    round(avg(Duration) / 1e6, 2) AS avg_ms
FROM traces
WHERE Timestamp > now() - INTERVAL 6 HOUR
GROUP BY method
ORDER BY spans DESC
LIMIT 10`,
  },

  // RED metrics from AggregatingMergeTree
  'red-metrics': {
    database: 'otel',
    sql: `SELECT
    formatDateTime(time, '%H:%M') AS minute,
    ServiceName,
    request_count,
    error_count,
    round(100.0 * error_count / greatest(request_count, 1), 1) AS error_pct,
    round(quantilesMerge(0.5, 0.95, 0.99)(duration_quantiles)[1] / 1e6, 1) AS p50_ms,
    round(quantilesMerge(0.5, 0.95, 0.99)(duration_quantiles)[2] / 1e6, 1) AS p95_ms,
    round(quantilesMerge(0.5, 0.95, 0.99)(duration_quantiles)[3] / 1e6, 1) AS p99_ms
FROM red_metrics_1m
WHERE time >= now() - INTERVAL 30 MINUTE
GROUP BY minute, ServiceName, request_count, error_count
ORDER BY minute DESC
LIMIT 20`,
  },

  // Extracted columns showcase
  'extracted': {
    database: 'otel',
    sql: `SELECT
    ServiceName,
    K8sNamespace,
    K8sPodName,
    HttpMethod,
    HttpStatusCode,
    HttpRoute,
    round(Duration / 1e6, 2) AS duration_ms,
    StatusCode
FROM traces
WHERE Timestamp > now() - INTERVAL 15 MINUTE
  AND HttpMethod != ''
ORDER BY Timestamp DESC
LIMIT 15`,
  },

  // Error heatmap
  'errors': {
    database: 'otel',
    sql: `SELECT
    ServiceName,
    SpanName,
    HttpStatusCode,
    HttpRoute,
    count() AS error_count,
    round(avg(Duration) / 1e6, 1) AS avg_ms,
    max(StatusMessage) AS sample_message
FROM traces
WHERE Timestamp > now() - INTERVAL 1 HOUR
  AND StatusCode = 'Error'
GROUP BY ServiceName, SpanName, HttpStatusCode, HttpRoute
ORDER BY error_count DESC
LIMIT 20`,
  },

  // Storage meta query
  'storage': {
    sql: `SELECT
    database,
    table,
    sum(rows) AS rows,
    formatReadableSize(sum(bytes_on_disk)) AS on_disk,
    formatReadableSize(sum(data_uncompressed_bytes)) AS uncompressed,
    round(sum(bytes_on_disk) * 100.0 / greatest(sum(data_uncompressed_bytes), 1), 1) AS compression_pct,
    engine
FROM system.parts
INNER JOIN system.tables USING (database, table)
WHERE database = 'otel'
  AND table IN ('otel_traces', 'traces', 'otel_logs', 'logs',
                'red_metrics_1m', 'otel_metrics_gauge', 'metrics_gauge')
  AND active = 1
GROUP BY database, table, engine
ORDER BY sum(bytes_on_disk) DESC`,
  },
};

// ─── ClickHouse HTTP query ─────────────────────────────────────────────────

async function runQuery(sql: string, database = 'otel') {
  const url = `${process.env.CLICKHOUSE_URL ?? 'http://clickhouse:8123'}/?database=${database}&output_format_json_quote_64bit_integers=0`;
  const body = sql.trim() + '\nFORMAT JSONCompact';
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const elapsed_ms = Date.now() - start;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err.slice(0, 400));
  }
  const json = await res.json();
  return {
    columns: (json.meta as { name: string }[]).map((c) => c.name),
    rows: json.data as (string | number)[][],
    rows_read: json.statistics?.rows_read ?? 0,
    bytes_read: json.statistics?.bytes_read ?? 0,
    elapsed_ms,
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('q') ?? '';
  const q = QUERIES[id];
  if (!q) {
    return Response.json({ error: `Unknown query id: ${id}` }, { status: 400 });
  }
  try {
    const result = await runQuery(q.sql, q.database);
    return Response.json({ ...result, sql: q.sql });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Query failed' },
      { status: 500 },
    );
  }
}
