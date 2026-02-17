'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useArticles } from '@/lib/hooks/useArticles';
import { ArticleCard } from './ArticleCard';
import type { Article } from '@/lib/types';

type SortOption = 'newest' | 'popular';

export function ArticleFeed() {
  const searchParams = useSearchParams();
  const sourceFilter = searchParams.get('source') ?? '';
  const tagFilter = searchParams.get('tag') ?? '';

  const [sort, setSort] = useState<SortOption>('newest');
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const sortParam = sort === 'popular' ? 'score,desc' : 'publishedAt,desc';

  const { articles, page, isLoading, isValidating } = useArticles({
    page: currentPage,
    size: 20,
    source: sourceFilter || undefined,
    tag: tagFilter || undefined,
    sort: sortParam,
  });

  // Reset when filters change
  useEffect(() => {
    setAllArticles([]);
    setCurrentPage(0);
    setHasMore(true);
  }, [sourceFilter, tagFilter, sort]);

  // Append articles when page data arrives
  useEffect(() => {
    if (articles.length > 0) {
      setAllArticles((prev) => {
        if (currentPage === 0) return articles;
        const existingIds = new Set(prev.map((a) => a.id));
        const newArticles = articles.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newArticles];
      });
    }
    if (page) {
      setHasMore(!page.last);
    }
  }, [articles, page, currentPage]);

  // Infinite scroll via intersection observer
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>(null);

  const loadMore = useCallback(() => {
    if (!isLoading && !isValidating && hasMore) {
      setCurrentPage((p) => p + 1);
    }
  }, [isLoading, isValidating, hasMore]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">
          Sort
        </span>
        <button
          onClick={() => setSort('newest')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            sort === 'newest'
              ? 'bg-zinc-800 text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          Newest
        </button>
        <button
          onClick={() => setSort('popular')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            sort === 'popular'
              ? 'bg-zinc-800 text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          Popular
        </button>
        {page && (
          <span className="ml-auto text-xs text-zinc-600">
            {page.totalElements} articles
          </span>
        )}
      </div>

      {/* Article list */}
      {allArticles.length === 0 && isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
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
      ) : allArticles.length === 0 ? (
        <div className="card py-12 text-center">
          <svg
            className="mx-auto mb-3 h-12 w-12 text-zinc-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
            />
          </svg>
          <p className="text-zinc-500">No articles found</p>
          <p className="mt-1 text-sm text-zinc-600">
            Try adjusting your filters or check back later
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {allArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* Loading more indicator */}
          {isValidating && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
            </div>
          )}

          {/* Sentinel for infinite scroll */}
          {hasMore && <div ref={sentinelRef} className="h-4" />}

          {!hasMore && allArticles.length > 0 && (
            <p className="py-4 text-center text-sm text-zinc-600">
              You have reached the end
            </p>
          )}
        </>
      )}
    </div>
  );
}
