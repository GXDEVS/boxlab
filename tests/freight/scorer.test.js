import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFreights } from '../../src/freight/scorer.js';

const F = (over) => ({
  id: 'x', name: 'X',
  weightRange: { min: 0, max: 30 },
  insuranceMax: 3000,
  type: 'express',
  priceTier: 'medium',
  destinations: ['BR'],
  restrictions: { forbidden: [] },
  volumetricDivisor: 5000,
  pureWeight: false,
  transitDays: { min: 15, max: 30 },
  ...over,
});

const W = (real = 0.5, volume = 1500) => ({ realWeightKg: real, volumeCm3: volume });

describe('scoreFreights', () => {
  it('weight gate uses chargedKgFor per freight (pure-weight passes when real fits)', () => {
    const pure = F({ id: 'pure', volumetricDivisor: null, pureWeight: true });
    const r = scoreFreights({ weights: W(0.5, 100000), commodityAttrs: [] }, [pure]);
    assert.equal(r.compatible.length, 1);
  });

  it('weight gate fails for cubed freight when volumetric weight exceeds range', () => {
    const cubed = F({ id: 'cubed', weightRange: { min: 0, max: 3 } });
    const r = scoreFreights({ weights: W(0.5, 100000), commodityAttrs: [] }, [cubed]);
    assert.equal(r.compatible.length, 0);
    assert.equal(r.incompatible.length, 1);
    assert.match(r.incompatible[0].reasons[0], /Peso/);
  });

  it('forbidden commodity reasons are line-per-reason (not joined)', () => {
    const f = F({ restrictions: { forbidden: ['battery', 'liquid'] } });
    const r = scoreFreights({ weights: W(), commodityAttrs: ['battery', 'liquid'] }, [f]);
    assert.equal(r.incompatible.length, 1);
    assert.equal(r.incompatible[0].reasons.length, 2);
    assert.match(r.incompatible[0].reasons[0], /Battery/i);
    assert.match(r.incompatible[0].reasons[1], /Liquid/i);
  });

  it('score breakdown sums to score / 100 (now with transit)', () => {
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [F()]);
    const b = r.compatible[0].breakdown;
    const total = b.insurance + b.price + b.type + b.headroom + b.transit;
    assert.ok(Math.abs(total * 100 - r.compatible[0].score) < 0.001);
  });

  it('breakdown weights sum to 1.0 — full-score freight scores ~100', () => {
    const fullScore = F({
      insuranceMax: 5000,
      priceTier: 'cheap',
      type: 'express',
      transitDays: { min: 0, max: 0 },
      weightRange: { min: 0, max: 1 },
    });
    const r = scoreFreights({ weights: W(0.5, 100), commodityAttrs: [] }, [fullScore]);
    assert.ok(Math.abs(r.compatible[0].score - 100) < 0.5,
      `expected ~100, got ${r.compatible[0].score}`);
  });

  it('faster transit produces higher transit subscore', () => {
    const fast = F({ id: 'fast', transitDays: { min: 5, max: 10 } });
    const slow = F({ id: 'slow', transitDays: { min: 50, max: 60 } });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [fast, slow]);
    const fastB = r.compatible.find(x => x.freight.id === 'fast').breakdown.transit;
    const slowB = r.compatible.find(x => x.freight.id === 'slow').breakdown.transit;
    assert.ok(fastB > slowB, `fast=${fastB} slow=${slowB}`);
  });

  it('returns recommended=null when nothing compatible', () => {
    const r = scoreFreights({ weights: W(50, 1000), commodityAttrs: [] },
                            [F({ weightRange: { min: 0, max: 1 } })]);
    assert.equal(r.recommended, null);
  });

  it('compatible list ordered by score desc', () => {
    const list = [
      F({ id: 'lowins', insuranceMax: 1000 }),
      F({ id: 'highins', insuranceMax: 5000 }),
    ];
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, list);
    assert.equal(r.compatible[0].freight.id, 'highins');
  });

  it('exposes chargedKg per scored item', () => {
    const cubed = F({ volumetricDivisor: 5000 });
    const pure  = F({ id: 'pure', volumetricDivisor: null, pureWeight: true });
    const r = scoreFreights({ weights: W(0.5, 5000), commodityAttrs: [] }, [cubed, pure]);
    const cubedScored = r.compatible.find(x => x.freight.id === 'x');
    const pureScored  = r.compatible.find(x => x.freight.id === 'pure');
    assert.equal(cubedScored.chargedKg, 1.0);   // 5000/5000 prevails over 0.5
    assert.equal(pureScored.chargedKg, 0.5);    // real wins
  });

  it('country mismatch produces dedicated reason', () => {
    const r = scoreFreights({ weights: W(), commodityAttrs: [], country: 'US' }, [F()]);
    assert.equal(r.compatible.length, 0);
    assert.match(r.incompatible[0].reasons[0], /US/);
  });
});
