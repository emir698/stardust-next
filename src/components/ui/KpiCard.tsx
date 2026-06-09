import { cn } from '@/lib/utils';

type KpiColor = 'ac' | 'gn' | 'rd' | 'bl' | 'tx' | 'or' | 'vi';

const colorMap: Record<KpiColor, string> = {
  ac: 'text-ac',
  gn: 'text-gn',
  rd: 'text-rd',
  bl: 'text-bl',
  tx: 'text-tx',
  or: 'text-or',
  vi: 'text-vi',
};

const glowMap: Record<KpiColor, string> = {
  ac: 'rgba(148,163,184,0.12)',
  gn: 'rgba(52,211,153,0.12)',
  rd: 'rgba(248,113,113,0.12)',
  bl: 'rgba(96,165,250,0.12)',
  tx: 'transparent',
  or: 'rgba(251,146,60,0.12)',
  vi: 'rgba(167,139,250,0.12)',
};

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: KpiColor;
}

export function KpiCard({ label, value, sub, color = 'tx' }: KpiCardProps) {
  return (
    <div
      className="glass-card rounded-2xl p-6 hover-lift"
      style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 40px ${glowMap[color]}` }}
    >
      <p className="text-[11px] font-medium text-mu uppercase tracking-widest mb-3">{label}</p>
      <p className={cn('text-3xl font-semibold tracking-tight leading-none tabular-nums', colorMap[color])}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-mu mt-2">{sub}</p>}
    </div>
  );
}
