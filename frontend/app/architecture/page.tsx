import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Architecture — O11y Alchemy',
  description: 'Production-grade cloud-native architecture: GKE, Spring Boot 3, Next.js 15, OpenTelemetry, ClickHouse, ArgoCD GitOps.',
};

// ─── data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '8', label: 'News sources polled' },
  { value: '6', label: 'Resilience4j instances' },
  { value: '7', label: 'PostgreSQL tables' },
  { value: '3', label: 'Telemetry backends' },
  { value: '41', label: 'Helm templates' },
  { value: '72h', label: 'Telemetry TTL' },
  { value: '4', label: 'OTel pipelines' },
  { value: '100%', label: 'Auto-instrumented' },
];

const SECTIONS = [
  {
    number: '01',
    label: 'GitOps · CI/CD',
    title: 'Infrastructure & Deployment',
    color: 'text-amber-500',
    stack: ['GKE Standard', 'ArgoCD', 'Helm 3', 'GitHub Actions', 'Traefik / nginx', 'NetworkPolicy'],
    paragraphs: [
      'The platform runs on GKE Standard with all configuration expressed as a single Helm chart (41 templates). ArgoCD manages the cluster: automated sync, self-heal, and three-attempt retry with exponential backoff. There is no manual kubectl — every change that reaches main is deployed automatically.',
      'The CI pipeline uses path-based change detection to build only what changed. Docker images are tagged with the short commit SHA and pushed to GHCR; the pipeline then commits updated image tags back to the Helm values file, which ArgoCD detects and rolls out. Two values files support two environments: k3d for local development and GKE for production.',
      'NetworkPolicies enforce strict least-privilege traffic: the frontend can only reach the backend on port 8080, the backend can only reach PostgreSQL on 5432 and external HTTPS (excluding RFC1918), and no workload has unrestricted egress. The OTel Collector is the only component reachable cluster-wide on OTLP ports 4317/4318.',
    ],
    details: [
      { label: 'Registry', value: 'GHCR (ghcr.io/{owner}/o11y-news-{component})' },
      { label: 'Sync policy', value: 'Automated · prune: true · selfHeal: true' },
      { label: 'Retry', value: '3 attempts · 5s → 3m backoff' },
      { label: 'Ingress routing', value: '/api/admin, /api/otel → frontend; /api → backend' },
    ],
  },
  {
    number: '02',
    label: 'Spring Boot 3 · Java 21',
    title: 'Backend & Data Layer',
    color: 'text-blue-400',
    stack: ['Spring Boot 3.4', 'Java 21 Virtual Threads', 'PostgreSQL 16', 'Flyway', 'HikariCP', 'ZGC'],
    paragraphs: [
      'The backend is a Spring Boot 3.4 application running on Java 21 with virtual threads enabled globally. ZGC is configured with 75% max RAM percentage to take advantage of the low-pause collector at container scale. Flyway manages schema migrations in three versions: initial schema (V1), observability vendor blog sources (V2), and Kubernetes/CNCF sources (V3).',
      'HikariCP is tuned for Kubernetes: 15 max connections, 3 minimum idle, 20-second connection timeout, and 20-minute max lifetime. The schema includes GIN indexes on article tags (array type) and a full-text search index over title and content_snippet — no Elasticsearch required for search.',
      'Authentication uses SHA-256-hashed API keys stored in the api_keys table. An ApiKeyAuthFilter runs on every request, skipping public paths (/api/telemetry/**, /api/articles/**). The X-Session-Id header from the browser is propagated through the request context for session-to-trace correlation in the telemetry API.',
    ],
    details: [
      { label: 'Virtual threads', value: 'spring.threads.virtual.enabled=true' },
      { label: 'JVM', value: '-XX:+UseZGC -XX:MaxRAMPercentage=75.0' },
      { label: 'Connection pool', value: 'HikariCP · max=15, min=3, timeout=20s' },
      { label: 'Schema migrations', value: 'Flyway V1–V3 · DDL mode: validate' },
      { label: 'Deduplication', value: 'SHA-256 hash of normalized URL · O(1) lookup' },
    ],
  },
  {
    number: '03',
    label: 'Resilience4j · RSS · APIs',
    title: 'News Data Pipeline',
    color: 'text-emerald-400',
    stack: ['Resilience4j 2.2', 'Circuit Breaker', 'Rate Limiter', 'Retry', 'Dead Letter Queue', 'Rome RSS'],
    paragraphs: [
      'Eight pollers run on independent schedules: Hacker News (3 min), Reddit (5 min), Dev.to (10 min), Lobsters (10 min), YouTube (15 min), Kubernetes Blog (15 min), CNCF Blog (15 min), and GitHub releases (hourly). Each poller has its own Resilience4j circuit breaker, rate limiter, and retry policy — a failure in the GitHub poller has zero effect on HN or Reddit.',
      'Circuit breakers use a 10-call sliding window with a 50% failure threshold. Recovery wait times are tuned per source: 60 seconds for fast APIs (HN, Reddit, Lobsters), 120 seconds for Dev.to, and 300 seconds for GitHub (which enforces its own rate limits). Half-open state allows 2–3 trial calls before fully re-opening.',
      'Failed article fetches are written to a dead_letters table with status PENDING. A retry scheduler runs every 30 minutes with up to 5 attempts and exponential backoff starting at 60 seconds (multiplier 2.0). Broad-spectrum sources (HN, Reddit, GitHub) pass through a keyword relevance filter before persistence; curated sources (Kubernetes Blog, CNCF) are persisted unconditionally.',
    ],
    details: [
      { label: 'Pollers', value: 'HackerNews · Reddit · DevTo · GitHub · Lobsters · YouTube · K8s Blog · CNCF' },
      { label: 'Circuit breaker', value: '10-call window · 50% threshold · per-source wait times' },
      { label: 'Dead letter retry', value: '5 max attempts · 60s initial · 2.0 multiplier' },
      { label: 'Reddit auth', value: 'OAuth2 client_credentials · cached token + 600s refresh buffer' },
    ],
  },
  {
    number: '04',
    label: 'OTel · ClickHouse · Dash0',
    title: 'Observability Pipeline',
    color: 'text-purple-400',
    stack: ['Dash0 Operator', 'OTel Collector 0.118', 'ClickHouse 24.8', 'OTLP', 'LZ4', 'W3C Traceparent'],
    paragraphs: [
      'The Dash0 Operator auto-instruments all backend workloads by injecting the OpenTelemetry JavaAgent via an init container — no application code changes required. @WithSpan annotations supplement auto-instrumentation at critical boundaries: poller execution, deduplication checks, and telemetry queries. Micrometer exports JVM and HikariCP metrics as OTLP every 30 seconds.',
      'The OTel Collector (contrib 0.118.0) receives OTLP on gRPC (4317) and HTTP (4318). A single batch processor (5s timeout) feeds a ClickHouse exporter with LZ4 compression, a 100-item queue, and 2 consumers. The database auto-creates otel_traces, otel_logs, otel_metrics_gauge, otel_metrics_sum, and otel_metrics_histogram tables with a 72-hour TTL — the cluster stays lean without manual cleanup.',
      'The frontend injects the OpenTelemetry browser SDK via OTelProvider on every page load. DocumentLoadInstrumentation captures navigation timing; FetchInstrumentation traces every API call and propagates W3C traceparent headers so browser-initiated requests appear as child spans of the corresponding backend server spans — a single distributed trace spans from browser click to JDBC query.',
    ],
    details: [
      { label: 'Agent injection', value: 'Dash0 Operator · LD_PRELOAD · zero code changes' },
      { label: 'Collector exporters', value: 'ClickHouse (primary) · debug (secondary)' },
      { label: 'Compression', value: 'LZ4 · 10–20× storage reduction' },
      { label: 'TTL', value: '72 hours · auto-purged by ClickHouse TTL engine' },
      { label: 'Browser SDK', value: 'DocumentLoad + Fetch instrumentation · W3C context propagation' },
    ],
  },
  {
    number: '05',
    label: 'Live UI · Telemetry API',
    title: 'Live Telemetry Interface',
    color: 'text-rose-400',
    stack: ['Next.js 15 App Router', 'SWR', 'SSE', 'React 19', 'TypeScript', 'Tailwind CSS 3'],
    paragraphs: [
      'The telemetry API (TelemetryController) exposes five public endpoints with no authentication. A priority-based backend selector routes queries to ClickHouse first (if LOCAL_OTEL_CLICKHOUSE_URL is set), Dash0 second (if DASH0_API_TOKEN is set), and Jaeger + Prometheus as a legacy fallback. TelemetryService presents the same interface regardless of which backend is active.',
      'The Traces endpoint streams via Server-Sent Events on a virtual thread per connection — the frontend receives new trace data every 3 seconds without polling. The Metrics endpoint computes request rate, p50/p95/p99 latency, error rate, JVM heap, active DB connections, and per-source circuit breaker states from ClickHouse in a single HTTP request to the ClickHouse HTTP API using FORMAT JSONEachRow.',
      'The Service Map endpoint walks CLIENT and PRODUCER spans to derive the service dependency graph: nodes (backend, postgres, external) and weighted edges (requests/min, error rate). PII redaction strips net.peer.ip, http.client_ip, cookies, and auth headers before any telemetry data reaches the frontend.',
    ],
    details: [
      { label: 'Backend priority', value: 'ClickHouse → Dash0 → Jaeger+Prometheus' },
      { label: 'Trace stream', value: 'SSE · virtual thread per connection · 3s interval' },
      { label: 'Metrics query', value: 'Single ClickHouse HTTP call · JSONEachRow format' },
      { label: 'Tabs', value: 'Overview · Traces · Metrics · Logs · Browser' },
      { label: 'PII', value: 'IP, cookies, auth headers stripped server-side' },
    ],
  },
  {
    number: '06',
    label: 'Architectural Decisions',
    title: 'Design Rationale',
    color: 'text-amber-400',
    stack: ['Virtual Threads over Reactive', 'ClickHouse over Prometheus', 'GitOps over kubectl', 'OTLP-native from day one'],
    paragraphs: [
      'Virtual threads (Project Loom) over Spring WebFlux: the blocking I/O model of Spring MVC is simpler to instrument with OpenTelemetry, produces cleaner traces without reactive-scheduler noise, and carries no penalty at this scale. ZGC makes long-lived threads cheap. The SSE trace stream — one virtual thread per browser connection — would require complex Flux pipelines in a reactive model; here it is a simple while loop.',
      'ClickHouse over Prometheus + Jaeger: a single OLAP store for traces, logs, and metrics eliminates the operational overhead of two separate systems, enables arbitrary SQL correlations across signal types, and compresses telemetry data 10–20× with LZ4. The ClickHouseTelemetryClient queries via the HTTP API using FORMAT JSONEachRow — no JDBC driver, no extra dependency, sub-millisecond query latency for 72-hour windows.',
      "OTLP-native from the start: rather than adopting Prometheus scraping or Jaeger's proprietary format, the entire stack emits and stores OTLP. This means any OTLP-compatible backend (Dash0, Honeycomb, Grafana, New Relic) can receive the same signals with a single exporter swap. The browser SDK propagates W3C traceparent so distributed traces traverse the full stack: browser → Next.js API proxy → Spring Boot → PostgreSQL, all correlated by a single trace ID.",
    ],
    details: [
      { label: 'Threading model', value: 'Java 21 Loom · Virtual threads · ZGC' },
      { label: 'Telemetry storage', value: 'ClickHouse 24.8 · OLAP · LZ4 · 72h TTL' },
      { label: 'Signal format', value: 'OTLP-native end-to-end · backend-agnostic' },
      { label: 'Deployment model', value: 'GitOps · ArgoCD · Helm · no manual kubectl' },
    ],
  },
];

