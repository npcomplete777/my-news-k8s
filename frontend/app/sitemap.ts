import type { MetadataRoute } from 'next';

const BASE_URL = 'https://o11y-alchemy.com';

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE_URL,                           priority: 1.0, changeFrequency: 'daily' },
  { url: `${BASE_URL}/anti-patterns`,        priority: 0.9, changeFrequency: 'monthly' },
  { url: `${BASE_URL}/ai`,                   priority: 0.9, changeFrequency: 'monthly' },
  { url: `${BASE_URL}/otel`,                 priority: 0.8, changeFrequency: 'monthly' },
  { url: `${BASE_URL}/clickhouse`,           priority: 0.8, changeFrequency: 'monthly' },
  { url: `${BASE_URL}/architecture`,         priority: 0.8, changeFrequency: 'monthly' },
  { url: `${BASE_URL}/feed`,                 priority: 0.7, changeFrequency: 'hourly' },
  { url: `${BASE_URL}/telemetry`,            priority: 0.6, changeFrequency: 'always' },
  { url: `${BASE_URL}/about`,                priority: 0.5, changeFrequency: 'monthly' },
];

async function getArticleIds(): Promise<number[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
  try {
    const res = await fetch(
      `${apiUrl}/api/articles?size=200&sort=publishedAt,desc`,
      {
        headers: { 'X-API-Key': 'dev-api-key-001', 'Content-Type': 'application/json' },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.content ?? []).map((a: { id: number }) => a.id);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ids = await getArticleIds();
  const articlePages: MetadataRoute.Sitemap = ids.map((id) => ({
    url: `${BASE_URL}/articles/${id}`,
    priority: 0.5,
    changeFrequency: 'yearly' as const,
  }));

  return [...STATIC_PAGES, ...articlePages];
}
