import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ClickHouse Schema — O11y Alchemy',
  description: 'Redesigning the default OpenTelemetry ClickHouse schema for production: Null-engine ingest, Materialized Views, extracted columns, proper codecs, and pre-aggregated RED metrics.',
};

// ─── data ────────────────────────────────────────────────────────────────────

const BEFORE_STATS = [
  { value: '5', label: 'Bloom filter indices on Map keys/values', note: 'per table' },
  { value: '0', label: 'Extracted top-level attribute columns', note: 'all attrs in Map' },
  { value: '8.3 MB', label: 'Bytes read — http.method GROUP BY', note: '52K rows scanned' },
  { value: '77 ms', label: 'Map access query time', note: 'on 52K rows' },
];

const AFTER_STATS = [
  { value: '3', label: 'Targeted skip indices (TraceId, minmax)', note: 'meaningful only' },
  { value: '13', label: 'Extracted columns per trace', note: 'K8s + HTTP + DB + RPC' },
  { value: '~50 KB', label: 'Bytes read — HttpMethod GROUP BY', note: 'single column scan' },
  { value: '5', label: 'Total tables in pipeline', note: 'Null + Target + MV + RED' },
];

const PROBLEMS = [
  {
    number: '01',
    title: 'Map(String, String) — the core bottleneck',
    body: [
      'Every attribute — HTTP method, status code, Kubernetes pod name, database statement — lives in a single Map column. When you filter on SpanAttributes[\'http.method\'], ClickHouse loads the entire Map column for every row and scans linearly through each map to find your key. With 40+ attributes per span, you read 40× more data than needed.',
      'Map values are always String. Your http.status_code of 200 is stored as "200". Every comparison requires toUInt16(SpanAttributes[\'http.status_code\']) > 400 at query time — burning CPU, obstructing the query optimizer, and producing verbose SQL that\'s easy to get wrong.',
      'Most critically: Map keys cannot participate in ORDER BY or PRIMARY KEY. ClickHouse\'s primary index — its most powerful query acceleration mechanism — is completely blind to anything inside a Map. No granule skipping. No data skipping. Full table scan every time.',
    ],
  },
  {
    number: '02',
    title: 'Generic ORDER BY ignores your access patterns',
    body: [
      'The default traces schema orders by (ServiceName, SpanName, toDateTime(Timestamp)). This is a reasonable guess, but if you filter by Kubernetes namespace before service name — which is common in multi-tenant clusters — the ordering key is useless for your actual query patterns and ClickHouse scans far more granules than necessary.',
      'The default metrics_gauge table orders by (ServiceName, MetricName, Attributes, toUnixTimestamp64Nano(TimeUnix)). Including a Map column in ORDER BY works lexicographically but adds overhead and prevents any optimization based on attribute values.',
    ],
  },
  {
    number: '03',
    title: 'Unnecessary indices compensating for Map slowness',
    body: [
      'The default schema creates bloom filter indices on mapKeys(SpanAttributes), mapValues(SpanAttributes), mapKeys(ResourceAttributes), and mapValues(ResourceAttributes) — four indices trying to work around the fundamental problem of Map access. These consume disk space, slow every insert, and add maintenance overhead.',
      'ClickHouse\'s own documentation warns: secondary indices should be tested to ensure they actually benefit your query patterns. Bloom filters on Maps are a band-aid. The right fix is to extract hot keys to top-level columns and put those in the ORDER BY.',
    ],
  },
  {
    number: '04',
    title: 'No pre-aggregation for dashboard queries',
    body: [
      'Every dashboard refresh hits the raw trace table. For a query like "requests per minute by service over the last hour" on a busy system, this means scanning millions of raw spans every time a panel reloads. ClickHouse handles this better than most databases, but the ceiling is still the full table scan.',
      'The right pattern for operational dashboards is pre-aggregated Materialized Views — AggregatingMergeTree tables that maintain 1-minute rollups of RED metrics (Rate, Errors, Duration) as data arrives. Dashboard queries read from the aggregated table, not the raw one.',
    ],
  },
];

