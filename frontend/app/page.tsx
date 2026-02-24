import { HeroFeature } from '@/components/HeroFeature';
import { FeedGrid } from '@/components/FeedGrid';
import { LiveTelemetryPulse } from '@/components/LiveTelemetryPulse';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-4">
        <LiveTelemetryPulse />
        <HeroFeature />
        <FeedGrid />
      </div>
    </div>
  );
}
