'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, logout } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

// Lucide-react SVG ikonları (inline — bağımlılık gerekmez)
const TicketIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
    <path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
  </svg>
);

const DashboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
    <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

const VitoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11 2 11v3c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
  </svg>
);

const TagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
  </svg>
);

const AdminIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
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
      <aside style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-sf)',
        borderRight: '1px solid var(--color-bd)',
        padding: '0',
        overflow: 'hidden',
      }} className="sidebar-desktop">

        {/* Logo */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--color-bd)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--sidebar-ac)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}>
            <SparkleIcon />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-tx)', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>
              STARDUST
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-mu)', marginTop: 1 }}>
              Box Office
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
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
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? '#fff' : 'var(--color-mu)',
                  background: active ? 'var(--sidebar-ac)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--color-sf2)';
                    e.currentTarget.style.color = 'var(--color-tx)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-mu)';
                  }
                }}
              >
                <Icon />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-bd)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--sidebar-ac)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}>
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-mu)', textTransform: 'capitalize' }}>
                  {user.role}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Çıkış"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: '1px solid var(--color-bd)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--color-mu)',
              flexShrink: 0,
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-rd)';
              e.currentTarget.style.color = 'var(--color-rd)';
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
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: 'var(--color-sf)',
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
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '6px 12px',
                borderRadius: 8,
                color: active ? 'var(--sidebar-ac)' : 'var(--color-mu)',
                textDecoration: 'none',
                fontSize: 10,
                fontWeight: active ? 600 : 500,
                minWidth: 50,
              }}
            >
              <Icon />
              <span style={{ fontSize: 9 }}>{tab.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
