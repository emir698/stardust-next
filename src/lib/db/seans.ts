import {
  ref, get, set, remove, onValue, off,
  type DataSnapshot,
} from 'firebase/database';
import { db } from '@/lib/firebase';

// ─── Veri yapısı ──────────────────────────────────────────────────────────────
// Firebase path: seansTakvimi/{DD.MM.YYYY} → string[]  (saat listesi, boş dizi = o gün etkinlik yok)
// Örnek:
//   seansTakvimi/01.07.2026 → ["21:15","21:30","22:00","22:30"]
//   seansTakvimi/15.07.2026 → []   (takvimde var ama etkinlik yok — haftalık kuralı override eder)

export type SeansTakvimi = Record<string, string[]>;

// ─── Okuma ────────────────────────────────────────────────────────────────────

export async function getSeansTakvimi(): Promise<SeansTakvimi> {
  const snap = await get(ref(db, 'seansTakvimi'));
  if (!snap.exists()) return {};
  return snap.val() as SeansTakvimi;
}

export function watchSeansTakvimi(cb: (takvim: SeansTakvimi) => void) {
  const r = ref(db, 'seansTakvimi');
  const handler = (snap: DataSnapshot) => {
    cb(snap.exists() ? (snap.val() as SeansTakvimi) : {});
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

// ─── Yazma ────────────────────────────────────────────────────────────────────

export async function setSeansSaatleri(tarih: string, saatler: string[]): Promise<void> {
  await set(ref(db, `seansTakvimi/${tarih}`), saatler);
}

export async function deleteSeansTarih(tarih: string): Promise<void> {
  await remove(ref(db, `seansTakvimi/${tarih}`));
}

// ─── Seed — mevcut hardcoded takvimi Firebase'e ilk kez yazar ────────────────
// Admin panelinden bir kez çağrılır, sonraki güncellemeler Firebase üzerinden yapılır.

export const INITIAL_TAKVIM: SeansTakvimi = {
  '19.05.2026': ['20:45', '21:00', '21:30', '22:00'],
  '28.05.2026': ['20:45', '21:00', '21:30', '22:00', '22:30'],
  '01.07.2026': ['21:15', '21:30', '22:00', '22:30'],
  '03.07.2026': ['21:15', '21:30', '22:00', '22:30', '23:00'],
  '04.07.2026': ['21:15', '21:30', '22:00', '22:30', '23:00'],
  '05.07.2026': ['21:15', '21:30', '22:00', '22:30'],
  '08.07.2026': ['21:15', '21:30', '22:00', '22:30'],
  '10.07.2026': ['21:15', '21:30', '22:00', '22:30', '23:00'],
  '11.07.2026': ['21:15', '21:30', '22:00', '22:30', '23:00'],
};

export async function seedSeansTakvimi(): Promise<void> {
  const snap = await get(ref(db, 'seansTakvimi'));
  if (snap.exists()) return; // zaten varsa tekrar yazma
  await set(ref(db, 'seansTakvimi'), INITIAL_TAKVIM);
}
