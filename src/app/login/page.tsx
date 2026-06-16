'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserRecord } from '@/lib/db/users';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import type { AppUser } from '@/types';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { setUser } = useAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      const loginEmail = email.includes('@') ? email : `${email}@stardust.app`;
      await setPersistence(auth, browserSessionPersistence);
      const cred  = await signInWithEmailAndPassword(auth, loginEmail, password);
      const record = await getUserRecord(cred.user.uid);
      if (!record) {
        await auth.signOut();
        setError('Bu hesabın sisteme erişim yetkisi yok.');
        return;
      }
      const user: AppUser = { uid: cred.user.uid, email: cred.user.email ?? '', name: record.name, role: record.role };
      setUser(user);
      Cookies.set('stardust_session', '1', { expires: 7 });
      router.push('/tickets');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      setError(
        code === 'auth/invalid-credential' || code === 'auth/user-not-found'
          ? 'Kullanıcı adı veya şifre hatalı.'
          : 'Giriş yapılırken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 20, padding: '1.75rem', width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: '#e8c547', fontWeight: 700, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
            ✦ ✦ ✦
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 8, letterSpacing: 1, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
            STARDUST
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 13, color: '#f87171', textAlign: 'center', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Form */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, display: 'block' }}>
            Kullanıcı Adı
          </label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="ad.soyad"
            autoCapitalize="none"
            autoComplete="username"
            autoFocus
            style={{ width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px 16px', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontSize: 16, outline: 'none', WebkitAppearance: 'none', transition: 'border .15s', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#e8c547')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#2a2a2a')}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, display: 'block' }}>
            Şifre
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{ width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px 16px', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontSize: 16, outline: 'none', WebkitAppearance: 'none', transition: 'border .15s', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#e8c547')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#2a2a2a')}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{ width: '100%', padding: 16, background: '#e8c547', color: '#000', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: loading || !email || !password ? 'default' : 'pointer', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', marginTop: '.5rem', opacity: loading || !email || !password ? 0.6 : 1, transition: 'background .15s' }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#f0cf5a'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#e8c547'; }}
        >
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </div>
    </div>
  );
}
