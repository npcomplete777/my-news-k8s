'use client';

import { useState } from 'react';
import { TraceList } from '@/components/telemetry/TraceList';
import { useTraces } from '@/lib/hooks/useTelemetry';

const TIME_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
];

export default function TracesPage() {
  const [minutes, setMinutes] = useState(5);
  const [errorOnly, setErrorOnly] = useState(false);

  const { traces, isLoading, mutate } = useTraces({ minutes, errorOnly, limit: 50 });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time range */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 p-0.5">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMinutes(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                minutes === opt.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Error filter */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={errorOnly}
            onChange={e => setErrorOnly(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
          />
          Errors only
        </label>

        {/* Refresh */}
        <button
          onClick={() => mutate()}
          className="btn-ghost ml-auto text-xs"
          title="Refresh"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary */}
      {!isLoading && (
        <p className="text-xs text-zinc-500">
          {traces.length} trace{traces.length !== 1 ? 's' : ''} in the last {minutes} min
          {errorOnly ? ' (errors only)' : ''}
        </p>
      )}

      {/* Trace list */}
      <TraceList
        traces={traces}
        isLoading={isLoading}
        emptyMessage={`No traces in the last ${minutes} minutes${errorOnly ? ' with errors' : ''}.`}
      />
    </div>
  );
}
