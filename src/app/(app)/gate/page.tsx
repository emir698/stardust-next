'use client';

import { useState, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useBiletler } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { todayStr, dateToInput, inputToDate, getDayName } from '@/lib/utils';
import type { Satis } from '@/types';
import { sendBiletMail } from '@/lib/email';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ─── PDF helpers ──────────────────────────────────────────────────────────────

async function buildTicketPage(doc: jsPDF, pageIdx: number, biletNo: string, satis: Satis) {
  if (pageIdx > 0) doc.addPage();
  const qrDataUrl = await QRCode.toDataURL(biletNo, { width: 200, margin: 1, color: { dark: '#000', light: '#fff' } });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, doc.internal.pageSize.getHeight(), 'F');
  doc.setFontSize(8); doc.setTextColor(160, 160, 160);
  doc.text('✦ STARDUST ✦', w / 2, 18, { align: 'center' });
  doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
  doc.text('Astra Lumina Istanbul', w / 2, 28, { align: 'center' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
  doc.text(`${satis.tarih} — Seans ${satis.seans}`, w / 2, 36, { align: 'center' });
  doc.setFontSize(11); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
  doc.text(satis.musteriAd ?? '', w / 2, 44, { align: 'center' });
  const qrSize = 60;
  // jsPDF addImage — data URL'den PNG
const qrBase64 = qrDataUrl.split(',')[1];
doc.addImage(qrBase64, 'PNG', (w - qrSize) / 2, 52, qrSize, qrSize);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
  doc.text(biletNo, w / 2, 120, { align: 'center' });
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`PNR: ${satis.pnr}`, w / 2, 128, { align: 'center' });
}

function getBiletNolar(satis: Satis): string[] {
  return (satis.biletler as Array<{ no: string } | string> || []).map(b =>
    typeof b === 'string' ? b : b.no
  );
}

function safeName(satis: Satis): string {
  return (satis.musteriAd ?? 'musteri').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_À-ɏ]/g, '');
}

async function downloadPNRPdf(satis: Satis) {
  const biletNolar = getBiletNolar(satis);
  const doc = new jsPDF({ unit: 'mm', format: [90, 140] });
  for (let i = 0; i < biletNolar.length; i++) {
    await buildTicketPage(doc, i, biletNolar[i], satis);
  }
  doc.save(`${satis.pnr}_${safeName(satis)}.pdf`);
}

