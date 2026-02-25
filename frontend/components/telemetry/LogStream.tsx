'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { LogEntryDTO } from '@/lib/telemetry-types';

const SEVERITY_CLASSES: Record<string, string> = {
  FATAL: 'bg-red-900/60 text-red-300',
  ERROR: 'bg-red-900/50 text-red-400',
  WARN: 'bg-amber-900/50 text-amber-400',
  WARNING: 'bg-amber-900/50 text-amber-400',
  INFO: 'bg-blue-900/40 text-blue-400',
  DEBUG: 'bg-zinc-800 text-zinc-500',
  TRACE: 'bg-zinc-800/60 text-zinc-600',
};

function severityClass(sev: string): string {
  return SEVERITY_CLASSES[sev.toUpperCase()] ?? 'bg-zinc-800 text-zinc-500';
}

function LogRow({ entry }: { entry: LogEntryDTO }) {
  let ts = '';
  try {
    ts = format(new Date(entry.timestamp), 'HH:mm:ss.SSS');
  } catch {
    ts = entry.timestamp;
  }

  return (
    <div className="flex gap-2 items-start py-1.5 border-b border-zinc-800/50 last:border-0 text-xs">
      {/* Timestamp */}
      <span className="shrink-0 font-mono text-zinc-600 w-24">{ts}</span>

      {/* Severity */}
      <span className={clsx('badge shrink-0 w-14 justify-center', severityClass(entry.severity))}>
        {entry.severity.toUpperCase().slice(0, 5)}
      </span>

      {/* Body */}
      <span className="flex-1 text-zinc-300 break-words min-w-0">{entry.body}</span>

      {/* Trace link */}
      {entry.traceId && (
        <Link
          href={`/telemetry/traces/${encodeURIComponent(entry.traceId)}`}
          className="shrink-0 font-mono text-zinc-600 hover:text-amber-400 transition-colors"
          title="View trace"
        >
          {entry.traceId.slice(0, 8)}
        </Link>
      )}
    </div>
  );
}

export function LogStream({
  logs,
  isLoading,
}: {
  logs: LogEntryDTO[];
  isLoading: boolean;
}) {
  if (isLoading && logs.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-5 w-full rounded" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No log entries yet — trigger some requests to see live logs.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 dark:border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono">
      {logs.map((entry, i) => (
        <LogRow key={`${entry.timestamp}-${i}`} entry={entry} />
      ))}
    </div>
  );
}
