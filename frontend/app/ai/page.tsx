const MCP_TOOLS = [
  {
    name: 'VALIS MCP',
    icon: '🤖',
    description:
      'AI-native observability for Claude. Autonomous anti-pattern detection using Bayesian trace topology analysis — N+1 queries, retry storms, sync-over-async, and more. Correlates spans to source code, runs statistical process control, and closes the remediation loop via GitOps.',
    href: 'https://github.com/npcomplete777/valis-mcp',
  },
  {
    name: 'Kibana MCP',
    icon: '🔍',
    description:
      'Full-surface MCP server for Kibana. 38 tools across 7 domains: dashboards, alerts, saved objects, Lens visualizations, data views, KQL query execution, and index pattern management. Enables autonomous dashboard migration and full operational control from Claude.',
    href: 'https://github.com/npcomplete777/Kibana-mcp',
  },
  {
    name: 'Elasticsearch MCP',
    icon: '🔎',
    description:
      'MCP server for Elasticsearch. Index management, document search and retrieval, cluster health monitoring, aggregation queries, and mapping inspection. Enables AI agents to query and analyze Elasticsearch data directly.',
    href: 'https://github.com/npcomplete777/ElasticSearch-mcp',
  },
  {
    name: 'Dash0 MCP',
    icon: '📡',
    description:
      'MCP server for Dash0. Spans, logs, and metrics querying via OTLP-native APIs, dashboard creation (Perses CRDs), check rule management, synthetic monitoring, and alert configuration. Built and validated through real multi-platform migration work.',
    href: 'https://github.com/npcomplete777/Dash0-mcp',
  },
  {
    name: 'Grafana MCP',
    icon: '📈',
    description:
      'MCP server for Grafana. Dashboard creation and management, PromQL and Loki query execution, alert rule configuration, datasource management, and folder organization. Supports the full Grafana API surface for autonomous observability operations.',
    href: 'https://github.com/npcomplete777/Grafana-mcp',
  },
  {
    name: 'Dynatrace Classic MCP',
    icon: '🦋',
    description:
      'MCP server for Dynatrace Classic (SaaS/Managed). Entity queries, problem management, metrics v2, USQL queries, Davis AI event feed, synthetic monitoring, and custom device integration. Full operational coverage of the Dynatrace Classic API.',
    href: 'https://github.com/npcomplete777/Dynatrace-classic-v2-mcp',
  },
  {
    name: 'Dynatrace Platform MCP',
    icon: '🦋',
    description:
      'MCP server for Dynatrace Platform (Grail). DQL query execution, log analytics, business event querying, segment management, and platform-native APIs. Built for the next-generation Dynatrace data lakehouse architecture.',
    href: 'https://github.com/npcomplete777/Dynatrace-platform-mcp',
  },
  {
    name: 'Datadog MCP',
    icon: '🐶',
    description:
      'MCP server for Datadog. Metrics queries, log search, APM trace retrieval, monitor management, dashboard operations, and incident management. Enables AI-driven observability workflows across the full Datadog platform.',
    href: 'https://github.com/npcomplete777/Datadog-mcp',
  },
  {
    name: 'AppDynamics MCP',
    icon: '⚙️',
    description:
      'MCP server for AppDynamics. Application performance monitoring, business transaction analysis, baseline comparison, anomaly detection, and tier/node health inspection. Bridges AppDynamics APM data into AI-native observability workflows.',
    href: 'https://github.com/npcomplete777/AppD-mcp',
  },
];

