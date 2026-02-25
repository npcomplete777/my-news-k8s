'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import type { TraceDTO } from '@/lib/telemetry-types';

function formatDuration(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function TraceRow({ trace }: { trace: TraceDTO }) {
  return (
    <Link
      href={`/telemetry/traces/${encodeURIComponent(trace.traceId)}`}
      className={clsx(
        'flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm',
        'transition-colors hover:bg-stone-100 dark:hover:bg-zinc-800/50',
        trace.mySession
          ? 'border-amber-800/50 bg-amber-950/20'
          : 'border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900/30'
      )}
    >
      {/* Left: name + trace ID */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-stone-800 dark:text-zinc-200 truncate">{trace.rootSpanName}</span>
          {trace.hasError && (
            <span className="badge bg-red-900/50 text-red-400 shrink-0">ERROR</span>
          )}
          {trace.mySession && (
            <span className="badge bg-amber-900/50 text-amber-400 shrink-0">yours</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
          <code className="font-mono">{trace.traceId.slice(0, 16)}…</code>
          <span>·</span>
          <span>{trace.spanCount} span{trace.spanCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{trace.serviceName}</span>
        </div>
      </div>

      {/* Right: duration + time */}
      <div className="shrink-0 text-right text-xs text-zinc-500">
        <p className={clsx('font-mono font-medium', trace.hasError ? 'text-red-400' : 'text-stone-700 dark:text-zinc-300')}>
          {formatDuration(trace.durationMs)}
        </p>
        <p className="mt-0.5">{formatDistanceToNow(new Date(trace.startTime), { addSuffix: true })}</p>
      </div>
    </Link>
  );
}

export function TraceList({
  traces,
  isLoading,
  emptyMessage = 'No traces yet — make some requests to see live data.',
}: {
  traces: TraceDTO[];
  isLoading: boolean;
  emptyMessage?: string;
}) {
  if (isLoading && traces.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {traces.map(trace => (
        <TraceRow key={trace.traceId} trace={trace} />
      ))}
    </div>
  );
}
