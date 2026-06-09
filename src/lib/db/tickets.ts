import {
  ref, get, set, update, remove, onValue, off,
  type DataSnapshot,
} from 'firebase/database';
import { db } from '@/lib/firebase';
import type { Satis, PNRKayit, Bilet } from '@/types';

// ─── Tickets (satış kayıtları) ───────────────────────────────────────────────

export async function getSatisList(): Promise<Satis[]> {
  const snap = await get(ref(db, 'tickets'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() as Record<string, Satis>).map(
    ([id, v]) => ({ ...v, id })
  );
}

export async function createSatis(satis: Satis): Promise<void> {
  await set(ref(db, `tickets/${satis.id}`), satis);
}

export async function updateSatis(id: string, data: Partial<Satis>): Promise<void> {
  await update(ref(db, `tickets/${id}`), data);
}

export function watchSatisList(cb: (list: Satis[]) => void) {
  const r = ref(db, 'tickets');
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.entries(snap.val() as Record<string, Satis>).map(
      ([id, v]) => ({ ...v, id })
    ));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

// ─── PNRler ──────────────────────────────────────────────────────────────────

export async function getPNR(pnr: string): Promise<PNRKayit | null> {
  const snap = await get(ref(db, `pnrler/${pnr}`));
  return snap.exists() ? snap.val() : null;
}

export async function setPNR(pnr: string, kayit: PNRKayit): Promise<void> {
  await set(ref(db, `pnrler/${pnr}`), kayit);
}

export async function updatePNR(pnr: string, data: Partial<PNRKayit>): Promise<void> {
  await update(ref(db, `pnrler/${pnr}`), data);
}

export async function deletePNR(pnr: string): Promise<void> {
  await remove(ref(db, `pnrler/${pnr}`));
}

export function watchPNRler(cb: (map: Record<string, PNRKayit>) => void) {
  const r = ref(db, 'pnrler');
  const handler = (snap: DataSnapshot) => {
    cb(snap.exists() ? snap.val() : {});
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

// ─── Biletler (bireysel) ─────────────────────────────────────────────────────

export function watchBiletler(cb: (map: Record<string, Bilet>) => void) {
  const r = ref(db, 'biletler');
  const handler = (snap: DataSnapshot) => {
    cb(snap.exists() ? snap.val() : {});
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function getBiletByNo(biletNo: string): Promise<Bilet | null> {
  const snap = await get(ref(db, `biletler/${biletNo}`));
  return snap.exists() ? snap.val() : null;
}

export async function updateBilet(biletNo: string, data: Partial<Bilet>): Promise<void> {
  await update(ref(db, `biletler/${biletNo}`), data);
}
