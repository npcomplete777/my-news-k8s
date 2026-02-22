'use client';

import { formatDistanceToNow } from 'date-fns';
import { useMetrics } from '@/lib/hooks/useTelemetry';

type Status = 'ok' | 'warn' | 'error' | 'neutral';

function MetricCard({
  label,
  value,
  unit,
  status = 'neutral',
}: {
  label: string;
  value: string | null;
  unit?: string;
  status?: Status;
}) {
  const valueClass: Record<Status, string> = {
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
    neutral: 'text-zinc-100',
  };

  return (
    <div className="card">
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      {value === null ? (
        <p className="text-zinc-600 text-sm font-mono">—</p>
      ) : (
        <p className={`font-mono text-2xl font-semibold ${valueClass[status]}`}>
          {value}
          {unit && <span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span>}
        </p>
      )}
    </div>
  );
}

export function MetricsGrid() {
  const { metrics, isLoading } = useMetrics();

  if (isLoading && !metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton mb-2 h-3 w-20" />
            <div className="skeleton h-8 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const errorRate = metrics?.errorRate ?? null;
  const errorStatus: Status =
    errorRate === null ? 'neutral' : errorRate > 5 ? 'error' : errorRate > 1 ? 'warn' : 'ok';

  const p99 = metrics?.latencyP99Ms ?? null;
  const p99Status: Status = p99 === null ? 'neutral' : p99 > 1000 ? 'warn' : 'ok';

  const p95 = metrics?.latencyP95Ms ?? null;

  const heapMb = metrics?.jvmHeapUsedMb ?? null;
  const heapStatus: Status = heapMb === null ? 'neutral' : heapMb > 1200 ? 'warn' : 'ok';

  const dbConns = metrics?.activeDbConnections ?? null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard
          label="Requests / sec"
          value={metrics?.requestRate != null ? metrics.requestRate.toFixed(2) : null}
          status={metrics?.requestRate != null ? 'ok' : 'neutral'}
        />
        <MetricCard
          label="Error rate"
          value={errorRate != null ? errorRate.toFixed(1) : null}
          unit="%"
          status={errorStatus}
        />
        <MetricCard
          label="P99 latency"
          value={p99 != null ? p99.toFixed(0) : null}
          unit="ms"
          status={p99Status}
        />
        <MetricCard
          label="P95 latency"
          value={p95 != null ? p95.toFixed(0) : null}
          unit="ms"
          status="neutral"
        />
        <MetricCard
          label="JVM heap"
          value={heapMb != null ? heapMb.toFixed(0) : null}
          unit="MB"
          status={heapStatus}
        />
        <MetricCard
          label="DB connections"
          value={dbConns != null ? String(dbConns) : null}
          status="neutral"
        />
      </div>

      {metrics?.pollerStatuses && Object.keys(metrics.pollerStatuses).length > 0 && (
        <div>
          <p className="mb-2 text-xs text-zinc-500">News Pollers</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.pollerStatuses).map(([name, status]) => (
              <span
                key={name}
                className={`badge ${
                  status === 'OK'
                    ? 'bg-emerald-900/50 text-emerald-400'
                    : 'bg-red-900/50 text-red-400'
                }`}
              >
                {name}: {status}
              </span>
            ))}
          </div>
        </div>
      )}

      {metrics?.updatedAt && (
        <p className="text-xs text-zinc-600">
          Updated {formatDistanceToNow(new Date(metrics.updatedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
