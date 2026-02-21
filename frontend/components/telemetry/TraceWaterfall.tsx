'use client';

import { clsx } from 'clsx';
import type { SpanDTO } from '@/lib/telemetry-types';

// ── Tree building ──────────────────────────────────────────────────────────────

type SpanNode = SpanDTO & { depth: number; children: SpanNode[] };

function buildTree(spans: SpanDTO[]): SpanNode[] {
  const map = new Map<string, SpanNode>();
  for (const span of spans) {
    map.set(span.spanId, { ...span, depth: 0, children: [] });
  }

  const roots: SpanNode[] = [];
  for (const span of spans) {
    const node = map.get(span.spanId)!;
    if (span.parentSpanId && map.has(span.parentSpanId)) {
      const parent = map.get(span.parentSpanId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function flatten(nodes: SpanNode[]): SpanNode[] {
  const out: SpanNode[] = [];
  function walk(node: SpanNode) {
    out.push(node);
    node.children
      .slice()
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .forEach(walk);
  }
  nodes.forEach(walk);
  return out;
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(ms: number) {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const BAR_WIDTH = 280; // px

export function TraceWaterfall({ spans }: { spans: SpanDTO[] }) {
  if (spans.length === 0) {
    return <p className="text-sm text-zinc-500 py-4">No spans found.</p>;
  }

  const flat = flatten(buildTree(spans));

  const times = flat.map(s => new Date(s.startTime).getTime());
  const ends = flat.map(s => new Date(s.startTime).getTime() + s.durationMs);
  const minMs = Math.min(...times);
  const totalMs = Math.max(1, Math.max(...ends) - minMs);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header row */}
        <div className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-500 px-2">
          <span className="w-56 shrink-0">Span</span>
          <span style={{ width: BAR_WIDTH }} className="shrink-0">Timeline ({fmt(totalMs)})</span>
          <span className="w-16 text-right shrink-0">Duration</span>
        </div>

        {flat.map(span => {
          const startMs = new Date(span.startTime).getTime() - minMs;
          const left = (startMs / totalMs) * BAR_WIDTH;
          const width = Math.max(2, (span.durationMs / totalMs) * BAR_WIDTH);
          const isError = span.status === 'ERROR';

          return (
            <div
              key={span.spanId}
              className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-800/40"
            >
              {/* Name with depth indent */}
              <div
                className="w-56 shrink-0 truncate text-xs text-zinc-300"
                style={{ paddingLeft: span.depth * 12 }}
                title={span.name}
              >
                {span.depth > 0 && (
                  <span className="mr-1 text-zinc-600">└</span>
                )}
                {span.name}
              </div>

              {/* Timeline bar */}
              <div
                className="relative shrink-0 bg-zinc-800 rounded-sm"
                style={{ width: BAR_WIDTH, height: 16 }}
              >
                <div
                  className={clsx(
                    'absolute top-0 h-full rounded-sm',
                    isError ? 'bg-red-600' : 'bg-k8s/80'
                  )}
                  style={{ left, width }}
                />
              </div>

              {/* Duration */}
              <span
                className={clsx(
                  'w-16 shrink-0 text-right font-mono text-xs',
                  isError ? 'text-red-400' : 'text-zinc-400'
                )}
              >
                {fmt(span.durationMs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
