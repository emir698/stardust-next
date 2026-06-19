/**
 * Mail gönderim istemcisi.
 *
 * Resend tabanlı /api/send-ticket-mail route'unu çağırır.
 * PDF üretimi ve gerçek mail gönderimi server-side'da yapılır.
 * Bu dosya sadece client'tan o route'a istek atan ince bir katmandır.
 */

export interface BiletMailData {
  no: string;
  tur: string;
  qrDataUrl?: string; // artık kullanılmıyor — PDF server'da QR'ı kendisi üretir
}

export async function sendBiletMail(
  to: string,
  pnr: string,
  musteriAd: string,
  tarih: string,
  seans: string,
  toplamBilet: number,
  toplam: number,
  biletler?: BiletMailData[]
): Promise<void> {
  if (!biletler || biletler.length === 0) {
    throw new Error('Mail göndermek için en az 1 bilet gerekli');
  }

  const response = await fetch('/api/send-ticket-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      musteriAd,
      pnr,
      tarih,
      seans,
      biletler: biletler.map(b => ({ no: b.no, tur: b.tur })),
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error ?? `Mail gönderilemedi (${response.status})`);
  }
}
