import {
  VENDORS,
  ASSUMPTIONS,
  dpToSeries,
  spansToGB,
  logsToGB,
  dpToGB,
  type VendorConfig,
} from './vendor-pricing';

export interface SignalCounts {
  metricDataPoints: number;
  logRecords: number;
  spans: number;
}

export interface SignalCostLine {
  cost: number;
  formula: string;
  unit: string;
}

export interface FixedCostLine {
  label: string;
  cost: number;
  note: string;
}

export interface VendorCostBreakdown {
  vendor: string;
  shortName: string;
  color: string;
  pricingUrl: string;
  metrics: SignalCostLine;
  logs: SignalCostLine;
  traces: SignalCostLine;
  fixed: FixedCostLine[];
  subtotal: number; // signal costs only
  total: number;    // signal + fixed
  warnings: string[];
  strengths: string[];
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function calcDatadog(counts: SignalCounts, v: VendorConfig): VendorCostBreakdown {
  const series = dpToSeries(counts.metricDataPoints);
  const metricCost = (series / v.metrics.unitSize) * v.metrics.ratePerUnit;

  const logGB = logsToGB(counts.logRecords);
  const logIngestion = logGB * 0.10;
  const logIndexing = (counts.logRecords / v.logs.unitSize) * v.logs.ratePerUnit;
  const logCost = logIngestion + logIndexing;

  const traceGB = spansToGB(counts.spans);
  const traceIngestion = Math.max(0, traceGB - 150 * ASSUMPTIONS.assumedHosts) * 0.10;
  const freeSpans = v.traces.freeSpans * ASSUMPTIONS.assumedHosts;
  const additionalSpans = Math.max(0, counts.spans - freeSpans);
  const traceIndexing = (additionalSpans / v.traces.unitSize) * v.traces.ratePerUnit;
  const traceCost = traceIngestion + traceIndexing;

  const fixed = v.fixed.map(f => ({ label: f.label, cost: f.perMonth, note: f.note }));
  const fixedTotal = fixed.reduce((s, f) => s + f.cost, 0);

  return {
    vendor: v.vendor, shortName: v.shortName, color: v.color, pricingUrl: v.pricingUrl,
    metrics: {
      cost: metricCost,
      formula: `${fmt(series, 0)} series × $0.05/series = $${fmt(metricCost)}`,
      unit: 'custom metric series',
    },
    logs: {
      cost: logCost,
      formula: `$${fmt(logIngestion)} ingestion (${fmt(logGB, 4)} GB × $0.10) + $${fmt(logIndexing)} indexing (${fmt(counts.logRecords / 1e6, 2)}M × $1.70)`,
      unit: 'GB ingested + M events indexed',
    },
    traces: {
      cost: traceCost,
      formula: `+$${fmt(traceIngestion)} overage ingestion + $${fmt(traceIndexing)} additional indexed spans`,
      unit: 'spans beyond 1M included/host',
    },
    fixed,
    subtotal: metricCost + logCost + traceCost,
    total: metricCost + logCost + traceCost + fixedTotal,
    warnings: v.warnings, strengths: v.strengths,
  };
}

function calcDynatrace(counts: SignalCounts, v: VendorConfig): VendorCostBreakdown {
  const metricCost = (counts.metricDataPoints / v.metrics.unitSize) * v.metrics.ratePerUnit;

  const logGB = logsToGB(counts.logRecords) * 2; // enrichment 2x
  const logCost = logGB * 0.20;

  const traceGB = spansToGB(counts.spans) * 1.5; // light enrichment
  const traceCost = traceGB * 0.20;

  return {
    vendor: v.vendor, shortName: v.shortName, color: v.color, pricingUrl: v.pricingUrl,
    metrics: {
      cost: metricCost,
      formula: `${fmt(counts.metricDataPoints / 1e6, 2)}M DPs × $1.50/M = $${fmt(metricCost)}`,
      unit: 'data points (DDUs)',
    },
    logs: {
      cost: logCost,
      formula: `${fmt(logGB, 4)} GiB enriched × $0.20/GiB = $${fmt(logCost)}`,
      unit: 'GiB ingested (2× raw)',
    },
    traces: {
      cost: traceCost,
      formula: `${fmt(traceGB, 4)} GiB enriched × $0.20/GiB = $${fmt(traceCost)}`,
      unit: 'GiB ingested (1.5× raw)',
    },
    fixed: [],
    subtotal: metricCost + logCost + traceCost,
    total: metricCost + logCost + traceCost,
    warnings: v.warnings, strengths: v.strengths,
  };
}

function calcElastic(counts: SignalCounts, v: VendorConfig): VendorCostBreakdown {
  const rate = v.metrics.ratePerUnit; // $0.60/GB at low volume
  const enrich = ASSUMPTIONS.elasticEnrichmentMultiplier;

  const metricGB = dpToGB(counts.metricDataPoints) * enrich;
  const logGB = logsToGB(counts.logRecords) * enrich;
  const traceGB = spansToGB(counts.spans) * enrich;

  const metricCost = metricGB * rate;
  const logCost = logGB * rate;
  const traceCost = traceGB * rate;

  return {
    vendor: v.vendor, shortName: v.shortName, color: v.color, pricingUrl: v.pricingUrl,
    metrics: {
      cost: metricCost,
      formula: `${fmt(metricGB, 4)} GB enriched (${enrich}× raw) × $${rate}/GB = $${fmt(metricCost)}`,
      unit: 'GB (enriched, normalized)',
    },
    logs: {
      cost: logCost,
      formula: `${fmt(logGB, 4)} GB enriched × $${rate}/GB = $${fmt(logCost)}`,
      unit: 'GB',
    },
    traces: {
      cost: traceCost,
      formula: `${fmt(traceGB, 4)} GB enriched × $${rate}/GB = $${fmt(traceCost)}`,
      unit: 'GB',
    },
    fixed: [],
    subtotal: metricCost + logCost + traceCost,
    total: metricCost + logCost + traceCost,
    warnings: v.warnings, strengths: v.strengths,
  };
}

function calcNewRelic(counts: SignalCounts, v: VendorConfig): VendorCostBreakdown {
  const rate = 0.40; // $/GB
  const freeGB = 100;

  const metricGB = dpToGB(counts.metricDataPoints);
  const logGB = logsToGB(counts.logRecords);
  const traceGB = spansToGB(counts.spans);
  const totalGB = metricGB + logGB + traceGB;

  // Pro-rate free allowance across signal types
  const ratio = totalGB > 0 ? 1 - Math.min(1, freeGB / totalGB) : 0;
  const metricCost = Math.max(0, metricGB * ratio * rate);
  const logCost = Math.max(0, logGB * ratio * rate);
  const traceCost = Math.max(0, traceGB * ratio * rate);

  const fixed = v.fixed.map(f => ({ label: f.label, cost: f.perMonth, note: f.note }));
  const fixedTotal = fixed.reduce((s, f) => s + f.cost, 0);

  return {
    vendor: v.vendor, shortName: v.shortName, color: v.color, pricingUrl: v.pricingUrl,
    metrics: {
      cost: metricCost,
      formula: `${fmt(metricGB, 4)} GB × $0.40 (after ${fmt(freeGB, 0)} GB/mo free) = $${fmt(metricCost)}`,
      unit: 'GB (all signals combined)',
    },
    logs: {
      cost: logCost,
      formula: `${fmt(logGB, 4)} GB × $0.40 = $${fmt(logCost)}`,
      unit: 'GB',
    },
    traces: {
      cost: traceCost,
      formula: `${fmt(traceGB, 4)} GB × $0.40 = $${fmt(traceCost)}`,
      unit: 'GB',
    },
    fixed,
    subtotal: metricCost + logCost + traceCost,
    total: metricCost + logCost + traceCost + fixedTotal,
    warnings: v.warnings, strengths: v.strengths,
  };
}

function calcSplunk(counts: SignalCounts, v: VendorConfig): VendorCostBreakdown {
  const metricCost = (counts.metricDataPoints / v.metrics.unitSize) * v.metrics.ratePerUnit;
  const logCost = (counts.logRecords / v.logs.unitSize) * v.logs.ratePerUnit;
  const traceCost = (counts.spans / v.traces.unitSize) * v.traces.ratePerUnit;

  const fixed = v.fixed.map(f => ({ label: f.label, cost: f.perMonth, note: f.note }));
  const fixedTotal = fixed.reduce((s, f) => s + f.cost, 0);

  return {
    vendor: v.vendor, shortName: v.shortName, color: v.color, pricingUrl: v.pricingUrl,
    metrics: {
      cost: metricCost,
      formula: `${fmt(counts.metricDataPoints / 1e6, 2)}M DPs × ~$80/M (estimated) = $${fmt(metricCost)}`,
      unit: 'MTS (metric time series)',
    },
    logs: {
      cost: logCost,
      formula: `ESTIMATE ONLY: ${fmt(counts.logRecords / 1e6, 2)}M records × ~$5/M = $${fmt(logCost)}. Contact Splunk for actual pricing.`,
      unit: 'estimated — pricing not published',
    },
    traces: {
      cost: traceCost,
      formula: `${fmt(counts.spans / 1e6, 2)}M spans × ~$11/M (from $55/host capacity) = $${fmt(traceCost)}`,
      unit: 'spans (estimated from host capacity)',
    },
    fixed,
    subtotal: metricCost + logCost + traceCost,
    total: metricCost + logCost + traceCost + fixedTotal,
    warnings: v.warnings, strengths: v.strengths,
  };
}

function calcGrafana(counts: SignalCounts, v: VendorConfig): VendorCostBreakdown {
  const series = dpToSeries(counts.metricDataPoints);
  const freeSeries = 10_000;
  const billableSeries = Math.max(0, series - freeSeries);
  const metricCost = (billableSeries / v.metrics.unitSize) * v.metrics.ratePerUnit;

  const logGB = logsToGB(counts.logRecords);
  const freeLogGB = 50;
  const logCost = Math.max(0, logGB - freeLogGB) * v.logs.ratePerUnit;

  const traceGB = spansToGB(counts.spans);
  const freeTraceGB = 50;
  const traceCost = Math.max(0, traceGB - freeTraceGB) * v.traces.ratePerUnit;

  const fixed = v.fixed.map(f => ({ label: f.label, cost: f.perMonth, note: f.note }));
  const fixedTotal = fixed.reduce((s, f) => s + f.cost, 0);

  return {
    vendor: v.vendor, shortName: v.shortName, color: v.color, pricingUrl: v.pricingUrl,
    metrics: {
      cost: metricCost,
      formula: `${fmt(billableSeries, 0)} billable series (after 10K free) × $8/K = $${fmt(metricCost)}`,
      unit: 'active series (95th percentile)',
    },
    logs: {
      cost: logCost,
      formula: `${fmt(Math.max(0, logGB - freeLogGB), 4)} GB over free tier × $0.50/GB = $${fmt(logCost)}`,
      unit: 'GB (30-day retention)',
    },
    traces: {
      cost: traceCost,
      formula: `${fmt(Math.max(0, traceGB - freeTraceGB), 4)} GB over free tier × $0.50/GB = $${fmt(traceCost)}`,
      unit: 'GB (30-day retention)',
    },
    fixed,
    subtotal: metricCost + logCost + traceCost,
    total: metricCost + logCost + traceCost + fixedTotal,
    warnings: v.warnings, strengths: v.strengths,
  };
}

function calcDash0(counts: SignalCounts, v: VendorConfig): VendorCostBreakdown {
  const metricCost = (counts.metricDataPoints / v.metrics.unitSize) * v.metrics.ratePerUnit;
  const logCost = (counts.logRecords / v.logs.unitSize) * v.logs.ratePerUnit;
  const traceCost = (counts.spans / v.traces.unitSize) * v.traces.ratePerUnit;

  return {
    vendor: v.vendor, shortName: v.shortName, color: v.color, pricingUrl: v.pricingUrl,
    metrics: {
      cost: metricCost,
      formula: `${fmt(counts.metricDataPoints / 1e6, 4)}M DPs × $0.20/M = $${fmt(metricCost)}`,
      unit: 'million data points (13-mo retention)',
    },
    logs: {
      cost: logCost,
      formula: `${fmt(counts.logRecords / 1e6, 4)}M records × $0.60/M = $${fmt(logCost)}`,
      unit: 'million log records (30d retention)',
    },
    traces: {
      cost: traceCost,
      formula: `${fmt(counts.spans / 1e6, 4)}M spans × $0.60/M = $${fmt(traceCost)}`,
      unit: 'million spans (30d retention)',
    },
    fixed: [],
    subtotal: metricCost + logCost + traceCost,
    total: metricCost + logCost + traceCost,
    warnings: v.warnings, strengths: v.strengths,
  };
}

const CALCULATORS: Record<string, (counts: SignalCounts, v: VendorConfig) => VendorCostBreakdown> = {
  'Datadog': calcDatadog,
  'Dynatrace': calcDynatrace,
  'Elastic': calcElastic,
  'New Relic': calcNewRelic,
  'Splunk': calcSplunk,
  'Grafana Cloud': calcGrafana,
  'Dash0': calcDash0,
};

/** Calculate monthly costs for all vendors given monthly signal counts. */
export function calculateAllCosts(monthlyCounts: SignalCounts): VendorCostBreakdown[] {
  return VENDORS.map(v => {
    const calc = CALCULATORS[v.vendor];
    if (!calc) return null;
    return calc(monthlyCounts, v);
  }).filter((x): x is VendorCostBreakdown => x !== null);
}

/** Extrapolate 5-minute counts to monthly (5min × 8,640 = 30-day month) */
export function toMonthly(counts5min: SignalCounts): SignalCounts {
  const factor = 8_640; // 5-min intervals per 30-day month
  return {
    metricDataPoints: counts5min.metricDataPoints * factor,
    logRecords: counts5min.logRecords * factor,
    spans: counts5min.spans * factor,
  };
}

/** Apply a scale multiplier to counts. */
export function scale(counts: SignalCounts, multiplier: number): SignalCounts {
  return {
    metricDataPoints: counts.metricDataPoints * multiplier,
    logRecords: counts.logRecords * multiplier,
    spans: counts.spans * multiplier,
  };
}
