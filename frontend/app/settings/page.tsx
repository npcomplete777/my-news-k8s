'use client';

import { useEffect, useState } from 'react';
import { usePreferences } from '@/lib/hooks/usePreferences';
import useSWR from 'swr';
import { getFeeds } from '@/lib/api';
import type { FeedSource } from '@/lib/types';

const SOURCE_COLORS: Record<string, string> = {
  'hacker-news': 'bg-hn/20 text-hn border-hn/30',
  reddit: 'bg-reddit/20 text-reddit border-reddit/30',
  github: 'bg-github/20 text-zinc-300 border-github/30',
  devto: 'bg-zinc-700/50 text-zinc-300 border-zinc-600',
  lobsters: 'bg-lobsters/20 text-lobsters border-lobsters/30',
  youtube: 'bg-youtube/20 text-youtube border-youtube/30',
  'k8s-blog': 'bg-k8s/20 text-k8s border-k8s/30',
  'cncf-blog': 'bg-cncf/20 text-cncf border-cncf/30',
};

export default function SettingsPage() {
  const { preferences, isLoading, savePreferences } = usePreferences();
  const { data: feeds } = useSWR<FeedSource[]>('/api/feeds', () => getFeeds());

  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newExcluded, setNewExcluded] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (preferences) {
      setSelectedSources(preferences.sources ?? []);
      setKeywords(preferences.keywords ?? []);
      setExcludedKeywords(preferences.excludedKeywords ?? []);
    }
  }, [preferences]);

  const toggleSource = (slug: string) => {
    setSelectedSources((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords((prev) => [...prev, kw]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const addExcluded = () => {
    const kw = newExcluded.trim().toLowerCase();
    if (kw && !excludedKeywords.includes(kw)) {
      setExcludedKeywords((prev) => [...prev, kw]);
      setNewExcluded('');
    }
  };

  const removeExcluded = (kw: string) => {
    setExcludedKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await savePreferences({
        sources: selectedSources,
        keywords,
        excludedKeywords,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="skeleton mb-4 h-8 w-32" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500">
          Customize your news feed preferences
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Source Selection */}
        <section className="card">
          <h2 className="mb-1 text-lg font-semibold text-zinc-200">Sources</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Select which news sources to include in your feed
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(feeds ?? []).map((feed) => {
              const active = selectedSources.includes(feed.slug);
              const colorClass = SOURCE_COLORS[feed.slug] ?? 'bg-zinc-700/50 text-zinc-300 border-zinc-600';
              return (
                <button
                  key={feed.id}
                  onClick={() => toggleSource(feed.slug)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? colorClass
                      : 'border-zinc-800 bg-zinc-900 text-zinc-600 hover:border-zinc-700'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      active ? 'bg-current' : 'bg-zinc-700'
                    }`}
                  />
                  {feed.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Keywords */}
        <section className="card">
          <h2 className="mb-1 text-lg font-semibold text-zinc-200">
            Keywords
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Highlight articles matching these keywords
          </p>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="e.g. kubernetes, observability"
              className="input flex-1"
            />
            <button onClick={addKeyword} className="btn-primary">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-400"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  className="ml-1 text-amber-600 hover:text-amber-400"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {keywords.length === 0 && (
              <span className="text-sm text-zinc-600">No keywords added</span>
            )}
          </div>
        </section>

        {/* Excluded Keywords */}
        <section className="card">
          <h2 className="mb-1 text-lg font-semibold text-zinc-200">
            Excluded Keywords
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Hide articles containing these keywords
          </p>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newExcluded}
              onChange={(e) => setNewExcluded(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExcluded()}
              placeholder="e.g. crypto, nft"
              className="input flex-1"
            />
            <button onClick={addExcluded} className="btn-primary">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {excludedKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-sm text-red-400"
              >
                {kw}
                <button
                  onClick={() => removeExcluded(kw)}
                  className="ml-1 text-red-600 hover:text-red-400"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {excludedKeywords.length === 0 && (
              <span className="text-sm text-zinc-600">No excluded keywords</span>
            )}
          </div>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400">
              Preferences saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
