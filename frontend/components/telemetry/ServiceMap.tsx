'use client';

import { useServiceMap } from '@/lib/hooks/useTelemetry';
import type { ServiceNode, ServiceEdge } from '@/lib/telemetry-types';

const W = 480;
const H = 260;
const NODE_R = 28;

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  SERVICE:  { fill: '#1d4ed8', stroke: '#3b82f6', text: '#bfdbfe' },
  DATABASE: { fill: '#92400e', stroke: '#f59e0b', text: '#fde68a' },
  EXTERNAL: { fill: '#374151', stroke: '#6b7280', text: '#d1d5db' },
};

function defaultColor() {
  return { fill: '#18181b', stroke: '#52525b', text: '#d4d4d8' };
}

function layoutPositions(nodes: ServiceNode[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const cx = W / 2;
  const cy = H / 2;

  const service = nodes.find(n => n.type === 'SERVICE');
  const others = nodes.filter(n => n !== service);

  if (service) pos.set(service.id, { x: cx, y: cy });

  if (others.length === 0) return pos;

  const radius = Math.min(cx, cy) - NODE_R - 10;
  others.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
    pos.set(node.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  return pos;
}

function EdgeLine({
  from,
  to,
  callCount,
  pos,
}: {
  from: string;
  to: string;
  callCount: number;
  pos: Map<string, { x: number; y: number }>;
}) {
  const a = pos.get(from);
  const b = pos.get(to);
  if (!a || !b) return null;

  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  return (
    <g>
      <line
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke="#3f3f46" strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
      <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fill="#71717a">
        {callCount}
      </text>
    </g>
  );
}

function NodeCircle({
  node,
  pos,
}: {
  node: ServiceNode;
  pos: Map<string, { x: number; y: number }>;
}) {
  const p = pos.get(node.id);
  if (!p) return null;
  const c = NODE_COLORS[node.type] ?? defaultColor();

  return (
    <g>
      <circle cx={p.x} cy={p.y} r={NODE_R} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
      <text
        x={p.x} y={p.y + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fontWeight={600} fill={c.text}
        style={{ fontFamily: 'monospace' }}
      >
        {(node.displayName ?? node.id).length > 10 ? (node.displayName ?? node.id).slice(0, 9) + '…' : (node.displayName ?? node.id)}
      </text>
      <text
        x={p.x} y={p.y + NODE_R + 12}
        textAnchor="middle" fontSize={8} fill="#71717a"
      >
        {node.type}
      </text>
    </g>
  );
}

export function ServiceMap() {
  const { serviceMap, isLoading } = useServiceMap();

  if (isLoading && !serviceMap) {
    return <div className="skeleton h-40 w-full rounded-lg" />;
  }

  const nodes: ServiceNode[] = serviceMap?.nodes ?? [];
  const edges: ServiceEdge[] = serviceMap?.edges ?? [];

  if (nodes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No service topology yet — make some requests first.
      </p>
    );
  }

  const pos = layoutPositions(nodes);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-64">
        <defs>
          <marker id="arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#52525b" />
          </marker>
        </defs>
        {edges.map((e, i) => (
          <EdgeLine key={i} from={e.from} to={e.to} callCount={e.callCount} pos={pos} />
        ))}
        {nodes.map(n => (
          <NodeCircle key={n.id} node={n} pos={pos} />
        ))}
      </svg>
    </div>
  );
}
