'use client';

import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueryResult {
  columns: string[];
  rows: (string | number)[][];
  rows_read: number;
  bytes_read: number;
  elapsed_ms: number;
  sql: string;
  error?: string;
}

interface BenchmarkResult {
  old: QueryResult | null;
  new: QueryResult | null;
}

// ─── Query catalogue ──────────────────────────────────────────────────────────

const QUERIES = [
  {
    id: 'benchmark',
    label: 'Schema Benchmark',
    icon: '⚡',
    description: 'Runs the same GROUP BY on both schemas simultaneously. Old: Map column scan. New: extracted top-level column. Watch the bytes_read gap.',
    category: 'PERFORMANCE',
    isBenchmark: true,
  },
  {
    id: 'red-metrics',
    label: 'RED Metrics',
    icon: '📊',
    description: 'Queries the AggregatingMergeTree rollup table — pre-aggregated request rate, error rate, and latency percentiles. No raw span scan.',
    category: 'AGGREGATION',
    isBenchmark: false,
  },
  {
    id: 'extracted',
    label: 'Extracted Columns',
    icon: '🔍',
    description: 'Live spans from the new schema with top-level K8s, HTTP, and status columns — no Map access, no type casting.',
    category: 'SCHEMA',
    isBenchmark: false,
  },
  {
    id: 'errors',
    label: 'Error Analysis',
    icon: '🚨',
    description: 'Error spans grouped by service + operation with HTTP status codes and sample messages — all from extracted columns, zero Map lookups.',
    category: 'OBSERVABILITY',
    isBenchmark: false,
  },
  {
    id: 'storage',
    label: 'Storage Ratios',
    icon: '💾',
    description: 'ClickHouse system.parts meta-query. Compare disk footprint, compression ratio, and row counts across old and new tables.',
    category: 'META',
    isBenchmark: false,
  },
] as const;

