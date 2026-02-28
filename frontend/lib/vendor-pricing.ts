// Vendor pricing constants — all from official pricing pages, annual commitment rates
// Last updated: Feb 2025

export interface VendorConfig {
  vendor: string;
  shortName: string;
  color: string; // hex brand color for inline styling
  pricingUrl: string;
  metrics: {
    model: 'per-series' | 'per-datapoint' | 'per-gb';
    ratePerUnit: number; // $ per unitSize
    unitSize: number;    // datapoints per unit
    freeDatapoints: number;
    sourceNote: string;
  };
  logs: {
    ratePerUnit: number; // $ per unitSize
    unitSize: number;    // log records per unit
    freeRecords: number;
    sourceNote: string;
  };
  traces: {
    ratePerUnit: number; // $ per unitSize
    unitSize: number;    // spans per unit
    freeSpans: number;
    sourceNote: string;
  };
  fixed: Array<{ label: string; perMonth: number; note: string }>;
  warnings: string[];   // OTel-specific gotchas
  strengths: string[];  // Notable positives
}

// ─── Normalization assumptions ────────────────────────────────────────────────

export const ASSUMPTIONS = {
  avgSpanBytes: 800,
  avgLogBytes: 500,
  avgMetricBytes: 100,
  /** Unique metric series per datapoint — 10% cardinality ratio (100 series per 1K DPs) */
  metricCardinalityRatio: 0.10,
  assumedHosts: 1,
  assumedSeats: 1,
  elasticEnrichmentMultiplier: 3,
} as const;

// Helper: datapoints → GB
export function dpToGB(dp: number): number {
  return (dp * ASSUMPTIONS.avgMetricBytes) / 1e9;
}
export function spansToGB(spans: number): number {
  return (spans * ASSUMPTIONS.avgSpanBytes) / 1e9;
}
export function logsToGB(logs: number): number {
  return (logs * ASSUMPTIONS.avgLogBytes) / 1e9;
}
export function dpToSeries(dp: number): number {
  return dp * ASSUMPTIONS.metricCardinalityRatio;
}

// ─── Vendor definitions ───────────────────────────────────────────────────────

