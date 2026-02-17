'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getArticle, markAsRead } from '@/lib/api';
import { BookmarkButton } from '@/components/BookmarkButton';
import type { ArticleDetail } from '@/lib/types';
import { sourceColor } from '@/components/ArticleCard';

export default function ArticleDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || isNaN(id)) return;

    let cancelled = false;

    async function load() {
      try {
        const data = await getArticle(id);
        if (!cancelled) {
          setArticle(data);
          setLoading(false);
          // Mark as read on mount
          markAsRead(id).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load article');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4">
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton mt-4 h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card text-center">
          <p className="text-red-400">{error || 'Article not found'}</p>
          <Link href="/" className="btn-ghost mt-4 inline-block">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const bgClass = sourceColor(article.source);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to feed
      </Link>

      <article className="card">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className={`badge ${bgClass} w-fit`}>{article.source}</span>
            <h1 className="text-xl font-bold leading-tight text-zinc-100 sm:text-2xl">
              {article.title}
            </h1>
          </div>
          <BookmarkButton
            articleId={article.id}
            initialBookmarked={article.bookmarked}
          />
        </div>

        {/* Meta */}
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          {article.author && (
            <span>
              by <span className="text-zinc-400">{article.author}</span>
            </span>
          )}
          <span>
            {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
          </span>
          {article.score > 0 && (
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              {article.score}
            </span>
          )}
        </div>

        {/* Content */}
        {article.contentSnippet && (
          <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
            <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">
              {article.contentSnippet}
            </p>
          </div>
        )}

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span key={tag} className="tag-pill">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* External link */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center gap-2"
        >
          Read original
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>

        {/* Metadata */}
        {article.metadata && Object.keys(article.metadata).length > 0 && (
          <div className="mt-6 border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Metadata
            </h3>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(article.metadata).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-zinc-600">{key}</dt>
                  <dd className="text-zinc-400">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </article>
    </div>
  );
}
