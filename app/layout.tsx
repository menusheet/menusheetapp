import type { Metadata } from 'next';
import './globals.css';
import { siteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'MenuSheet — QR Code Digital Menu for ₹100/month',
    template: '%s — MenuSheet',
  },
  description:
    'MenuSheet gives every restaurant a beautiful QR-code digital menu. No app, no backend, no hassle — just ₹100/month.',
  icons: {
    icon: [{ url: '/icons/logo.png', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/icons/logo.png', type: 'image/png', sizes: '512x512' }],
  },
  openGraph: {
    images: [{ url: '/icons/logo.png', width: 512, height: 512, alt: 'MenuSheet' }],
  },
  twitter: {
    card: 'summary',
    images: ['/icons/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}
