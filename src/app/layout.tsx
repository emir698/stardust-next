import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Stardust — Box Office',
  description: 'Bilet satış yönetim sistemi',
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
          {children}
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
