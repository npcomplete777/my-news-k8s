const MCP_TOOLS = [
  {
    name: 'VALIS MCP',
    icon: '🤖',
    description:
      'AI-native observability for Claude. Autonomous anti-pattern detection using Bayesian trace topology analysis — N+1 queries, retry storms, sync-over-async, and more. Correlates spans to source code, runs statistical process control, and closes the remediation loop via GitOps.',
    tags: ['Anti-Pattern Detection', 'Bayesian Inference', 'Trace Topology', 'Autonomous Remediation'],
    href: 'https://github.com/npcomplete777/valis-mcp',
  },
  {
    name: 'Kibana MCP',
    icon: '🔍',
    description:
      'Full-surface MCP server for Kibana. 38 tools across 7 domains: dashboards, alerts, saved objects, Lens visualizations, data views, KQL query execution, and index pattern management. Enables autonomous dashboard migration and full operational control from Claude.',
    tags: ['Kibana', 'Dashboards', 'KQL', 'Lens'],
    href: 'https://github.com/npcomplete777/Kibana-mcp',
  },
  {
    name: 'Elasticsearch MCP',
    icon: '🔎',
    description:
      'MCP server for Elasticsearch. Index management, document search and retrieval, cluster health monitoring, aggregation queries, and mapping inspection. Enables AI agents to query and analyze Elasticsearch data directly.',
    tags: ['Elasticsearch', 'Search', 'Aggregations', 'Cluster Health'],
    href: 'https://github.com/npcomplete777/ElasticSearch-mcp',
  },
  {
    name: 'Dash0 MCP',
    icon: '📡',
    description:
      'MCP server for Dash0. Spans, logs, and metrics querying via OTLP-native APIs, dashboard creation (Perses CRDs), check rule management, synthetic monitoring, and alert configuration. Built and validated through real multi-platform migration work.',
    tags: ['Dash0', 'OpenTelemetry', 'Perses', 'Check Rules'],
    href: 'https://github.com/npcomplete777/Dash0-mcp',
  },
  {
    name: 'Grafana MCP',
    icon: '📈',
    description:
      'MCP server for Grafana. Dashboard creation and management, PromQL and Loki query execution, alert rule configuration, datasource management, and folder organization. Supports the full Grafana API surface for autonomous observability operations.',
    tags: ['Grafana', 'PromQL', 'Loki', 'Alerting'],
    href: 'https://github.com/npcomplete777/Grafana-mcp',
  },
  {
    name: 'Dynatrace Classic MCP',
    icon: '🦋',
    description:
      'MCP server for Dynatrace Classic (SaaS/Managed). Entity queries, problem management, metrics v2, USQL queries, Davis AI event feed, synthetic monitoring, and custom device integration. Full operational coverage of the Dynatrace Classic API.',
    tags: ['Dynatrace', 'Davis AI', 'USQL', 'Entities'],
    href: 'https://github.com/npcomplete777/Dynatrace-classic-v2-mcp',
  },
  {
    name: 'Dynatrace Platform MCP',
    icon: '🦋',
    description:
      'MCP server for Dynatrace Platform (Grail). DQL query execution, log analytics, business event querying, segment management, and platform-native APIs. Built for the next-generation Dynatrace data lakehouse architecture.',
    tags: ['Dynatrace', 'DQL', 'Grail', 'Business Events'],
    href: 'https://github.com/npcomplete777/Dynatrace-platform-mcp',
  },
  {
    name: 'Datadog MCP',
    icon: '🐶',
    description:
      'MCP server for Datadog. Metrics queries, log search, APM trace retrieval, monitor management, dashboard operations, and incident management. Enables AI-driven observability workflows across the full Datadog platform.',
    tags: ['Datadog', 'APM', 'Monitors', 'Metrics'],
    href: 'https://github.com/npcomplete777/Datadog-mcp',
  },
  {
    name: 'AppDynamics MCP',
    icon: '⚙️',
    description:
      'MCP server for AppDynamics. Application performance monitoring, business transaction analysis, baseline comparison, anomaly detection, and tier/node health inspection. Bridges AppDynamics APM data into AI-native observability workflows.',
    tags: ['AppDynamics', 'APM', 'Business Transactions', 'Baselines'],
    href: 'https://github.com/npcomplete777/AppD-mcp',
  },
];

export default function AIPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        {/* Header */}
        <div className="mb-10 border-t-2 border-stone-900 pt-6 dark:border-zinc-100">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-2">
            Agentic AI · Model Context Protocol
          </p>
          <h1 className="font-display font-black uppercase leading-[0.95] tracking-wide text-stone-900 dark:text-zinc-100 text-5xl sm:text-6xl lg:text-7xl mb-4">
            AI TOOLS
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
            A suite of open-source MCP (Model Context Protocol) servers written in Go — giving Claude
            direct, autonomous access to every major observability platform. Each server exposes the
            full API surface of its platform as composable tools an AI agent can orchestrate at runtime.
          </p>
        </div>

        {/* MCP grid */}
        <div className="grid grid-cols-1 gap-px bg-stone-200 dark:bg-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
          {MCP_TOOLS.map((tool) => (
            <a
              key={tool.name}
              href={tool.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-4 bg-white p-6 transition-colors hover:bg-stone-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-3xl leading-none" aria-hidden="true">{tool.icon}</span>
                <svg
                  className="mt-1 h-4 w-4 shrink-0 text-stone-300 transition-colors group-hover:text-stone-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="font-black text-xs uppercase tracking-widest text-stone-900 dark:text-zinc-100">
                  {tool.name}
                </h2>
                <p className="text-xs leading-relaxed text-stone-500 dark:text-zinc-500">
                  {tool.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-auto">
                {tool.tags.map((tag) => (
                  <span key={tag} className="tag-pill text-[10px] py-0.5 px-2">
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-8 text-xs text-stone-400 dark:text-zinc-600">
          All tools are open source and written in Go using the{' '}
          <a
            href="https://github.com/mark3labs/mcp-go"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors"
          >
            mcp-go
          </a>{' '}
          framework. Each server exposes complete API coverage — not curated subsets — enabling
          autonomous AI agents to operate observability platforms end-to-end.
        </p>
      </div>
    </div>
  );
}
