'use client';

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { ref, set, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useVitoDrivers, useCodes, useBatches } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  todayStr, dateToInput, inputToDate, getSaatler,
  isEtkinlikGunu, fmtMoney, genID, genPNR, getDayName, fmtDate,
} from '@/lib/utils';
import { hesaplaFiyat } from '@/lib/pricing';
import { TICKET_PRICES, type TicketQty, type Satis, type PNRKayit, type Bilet, type IndirimKodu } from '@/types';

// ─── Sabitler ────────────────────────────────────────────────────────────────

const EMPTY_QTY: TicketQty = { tam: 0, cocuk: 0, yabanci: 0, davetli: 0, kurumsal: 0 };
const TICKET_TYPES = [
  { key: 'tam'      as const, label: 'Tam',           sub: '18 yaş üstü',    price: 1500, color: 'text-bl'  },
  { key: 'cocuk'    as const, label: 'Çocuk',         sub: '4–18 yaş',       price: 1200, color: 'text-gn'  },
  { key: 'yabanci'  as const, label: 'Yabancı',       sub: 'Tüm yaşlar',     price: 2250, color: 'text-or'  },
  { key: 'davetli'  as const, label: 'Davetli',       sub: 'Ücretsiz giriş', price: 0,    color: 'text-vi'  },
  { key: 'kurumsal' as const, label: 'Kurumsal Satış',sub: 'Ücretsiz · Toplu',price: 0,  color: 'text-pk'  },
];

// ─── QR kod üretici ───────────────────────────────────────────────────────────

async function buildQRUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 160, margin: 1, color: { dark: '#000', light: '#fff' } });
}

// ─── Özet hesaplama ───────────────────────────────────────────────────────────

