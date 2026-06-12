import emailjs from '@emailjs/browser';

export async function sendBiletMail(
  to: string,
  pnr: string,
  musteriAd: string,
  tarih: string,
  seans: string,
  toplamBilet: number,
  toplam: number
) {
  // Template'deki {{{bilet_html}}} için basit HTML tablosu oluştur
  const biletHtml = `
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <tr><td style="padding:8px;color:#888;">PNR</td><td style="padding:8px;font-weight:bold;color:#c9a84c;">${pnr}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;color:#888;">Ad Soyad</td><td style="padding:8px;">${musteriAd}</td></tr>
      <tr><td style="padding:8px;color:#888;">Tarih</td><td style="padding:8px;">${tarih}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;color:#888;">Seans</td><td style="padding:8px;">${seans}</td></tr>
      <tr><td style="padding:8px;color:#888;">Bilet Sayısı</td><td style="padding:8px;">${toplamBilet} kişi</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;color:#888;">Toplam</td><td style="padding:8px;font-weight:bold;color:#2e7d32;">${toplam.toLocaleString('tr-TR')}₺</td></tr>
    </table>
    <p style="margin-top:16px;font-size:12px;color:#888;">Kapıda QR kodunuzu göstermeniz yeterlidir.</p>
  `;

  return emailjs.send(
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
    {
      to_email: to,
      to_name: musteriAd,
      pnr,
      tarih,
      seans,
      toplam_bilet: toplamBilet,
      toplam_ucret: toplam.toLocaleString('tr-TR') + '₺',
      bilet_html: biletHtml,
    },
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
  );
}
