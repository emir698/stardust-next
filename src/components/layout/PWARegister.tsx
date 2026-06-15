'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] registered', reg.scope);
      })
      .catch(err => {
        console.error('[SW] registration failed', err);
      });

    // ── Honeywell DataWedge intent → barcode input ──────────────────────────
    // DataWedge can be configured to broadcast with action:
    //   com.honeywell.decode.intent.action.DECODE_DATA
    // extra key: "com.symbol.datawedge.data_string"
    // This listener catches it if the PWA is the foreground app.
    const handleIntent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.barcode) return;
      // Dispatch a synthetic input event to the active barcode field
      const input = document.getElementById('barcode-field') as HTMLInputElement | null;
      if (!input) return;
      const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSet?.call(input, detail.barcode);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };

    window.addEventListener('barcode-scan', handleIntent);

    // ── SW message relay ────────────────────────────────────────────────────
    const swHandler = (e: MessageEvent) => {
      if (e.data?.type === 'BARCODE_SCAN') {
        window.dispatchEvent(new CustomEvent('barcode-scan', { detail: { barcode: e.data.barcode } }));
      }
    };
    navigator.serviceWorker.addEventListener('message', swHandler);

    return () => {
      window.removeEventListener('barcode-scan', handleIntent);
      navigator.serviceWorker.removeEventListener('message', swHandler);
    };
  }, []);

  return null;
}
