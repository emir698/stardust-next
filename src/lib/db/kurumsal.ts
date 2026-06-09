import {
  ref, get, set, update, remove, onValue, off,
  type DataSnapshot,
} from 'firebase/database';
import { db } from '@/lib/firebase';
import type { KurumsalPaket } from '@/types';

export function watchKurumsalPaketler(cb: (paketler: KurumsalPaket[]) => void) {
  const r = ref(db, 'kurumsalPaketler');
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.entries(
      snap.val() as Record<string, Omit<KurumsalPaket, '_key'>>
    ).map(([key, v]) => ({ ...v, _key: key })));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function getKurumsalPaket(key: string): Promise<KurumsalPaket | null> {
  const snap = await get(ref(db, `kurumsalPaketler/${key}`));
  return snap.exists() ? { ...snap.val(), _key: key } : null;
}

export async function setKurumsalPaket(key: string, paket: Omit<KurumsalPaket, '_key'>): Promise<void> {
  await set(ref(db, `kurumsalPaketler/${key}`), paket);
}

export async function updateKurumsalPaket(key: string, data: Partial<KurumsalPaket>): Promise<void> {
  await update(ref(db, `kurumsalPaketler/${key}`), data);
}

export async function deleteKurumsalPaket(key: string): Promise<void> {
  await remove(ref(db, `kurumsalPaketler/${key}`));
}
