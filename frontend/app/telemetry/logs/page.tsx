'use client';

import { useState } from 'react';
import { LogStream } from '@/components/telemetry/LogStream';
import { useLogs } from '@/lib/hooks/useTelemetry';

const SEVERITIES = ['', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
const SEVERITY_LABELS: Record<string, string> = {
  '': 'All',
  DEBUG: 'Debug+',
  INFO: 'Info+',
  WARN: 'Warn+',
  ERROR: 'Error only',
};

const TIME_OPTIONS = [
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
];

export default function LogsPage() {
  const [minutes, setMinutes] = useState(10);
  const [minSeverity, setMinSeverity] = useState('');

  const { logs, isLoading } = useLogs({ minutes, minSeverity: minSeverity || undefined, limit: 200 });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time range */}
        <div className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-zinc-800 p-0.5">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMinutes(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                minutes === opt.value
                  ? 'bg-stone-200 text-stone-800 dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-stone-500 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-zinc-800 p-0.5">
          {SEVERITIES.map(sev => (
            <button
              key={sev}
              onClick={() => setMinSeverity(sev)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                minSeverity === sev
                  ? 'bg-stone-200 text-stone-800 dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-stone-500 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300'
              }`}
            >
              {SEVERITY_LABELS[sev]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {!isLoading && (
        <p className="text-xs text-zinc-500">
          {logs.length} log entr{logs.length !== 1 ? 'ies' : 'y'} in the last {minutes} min
          {minSeverity ? ` (${SEVERITY_LABELS[minSeverity]})` : ''}
        </p>
      )}

      {/* Log stream */}
      <LogStream logs={logs} isLoading={isLoading} />
    </div>
  );
}
