'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, logout } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

const TicketIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
    <path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
  </svg>
);
const DashboardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
    <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);
const VitoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11 2 11v3c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
  </svg>
);
const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
  </svg>
);
const AdminIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const TABS = [
  { href: '/tickets',        label: 'Bilet Sat',        icon: TicketIcon,    roles: ['admin', 'bilet satis'] },
  { href: '/vito',           label: 'Vito',             icon: VitoIcon,      roles: ['admin', 'bilet satis'] },
  { href: '/gate',           label: 'Bilet Sorgulama',  icon: SearchIcon,    roles: ['admin', 'bilet satis', 'management1', 'okutma'] },
  { href: '/dashboard',      label: 'Dashboard',        icon: DashboardIcon, roles: ['admin', 'management1'] },
  { href: '/discount-codes', label: 'İndirim Kodları',  icon: TagIcon,       roles: ['admin', 'management1'] },
  { href: '/admin',          label: 'Admin',            icon: AdminIcon,     roles: ['admin'] },
];

const S = {
  sidebar: {
    position: 'sticky' as const,
    top: 0,
    height: '100vh',
    width: 240,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--color-bg)',
    borderRight: '1px solid var(--color-bd)',
    overflow: 'hidden',
  },
  logo: {
    height: 56,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 20px',
    borderBottom: '1px solid var(--color-bd)',
  },
  logoMark: {
    width: 8,
    height: 8,
    borderRadius: 2,
    background: 'var(--color-tx)',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.2em',
    color: 'var(--color-tx)',
    fontFamily: 'var(--font-mono)',
  },
  section: {
    padding: '16px 12px 4px',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.16em',
    color: 'var(--color-mu)',
    textTransform: 'uppercase' as const,
    padding: '0 8px',
    marginBottom: 4,
  },
  nav: {
    flex: 1,
    padding: '4px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 1,
    overflowY: 'auto' as const,
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--color-bd)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const visible = TABS.filter(t => !t.roles || (user && t.roles.includes(user.role)));

  const handleLogout = async () => {
    await logout();
    Cookies.remove('stardust_session');
    router.push('/login');
  };

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside style={S.sidebar} className="sidebar-desktop">

        {/* Wordmark */}
        <div style={S.logo}>
          <span style={S.logoMark} aria-hidden />
          <span style={S.logoText}>STARDUST</span>
        </div>

        {/* Nav */}
        <div style={S.section}>
          <p style={S.sectionLabel}>Workspace</p>
        </div>
        <nav style={S.nav}>
          {visible.map((tab) => {
            const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--color-tx)' : 'var(--color-mu)',
                  background: active ? 'var(--color-sf)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all .1s',
                  border: active ? '1px solid var(--color-bd)' : '1px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--color-tx)';
                    e.currentTarget.style.background = 'var(--color-sf)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--color-mu)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={S.footer}>
          {user && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-mu)', marginTop: 1, textTransform: 'capitalize' }}>
                {user.role}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Çıkış"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: '1px solid var(--color-bd)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--color-mu)',
              flexShrink: 0,
              transition: 'all .1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-tx)';
              e.currentTarget.style.color = 'var(--color-tx)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-bd)';
              e.currentTarget.style.color = 'var(--color-mu)';
            }}
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Bar ── */}
      <nav className="sidebar-mobile" style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 56,
        background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-bd)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {visible.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <Link key={tab.href} href={tab.href} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 10px',
              color: active ? 'var(--color-tx)' : 'var(--color-mu)',
              textDecoration: 'none',
              fontSize: 9,
              fontWeight: active ? 500 : 400,
              letterSpacing: '0.04em',
            }}>
              <Icon />
              {tab.label.split(' ')[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
