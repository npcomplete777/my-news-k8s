'use client';

import { useState, useCallback } from 'react';
import { addBookmark, removeBookmark } from '@/lib/api';

interface BookmarkButtonProps {
  articleId: number;
  initialBookmarked: boolean;
  onToggle?: () => void;
}

export function BookmarkButton({
  articleId,
  initialBookmarked,
  onToggle,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (loading) return;

      // Optimistic update
      setBookmarked((prev) => !prev);
      setLoading(true);

      try {
        if (bookmarked) {
          await removeBookmark(articleId);
        } else {
          await addBookmark(articleId);
        }
        onToggle?.();
      } catch {
        // Revert on error
        setBookmarked((prev) => !prev);
      } finally {
        setLoading(false);
      }
    },
    [articleId, bookmarked, loading, onToggle]
  );

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="group/bm shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-amber-400 disabled:opacity-50"
      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      {bookmarked ? (
        <svg
          className="h-5 w-5 text-amber-500"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            fillRule="evenodd"
            d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
          />
        </svg>
      )}
    </button>
  );
}
