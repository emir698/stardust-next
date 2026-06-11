'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn('w-full max-h-[90vh] overflow-y-auto', width)}
        style={{ background: 'var(--color-sf)', border: '1px solid var(--color-bd2)', borderRadius: 14, padding: '1.75rem' }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--color-tx)' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 mt-4">
      {children}
    </div>
  );
}
