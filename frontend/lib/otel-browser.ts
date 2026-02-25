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

export function initBrowserOtel(): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  const provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'o11y-news-browser',
      // User identity / environment attributes — stored in ClickHouse on every span
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

  // In-memory: feeds React state for the Browser tab
  provider.addSpanProcessor(new NotifyingSpanProcessor());

  // Batch export to OTel collector via Next.js same-origin proxy
  provider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter({ url: '/api/otel/v1/traces' }))
  );

  provider.register();

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        ignoreUrls: [/\/api\/otel\//],
      }),
    ],
  });

  // Track page view duration: one span per page visit, ends when tab hides or page unloads
  trackPageViews(provider);
}

function trackPageViews(provider: WebTracerProvider): void {
  const tracer = trace.getTracer('o11y-news-browser');
  let pageSpan: Span | null = null;

  function startPageSpan() {
    pageSpan = tracer.startSpan('page.view', {
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

  function endPageSpan() {
    if (pageSpan) {
      pageSpan.end();
      pageSpan = null;
    }
  }

  startPageSpan();

  // visibilitychange is the most reliable signal for tab hide/close/switch
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      endPageSpan();
      // Flush so spans export before the browser suspends the page
      provider.forceFlush().catch(() => {});
    } else if (document.visibilityState === 'visible') {
      startPageSpan();
    }
  });

  // pagehide fires on mobile and bfcache navigation where visibilitychange may not
  window.addEventListener('pagehide', () => {
    endPageSpan();
    provider.forceFlush().catch(() => {});
  });
}
