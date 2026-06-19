/**
 * Server-side bilet PDF üretimi — ortak çizim mantığını (src/lib/shared/ticketPdf.ts)
 * kullanır, çıktıyı Node Buffer'a çevirir (mail eki için).
 */

import { newTicketDoc, drawTicketPage, type TicketPdfInput } from '@/lib/shared/ticketPdf';

export type { TicketPdfInput };

/**
 * Bir PNR'a ait tüm biletleri tek bir multi-page PDF olarak üretir.
 */
export async function buildTicketsPdf(tickets: TicketPdfInput[]): Promise<Buffer> {
  const doc = newTicketDoc();
  for (let i = 0; i < tickets.length; i++) {
    await drawTicketPage(doc, i, tickets[i]);
  }
  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Her bilet için AYRI bir PDF buffer'ı üretir (ayrı ek olarak göndermek için).
 */
export async function buildIndividualTicketPdfs(
  tickets: TicketPdfInput[]
): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const results: Array<{ filename: string; buffer: Buffer }> = [];
  for (let i = 0; i < tickets.length; i++) {
    const doc = newTicketDoc();
    await drawTicketPage(doc, 0, tickets[i]);
    const buffer = Buffer.from(doc.output('arraybuffer'));
    const filename = `Stardust-Bilet-${i + 1}-${tickets[i].biletNo}.pdf`;
    results.push({ filename, buffer });
  }
  return results;
}
