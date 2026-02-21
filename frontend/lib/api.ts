import type {
  Article,
  ArticleDetail,
  ArticleParams,
  FeedSource,
  Page,
  SearchParams,
  User,
  UserPreferences,
} from './types';
import type {
  TraceDTO,
  SpanDTO,
  MetricsSummaryDTO,
  LogEntryDTO,
  ServiceMapDTO,
} from './telemetry-types';
import { getSessionId } from './session';

// Browser: use '' (relative URL) so nginx ingress routes /api/* → backend.
// Server-side (Next.js Node.js process inside cluster): use ClusterIP env var.
const API_URL =
  typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080');

function getApiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('o11y-news-api-key') || 'dev-api-key-001';
  }
  return 'dev-api-key-001';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const sessionId = getSessionId();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-Key': getApiKey(),
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unknown error');
    throw new Error(`API error ${res.status}: ${errorBody}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '' && v !== null
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// --- Articles ---

export async function getArticles(params: ArticleParams = {}): Promise<Page<Article>> {
  const query = buildQuery({
    page: params.page,
    size: params.size ?? 20,
    source: params.source,
    tag: params.tag,
    sort: params.sort,
  });
  return request<Page<Article>>(`/api/articles${query}`);
}

export async function getArticle(id: number): Promise<ArticleDetail> {
  return request<ArticleDetail>(`/api/articles/${id}`);
}

export async function markAsRead(id: number): Promise<void> {
  return request<void>(`/api/articles/${id}/read`, { method: 'POST' });
}

// --- Search ---

export async function searchArticles(params: SearchParams): Promise<Page<Article>> {
  const query = buildQuery({
    q: params.q,
    page: params.page,
    size: params.size ?? 20,
  });
  return request<Page<Article>>(`/api/articles/search${query}`);
}

// --- Bookmarks ---

export async function getBookmarks(
  params: { page?: number; size?: number } = {}
): Promise<Page<Article>> {
  const query = buildQuery({
    page: params.page,
    size: params.size ?? 20,
  });
  return request<Page<Article>>(`/api/bookmarks${query}`);
}

export async function addBookmark(articleId: number): Promise<void> {
  return request<void>('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ articleId }),
  });
}

export async function removeBookmark(articleId: number): Promise<void> {
  return request<void>(`/api/bookmarks/${articleId}`, {
    method: 'DELETE',
  });
}

// --- User ---

export async function getUser(): Promise<User> {
  return request<User>('/api/user');
}

export async function updatePreferences(prefs: UserPreferences): Promise<User> {
  return request<User>('/api/user/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      sources: prefs.sources,
      keywords: prefs.keywords,
      excludedKeywords: prefs.excludedKeywords,
    }),
  });
}

// --- Feeds ---

export async function getFeeds(): Promise<FeedSource[]> {
  return request<FeedSource[]>('/api/feeds');
}

// --- SWR fetcher ---

export const fetcher = <T>(path: string): Promise<T> => request<T>(path);

// --- Telemetry (public endpoints — no API key required, X-Session-Id forwarded) ---

export async function getTelemetryTraces(
  params: { minutes?: number; errorOnly?: boolean; limit?: number } = {}
): Promise<TraceDTO[]> {
  const q = buildQuery({
    minutes: params.minutes ?? 5,
    errorOnly: String(params.errorOnly ?? false),
    limit: params.limit ?? 50,
  });
  return request<TraceDTO[]>(`/api/telemetry/traces${q}`);
}

export async function getTelemetryTrace(traceId: string): Promise<SpanDTO[]> {
  return request<SpanDTO[]>(`/api/telemetry/traces/${encodeURIComponent(traceId)}`);
}

export async function getTelemetryMetrics(): Promise<MetricsSummaryDTO> {
  return request<MetricsSummaryDTO>('/api/telemetry/metrics');
}

export async function getTelemetryLogs(
  params: { minutes?: number; minSeverity?: string; limit?: number } = {}
): Promise<LogEntryDTO[]> {
  const q = buildQuery({
    minutes: params.minutes ?? 10,
    minSeverity: params.minSeverity,
    limit: params.limit ?? 100,
  });
  return request<LogEntryDTO[]>(`/api/telemetry/logs${q}`);
}

export async function getTelemetryServiceMap(minutes = 30): Promise<ServiceMapDTO> {
  return request<ServiceMapDTO>(`/api/telemetry/service-map?minutes=${minutes}`);
}
