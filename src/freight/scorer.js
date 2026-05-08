import { chargedKgFor } from './weight.js';

const W = { insurance: 0.40, price: 0.20, type: 0.15, headroom: 0.15, transit: 0.10 };
const PRICE_SCORE = { cheap: 1.0, medium: 0.66, expensive: 0.33 };
const TYPE_SCORE  = {
  express: 1.0, ems: 0.85, battery: 0.7, eub: 0.7,
  'duty-free': 0.6, sal: 0.55, seamail: 0.4,
};

const COMMODITY_LABELS = {
  electric: 'Electric', liquid: 'Liquid', knives: 'Knives', powder: 'Powder',
  shoes: 'Shoes', bags: 'Bags', food: 'Food', battery: 'Battery',
  cosmetics: 'Cosmetics', magnetic: 'Magnetic', watch: 'Watch', perfume: 'Perfume',
  seafreight: 'Sea freight', electronics: 'Electronic Products',
};

export function scoreFreights({ weights, commodityAttrs = [], country = 'BR' }, freights) {
  const compatible = [];
  const incompatible = [];

  for (const f of freights) {
    const chargedKg = chargedKgFor(weights, f);
    const reasons = [];

    if (chargedKg < f.weightRange.min || chargedKg > f.weightRange.max) {
      reasons.push(`Peso fora da faixa (${f.weightRange.min}–${f.weightRange.max}kg, você tem ${chargedKg.toFixed(2)}kg)`);
    }
    if (!f.destinations.includes(country)) {
      reasons.push(`Não atende ${country}`);
    }
    for (const k of f.restrictions?.forbidden ?? []) {
      if (commodityAttrs.includes(k)) {
        reasons.push(`Não transporta ${COMMODITY_LABELS[k] ?? k}`);
      }
    }

    if (reasons.length) {
      incompatible.push({ freight: f, reasons, chargedKg });
    } else {
      const breakdown = {
        insurance: W.insurance * Math.min(1, f.insuranceMax / 5000),
        price:     W.price     * (PRICE_SCORE[f.priceTier] ?? 0.5),
        type:      W.type      * (TYPE_SCORE[f.type] ?? 0.5),
        headroom:  W.headroom  * headroomScore(chargedKg, f.weightRange),
        transit:   W.transit   * transitScore(f.transitDays),
      };
      const score = (breakdown.insurance + breakdown.price + breakdown.type + breakdown.headroom + breakdown.transit) * 100;
      compatible.push({ freight: f, score, breakdown, chargedKg });
    }
  }

  compatible.sort((a, b) => b.score - a.score);
  return { recommended: compatible[0] ?? null, compatible, incompatible };
}

function headroomScore(charged, range) {
  const min = range.min, max = range.max;
  if (max === min) return 1;
  const mid = (min + max) / 2;
  const dist = Math.abs(charged - mid);
  return Math.max(0, Math.min(1, 1 - 2 * dist / (max - min)));
}

function transitScore(transitDays) {
  if (!transitDays) return 0.5;
  const avg = (transitDays.min + transitDays.max) / 2;
  return Math.max(0, Math.min(1, 1 - avg / 60));
}
