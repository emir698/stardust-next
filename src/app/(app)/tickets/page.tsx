'use client';

import { useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { update } from 'firebase/database';
import { ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useVitoDrivers, useCodes, useBatches } from '@/hooks/useFirebaseData';
import { Input } from '@/components/ui/Input';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import {
  todayStr, dateToInput, inputToDate, getSaatler,
  isEtkinlikGunu, fmtMoney, genID, genPNR, getDayName,
} from '@/lib/utils';
import { hesaplaFiyat } from '@/lib/pricing';
import { type TicketQty, type Satis, type PNRKayit, type Bilet, type IndirimKodu } from '@/types';

const EMPTY_QTY: TicketQty = { tam: 0, cocuk: 0, yabanci: 0, davetli: 0, kurumsal: 0 };
const TICKET_TYPES = [
  { key: 'tam'      as const, label: 'Tam',            sub: '18 yaş üstü',     price: 1500, priceColor: '' },
  { key: 'cocuk'    as const, label: 'Çocuk',          sub: '4–18 yaş',        price: 1200, priceColor: '' },
  { key: 'yabanci'  as const, label: 'Yabancı',        sub: 'Tüm yaşlar',      price: 2250, priceColor: '' },
  { key: 'davetli'  as const, label: 'Davetli',        sub: 'Ücretsiz giriş',  price: 0,    priceColor: 'color:var(--gn)' },
  { key: 'kurumsal' as const, label: 'Kurumsal Satış', sub: 'Ücretsiz · Toplu',price: 0,    priceColor: 'color:#a855f7' },
];

async function buildQRUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 160, margin: 1, color: { dark: '#000', light: '#fff' } });
}

function buildSeansCounts(satisList: Satis[], tarih: string): Record<string, number> {
  return satisList
    .filter(s => s.tarih === tarih)
    .reduce((acc, s) => {
      const k = s.seans;
      const n = (s.tam||0)+(s.cocuk||0)+(s.yabanci||0)+(s.davetli||0)+(s.kurumsal||0);
      acc[k] = (acc[k] || 0) + n;
      return acc;
    }, {} as Record<string, number>);
}

