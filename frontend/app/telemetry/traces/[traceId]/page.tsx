'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { TraceWaterfall } from '@/components/telemetry/TraceWaterfall';
import { useTraceDetail } from '@/lib/hooks/useTelemetry';

export default function TraceDetailPage() {
  const params = useParams();
  const traceId = decodeURIComponent(String(params.traceId ?? ''));

  const { spans, isLoading, error } = useTraceDetail(traceId || null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-6 w-64 rounded" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-400">
          Failed to load trace: {error instanceof Error ? error.message : String(error)}
        </p>
        <Link href="/telemetry/traces" className="btn-ghost mt-3 inline-block text-sm">
          ← Back to traces
        </Link>
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-zinc-500">Trace not found or expired.</p>
        <Link href="/telemetry/traces" className="btn-ghost mt-3 inline-block text-sm">
          ← Back to traces
        </Link>
      </div>
    );
  }

  // Derive summary from spans
  const rootSpan = spans.find(s => !s.parentSpanId) ?? spans[0];
  const totalDuration = spans.reduce((mx, s) => Math.max(mx, s.durationMs), 0);
  const hasError = spans.some(s => s.status === 'ERROR');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/telemetry/traces"
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back to traces
          </Link>
          <h2 className="text-lg font-semibold text-zinc-100">{rootSpan.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <code className="font-mono">{traceId}</code>
            {hasError && <span className="badge bg-red-900/50 text-red-400">ERROR</span>}
            <span>·</span>
            <span>{spans.length} spans</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(rootSpan.startTime), { addSuffix: true })}</span>
          </div>
        </div>
        <span className="shrink-0 font-mono text-zinc-300 text-sm">
          {totalDuration < 1000
            ? `${totalDuration.toFixed(0)} ms`
            : `${(totalDuration / 1000).toFixed(2)} s`}
        </span>
      </div>

      {/* Waterfall */}
      <div className="card">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Span Timeline
        </h3>
        <TraceWaterfall spans={spans} />
      </div>

      {/* Span attributes detail */}
      <div className="card">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Span Attributes
        </h3>
        <div className="space-y-3">
          {spans.map(span => (
            <details key={span.spanId} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800/50">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    span.status === 'ERROR' ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                />
                <span className="text-sm font-medium text-zinc-300">{span.name}</span>
                <code className="ml-auto font-mono text-xs text-zinc-600">
                  {span.durationMs < 1000
                    ? `${span.durationMs.toFixed(0)}ms`
                    : `${(span.durationMs / 1000).toFixed(2)}s`}
                </code>
              </summary>
              {Object.keys(span.attributes).length > 0 && (
                <dl className="mt-2 ml-4 grid grid-cols-1 gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs sm:grid-cols-2">
                  {Object.entries(span.attributes).map(([k, v]) => (
                    <div key={k} className="overflow-hidden">
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="truncate font-mono text-zinc-300" title={String(v)}>
                        {String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
