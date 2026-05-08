export function calcWeights(items, box) {
  const realWeightG = items.reduce((s, it) => s + (it.weight || 0), 0);
  const realWeightKg = realWeightG / 1000;
  const volumeCm3 = box.length * box.width * box.height;
  return { realWeightG, realWeightKg, volumeCm3 };
}

export function chargedKgFor(weights, freight) {
  if (freight.volumetricDivisor == null) return weights.realWeightKg;
  const cubic = weights.volumeCm3 / freight.volumetricDivisor;
  return Math.max(weights.realWeightKg, cubic);
}
