import { type NextRequest } from 'next/server';

interface GeoResult {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  timezone: string;
}

// In-memory cache: ip → { data, expiry }
const geoCache = new Map<string, { data: GeoResult; expiry: number }>();

function isPrivateIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

export async function GET(req: NextRequest) {
  // CF-Connecting-IP is the definitive real IP when behind Cloudflare.
  // X-Forwarded-For / X-Real-IP contain Cloudflare edge IPs when proxied, not the visitor.
  const cfIp = req.headers.get('cf-connecting-ip');
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = (cfIp ?? (forwarded ? forwarded.split(',')[0] : realIp ?? '')).trim() || '127.0.0.1';

  if (isPrivateIp(ip)) {
    return Response.json({
      country: 'Local Network', countryCode: 'XX',
      region: 'Private', city: ip, isp: 'Internal', timezone: '',
    });
  }

  const cached = geoCache.get(ip);
  if (cached && cached.expiry > Date.now()) return Response.json(cached.data);

  try {
    const res = await fetch(`https://ipwho.is/${ip}`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const d = await res.json();
      if (d.success) {
        const result: GeoResult = {
          country: d.country ?? '',
          countryCode: d.country_code ?? '',
          region: d.region ?? '',
          city: d.city ?? '',
          isp: d.connection?.isp ?? d.connection?.org ?? '',
          timezone: d.timezone?.id ?? '',
        };
        geoCache.set(ip, { data: result, expiry: Date.now() + 3_600_000 });
        return Response.json(result);
      }
    }
  } catch {
    // timeout or network error — fall through
  }

  return Response.json({ country: '', countryCode: '', region: '', city: '', isp: '', timezone: '' });
}
