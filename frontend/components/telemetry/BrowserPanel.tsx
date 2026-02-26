'use client';

import { useBrowserSpans, useNavTiming, useVisitorProfile } from '@/lib/hooks/useBrowserTelemetry';
import type { BrowserSpan, } from '@/lib/otel-browser';
import type { VisitorProfile } from '@/lib/hooks/useBrowserTelemetry';
import { format } from 'date-fns';
import { clsx } from 'clsx';

// ── UA parsers ────────────────────────────────────────────────────────────────

function parseBrowser(ua: string): string {
  if (!ua) return '—';
  const edgeM = ua.match(/Edg\/([\d]+)/);
  if (edgeM) return `Edge ${edgeM[1]}`;
  const oprM = ua.match(/OPR\/([\d]+)/);
  if (oprM) return `Opera ${oprM[1]}`;
  const chromeM = ua.match(/Chrome\/([\d]+)/);
  if (chromeM) return `Chrome ${chromeM[1]}`;
  const ffM = ua.match(/Firefox\/([\d]+)/);
  if (ffM) return `Firefox ${ffM[1]}`;
  const safM = ua.match(/Version\/([\d]+)/);
  if (safM && /Safari/.test(ua)) return `Safari ${safM[1]}`;
  return 'Unknown';
}

function parseOS(ua: string): string {
  if (!ua) return '—';
  if (/iPhone/.test(ua)) {
    const v = ua.match(/CPU iPhone OS ([\d_]+)/);
    return v ? `iOS ${v[1].replace(/_/g, '.')}` : 'iOS';
  }
  if (/iPad/.test(ua)) {
    const v = ua.match(/CPU OS ([\d_]+)/);
    return v ? `iPadOS ${v[1].replace(/_/g, '.')}` : 'iPadOS';
  }
  if (/Android/.test(ua)) {
    const v = ua.match(/Android ([\d.]+)/);
    return v ? `Android ${v[1]}` : 'Android';
  }
  if (/Macintosh|Mac OS X/.test(ua)) {
    const v = ua.match(/Mac OS X ([\d_]+)/);
    return v ? `macOS ${v[1].replace(/_/g, '.')}` : 'macOS';
  }
  if (/Windows NT ([\d.]+)/.test(ua)) {
    const v = ua.match(/Windows NT ([\d.]+)/);
    const map: Record<string, string> = { '10.0': '10 / 11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    return `Windows ${v ? (map[v[1]] ?? v[1]) : ''}`;
  }
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// ── Visitor Profile Card ──────────────────────────────────────────────────────

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-[3px]">
      <span className="text-[10px] uppercase tracking-widest text-zinc-600 shrink-0 whitespace-nowrap">{label}</span>
      <span className={clsx(
        'text-xs text-right text-zinc-200 leading-snug',
        mono && 'font-mono',
        !value && 'text-zinc-600',
      )}>
        {value || '—'}
      </span>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: { label: string; value: string; mono?: boolean }[] }) {
  return (
    <div className="flex flex-col gap-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-500 mb-1 mt-0.5">{title}</p>
      {rows.map(r => <Row key={r.label} {...r} />)}
    </div>
  );
}

