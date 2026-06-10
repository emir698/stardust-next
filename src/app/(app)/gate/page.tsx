'use client';

import { useState, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useBiletler } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { KpiCard } from '@/components/ui/KpiCard';
import { toast } from '@/components/ui/Toast';
import { todayStr, dateToInput, inputToDate, fmtDate } from '@/lib/utils';
import type { Satis } from '@/types';

export default function GatePage() {
  const { user } = useAuth();
  const satisList = useSatisList();
  const biletler  = useBiletler();

  const [selectedTarih, setSelectedTarih] = useState(todayStr());
  const [aramaInput, setAramaInput] = useState('');

  const [girisModal, setGirisModal] = useState(false);
  const [girisTarget, setGirisTarget] = useState<Satis | null>(null);
  const [seciliBiletler, setSeciliBiletler] = useState<Set<string>>(new Set());

  const [isimSecimModal, setIsimSecimModal] = useState(false);
  const [isimSecimList, setIsimSecimList] = useState<Satis[]>([]);

  const gunSatislari = useMemo(
    () => satisList.filter(t => t.tarih === selectedTarih),
    [satisList, selectedTarih]
  );

  const filteredSatislar = useMemo(() => {
    if (!aramaInput.trim()) return gunSatislari;
    const q = aramaInput.toLowerCase();
    return gunSatislari.filter(t =>
      t.pnr?.toLowerCase().includes(q) ||
      t.musteriAd?.toLowerCase().includes(q) ||
      t.musteriTel?.includes(q)
    );
  }, [gunSatislari, aramaInput]);

  const toplamBilet = gunSatislari.reduce(
    (s, t) => s + (t.tam||0) + (t.cocuk||0) + (t.yabanci||0) + (t.davetli||0) + (t.kurumsal||0), 0
  );
  const girisYapan = gunSatislari.reduce((s, t) => {
    if (!t.biletler?.length) return s;
    const used = (t.biletler as Array<{ no: string } | string>).filter(b => {
      const no = typeof b === 'string' ? b : b.no;
      return biletler[no]?.kullanildi;
    }).length;
    return s + used;
  }, 0);

  function isSatisKullanildi(t: Satis) {
    if (!t.biletler?.length) return false;
    return (t.biletler as Array<{ no: string } | string>).every(b => {
      const no = typeof b === 'string' ? b : b.no;
      return biletler[no]?.kullanildi;
    });
  }
  function getSatisKullanilan(t: Satis) {
    if (!t.biletler?.length) return 0;
    return (t.biletler as Array<{ no: string } | string>).filter(b => {
      const no = typeof b === 'string' ? b : b.no;
      return biletler[no]?.kullanildi;
    }).length;
  }

  function handleSorgula() {
    const val = aramaInput.trim();
    if (!val) return;
    const isPNR = /^[A-Z0-9-]{6,}$/i.test(val.replace(/\s/g, '')) && !val.includes(' ');
    if (isPNR) {
      const found = satisList.find(t => t.pnr?.toUpperCase() === val.toUpperCase());
      if (!found) { toast('PNR bulunamadı', 'err'); return; }
      openGirisModal(found);
    } else {
      const bulunanlar = satisList.filter(t => t.musteriAd?.toLowerCase().includes(val.toLowerCase()));
      if (!bulunanlar.length) { toast('Kayıt bulunamadı', 'err'); return; }
      if (bulunanlar.length === 1) { openGirisModal(bulunanlar[0]); return; }
      setIsimSecimList(bulunanlar);
      setIsimSecimModal(true);
    }
  }

  function openGirisModal(satis: Satis) {
    setGirisTarget(satis);
    const bekleyenler = (satis.biletler as Array<{ no: string } | string> || [])
      .map(b => typeof b === 'string' ? b : b.no)
      .filter(no => !biletler[no]?.kullanildi);
    setSeciliBiletler(new Set(bekleyenler));
    setGirisModal(true);
    setIsimSecimModal(false);
  }

  async function handleGirisVer() {
    if (!girisTarget || seciliBiletler.size === 0) return;
    const now = new Date();
    const saat = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const updates: Record<string, unknown> = {};
    seciliBiletler.forEach(no => {
      updates[`biletler/${no}/kullanildi`] = true;
      updates[`biletler/${no}/kullanildiSaat`] = saat;
    });
    const tumBiletNolar = (girisTarget.biletler as Array<{ no: string } | string> || [])
      .map(b => typeof b === 'string' ? b : b.no);
    const bekleyenler = tumBiletNolar.filter(no => !biletler[no]?.kullanildi);
    if (seciliBiletler.size >= bekleyenler.length) {
      updates[`pnrler/${girisTarget.pnr}/kullanildi`] = true;
      updates[`pnrler/${girisTarget.pnr}/kullanildiSaat`] = saat;
    }
    await update(ref(db), updates);
    toast(`${seciliBiletler.size} bilete giriş verildi!`, 'ok');
    setGirisModal(false);
    setGirisTarget(null);
  }

  async function hizliGiris(satis: Satis) {
    const bekleyenler = (satis.biletler as Array<{ no: string } | string> || [])
      .map(b => typeof b === 'string' ? b : b.no)
      .filter(no => !biletler[no]?.kullanildi);
    if (!bekleyenler.length) { toast('Tüm biletler zaten kullanılmış', 'warn'); return; }
    const now = new Date();
    const saat = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const updates: Record<string, unknown> = {};
    bekleyenler.forEach(no => {
      updates[`biletler/${no}/kullanildi`] = true;
      updates[`biletler/${no}/kullanildiSaat`] = saat;
    });
    updates[`pnrler/${satis.pnr}/kullanildi`] = true;
    updates[`pnrler/${satis.pnr}/kullanildiSaat`] = saat;
    await update(ref(db), updates);
    toast(`${bekleyenler.length} bilete giriş verildi!`, 'ok');
  }

  async function handleSil(pnr: string) {
    if (!confirm(`${pnr} numaralı satışı ve tüm biletleri silmek istediğinize emin misiniz?`)) return;
    const satis = satisList.find(t => t.pnr === pnr);
    if (!satis) return;
    const updates: Record<string, null> = {};
    updates[`tickets/${satis.id}`] = null;
    updates[`pnrler/${pnr}`] = null;
    (satis.biletler as Array<{ no: string } | string> || []).forEach(b => {
      const no = typeof b === 'string' ? b : b.no;
      updates[`biletler/${no}`] = null;
    });
    await update(ref(db), updates as Record<string, unknown>);
    toast('Satış silindi', 'ok');
  }

  const targetBiletNolar = girisTarget
    ? (girisTarget.biletler as Array<{ no: string } | string> || []).map(b => typeof b === 'string' ? b : b.no)
    : [];
  const bekleyenBiletler = targetBiletNolar.filter(no => !biletler[no]?.kullanildi);

  return (
    <div className="space-y-6">

      {/* ─── Sayfa Başlığı ─── */}
      <div className="mb-10">
        <h1 className="text-[26px] font-semibold tracking-tight">Kapı Kontrol</h1>
        <p className="text-mu text-[13px] mt-1">Bilet okutma ve giriş yönetimi</p>
      </div>

      {/* ─── Filtrele ─── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd">
          <h2 className="text-[15px] font-semibold text-tx">Filtrele</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8 items-start">

            {/* Tarih */}
            <div>
              <div className="text-[11px] font-semibold text-mu uppercase tracking-widest mb-3">Gün Seç</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedTarih(todayStr())}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    selectedTarih === todayStr() ? 'bg-btn text-white border-btn' : 'bg-sf2 text-tx border-bd hover:border-ac hover:text-ac'
                  }`}
                >Bugün</button>
                <input
                  type="date"
                  value={dateToInput(selectedTarih)}
                  onChange={e => setSelectedTarih(inputToDate(e.target.value))}
                  className="bg-sf2 border border-bd rounded-xl px-4 py-2 text-tx font-mono text-sm outline-none focus:border-ac cursor-pointer"
                />
                {selectedTarih !== todayStr() && (
                  <span className="text-sm text-ac font-medium">{fmtDate(selectedTarih)}</span>
                )}
              </div>
            </div>

            {/* Arama */}
            <div>
              <div className="text-[11px] font-semibold text-mu uppercase tracking-widest mb-3">PNR / Ad Sorgula</div>
              <div className="flex items-center gap-3">
                <input
                  value={aramaInput}
                  onChange={e => setAramaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSorgula()}
                  placeholder="PNR veya ad soyad..."
                  className="flex-1 bg-sf2 border border-bd rounded-xl px-4 py-2.5 text-tx text-sm outline-none focus:border-ac"
                />
                <Button variant="accent" size="sm" onClick={handleSorgula}>Sorgula</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── KPI ─── */}
      <div className="grid grid-cols-2 gap-6">
        <KpiCard label="Seçili Gün Toplam Bilet" value={toplamBilet} color="ac" />
        <KpiCard label="Giriş Yapıldı" value={girisYapan} color="gn" />
      </div>

      {/* ─── Tablo ─── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-tx">
            Günün Satışları {fmtDate(selectedTarih)}
          </h2>
          <span className="text-[13px] text-mu font-mono">{filteredSatislar.length} kayıt</span>
        </div>
        <div className="p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-bd">
                {['PNR','Ad Soyad','Telefon','Seans','Tam','Çocuk','Yab.','Kur.','Saat','Durum','İşlem'].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-[10px] font-semibold text-mu uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSatislar.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-mu">Bu gün için satış yok</td>
                </tr>
              ) : filteredSatislar.map(t => {
                const kullanildi = isSatisKullanildi(t);
                const kullanilan = getSatisKullanilan(t);
                const total = (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0);
                return (
                  <tr key={t.id} className="border-b border-bd last:border-0 hover:bg-sf2/60 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-ac tracking-wide">{t.pnr ?? '—'}</td>
                    <td className="px-6 py-4 text-[13px] font-medium">{t.musteriAd ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-mu font-mono">{t.musteriTel ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-mu font-mono">{t.seans ?? '—'}</td>
                    <td className="px-6 py-4 text-[13px]">{t.tam ?? 0}</td>
                    <td className="px-6 py-4 text-[13px]">{t.cocuk ?? 0}</td>
                    <td className="px-6 py-4 text-[13px]">{t.yabanci ?? 0}</td>
                    <td className="px-6 py-4 text-[13px] text-vi font-semibold">{t.kurumsal ?? 0}</td>
                    <td className="px-6 py-4 text-[11px] text-mu font-mono">{t.satisZamani ?? '—'}</td>
                    <td className="px-6 py-4">
                      {kullanildi
                        ? <Badge variant="inactive">Kullanıldı</Badge>
                        : <Badge variant="active">{kullanilan}/{total} Giriş</Badge>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {!kullanildi && t.pnr && (
                          <Button variant="accent" size="sm" onClick={() => hizliGiris(t)}>Giriş Ver</Button>
                        )}
                        {t.pnr && (
                          <Button size="sm" onClick={() => openGirisModal(t)}>Detay</Button>
                        )}
                        {t.pnr && user?.role === 'admin' && (
                          <Button variant="danger" size="sm" onClick={() => handleSil(t.pnr!)}>Sil</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Giriş Ver Modal ─── */}
      <Modal open={girisModal} onClose={() => setGirisModal(false)} title="🚪 Giriş Ver" width="max-w-lg">
        {girisTarget && (
          <>
            <div className="font-semibold text-base mb-1">{girisTarget.musteriAd}</div>
            <div className="text-xs text-mu font-mono mb-5">
              {girisTarget.tarih} · Seans {girisTarget.seans} · PNR {girisTarget.pnr}
            </div>

            {bekleyenBiletler.length === 0 ? (
              <div className="text-rd text-sm text-center py-8">Tüm biletler kullanılmış!</div>
            ) : (
              <>
                <div className="text-xs text-mu mb-4">
                  Giriş verilecek biletleri seçin ({bekleyenBiletler.length} bekliyor):
                </div>
                <div className="space-y-2 mb-5">
                  {bekleyenBiletler.map(no => (
                    <label
                      key={no}
                      className="flex items-center gap-3 bg-sf2 border border-bd rounded-xl px-4 py-3 cursor-pointer hover:border-bd2 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={seciliBiletler.has(no)}
                        onChange={e => {
                          const next = new Set(seciliBiletler);
                          e.target.checked ? next.add(no) : next.delete(no);
                          setSeciliBiletler(next);
                        }}
                        className="w-4 h-4 accent-ac cursor-pointer"
                      />
                      <span className="font-mono text-xs text-ac flex-1">{no}</span>
                      <span className="text-xs text-mu">{biletler[no]?.tur ?? ''}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {targetBiletNolar.filter(no => biletler[no]?.kullanildi).length > 0 && (
              <div className="text-xs text-mu mb-4">
                {targetBiletNolar.filter(no => biletler[no]?.kullanildi).length} bilet daha önce kullanıldı.
              </div>
            )}

            <ModalActions>
              <Button variant="ghost" onClick={() => setGirisModal(false)}>Kapat</Button>
              {bekleyenBiletler.length > 0 && (
                <Button variant="accent" disabled={seciliBiletler.size === 0} onClick={handleGirisVer}>
                  ✓ Seçili Biletlere Giriş Ver
                </Button>
              )}
            </ModalActions>
          </>
        )}
      </Modal>

      {/* ─── İsim Seçim Modal ─── */}
      <Modal open={isimSecimModal} onClose={() => setIsimSecimModal(false)} title="🔍 Birden Fazla Kayıt Bulundu">
        <p className="text-sm text-mu mb-5">Hangi müşteriyi görüntülemek istiyorsunuz?</p>
        <div className="space-y-2">
          {isimSecimList.map(t => (
            <button
              key={t.id}
              onClick={() => openGirisModal(t)}
              className="w-full flex justify-between items-center bg-sf2 border border-bd rounded-2xl px-5 py-4 hover:border-bd2 transition-all text-left"
            >
              <div>
                <div className="text-sm font-medium">{t.musteriAd}</div>
                <div className="text-xs text-mu font-mono mt-1">
                  {t.tarih} · {t.seans} · {t.pnr}
                </div>
              </div>
              <span className="text-ac font-mono text-sm">→</span>
            </button>
          ))}
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setIsimSecimModal(false)}>Kapat</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
