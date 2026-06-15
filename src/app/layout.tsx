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
  title: 'Stardust — Ticket Scan',
  description: 'Stardust Box Office bilet kontrol uygulaması',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StarScan',
  },
  icons: {
    apple: '/icons/icon-180.png',
    icon: '/icons/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {/* html5-qrcode for QR camera scanning on /scan route */}
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
