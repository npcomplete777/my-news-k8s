'use client';

import { BrowserPanel } from '@/components/telemetry/BrowserPanel';

export default function BrowserPage() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-stone-500 dark:text-zinc-500">
        Real-time spans captured in your browser via OpenTelemetry JS. These also appear in the{' '}
        <span className="text-stone-700 dark:text-zinc-300 font-medium">Traces</span> tab once
        ClickHouse ingests them (~5s batch delay).
      </p>
      <BrowserPanel />
    </div>
  );
}
