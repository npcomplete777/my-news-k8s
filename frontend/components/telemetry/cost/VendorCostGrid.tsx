'use client';

import { useMemo } from 'react';
import type { VendorCostBreakdown } from '@/lib/cost-calculator';
import { VendorCostCard } from './VendorCostCard';

interface Props {
  breakdowns: VendorCostBreakdown[];
  windowLabel: string;
  includeMinimums?: boolean;
}

export function VendorCostGrid({ breakdowns, windowLabel, includeMinimums }: Props) {
  const sorted = useMemo(
    () => [...breakdowns].sort((a, b) => a.total - b.total),
    [breakdowns]
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((b, i) => (
        <VendorCostCard
          key={b.vendor}
          breakdown={b}
          rank={i + 1}
          totalVendors={sorted.length}
          windowLabel={windowLabel}
          includeMinimums={includeMinimums}
        />
      ))}
    </div>
  );
}