// ─── components ──────────────────────────────────────────────────────────────

function FlowNode({
  label, sublabel, accent = false,
}: { label: string; sublabel?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-center ${
      accent
        ? 'border-amber-500/40 bg-amber-950/20'
        : 'border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
    }`}>
      <p className={`text-xs font-bold uppercase tracking-wide leading-tight ${
        accent ? 'text-amber-400' : 'text-stone-900 dark:text-zinc-100'
      }`}>{label}</p>
      {sublabel && (
        <p className="text-[10px] text-stone-400 dark:text-zinc-600 mt-0.5 leading-tight">{sublabel}</p>
      )}
    </div>
  );
}

function Arrow({ label, vertical = false }: { label?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center gap-0.5 py-1">
        {label && <span className="text-[9px] uppercase tracking-widest text-stone-400 dark:text-zinc-600">{label}</span>}
        <span className="text-stone-300 dark:text-zinc-600 text-sm">↓</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      {label && <span className="text-[9px] uppercase tracking-widest text-stone-400 dark:text-zinc-600 whitespace-nowrap">{label}</span>}
      <span className="text-stone-300 dark:text-zinc-600">→</span>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8">

        {/* Header */}
        <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-2">
            GKE · Spring Boot 3 · Next.js 15 · OpenTelemetry · ClickHouse
          </p>
          <h1 className="font-display font-black uppercase leading-[0.9] tracking-wide text-stone-900 dark:text-zinc-100 text-5xl sm:text-6xl lg:text-8xl mb-5">
            Architecture
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
            A production-grade cloud-native news aggregator deployed on GKE — built as a live
            observability showcase. Every layer is instrumented end-to-end: browser spans connect
            to backend traces connect to database queries, all correlated through W3C traceparent
            headers and stored in ClickHouse.
          </p>
        </div>

        {/* Stats bar */}
        <div className="mb-14 grid grid-cols-4 gap-px bg-stone-200 dark:bg-zinc-800 rounded-lg overflow-hidden sm:grid-cols-8">
          {STATS.map(s => (
            <div key={s.label} className="bg-white dark:bg-zinc-950 px-3 py-4 flex flex-col gap-1">
              <span className="font-display font-black text-2xl text-stone-900 dark:text-zinc-100 leading-none">
                {s.value}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-stone-400 dark:text-zinc-600 leading-tight">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Telemetry flow diagram */}
        <div className="mb-16">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-4">
            End-to-end telemetry flow
          </p>

          {/* Main horizontal flow */}
          <div className="rounded-lg border border-stone-200 dark:border-zinc-800 p-6 overflow-x-auto">
            {/* Request / app layer */}
            <div className="flex items-center gap-2 mb-2 min-w-max">
              <FlowNode label="Browser" sublabel="OTel SDK" accent />
              <Arrow label="HTTPS + traceparent" />
              <FlowNode label="Traefik / nginx" sublabel="Ingress" />
              <Arrow />
              <FlowNode label="Next.js 15" sublabel="App Router" />
              <Arrow label="/api/*" />
              <FlowNode label="Spring Boot 3" sublabel="Java 21 · Virtual Threads" accent />
              <Arrow label="JDBC" />
              <FlowNode label="PostgreSQL 16" sublabel="10 Gi · Flyway" />
            </div>

            {/* Divider */}
            <div className="my-4 border-t border-dashed border-stone-200 dark:border-zinc-800" />

            {/* Telemetry layer */}
            <div className="flex items-center gap-2 min-w-max">
              <FlowNode label="OTel Browser SDK" sublabel="DocumentLoad · Fetch" accent />
              <Arrow label="/api/otel proxy" />
              <FlowNode label="OTel Collector" sublabel="contrib 0.118 · gRPC+HTTP" />
              <Arrow label="LZ4 batch" />
              <FlowNode label="ClickHouse 24.8" sublabel="otel_traces · otel_logs · otel_metrics" accent />
              <Arrow label="HTTP API" />
              <FlowNode label="Telemetry API" sublabel="/api/telemetry · SSE stream" />
              <Arrow />
              <FlowNode label="Live Telemetry UI" sublabel="Traces · Metrics · Logs" accent />
            </div>

            {/* Side note */}
            <div className="mt-4 flex items-center gap-3 text-[10px] text-stone-400 dark:text-zinc-600">
              <span className="rounded border border-stone-200 dark:border-zinc-800 px-2 py-1">
                Dash0 Operator → JavaAgent injection (auto-instrumentation, no code changes)
              </span>
              <span className="rounded border border-stone-200 dark:border-zinc-800 px-2 py-1">
                ArgoCD → Helm → GKE (automated GitOps sync on every push)
              </span>
            </div>
          </div>
        </div>

        {/* CI/CD flow */}
        <div className="mb-16">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-4">
            GitOps deployment pipeline
          </p>
          <div className="rounded-lg border border-stone-200 dark:border-zinc-800 p-6 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <FlowNode label="git push" sublabel="main branch" />
              <Arrow />
              <FlowNode label="GitHub Actions" sublabel="Path-detect · Build & Push" />
              <Arrow label="SHA tag" />
              <FlowNode label="GHCR" sublabel="ghcr.io/{owner}" />
              <Arrow label="commit values" />
              <FlowNode label="Helm values-gke.yaml" sublabel="image.tag: {sha}" accent />
              <Arrow label="detect diff" />
              <FlowNode label="ArgoCD" sublabel="Auto-sync · self-heal" />
              <Arrow label="kubectl apply" />
              <FlowNode label="GKE rollout" sublabel="RollingUpdate · zero downtime" accent />
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-0">
          {SECTIONS.map((section, idx) => (
            <div
              key={section.number}
              className={`py-12 ${idx !== 0 ? 'border-t border-stone-100 dark:border-zinc-900' : ''}`}
            >
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
                {/* Left: number + meta */}
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <span className={`font-display font-black text-7xl leading-none ${section.color} opacity-30`}>
                    {section.number}
                  </span>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 mb-1 ${section.color}`}>
                    {section.label}
                  </p>
                  <h2 className="font-black text-xl uppercase tracking-wide text-stone-900 dark:text-zinc-100 mb-4">
                    {section.title}
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {section.stack.map(s => (
                      <span key={s} className="tag-pill text-[10px]">{s}</span>
                    ))}
                  </div>
                </div>

                {/* Right: content */}
                <div>
                  <div className="space-y-4 mb-6">
                    {section.paragraphs.map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                        {p}
                      </p>
                    ))}
                  </div>

                  {/* Details table */}
                  <div className="rounded-lg border border-stone-100 dark:border-zinc-800 overflow-hidden">
                    {section.details.map((d, i) => (
                      <div
                        key={d.label}
                        className={`flex gap-4 px-4 py-2.5 text-xs ${
                          i % 2 === 0
                            ? 'bg-stone-50 dark:bg-zinc-900/50'
                            : 'bg-white dark:bg-zinc-950'
                        }`}
                      >
                        <span className="w-36 shrink-0 font-bold uppercase tracking-wide text-stone-400 dark:text-zinc-600">
                          {d.label}
                        </span>
                        <span className="font-mono text-stone-700 dark:text-zinc-300">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pull quote */}
        <div className="mt-12 border-t-2 border-stone-900 dark:border-zinc-100 pt-8">
          <blockquote className="max-w-3xl">
            <p className="font-display font-black uppercase text-3xl sm:text-4xl leading-[0.95] text-stone-900 dark:text-zinc-100">
              &ldquo;Every component is auto-instrumented. Every request is traced. Every failure is
              circuit-broken. Zero kubectl in production.&rdquo;
            </p>
            <footer className="mt-4 text-xs text-stone-400 dark:text-zinc-600 uppercase tracking-widest">
              O11y Alchemy · o11y-alchemy.com
            </footer>
          </blockquote>
        </div>

      </div>
    </div>
  );
}
