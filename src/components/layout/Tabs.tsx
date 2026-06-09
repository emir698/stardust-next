'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

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
    <nav className="flex items-center gap-0.5 mb-8 flex-wrap">
      {visible.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative px-3.5 py-2 rounded-lg text-[13px] font-medium',
              'transition-all duration-200 whitespace-nowrap',
              active
                ? 'text-tx bg-sf2 border border-bd2'
                : 'text-mu hover:text-tx hover:bg-sf2/70 border border-transparent'
            )}
          >
            {tab.label}
            {active && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)' }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
