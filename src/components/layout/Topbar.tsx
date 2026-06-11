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
    <header className="sticky top-0 z-40 border-b border-[var(--color-bd)] bg-[var(--color-bg)]"
      style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 17, color: 'var(--color-ac)', letterSpacing: 3, fontWeight: 600 }}>
        STARDUST
      </span>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {user && (
          <span style={{ fontSize: 12, color: 'var(--color-mu)', fontFamily: 'var(--font-mono)', padding: '4px 10px', border: '1px solid var(--color-bd)', borderRadius: 20 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-gn)', display: 'inline-block', marginRight: 6 }} />
            {user.name}
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{ fontSize: 12, color: 'var(--color-mu)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-rd)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mu)')}
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
