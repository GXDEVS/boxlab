import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcWeights, chargedKgFor } from '../../src/freight/weight.js';

describe('calcWeights', () => {
  it('returns realWeightG, realWeightKg, volumeCm3', () => {
    const r = calcWeights([{ weight: 200 }, { weight: 150 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.realWeightG, 350);
    assert.equal(r.realWeightKg, 0.35);
    assert.equal(r.volumeCm3, 1000);
  });

  it('does NOT return chargedKg/cubicWeightKg anymore (per-freight now)', () => {
    const r = calcWeights([{ weight: 200 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.chargedKg, undefined);
    assert.equal(r.cubicWeightKg, undefined);
    assert.equal(r.chargedSource, undefined);
  });

  it('handles empty items and zero box', () => {
    const r = calcWeights([], { length: 0, width: 0, height: 0 });
    assert.equal(r.realWeightG, 0);
    assert.equal(r.realWeightKg, 0);
    assert.equal(r.volumeCm3, 0);
  });

  it('treats missing weight as zero', () => {
    const r = calcWeights([{ weight: undefined }, { weight: 100 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.realWeightG, 100);
  });
});

describe('chargedKgFor', () => {
  const W = (real, vol) => ({ realWeightKg: real, volumeCm3: vol });

  it('pure-weight freight (divisor null) ignores volume', () => {
    const f = { volumetricDivisor: null };
    assert.equal(chargedKgFor(W(0.2, 50000), f), 0.2);
  });

  it('returns max(real, volumeCm3 / divisor)', () => {
    const f5 = { volumetricDivisor: 5000 };
    assert.equal(chargedKgFor(W(0.35, 1120), f5), 0.35);    // real prevails
    assert.equal(chargedKgFor(W(0.5, 5000), f5), 1.0);      // cubic prevails
  });

  it('divisor 6000 produces smaller cubic than 5000', () => {
    const w = W(0.1, 6000);
    const c5 = chargedKgFor(w, { volumetricDivisor: 5000 });
    const c6 = chargedKgFor(w, { volumetricDivisor: 6000 });
    assert.ok(c5 > c6, `c5=${c5}, c6=${c6}`);
    assert.equal(c5, 6000 / 5000);
    assert.equal(c6, 6000 / 6000);
  });

  it('returns 0 when both real and volume are 0', () => {
    assert.equal(chargedKgFor(W(0, 0), { volumetricDivisor: 5000 }), 0);
  });
});
