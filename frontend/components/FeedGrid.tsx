'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { getArticles } from '@/lib/api';
import { ArticleGridCard } from './ArticleGridCard';
import type { Article, Page } from '@/lib/types';

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3">
      <div className="skeleton aspect-video w-full" />
      <div className="skeleton h-3 w-20" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-3 w-16" />
    </div>
  );
}

export function FeedGrid() {
  const { data, isLoading } = useSWR<Page<Article>>(
    'home-feed',
    () => getArticles({ page: 0, size: 8 } as any)
  );

  const articles = data?.content ?? [];

  return (
    <section className="mt-10">
      {/* Section header */}
      <div className="mb-8 flex items-baseline justify-between border-t-2 border-stone-900 dark:border-zinc-100 pt-4">
        <span className="font-black uppercase tracking-widest text-xs text-stone-900 dark:text-zinc-100">
          From the Feed
        </span>
        <Link
          href="/"
          className="font-black uppercase tracking-widest text-xs text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors"
        >
          View all →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : articles.map((article) => (
              <ArticleGridCard key={article.id} article={article} />
            ))}
      </div>
    </section>
  );
}
