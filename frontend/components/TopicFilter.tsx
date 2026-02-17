'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const POPULAR_TOPICS = [
  'kubernetes',
  'docker',
  'observability',
  'platform-engineering',
  'go',
  'rust',
  'ai',
  'security',
  'gitops',
  'service-mesh',
  'wasm',
  'devops',
];

export function TopicFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get('tag') ?? '';

  const selectTag = useCallback(
    (tag: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tag === activeTag) {
        params.delete('tag');
      } else {
        params.set('tag', tag);
      }
      const qs = params.toString();
      router.push(qs ? `/?${qs}` : '/');
    },
    [activeTag, router, searchParams]
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
        Topics
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_TOPICS.map((topic) => {
          const isActive = activeTag === topic;
          return (
            <button
              key={topic}
              onClick={() => selectTag(topic)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-amber-600/20 text-amber-400 ring-1 ring-amber-600/30'
                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-400'
              }`}
            >
              {topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}
