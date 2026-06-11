import { cn } from '@/lib/utils';

type KpiColor = 'ac' | 'gn' | 'rd' | 'bl' | 'tx' | 'or' | 'vi';

const colorMap: Record<KpiColor, string> = {
  ac: 'text-[var(--color-ac)]',
  gn: 'text-[var(--color-gn)]',
  rd: 'text-[var(--color-rd)]',
  bl: 'text-[var(--color-bl)]',
  tx: 'text-[var(--color-tx)]',
  or: 'text-[var(--color-or)]',
  vi: 'text-[var(--color-vi)]',
};

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: KpiColor;
}

export function KpiCard({ label, value, sub, color = 'tx' }: KpiCardProps) {
  return (
    <div style={{ background: 'var(--color-sf)', border: '1px solid var(--color-bd)', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: 'var(--color-mu)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</p>
      <p className={cn('text-[28px] font-semibold leading-none tabular-nums', colorMap[color])}
         style={{ fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: 'var(--color-mu)', marginTop: 6 }}>{sub}</p>}
    </div>
  );
}
