import type { Metadata } from 'next';
import { QueryExplorer } from '@/components/clickhouse/QueryExplorer';

export const metadata: Metadata = {
  title: 'ClickHouse Schema — O11y Alchemy',
  description: 'Redesigning the default OpenTelemetry ClickHouse schema for production: Null-engine ingest, Materialized Views, extracted columns, proper codecs, and pre-aggregated RED metrics.',
};

// ─── data ────────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    number: '01',
    color: 'text-red-400',
    title: 'Map(String, String) — the core bottleneck',
    body: [
      'Every attribute — HTTP method, status code, Kubernetes pod name, database statement — lives in a single Map column. When you filter on SpanAttributes[\'http.method\'], ClickHouse loads the entire Map for every row and linearly scans it to find your key. With 40+ attributes per span, you read 40× more data than necessary.',
      'Map values are always String. Your http.status_code of 200 is stored as "200". Every comparison requires toUInt16OrZero(SpanAttributes[\'http.status_code\']) > 400 at query time — burning CPU, obstructing the optimizer, and producing error-prone SQL. Extracted columns carry the right type on disk.',
      'Most critically: Map keys cannot participate in ORDER BY or PRIMARY KEY. ClickHouse\'s primary index is completely blind to anything inside a Map. No granule elimination. No data skipping. Full table scan every time you filter on an attribute.',
    ],
  },
  {
    number: '02',
    color: 'text-amber-400',
    title: 'Generic ORDER BY ignores your access patterns',
    body: [
      'The default traces schema orders by (ServiceName, SpanName, toDateTime(Timestamp)). The default metrics_gauge table includes Attributes (a Map!) in the ORDER BY — which sorts lexicographically but achieves nothing useful for query acceleration.',
      'In a Kubernetes environment, the most common filter sequence is namespace → service → operation → time. Our redesigned key — (ServiceName, K8sNamespace, SpanName, toUnixTimestamp(TimestampTime), TraceId) — eliminates entire granules before touching Timestamp, cutting scan depth at each level.',
    ],
  },
  {
    number: '03',
    color: 'text-amber-400',
    title: 'Five bloom filters compensating for Map slowness',
    body: [
      'The default schema creates bloom filter indices on mapKeys(SpanAttributes), mapValues(SpanAttributes), mapKeys(ResourceAttributes), and mapValues(ResourceAttributes) — four indices trying to paper over the fundamental problem of Map access. They consume disk, slow every insert, and rarely help. ClickHouse\'s own docs warn to test before deploying secondary indices.',
      'After extracting hot keys to top-level columns, those bloom filters become unnecessary. We keep exactly three: a bloom_filter(0.001) for TraceId point lookups, and minmax indices on HttpStatusCode and Duration for range filters.',
    ],
  },
  {
    number: '04',
    color: 'text-blue-400',
    title: 'No pre-aggregation for dashboard queries',
    body: [
      'Every dashboard refresh hits the raw trace table. For RED metrics (Rate, Errors, Duration) over the last hour, this means scanning all raw spans every time a panel reloads. We add an AggregatingMergeTree table (red_metrics_1m) that maintains per-minute rollups as data arrives.',
      'Critically, both the main traces MV and the RED metrics MV source from traces_raw — the Null table. ClickHouse Materialized Views only fire on direct INSERT, not on INSERTs caused by other MVs. Both run in parallel at ingest time.',
    ],
  },
];

const PIPELINE_STEPS = [
  {
    step: '01',
    label: 'OTel Collector',
    detail: 'create_schema: false. Writes traces to traces_raw, logs to logs_raw. 4 consumers, 500-item queue.',
    color: 'text-amber-500',
    border: 'border-amber-500/30',
  },
  {
    step: '02',
    label: 'Null Tables',
    detail: 'traces_raw and logs_raw: Null engine. Receive inserts, discard storage, trigger all attached MVs simultaneously.',
    color: 'text-blue-400',
    border: 'border-blue-400/30',
  },
  {
    step: '03',
    label: 'Materialized Views',
    detail: 'traces_mv → traces (extracts 13 columns, casts types). red_metrics_1m_mv → AggregatingMergeTree. Both fire from traces_raw.',
    color: 'text-emerald-400',
    border: 'border-emerald-400/30',
  },
  {
    step: '04',
    label: 'Target Tables',
    detail: 'traces: MergeTree ordered (ServiceName, K8sNamespace, SpanName, time, TraceId). red_metrics_1m: O(1) dashboard reads.',
    color: 'text-purple-400',
    border: 'border-purple-400/30',
  },
];

