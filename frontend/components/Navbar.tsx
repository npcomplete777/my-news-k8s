'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTheme } from '@/components/ThemeProvider';

const navLinks = [
  { href: '/feed', label: 'Feed' },
  { href: '/telemetry', label: 'Telemetry' },
  { href: '/anti-patterns', label: 'Anti-Patterns' },
  { href: '/ai', label: 'AI' },
  { href: '/otel', label: 'OTel' },
  { href: '/clickhouse', label: 'ClickHouse' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white dark:bg-zinc-950 dark:border-zinc-800">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-4">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <span className="font-black uppercase tracking-widest text-stone-900 dark:text-zinc-100 text-base">
            O11Y Alchemy
          </span>
        </Link>

        {/* Center nav links */}
        <div className="hidden md:flex flex-1 items-center justify-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'text-xs font-bold uppercase tracking-widest transition-colors',
                  isActive
                    ? 'text-stone-900 dark:text-zinc-100'
                    : 'text-stone-400 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right side: theme toggle + GitHub + Search */}
        <div className="ml-auto flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors"
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === 'dark' ? (
                // Sun icon
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
              ) : (
                // Moon icon
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )
            ) : (
              <div className="h-5 w-5" />
            )}
          </button>

          <a
            href="https://github.com/npcomplete777/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors"
            aria-label="GitHub"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
          </a>

          <button
            type="button"
            className="text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors"
            aria-label="Search"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
