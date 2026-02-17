export interface Article {
  id: number;
  source: string;
  title: string;
  url: string;
  author: string | null;
  contentSnippet: string | null;
  publishedAt: string;
  score: number;
  tags: string[];
  read: boolean;
  bookmarked: boolean;
}

export interface ArticleDetail extends Article {
  metadata: Record<string, unknown>;
}

export interface User {
  id: number;
  username: string;
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  sources?: string[];
  keywords?: string[];
  excludedKeywords?: string[];
  display?: Record<string, unknown>;
}

export interface FeedSource {
  id: number;
  name: string;
  slug: string;
  pollInterval: number;
  enabled: boolean;
  configJson?: Record<string, unknown>;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface ArticleParams {
  page?: number;
  size?: number;
  source?: string;
  tag?: string;
  sort?: string;
}

export interface SearchParams {
  q: string;
  page?: number;
  size?: number;
}
