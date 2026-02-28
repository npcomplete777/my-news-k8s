import { NextResponse } from 'next/server';

const CH = process.env.CLICKHOUSE_URL ?? 'http://clickhouse:8123';

async function ch(sql: string): Promise<string> {
  const res = await fetch(`${CH}/?output_format_json_quote_64bit_integers=0`, {
    method: 'POST',
    body: sql + '\nFORMAT JSONEachRow',
    headers: { 'Content-Type': 'text/plain' },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`CH ${res.status}`);
  return res.text();
}

function parseRows<T>(text: string): T[] {
  return text.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

/** Derive deployment name from pod name.
 *  Pod naming convention: <deployment>-<replicaset-hash>-<pod-hash>
 *  e.g. o11y-news-backend-6f6fb6d76d-cnwkr → o11y-news-backend
 */
function deploymentFromPod(podName: string): string {
  const parts = podName.split('-');
  // Last two segments are RS hash (10 chars) + pod hash (5 chars), drop them
  if (parts.length >= 3) return parts.slice(0, -2).join('-');
  return podName;
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
  from: string; // service name
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
    const [podText, edgeText] = await Promise.all([
      ch(`
        SELECT
          ResourceAttributes['host.name'] AS pod,
          ServiceName                     AS service,
          count()                         AS spans,
          countIf(StatusCode = 'Error')   AS errors,
          round(avg(Duration) / 1e6, 2)  AS avgDurationMs
        FROM otel.traces
        WHERE Timestamp > now() - INTERVAL 30 MINUTE
          AND ResourceAttributes['host.name'] != ''
        GROUP BY pod, service
        ORDER BY spans DESC
        LIMIT 60
      `),
      ch(`
        SELECT
          parent.ServiceName AS src,
          child.ServiceName  AS tgt,
          count()            AS calls
        FROM otel.traces AS child
        INNER JOIN otel.traces AS parent
          ON  child.TraceId     = parent.TraceId
          AND child.ParentSpanId = parent.SpanId
        WHERE child.Timestamp  > now() - INTERVAL 30 MINUTE
          AND parent.Timestamp > now() - INTERVAL 30 MINUTE
          AND child.ParentSpanId != ''
          AND parent.ServiceName != child.ServiceName
        GROUP BY src, tgt
        ORDER BY calls DESC
        LIMIT 20
      `),
    ]);

    type PodRow  = { pod: string; service: string; spans: string; errors: string; avgDurationMs: string };
    type EdgeRow = { src: string; tgt: string; calls: string };

    const podRows  = parseRows<PodRow>(podText);
    const edgeRows = parseRows<EdgeRow>(edgeText);

    const pods: PodStat[] = podRows.map(r => {
      const spans  = Number(r.spans);
      const errors = Number(r.errors);
      return {
        pod:           r.pod,
        deployment:    deploymentFromPod(r.pod),
        service:       r.service,
        spans,
        errors,
        errorRate:     spans > 0 ? errors / spans : 0,
        avgDurationMs: Number(r.avgDurationMs),
      };
    });

    const edges: K8sEdge[] = edgeRows.map(r => ({
      from:  r.src,
      to:    r.tgt,
      calls: Number(r.calls),
    }));

    return NextResponse.json({ pods, edges, updatedAt: Date.now() } satisfies K8sTopology);
  } catch (err) {
    console.error('[k8s topology]', err);
    return NextResponse.json({ pods: [], edges: [], updatedAt: Date.now() } satisfies K8sTopology);
  }
}
