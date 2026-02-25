import { HeroCarousel } from '@/components/HeroCarousel';
import { BlogArticles } from '@/components/BlogArticles';
import { LiveTelemetryPulse } from '@/components/LiveTelemetryPulse';
import { SiteIntro } from '@/components/SiteIntro';

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
