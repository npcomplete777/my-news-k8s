import type { Metadata } from 'next';
import { HeroCarousel } from '@/components/HeroCarousel';
import { BlogArticles } from '@/components/BlogArticles';
import { LiveTelemetryPulse } from '@/components/LiveTelemetryPulse';
import { SiteIntro } from '@/components/SiteIntro';

export const metadata: Metadata = {
  title: 'O11y Alchemy',
  description:
    'A live, self-observing Kubernetes cluster — OpenTelemetry traces, ClickHouse analytics, and agentic AI observability tools. Watch your own session flow through the stack in real time.',
  openGraph: {
    title: 'O11y Alchemy — The Self-Observing Observatory',
    description:
      'Real-time OpenTelemetry traces, metrics, and logs from a live GKE cluster. The site observes itself.',
    url: '/',
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-4">
        <LiveTelemetryPulse />
        <SiteIntro />
        <HeroCarousel />
        <BlogArticles />
      </div>
    </div>
  );
}
