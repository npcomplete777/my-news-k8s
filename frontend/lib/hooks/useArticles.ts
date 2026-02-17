'use client';

import useSWR from 'swr';
import type { Article, ArticleParams, Page } from '@/lib/types';
import { getArticles } from '@/lib/api';

function buildKey(params: ArticleParams): string {
  const parts = ['/api/articles'];
  const queryParts: string[] = [];
  if (params.page !== undefined) queryParts.push(`page=${params.page}`);
  if (params.size !== undefined) queryParts.push(`size=${params.size}`);
  if (params.source) queryParts.push(`source=${params.source}`);
  if (params.tag) queryParts.push(`tag=${params.tag}`);
  if (params.sort) queryParts.push(`sort=${params.sort}`);
  if (queryParts.length > 0) parts.push('?' + queryParts.join('&'));
  return parts.join('');
}

export function useArticles(params: ArticleParams = {}) {
  const key = buildKey(params);

  const { data, error, isLoading, isValidating, mutate } = useSWR<Page<Article>>(
    key,
    () => getArticles(params),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  return {
    articles: data?.content ?? [],
    page: data,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
