import Link from 'next/link';

const PIPELINE = [
  {
    label: 'Your Browser',
    detail: 'Every click, scroll, and page load is an event.',
  },
  {
    label: 'OpenTelemetry',
    detail: 'Each event becomes a structured trace with timing and context.',
  },
  {
    label: 'ClickHouse',
    detail: '228 million rows stored. Compressed, indexed, queryable in milliseconds.',
  },
  {
    label: 'This Page',
    detail: 'Live metrics, traces, and logs — anyone can see them on the Telemetry tab.',
  },
];

export function SiteIntro() {
  return (
    <section className="border-b border-stone-200 dark:border-zinc-800 py-10 sm:py-14">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px] lg:gap-16 lg:items-start">

        {/* Left — headline + copy + CTA */}
        <div className="flex flex-col gap-5">

          {/* Live eyebrow */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400 dark:text-zinc-500">
              Live observability laboratory
            </span>
          </div>

          {/* Main headline */}
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-stone-900 dark:text-zinc-100 text-[clamp(2.4rem,5vw,3.5rem)]">
            This site<br />
            observes<br />
            itself.
          </h2>

          {/* Body — plain English, no jargon assumed */}
          <p className="max-w-md text-base leading-relaxed text-stone-600 dark:text-zinc-400">
            Every interaction you make here is captured as a real-time data trace —
            stored, compressed, and made queryable in under a second. The Telemetry
            tab shows you exactly what your visit looks like from the inside.
          </p>

          {/* Supporting detail */}
          <p className="max-w-md text-sm leading-relaxed text-stone-400 dark:text-zinc-600">
            Built with{' '}
            <span className="font-semibold text-stone-600 dark:text-zinc-400">OpenTelemetry</span>
            {' '}(the open standard for application monitoring),{' '}
            <span className="font-semibold text-stone-600 dark:text-zinc-400">ClickHouse</span>
            {' '}(a column-oriented analytics database), and a custom Spring Boot backend
            running inside Kubernetes — all instrumented end-to-end.
          </p>

          {/* CTA row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/telemetry" className="btn-primary">
              See Live Telemetry
            </Link>
            <Link href="/clickhouse" className="btn-outline">
              How the Data Works
            </Link>
          </div>
        </div>

        {/* Right — pipeline timeline */}
        <div className="flex flex-col gap-2">
          <span className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-300 dark:text-zinc-700">
            The data pipeline
          </span>

          {PIPELINE.map((step, i) => (
            <div key={step.label} className="flex gap-4">
              {/* Spine */}
              <div className="flex flex-col items-center">
                <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-colors
                  ${i === 0
                    ? 'border-emerald-500 bg-emerald-500'
                    : i === PIPELINE.length - 1
                    ? 'border-stone-900 bg-stone-900 dark:border-zinc-100 dark:bg-zinc-100'
                    : 'border-stone-400 bg-white dark:border-zinc-500 dark:bg-zinc-950'
                  }`}
                />
                {i < PIPELINE.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-stone-200 dark:bg-zinc-800" style={{ minHeight: 28 }} />
                )}
              </div>

              {/* Text */}
              <div className="pb-5">
                <p className="text-xs font-black uppercase tracking-wide text-stone-900 dark:text-zinc-100 leading-none">
                  {step.label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-400 dark:text-zinc-600">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
