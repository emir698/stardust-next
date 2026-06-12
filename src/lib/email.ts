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
  const biletHtml = `
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <tr><td style="padding:8px;color:#888;">PNR</td><td style="padding:8px;font-weight:bold;color:#c9a84c;">${pnr}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;color:#888;">Ad Soyad</td><td style="padding:8px;">${musteriAd}</td></tr>
      <tr><td style="padding:8px;color:#888;">Tarih</td><td style="padding:8px;">${tarih}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;color:#888;">Seans</td><td style="padding:8px;">${seans}</td></tr>
      <tr><td style="padding:8px;color:#888;">Bilet Sayisi</td><td style="padding:8px;">${toplamBilet} kisi</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;color:#888;">Toplam</td><td style="padding:8px;font-weight:bold;color:#2e7d32;">${toplam.toLocaleString('tr-TR')} TL</td></tr>
    </table>
  `;

  // EmailJS fetch API ile gonder — browser paketi yerine direkt API
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
      template_id: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
      user_id: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: to,
        to_name: musteriAd,
        pnr,
        tarih,
        seans,
        toplam_bilet: toplamBilet,
        toplam_ucret: toplam.toLocaleString('tr-TR') + ' TL',
        bilet_html: biletHtml,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EmailJS hata: ${response.status} ${text}`);
  }

  return response;
}
