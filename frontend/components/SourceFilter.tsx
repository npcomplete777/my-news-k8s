'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface SourceConfig {
  slug: string;
  name: string;
  color: string;
  dot: string;
}

const SOURCES: SourceConfig[] = [
  { slug: 'hacker-news', name: 'Hacker News', color: 'text-hn', dot: 'bg-hn' },
  { slug: 'reddit', name: 'Reddit', color: 'text-reddit', dot: 'bg-reddit' },
  { slug: 'github', name: 'GitHub', color: 'text-zinc-300', dot: 'bg-zinc-400' },
  { slug: 'devto', name: 'Dev.to', color: 'text-zinc-300', dot: 'bg-zinc-400' },
  { slug: 'lobsters', name: 'Lobsters', color: 'text-lobsters', dot: 'bg-lobsters' },
  { slug: 'youtube', name: 'YouTube', color: 'text-youtube', dot: 'bg-youtube' },
  { slug: 'k8s-blog', name: 'K8s Blog', color: 'text-k8s', dot: 'bg-k8s' },
  { slug: 'cncf-blog', name: 'CNCF Blog', color: 'text-cncf', dot: 'bg-cncf' },
];

export function SourceFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSource = searchParams.get('source') ?? '';

  const selectSource = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slug === activeSource) {
        params.delete('source');
      } else {
        params.set('source', slug);
      }
      const qs = params.toString();
      router.push(qs ? `/?${qs}` : '/');
    },
    [activeSource, router, searchParams]
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
        Sources
      </h3>
      <div className="flex flex-col gap-0.5">
        {/* All sources */}
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('source');
            const qs = params.toString();
            router.push(qs ? `/?${qs}` : '/');
          }}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            !activeSource
              ? 'bg-zinc-800 font-medium text-zinc-200'
              : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${!activeSource ? 'bg-amber-500' : 'bg-zinc-700'}`} />
          All Sources
        </button>

        {SOURCES.map((source) => {
          const isActive = activeSource === source.slug;
          return (
            <button
              key={source.slug}
              onClick={() => selectSource(source.slug)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                isActive
                  ? `bg-zinc-800 font-medium ${source.color}`
                  : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive ? source.dot : 'bg-zinc-700'
                }`}
              />
              {source.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
