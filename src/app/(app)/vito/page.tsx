'use client';

import { useState, useMemo } from 'react';
import { ref, push, set, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useVitoDrivers, useCodes, useBatches } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import QRCode from 'qrcode';
import {
  todayStr, dateToInput, inputToDate, getSaatler,
  isEtkinlikGunu, fmtMoney, genID, genPNR, fmtDate,
} from '@/lib/utils';
import { hesaplaFiyat } from '@/lib/pricing';
import { type TicketQty, type Satis, type IndirimKodu, type VitoDriver } from '@/types';

const EMPTY_QTY: TicketQty = { tam: 0, cocuk: 0, yabanci: 0, davetli: 0, kurumsal: 0 };
const TICKET_TYPES = [
  { key: 'tam'      as const, label: 'Tam',     price: 1500 },
  { key: 'cocuk'    as const, label: 'Çocuk',   price: 1200 },
  { key: 'yabanci'  as const, label: 'Yabancı', price: 2250 },
  { key: 'davetli'  as const, label: 'Davetli', price: 0    },
];

async function buildQRUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 160, margin: 1 });
}

// ─── Sekme: Bilet Sat ────────────────────────────────────────────────────────

function VitoBiletSat({ drivers, satisList, user }: {
  drivers: VitoDriver[];
  satisList: Satis[];
  user: ReturnType<typeof useAuth>['user'];
}) {
  const codes   = useCodes();
  const batches = useBatches();

  const [selectedTarih, setSelectedTarih] = useState(todayStr());
  const [selectedSeans, setSelectedSeans] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [ad, setAd]     = useState('');
  const [soyad, setSoyad] = useState('');
  const [tel, setTel]   = useState('');
  const [mail, setMail] = useState('');
  const [qty, setQty]   = useState<TicketQty>({ ...EMPTY_QTY });
  const [indirimInput, setIndirimInput] = useState('');
  const [aktifKod, setAktifKod]         = useState<IndirimKodu | null>(null);
  const [indirimOrani, setIndirimOrani] = useState(0);
  const [indirimMsg, setIndirimMsg]     = useState('');
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [biletModal, setBiletModal]     = useState(false);
  const [biletler, setBiletler]         = useState<Array<{ no: string; tur: string; qrUrl: string }>>([]);
  const [lastPNR, setLastPNR]           = useState('');
  const [lastAdSoyad, setLastAdSoyad]   = useState('');

  const saatler    = getSaatler(selectedTarih);
  const isEtkinlik = isEtkinlikGunu(selectedTarih);
  const seansCounts = useMemo(() =>
    satisList.filter(s => s.tarih === selectedTarih).reduce((acc, s) => {
      const n = (s.tam||0)+(s.cocuk||0)+(s.yabanci||0)+(s.davetli||0)+(s.kurumsal||0);
      acc[s.seans] = (acc[s.seans] || 0) + n; return acc;
    }, {} as Record<string, number>)
  , [satisList, selectedTarih]);

  const driver    = drivers.find(d => d._key === selectedDriver);
  const toplam    = qty.tam + qty.cocuk + qty.yabanci + qty.davetli + qty.kurumsal;
  const p         = hesaplaFiyat(qty.tam, qty.cocuk, qty.yabanci);
  const gelirBase = p.gelir;
  const indirimTutar = indirimOrani > 0 ? Math.round(gelirBase * indirimOrani) : 0;
  const sonToplam = gelirBase - indirimTutar;
  const vitoKom   = driver ? Math.round(gelirBase * (driver.komisyonOran / 100)) : 0;

  const handleIndirimUygula = () => {
    const kod = indirimInput.trim().toUpperCase();
    const found = codes.find(c => c.code === kod);
    if (!found) { setIndirimMsg('❌ Geçersiz kod.'); return; }
    if (found.status === 'deaktif') { setIndirimMsg('❌ Bu kod daha önce kullanılmış.'); return; }
    const batch = batches.find(b => b.codes?.includes(kod));
    const oran = batch?.indirim ?? found.indirim ?? 10;
    setAktifKod(found); setIndirimOrani(oran / 100);
    setIndirimMsg(`✅ %${oran} indirim uygulandı!`);
  };

  const handleTamamla = async () => {
    if (!selectedSeans || !user) return;
    setConfirmOpen(false);
    const adSoyad  = `${ad.trim()} ${soyad.trim()}`.trim();
    const pnr      = 'PNR-' + genPNR();
    const now      = new Date();
    const saat     = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const satisId  = genID();

    const biletNolar: string[] = [];
    const biletlerFirebase: Record<string, unknown> = {};
    const preview: Array<{ no: string; tur: string; qrUrl: string }> = [];

    for (const tp of TICKET_TYPES) {
      for (let i = 0; i < (qty[tp.key] || 0); i++) {
        const bNo = `SD-${selectedSeans}-${genID()}`;
        biletNolar.push(bNo);
        biletlerFirebase[bNo] = { no: bNo, pnr, seans: selectedSeans, tur: tp.key, tarih: selectedTarih, kullanildi: false };
        preview.push({ no: bNo, tur: tp.label, qrUrl: await buildQRUrl(bNo) });
      }
    }

    const satis: Partial<Satis> = {
      id: satisId, pnr, tarih: selectedTarih, seans: selectedSeans,
      satisZamani: saat, kasiyerId: user.uid, kasiyerAd: user.name,
      musteriAd: adSoyad, musteriTel: tel.trim(), musteriMail: mail.trim(),
      tam: qty.tam, cocuk: qty.cocuk, yabanci: qty.yabanci, davetli: qty.davetli, kurumsal: 0,
      toplam: sonToplam,
      ...(driver ? { vitoSurucu: driver._key, vitoPlaka: driver.plaka, vitoKomisyon: vitoKom, vitoOdendi: false } : {}),
    };

    const updates: Record<string, unknown> = {};
    updates[`tickets/${satisId}`] = satis;
    updates[`pnrler/${pnr}`] = {
      satisId, pnr, musteriAd: adSoyad, musteriTel: tel, musteriMail: mail,
      tarih: selectedTarih, seans: selectedSeans,
      tam: qty.tam, cocuk: qty.cocuk, yabanci: qty.yabanci, davetli: qty.davetli,
      toplam: sonToplam, biletler: [], kullanildi: false,
    };
    Object.entries(biletlerFirebase).forEach(([k, v]) => { updates[`biletler/${k}`] = v; });
    if (aktifKod) updates[`codes/${aktifKod._key}`] = { ...aktifKod, status: 'deaktif', date: todayStr(), kullanan: adSoyad };
    await update(ref(db), updates);

    setLastPNR(pnr); setLastAdSoyad(adSoyad); setBiletler(preview); setBiletModal(true);
    setSelectedSeans(null); setQty({ ...EMPTY_QTY }); setAd(''); setSoyad(''); setTel(''); setMail('');
    setAktifKod(null); setIndirimOrani(0); setIndirimInput(''); setIndirimMsg('');
    toast(`${biletNolar.length} bilet oluşturuldu!`, 'ok');
  };

  const activeDrivers = drivers.filter(d => d.aktif);

  return (
    <div className="space-y-6">

      {/* Sürücü seçimi */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd">
          <h2 className="text-[15px] font-semibold text-tx">Vito Sürücüsü</h2>
        </div>
        <div className="p-7">
          <select
            value={selectedDriver}
            onChange={e => setSelectedDriver(e.target.value)}
            className="w-full bg-sf2 border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac"
          >
            <option value="">— Sürücü seçin —</option>
            {activeDrivers.map(d => <option key={d._key} value={d._key}>{d.ad} · {d.plaka}</option>)}
          </select>
          {driver && (
            <div className="mt-4 bg-bl/8 border border-bl/20 rounded-xl px-4 py-3 text-xs">
              <div className="text-[10px] text-bl uppercase tracking-widest mb-2 font-semibold">Seçili Sürücü</div>
              <div className="flex gap-6 text-mu">
                <span className="text-tx font-medium">{driver.ad}</span>
                <span className="font-mono text-ac">{driver.plaka}</span>
                <span>%{driver.komisyonOran} komisyon</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tarih */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd">
          <h2 className="text-[15px] font-semibold text-tx">Tarih Seç</h2>
        </div>
        <div className="px-7 py-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedTarih(todayStr()); setSelectedSeans(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                selectedTarih === todayStr() ? 'bg-btn text-white border-btn' : 'bg-sf2 text-tx border-bd hover:border-bd2'
              }`}
            >
              Bugün
            </button>
            <input
              type="date"
              value={dateToInput(selectedTarih)}
              onChange={e => { setSelectedTarih(inputToDate(e.target.value)); setSelectedSeans(null); }}
              className="bg-sf2 border border-bd rounded-xl px-4 py-2 text-tx font-mono text-sm outline-none focus:border-ac cursor-pointer"
            />
            {selectedTarih !== todayStr() && (
              <span className="text-sm text-ac font-medium">{fmtDate(selectedTarih)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Seans */}
      {isEtkinlik && saatler && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-bd">
            <h2 className="text-[15px] font-semibold text-tx">Seans Seç</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-5 gap-3">
              {saatler.map((saat, idx) => (
                <button
                  key={saat}
                  onClick={() => setSelectedSeans(saat)}
                  className={`border-2 rounded-2xl py-4 px-2 text-center cursor-pointer transition-all hover-lift ${
                    selectedSeans === saat ? 'border-bl bg-bl/10' : 'border-bd bg-sf2/60 hover:border-bd2'
                  }`}
                >
                  <div className="text-[28px] font-semibold font-mono text-bl leading-none">{idx + 1}</div>
                  <div className="text-[11px] text-mu mt-2">{saat}</div>
                  <div className="text-sm text-tx font-mono font-semibold mt-1">{seansCounts[saat] ?? 0}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Müşteri + Biletler */}
      {selectedSeans && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-bd">
            <h2 className="text-[15px] font-semibold text-tx">
              Satış — Seans <span className="text-ac font-normal">{selectedSeans}</span>
            </h2>
          </div>
          <div className="p-7">
            <p className="text-[11px] font-semibold text-mu uppercase tracking-widest mb-4">Müşteri Bilgileri</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Input label="Ad"      value={ad}    onChange={e => setAd(e.target.value)}    placeholder="Ad" />
              <Input label="Soyad"   value={soyad} onChange={e => setSoyad(e.target.value)} placeholder="Soyad" />
              <Input label="Telefon" value={tel}   onChange={e => setTel(e.target.value)}   type="tel" />
              <Input label="E-posta" value={mail}  onChange={e => setMail(e.target.value)}  type="email" />
            </div>

            <div className="h-px bg-bd mb-8" />
            <p className="text-[11px] font-semibold text-mu uppercase tracking-widest mb-4">Bilet Türleri</p>

            <div className="space-y-1 mb-6">
              {TICKET_TYPES.map(tp => (
                <div key={tp.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-4 rounded-xl hover:bg-sf2/50 transition-colors">
                  <div className="text-[14px] font-medium">{tp.label}</div>
                  <div className="text-sm font-mono text-ac font-semibold whitespace-nowrap">
                    {tp.price > 0 ? `${tp.price.toLocaleString('tr-TR')} ₺` : '0 ₺'}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQty(q => ({ ...q, [tp.key]: Math.max(0, q[tp.key] - 1) }))}
                      className="w-9 h-9 rounded-xl border border-bd bg-sf text-tx text-lg flex items-center justify-center hover:border-ac hover:text-ac transition-all"
                    >−</button>
                    <span className="w-8 text-center font-semibold font-mono text-[16px]">{qty[tp.key]}</span>
                    <button
                      onClick={() => setQty(q => ({ ...q, [tp.key]: q[tp.key] + 1 }))}
                      className="w-9 h-9 rounded-xl border border-bd bg-sf text-tx text-lg flex items-center justify-center hover:border-ac hover:text-ac transition-all"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>

            {toplam > 0 && driver && (
              <div className="bg-bl/8 border border-bl/20 rounded-xl px-5 py-4 mb-4">
                <div className="text-[10px] text-bl uppercase tracking-widest mb-2 font-semibold">Vito Komisyon</div>
                <div className="flex justify-between text-gn font-semibold text-sm">
                  <span>{driver.ad} · {driver.plaka}</span>
                  <span>{fmtMoney(vitoKom)} (%{driver.komisyonOran})</span>
                </div>
              </div>
            )}

            {toplam > 0 && (
              <div className="flex justify-between items-center bg-sf2/60 border border-bd rounded-xl px-5 py-4 mb-6">
                <span className="text-sm text-mu">TOPLAM ({toplam} kişi)</span>
                <span className="font-mono font-semibold text-[16px] text-ac">{fmtMoney(sonToplam)}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-bd">
              <Button variant="ghost" onClick={() => { setSelectedSeans(null); setQty({ ...EMPTY_QTY }); }}>İptal</Button>
              <Button variant="accent" disabled={toplam === 0 || !ad.trim()} onClick={() => setConfirmOpen(true)}>
                Satışı Tamamla
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Satışı Onayla">
        <div className="text-sm space-y-2 bg-sf2 border border-bd rounded-xl p-4 mb-4">
          <div className="flex justify-between"><span className="text-mu">Müşteri</span><span className="font-medium">{ad} {soyad}</span></div>
          <div className="flex justify-between"><span className="text-mu">Tarih / Seans</span><span>{selectedTarih} / {selectedSeans}</span></div>
          {driver && <div className="flex justify-between"><span className="text-mu">Sürücü</span><span>{driver.ad}</span></div>}
          <div className="flex justify-between text-ac font-semibold pt-2 border-t border-bd">
            <span>Toplam</span><span>{fmtMoney(sonToplam)}</span>
          </div>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>İptal</Button>
          <Button variant="accent" onClick={handleTamamla}>✓ Onayla</Button>
        </ModalActions>
      </Modal>

      <Modal open={biletModal} onClose={() => setBiletModal(false)} title="🎟️ Biletler Hazır" width="max-w-xl">
        <p className="text-sm text-mu mb-5">PNR: <span className="font-mono text-ac">{lastPNR}</span> · {lastAdSoyad}</p>
        <div className="space-y-3">
          {biletler.map(b => (
            <div key={b.no} className="bg-white text-black rounded-2xl p-5 border border-gray-200 text-center">
              <div className="text-[10px] tracking-[3px] text-gray-400 mb-1">✦ STARDUST ✦</div>
              <div className="font-bold text-base mb-1">Astra Lumina İstanbul</div>
              <div className="text-xs text-gray-500 mb-3">{selectedTarih} — Seans {selectedSeans}</div>
              <div className="flex justify-center mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.qrUrl} alt="QR" width={120} height={120} className="rounded-xl" />
              </div>
              <div className="font-semibold text-sm">{lastAdSoyad}</div>
              <div className="text-[9px] text-gray-400 font-mono mt-1">{b.no}</div>
            </div>
          ))}
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setBiletModal(false)}>Kapat</Button>
          <Button variant="accent" onClick={() => window.print()}>🖨️ Yazdır</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

// ─── Sekme: Sürücüler ────────────────────────────────────────────────────────

function VitoSurucular({ drivers }: { drivers: VitoDriver[] }) {
  const [ad, setAd]       = useState('');
  const [plaka, setPlaka] = useState('');
  const [tel, setTel]     = useState('');
  const [oran, setOran]   = useState('20');

  const handleEkle = async () => {
    if (!ad.trim() || !plaka.trim()) { toast('Ad ve plaka zorunlu', 'err'); return; }
    const newRef = push(ref(db, 'vitoDrivers'));
    await set(newRef, { ad: ad.trim(), plaka: plaka.trim().toUpperCase(), tel: tel.trim(), komisyonOran: parseInt(oran, 10), aktif: true });
    setAd(''); setPlaka(''); setTel(''); setOran('20');
    toast('Sürücü eklendi', 'ok');
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd">
          <h2 className="text-[15px] font-semibold text-tx">Yeni Sürücü Ekle</h2>
        </div>
        <div className="p-7">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Input label="Ad Soyad" value={ad}    onChange={e => setAd(e.target.value)}    placeholder="Ahmet Yılmaz" />
            <Input label="Plaka"    value={plaka} onChange={e => setPlaka(e.target.value)} placeholder="34 ABC 123" />
            <Input label="Telefon"  value={tel}   onChange={e => setTel(e.target.value)}   type="tel" />
            <div>
              <label className="text-[11px] font-semibold text-mu uppercase tracking-widest block mb-2">Komisyon Oranı</label>
              <select
                value={oran}
                onChange={e => setOran(e.target.value)}
                className="w-full bg-sf2 border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac"
              >
                {[10,15,20,25,30].map(v => <option key={v} value={String(v)}>%{v}</option>)}
              </select>
            </div>
          </div>
          <Button variant="accent" onClick={handleEkle}>+ Sürücü Ekle</Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-tx">Sürücü Listesi</h2>
          <span className="text-[11px] text-mu">{drivers.length} sürücü</span>
        </div>
        {drivers.length === 0 ? (
          <div className="text-mu text-sm text-center py-10">Henüz sürücü yok</div>
        ) : (
          <div className="divide-y divide-bd">
            {drivers.map(d => (
              <div key={d._key} className="flex items-center justify-between px-7 py-5 hover:bg-sf2/40 transition-colors">
                <div>
                  <div className="font-semibold text-[14px]">{d.ad}</div>
                  <div className="text-xs text-mu font-mono mt-1">{d.plaka} · %{d.komisyonOran} komisyon</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={d.aktif ? 'active' : 'inactive'}>{d.aktif ? 'Aktif' : 'Pasif'}</Badge>
                  <Button size="sm" onClick={() => update(ref(db, `vitoDrivers/${d._key}`), { aktif: !d.aktif })}>
                    {d.aktif ? 'Pasife Al' : 'Aktif Et'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => {
                    if (confirm('Sürücüyü silmek istediğinizden emin misiniz?')) {
                      remove(ref(db, `vitoDrivers/${d._key}`));
                      toast('Sürücü silindi', 'ok');
                    }
                  }}>Sil</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sekme: Komisyon ─────────────────────────────────────────────────────────

function VitoKomisyon({ drivers, satisList }: { drivers: VitoDriver[]; satisList: Satis[] }) {
  const [filtreSurucu, setFiltreSurucu] = useState('');

  const vitoSatislar  = satisList.filter(t => t.vitoSurucu);
  const filtered      = filtreSurucu ? vitoSatislar.filter(t => t.vitoSurucu === filtreSurucu) : vitoSatislar;
  filtered.sort((a, b) => b.tarih.localeCompare(a.tarih));

  const toplamTur     = filtered.length;
  const toplamKisi    = filtered.reduce((s, t) => s + (t.tam||0)+(t.cocuk||0)+(t.yabanci||0), 0);
  const toplamHakedis = filtered.reduce((s, t) => s + (t.vitoKomisyon||0), 0);

  const handleToggleOdeme = async (satisId: string, current: boolean) => {
    await update(ref(db, `tickets/${satisId}`), { vitoOdendi: !current });
    toast(!current ? 'Ödeme işaretlendi' : 'Ödeme geri alındı', 'ok');
  };

  return (
    <div className="space-y-6">

      {/* Filtre + KPI yan yana */}
      <div className="grid grid-cols-[260px_1fr] gap-6 items-start">
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-bd">
            <h2 className="text-[15px] font-semibold text-tx">Sürücü Filtresi</h2>
          </div>
          <div className="px-7 py-5">
            <select
              value={filtreSurucu}
              onChange={e => setFiltreSurucu(e.target.value)}
              className="w-full bg-sf2 border border-bd rounded-xl px-4 py-2.5 text-tx text-sm outline-none focus:border-ac"
            >
              <option value="">Tüm Sürücüler</option>
              {drivers.filter(d => d.aktif).map(d => <option key={d._key} value={d._key}>{d.ad}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 text-center hover-lift">
            <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Toplam Tur</div>
            <div className="font-mono text-3xl font-semibold">{toplamTur}</div>
          </div>
          <div className="glass-card rounded-2xl p-6 text-center hover-lift">
            <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Toplam Kişi</div>
            <div className="font-mono text-3xl font-semibold">{toplamKisi}</div>
          </div>
          <div className="glass-card rounded-2xl p-6 text-center hover-lift">
            <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Toplam Hakediş</div>
            <div className="font-mono text-2xl font-semibold text-bl">{fmtMoney(toplamHakedis)}</div>
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-tx">Vito Turları</h2>
          <span className="text-[11px] text-mu">{filtered.length} kayıt</span>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-bd">
              {['Sürücü','Müşteri','Tarih','Seans','Kişi','Hakediş','Ödeme'].map(h => (
                <th key={h} className="px-5 py-4 text-left text-[10px] font-semibold text-mu uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-mu">Vito satışı bulunamadı</td></tr>
            ) : filtered.map(t => {
              const drv = drivers.find(d => d._key === t.vitoSurucu);
              return (
                <tr key={t.id} className="border-b border-bd last:border-0 hover:bg-sf2/60 transition-colors">
                  <td className="px-5 py-4 text-[13px] font-medium">{drv?.ad ?? '—'}</td>
                  <td className="px-5 py-4 text-[13px]">{t.musteriAd}</td>
                  <td className="px-5 py-4 font-mono text-xs text-mu">{t.tarih}</td>
                  <td className="px-5 py-4 font-mono text-xs">{t.seans}</td>
                  <td className="px-5 py-4 font-mono text-[13px]">{(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)}</td>
                  <td className="px-5 py-4 text-bl font-mono font-semibold text-[13px]">{fmtMoney(t.vitoKomisyon||0)}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleToggleOdeme(t.id, !!t.vitoOdendi)}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                        t.vitoOdendi
                          ? 'bg-gd text-gn hover:bg-rdd hover:text-rd'
                          : 'bg-rdd text-rd hover:bg-gd hover:text-gn'
                      }`}
                    >
                      {t.vitoOdendi ? 'Ödendi ✓' : 'Bekliyor'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function VitoPage() {
  const { user }   = useAuth();
  const drivers    = useVitoDrivers();
  const satisList  = useSatisList();
  const [activeTab, setActiveTab] = useState<'satis'|'surucular'|'komisyon'>('satis');

  const tabs = [
    { key: 'satis'     as const, label: 'Bilet Sat' },
    { key: 'surucular' as const, label: 'Sürücüler' },
    { key: 'komisyon'  as const, label: 'Komisyon'  },
  ];

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-[26px] font-semibold tracking-tight">Vito Yönetimi</h1>
        <p className="text-mu text-[13px] mt-1">Vito satışları ve komisyon takibi</p>
      </div>

      {/* Alt sekmeler */}
      <div className="flex gap-1.5 mb-8 p-1.5 bg-sf2/60 border border-bd rounded-2xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-btn text-white shadow-[0_2px_12px_rgba(30,64,175,0.3)]'
                : 'text-mu hover:text-tx hover:bg-sf2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'satis'     && <VitoBiletSat drivers={drivers} satisList={satisList} user={user} />}
      {activeTab === 'surucular' && <VitoSurucular drivers={drivers} />}
      {activeTab === 'komisyon'  && <VitoKomisyon  drivers={drivers} satisList={satisList} />}
    </div>
  );
}