export default function TicketsPage() {
  const { user } = useAuth();
  const satisList   = useSatisList();
  const vitoDrivers = useVitoDrivers();
  const codes       = useCodes();
  const batches     = useBatches();

  const [selectedTarih, setSelectedTarih] = useState(todayStr());
  const [selectedSeans, setSelectedSeans] = useState<string | null>(null);
  const [ad, setAd]       = useState('');
  const [soyad, setSoyad] = useState('');
  const [tel, setTel]     = useState('');
  const [mail, setMail]   = useState('');
  const [vitoSurucuKey, setVitoSurucuKey] = useState('');
  const [qty, setQty] = useState<TicketQty>({ ...EMPTY_QTY });
  const [indirimInput, setIndirimInput]     = useState('');
  const [aktifIndirimKodu, setAktifIndirimKodu] = useState<IndirimKodu | null>(null);
  const [indirimOrani, setIndirimOrani]     = useState(0);
  const [indirimMsg, setIndirimMsg]         = useState('');
  const [indirimChecking, setIndirimChecking] = useState(false);
  const [confirmOpen, setConfirmOpen]       = useState(false);
  const [biletModalOpen, setBiletModalOpen] = useState(false);
  const [biletlerData, setBiletlerData]     = useState<Array<{ no: string; tur: string; qrUrl: string }>>([]);
  const [lastPNR, setLastPNR]               = useState('');
  const [lastAdSoyad, setLastAdSoyad]       = useState('');

  const saatler    = getSaatler(selectedTarih);
  const isEtkinlik = isEtkinlikGunu(selectedTarih);
  const seansCounts = buildSeansCounts(satisList, selectedTarih);
  const toplam = qty.tam + qty.cocuk + qty.yabanci + qty.davetli + qty.kurumsal;
  const vitoSurucu = vitoDrivers.find(d => d._key === vitoSurucuKey) ?? null;
  const vitoKomisyon = vitoSurucu
    ? Math.round(hesaplaFiyat(qty.tam, qty.cocuk, qty.yabanci).gelir * (vitoSurucu.komisyonOran / 100))
    : 0;
  const activeDrivers = vitoDrivers.filter(d => d.aktif);

  const p = hesaplaFiyat(qty.tam, qty.cocuk, qty.yabanci);
  const indirimTutar = indirimOrani > 0 ? Math.round(p.gelir * indirimOrani) : 0;

  const handleTarihChange = (val: string) => { setSelectedTarih(val); setSelectedSeans(null); };

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
    setAktifIndirimKodu(null); setIndirimOrani(0); setIndirimInput(''); setIndirimMsg('');
  };

  const handleTamamla = useCallback(async () => {
    if (!selectedSeans || !user) return;
    setConfirmOpen(false);
    const adSoyad = `${ad.trim()} ${soyad.trim()}`.trim();
    const pnr     = 'PNR-' + genPNR();
    const now     = new Date();
    const saat    = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const satisId = genID();
    const sonToplam = p.gelir - indirimTutar;
    const biletTipleri = [
      { key: 'tam'      as const, label: 'Tam' },
      { key: 'cocuk'    as const, label: 'Çocuk' },
      { key: 'yabanci'  as const, label: 'Yabancı' },
      { key: 'davetli'  as const, label: 'Davetli' },
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
      tam: qty.tam, cocuk: qty.cocuk, yabanci: qty.yabanci, davetli: qty.davetli, kurumsal: qty.kurumsal,
      toplam: sonToplam,
      biletler: biletNolar.map(no => ({ no, pnr, tur: 'tam', kullanildi: false })),
      indirimKodu: aktifIndirimKodu?.code,
      indirimOran: indirimOrani > 0 ? Math.round(indirimOrani * 100) : undefined,
      ...(vitoSurucu ? { vitoSurucu: vitoSurucu._key, vitoPlaka: vitoSurucu.plaka, vitoKomisyon, vitoOdendi: false } : {}),
    };
    const pnrKayit: PNRKayit = {
      satisId, pnr, musteriAd: adSoyad, musteriTel: tel.trim(), musteriMail: mail.trim(),
      tarih: selectedTarih, seans: selectedSeans,
      tam: qty.tam, cocuk: qty.cocuk, yabanci: qty.yabanci, davetli: qty.davetli, kurumsal: qty.kurumsal,
      toplam: sonToplam, biletler: [], kullanildi: false,
    };
    const updates: Record<string, unknown> = {};
    updates[`tickets/${satisId}`] = satis;
    updates[`pnrler/${pnr}`] = pnrKayit;
    for (const [key, val] of Object.entries(biletlerFirebase)) updates[`biletler/${key}`] = val;
    if (aktifIndirimKodu) {
      updates[`codes/${aktifIndirimKodu._key}`] = { ...aktifIndirimKodu, status: 'deaktif', date: todayStr(), kullanan: adSoyad };
    }
    await update(ref(db), updates);
    setLastPNR(pnr); setLastAdSoyad(adSoyad); setBiletlerData(biletlerPreview); setBiletModalOpen(true);
    resetForm();
    toast(`Satış tamamlandı! ${biletNolar.length} bilet oluşturuldu.`, 'ok');
  }, [selectedSeans, selectedTarih, ad, soyad, tel, mail, qty, indirimOrani, indirimTutar, aktifIndirimKodu, vitoSurucu, vitoKomisyon, p, user]);

  function resetForm() {
    setSelectedSeans(null); setQty({ ...EMPTY_QTY });
    setAd(''); setSoyad(''); setTel(''); setMail(''); setVitoSurucuKey('');
    setAktifIndirimKodu(null); setIndirimOrani(0); setIndirimInput(''); setIndirimMsg('');
  }

  return (
    <div>
      {/* Tarih Seçici */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'.6rem 1rem', background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:10, marginBottom:'1rem' }}>
        <span style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap' }}>Tarih</span>
        <button
          className={`tarih-picker-buton${selectedTarih !== todayStr() ? ' pasif' : ''}`}
          onClick={() => handleTarihChange(todayStr())}
        >Bugün</button>
        <div className="tarih-picker-date">
          <input type="date" value={dateToInput(selectedTarih)} onChange={e => handleTarihChange(inputToDate(e.target.value))} />
        </div>
        {selectedTarih !== todayStr() && (
          <span style={{ fontSize:13, color:'var(--ac)' }}>{selectedTarih}</span>
        )}
      </div>

      {/* Seans Seçimi */}
      {!isEtkinlik ? (
        <div className="page-section" style={{ color:'var(--mu)', fontSize:13, textAlign:'center', padding:'1.5rem' }}>
          Bu tarihte etkinlik yok — yalnızca Cuma, Cumartesi ve Pazar seansları mevcuttur.
        </div>
      ) : (
        <div style={{ background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:10, padding:'.75rem 1rem', marginBottom:'1rem' }}>
          <div style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'.5rem' }}>
            Seans Seç — <span style={{ color:'var(--ac)', textTransform:'none' }}>{selectedTarih}</span>
          </div>
          <div className="seans-grid">
            {(saatler ?? []).map((saat, idx) => (
              <div
                key={saat}
                className={`seans-card${selectedSeans === saat ? ' selected' : ''}`}
                onClick={() => setSelectedSeans(saat)}
              >
                <div className="seans-no">{idx + 1}</div>
                <div className="seans-label">{saat}</div>
                <div className="seans-sold">{seansCounts[saat] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Müşteri + Biletler */}
      {selectedSeans && (
        <div className="page-section">
          <div className="section-title">
            Müşteri Bilgileri — Seans <span style={{ color:'var(--ac)', textTransform:'none', fontWeight:400 }}>{selectedSeans}</span>
          </div>
          <div className="musteri-grid">
            <div><Input label="Ad"      value={ad}    onChange={e => setAd(e.target.value)}    placeholder="Ad" /></div>
            <div><Input label="Soyad"   value={soyad} onChange={e => setSoyad(e.target.value)} placeholder="Soyad" /></div>
            <div><Input label="Telefon" value={tel}   onChange={e => setTel(e.target.value)}   placeholder="+90 555 000 00 00" type="tel" /></div>
            <div><Input label="E-posta" value={mail}  onChange={e => setMail(e.target.value)}  placeholder="musteri@mail.com" type="email" /></div>
            {activeDrivers.length > 0 && (
              <div>
                <label className="form-label" style={{ color:'var(--ac)' }}>
                  Vito Sürücüsü <span style={{ color:'var(--mu)', fontSize:10 }}>(opsiyonel)</span>
                </label>
                <select
                  className="form-input"
                  value={vitoSurucuKey}
                  onChange={e => setVitoSurucuKey(e.target.value)}
                >
                  <option value="">— Sürücü yok —</option>
                  {activeDrivers.map(d => (
                    <option key={d._key} value={d._key}>{d.ad} · {d.plaka}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {vitoSurucu && (
            <div style={{ display:'none', background:'#1a1500', border:'1px solid #3a2e00', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12 }} id="vp">
              <div style={{ color:'var(--ac)', fontSize:10, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>Komisyon Önizleme</div>
              <div style={{ display:'flex', justifyContent:'space-between', color:'#aaa', marginBottom:3 }}><span>Sürücü</span><span style={{ color:'var(--tx)' }}>{vitoSurucu.ad}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', color:'#aaa', marginBottom:3 }}><span>Plaka</span><span style={{ fontFamily:'var(--mo)', color:'var(--ac)' }}>{vitoSurucu.plaka}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', color:'var(--gn)', fontWeight:600, borderTop:'1px solid #3a2e00', marginTop:6, paddingTop:6 }}><span>Komisyon</span><span>{fmtMoney(vitoKomisyon)}</span></div>
            </div>
          )}

          <div className="section-title" style={{ marginTop:'1rem' }}>
            Bilet Türü — Seans <span style={{ color:'var(--ac)', textTransform:'none', fontWeight:400 }}>{selectedSeans}</span>
          </div>

          {TICKET_TYPES.map(tp => (
            <div className="bilet-row" key={tp.key}>
              <div>
                <div className="bilet-type-name">{tp.label}</div>
                <div className="bilet-type-sub">{tp.sub}</div>
              </div>
              <div className="bilet-price" style={tp.priceColor ? { color: tp.priceColor.replace('color:','') } : {}}>
                {tp.price > 0 ? `${tp.price.toLocaleString('tr-TR')} ₺` : '0 ₺'}
              </div>
              <div className="bilet-qty">
                <button className="qty-btn" onClick={() => setQty(q => ({ ...q, [tp.key]: Math.max(0, q[tp.key] - 1) }))}>−</button>
                <span className="qty-num">{qty[tp.key]}</span>
                <button className="qty-btn" onClick={() => setQty(q => ({ ...q, [tp.key]: q[tp.key] + 1 }))}>+</button>
              </div>
            </div>
          ))}

          {/* Özet */}
          {toplam > 0 && (
            <div className="ozet-box">
              {p.aile2t1c > 0 && <div className="ozet-row" style={{ color:'var(--ac)' }}><span>🎁 Aile (2T+1Ç) × {p.aile2t1c}</span><span>{fmtMoney(p.aile2t1c * 3900)}</span></div>}
              {p.aile1t2c > 0 && <div className="ozet-row" style={{ color:'var(--ac)' }}><span>🎁 Aile (1T+2Ç) × {p.aile1t2c}</span><span>{fmtMoney(p.aile1t2c * 3900)}</span></div>}
              {p.kalanTam   > 0 && <div className="ozet-row"><span>Tam × {p.kalanTam}</span><span>{fmtMoney(p.kalanTam * 1500)}</span></div>}
              {p.kalanCocuk > 0 && <div className="ozet-row"><span>Çocuk × {p.kalanCocuk}</span><span>{fmtMoney(p.kalanCocuk * 1200)}</span></div>}
              {qty.yabanci  > 0 && <div className="ozet-row"><span>Yabancı × {qty.yabanci}</span><span>{fmtMoney(qty.yabanci * 2250)}</span></div>}
              {qty.davetli  > 0 && <div className="ozet-row" style={{ color:'var(--gn)' }}><span>Davetli × {qty.davetli}</span><span>0₺</span></div>}
              {qty.kurumsal > 0 && <div className="ozet-row"><span>Kurumsal × {qty.kurumsal}</span><span>0₺</span></div>}
              {indirimOrani > 0 && aktifIndirimKodu && (
                <div className="ozet-row" style={{ color:'var(--gn)' }}>
                  <span>%{Math.round(indirimOrani * 100)} İndirim ({aktifIndirimKodu.code})</span>
                  <span>-{fmtMoney(indirimTutar)}</span>
                </div>
              )}
              <div className="ozet-row">
                <span>TOPLAM ({toplam} kişi)</span>
                <span>{fmtMoney(p.gelir - indirimTutar)}</span>
              </div>
            </div>
          )}

          {/* İndirim Kodu */}
          {toplam > 0 && (
            <div style={{ display:'none', marginTop:'1rem', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, padding:'1rem' }} id="indirimAlani">
              <div style={{ fontSize:12, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>İndirim Kodu</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Kodu girin..."
                  style={{ fontFamily:'var(--mo)', fontSize:13, letterSpacing:1, flex:1 }}
                  value={indirimInput}
                  onChange={e => setIndirimInput(e.target.value.toUpperCase())}
                  disabled={!!aktifIndirimKodu}
                />
                {!aktifIndirimKodu ? (
                  <Button variant="accent" size="sm" onClick={handleIndirimUygula} disabled={indirimChecking}>Uygula</Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={handleIndirimIptal}>İptal</Button>
                )}
              </div>
              {indirimMsg && <div style={{ marginTop:8, fontSize:13, color: aktifIndirimKodu ? 'var(--gn)' : 'var(--rd)' }}>{indirimMsg}</div>}
            </div>
          )}

          {/* İndirim Kodu (her zaman görünür) */}
          {toplam > 0 && (
            <div style={{ marginTop:'1rem', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, padding:'1rem' }}>
              <div style={{ fontSize:12, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>İndirim Kodu</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Kodu girin..."
                  style={{ fontFamily:'var(--mo)', fontSize:13, letterSpacing:1, flex:1 }}
                  value={indirimInput}
                  onChange={e => setIndirimInput(e.target.value.toUpperCase())}
                  disabled={!!aktifIndirimKodu}
                />
                {!aktifIndirimKodu ? (
                  <Button variant="accent" size="sm" onClick={handleIndirimUygula} disabled={indirimChecking}>Uygula</Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={handleIndirimIptal}>İptal</Button>
                )}
              </div>
              {indirimMsg && <div style={{ marginTop:8, fontSize:13, color: aktifIndirimKodu ? 'var(--gn)' : 'var(--rd)' }}>{indirimMsg}</div>}
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:'1.25rem' }}>
            <Button variant="default" onClick={resetForm}>İptal</Button>
            <Button variant="accent" disabled={toplam === 0 || !ad.trim()} onClick={() => setConfirmOpen(true)}>Satışı Tamamla</Button>
          </div>
        </div>
      )}

      {/* Satış Onay Modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Satışı Onayla">
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{ad} {soyad}</div>
          <div style={{ fontSize:13, color:'var(--mu)', marginBottom:8 }}>{selectedTarih} · Seans {selectedSeans}</div>
          {qty.tam > 0      && <div style={{ fontSize:13 }}>Tam: {qty.tam}</div>}
          {qty.cocuk > 0    && <div style={{ fontSize:13 }}>Çocuk: {qty.cocuk}</div>}
          {qty.yabanci > 0  && <div style={{ fontSize:13 }}>Yabancı: {qty.yabanci}</div>}
          {qty.davetli > 0  && <div style={{ fontSize:13 }}>Davetli: {qty.davetli}</div>}
          {qty.kurumsal > 0 && <div style={{ fontSize:13 }}>Kurumsal: {qty.kurumsal}</div>}
          {aktifIndirimKodu && <div style={{ fontSize:13, color:'var(--gn)', marginTop:4 }}>İndirim: {aktifIndirimKodu.code} (%{Math.round(indirimOrani * 100)})</div>}
          <div style={{ fontSize:15, fontWeight:600, color:'var(--ac)', marginTop:8 }}>TOPLAM: {fmtMoney(p.gelir - indirimTutar)}</div>
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setConfirmOpen(false)}>İptal</Button>
          <Button variant="accent" onClick={handleTamamla}>✓ Onayla ve Bilet Oluştur</Button>
        </ModalActions>
      </Modal>

      {/* Bilet Modal */}
      <Modal open={biletModalOpen} onClose={() => setBiletModalOpen(false)} title="🎟️ Biletler Hazır" width="max-w-xl">
        <p>Yazdır butonuna basarak biletleri alın.</p>
        <div id="biletlerWrap" className="print-area" style={{ marginTop:'1rem' }}>
          {biletlerData.map((b) => (
            <div key={b.no} style={{ background:'#fff', color:'#000', borderRadius:10, padding:'1.25rem', marginBottom:10, fontFamily:'var(--sa)', border:'1px solid #eee' }}>
              <div style={{ fontSize:10, letterSpacing:3, color:'#888', textAlign:'center', marginBottom:4 }}>✦ STARDUST ✦</div>
              <div style={{ fontSize:18, fontWeight:700, textAlign:'center', marginBottom:2 }}>Astra Lumina İstanbul</div>
              <div style={{ fontSize:12, color:'#555', textAlign:'center', marginBottom:8 }}>{getDayName(selectedTarih, false)}, {selectedTarih} — Seans {lastPNR}</div>
              <div style={{ fontSize:13, fontWeight:600, textAlign:'center', marginBottom:12, color:'#333' }}>{lastAdSoyad}</div>
              <div style={{ display:'flex', justifyContent:'center', margin:'10px 0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.qrUrl} alt="QR" width={140} height={140} />
              </div>
              <div style={{ textAlign:'center' }}>
                <span style={{ display:'inline-block', padding:'4px 16px', borderRadius:20, fontSize:12, fontWeight:600, margin:'6px 0',
                  background: b.tur==='Tam' ? '#e8f5e9' : b.tur==='Çocuk' ? '#e3f2fd' : b.tur==='Yabancı' ? '#fff3e0' : b.tur==='Kurumsal Satış' ? 'rgba(168,85,247,.1)' : '#e8f5e9',
                  color: b.tur==='Tam' ? '#2e7d32' : b.tur==='Çocuk' ? '#1565c0' : b.tur==='Yabancı' ? '#e65100' : b.tur==='Kurumsal Satış' ? '#a855f7' : '#2e7d32',
                }}>{b.tur}</span>
              </div>
              <div style={{ fontSize:9, color:'#aaa', textAlign:'center', marginTop:6, fontFamily:'monospace' }}>{b.no}</div>
            </div>
          ))}
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setBiletModalOpen(false)}>Kapat</Button>
          <Button variant="accent" onClick={() => window.print()}>🖨️ Yazdır</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
