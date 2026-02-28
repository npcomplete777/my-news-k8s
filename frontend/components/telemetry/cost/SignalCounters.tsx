'use client';

import type { LiveCounts } from '@/lib/hooks/useTelemetryCounts';
import { AnimatedNumber, fmtCount } from './AnimatedNumber';

interface Props {
  counts: LiveCounts;
}

function Counter({
  label,
  icon,
  value,
  rate,
  unit,
  color,
}: {
  label: string;
  icon: string;
  value: number;
  rate: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
          {label}
        </span>
      </div>
      <p
        className="font-mono text-3xl font-bold tabular-nums"
        style={{ color }}
      >
        <AnimatedNumber value={value} format={fmtCount} durationMs={800} />
      </p>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="text-xs text-stone-400 dark:text-zinc-500 font-mono tabular-nums">
          {rate < 1 ? rate.toFixed(1) : Math.round(rate)}/{unit}
        </span>
      </div>
    </div>
  );
}

export function SignalCounters({ counts }: Props) {
  const backend = counts.backend;
  const spans = (backend?.spans ?? 0) + counts.browserSpans;
  const logs = backend?.logRecords ?? 0;
  const metrics = backend?.metricDataPoints ?? 0;

  const spansRate = backend?.ratePerMinute.spans ?? 0;
  const logsRate = backend?.ratePerMinute.logRecords ?? 0;
  const metricsRate = backend?.ratePerMinute.metricDataPoints ?? 0;

  const isUnavailable = backend?.source === 'unavailable';

  return (
    <div className="flex flex-col gap-3">
      {isUnavailable && (
        <p className="text-xs text-amber-500 dark:text-amber-400">
          Backend telemetry unavailable — showing browser signals only. Costs calculated from browser spans only.
        </p>
      )}
      {backend?.source === 'clickhouse' && (
        <p className="text-xs text-stone-400 dark:text-zinc-500">
          Live counts from ClickHouse · last 5 minutes · refreshes every 10 s
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Counter
          label="Traces / Spans"
          icon="🔍"
          value={spans}
          rate={spansRate}
          unit="min"
          color="#f59e0b"
        />
        <Counter
          label="Metric Data Points"
          icon="📊"
          value={metrics}
          rate={metricsRate}
          unit="min"
          color="#34d399"
        />
        <Counter
          label="Log Records"
          icon="📝"
          value={logs}
          rate={logsRate}
          unit="min"
          color="#60a5fa"
        />
      </div>
    </div>
  );
}
