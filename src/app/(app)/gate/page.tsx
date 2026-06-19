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
import { newTicketDoc, drawTicketPage } from '@/lib/shared/ticketPdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function getBiletNolar(satis: Satis): string[] {
  return (satis.biletler as Array<{ no: string } | string> || []).map(b =>
    typeof b === 'string' ? b : b.no
  );
}

function getBiletTur(satis: Satis, no: string): string {
  const found = (satis.biletler as Array<{ no: string; tur?: string }> || []).find(b =>
    typeof b !== 'string' && b.no === no
  );
  return (found && typeof found !== 'string' && found.tur) || 'tam';
}

function safeName(satis: Satis): string {
  return (satis.musteriAd ?? 'musteri').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_À-ɏ]/g, '');
}

async function downloadPNRZip(satis: Satis) {
  const zip = new JSZip();
  const biletNolar = getBiletNolar(satis);
  for (const no of biletNolar) {
    const doc = newTicketDoc();
    await drawTicketPage(doc, 0, {
      biletNo: no, tur: getBiletTur(satis, no), musteriAd: satis.musteriAd ?? '',
      tarih: satis.tarih, seans: satis.seans ?? '', pnr: satis.pnr,
    });
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
      const doc = newTicketDoc();
      await drawTicketPage(doc, 0, {
        biletNo: no, tur: getBiletTur(satis, no), musteriAd: satis.musteriAd ?? '',
        tarih: satis.tarih, seans: satis.seans ?? '', pnr: satis.pnr,
      });
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
    <div style={{ maxWidth: 1200 }}>
      {/* Sayfa Başlığı */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-tx)', letterSpacing: '-0.02em', margin: 0 }}>Bilet Sorgulama</h1>
        <p style={{ fontSize: 13, color: 'var(--color-mu)', marginTop: 4 }}>PNR veya QR kodu ile bilet ara ve doğrula.</p>
      </div>
      {/* Arama + Tarih — v0 Ticket Query stili */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-mu)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="PNR veya ad soyad ile ara..." value={aramaInput}
            onChange={e => setAramaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSorgula()}
            style={{
              width: '100%', padding: '9px 12px 9px 36px', fontSize: 13,
              background: 'var(--color-sf)', border: '1px solid var(--color-bd)',
              borderRadius: 8, color: 'var(--color-tx)', outline: 'none',
              fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setSelectedTarih(todayStr())} style={{
            padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'var(--color-sf)', border: '1px solid var(--color-bd)',
            borderRadius: 6, color: 'var(--color-mu)', transition: 'all .1s',
          }}>Bugün</button>
          <input type="date" value={dateToInput(selectedTarih)} onChange={e => setSelectedTarih(inputToDate(e.target.value))} style={{
            padding: '7px 10px', fontSize: 12, background: 'var(--color-sf)',
            border: '1px solid var(--color-bd)', borderRadius: 6, color: 'var(--color-tx)',
            outline: 'none', fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }} />
          <Button variant="default" size="sm" onClick={handleSorgula}>Sorgula</Button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, marginBottom:'1.5rem', border:'1px solid var(--color-bd)', borderRadius:8, overflow:'hidden' }}>
        <div className="kpi"><div className="kpi-label">Seçili Gün Toplam Bilet</div><div className="kpi-val">{toplamBilet}</div></div>
        <div className="kpi"><div className="kpi-label">Giriş Yapıldı</div><div className="kpi-val">{girisYapan}</div></div>
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
                  <td>{t.kurumsal ?? 0}</td>
                  <td className="dc">{t.satisZamani ?? '—'}</td>
                  <td>
                    {kullanildi
                      ? <span className="badge bdd">Kullanıldı</span>
                      : <span className="badge ba">{kullanilan}/{total} Giriş</span>
                    }
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                      <Button size="sm" onClick={() => openDetayModal(t)}>Detay</Button>
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
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:4 }}>
                        <svg width="13" height="15" viewBox="0 0 52 60" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" fill="#0a0a0a" d="M8.5 1 H33.5 Q41 1 41 8.5 V20 A10 10 0 0 0 41 40 V51.5 Q41 59 33.5 59 H8.5 Q1 59 1 51.5 V8.5 Q1 1 8.5 1 Z M7 16 Q7 11 12 11 H27 Q33 11 33 16 V44 Q33 49 28 49 H12 Q7 49 7 44 Z" />
                        </svg>
                        <span style={{ fontSize:10, letterSpacing:3, color:'#888', fontWeight:700 }}>STARDUST</span>
                      </div>
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
