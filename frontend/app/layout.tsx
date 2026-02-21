import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Observing O11y News',
  description: 'Observing O11y News — Cloud-native news aggregator with live observability',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-4">
          {children}
        </main>
      </body>
    </html>
  );
}