const CODEC_TABLE = [
  { column: 'DateTime64 timestamps', codec: 'Delta(8), ZSTD(1)', why: 'Adjacent timestamps differ by small amounts. Delta encodes the diff; ZSTD compresses the deltas. Often 10× better than raw ZSTD.' },
  { column: 'Duration (UInt64, ns)', codec: 'T64, ZSTD(1)', why: 'T64 exploits bounded integer bit structure. Span durations cluster in µs–ms range, making T64 highly effective.' },
  { column: 'Float64 metric values', codec: 'Gorilla, ZSTD(1)', why: 'Gorilla XOR-encodes time-series floats — 3–5× better compression than ZSTD alone for gauge values.' },
  { column: 'Low-cardinality strings', codec: 'LowCardinality(String)', why: 'Dictionary-encodes to integers on disk. ServiceName with 10 values stores as UInt8. Massive compression + faster GROUP BY.' },
  { column: 'HttpStatusCode (UInt16)', codec: 'T64, ZSTD(1)', why: 'HTTP status codes cluster around 200, 404, 500. T64 + minmax skip index enables fast range filters.' },
  { column: 'Map columns (ad-hoc)', codec: 'ZSTD(1)', why: 'The only option for Maps — another reason to extract hot keys into typed columns with specialized codecs.' },
];

const ORDER_BY_RULES = [
  { rule: 'Most common equality filter first', impl: 'ServiceName', why: 'Eliminates entire granules before any other column is evaluated.' },
  { rule: 'Low cardinality before high cardinality', impl: 'K8sNamespace (dozens) → SpanName (hundreds) → time', why: 'More values eliminated per step. Low-cardinality columns compress the index most efficiently.' },
  { rule: 'Timestamp in key, not first', impl: 'toUnixTimestamp(TimestampTime) — position 4', why: 'Epoch int (4 bytes) vs DateTime64 (8 bytes) halves timestamp contribution to index size.' },
  { rule: 'TraceId last, use bloom filter', impl: 'TraceId — position 5', why: 'High-cardinality point lookups served by bloom_filter(0.001), not by ordering key depth.' },
];

// ─── SQL snippets ─────────────────────────────────────────────────────────────

const BEFORE_DDL = `-- DEFAULT auto-created schema (create_schema: true, otelcol-contrib 0.118.0)
CREATE TABLE otel.otel_traces (
    Timestamp          DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    TraceId            String CODEC(ZSTD(1)),       -- String, not FixedString(32)
    SpanId             String CODEC(ZSTD(1)),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),   -- all K8s buried here
    SpanAttributes     Map(LowCardinality(String), String) CODEC(ZSTD(1)),   -- all HTTP/RPC buried here
    Duration           UInt64 CODEC(ZSTD(1)),        -- missing T64 codec
    StatusCode         LowCardinality(String) CODEC(ZSTD(1)),
    -- ... SpanName, SpanKind, ServiceName, ScopeName, Events.*, Links.* ...
    INDEX idx_trace_id          TraceId                     TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_res_attr_key      mapKeys(ResourceAttributes)   TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_res_attr_value    mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_key     mapKeys(SpanAttributes)       TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_value   mapValues(SpanAttributes)     TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_duration          Duration                    TYPE minmax GRANULARITY 1
) ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, SpanName, toDateTime(Timestamp))     -- no K8sNamespace, no TraceId
TTL toDate(Timestamp) + toIntervalDay(3)                    -- 3-day TTL
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;`;

