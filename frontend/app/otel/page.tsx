import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OTel — O11y Alchemy',
  description: 'Custom OpenTelemetry Collector receivers — Airflow, Databricks, Snowflake, CockroachDB, and UniFi network infrastructure.',
};

const OTEL_RECEIVERS = [
  {
    name: 'UniFi Receiver',
    icon: '📡',
    description:
      'VAP-level metrics per access point, SSID, and radio band — scraped from the UniFi Dream Machine API every 30 seconds. Covers tx/rx throughput, packet error and drop rates, connected client counts, CCQ and satisfaction scores, average RSSI, switch port rates, UDM temperature, and WAN latency/availability. Running in production on a Raspberry Pi 5 k3s cluster.',
    href: 'https://github.com/npcomplete777/unifireceiver',
    tags: ['UniFi', 'WiFi', 'Network', 'Dream Machine'],
  },
  {
    name: 'Airflow Receiver',
    icon: '🌊',
    description:
      '70+ metrics covering DAG execution, task durations, pool utilization, and scheduler health. Compatible with MWAA, Cloud Composer, and Astronomer. Exposes Airflow internals as first-class OTel metrics for correlation with downstream pipeline spans.',
    href: 'https://github.com/npcomplete777/airflowreceiver',
    tags: ['Python', 'DAGs', 'MWAA', 'Cloud Composer'],
  },
  {
    name: 'Databricks Receiver',
    icon: '⚡',
    description:
      '21 metrics across job execution, SQL warehouse performance, workspace storage, and cluster utilization. Bridges Databricks operational telemetry into the OTel ecosystem, enabling unified observability across data engineering and application layers.',
    href: 'https://github.com/npcomplete777/databricksreceiver',
    tags: ['Spark', 'SQL Warehouses', 'Jobs API', 'Clusters'],
  },
  {
    name: 'Snowflake Receiver',
    icon: '❄️',
    description:
      '300+ metrics spanning query performance, warehouse utilization, credit consumption, storage growth, and data pipeline health. Full visibility into Snowflake cost and performance from within your existing OTel collector pipeline.',
    href: 'https://github.com/npcomplete777/snowflakereceiver',
    tags: ['Warehouses', 'Credits', 'Queries', 'Storage'],
  },
  {
    name: 'CockroachDB Receiver',
    icon: '🪳',
    description:
      "SQL execution stats, transaction contention, index usage, and node health metrics. Alpha-stage receiver designed for CockroachDB's distributed architecture, surfacing database internals as OTel metrics alongside application traces.",
    href: 'https://github.com/npcomplete777/cockroachdbreceiver',
    tags: ['Distributed SQL', 'Transactions', 'Nodes', 'Alpha'],
  },
];

function ReceiverCard({
  name, icon, description, href, tags,
}: {
  name: string; icon: string; description: string; href: string; tags: string[];
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-4 rounded-lg border border-stone-200 dark:border-zinc-800 p-6 transition-colors hover:border-stone-400 dark:hover:border-zinc-600 hover:bg-stone-50 dark:hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none shrink-0" aria-hidden="true">{icon}</span>
          <span className="font-black text-sm uppercase tracking-widest text-stone-900 dark:text-zinc-100">
            {name}
          </span>
        </div>
        <svg
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-300 transition-colors group-hover:text-stone-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
      <p className="text-xs leading-relaxed text-stone-500 dark:text-zinc-500">{description}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {tags.map(tag => (
          <span key={tag} className="tag-pill text-[10px]">{tag}</span>
        ))}
      </div>
    </a>
  );
}

export default function OtelPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8">

        {/* Header */}
        <div className="mb-12 border-t-2 border-stone-900 pt-6 dark:border-zinc-100">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-2">
            OpenTelemetry Collector · Custom Receivers
          </p>
          <h1 className="font-display font-black uppercase leading-[0.95] tracking-wide text-stone-900 dark:text-zinc-100 text-5xl sm:text-6xl lg:text-7xl mb-4">
            OTEL
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
            Custom OpenTelemetry Collector receivers for first-party data sources. Drop these into
            any collector pipeline to bring UniFi network infrastructure, Airflow, Databricks,
            Snowflake, and CockroachDB metrics alongside your application traces and logs.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Add to collector',
              body: 'Drop the receiver binary into your OTel collector distribution or use a custom build. Configure in your existing collector YAML.',
            },
            {
              step: '02',
              title: 'Metrics flow in',
              body: 'Receivers poll the source API on a configurable interval and emit metrics in OTLP format through your existing exporter pipeline.',
            },
            {
              step: '03',
              title: 'Correlate with traces',
              body: 'First-party metrics land in the same backend as your application traces. Correlate Airflow DAG failures with downstream service degradation.',
            },
          ].map(item => (
            <div key={item.step} className="flex flex-col gap-2">
              <span className="font-display font-black text-4xl text-stone-100 dark:text-zinc-800 leading-none">
                {item.step}
              </span>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-zinc-100">
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed text-stone-500 dark:text-zinc-500">{item.body}</p>
            </div>
          ))}
        </div>

        {/* Receivers grid */}
        <div className="border-t border-stone-200 dark:border-zinc-800 pt-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">
              Available Receivers
            </p>
            <p className="text-xs text-stone-400 dark:text-zinc-600">
              5 receivers · Plug-in to any OTel Collector pipeline · Written in Go
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {OTEL_RECEIVERS.map(receiver => (
              <ReceiverCard key={receiver.name} {...receiver} />
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-10 border-t border-stone-100 dark:border-zinc-900 pt-6">
          <p className="text-xs text-stone-400 dark:text-zinc-600 max-w-xl">
            All receivers follow the{' '}
            <a
              href="https://opentelemetry.io/docs/collector/building/receiver/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors"
            >
              OTel Collector receiver interface
            </a>
            . Configure in your existing collector YAML — no custom builds required for standard deployments.
          </p>
        </div>

      </div>
    </div>
  );
}
