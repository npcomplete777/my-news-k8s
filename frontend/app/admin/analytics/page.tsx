'use client';

import { useState, useEffect, useCallback } from 'react';

interface PageView {
  ts: string;
  path: string;
  title: string;
  referrer: string;
  vp_w: string;
  vp_h: string;
  seconds: string;
  ua: string;
  tz: string;
  lang: string;
  sw: string;
  sh: string;
  dpr: string;
  platform: string;
  hw_cores: string;
  device_memory: string;
  color_scheme: string;
  touch_points: string;
  connection: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  isp: string;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseBrowser(ua: string): string {
  if (!ua) return '—';
  const edgeM = ua.match(/Edg\/([\d]+)/);  if (edgeM) return `Edge ${edgeM[1]}`;
  const oprM = ua.match(/OPR\/([\d]+)/);   if (oprM) return `Opera ${oprM[1]}`;
  const chrM = ua.match(/Chrome\/([\d]+)/); if (chrM) return `Chrome ${chrM[1]}`;
  const ffM = ua.match(/Firefox\/([\d]+)/); if (ffM) return `Firefox ${ffM[1]}`;
  const safM = ua.match(/Version\/([\d]+)/);
  if (safM && /Safari/.test(ua)) return `Safari ${safM[1]}`;
  return 'Other';
}

function parseBrowserFamily(ua: string): string {
  if (!ua) return 'Other';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

function parseOS(ua: string): string {
  if (!ua) return '—';
  if (/iPhone/.test(ua)) return 'iOS';
  if (/iPad/.test(ua)) return 'iPadOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

function shortRef(ref: string): string {
  if (!ref) return '—';
  try { return new URL(ref).hostname.replace('www.', ''); } catch { return ref.slice(0, 30); }
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function topN(values: string[], n = 8): [string, number][] {
  const counts: Record<string, number> = {};
  for (const v of values) if (v) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ── Components ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">{label}</p>
      <p className="text-2xl font-black tabular-nums text-stone-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function BreakdownCard({ title, data, flag = false }: { title: string; data: [string, number][]; flag?: boolean }) {
  const total = data.reduce((s, [, n]) => s + n, 0);
  if (data.length === 0) return null;
  return (
    <div className="card flex flex-col gap-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">{title}</p>
      <div className="flex flex-col gap-2">
        {data.map(([label, count]) => (
          <div key={label}>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-stone-700 dark:text-zinc-300 truncate">
                {flag && label.length === 2 ? `${countryFlag(label)} ` : ''}{label || '—'}
              </span>
              <span className="tabular-nums text-stone-400 dark:text-zinc-600 ml-2 shrink-0">
                {count} <span className="text-stone-300 dark:text-zinc-700">({Math.round(count / total * 100)}%)</span>
              </span>
            </div>
            <div className="h-1 bg-stone-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 dark:bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    const res = await fetch('/api/admin/analytics?days=1', {
      headers: { Authorization: `Bearer ${pw}` },
    });
    if (res.ok) { sessionStorage.setItem('admin_pw', pw); onAuth(pw); }
    else setError(true);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">Admin</p>
          <h1 className="font-display font-black uppercase text-4xl text-stone-900 dark:text-zinc-100">Analytics</h1>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="Password" autoFocus
            className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {error && <p className="text-xs text-red-500">Incorrect password.</p>}
          <button type="submit"
            className="rounded-lg bg-stone-900 dark:bg-zinc-100 px-4 py-3 text-sm font-bold text-white dark:text-zinc-900 hover:bg-stone-700 dark:hover:bg-zinc-300 transition-colors">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [rows, setRows] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = sessionStorage.getItem('admin_pw');
    if (stored) setPassword(stored);
  }, []);

  const fetchData = useCallback(async (pw: string, d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`, {
        headers: { Authorization: `Bearer ${pw}` },
      });
      if (!res.ok) { setPassword(null); return; }
      setRows(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (password) fetchData(password, days); }, [password, days, fetchData]);

  if (!mounted) return null;
  if (!password) return <PasswordGate onAuth={pw => setPassword(pw)} />;

  // ── Stats ──
  const totalVisits = rows.length;
  const uniquePaths = new Set(rows.map(r => r.path)).size;
  const avgSeconds = rows.length
    ? Math.round(rows.reduce((s, r) => s + parseFloat(r.seconds || '0'), 0) / rows.length)
    : 0;
  const topPath = rows.length
    ? topN(rows.map(r => r.path || '/'), 1)[0]?.[0] ?? '—'
    : '—';

  // ── Breakdowns ──
  const browsers   = topN(rows.map(r => parseBrowserFamily(r.ua)));
  const oses       = topN(rows.map(r => parseOS(r.ua)));
  const countries  = topN(rows.map(r => r.country).filter(Boolean));
  const timezones  = topN(rows.map(r => r.tz).filter(Boolean));
  const connections = topN(rows.map(r => r.connection).filter(Boolean));
  const colorSchemes = topN(rows.map(r => r.color_scheme).filter(Boolean));
  const screens    = topN(rows.map(r => r.sw && r.sh ? `${r.sw}×${r.sh}` : '').filter(Boolean));
  const paths      = topN(rows.map(r => r.path || '/'));

  const hasGeo = rows.some(r => r.country);
  const hasConnection = rows.some(r => r.connection);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 pb-20 pt-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="border-t-2 border-stone-900 dark:border-zinc-100 pt-6 mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1">
              Admin · Browser Analytics
            </p>
            <h1 className="font-display font-black uppercase leading-[0.95] text-5xl text-stone-900 dark:text-zinc-100">
              Page Views
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  days === d
                    ? 'bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-100'
                }`}>
                {d}d
              </button>
            ))}
            <button onClick={() => { sessionStorage.removeItem('admin_pw'); setPassword(null); }}
              className="ml-4 text-xs text-stone-400 dark:text-zinc-600 hover:text-red-500 transition-colors">
              Sign out
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          <StatCard label="Page Views" value={loading ? '…' : totalVisits} />
          <StatCard label="Unique Pages" value={loading ? '…' : uniquePaths} />
          <StatCard label="Avg Time on Page" value={loading ? '…' : `${avgSeconds}s`} />
          <StatCard label="Top Page" value={loading ? '…' : topPath} />
        </div>

        {/* Breakdown grid */}
        {!loading && rows.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
            <BreakdownCard title="Top Pages" data={paths} />
            <BreakdownCard title="Browsers" data={browsers} />
            <BreakdownCard title="Operating Systems" data={oses} />
            {hasGeo && <BreakdownCard title="Countries" data={countries} flag={false} />}
            <BreakdownCard title="Timezones" data={timezones} />
            {hasConnection && <BreakdownCard title="Connection Type" data={connections} />}
            <BreakdownCard title="Color Scheme" data={colorSchemes} />
            <BreakdownCard title="Screen Resolutions" data={screens} />
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton h-8 w-full rounded" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-stone-400 dark:text-zinc-600">
            No page views in the last {days} days — browser SDK may not have data yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900">
                  {['Time', 'Path', 'Duration', 'Browser', 'OS', 'Location', 'Connection', 'Screen', 'Scheme', 'Referrer'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const flag = countryFlag(row.country_code);
                  const location = row.country
                    ? `${flag} ${row.country}${row.city ? ` · ${row.city}` : ''}`
                    : '—';
                  return (
                    <tr key={i}
                      className="border-b border-stone-100 dark:border-zinc-800/50 last:border-0 hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-3 py-2 font-mono text-stone-400 dark:text-zinc-600 whitespace-nowrap">{row.ts}</td>
                      <td className="px-3 py-2 font-medium text-stone-900 dark:text-zinc-100 max-w-[180px] truncate" title={row.path}>{row.path || '/'}</td>
                      <td className="px-3 py-2 tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {parseFloat(row.seconds) > 0 ? `${row.seconds}s` : '—'}
                      </td>
                      <td className="px-3 py-2 text-stone-600 dark:text-zinc-400 whitespace-nowrap">{parseBrowser(row.ua)}</td>
                      <td className="px-3 py-2 text-stone-600 dark:text-zinc-400 whitespace-nowrap">{parseOS(row.ua)}</td>
                      <td className="px-3 py-2 text-stone-500 dark:text-zinc-500 whitespace-nowrap max-w-[160px] truncate" title={location}>{location}</td>
                      <td className="px-3 py-2 text-stone-400 dark:text-zinc-600 whitespace-nowrap">{row.connection || '—'}</td>
                      <td className="px-3 py-2 font-mono text-stone-400 dark:text-zinc-600 whitespace-nowrap">
                        {row.sw && row.sh ? `${row.sw}×${row.sh}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-stone-400 dark:text-zinc-600 whitespace-nowrap">{row.color_scheme || '—'}</td>
                      <td className="px-3 py-2 text-stone-400 dark:text-zinc-600 max-w-[140px] truncate" title={row.referrer}>
                        {shortRef(row.referrer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