const AFTER_NULL_DDL = `-- STEP 1: Null engine ingest table — same wire format, costs nothing to store
CREATE TABLE otel.traces_raw ( ... same columns as old otel_traces ... )
ENGINE = Null;  -- discards all data but fires every attached Materialized View`;

const AFTER_TARGET_DDL = `-- STEP 2: Optimized target table (MergeTree — stores the real data)
CREATE TABLE otel.traces (
    Timestamp          DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    TimestampDate      Date DEFAULT toDate(Timestamp),
    TimestampTime      DateTime DEFAULT toDateTime(Timestamp),
    TraceId            String CODEC(ZSTD(1)),
    SpanName           LowCardinality(String) CODEC(ZSTD(1)),
    SpanKind           LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName        LowCardinality(String) CODEC(ZSTD(1)),
    Duration           UInt64 CODEC(T64, ZSTD(1)),          -- T64 for bounded integers
    StatusCode         LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),  -- kept for cold ad-hoc
    SpanAttributes     Map(LowCardinality(String), String) CODEC(ZSTD(1)),  -- kept for cold ad-hoc
    -- Extracted Kubernetes resource attributes (13 new top-level columns)
    K8sNamespace       LowCardinality(String) CODEC(ZSTD(1)),
    K8sPodName         LowCardinality(String) CODEC(ZSTD(1)),
    K8sDeploymentName  LowCardinality(String) CODEC(ZSTD(1)),
    K8sNodeName        LowCardinality(String) CODEC(ZSTD(1)),
    HostName           LowCardinality(String) CODEC(ZSTD(1)),
    -- Extracted HTTP / RPC / DB span attributes — proper types
    HttpMethod         LowCardinality(String) CODEC(ZSTD(1)),
    HttpStatusCode     UInt16 CODEC(T64, ZSTD(1)),           -- native UInt16, not String "200"
    HttpRoute          LowCardinality(String) CODEC(ZSTD(1)),
    HttpUrl            String CODEC(ZSTD(1)),
    RpcMethod          LowCardinality(String) CODEC(ZSTD(1)),
    RpcService         LowCardinality(String) CODEC(ZSTD(1)),
    DbSystem           LowCardinality(String) CODEC(ZSTD(1)),
    DbStatement        String CODEC(ZSTD(1)),
    -- 3 targeted indices (vs 5 Map band-aids)
    INDEX idx_trace_id    TraceId        TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_http_status HttpStatusCode TYPE minmax GRANULARITY 1,
    INDEX idx_duration    Duration       TYPE minmax GRANULARITY 1
) ENGINE = MergeTree
PARTITION BY TimestampDate
ORDER BY (ServiceName, K8sNamespace, SpanName, toUnixTimestamp(TimestampTime), TraceId)
TTL TimestampDate + INTERVAL 30 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;`;

const AFTER_MV_DDL = `-- STEP 3: Materialized View — runs at insert time, zero query-time overhead
CREATE MATERIALIZED VIEW otel.traces_mv TO otel.traces AS
SELECT
    Timestamp, TraceId, SpanId, ParentSpanId,
    SpanName, SpanKind, ServiceName,
    Duration, StatusCode, StatusMessage,
    ResourceAttributes, SpanAttributes,        -- full maps kept for ad-hoc
    -- K8s extraction
    ResourceAttributes['k8s.namespace.name']  AS K8sNamespace,
    ResourceAttributes['k8s.pod.name']        AS K8sPodName,
    ResourceAttributes['k8s.deployment.name'] AS K8sDeploymentName,
    ResourceAttributes['k8s.node.name']       AS K8sNodeName,
    ResourceAttributes['host.name']           AS HostName,
    -- HTTP / RPC / DB extraction with type coercion
    SpanAttributes['http.method']             AS HttpMethod,
    if(SpanAttributes['http.status_code'] = '', 0,
       toUInt16OrZero(SpanAttributes['http.status_code'])) AS HttpStatusCode,
    SpanAttributes['http.route']              AS HttpRoute,
    SpanAttributes['http.url']                AS HttpUrl,
    SpanAttributes['rpc.method']              AS RpcMethod,
    SpanAttributes['rpc.service']             AS RpcService,
    SpanAttributes['db.system']               AS DbSystem,
    SpanAttributes['db.statement']            AS DbStatement,
    ScopeName,
    \`Events.Timestamp\`, \`Events.Name\`, \`Events.Attributes\`,
    \`Links.TraceId\`, \`Links.SpanId\`, \`Links.TraceState\`, \`Links.Attributes\`
FROM otel.traces_raw;`;

