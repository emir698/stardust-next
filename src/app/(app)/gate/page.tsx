'use client';

import { useState, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSatisList, useBiletler } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { todayStr, dateToInput, inputToDate } from '@/lib/utils';
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
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');

  // Header
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('✦ STARDUST ✦', w / 2, 18, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Astra Lumina Istanbul', w / 2, 28, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`${satis.tarih}  —  Seans ${satis.seans}`, w / 2, 36, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(satis.musteriAd ?? '', w / 2, 44, { align: 'center' });

  // QR
  const qrSize = 60;
  doc.addImage(qrDataUrl, 'PNG', (w - qrSize) / 2, 52, qrSize, qrSize);

  // Bilet no
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  doc.text(biletNo, w / 2, 120, { align: 'center' });

  // PNR
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`PNR: ${satis.pnr}`, w / 2, 128, { align: 'center' });
}

async function buildPNRPdf(satis: Satis): Promise<jsPDF> {
  const biletNolar = getBiletNolar(satis);
  const doc = new jsPDF({ unit: 'mm', format: [90, 140] });
  for (let i = 0; i < biletNolar.length; i++) {
    await buildTicketPage(doc, i, biletNolar[i], satis);
  }
  return doc;
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
  const doc = await buildPNRPdf(satis);
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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const [zipLoading, setZipLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [zipRowLoading, setZipRowLoading] = useState<string | null>(null);
  const [mailModal, setMailModal] = useState(false);
  const [mailTarget, setMailTarget] = useState<Satis | null>(null);
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
    (s, t) => s + (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0
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
      openGirisModal(found);
    } else {
      const bulunanlar = satisList.filter(t => t.musteriAd?.toLowerCase().includes(val.toLowerCase()));
      if (!bulunanlar.length) { toast('Kayıt bulunamadı', 'err'); return; }
      if (bulunanlar.length === 1) { openGirisModal(bulunanlar[0]); return; }
      setIsimSecimList(bulunanlar); setIsimSecimModal(true);
    }
  }

  function openGirisModal(satis: Satis) {
    setGirisTarget(satis);
    const bekleyenler = (satis.biletler as Array<{ no: string }|string> || [])
      .map(b => typeof b === 'string' ? b : b.no)
      .filter(no => !biletler[no]?.kullanildi);
    setSeciliBiletler(new Set(bekleyenler));
    setGirisModal(true); setIsimSecimModal(false);
  }

  async function handleGirisVer() {
    if (!girisTarget || seciliBiletler.size === 0) return;
    const now  = new Date();
    const saat = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const updates: Record<string, unknown> = {};
    seciliBiletler.forEach(no => { updates[`biletler/${no}/kullanildi`] = true; updates[`biletler/${no}/kullanildiSaat`] = saat; });
    const tumBiletNolar = (girisTarget.biletler as Array<{ no: string }|string> || []).map(b => typeof b === 'string' ? b : b.no);
    const bekleyenler = tumBiletNolar.filter(no => !biletler[no]?.kullanildi);
    if (seciliBiletler.size >= bekleyenler.length) {
      updates[`pnrler/${girisTarget.pnr}/kullanildi`] = true;
      updates[`pnrler/${girisTarget.pnr}/kullanildiSaat`] = saat;
    }
    await update(ref(db), updates);
    toast(`${seciliBiletler.size} bilete giriş verildi!`, 'ok');
    setGirisModal(false); setGirisTarget(null);
  }

  async function hizliGiris(satis: Satis) {
    const bekleyenler = (satis.biletler as Array<{ no: string }|string> || [])
      .map(b => typeof b === 'string' ? b : b.no)
      .filter(no => !biletler[no]?.kullanildi);
    if (!bekleyenler.length) { toast('Tüm biletler zaten kullanılmış', 'warn'); return; }
    const now  = new Date();
    const saat = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const updates: Record<string, unknown> = {};
    bekleyenler.forEach(no => { updates[`biletler/${no}/kullanildi`] = true; updates[`biletler/${no}/kullanildiSaat`] = saat; });
    updates[`pnrler/${satis.pnr}/kullanildi`] = true;
    updates[`pnrler/${satis.pnr}/kullanildiSaat`] = saat;
    await update(ref(db), updates);
    toast(`${bekleyenler.length} bilete giriş verildi!`, 'ok');
  }

  async function handleSil(pnr: string) {
    if (!confirm(`${pnr} numaralı satışı silmek istiyor musunuz?`)) return;
    const satis = satisList.find(t => t.pnr === pnr);
    if (!satis) return;
    const updates: Record<string, null> = {};
    updates[`tickets/${satis.id}`] = null;
    updates[`pnrler/${pnr}`] = null;
    (satis.biletler as Array<{ no: string }|string> || []).forEach(b => {
      const no = typeof b === 'string' ? b : b.no;
      updates[`biletler/${no}`] = null;
    });
    await update(ref(db), updates as Record<string, unknown>);
    toast('Satış silindi', 'ok');
  }

  async function handleBiletiGetir(satis: Satis) {
    setPdfLoading(satis.id);
    try {
      await downloadPNRPdf(satis);
    } catch {
      toast('PDF oluşturulamadı', 'err');
    } finally {
      setPdfLoading(null);
    }
  }

  async function handleZipIndir(satis: Satis) {
    setZipRowLoading(satis.id);
    try {
      await downloadPNRZip(satis);
    } catch {
      toast('ZIP oluşturulamadı', 'err');
    } finally {
      setZipRowLoading(null);
    }
  }

  function openMailModal(satis: Satis) {
    setMailTarget(satis);
    setMailAddress(satis.musteriMail ?? '');
    setMailModal(true);
  }

  async function handleMailGonder() {
    if (!mailTarget || !mailAddress.trim()) { toast('Mail adresi girin', 'err'); return; }
    setMailSending(true);
    try {
      const toplamBilet = (mailTarget.tam||0)+(mailTarget.cocuk||0)+(mailTarget.yabanci||0)+(mailTarget.davetli||0)+(mailTarget.kurumsal||0);
      await sendBiletMail(
        mailAddress.trim(),
        mailTarget.pnr ?? '',
        mailTarget.musteriAd ?? '',
        mailTarget.tarih,
        mailTarget.seans ?? '',
        toplamBilet,
        mailTarget.toplam ?? 0
      );
      toast('Mail gönderildi!', 'ok');
      setMailModal(false);
    } catch {
      toast('Mail gönderilemedi', 'err');
    } finally {
      setMailSending(false);
    }
  }

  async function handleTumunuZip() {
    setZipLoading(true);
    try {
      await downloadAllZip(satisList, selectedTarih);
    } catch {
      toast('ZIP oluşturulamadı', 'err');
    } finally {
      setZipLoading(false);
    }
  }

  const targetBiletNolar = girisTarget
    ? (girisTarget.biletler as Array<{ no: string }|string> || []).map(b => typeof b === 'string' ? b : b.no)
    : [];
  const bekleyenBiletler = targetBiletNolar.filter(no => !biletler[no]?.kullanildi);

  return (
    <div>
      {/* Tarih + Sorgula */}
      <div className="page-section">
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
            <div className="section-title" style={{ margin:0 }}>Gün Seç</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button
                className={`tarih-picker-buton${selectedTarih !== todayStr() ? ' pasif' : ''}`}
                onClick={() => setSelectedTarih(todayStr())}
              >Bugün</button>
              <div className="tarih-picker-date">
                <input type="date" value={dateToInput(selectedTarih)} onChange={e => setSelectedTarih(inputToDate(e.target.value))} />
              </div>
            </div>
          </div>
          <div style={{ width:1, height:40, background:'var(--bd)', margin:'0 4px' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
            <div className="section-title" style={{ margin:0 }}>Sorgula</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder="PNR veya ad soyad..."
                style={{ fontSize:13, width:220 }}
                value={aramaInput}
                onChange={e => setAramaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSorgula()}
              />
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
        <Button
          size="sm"
          onClick={handleTumunuZip}
          disabled={zipLoading || gunSatislari.length === 0}
        >
          {zipLoading ? 'Hazırlanıyor...' : '⬇ Tümünü ZIP İndir'}
        </Button>
      </div>
      <div className="tw" style={{ marginBottom:'1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>PNR</th><th>Ad Soyad</th><th>Telefon</th><th>Seans</th>
              <th>Tam</th><th>Çocuk</th><th>Yabancı</th><th>Kurumsal</th>
              <th>Satış Saati</th><th>Durum</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredSatislar.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign:'center', padding:'2rem', color:'var(--mu)' }}>Bu gün için satış yok</td></tr>
            ) : filteredSatislar.map(t => {
              const kullanildi = isSatisKullanildi(t);
              const kullanilan = getSatisKullanilan(t);
              const total = (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0);
              return (
                <tr key={t.id}>
                  <td className="cc">{t.pnr ?? '—'}</td>
                  <td>{t.musteriAd ?? '—'}</td>
                  <td className="dc">{t.musteriTel ?? '—'}</td>
                  <td className="dc">{t.seans ?? '—'}</td>
                  <td>{t.tam ?? 0}</td>
                  <td>{t.cocuk ?? 0}</td>
                  <td>{t.yabanci ?? 0}</td>
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
                      {!kullanildi && t.pnr && (
                        <Button variant="accent" size="sm" onClick={() => hizliGiris(t)}>Giriş Ver</Button>
                      )}
                      {t.pnr && <Button size="sm" onClick={() => openGirisModal(t)}>Detay</Button>}
                      {t.pnr && (
                        <Button size="sm" disabled={pdfLoading === t.id} onClick={() => handleBiletiGetir(t)}>
                          {pdfLoading === t.id ? '...' : 'Bileti Getir'}
                        </Button>
                      )}
                      {t.pnr && (
                        <Button size="sm" disabled={zipRowLoading === t.id} onClick={() => handleZipIndir(t)}>
                          {zipRowLoading === t.id ? '...' : 'ZIP İndir'}
                        </Button>
                      )}
                      {t.pnr && (
                        <Button size="sm" onClick={() => openMailModal(t)}>📧 Mail Gönder</Button>
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

      {/* Giriş Ver Modal */}
      <Modal open={girisModal} onClose={() => setGirisModal(false)} title="🚪 Giriş Ver" width="max-w-lg">
        {girisTarget && (
          <>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{girisTarget.musteriAd}</div>
            <div className="dc" style={{ marginBottom:'1rem' }}>
              {girisTarget.tarih} · Seans {girisTarget.seans} · {girisTarget.pnr}
            </div>
            {bekleyenBiletler.length === 0 ? (
              <div style={{ color:'var(--rd)', fontSize:13, textAlign:'center', padding:'1.5rem' }}>Tüm biletler kullanılmış!</div>
            ) : (
              <>
                <div style={{ fontSize:12, color:'var(--mu)', marginBottom:8 }}>
                  Giriş verilecek biletleri seçin ({bekleyenBiletler.length} bekliyor):
                </div>
                {bekleyenBiletler.map(no => (
                  <label key={no} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 12px', cursor:'pointer', marginBottom:6 }}>
                    <input
                      type="checkbox"
                      checked={seciliBiletler.has(no)}
                      onChange={e => {
                        const next = new Set(seciliBiletler);
                        e.target.checked ? next.add(no) : next.delete(no);
                        setSeciliBiletler(next);
                      }}
                    />
                    <span style={{ fontFamily:'var(--mo)', fontSize:12, color:'var(--ac)', flex:1 }}>{no}</span>
                    <span style={{ fontSize:11, color:'var(--mu)' }}>{biletler[no]?.tur ?? ''}</span>
                  </label>
                ))}
              </>
            )}
            <ModalActions>
              <Button variant="default" onClick={() => setGirisModal(false)}>Kapat</Button>
              {bekleyenBiletler.length > 0 && (
                <Button variant="accent" disabled={seciliBiletler.size === 0} onClick={handleGirisVer} style={{ fontSize:15, padding:'12px 32px' }}>
                  ✓ Seçili Biletlere Giriş Ver
                </Button>
              )}
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Mail Gönder Modal */}
      <Modal open={mailModal} onClose={() => setMailModal(false)} title="📧 Mail Gönder">
        {mailTarget && (
          <>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>{mailTarget.musteriAd}</div>
              <div style={{ fontSize:12, color:'var(--mu)', marginTop:2 }}>{mailTarget.pnr} · {mailTarget.tarih} · Seans {mailTarget.seans}</div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label className="form-label">Mail Adresi</label>
              <input
                type="email"
                className="form-input"
                placeholder="musteri@mail.com"
                value={mailAddress}
                onChange={e => setMailAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMailGonder()}
                autoFocus
              />
            </div>
            <ModalActions>
              <Button variant="default" onClick={() => setMailModal(false)}>İptal</Button>
              <Button variant="accent" onClick={handleMailGonder} disabled={mailSending || !mailAddress.trim()}>
                {mailSending ? 'Gönderiliyor...' : 'Gönder'}
              </Button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* İsim Seçim Modal */}
      <Modal open={isimSecimModal} onClose={() => setIsimSecimModal(false)} title="🔍 Birden Fazla Kayıt Bulundu">
        <p>Hangi müşteriyi görüntülemek istiyorsunuz?</p>
        {isimSecimList.map(t => (
          <button
            key={t.id}
            onClick={() => openGirisModal(t)}
            style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 14px', cursor:'pointer', marginBottom:6, color:'var(--tx)' }}
          >
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
