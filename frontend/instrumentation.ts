/**
 * Next.js server-side OpenTelemetry instrumentation.
 *
 * This file is loaded by Next.js at startup (Node.js runtime only).
 * It creates a NodeTracerProvider that:
 *   1. Reads W3C `traceparent` headers from incoming browser fetch requests
 *      and creates child spans under the browser's trace.
 *   2. Injects `traceparent` into outgoing requests to the Spring Boot backend,
 *      so backend spans appear as children of the same trace.
 *   3. Exports those server-side spans to the OTel Collector via OTLP/HTTP.
 *
 * This is the bridge that correlates browser SDK spans with server-side spans.
 */
export async function register() {
  // Only run in Node.js runtime — not Edge runtime
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node');
  const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-base');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { Resource } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');
  const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http');
  const { registerInstrumentations } = await import('@opentelemetry/instrumentation');

  const collectorUrl = process.env.OTELCOL_URL ?? 'http://otelcol:4318';

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'o11y-news-frontend',
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${collectorUrl}/v1/traces` }),
        { scheduledDelayMillis: 5000 }
      ),
    ],
  });

  provider.register();

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation({
        // Don't create spans for Next.js internals or the OTel export proxy itself
        ignoreIncomingRequestHook: (req) => {
          const url = req.url ?? '';
          return (
            url.startsWith('/_next/') ||
            url === '/favicon.ico' ||
            url === '/robots.txt' ||
            url === '/sitemap.xml' ||
            url.startsWith('/api/otel/')    // skip OTel proxy — would create circular spans
          );
        },
        // Don't trace outgoing calls to the OTel Collector (spans about spans)
        ignoreOutgoingRequestHook: (req) => {
          const host = (typeof req === 'object' && req !== null && 'host' in req)
            ? String((req as { host?: string }).host ?? '')
            : '';
          return host.includes('otelcol') || host.includes('4318');
        },
      }),
    ],
  });
}
