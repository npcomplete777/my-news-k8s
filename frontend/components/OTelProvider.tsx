'use client';

import { useEffect } from 'react';

export function OTelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    import('@/lib/otel-browser').then(m => m.initBrowserOtel());
  }, []);

  return <>{children}</>;
}
