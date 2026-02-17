'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBookmarks } from '@/lib/hooks/useBookmarks';
import { ArticleCard } from '@/components/ArticleCard';

export default function BookmarksPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const { bookmarks, page, isLoading, toggleBookmark } = useBookmarks({
    page: currentPage,
    size: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-100">Bookmarks</h1>
        <p className="text-sm text-zinc-500">
          Your saved articles for later reading
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton mb-3 h-4 w-16" />
              <div className="skeleton mb-2 h-5 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
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
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
          <p className="text-zinc-500">No bookmarks yet</p>
          <p className="mt-1 text-sm text-zinc-600">
            Bookmark articles from the feed to save them here
          </p>
          <Link href="/" className="btn-primary mt-4 inline-block">
            Browse articles
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {bookmarks.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onBookmarkToggle={async () => {
                  await toggleBookmark(article.id, article.bookmarked);
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          {page && page.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={page.first}
                className="btn-ghost disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Page {page.number + 1} of {page.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={page.last}
                className="btn-ghost disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
