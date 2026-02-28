import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Geometry of Failure',
  description:
    'Twelve distributed systems anti-patterns — N+1 queries, retry storms, sync-over-async, and more — visualized as animated geometry. Each pattern is a shape. Each shape is a failure mode.',
  openGraph: {
    title: 'The Geometry of Failure — O11y Alchemy',
    description:
      'Twelve distributed systems anti-patterns visualized as animated geometry. N+1 queries, retry storms, thundering herds — each pattern is a shape, each shape is a failure mode.',
    url: '/anti-patterns',
  },
};

export default function AntiPatternsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
