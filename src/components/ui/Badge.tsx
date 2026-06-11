import { cn } from '@/lib/utils';

type BadgeVariant = 'active' | 'inactive' | 'admin' | 'gise' | 'info';

const variants: Record<BadgeVariant, string> = {
  active:   'bg-[rgba(74,222,128,0.08)]   text-[var(--color-gn)] border border-[rgba(74,222,128,0.2)]',
  inactive: 'bg-[rgba(248,113,113,0.08)]  text-[var(--color-rd)] border border-[rgba(248,113,113,0.2)]',
  admin:    'bg-[rgba(232,197,71,0.12)]   text-[var(--color-ac)] border border-[rgba(232,197,71,0.3)]',
  gise:     'bg-[rgba(74,222,128,0.08)]   text-[var(--color-gn)] border border-[rgba(74,222,128,0.2)]',
  info:     'bg-[rgba(96,165,250,0.08)]   text-[var(--color-bl)] border border-[rgba(96,165,250,0.2)]',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'info', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block text-[11px] font-medium px-[10px] py-[3px] rounded-[20px]',
        variants[variant],
        className
      )}
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {children}
    </span>
  );
}
