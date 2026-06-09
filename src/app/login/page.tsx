'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
      router.push('/dashboard');
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
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: '#0a0f1e',
        backgroundImage: [
          'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(30,64,175,0.22) 0%, transparent 65%)',
          'radial-gradient(ellipse 40% 40% at 90% 100%, rgba(99,102,241,0.10) 0%, transparent 55%)',
          'radial-gradient(ellipse 30% 30% at 10% 80%,  rgba(16,185,129,0.05) 0%, transparent 50%)',
        ].join(', '),
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-[360px] px-5 animate-slide-up">

        {/* Logo mark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(30,64,175,0.8) 0%, rgba(99,102,241,0.8) 100%)',
                boxShadow: '0 0 0 1px rgba(148,163,184,0.15), 0 8px 32px rgba(30,64,175,0.35)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span className="text-white text-xl font-bold">✦</span>
            </div>
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-tx leading-none">Stardust</h1>
          <p className="text-[13px] text-mu mt-1.5 font-medium">Box Office</p>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(15,23,41,0.70)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid rgba(148,163,184,0.12)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {error && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-5 animate-fade-in"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)' }}
            >
              <span className="w-4 h-4 rounded-full bg-rd flex items-center justify-center text-[9px] font-bold text-bg flex-shrink-0">✕</span>
              <span className="text-rd text-[13px]">{error}</span>
            </div>
          )}

          <div className="space-y-3 mb-5">
            <div>
              <label className="text-[11px] font-medium text-mu uppercase tracking-widest block mb-1.5">
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
                className="w-full rounded-xl px-4 py-3 text-tx text-[13px] outline-none placeholder:text-mu2 transition-all duration-150"
                style={{
                  background: 'rgba(19,30,53,0.8)',
                  border: '1px solid rgba(30,45,74,1)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(148,163,184,0.07)'; }}
                onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(30,45,74,1)';         e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-mu uppercase tracking-widest block mb-1.5">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-xl px-4 py-3 text-tx text-[13px] outline-none placeholder:text-mu2 transition-all duration-150"
                style={{
                  background: 'rgba(19,30,53,0.8)',
                  border: '1px solid rgba(30,45,74,1)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(148,163,184,0.07)'; }}
                onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(30,45,74,1)';         e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full rounded-xl py-3 text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: loading
                ? 'rgba(30,64,175,0.6)'
                : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(30,64,175,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.12)'; } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(30,64,175,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'; } }}
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </div>

        <p className="text-center text-[11px] text-mu2 mt-6">
          Stardust Box Office · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
