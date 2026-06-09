// ─── Kullanıcı ───────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'bilet satis' | 'okutma' | 'management1';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
}

// ─── Bilet Türleri ───────────────────────────────────────────────────────────

export type TicketType = 'tam' | 'cocuk' | 'yabanci' | 'davetli' | 'kurumsal';

export const TICKET_PRICES: Record<TicketType, number> = {
  tam: 1500,
  cocuk: 1200,
  yabanci: 2250,
  davetli: 0,
  kurumsal: 0,
};

export const TICKET_LABELS: Record<TicketType, string> = {
  tam: 'Tam',
  cocuk: 'Çocuk',
  yabanci: 'Yabancı',
  davetli: 'Davetli',
  kurumsal: 'Kurumsal',
};

// ─── Bireysel Bilet ──────────────────────────────────────────────────────────

export interface Bilet {
  no: string;
  tur: TicketType;
  pnr: string;
  seans?: string;
  tarih?: string;
  kullanildi: boolean;
  kullanildiSaat?: string;
  musteriAd?: string;
  kurumsalKod?: string;
}

// ─── PNR Kaydı ───────────────────────────────────────────────────────────────

export interface PNRKayit {
  satisId: string;
  pnr: string;
  musteriAd: string;
  musteriTel: string;
  musteriMail: string;
  tarih: string; // DD.MM.YYYY
  seans: string; // HH:MM
  tam: number;
  cocuk: number;
  yabanci: number;
  davetli?: number;
  kurumsal?: number;
  toplam: number;
  biletler: Bilet[];
  kullanildi: boolean;
  kullanildiSaat?: string;
}

// ─── Satış Kaydı ─────────────────────────────────────────────────────────────

export interface Satis {
  id: string;
  pnr: string;
  musteriAd: string;
  musteriTel: string;
  musteriMail: string;
  tarih: string;
  seans: string;
  tam: number;
  cocuk: number;
  yabanci: number;
  davetli?: number;
  kurumsal?: number;
  toplam: number;
  biletler: Bilet[];
  indirimKodu?: string;
  indirimOran?: number;
  satisZamani: string;
  kasiyerId: string;
  kasiyerAd: string;
  vitoSurucu?: string;
  vitoPlaka?: string;
  vitoKomisyon?: number;
  vitoOdendi?: boolean;
}

// ─── Bilet Miktarları ────────────────────────────────────────────────────────

export interface TicketQty {
  tam: number;
  cocuk: number;
  yabanci: number;
  davetli: number;
  kurumsal: number;
}

// ─── Seans ───────────────────────────────────────────────────────────────────

export interface SeansInfo {
  saat: string;
  satilan: number;
  kapasite?: number;
}

// ─── İndirim Kodu ────────────────────────────────────────────────────────────

export interface IndirimKodu {
  _key: string;
  code: string;
  group?: string;
  batchKey?: string;
  indirim: number; // yüzde olarak: 10, 20, 100 vb.
  status: 'aktif' | 'deaktif';
  kullanan?: string;
  date?: string;
}

// ─── Kod Grubu (Batch) ───────────────────────────────────────────────────────

export interface CodeBatch {
  _key: string;
  name: string;
  indirim: number;
  codes: string[];
  createdAt: string;
}

// ─── Vito Sürücü ─────────────────────────────────────────────────────────────

export interface VitoDriver {
  _key: string;
  ad: string;
  plaka: string;
  tel?: string;
  komisyonOran: number; // yüzde: 20 vb.
  aktif: boolean;
}

// ─── Kurumsal Paket ──────────────────────────────────────────────────────────

export interface KurumsalPaket {
  _key: string;
  firma: string;
  baslangic: string; // DD.MM.YYYY
  bitis: string;     // DD.MM.YYYY
  adet: number;
  kullanilanAdet: number;
  prefix: string;
  createdAt: string;
}

// ─── Dashboard KPI ───────────────────────────────────────────────────────────

export interface DashboardKPI {
  toplamBilet: number;
  toplamGelir: number;
  girisYapan: number;
  aktifKod: number;
}

// ─── Seans Zamanlaması ───────────────────────────────────────────────────────

export const OZEL_SAATLER: Record<string, string[]> = {
  '19.05.2026': ['20:45', '21:00', '21:30', '22:00'],
  '28.05.2026': ['20:45', '21:00', '21:30', '22:00', '22:30'],
};

// 5=Cuma, 6=Cumartesi, 0=Pazar
export const HAFTALIK_SAATLER: Record<number, string[]> = {
  5: ['20:45', '21:00', '21:30', '22:00', '22:30'],
  6: ['20:45', '21:00', '21:30', '22:00', '22:30'],
  0: ['20:45', '21:00', '21:30', '22:00'],
};
