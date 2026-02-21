'use client';

import { useSessionId } from '@/lib/hooks/useSessionId';
import { clsx } from 'clsx';

export function SessionBadge({ className }: { className?: string }) {
  const { sessionId, reset } = useSessionId();

  if (!sessionId) return null;

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <span className="text-xs text-zinc-500">Session:</span>
      <code className="badge bg-zinc-800 font-mono text-amber-400 text-xs tracking-tight">
        {sessionId.slice(0, 8)}…
      </code>
      <button
        onClick={reset}
        title="Reset session ID"
        className="text-zinc-600 hover:text-zinc-400 transition-colors text-sm leading-none"
      >
        ↺
      </button>
    </div>
  );
}
