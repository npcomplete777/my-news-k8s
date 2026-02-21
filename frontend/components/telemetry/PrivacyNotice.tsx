'use client';

import { useState } from 'react';

export function PrivacyNotice() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-amber-300 font-medium">
          🔒 Anonymized live telemetry — no personal data
        </p>
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 text-xs text-amber-600 hover:text-amber-400 transition-colors"
        >
          {expanded ? 'Hide' : 'Learn more'}
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1 text-xs text-zinc-400 list-none">
          <li>• IP addresses, user agents, and cookies are stripped server-side.</li>
          <li>• Traces show HTTP method, URL path, latency, and status only — no request bodies.</li>
          <li>• Your browser session ID highlights your own requests in the trace list.</li>
          <li>• This view is read-only. Data refreshes every 3–10 seconds.</li>
        </ul>
      )}
    </div>
  );
}
