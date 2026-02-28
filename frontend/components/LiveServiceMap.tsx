'use client';

import { useEffect, useRef } from 'react';
import { useServiceMap } from '@/lib/hooks/useTelemetry';
import type { ServiceEdge } from '@/lib/telemetry-types';

// ─── visual config ────────────────────────────────────────────────────────────

const NODE_STYLE: Record<string, { color: string; label: string }> = {
  SERVICE:  { color: '#10b981', label: 'SVC' },
  DATABASE: { color: '#f59e0b', label: 'DB'  },
  EXTERNAL: { color: '#71717a', label: 'EXT' },
};
const FALLBACK_STYLE = { color: '#818cf8', label: '?' };

function styleFor(type: string) { return NODE_STYLE[type] ?? FALLBACK_STYLE; }

function ha(hex: string, alpha: number) {
  return hex + Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
}

// ─── types ────────────────────────────────────────────────────────────────────

interface SimNode {
  id: string;
  displayName: string;
  type: string;
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

// ─── component ────────────────────────────────────────────────────────────────

export default function LiveServiceMap() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef<number | null>(null);
  const timeRef     = useRef(0);
  const simNodes    = useRef<SimNode[]>([]);
  const edgesRef    = useRef<ServiceEdge[]>([]);
  const particles   = useRef<Particle[]>([]);
  const lastUpdated = useRef(Date.now());
  const loadingRef  = useRef(true);

  const { serviceMap, isLoading } = useServiceMap(30);

  // Keep loading ref in sync
  useEffect(() => { loadingRef.current = isLoading; }, [isLoading]);

  // Rebuild simulation nodes + particles when topology changes
  useEffect(() => {
    if (!serviceMap) return;
    lastUpdated.current = Date.now();

    const canvas = canvasRef.current;
    const w = canvas?.offsetWidth || 420;
    const h = canvas?.offsetHeight || 480;
    const cx = w / 2, cy = h / 2;

    const { nodes, edges } = serviceMap;
    edgesRef.current = edges;

    // Compute degree (connectivity) per node
    const degree: Record<string, number> = {};
    nodes.forEach(n => { degree[n.id] = 0; });
    edges.forEach(e => {
      degree[e.from] = (degree[e.from] || 0) + 1;
      degree[e.to]   = (degree[e.to]   || 0) + 1;
    });

    // Preserve positions for nodes we already know
    const prev: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    simNodes.current.forEach(n => { prev[n.id] = { x: n.x, y: n.y, vx: n.vx, vy: n.vy }; });

    simNodes.current = nodes.map(node => {
      const r = 18 + Math.min((degree[node.id] ?? 0) * 3, 18);
      const p = prev[node.id];
      if (p) return { ...node, ...p, r };
      const ang  = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 70;
      return { ...node, x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, vx: 0, vy: 0, r };
    });

    // Build particles for edges
    const pts: Particle[] = [];
    edges.forEach((e, i) => {
      const count = Math.max(2, Math.min(8, Math.ceil(e.callCount / 10)));
      for (let j = 0; j < count; j++) {
        pts.push({ edgeIdx: i, progress: j / count, speed: 0.003 + Math.random() * 0.004, size: 1.5 + Math.random() * 2 });
      }
    });
    particles.current = pts;
  }, [serviceMap]);

  // Canvas resize helper
  function makeApplySize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    return () => {
      const container = canvas.parentElement!;
      const w = container.offsetWidth  || container.clientWidth;
      const h = container.offsetHeight || container.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
  }

  // RAF draw loop — reads only from refs, runs forever
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const applySize = makeApplySize(canvas, ctx);
    const ro = new ResizeObserver(applySize);
    ro.observe(canvas.parentElement!);
    applySize();
    window.addEventListener('resize', applySize);