function VisitorProfileCard() {
  const p = useVisitorProfile();

  if (!p) {
    return (
      <div className="card animate-pulse h-32 flex items-center justify-center">
        <p className="text-xs text-zinc-600">Reading browser environment…</p>
      </div>
    );
  }

  const browser = parseBrowser(p.userAgent);
  const os = parseOS(p.userAgent);
  const flag = countryFlag(p.countryCode);
  const locationStr = [flag, p.country, p.region && `· ${p.region}`, p.city && `· ${p.city}`]
    .filter(Boolean).join(' ') || (p.geoLoaded ? 'Unknown' : 'Looking up…');

  const deviceSections: { label: string; value: string; mono?: boolean }[][] = [
    [
      { label: 'Browser', value: browser },
      { label: 'OS', value: os },
      { label: 'Platform', value: p.platform || '—' },
      { label: 'CPU Cores', value: String(p.hardwareConcurrency) },
      { label: 'RAM', value: p.deviceMemoryGb != null ? `≥${p.deviceMemoryGb} GB (bucket)` : 'Not disclosed' },
      { label: 'Touchscreen', value: p.maxTouchPoints > 0 ? `Yes (${p.maxTouchPoints} pts)` : 'No' },
    ],
    [
      { label: 'Screen', value: `${p.screenWidth}×${p.screenHeight}` },
      { label: 'Viewport', value: `${p.viewportWidth}×${p.viewportHeight}` },
      { label: 'Pixel Ratio', value: `${p.devicePixelRatio}×` },
      { label: 'Color Depth', value: `${p.colorDepth}-bit` },
      { label: 'Color Scheme', value: p.colorScheme },
    ],
  ];

  return (
    <div className="card border-zinc-800 bg-zinc-950/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            OpenTelemetry Browser SDK
          </p>
          <h3 className="text-sm font-semibold text-zinc-100 mt-0.5">
            What This Site Sees About You
          </h3>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · No Login
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Section
          title="Device & Browser"
          rows={deviceSections[0]}
        />
        <Section
          title="Display"
          rows={deviceSections[1]}
        />
        <Section
          title="Network"
          rows={[
            { label: 'Connection', value: p.connectionType ?? 'Not disclosed' },
            { label: 'Downlink', value: p.downlinkMbps != null ? `${p.downlinkMbps} Mbps` : 'Not disclosed' },
            { label: 'RTT', value: p.rttMs != null ? `${p.rttMs} ms` : 'Not disclosed' },
            { label: 'Save Data', value: p.saveData ? 'On' : 'Off' },
            { label: 'Online', value: p.online ? 'Yes' : 'No' },
          ]}
        />
        <Section
          title="Identity Signals"
          rows={[
            { label: 'Language', value: p.language },
            { label: 'All Languages', value: p.languages.join(', ') },
            { label: 'Timezone', value: p.timezone },
            { label: 'Cookies', value: p.cookiesEnabled ? 'Enabled' : 'Disabled' },
            { label: 'Do Not Track', value: p.doNotTrack === '1' ? 'Requested' : p.doNotTrack === '0' ? 'Not set' : 'Unspecified' },
          ]}
        />
        <Section
          title="Location (IP Geo)"
          rows={[
            { label: 'Location', value: locationStr },
            { label: 'ISP', value: p.isp || (p.geoLoaded ? 'Unknown' : '…') },
            { label: 'Timezone (IP)', value: p.geoTimezone || (p.geoLoaded ? 'Unknown' : '…') },
          ]}
        />
      </div>

      <p className="mt-4 text-[10px] text-zinc-700 leading-relaxed border-t border-zinc-800 pt-3">
        All values above are captured by the{' '}
        <span className="text-zinc-500">OpenTelemetry JS SDK</span> running in your browser and stored
        in <span className="text-zinc-500">ClickHouse</span> as span attributes on each{' '}
        <span className="font-mono text-zinc-500">page.view</span> span. No login required.
        RAM shows an approximate bucket per the Device Memory API spec.
        Location is derived server-side from your IP via{' '}
        <span className="text-zinc-500">ipwho.is</span> — your IP is never stored.
      </p>
    </div>
  );
}

// ── Nav Timing ─────────────────────────────────────────────────────────────────

function NavTimingGrid() {
  const { ttfbMs, domReadyMs, loadMs, fcpMs } = useNavTiming();

  const metrics = [
    { label: 'TTFB', value: ttfbMs, unit: 'ms', color: 'text-amber-400' },
    { label: 'FCP', value: fcpMs, unit: 'ms', color: 'text-emerald-400' },
    { label: 'DOM Ready', value: domReadyMs, unit: 'ms', color: 'text-blue-400' },
    { label: 'Load', value: loadMs, unit: 'ms', color: 'text-purple-400' },
  ];

  return (
    <div className="card flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-zinc-500">
        Page Performance
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(m => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-stone-500 dark:text-zinc-600">{m.label}</span>
            {m.value !== null ? (
              <span className={clsx('text-xl font-bold tabular-nums', m.color)}>
                {m.value}
                <span className="text-xs font-normal text-stone-500 dark:text-zinc-500 ml-0.5">{m.unit}</span>
              </span>
            ) : (
              <span className="text-xl font-bold text-stone-400 dark:text-zinc-600">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Span List ─────────────────────────────────────────────────────────────────

function SpanRow({ span }: { span: BrowserSpan }) {
  let ts = '';
  try { ts = format(new Date(span.startTime), 'HH:mm:ss.SSS'); } catch { ts = String(span.startTime); }

  const durationLabel =
    span.durationMs < 1 ? `${Math.round(span.durationMs * 1000)}μs` : `${Math.round(span.durationMs)}ms`;

  const statusClass =
    span.status === 'ERROR' ? 'bg-red-900/50 text-red-400'
    : span.status === 'OK' ? 'bg-emerald-900/40 text-emerald-400'
    : 'bg-zinc-800 text-zinc-500';

  return (
    <div className="flex gap-2 items-start py-1.5 border-b border-stone-200 dark:border-zinc-800/50 last:border-0 text-xs">
      <span className="shrink-0 font-mono text-stone-500 dark:text-zinc-600 w-24">{ts}</span>
      <span className="flex-1 text-stone-700 dark:text-zinc-300 break-words min-w-0 font-mono">{span.name}</span>
      <span className={clsx('badge shrink-0', statusClass)}>{durationLabel}</span>
      <span className="shrink-0 font-mono text-stone-400 dark:text-zinc-600">{span.traceId.slice(0, 8)}</span>
    </div>
  );
}

function BrowserSpanList() {
  const spans = useBrowserSpans();
  if (spans.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-stone-500 dark:text-zinc-500">
        Waiting for spans… (navigate around or trigger requests)
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-stone-200 dark:border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono">
      {spans.slice(0, 10).map((span, i) => <SpanRow key={`${span.spanId}-${i}`} span={span} />)}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function BrowserPanel() {
  return (
    <div className="flex flex-col gap-4">
      <VisitorProfileCard />
      <NavTimingGrid />
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-zinc-500">
          Recent Browser Spans
        </h3>
        <BrowserSpanList />
      </div>
    </div>
  );
}
