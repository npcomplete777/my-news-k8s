'use client';

import { formatDistanceToNow } from 'date-fns';
import { sourceColor } from './ArticleCard';
import type { Article } from '@/lib/types';

interface ArticleGridCardProps {
  article: Article;
}

export function ArticleGridCard({ article }: ArticleGridCardProps) {
  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : null;
  const timeAgo = publishedDate && !isNaN(publishedDate.getTime())
    ? formatDistanceToNow(publishedDate, { addSuffix: true })
    : null;

  const bgClass = sourceColor(article.source);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-stone-100 dark:bg-zinc-800">
        {article.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.classList.add('flex', 'items-center', 'justify-center');
                const fallback = document.createElement('span');
                fallback.className = 'text-2xl text-stone-300 select-none';
                fallback.textContent = '◎';
                parent.appendChild(fallback);
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-2xl text-stone-300 select-none">◎</span>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2">
        <span className={`badge text-[10px] ${bgClass}`}>
          {article.source}
        </span>
        {timeAgo && <span className="text-[10px] text-stone-400 dark:text-zinc-500">{timeAgo}</span>}
      </div>

      {/* Title */}
      <p className="text-sm font-bold leading-snug text-stone-900 dark:text-zinc-100 line-clamp-3 transition-colors group-hover:text-stone-500 dark:group-hover:text-zinc-400">
        {article.title}
      </p>

      {/* Read more */}
      <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 transition-colors group-hover:text-stone-900 dark:group-hover:text-zinc-100">
        Read more →
      </span>
    </a>
  );
}
