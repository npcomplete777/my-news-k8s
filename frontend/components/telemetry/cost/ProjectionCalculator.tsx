'use client';

import type { VendorCostBreakdown } from '@/lib/cost-calculator';
import { fmtCost } from './AnimatedNumber';

interface Props {
  breakdowns: VendorCostBreakdown[];
  scale: number;
  onScaleChange: (scale: number) => void;
  baseWindowLabel: string;
}

const SCALE_OPTIONS = [
  { label: '1×', value: 1, sublabel: 'current traffic' },
  { label: '10×', value: 10, sublabel: 'small startup' },
  { label: '100×', value: 100, sublabel: 'mid-size org' },
  { label: '1,000×', value: 1_000, sublabel: 'large enterprise' },
];

export function ProjectionCalculator({ breakdowns, scale, onScaleChange, baseWindowLabel }: Props) {
  const sorted = [...breakdowns].sort((a, b) => a.total * scale - b.total * scale);
  const maxCost = (sorted[sorted.length - 1]?.total ?? 0) * scale || 1;

  return (
    <div className="card flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-stone-900 dark:text-zinc-100">
          Scale Projection
        </h3>
        <p className="text-xs text-stone-400 dark:text-zinc-500">
          If your organization generated this multiple of traffic ({baseWindowLabel})
        </p>
      </div>

      {/* Scale selector */}
      <div className="flex flex-wrap gap-2">
        {SCALE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onScaleChange(opt.value)}
            className={`flex flex-col items-center rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              scale === opt.value
                ? 'bg-amber-500 text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            <span>{opt.label}</span>
            <span className="text-[9px] font-normal normal-case opacity-75">{opt.sublabel}</span>
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="flex flex-col gap-2">
        {sorted.map(b => {
          const cost = b.total * scale;
          const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
          const isCheapest = b.vendor === sorted[0]?.vendor;

          return (
            <div key={b.vendor} className="flex items-center gap-3">
              <span
                className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-right"
                style={{ color: b.color }}
              >
                {b.shortName}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div className="h-5 flex-1 rounded-sm bg-stone-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, 0.5)}%`,
                      backgroundColor: isCheapest ? '#34d399' : b.color,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-stone-700 dark:text-zinc-300">
                  {fmtCost(cost)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-stone-400 dark:text-zinc-600">
        Costs scale linearly with signal volume. Fixed fees (host/seat) are included as-is.
        At 1,000× traffic, some vendors may offer volume discounts not reflected here.
      </p>
    </div>
  );
}
