import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SourceFilter } from '@/components/SourceFilter';
import { TopicFilter } from '@/components/TopicFilter';
import { ArticleFeed } from '@/components/ArticleFeed';

export const metadata: Metadata = {
  title: 'Industry Feed',
  description:
    'Kubernetes, observability, and platform engineering news — aggregated from Hacker News, CNCF, SRE Weekly, and more. Curated and tagged by AI.',
  openGraph: {
    title: 'Industry Feed — O11y Alchemy',
    description: 'Live observability and platform engineering news, curated by AI.',
    url: '/feed',
  },
};

export default function FeedPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        <div className="mb-6 border-t-2 border-stone-900 pt-6 dark:border-zinc-100">
          <h1 className="font-display font-black uppercase tracking-tighter text-stone-900 dark:text-zinc-100 text-2xl sm:text-3xl">
            Industry Feed
          </h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
            Kubernetes, observability, and platform engineering news from across the web
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
          <aside className="flex flex-col gap-4">
            <Suspense fallback={<div className="skeleton h-52 rounded-lg" />}>
              <SourceFilter />
            </Suspense>
            <Suspense fallback={<div className="skeleton h-36 rounded-lg" />}>
              <TopicFilter />
            </Suspense>
          </aside>
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
