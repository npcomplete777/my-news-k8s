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

const YAML_EXAMPLE = `# valis-dynatrace-tools.yaml
tools:
  enabled:
    - dt_dql_execute
    - dt_documents_list
    - dt_document_get
    - dt_document_create    # write access: enabled for autonomous workflows
    - dt_slos_list
    - dt_slo_evaluate
    - dt_slo_create          # can create SLOs from detected patterns
  disabled:
    - dt_document_delete     # destructive: requires explicit opt-in
    - dt_workflow_delete
    - dt_slo_delete
  contexts:
    investigation:           # read-heavy for initial triage
      - dt_dql_execute
      - dt_documents_list
      - dt_slo_evaluate
    remediation:             # write-enabled for autonomous fixes
      - dt_document_create
      - dt_slo_create
      - dt_workflow_create`;

const ARTICLE_SECTIONS = [
  {
    heading: 'The vendor argument',
    body: `The conventional wisdom — increasingly promoted by vendors like Honeycomb, who shipped a hosted MCP server in 2025 — is straightforward: wait for official servers, use OAuth 2.1, accept curated read-mostly tool surfaces, and let the vendor manage the experience. Their reasoning is sound on its own terms. Vendor-built servers can optimize LLM responses for token efficiency. OAuth provides user-scoped authorization. Curated tool surfaces prevent agents from doing things they shouldn't.

But this argument has a ceiling, and that ceiling is exactly where autonomous observability begins.`,
  },
  {
    heading: 'The ceiling: read-only access can\'t close the loop',
    body: `Honeycomb's MCP server — like nearly every vendor-built MCP server in the observability space — is predominantly read-only. You can query datasets. You can list triggers and SLOs. You can fetch a trace. What you cannot do is create a dashboard from the results of your investigation, configure an alert based on a pattern you just detected, set up an SLO for a service you just discovered is failing, or modify a trigger threshold that's producing false positives.

This is not a criticism of Honeycomb specifically. Dynatrace, Datadog, and New Relic follow the same pattern. Vendors are understandably cautious about giving AI agents write access to production configuration. But caution and autonomy are fundamentally at odds. If the agent can observe but not act, you don't have autonomous observability. You have a chatbot that reads dashboards aloud.

VALIS requires full CRUD access across every platform it touches — not because write access is a nice-to-have, but because the closed loop is the product. Detect an anti-pattern → create a dashboard documenting it → configure an alert for recurrence → generate the fix → deploy it → verify the traces show improvement. Every step in that chain requires write operations that no vendor MCP server provides.`,
  },
  {
    heading: 'Why we don\'t wait',
    body: `There are eight observability platforms in the VALIS architecture: Dynatrace, Datadog, Honeycomb, Grafana, Kibana, Elasticsearch, Dash0, and AppDynamics. No vendor has an incentive to build MCP tooling that integrates with their competitors. Dynatrace will never ship tools that help an AI agent migrate your dashboards to Grafana. Datadog will never expose the APIs needed for an autonomous agent to prove your workload runs 10x cheaper on ClickHouse. Cross-platform orchestration is structurally impossible if you only use vendor-provided servers.

Even within a single platform, vendor timelines don't align with practitioner need. Honeycomb shipped their initial MCP server in late 2024, deprecated the self-hosted version in mid-2025, and launched the hosted replacement as generally available months later. Our Honeycomb server had 54 tools covering full CRUD across datasets, columns, queries, boards, SLOs, triggers, burn alerts, recipients, markers, and service maps — while the official server was still read-only with roughly 10 tools. The gap isn't closing. Vendor roadmaps serve vendor priorities.`,
  },
  {
    heading: 'The design pattern: API tokens, not OAuth',
    body: `Every custom MCP server in the VALIS ecosystem uses a deliberate design pattern: API token authentication, not OAuth.

This is a conscious architectural choice, not a shortcut. OAuth 2.1 is designed for human-initiated, browser-mediated authorization flows. It assumes a user is present to click "Authorize," that sessions expire and require re-authentication, and that the authorization scope is tied to a specific user's permissions at a specific moment. This makes sense when the MCP client is an IDE like Cursor or VS Code, where a developer is sitting at a keyboard.

Autonomous agents don't sit at keyboards. VALIS runs continuous detection loops, orchestrates cross-platform correlations at 3 AM, and chains together tool calls across eight platforms in a single reasoning pass. An OAuth flow that requires browser interaction every 24 hours — which is the current reality for Honeycomb's hosted MCP — is a non-starter for autonomous operation.

API tokens provide exactly what server-to-server autonomous workflows require: stable, long-lived credentials with explicit scope. Every platform in the observability ecosystem supports them. They're configured once per environment and work indefinitely. There's no session expiration mid-investigation, no browser redirect in a headless container, no token refresh race condition during a critical incident response.

The tradeoff is real: API tokens lack per-user attribution and fine-grained session revocation. For a human-in-the-loop IDE integration, OAuth is the correct choice. For an autonomous agent that needs to operate unattended across multiple platforms, API tokens are the only viable authentication model. The architectural context determines the right answer.`,
  },
];

