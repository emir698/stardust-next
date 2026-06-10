'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Topbar } from '@/components/layout/Topbar';
import { Tabs } from '@/components/layout/Tabs';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-mu text-[13px] font-medium">Yükleniyor…</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg">
      <Topbar />
      <main className="max-w-[1440px] mx-auto px-10 lg:px-16 py-12">
        <Tabs />
        {children}
      </main>
    </div>
  );
}
