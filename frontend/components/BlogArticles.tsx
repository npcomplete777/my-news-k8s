'use client';

import { useState } from 'react';
import { BLOG_ARTICLES, type BlogArticle } from '@/lib/blog-articles';

const PREVIEW_PARAGRAPHS = 2;

function ArticleCard({ article, index }: { article: BlogArticle; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const previewParas = article.sections[0]?.paragraphs.slice(0, PREVIEW_PARAGRAPHS) ?? [];

  return (
    <article className="border-t border-stone-200 dark:border-zinc-800 py-6">
      {/* Article header — always visible */}
      <div
        className="flex cursor-pointer items-start justify-between gap-6"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex flex-col gap-2 min-w-0">
          {/* Number + tags row */}
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-black text-xs tabular-nums text-stone-300 dark:text-zinc-700">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {article.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag-pill text-[10px] py-0.5 px-2">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <h2 className="font-display font-black uppercase leading-tight tracking-tight text-stone-900 dark:text-zinc-100 text-xl sm:text-2xl">
            {article.title}
          </h2>
          <p className="text-xs font-medium italic text-stone-500 dark:text-zinc-500 leading-relaxed">
            {article.subtitle}
          </p>
        </div>

        {/* Expand/collapse toggle */}
        <div className="shrink-0 mt-1">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all
              ${expanded
                ? 'border-stone-900 bg-stone-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'border-stone-300 text-stone-400 dark:border-zinc-700 dark:text-zinc-600'
              }`}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
            </svg>
          </div>
        </div>
      </div>

      {/* Collapsed preview */}
      {!expanded && (
        <div className="mt-4 flex flex-col gap-3">
          {previewParas.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-stone-600 dark:text-zinc-400 max-w-3xl">
              {para}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 self-start text-xs font-bold uppercase tracking-widest text-stone-400 underline underline-offset-4 transition-colors hover:text-stone-900 dark:text-zinc-600 dark:hover:text-zinc-100"
          >
            Read full article ↓
          </button>
        </div>
      )}

      {/* Expanded full article */}
      {expanded && (
        <div className="mt-4 flex flex-col gap-6 max-w-3xl">
          {article.sections.map((section, si) => (
            <div key={si} className="flex flex-col gap-3">
              {section.heading && (
                <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-900 dark:text-zinc-100">
                  {section.heading}
                </h3>
              )}
              {section.paragraphs.map((para, pi) => (
                <p key={pi} className="text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                  {para}
                </p>
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="self-start text-xs font-bold uppercase tracking-widest text-stone-400 underline underline-offset-4 transition-colors hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            Collapse ↑
          </button>
        </div>
      )}
    </article>
  );
}

export function BlogArticles() {
  return (
    <section className="py-10">
      {/* Section header */}
      <div className="mb-6 border-t-2 border-stone-900 pt-6 dark:border-zinc-100">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display font-black uppercase tracking-tighter text-stone-900 dark:text-zinc-100 text-2xl sm:text-3xl">
            From the Blog
          </h2>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-600">
            O11y Alchemy · {BLOG_ARTICLES.length} Articles
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
          Agentic AI, distributed tracing, and the future of observability
        </p>
      </div>

      {/* Article list */}
      <div>
        {BLOG_ARTICLES.map((article, i) => (
          <ArticleCard key={article.id} article={article} index={i} />
        ))}
      </div>
    </section>
  );
}
