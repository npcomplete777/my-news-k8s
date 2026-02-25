'use client';

import { useState } from 'react';
import { getSessionId } from '@/lib/session';

const sessionHeaders = () => ({
  'X-Session-Id': getSessionId(),
  'Content-Type': 'application/json',
});

const PRESETS = {
  feed:      ['/api/articles?size=10', '/api/articles?page=1&size=5'],
  search:    ['/api/articles/search?q=kubernetes', '/api/articles/search?q=opentelemetry'],
  bookmarks: ['/api/bookmarks'],
  burst:     [
    '/api/articles?size=10',
    '/api/articles/search?q=tracing',
    '/api/bookmarks',
    '/api/articles?size=20',
    '/api/articles/search?q=spans',
    '/api/articles?page=2&size=10',
  ],
} as const;

type Preset = keyof typeof PRESETS;

export function LoadGenerator() {
  const [count, setCount] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  async function fire(preset: Preset) {
    setRunning(true);
    const urls = PRESETS[preset];
    const results = await Promise.allSettled(
      urls.map(u => fetch(u, { headers: sessionHeaders() }))
    );
    setCount(c => c + urls.length);
    const statuses = results.flatMap(r =>
      r.status === 'fulfilled' ? [r.value.status] : []
    );
    setLast(statuses[statuses.length - 1] ?? null);
    setRunning(false);
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-stone-700 dark:text-zinc-300 mb-3">Generate Demo Traffic</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {(['feed', 'search', 'bookmarks', 'burst'] as const).map(p => (
          <button
            key={p}
            onClick={() => fire(p)}
            disabled={running}
            className="btn-ghost capitalize"
          >
            {p === 'burst' ? 'Burst (all×3)' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Fired: {count} request{count !== 1 ? 's' : ''}
        {last !== null ? ` · Last status: ${last}` : ''}
        {running ? ' · Running…' : ''}
      </p>
    </div>
  );
}
