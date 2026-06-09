import { ref, get, update, onValue, off, type DataSnapshot } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { IndirimKodu, CodeBatch } from '@/types';

// ─── İndirim Kodları ─────────────────────────────────────────────────────────

export function watchCodes(cb: (codes: IndirimKodu[]) => void) {
  const r = ref(db, 'codes');
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) { cb([]); return; }
    const list: IndirimKodu[] = Object.entries(
      snap.val() as Record<string, Omit<IndirimKodu, '_key'>>
    ).map(([key, v]) => ({ ...v, _key: key }));
    cb(list);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function getCodes(): Promise<IndirimKodu[]> {
  const snap = await get(ref(db, 'codes'));
  if (!snap.exists()) return [];
  return Object.entries(
    snap.val() as Record<string, Omit<IndirimKodu, '_key'>>
  ).map(([key, v]) => ({ ...v, _key: key }));
}

export async function deactivateCode(key: string, kullanan: string, date: string): Promise<void> {
  await update(ref(db, `codes/${key}`), { status: 'deaktif', kullanan, date });
}

export async function activateCode(key: string): Promise<void> {
  await update(ref(db, `codes/${key}`), { status: 'aktif', kullanan: '', date: '' });
}

export async function getCodeByValue(code: string): Promise<IndirimKodu | null> {
  const all = await getCodes();
  return all.find(c => c.code === code) ?? null;
}

// ─── Kod Grupları (Batches) ───────────────────────────────────────────────────

export function watchBatches(cb: (batches: CodeBatch[]) => void) {
  const r = ref(db, 'codeBatches');
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.entries(
      snap.val() as Record<string, Omit<CodeBatch, '_key'>>
    ).map(([key, v]) => ({ ...v, _key: key })));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}
