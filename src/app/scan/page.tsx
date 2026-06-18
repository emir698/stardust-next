'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, update, onValue, off } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth, logout } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type { Bilet, OZEL_SAATLER, HAFTALIK_SAATLER } from '@/types';

// ─── Seans helpers ────────────────────────────────────────────────────────────

const OZEL: Record<string, string[]> = {
  '19.05.2026': ['20:45', '21:00', '21:30', '22:00'],
  '28.05.2026': ['20:45', '21:00', '21:30', '22:00', '22:30'],
};
const HSEANS: Record<number, string[]> = {
  3: ['21:00', '21:30', '22:00', '22:30'],
  5: ['21:00', '21:30', '22:00', '22:30', '23:00'],
  6: ['21:00', '21:30', '22:00', '22:30', '23:00'],
  0: ['21:00', '21:30', '22:00', '22:30'],
};

function pad(n: number) { return String(n).padStart(2, '0'); }

function todayStr() {
  const n = new Date();
  return `${pad(n.getDate())}.${pad(n.getMonth() + 1)}.${n.getFullYear()}`;
}

function addDays(ds: string, n: number) {
  const p = ds.split('.');
  const d = new Date(+p[2], +p[1] - 1, +p[0]);
  d.setDate(d.getDate() + n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function getDayName(ds: string) {
  const p = ds.split('.');
  return ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][
    new Date(+p[2], +p[1] - 1, +p[0]).getDay()
  ];
}

function fmtDate(ds: string) {
  const p = ds.split('.');
  const m = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  return `${+p[0]} ${m[+p[1] - 1]} ${p[2]}, ${getDayName(ds)}`;
}

function getSaatler(ds: string): string[] | null {
  if (OZEL[ds]) return OZEL[ds];
  const p = ds.split('.');
  return HSEANS[new Date(+p[2], +p[1] - 1, +p[0]).getDay()] ?? null;
}

function isEtkinlik(ds: string) { return getSaatler(ds) !== null; }

function nowSaat() {
  const n = new Date();
  return `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
}

function dmyToDate(s: string) {
  const p = s.split('.');
  return new Date(+p[2], +p[1] - 1, +p[0]);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PNRDoc {
  musteriAd: string;
  tarih: string;
  seans: string;
  tam: number;
  cocuk: number;
  yabanci: number;
  davetli?: number;
  biletler?: string[];
  kullanildi?: boolean;
  kullanildiSaat?: string;
}

interface BiletDoc extends Bilet {
  musteriAd?: string;
  kullanildiSaat?: string;
}

interface KurumsalBilet {
  kod: string;
  kullanildi?: boolean;
  kullanimTarihi?: string;
  kullanimSaat?: string;
}

interface KurumsalPaketRaw {
  id?: string;
  firma: string;
  baslangic: string;
  bitis: string;
  adet: number;
  kullanilan?: number;
  biletler?: Record<string, KurumsalBilet>;
}

interface KurumsalSonuc {
  ok: boolean;
  firma: string;
  msg: string;
  kullanilan?: number;
  toplam?: number;
  kalan?: number;
  bitis?: string;
}

interface SeansIstatistik {
  toplam: number;
  giris: number;
}

// ─── Screen enum ─────────────────────────────────────────────────────────────

type Screen = 'seans' | 'scan';

// ─── Sheet state ─────────────────────────────────────────────────────────────

type SheetType = 'none' | 'result' | 'liste';

interface ResultSheet {
  icon: string;
  title: string;
  titleCls: string; // 'green' | 'red' | ''
  name: string;
  info: string;
  biletlerHtml?: BiletItem[];
  showGiris: boolean;
}

interface BiletItem {
  no: string;
  tur: string;
  kullanildi: boolean;
  checked: boolean;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, type: 'ok' | 'err') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  return { toast, show };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ScanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Seans state
  const [screen, setScreen] = useState<Screen>('seans');
  const [selectedGun, setSelectedGun] = useState('');
  const [selectedSeans, setSelectedSeans] = useState('');
  const [biletler, setBiletler] = useState<Record<string, BiletDoc>>({});
  const [kurumsalPaketler, setKurumsalPaketler] = useState<Record<string, KurumsalPaketRaw>>({});

  // Scan state
  const [qrActive, setQrActive] = useState(false);
  const qrScannerRef = useRef<unknown>(null);

  // Sheet state
  const [sheetType, setSheetType] = useState<SheetType>('none');
  const [resultSheet, setResultSheet] = useState<ResultSheet | null>(null);
  const [currentPNR, setCurrentPNR] = useState<{ pnr: string; bekleyenler: BiletItem[] } | null>(null);

  // Barcode input
  const barcodeRef = useRef<HTMLInputElement>(null);
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toast, show: showToast } = useToast();

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (!authLoading && user && user.role !== 'admin' && user.role !== 'okutma') {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // ── Firebase watchers ─────────────────────────────────────────────────────

  useEffect(() => {
    const r = ref(db, 'biletler');
    const unsub = onValue(r, snap => setBiletler(snap.exists() ? snap.val() : {}));
    return () => off(r, 'value', unsub as never);
  }, []);

  useEffect(() => {
    const r = ref(db, 'kurumsalPaketler');
    const unsub = onValue(r, snap => setKurumsalPaketler(snap.exists() ? snap.val() : {}));
    return () => off(r, 'value', unsub as never);
  }, []);

  // ── Initial seans selection ────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let gun = todayStr();
    if (!isEtkinlik(gun)) {
      for (let i = 1; i <= 14; i++) {
        const d = addDays(gun, i);
        if (isEtkinlik(d)) { gun = d; break; }
      }
    }
    setSelectedGun(gun);
  }, [user]);

  // ── Seans stats ───────────────────────────────────────────────────────────

  function getSeansIstatistik(gun: string, seans: string): SeansIstatistik {
    const gb = Object.values(biletler).filter(b => b && b.tarih === gun && b.seans === seans);
    return { toplam: gb.length, giris: gb.filter(b => b.kullanildi).length };
  }

  // ── Select seans ─────────────────────────────────────────────────────────

  function selectSeans(saat: string) {
    setSelectedSeans(saat);
    setScreen('scan');
    setTimeout(() => { barcodeRef.current?.focus(); }, 400);
  }

  function goBack() {
    stopQr();
    setSheetType('none');
    setScreen('seans');
    setSelectedSeans('');
  }

  // ── Barcode / HID scanner support ────────────────────────────────────────
  // Honeywell Granit/Voyager USB-HID sends keystrokes ending with Enter
  // Android Bluetooth scanners emit keyCode 229 (IME) or the value directly

  function handleBarcodeInput(val: string) {
    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
    const v = val.trim().toUpperCase();
    // Auto-submit for SD- or PNR- codes of sufficient length
    if ((v.startsWith('SD-') && v.length >= 10) || (v.startsWith('PNR-') && v.length >= 10) || (v.startsWith('KURUMSAL') && v.length >= 8)) {
      barcodeTimerRef.current = setTimeout(() => submitBarcode(v), 80);
    }
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
      const val = barcodeRef.current?.value.trim().toUpperCase() ?? '';
      if (val.length >= 4) submitBarcode(val);
    }
    // Honeywell sends F21 as trigger signal on some models
    if (e.code === 'F21') {
      e.preventDefault();
      barcodeTimerRef.current = setTimeout(() => {
        const val = barcodeRef.current?.value.trim().toUpperCase() ?? '';
        if (val.length >= 4) submitBarcode(val);
      }, 100);
    }
  }

  async function submitBarcode(val: string) {
    if (!barcodeRef.current) return;
    barcodeRef.current.value = '';
    barcodeRef.current.focus();
    await islemYap(val);
  }

  // ── Keep barcode input focused ─────────────────────────────────────────

  function refocusBarcode() {
    if (screen !== 'scan') return;
    if (sheetType !== 'none') return;
    barcodeRef.current?.focus();
  }

  // ── QR Camera ─────────────────────────────────────────────────────────────

  async function startQr() {
    if (typeof window === 'undefined') return;
    try {
      // html5-qrcode loaded via CDN in layout; access via window
      const Html5Qrcode = (window as unknown as Record<string, unknown>)['Html5Qrcode'] as (new (id: string) => {
        start: (cam: unknown, cfg: unknown, onSuccess: (text: string) => void, onErr: () => void) => Promise<void>;
        stop: () => Promise<void>;
      }) | undefined;
      if (!Html5Qrcode) { showToast('QR kütüphanesi yüklenemedi', 'err'); return; }
      const scanner = new Html5Qrcode('qr-reader');
      qrScannerRef.current = scanner;
      setQrActive(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (text: string) => {
          const val = text.trim().toUpperCase();
          await stopQr();
          await islemYap(val);
        },
        () => {}
      );
    } catch {
      showToast('Kamera açılamadı', 'err');
      setQrActive(false);
      qrScannerRef.current = null;
    }
  }

  async function stopQr() {
    setQrActive(false);
    if (qrScannerRef.current) {
      try {
        await (qrScannerRef.current as { stop: () => Promise<void> }).stop();
      } catch { /* ignore */ }
      qrScannerRef.current = null;
    }
  }

  // ── Core scan logic ───────────────────────────────────────────────────────

  async function islemYap(val: string) {
    // Kurumsal check first
    const kSonuc = await kurumsalScanKontrol(val);
    if (kSonuc !== null) { showKurumsalResult(kSonuc); return; }

    if (val.startsWith('SD-')) { await sorgulaBiletNo(val); }
    else { await sorgulaPNR(val); }
  }

  async function kurumsalScanKontrol(kod: string): Promise<KurumsalSonuc | null> {
    const paketler = Object.entries(kurumsalPaketler);
    for (const [pKey, p] of paketler) {
      if (!p.biletler) continue;
      for (const [bKey, b] of Object.entries(p.biletler)) {
        if (b.kod !== kod) continue;
        const today = todayStr();
        const todayD = dmyToDate(today);
        const basD = dmyToDate(p.baslangic);
        const bitD = dmyToDate(p.bitis);
        if (todayD < basD) return { ok: false, firma: p.firma, msg: 'Bilet henüz geçerli değil' };
        if (todayD > bitD) return { ok: false, firma: p.firma, msg: `Bilet süresi dolmuş (${p.bitis})` };
        if (b.kullanildi) return { ok: false, firma: p.firma, msg: 'Bu bilet zaten kullanıldı' };

        const saat = new Date().toTimeString().slice(0, 8);
        await update(ref(db, `kurumsalPaketler/${pKey}/biletler/${bKey}`), {
          kullanildi: true, kullanimTarihi: today, kullanimSaat: saat,
        });
        const yeniKullanilan = (p.kullanilan ?? 0) + 1;
        await update(ref(db, `kurumsalPaketler/${pKey}`), { kullanilan: yeniKullanilan });
        return {
          ok: true, firma: p.firma, msg: p.firma,
          kullanilan: yeniKullanilan, toplam: p.adet,
          kalan: p.adet - yeniKullanilan, bitis: p.bitis,
        };
      }
    }
    return null;
  }

  function showKurumsalResult(r: KurumsalSonuc) {
    if (r.ok) {
      openResultSheet({
        icon: '✓', title: 'Giriş Onaylandı', titleCls: 'green',
        name: r.firma,
        info: `${r.kullanilan} / ${r.toplam} bilet kullanıldı\n${r.kalan} bilet kaldı · Geçerlilik: ${r.bitis}`,
        showGiris: false,
      });
    } else {
      openResultSheet({
        icon: '✗', title: 'Geçersiz Bilet', titleCls: 'red',
        name: r.firma, info: r.msg, showGiris: false,
      });
    }
  }

  async function sorgulaPNR(val: string) {
    const snap = await get(ref(db, `pnrler/${val}`));
    const p = snap.val() as PNRDoc | null;
    if (!p) {
      openResultSheet({ icon: '✗', title: 'PNR Bulunamadı', titleCls: 'red', name: '', info: 'Bu PNR sistemde kayıtlı değil.', showGiris: false });
      return;
    }
    // Kurumsal PNR: tüm biletler kurumsal ise tarih/seans kontrolü yapma
    const biletNoList = p.biletler ?? [];
    const biletSnaplar = await Promise.all(biletNoList.map(async bno => {
      const bs = await get(ref(db, `biletler/${bno}`));
      return bs.val() as BiletDoc | null;
    }));
    const tumKurumsal = biletSnaplar.length > 0 && biletSnaplar.every(b => b?.tur === 'kurumsal');
    if (!tumKurumsal && (p.tarih !== selectedGun || p.seans !== selectedSeans)) {
      openResultSheet({ icon: '⚠️', title: 'Yanlış Seans', titleCls: 'red', name: p.musteriAd, info: `Bu bilet ${p.tarih} · Seans ${p.seans} için geçerlidir.\nŞu an: ${selectedGun} · Seans ${selectedSeans}`, showGiris: false });
      return;
    }
    const results = biletNoList.map((bno, i) => ({ no: bno, data: biletSnaplar[i] }));
    const biletItems: BiletItem[] = results.map(b => ({
      no: b.no,
      tur: b.data?.tur ?? '-',
      kullanildi: !!(b.data?.kullanildi),
      checked: !b.data?.kullanildi,
    }));
    const bekleyenler = biletItems.filter(b => !b.kullanildi);
    if (bekleyenler.length === 0) {
      openResultSheet({ icon: '✗', title: 'Tümü Kullanılmış', titleCls: 'red', name: p.musteriAd, info: `${p.tarih} · Seans ${p.seans}`, showGiris: false });
      return;
    }
    setCurrentPNR({ pnr: val, bekleyenler });
    openResultSheet({
      icon: '📋', title: 'PNR Bulundu', titleCls: '',
      name: p.musteriAd,
      info: `${p.tarih} · Seans ${p.seans}\nTam: ${p.tam ?? 0} · Çocuk: ${p.cocuk ?? 0} · Yabancı: ${p.yabanci ?? 0}`,
      biletlerHtml: biletItems,
      showGiris: true,
    });
  }

  async function sorgulaBiletNo(val: string) {
    const snap = await get(ref(db, `biletler/${val}`));
    const b = snap.val() as BiletDoc | null;
    if (!b) {
      openResultSheet({ icon: '✗', title: 'Geçersiz Bilet', titleCls: 'red', name: '', info: 'Bu bilet bulunamadı.', showGiris: false });
      return;
    }

    // Kurumsal biletler: tarih/seans bağımsız, geçerlilik aralığı yok (satış anında belirlendi)
    if (b.tur === 'kurumsal') {
      if (b.kullanildi) {
        openResultSheet({ icon: '✗', title: 'Kullanılmış', titleCls: 'red', name: b.musteriAd ?? '', info: `${b.kullanildiSaat} saatinde giriş yapıldı.`, showGiris: false });
        return;
      }
      const saat = nowSaat();
      const upd: Record<string, unknown> = {};
      upd[`biletler/${val}/kullanildi`] = true;
      upd[`biletler/${val}/kullanildiSaat`] = saat;
      await update(ref(db), upd);
      openResultSheet({
        icon: '✓', title: 'Kurumsal Giriş', titleCls: 'green',
        name: b.musteriAd ?? 'Kurumsal Misafir',
        info: `Kurumsal bilet\n${val}`,
        showGiris: false,
      });
      setTimeout(() => closeSheet(), 3000);
      return;
    }

    // Bireysel biletler: tarih ve seans eşleşmeli
    if (b.tarih !== selectedGun || b.seans !== selectedSeans) {
      openResultSheet({ icon: '⚠️', title: 'Yanlış Seans', titleCls: 'red', name: b.musteriAd ?? '', info: `Bu bilet ${b.tarih} · Seans ${b.seans} için geçerlidir.\nŞu an: ${selectedGun} · Seans ${selectedSeans}`, showGiris: false });
      return;
    }
    if (b.kullanildi) {
      openResultSheet({ icon: '✗', title: 'Kullanılmış', titleCls: 'red', name: b.musteriAd ?? '', info: `${b.kullanildiSaat} saatinde giriş yapıldı.`, showGiris: false });
      return;
    }
    const biletNo = val;
    const biletTur = b.tur;
    const biletSaat = nowSaat();
    const upd2: Record<string, unknown> = {};
    upd2[`biletler/${biletNo}/kullanildi`] = true;
    upd2[`biletler/${biletNo}/kullanildiSaat`] = biletSaat;
    await update(ref(db), upd2);
    openResultSheet({
      icon: '✓', title: 'Bilet Geçerli', titleCls: 'green',
      name: b.musteriAd ?? '',
      info: `Seans: ${b.seans} · ${biletTur}\n${b.tarih}`,
      showGiris: false,
    });
    setTimeout(() => closeSheet(), 3000);
  }

  async function girisVer() {
    if (!currentPNR) return;
    const secili = currentPNR.bekleyenler.filter(b => b.checked).map(b => b.no);
    if (!secili.length) { showToast('En az 1 bilet seçin', 'err'); return; }
    const saat = nowSaat();
    const upd: Record<string, unknown> = {};
    secili.forEach(bno => {
      upd[`biletler/${bno}/kullanildi`] = true;
      upd[`biletler/${bno}/kullanildiSaat`] = saat;
    });
    if (currentPNR.pnr && secili.length >= currentPNR.bekleyenler.length) {
      upd[`pnrler/${currentPNR.pnr}/kullanildi`] = true;
      upd[`pnrler/${currentPNR.pnr}/kullanildiSaat`] = saat;
    }
    await update(ref(db), upd);
    showToast(`✓ ${secili.length} bilete giriş verildi!`, 'ok');
    setTimeout(() => {
      closeSheet();
    }, 1800);
  }

  function toggleBiletCheck(no: string) {
    if (!currentPNR) return;
    setCurrentPNR({
      ...currentPNR,
      bekleyenler: currentPNR.bekleyenler.map(b => b.no === no ? { ...b, checked: !b.checked } : b),
    });
    // Also update resultSheet biletlerHtml
    setResultSheet(prev => prev ? {
      ...prev,
      biletlerHtml: prev.biletlerHtml?.map(b => b.no === no ? { ...b, checked: !b.checked } : b),
    } : prev);
  }

  // ── Sheet helpers ─────────────────────────────────────────────────────────

  function openResultSheet(r: ResultSheet) {
    setResultSheet(r);
    setSheetType('result');
  }

  function closeSheet() {
    setSheetType('none');
    setResultSheet(null);
    setCurrentPNR(null);
    setTimeout(() => {
      barcodeRef.current?.value !== undefined && (barcodeRef.current.value = '');
      barcodeRef.current?.focus();
    }, 200);
  }

  // ── Liste sheet ───────────────────────────────────────────────────────────

  interface ListeKisi {
    musteriAd: string;
    tarih: string;
    seans: string;
    biletler?: string[];
    giris: number;
    toplam: number;
    girisZamani?: string;
  }

  const [listeKisiler, setListeKisiler] = useState<ListeKisi[]>([]);

  async function openListe() {
    const snap = await get(ref(db, 'pnrler'));
    const pnrMap = (snap.val() ?? {}) as Record<string, PNRDoc>;
    const ilgili = Object.values(pnrMap).filter(p => p.tarih === selectedGun && p.seans === selectedSeans);

    const kisiler: ListeKisi[] = ilgili.map(p => {
      const biletNoList = p.biletler ?? [];
      const giris = biletNoList.filter(bno => biletler[bno]?.kullanildi).length;
      const girisZamani = biletNoList
        .map(bno => biletler[bno]?.kullanildiSaat)
        .filter(Boolean)[0];
      return {
        musteriAd: p.musteriAd,
        tarih: p.tarih,
        seans: p.seans,
        biletler: biletNoList,
        giris,
        toplam: biletNoList.length || ((p.tam ?? 0) + (p.cocuk ?? 0) + (p.yabanci ?? 0)),
        girisZamani,
      };
    });
    setListeKisiler(kisiler);
    setSheetType('liste');
  }

  // ── Stats for topbar ──────────────────────────────────────────────────────

  const stat = selectedGun && selectedSeans ? getSeansIstatistik(selectedGun, selectedSeans) : { toplam: 0, giris: 0 };

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#ededed', fontSize: 13, letterSpacing: 4, fontFamily: 'monospace' }}>STARDUST</div>
      </div>
    );
  }

  const saatler = selectedGun ? (getSaatler(selectedGun) ?? []) : [];

  return (
    <>
      {/* ── Global styles (scoped) — v0.dev monokrom tema ── */}
      <style>{`
        .scan-root { background: #0a0a0a; color: #ededed; min-height: 100vh; max-width: 430px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .scan-header { background: #0a0a0a; border-bottom: 1px solid #222; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 20; }
        .scan-header-logo { font-size: 12px; letter-spacing: 0.2em; color: #ededed; font-weight: 600; font-family: monospace; }
        .scan-header-sub { font-size: 10px; color: #666; letter-spacing: 0.12em; margin-top: 2px; }
        .scan-header-right { display: flex; align-items: center; gap: 10px; }
        .scan-btn-sm { background: #141414; border: 1px solid #222; border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: 500; color: #888; cursor: pointer; font-family: inherit; }

        /* Seans screen */
        .seans-screen { padding: 20px 16px; }
        .seans-title { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 4px; }
        .seans-date { font-size: 13px; color: #666; margin-bottom: 24px; }
        .seans-kart { background: #141414; border-radius: 8px; margin-bottom: 10px; border: 1px solid #222; display: flex; align-items: center; cursor: pointer; transition: border-color .15s, background .15s; }
        .seans-kart:active { border-color: #383838; background: #1a1a1a; }
        .seans-info { padding: 18px 16px; flex: 1; }
        .seans-saat { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; font-family: monospace; color: #ededed; }
        .seans-tarih { font-size: 12px; color: #666; margin-top: 4px; font-family: monospace; }
        .seans-stat { font-size: 12px; color: #888; margin-top: 8px; }
        .seans-chevron { font-size: 18px; color: #444; padding-right: 16px; }

        /* Scan screen */
        .scan-topbar { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #222; background: #0a0a0a; gap: 8px; }
        .back-btn { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #888; background: none; border: none; cursor: pointer; font-weight: 500; padding: 0; font-family: inherit; flex-shrink: 0; }
        .seans-label { font-size: 16px; font-weight: 600; color: #ededed; letter-spacing: -0.01em; font-family: monospace; }
        .stat-pill { font-size: 11px; font-weight: 500; color: #888; background: #141414; border: 1px solid #222; border-radius: 20px; padding: 4px 10px; flex-shrink: 0; font-family: monospace; }
        .liste-btn { background: #141414; border: 1px solid #222; border-radius: 6px; padding: 8px 14px; font-size: 12px; font-weight: 500; color: #ededed; cursor: pointer; font-family: inherit; flex-shrink: 0; }

        .scan-body { padding: 12px; }

        /* Barcode input */
        .barcode-input { width: 100%; background: #141414; border: 1.5px solid #ededed; border-radius: 8px; padding: 16px; color: #ededed; font-size: 15px; font-weight: 600; font-family: monospace; outline: none; text-align: center; box-sizing: border-box; margin-bottom: 12px; caret-color: #ededed; }
        .barcode-input::placeholder { color: #444; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 400; font-size: 13px; }

        /* QR card */
        .qr-card { background: #141414; border: 1px solid #222; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
        .qr-start-btn { width: 100%; padding: 14px; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .qr-icon { font-size: 32px; line-height: 1; opacity: 0.7; }
        .qr-label { font-size: 22px; font-weight: 700; color: #ededed; }
        .qr-sub { font-size: 14px; color: #666; }
        .qr-stop-btn { width: 100%; padding: 16px; background: #ededed; color: #0a0a0a; border: none; cursor: pointer; font-size: 14px; font-weight: 600; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; }
        #qr-reader { width: 100%; background: #000; display: none; }
        #qr-reader video { width: 100% !important; }

        /* Overlay / Sheet */
        .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 50; align-items: flex-end; justify-content: center; }
        .overlay.open { display: flex; }
        .sheet { background: #141414; border-radius: 16px 16px 0 0; width: 100%; max-width: 430px; max-height: 88vh; overflow-y: auto; padding: 20px; border-top: 1px solid #222; }
        .sheet-handle { width: 36px; height: 4px; background: #2e2e2e; border-radius: 2px; margin: 0 auto 20px; }
        .r-icon { font-size: 56px; text-align: center; margin-bottom: 12px; line-height: 1; opacity: 0.9; }
        .r-title { font-size: 22px; font-weight: 600; text-align: center; margin-bottom: 4px; letter-spacing: -0.01em; }
        .r-title.green { color: #ededed; }
        .r-title.red { color: #888; }
        .r-name { font-size: 16px; font-weight: 500; text-align: center; margin-bottom: 6px; color: #ededed; }
        .r-info { font-size: 13px; color: #888; text-align: center; margin-bottom: 20px; line-height: 1.7; white-space: pre-line; }

        /* Bilet items */
        .bilet-item { background: #1a1a1a; border: 1px solid #222; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
        .bi-no { font-size: 12px; font-family: monospace; color: #ededed; font-weight: 600; }
        .bi-tur { font-size: 12px; color: #666; margin-top: 2px; }
        .bi-cb { width: 20px; height: 20px; accent-color: #ededed; cursor: pointer; }
        .bi-status { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; border: 1px solid #2e2e2e; }
        .bi-status.ok { background: rgba(255,255,255,.06); color: #ededed; border-color: #2e2e2e; }
        .bi-status.used { background: transparent; color: #555; border-color: #222; }

        /* Buttons */
        .giris-btn { width: 100%; padding: 16px; background: #ededed; color: #0a0a0a; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 12px; font-family: inherit; }
        .giris-btn:disabled { opacity: .3; cursor: default; }
        .kapat-btn { width: 100%; padding: 14px; background: #1a1a1a; border: 1px solid #222; color: #888; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; margin-top: 8px; font-family: inherit; }

        /* Liste sheet */
        .liste-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; letter-spacing: -0.01em; }
        .liste-ozet { background: #1a1a1a; border: 1px solid #222; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
        .liste-ozet-label { font-size: 13px; font-weight: 500; color: #888; }
        .liste-ozet-sayi { font-size: 20px; font-weight: 700; color: #ededed; font-family: monospace; }
        .liste-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #1a1a1a; border: 1px solid #222; border-radius: 8px; margin-bottom: 8px; }
        .li-name { font-size: 14px; font-weight: 500; color: #ededed; }
        .li-detail { font-size: 12px; color: #666; margin-top: 2px; }
        .li-badge { font-size: 11px; padding: 4px 10px; border-radius: 20px; font-weight: 500; white-space: nowrap; border: 1px solid #2e2e2e; }
        .li-badge.ok { background: rgba(255,255,255,.06); color: #ededed; }
        .li-badge.no { background: transparent; color: #555; border-color: #222; }

        /* Toast */
        .scan-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(20px); background: #141414; border: 1px solid #2e2e2e; border-radius: 10px; padding: 12px 20px; font-size: 13px; font-weight: 500; z-index: 100; opacity: 0; transition: all .25s; pointer-events: none; white-space: nowrap; max-width: 90vw; text-align: center; }
        .scan-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .scan-toast.ok { border-color: #3e3e3e; color: #ededed; }
        .scan-toast.err { border-color: #2e2e2e; color: #888; }
      `}</style>

      <div className="scan-root" onClick={refocusBarcode}>

        {/* ── Header ── */}
        <div className="scan-header">
          <div>
            <div className="scan-header-logo">STARDUST</div>
            <div className="scan-header-sub">TICKET SCAN</div>
          </div>
          <div className="scan-header-right">
            <span style={{ fontSize: 12, color: '#666' }}>{user.name}</span>
            <button className="scan-btn-sm" onClick={() => { stopQr(); logout(); router.replace('/login'); }}>
              Çıkış
            </button>
          </div>
        </div>

        {/* ── Seans Screen ── */}
        {screen === 'seans' && (
          <div className="seans-screen">
            <div className="seans-title">Seans Seçimi</div>
            <div className="seans-date">{selectedGun ? fmtDate(selectedGun) : ''}</div>
            {saatler.map(saat => {
              const s = getSeansIstatistik(selectedGun, saat);
              return (
                <div key={saat} className="seans-kart" onClick={() => selectSeans(saat)}>
                  <div className="seans-info">
                    <div className="seans-saat">{saat}</div>
                    <div className="seans-tarih">{selectedGun}</div>
                    {s.toplam > 0 && (
                      <div className="seans-stat">{s.giris} / {s.toplam} giriş yapıldı</div>
                    )}
                  </div>
                  <div className="seans-chevron">›</div>
                </div>
              );
            })}
            {saatler.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 14 }}>
                Bugün etkinlik yok.
              </div>
            )}
          </div>
        )}

        {/* ── Scan Screen ── */}
        {screen === 'scan' && (
          <div>
            <div className="scan-topbar">
              <button className="back-btn" onClick={goBack}>← Geri</button>
              <div className="seans-label">{selectedSeans}</div>
              <div className="stat-pill">{stat.giris}/{stat.toplam}</div>
              <button className="liste-btn" onClick={openListe}>☰ Liste</button>
            </div>

            <div className="scan-body">

              {/* Honeywell / HID barcode input */}
              <input
                ref={barcodeRef}
                type="text"
                className="barcode-input"
                placeholder="👆 Barkod okut veya buraya yaz"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={e => handleBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
              />

              {/* QR Camera */}
              <div className="qr-card">
                <div id="qr-reader" style={{ display: qrActive ? 'block' : 'none' }} />
                {!qrActive ? (
                  <button className="qr-start-btn" onClick={startQr}>
                    <div className="qr-icon">📷</div>
                  </button>
                ) : (
                  <button className="qr-stop-btn" onClick={stopQr}>⏹ Kamerayı Durdur</button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── Result Sheet ── */}
        <div
          className={`overlay${sheetType === 'result' ? ' open' : ''}`}
          onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}
        >
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            {resultSheet && (
              <>
                <div className="r-icon">{resultSheet.icon}</div>
                <div className={`r-title ${resultSheet.titleCls}`}>{resultSheet.title}</div>
                {resultSheet.name && <div className="r-name">{resultSheet.name}</div>}
                <div className="r-info">{resultSheet.info}</div>

                {resultSheet.biletlerHtml && resultSheet.biletlerHtml.map(b => (
                  <div key={b.no} className="bilet-item">
                    <div>
                      <div className="bi-no">{b.no}</div>
                      <div className="bi-tur">{b.tur}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!b.kullanildi && (
                        <input
                          type="checkbox"
                          className="bi-cb"
                          checked={b.checked}
                          onChange={() => toggleBiletCheck(b.no)}
                        />
                      )}
                      <span className={`bi-status ${b.kullanildi ? 'used' : 'ok'}`}>
                        {b.kullanildi ? 'Kullanıldı' : 'Bekliyor'}
                      </span>
                    </div>
                  </div>
                ))}

                {resultSheet.showGiris && (
                  <button className="giris-btn" onClick={girisVer}>
                    ✓ Giriş Ver
                  </button>
                )}
                <button className="kapat-btn" onClick={closeSheet}>Kapat</button>
              </>
            )}
          </div>
        </div>

        {/* ── Liste Sheet ── */}
        <div
          className={`overlay${sheetType === 'liste' ? ' open' : ''}`}
          onClick={e => { if (e.target === e.currentTarget) setSheetType('none'); }}
        >
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="liste-title">Seans {selectedSeans}</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{selectedGun}</div>
            <div className="liste-ozet">
              <div className="liste-ozet-label">Giriş Yapan Kişi Sayısı</div>
              <div className="liste-ozet-sayi">
                {listeKisiler.filter(k => k.giris > 0).length} / {listeKisiler.length}
              </div>
            </div>
            {listeKisiler.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#666', fontSize: 14 }}>
                Bu seans için henüz satış yok.
              </div>
            ) : (
              listeKisiler.map((k, i) => (
                <div key={i} className="liste-item">
                  <div>
                    <div className="li-name">{k.musteriAd}</div>
                    <div className="li-detail">{k.giris}/{k.toplam} kişi</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`li-badge ${k.giris > 0 ? 'ok' : 'no'}`}>
                      {k.giris > 0 ? `${k.giris}/${k.toplam} Girdi` : 'Giriş Yapmadı'}
                    </span>
                    {k.girisZamani && (
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4, fontFamily: 'monospace' }}>
                        {k.girisZamani}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <button className="kapat-btn" onClick={() => setSheetType('none')}>Kapat</button>
          </div>
        </div>

        {/* ── Toast ── */}
        {toast && (
          <div className={`scan-toast show ${toast.type}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}
