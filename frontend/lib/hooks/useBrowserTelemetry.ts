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
    ttfbMs: null, domReadyMs: null, loadMs: null, fcpMs: null,
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

// ────────────────────────────────────────────────────────────────────────────
// Visitor profile — everything the browser exposes + async geo from the server
// ────────────────────────────────────────────────────────────────────────────

export interface VisitorProfile {
  // Browser
  userAgent: string;
  platform: string;
  // Hardware
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  maxTouchPoints: number;
  // Display
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  colorScheme: 'dark' | 'light';
  // Identity signals
  language: string;
  languages: string[];
  timezone: string;
  cookiesEnabled: boolean;
  doNotTrack: string;
  online: boolean;
  // Network
  connectionType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean;
  // Geo — async, populated after /api/visitor-context resolves
  geoLoaded: boolean;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  geoTimezone: string;
}

export function useVisitorProfile(): VisitorProfile | null {
  const [profile, setProfile] = useState<VisitorProfile | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const conn = (navigator as unknown as {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    }).connection;

    const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;

    const base: VisitorProfile = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGb: deviceMemory ?? null,
      maxTouchPoints: navigator.maxTouchPoints,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      devicePixelRatio: window.devicePixelRatio,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      language: navigator.language,
      languages: [...navigator.languages],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack ?? 'unspecified',
      online: navigator.onLine,
      connectionType: conn?.effectiveType ?? null,
      downlinkMbps: conn?.downlink ?? null,
      rttMs: conn?.rtt ?? null,
      saveData: conn?.saveData ?? false,
      geoLoaded: false,
      country: '', countryCode: '', region: '', city: '', isp: '', geoTimezone: '',
    };
    setProfile(base);

    fetch('/api/visitor-context')
      .then(r => r.json())
      .then((geo: { country?: string; countryCode?: string; region?: string; city?: string; isp?: string; timezone?: string }) => {
        setProfile(prev => prev ? {
          ...prev,
          geoLoaded: true,
          country: geo.country ?? '',
          countryCode: geo.countryCode ?? '',
          region: geo.region ?? '',
          city: geo.city ?? '',
          isp: geo.isp ?? '',
          geoTimezone: geo.timezone ?? '',
        } : prev);
      })
      .catch(() => setProfile(prev => prev ? { ...prev, geoLoaded: true } : prev));
  }, []);

  return profile;
}