const PIPELINE_STEPS = [
  {
    step: '01',
    label: 'OTel Collector',
    detail: 'Receives OTLP traces, logs, metrics. create_schema: false. Batches 10K rows @ 5s.',
    color: 'text-amber-500',
  },
  {
    step: '02',
    label: 'Null Table (traces_raw)',
    detail: 'Accepts inserts, discards storage. Triggers all attached Materialized Views on every INSERT batch.',
    color: 'text-blue-400',
  },
  {
    step: '03',
    label: 'Materialized Views',
    detail: 'traces_mv: extracts K8s + HTTP + RPC + DB columns, casts types. red_metrics_1m_mv: aggregates server spans into AggregatingMergeTree.',
    color: 'text-emerald-400',
  },
  {
    step: '04',
    label: 'Target Tables',
    detail: 'traces: MergeTree ordered by (ServiceName, K8sNamespace, SpanName, time). red_metrics_1m: AggregatingMergeTree for O(1) dashboard queries.',
    color: 'text-purple-400',
  },
];

const CODEC_TABLE = [
  { column: 'DateTime64 timestamps', codec: 'Delta(8), ZSTD(1)', why: 'Adjacent timestamps differ by small amounts. Delta encodes the diff; ZSTD compresses the deltas. Often 10× better than raw ZSTD.' },
  { column: 'Duration (UInt64, ns)', codec: 'T64, ZSTD(1)', why: 'T64 exploits bounded integer bit structure. Span durations cluster in a narrow range (µs–ms), making T64 highly effective.' },
  { column: 'Float64 metric values', codec: 'Gorilla, ZSTD(1)', why: 'Gorilla XOR-encodes time-series floats. Designed for metric data — 3–5× better compression than ZSTD alone for gauge values.' },
  { column: 'LowCardinality strings', codec: 'LowCardinality(String)', why: 'Dictionary-encodes to integers on disk. ServiceName with 10 values stores as UInt8. Massive compression + faster GROUP BY.' },
  { column: 'HttpStatusCode (UInt16)', codec: 'T64, ZSTD(1)', why: 'HTTP status codes cluster around 200, 404, 500. T64 encodes the pattern efficiently. Enables minmax skip index.' },
  { column: 'Map columns (kept for ad-hoc)', codec: 'ZSTD(1)', why: 'Only option for Maps. Another reason to extract hot keys — they get none of the specialized codec benefits.' },
];

const ORDERING_RULES = [
  { rule: 'Most common equality filter first', example: 'ServiceName — almost every query includes this', why: 'ClickHouse eliminates granules before even looking at other columns.' },
  { rule: 'Low cardinality before high cardinality', example: 'K8sNamespace (dozens) → SpanName (hundreds) → Timestamp (unique)', why: 'More values eliminated per granule step. Low-cardinality columns at the front compress the index heavily.' },
  { rule: 'Timestamp in the key, not first', example: 'toUnixTimestamp(TimestampTime) — position 4 in our key', why: 'Using epoch int (4 bytes) vs DateTime64 (8 bytes) halves the timestamp contribution to index size.' },
  { rule: 'TraceId last', example: 'TraceId — high cardinality point lookups', why: 'Bloom filter index handles TraceId point lookups better than ordering. Ordering key depth has diminishing returns.' },
  { rule: 'Max 4–5 columns', example: '(ServiceName, K8sNamespace, SpanName, toUnixTimestamp(…), TraceId)', why: 'More columns increase insert overhead and primary key storage size. Stop where returns diminish.' },
];

// ─── components ──────────────────────────────────────────────────────────────