const RED_METRICS_DDL = `-- Pre-aggregated RED metrics — AggregatingMergeTree for O(1) dashboard reads
CREATE TABLE otel.red_metrics_1m (
    time               DateTime CODEC(Delta, ZSTD(1)),
    ServiceName        LowCardinality(String) CODEC(ZSTD(1)),
    SpanName           LowCardinality(String) CODEC(ZSTD(1)),
    K8sNamespace       LowCardinality(String) CODEC(ZSTD(1)),
    request_count      UInt64 CODEC(ZSTD(1)),
    error_count        UInt64 CODEC(ZSTD(1)),
    duration_sum       UInt64 CODEC(ZSTD(1)),
    duration_min       UInt64 CODEC(ZSTD(1)),
    duration_max       UInt64 CODEC(ZSTD(1)),
    duration_quantiles AggregateFunction(quantiles(0.5, 0.9, 0.95, 0.99), UInt64)
) ENGINE = AggregatingMergeTree
PARTITION BY toDate(time)
ORDER BY (ServiceName, K8sNamespace, SpanName, time)
TTL toDate(time) + INTERVAL 90 DAY;

-- MV also sources from traces_raw (MVs only fire on direct INSERT, not on MV-caused INSERTs)
CREATE MATERIALIZED VIEW otel.red_metrics_1m_mv TO otel.red_metrics_1m AS
SELECT
    toStartOfMinute(toDateTime(Timestamp))           AS time,
    ServiceName, SpanName,
    ResourceAttributes['k8s.namespace.name']         AS K8sNamespace,
    count()                                          AS request_count,
    countIf(StatusCode = 'Error')                    AS error_count,
    sum(Duration) AS duration_sum, min(Duration) AS duration_min, max(Duration) AS duration_max,
    quantilesState(0.5, 0.9, 0.95, 0.99)(Duration)  AS duration_quantiles
FROM otel.traces_raw
WHERE SpanKind IN ('Server', 'SPAN_KIND_SERVER')
GROUP BY time, ServiceName, SpanName, K8sNamespace;`;

