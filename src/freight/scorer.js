const W = { insurance: 0.45, price: 0.20, type: 0.20, headroom: 0.15 };
const PRICE_SCORE = { cheap: 1.0, medium: 0.66, expensive: 0.33 };
const TYPE_SCORE = { express: 1.0, ems: 0.85, battery: 0.7, sal: 0.55, seamail: 0.4 };

export function scoreFreights({ chargedKg, commodityAttrs = [], country = 'BR' }, freights) {
  const compatible = [];
  const incompatible = [];

  for (const f of freights) {
    const reasons = [];
    if (chargedKg < f.weightRange.min || chargedKg > f.weightRange.max) {
      reasons.push(`Peso fora da faixa (${f.weightRange.min}-${f.weightRange.max}kg, você tem ${chargedKg.toFixed(2)}kg)`);
    }
    if (!f.destinations.includes(country)) {
      reasons.push(`Não atende ${country}`);
    }
    const blocked = (f.restrictions?.forbidden ?? []).filter(x => commodityAttrs.includes(x));
    if (blocked.length) {
      reasons.push(`Não aceita: ${blocked.join(', ')}`);
    }

    if (reasons.length) {
      incompatible.push({ freight: f, reasons });
    } else {
      const breakdown = {
        insurance: W.insurance * (f.insuranceMax / 5000),
        price:     W.price     * (PRICE_SCORE[f.priceTier] ?? 0.5),
        type:      W.type      * (TYPE_SCORE[f.type] ?? 0.5),
        headroom:  W.headroom  * headroomScore(chargedKg, f.weightRange),
      };
      const score = (breakdown.insurance + breakdown.price + breakdown.type + breakdown.headroom) * 100;
      compatible.push({ freight: f, score, breakdown });
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
