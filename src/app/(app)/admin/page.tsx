'use client';

import { useState } from 'react';
import { ref, set, remove, update, get } from 'firebase/database';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useCodes, useUsers, useKurumsalPaketler, usePNRler, useBiletler, useSeansTakvimi } from '@/hooks/useFirebaseData';
import { setSeansSaatleri, deleteSeansTarih, seedSeansTakvimi } from '@/lib/db/seans';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { todayStr, fmtMoney, dateToInput, inputToDate } from '@/lib/utils';
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

function KullaniciYonetimi() {
  const { user: currentUser } = useAuth();
  const users = useUsers();

  const [addModal, setAddModal] = useState(false);
  const [nuEmail, setNuEmail]   = useState('');
  const [nuPass, setNuPass]     = useState('');
  const [nuName, setNuName]     = useState('');
  const [nuRole, setNuRole]     = useState<UserRole>('bilet satis');
  const [saving, setSaving]     = useState(false);

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
    <div className="panel">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div className="panel-title" style={{ margin:0 }}>Kullanıcılar</div>
        <Button variant="accent" size="sm" onClick={() => setAddModal(true)}>+ Kullanıcı Ekle</Button>
      </div>
      {users.length === 0 ? (
        <div style={{ color:'var(--mu)', fontSize:13, textAlign:'center', padding:'2rem' }}>Kullanıcı yok</div>
      ) : users.map(u => (
        <div key={u.uid} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>{u.name}</div>
            <div style={{ fontSize:12, color:'var(--mu)', marginTop:2 }}>{u.email ?? u.uid}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Badge variant={u.role === 'admin' ? 'admin' : 'gise'}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
            {u.uid !== currentUser?.uid && (
              <Button variant="danger" size="sm" onClick={() => handleSilUser(u.uid, u.name)}>Sil</Button>
            )}
          </div>
        </div>
      ))}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Kullanıcı Ekle">
        <div style={{ marginBottom:12 }}>
          <label className="form-label">Kullanıcı Adı (e-posta öneki)</label>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input className="form-input" style={{ flex:1 }} value={nuEmail} onChange={e => setNuEmail(e.target.value)} placeholder="ahmet.yilmaz" />
            <span style={{ fontSize:13, color:'var(--mu)' }}>@stardust.app</span>
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <Input label="Şifre" value={nuPass} onChange={e => setNuPass(e.target.value)} type="password" placeholder="En az 6 karakter" />
        </div>
        <div style={{ marginBottom:12 }}>
          <Input label="Ad Soyad" value={nuName} onChange={e => setNuName(e.target.value)} placeholder="Ahmet Yılmaz" />
        </div>
        <div style={{ marginBottom:12 }}>
          <label className="form-label">Rol</label>
          <select id="nu-role" className="form-input" value={nuRole} onChange={e => setNuRole(e.target.value as UserRole)}>
            <option value="bilet satis">Bilet Satış</option>
            <option value="okutma">Okutma</option>
            <option value="management1">Management</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setAddModal(false)}>İptal</Button>
          <Button variant="accent" onClick={handleAddUser} disabled={saving}>{saving ? 'Ekleniyor...' : 'Ekle'}</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

