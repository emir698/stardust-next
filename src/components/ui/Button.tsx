'use client';

import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'accent' | 'danger' | 'success' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const base = 'inline-flex items-center justify-center font-medium whitespace-nowrap cursor-pointer transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed';

const variantClasses: Record<Variant, string> = {
  accent:  'bg-[var(--color-ac)] text-white border border-[var(--color-ac)] hover:bg-[var(--color-ac-hover)]',
  default: 'bg-[var(--color-sf)] text-[var(--color-tx)] border border-[var(--color-bd)] hover:border-[var(--color-bd2)] hover:bg-[var(--color-sf2)]',
  danger:  'text-[var(--color-rd)] border border-[rgba(248,113,113,0.25)] hover:bg-[var(--color-rdd)] hover:border-[var(--color-rd)]',
  success: 'text-[var(--color-gn)] border border-[rgba(74,222,128,0.25)] hover:bg-[var(--color-gd)] hover:border-[var(--color-gn)]',
  ghost:   'bg-transparent text-[var(--color-mu)] border border-transparent hover:text-[var(--color-tx)] hover:bg-[var(--color-sf2)]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-[5px] text-[12px] rounded-md gap-1',
  md: 'px-4 py-[9px] text-[13px] rounded-lg gap-1.5',
  lg: 'px-5 py-[10px] text-[13px] rounded-lg gap-2',
};

export function Button({
  variant = 'default',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
    >
      {children}
    </button>
  );
}
