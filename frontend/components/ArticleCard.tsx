'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { BookmarkButton } from './BookmarkButton';
import type { Article } from '@/lib/types';

const SOURCE_STYLES: Record<string, string> = {
  'hacker-news': 'bg-hn/15 text-hn',
  reddit: 'bg-reddit/15 text-reddit',
  github: 'bg-zinc-700/50 text-zinc-300',
  devto: 'bg-zinc-700/50 text-zinc-300',
  lobsters: 'bg-lobsters/15 text-lobsters',
  youtube: 'bg-youtube/15 text-youtube',
  'k8s-blog': 'bg-k8s/15 text-k8s',
  'cncf-blog': 'bg-cncf/15 text-cncf',
};

export function sourceColor(source: string): string {
  return SOURCE_STYLES[source.toLowerCase()] ?? 'bg-zinc-700/50 text-zinc-400';
}

interface ArticleCardProps {
  article: Article;
  onBookmarkToggle?: () => void;
}

export function ArticleCard({ article, onBookmarkToggle }: ArticleCardProps) {
  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), {
    addSuffix: true,
  });

  const bgClass = sourceColor(article.source);

  return (
    <div
      className={clsx(
        'card group',
        article.read && 'opacity-65 hover:opacity-90'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Score */}
        {article.score > 0 && (
          <div className="flex shrink-0 flex-col items-center pt-0.5">
            <svg
              className="h-3.5 w-3.5 text-amber-500/70"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
            <span className="text-xs font-medium text-zinc-500">
              {article.score}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Source badge */}
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`badge text-[11px] ${bgClass}`}>
              {article.source}
            </span>
            {article.read && (
              <span className="text-[11px] text-zinc-600">read</span>
            )}
          </div>

          {/* Title */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 block text-sm font-semibold leading-snug text-zinc-200 transition-colors group-hover:text-amber-400"
          >
            {article.title}
          </a>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
            {article.author && <span>by {article.author}</span>}
            <span>{timeAgo}</span>
            <Link
              href={`/articles/${article.id}`}
              className="text-zinc-600 transition-colors hover:text-zinc-400"
            >
              details
            </Link>
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {article.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="tag-pill text-[11px]">
                  {tag}
                </span>
              ))}
              {article.tags.length > 5 && (
                <span className="text-[11px] text-zinc-600">
                  +{article.tags.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bookmark */}
        <BookmarkButton
          articleId={article.id}
          initialBookmarked={article.bookmarked}
          onToggle={onBookmarkToggle}
        />
      </div>
    </div>
  );
}
