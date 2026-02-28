'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import type { K8sTopology, PodStat, K8sEdge } from '@/app/api/telemetry/k8s/route';

// ─── palette ────────────────────────────────────────────────────────────────

const COLORS = ['#10b981', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6', '#22d3ee'];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return COLORS[h % COLORS.length];
}

function ha(hex: string, a: number): string {
  return hex + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');
}

// ─── simulation types ────────────────────────────────────────────────────────

interface SimNode {
  id: string;       // deployment name
  label: string;
  color: string;
  pods: PodStat[];
  x: number; y: number;
  vx: number; vy: number;
  r: number;
}

interface Particle {
  edgeIdx: number;
  progress: number;
  speed: number;
  size: number;
}

// ─── data fetching ───────────────────────────────────────────────────────────

async function fetchK8s(): Promise<K8sTopology> {
  const res = await fetch('/api/telemetry/k8s', { cache: 'no-store' });
  if (!res.ok) throw new Error('k8s fetch failed');
  return res.json();
}

// Group pods by deployment, returning SimNodes
function buildNodes(pods: PodStat[]): SimNode[] {
  const map = new Map<string, SimNode>();
  for (const p of pods) {
    const key = p.deployment || p.service;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        label: key,
        color: colorFor(key),
        pods: [],
        x: 0, y: 0, vx: 0, vy: 0,
        r: 22,
      });
    }
    map.get(key)!.pods.push(p);
  }
  // Scale radius by pod count
  map.forEach(n => { n.r = 20 + Math.min(n.pods.length * 4, 16); });
  return [...map.values()];
}

// ─── component ───────────────────────────────────────────────────────────────

