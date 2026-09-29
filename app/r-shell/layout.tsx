import type { Metadata, Viewport } from 'next';

/**
 * Metadata for the universal menu shell.
 *
 * The shell serves whatever /r/{id} the build manifest did not cover, so there
 * is no restaurant name to put in the title at build time — the page sets
 * document.title from the API response once it arrives. What matters here is
 * that it stays indexable, matching the pre-rendered pages, so a restaurant
 * onboarded after the last deploy is still crawlable.
 *
 * Deliberately no canonical link. This file is served at many different
 * /r/{id} URLs, and any single value here would collapse them all onto one
 * address. With no canonical, crawlers use the URL they actually requested.
 */
export const metadata: Metadata = {
  title: {
    absolute: 'Menu',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function MenuShellLayout({ children }: { children: React.ReactNode }) {
  return children;
}
