'use client';

import dynamic from 'next/dynamic';

const LiveServiceMap = dynamic(() => import('./LiveServiceMap'), { ssr: false });

export function HelixAnimationClient() {
  return <LiveServiceMap />;
}