function OzetBox({ qty, indirimKodu, indirimOrani }: {
  qty: TicketQty;
  indirimKodu: IndirimKodu | null;
  indirimOrani: number;
}) {
  const { tam, cocuk, yabanci, davetli, kurumsal } = qty;
  const total = tam + cocuk + yabanci + davetli + kurumsal;
  if (total === 0) return null;

  const p = hesaplaFiyat(tam, cocuk, yabanci);
  const gelir = p.gelir;
  const indirimTutar = indirimOrani > 0 ? Math.round(gelir * indirimOrani) : 0;

  return (
    <div className="bg-sf/60 border border-bd rounded-2xl p-5 mt-6">
      {p.aile2t1c > 0 && (
        <Row label={`🎁 Aile (2T+1Ç) × ${p.aile2t1c}`} value={fmtMoney(p.aile2t1c * 3900)} highlight />
      )}
      {p.aile1t2c > 0 && (
        <Row label={`🎁 Aile (1T+2Ç) × ${p.aile1t2c}`} value={fmtMoney(p.aile1t2c * 3900)} highlight />
      )}
      {p.kalanTam > 0    && <Row label={`Tam × ${p.kalanTam}`}       value={fmtMoney(p.kalanTam * 1500)} />}
      {p.kalanCocuk > 0  && <Row label={`Çocuk × ${p.kalanCocuk}`}   value={fmtMoney(p.kalanCocuk * 1200)} />}
      {yabanci > 0       && <Row label={`Yabancı × ${yabanci}`}      value={fmtMoney(yabanci * 2250)} />}
      {davetli > 0       && <Row label={`Davetli × ${davetli}`}      value="0₺" green />}
      {kurumsal > 0      && <Row label={`Kurumsal × ${kurumsal}`}    value="0₺" />}
      {indirimOrani > 0 && indirimKodu && (
        <Row
          label={`%${Math.round(indirimOrani * 100)} İndirim (${indirimKodu.code})`}
          value={`-${fmtMoney(indirimTutar)}`}
          green
        />
      )}
      <div className="flex justify-between pt-3 mt-3 border-t border-bd text-[15px] font-semibold text-ac">
        <span>TOPLAM ({total} kişi)</span>
        <span>{fmtMoney(gelir - indirimTutar)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, green }: {
  label: string; value: string; highlight?: boolean; green?: boolean;
}) {
  return (
    <div className={`flex justify-between text-sm py-1.5 border-b border-bd/50 ${highlight ? 'text-ac' : green ? 'text-gn' : 'text-tx'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

// ─── Seans satış sayaçları ────────────────────────────────────────────────────

function buildSeansCounts(satisList: Satis[], tarih: string): Record<string, number> {
  return satisList
    .filter(s => s.tarih === tarih)
    .reduce((acc, s) => {
      const k = s.seans;
      const n = (s.tam || 0) + (s.cocuk || 0) + (s.yabanci || 0) + (s.davetli || 0) + (s.kurumsal || 0);
      acc[k] = (acc[k] || 0) + n;
      return acc;
    }, {} as Record<string, number>);
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { user } = useAuth();
  const satisList = useSatisList();
  const vitoDrivers = useVitoDrivers();
  const codes = useCodes();
  const batches = useBatches();

  const [selectedTarih, setSelectedTarih] = useState<string>(todayStr());
  const [selectedSeans, setSelectedSeans] = useState<string | null>(null);

  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [tel, setTel] = useState('');
  const [mail, setMail] = useState('');

  const [vitoSurucuKey, setVitoSurucuKey] = useState('');

  const [qty, setQty] = useState<TicketQty>({ ...EMPTY_QTY });

  const [indirimInput, setIndirimInput] = useState('');
  const [aktifIndirimKodu, setAktifIndirimKodu] = useState<IndirimKodu | null>(null);
  const [indirimOrani, setIndirimOrani] = useState(0);
  const [indirimMsg, setIndirimMsg] = useState('');
  const [indirimChecking, setIndirimChecking] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [biletModalOpen, setBiletModalOpen] = useState(false);
  const [biletlerData, setBiletlerData] = useState<Array<{ no: string; tur: string; qrUrl: string }>>([]);
  const [lastPNR, setLastPNR] = useState('');
  const [lastAdSoyad, setLastAdSoyad] = useState('');

  const saatler = getSaatler(selectedTarih);
  const isEtkinlik = isEtkinlikGunu(selectedTarih);
  const seansCounts = buildSeansCounts(satisList, selectedTarih);

  const toplam = qty.tam + qty.cocuk + qty.yabanci + qty.davetli + qty.kurumsal;

  const vitoSurucu = vitoDrivers.find(d => d._key === vitoSurucuKey) ?? null;
  const vitoKomisyon = vitoSurucu
    ? Math.round(hesaplaFiyat(qty.tam, qty.cocuk, qty.yabanci).gelir * (vitoSurucu.komisyonOran / 100))
    : 0;

  const handleTarihChange = (val: string) => {
    setSelectedTarih(val);
    setSelectedSeans(null);
  };

  const handleIndirimUygula = useCallback(() => {
    const kod = indirimInput.trim().toUpperCase();
    if (!kod) { toast('Kod giriniz', 'err'); return; }
    setIndirimChecking(true);
    setIndirimMsg('Kontrol ediliyor...');
    const found = codes.find(c => c.code === kod);
    if (!found) { setIndirimMsg('❌ Geçersiz kod.'); setIndirimChecking(false); return; }
    if (found.status === 'deaktif') { setIndirimMsg('❌ Bu kod daha önce kullanılmış.'); setIndirimChecking(false); return; }
    const batch = batches.find(b => b.codes?.includes(kod));
    const oran = batch?.indirim ?? found.indirim ?? 10;
    setAktifIndirimKodu(found);
    setIndirimOrani(oran / 100);
    setIndirimMsg(`✅ %${oran} indirim uygulandı!`);
    setIndirimChecking(false);
  }, [indirimInput, codes, batches]);

  const handleIndirimIptal = () => {
    setAktifIndirimKodu(null);
    setIndirimOrani(0);
    setIndirimInput('');
    setIndirimMsg('');
  };

  const handleTamamla = useCallback(async () => {
    if (!selectedSeans || !user) return;
    setConfirmOpen(false);

    const adSoyad = `${ad.trim()} ${soyad.trim()}`.trim();
    const pnr = 'PNR-' + genPNR();
    const now = new Date();
    const saat = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const satisId = genID();

    const p = hesaplaFiyat(qty.tam, qty.cocuk, qty.yabanci);
    const gelir = p.gelir;
    const indirimTutar = indirimOrani > 0 ? Math.round(gelir * indirimOrani) : 0;
    const sonToplam = gelir - indirimTutar;

    const biletTipleri = [
      { key: 'tam' as const, label: 'Tam' }, { key: 'cocuk' as const, label: 'Çocuk' },
      { key: 'yabanci' as const, label: 'Yabancı' }, { key: 'davetli' as const, label: 'Davetli' },
      { key: 'kurumsal' as const, label: 'Kurumsal Satış' },
    ];

    const biletNolar: string[] = [];
    const biletlerFirebase: Record<string, Bilet> = {};
    const biletlerPreview: Array<{ no: string; tur: string; qrUrl: string }> = [];

    for (const tp of biletTipleri) {
      const n = qty[tp.key] || 0;
      for (let i = 0; i < n; i++) {
        const bNo = `SD-${selectedSeans}-${genID()}`;
        biletNolar.push(bNo);
        biletlerFirebase[bNo] = { no: bNo, pnr, seans: selectedSeans, tur: tp.key, tarih: selectedTarih, kullanildi: false };
        const qrUrl = await buildQRUrl(bNo);
        biletlerPreview.push({ no: bNo, tur: tp.label, qrUrl });
      }
    }

    const satis: Satis = {
      id: satisId, pnr, tarih: selectedTarih, seans: selectedSeans,
      satisZamani: saat, kasiyerId: user.uid, kasiyerAd: user.name,
      musteriAd: adSoyad, musteriTel: tel.trim(), musteriMail: mail.trim(),
      tam: qty.tam, cocuk: qty.cocuk, yabanci: qty.yabanci,
      davetli: qty.davetli, kurumsal: qty.kurumsal,
      toplam: sonToplam,
      biletler: biletNolar.map(no => ({ no, pnr, tur: 'tam', kullanildi: false })),
      indirimKodu: aktifIndirimKodu?.code,
      indirimOran: indirimOrani > 0 ? Math.round(indirimOrani * 100) : undefined,
      ...(vitoSurucu ? {
        vitoSurucu: vitoSurucu._key,
        vitoPlaka: vitoSurucu.plaka,
        vitoKomisyon,
        vitoOdendi: false,
      } : {}),
    };

    const pnrKayit: PNRKayit = {
      satisId, pnr, musteriAd: adSoyad, musteriTel: tel.trim(), musteriMail: mail.trim(),
      tarih: selectedTarih, seans: selectedSeans,
      tam: qty.tam, cocuk: qty.cocuk, yabanci: qty.yabanci,
      davetli: qty.davetli, kurumsal: qty.kurumsal,
      toplam: sonToplam, biletler: [], kullanildi: false,
    };

    const updates: Record<string, unknown> = {};
    updates[`tickets/${satisId}`] = satis;
    updates[`pnrler/${pnr}`] = pnrKayit;
    for (const [key, val] of Object.entries(biletlerFirebase)) {
      updates[`biletler/${key}`] = val;
    }
    if (aktifIndirimKodu) {
      updates[`codes/${aktifIndirimKodu._key}`] = {
        ...aktifIndirimKodu, status: 'deaktif', date: todayStr(), kullanan: adSoyad,
      };
    }
    await update(ref(db), updates);

    setLastPNR(pnr);
    setLastAdSoyad(adSoyad);
    setBiletlerData(biletlerPreview);
    setBiletModalOpen(true);
    resetForm();
    toast(`Satış tamamlandı! ${biletNolar.length} bilet oluşturuldu.`, 'ok');
  }, [selectedSeans, selectedTarih, ad, soyad, tel, mail, qty, indirimOrani, aktifIndirimKodu, vitoSurucu, vitoKomisyon, user]);

  function resetForm() {
    setSelectedSeans(null);
    setQty({ ...EMPTY_QTY });
    setAd(''); setSoyad(''); setTel(''); setMail('');
    setVitoSurucuKey('');
    setAktifIndirimKodu(null); setIndirimOrani(0); setIndirimInput(''); setIndirimMsg('');
  }

  const activeDrivers = vitoDrivers.filter(d => d.aktif);

  return (
    <div className="space-y-6">

      {/* ─── Sayfa Başlığı ─── */}
      <div className="mb-10">
        <h1 className="text-[26px] font-semibold tracking-tight">Bilet Sat</h1>
        <p className="text-mu text-[13px] mt-1">Yeni bilet oluştur</p>
      </div>

      {/* ─── Tarih Seçici ─── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-bd">
          <h2 className="text-[15px] font-semibold text-tx">Tarih</h2>
        </div>
        <div className="p-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTarihChange(todayStr())}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                selectedTarih === todayStr()
                  ? 'bg-btn text-white border-btn'
                  : 'bg-sf2 text-tx border-bd hover:border-ac hover:text-ac'
              }`}
            >
              Bugün
            </button>
            <input
              type="date"
              value={dateToInput(selectedTarih)}
              onChange={e => handleTarihChange(inputToDate(e.target.value))}
              className="bg-sf2 border border-bd rounded-xl px-4 py-2 text-tx font-mono text-sm outline-none focus:border-ac cursor-pointer"
            />
            {selectedTarih !== todayStr() && (
              <span className="text-sm text-ac font-medium">{fmtDate(selectedTarih)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Seans Seçimi ─── */}
      {!isEtkinlik ? (
        <div className="glass-card rounded-2xl p-7 text-mu text-sm text-center">
          Bu tarihte etkinlik yok — yalnızca Cuma, Cumartesi ve Pazar seansları mevcuttur.
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-bd">
            <h2 className="text-[15px] font-semibold text-tx">
              Seans Seç — <span className="text-ac font-normal">{fmtDate(selectedTarih)}</span>
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-5 gap-3">
              {(saatler ?? []).map((saat, idx) => (
                <button
                  key={saat}
                  onClick={() => setSelectedSeans(saat)}
                  className={`border-2 rounded-2xl py-4 px-2 text-center cursor-pointer transition-all hover-lift ${
                    selectedSeans === saat
                      ? 'border-bl bg-bl/10'
                      : 'border-bd bg-sf2/60 hover:border-bd2'
                  }`}
                >
                  <div className="text-[30px] font-semibold font-mono text-ac leading-none">
                    {idx + 1}
                  </div>
                  <div className="text-[11px] text-mu mt-2">{saat}</div>
                  <div className="text-sm text-tx mt-2 font-mono font-semibold">
                    {seansCounts[saat] ?? 0}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Müşteri + Biletler ─── */}
      {selectedSeans && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-bd">
            <h2 className="text-[15px] font-semibold text-tx">
              Seans {selectedSeans} — {fmtDate(selectedTarih)}
            </h2>
          </div>
          <div className="p-7">

            {/* Müşteri bilgileri */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Input label="Ad"      value={ad}    onChange={e => setAd(e.target.value)}    placeholder="Ad" />
              <Input label="Soyad"   value={soyad} onChange={e => setSoyad(e.target.value)} placeholder="Soyad" />
              <Input label="Telefon" value={tel}   onChange={e => setTel(e.target.value)}   placeholder="+90 555 000 00 00" type="tel" />
              <Input label="E-posta" value={mail}  onChange={e => setMail(e.target.value)}  placeholder="musteri@mail.com" type="email" />
            </div>

            {/* Vito sürücüsü */}
            {activeDrivers.length > 0 && (
              <div className="mb-8">
                <label className="text-[11px] font-semibold text-mu uppercase tracking-widest block mb-3">
                  Vito Sürücüsü <span className="text-mu2 normal-case font-normal text-[10px]">(opsiyonel)</span>
                </label>
                <select
                  value={vitoSurucuKey}
                  onChange={e => setVitoSurucuKey(e.target.value)}
                  className="w-full bg-sf2 border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac"
                >
                  <option value="">— Sürücü yok —</option>
                  {activeDrivers.map(d => (
                    <option key={d._key} value={d._key}>{d.ad} · {d.plaka}</option>
                  ))}
                </select>
                {vitoSurucu && (
                  <div className="mt-3 bg-bl/8 border border-bl/20 rounded-xl px-5 py-4">
                    <div className="text-[10px] text-bl uppercase tracking-widest mb-3 font-semibold">Komisyon Önizleme</div>
                    <div className="flex justify-between text-mu mb-2 text-sm"><span>Sürücü</span><span className="text-tx font-medium">{vitoSurucu.ad}</span></div>
                    <div className="flex justify-between text-mu mb-2 text-sm"><span>Plaka</span><span className="text-ac font-mono">{vitoSurucu.plaka}</span></div>
                    <div className="flex justify-between text-mu mb-2 text-sm"><span>Oran</span><span>%{vitoSurucu.komisyonOran}</span></div>
                    <div className="flex justify-between text-gn font-semibold border-t border-bl/15 pt-3 mt-2 text-sm">
                      <span>Komisyon</span><span>{fmtMoney(vitoKomisyon)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-bd mb-8" />

            {/* Bilet türleri */}
            <div className="space-y-1 mb-6">
              {TICKET_TYPES.map(tp => (
                <div
                  key={tp.key}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-4 rounded-xl hover:bg-sf2/50 transition-colors"
                >
                  <div>
                    <div className="text-[14px] font-medium">{tp.label}</div>
                    <div className="text-[11px] text-mu mt-0.5">{tp.sub}</div>
                  </div>
                  <div className={`text-sm font-mono font-semibold ${tp.color} whitespace-nowrap`}>
                    {tp.price > 0 ? `${tp.price.toLocaleString('tr-TR')} ₺` : '0 ₺'}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQty(q => ({ ...q, [tp.key]: Math.max(0, q[tp.key] - 1) }))}
                      className="w-9 h-9 rounded-xl border border-bd bg-sf text-tx text-lg cursor-pointer hover:border-ac hover:text-ac flex items-center justify-center transition-all"
                    >−</button>
                    <span className="w-8 text-center font-semibold font-mono text-[16px]">{qty[tp.key]}</span>
                    <button
                      onClick={() => setQty(q => ({ ...q, [tp.key]: q[tp.key] + 1 }))}
                      className="w-9 h-9 rounded-xl border border-bd bg-sf text-tx text-lg cursor-pointer hover:border-ac hover:text-ac flex items-center justify-center transition-all"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* İndirim kodu */}
            {toplam > 0 && (
              <div className="bg-sf2/60 border border-bd rounded-2xl p-5">
                <div className="text-[11px] font-semibold text-mu uppercase tracking-widest mb-4">İndirim Kodu</div>
                <div className="flex gap-3">
                  <input
                    value={indirimInput}
                    onChange={e => setIndirimInput(e.target.value.toUpperCase())}
                    disabled={!!aktifIndirimKodu}
                    placeholder="Kodu girin..."
                    className="flex-1 bg-bg border border-bd rounded-xl px-4 py-2.5 text-tx font-mono text-sm outline-none focus:border-ac disabled:opacity-50"
                  />
                  {!aktifIndirimKodu ? (
                    <Button variant="accent" size="sm" onClick={handleIndirimUygula} disabled={indirimChecking}>
                      Uygula
                    </Button>
                  ) : (
                    <Button variant="danger" size="sm" onClick={handleIndirimIptal}>İptal</Button>
                  )}
                </div>
                {indirimMsg && (
                  <p className={`text-xs mt-3 ${aktifIndirimKodu ? 'text-gn' : 'text-rd'}`}>{indirimMsg}</p>
                )}
              </div>
            )}

            {/* Özet */}
            <OzetBox qty={qty} indirimKodu={aktifIndirimKodu} indirimOrani={indirimOrani} />

            {/* Butonlar */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-bd">
              <Button variant="ghost" onClick={resetForm}>İptal</Button>
              <Button variant="accent" disabled={toplam === 0 || !ad.trim()} onClick={() => setConfirmOpen(true)}>
                Satışı Tamamla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Satış Onay Modal ─── */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Satışı Onayla">
        <div className="text-[11px] text-mu uppercase tracking-wide mb-1">Müşteri</div>
        <div className="font-semibold text-base mb-4">{ad} {soyad}</div>
        <div className="bg-sf2 border border-bd rounded-xl p-4 text-sm space-y-2 mb-4">
          <div className="flex justify-between"><span className="text-mu">Tarih</span><span>{selectedTarih}</span></div>
          <div className="flex justify-between"><span className="text-mu">Seans</span><span>{selectedSeans}</span></div>
          {qty.tam > 0       && <div className="flex justify-between"><span className="text-mu">Tam</span><span>{qty.tam} adet</span></div>}
          {qty.cocuk > 0     && <div className="flex justify-between"><span className="text-mu">Çocuk</span><span>{qty.cocuk} adet</span></div>}
          {qty.yabanci > 0   && <div className="flex justify-between"><span className="text-mu">Yabancı</span><span>{qty.yabanci} adet</span></div>}
          {qty.davetli > 0   && <div className="flex justify-between"><span className="text-mu">Davetli</span><span>{qty.davetli} adet</span></div>}
          {qty.kurumsal > 0  && <div className="flex justify-between"><span className="text-mu">Kurumsal</span><span>{qty.kurumsal} adet</span></div>}
          {aktifIndirimKodu  && <div className="flex justify-between text-gn"><span>İndirim Kodu</span><span>{aktifIndirimKodu.code} (%{Math.round(indirimOrani * 100)})</span></div>}
        </div>
        <OzetBox qty={qty} indirimKodu={aktifIndirimKodu} indirimOrani={indirimOrani} />
        <ModalActions>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>İptal</Button>
          <Button variant="accent" onClick={handleTamamla}>✓ Onayla ve Bilet Oluştur</Button>
        </ModalActions>
      </Modal>

      {/* ─── Bilet Görüntüleme Modal ─── */}
      <Modal
        open={biletModalOpen}
        onClose={() => setBiletModalOpen(false)}
        title="🎟️ Biletler Hazır"
        width="max-w-xl"
      >
        <p className="text-sm text-mu mb-1">PNR: <span className="font-mono text-ac">{lastPNR}</span></p>
        <p className="text-sm text-mu mb-5">Müşteri: <span className="text-tx">{lastAdSoyad}</span></p>
        <div id="biletlerWrap" className="space-y-3 print-area">
          {biletlerData.map((b) => (
            <div key={b.no} className="bg-white text-black rounded-2xl p-5 border border-gray-200">
              <div className="text-center text-[10px] tracking-[3px] text-gray-400 mb-1">✦ STARDUST ✦</div>
              <div className="text-center text-lg font-bold mb-1">Astra Lumina İstanbul</div>
              <div className="text-center text-xs text-gray-500 mb-3">
                {getDayName(selectedTarih, false)}, {selectedTarih} — Seans {selectedSeans}
              </div>
              <div className="text-center font-semibold mb-3">{lastAdSoyad}</div>
              <div className="flex justify-center mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.qrUrl} alt="QR" width={140} height={140} className="rounded-xl" />
              </div>
              <div className="text-center">
                <span className={`inline-block px-5 py-1.5 rounded-full text-sm font-semibold
                  ${b.tur === 'Tam' ? 'bg-green-50 text-green-800' :
                    b.tur === 'Çocuk' ? 'bg-blue-50 text-blue-800' :
                    b.tur === 'Yabancı' ? 'bg-orange-50 text-orange-800' :
                    b.tur === 'Kurumsal Satış' ? 'bg-purple-50 text-purple-800' :
                    'bg-green-50 text-green-800'}`}
                >
                  {b.tur}
                </span>
              </div>
              <div className="text-center text-[9px] text-gray-400 mt-2 font-mono">{b.no}</div>
            </div>
          ))}
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setBiletModalOpen(false)}>Kapat</Button>
          <Button variant="accent" onClick={() => window.print()}>🖨️ Yazdır</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
