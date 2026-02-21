'use client';

import { MetricsGrid } from '@/components/telemetry/MetricsGrid';
import { useMetrics } from '@/lib/hooks/useTelemetry';

export default function MetricsPage() {
  const { isLoading } = useMetrics();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Live metrics from Dash0 Prometheus endpoint — auto-refreshes every 5 s.
        </p>
        {isLoading && (
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        )}
      </div>

      <MetricsGrid />
    </div>
  );
}
