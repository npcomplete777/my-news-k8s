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
  // CF-Connecting-IP is the definitive real visitor IP when behind Cloudflare.
  // X-Forwarded-For contains Cloudflare edge IPs, not the real visitor.
  const cfIp      = req.headers.get('cf-connecting-ip');
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp    = req.headers.get('x-real-ip');
  const ip = (cfIp ?? (forwarded ? forwarded.split(',')[0] : realIp ?? '')).trim() || '127.0.0.1';

  if (isPrivateIp(ip)) {
    return Response.json({
      country: 'Local Network', countryCode: 'XX',
      region: 'Private', city: ip, isp: 'Internal', timezone: '',
    });
  }

  const cached = geoCache.get(ip);
  if (cached && cached.expiry > Date.now()) return Response.json(cached.data);

  // Primary: ipapi.co — free tier, 1k req/day, proper IANA timezones, ISP via "org" field
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'o11y-news-observability/1.0',
      },
    });
    if (res.ok) {
      const d = await res.json();
      if (!d.error) {
        const result: GeoResult = {
          country:     d.country_name ?? '',
          countryCode: d.country_code ?? '',
          region:      d.region ?? '',
          city:        d.city ?? '',
          isp:         d.org ?? '',
          timezone:    d.timezone ?? '',
        };
        geoCache.set(ip, { data: result, expiry: Date.now() + 3_600_000 });
        return Response.json(result);
      }
    }
  } catch {
    // timeout or network error — fall through to Cloudflare header fallback
  }

  // Fallback: Cloudflare injects CF-IPCountry on all plans at zero cost/latency.
  // City/region headers require Business plan — use what's available.
  const cfCountry = req.headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX') {
    return Response.json({
      country: '', countryCode: cfCountry,
      region: '', city: '', isp: '', timezone: '',
    });
  }

  return Response.json({ country: '', countryCode: '', region: '', city: '', isp: '', timezone: '' });
}