export const VENDORS: VendorConfig[] = [
  {
    vendor: 'Datadog',
    shortName: 'Datadog',
    color: '#632CA6',
    pricingUrl: 'https://www.datadoghq.com/pricing/',
    metrics: {
      model: 'per-series',
      // $5 per 100 custom metrics/mo = $0.05 per series/mo
      // ALL OTel metrics are classified as custom metrics
      ratePerUnit: 5.00,
      unitSize: 100,  // per 100 series
      freeDatapoints: 0,
      sourceNote: '$5 per 100 custom metric series/mo (OTel = custom)',
    },
    logs: {
      // $0.10/GB ingestion + $1.70/M events indexed (15d retention)
      // Combined into a per-record rate: $0.10/GB + $1.70/M ≈ dominant term is indexing
      ratePerUnit: 1.70,
      unitSize: 1_000_000,
      freeRecords: 0,
      sourceNote: '$1.70 per million events indexed (15d) + $0.10/GB ingestion',
    },
    traces: {
      // APM host-based: $31/host includes 150GB + 1M indexed spans
      // Additional indexed spans: $1.70/M
      ratePerUnit: 1.70,
      unitSize: 1_000_000,
      freeSpans: 1_000_000, // included per host
      sourceNote: '$31/host/mo APM (includes 1M spans) + $1.70/M additional',
    },
    fixed: [
      { label: 'Infra Pro (1 host)', perMonth: 15, note: '$15/host/mo' },
      { label: 'APM (1 host)', perMonth: 31, note: '$31/host/mo, includes 150GB + 1M indexed spans' },
    ],
    warnings: [
      'All OpenTelemetry metrics classified as custom metrics — no native OTel metric discounts',
      'High-cardinality metrics (many label combinations) multiply costs rapidly',
      'APM host fee is mandatory — no span-only pricing without host agent',
    ],
    strengths: [
      'Largest feature set of any observability vendor',
      'Extensive OTel compatibility despite custom metric classification',
      'Best-in-class dashboards and ML anomaly detection',
    ],
  },
  {
    vendor: 'Dynatrace',
    shortName: 'Dynatrace',
    color: '#1496FF',
    pricingUrl: 'https://www.dynatrace.com/pricing/',
    metrics: {
      model: 'per-datapoint',
      // $0.15 per 100,000 data points = $1.50/M
      ratePerUnit: 0.15,
      unitSize: 100_000,
      freeDatapoints: 0,
      sourceNote: '$0.15 per 100K data points (Davis Data Units), 462-day retention included',
    },
    logs: {
      // $0.20/GiB ingestion. Use 500 bytes/record avg.
      // Per record: 500 bytes × $0.20/GB ≈ $0.0000001 per record
      // Stored as rate per 1M records: 1M × 500 bytes = 500 MB × $0.20 = $0.10/M records
      ratePerUnit: 0.10,
      unitSize: 1_000_000,
      freeRecords: 0,
      sourceNote: '$0.20/GiB ingested (DPS usage-based storage), enriched from raw',
    },
    traces: {
      // $0.20/GiB ingestion. 800 bytes/span avg.
      // 1M spans × 800 bytes = 800 MB × $0.20 = $0.16/M spans
      ratePerUnit: 0.16,
      unitSize: 1_000_000,
      freeSpans: 0,
      sourceNote: '$0.20/GiB ingested, 10-day retention included',
    },
    fixed: [],
    warnings: [
      'Log and trace pricing uses enriched GiB (2–4× raw wire size)',
      'Full pricing requires annual DPS (Digital Performance Score) commitment',
      'No OneAgent costs assumed — comparing OTLP ingest only',
    ],
    strengths: [
      '462-day metric retention included (vs 15 days at Datadog, 13 months at Dash0)',
      'Davis AI for automatic anomaly detection',
      'Strong Kubernetes observability out of the box',
    ],
  },
  {
    vendor: 'Elastic',
    shortName: 'Elastic',
    color: '#FEC514',
    pricingUrl: 'https://www.elastic.co/pricing/',
    metrics: {
      model: 'per-gb',
      // $0.60/GB at low volume (realistic for small deployments)
      // Elastic meters enriched/normalized uncompressed data (2–10× wire)
      // Combined all-signals rate (Serverless Observability)
      ratePerUnit: 0.60,
      unitSize: 1,  // per GB
      freeDatapoints: 0,
      sourceNote: '$0.09–$0.60/GB (Serverless Observability, volume-tiered). Applied to enriched data (3× wire).',
    },
    logs: {
      ratePerUnit: 0.60,
      unitSize: 1,
      freeRecords: 0,
      sourceNote: 'Same GB-based rate for logs',
    },
    traces: {
      ratePerUnit: 0.60,
      unitSize: 1,
      freeSpans: 0,
      sourceNote: 'Same GB-based rate for traces/APM',
    },
    fixed: [],
    warnings: [
      'Metered on enriched/normalized size — typically 2–10× raw wire size',
      'Small deployments pay ~$0.60/GB; volume discounts apply above ~50GB/day',
      'Exact tier breakpoints require Elastic pricing calculator',
    ],
    strengths: [
      'Unified pricing across all signal types (no per-signal complexity)',
      'Excellent log search and full-text capabilities',
      'Strong Kibana dashboarding and ML-powered anomaly detection',
    ],
  },
  {
    vendor: 'New Relic',
    shortName: 'New Relic',
    color: '#008C99',
    pricingUrl: 'https://newrelic.com/pricing',
    metrics: {
      model: 'per-gb',
      // $0.40/GB all signals, 100GB/mo free
      ratePerUnit: 0.40,
      unitSize: 1,
      freeDatapoints: 100e9 / ASSUMPTIONS.avgMetricBytes,  // 100GB free in datapoints
      sourceNote: '$0.40/GB (Original Data plan), 100GB/mo free across all signals',
    },
    logs: {
      ratePerUnit: 0.40,
      unitSize: 1,
      freeRecords: Math.floor(100e9 / ASSUMPTIONS.avgLogBytes),
      sourceNote: '$0.40/GB, shared 100GB free tier',
    },
    traces: {
      ratePerUnit: 0.40,
      unitSize: 1,
      freeSpans: Math.floor(100e9 / ASSUMPTIONS.avgSpanBytes),
      sourceNote: '$0.40/GB, shared 100GB free tier',
    },
    fixed: [
      { label: 'Full Platform user (1 seat)', perMonth: 349, note: '$349/mo annual — required for full platform access' },
    ],
    warnings: [
      '100GB/mo free allowance shared across all signals — can offset small deployments entirely',
      '$349/mo seat fee for Full Platform users (engineers who need dashboards/alerts)',
      'Core user ($49/mo) has reduced access to dashboards and features',
    ],
    strengths: [
      '100GB/mo free — best free tier by volume of any major vendor',
      'Simplest pricing model: one rate for all signals',
      '$0 Basic user tier allows unlimited read-only viewers',
    ],
  },
  {
    vendor: 'Splunk',
    shortName: 'Splunk',
    color: '#65A637',
    pricingUrl: 'https://www.splunk.com/en_us/products/pricing.html',
    metrics: {
      model: 'per-gb',
      // Splunk Infrastructure Monitoring: $15/host, includes 100 MTS/host
      // For comparison, treating as if metrics are included in host fee
      // Per-MTS overage unclear publicly — using conservative estimate
      ratePerUnit: 0.08,  // ~$80/M data points (conservative estimate)
      unitSize: 1_000_000,
      freeDatapoints: 0,
      sourceNote: '$15/host/mo Infra bundle includes 100 MTS. Overage not publicly priced.',
    },
    logs: {
      // Splunk Cloud log pricing not publicly available at per-GB level
      // Using third-party estimate of ~$1,800/GB/day annualized at low volumes
      ratePerUnit: 5.00,
      unitSize: 1_000_000,
      freeRecords: 0,
      sourceNote: 'Log pricing not published. Estimated based on $1,800/GB/day (third-party analysis). Contact Splunk for actual pricing.',
    },
    traces: {
      // APM: $55/host/mo standalone
      // Per-span: estimated from $55/host including ~5M spans/host/mo
      ratePerUnit: 0.011,  // ~$11/M spans
      unitSize: 1_000_000,
      freeSpans: 0,
      sourceNote: '$55/host/mo APM standalone. Per-span estimate based on typical host volume.',
    },
    fixed: [
      { label: 'Infra Monitoring (1 host)', perMonth: 15, note: '$15/host/mo' },
      { label: 'APM (1 host)', perMonth: 55, note: '$55/host/mo' },
    ],
    warnings: [
      'Log pricing not publicly disclosed — shown as estimate only',
      'Host-based pricing means you pay for capacity, not consumption',
      'Log costs at low volumes can be significantly higher than usage-based alternatives',
    ],
    strengths: [
      'Mature platform with extensive enterprise integrations',
      'Powerful SPL query language for complex log analysis',
      'Strong compliance and security use cases (SIEM integration)',
    ],
  },
  {
    vendor: 'Grafana Cloud',
    shortName: 'Grafana',
    color: '#F46800',
    pricingUrl: 'https://grafana.com/pricing/',
    metrics: {
      model: 'per-series',
      // $8 per 1,000 active series, 10K free
      ratePerUnit: 8.00,
      unitSize: 1_000,
      freeDatapoints: 10_000 / ASSUMPTIONS.metricCardinalityRatio, // 10K series free
      sourceNote: '$8 per 1,000 active series (standard 1 DPM), 10K series free',
    },
    logs: {
      // $0.50/GB, 50GB free
      ratePerUnit: 0.50,
      unitSize: 1,
      freeRecords: Math.floor(50e9 / ASSUMPTIONS.avgLogBytes),
      sourceNote: '$0.50/GB (30-day retention), 50GB/mo free',
    },
    traces: {
      // $0.50/GB, 50GB free
      ratePerUnit: 0.50,
      unitSize: 1,
      freeSpans: Math.floor(50e9 / ASSUMPTIONS.avgSpanBytes),
      sourceNote: '$0.50/GB (30-day retention), 50GB/mo free',
    },
    fixed: [
      { label: 'Pro plan', perMonth: 19, note: '$19/mo base (Pro tier required for most features)' },
    ],
    warnings: [
      'Free tier caps: 10K metric series, 50GB logs, 50GB traces — generous for small deployments',
      '$8/seat for users beyond 3 included in Pro plan',
      'Billing on 95th-percentile active series — spikes in cardinality can surprise',
    ],
    strengths: [
      'Generous free tier — small sites may pay $0 beyond the $19/mo base',
      'Best open-source ecosystem integration (Prometheus, Loki, Tempo, Pyroscope)',
      'Most transparent pricing with live cost calculator',
    ],
  },
  {
    vendor: 'Dash0',
    shortName: 'Dash0',
    color: '#00DC82',
    pricingUrl: 'https://www.dash0.com/pricing',
    metrics: {
      model: 'per-datapoint',
      // $0.20 per million data points, 13-month retention
      ratePerUnit: 0.20,
      unitSize: 1_000_000,
      freeDatapoints: 0,
      sourceNote: '$0.20 per million data points, 13-month retention included',
    },
    logs: {
      // $0.60 per million log records, 30-day retention
      ratePerUnit: 0.60,
      unitSize: 1_000_000,
      freeRecords: 0,
      sourceNote: '$0.60 per million log records, 30-day retention',
    },
    traces: {
      // $0.60 per million spans, 30-day retention
      ratePerUnit: 0.60,
      unitSize: 1_000_000,
      freeSpans: 0,
      sourceNote: '$0.60 per million spans, 30-day retention',
    },
    fixed: [],
    warnings: [],
    strengths: [
      'No per-host, per-seat, platform, or query fees — signal count only',
      'Platform fee eliminated Feb 7, 2025',
      'Native OTLP ingest — no agent required, no proprietary SDK',
      '13-month metric retention at base price (vs 15 days at Datadog)',
    ],
  },
];
