/**
 * Mail HTML şablonu — yeni Stardust kimliği.
 * Beyaz zemin, monokrom header (siyah/#0a0a0a), ticket-stub mark.
 * Yıldız / spark / ışın YOK.
 */

export interface TicketMailInput {
  musteriAd: string;
  pnr: string;
  bilgilendirme?: string; // opsiyonel ek not
}

/**
 * Ticket-stub mark'ı inline SVG olarak — email istemcilerinin çoğu
 * (Gmail, Outlook web, Apple Mail) inline SVG'yi render eder.
 * Güvenli taraf için aynı zamanda PNG fallback de eklenebilir, ama
 * şimdilik SVG yeterli çünkü sade geometrik bir şekil.
 */
function ticketMarkSvg(color: string, size: number): string {
  return `<svg width="${Math.round(size * 0.867)}" height="${size}" viewBox="0 0 52 60" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <path fill-rule="evenodd" clip-rule="evenodd" fill="${color}" d="M8.5 1 H33.5 Q41 1 41 8.5 V20 A10 10 0 0 0 41 40 V51.5 Q41 59 33.5 59 H8.5 Q1 59 1 51.5 V8.5 Q1 1 8.5 1 Z M7 16 Q7 11 12 11 H27 Q33 11 33 16 V44 Q33 49 28 49 H12 Q7 49 7 44 Z" />
  </svg>`;
}

export function buildTicketMailHtml(input: TicketMailInput): string {
  const { musteriAd, pnr } = input;

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f4;padding:32px 16px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e8e8;">

    <!-- Header -->
    <div style="background:#0a0a0a;padding:28px 24px;text-align:center;">
      <div style="display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
        ${ticketMarkSvg('#ededed', 18)}
        <span style="color:#ededed;font-size:13px;font-weight:700;letter-spacing:0.22em;font-family:ui-monospace,'SF Mono',Menlo,monospace;">STARDUST</span>
      </div>
      <div style="color:#ffffff;font-size:17px;font-weight:600;margin-top:8px;">Astra Lumina İstanbul</div>
    </div>

    <!-- Body -->
    <div style="padding:32px 28px;">
      <p style="color:#1a1a1a;font-size:15px;margin:0 0 18px;line-height:1.5;">
        Merhaba <strong>${escapeHtml(musteriAd)}</strong>,
      </p>
      <p style="color:#444444;font-size:14px;line-height:1.7;margin:0 0 12px;">
        Etkinlik biletiniz ekte PDF olarak yer almaktadır.
      </p>
      <p style="color:#444444;font-size:14px;line-height:1.7;margin:0 0 12px;">
        Seans saatinizden <strong>30 dakika önce</strong> alanda bulunmanız gerekmektedir.
      </p>
      <p style="color:#444444;font-size:14px;line-height:1.7;margin:0 0 12px;">
        Seans saatinin kaçırılması durumunda <strong>ücret iadesi yapılmaz.</strong>
      </p>
      <p style="color:#444444;font-size:14px;line-height:1.7;margin:0;">
        Girişlerde biletinizin QR kodunu okutmanız yeterli olacaktır.
      </p>

      <div style="margin-top:24px;padding-top:18px;border-top:1px solid #eeeeee;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#888888;">
          <span>PNR</span>
          <span style="font-family:ui-monospace,monospace;color:#1a1a1a;font-weight:600;">${escapeHtml(pnr)}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:16px 28px;border-top:1px solid #eeeeee;text-align:center;">
      <p style="color:#999999;font-size:11px;margin:0;letter-spacing:0.02em;">Astra Lumina İstanbul · Stardust Ticket</p>
    </div>

  </div>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
