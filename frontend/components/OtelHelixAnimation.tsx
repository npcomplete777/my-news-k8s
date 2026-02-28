'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const SERVICES = [
  { id: 'frontend', name: 'Frontend', color: '#60A5FA', icon: '🌐', tier: 'edge' },
  { id: 'frontend-proxy', name: 'Envoy Proxy', color: '#818CF8', icon: '🔀', tier: 'edge' },
  { id: 'ad', name: 'Ad Service', color: '#F472B6', icon: '📢', tier: 'business' },
  { id: 'cart', name: 'Cart Service', color: '#FB923C', icon: '🛒', tier: 'business' },
  { id: 'checkout', name: 'Checkout', color: '#FBBF24', icon: '💳', tier: 'business' },
  { id: 'currency', name: 'Currency', color: '#34D399', icon: '💱', tier: 'business' },
  { id: 'email', name: 'Email Service', color: '#F87171', icon: '📧', tier: 'business' },
  { id: 'payment', name: 'Payment', color: '#A78BFA', icon: '💰', tier: 'business' },
  { id: 'product-catalog', name: 'Product Catalog', color: '#2DD4BF', icon: '📦', tier: 'business' },
  { id: 'recommendation', name: 'Recommendations', color: '#FB7185', icon: '⭐', tier: 'business' },
  { id: 'shipping', name: 'Shipping', color: '#38BDF8', icon: '🚚', tier: 'business' },
  { id: 'quote', name: 'Quote Service', color: '#C084FC', icon: '📋', tier: 'business' },
  { id: 'flagd', name: 'Feature Flags', color: '#FCD34D', icon: '🚩', tier: 'infra' },
  { id: 'kafka', name: 'Kafka', color: '#6EE7B7', icon: '📨', tier: 'infra' },
  { id: 'accounting', name: 'Accounting', color: '#FDA4AF', icon: '📊', tier: 'infra' },
  { id: 'fraud', name: 'Fraud Detection', color: '#FCA5A5', icon: '🔍', tier: 'infra' },
  { id: 'redis', name: 'Redis', color: '#EF4444', icon: '🗄️', tier: 'data' },
  { id: 'postgres', name: 'PostgreSQL', color: '#3B82F6', icon: '🐘', tier: 'data' },
  { id: 'collector', name: 'OTel Collector', color: '#F59E0B', icon: '📡', tier: 'otel' },
  { id: 'jaeger', name: 'Jaeger', color: '#10B981', icon: '🔭', tier: 'otel' },
  { id: 'prometheus', name: 'Prometheus', color: '#E11D48', icon: '📈', tier: 'otel' },
  { id: 'grafana', name: 'Grafana', color: '#F97316', icon: '📊', tier: 'otel' },
  { id: 'load-generator', name: 'Load Generator', color: '#8B5CF6', icon: '⚡', tier: 'edge' },
];

const CONNECTIONS = [
  { from: 'load-generator', to: 'frontend-proxy' },
  { from: 'frontend-proxy', to: 'frontend' },
  { from: 'frontend', to: 'ad' },
  { from: 'frontend', to: 'cart' },
  { from: 'frontend', to: 'checkout' },
  { from: 'frontend', to: 'currency' },
  { from: 'frontend', to: 'product-catalog' },
  { from: 'frontend', to: 'recommendation' },
  { from: 'frontend', to: 'shipping' },
  { from: 'checkout', to: 'cart' },
  { from: 'checkout', to: 'currency' },
  { from: 'checkout', to: 'email' },
  { from: 'checkout', to: 'payment' },
  { from: 'checkout', to: 'product-catalog' },
  { from: 'checkout', to: 'shipping' },
  { from: 'checkout', to: 'kafka' },
  { from: 'recommendation', to: 'product-catalog' },
  { from: 'recommendation', to: 'flagd' },
  { from: 'shipping', to: 'quote' },
  { from: 'cart', to: 'redis' },
  { from: 'kafka', to: 'accounting' },
  { from: 'kafka', to: 'fraud' },
  { from: 'accounting', to: 'postgres' },
  { from: 'fraud', to: 'postgres' },
  { from: 'collector', to: 'jaeger' },
  { from: 'collector', to: 'prometheus' },
  { from: 'prometheus', to: 'grafana' },
  { from: 'flagd', to: 'postgres' },
  { from: 'quote', to: 'flagd' },
];

const PARTICLE_COUNT = 4;