const FINAL_SECTION = {
  heading: 'The real question',
  body: `The debate isn't really about OAuth versus API tokens or hosted versus self-hosted. It's about who controls the agent's capabilities: the vendor, or the operator.

Vendor-built MCP servers are excellent for what they're designed for: giving a developer in an IDE a natural-language interface to a single platform. If that's your use case, use the vendor server. It will be better maintained, better documented, and easier to set up than anything custom.

But if what you're building is an autonomous system that reasons across platforms, takes action based on what it finds, and operates continuously without human intervention — you need full API surface coverage, stable authentication for headless operation, and operator-controlled tool granularity. No vendor will build that for you. Not because they can't, but because it's not in their interest.

We build custom Go MCP servers because the alternative is waiting for a future that vendors have no incentive to deliver.`,
};

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
            Agentic AI · Model Context Protocol
          </p>
          <h1 className="font-display font-black uppercase leading-[0.95] tracking-wide text-stone-900 dark:text-zinc-100 text-5xl sm:text-6xl lg:text-7xl mb-4">
            AI TOOLS
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400 sm:text-base">
            Open-source MCP servers written in Go — giving Claude direct, autonomous access to every
            major observability platform with full CRUD coverage, not curated read-only subsets.
          </p>
        </div>

        {/* Article */}
        <div className="mb-16 grid grid-cols-1 gap-0 lg:grid-cols-[1fr_2fr]">
          {/* Article label / kicker */}
          <div className="lg:pr-12 mb-6 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-600 mb-2">
                Essay
              </p>
              <h2 className="font-display font-black uppercase leading-[0.95] tracking-wide text-stone-900 dark:text-zinc-100 text-2xl sm:text-3xl">
                Why We Build Custom MCP Servers
              </h2>
              <div className="mt-4 h-px bg-stone-200 dark:bg-zinc-800" />
              <p className="mt-4 text-xs text-stone-400 dark:text-zinc-600 leading-relaxed">
                On vendor ceilings, OAuth tradeoffs, and operator-controlled tool granularity in autonomous observability systems.
              </p>
            </div>
          </div>

          {/* Article body */}
          <div className="border-t border-stone-200 dark:border-zinc-800 lg:border-t-0 lg:border-l lg:pl-12 pt-6 lg:pt-0">
            <div className="space-y-8">
              {ARTICLE_SECTIONS.map((section) => (
                <div key={section.heading}>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-3">
                    {section.heading}
                  </h3>
                  <div className="space-y-3">
                    {section.body.split('\n\n').map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed text-stone-700 dark:text-zinc-300">
                        {para}
                      </p>
                    ))}
                  </div>
                </div>
              ))}

              {/* YAML-driven tool control section with code block */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-3">
                  YAML-driven tool control
                </h3>
                <p className="text-sm leading-relaxed text-stone-700 dark:text-zinc-300 mb-3">
                  When you expose full API surfaces via MCP — 96 tools for Dynatrace alone, 54 for
                  Honeycomb, comparable coverage for every other platform — the question becomes: how
                  do you control what an agent can actually use?
                </p>
                <p className="text-sm leading-relaxed text-stone-700 dark:text-zinc-300 mb-3">
                  Honeycomb&apos;s answer is to curate at the server level. They decide which tools
                  exist. We solved this differently. Every VALIS MCP server reads a YAML configuration
                  file that specifies exactly which tools are available for a given deployment context.
                </p>
                <pre className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-[11px] leading-relaxed text-zinc-300 overflow-x-auto font-mono my-4">
                  {YAML_EXAMPLE}
                </pre>
                <p className="text-sm leading-relaxed text-stone-700 dark:text-zinc-300">
                  This gives you something no vendor MCP server offers:{' '}
                  <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                    operator-controlled granularity over tool availability, scoped by workflow context,
                    defined in version-controlled configuration.
                  </strong>{' '}
                  Want read-only mode during a vendor evaluation? Change the YAML. Want write operations
                  only during a maintenance window? Change the YAML. Three environments, three YAML
                  files.
                </p>
              </div>

              {/* Final section */}
              <div className="border-t border-stone-200 dark:border-zinc-800 pt-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-3">
                  {FINAL_SECTION.heading}
                </h3>
                <div className="space-y-3">
                  {FINAL_SECTION.body.split('\n\n').map((para, i) => (
                    <p
                      key={i}
                      className={
                        i === FINAL_SECTION.body.split('\n\n').length - 1
                          ? 'text-sm leading-relaxed text-stone-900 dark:text-zinc-100 font-medium'
                          : 'text-sm leading-relaxed text-stone-700 dark:text-zinc-300'
                      }
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MCP Servers */}
        <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">
              Model Context Protocol
            </p>
            <h2 className="font-display font-black uppercase tracking-wide text-stone-900 dark:text-zinc-100 text-3xl sm:text-4xl">
              MCP Servers
            </h2>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
              9 servers · Written in Go · Full API surface coverage
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-16 sm:grid-cols-2 lg:grid-cols-3">
            {MCP_TOOLS.map((tool) => (
              <ToolCard key={tool.name} {...tool} />
            ))}
          </div>

          <p className="mt-6 text-xs text-stone-400 dark:text-zinc-600">
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

      </div>
    </div>
  );
}
