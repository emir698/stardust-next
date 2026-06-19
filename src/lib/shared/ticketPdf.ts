/**
 * Ortak bilet PDF üretimi — hem tarayıcıda (ZIP indirme) hem
 * server'da (mail eki) çalışır. Buffer/ArrayBuffer kullanımı yok,
 * sadece jsPDF doc objesi döner — çağıran taraf çıktıyı istediği
 * formata (Blob, ArrayBuffer, base64) kendisi çevirir.
 *
 * Tema: beyaz zemin, monokrom (siyah/beyaz/gri), ticket-stub mark.
 * Yıldız / spark YOK.
 *
 * Font: Noto Sans (gömülü, base64) — Helvetica/Courier yerine.
 * jsPDF'in standart fontları (helvetica, courier, times) WinAnsi/Latin-1
 * kodlamasını kullanır ve Türkçe karakterleri (ı, ş, ğ, ç, ö, ü, İ)
 * doğru render edemez. Noto Sans tam Unicode desteği sağlar.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { NotoSansRegularBase64 } from './fonts/NotoSansRegular';
import { NotoSansBoldBase64 } from './fonts/NotoSansBold';

export interface TicketPdfInput {
  biletNo: string;
  tur: string;        // 'tam' | 'cocuk' | 'yabanci' | 'davetli' | 'kurumsal'
  musteriAd: string;
  tarih: string;       // "29.05.2026"
  seans: string;        // "22:30"
  pnr?: string;
  gunAdi?: string;       // "Cum" — opsiyonel
}

export const TUR_LABEL: Record<string, string> = {
  tam: 'Tam',
  cocuk: 'Çocuk',
  yabanci: 'Yabancı',
  davetli: 'Davetli',
  kurumsal: 'Kurumsal',
};

const INK = { r: 10, g: 10, b: 10 };
const MUTED = { r: 140, g: 140, b: 140 };
const BORDER = { r: 225, g: 225, b: 225 };
const CHIP_BG = { r: 244, g: 244, b: 244 };

let fontsRegistered = false;

/**
 * Noto Sans fontunu jsPDF'in VFS (virtual file system)'ine kaydeder.
 * Her yeni doc instance'ı için çağrılması gerekir çünkü font, document'a
 * özel olarak addFont ile bağlanır.
 */
function registerFonts(doc: jsPDF) {
  doc.addFileToVFS('NotoSans-Regular.ttf', NotoSansRegularBase64);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', NotoSansBoldBase64);
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  fontsRegistered = true;
}

function drawTicketMark(doc: jsPDF, cx: number, cy: number, h: number) {
  const ratio = 52 / 60;
  const w = h * ratio;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;

  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setFillColor(INK.r, INK.g, INK.b);

  const bw = w * 0.79;
  const bh = h;
  const bx = x0 + w * 0.02;
  const by = y0;
  const rx = w * 0.16;

  doc.roundedRect(bx, by, bw, bh, rx, rx, 'F');

  const notchR = h * 0.167;
  const notchCx = bx + bw;
  const notchCy = y0 + h / 2;
  doc.setFillColor(255, 255, 255);
  doc.circle(notchCx, notchCy, notchR, 'F');

  const winInsetX = w * 0.10;
  const winInsetY = h * 0.083;
  const wx = bx + winInsetX;
  const wy = by + winInsetY;
  const ww = bw - winInsetX * 1.7;
  const wh = bh - winInsetY * 2;
  doc.roundedRect(wx, wy, ww, wh, rx * 0.5, rx * 0.5, 'F');
}

export async function drawTicketPage(doc: jsPDF, pageIdx: number, t: TicketPdfInput) {
  if (pageIdx > 0) doc.addPage();

  // Font kaydı her yeni doc instance için bir kez yapılmalı.
  // pageIdx===0 yeni sayfa demek değil, yeni doc demek olabilir; emniyetle
  // her çağrıda kontrol ediyoruz (addFont tekrar çağrılırsa sorun olmaz).
  registerFonts(doc);

  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');

  let y = 16;
  drawTicketMark(doc, w / 2 - 13, y, 7);
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('STARDUST', w / 2 + 3, y + 2.2, { align: 'left' });

  y += 10;
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('Astra Lumina İstanbul', w / 2, y, { align: 'center' });

  y += 6;
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
  doc.setLineWidth(0.3);
  doc.line(10, y, w - 10, y);

  y += 9;
  const tarihStr = t.gunAdi ? `${t.gunAdi}, ${t.tarih}` : t.tarih;
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`${tarihStr} · Seans ${t.seans}`, w / 2, y, { align: 'center' });

  y += 8;
  const qrDataUrl = await QRCode.toDataURL(t.biletNo, {
    width: 300,
    margin: 1,
    color: { dark: '#0a0a0a', light: '#ffffff' },
  });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrSize = Math.min(w * 0.62, 62);
  doc.addImage(qrBase64, 'PNG', (w - qrSize) / 2, y, qrSize, qrSize);
  y += qrSize + 7;

  const label = TUR_LABEL[t.tur] ?? t.tur;
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(9);
  const chipPadX = 5;
  const chipTextW = doc.getTextWidth(label);
  const chipW = chipTextW + chipPadX * 2;
  const chipH = 7;
  const chipX = (w - chipW) / 2;
  doc.setFillColor(CHIP_BG.r, CHIP_BG.g, CHIP_BG.b);
  doc.roundedRect(chipX, y, chipW, chipH, chipH / 2, chipH / 2, 'F');
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(label, w / 2, y + chipH / 2 + 1.4, { align: 'center' });
  y += chipH + 6;

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(t.biletNo, w / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
  doc.setLineWidth(0.3);
  doc.line(10, y, w - 10, y);
  y += 7;

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(40, 40, 40);
  const kurallarLines = doc.splitTextToSize(
    'Kurallar: Karekodun taranmasıyla etkinliğe sadece 1 (bir) kişi girebilir. Bu biletin kopyalanması ya da satılması etkinliğe giriş hakkınızı engeller.',
    w - 20
  );
  doc.text(kurallarLines, 10, y);
  y += kurallarLines.length * 3.3 + 3;

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const rulesEn = doc.splitTextToSize(
    'Rules: The QR code only allows one entry per scan. Unauthorised duplication or sale of this ticket may prevent your admittance to the event.',
    w - 20
  );
  doc.text(rulesEn, 10, y);
  y += rulesEn.length * 3.1 + 6;

  const boxY = y;
  const boxH = 14;
  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setLineWidth(0.4);
  doc.roundedRect(10, boxY, w - 20, boxH, 2, 2, 'S');
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('PDF biletinizi yanınızda veya mobil cihazınızda bulundurmayı unutmayın!', w / 2, boxY + 5.5, { align: 'center' });
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('PDF biletinizdeki karekod kapıda okutulacaktır.', w / 2, boxY + 10.5, { align: 'center' });
}

export function newTicketDoc(): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: [90, 150] });
  return doc;
}
