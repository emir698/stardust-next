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
  doc.addImage(qrDataUrl, 'PNG', (w - qrSize) / 2, 52, qrSize, qrSize);

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

    // QR kodlarını oluştur
    setDetayQRLoading(true);
    try {
      const biletNolar = getBiletNolar(satis);
      const qrler = await Promise.all(
        biletNolar.map(async (no) => {
          const qrUrl = await QRCode.toDataURL(no, { width: 200, margin: 1, color: { dark: '#000', light: '#fff' } });
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
    setDetayModal(false);
  }

  async function handleGirisVerDetay() {
    if (!detayTarget) return;
    const bekleyenler = getBiletNolar(detayTarget).filter(no => !biletler[no]?.kullanildi);
    if (!bekleyenler.length) { toast('Tüm biletler zaten kullanılmış', 'warn'); return; }
    const now = new Date();
    const saat = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const updates: Record<string, unknown> = {};
    bekleyenler.forEach(no => {
      updates[`biletler/${no}/kullanildi`] = true;
      updates[`biletler/${no}/kullanildiSaat`] = saat;
    });
    updates[`pnrler/${detayTarget.pnr}/kullanildi`] = true;
    updates[`pnrler/${detayTarget.pnr}/kullanildiSaat`] = saat;
    await update(ref(db), updates);
    toast(`${bekleyenler.length} bilete giriş verildi!`, 'ok');
    setDetayModal(false);
  }

  async function handleMailGonder() {
    if (!detayTarget || !mailAddress.trim()) { toast('Mail adresi girin', 'err'); return; }
    setMailSending(true);
    try {
      const toplamBlt = (detayTarget.tam||0) + (detayTarget.cocuk||0) + (detayTarget.yabanci||0) + (detayTarget.davetli||0) + (detayTarget.kurumsal||0);
      await sendBiletMail(
        mailAddress.trim(),
        detayTarget.pnr ?? '',
        detayTarget.musteriAd ?? '',
        detayTarget.tarih,
        detayTarget.seans ?? '',
        toplamBlt,
        detayTarget.toplam ?? 0,
      );
      toast('Mail gönderildi!', 'ok');
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

  const TUR_LABEL: Record<string, string> = {
    tam: 'Tam', cocuk: 'Çocuk', yabanci: 'Yabancı', davetli: 'Davetli', kurumsal: 'Kurumsal',
  };
  const TUR_RENK: Record<string, { bg: string; color: string }> = {
    tam:      { bg:'#e8f5e9', color:'#2e7d32' },
    cocuk:    { bg:'#e3f2fd', color:'#1565c0' },
    yabanci:  { bg:'#fff3e0', color:'#e65100' },
    davetli:  { bg:'#e8f5e9', color:'#2e7d32' },
    kurumsal: { bg:'rgba(168,85,247,.1)', color:'#a855f7' },
  };

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
        <div className="kpi">
          <div className="kpi-label">Seçili Gün Toplam Bilet</div>
          <div className="kpi-val ac">{toplamBilet}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Giriş Yapıldı</div>
          <div className="kpi-val gn">{girisYapan}</div>
        </div>
      </div>

      {/* Tablo başlığı + Tümünü ZIP */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div className="section-title" style={{ margin:0 }}>Seçili Günün Biletleri</div>
        <Button
          size="sm"
          onClick={handleTumunuZip}
          disabled={zipLoading || gunSatislari.length === 0}
        >
          {zipLoading ? 'Hazırlanıyor...' : '⬇ Tümünü ZIP'}
        </Button>
      </div>

      {/* Bilet Kartları */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filteredSatislar.length === 0 ? (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--mu)', background:'var(--sf)', borderRadius:10, border:'1px solid var(--bd)' }}>
            Bu gün için satış yok
          </div>
        ) : filteredSatislar.map(t => {
          const kullanildi = isSatisKullanildi(t);
          const kullanilan = getSatisKullanilan(t);
          const total = (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0);
          return (
            <div key={t.id} style={{ background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:12, padding:'14px 16px' }}>
              {/* Üst satır: PNR + durum */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontFamily:'var(--mo)', fontSize:13, color:'var(--ac)', fontWeight:600 }}>{t.pnr ?? '—'}</span>
                  <span style={{ fontSize:13, fontWeight:500 }}>{t.musteriAd ?? '—'}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {kullanildi
                    ? <span className="badge bdd">Kullanıldı</span>
                    : <span className="badge ba">{kullanilan}/{total} Giriş</span>
                  }
                </div>
              </div>
              {/* Alt satır: bilgiler + butonlar */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div style={{ fontSize:12, color:'var(--mu)', display:'flex', gap:16 }}>
                  <span>📞 {t.musteriTel || '—'}</span>
                  <span style={{ fontFamily:'var(--mo)' }}>⏰ {t.seans}</span>
                  <span>
                    {[
                      t.tam ? `${t.tam} Tam` : '',
                      t.cocuk ? `${t.cocuk} Çocuk` : '',
                      t.yabanci ? `${t.yabanci} Yabancı` : '',
                      t.davetli ? `${t.davetli} Davetli` : '',
                      t.kurumsal ? `${t.kurumsal} Kurumsal` : '',
                    ].filter(Boolean).join(' · ')}
                  </span>
                  <span style={{ fontFamily:'var(--mo)', color:'var(--gn)', fontWeight:600 }}>
                    {t.toplam?.toLocaleString('tr-TR')}₺
                  </span>
                </div>
                {/* Sadece 2 buton */}
                <div style={{ display:'flex', gap:8 }}>
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => openDetayModal(t)}
                  >
                    Detay
                  </Button>
                  <Button
                    size="sm"
                    disabled={zipRowLoading === t.id}
                    onClick={() => handleZipIndir(t)}
                  >
                    {zipRowLoading === t.id ? '...' : '⬇ ZIP İndir'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detay Modal — QR + Müşteri Bilgileri + Mail */}
      <Modal open={detayModal} onClose={() => setDetayModal(false)} title="🎟️ Bilet Detayı" width="max-w-2xl">
        {detayTarget && (
          <div>
            {/* Müşteri Bilgileri Kartı */}
            <div style={{ background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Müşteri Bilgileri</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px' }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--mu)' }}>Ad Soyad</div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{detayTarget.musteriAd}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--mu)' }}>PNR</div>
                  <div style={{ fontFamily:'var(--mo)', fontSize:13, color:'var(--ac)', fontWeight:600 }}>{detayTarget.pnr}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--mu)' }}>Telefon</div>
                  <div style={{ fontSize:13 }}>{detayTarget.musteriTel || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--mu)' }}>E-posta</div>
                  <div style={{ fontSize:13 }}>{detayTarget.musteriMail || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--mu)' }}>Tarih / Seans</div>
                  <div style={{ fontSize:13 }}>
                    {getDayName(detayTarget.tarih, false)}, {detayTarget.tarih} — {detayTarget.seans}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--mu)' }}>Toplam</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--gn)' }}>
                    {detayTarget.toplam?.toLocaleString('tr-TR')}₺
                  </div>
                </div>
              </div>
            </div>

            {/* Bilet Özeti */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {[
                { key:'tam', label:'Tam', val:detayTarget.tam },
                { key:'cocuk', label:'Çocuk', val:detayTarget.cocuk },
                { key:'yabanci', label:'Yabancı', val:detayTarget.yabanci },
                { key:'davetli', label:'Davetli', val:detayTarget.davetli },
                { key:'kurumsal', label:'Kurumsal', val:detayTarget.kurumsal },
              ].filter(x => x.val).map(x => (
                <span key={x.key} style={{
                  padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                  background: TUR_RENK[x.key]?.bg, color: TUR_RENK[x.key]?.color,
                }}>
                  {x.val} {x.label}
                </span>
              ))}
              {detayTarget.indirimKodu && (
                <span style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, background:'rgba(52,211,153,.1)', color:'var(--gn)' }}>
                  %{detayTarget.indirimOran} İndirim ({detayTarget.indirimKodu})
                </span>
              )}
            </div>

            {/* QR Kodları */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>QR Kodlar</div>
              {detayQRLoading ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'var(--mu)' }}>QR kodlar oluşturuluyor...</div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
                  {detayQRler.map(q => {
                    const kullanildi = biletler[q.no]?.kullanildi;
                    return (
                      <div key={q.no} style={{
                        background:'#fff', borderRadius:12, padding:12, textAlign:'center', border:'2px solid',
                        borderColor: kullanildi ? '#ef4444' : '#e2e8f0',
                        opacity: kullanildi ? 0.6 : 1,
                        minWidth:120,
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.qrUrl} alt="QR" width={100} height={100} />
                        <div style={{ fontSize:10, color:'#666', marginTop:4, fontFamily:'monospace' }}>
                          {q.no.slice(-8)}
                        </div>
                        <div style={{
                          fontSize:10, fontWeight:600, marginTop:4, padding:'2px 8px', borderRadius:10,
                          background: TUR_RENK[q.tur]?.bg, color: TUR_RENK[q.tur]?.color,
                        }}>
                          {TUR_LABEL[q.tur] ?? q.tur}
                        </div>
                        {kullanildi && (
                          <div style={{ fontSize:9, color:'#ef4444', marginTop:4 }}>✓ Kullanıldı</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mail Gönder */}
            <div style={{ background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
              <div style={{ fontSize:11, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>📧 Mail Gönder</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="musteri@mail.com"
                  value={mailAddress}
                  onChange={e => setMailAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMailGonder()}
                  style={{ flex:1 }}
                />
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleMailGonder}
                  disabled={mailSending || !mailAddress.trim()}
                >
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
            <Button variant="default" size="sm" onClick={handleGirisVerDetay}>Giriş Ver</Button>
          )}
          <Button variant="default" onClick={() => setDetayModal(false)}>Kapat</Button>
        </ModalActions>
      </Modal>

      {/* İsim Seçim Modal */}
      <Modal open={isimSecimModal} onClose={() => setIsimSecimModal(false)} title="🔍 Birden Fazla Kayıt">
        <p style={{ fontSize:13, color:'var(--mu)', marginBottom:12 }}>Hangi müşteriyi görüntülemek istiyorsunuz?</p>
        {isimSecimList.map(t => (
          <button
            key={t.id}
            onClick={() => openDetayModal(t)}
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
