'use client';

import { useState } from 'react';
import { ASSUMPTIONS } from '@/lib/vendor-pricing';

export function CostMethodology() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-stone-900 dark:text-zinc-100">
            Methodology & Sources
          </p>
          <p className="text-xs text-stone-400 dark:text-zinc-500">
            How these numbers are calculated — click to expand
          </p>
        </div>
        <span className="shrink-0 text-stone-400 dark:text-zinc-600 text-sm">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-5 border-t border-stone-100 dark:border-zinc-800 pt-4">
          <a
            href="/telemetry/cost/methodology"
            className="text-xs font-bold uppercase tracking-wider text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            → Full calculation details for all 7 vendors
          </a>

          {/* Disclaimer */}
          <div className="rounded-md border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Important:</strong> All costs use published list prices with annual commitment
              rates as of February 2025. Enterprise customers typically negotiate significant discounts
              (20–50%). Actual costs depend on your specific cardinality, retention requirements, and
              usage patterns. No vendor is affiliated with this site — all comparisons use the same
              methodology and assumptions.
            </p>
          </div>

          {/* Assumptions */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
              Normalization assumptions
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {[
                ['Avg span size', `${ASSUMPTIONS.avgSpanBytes} bytes`],
                ['Avg log record size', `${ASSUMPTIONS.avgLogBytes} bytes`],
                ['Avg metric DP size', `${ASSUMPTIONS.avgMetricBytes} bytes`],
                ['Metric cardinality ratio', `${ASSUMPTIONS.metricCardinalityRatio * 100}% (${ASSUMPTIONS.metricCardinalityRatio * 1000} series per 1,000 DPs)`],
                ['Elastic enrichment multiplier', `${ASSUMPTIONS.elasticEnrichmentMultiplier}× (middle of 2–10× range)`],
                ['Assumed hosts', `${ASSUMPTIONS.assumedHosts} (this site)`],
                ['Assumed seats', `${ASSUMPTIONS.assumedSeats} (1 engineer)`],
              ].map(([label, value]) => (
                <div key={label as string} className="flex gap-2">
                  <span className="text-xs text-stone-400 dark:text-zinc-500 min-w-0">{label}:</span>
                  <span className="text-xs font-mono text-stone-700 dark:text-zinc-300">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signal counting */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
              Signal counting
            </p>
            <p className="text-xs text-stone-500 dark:text-zinc-500 leading-relaxed">
              Backend signal counts (spans, logs, metric data points) are queried from the live
              ClickHouse cluster that stores this site&apos;s telemetry. The query window is the
              last 5 minutes; costs are extrapolated to the selected time window by multiplying
              by the appropriate interval count. Browser spans from your current session are
              counted separately via the OpenTelemetry browser SDK and added to the span total.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
