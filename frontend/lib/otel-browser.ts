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

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

// Module-level span handle and provider ref so OTelProvider can rotate spans on route change
let _pageSpan: Span | null = null;
let _provider: WebTracerProvider | null = null;

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
    },
  });
}

export function initBrowserOtel(): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  const provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'o11y-news-browser',
      'browser.user_agent': navigator.userAgent,
      'browser.language': navigator.language,
      'browser.languages': navigator.languages.join(','),
      'browser.screen_width': screen.width,
      'browser.screen_height': screen.height,
      'browser.color_depth': screen.colorDepth,
      'browser.device_pixel_ratio': window.devicePixelRatio,
      'browser.timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      'browser.platform': navigator.platform,
      'browser.online': navigator.onLine,
      'page.referrer': document.referrer,
      'page.origin': window.location.origin,
    }),
  });

  provider.addSpanProcessor(new NotifyingSpanProcessor());
  provider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter({
      url: '/api/otel/v1/traces',
      headers: {}, // force XHR transport instead of sendBeacon (sendBeacon is fire-and-forget with no retry)
    }))
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

  // Start the first page span
  startPageSpan();

  // Tab-level events: hidden/close/mobile background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      endPageSpan();
    } else if (document.visibilityState === 'visible') {
      startPageSpan();
    }
  });

  window.addEventListener('pagehide', () => {
    endPageSpan();
  });
}
