import Link from 'next/link';
import { VENDORS, ASSUMPTIONS } from '@/lib/vendor-pricing';

export const metadata = {
  title: 'Cost Methodology — How Each Vendor Is Calculated',
  description:
    'Detailed breakdown of how observability vendor costs are calculated for Datadog, Dynatrace, Elastic, New Relic, Splunk, Grafana Cloud, and Dash0.',
};

// Window multipliers used in the calculator (5-min interval to window)
const WINDOW_MULTIPLIERS = [
  { label: 'Per hour', multiplier: 12, description: '12 × 5-min intervals' },
  { label: 'Per day', multiplier: 288, description: '288 × 5-min intervals' },
  { label: 'Per month', multiplier: 8640, description: '8,640 × 5-min intervals (30 days)' },
];

// Justifications for each assumption
const ASSUMPTION_ROWS = [
  {
    key: 'Avg span size',
    value: `${ASSUMPTIONS.avgSpanBytes} bytes`,
    justification:
      'Measured from typical OTel trace spans with ~10 attributes. Spans vary 300–2,000 bytes; 800 is a realistic mid-range for instrumented microservices.',
  },
  {
    key: 'Avg log record size',
    value: `${ASSUMPTIONS.avgLogBytes} bytes`,
    justification:
      'Structured JSON log with severity, timestamp, trace context, and ~3 custom attributes. Plain-text logs are smaller; structured logs with stack traces are larger.',
  },
  {
    key: 'Avg metric data point size',
    value: `${ASSUMPTIONS.avgMetricBytes} bytes`,
    justification:
      'A single gauge or counter data point with 3–5 labels. Used to convert data point counts to GB for vendors that bill by storage.',
  },
  {
    key: 'Metric cardinality ratio',
    value: `${ASSUMPTIONS.metricCardinalityRatio * 100}% (${ASSUMPTIONS.metricCardinalityRatio * 1000} series per 1,000 DPs)`,
    justification:
      'Assumes 10 unique label combinations per metric name — e.g. status_code × method × endpoint. Real cardinality depends heavily on labeling strategy.',
  },
  {
    key: 'Elastic enrichment multiplier',
    value: `${ASSUMPTIONS.elasticEnrichmentMultiplier}× raw wire size`,
    justification:
      'Elastic Serverless Observability meters ingest on normalized, enriched data. Elastic documentation cites 2–10× amplification; 3× is the conservative mid-estimate.',
  },
  {
    key: 'Assumed hosts',
    value: `${ASSUMPTIONS.assumedHosts}`,
    justification:
      'This site runs on a single-host deployment. Datadog and Splunk have per-host fees; scaling to N hosts multiplies those fixed costs directly.',
  },
  {
    key: 'Assumed seats',
    value: `${ASSUMPTIONS.assumedSeats}`,
    justification:
      'One engineer with full platform access. New Relic\'s $349/mo seat fee and Grafana\'s $8/seat overage are included based on 1 Full Platform user.',
  },
];

