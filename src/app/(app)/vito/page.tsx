'use client';

import { useState, useMemo } from 'react';
import { ref, update, remove } from 'firebase/database';
import { addVitoDriver } from '@/lib/db/vito';
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

function VitoBiletSat({ drivers, satisList, user }: {
  drivers: VitoDriver[];
  satisList: Satis[];
  user: ReturnType<typeof useAuth>['user'];
}) {
  const codes   = useCodes();
  const batches = useBatches();

  const [selectedTarih, setSelectedTarih]   = useState(todayStr());
  const [selectedSeans, setSelectedSeans]   = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [ad, setAd]       = useState('');
  const [soyad, setSoyad] = useState('');
  const [tel, setTel]     = useState('');
  const [mail, setMail]   = useState('');
  const [qty, setQty]     = useState<TicketQty>({ ...EMPTY_QTY });
  const [indirimInput, setIndirimInput]   = useState('');
  const [aktifKod, setAktifKod]           = useState<IndirimKodu | null>(null);
  const [indirimOrani, setIndirimOrani]   = useState(0);
  const [indirimMsg, setIndirimMsg]       = useState('');
  const [confirmOpen, setConfirmOpen]     = useState(false);
  const [biletModal, setBiletModal]       = useState(false);
  const [biletler, setBiletler]           = useState<Array<{ no: string; tur: string; qrUrl: string }>>([]);
  const [lastPNR, setLastPNR]             = useState('');
  const [lastAdSoyad, setLastAdSoyad]     = useState('');

  const saatler    = getSaatler(selectedTarih);
  const isEtkinlik = isEtkinlikGunu(selectedTarih);
  const seansCounts = useMemo(() =>
    satisList.filter(s => s.tarih === selectedTarih).reduce((acc, s) => {
      const n = (s.tam||0)+(s.cocuk||0)+(s.yabanci||0)+(s.davetli||0)+(s.kurumsal||0);
      acc[s.seans] = (acc[s.seans] || 0) + n; return acc;
    }, {} as Record<string, number>)
  , [satisList, selectedTarih]);

  const driver     = drivers.find(d => d._key === selectedDriver);
  const toplam     = qty.tam + qty.cocuk + qty.yabanci + qty.davetli + qty.kurumsal;
  const p          = hesaplaFiyat(qty.tam, qty.cocuk, qty.yabanci);
  const gelirBase  = p.gelir;
  const indirimTutar = indirimOrani > 0 ? Math.round(gelirBase * indirimOrani) : 0;
  const sonToplam  = gelirBase - indirimTutar;
  const vitoKom    = driver ? 500 : 0;

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
    const adSoyad = `${ad.trim()} ${soyad.trim()}`.trim();
    const pnr     = 'PNR-' + genPNR();
    const now     = new Date();
    const saat    = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const satisId = genID();

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
    <div>
      {/* Sürücü + Tarih */}
      <div className="page-section">
        <div className="musteri-grid">
          <div>
            <label className="form-label">Vito Sürücüsü</label>
            <select id="vito-surucu-sel2" className="form-input" value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
              <option value="">— Sürücü seçin —</option>
              {activeDrivers.map(d => <option key={d._key} value={d._key}>{d.ad} · {d.plaka}</option>)}
            </select>
          </div>
          {driver && (
            <div id="vito-surucu-bilgi" style={{ background:'#1e1a00', border:'1px solid #3a2e00', borderRadius:8, padding:'8px 12px', fontSize:12, display:'flex', alignItems:'center', gap:16 }}>
              <span style={{ fontWeight:600 }}>{driver.ad}</span>
              <span style={{ fontFamily:'var(--mo)', color:'var(--ac)' }}>{driver.plaka}</span>
              <span style={{ color:'var(--mu)' }}>500 ₺ sabit hakediş</span>
            </div>
          )}
        </div>
      </div>

      {/* Tarih Seç */}
      <div style={{ background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:10, padding:'.75rem 1rem', marginBottom:'1rem' }}>
        <div style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'.5rem' }}>
          Tarih Seç — <span style={{ color:'var(--ac)', textTransform:'none' }}>{fmtDate(selectedTarih)}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button
            id="vito-bugun-btn"
            className={`tarih-picker-buton${selectedTarih !== todayStr() ? ' pasif' : ''}`}
            onClick={() => { setSelectedTarih(todayStr()); setSelectedSeans(null); }}
          >Bugün</button>
          <div className="tarih-picker-date">
            <input type="date" value={dateToInput(selectedTarih)} onChange={e => { setSelectedTarih(inputToDate(e.target.value)); setSelectedSeans(null); }} />
          </div>
        </div>
      </div>

      {/* Seans */}
      {isEtkinlik && saatler && (
        <div style={{ background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:10, padding:'.75rem 1rem', marginBottom:'1rem' }}>
          <div style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'.5rem' }}>
            Seans Seç — <span id="vito-secilenTarihLabel" style={{ color:'var(--ac)', textTransform:'none' }}>{selectedTarih}</span>
          </div>
          <div className="seans-grid">
            {saatler.map(saat => (
              <div
                key={saat}
                className={`seans-card${selectedSeans === saat ? ' selected' : ''}`}
                onClick={() => setSelectedSeans(saat)}
              >
                <div className="seans-time">{saat}</div>
                <div className="seans-count">{seansCounts[saat] ?? 0} kişi</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bilet Formu */}
      {selectedSeans && (
        <div className="page-section" id="vito-biletSection">
          <div className="section-title">Müşteri Bilgileri — Seans <span style={{ color:'var(--ac)', textTransform:'none', fontWeight:400 }}>{selectedSeans}</span></div>
          <div className="musteri-grid">
            <div><label className="form-label">Ad</label><input className="form-input" type="text" value={ad} onChange={e => setAd(e.target.value)} placeholder="Ad" /></div>
            <div><label className="form-label">Soyad</label><input className="form-input" type="text" value={soyad} onChange={e => setSoyad(e.target.value)} placeholder="Soyad" /></div>
            <div><label className="form-label">Telefon</label><input className="form-input" type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="+90 555 000 00 00" /></div>
            <div><label className="form-label">E-posta</label><input className="form-input" type="email" value={mail} onChange={e => setMail(e.target.value)} placeholder="musteri@mail.com" /></div>
          </div>

          <div className="section-title" style={{ marginTop:'1rem' }}>
            Bilet Türü — Seans <span id="vito-secilenSeansLabel" style={{ color:'var(--ac)', textTransform:'none' }}>{selectedSeans}</span>
          </div>

          {TICKET_TYPES.map(tp => (
            <div key={tp.key} className="bilet-row">
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontWeight:600, fontSize:14 }}>{tp.label}</span>
                <span style={{ fontSize:12, color:'var(--mu)', fontFamily:'var(--mo)' }}>
                  {tp.price > 0 ? `${tp.price.toLocaleString('tr-TR')} ₺` : 'Ücretsiz'}
                </span>
              </div>
              <div className="bilet-qty">
                <button className="qty-btn" onClick={() => setQty(q => ({ ...q, [tp.key]: Math.max(0, q[tp.key] - 1) }))}>−</button>
                <span className="qty-num">{qty[tp.key]}</span>
                <button className="qty-btn" onClick={() => setQty(q => ({ ...q, [tp.key]: q[tp.key] + 1 }))}>+</button>
              </div>
            </div>
          ))}

          {toplam > 0 && driver && (
            <div id="vito-kom-preview2" style={{ background:'#1a1500', border:'1px solid #3a2e00', borderRadius:8, padding:'10px 14px', marginTop:10, fontSize:12 }}>
              <span style={{ color:'var(--mu)' }}>Vito Komisyon: </span>
              <span style={{ color:'var(--ac)', fontWeight:600 }}>{driver.ad} · {fmtMoney(vitoKom)}</span>
            </div>
          )}

          {toplam > 0 && (
            <div className="ozet-box" id="vito-ozetBox">
              <div className="ozet-row"><span>Kişi</span><span style={{ fontFamily:'var(--mo)' }}>{toplam}</span></div>
              <div className="ozet-row"><span>Toplam</span><span style={{ fontFamily:'var(--mo)', color:'var(--ac)', fontWeight:700, fontSize:16 }}>{fmtMoney(sonToplam)}</span></div>
            </div>
          )}

          <div className="mbtns" style={{ marginTop:'1rem' }}>
            <button className="btn btn-ac" style={{ flex:1 }} disabled={toplam === 0 || !ad.trim()} onClick={() => setConfirmOpen(true)}>Satışı Tamamla</button>
            <button className="btn" onClick={() => { setSelectedSeans(null); setQty({ ...EMPTY_QTY }); setAd(''); setSoyad(''); setTel(''); setMail(''); }}>Temizle</button>
          </div>
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Satışı Onayla">
        <div style={{ background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div className="ozet-row"><span style={{ color:'var(--mu)' }}>Müşteri</span><span style={{ fontWeight:500 }}>{ad} {soyad}</span></div>
          <div className="ozet-row"><span style={{ color:'var(--mu)' }}>Tarih / Seans</span><span>{selectedTarih} / {selectedSeans}</span></div>
          {driver && <div className="ozet-row"><span style={{ color:'var(--mu)' }}>Sürücü</span><span>{driver.ad}</span></div>}
          <div className="ozet-row" style={{ borderTop:'1px solid var(--bd)', paddingTop:8, marginTop:4 }}><span>Toplam</span><span style={{ color:'var(--ac)', fontWeight:700 }}>{fmtMoney(sonToplam)}</span></div>
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setConfirmOpen(false)}>İptal</Button>
          <Button variant="accent" onClick={handleTamamla}>✓ Onayla</Button>
        </ModalActions>
      </Modal>

      <Modal open={biletModal} onClose={() => setBiletModal(false)} title="🎟️ Biletler Hazır">
        <p style={{ fontSize:13, color:'var(--mu)', marginBottom:16 }}>PNR: <span style={{ fontFamily:'var(--mo)', color:'var(--ac)' }}>{lastPNR}</span> · {lastAdSoyad}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {biletler.map(b => (
            <div key={b.no} style={{ background:'white', color:'black', borderRadius:16, padding:20, border:'1px solid #eee', textAlign:'center' }}>
              <div style={{ fontSize:10, letterSpacing:3, color:'#999', marginBottom:4 }}>✦ STARDUST ✦</div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Astra Lumina İstanbul</div>
              <div style={{ fontSize:12, color:'#666', marginBottom:12 }}>{selectedTarih} — Seans {selectedSeans}</div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.qrUrl} alt="QR" width={120} height={120} style={{ borderRadius:10 }} />
              </div>
              <div style={{ fontWeight:600, fontSize:14 }}>{lastAdSoyad}</div>
              <div style={{ fontSize:9, color:'#aaa', fontFamily:'monospace', marginTop:4 }}>{b.no}</div>
            </div>
          ))}
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setBiletModal(false)}>Kapat</Button>
          <Button variant="accent" onClick={() => window.print()}>🖨️ Yazdır</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

function VitoSurucular({ drivers }: { drivers: VitoDriver[] }) {
  const [ad, setAd]       = useState('');
  const [plaka, setPlaka] = useState('');
  const [tel, setTel]     = useState('');
  const [saving, setSaving] = useState(false);

  const handleEkle = async () => {
    if (!ad.trim() || !plaka.trim()) { toast('Ad ve plaka zorunlu', 'err'); return; }
    setSaving(true);
    try {
      await addVitoDriver({ ad: ad.trim(), plaka: plaka.trim().toUpperCase(), tel: tel.trim(), aktif: true });
      setAd(''); setPlaka(''); setTel('');
      toast('Sürücü eklendi', 'ok');
    } catch {
      toast('Sürücü eklenemedi', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-section">
        <div className="section-title">Yeni Sürücü Ekle</div>
        <div className="musteri-grid" style={{ marginBottom:12 }}>
          <div><label className="form-label">Ad Soyad</label><input className="form-input" value={ad}    onChange={e => setAd(e.target.value)}    placeholder="Ahmet Yılmaz" /></div>
          <div><label className="form-label">Plaka</label><input className="form-input" value={plaka} onChange={e => setPlaka(e.target.value)} placeholder="34 ABC 123" /></div>
          <div><label className="form-label">Telefon</label><input className="form-input" type="tel" value={tel} onChange={e => setTel(e.target.value)} /></div>
        </div>
        <Button variant="accent" size="sm" onClick={handleEkle} disabled={saving}>{saving ? 'Ekleniyor...' : '+ Sürücü Ekle'}</Button>
      </div>

      <div className="panel">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <div className="panel-title" style={{ margin:0 }}>Sürücü Listesi</div>
          <span style={{ fontSize:12, color:'var(--mu)' }}>{drivers.length} sürücü</span>
        </div>
        {drivers.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2.5rem 1rem', gap:8 }}>
            <div style={{ fontSize:28 }}>🚐</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--tx)' }}>Henüz sürücü eklenmedi</div>
            <div style={{ fontSize:12, color:'var(--mu)', textAlign:'center' }}>Yukarıdaki formu kullanarak ilk sürücüyü ekleyin.</div>
          </div>
        ) : drivers.map(d => (
          <div key={d._key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{d.ad}</div>
              <div style={{ fontSize:12, color:'var(--mu)', fontFamily:'var(--mo)', marginTop:2 }}>{d.plaka} · 500 ₺ sabit hakediş</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
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
    </div>
  );
}

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
    <div>
      <div className="toolbar" style={{ marginBottom:'1rem' }}>
        <label className="form-label" style={{ margin:0, alignSelf:'center' }}>Sürücü:</label>
        <select className="sw" value={filtreSurucu} onChange={e => setFiltreSurucu(e.target.value)}>
          <option value="">Tüm Sürücüler</option>
          {drivers.filter(d => d.aktif).map(d => <option key={d._key} value={d._key}>{d.ad}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', marginBottom:'.75rem', background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ flex:1, padding:14, textAlign:'center', borderRight:'1px solid var(--bd)' }}>
          <div style={{ fontSize:10, color:'var(--mu)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Toplam Tur</div>
          <div style={{ fontSize:26, fontWeight:700, fontFamily:'var(--mo)' }}>{toplamTur}</div>
        </div>
        <div style={{ flex:1, padding:14, textAlign:'center', borderRight:'1px solid var(--bd)' }}>
          <div style={{ fontSize:10, color:'var(--mu)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Toplam Kişi</div>
          <div style={{ fontSize:26, fontWeight:700, fontFamily:'var(--mo)' }}>{toplamKisi}</div>
        </div>
        <div style={{ flex:1, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:10, color:'var(--mu)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Toplam Hakediş</div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--ac)', fontFamily:'var(--mo)' }}>{fmtMoney(toplamHakedis)}</div>
        </div>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr><th>Sürücü</th><th>Müşteri</th><th>Tarih</th><th>Seans</th><th>Kişi</th><th>Hakediş</th><th>Ödeme</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'var(--mu)' }}>Vito satışı bulunamadı</td></tr>
            ) : filtered.map(t => {
              const drv = drivers.find(d => d._key === t.vitoSurucu);
              return (
                <tr key={t.id}>
                  <td style={{ fontWeight:600 }}>{drv?.ad ?? '—'}</td>
                  <td>{t.musteriAd}</td>
                  <td className="dc">{t.tarih}</td>
                  <td style={{ fontFamily:'var(--mo)' }}>{t.seans}</td>
                  <td style={{ fontFamily:'var(--mo)' }}>{(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)}</td>
                  <td style={{ color:'var(--bl)', fontFamily:'var(--mo)', fontWeight:700 }}>{fmtMoney(t.vitoKomisyon||0)}</td>
                  <td>
                    <button
                      onClick={() => handleToggleOdeme(t.id, !!t.vitoOdendi)}
                      className={`badge ${t.vitoOdendi ? 'ba' : 'bdd'}`}
                      style={{ cursor:'pointer', border:'none' }}
                    >
                      {t.vitoOdendi ? 'Ödendi' : 'Bekliyor'}
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

export default function VitoPage() {
  const { user }  = useAuth();
  const drivers   = useVitoDrivers();
  const satisList = useSatisList();
  const [activeTab, setActiveTab] = useState<'satis'|'surucular'|'komisyon'>('satis');

  const tabs = [
    { key: 'satis'     as const, label: 'Bilet Sat'  },
    { key: 'surucular' as const, label: 'Sürücüler'  },
    { key: 'komisyon'  as const, label: 'Komisyon'   },
  ];

  return (
    <div>
      {/* Alt Sekmeler */}
      <div style={{ display:'flex', gap:6, marginBottom:'1.5rem', padding:4, background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:10, width:'fit-content' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding:'6px 18px', borderRadius:8, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', transition:'all .15s',
              background: activeTab === t.key ? 'var(--ac)' : 'transparent',
              color: activeTab === t.key ? '#000' : 'var(--mu)',
            }}
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
