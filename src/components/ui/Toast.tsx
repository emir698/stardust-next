'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type ToastType = 'ok' | 'err' | 'warn';

interface ToastMessage { id: number; msg: string; type: ToastType; }

let _add: ((msg: string, type: ToastType) => void) | null = null;

export function toast(msg: string, type: ToastType = 'ok') { _add?.(msg, type); }

const meta: Record<ToastType, { icon: string; dot: string; border: string }> = {
  ok:   { icon: '✓', dot: 'bg-gn',  border: 'border-gn/20' },
  err:  { icon: '✕', dot: 'bg-rd',  border: 'border-rd/20' },
  warn: { icon: '!', dot: 'bg-or',   border: 'border-or/20' },
};

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const add = useCallback((msg: string, type: ToastType) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => { _add = add; return () => { _add = null; }; }, [add]);

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'glass-strong flex items-center gap-3 rounded-2xl px-4 py-3 animate-slide-up',
            'border', meta[t.type].border
          )}
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          <span className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0',
            meta[t.type].dot
          )}>
            {meta[t.type].icon}
          </span>
          <span className="text-[13px] text-tx">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
