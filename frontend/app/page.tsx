import { Suspense } from 'react';
import { HeroCarousel } from '@/components/HeroCarousel';
import { LiveTelemetryPulse } from '@/components/LiveTelemetryPulse';
import { SourceFilter } from '@/components/SourceFilter';
import { TopicFilter } from '@/components/TopicFilter';
import { ArticleFeed } from '@/components/ArticleFeed';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-4">
        <LiveTelemetryPulse />
        <HeroCarousel />

        {/* Feed section */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
          {/* Sidebar filters */}
          <aside className="flex flex-col gap-4">
            <Suspense fallback={<div className="skeleton h-52 rounded-lg" />}>
              <SourceFilter />
            </Suspense>
            <Suspense fallback={<div className="skeleton h-36 rounded-lg" />}>
              <TopicFilter />
            </Suspense>
          </aside>

          {/* Article feed */}
          <div className="min-w-0">
            <Suspense fallback={<div className="skeleton h-96 rounded-lg" />}>
              <ArticleFeed />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
