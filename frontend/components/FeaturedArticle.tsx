import Link from 'next/link';

interface FeaturedPost {
  title: string;
  description: string;
  url: string;
  author: string;
  authorUrl: string;
  tag: string;
  imageUrl?: string;
}

const FEATURED_POSTS: FeaturedPost[] = [
  {
    title: 'Ontology-Driven Migration: A Framework for Moving Observability Platforms',
    description:
      'A structured approach to planning and executing observability platform migrations — from legacy APM to modern OTLP-native systems. Covers signal taxonomy, instrumentation gap analysis, and phased cutover strategies.',
    url: 'https://npcomplete777.github.io/o11y-alchemy/posts/ontology-driven-migration/',
    author: 'Aaron Jacobs',
    authorUrl: 'https://npcomplete777.github.io/o11y-alchemy/',
    tag: 'O11y Alchemy',
  },
];

export function FeaturedArticle() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-zinc-800" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          From the blog
        </h2>
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <div className="flex flex-col gap-3">
        {FEATURED_POSTS.map((post) => (
          <a
            key={post.url}
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group card border-amber-900/30 bg-gradient-to-br from-amber-950/20 to-zinc-900/60 transition-colors hover:border-amber-700/50"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="badge bg-amber-900/40 text-amber-400 text-[11px]">
                  {post.tag}
                </span>
                <span className="text-[11px] text-zinc-600">featured</span>
              </div>

              <h3 className="text-sm font-semibold leading-snug text-zinc-200 transition-colors group-hover:text-amber-400">
                {post.title}
              </h3>

              <p className="text-xs leading-relaxed text-zinc-500">
                {post.description}
              </p>

              <div className="flex items-center gap-1 text-xs text-zinc-600">
                <span>by</span>
                <span className="text-zinc-400">{post.author}</span>
                <span className="ml-auto text-amber-600/60 transition-colors group-hover:text-amber-500">
                  read →
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
