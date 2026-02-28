'use client';

import dynamic from 'next/dynamic';

const OtelHelixAnimation = dynamic(() => import('./OtelHelixAnimation'), { ssr: false });

export function HelixAnimationClient() {
  return <OtelHelixAnimation />;
}