    const draw = () => {
      const w = canvas.offsetWidth  || canvas.clientWidth;
      const h = canvas.offsetHeight || canvas.clientHeight;
      if (!w || !h) { animRef.current = requestAnimationFrame(draw); return; }

      timeRef.current += 0.016;
      const t = timeRef.current;
      const cx = w / 2, cy = h / 2;

      const nodes  = simNodes.current;
      const edges  = edgesRef.current;
      const ptcls  = particles.current;

      // Fast lookup
      const byId: Record<string, SimNode> = {};
      nodes.forEach(n => { byId[n.id] = n; });

      // ── spring simulation ──────────────────────────────────────────────────
      if (nodes.length > 1) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d  = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const f  = 8000 / (d * d);
            a.vx += (dx / d) * f; a.vy += (dy / d) * f;
            b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
          }
        }
        // Attraction along edges
        edges.forEach(e => {
          const a = byId[e.from], b = byId[e.to];
          if (!a || !b) return;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d  = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f  = (d - 130) * 0.025;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        });
        // Center gravity + damping + bounds
        nodes.forEach(n => {
          n.vx += (cx - n.x) * 0.007;
          n.vy += (cy - n.y) * 0.007;
          n.vx *= 0.88;
          n.vy *= 0.88;
          n.x = Math.max(n.r + 45, Math.min(w - n.r - 45, n.x + n.vx));
          n.y = Math.max(n.r + 45, Math.min(h - n.r - 45, n.y + n.vy));
        });
      } else if (nodes.length === 1) {
        // Single node — just center it
        nodes[0].x += (cx - nodes[0].x) * 0.05;
        nodes[0].y += (cy - nodes[0].y) * 0.05;
      }

      // ── draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Background — fades to transparent so it blends with any page theme
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.72);
      bg.addColorStop(0,   'rgba(15,23,41,0.96)');
      bg.addColorStop(0.5, 'rgba(9,14,28,0.88)');
      bg.addColorStop(1,   'rgba(5,8,16,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Empty / loading state
      if (nodes.length === 0) {
        ctx.font = '12px Inter,system-ui,sans-serif';
        ctx.fillStyle = 'rgba(148,163,184,0.45)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(
          loadingRef.current
            ? 'Loading service topology…'
            : 'Navigate the site to populate trace data',
          cx, cy
        );
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── edges ──────────────────────────────────────────────────────────────
      edges.forEach(e => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return;
        const sc = styleFor(a.type).color;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = ha(sc, 0.4);
        ctx.lineWidth   = 1 + Math.log1p(e.callCount) * 0.3;
        ctx.stroke();

        // Arrow head
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d > b.r + 14) {
          const hx  = b.x - (dx / d) * (b.r + 9);
          const hy  = b.y - (dy / d) * (b.r + 9);
          const ang = Math.atan2(dy, dx);
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - 7 * Math.cos(ang - 0.45), hy - 7 * Math.sin(ang - 0.45));
          ctx.lineTo(hx - 7 * Math.cos(ang + 0.45), hy - 7 * Math.sin(ang + 0.45));
          ctx.closePath();
          ctx.fillStyle = ha(sc, 0.7);
          ctx.fill();
        }

        // Call count label mid-edge
        ctx.font = '9px Inter,system-ui,sans-serif';
        ctx.fillStyle = 'rgba(148,163,184,0.55)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const cnt = e.callCount > 999 ? `${(e.callCount / 1000).toFixed(1)}k` : String(e.callCount);
        ctx.fillText(cnt, (a.x + b.x) / 2, (a.y + b.y) / 2 - 7);
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
        const alpha = Math.sin(pt * Math.PI) * 0.85 + 0.15;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = ha(styleFor(a.type).color, alpha);
        ctx.fill();
      });

      // ── nodes ──────────────────────────────────────────────────────────────
      [...nodes].sort((a, b) => a.y - b.y).forEach(node => {
        const { color, label } = styleFor(node.type);
        const pulse = Math.sin(t * 1.8 + node.x * 0.012) * 1.5;

        // Outer glow
        const glowR = node.r + 16 + pulse;
        const glow  = ctx.createRadialGradient(node.x, node.y, node.r * 0.6, node.x, node.y, glowR);
        glow.addColorStop(0, ha(color, 0.22));
        glow.addColorStop(1, ha(color, 0));
        ctx.beginPath(); ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow; ctx.fill();

        // Node fill
        const fillR = node.r + pulse * 0.2;
        const fill  = ctx.createRadialGradient(
          node.x - node.r * 0.3, node.y - node.r * 0.3, 0,
          node.x, node.y, fillR
        );
        fill.addColorStop(0, ha(color, 0.55));
        fill.addColorStop(1, ha(color, 0.12));
        ctx.beginPath(); ctx.arc(node.x, node.y, fillR, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = ha(color, 0.9); ctx.lineWidth = 1.5; ctx.stroke();

        // Short type label inside
        ctx.font       = `bold ${Math.max(9, Math.round(node.r * 0.55))}px Inter,system-ui,sans-serif`;
        ctx.fillStyle  = ha(color, 0.95);
        ctx.textAlign  = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, node.x, node.y);

        // Service name below
        const name = node.displayName || node.id;
        ctx.font      = '10px Inter,system-ui,sans-serif';
        ctx.fillStyle = 'rgba(226,232,240,0.82)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(name, node.x, node.y + node.r + 5);
      });

      // ── live badge ─────────────────────────────────────────────────────────
      const sAgo    = Math.floor((Date.now() - lastUpdated.current) / 1000);
      const agoText = sAgo < 5 ? 'just now' : `${sAgo}s ago`;
      ctx.font      = '9px Inter,system-ui,sans-serif';
      ctx.fillStyle = 'rgba(148,163,184,0.32)';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`● LIVE  service map  ${agoText}`, 10, h - 8);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
      window.removeEventListener('resize', applySize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional: reads from refs only

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
