'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import type { Article, Page } from '@/lib/types';
import { getBookmarks, addBookmark, removeBookmark } from '@/lib/api';

export function useBookmarks(params: { page?: number; size?: number } = {}) {
  const key = `/api/bookmarks?page=${params.page ?? 0}&size=${params.size ?? 20}`;

  const { data, error, isLoading, mutate } = useSWR<Page<Article>>(
    key,
    () => getBookmarks(params),
    {
      revalidateOnFocus: false,
    }
  );

  const toggleBookmark = useCallback(
    async (articleId: number, currentlyBookmarked: boolean) => {
      try {
        if (currentlyBookmarked) {
          await removeBookmark(articleId);
        } else {
          await addBookmark(articleId);
        }
        mutate();
      } catch (err) {
        console.error('Failed to toggle bookmark:', err);
        throw err;
      }
    },
    [mutate]
  );

  return {
    bookmarks: data?.content ?? [],
    page: data,
    isLoading,
    error,
    mutate,
    toggleBookmark,
  };
}
