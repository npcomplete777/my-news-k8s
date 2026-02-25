'use client';

import { useBrowserSpans, useNavTiming } from '@/lib/hooks/useBrowserTelemetry';
import type { BrowserSpan } from '@/lib/otel-browser';
import { format } from 'date-fns';
import { clsx } from 'clsx';

function NavTimingGrid() {
  const { ttfbMs, domReadyMs, loadMs, fcpMs } = useNavTiming();

  const metrics = [
    { label: 'TTFB', value: ttfbMs, unit: 'ms', color: 'text-amber-400' },
    { label: 'FCP', value: fcpMs, unit: 'ms', color: 'text-emerald-400' },
    { label: 'DOM Ready', value: domReadyMs, unit: 'ms', color: 'text-blue-400' },
    { label: 'Load', value: loadMs, unit: 'ms', color: 'text-purple-400' },
  ];

  return (
    <div className="card flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-zinc-500">
        Page Performance
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(m => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-stone-500 dark:text-zinc-600">
              {m.label}
            </span>
            {m.value !== null ? (
              <span className={clsx('text-xl font-bold tabular-nums', m.color)}>
                {m.value}
                <span className="text-xs font-normal text-stone-500 dark:text-zinc-500 ml-0.5">
                  {m.unit}
                </span>
              </span>
            ) : (
              <span className="text-xl font-bold text-stone-400 dark:text-zinc-600">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpanRow({ span }: { span: BrowserSpan }) {
  let ts = '';
  try {
    ts = format(new Date(span.startTime), 'HH:mm:ss.SSS');
  } catch {
    ts = String(span.startTime);
  }

  const durationLabel =
    span.durationMs < 1
      ? `${Math.round(span.durationMs * 1000)}μs`
      : `${Math.round(span.durationMs)}ms`;

  const statusClass =
    span.status === 'ERROR'
      ? 'bg-red-900/50 text-red-400'
      : span.status === 'OK'
      ? 'bg-emerald-900/40 text-emerald-400'
      : 'bg-zinc-800 text-zinc-500';

  return (
    <div className="flex gap-2 items-start py-1.5 border-b border-stone-200 dark:border-zinc-800/50 last:border-0 text-xs">
      <span className="shrink-0 font-mono text-stone-500 dark:text-zinc-600 w-24">{ts}</span>
      <span className="flex-1 text-stone-700 dark:text-zinc-300 break-words min-w-0 font-mono">
        {span.name}
      </span>
      <span className={clsx('badge shrink-0', statusClass)}>{durationLabel}</span>
      <span className="shrink-0 font-mono text-stone-400 dark:text-zinc-600">
        {span.traceId.slice(0, 8)}
      </span>
    </div>
  );
}

function BrowserSpanList() {
  const spans = useBrowserSpans();

  if (spans.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-stone-500 dark:text-zinc-500">
        Waiting for spans... (navigate around or trigger requests)
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 dark:border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono">
      {spans.slice(0, 10).map((span, i) => (
        <SpanRow key={`${span.spanId}-${i}`} span={span} />
      ))}
    </div>
  );
}

export function BrowserPanel() {
  return (
    <div className="flex flex-col gap-4">
      <NavTimingGrid />

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-zinc-500">
          Recent Browser Spans
        </h3>
        <BrowserSpanList />
      </div>
    </div>
  );
}
