import type { Metadata } from 'next';
import { Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { OTelProvider } from '@/components/OTelProvider';

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'O11y Alchemy',
  description:
    'Agentic AI observability showcase — real-time traces, metrics, and logs from a live Kubernetes cluster, powered by OpenTelemetry and ClickHouse.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={barlowCondensed.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `(function(){var s=localStorage.getItem('theme');var d=document.documentElement;if(s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark');}else{d.classList.remove('dark');}})();`}} />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-zinc-950 text-stone-900 dark:text-zinc-100">
        <ThemeProvider>
          <OTelProvider>
            <Navbar />
            <main>{children}</main>
          </OTelProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
