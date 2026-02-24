'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Slide {
  videoId: string;
  blogUrl: string;
  blogSource: string;
  blogTitle: string;
  blogBlurb: string;
  category: string;
  headline: string[];
  tags: string[];
}

// TODO: Replace placeholder slides (index 1, 2) with real video IDs and blog posts
const SLIDES: Slide[] = [
  {
    videoId: 'hlS44t0_z0M',
    blogUrl: 'https://npcomplete777.github.io/o11y-alchemy/posts/ontology-driven-migration/',
    blogSource: 'O11y Alchemy',
    blogTitle: 'Ontology-Driven Migration: A Framework for Moving Observability Platforms',
    blogBlurb:
      'A structured approach to planning and executing observability platform migrations — from legacy APM to modern OTLP-native systems. Covers signal taxonomy, instrumentation gap analysis, and phased cutover strategies. Built and validated using VALIS, an MCP-powered agentic AI tool for Claude.',
    category: 'Observability · Platform Engineering',
    headline: ['HOW TO MIGRATE', 'YOUR OBSERVABILITY', 'PLATFORM'],
    tags: ['OpenTelemetry', 'Distributed Tracing', 'Platform Migration'],
  },
  {
    // TODO: Replace with real video ID for VALIS MCP deep-dive
    videoId: 'hlS44t0_z0M',
    blogUrl: 'https://npcomplete777.github.io/o11y-alchemy/',
    blogSource: 'O11y Alchemy',
    // TODO: Replace with real blog post title and URL
    blogTitle: 'VALIS: Building an AI-Native Observability Tool for Claude',
    blogBlurb:
      'How I built VALIS — an MCP server that gives Claude direct access to distributed traces, metrics, and logs. Covers the Model Context Protocol, ClickHouse as a trace store, and the agentic patterns that make root-cause analysis feel like a conversation.',
    category: 'Agentic AI · MCP',
    headline: ['VALIS:', 'AI-NATIVE', 'OBSERVABILITY'],
    tags: ['MCP', 'Agentic AI', 'Claude'],
  },
  {
    // TODO: Replace with real video ID for OTel Kubernetes episode
    videoId: 'hlS44t0_z0M',
    blogUrl: 'https://npcomplete777.github.io/o11y-alchemy/',
    blogSource: 'O11y Alchemy',
    // TODO: Replace with real blog post title and URL
    blogTitle: 'OpenTelemetry in Production Kubernetes: Zero to Distributed Tracing',
    blogBlurb:
      'A practical walkthrough of instrumenting Spring Boot microservices with the OpenTelemetry Java agent on GKE — from configuring the OTel Collector and Jaeger to writing PromQL queries against real trace-derived metrics.',
    category: 'OpenTelemetry · Kubernetes',
    headline: ['OPENTELEMETRY', 'IN PRODUCTION', 'KUBERNETES'],
    tags: ['OpenTelemetry', 'Kubernetes', 'Java'],
  },
];

const SIDEBAR_CARDS = [
  {
    icon: '🔭',
    title: 'LIVE TELEMETRY',
    description: 'Real-time traces and metrics from this running application.',
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
    description: 'Full-stack Kubernetes app: Next.js, Spring Boot, OTel Java agent.',
    cta: 'View on GitHub →',
    href: 'https://github.com/npcomplete777/my-news-k8s',
    external: true,
  },
];

const INTERVAL_MS = 5000;

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const advance = useCallback((dir: number) => {
    setCurrent((c) => (c + dir + SLIDES.length) % SLIDES.length);
    setPlaying(false);
    setProgressKey((k) => k + 1);
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    setPlaying(false);
    setProgressKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (paused || playing) return;
    timerRef.current = setTimeout(() => advance(1), INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, paused, playing, progressKey, advance]);

  const slide = SLIDES[current];
  const thumbnailUrl = `https://img.youtube.com/vi/${slide.videoId}/maxresdefault.jpg`;

  return (
    <section
      className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_300px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left column — editorial content */}
      <div className="flex flex-col gap-6">
        {/* Progress indicators */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="relative h-0.5 flex-1 overflow-hidden bg-stone-200 dark:bg-zinc-800"
              aria-label={`Go to slide ${i + 1}`}
            >
              {i < current && (
                <span className="absolute inset-0 bg-stone-900 dark:bg-zinc-100" />
              )}
              {i === current && (
                <span
                  key={progressKey}
                  className="absolute inset-y-0 left-0 bg-stone-900 dark:bg-zinc-100"
                  style={{
                    animation: `slideProgress ${INTERVAL_MS}ms linear forwards`,
                    animationPlayState: paused || playing ? 'paused' : 'running',
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Category label */}
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
          {slide.category}
        </p>

        {/* Headline */}
        <h1 className="font-display font-black uppercase leading-none tracking-tighter text-stone-900 dark:text-zinc-100 text-4xl sm:text-5xl lg:text-6xl">
          {slide.headline.map((line, i) => (
            <span key={i}>
              {line}
              {i < slide.headline.length - 1 && <br />}
            </span>
          ))}
        </h1>

        {/* Video — thumbnail until clicked, then embedded player */}
        <div className="relative aspect-video w-full overflow-hidden bg-stone-900">
          {playing ? (
            <iframe
              src={`https://www.youtube.com/embed/${slide.videoId}?autoplay=1`}
              title={slide.blogTitle}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt={slide.blogTitle}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${slide.videoId}/hqdefault.jpg`;
                }}
              />

              <div className="absolute inset-0 bg-black/10 transition-colors hover:bg-black/25" />

              {/* Play button */}
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

              {/* Prev arrow */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  advance(-1);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                aria-label="Previous slide"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Next arrow */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  advance(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                aria-label="Next slide"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Blog article link */}
        <a
          href={slide.blogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start justify-between gap-4 border-t border-stone-200 pt-4 dark:border-zinc-800"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
              From the blog · {slide.blogSource}
            </span>
            <span className="text-sm font-semibold leading-snug text-stone-900 transition-colors group-hover:text-stone-500 dark:text-zinc-100 dark:group-hover:text-zinc-400">
              {slide.blogTitle}
            </span>
          </div>
          <span className="mt-1 shrink-0 text-xs font-bold uppercase tracking-widest text-stone-400 transition-colors group-hover:text-stone-900 dark:text-zinc-500 dark:group-hover:text-zinc-100">
            Read →
          </span>
        </a>

        {/* Description */}
        <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
          {slide.blogBlurb}
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/telemetry" className="btn-primary">
            Explore Telemetry
          </Link>
          <a
            href={slide.blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            Read the Article
          </a>
        </div>

        {/* Topic tags */}
        <div className="flex flex-wrap gap-2">
          {slide.tags.map((tag) => (
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
              <a key={card.title} href={card.href} target="_blank" rel="noopener noreferrer" className="block">
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
