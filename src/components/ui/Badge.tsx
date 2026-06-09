import { cn } from '@/lib/utils';

type BadgeVariant = 'active' | 'inactive' | 'admin' | 'gise' | 'info';

const variants: Record<BadgeVariant, string> = {
  active:   'bg-gd   text-gn  border border-gn/15',
  inactive: 'bg-rdd  text-rd  border border-rd/15',
  admin:    'bg-ac/8 text-ac  border border-ac/20',
  gise:     'bg-sf3  text-mu  border border-bd',
  info:     'bg-bl/8 text-bl  border border-bl/15',
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
        'inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
