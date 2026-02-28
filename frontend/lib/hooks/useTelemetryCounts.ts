'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import useSWR from 'swr';
import { onBrowserSpan } from '@/lib/otel-browser';
import type { TelemetryCounts } from '@/app/api/telemetry/counts/route';

export interface LiveCounts {
  /** 5-min backend counts from ClickHouse */
  backend: TelemetryCounts | null;
  /** Browser spans accumulated since page load */
  browserSpans: number;
  /** Combined spans/sec over last 10s window */
  spansPerSec: number;
  /** Whether backend data is loading */
  isLoading: boolean;
}

async function fetchCounts(): Promise<TelemetryCounts> {
  const res = await fetch('/api/telemetry/counts', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch counts');
  return res.json();
}

export function useTelemetryCounts(): LiveCounts {
  const [browserSpans, setBrowserSpans] = useState(0);
  const [spansPerSec, setSpansPerSec] = useState(0);
  const recentSpanTimesRef = useRef<number[]>([]);

  // Subscribe to browser spans
  useEffect(() => {
    const unsub = onBrowserSpan(() => {
      setBrowserSpans(prev => prev + 1);
      const now = Date.now();
      recentSpanTimesRef.current = [...recentSpanTimesRef.current.filter(t => now - t < 10_000), now];
    });
    return unsub;
  }, []);

  // Rolling rate calculation — update every second
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const windowMs = 10_000;
      recentSpanTimesRef.current = recentSpanTimesRef.current.filter(t => now - t < windowMs);
      setSpansPerSec(recentSpanTimesRef.current.length / (windowMs / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useSWR<TelemetryCounts>('/api/telemetry/counts', fetchCounts, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
    dedupingInterval: 8_000,
  });

  return {
    backend: data ?? null,
    browserSpans,
    spansPerSec,
    isLoading,
  };
}

/** Time-window options for how to extrapolate the cost view */
export const TIME_WINDOWS = [
  { label: 'Per hour', multiplier: 12 },         // 5min × 12 = 1hr
  { label: 'Per day', multiplier: 288 },          // 5min × 288 = 24hr
  { label: 'Per month', multiplier: 8_640 },      // 5min × 8,640 = 30d
] as const;

export type TimeWindow = typeof TIME_WINDOWS[number];

/** Scale multipliers for projection calculator */
export const SCALE_OPTIONS = [1, 10, 100, 1_000] as const;
export type ScaleOption = typeof SCALE_OPTIONS[number];
