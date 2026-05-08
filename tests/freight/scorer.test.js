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

describe('scoreFreights — gates', () => {
  it('weight gate uses chargedKgFor per freight (pure-weight passes when real fits)', () => {
    const pure = F({ id: 'pure', volumetricDivisor: null, pureWeight: true });
    const r = scoreFreights({ weights: W(0.5, 100000), commodityAttrs: [] }, [pure]);
    assert.equal(r.compatible.length, 1);
  });

  it('weight gate fails for cubed freight when volumetric weight exceeds range', () => {
    const cubed = F({ id: 'cubed', weightRange: { min: 0, max: 3 } });
    const r = scoreFreights({ weights: W(0.5, 100000), commodityAttrs: [] }, [cubed]);
    assert.equal(r.compatible.length, 0);
    assert.match(r.incompatible[0].reasons[0], /Peso/);
  });

  it('forbidden commodity reasons are line-per-reason', () => {
    const f = F({ restrictions: { forbidden: ['battery', 'liquid'] } });
    const r = scoreFreights({ weights: W(), commodityAttrs: ['battery', 'liquid'] }, [f]);
    assert.equal(r.incompatible[0].reasons.length, 2);
    assert.match(r.incompatible[0].reasons[0], /Battery/i);
    assert.match(r.incompatible[0].reasons[1], /Liquid/i);
  });

  it('country mismatch produces dedicated reason', () => {
    const r = scoreFreights({ weights: W(), commodityAttrs: [], country: 'US' }, [F()]);
    assert.match(r.incompatible[0].reasons[0], /US/);
  });
});

describe('scoreFreights — recommendation = cheapest first', () => {
  it('picks cheap over medium even when medium has higher insurance', () => {
    const cheap  = F({ id: 'cheap',  priceTier: 'cheap',  insuranceMax: 1000 });
    const medium = F({ id: 'medium', priceTier: 'medium', insuranceMax: 5000 });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [cheap, medium]);
    assert.equal(r.recommended.freight.id, 'cheap');
  });

  it('picks medium over expensive', () => {
    const exp = F({ id: 'exp', priceTier: 'expensive' });
    const med = F({ id: 'med', priceTier: 'medium' });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [exp, med]);
    assert.equal(r.recommended.freight.id, 'med');
  });

  it('within same priceTier — faster transit wins', () => {
    const slow = F({ id: 'slow', priceTier: 'cheap', transitDays: { min: 50, max: 60 } });
    const fast = F({ id: 'fast', priceTier: 'cheap', transitDays: { min: 5, max: 10 } });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [slow, fast]);
    assert.equal(r.recommended.freight.id, 'fast');
  });

  it('within same tier and transit — bigger insurance wins', () => {
    const same = (id, ins) => F({
      id, priceTier: 'cheap', insuranceMax: ins,
      transitDays: { min: 10, max: 20 },
    });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [same('lo', 1000), same('hi', 5000)]);
    assert.equal(r.recommended.freight.id, 'hi');
  });
});

describe('scoreFreights — low-insurance alert', () => {
  it('flags low insurance when recommended < 3000', () => {
    const cheapWeak = F({ id: 'cw', priceTier: 'cheap', insuranceMax: 2000 });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [cheapWeak]);
    assert.ok(r.lowInsuranceAlert);
    assert.equal(r.lowInsuranceAlert.insuranceMax, 2000);
    assert.equal(r.lowInsuranceAlert.threshold, 3000);
  });

  it('no alert when insurance >= 3000', () => {
    const okIns = F({ id: 'ok', insuranceMax: 3000 });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [okIns]);
    assert.equal(r.lowInsuranceAlert, null);
  });

  it('no alert when nothing is compatible', () => {
    const tooSmall = F({ weightRange: { min: 0, max: 0.001 } });
    const r = scoreFreights({ weights: W(50, 1000), commodityAttrs: [] }, [tooSmall]);
    assert.equal(r.lowInsuranceAlert, null);
    assert.equal(r.recommended, null);
  });
});

describe('scoreFreights — breakdown still informational', () => {
  it('breakdown sums to score / 100', () => {
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [F()]);
    const b = r.compatible[0].breakdown;
    const total = b.insurance + b.price + b.type + b.headroom + b.transit;
    assert.ok(Math.abs(total * 100 - r.compatible[0].score) < 0.001);
  });

  it('exposes chargedKg per scored item', () => {
    const cubed = F({ volumetricDivisor: 5000 });
    const pure  = F({ id: 'pure', volumetricDivisor: null, pureWeight: true });
    const r = scoreFreights({ weights: W(0.5, 5000), commodityAttrs: [] }, [cubed, pure]);
    assert.equal(r.compatible.find(x => x.freight.id === 'x').chargedKg, 1.0);
    assert.equal(r.compatible.find(x => x.freight.id === 'pure').chargedKg, 0.5);
  });
});
