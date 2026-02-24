import Link from 'next/link';

const TOPIC_TAGS = [
  'OpenTelemetry',
  'Distributed Tracing',
  'Agentic AI',
  'Kubernetes',
  'MCP',
];

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

const VALIS_OUTPUT_LINES = [
  { color: 'text-stone-500', text: '$ valis analyze --trace-id 4f2a8c1e...' },
  { color: 'text-emerald-400', text: '✓ Loaded 847 spans across 12 services' },
  { color: 'text-stone-400', text: '' },
  { color: 'text-amber-400', text: '⚠ ANOMALY DETECTED — order-service' },
  { color: 'text-stone-400', text: '  p99 latency: 2,847ms  (+340% vs baseline)' },
  { color: 'text-stone-400', text: '  error rate:  43.5%    (baseline: 0.2%)' },
  { color: 'text-stone-400', text: '' },
  { color: 'text-sky-400', text: '↳ Root cause: ProcessPayment → ArrangeShipping' },
  { color: 'text-stone-400', text: '  cascade failure on payment-svc timeout' },
  { color: 'text-stone-400', text: '  first failure: 14:22:07.441 UTC' },
  { color: 'text-stone-400', text: '' },
  { color: 'text-emerald-400', text: '✓ Baseline updated — 22 services calibrated' },
  { color: 'text-stone-500', text: '  next analysis window: 5m' },
];

export function HeroFeature() {
  return (
    <section className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_300px]">
      {/* Left column — editorial content */}
      <div className="flex flex-col gap-6">
        {/* Category label */}
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
          Agentic AI · Observability
        </p>

        {/* Headline */}
        <h1 className="font-display font-black uppercase leading-none tracking-tighter text-stone-900 dark:text-zinc-100 text-4xl sm:text-5xl lg:text-6xl">
          WHAT IS THE{'\n'}SELF-OBSERVING{'\n'}SYSTEM?
        </h1>

        {/* Video / terminal placeholder */}
        <div className="relative aspect-video w-full overflow-hidden bg-stone-900">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-zinc-900" />

          {/* Dot grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* VALIS terminal output */}
          <div className="absolute inset-0 flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10">
            <pre className="w-full max-w-xl overflow-hidden font-mono text-[11px] leading-relaxed sm:text-xs">
              {VALIS_OUTPUT_LINES.map((line, i) => (
                <div key={i} className={line.color}>
                  {line.text || '\u00A0'}
                </div>
              ))}
            </pre>
          </div>

          {/* Play button */}
          <div className="absolute inset-0 flex items-end justify-end p-4">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              aria-label="Play demo"
            >
              <svg
                className="h-4 w-4 translate-x-px"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
          O11y Alchemy is a live demonstration of agentic AI observability. VALIS — an
          MCP-native tool for Claude — continuously analyzes distributed traces, detects
          anomalies against learned baselines, and performs root cause correlation across
          a real Kubernetes cluster running OpenTelemetry instrumentation.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/telemetry" className="btn-primary">
            Explore Telemetry
          </Link>
          <a
            href="https://npcomplete777.github.io/o11y-alchemy/"
            className="btn-outline"
          >
            Read the Blog
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
