'use client';

import { PrivacyNotice } from '@/components/telemetry/PrivacyNotice';
import { MetricsGrid } from '@/components/telemetry/MetricsGrid';
import { TraceList } from '@/components/telemetry/TraceList';
import { ServiceMap } from '@/components/telemetry/ServiceMap';
import { useLiveTraces, useTraces } from '@/lib/hooks/useTelemetry';

function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}
      />
      <span className={connected ? 'text-emerald-400' : 'text-zinc-500'}>
        {connected ? 'Live' : 'Connecting…'}
      </span>
    </span>
  );
}

export default function TelemetryOverviewPage() {
  const { data: liveTraces, connected } = useLiveTraces();
  const { traces: polledTraces, isLoading } = useTraces({ minutes: 5, limit: 10 });

  // Prefer SSE data when connected, fall back to polled
  const displayTraces = connected && liveTraces ? liveTraces.slice(0, 10) : polledTraces;

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice />

      {/* Metrics */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Live Metrics
        </h2>
        <MetricsGrid />
      </section>

      {/* Recent traces */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Recent Traces
          </h2>
          <LiveBadge connected={connected} />
        </div>
        <TraceList traces={displayTraces} isLoading={isLoading && !connected} />
      </section>

      {/* Service map */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Service Map
        </h2>
        <ServiceMap />
      </section>
    </div>
  );
}
