import { Suspense } from 'react';
import { ArticleFeed } from '@/components/ArticleFeed';
import { SourceFilter } from '@/components/SourceFilter';
import { TopicFilter } from '@/components/TopicFilter';

function FilterSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="skeleton mb-3 h-3 w-16" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-7 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card">
          <div className="flex items-start gap-3">
            <div className="skeleton h-8 w-8 shrink-0 rounded" />
            <div className="flex-1">
              <div className="skeleton mb-2 h-3 w-16" />
              <div className="skeleton mb-2 h-4 w-5/6" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-100">Latest News</h1>
        <p className="text-sm text-zinc-500">
          Cloud-native, Kubernetes, and developer ecosystem news from across the web
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar filters */}
        <aside className="w-full shrink-0 lg:w-56">
          <div className="sticky top-20 flex flex-col gap-4">
            <Suspense fallback={<FilterSkeleton />}>
              <SourceFilter />
            </Suspense>
            <Suspense fallback={<FilterSkeleton />}>
              <TopicFilter />
            </Suspense>
          </div>
        </aside>

        {/* Main feed */}
        <div className="min-w-0 flex-1">
          <Suspense fallback={<FeedSkeleton />}>
            <ArticleFeed />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
