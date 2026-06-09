'use client';

import { useState, useRef } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { useSatisList } from '@/hooks/useFirebaseData';
import type { Bilet, Satis } from '@/types';

type ScanState = 'idle' | 'valid' | 'invalid';

interface ScanResult {
  state: ScanState;
  icon: string;
  msg: string;
  detail: string;
  biletNo?: string;
  pnrVal?: string;
}

const IDLE: ScanResult = { state: 'idle', icon: '', msg: '', detail: '' };

function pad(n: number) { return String(n).padStart(2, '0'); }
function nowSaat() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function ScanPage() {
  const satisList = useSatisList();
  const [input, setInput]         = useState('');
  const [result, setResult]       = useState<ScanResult>(IDLE);
  const [girisModal, setGirisModal] = useState(false);
  const [pnrData, setPnrData]     = useState<{ pnr: string; musteriAd: string; tarih: string; seans: string; bekleyenler: Array<{ no: string; tur: string; checked: boolean }> } | null>(null);
  const [nameResults, setNameResults] = useState<Satis[]>([]);
  const [nameModal, setNameModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetResult = () => setResult(IDLE);

  const handleSearch = async () => {
    const val = input.trim().toUpperCase();
    if (!val) { toast('Bir değer girin', 'err'); return; }

    // Bilet No (SD- prefix)
    if (val.startsWith('SD-')) {
      const snap = await get(ref(db, `biletler/${val}`));
      const b = snap.val() as (Bilet & { musteriAd?: string; seans?: string; tarih?: string }) | null;
      if (!b) {
        setResult({ state: 'invalid', icon: '✗', msg: 'Geçersiz Bilet', detail: 'Bu bilet numarası sistemde bulunamadı.' });
        return;
      }
      if (b.kullanildi) {
        setResult({ state: 'invalid', icon: '✗', msg: 'Bilet Kullanılmış', detail: `${b.musteriAd ?? ''}\nSeans: ${b.seans ?? ''} · ${b.tur}\nGiriş saati: ${b.kullanildiSaat ?? '—'}` });
        return;
      }
      setResult({ state: 'valid', icon: '🎫', msg: 'Bilet Geçerli', detail: `${b.musteriAd ?? ''}\nPNR: ${b.pnr ?? '—'}\nSeans: ${b.seans ?? ''} · ${b.tur} · ${b.tarih ?? ''}`, biletNo: val });
      return;
    }

    // PNR (PNR- prefix)
    if (val.startsWith('PNR-')) {
      const snap = await get(ref(db, `pnrler/${val}`));
      const p = snap.val() as { musteriAd: string; tarih: string; seans: string; tam: number; cocuk: number; yabanci: number; biletler: string[]; kullanildi: boolean; toplam: number } | null;
      if (!p) {
        setResult({ state: 'invalid', icon: '✗', msg: 'PNR Bulunamadı', detail: 'Bu PNR sistemde kayıtlı değil.' });
        return;
      }
      // Fetch tickets for this PNR
      await openPnrModal(val, p);
      return;
    }

    // Name search
    const q = input.trim().toLowerCase();
    const found = satisList.filter(t => t?.musteriAd?.toLowerCase().includes(q));
    if (!found.length) {
      setResult({ state: 'invalid', icon: '✗', msg: 'Kayıt Bulunamadı', detail: `"${input.trim()}" için kayıt yok.` });
      return;
    }
    if (found.length === 1) {
      const snap = await get(ref(db, `pnrler/${found[0].pnr}`));
      const p = snap.val();
      if (p) { await openPnrModal(found[0].pnr, p); return; }
    }
    setNameResults(found);
    setNameModal(true);
  };

  const openPnrModal = async (pnrVal: string, p: { musteriAd: string; tarih: string; seans: string; tam: number; cocuk: number; yabanci: number; biletler: string[]; kullanildi: boolean }) => {
    const biletNoList: string[] = p.biletler ?? [];
    const results = await Promise.all(biletNoList.map(async bno => {
      const snap = await get(ref(db, `biletler/${bno}`));
      return { no: bno, data: snap.val() as Bilet | null };
    }));
    const bekleyenler = results.filter(b => b.data && !b.data.kullanildi).map(b => ({ no: b.no, tur: b.data!.tur, checked: true }));
    setPnrData({ pnr: pnrVal, musteriAd: p.musteriAd, tarih: p.tarih, seans: p.seans, bekleyenler });
    setGirisModal(true);
    resetResult(); setInput('');
  };

  const handleBiletGiris = async () => {
    if (!result.biletNo) return;
    const saat = nowSaat();
    await update(ref(db, `biletler/${result.biletNo}`), { kullanildi: true, kullanildiSaat: saat });
    toast('Giriş verildi!', 'ok');
    resetResult(); setInput('');
    inputRef.current?.focus();
  };

  const handlePnrGiris = async () => {
    if (!pnrData) return;
    const secili = pnrData.bekleyenler.filter(b => b.checked).map(b => b.no);
    if (!secili.length) { toast('En az 1 bilet seçin', 'err'); return; }
    const saat = nowSaat();
    const upd: Record<string, unknown> = {};
    secili.forEach(bno => { upd[`biletler/${bno}/kullanildi`] = true; upd[`biletler/${bno}/kullanildiSaat`] = saat; });
    if (secili.length === pnrData.bekleyenler.length) { upd[`pnrler/${pnrData.pnr}/kullanildi`] = true; upd[`pnrler/${pnrData.pnr}/kullanildiSaat`] = saat; }
    await update(ref(db), upd);
    toast(`${secili.length} bilete giriş verildi!`, 'ok');
    setGirisModal(false); setPnrData(null);
    inputRef.current?.focus();
  };

  const toggleBilet = (no: string) => {
    if (!pnrData) return;
    setPnrData({ ...pnrData, bekleyenler: pnrData.bekleyenler.map(b => b.no === no ? { ...b, checked: !b.checked } : b) });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Başlık */}
        <div className="text-center mb-8">
          <div className="text-[11px] tracking-[4px] text-mu mb-1">✦ STARDUST ✦</div>
          <div className="text-xl font-semibold">Bilet Tarama</div>
        </div>

        {/* Arama Alanı */}
        <div className="mb-4">
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); resetResult(); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="PNR, SD- no veya ad soyad"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            className="w-full bg-sf border-2 border-ac rounded-xl px-5 py-4 text-tx font-mono text-lg outline-none text-center tracking-widest focus:border-ac-hover placeholder:text-mu placeholder:text-base placeholder:tracking-normal"
          />
        </div>
        <Button variant="accent" onClick={handleSearch} className="w-full mb-6 py-3 text-base font-semibold">Sorgula</Button>

        {/* Sonuç */}
        {result.state !== 'idle' && (
          <div className={`rounded-xl p-6 text-center ${result.state === 'valid' ? 'bg-gd border-2 border-gn' : 'bg-rdd border-2 border-rd'}`}>
            <div className="text-5xl mb-3 leading-none">{result.icon}</div>
            <div className={`text-xl font-bold mb-2 ${result.state === 'valid' ? 'text-gn' : 'text-rd'}`}>{result.msg}</div>
            <div className="text-sm text-mu whitespace-pre-line leading-relaxed">{result.detail}</div>
            {result.state === 'valid' && result.biletNo && (
              <button onClick={handleBiletGiris}
                className="mt-4 bg-gn text-black font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-gn/90 transition-all w-full">
                ✓ Giriş Ver
              </button>
            )}
          </div>
        )}
      </div>

      {/* PNR Giriş Modal */}
      <Modal open={girisModal} onClose={() => setGirisModal(false)} title={pnrData?.musteriAd ?? 'Giriş'}>
        {pnrData && (
          <>
            <div className="text-xs text-mu mb-4">{pnrData.tarih} · Seans {pnrData.seans}</div>
            {pnrData.bekleyenler.length === 0
              ? <div className="text-rd text-sm text-center py-4">Tüm biletler kullanılmış!</div>
              : (
                <>
                  <div className="text-xs text-mu mb-2">Giriş verilecek biletleri seçin ({pnrData.bekleyenler.length} bekliyor):</div>
                  <div className="space-y-2 mb-4">
                    {pnrData.bekleyenler.map(b => (
                      <label key={b.no} className="flex items-center gap-3 bg-sf2 border border-bd rounded-lg px-3 py-2.5 cursor-pointer">
                        <input type="checkbox" checked={b.checked} onChange={() => toggleBilet(b.no)}
                          className="w-4 h-4 accent-ac cursor-pointer" />
                        <span className="font-mono text-xs text-ac flex-1">{b.no} · {b.tur}</span>
                      </label>
                    ))}
                  </div>
                  <ModalActions>
                    <Button variant="ghost" onClick={() => setGirisModal(false)}>İptal</Button>
                    <Button variant="success" onClick={handlePnrGiris}>✓ Giriş Ver</Button>
                  </ModalActions>
                </>
              )
            }
          </>
        )}
      </Modal>

      {/* İsim Seçim Modal */}
      <Modal open={nameModal} onClose={() => setNameModal(false)} title={`${nameResults.length} Kayıt Bulundu`}>
        <div className="space-y-2 mb-4">
          {nameResults.map(t => (
            <button key={t.id} onClick={async () => {
              setNameModal(false);
              const snap = await get(ref(db, `pnrler/${t.pnr}`));
              const p = snap.val();
              if (p) await openPnrModal(t.pnr, p);
              else toast('PNR verisi bulunamadı', 'err');
            }}
              className="w-full text-left bg-sf2 border border-bd rounded-xl px-4 py-3 hover:border-ac transition-all cursor-pointer">
              <div className="font-medium text-sm">{t.musteriAd}</div>
              <div className="text-xs text-mu font-mono mt-0.5">{t.tarih} · {t.seans} · {t.pnr}</div>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setNameModal(false)}>Kapat</Button>
      </Modal>
    </div>
  );
}
