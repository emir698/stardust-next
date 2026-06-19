/**
 * POST /api/send-ticket-mail
 *
 * Server-side mail gönderimi — Resend ile, her bilet için ayrı PDF eki.
 * Bu route Node.js runtime'da çalışır (jsPDF + qrcode burada sorunsuz çalışır,
 * tarayıcıya ihtiyaç yok).
 *
 * Body:
 * {
 *   to: string;
 *   musteriAd: string;
 *   pnr: string;
 *   tarih: string;        // "29.05.2026"
 *   seans: string;        // "22:30"
 *   gunAdi?: string;       // "Cum"
 *   biletler: Array<{ no: string; tur: string }>;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { buildIndividualTicketPdfs } from '@/lib/server/ticketPdf';
import { buildTicketMailHtml } from '@/lib/server/ticketMailTemplate';

export const runtime = 'nodejs';

interface BiletInput {
  no: string;
  tur: string;
}

interface RequestBody {
  to: string;
  musteriAd: string;
  pnr: string;
  tarih: string;
  seans: string;
  gunAdi?: string;
  biletler: BiletInput[];
}

const FROM_ADDRESS = 'Stardust Ticket <bilet@stardustticket.com>';

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
  }

  const { to, musteriAd, pnr, tarih, seans, gunAdi, biletler } = body;

  if (!to || !musteriAd || !pnr || !tarih || !seans || !Array.isArray(biletler) || biletler.length === 0) {
    return NextResponse.json({ error: 'Eksik alan: to, musteriAd, pnr, tarih, seans, biletler gerekli' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY tanımlı değil (Vercel env)' }, { status: 500 });
  }

  try {
    // ── PDF'leri üret (her bilet için ayrı dosya) ──────────────
    const pdfFiles = await buildIndividualTicketPdfs(
      biletler.map(b => ({
        biletNo: b.no,
        tur: b.tur,
        musteriAd,
        tarih,
        seans,
        pnr,
        gunAdi,
      }))
    );

    const attachments = pdfFiles.map(f => ({
      filename: f.filename,
      content: f.buffer.toString('base64'),
    }));

    const html = buildTicketMailHtml({ musteriAd, pnr });

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: `Sayın ${musteriAd}, Astra Lumina İstanbul biletleriniz oluşturulmuştur`,
      html,
      attachments,
    });

    if (error) {
      console.error('Resend hata:', error);
      return NextResponse.json({ error: error.message ?? 'Mail gönderilemedi' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (err) {
    console.error('send-ticket-mail hata:', err);
    const message = err instanceof Error ? err.message : 'Beklenmeyen hata';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