export default function CostMethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-10">
      {/* Back link */}
      <div>
        <Link
          href="/telemetry/cost"
          className="text-xs font-bold uppercase tracking-wider text-stone-400 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
        >
          ← Back to Cost Calculator
        </Link>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-zinc-100">
          Cost Calculation Methodology
        </h1>
        <p className="text-sm text-stone-500 dark:text-zinc-400 leading-relaxed">
          How every number on the cost calculator is derived — signal counting, window extrapolation,
          enrichment multipliers, and the per-vendor formulas for all 7 platforms. Pricing data as of
          February 2025.
        </p>
      </div>

      {/* ── 1. Signal Counting ── */}
      <Section title="1. Signal Counting">
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
          Backend signal counts — spans, log records, and metric data points — are queried live from
          the ClickHouse cluster that stores this site&apos;s OpenTelemetry data. Each query covers
          the last 5-minute window. The query selects only records with a timestamp in{' '}
          <code className="font-mono text-xs bg-stone-100 dark:bg-zinc-800 px-1 rounded">
            [now() - 5m, now()]
          </code>{' '}
          from the <code className="font-mono text-xs bg-stone-100 dark:bg-zinc-800 px-1 rounded">otel</code> database.
        </p>
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed mt-2">
          Browser spans are counted separately. The OpenTelemetry browser SDK (
          <code className="font-mono text-xs bg-stone-100 dark:bg-zinc-800 px-1 rounded">
            @opentelemetry/sdk-trace-web
          </code>
          ) instruments page load, navigation, and fetch requests in your current browser session.
          These spans are batched and sent directly from your browser to the OTel collector, then
          added to the span total shown on the cost page.
        </p>
      </Section>

      {/* ── 2. Window Extrapolation ── */}
      <Section title="2. Window Extrapolation">
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
          The 5-minute raw counts are multiplied by an interval factor to extrapolate to the chosen
          time window. This assumes traffic is roughly uniform — appropriate for the low-traffic
          baseline this site represents.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-zinc-700">
                <Th>Window</Th>
                <Th>Multiplier</Th>
                <Th>Derivation</Th>
              </tr>
            </thead>
            <tbody>
              {WINDOW_MULTIPLIERS.map(w => (
                <tr key={w.label} className="border-b border-stone-100 dark:border-zinc-800">
                  <Td>{w.label}</Td>
                  <Td mono>{w.multiplier.toLocaleString()}</Td>
                  <Td>{w.description}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-stone-400 dark:text-zinc-500 mt-2">
          Formula: <code className="font-mono bg-stone-100 dark:bg-zinc-800 px-1 rounded">
            windowCount = 5minCount × multiplier
          </code>
        </p>
      </Section>

      {/* ── 3. Normalization Assumptions ── */}
      <Section title="3. Normalization Assumptions">
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
          Different vendors bill in different units (GB, data points, series, records). These
          assumptions convert raw signal counts into the units each vendor uses for billing.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-zinc-700">
                <Th>Assumption</Th>
                <Th>Value</Th>
                <Th>Justification</Th>
              </tr>
            </thead>
            <tbody>
              {ASSUMPTION_ROWS.map(row => (
                <tr key={row.key} className="border-b border-stone-100 dark:border-zinc-800">
                  <Td>{row.key}</Td>
                  <Td mono>{row.value}</Td>
                  <Td>{row.justification}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── 4. Enrichment Multipliers ── */}
      <Section title="4. Enrichment Multipliers">
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
          Some vendors bill on <em>processed</em> or <em>enriched</em> data rather than raw OTLP
          wire size. Enrichment includes field normalization, index metadata, schema overhead, and
          internal routing structures added by the vendor&apos;s ingest pipeline.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <EnrichmentNote
            vendor="Dynatrace"
            color="#1496FF"
            multipliers={{ logs: '2×', traces: '1.5×' }}
            explanation="Dynatrace stores logs in a parsed, query-optimized format with additional Davis context fields. Traces are enriched with topology context but less aggressively than logs. Dynatrace's own documentation cites 2–4× amplification; 2× for logs and 1.5× for traces are conservative estimates."
          />
          <EnrichmentNote
            vendor="Elastic"
            color="#FEC514"
            multipliers={{ all: '3×' }}
            explanation="Elastic Serverless Observability applies ECS (Elastic Common Schema) normalization, index mappings, and internal routing overhead. Elastic's own pricing documentation notes the enrichment factor varies 2–10×; 3× is the documented conservative estimate for structured OTel data."
          />
        </div>
      </Section>

      {/* ── 5. Commitment Minimums ── */}
      <Section title="5. Commitment Minimums">
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
          Pure consumption pricing (pay only for what you use) accurately represents incremental cost
          but can be misleading for vendors that require annual contract commitments before any
          consumption begins.
        </p>
        <div className="mt-3 rounded-md border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">Dynatrace DPS Contract</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Dynatrace pricing is based on <strong>Digital Performance Score (DPS)</strong> — a unified
            consumption unit across all signal types. While DPS usage can technically reach $0 at
            zero traffic, Dynatrace requires an <strong>annual DPS contract minimum</strong> of
            approximately $20,000/year before any consumption is billed. This minimum is non-negotiable
            for commercial customers and represents the real floor cost regardless of usage.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed mt-2">
            Enabling the <strong>&quot;Commitment minimums&quot;</strong> toggle on the cost calculator
            adds this $1,667/mo pro-rated to the selected time window. With the toggle enabled,
            Dynatrace correctly reflects its true minimum cost for any new customer.
          </p>
        </div>
      </Section>

      {/* ── 6. Per-Vendor Formulas ── */}
      <Section title="6. Per-Vendor Formulas">
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
          Detailed breakdown of how each vendor&apos;s cost is calculated from raw signal counts.
          All rates are published list prices with annual commitment discounts applied where
          applicable (Feb 2025).
        </p>
        <div className="mt-6 flex flex-col gap-8">
          {VENDORS.map(v => (
            <VendorSection key={v.vendor} v={v} />
          ))}
        </div>
      </Section>

      {/* ── 7. Limitations ── */}
      <Section title="7. Limitations & Caveats">
        <ul className="flex flex-col gap-2">
          {[
            {
              label: 'Enterprise discounts',
              detail:
                'All costs use published list prices. Enterprise customers typically negotiate 20–50% discounts. At scale, Datadog and Dynatrace in particular have significant negotiation leverage.',
            },
            {
              label: 'Cardinality spikes',
              detail:
                'The metric cardinality ratio (10%) is a baseline assumption. High-cardinality deployments (many unique label combinations) can multiply Datadog and Grafana Cloud costs 5–20×. Cardinality is the primary surprise cost driver in production observability.',
            },
            {
              label: 'Multi-host scaling',
              detail:
                'Datadog and Splunk have per-host fees that scale linearly with your fleet size. A 10-host deployment multiplies the fixed fees by 10, which can dominate total cost at larger scales.',
            },
            {
              label: 'Bundled products',
              detail:
                'Some vendors (New Relic, Datadog) bundle features that would require separate products elsewhere. The seat/host fees cover broad platform access — the per-signal costs shown here don\'t capture the full value exchange.',
            },
            {
              label: 'Self-hosted options',
              detail:
                'Grafana OSS, Elastic self-managed, and OpenTelemetry Collector-only setups have $0 software cost. This calculator compares SaaS/managed offerings only.',
            },
            {
              label: 'Pricing changes',
              detail:
                'All prices are from February 2025. Observability pricing changes frequently — especially for newer vendors like Dash0 that are still establishing their pricing model.',
            },
          ].map(item => (
            <li key={item.label} className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-stone-700 dark:text-zinc-300">{item.label}</span>
              <span className="text-xs text-stone-500 dark:text-zinc-500 leading-relaxed">{item.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Footer */}
      <div className="border-t border-stone-100 dark:border-zinc-800 pt-6">
        <Link
          href="/telemetry/cost"
          className="text-xs font-bold uppercase tracking-wider text-stone-400 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
        >
          ← Back to Cost Calculator
        </Link>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-black uppercase tracking-wide text-stone-800 dark:text-zinc-200 border-b border-stone-200 dark:border-zinc-700 pb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`py-2 pr-4 align-top text-xs text-stone-600 dark:text-zinc-400 ${mono ? 'font-mono' : ''}`}>
      {children}
    </td>
  );
}

function EnrichmentNote({
  vendor,
  color,
  multipliers,
  explanation,
}: {
  vendor: string;
  color: string;
  multipliers: Record<string, string>;
  explanation: string;
}) {
  return (
    <div className="rounded-md border border-stone-200 dark:border-zinc-700 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-black uppercase tracking-wide" style={{ color }}>
          {vendor}
        </span>
        <div className="flex gap-1">
          {Object.entries(multipliers).map(([signal, mult]) => (
            <span
              key={signal}
              className="rounded-full bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-mono font-bold text-stone-600 dark:text-zinc-400"
            >
              {signal === 'all' ? 'all signals' : signal}: {mult}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-stone-500 dark:text-zinc-500 leading-relaxed">{explanation}</p>
    </div>
  );
}

function VendorSection({ v }: { v: (typeof VENDORS)[number] }) {
  const hasMinimum = !!v.commitmentMinimum;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-stone-200 dark:border-zinc-700 p-4">
      {/* Vendor heading */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: v.color }}>
          {v.vendor}
        </h3>
        <a
          href={v.pricingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
        >
          Official pricing →
        </a>
      </div>

      {/* Pricing model summary */}
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
        Model:{' '}
        <span className="normal-case font-normal text-stone-600 dark:text-zinc-400">
          {v.metrics.model === 'per-series'
            ? 'Per active metric series'
            : v.metrics.model === 'per-datapoint'
            ? 'Per metric data point (consumption)'
            : 'Per GB ingested (all signals)'}
        </span>
      </p>

      {/* Signal formulas */}
      <div className="flex flex-col gap-2">
        <FormulaRow signal="Metrics" note={v.metrics.sourceNote} />
        <FormulaRow signal="Logs" note={v.logs.sourceNote} />
        <FormulaRow signal="Traces" note={v.traces.sourceNote} />
      </div>

      {/* Fixed costs */}
      {v.fixed.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
            Fixed fees
          </p>
          {v.fixed.map(f => (
            <p key={f.label} className="text-xs font-mono text-stone-600 dark:text-zinc-400">
              {f.label}: ${f.perMonth.toLocaleString()}/mo — {f.note}
            </p>
          ))}
        </div>
      )}

      {/* Commitment minimum */}
      {hasMinimum && (
        <div className="rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-0.5">
            Annual commitment minimum
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            ${(v.commitmentMinimum!.perYear / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo
            (${v.commitmentMinimum!.perYear.toLocaleString()}/yr) —{' '}
            {v.commitmentMinimum!.description}
          </p>
        </div>
      )}

      {/* Warnings */}
      {v.warnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {v.warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-amber-500 dark:text-amber-400 leading-snug">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Strengths */}
      {v.strengths.length > 0 && (
        <div className="flex flex-col gap-1">
          {v.strengths.map((s, i) => (
            <p key={i} className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-snug">
              ✓ {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function FormulaRow({ signal, note }: { signal: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
        {signal}
      </span>
      <span className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">{note}</span>
    </div>
  );
}
