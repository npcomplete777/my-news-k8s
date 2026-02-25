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
import type { Context } from '@opentelemetry/api';

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
    }),
  });

  // In-memory: immediately feeds React state for the Browser tab
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
        ignoreUrls: [/\/api\/otel\//], // avoid self-tracing the OTLP export requests
      }),
    ],
  });
}