async function downloadPNRZip(satis: Satis) {
  const zip = new JSZip();
  const biletNolar = getBiletNolar(satis);
  for (const no of biletNolar) {
    const doc = new jsPDF({ unit: 'mm', format: [90, 140] });
    await buildTicketPage(doc, 0, no, satis);
    zip.file(`${no}.pdf`, doc.output('arraybuffer'));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${satis.pnr}_${safeName(satis)}.zip`);
}

async function downloadAllZip(satisList: Satis[], tarih: string) {
  const gunSatislari = satisList.filter(t => t.tarih === tarih);
  if (!gunSatislari.length) { toast('Bu gün için satış yok', 'warn'); return; }
  const zip = new JSZip();
  for (const satis of gunSatislari) {
    const biletNolar = getBiletNolar(satis);
    for (const no of biletNolar) {
      const doc = new jsPDF({ unit: 'mm', format: [90, 140] });
      await buildTicketPage(doc, 0, no, satis);
      zip.file(`${satis.pnr}/${no}.pdf`, doc.output('arraybuffer'));
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `biletler_${tarih}.zip`);
}

const TUR_LABEL: Record<string, string> = {
  tam: 'Tam', cocuk: 'Çocuk', yabanci: 'Yabancı', davetli: 'Davetli', kurumsal: 'Kurumsal',
};
const TUR_BG: Record<string, string> = {
  tam: '#e8f5e9', cocuk: '#e3f2fd', yabanci: '#fff3e0', davetli: '#e8f5e9', kurumsal: 'rgba(168,85,247,.1)',
};
const TUR_COLOR: Record<string, string> = {
  tam: '#2e7d32', cocuk: '#1565c0', yabanci: '#e65100', davetli: '#2e7d32', kurumsal: '#a855f7',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GatePage() {
  const { user } = useAuth();
  const satisList = useSatisList();
  const biletler = useBiletler();

  const [selectedTarih, setSelectedTarih] = useState(todayStr());
  const [aramaInput, setAramaInput] = useState('');
  const [detayModal, setDetayModal] = useState(false);
  const [detayTarget, setDetayTarget] = useState<Satis | null>(null);
  const [detayQRler, setDetayQRler] = useState<Array<{ no: string; qrUrl: string; tur: string }>>([]);
  const [detayQRLoading, setDetayQRLoading] = useState(false);
  const [isimSecimModal, setIsimSecimModal] = useState(false);
  const [isimSecimList, setIsimSecimList] = useState<Satis[]>([]);
  const [zipLoading, setZipLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [zipRowLoading, setZipRowLoading] = useState<string | null>(null);
  const [mailAddress, setMailAddress] = useState('');
  const [mailSending, setMailSending] = useState(false);

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
    return s + (t.biletler as Array<{ no: string }|string>).filter(b => {
      const no = typeof b === 'string' ? b : b.no;
      return biletler[no]?.kullanildi;
    }).length;
  }, 0);

  function isSatisKullanildi(t: Satis) {
    if (!t.biletler?.length) return false;
    return (t.biletler as Array<{ no: string }|string>).every(b => {
      const no = typeof b === 'string' ? b : b.no;
      return biletler[no]?.kullanildi;
    });
  }

  function getSatisKullanilan(t: Satis) {
    if (!t.biletler?.length) return 0;
    return (t.biletler as Array<{ no: string }|string>).filter(b => {
      const no = typeof b === 'string' ? b : b.no;
      return biletler[no]?.kullanildi;
    }).length;
  }

  function handleSorgula() {
    const val = aramaInput.trim();
    if (!val) return;
    const isPNR = /^[A-Z0-9-]{6,}$/i.test(val.replace(/\s/g,'')) && !val.includes(' ');
    if (isPNR) {
      const found = satisList.find(t => t.pnr?.toUpperCase() === val.toUpperCase());
      if (!found) { toast('PNR bulunamadı', 'err'); return; }
      openDetayModal(found);
    } else {
      const bulunanlar = satisList.filter(t => t.musteriAd?.toLowerCase().includes(val.toLowerCase()));
      if (!bulunanlar.length) { toast('Kayıt bulunamadı', 'err'); return; }
      if (bulunanlar.length === 1) { openDetayModal(bulunanlar[0]); return; }
      setIsimSecimList(bulunanlar); setIsimSecimModal(true);
    }
  }

  async function openDetayModal(satis: Satis) {
    setDetayTarget(satis);
    setDetayQRler([]);
    setMailAddress(satis.musteriMail ?? '');
    setDetayModal(true);
    setIsimSecimModal(false);
    setDetayQRLoading(true);
    try {
      const biletNolar = getBiletNolar(satis);
      const qrler = await Promise.all(
        biletNolar.map(async (no) => {
          const qrUrl = await QRCode.toDataURL(no, { width: 160, margin: 1, color: { dark: '#000', light: '#fff' } });
          const bilet = biletler[no];
          return { no, qrUrl, tur: bilet?.tur ?? 'tam' };
        })
      );
      setDetayQRler(qrler);
    } catch {
      toast('QR oluşturulamadı', 'err');
    } finally {
      setDetayQRLoading(false);
    }
  }

  async function handleGirisVer(t: Satis) {
    const bekleyenler = getBiletNolar(t).filter(no => !biletler[no]?.kullanildi);
    if (!bekleyenler.length) { toast('Tüm biletler zaten kullanılmış', 'warn'); return; }
    const now = new Date();
    const saat = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const updates: Record<string, unknown> = {};
    bekleyenler.forEach(no => {
      updates[`biletler/${no}/kullanildi`] = true;
      updates[`biletler/${no}/kullanildiSaat`] = saat;
    });
    updates[`pnrler/${t.pnr}/kullanildi`] = true;
    updates[`pnrler/${t.pnr}/kullanildiSaat`] = saat;
    await update(ref(db), updates);
    toast(`${bekleyenler.length} bilete giriş verildi!`, 'ok');
    if (detayModal) setDetayModal(false);
  }

  async function handleBiletiGetir(t: Satis) {
    setPdfLoading(t.id);
    try { await downloadPNRPdf(t); }
    catch { toast('PDF oluşturulamadı', 'err'); }
    finally { setPdfLoading(null); }
  }

  async function handleZipIndir(t: Satis) {
    setZipRowLoading(t.id);
    try { await downloadPNRZip(t); }
    catch { toast('ZIP oluşturulamadı', 'err'); }
    finally { setZipRowLoading(null); }
  }

  async function handleSil(pnr: string) {
    if (!confirm(`${pnr} numaralı satışı silmek istiyor musunuz?`)) return;
    const satis = satisList.find(t => t.pnr === pnr);
    if (!satis) return;
    const updates: Record<string, null> = {};
    updates[`tickets/${satis.id}`] = null;
    updates[`pnrler/${pnr}`] = null;
    getBiletNolar(satis).forEach(no => { updates[`biletler/${no}`] = null; });
    await update(ref(db), updates as Record<string, unknown>);
    toast('Satış silindi', 'ok');
    setDetayModal(false);
  }

  async function handleMailGonder() {
if (!detayTarget || !mailAddress.trim()) { toast('Mail adresi girin', 'err'); return; }
setMailSending(true);
try {
const toplamBlt = (detayTarget.tam||0)+(detayTarget.cocuk||0)+(detayTarget.yabanci||0)+(detayTarget.davetli||0)+(detayTarget.kurumsal||0);
const biletlerIcinMail = detayQRler.map(q => ({ no: q.no, tur: q.tur, qrDataUrl: q.qrUrl }));
await sendBiletMail(mailAddress.trim(), detayTarget.pnr ?? '', detayTarget.musteriAd ?? '', detayTarget.tarih, detayTarget.seans ?? '', toplamBlt, detayTarget.toplam ?? 0, biletlerIcinMail);
toast('Mail gönderildi!', 'ok');
} catch { toast('Mail gönderilemedi', 'err'); }
finally { setMailSending(false); }
}

  async function handleTumunuZip() {
    setZipLoading(true);
    try { await downloadAllZip(satisList, selectedTarih); }
    catch { toast('ZIP oluşturulamadı', 'err'); }
    finally { setZipLoading(false); }
  }

  return (
    <div>
      {/* Tarih + Sorgula */}
      <div className="page-section">
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
            <div className="section-title" style={{ margin:0 }}>Gün Seç</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button className={`tarih-picker-buton${selectedTarih !== todayStr() ? ' pasif' : ''}`} onClick={() => setSelectedTarih(todayStr())}>Bugün</button>
              <div className="tarih-picker-date">
                <input type="date" value={dateToInput(selectedTarih)} onChange={e => setSelectedTarih(inputToDate(e.target.value))} />
              </div>
            </div>
          </div>
          <div style={{ width:1, height:40, background:'var(--bd)', margin:'0 4px' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
            <div className="section-title" style={{ margin:0 }}>Sorgula</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="text" className="form-input" placeholder="PNR veya ad soyad..." style={{ fontSize:13, width:220 }} value={aramaInput} onChange={e => setAramaInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSorgula()} />
              <Button variant="accent" size="sm" onClick={handleSorgula}>Sorgula</Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:'1.5rem' }}>
        <div className="kpi"><div className="kpi-label">Seçili Gün Toplam Bilet</div><div className="kpi-val ac">{toplamBilet}</div></div>
        <div className="kpi"><div className="kpi-label">Giriş Yapıldı</div><div className="kpi-val gn">{girisYapan}</div></div>
      </div>

      {/* Tablo başlığı + Tümünü ZIP */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div className="section-title" style={{ margin:0 }}>Seçili Günün Biletleri</div>
        <Button size="sm" onClick={handleTumunuZip} disabled={zipLoading || gunSatislari.length === 0}>
          {zipLoading ? 'Hazırlanıyor...' : '⬇ Tümünü ZIP İndir'}
        </Button>
      </div>

      {/* Tablo */}
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>PNR</th>
              <th>Ad Soyad</th>
              <th>Telefon</th>
              <th>Seans</th>
              <th>Tam</th>
              <th>Çocuk</th>
              <th>Yabancı</th>
              <th>Davetli</th>
              <th>Kurumsal</th>
              <th>Satış Saati</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredSatislar.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign:'center', padding:'2rem', color:'var(--mu)' }}>Bu gün için satış yok</td></tr>
            ) : filteredSatislar.map(t => {
              const kullanildi = isSatisKullanildi(t);
              const kullanilan = getSatisKullanilan(t);
              const total = (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0);
              return (
                <tr key={t.id}>
                  <td className="cc">{t.pnr ?? '—'}</td>
                  <td>{t.musteriAd ?? '—'}</td>
                  <td className="dc">{t.musteriTel || '—'}</td>
                  <td className="dc">{t.seans ?? '—'}</td>
                  <td>{t.tam ?? 0}</td>
                  <td>{t.cocuk ?? 0}</td>
                  <td>{t.yabanci ?? 0}</td>
                  <td>{t.davetli ?? 0}</td>
                  <td style={{ color:'var(--vi)', fontWeight:600 }}>{t.kurumsal ?? 0}</td>
                  <td className="dc">{t.satisZamani ?? '—'}</td>
                  <td>
                    {kullanildi
                      ? <span className="badge bdd">Kullanıldı</span>
                      : <span className="badge ba">{kullanilan}/{total} Giriş</span>
                    }
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <Button size="sm" onClick={() => openDetayModal(t)}>Detay</Button>
                      <Button size="sm" disabled={pdfLoading === t.id} onClick={() => handleBiletiGetir(t)}>
                        {pdfLoading === t.id ? '...' : 'Bileti Getir'}
                      </Button>
                      <Button size="sm" disabled={zipRowLoading === t.id} onClick={() => handleZipIndir(t)}>
                        {zipRowLoading === t.id ? '...' : '↓ ZIP'}
                      </Button>
                      {user?.role === 'admin' && (
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

      {/* Detay Modal — Bilet satış ekranı gibi QR + mail */}
      <Modal open={detayModal} onClose={() => setDetayModal(false)} title="🎟️ Biletler Hazır" width="max-w-xl">
        {detayTarget && (
          <div>
            {/* PNR + müşteri özet */}
            <div style={{ fontSize:13, color:'var(--mu)', marginBottom:12 }}>
              <span style={{ fontFamily:'var(--mo)', color:'var(--ac)', fontWeight:600 }}>{detayTarget.pnr}</span>
              {' · '}{detayTarget.musteriAd}
              {' · '}{getDayName(detayTarget.tarih, false)}, {detayTarget.tarih} — Seans {detayTarget.seans}
            </div>

            {/* Biletler — satış ekranıyla aynı tasarım */}
            {detayQRLoading ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--mu)' }}>QR kodlar hazırlanıyor...</div>
            ) : (
              <div style={{ marginBottom:16 }}>
                {detayQRler.map(q => {
                  const kullanildi = biletler[q.no]?.kullanildi;
                  return (
                    <div key={q.no} style={{ background:'#fff', color:'#000', borderRadius:10, padding:'1.25rem', marginBottom:10, border: kullanildi ? '2px solid #ef4444' : '1px solid #eee', opacity: kullanildi ? 0.7 : 1 }}>
                      <div style={{ fontSize:10, letterSpacing:3, color:'#888', textAlign:'center', marginBottom:4 }}>✦ STARDUST ✦</div>
                      <div style={{ fontSize:18, fontWeight:700, textAlign:'center', marginBottom:2 }}>Astra Lumina İstanbul</div>
                      <div style={{ fontSize:12, color:'#555', textAlign:'center', marginBottom:8 }}>
                        {getDayName(detayTarget.tarih, false)}, {detayTarget.tarih} — Seans {detayTarget.seans}
                      </div>
                      <div style={{ fontSize:13, fontWeight:600, textAlign:'center', marginBottom:12, color:'#333' }}>{detayTarget.musteriAd}</div>
                      <div style={{ display:'flex', justifyContent:'center', margin:'10px 0' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.qrUrl} alt="QR" width={140} height={140} />
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <span style={{ display:'inline-block', padding:'4px 16px', borderRadius:20, fontSize:12, fontWeight:600, margin:'6px 0', background: TUR_BG[q.tur], color: TUR_COLOR[q.tur] }}>
                          {TUR_LABEL[q.tur] ?? q.tur}
                        </span>
                      </div>
                      <div style={{ fontSize:9, color:'#aaa', textAlign:'center', marginTop:6, fontFamily:'monospace' }}>{q.no}</div>
                      {kullanildi && (
                        <div style={{ textAlign:'center', color:'#ef4444', fontSize:11, marginTop:4, fontWeight:600 }}>✓ Bu bilet kullanılmış</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mail Gönder */}
            <div style={{ background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>📧 Mail Gönder</div>
              <div style={{ display:'flex', gap:8 }}>
                <input type="email" className="form-input" placeholder="musteri@mail.com" value={mailAddress} onChange={e => setMailAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleMailGonder()} style={{ flex:1 }} />
                <Button variant="accent" size="sm" onClick={handleMailGonder} disabled={mailSending || !mailAddress.trim()}>
                  {mailSending ? 'Gönderiliyor...' : 'Gönder'}
                </Button>
              </div>
            </div>
          </div>
        )}
        <ModalActions>
          {detayTarget && user?.role === 'admin' && (
            <Button variant="danger" size="sm" onClick={() => handleSil(detayTarget.pnr!)}>Satışı Sil</Button>
          )}
          {detayTarget && !isSatisKullanildi(detayTarget) && (
            <Button variant="default" size="sm" onClick={() => handleGirisVer(detayTarget)}>Giriş Ver</Button>
          )}
          <Button variant="accent" size="sm" onClick={() => window.print()}>🖨️ Yazdır</Button>
          <Button variant="default" onClick={() => setDetayModal(false)}>Kapat</Button>
        </ModalActions>
      </Modal>

      {/* İsim Seçim Modal */}
      <Modal open={isimSecimModal} onClose={() => setIsimSecimModal(false)} title="🔍 Birden Fazla Kayıt">
        <p style={{ fontSize:13, color:'var(--mu)', marginBottom:12 }}>Hangi müşteriyi görüntülemek istiyorsunuz?</p>
        {isimSecimList.map(t => (
          <button key={t.id} onClick={() => openDetayModal(t)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 14px', cursor:'pointer', marginBottom:6, color:'var(--tx)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500 }}>{t.musteriAd}</div>
              <div className="dc" style={{ marginTop:2 }}>{t.tarih} · {t.seans} · {t.pnr}</div>
            </div>
            <span style={{ color:'var(--ac)', fontFamily:'var(--mo)' }}>→</span>
          </button>
        ))}
        <ModalActions>
          <Button variant="default" onClick={() => setIsimSecimModal(false)}>Kapat</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
