'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high';
type RenderFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

interface Pattern {
  id: number;
  name: string;
  alias: string;
  severity: Severity;
  description: string;
  geometry: string;
  entropy: string;
  fix: string;
  renderTrace: RenderFn;
}

// ─── Pattern data (12 anti-patterns with canvas renderers) ───────────────────

const PATTERNS: Pattern[] = [
  {
    id: 1,
    name: 'N+1 Query',
    alias: 'The Comb',
    severity: 'critical',
    description: 'Sequential repeated calls that scale linearly with input cardinality. Each tooth is an identical operation that should have been batched.',
    geometry: 'High fan-out · Homogeneous children · Sequential · Linear scaling',
    entropy: 'O(2N+2) → O(3)',
    fix: 'Replace with a single batched query using IN clause or a JOIN. One round-trip instead of N.',
    renderTrace: (ctx, w, h, t) => {
      const spine_y = 28;
      const teeth = 8;
      const spacing = (w - 60) / (teeth - 1);
      const startX = 30;
      ctx.strokeStyle = '#c8b4ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(startX - 10, spine_y);
      ctx.lineTo(w - startX + 10, spine_y);
      ctx.stroke();
      for (let i = 0; i < teeth; i++) {
        const x = startX + i * spacing;
        const delay = i * 0.12;
        const progress = Math.max(0, Math.min(1, (t - delay) * 2));
        const toothLen = progress * (h - 55);
        ctx.strokeStyle = `rgba(167, 139, 250, ${0.4 + progress * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, spine_y);
        ctx.lineTo(x, spine_y + toothLen);
        ctx.stroke();
        if (progress > 0.1) {
          ctx.fillStyle = '#a78bfa';
          ctx.beginPath();
          ctx.arc(x, spine_y, 3, 0, Math.PI * 2);
          ctx.fill();
          if (progress > 0.9) {
            ctx.fillStyle = '#7c3aed';
            ctx.beginPath();
            ctx.arc(x, spine_y + toothLen, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
  },
  {
    id: 2,
    name: 'Sync-over-Async',
    alias: 'The Lollipop',
    severity: 'critical',
    description: 'A blocking .Wait() or .Result call on an async operation. Fast cluster of work dwarfed by one massively long stem that blocks the entire request thread.',
    geometry: 'Moderate fan-out · One dominant child · Extreme bimodal duration',
    entropy: 'Request blocked on non-critical path',
    fix: 'Replace .Result/.Wait() with await. Use ConfigureAwait(false) in library code to prevent SyncContext capture.',
    renderTrace: (ctx, w, h, t) => {
      const cx = w / 2;
      const clusterY = 30;
      const nodes = 5;
      for (let i = 0; i < nodes; i++) {
        const angle = (i / nodes) * Math.PI * 2 - Math.PI / 2;
        const radius = 22;
        const nx = cx + Math.cos(angle) * radius;
        const ny = clusterY + Math.sin(angle) * radius;
        const fadeIn = Math.max(0, Math.min(1, (t - i * 0.05) * 3));
        ctx.strokeStyle = `rgba(52, 211, 153, ${fadeIn * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, clusterY);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.fillStyle = `rgba(52, 211, 153, ${fadeIn})`;
        ctx.beginPath();
        ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(cx, clusterY, 4, 0, Math.PI * 2);
      ctx.fill();
      const stemProgress = Math.max(0, Math.min(1, (t - 0.3) * 0.8));
      const stemLen = stemProgress * (h - 70);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, clusterY + 25);
      ctx.lineTo(cx, clusterY + 25 + stemLen);
      ctx.stroke();
      ctx.setLineDash([]);
      if (stemProgress > 0.8) {
        const pulse = Math.sin(t * 5) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.beginPath();
        ctx.arc(cx, clusterY + 25 + stemLen, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 3,
    name: 'Retry Storm',
    alias: 'The Staircase',
    severity: 'critical',
    description: 'Cascading retries with increasing latency. Each step represents another failed attempt with growing delays, amplifying load on an already struggling service.',
    geometry: 'Repeated calls to same target · Sequential with increasing gaps · Terminal timeout',
    entropy: 'Exponential state explosion under failure',
    fix: 'Exponential backoff with jitter + circuit breaker. Cap total retry budget. Coordinate retries across instances with a shared token bucket.',
    renderTrace: (ctx, w, h, t) => {
      const steps = 6;
      const stepW = (w - 40) / steps;
      const stepH = (h - 40) / steps;
      for (let i = 0; i < steps; i++) {
        const delay = i * 0.15;
        const progress = Math.max(0, Math.min(1, (t - delay) * 2));
        const x = 20 + i * stepW;
        const y = 20 + i * stepH;
        const intensity = i / (steps - 1);
        ctx.strokeStyle = `rgba(251, ${Math.round(180 - intensity * 130)}, ${Math.round(71 - intensity * 50)}, ${progress})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + stepW, y);
        ctx.stroke();
        if (i < steps - 1) {
          ctx.strokeStyle = `rgba(251, ${Math.round(180 - intensity * 130)}, ${Math.round(71 - intensity * 50)}, ${progress * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x + stepW, y);
          ctx.lineTo(x + stepW, y + stepH);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (progress > 0.5) {
          ctx.fillStyle = `rgb(251, ${Math.round(180 - intensity * 130)}, ${Math.round(71 - intensity * 50)})`;
          ctx.beginPath();
          ctx.arc(x + stepW, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (t > 1.0) {
        const pulse = Math.sin(t * 4) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.lineWidth = 3;
        const ex = w - 25, ey = h - 25;
        ctx.beginPath();
        ctx.moveTo(ex - 8, ey - 8); ctx.lineTo(ex + 8, ey + 8);
        ctx.moveTo(ex + 8, ey - 8); ctx.lineTo(ex - 8, ey + 8);
        ctx.stroke();
      }
    },
  },
  {
    id: 4,
    name: 'Circuit Breaker Oscillation',
    alias: 'The Sawtooth',
    severity: 'high',
    description: 'Periodic alternation between fast-fail and slow-fail states. The circuit breaker opens and closes in a destructive rhythm, never stabilizing into recovery.',
    geometry: 'Oscillating duration distribution · Periodic rise-and-crash',
    entropy: 'Bistable system unable to converge',
    fix: 'Tune the half-open probe rate and success threshold. Add jitter to prevent synchronized re-opening across instances.',
    renderTrace: (ctx, w, h, t) => {
      const mid = h / 2;
      const amp = h * 0.32;
      const cycles = 3.5;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const progress = Math.max(0, Math.min(1, (t * 1.2 - (x / w) * 0.8)));
        if (progress <= 0) break;
        const xNorm = x / w;
        const sawPhase = (xNorm * cycles) % 1;
        const y = mid - amp * (sawPhase * 2 - 1) * (sawPhase < 0.85 ? 1 : -3);
        const clampedY = Math.max(10, Math.min(h - 10, y));
        if (x === 0) ctx.moveTo(x, clampedY);
        else ctx.lineTo(x, clampedY);
      }
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let i = 0; i < Math.floor(cycles); i++) {
        const crashX = ((i + 0.85) / cycles) * w;
        const crashProgress = Math.max(0, Math.min(1, t * 1.2 - (crashX / w) * 0.8));
        if (crashX < w && crashProgress > 0.5) {
          ctx.fillStyle = `rgba(239, 68, 68, ${crashProgress})`;
          ctx.beginPath();
          ctx.arc(crashX, mid + amp * 0.6, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 5,
    name: 'Connection Pool Exhaustion',
    alias: 'The Hourglass',
    severity: 'critical',
    description: 'Flow constricts at a single shared resource. Healthy connections shrink while the waiting queue grows, starving all dependent services of database access.',
    geometry: 'Bimodal duration (instant vs wait-timeout) · Progressive degradation',
    entropy: 'Shared resource becomes single point of serialization',
    fix: 'Right-size pool based on DB capacity, not application demand. Instrument pool wait time as a metric. Add request-level timeouts shorter than pool wait.',
    renderTrace: (ctx, w, h, t) => {
      const cx = w / 2, cy = h / 2;
      const neckW = 8, topW = w * 0.38;
      ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
      ctx.beginPath();
      ctx.moveTo(cx - topW, 8); ctx.lineTo(cx + topW, 8);
      ctx.lineTo(cx + neckW, cy); ctx.lineTo(cx - neckW, cy);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.beginPath();
      ctx.moveTo(cx - neckW, cy); ctx.lineTo(cx + neckW, cy);
      ctx.lineTo(cx + topW, h - 8); ctx.lineTo(cx - topW, h - 8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1.5; ctx.stroke();
      const particles = 12;
      for (let i = 0; i < particles; i++) {
        const pt = ((t * 0.6 + i / particles) % 1);
        const delay = i * 0.05;
        const pProgress = Math.max(0, Math.min(1, (t - delay) * 1.5));
        if (pProgress <= 0) continue;
        let px, py;
        if (pt < 0.45) {
          const localT = pt / 0.45;
          const spread = topW * (1 - localT * 0.9);
          px = cx + (Math.sin(i * 2.5) * spread);
          py = 12 + localT * (cy - 16);
        } else if (pt < 0.55) {
          px = cx + (Math.sin(i * 2.5) * neckW * 0.5);
          py = cy;
        } else {
          const localT = (pt - 0.55) / 0.45;
          const spread = topW * localT * 0.9;
          px = cx + (Math.sin(i * 2.5) * spread);
          py = cy + 4 + localT * (cy - 16);
        }
        const isBlocked = pt > 0.4 && pt < 0.6;
        ctx.fillStyle = isBlocked ? `rgba(251, 191, 36, ${pProgress})` : `rgba(96, 165, 250, ${pProgress * 0.8})`;
        ctx.beginPath();
        ctx.arc(px, py, isBlocked ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 6,
    name: 'Cascading Timeout',
    alias: 'The Domino Chain',
    severity: 'critical',
    description: 'Timeout configuration mismatch across service boundaries. Service A waits longer than B, which waits longer than C — creating unpredictable failure propagation upstream.',
    geometry: 'Chain of decreasing timeout spans · Terminal failure propagates backward',
    entropy: 'Timeout misconfiguration amplifies through depth',
    fix: 'Enforce outer timeout < sum of inner timeouts. Use a propagated deadline context. Never configure downstream timeouts longer than upstream.',
    renderTrace: (ctx, w, h, t) => {
      const levels = 5;
      const barH = 14;
      const gap = (h - levels * barH - 20) / (levels - 1);
      for (let i = 0; i < levels; i++) {
        const delay = i * 0.18;
        const progress = Math.max(0, Math.min(1, (t - delay) * 1.8));
        const y = 10 + i * (barH + gap);
        const barW = (w - 40) * (1 - i * 0.17) * progress;
        const indent = i * 12;
        const hue = 200 - i * 40;
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${progress * 0.7})`;
        ctx.beginPath();
        ctx.roundRect(indent + 10, y, barW, barH, 3);
        ctx.fill();
        if (progress > 0.8 && i < levels - 1) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${(progress - 0.8) * 5 * (Math.sin(t * 4 + i) * 0.3 + 0.7)})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(indent + 10 + barW, y - 2);
          ctx.lineTo(indent + 10 + barW, y + barH + 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (t > 1.0) {
        const arrowProgress = Math.min(1, (t - 1.0) * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${arrowProgress * 0.6})`;
        ctx.lineWidth = 1.5;
        for (let i = levels - 1; i > Math.max(0, levels - 1 - Math.floor(arrowProgress * levels)); i--) {
          const y1 = 10 + i * (barH + gap) + barH / 2;
          const y2 = 10 + (i - 1) * (barH + gap) + barH / 2;
          const x = w - 20;
          ctx.beginPath();
          ctx.moveTo(x, y1); ctx.lineTo(x, y2);
          ctx.lineTo(x - 4, y2 + 5); ctx.moveTo(x, y2); ctx.lineTo(x + 4, y2 + 5);
          ctx.stroke();
        }
      }
    },
  },
  {
    id: 7,
    name: 'Thread / Goroutine Leak',
    alias: 'The Expanding Fan',
    severity: 'high',
    description: 'Fan-out increases over time without corresponding fan-in. Resources are spawned but never reclaimed, leading to gradual memory exhaustion and eventual OOMKill.',
    geometry: 'Monotonically increasing fan-out · Missing completions · Growing resource count',
    entropy: 'Unbounded state accumulation',
    fix: 'Always use context cancellation. Instrument goroutine/thread count as a gauge metric. Alert on monotonic increase over a 5-minute window.',
    renderTrace: (ctx, w, h, t) => {
      const cx = 20, cy = h / 2;
      const rays = 14;
      const maxLen = w - 40;
      for (let i = 0; i < rays; i++) {
        const angleSpread = Math.PI * 0.75;
        const angle = -angleSpread / 2 + (i / (rays - 1)) * angleSpread;
        const delay = i * 0.08;
        const progress = Math.max(0, Math.min(1, (t - delay) * 1.5));
        const len = progress * (maxLen * (0.3 + (i / rays) * 0.7));
        const endX = cx + Math.cos(angle) * len;
        const endY = cy + Math.sin(angle) * len;
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.3 + progress * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(endX, endY);
        ctx.stroke();
        if (progress > 0.8) {
          ctx.strokeStyle = `rgba(168, 85, 247, ${progress})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(endX, endY, 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      if (t > 0.6) {
        const memProgress = Math.min(1, (t - 0.6) * 0.8);
        ctx.fillStyle = `rgba(239, 68, 68, ${memProgress * 0.25})`;
        ctx.beginPath();
        ctx.arc(cx, cy, memProgress * (w * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 8,
    name: 'Cache Stampede',
    alias: 'The Burst',
    severity: 'high',
    description: 'A popular cache key expires and hundreds of requests simultaneously hit the database. Single invalidation event amplified into N redundant identical queries.',
    geometry: 'Sudden high fan-out from single trigger · All children identical · Concurrent',
    entropy: 'Single event multiplied into N redundant operations',
    fix: 'Use probabilistic early expiry (PER) or lock-based stampede prevention. Stagger TTLs with jitter. Use read-through cache with a mutex.',
    renderTrace: (ctx, w, h, t) => {
      const cx = w / 2, cy = h / 2;
      const burstRays = 18;
      const triggerProgress = Math.min(1, t * 3);
      if (triggerProgress > 0) {
        ctx.fillStyle = `rgba(251, 191, 36, ${triggerProgress})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (t > 0.2) {
        const ringProgress = Math.min(1, (t - 0.2) * 1.5);
        const ringR = ringProgress * Math.min(w, h) * 0.45;
        ctx.strokeStyle = `rgba(251, 191, 36, ${(1 - ringProgress) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < burstRays; i++) {
        const angle = (i / burstRays) * Math.PI * 2;
        const progress = Math.max(0, Math.min(1, (t - 0.25) * 2));
        const len = progress * Math.min(w, h) * 0.38;
        const endX = cx + Math.cos(angle) * len;
        const endY = cy + Math.sin(angle) * len;
        ctx.strokeStyle = `rgba(251, 146, 60, ${progress * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(endX, endY);
        ctx.stroke();
        if (progress > 0.7) {
          ctx.fillStyle = `rgba(251, 146, 60, ${progress})`;
          ctx.beginPath();
          ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 9,
    name: 'Async Deadlock',
    alias: 'The Frozen Branch',
    severity: 'critical',
    description: 'Parent blocked on a non-completing async child. Universal shape across .NET SyncContext, Python asyncio, Kotlin runBlocking, and Java CompletableFuture.get().',
    geometry: 'Single non-completing child · Zero concurrent work · Eventual timeout',
    entropy: 'Mutual exclusion in async context eliminates forward progress',
    fix: 'Never block on async in sync context. Use async all the way down. Replace .Result with await, runBlocking with coroutine scope.',
    renderTrace: (ctx, w, h, t) => {
      const cx = w / 2, topY = 20, blockY = topY + 30;
      const parentW = w * 0.7;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.beginPath();
      ctx.roundRect(cx - parentW / 2, topY, parentW, 16, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 1; ctx.stroke();
      const childProgress = Math.min(0.85, t * 0.4);
      const childW = parentW * childProgress;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.beginPath();
      ctx.roundRect(cx - parentW / 2 + 15, blockY + 10, childW, 12, 3);
      ctx.fill();
      const pulse = Math.sin(t * 3) * 0.4 + 0.6;
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(cx - parentW / 2 + 15 + childW - 2, blockY + 10, 20, 12, 3);
      ctx.stroke();
      ctx.setLineDash([]);
      if (t > 0.5) {
        const deadAlpha = Math.min(0.12, (t - 0.5) * 0.15);
        ctx.fillStyle = `rgba(239, 68, 68, ${deadAlpha})`;
        ctx.fillRect(cx - parentW / 2, blockY + 32, parentW, h - blockY - 42);
        const lines = 4;
        for (let i = 0; i < lines; i++) {
          const ly = blockY + 40 + i * 18;
          if (ly > h - 15) break;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(cx - parentW / 2 + 15, ly);
          ctx.lineTo(cx + parentW / 2 - 15, ly);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    },
  },
  {
    id: 10,
    name: 'Hot Partition',
    alias: 'The Imbalanced Tree',
    severity: 'high',
    description: 'One partition key receives the vast majority of traffic while others sit idle. Extreme skew in a nominally distributed system negates every benefit of partitioning.',
    geometry: 'Fan-out to N children · One child dominates duration and throughput',
    entropy: 'Partitioning entropy near zero — distribution without distribution',
    fix: 'Add artificial entropy to the partition key (suffix with hash bucket). Monitor partition skew as a metric. Use consistent hashing with virtual nodes.',
    renderTrace: (ctx, w, h, t) => {
      const rootX = w / 2, rootY = 15;
      const branches = 6, tierY = h * 0.45;
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(rootX, rootY, 4, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < branches; i++) {
        const delay = i * 0.08;
        const progress = Math.max(0, Math.min(1, (t - delay) * 2));
        const x = 20 + (i / (branches - 1)) * (w - 40);
        const isHot = i === 2;
        ctx.strokeStyle = isHot ? `rgba(239, 68, 68, ${progress})` : `rgba(96, 165, 250, ${progress * 0.4})`;
        ctx.lineWidth = isHot ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(rootX, rootY); ctx.lineTo(x, tierY);
        ctx.stroke();
        const subDepth = isHot ? h - tierY - 15 : (h - tierY - 15) * 0.2;
        const subProgress = Math.max(0, Math.min(1, (t - 0.4 - delay) * 1.5));
        ctx.strokeStyle = isHot ? `rgba(239, 68, 68, ${subProgress * 0.8})` : `rgba(96, 165, 250, ${subProgress * 0.25})`;
        ctx.lineWidth = isHot ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, tierY); ctx.lineTo(x, tierY + subDepth * subProgress);
        ctx.stroke();
        ctx.fillStyle = isHot ? `rgba(239, 68, 68, ${progress})` : `rgba(96, 165, 250, ${progress * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, tierY, isHot ? 6 : 3, 0, Math.PI * 2);
        ctx.fill();
        if (isHot && progress > 0.5) {
          const glow = Math.sin(t * 3) * 0.15 + 0.2;
          ctx.fillStyle = `rgba(239, 68, 68, ${glow})`;
          ctx.beginPath();
          ctx.arc(x, tierY, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 11,
    name: 'Memory Leak (Slow)',
    alias: 'The Rising Tide',
    severity: 'high',
    description: 'Objects accumulate in unbounded collections over hours. Invisible in short traces but revealed by correlating span memory attributes across time — a gradual rise toward OOMKill.',
    geometry: 'Normal individual traces · Monotonically increasing resource metric envelope',
    entropy: 'State accumulation without reclamation',
    fix: 'Correlate span count with heap growth over time. Use weak references for caches. Profile with async-profiler or pprof. Alert on heap growth rate, not absolute threshold.',
    renderTrace: (ctx, w, h, t) => {
      const baseY = h - 15;
      const progress = Math.min(1, t * 0.7);
      const waterH = progress * (h - 30) * 0.85;
      const gradient = ctx.createLinearGradient(0, baseY - waterH, 0, baseY);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(5, baseY);
      for (let x = 5; x <= w - 5; x++) {
        const wave = Math.sin(x * 0.08 + t * 3) * 2;
        ctx.lineTo(x, baseY - waterH + wave);
      }
      ctx.lineTo(w - 5, baseY);
      ctx.closePath();
      ctx.fill();
      const spans = 6;
      for (let i = 0; i < spans; i++) {
        const sx = 15 + (i / (spans - 1)) * (w - 50);
        const sy = baseY - waterH - 15 + Math.sin(i * 1.7 + t * 2) * 4;
        const sw = 18 + Math.sin(i * 2.3) * 6;
        const spanProgress = Math.max(0, Math.min(1, (t - i * 0.1) * 2));
        ctx.fillStyle = `rgba(96, 165, 250, ${spanProgress * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, 6, 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(5, 18); ctx.lineTo(w - 5, 18);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  {
    id: 12,
    name: 'Shared Resource Contention',
    alias: 'The Bottleneck Bridge',
    severity: 'high',
    description: 'Two or more independent services sharing a resource (Redis, connection pool) where one service\'s burst degrades the other. Independent work serialized at a single chokepoint.',
    geometry: 'Two independent trace trees converging on single span with queuing',
    entropy: 'Independent entropy streams merge at contention point',
    fix: 'Separate resource pools per service. Use resource namespacing. Instrument pool utilization per caller. Add backpressure at the client level.',
    renderTrace: (ctx, w, h, t) => {
      const cx = w / 2, cy = h / 2;
      const bridgeW = 20;
      const leftNodes: [number, number][] = [[20, 20], [15, cy - 10], [35, cy - 10]];
      for (const [nx, ny] of leftNodes) {
        const progress = Math.max(0, Math.min(1, t * 2));
        ctx.fillStyle = `rgba(96, 165, 250, ${progress * 0.7})`;
        ctx.beginPath();
        ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(20, 20); ctx.lineTo(15, cy - 10);
      ctx.moveTo(20, 20); ctx.lineTo(35, cy - 10);
      ctx.stroke();
      const rightNodes: [number, number][] = [[w - 20, 20], [w - 15, cy - 10], [w - 35, cy - 10]];
      for (const [nx, ny] of rightNodes) {
        const progress = Math.max(0, Math.min(1, t * 2));
        ctx.fillStyle = `rgba(52, 211, 153, ${progress * 0.7})`;
        ctx.beginPath();
        ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w - 20, 20); ctx.lineTo(w - 15, cy - 10);
      ctx.moveTo(w - 20, 20); ctx.lineTo(w - 35, cy - 10);
      ctx.stroke();
      const convProgress = Math.max(0, Math.min(1, (t - 0.3) * 1.5));
      ctx.strokeStyle = `rgba(96, 165, 250, ${convProgress * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(25, cy - 5); ctx.lineTo(cx - bridgeW / 2, cy);
      ctx.stroke();
      ctx.strokeStyle = `rgba(52, 211, 153, ${convProgress * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(w - 25, cy - 5); ctx.lineTo(cx + bridgeW / 2, cy);
      ctx.stroke();
      const pulse = Math.sin(t * 4) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(251, 191, 36, ${convProgress * 0.5 * pulse})`;
      ctx.beginPath();
      ctx.roundRect(cx - bridgeW / 2, cy - 8, bridgeW, 16, 4);
      ctx.fill();
      ctx.strokeStyle = `rgba(251, 191, 36, ${convProgress * 0.8})`;
      ctx.lineWidth = 1.5; ctx.stroke();
      const outProgress = Math.max(0, Math.min(1, (t - 0.7) * 1.5));
      ctx.strokeStyle = `rgba(148, 163, 184, ${outProgress * 0.4})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 12); ctx.lineTo(cx - 25, h - 15);
      ctx.moveTo(cx + 10, cy + 12); ctx.lineTo(cx + 25, h - 15);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
];

// ─── Canvas component ─────────────────────────────────────────────────────────

function TraceCanvas({ pattern, isActive }: { pattern: Pattern; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      ctx.clearRect(0, 0, w, h);
      pattern.renderTrace(ctx, w, h, isActive ? elapsed : Math.min(elapsed, 1.5));
      animRef.current = requestAnimationFrame(animate);
    };

    startTimeRef.current = null;
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [pattern, isActive]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV = {
  critical: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    ring: 'ring-red-500/20',
    label: 'text-red-400',
    badge: 'bg-red-950/60 text-red-400 ring-1 ring-red-500/20',
    dot: 'bg-red-500',
  },
  high: {
    bg: 'rgba(251,191,36,0.06)',
    border: 'rgba(251,191,36,0.2)',
    ring: 'ring-amber-500/20',
    label: 'text-amber-400',
    badge: 'bg-amber-950/60 text-amber-400 ring-1 ring-amber-500/20',
    dot: 'bg-amber-500',
  },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AntiPatternsPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');

  const visible = PATTERNS.filter(p => filter === 'all' || p.severity === filter);
  const critCount = PATTERNS.filter(p => p.severity === 'critical').length;
  const highCount = PATTERNS.filter(p => p.severity === 'high').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">

      {/* ── Hero ── */}
      <div className="relative border-b border-zinc-800/60 overflow-hidden">
        {/* Dot-grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(148,163,184,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400 mb-3">
              VALIS Detection Framework · O11y Alchemy Research
            </p>
            <h1
              className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.1] mb-5"
              style={{
                background: 'linear-gradient(135deg, #e2e8f0 0%, #a78bfa 55%, #7c3aed 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              The Geometry of Failure
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl mb-6">
              Anti-patterns in distributed systems produce characteristic geometric signatures in trace topology space.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href="https://npcomplete777.github.io/o11y-alchemy/posts/geometry-of-failure/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors border border-violet-500/30 hover:border-violet-400/50 rounded-md px-3 py-1.5"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Read the Research
              </a>
              <div className="flex items-center gap-4 text-[11px] text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {critCount} Critical
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {highCount} High
                </span>
                <span className="text-zinc-700">·</span>
                <span>3 languages verified</span>
                <span className="text-zinc-700">·</span>
                <span>99.9% Bayesian confidence</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Concept strip ── */}
      <div className="border-b border-zinc-800/40">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-800/40 rounded-lg overflow-hidden">
            {[
              { label: 'Fan-out', desc: 'Breadth of child spans', icon: '⇶' },
              { label: 'Homogeneity', desc: 'Identical repeated operations', icon: '≡' },
              { label: 'Temporality', desc: 'Sequential vs concurrent', icon: '⟶' },
              { label: 'Scaling', desc: 'Growth relative to input N', icon: '∝' },
            ].map(d => (
              <div key={d.label} className="bg-zinc-900/80 px-4 py-3 flex gap-3 items-start">
                <span className="text-lg text-violet-400/60 font-mono mt-0.5">{d.icon}</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{d.label}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="sticky top-[57px] z-30 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/50">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 hidden sm:block">
            Click any pattern to expand · Hover to animate
          </p>
          <div className="flex gap-1">
            {(['all', 'critical', 'high'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors',
                  filter === f
                    ? f === 'critical' ? 'bg-red-950/60 text-red-400 ring-1 ring-red-500/30'
                    : f === 'high' ? 'bg-amber-950/60 text-amber-400 ring-1 ring-amber-500/30'
                    : 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-400'
                )}
              >
                {f === 'all' ? `All ${PATTERNS.length}` : f === 'critical' ? `Critical ${critCount}` : `High ${highCount}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pattern grid ── */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {visible.map(p => {
            const sev = SEV[p.severity];
            const isActive = hovered === p.id || selected === p.id;
            const isOpen = selected === p.id;

            return (
              <div
                key={p.id}
                onClick={() => setSelected(isOpen ? null : p.id)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isOpen ? sev.bg : hovered === p.id ? 'rgba(148,163,184,0.04)' : 'rgba(148,163,184,0.02)',
                  border: `1px solid ${isOpen ? sev.border : hovered === p.id ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.06)'}`,
                }}
                className="rounded-lg cursor-pointer transition-all duration-200 overflow-hidden"
              >
                {/* Canvas */}
                <div className="h-36 p-3 pb-0">
                  <div className="h-full rounded-md overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)' }}>
                    <TraceCanvas pattern={p} isActive={isActive} />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-sm font-semibold text-zinc-100">{p.name}</span>
                      <span className="ml-2 text-[11px] text-zinc-600 italic">{p.alias}</span>
                    </div>
                    <span className={clsx('shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', sev.badge)}>
                      {p.severity}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{p.description}</p>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-zinc-800/60 flex flex-col gap-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Geometry</p>
                        <p className="text-xs text-violet-300 leading-relaxed">{p.geometry}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Entropy Signal</p>
                        <p className="text-xs text-amber-400 leading-relaxed">{p.entropy}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Fix</p>
                        <p className="text-xs text-emerald-400 leading-relaxed">{p.fix}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Three-layer model callout ── */}
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-xl border border-violet-500/15 bg-violet-950/10 p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400 mb-3">
            Detection Architecture
          </p>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Three-Layer Classification Model</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                layer: '1 — Geometry',
                color: 'text-violet-300',
                desc: 'Universal trace shapes detectable across all languages. Fan-out, homogeneity, temporality, and scaling properties measured from raw span trees.',
              },
              {
                layer: '2 — Semantics',
                color: 'text-blue-300',
                desc: 'Language-aware signal interpretation. Java JDBC span names differ from Python psycopg2, but both produce identical N+1 geometry.',
              },
              {
                layer: '3 — Remediation',
                color: 'text-emerald-300',
                desc: 'Implementation-specific fix recommendations. The geometry identifies the problem; the language context selects the remedy.',
              },
            ].map(l => (
              <div key={l.layer}>
                <p className={clsx('text-xs font-bold mb-2 font-mono', l.color)}>{l.layer}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-zinc-800/40 py-8 text-center">
        <p className="text-xs text-zinc-600 italic">
          The traces are the substrate. The shapes are the signal. The agent is the classifier.
        </p>
        <p className="text-[10px] text-zinc-800 mt-2">
          © 2026 VALIS Detection Framework · O11y Alchemy
        </p>
      </div>
    </div>
  );
}
