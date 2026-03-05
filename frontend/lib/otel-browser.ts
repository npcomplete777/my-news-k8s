import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';
import type { Context, Span } from '@opentelemetry/api';

export interface BrowserSpan {
  name: string;
  traceId: string;
  spanId: string;
  startTime: number; // epoch ms
  endTime: number;   // epoch ms
  durationMs: number;
  status: 'OK' | 'ERROR' | 'UNSET';
  attributes: Record<string, unknown>;
}

type SpanCallback = (span: BrowserSpan) => void;

const subscribers = new Set<SpanCallback>();
let initialized = false;

/** Subscribe to completed browser spans. Returns an unsubscribe function. */
export function onBrowserSpan(cb: SpanCallback): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/** In-memory span processor that notifies React subscribers on each completed span. */
class NotifyingSpanProcessor implements SpanProcessor {
  onStart(_span: ReadableSpan, _parentContext: Context): void {}

  onEnd(span: ReadableSpan): void {
    const startMs = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
    const endMs = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
    const bs: BrowserSpan = {
      name: span.name,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      startTime: startMs,
      endTime: endMs,
      durationMs: endMs - startMs,
      status: span.status.code === 2 ? 'ERROR' : span.status.code === 1 ? 'OK' : 'UNSET',
      attributes: { ...span.attributes },
    };
    subscribers.forEach(cb => cb(bs));
  }

  shutdown(): Promise<void> { return Promise.resolve(); }
  forceFlush(): Promise<void> { return Promise.resolve(); }
}

// Module-level handles
let _pageSpan: Span | null = null;
let _provider: WebTracerProvider | null = null;
// Geo context populated async from /api/visitor-context
let _visitorGeo: Record<string, string> = {};

/** End the current page.view span and flush. Called by OTelProvider on route change. */
export function endPageSpan(): void {
  if (_pageSpan) {
    _pageSpan.end();
    _pageSpan = null;
  }
  _provider?.forceFlush().catch(() => {});
}

/** Start a new page.view span for the current URL. Called by OTelProvider on route change. */
export function startPageSpan(): void {
  if (!_provider) return;
  endPageSpan();

  // Connection info (NetworkInformation API — not universally supported)
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;
  const connAttrs: Record<string, string | number | boolean> = {};
  if (conn) {
    if (conn.effectiveType) connAttrs['connection.effective_type'] = conn.effectiveType;
    if (conn.downlink != null) connAttrs['connection.downlink_mbps'] = conn.downlink;
    if (conn.rtt != null) connAttrs['connection.rtt_ms'] = conn.rtt;
    connAttrs['connection.save_data'] = conn.saveData ?? false;
  }

  // UTM params
  const utmAttrs: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = params.get(p);
    if (v) utmAttrs[`page.${p}`] = v;
  }

  const tracer = trace.getTracer('o11y-news-browser');
  _pageSpan = tracer.startSpan('page.view', {
    attributes: {
      'page.url': window.location.href,
      'page.path': window.location.pathname,
      'page.search': window.location.search,
      'page.hash': window.location.hash,
      'page.title': document.title,
      'page.referrer': document.referrer,
      'viewport.width': window.innerWidth,
      'viewport.height': window.innerHeight,
      ...connAttrs,
      ...utmAttrs,
      ..._visitorGeo,
    },
  });
}

export function initBrowserOtel(): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  // DeviceMemory API — returns rough bucket (0.25, 0.5, 1, 2, 4, 8 GB) or undefined
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;

  const provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'o11y-news-browser',
      // Browser identity
      'browser.user_agent': navigator.userAgent,
      'browser.language': navigator.language,
      'browser.languages': navigator.languages.join(','),
      'browser.platform': navigator.platform,
      'browser.online': navigator.onLine,
      // Hardware capabilities
      'browser.hardware_concurrency': navigator.hardwareConcurrency,
      'browser.device_memory_gb': deviceMemory ?? 0,
      'browser.max_touch_points': navigator.maxTouchPoints,
      'browser.cookies_enabled': navigator.cookieEnabled,
      'browser.do_not_track': navigator.doNotTrack ?? 'unspecified',
      // Display
      'browser.screen_width': screen.width,
      'browser.screen_height': screen.height,
      'browser.color_depth': screen.colorDepth,
      'browser.device_pixel_ratio': window.devicePixelRatio,
      'browser.color_scheme': window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      // Locale
      'browser.timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      // Page origin
      'page.referrer': document.referrer,
      'page.origin': window.location.origin,
    }),
  });

  provider.addSpanProcessor(new NotifyingSpanProcessor());
  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({ url: '/api/otel/v1/traces' }),
      { scheduledDelayMillis: 5000, maxExportBatchSize: 50 }
    )
  );

  provider.register();
  _provider = provider;

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        ignoreUrls: [/\/api\/otel\//],
      }),
    ],
  });

  // Async geo lookup — populates _visitorGeo for subsequent page.view spans
  fetch('/api/visitor-context')
    .then(r => r.json())
    .then((geo: { country?: string; countryCode?: string; region?: string; city?: string; isp?: string; timezone?: string }) => {
      _visitorGeo = {};
      if (geo.country)     _visitorGeo['geo.country']      = geo.country;
      if (geo.countryCode) _visitorGeo['geo.country_code'] = geo.countryCode;
      if (geo.region)      _visitorGeo['geo.region']       = geo.region;
      if (geo.city)        _visitorGeo['geo.city']         = geo.city;
      if (geo.isp)         _visitorGeo['geo.isp']          = geo.isp;
      if (geo.timezone)    _visitorGeo['geo.timezone']     = geo.timezone;
      // Patch the running page span with geo attrs
      if (_pageSpan) {
        for (const [k, v] of Object.entries(_visitorGeo)) {
          _pageSpan.setAttribute(k, v);
        }
      }
    })
    .catch(() => {});

  // Start first page span
  startPageSpan();

  // Tab-level events
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') endPageSpan();
    else if (document.visibilityState === 'visible') startPageSpan();
  });
  window.addEventListener('pagehide', () => endPageSpan());
}
