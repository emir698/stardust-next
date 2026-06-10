'use client';

import { useState } from 'react';
import { ref, set, remove, update, get } from 'firebase/database';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useCodes, useUsers, useKurumsalPaketler } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { todayStr, fmtMoney } from '@/lib/utils';
import type { UserRole, KurumsalPaket } from '@/types';

const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  'bilet satis': 'Bilet Satış',
  okutma: 'Okutma',
  management1: 'Management',
};

// ─── Kullanıcı Yönetimi ───────────────────────────────────────────────────────

function KullaniciYonetimi() {
  const { user: currentUser } = useAuth();
  const users = useUsers();

  const [addModal, setAddModal]   = useState(false);
  const [nuEmail, setNuEmail]     = useState('');
  const [nuPass, setNuPass]       = useState('');
  const [nuName, setNuName]       = useState('');
  const [nuRole, setNuRole]       = useState<UserRole>('bilet satis');
  const [saving, setSaving]       = useState(false);

  const handleAddUser = async () => {
    if (!nuEmail.trim() || !nuPass || !nuName.trim()) {
      toast('Tüm alanları doldurun', 'err'); return;
    }
    setSaving(true);
    const email = nuEmail.trim().toLowerCase() + '@stardust.app';
    const appName = 'sec_' + Date.now();
    const secApp = initializeApp(FIREBASE_CONFIG, appName);
    const secAuth = getAuth(secApp);
    const secDb   = getDatabase(secApp);
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, email, nuPass);
      await set(ref(secDb, `users/${cred.user.uid}`), { name: nuName.trim(), email, role: nuRole });
      await deleteApp(secApp);
      toast(`${nuName} eklendi!`, 'ok');
      setAddModal(false); setNuEmail(''); setNuPass(''); setNuName(''); setNuRole('bilet satis');
    } catch (err: unknown) {
      await deleteApp(secApp);
      const code = (err as { code?: string })?.code;
      toast(code === 'auth/email-already-in-use' ? 'Bu e-posta zaten kayıtlı.' : 'Hata: ' + String(err), 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleSilUser = async (uid: string, name: string) => {
    if (!confirm(`"${name}" kullanıcısını silmek istediğinizden emin misiniz?`)) return;
    await remove(ref(db, `users/${uid}`));
    toast('Kullanıcı silindi (Firebase Auth kaydı kalır)', 'ok');
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex justify-between items-center px-7 py-5 border-b border-bd">
        <h2 className="text-[15px] font-semibold text-tx">Kullanıcılar</h2>
        <Button variant="accent" size="sm" onClick={() => setAddModal(true)}>+ Kullanıcı Ekle</Button>
      </div>
      <div className="divide-y divide-bd">
        {users.length === 0 ? (
          <div className="text-mu text-sm text-center py-10">Kullanıcı yok</div>
        ) : users.map(u => (
          <div key={u.uid} className="flex items-center justify-between px-7 py-5 hover:bg-sf2/40 transition-colors">
            <div>
              <div className="font-semibold text-[14px]">{u.name}</div>
              <div className="text-xs text-mu mt-1">{u.email ?? u.uid}</div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={u.role === 'admin' ? 'admin' : 'gise'}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
              {u.uid !== currentUser?.uid && (
                <Button variant="danger" size="sm" onClick={() => handleSilUser(u.uid, u.name)}>Sil</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Kullanıcı Ekle">
        <div className="space-y-4 mb-5">
          <div>
            <label className="text-[11px] font-semibold text-mu uppercase tracking-wide block mb-2">Kullanıcı Adı (e-posta öneki)</label>
            <div className="flex items-center gap-3">
              <input
                value={nuEmail}
                onChange={e => setNuEmail(e.target.value)}
                placeholder="ahmet.yilmaz"
                className="flex-1 bg-bg border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac"
              />
              <span className="text-mu text-sm">@stardust.app</span>
            </div>
          </div>
          <Input label="Şifre" value={nuPass} onChange={e => setNuPass(e.target.value)} type="password" placeholder="En az 6 karakter" />
          <Input label="Ad Soyad" value={nuName} onChange={e => setNuName(e.target.value)} placeholder="Ahmet Yılmaz" />
          <div>
            <label className="text-[11px] font-semibold text-mu uppercase tracking-wide block mb-2">Rol</label>
            <select
              value={nuRole}
              onChange={e => setNuRole(e.target.value as UserRole)}
              className="w-full bg-bg border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac"
            >
              <option value="bilet satis">Bilet Satış</option>
              <option value="okutma">Okutma</option>
              <option value="management1">Management</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setAddModal(false)}>İptal</Button>
          <Button variant="accent" onClick={handleAddUser} disabled={saving}>{saving ? 'Ekleniyor...' : 'Ekle'}</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

// ─── Kurumsal Paket Yönetimi ──────────────────────────────────────────────────

function KurumsalYonetimi() {
  const paketler = useKurumsalPaketler();

  const [modal, setModal]         = useState(false);
  const [editKey, setEditKey]     = useState<string | null>(null);
  const [firma, setFirma]         = useState('');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis]         = useState('');
  const [adet, setAdet]           = useState('');
  const [prefix, setPrefix]       = useState('');

  const openAdd = () => { setEditKey(null); setFirma(''); setBaslangic(''); setBitis(''); setAdet(''); setPrefix(''); setModal(true); };
  const openEdit = (p: KurumsalPaket) => {
    setEditKey(p._key); setFirma(p.firma); setBaslangic(p.baslangic); setBitis(p.bitis);
    setAdet(String(p.adet)); setPrefix(p.prefix); setModal(true);
  };

  const handleSave = async () => {
    if (!firma.trim() || !baslangic || !bitis || !adet || !prefix.trim()) {
      toast('Tüm alanları doldurun', 'err'); return;
    }
    const data = {
      firma: firma.trim(), baslangic, bitis,
      adet: parseInt(adet, 10), kullanilanAdet: 0,
      prefix: prefix.trim().toUpperCase(), createdAt: todayStr(),
    };
    if (editKey) {
      const snap = await get(ref(db, `kurumsalPaketler/${editKey}`));
      const old = snap.val() as KurumsalPaket | null;
      await update(ref(db, `kurumsalPaketler/${editKey}`), {
        ...data, kullanilanAdet: old?.kullanilanAdet ?? 0, createdAt: old?.createdAt ?? todayStr(),
      });
    } else {
      const newRef = ref(db, `kurumsalPaketler/${Date.now().toString(36).toUpperCase()}`);
      await set(newRef, data);
    }
    toast('Kaydedildi', 'ok'); setModal(false);
  };

  const handleSil = async (key: string, name: string) => {
    if (!confirm(`"${name}" kurumsal paketini silmek istiyor musunuz?`)) return;
    await remove(ref(db, `kurumsalPaketler/${key}`));
    toast('Silindi', 'ok');
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex justify-between items-center px-7 py-5 border-b border-bd">
        <h2 className="text-[15px] font-semibold text-tx">Kurumsal Paketler</h2>
        <Button variant="accent" size="sm" onClick={openAdd}>+ Paket Ekle</Button>
      </div>
      {paketler.length === 0 ? (
        <div className="text-mu text-sm text-center py-10">Henüz kurumsal paket yok</div>
      ) : (
        <div className="divide-y divide-bd">
          {paketler.map(p => (
            <div key={p._key} className="flex items-center justify-between px-7 py-5 hover:bg-sf2/40 transition-colors">
              <div>
                <div className="font-semibold text-[14px]">{p.firma}</div>
                <div className="text-xs text-mu font-mono mt-1">{p.prefix} · {p.kullanilanAdet}/{p.adet} kullanıldı · {p.baslangic}–{p.bitis}</div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => openEdit(p)}>Düzenle</Button>
                <Button variant="danger" size="sm" onClick={() => handleSil(p._key, p.firma)}>Sil</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editKey ? 'Paketi Düzenle' : 'Yeni Kurumsal Paket'}>
        <div className="space-y-4 mb-5">
          <Input label="Firma Adı"   value={firma}     onChange={e => setFirma(e.target.value)}     placeholder="Örn: Acme A.Ş." />
          <Input label="Prefix"      value={prefix}    onChange={e => setPrefix(e.target.value)}    placeholder="ACME" />
          <Input label="Bilet Adedi" value={adet}      onChange={e => setAdet(e.target.value)}      type="number" placeholder="100" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Başlangıç (GG.AA.YYYY)" value={baslangic} onChange={e => setBaslangic(e.target.value)} placeholder="01.01.2026" />
            <Input label="Bitiş (GG.AA.YYYY)"     value={bitis}     onChange={e => setBitis(e.target.value)}     placeholder="31.12.2026" />
          </div>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setModal(false)}>İptal</Button>
          <Button variant="accent" onClick={handleSave}>Kaydet</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

// ─── Tehlikeli İşlemler ───────────────────────────────────────────────────────

function TehlikeliIslemler() {
  const satisList = useSatisList();
  const codes     = useCodes();
  const [resetModal, setResetModal] = useState(false);

  const handleExport = () => {
    const data = { tarih: todayStr(), tickets: satisList };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stardust_yedek_${todayStr().replace(/\./g, '-')}.json`;
    a.click();
    toast('Yedek alındı!', 'ok');
  };

  const handleReset = async () => {
    setResetModal(false);
    const updates: Record<string, null> = { tickets: null, biletler: null, pnrler: null };
    await update(ref(db), updates as Record<string, unknown>);

    const codeUpdates: Record<string, unknown> = {};
    codes.forEach(c => {
      if (c) {
        codeUpdates[`codes/${c._key}/status`] = 'aktif';
        codeUpdates[`codes/${c._key}/date`] = '';
        codeUpdates[`codes/${c._key}/kullanan`] = null;
      }
    });
    if (Object.keys(codeUpdates).length > 0) await update(ref(db), codeUpdates);
    toast('Tüm veriler ve kodlar sıfırlandı!', 'ok');
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-rd/20" style={{ background: 'rgba(248,113,113,0.04)' }}>
      <div className="px-7 py-5 border-b border-rd/15">
        <h2 className="text-[15px] font-semibold text-rd">Tehlikeli İşlemler</h2>
      </div>
      <div className="px-7 py-6">
        <div className="flex gap-3">
          <Button onClick={handleExport}>📤 Veri Yedeği Al</Button>
          <Button variant="danger" onClick={() => setResetModal(true)}>⚠️ Verileri Sıfırla</Button>
        </div>
      </div>

      <Modal open={resetModal} onClose={() => setResetModal(false)} title="⚠️ Verileri Sıfırla">
        <div className="bg-rdd border border-rd/30 rounded-xl px-5 py-4 mb-5">
          <p className="text-rd text-sm font-semibold mb-1.5">Bu işlem geri alınamaz!</p>
          <p className="text-sm text-tx/80">Tüm bilet, satış ve giriş verileri silinecek. İndirim kodları aktif hale döndürülecek.</p>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setResetModal(false)}>İptal</Button>
          <Button variant="danger" onClick={handleReset}>Sıfırla</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const satisList = useSatisList();
  const codes     = useCodes();

  const toplamBilet = satisList.reduce((s, t) => s + (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0);
  const toplamGelir = satisList.reduce((s, t) => s + (t.toplam||0), 0);
  const aktifKod    = codes.filter(c => c?.status === 'aktif').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Yönetim Paneli</h1>
        <p className="text-mu text-[13px] mt-1">Sistem ve kullanıcı ayarları</p>
      </div>

      {/* ─── KPI ─── */}
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-7 text-center hover-lift">
          <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Toplam Bilet</div>
          <div className="font-mono text-3xl font-semibold">{toplamBilet.toLocaleString('tr-TR')}</div>
        </div>
        <div className="glass-card rounded-2xl p-7 text-center hover-lift">
          <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Toplam Gelir</div>
          <div className="font-mono text-2xl font-semibold text-gn">{fmtMoney(toplamGelir)}</div>
        </div>
        <div className="glass-card rounded-2xl p-7 text-center hover-lift">
          <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Aktif Kod</div>
          <div className="font-mono text-3xl font-semibold text-ac">{aktifKod.toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <KullaniciYonetimi />
      <KurumsalYonetimi />
      <TehlikeliIslemler />
    </div>
  );
}