// ─── Components ───────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'sql' }: { code: string; lang?: string }) {
  const lines = code.split('\n');
  return (
    <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">{lang}</span>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-xs font-mono leading-[1.7] text-zinc-300 whitespace-pre">
          <code
            dangerouslySetInnerHTML={{
              __html: lines.map((line) =>
                line
                  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/(--.*)$/, '<span class="text-zinc-600 italic">$1</span>')
                  .replace(
                    /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|AS|AND|OR|IN|INTERVAL|CREATE|TABLE|MATERIALIZED|VIEW|TO|ENGINE|PARTITION BY|ORDER BY|TTL|SETTINGS|IF NOT EXISTS|CODEC|DEFAULT|INDEX|TYPE|GRANULARITY|USING|WITH)\b/g,
                    '<span class="text-blue-400 font-semibold">$1</span>',
                  )
                  .replace(
                    /\b(round|count|avg|min|max|sum|countIf|toDate|toDateTime|toUnixTimestamp|now|quantilesMerge|quantilesState|if|toUInt16OrZero|formatReadableSize|greatest)\b/g,
                    '<span class="text-amber-300">$1</span>',
                  )
                  .replace(/'([^']*)'/g, "<span class=\"text-emerald-400\">'$1'</span>")
              ).join('\n'),
            }}
          />
        </pre>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClickHousePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 pb-24">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-stone-200 dark:border-zinc-800 px-4 pt-12 pb-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-2">
            Schema Engineering · OTel ClickHouse
          </p>
          <h1 className="font-display font-black uppercase leading-[0.9] text-6xl sm:text-7xl text-stone-900 dark:text-zinc-100 mb-6">
            ClickHouse
          </h1>
          <p className="max-w-2xl text-base text-stone-600 dark:text-zinc-400 leading-relaxed mb-8">
            The OpenTelemetry Collector ships a default ClickHouse schema built for compatibility,
            not performance. This documents why it falls short in production, how we redesigned it
            using the Null-engine ingest pattern, and the measured performance delta — live, against
            this cluster.
          </p>

          {/* Performance highlight bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Old — Map access', value: '8.3 MB', sub: 'bytes read, http.method GROUP BY', accent: false },
              { label: 'New — Extracted column', value: '132 KB', sub: 'bytes read, same query', accent: true },
              { label: 'Reduction', value: '65×', sub: 'fewer bytes on equivalent query', accent: true },
              { label: 'New top-level columns', value: '13', sub: 'K8s + HTTP + DB + RPC per span', accent: false },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg border px-4 py-3 ${
                s.accent
                  ? 'border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/20'
                  : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900'
              }`}>
                <p className={`text-2xl font-black tabular-nums ${s.accent ? 'text-emerald-500' : 'text-stone-900 dark:text-zinc-100'}`}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-600 mt-1">{s.label}</p>
                <p className="text-[11px] text-stone-500 dark:text-zinc-500 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-12 space-y-20">

        {/* ── Interactive query explorer ───────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Live Demo</p>
            <h2 className="font-display font-black uppercase text-4xl text-stone-900 dark:text-zinc-100 mb-2">
              Query the Live Cluster
            </h2>
            <p className="text-sm text-stone-500 dark:text-zinc-500 max-w-xl">
              Five curated queries run against the actual ClickHouse instance powering this site.
              Start with <span className="text-amber-500 font-semibold">Schema Benchmark</span> — it runs both schemas simultaneously and shows you the byte gap in real time.
            </p>
          </div>
          <QueryExplorer />
        </div>

        {/* ── Pipeline diagram ─────────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Architecture</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">The Ingest Pipeline</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.step} className="relative">
                <div className={`rounded-lg border ${step.border} bg-stone-50 dark:bg-zinc-900 p-4 h-full flex flex-col gap-2`}>
                  <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${step.color}`}>{step.step}</p>
                  <p className={`font-bold text-sm ${step.color}`}>{step.label}</p>
                  <p className="text-xs text-stone-500 dark:text-zinc-500 leading-relaxed flex-1">{step.detail}</p>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="hidden sm:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-stone-300 dark:text-zinc-600 text-xl font-bold">›</div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-stone-400 dark:text-zinc-600">
            ClickHouse MVs trigger on direct INSERT only — not on INSERTs caused by other MVs.
            Both <code className="font-mono">traces_mv</code> and <code className="font-mono">red_metrics_1m_mv</code> source from <code className="font-mono">traces_raw</code> and run in parallel at ingest time.
          </p>
        </div>

        {/* ── Problems with default schema ─────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Analysis</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">What the Default Schema Gets Wrong</h2>
          </div>
          <div className="space-y-10">
            {PROBLEMS.map((p) => (
              <div key={p.number} className="grid gap-6 sm:grid-cols-[96px_1fr]">
                <p className={`font-display font-black text-5xl leading-none ${p.color} opacity-40`}>{p.number}</p>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 mb-3">{p.title}</h3>
                  <div className="space-y-2.5">
                    {p.body.map((para, i) => (
                      <p key={i} className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">{para}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── DDL: Before / After side-by-side ────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Schema DDL</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">Before & After</h2>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Before</span>
              <div className="flex-1 h-px bg-red-800/30" />
            </div>
            <CodeBlock code={BEFORE_DDL} />
            <p className="text-xs text-stone-400 dark:text-zinc-600 italic">
              Measured: <code className="font-mono">SELECT SpanAttributes[&apos;http.method&apos;] … GROUP BY method</code> reads <strong>8.3 MB</strong> across 52K rows in 77ms.
            </p>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">After — Step 1</span>
              <div className="flex-1 h-px bg-emerald-800/30" />
            </div>
            <CodeBlock code={AFTER_NULL_DDL} />
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">After — Step 2</span>
              <div className="flex-1 h-px bg-emerald-800/30" />
            </div>
            <CodeBlock code={AFTER_TARGET_DDL} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">After — Step 3</span>
              <div className="flex-1 h-px bg-emerald-800/30" />
            </div>
            <CodeBlock code={AFTER_MV_DDL} />
            <p className="text-xs text-stone-400 dark:text-zinc-600 italic">
              Measured: <code className="font-mono">SELECT HttpMethod … GROUP BY method</code> reads <strong>132 KB</strong> in 41ms — 65× fewer bytes, same result.
            </p>
          </div>
        </div>

        {/* ── RED metrics ─────────────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Pre-Aggregation</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">RED Metrics — 1-Minute Rollups</h2>
          </div>
          <p className="text-sm text-stone-500 dark:text-zinc-500 mb-4 max-w-xl">
            AggregatingMergeTree maintains per-minute Rate, Error, and Duration summaries as spans arrive.
            Dashboard queries read the rollup — not the raw spans. Use the <span className="text-amber-500 font-semibold">RED Metrics</span> query above to see live data.
          </p>
          <CodeBlock code={RED_METRICS_DDL} />
        </div>

        {/* ── Reference tables ─────────────────────────────────────────────── */}
        <div className="grid gap-12 sm:grid-cols-2">

          {/* Codec guide */}
          <div>
            <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-4">
              <h2 className="font-display font-black uppercase text-xl text-stone-900 dark:text-zinc-100">Codec Selection</h2>
            </div>
            <div className="rounded-lg border border-stone-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900">
                    {['Column', 'Codec', 'Why'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CODEC_TABLE.map((row, i) => (
                    <tr key={i} className="border-b border-stone-100 dark:border-zinc-800/50 last:border-0">
                      <td className="px-3 py-2 font-mono text-stone-700 dark:text-zinc-300 text-[11px]">{row.column}</td>
                      <td className="px-3 py-2 font-mono text-amber-600 dark:text-amber-400 text-[11px] whitespace-nowrap">{row.codec}</td>
                      <td className="px-3 py-2 text-stone-500 dark:text-zinc-500 leading-relaxed">{row.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ORDER BY rules */}
          <div>
            <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-4">
              <h2 className="font-display font-black uppercase text-xl text-stone-900 dark:text-zinc-100">ORDER BY Design</h2>
            </div>
            <div className="space-y-3">
              {ORDER_BY_RULES.map((r, i) => (
                <div key={i} className="rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-stone-400 dark:text-zinc-600">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-xs font-bold text-stone-800 dark:text-zinc-200">{r.rule}</span>
                  </div>
                  <p className="font-mono text-[11px] text-amber-600 dark:text-amber-400 mb-1">{r.impl}</p>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-500">{r.why}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Closing quote ────────────────────────────────────────────────── */}
        <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-10">
          <blockquote className="text-2xl sm:text-3xl font-display font-black uppercase leading-tight text-stone-900 dark:text-zinc-100 max-w-3xl mb-4">
            &ldquo;The Null table costs nothing to store and buys you schema migration flexibility forever.&rdquo;
          </blockquote>
          <p className="text-sm text-stone-400 dark:text-zinc-600 max-w-xl">
            Add a new Materialized View + target table, backfill from the raw table during low traffic,
            then switch query targets. Zero downtime. No re-ingestion from the source.
            The old schema stays alive until TTL expires.
          </p>
        </div>

      </div>
    </div>
  );
}
