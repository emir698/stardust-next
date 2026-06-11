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
    },
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
  );
}
