'use client';

import { useEffect, useState } from 'react';
import type { BrowserSpan } from '@/lib/otel-browser';

const MAX_SPANS = 20;

export function useBrowserSpans(): BrowserSpan[] {
  const [spans, setSpans] = useState<BrowserSpan[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    import('@/lib/otel-browser').then(({ onBrowserSpan }) => {
      unsub = onBrowserSpan(span => {
        setSpans(prev => [span, ...prev].slice(0, MAX_SPANS));
      });
    });

    return () => unsub?.();
  }, []);

  return spans;
}

export interface NavTiming {
  ttfbMs: number | null;
  domReadyMs: number | null;
  loadMs: number | null;
  fcpMs: number | null;
}

export function useNavTiming(): NavTiming {
  const [timing, setTiming] = useState<NavTiming>({
    ttfbMs: null,
    domReadyMs: null,
    loadMs: null,
    fcpMs: null,
  });

  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      setTiming(prev => ({
        ...prev,
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
        domReadyMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadMs: Math.round(nav.loadEventEnd - nav.startTime),
      }));
    }

    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              setTiming(prev => ({ ...prev, fcpMs: Math.round(entry.startTime) }));
              observer.disconnect();
            }
          }
        });
        observer.observe({ type: 'paint', buffered: true });
        return () => observer.disconnect();
      } catch {
        // not supported
      }
    }
  }, []);

  return timing;
}