function StatBar({ stats, label }: { stats: { value: string; label: string; note: string }[]; label: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card flex flex-col gap-1">
            <p className="text-2xl font-black tabular-nums text-stone-900 dark:text-zinc-100">{s.value}</p>
            <p className="text-[11px] text-stone-600 dark:text-zinc-400 leading-tight">{s.label}</p>
            <p className="text-[10px] text-stone-400 dark:text-zinc-600 italic">{s.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ code, lang = 'sql' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg bg-stone-950 dark:bg-zinc-900 border border-stone-800 dark:border-zinc-700 overflow-x-auto">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-800 dark:border-zinc-700">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-500 dark:text-zinc-500">{lang}</span>
      </div>
      <pre className="p-4 text-xs font-mono text-stone-200 dark:text-zinc-200 leading-relaxed overflow-x-auto whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── SQL snippets ─────────────────────────────────────────────────────────────

const BEFORE_TRACES_DDL = `-- DEFAULT auto-generated schema (create_schema: true)
CREATE TABLE otel.otel_traces (
    Timestamp          DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    TraceId            String CODEC(ZSTD(1)),       -- should be FixedString(32)
    SpanId             String CODEC(ZSTD(1)),
    ParentSpanId       String CODEC(ZSTD(1)),
    SpanName           LowCardinality(String) CODEC(ZSTD(1)),
    SpanKind           LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName        LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),   -- ← all K8s attrs buried here
    SpanAttributes     Map(LowCardinality(String), String) CODEC(ZSTD(1)),   -- ← all HTTP/RPC attrs buried here
    Duration           UInt64 CODEC(ZSTD(1)),        -- ← missing T64 codec
    StatusCode         LowCardinality(String) CODEC(ZSTD(1)),
    -- ... Events/Links arrays ...
    INDEX idx_trace_id          TraceId             TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_res_attr_key      mapKeys(ResourceAttributes)   TYPE bloom_filter(0.01) GRANULARITY 1,  -- ← Map band-aids
    INDEX idx_res_attr_value    mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_key     mapKeys(SpanAttributes)       TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_value   mapValues(SpanAttributes)     TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_duration          Duration            TYPE minmax GRANULARITY 1
) ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, SpanName, toDateTime(Timestamp))   -- ← no K8s namespace, no TraceId
TTL toDate(Timestamp) + toIntervalDay(3)                   -- ← 3-day TTL (too short)
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;`;

const AFTER_TRACES_RAW_DDL = `-- STEP 1: Null engine ingest table (same shape as old table — exporter writes here)
-- create_schema: false in OTel Collector config
CREATE TABLE otel.traces_raw (
    Timestamp          DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    TraceId            String CODEC(ZSTD(1)),
    SpanId             String CODEC(ZSTD(1)),
    ParentSpanId       String CODEC(ZSTD(1)),
    SpanName           LowCardinality(String) CODEC(ZSTD(1)),
    SpanKind           LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName        LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    SpanAttributes     Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    Duration           UInt64 CODEC(ZSTD(1)),
    StatusCode         LowCardinality(String) CODEC(ZSTD(1)),
    StatusMessage      String CODEC(ZSTD(1)),
    ScopeName          LowCardinality(String) CODEC(ZSTD(1)),
    ScopeVersion       String CODEC(ZSTD(1)),
    \`Events.Timestamp\` Array(DateTime64(9)) CODEC(ZSTD(1)),
    \`Events.Name\`      Array(LowCardinality(String)) CODEC(ZSTD(1)),
    \`Events.Attributes\` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    \`Links.TraceId\`    Array(String) CODEC(ZSTD(1)),
    \`Links.SpanId\`     Array(String) CODEC(ZSTD(1)),
    \`Links.TraceState\` Array(String) CODEC(ZSTD(1)),
    \`Links.Attributes\` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1))
) ENGINE = Null;  -- stores nothing, but fires all attached Materialized Views`;

const AFTER_TRACES_TARGET_DDL = `-- STEP 2: Optimized target table
CREATE TABLE otel.traces (
    Timestamp          DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    TimestampDate      Date DEFAULT toDate(Timestamp),
    TimestampTime      DateTime DEFAULT toDateTime(Timestamp),
    TraceId            String CODEC(ZSTD(1)),
    SpanId             String CODEC(ZSTD(1)),
    ParentSpanId       String CODEC(ZSTD(1)),
    SpanName           LowCardinality(String) CODEC(ZSTD(1)),
    SpanKind           LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName        LowCardinality(String) CODEC(ZSTD(1)),
    Duration           UInt64 CODEC(T64, ZSTD(1)),          -- ← T64 for bounded integers
    StatusCode         LowCardinality(String) CODEC(ZSTD(1)),
    StatusMessage      String CODEC(ZSTD(1)),
    -- Maps kept for ad-hoc exploration of cold attributes
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    SpanAttributes     Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    -- Extracted Kubernetes resource attributes (top-level columns)
    K8sNamespace       LowCardinality(String) CODEC(ZSTD(1)),
    K8sPodName         LowCardinality(String) CODEC(ZSTD(1)),
    K8sDeploymentName  LowCardinality(String) CODEC(ZSTD(1)),
    K8sNodeName        LowCardinality(String) CODEC(ZSTD(1)),
    HostName           LowCardinality(String) CODEC(ZSTD(1)),
    -- Extracted HTTP / RPC / DB span attributes with correct types
    HttpMethod         LowCardinality(String) CODEC(ZSTD(1)),
    HttpStatusCode     UInt16 CODEC(T64, ZSTD(1)),           -- ← proper numeric type
    HttpRoute          LowCardinality(String) CODEC(ZSTD(1)),
    HttpUrl            String CODEC(ZSTD(1)),
    RpcMethod          LowCardinality(String) CODEC(ZSTD(1)),
    RpcService         LowCardinality(String) CODEC(ZSTD(1)),
    DbSystem           LowCardinality(String) CODEC(ZSTD(1)),
    DbStatement        String CODEC(ZSTD(1)),
    ScopeName          LowCardinality(String) CODEC(ZSTD(1)),
    \`Events.Timestamp\` Array(DateTime64(9)) CODEC(ZSTD(1)),
    \`Events.Name\`      Array(LowCardinality(String)) CODEC(ZSTD(1)),
    \`Events.Attributes\` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    \`Links.TraceId\`    Array(String) CODEC(ZSTD(1)),
    \`Links.SpanId\`     Array(String) CODEC(ZSTD(1)),
    \`Links.TraceState\` Array(String) CODEC(ZSTD(1)),
    \`Links.Attributes\` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    -- Only 3 targeted indices (vs 5 Map band-aids before)
    INDEX idx_trace_id    TraceId        TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_http_status HttpStatusCode TYPE minmax GRANULARITY 1,
    INDEX idx_duration    Duration       TYPE minmax GRANULARITY 1
) ENGINE = MergeTree
PARTITION BY TimestampDate
ORDER BY (ServiceName, K8sNamespace, SpanName, toUnixTimestamp(TimestampTime), TraceId)
TTL TimestampDate + INTERVAL 30 DAY               -- ← 30-day TTL
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;`;

const AFTER_TRACES_MV_DDL = `-- STEP 3: Materialized View — transforms & routes data at insert time
CREATE MATERIALIZED VIEW otel.traces_mv TO otel.traces AS
SELECT
    Timestamp,
    TraceId, SpanId, ParentSpanId,
    SpanName, SpanKind, ServiceName,
    Duration, StatusCode, StatusMessage,
    -- Keep full maps for ad-hoc exploration
    ResourceAttributes, SpanAttributes,
    -- Extract Kubernetes resource attributes
    ResourceAttributes['k8s.namespace.name']  AS K8sNamespace,
    ResourceAttributes['k8s.pod.name']        AS K8sPodName,
    ResourceAttributes['k8s.deployment.name'] AS K8sDeploymentName,
    ResourceAttributes['k8s.node.name']       AS K8sNodeName,
    ResourceAttributes['host.name']           AS HostName,
    -- Extract HTTP / RPC / DB span attributes with type coercion
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

const RED_METRICS_DDL = `-- Pre-aggregated RED metrics (Rate, Errors, Duration) — 1-minute rollups
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
    duration_quantiles AggregateFunction(quantiles(0.5, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
) ENGINE = AggregatingMergeTree
PARTITION BY toDate(time)
ORDER BY (ServiceName, K8sNamespace, SpanName, time)
TTL toDate(time) + INTERVAL 90 DAY;

-- MV sourced from traces_raw (MVs trigger on direct INSERT, not on MV-caused INSERTs)
CREATE MATERIALIZED VIEW otel.red_metrics_1m_mv TO otel.red_metrics_1m AS
SELECT
    toStartOfMinute(toDateTime(Timestamp))           AS time,
    ServiceName, SpanName,
    ResourceAttributes['k8s.namespace.name']         AS K8sNamespace,
    count()                                          AS request_count,
    countIf(StatusCode = 'Error')                    AS error_count,
    sum(Duration)                                    AS duration_sum,
    min(Duration)                                    AS duration_min,
    max(Duration)                                    AS duration_max,
    quantilesState(0.5, 0.9, 0.95, 0.99)(Duration)  AS duration_quantiles
FROM otel.traces_raw
WHERE SpanKind IN ('Server', 'SPAN_KIND_SERVER')
GROUP BY time, ServiceName, SpanName, K8sNamespace;

-- Dashboard query reads from pre-aggregated table — no raw scan
SELECT
    time,
    request_count,
    error_count,
    round(100.0 * error_count / request_count, 2) AS error_rate_pct,
    quantilesMerge(0.5, 0.9, 0.95, 0.99)(duration_quantiles)[1] / 1e6 AS p50_ms,
    quantilesMerge(0.5, 0.9, 0.95, 0.99)(duration_quantiles)[4] / 1e6 AS p99_ms
FROM otel.red_metrics_1m
WHERE ServiceName = 'o11y-news'
  AND time >= now() - INTERVAL 1 HOUR
GROUP BY time, request_count, error_count
ORDER BY time;`;

const OTELCOL_CONFIG = `# OTel Collector config — key changes
exporters:
  clickhouse:
    endpoint: tcp://clickhouse:9000
    database: otel
    create_schema: false            # ← you manage DDL
    traces_table_name: traces_raw   # ← Null engine ingest table
    logs_table_name: logs_raw       # ← Null engine ingest table
    metrics_gauge_table_name: metrics_gauge_raw
    compress: lz4
    timeout: 10s
    sending_queue:
      num_consumers: 4              # ← 2x more consumers
      queue_size: 500               # ← 5x larger buffer
    batch:
      timeout: 5s
      send_batch_size: 10000        # ← bulk inserts for ClickHouse performance`;

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ClickHousePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 pb-24">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="border-b border-stone-200 dark:border-zinc-800 px-4 pt-12 pb-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-2">
            Schema Engineering
          </p>
          <h1 className="font-display font-black uppercase leading-[0.9] text-6xl sm:text-7xl text-stone-900 dark:text-zinc-100 mb-6">
            ClickHouse
          </h1>
          <p className="max-w-2xl text-base text-stone-600 dark:text-zinc-400 leading-relaxed">
            The OpenTelemetry Collector ships with a default ClickHouse schema designed as a
            starting point, not a destination. This documents why it falls short in production,
            how we redesigned it using the Null-engine ingest pattern, and the measured performance
            delta before and after.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-12 space-y-20">

        {/* ── Before / After stats ─────────────────────────────────────────── */}
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-4">
            <div className="border-l-2 border-red-400/60 pl-4">
              <StatBar stats={BEFORE_STATS} label="Before — default auto-created schema" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="border-l-2 border-emerald-400/60 pl-4">
              <StatBar stats={AFTER_STATS} label="After — Null + MV + extracted columns" />
            </div>
          </div>
        </div>

        {/* ── Pipeline diagram ─────────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Architecture</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              The Ingest Pipeline
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.step} className="relative">
                <div className="card h-full flex flex-col gap-2">
                  <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${step.color}`}>{step.step}</p>
                  <p className="font-bold text-sm text-stone-900 dark:text-zinc-100">{step.label}</p>
                  <p className="text-xs text-stone-500 dark:text-zinc-500 leading-relaxed flex-1">{step.detail}</p>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-4 h-4 items-center justify-center">
                    <span className="text-stone-300 dark:text-zinc-600 text-lg">›</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-stone-400 dark:text-zinc-600">
            Key insight: ClickHouse Materialized Views trigger on direct INSERT into the Null table, not on INSERTs caused by other MVs.
            Both <code className="font-mono">traces_mv</code> and <code className="font-mono">red_metrics_1m_mv</code> source from <code className="font-mono">traces_raw</code>.
          </p>
        </div>

        {/* ── Problems with the default schema ─────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Analysis</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              What the Default Schema Gets Wrong
            </h2>
          </div>
          <div className="space-y-12">
            {PROBLEMS.map((p) => (
              <div key={p.number} className="grid gap-6 sm:grid-cols-[120px_1fr]">
                <div className="shrink-0">
                  <p className="font-display font-black text-5xl text-stone-200 dark:text-zinc-800 leading-none">{p.number}</p>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900 dark:text-zinc-100 mb-4">{p.title}</h3>
                  <div className="space-y-3">
                    {p.body.map((para, i) => (
                      <p key={i} className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">{para}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Before DDL ──────────────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/80 mb-1">Before</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              Default Auto-Created Schema
            </h2>
          </div>
          <p className="text-sm text-stone-500 dark:text-zinc-500 mb-4">
            The schema ClickHouse receives when <code className="font-mono text-xs">create_schema: true</code>.
            Annotations in comments show the specific problems.
          </p>
          <CodeBlock code={BEFORE_TRACES_DDL} />
          <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">Measured on this cluster (52K spans)</p>
            <p className="text-sm text-red-600 dark:text-red-300">
              <span className="font-mono">SELECT SpanAttributes[&apos;http.method&apos;] … GROUP BY method</span>:
              reads <strong>8.3 MB</strong> across 52,553 rows in <strong>77 ms</strong> — loads the entire SpanAttributes Map column for every row.
            </p>
          </div>
        </div>

        {/* ── After DDL — three parts ─────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80 mb-1">After</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              Redesigned Schema
            </h2>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-3">Step 1 — Null ingest table</p>
              <CodeBlock code={AFTER_TRACES_RAW_DDL} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-3">Step 2 — Optimized target table</p>
              <CodeBlock code={AFTER_TRACES_TARGET_DDL} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-3">Step 3 — Materialized view (transforms at insert time)</p>
              <CodeBlock code={AFTER_TRACES_MV_DDL} />
            </div>
          </div>
        </div>

        {/* ── RED metrics ─────────────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Pre-Aggregation</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              RED Metrics — 1-Minute Rollups
            </h2>
          </div>
          <p className="text-sm text-stone-500 dark:text-zinc-500 mb-6">
            An <code className="font-mono text-xs">AggregatingMergeTree</code> table maintains per-minute Rate, Error,
            and Duration summaries as spans arrive. Dashboard queries read from this pre-aggregated table —
            not the raw trace table — making panel refresh O(minutes) instead of O(all spans).
          </p>
          <CodeBlock code={RED_METRICS_DDL} />
        </div>

        {/* ── OTel Collector config ────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Collector Config</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              OTel Collector Changes
            </h2>
          </div>
          <CodeBlock code={OTELCOL_CONFIG} lang="yaml" />
        </div>

        {/* ── Codec table ─────────────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Reference</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              Codec Selection Guide
            </h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900">
                  {['Column Pattern', 'Codec', 'Why'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CODEC_TABLE.map((row, i) => (
                  <tr key={i} className="border-b border-stone-100 dark:border-zinc-800/50 last:border-0 hover:bg-stone-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 font-mono text-stone-700 dark:text-zinc-300 whitespace-nowrap">{row.column}</td>
                    <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">{row.codec}</td>
                    <td className="px-4 py-3 text-stone-500 dark:text-zinc-500 leading-relaxed">{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ORDER BY rules ──────────────────────────────────────────────── */}
        <div>
          <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Reference</p>
            <h2 className="font-display font-black uppercase text-3xl text-stone-900 dark:text-zinc-100">
              ORDER BY Design Rules
            </h2>
          </div>
          <div className="space-y-4">
            {ORDERING_RULES.map((rule, i) => (
              <div key={i} className="card grid gap-2 sm:grid-cols-[40px_1fr_1fr_1fr]">
                <p className="font-mono text-xs text-stone-400 dark:text-zinc-600 pt-0.5">{String(i + 1).padStart(2, '0')}</p>
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-zinc-100">{rule.rule}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-600 mb-0.5">Our implementation</p>
                  <p className="font-mono text-xs text-amber-600 dark:text-amber-400">{rule.example}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-600 mb-0.5">Why</p>
                  <p className="text-xs text-stone-500 dark:text-zinc-500">{rule.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Closing pull quote ──────────────────────────────────────────── */}
        <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-10">
          <blockquote className="text-2xl sm:text-3xl font-display font-black uppercase leading-tight text-stone-900 dark:text-zinc-100 max-w-3xl">
            &ldquo;The Null table costs nothing to store and buys you schema migration flexibility forever.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-stone-400 dark:text-zinc-600">
            Add a new Materialized View targeting a new table with a different schema, backfill from the raw table during low traffic, then switch the query layer. Zero downtime. No reingestion from the source.
          </p>
        </div>

      </div>
    </div>
  );
}
