'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserRecord } from '@/lib/db/users';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import type { AppUser } from '@/types';
import { StardustLogo } from '@/components/brand/Logo';

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
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next === '/scan' ? '/scan' : '/tickets');
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
      <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 8, padding: '2rem', width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <StardustLogo
            layout="stacked"
            size="md"
            style={{ color: '#ededed', alignItems: 'center' }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: '1rem', background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, padding: '10px 12px' }}>
            {error}
          </div>
        )}

        {/* Form */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8, display: 'block' }}>
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
            style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '13px 14px', color: '#ededed', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontSize: 16, outline: 'none', WebkitAppearance: 'none', transition: 'border-color .15s', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#ededed')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#222')}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8, display: 'block' }}>
            Şifre
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '13px 14px', color: '#ededed', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontSize: 16, outline: 'none', WebkitAppearance: 'none', transition: 'border-color .15s', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#ededed')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#222')}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{ width: '100%', padding: 14, background: '#ededed', color: '#0a0a0a', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading || !email || !password ? 'default' : 'pointer', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', marginTop: '.5rem', opacity: loading || !email || !password ? 0.4 : 1, transition: 'background .15s' }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#ffffff'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#ededed'; }}
        >
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </div>
    </div>
  );
}
