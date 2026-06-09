import { ref, get, onValue, off, type DataSnapshot } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/types';

interface UserRecord {
  name: string;
  role: AppUser['role'];
  email?: string;
}

export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? snap.val() : null;
}

export function watchUsers(cb: (users: Array<UserRecord & { uid: string }>) => void) {
  const r = ref(db, 'users');
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.entries(snap.val() as Record<string, UserRecord>).map(
      ([uid, v]) => ({ ...v, uid })
    ));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}
