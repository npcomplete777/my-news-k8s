'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import useSWR from 'swr';
import { searchArticles } from '@/lib/api';
import { ArticleCard } from '@/components/ArticleCard';
import type { Article, Page } from '@/lib/types';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [currentPage, setCurrentPage] = useState(0);

  // Reset page when query changes
  useEffect(() => {
    setCurrentPage(0);
  }, [query]);

  const { data, isLoading } = useSWR<Page<Article>>(
    query ? `/api/articles/search?q=${query}&page=${currentPage}` : null,
    () => searchArticles({ q: query, page: currentPage }),
    { revalidateOnFocus: false }
  );

  if (!query) {
    return (
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
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <p className="text-zinc-500">Enter a search query to find articles</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton mb-3 h-4 w-16" />
            <div className="skeleton mb-2 h-5 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const articles = data?.content ?? [];

  if (articles.length === 0) {
    return (
      <div className="card py-12 text-center">
        <p className="text-zinc-500">
          No results found for &ldquo;{query}&rdquo;
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Try different keywords or check your spelling
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">
        {data?.totalElements ?? 0} results for &ldquo;{query}&rdquo;
      </p>
      <div className="flex flex-col gap-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={data.first}
            className="btn-ghost disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {data.number + 1} of {data.totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={data.last}
            className="btn-ghost disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-100">Search</h1>
        <p className="text-sm text-zinc-500">
          Find articles across all sources
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card">
                <div className="skeleton h-16 w-full" />
              </div>
            ))}
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </div>
  );
}
