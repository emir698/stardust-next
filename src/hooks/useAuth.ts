'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserRecord } from '@/lib/db/users';
import { useAuthStore } from '@/store/auth';
import type { AppUser } from '@/types';

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const record = await getUserRecord(firebaseUser.uid);
        if (!record) {
          await signOut(auth);
          setUser(null);
        } else {
          const user: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            name: record.name,
            role: record.role,
          };
          setUser(user);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [setUser, setLoading]);
}

export function useAuth() {
  const user    = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  return { user, loading };
}

export async function logout() {
  await signOut(auth);
}
