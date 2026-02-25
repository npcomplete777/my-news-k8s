import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — Observing O11y News',
  description: 'About Aaron Jacobs — observability platform engineer and O11y Alchemy author',
};

const skills = [
  'OpenTelemetry', 'Distributed Tracing', 'Metrics & Alerting', 'Log Aggregation',
  'Kubernetes / GKE', 'Helm + ArgoCD', 'Spring Boot', 'Next.js',
  'Dash0', 'Grafana', 'Datadog', 'New Relic',
  'PostgreSQL', 'Java 21', 'TypeScript', 'Docker',
  'OTLP-native migration', 'Observability as Code', 'MCP / Agentic AI',
];

const projects = [
  {
    name: 'Observing O11y News',
    description:
      'This site — a production-grade cloud-native news aggregator deployed on GKE. ' +
      'Demonstrates auto-instrumentation via Dash0 Operator, GitOps via ArgoCD, ' +
      'RSS pollers with Resilience4j circuit breakers, and a live telemetry tab.',
    url: 'https://github.com/npcomplete777/my-news-k8s',
    tags: ['Spring Boot', 'Next.js', 'Dash0', 'GKE', 'ArgoCD'],
  },
  {
    name: 'O11y Alchemy Blog',
    description:
      'Technical writing on observability platform engineering — migrations, signal taxonomy, ' +
      'instrumentation strategy, and OTLP-native architecture patterns.',
    url: 'https://npcomplete777.github.io/o11y-alchemy/',
    tags: ['Technical Writing', 'O11y', 'OTLP', 'Migrations'],
  },
  {
    name: 'Dash0 MCP Server',
    description:
      'Model Context Protocol server for querying Dash0 telemetry from AI assistants. ' +
      'Enables natural-language access to traces, metrics, and logs stored in Dash0.',
    url: 'https://github.com/npcomplete777',
    tags: ['MCP', 'AI Agents', 'Dash0', 'TypeScript'],
  },
  {
    name: 'OTel Receiver Factory',
    description:
      'Utility for composing OpenTelemetry collector receiver pipelines programmatically. ' +
      'Simplifies building custom receivers for non-standard telemetry sources.',
    url: 'https://github.com/npcomplete777',
    tags: ['OpenTelemetry', 'Go', 'Collector'],
  },
];

const expertise = [
  {
    area: 'Platform Migration',
    detail:
      'Ontology-driven framework for migrating observability platforms — from legacy APM to OTLP-native systems. ' +
      'Signal taxonomy mapping, instrumentation gap analysis, phased cutover strategies.',
  },
  {
    area: 'Production Kubernetes',
    detail:
      'GKE workloads with Helm + ArgoCD GitOps, Resilience4j for circuit breakers, ' +
      'Flyway for zero-downtime database migrations, proper startup/liveness/readiness probes.',
  },
  {
    area: 'Auto-Instrumentation',
    detail:
      'Dash0 Operator and OpenTelemetry Java/Node.js agents. ' +
      'Zero-touch instrumentation without modifying application code. ' +
      '@WithSpan for manual trace enrichment where auto-instrumentation falls short.',
  },
  {
    area: 'Agentic AI Integration',
    detail:
      'Model Context Protocol (MCP) server development for exposing observability data ' +
      'to AI assistants. Enables LLMs to reason over traces, metrics, and logs.',
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto flex flex-col gap-10 max-w-3xl px-4 pt-6 pb-20">
      {/* Hero */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-lg font-bold text-white shrink-0">
            AJ
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Aaron Jacobs</h1>
            <p className="text-sm text-zinc-500">Observability Platform Engineer</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-zinc-400 mt-2">
          I build production-grade observability platforms — migrations, instrumentation pipelines,
          and the tooling to make sense of distributed systems at scale. This site is a live demo
          of those skills: a real news aggregator running on GKE, auto-instrumented by the Dash0
          Operator, with every request traced from browser to database.
        </p>
        <div className="flex flex-wrap gap-3 mt-1">
          <a
            href="https://github.com/npcomplete777"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
          <a
            href="https://npcomplete777.github.io/o11y-alchemy/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            O11y Alchemy Blog
          </a>
          <Link
            href="/telemetry"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Telemetry
          </Link>
        </div>
      </div>

      {/* Expertise */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Expertise
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {expertise.map((item) => (
            <div key={item.area} className="card flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-amber-400">{item.area}</h3>
              <p className="text-xs leading-relaxed text-zinc-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Technologies
        </h2>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span key={skill} className="tag-pill text-xs">
              {skill}
            </span>
          ))}
        </div>
      </section>

      {/* Projects */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Projects
        </h2>
        <div className="flex flex-col gap-3">
          {projects.map((project) => (
            <a
              key={project.name}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group card transition-colors hover:border-zinc-700"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200 transition-colors group-hover:text-amber-400">
                    {project.name}
                  </h3>
                  <span className="text-xs text-zinc-700 transition-colors group-hover:text-zinc-500">
                    view →
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-500">{project.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span key={tag} className="tag-pill text-[11px]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* This site */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          About This Site
        </h2>
        <div className="card border-emerald-900/30 bg-gradient-to-br from-emerald-950/20 to-zinc-900/60">
          <p className="text-xs leading-relaxed text-zinc-400">
            Observing O11y News is a production-grade demo application — not a toy. It runs on GKE
            Standard with a real Postgres database, Spring Boot backend, and Next.js frontend. Every
            component is auto-instrumented by the Dash0 Operator: HTTP requests, JDBC queries,
            scheduled pollers, and JVM metrics all produce OTLP telemetry. The{' '}
            <Link href="/telemetry" className="text-emerald-400 hover:text-emerald-300">
              Telemetry tab
            </Link>{' '}
            surfaces this data live. The{' '}
            <Link href="/architecture" className="text-emerald-400 hover:text-emerald-300">
              Architecture page
            </Link>{' '}
            explains how it all fits together.
          </p>
        </div>
      </section>
    </div>
  );
}
