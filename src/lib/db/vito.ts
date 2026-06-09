import {
  ref, onValue, off, update, remove, push, set,
  type DataSnapshot,
} from 'firebase/database';
import { db } from '@/lib/firebase';
import type { VitoDriver } from '@/types';

export function watchVitoDrivers(cb: (drivers: VitoDriver[]) => void) {
  const r = ref(db, 'vitoDrivers');
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.entries(
      snap.val() as Record<string, Omit<VitoDriver, '_key'>>
    ).map(([key, v]) => ({ ...v, _key: key })));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function addVitoDriver(driver: Omit<VitoDriver, '_key'>): Promise<string> {
  const newRef = push(ref(db, 'vitoDrivers'));
  await set(newRef, driver);
  return newRef.key!;
}

export async function updateVitoDriver(key: string, data: Partial<VitoDriver>): Promise<void> {
  await update(ref(db, `vitoDrivers/${key}`), data);
}

export async function deleteVitoDriver(key: string): Promise<void> {
  await remove(ref(db, `vitoDrivers/${key}`));
}
