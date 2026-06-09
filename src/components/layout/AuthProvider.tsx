'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserRecord } from '@/lib/db/users';
import { useAuthStore } from '@/store/auth';
import type { AppUser } from '@/types';
import Cookies from 'js-cookie';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        Cookies.remove('stardust_session');
        return;
      }
      try {
        const record = await getUserRecord(firebaseUser.uid);
        if (!record) {
          await auth.signOut();
          setUser(null);
          Cookies.remove('stardust_session');
        } else {
          const user: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            name: record.name,
            role: record.role,
          };
          setUser(user);
          // Middleware için lightweight session cookie (token değil)
          Cookies.set('stardust_session', '1', { expires: 7 });
        }
      } catch {
        setUser(null);
        Cookies.remove('stardust_session');
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [setUser, setLoading]);

  return <>{children}</>;
}
