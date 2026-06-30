import { OZEL_SAATLER, HAFTALIK_SAATLER } from '@/types';
import type { SeansTakvimi } from '@/lib/db/seans';

// ─── Tarih Formatları ────────────────────────────────────────────────────────

function pad(x: number): string {
  return x < 10 ? '0' + x : String(x);
}

export function todayStr(): string {
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  return pad(n.getDate()) + '.' + pad(n.getMonth() + 1) + '.' + n.getFullYear();
}

/** DD.MM.YYYY → YYYY-MM-DD (HTML date input değeri) */
export function dateToInput(ds: string): string {
  if (!ds) return '';
  const [d, m, y] = ds.split('.');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD → DD.MM.YYYY */
export function inputToDate(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${pad(parseInt(d))}.${pad(parseInt(m))}.${y}`;
}

export function addDays(ds: string, n: number): string {
  const [d, m, y] = ds.split('.');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  date.setDate(date.getDate() + n);
  return pad(date.getDate()) + '.' + pad(date.getMonth() + 1) + '.' + date.getFullYear();
}

export function getDayName(ds: string, short = true): string {
  const [d, m, y] = ds.split('.');
  const names = short
    ? ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
    : ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return names[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()];
}

export function fmtDate(ds: string): string {
  const [d, m, y] = ds.split('.');
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}, ${getDayName(ds, false)}`;
}

export function dateInRange(ds: string, start: string, end: string): boolean {
  const toMs = (s: string) => {
    const [d, m, y] = s.split('.');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
  };
  return toMs(ds) >= toMs(start) && toMs(ds) <= toMs(end);
}

// ─── Para ────────────────────────────────────────────────────────────────────

export function fmtMoney(n: number): string {
  return n.toLocaleString('tr-TR') + '₺';
}

// ─── ID Üretimi ──────────────────────────────────────────────────────────────

export function genID(): string {
  return Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substring(2, 7).toUpperCase();
}

// ─── Seans Saatleri ─────────────────────────────────────────────────────────
// Firebase takvim üzerinden çalışır. takvim henüz yüklenmemişse haftalık kurala fallback yapar.

export function getSaatlerFromTakvim(ds: string, takvim: SeansTakvimi): string[] | null {
  if (ds in takvim) {
    const list = takvim[ds];
    return list.length > 0 ? list : null; // boş dizi = o gün etkinlik yok
  }
  const [d, m, y] = ds.split('.');
  const day = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay();
  return HAFTALIK_SAATLER[day] ?? null;
}

export function isEtkinlikGununuFromTakvim(ds: string, takvim: SeansTakvimi): boolean {
  return getSaatlerFromTakvim(ds, takvim) !== null;
}

// Legacy — OZEL_SAATLER kodda tanımlıyken kullanılan eski versiyon. Yavaş yavaş kaldırılacak.
export function getSaatler(ds: string): string[] | null {
  if (ds in OZEL_SAATLER) {
    const list = OZEL_SAATLER[ds];
    return list.length > 0 ? list : null;
  }
  const [d, m, y] = ds.split('.');
  const day = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay();
  return HAFTALIK_SAATLER[day] ?? null;
}

export function isEtkinlikGunu(ds: string): boolean {
  return getSaatler(ds) !== null;
}

// ─── PNR Üretimi ─────────────────────────────────────────────────────────────

export function genPNR(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pnr = '';
  for (let i = 0; i < 8; i++) {
    pnr += chars[Math.floor(Math.random() * chars.length)];
  }
  return pnr;
}

// ─── Bilet No ────────────────────────────────────────────────────────────────

export function genBiletNo(pnr: string, index: number): string {
  return pnr + '-' + String(index + 1).padStart(2, '0');
}

// ─── cn (className birleştirici) ─────────────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