type QueryId = (typeof QUERIES)[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtRows(n: number): string {
  return n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  label, value, highlight,
}: { label: string; value: string; highlight?: 'green' | 'red' | 'amber' | 'default' }) {
  const colors = {
    green: 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40',
    red: 'text-red-400 bg-red-950/30 border-red-800/40',
    amber: 'text-amber-400 bg-amber-950/30 border-amber-800/40',
    default: 'text-zinc-300 bg-zinc-800/60 border-zinc-700/40',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs ${colors[highlight ?? 'default']}`}>
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}

function SqlDisplay({ sql }: { sql: string }) {
  const lines = sql.trim().split('\n');
  const keywords = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|INNER|LEFT|ON|AND|OR|NOT|IN|AS|INTERVAL|round|count|avg|min|max|sum|quantilesMerge|quantilesState|formatReadableSize|formatDateTime|greatest|WITH|HAVING|UNION|INSERT|INTO|CREATE|TABLE|VIEW|MATERIALIZED|ENGINE|PARTITION BY|TTL|SETTINGS|IF NOT EXISTS|IF EXISTS|CODEC|DEFAULT|INDEX|TYPE|GRANULARITY)\b/g;
  const functions = /\b(toDate|toDateTime|toUnixTimestamp|now|greatest|round|formatReadableSize|formatDateTime|quantilesMerge|quantilesState|countIf)\b/g;

  function colorize(line: string) {
    // very simple colorize — just wrap keywords
    const parts: { text: string; type: 'keyword' | 'string' | 'comment' | 'plain' }[] = [];
    if (line.trimStart().startsWith('--')) {
      parts.push({ text: line, type: 'comment' });
      return parts;
    }
    let rest = line;
    while (rest.length > 0) {
      const kwMatch = rest.match(keywords);
      if (!kwMatch) { parts.push({ text: rest, type: 'plain' }); break; }
      const idx = rest.search(keywords);
      if (idx > 0) parts.push({ text: rest.slice(0, idx), type: 'plain' });
      parts.push({ text: kwMatch[0], type: 'keyword' });
      rest = rest.slice(idx + kwMatch[0].length);
    }
    return parts;
  }

  return (
    <div className="overflow-x-auto">
      <pre className="text-xs font-mono leading-[1.7] text-zinc-300 whitespace-pre">
        {lines.map((line, i) => {
          const isComment = line.trimStart().startsWith('--');
          return (
            <div key={i} className="flex">
              <span className="select-none w-7 shrink-0 text-right text-zinc-700 mr-3 text-[10px] leading-[1.7]">
                {i + 1}
              </span>
              {isComment ? (
                <span className="text-zinc-600 italic">{line}</span>
              ) : (
                <span
                  dangerouslySetInnerHTML={{
                    __html: line
                      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                      .replace(
                        /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|AS|AND|OR|IN|INTERVAL|WITH|HAVING)\b/g,
                        '<span class="text-blue-400 font-semibold">$1</span>',
                      )
                      .replace(
                        /\b(round|count|avg|min|max|sum|countIf|formatReadableSize|formatDateTime|greatest|toDate|toDateTime|now|quantilesMerge|quantilesState)\b/g,
                        '<span class="text-amber-300">$1</span>',
                      )
                      .replace(/'([^']*)'/g, '<span class="text-emerald-400">\'$1\'</span>')
                      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="text-purple-400">$1</span>'),
                  }}
                />
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function ResultTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return <p className="text-zinc-500 text-xs py-4 text-center">No rows returned.</p>;
  }

  const highlight = (col: string, val: string | number): string => {
    const v = String(val);
    if (col.includes('error') || col === 'StatusCode') {
      if (v === 'Error' || Number(v) > 0) return 'text-red-400';
    }
    if (col.includes('p99') || col.includes('p95') || col.includes('avg_ms') || col.includes('duration_ms')) {
      const n = Number(v);
      if (n > 500) return 'text-red-400';
      if (n > 100) return 'text-amber-400';
      return 'text-emerald-400';
    }
    if (col.includes('compression')) {
      const n = Number(v);
      if (n < 5) return 'text-emerald-400';
      if (n < 15) return 'text-amber-400';
    }
    if (col === 'method' || col === 'HttpMethod') return 'text-amber-300';
    if (col === 'engine') return 'text-blue-400';
    return 'text-zinc-200';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr className="border-b border-zinc-700">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2 whitespace-nowrap ${highlight(columns[ci], cell)}`}>
                  {String(cell === null || cell === '' ? '—' : cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsBar({ result, label }: { result: QueryResult; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-3 border-t border-zinc-800">
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mr-1">{label}</span>}
      <StatPill
        label="elapsed"
        value={`${result.elapsed_ms}ms`}
        highlight={result.elapsed_ms < 50 ? 'green' : result.elapsed_ms < 200 ? 'amber' : 'red'}
      />
      <StatPill
        label="bytes"
        value={fmtBytes(result.bytes_read)}
        highlight={result.bytes_read < 200_000 ? 'green' : result.bytes_read < 5_000_000 ? 'amber' : 'red'}
      />
      <StatPill label="rows scanned" value={fmtRows(result.rows_read)} />
      <StatPill label="rows returned" value={String(result.rows.length)} />
    </div>
  );
}

// ─── Benchmark panel ──────────────────────────────────────────────────────────

const BENCH_OLD_SQL = `SELECT\n    SpanAttributes['http.method'] AS method,\n    count() AS spans,\n    round(avg(Duration) / 1e6, 2) AS avg_ms\nFROM otel_traces\nWHERE Timestamp > now() - INTERVAL 6 HOUR\nGROUP BY method\nORDER BY spans DESC\nLIMIT 10`;
const BENCH_NEW_SQL = `SELECT\n    HttpMethod AS method,\n    count() AS spans,\n    round(avg(Duration) / 1e6, 2) AS avg_ms\nFROM traces\nWHERE Timestamp > now() - INTERVAL 6 HOUR\nGROUP BY method\nORDER BY spans DESC\nLIMIT 10`;

function BenchmarkPanel() {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setResult(null);
    const [oldRes, newRes] = await Promise.all([
      fetch('/api/clickhouse/showcase?q=bench-old').then((r) => r.json()),
      fetch('/api/clickhouse/showcase?q=bench-new').then((r) => r.json()),
    ]);
    setResult({ old: oldRes, new: newRes });
    setLoading(false);
  }, []);

  const ratio = result?.old && result?.new && result.new.bytes_read > 0
    ? Math.round(result.old.bytes_read / result.new.bytes_read)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
          Same logical query — <code className="text-amber-300 text-[11px]">GROUP BY http.method</code> — executed against both schemas at once.
          The only difference: one reads a <span className="text-red-400 font-semibold">Map column</span>, the other reads an
          <span className="text-emerald-400 font-semibold"> extracted column</span>.
        </p>
        <button
          onClick={run}
          disabled={loading}
          className="shrink-0 ml-4 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-950 transition-colors"
        >
          {loading ? 'Running…' : 'Run Benchmark'}
        </button>
      </div>

      {ratio !== null && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-5 py-4 flex items-center gap-4">
          <p className="text-5xl font-black text-emerald-400 tabular-nums">{ratio}×</p>
          <div>
            <p className="font-bold text-emerald-300">fewer bytes read with extracted column</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {fmtBytes(result!.old!.bytes_read)} → {fmtBytes(result!.new!.bytes_read)} · Map scan vs direct column read
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Old schema */}
        <div className="rounded-lg border border-red-800/30 bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-950/30 border-b border-red-800/30">
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Before — Map access</span>
            <code className="ml-auto text-[10px] text-zinc-600 font-mono">otel_traces</code>
          </div>
          <div className="p-4">
            <SqlDisplay sql={BENCH_OLD_SQL} />
          </div>
          {result?.old && !result.old.error && (
            <>
              <div className="px-4">
                <ResultTable columns={result.old.columns} rows={result.old.rows} />
                <StatsBar result={result.old} />
              </div>
            </>
          )}
          {result?.old?.error && (
            <p className="px-4 pb-3 text-xs text-red-400">{result.old.error}</p>
          )}
          {loading && <div className="px-4 pb-3 text-xs text-zinc-600 animate-pulse">Querying…</div>}
        </div>

        {/* New schema */}
        <div className="rounded-lg border border-emerald-800/30 bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-950/30 border-b border-emerald-800/30">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">After — Extracted column</span>
            <code className="ml-auto text-[10px] text-zinc-600 font-mono">traces</code>
          </div>
          <div className="p-4">
            <SqlDisplay sql={BENCH_NEW_SQL} />
          </div>
          {result?.new && !result.new.error && (
            <>
              <div className="px-4">
                <ResultTable columns={result.new.columns} rows={result.new.rows} />
                <StatsBar result={result.new} />
              </div>
            </>
          )}
          {result?.new?.error && (
            <p className="px-4 pb-3 text-xs text-red-400">{result.new.error}</p>
          )}
          {loading && <div className="px-4 pb-3 text-xs text-zinc-600 animate-pulse">Querying…</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Main QueryExplorer ───────────────────────────────────────────────────────

export function QueryExplorer() {
  const [activeId, setActiveId] = useState<QueryId>('benchmark');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const active = QUERIES.find((q) => q.id === activeId)!;

  const run = useCallback(async (id: QueryId) => {
    if (id === 'benchmark') return; // handled by BenchmarkPanel
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/clickhouse/showcase?q=${id}`);
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }, []);

  const handleSelect = (id: QueryId) => {
    setActiveId(id);
    setResult(null);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">

      {/* ── Terminal chrome ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-amber-500/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
        </div>
        <span className="ml-2 text-[11px] font-mono text-zinc-500">clickhouse-client — otel database</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            connected
          </span>
        </div>
      </div>

      <div className="flex min-h-[480px]">

        {/* ── Query sidebar ────────────────────────────────────────────── */}
        <div className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
          {QUERIES.map((q) => (
            <button
              key={q.id}
              onClick={() => handleSelect(q.id)}
              className={`text-left px-3 py-3 border-b border-zinc-800/50 transition-colors ${
                activeId === q.id
                  ? 'bg-zinc-800 border-l-2 border-l-amber-500'
                  : 'hover:bg-zinc-800/40 border-l-2 border-l-transparent'
              }`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${
                activeId === q.id ? 'text-amber-500' : 'text-zinc-600'
              }`}>{q.category}</p>
              <p className={`text-xs font-semibold leading-tight ${
                activeId === q.id ? 'text-zinc-100' : 'text-zinc-400'
              }`}>
                {q.icon} {q.label}
              </p>
            </button>
          ))}
        </div>

        {/* ── Main content area ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Description bar */}
          <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-3">
            <p className="text-xs text-zinc-400 flex-1 leading-relaxed">{active.description}</p>
            {!active.isBenchmark && (
              <button
                onClick={() => run(activeId)}
                disabled={loading}
                className="shrink-0 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-zinc-950 transition-colors"
              >
                {loading ? '⟳ Running…' : '▶ Run'}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-5 overflow-auto">

            {active.isBenchmark ? (
              <BenchmarkPanel />
            ) : (
              <div className="space-y-4">
                {/* SQL display */}
                {result?.sql && (
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
                    <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">SQL</span>
                    </div>
                    <div className="p-4">
                      <SqlDisplay sql={result.sql} />
                    </div>
                  </div>
                )}

                {/* No-result / loading state */}
                {!result && !loading && (
                  <div className="flex items-center justify-center h-48 text-zinc-700">
                    <div className="text-center">
                      <p className="text-3xl mb-2">▶</p>
                      <p className="text-sm">Press Run to execute against the live cluster</p>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex items-center justify-center h-48 text-zinc-600">
                    <div className="text-center space-y-2">
                      <div className="text-2xl animate-spin">⟳</div>
                      <p className="text-xs animate-pulse">Querying ClickHouse…</p>
                    </div>
                  </div>
                )}

                {/* Results */}
                {result && !result.error && !loading && (
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
                    <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Results</span>
                      <span className="ml-auto text-[10px] text-zinc-700">{result.rows.length} rows</span>
                    </div>
                    <div className="p-4">
                      <ResultTable columns={result.columns} rows={result.rows} />
                    </div>
                    <div className="px-4">
                      <StatsBar result={result} />
                    </div>
                  </div>
                )}

                {result?.error && (
                  <div className="rounded-lg border border-red-800/40 bg-red-950/20 p-4">
                    <p className="text-xs font-bold text-red-400 mb-1">Query Error</p>
                    <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap">{result.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
