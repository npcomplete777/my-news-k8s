'use client';

import { useState } from 'react';
import type { VendorCostBreakdown } from '@/lib/cost-calculator';
import { AnimatedNumber, fmtCost } from './AnimatedNumber';

interface Props {
  breakdown: VendorCostBreakdown;
  rank: number; // 1 = cheapest
  totalVendors: number;
  windowLabel: string; // e.g. "per month"
}

export function VendorCostCard({ breakdown: b, rank, totalVendors, windowLabel }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isCheapest = rank === 1;
  const isMostExpensive = rank === totalVendors;

  return (
    <div
      className="card flex flex-col gap-3 transition-all duration-300"
      style={{ borderLeft: `3px solid ${b.color}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-black uppercase tracking-wide"
              style={{ color: b.color }}
            >
              {b.shortName}
            </span>
            {isCheapest && (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                lowest
              </span>
            )}
            {isMostExpensive && (
              <span className="rounded-full bg-stone-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                highest
              </span>
            )}
          </div>
          <span className="text-[9px] uppercase tracking-widest text-stone-400 dark:text-zinc-600">
            #{rank} of {totalVendors}
          </span>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 text-stone-400 hover:text-stone-700 dark:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-xs"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Main cost */}
      <div>
        <p
          className="font-mono text-3xl font-bold tabular-nums leading-none"
          style={{ color: isCheapest ? '#34d399' : isMostExpensive ? '#f87171' : undefined }}
        >
          <AnimatedNumber value={b.total} format={fmtCost} durationMs={700} />
        </p>
        <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">{windowLabel}</p>
      </div>

      {/* Cost breakdown rows */}
      <div className="flex flex-col gap-1 border-t border-stone-100 dark:border-zinc-800 pt-2">
        <CostRow label="Metrics" cost={b.metrics.cost} />
        <CostRow label="Logs" cost={b.logs.cost} />
        <CostRow label="Traces" cost={b.traces.cost} />
        {b.fixed.map(f => (
          <CostRow key={f.label} label={f.label} cost={f.cost} isFixed />
        ))}
      </div>

      {/* Warnings */}
      {b.warnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {b.warnings.slice(0, 2).map((w, i) => (
            <p key={i} className="text-[10px] text-amber-500 dark:text-amber-400 leading-snug">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-stone-100 dark:border-zinc-800 pt-3">
          <ExpandedSection label="Metrics formula" text={b.metrics.formula} unit={b.metrics.unit} />
          <ExpandedSection label="Logs formula" text={b.logs.formula} unit={b.logs.unit} />
          <ExpandedSection label="Traces formula" text={b.traces.formula} unit={b.traces.unit} />

          {b.fixed.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-zinc-500 mb-1">
                Fixed fees
              </p>
              {b.fixed.map(f => (
                <p key={f.label} className="text-xs text-stone-500 dark:text-zinc-500 font-mono">
                  {f.label}: {fmtCost(f.cost)}/mo — {f.note}
                </p>
              ))}
            </div>
          )}

          {b.strengths.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500 mb-1">
                Strengths
              </p>
              {b.strengths.map((s, i) => (
                <p key={i} className="text-[10px] text-stone-500 dark:text-zinc-500 leading-snug">
                  ✓ {s}
                </p>
              ))}
            </div>
          )}

          {b.warnings.length > 2 && (
            <div>
              {b.warnings.slice(2).map((w, i) => (
                <p key={i} className="text-[10px] text-amber-500 dark:text-amber-400 leading-snug">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          <a
            href={b.pricingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
          >
            Official pricing page →
          </a>
        </div>
      )}
    </div>
  );
}

function CostRow({ label, cost, isFixed }: { label: string; cost: number; isFixed?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-xs ${isFixed ? 'text-stone-400 dark:text-zinc-500' : 'text-stone-500 dark:text-zinc-400'}`}>
        {isFixed ? '+ ' : ''}{label}
      </span>
      <span className={`font-mono text-xs tabular-nums ${isFixed ? 'text-stone-400 dark:text-zinc-500' : 'text-stone-700 dark:text-zinc-300'}`}>
        <AnimatedNumber value={cost} format={fmtCost} durationMs={700} />
      </span>
    </div>
  );
}

function ExpandedSection({ label, text, unit }: { label: string; text: string; unit: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-zinc-500 mb-0.5">
        {label}
      </p>
      <p className="text-xs font-mono text-stone-600 dark:text-zinc-400 break-words leading-relaxed">
        {text}
      </p>
      <p className="text-[10px] text-stone-400 dark:text-zinc-600 mt-0.5">Unit: {unit}</p>
    </div>
  );
}
