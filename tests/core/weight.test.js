import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcWeights } from '../../src/core/weight.js';

describe('calcWeights', () => {
  it('sums item weights in grams and returns kg too', () => {
    const r = calcWeights([{ weight: 200 }, { weight: 150 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.realWeightG, 350);
    assert.equal(r.realWeightKg, 0.35);
  });

  it('cubic = volume / 5000 (kg)', () => {
    const r = calcWeights([], { length: 16, width: 10, height: 7 });
    assert.equal(r.volumeCm3, 1120);
    assert.equal(r.cubicWeightKg, 1120 / 5000);
  });

  it('chargedKg = max(real, cubic) and source flag is real when real wins', () => {
    const r = calcWeights([{ weight: 350 }], { length: 16, width: 10, height: 7 });
    // real 0.35, cubic 0.224 -> real wins
    assert.equal(r.chargedKg, 0.35);
    assert.equal(r.chargedSource, 'real');
  });

  it('source flag is cubic when cubic wins', () => {
    const r = calcWeights([{ weight: 100 }], { length: 50, width: 50, height: 50 });
    // real 0.1, cubic 25 -> cubic wins
    assert.equal(r.chargedSource, 'cubic');
  });

  it('handles empty items and zero box', () => {
    const r = calcWeights([], { length: 0, width: 0, height: 0 });
    assert.equal(r.realWeightG, 0);
    assert.equal(r.cubicWeightKg, 0);
    assert.equal(r.chargedKg, 0);
  });

  it('treats missing weight as zero', () => {
    const r = calcWeights([{ weight: undefined }, { weight: 100 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.realWeightG, 100);
  });
});