const OTEL_RECEIVERS = [
  {
    name: 'Airflow Receiver',
    icon: '🌊',
    description:
      '70+ metrics covering DAG execution, task durations, pool utilization, and scheduler health. Compatible with MWAA, Cloud Composer, and Astronomer. Exposes Airflow internals as first-class OTel metrics for correlation with downstream pipeline spans.',
    href: 'https://github.com/npcomplete777/airflowreceiver',
  },
  {
    name: 'Databricks Receiver',
    icon: '⚡',
    description:
      '21 metrics across job execution, SQL warehouse performance, workspace storage, and cluster utilization. Bridges Databricks operational telemetry into the OTel ecosystem, enabling unified observability across data engineering and application layers.',
    href: 'https://github.com/npcomplete777/databricksreceiver',
  },
  {
    name: 'Snowflake Receiver',
    icon: '❄️',
    description:
      '300+ metrics spanning query performance, warehouse utilization, credit consumption, storage growth, and data pipeline health. Full visibility into Snowflake cost and performance from within your existing OTel collector pipeline.',
    href: 'https://github.com/npcomplete777/snowflakereceiver',
  },
  {
    name: 'CockroachDB Receiver',
    icon: '🪳',
    description:
      'SQL execution stats, transaction contention, index usage, and node health metrics. Alpha-stage receiver designed for CockroachDB\'s distributed architecture, surfacing database internals as OTel metrics alongside application traces.',
    href: 'https://github.com/npcomplete777/cockroachdbreceiver',
  },
];

function ToolCard({ name, icon, description, href }: { name: string; icon: string; description: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 border-b border-stone-100 dark:border-zinc-800 py-5 transition-colors hover:bg-stone-50 dark:hover:bg-zinc-900 px-4 -mx-4"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none shrink-0" aria-hidden="true">{icon}</span>
        <span className="font-black text-xs uppercase tracking-widest text-stone-900 dark:text-zinc-100">
          {name}
        </span>
        <svg
          className="ml-auto h-3.5 w-3.5 shrink-0 text-stone-300 transition-colors group-hover:text-stone-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
      <p className="text-xs leading-relaxed text-stone-500 dark:text-zinc-500">
        {description}
      </p>
    </a>
  );
}

export default function AIPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        {/* Header */}
        <div className="mb-10 border-t-2 border-stone-900 pt-6 dark:border-zinc-100">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-2">
            Agentic AI · Model Context Protocol · OpenTelemetry
          </p>
          <h1 className="font-display font-black uppercase leading-[0.95] tracking-wide text-stone-900 dark:text-zinc-100 text-5xl sm:text-6xl lg:text-7xl mb-4">
            AI TOOLS
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
            Open-source MCP servers written in Go — giving Claude direct, autonomous access to every
            major observability platform. Plus custom OpenTelemetry receivers that bring first-party
            data sources into the OTel ecosystem.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">

          {/* Left: MCP Servers */}
          <div>
            <div className="mb-6 border-t border-stone-900 dark:border-zinc-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">
                Model Context Protocol
              </p>
              <h2 className="font-black uppercase tracking-wide text-stone-900 dark:text-zinc-100 text-xl">
                MCP Servers
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                9 servers · Written in Go · Full API surface coverage
              </p>
            </div>
            <div>
              {MCP_TOOLS.map((tool) => (
                <ToolCard key={tool.name} {...tool} />
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-400 dark:text-zinc-600">
              All servers use the{' '}
              <a
                href="https://github.com/mark3labs/mcp-go"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors"
              >
                mcp-go
              </a>{' '}
              framework and expose complete API coverage — not curated subsets.
            </p>
          </div>

          {/* Right: OTel Receivers */}
          <div>
            <div className="mb-6 border-t border-stone-900 dark:border-zinc-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">
                OpenTelemetry Collector
              </p>
              <h2 className="font-black uppercase tracking-wide text-stone-900 dark:text-zinc-100 text-xl">
                Custom Receivers
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                4 receivers · Plug-in to any OTel Collector pipeline
              </p>
            </div>
            <div>
              {OTEL_RECEIVERS.map((receiver) => (
                <ToolCard key={receiver.name} {...receiver} />
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-400 dark:text-zinc-600">
              Drop-in receivers for the{' '}
              <a
                href="https://opentelemetry.io/docs/collector/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors"
              >
                OpenTelemetry Collector
              </a>
              . Configure in your existing collector YAML — no custom builds required.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
