'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { SessionBadge } from '@/components/telemetry/SessionBadge';

const tabs = [
  { href: '/telemetry', label: 'Overview' },
  { href: '/telemetry/traces', label: 'Traces' },
  { href: '/telemetry/metrics', label: 'Metrics' },
  { href: '/telemetry/logs', label: 'Logs' },
];

export default function TelemetryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="dark min-h-screen bg-zinc-950 px-4 pb-20 pt-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Live Telemetry</h1>
              <p className="text-sm text-zinc-500">
                Real-time observability data from the running cluster
              </p>
            </div>
            <SessionBadge className="mt-1 sm:mt-0" />
          </div>

          {/* Sub-navigation */}
          <div className="flex gap-1 border-b border-zinc-800 pb-0">
            {tabs.map(tab => {
              const isActive =
                tab.href === '/telemetry'
                  ? pathname === '/telemetry'
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={clsx(
                    '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* Page content */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
