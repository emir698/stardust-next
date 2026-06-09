import { cn } from '@/lib/utils';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[11px] font-medium text-mu uppercase tracking-widest">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full bg-sf2 rounded-xl px-4 py-2.5 text-tx text-[13px]',
          'border border-bd outline-none placeholder:text-mu2',
          'transition-all duration-150',
          'focus:border-ac/60 focus:bg-sf3 focus:shadow-[0_0_0_3px_rgba(148,163,184,0.08)]',
          'appearance-none [-webkit-appearance:none]',
          error && 'border-rd/50 focus:border-rd/70',
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] text-rd mt-0.5">{error}</p>}
    </div>
  );
}
