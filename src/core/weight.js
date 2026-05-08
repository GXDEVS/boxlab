// Real vs cubic weight using the standard CSSBuy ÷5000 divisor.
// chargedKg = max(real, cubic). chargedSource flags which one prevails.
export function calcWeights(items, box) {
  const realWeightG = items.reduce((s, it) => s + (it.weight || 0), 0);
  const realWeightKg = realWeightG / 1000;
  const volumeCm3 = box.length * box.width * box.height;
  const cubicWeightKg = volumeCm3 / 5000;
  const chargedKg = Math.max(realWeightKg, cubicWeightKg);
  const chargedSource = realWeightKg >= cubicWeightKg ? 'real' : 'cubic';
  return {
    realWeightG, realWeightKg,
    volumeCm3, cubicWeightKg,
    chargedKg, chargedSource,
  };
}
