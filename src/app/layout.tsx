import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { PWARegister } from '@/components/layout/PWARegister';
import Script from 'next/script';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  title: 'STARDUST',
  description: 'Stardust Box Office bilet kontrol uygulaması',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'STARDUST',
  },
  icons: {
    apple: '/icons/icon-180.png',
    icon: '/icons/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        {/* Explicit manifest link - Next.js 16 metadata.manifest bazen çalışmıyor */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="StarScan" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body>
        <Script
          src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"
          strategy="lazyOnload"
        />
        <AuthProvider>
          <PWARegister />
          {children}
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
