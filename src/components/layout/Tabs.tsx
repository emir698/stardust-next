'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const TABS = [
  { href: '/tickets',        label: 'Bilet Sat',       roles: ['admin', 'bilet satis'] },
  { href: '/vito',           label: 'Vito',             roles: ['admin', 'bilet satis'] },
  { href: '/gate',           label: 'Kapı',             roles: ['admin', 'bilet satis', 'management1', 'okutma'] },
  { href: '/dashboard',      label: 'Dashboard',        roles: ['admin', 'management1'] },
  { href: '/discount-codes', label: 'İndirim Kodları',  roles: ['admin', 'management1'] },
  { href: '/admin',          label: 'Admin',            roles: ['admin'] },
];

export function Tabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  const visible = TABS.filter(t => !t.roles || (user && t.roles.includes(user.role)));

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
    <div style={{ display: 'flex', gap: 2, background: 'var(--color-sf)', border: '1px solid var(--color-bd)', borderRadius: 10, padding: 4, width: '100%', flexWrap: 'wrap' }}>
      {visible.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '7px 18px',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              color: active ? '#000' : 'var(--color-mu)',
              background: active ? 'var(--color-ac)' : 'transparent',
              border: 'none',
              transition: 'all .15s',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--color-tx)'; e.currentTarget.style.background = 'var(--color-sf2)'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--color-mu)'; e.currentTarget.style.background = 'transparent'; } }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
    </div>
  );
}
