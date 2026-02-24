'use client';

import { useState } from 'react';
import Link from 'next/link';

const VIDEO_ID = 'hlS44t0_z0M';
const THUMBNAIL_URL = `https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
const BLOG_URL = 'https://npcomplete777.github.io/o11y-alchemy/posts/ontology-driven-migration/';
const BLOG_TITLE = 'Ontology-Driven Migration: A Framework for Moving Observability Platforms';

const SIDEBAR_CARDS = [
  {
    icon: '🔭',
    title: 'LIVE TELEMETRY',
    description:
      'Real-time traces and metrics from this running application.',
    cta: 'Explore →',
    href: '/telemetry',
    external: false,
  },
  {
    icon: '🤖',
    title: 'VALIS MCP',
    description:
      'AI-native observability tool for Claude — trace analysis, anomaly detection, root cause correlation.',
    cta: 'View on GitHub →',
    href: 'https://github.com/npcomplete777/valis-mcp',
    external: true,
  },
  {
    icon: '⚡',
    title: 'SOURCE CODE',
    description:
      'Full-stack Kubernetes app: Next.js, Spring Boot, OTel Java agent.',
    cta: 'View on GitHub →',
    href: 'https://github.com/npcomplete777/my-news-k8s',
    external: true,
  },
];

const TOPIC_TAGS = [
  'OpenTelemetry',
  'Distributed Tracing',
  'Agentic AI',
  'Kubernetes',
  'MCP',
];

export function HeroFeature() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_300px]">
      {/* Left column — editorial content */}
      <div className="flex flex-col gap-6">
        {/* Category label */}
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
          Observability · Platform Engineering
        </p>

        {/* Headline */}
        <h1 className="font-display font-black uppercase leading-none tracking-tighter text-stone-900 dark:text-zinc-100 text-4xl sm:text-5xl lg:text-6xl">
          HOW TO MIGRATE<br />YOUR OBSERVABILITY<br />PLATFORM
        </h1>

        {/* YouTube video — thumbnail until clicked, then embedded player */}
        <div className="relative aspect-video w-full overflow-hidden bg-stone-900">
          {playing ? (
            <iframe
              src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`}
              title={BLOG_TITLE}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <>
              {/* Thumbnail */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={THUMBNAIL_URL}
                alt={BLOG_TITLE}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`;
                }}
              />

              {/* Dark overlay on hover */}
              <div className="absolute inset-0 bg-black/10 transition-colors hover:bg-black/25" />

              {/* YouTube-style play button */}
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center"
                aria-label="Play video"
              >
                <div className="flex h-16 w-[72px] items-center justify-center rounded-xl bg-[#FF0000] shadow-lg transition-all hover:scale-110 hover:bg-[#cc0000]">
                  <svg
                    className="h-6 w-6 translate-x-0.5 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Blog article link — directly below the video */}
        <a
          href={BLOG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start justify-between gap-4 border-t border-stone-200 pt-4 dark:border-zinc-800"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
              From the blog · O11y Alchemy
            </span>
            <span className="text-sm font-semibold leading-snug text-stone-900 transition-colors group-hover:text-stone-500 dark:text-zinc-100 dark:group-hover:text-zinc-400">
              {BLOG_TITLE}
            </span>
          </div>
          <span className="mt-1 shrink-0 text-xs font-bold uppercase tracking-widest text-stone-400 transition-colors group-hover:text-stone-900 dark:text-zinc-500 dark:group-hover:text-zinc-100">
            Read →
          </span>
        </a>

        {/* Description */}
        <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
          A structured approach to planning and executing observability platform migrations —
          from legacy APM to modern OTLP-native systems. Covers signal taxonomy,
          instrumentation gap analysis, and phased cutover strategies. Built and validated
          using VALIS, an MCP-powered agentic AI tool for Claude.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/telemetry" className="btn-primary">
            Explore Telemetry
          </Link>
          <a
            href={BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            Read the Article
          </a>
        </div>

        {/* Topic tags */}
        <div className="flex flex-wrap gap-2">
          {TOPIC_TAGS.map((tag) => (
            <span key={tag} className="tag-pill text-[11px]">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Right column — sidebar cards */}
      <div className="flex flex-col divide-y divide-stone-200 dark:divide-zinc-800">
        {SIDEBAR_CARDS.map((card) => {
          const inner = (
            <div className="group flex flex-col gap-2 border-t border-stone-200 dark:border-zinc-800 py-5 transition-colors hover:border-stone-900 dark:hover:border-zinc-400 cursor-pointer">
              <span className="text-2xl leading-none" aria-hidden="true">
                {card.icon}
              </span>
              <p className="font-black text-xs uppercase tracking-widest text-stone-900 dark:text-zinc-100">
                {card.title}
              </p>
              <p className="text-xs leading-relaxed text-stone-500 dark:text-zinc-500">
                {card.description}
              </p>
              <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 transition-colors group-hover:text-stone-900 dark:group-hover:text-zinc-100">
                {card.cta}
              </span>
            </div>
          );

          if (card.external) {
            return (
              <a
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {inner}
              </a>
            );
          }

          return (
            <Link key={card.title} href={card.href} className="block">
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
