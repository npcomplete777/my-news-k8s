'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function OTelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);

  // Initialize OTel SDK once on first mount
  useEffect(() => {
    import('@/lib/otel-browser').then(m => m.initBrowserOtel());
  }, []);

  // Rotate page.view span on every client-side route change.
  // Next.js App Router never fires pagehide/visibilitychange on navigation,
  // so spans would otherwise accumulate in memory and never export.
  useEffect(() => {
    const prev = prevPathname.current;
    prevPathname.current = pathname;
    if (prev === null) return; // skip initial render — initBrowserOtel starts the first span

    // End the span for the page we're leaving, start one for the new route.
    // Small delay so document.title has updated to the new page's title.
    const t = setTimeout(() => {
      import('@/lib/otel-browser').then(m => {
        m.endPageSpan();
        m.startPageSpan();
      });
    }, 100);
    return () => clearTimeout(t);
  }, [pathname]);

  return <>{children}</>;
}
