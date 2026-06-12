export interface BiletMailData {
  no: string;
  tur: string;
  qrDataUrl: string; // base64 data URL
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
  const toplamStr = toplam.toLocaleString('tr-TR') + ' TL';

  const TUR_LABEL: Record<string, string> = {
    tam: 'Tam', cocuk: 'Cocuk', yabanci: 'Yabanci', davetli: 'Davetli', kurumsal: 'Kurumsal',
  };
  const TUR_COLOR: Record<string, string> = {
    tam: '#2e7d32', cocuk: '#1565c0', yabanci: '#e65100', davetli: '#2e7d32', kurumsal: '#a855f7',
  };
  const TUR_BG: Record<string, string> = {
    tam: '#e8f5e9', cocuk: '#e3f2fd', yabanci: '#fff3e0', davetli: '#e8f5e9', kurumsal: 'rgba(168,85,247,.1)',
  };

  // Her bilet için QR kodlu HTML kartı oluştur
  const biletKartlari = (biletler || []).map(b => {
    const label = TUR_LABEL[b.tur] ?? b.tur;
    const color = TUR_COLOR[b.tur] ?? '#333';
    const bg = TUR_BG[b.tur] ?? '#f5f5f5';
    return '<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;font-family:sans-serif;">'
      + '<div style="font-size:10px;letter-spacing:3px;color:#888;margin-bottom:6px;">✦ STARDUST ✦</div>'
      + '<div style="font-size:18px;font-weight:700;margin-bottom:4px;">Astra Lumina Istanbul</div>'
      + '<div style="font-size:12px;color:#666;margin-bottom:12px;">' + tarih + ' &mdash; Seans ' + seans + '</div>'
      + '<div style="font-size:13px;font-weight:600;margin-bottom:16px;">' + musteriAd + '</div>'
      + '<img src="' + b.qrDataUrl + '" width="160" height="160" style="display:block;margin:0 auto 12px;" alt="QR" />'
      + '<div style="display:inline-block;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:600;background:' + bg + ';color:' + color + ';">' + label + '</div>'
      + '<div style="font-size:9px;color:#aaa;margin-top:8px;font-family:monospace;">' + b.no + '</div>'
      + '</div>';
  }).join('');

  const biletHtml = biletKartlari || (
    '<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px;">'
    + '<tr><td style="padding:8px;color:#888;">PNR</td><td style="padding:8px;font-weight:bold;color:#c9a84c;">' + pnr + '</td></tr>'
    + '<tr style="background:#f9f9f9"><td style="padding:8px;color:#888;">Bilet Sayisi</td><td style="padding:8px;">' + toplamBilet + ' kisi</td></tr>'
    + '<tr><td style="padding:8px;color:#888;">Toplam</td><td style="padding:8px;font-weight:bold;color:#2e7d32;">' + toplamStr + '</td></tr>'
    + '</table>'
  );

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
        toplam_ucret: toplamStr,
        bilet_html: biletHtml,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('EmailJS hata: ' + response.status + ' ' + errText);
  }
}
