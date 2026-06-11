import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as https from 'https';

admin.initializeApp();

const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';

function sendSlack(message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text: message });
    const url = new URL(SLACK_WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, () => resolve());
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function pad(n: number): string { return n < 10 ? '0' + n : String(n); }
function todayStr(): string {
  const now = new Date();
  return pad(now.getDate()) + '.' + pad(now.getMonth() + 1) + '.' + now.getFullYear();
}
function fmtMoney(n: number): string { return n.toLocaleString('tr-TR') + 'TL'; }

export const gunlukRapor = onSchedule(
  { schedule: '59 23 * * *', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.database();
    const today = todayStr();

    const ticketsSnap = await db.ref('tickets').once('value');
    const tickets = ticketsSnap.val() || {};

    const bugunSatislar = Object.values(tickets).filter(
      (t: any) => t.tarih === today
    ) as any[];

    const toplamBilet = bugunSatislar.reduce(
      (s: number, t: any) => s + (t.tam || 0) + (t.cocuk || 0) + (t.yabanci || 0) + (t.davetli || 0) + (t.kurumsal || 0), 0
    );

    // Satış yoksa rapor gönderme
    if (toplamBilet === 0) {
      console.log('Bugun satis yok, rapor gonderilmedi:', today);
      return;
    }

    const toplamGelir = bugunSatislar.reduce((s: number, t: any) => s + (t.toplam || 0), 0);

    const seanslar: Record<string, number> = {};
    bugunSatislar.forEach((t: any) => {
      if (t.seans) {
        seanslar[t.seans] = (seanslar[t.seans] || 0) +
          (t.tam || 0) + (t.cocuk || 0) + (t.yabanci || 0) + (t.davetli || 0) + (t.kurumsal || 0);
      }
    });

    const seansText = Object.entries(seanslar)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([saat, sayi]) => '  - ' + saat + ' -> ' + sayi + ' kisi')
      .join('\n');

    const codesSnap = await db.ref('codes').once('value');
    const codes = codesSnap.val() || {};
    const kodKullanilan = Object.values(codes).filter(
      (c: any) => c && c.status === 'deaktif' && c.date === today
    ).length;

    const mesaj = '*STARDUST Gunluk Rapor - ' + today + '*\n\n' +
      'Toplam Bilet: *' + toplamBilet + ' kisi*\n' +
      'Toplam Gelir: *' + fmtMoney(toplamGelir) + '*\n' +
      'Bugun Kullanilan Indirim Kodu: *' + kodKullanilan + '*\n\n' +
      'Seans Dagilimi:\n' + seansText;

    await sendSlack(mesaj);
    console.log('Gunluk rapor gonderildi:', today);
  }
);
