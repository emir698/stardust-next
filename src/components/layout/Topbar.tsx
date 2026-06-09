'use client';

import { useAuth, logout } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export function Topbar() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    Cookies.remove('stardust_session');
    router.push('/login');
  };

  return (
    <header
      className="sticky top-0 z-40 h-12 flex items-center justify-between px-8 border-b border-bd"
      style={{
        background: 'rgba(10,15,30,0.85)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-bg"
          style={{ background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)' }}
        >
          ✦
        </div>
        <span className="text-[13px] font-semibold tracking-wider text-tx">
          STARDUST
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {user && (
          <span className="text-[12px] text-mu font-medium">{user.name}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-[12px] text-mu hover:text-rd transition-colors duration-150 font-medium"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
