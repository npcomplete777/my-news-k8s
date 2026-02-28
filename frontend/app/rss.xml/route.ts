import type { NextRequest } from 'next/server';

const BASE_URL = 'https://o11y-alchemy.com';
const FEED_TITLE = 'O11y Alchemy — Observability Intelligence';
const FEED_DESCRIPTION =
  'Kubernetes, OpenTelemetry, and platform engineering news — curated and augmented by AI, served from a self-observing live cluster.';

interface Article {
  id: number;
  title: string;
  url: string;
  author: string | null;
  contentSnippet: string | null;
  publishedAt: string;
  source: string;
  tags: string[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(dateStr: string): string {
  try {
    return new Date(dateStr).toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

export async function GET(_req: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

  let articles: Article[] = [];
  try {
    const res = await fetch(`${apiUrl}/api/articles?size=50&sort=publishedAt,desc`, {
      headers: { 'X-API-Key': 'dev-api-key-001', 'Content-Type': 'application/json' },
      next: { revalidate: 900 }, // 15-min cache
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      articles = data.content ?? [];
    }
  } catch {
    // return empty feed on error
  }

  const items = articles
    .map(
      (a) => `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.url)}</link>
      <guid isPermaLink="false">${BASE_URL}/articles/${a.id}</guid>
      <pubDate>${rfc822(a.publishedAt)}</pubDate>
      ${a.author ? `<author>${escapeXml(a.author)}</author>` : ''}
      ${a.contentSnippet ? `<description>${escapeXml(a.contentSnippet)}</description>` : ''}
      <source url="${BASE_URL}/rss.xml">${escapeXml(a.source)}</source>
      ${a.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('\n      ')}
    </item>`
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${BASE_URL}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
    },
  });
}
