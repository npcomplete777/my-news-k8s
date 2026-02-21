'use client';

import { useEffect, useRef, useState } from 'react';

export interface SSEState<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
}

/**
 * Opens a Server-Sent Events connection to `url` and returns the latest parsed event data.
 * Reconnection is handled automatically by the browser's EventSource.
 * Pass null to disable the connection.
 */
export function useSSE<T>(url: string | null): SSEState<T> {
  const [state, setState] = useState<SSEState<T>>({
    data: null,
    connected: false,
    error: null,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true, error: null }));
    };

    es.onmessage = (event) => {
      try {
        setState(prev => ({
          ...prev,
          data: JSON.parse(event.data) as T,
          connected: true,
        }));
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false, error: 'Stream reconnecting…' }));
    };

    return () => {
      es.close();
    };
  }, [url]);

  return state;
}