function KurumsalYonetimi() {
  const paketler = useKurumsalPaketler();

  const [modal, setModal]         = useState(false);
  const [editKey, setEditKey]     = useState<string | null>(null);
  const [firma, setFirma]         = useState('');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis]         = useState('');
  const [adet, setAdet]           = useState('');
  const [prefix, setPrefix]       = useState('');

  const openAdd  = () => { setEditKey(null); setFirma(''); setBaslangic(''); setBitis(''); setAdet(''); setPrefix(''); setModal(true); };
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
      adet: parseInt(adet, 10), kullanilan: 0,
      prefix: prefix.trim().toUpperCase(), createdAt: todayStr(),
    };
    if (editKey) {
      const snap = await get(ref(db, `kurumsalPaketler/${editKey}`));
      const old = snap.val() as KurumsalPaket | null;
      await update(ref(db, `kurumsalPaketler/${editKey}`), {
        ...data, kullanilan: old?.kullanilan ?? 0, createdAt: old?.createdAt ?? todayStr(),
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
    <div className="panel">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div className="panel-title" style={{ margin:0 }}>Kurumsal Paketler</div>
        <Button variant="accent" size="sm" onClick={openAdd}>+ Paket Ekle</Button>
      </div>
      {paketler.length === 0 ? (
        <div style={{ color:'var(--mu)', fontSize:13, textAlign:'center', padding:'2rem' }}>Henüz kurumsal paket yok</div>
      ) : paketler.map(p => (
        <div key={p._key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>{p.firma}</div>
            <div style={{ fontSize:12, color:'var(--mu)', fontFamily:'var(--mo)', marginTop:2 }}>
              {p.prefix} · {p.kullanilan}/{p.adet} kullanıldı · {p.baslangic}–{p.bitis}
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <Button size="sm" onClick={() => openEdit(p)}>Düzenle</Button>
            <Button variant="danger" size="sm" onClick={() => handleSil(p._key, p.firma)}>Sil</Button>
          </div>
        </div>
      ))}

      <Modal open={modal} onClose={() => setModal(false)} title={editKey ? 'Paketi Düzenle' : 'Yeni Kurumsal Paket'}>
        <div style={{ marginBottom:12 }}><Input label="Firma Adı"   value={firma}     onChange={e => setFirma(e.target.value)}     placeholder="Örn: Acme A.Ş." /></div>
        <div style={{ marginBottom:12 }}><Input label="Prefix"      value={prefix}    onChange={e => setPrefix(e.target.value)}    placeholder="ACME" /></div>
        <div style={{ marginBottom:12 }}><Input label="Bilet Adedi" value={adet}      onChange={e => setAdet(e.target.value)}      type="number" placeholder="100" /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <Input label="Başlangıç (GG.AA.YYYY)" value={baslangic} onChange={e => setBaslangic(e.target.value)} placeholder="01.01.2026" />
          <Input label="Bitiş (GG.AA.YYYY)"     value={bitis}     onChange={e => setBitis(e.target.value)}     placeholder="31.12.2026" />
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setModal(false)}>İptal</Button>
          <Button variant="accent" onClick={handleSave}>Kaydet</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

function KurumsalBiletTakibi() {
  const pnrler   = usePNRler();
  const biletler = useBiletler();
  const paketler = useKurumsalPaketler();

  interface FirmaOzet { firma: string; toplam: number; giris: number; }

  const ozet: Record<string, FirmaOzet> = {};

  // 1) PNR üzerinden kişiye özel kesilmiş kurumsal biletler (tur === 'kurumsal')
  //    Firma adı PNR'deki musteriAd'den gelir (örn. "Koru Sigorta").
  Object.values(pnrler).forEach(p => {
    const biletNoList = p.biletler ?? [];
    const kurumsalNolar = biletNoList.filter(b => biletler[b.no]?.tur === 'kurumsal');
    if (kurumsalNolar.length === 0) return;
    const ad = p.musteriAd?.trim() || 'Tanımsız Firma';
    const giris = kurumsalNolar.filter(b => biletler[b.no]?.kullanildi).length;
    if (!ozet[ad]) ozet[ad] = { firma: ad, toplam: 0, giris: 0 };
    ozet[ad].toplam += kurumsalNolar.length;
    ozet[ad].giris += giris;
  });

  // 2) Sabit adetli kurumsal paket kodları (örn. tek bir kod ile satılan toplu paketler)
  paketler.forEach(p => {
    const ad = p.firma?.trim() || 'Tanımsız Firma';
    if (!ozet[ad]) ozet[ad] = { firma: ad, toplam: 0, giris: 0 };
    ozet[ad].toplam += p.adet ?? 0;
    ozet[ad].giris += p.kullanilan ?? 0;
  });

  const liste = Object.values(ozet).sort((a, b) => a.firma.localeCompare(b.firma, 'tr'));
  const genelToplam = liste.reduce((s, f) => s + f.toplam, 0);
  const genelGiris  = liste.reduce((s, f) => s + f.giris, 0);

  return (
    <div className="panel">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div className="panel-title" style={{ margin:0 }}>Kurumsal Bilet Takibi</div>
        <Badge variant="gise">{genelGiris}/{genelToplam} okutuldu</Badge>
      </div>
      {liste.length === 0 ? (
        <div style={{ color:'var(--mu)', fontSize:13, textAlign:'center', padding:'2rem' }}>Henüz kurumsal bilet kaydı yok</div>
      ) : liste.map(f => {
        const kalan = f.toplam - f.giris;
        return (
          <div key={f.firma} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{f.firma}</div>
              <div style={{ fontSize:12, color:'var(--mu)', fontFamily:'var(--mo)', marginTop:2 }}>
                {f.giris}/{f.toplam} okutuldu · {kalan} kaldı
              </div>
            </div>
            <Badge variant={f.giris > 0 ? 'admin' : 'gise'}>{f.giris}/{f.toplam}</Badge>
          </div>
        );
      })}
    </div>
  );
}


function SeansTakvimiYonetimi() {
  const { takvim, loading } = useSeansTakvimi();

  const [modal, setModal]       = useState(false);
  const [editTarih, setEditTarih] = useState('');
  const [saatInput, setSaatInput] = useState('');
  const [saving, setSaving]     = useState(false);
  const [seeding, setSeeding]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const sortedEntries = Object.entries(takvim).sort(([a], [b]) => {
    const toMs = (s: string) => {
      const [d, m, y] = s.split('.');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
    };
    return toMs(a) - toMs(b);
  });

  const openAdd = () => {
    setEditTarih('');
    setSaatInput('');
    setModal(true);
  };

  const openEdit = (tarih: string, saatler: string[]) => {
    setEditTarih(dateToInput(tarih));
    setSaatInput(saatler.join(', '));
    setModal(true);
  };

  const handleSave = async () => {
    if (!editTarih) { toast('Tarih seçin', 'err'); return; }
    setSaving(true);
    const tarih = inputToDate(editTarih);
    const saatler = saatInput
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => /^\d{2}:\d{2}$/.test(s));
    await setSeansSaatleri(tarih, saatler);
    toast(`${tarih} kaydedildi`, 'ok');
    setSaving(false);
    setModal(false);
  };

  const handleDelete = async (tarih: string) => {
    setDeleting(tarih);
    await deleteSeansTarih(tarih);
    toast(`${tarih} silindi`, 'ok');
    setDeleting(null);
  };

  const handleSeed = async () => {
    setSeeding(true);
    await seedSeansTakvimi();
    toast('Mevcut takvim Firebase\'e aktarıldı', 'ok');
    setSeeding(false);
  };

  const gunAdi = (ds: string) => {
    const [d, m, y] = ds.split('.');
    const names = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    return names[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()];
  };

  return (
    <div style={{ border:'1px solid var(--br)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--br)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--color-tx)', textTransform:'uppercase', letterSpacing:'.5px' }}>Seans Takvimi</div>
          <div style={{ fontSize:12, color:'var(--color-mu)', marginTop:2 }}>Firebase üzerinden yönet — kaydettiğin an web ve Gate uygulaması güncellenir.</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {Object.keys(takvim).length === 0 && !loading && (
            <Button onClick={handleSeed} disabled={seeding}>{seeding ? 'Aktarılıyor...' : '📥 Mevcut Takvimi Aktar'}</Button>
          )}
          <Button onClick={openAdd}>+ Tarih Ekle</Button>
        </div>
      </div>

      <div style={{ padding:'1rem 1.25rem' }}>
        {loading && <div style={{ fontSize:13, color:'var(--color-mu)' }}>Yükleniyor...</div>}

        {!loading && sortedEntries.length === 0 && (
          <div style={{ fontSize:13, color:'var(--color-mu)', textAlign:'center', padding:'24px 0' }}>
            Henüz takvimde tarih yok. "Mevcut Takvimi Aktar" ile başlayabilirsiniz.
          </div>
        )}

        {sortedEntries.map(([tarih, saatler]) => (
          <div key={tarih} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--br)' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--color-tx)' }}>
                {tarih} <span style={{ fontWeight:400, color:'var(--color-mu)' }}>{gunAdi(tarih)}</span>
              </div>
              <div style={{ fontSize:12, color:'var(--color-mu)', marginTop:2 }}>
                {saatler.length === 0
                  ? <span style={{ color:'var(--rd)' }}>Etkinlik yok (override)</span>
                  : saatler.join(' · ')}
              </div>
            </div>
            <Button onClick={() => openEdit(tarih, saatler)}>Düzenle</Button>
            <Button variant="danger" onClick={() => handleDelete(tarih)} disabled={deleting === tarih}>
              {deleting === tarih ? '...' : 'Sil'}
            </Button>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editTarih ? 'Seans Düzenle' : 'Yeni Tarih Ekle'}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <div style={{ fontSize:12, color:'var(--color-mu)', marginBottom:4 }}>Tarih</div>
            <Input type="date" value={editTarih} onChange={e => setEditTarih(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:12, color:'var(--color-mu)', marginBottom:4 }}>Seans saatleri (virgülle ayır)</div>
            <Input
              placeholder="21:15, 21:30, 22:00, 22:30"
              value={saatInput}
              onChange={e => setSaatInput(e.target.value)}
            />
            <div style={{ fontSize:11, color:'var(--color-mu)', marginTop:4 }}>Boş bırakırsan o gün "etkinlik yok" olarak işaretlenir (haftalık kuralı override eder).</div>
          </div>
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setModal(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

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
    <div style={{ border:'1px solid rgba(248,113,113,0.2)', borderRadius:12, background:'rgba(248,113,113,0.04)', overflow:'hidden' }}>
      <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid rgba(248,113,113,0.15)' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--rd)', textTransform:'uppercase', letterSpacing:'.5px' }}>Tehlikeli İşlemler</div>
      </div>
      <div style={{ padding:'1rem 1.25rem' }}>
        <div style={{ display:'flex', gap:12 }}>
          <Button onClick={handleExport}>📤 Veri Yedeği Al</Button>
          <Button variant="danger" onClick={() => setResetModal(true)}>⚠️ Verileri Sıfırla</Button>
        </div>
      </div>

      <Modal open={resetModal} onClose={() => setResetModal(false)} title="⚠️ Verileri Sıfırla">
        <div style={{ background:'var(--rdd)', border:'1px solid rgba(248,113,113,.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <p style={{ color:'var(--rd)', fontSize:13, fontWeight:600, marginBottom:6 }}>Bu işlem geri alınamaz!</p>
          <p style={{ fontSize:13 }}>Tüm bilet, satış ve giriş verileri silinecek. İndirim kodları aktif hale döndürülecek.</p>
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setResetModal(false)}>İptal</Button>
          <Button variant="danger" onClick={handleReset}>Sıfırla</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

export default function AdminPage() {
  const satisList = useSatisList();
  const codes     = useCodes();

  const toplamBilet = satisList.reduce((s, t) => s+(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0);
  const toplamGelir = satisList.reduce((s, t) => s+(t.toplam||0), 0);
  const aktifKod    = codes.filter(c => c?.status === 'aktif').length;

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-tx)', letterSpacing: '-0.02em', margin: 0 }}>Admin</h1>
        <p style={{ fontSize: 13, color: 'var(--color-mu)', marginTop: 4 }}>Kullanıcı ve sistem yönetimi.</p>
      </div>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:'1.5rem' }}>
        <div className="kpi"><div className="kpi-label">Toplam Bilet</div><div className="kpi-val">{toplamBilet.toLocaleString('tr-TR')}</div></div>
        <div className="kpi"><div className="kpi-label">Toplam Gelir</div><div className="kpi-val gn">{fmtMoney(toplamGelir)}</div></div>
        <div className="kpi"><div className="kpi-label">Aktif Kod</div><div className="kpi-val ac">{aktifKod.toLocaleString('tr-TR')}</div></div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
        <KullaniciYonetimi />
        <KurumsalYonetimi />
        <KurumsalBiletTakibi />
        <SeansTakvimiYonetimi />
        <TehlikeliIslemler />
      </div>
    </div>
  );
}
