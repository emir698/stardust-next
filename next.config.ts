import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel Edge Runtime için
  experimental: {
    // middleware'in edge'de çalışması için gerekli ayarlar burada eklenebilir
  },
  // Production'da console.log'ları kaldır
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