type ServiceNode = typeof SERVICES[number] & {
  x: number; y: number; depth: number; scale: number; index: number; isPinned: boolean;
};

export default function OtelHelixAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const [hoveredNode, setHoveredNode] = useState<ServiceNode | null>(null);
  const [paused, setPaused] = useState(false);
  const [helixSpeed, setHelixSpeed] = useState(0.3);
  const [viewMode, setViewMode] = useState<'helix' | 'orbital'>('helix');
  const [pinnedCount, setPinnedCount] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const nodesRef = useRef<ServiceNode[]>([]);
  const particlesRef = useRef<{ connIndex: number; progress: number; speed: number; size: number; brightness: number }[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const pausedRef = useRef(false);
  const helixSpeedRef = useRef(0.3);
  const viewModeRef = useRef<'helix' | 'orbital'>('helix');
  const draggingRef = useRef<number | null>(null);
  const pinnedRef = useRef<Record<string, { x: number; y: number }>>({});

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { helixSpeedRef.current = helixSpeed; }, [helixSpeed]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  const getHelixPosition = useCallback((index: number, total: number, time: number, w: number, h: number) => {
    const centerX = w / 2;
    const centerY = h / 2;
    const radiusX = Math.min(w, h) * 0.32;
    const radiusY = Math.min(w, h) * 0.32;
    const t = (index / total) * Math.PI * 4 + time * helixSpeedRef.current;
    const strand = index % 2;
    const phase = strand * Math.PI;
    const spiralX = centerX + Math.cos(t + phase) * radiusX * (0.5 + 0.5 * Math.sin(t * 0.5));
    const spiralY = centerY + Math.sin(t + phase) * radiusY * (0.5 + 0.5 * Math.cos(t * 0.3));
    const depth = Math.sin(t + phase) * 0.5 + 0.5;
    const scale = 0.6 + depth * 0.5;
    return { x: spiralX, y: spiralY, depth, scale };
  }, []);

  const getOrbitalPosition = useCallback((index: number, total: number, time: number, w: number, h: number) => {
    const centerX = w / 2;
    const centerY = h / 2;
    const service = SERVICES[index];
    const tierRadius: Record<string, number> = { edge: 0.12, business: 0.28, infra: 0.38, data: 0.42, otel: 0.48 };
    const r = (tierRadius[service.tier] || 0.3) * Math.min(w, h);
    const tierServices = SERVICES.filter(s => s.tier === service.tier);
    const tierIndex = tierServices.findIndex(s => s.id === service.id);
    const tierTotal = tierServices.length;
    const angle = (tierIndex / tierTotal) * Math.PI * 2 + time * helixSpeedRef.current * (0.3 + (tierRadius[service.tier] || 0.3));
    const wobble = Math.sin(time * 2 + index) * 8;
    return {
      x: centerX + Math.cos(angle) * r + wobble,
      y: centerY + Math.sin(angle) * r + wobble * 0.5,
      depth: Math.sin(angle) * 0.5 + 0.5,
      scale: 0.7 + Math.sin(angle) * 0.15,
    };
  }, []);

  const initParticles = useCallback(() => {
    const particles: typeof particlesRef.current = [];
    CONNECTIONS.forEach((_, ci) => {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          connIndex: ci,
          progress: i / PARTICLE_COUNT,
          speed: 0.003 + Math.random() * 0.004,
          size: 1.5 + Math.random() * 2,
          brightness: 0.5 + Math.random() * 0.5,
        });
      }
    });
    particlesRef.current = particles;
  }, []);

  const hitTest = useCallback((mx: number, my: number) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = mx - node.x;
      const dy = my - node.y;
      const r = 20 * (node.scale || 1);
      if (dx * dx + dy * dy < r * r + 200) return i;
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const idx = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (idx !== null) { draggingRef.current = idx; setDragActive(true); e.preventDefault(); }
  }, [hitTest]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    mouseRef.current = { x: mx, y: my };
    if (draggingRef.current !== null) {
      pinnedRef.current[SERVICES[draggingRef.current].id] = { x: mx, y: my };
      setPinnedCount(Object.keys(pinnedRef.current).length);
      return;
    }
    const nodes = nodesRef.current;
    let found: ServiceNode | null = null;
    for (const node of nodes) {
      const dx = mx - node.x; const dy = my - node.y;
      if (dx * dx + dy * dy < 600) { found = node; break; }
    }
    setHoveredNode(found);
  }, []);

  const handleMouseUp = useCallback(() => { draggingRef.current = null; setDragActive(false); }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const idx = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (idx !== null) {
      const svcId = SERVICES[idx].id;
      if (pinnedRef.current[svcId]) { delete pinnedRef.current[svcId]; setPinnedCount(Object.keys(pinnedRef.current).length); }
    }
  }, [hitTest]);

  const unpinAll = useCallback(() => { pinnedRef.current = {}; setPinnedCount(0); }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); unpinAll(); }, [unpinAll]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    initParticles();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width; const h = rect.height;
      if (!pausedRef.current) timeRef.current += 0.016;
      const time = timeRef.current;
      const posFunc = viewModeRef.current === 'helix' ? getHelixPosition : getOrbitalPosition;

      const nodes: ServiceNode[] = SERVICES.map((svc, i) => {
        const pinned = pinnedRef.current[svc.id];
        if (pinned) {
          const animPos = posFunc(i, SERVICES.length, time, w, h);
          return { ...svc, x: pinned.x, y: pinned.y, depth: animPos.depth, scale: animPos.scale, index: i, isPinned: true };
        }
        const pos = posFunc(i, SERVICES.length, time, w, h);
        return { ...svc, ...pos, index: i, isPinned: false };
      });
      nodesRef.current = nodes;

      ctx.clearRect(0, 0, w, h);

      // Background
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      bgGrad.addColorStop(0, '#0f1729');
      bgGrad.addColorStop(0.5, '#0a0f1e');
      bgGrad.addColorStop(1, '#050810');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)';
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (let gy = 0; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

      // Helix backbone strands
      if (viewModeRef.current === 'helix') {
        for (let strand = 0; strand < 2; strand++) {
          ctx.beginPath();
          ctx.strokeStyle = strand === 0 ? 'rgba(96, 165, 250, 0.08)' : 'rgba(244, 114, 182, 0.08)';
          ctx.lineWidth = 2;
          for (let i = 0; i <= 200; i++) {
            const t = (i / 200) * Math.PI * 4 + time * helixSpeedRef.current;
            const phase = strand * Math.PI;
            const px = w / 2 + Math.cos(t + phase) * Math.min(w, h) * 0.32 * (0.5 + 0.5 * Math.sin(t * 0.5));
            const py = h / 2 + Math.sin(t + phase) * Math.min(w, h) * 0.32 * (0.5 + 0.5 * Math.cos(t * 0.3));
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // Connections
      const sortedConns = CONNECTIONS.map((conn, i) => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        return { ...conn, fromNode, toNode, avgDepth: ((fromNode?.depth || 0) + (toNode?.depth || 0)) / 2, index: i };
      }).sort((a, b) => a.avgDepth - b.avgDepth);

      sortedConns.forEach(conn => {
        if (!conn.fromNode || !conn.toNode) return;
        const { fromNode, toNode } = conn;
        const alpha = 0.08 + conn.avgDepth * 0.18;
        const mx2 = (fromNode.x + toNode.x) / 2;
        const my2 = (fromNode.y + toNode.y) / 2;
        const dx = toNode.x - fromNode.x; const dy = toNode.y - fromNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const curvature = Math.sin(time * 0.8 + conn.index) * dist * 0.15;
        const cx = mx2 + (-dy / dist) * curvature;
        const cy = my2 + (dx / dist) * curvature;

        ctx.beginPath(); ctx.moveTo(fromNode.x, fromNode.y); ctx.quadraticCurveTo(cx, cy, toNode.x, toNode.y);
        ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`; ctx.lineWidth = 0.8 + conn.avgDepth * 0.8; ctx.stroke();

        const glowAlpha = Math.max(0, Math.sin((time * 2 + conn.index * 0.5) % (Math.PI * 2))) * 0.3;
        if (glowAlpha > 0.05) {
          ctx.beginPath(); ctx.moveTo(fromNode.x, fromNode.y); ctx.quadraticCurveTo(cx, cy, toNode.x, toNode.y);
          ctx.strokeStyle = `rgba(96, 165, 250, ${glowAlpha})`; ctx.lineWidth = 2 + conn.avgDepth * 2; ctx.stroke();
        }

        const at = 0.55 + Math.sin(time + conn.index) * 0.05;
        const ax = (1 - at) * (1 - at) * fromNode.x + 2 * (1 - at) * at * cx + at * at * toNode.x;
        const ay = (1 - at) * (1 - at) * fromNode.y + 2 * (1 - at) * at * cy + at * at * toNode.y;
        const tangentX = 2 * (1 - at) * (cx - fromNode.x) + 2 * at * (toNode.x - cx);
        const tangentY = 2 * (1 - at) * (cy - fromNode.y) + 2 * at * (toNode.y - cy);
        const angle = Math.atan2(tangentY, tangentX);
        const arrowSize = 4 + conn.avgDepth * 3;
        ctx.beginPath();
        ctx.moveTo(ax + Math.cos(angle) * arrowSize, ay + Math.sin(angle) * arrowSize);
        ctx.lineTo(ax + Math.cos(angle + 2.5) * arrowSize, ay + Math.sin(angle + 2.5) * arrowSize);
        ctx.lineTo(ax + Math.cos(angle - 2.5) * arrowSize, ay + Math.sin(angle - 2.5) * arrowSize);
        ctx.closePath(); ctx.fillStyle = `rgba(148, 163, 184, ${alpha + 0.15})`; ctx.fill();
      });

      // Particles
      particlesRef.current.forEach(p => {
        if (!pausedRef.current) { p.progress += p.speed; if (p.progress > 1) p.progress -= 1; }
        const conn = CONNECTIONS[p.connIndex];
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return;
        const mx3 = (fromNode.x + toNode.x) / 2; const my3 = (fromNode.y + toNode.y) / 2;
        const dxx = toNode.x - fromNode.x; const dyy = toNode.y - fromNode.y;
        const dist2 = Math.sqrt(dxx * dxx + dyy * dyy) || 1;
        const curv = Math.sin(time * 0.8 + p.connIndex) * dist2 * 0.15;
        const cxx = mx3 + (-dyy / dist2) * curv; const cyy = my3 + (dxx / dist2) * curv;
        const t2 = p.progress;
        const px = (1 - t2) * (1 - t2) * fromNode.x + 2 * (1 - t2) * t2 * cxx + t2 * t2 * toNode.x;
        const py = (1 - t2) * (1 - t2) * fromNode.y + 2 * (1 - t2) * t2 * cyy + t2 * t2 * toNode.y;
        const avgD = fromNode.depth * (1 - t2) + toNode.depth * t2;
        const pAlpha = (0.3 + avgD * 0.7) * p.brightness;
        const grd = ctx.createRadialGradient(px, py, 0, px, py, p.size * 4);
        grd.addColorStop(0, `rgba(96, 165, 250, ${pAlpha})`);
        grd.addColorStop(0.5, `rgba(147, 51, 234, ${pAlpha * 0.4})`);
        grd.addColorStop(1, 'rgba(96, 165, 250, 0)');
        ctx.beginPath(); ctx.arc(px, py, p.size * 4, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${pAlpha})`; ctx.fill();
      });

      // Nodes
      [...nodes].sort((a, b) => a.depth - b.depth).forEach(node => {
        const s = node.scale;
        const alpha = 0.5 + node.depth * 0.5;
        const baseR = 18 * s;
        const pulse = Math.sin(time * 3 + node.index * 0.7) * 2;
        const isBeingDragged = draggingRef.current === node.index;

        if (node.isPinned) {
          ctx.beginPath(); ctx.arc(node.x, node.y, baseR + 18 + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = isBeingDragged ? 'rgba(250,204,21,0.7)' : 'rgba(250,204,21,0.35)';
          ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -time * 30; ctx.stroke(); ctx.setLineDash([]);
        }
        if (isBeingDragged) {
          const dg = ctx.createRadialGradient(node.x, node.y, baseR, node.x, node.y, baseR + 30);
          dg.addColorStop(0, 'rgba(250,204,21,0.25)'); dg.addColorStop(1, 'rgba(250,204,21,0)');
          ctx.beginPath(); ctx.arc(node.x, node.y, baseR + 30, 0, Math.PI * 2); ctx.fillStyle = dg; ctx.fill();
        }
        const glowR = baseR + 12 + pulse;
        const glow = ctx.createRadialGradient(node.x, node.y, baseR, node.x, node.y, glowR);
        glow.addColorStop(0, node.color + Math.round(alpha * 40).toString(16).padStart(2, '0'));
        glow.addColorStop(1, node.color + '00');
        ctx.beginPath(); ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();

        ctx.beginPath(); ctx.arc(node.x, node.y, baseR + pulse * 0.3, 0, Math.PI * 2);
        const mg = ctx.createRadialGradient(node.x - baseR * 0.3, node.y - baseR * 0.3, 0, node.x, node.y, baseR);
        mg.addColorStop(0, node.color + 'ee'); mg.addColorStop(1, node.color + '88');
        ctx.fillStyle = mg; ctx.globalAlpha = alpha; ctx.fill();
        ctx.strokeStyle = node.color; ctx.lineWidth = 1.5 * s; ctx.stroke(); ctx.globalAlpha = 1;

        ctx.font = `${12 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(node.icon, node.x, node.y);
        ctx.font = `${Math.max(8, 10 * s)}px Inter,system-ui,sans-serif`;
        ctx.fillStyle = `rgba(226,232,240,${alpha})`; ctx.textAlign = 'center';
        ctx.fillText(node.name, node.x, node.y + baseR + 12);
        if (node.isPinned && !isBeingDragged) {
          ctx.font = `${9 * s}px sans-serif`; ctx.fillText('📌', node.x + baseR + 4, node.y - baseR - 2);
        }
      });

      // Interaction hint
      ctx.font = '10px Inter,system-ui,sans-serif';
      ctx.fillStyle = 'rgba(148,163,184,0.35)';
      ctx.textAlign = 'left';
      ctx.fillText('Drag to pin  •  Double-click to unpin  •  Right-click to unpin all', 12, h - 12);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [getHelixPosition, getOrbitalPosition, initParticles]);

  return (
    <div className="relative w-full h-full" style={{ background: '#050810' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{
          display: 'block', width: '100%', height: '100%',
          cursor: dragActive ? 'grabbing' : hoveredNode ? 'grab' : 'default',
        }}
      />

      {/* Controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 flex-wrap justify-center rounded-xl px-3 py-2"
        style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(148,163,184,0.15)', backdropFilter: 'blur(12px)' }}>
        <button
          onClick={() => setPaused(p => !p)}
          className="rounded-lg px-3 py-1 text-xs text-slate-200 transition-colors"
          style={{ background: paused ? 'rgba(96,165,250,0.2)' : 'rgba(248,113,113,0.2)', border: `1px solid ${paused ? 'rgba(96,165,250,0.4)' : 'rgba(248,113,113,0.4)'}` }}
        >
          {paused ? '▶ Play' : '⏸ Pause'}
        </button>

        <span className="text-[11px] text-slate-500">Speed</span>
        <input type="range" min="0.05" max="1.5" step="0.05" value={helixSpeed}
          onChange={e => setHelixSpeed(parseFloat(e.target.value))}
          className="w-20" style={{ accentColor: '#60a5fa' }} />

        <button
          onClick={() => setViewMode(v => v === 'helix' ? 'orbital' : 'helix')}
          className="rounded-lg px-3 py-1 text-xs text-slate-200"
          style={{ background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(147,51,234,0.4)' }}
        >
          {viewMode === 'helix' ? '🧬 Helix' : '🌀 Orbital'}
        </button>

        {pinnedCount > 0 && (
          <button onClick={unpinAll}
            className="rounded-lg px-3 py-1 text-xs"
            style={{ background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.35)', color: '#fcd34d' }}>
            📌 Unpin ({pinnedCount})
          </button>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredNode && !dragActive && (
        <div className="absolute pointer-events-none rounded-xl px-3 py-2.5"
          style={{
            left: Math.min(mouseRef.current.x + 16, 560),
            top: Math.max(mouseRef.current.y - 50, 8),
            background: 'rgba(15,23,42,0.95)',
            border: `1px solid ${hoveredNode.color}55`,
            backdropFilter: 'blur(12px)',
            boxShadow: `0 0 20px ${hoveredNode.color}22`,
          }}>
          <div className="text-sm font-semibold" style={{ color: hoveredNode.color }}>
            {hoveredNode.icon} {hoveredNode.name}
            {hoveredNode.isPinned && <span className="ml-1.5 text-[10px] text-yellow-300">📌</span>}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {CONNECTIONS.filter(c => c.from === hoveredNode.id).length} outbound &nbsp;•&nbsp;
            {CONNECTIONS.filter(c => c.to === hoveredNode.id).length} inbound
          </div>
        </div>
      )}
    </div>
  );
}