export default function LiveServiceMap() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animRef      = useRef<number | null>(null);
  const timeRef      = useRef(0);
  const simNodes     = useRef<SimNode[]>([]);
  const edgesRef     = useRef<K8sEdge[]>([]);
  const particles    = useRef<Particle[]>([]);
  const lastUpdated  = useRef(Date.now());
  const loadingRef   = useRef(true);

  const { data, isLoading } = useSWR<K8sTopology>('/api/telemetry/k8s', fetchK8s, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  });

  useEffect(() => { loadingRef.current = isLoading; }, [isLoading]);

  // Rebuild sim when data arrives
  useEffect(() => {
    if (!data) return;
    lastUpdated.current = Date.now();

    const canvas = canvasRef.current;
    const w = canvas?.offsetWidth || 420;
    const h = canvas?.offsetHeight || 480;
    const cx = w / 2, cy = h / 2;

    const newNodes = buildNodes(data.pods);
    edgesRef.current = data.edges;

    // Map from service name → node id (deployment)
    const svcToNode: Record<string, string> = {};
    newNodes.forEach(n => n.pods.forEach(p => { svcToNode[p.service] = n.id; }));

    // Preserve existing positions
    const prev: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    simNodes.current.forEach(n => { prev[n.id] = { x: n.x, y: n.y, vx: n.vx, vy: n.vy }; });

    newNodes.forEach(n => {
      const p = prev[n.id];
      if (p) { n.x = p.x; n.y = p.y; n.vx = p.vx; n.vy = p.vy; return; }
      const ang = Math.random() * Math.PI * 2;
      n.x = cx + Math.cos(ang) * (40 + Math.random() * 60);
      n.y = cy + Math.sin(ang) * (40 + Math.random() * 60);
    });
    simNodes.current = newNodes;

    // Map edges from service → node, dedup
    const edgeMap = new Map<string, K8sEdge>();
    data.edges.forEach(e => {
      const from = svcToNode[e.from] ?? e.from;
      const to   = svcToNode[e.to]   ?? e.to;
      if (from === to) return;
      const key = `${from}→${to}`;
      const existing = edgeMap.get(key);
      if (existing) existing.calls += e.calls;
      else edgeMap.set(key, { from, to, calls: e.calls });
    });
    edgesRef.current = [...edgeMap.values()];

    // Particles
    const pts: Particle[] = [];
    edgesRef.current.forEach((_, i) => {
      const count = Math.max(3, Math.min(10, Math.ceil(edgesRef.current[i].calls / 20)));
      for (let j = 0; j < count; j++) {
        pts.push({ edgeIdx: i, progress: j / count, speed: 0.004 + Math.random() * 0.005, size: 1.8 + Math.random() * 1.5 });
      }
    });
    particles.current = pts;
  }, [data]);

  // RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const applySize = () => {
      const c = canvas.parentElement!;
      const w = c.offsetWidth || c.clientWidth;
      const h = c.offsetHeight || c.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(applySize);
    ro.observe(canvas.parentElement!);
    applySize();
    window.addEventListener('resize', applySize);

    const draw = () => {
      const w = canvas.offsetWidth  || canvas.clientWidth;
      const h = canvas.offsetHeight || canvas.clientHeight;
      if (!w || !h) { animRef.current = requestAnimationFrame(draw); return; }

      timeRef.current += 0.016;
      const t  = timeRef.current;
      const cx = w / 2, cy = h / 2;

      const nodes  = simNodes.current;
      const edges  = edgesRef.current;
      const ptcls  = particles.current;
      const byId: Record<string, SimNode> = {};
      nodes.forEach(n => { byId[n.id] = n; });

      // Spring simulation
      if (nodes.length > 1) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d  = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const f  = 9000 / (d * d);
            a.vx += (dx / d) * f; a.vy += (dy / d) * f;
            b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
          }
        }
        edges.forEach(e => {
          const a = byId[e.from], b = byId[e.to];
          if (!a || !b) return;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d  = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f  = (d - 140) * 0.022;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        });
        nodes.forEach(n => {
          n.vx += (cx - n.x) * 0.006;
          n.vy += (cy - n.y) * 0.006;
          n.vx *= 0.87; n.vy *= 0.87;
          n.x = Math.max(n.r + 50, Math.min(w - n.r - 50, n.x + n.vx));
          n.y = Math.max(n.r + 50, Math.min(h - n.r - 50, n.y + n.vy));
        });
      } else if (nodes.length === 1) {
        nodes[0].x += (cx - nodes[0].x) * 0.04;
        nodes[0].y += (cy - nodes[0].y) * 0.04;
      }

      // ── clear & background ────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Solid dark bg — CSS mask on wrapper handles the edge fade
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, w, h);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 0.5;
      const grid = 40;
      for (let x = grid; x < w; x += grid) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = grid; y < h; y += grid) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // ── empty / loading ───────────────────────────────────────────────────
      if (nodes.length === 0) {
        ctx.font = '12px Inter,system-ui,sans-serif';
        ctx.fillStyle = 'rgba(148,163,184,0.4)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(loadingRef.current ? 'Loading…' : 'No active pods — generate some traffic', cx, cy);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── edges ─────────────────────────────────────────────────────────────
      edges.forEach(e => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = ha(a.color, 0.2);
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Arrow
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d > b.r + 12) {
          const hx  = b.x - (dx / d) * (b.r + 8);
          const hy  = b.y - (dy / d) * (b.r + 8);
          const ang = Math.atan2(dy, dx);
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - 6 * Math.cos(ang - 0.45), hy - 6 * Math.sin(ang - 0.45));
          ctx.lineTo(hx - 6 * Math.cos(ang + 0.45), hy - 6 * Math.sin(ang + 0.45));
          ctx.closePath();
          ctx.fillStyle = ha(a.color, 0.5);
          ctx.fill();
        }

        // Call count label
        ctx.font = '9px Inter,system-ui,sans-serif';
        ctx.fillStyle = 'rgba(148,163,184,0.45)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const cnt = e.calls > 999 ? `${(e.calls / 1000).toFixed(1)}k` : String(e.calls);
        ctx.fillText(cnt, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
      });

      // ── particles ──────────────────────────────────────────────────────────
      ptcls.forEach(p => {
        p.progress = (p.progress + p.speed) % 1;
        const e = edges[p.edgeIdx];
        if (!e) return;
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return;
        const pt = p.progress;
        const px = a.x + (b.x - a.x) * pt;
        const py = a.y + (b.y - a.y) * pt;
        const al = Math.sin(pt * Math.PI) * 0.9 + 0.1;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = ha(a.color, al);
        ctx.fill();
      });

      // ── nodes ─────────────────────────────────────────────────────────────
      [...nodes].sort((a, b) => a.y - b.y).forEach(node => {
        const c     = node.color;
        const pulse = Math.sin(t * 1.6 + node.x * 0.008) * 1.8;
        const totalSpans = node.pods.reduce((s, p) => s + p.spans, 0);
        const totalErrors = node.pods.reduce((s, p) => s + p.errors, 0);
        const errRate = totalSpans > 0 ? totalErrors / totalSpans : 0;
        const nodeColor = errRate > 0.05 ? '#f87171' : c;

        // Outer pulse ring
        const ringR = node.r + 20 + pulse;
        const ring  = ctx.createRadialGradient(node.x, node.y, node.r, node.x, node.y, ringR);
        ring.addColorStop(0, ha(nodeColor, 0.18));
        ring.addColorStop(1, ha(nodeColor, 0));
        ctx.beginPath(); ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
        ctx.fillStyle = ring; ctx.fill();

        // Node body
        const body = ctx.createRadialGradient(
          node.x - node.r * 0.3, node.y - node.r * 0.35, 0,
          node.x, node.y, node.r + pulse * 0.15
        );
        body.addColorStop(0, ha(nodeColor, 0.5));
        body.addColorStop(1, ha(nodeColor, 0.1));
        ctx.beginPath(); ctx.arc(node.x, node.y, node.r + pulse * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = body; ctx.fill();
        ctx.strokeStyle = ha(nodeColor, 0.75); ctx.lineWidth = 1.5; ctx.stroke();

        // Pod dots orbiting the node
        const podCount = node.pods.length;
        node.pods.forEach((pod, i) => {
          const podAngle = (i / podCount) * Math.PI * 2 + t * 0.3 + node.x * 0.005;
          const orbitR   = node.r + 10;
          const px       = node.x + Math.cos(podAngle) * orbitR;
          const py       = node.y + Math.sin(podAngle) * orbitR;
          const podColor = pod.errorRate > 0.05 ? '#f87171' : nodeColor;
          ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = ha(podColor, 0.9); ctx.fill();
          ctx.strokeStyle = ha(podColor, 0.5); ctx.lineWidth = 1; ctx.stroke();
        });

        // Deployment name
        ctx.font      = `bold ${Math.max(9, Math.round(node.r * 0.4))}px Inter,system-ui,sans-serif`;
        ctx.fillStyle = ha(nodeColor, 0.9);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // Show abbreviated name inside node
        const short = node.label.replace('o11y-news-', '').replace('o11y-news', 'app');
        ctx.fillText(short.length > 10 ? short.slice(0, 9) + '…' : short, node.x, node.y);

        // Full label below
        ctx.font      = '10px Inter,system-ui,sans-serif';
        ctx.fillStyle = 'rgba(203,213,225,0.75)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + node.r + 8);

        // Pod count badge
        if (podCount > 0) {
          ctx.font      = '8px Inter,system-ui,sans-serif';
          ctx.fillStyle = ha(nodeColor, 0.55);
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(`${podCount} pod${podCount > 1 ? 's' : ''}`, node.x, node.y + node.r + 20);
        }
      });

      // ── live badge ────────────────────────────────────────────────────────
      const sAgo    = Math.floor((Date.now() - lastUpdated.current) / 1000);
      const agoText = sAgo < 5 ? 'just now' : `${sAgo}s ago`;
      ctx.font      = '9px Inter,system-ui,sans-serif';
      ctx.fillStyle = 'rgba(148,163,184,0.28)';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`● LIVE  k8s pods  ${agoText}`, 10, h - 8);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
      window.removeEventListener('resize', applySize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // CSS mask creates the soft edge-fade — no canvas gradient trickery needed
    <div
      className="relative w-full h-full"
      style={{
        maskImage: 'radial-gradient(ellipse 75% 80% at 50% 50%, black 35%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 75% 80% at 50% 50%, black 35%, transparent 100%)',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
