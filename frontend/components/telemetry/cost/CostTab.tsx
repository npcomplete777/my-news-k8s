'use client';

import { useState, useMemo } from 'react';
import { useTelemetryCounts, TIME_WINDOWS } from '@/lib/hooks/useTelemetryCounts';
import { calculateAllCosts, toMonthly, scale as scaleSignals } from '@/lib/cost-calculator';
import { SignalCounters } from './SignalCounters';
import { VendorCostGrid } from './VendorCostGrid';
import { ProjectionCalculator } from './ProjectionCalculator';
import { CostMethodology } from './CostMethodology';

export function CostTab() {
  const counts = useTelemetryCounts();
  const [windowIdx, setWindowIdx] = useState(2); // default: per month
  const [projectionScale, setProjectionScale] = useState(1);

  const window = TIME_WINDOWS[windowIdx];

  // Convert 5-min backend counts to selected window
  const windowCounts = useMemo(() => {
    const backend = counts.backend;
    const base = {
      spans: (backend?.spans ?? 0) + counts.browserSpans,
      logRecords: backend?.logRecords ?? 0,
      metricDataPoints: backend?.metricDataPoints ?? 0,
    };
    // window.multiplier converts 5-min interval to the chosen window
    return {
      spans: base.spans * window.multiplier,
      logRecords: base.logRecords * window.multiplier,
      metricDataPoints: base.metricDataPoints * window.multiplier,
    };
  }, [counts, window.multiplier]);

  const breakdowns = useMemo(() => calculateAllCosts(windowCounts), [windowCounts]);

  const cheapest = [...breakdowns].sort((a, b) => a.total - b.total)[0];
  const mostExpensive = [...breakdowns].sort((a, b) => b.total - a.total)[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
          Every span, metric, and log this site generates has a price tag — and that price varies
          wildly across vendors. Watch the signal counts update in real time, then see what your
          telemetry volume would cost across the 7 major observability platforms.
        </p>
        {cheapest && mostExpensive && (
          <p className="text-xs text-stone-400 dark:text-zinc-500">
            At current traffic:{' '}
            <span className="font-mono text-emerald-400">{cheapest.shortName}</span> is cheapest,{' '}
            <span className="font-mono" style={{ color: mostExpensive.color }}>
              {mostExpensive.shortName}
            </span>{' '}
            is {mostExpensive.total > 0
              ? `${(mostExpensive.total / Math.max(cheapest.total, 0.01)).toFixed(0)}× more expensive`
              : 'comparable'}.
          </p>
        )}
      </div>

      {/* Live signal counters */}
      <SignalCounters counts={counts} />

      {/* Time window + cost cards */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
            Showing cost
          </span>
          <div className="flex gap-1">
            {TIME_WINDOWS.map((w, i) => (
              <button
                key={w.label}
                onClick={() => setWindowIdx(i)}
                className={`rounded px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                  windowIdx === i
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <VendorCostGrid breakdowns={breakdowns} windowLabel={window.label.toLowerCase()} />
      </div>

      {/* Projection calculator */}
      <ProjectionCalculator
        breakdowns={breakdowns}
        scale={projectionScale}
        onScaleChange={setProjectionScale}
        baseWindowLabel={window.label.toLowerCase()}
      />

      {/* Methodology */}
      <CostMethodology />

      {/* Footer disclaimer */}
      <p className="text-[10px] text-stone-300 dark:text-zinc-700 leading-relaxed">
        Costs shown use published list prices with annual commitment rates (Feb 2025). Enterprise
        customers negotiate discounts of 20–50%. This site has no affiliation with any vendor listed.
        All vendors are evaluated using identical signal volume assumptions.
      </p>
    </div>
  );
}
