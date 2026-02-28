import { NextResponse } from 'next/server';

const CH = process.env.CLICKHOUSE_URL ?? 'http://clickhouse:8123';

async function chQuery(sql: string): Promise<string> {
  const res = await fetch(`${CH}/?output_format_json_quote_64bit_integers=0`, {
    method: 'POST',
    body: sql.trim() + '\nFORMAT JSONEachRow',
    headers: { 'Content-Type': 'text/plain' },
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ClickHouse ${res.status}`);
  return res.text();
}

function rows<T>(text: string): T[] {
  return text.trim().split('\n').filter(Boolean).map(l => JSON.parse(l) as T);
}

/** o11y-news-backend-6f6fb6d76d-cnwkr  →  o11y-news-backend */
function deploymentName(podName: string): string {
  const parts = podName.split('-');
  return parts.length >= 3 ? parts.slice(0, -2).join('-') : podName;
}

export interface PodStat {
  pod: string;
  deployment: string;
  service: string;
  spans: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
}

export interface K8sEdge {
  from: string;
  to: string;
  calls: number;
}

export interface K8sTopology {
  pods: PodStat[];
  edges: K8sEdge[];
  updatedAt: number;
}

export async function GET() {
  try {
    // ── 1. Pods from traces (6 h window so RSS pollers always appear) ─────────
    const podText = await chQuery(`
      SELECT
        ResourceAttributes['host.name']       AS pod,
        ServiceName                            AS service,
        count()                                AS spans,
        countIf(StatusCode = 'Error')          AS errors,
        round(avg(Duration) / 1e6, 2)          AS avgMs
      FROM otel.traces
      WHERE Timestamp > now() - INTERVAL 6 HOUR
        AND ResourceAttributes['host.name'] != ''
      GROUP BY pod, service
      ORDER BY spans DESC
      LIMIT 60
    `).catch(() => '');

    type PodRow = { pod: string; service: string; spans: string; errors: string; avgMs: string };
    const podRows = rows<PodRow>(podText);

    let pods: PodStat[] = podRows.map(r => {
      const spans  = Number(r.spans);
      const errors = Number(r.errors);
      return {
        pod:          r.pod,
        deployment:   deploymentName(r.pod),
        service:      r.service,
        spans,
        errors,
        errorRate:    spans > 0 ? errors / spans : 0,
        avgDurationMs: Number(r.avgMs),
      };
    });

    // ── 2. Fallback: if no pod data, derive nodes from metric service names ──
    if (pods.length === 0) {
      const metricText = await chQuery(`
        SELECT DISTINCT ServiceName AS service
        FROM otel.otel_metrics_sum
        WHERE TimeUnix > now() - INTERVAL 1 HOUR
          AND ServiceName != ''
        LIMIT 20
      `).catch(() => '');

      type MetricRow = { service: string };
      pods = rows<MetricRow>(metricText).map(r => ({
        pod:          r.service,
        deployment:   r.service,
        service:      r.service,
        spans:        0,
        errors:       0,
        errorRate:    0,
        avgDurationMs: 0,
      }));
    }

    // ── 3. Edges via peer.service attribute (no expensive self-join) ─────────
    const edgeText = await chQuery(`
      SELECT
        ServiceName                            AS src,
        SpanAttributes['peer.service']         AS tgt,
        count()                                AS calls
      FROM otel.traces
      WHERE Timestamp > now() - INTERVAL 6 HOUR
        AND SpanAttributes['peer.service'] != ''
      GROUP BY src, tgt
      ORDER BY calls DESC
      LIMIT 30
    `).catch(() => '');

    type EdgeRow = { src: string; tgt: string; calls: string };
    const edgeRows = rows<EdgeRow>(edgeText);
    const edges: K8sEdge[] = edgeRows
      .map(r => ({ from: r.src, to: r.tgt, calls: Number(r.calls) }))
      .filter(e => e.from !== e.to);

    return NextResponse.json({ pods, edges, updatedAt: Date.now() } satisfies K8sTopology);
  } catch (err) {
    console.error('[k8s topology]', err);
    return NextResponse.json({ pods: [], edges: [], updatedAt: Date.now() } satisfies K8sTopology);
  }
}
