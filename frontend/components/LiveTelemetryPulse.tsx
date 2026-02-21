'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTelemetryMetrics } from '@/lib/api';
import type { MetricsSummaryDTO } from '@/lib/telemetry-types';

export function LiveTelemetryPulse() {
  const [metrics, setMetrics] = useState<MetricsSummaryDTO | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        const data = await getTelemetryMetrics();
        if (!cancelled) {
          setMetrics(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error || !metrics) return null;

  const rps = metrics.requestRate;
  const errorRate = metrics.errorRate;
  const p99 = metrics.latencyP99Ms;

  const hasData = rps !== null || errorRate !== null || p99 !== null;
  if (!hasData) return null;

  return (
    <Link
      href="/telemetry"
      className="group flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
    >
      {/* Live pulse dot */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-medium text-zinc-400">Live</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-zinc-500">
        {rps !== null && (
          <span>
            <span className="font-mono text-zinc-300">{rps.toFixed(1)}</span>
            {' '}req/s
          </span>
        )}
        {errorRate !== null && (
          <span>
            <span className={`font-mono ${errorRate > 5 ? 'text-red-400' : 'text-zinc-300'}`}>
              {errorRate.toFixed(1)}%
            </span>
            {' '}errors
          </span>
        )}
        {p99 !== null && (
          <span>
            <span className="font-mono text-zinc-300">{Math.round(p99)}</span>
            {' '}ms p99
          </span>
        )}
      </div>

      <span className="ml-auto shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-500">
        telemetry →
      </span>
    </Link>
  );
}
