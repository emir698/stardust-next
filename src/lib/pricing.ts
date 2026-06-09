import { TICKET_PRICES } from '@/types';

const AILE_PAKETI = 3900; // 2T+1C veya 1T+2C

export interface PriceResult {
  gelir: number;
  aile2t1c: number; // 2 Tam + 1 Çocuk paketi adedi
  aile1t2c: number; // 1 Tam + 2 Çocuk paketi adedi
  kalanTam: number;
  kalanCocuk: number;
}

export function hesaplaFiyat(tam: number, cocuk: number, yabanci: number): PriceResult {
  let bestGelir = Infinity;
  let bestA2 = 0, bestA1 = 0, bestKT = 0, bestKC = 0;

  for (let a2 = 0; a2 <= Math.floor(tam / 2) && a2 <= cocuk; a2++) {
    const kT2 = tam - a2 * 2;
    const kC2 = cocuk - a2;
    for (let a1 = 0; a1 <= kT2 && a1 <= Math.floor(kC2 / 2); a1++) {
      const kt = kT2 - a1;
      const kc = kC2 - a1 * 2;
      const g = (a2 + a1) * AILE_PAKETI +
        kt * TICKET_PRICES.tam +
        kc * TICKET_PRICES.cocuk +
        yabanci * TICKET_PRICES.yabanci;
      if (g < bestGelir) {
        bestGelir = g;
        bestA2 = a2; bestA1 = a1; bestKT = kt; bestKC = kc;
      }
    }
  }

  return { gelir: bestGelir, aile2t1c: bestA2, aile1t2c: bestA1, kalanTam: bestKT, kalanCocuk: bestKC };
}

export function hesaplaSonToplam(
  tam: number, cocuk: number, yabanci: number,
  indirimOrani: number
): { sonToplam: number; price: PriceResult } {
  const price = hesaplaFiyat(tam, cocuk, yabanci);
  const araGelir = price.gelir;
  const indirimTutar = indirimOrani > 0 ? Math.round(araGelir * indirimOrani) : 0;
  return { sonToplam: araGelir - indirimTutar, price };
}
