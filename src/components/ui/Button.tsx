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

const variantClasses: Record<Variant, string> = {
  /* Navy primary — lacivert */
  accent:  'bg-btn text-white hover:bg-btn-hov border border-blue-700/40 shadow-[0_0_20px_rgba(30,64,175,0.25)] hover:shadow-[0_0_28px_rgba(37,99,235,0.35)]',
  /* Default — subtle glass */
  default: 'bg-sf2 text-tx hover:bg-sf3 border border-bd hover:border-bd2',
  /* Danger — red tonal */
  danger:  'bg-rdd text-rd hover:bg-rd/20 border border-rd/20',
  /* Success — emerald tonal */
  success: 'bg-gd text-gn hover:bg-gn/20 border border-gn/20',
  /* Ghost */
  ghost:   'bg-transparent text-mu hover:text-tx hover:bg-sf2 border border-transparent',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[12px] rounded-lg  gap-1',
  md: 'px-4 py-2   text-[13px] rounded-xl  gap-1.5',
  lg: 'px-5 py-2.5 text-[13px] rounded-xl  gap-2',
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
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-all duration-150 cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </button>
  );
}
