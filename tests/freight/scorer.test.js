import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFreights } from '../../src/freight/scorer.js';

const FREIGHTS = [
  {
    id: 'a', name: 'A', weightRange: { min: 0, max: 3 }, insuranceMax: 5000,
    type: 'express', priceTier: 'medium', destinations: ['BR'],
    restrictions: { forbidden: [], requiresExtra: [] },
  },
  {
    id: 'b', name: 'B', weightRange: { min: 0, max: 30 }, insuranceMax: 3000,
    type: 'sal', priceTier: 'cheap', destinations: ['BR'],
    restrictions: { forbidden: ['battery'], requiresExtra: [] },
  },
  {
    id: 'c', name: 'C', weightRange: { min: 5, max: 20 }, insuranceMax: 4000,
    type: 'express', priceTier: 'medium', destinations: ['BR'],
    restrictions: { forbidden: [], requiresExtra: [] },
  },
];

describe('scoreFreights', () => {
  it('filters out by weight gate', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    const ids = r.compatible.map(x => x.freight.id);
    assert.ok(ids.includes('a'));
    assert.ok(ids.includes('b'));
    assert.ok(!ids.includes('c'));
    const inc = r.incompatible.find(x => x.freight.id === 'c');
    assert.ok(inc);
    assert.ok(inc.reasons.some(r => r.includes('Peso')));
  });

  it('filters out by commodity gate', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: ['battery'] }, FREIGHTS);
    assert.ok(!r.compatible.find(x => x.freight.id === 'b'));
    assert.ok(r.incompatible.find(x => x.freight.id === 'b'));
  });

  it('recommended = highest score among compatible', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    // A has insurance=5000, weight in middle of 0-3 → highest
    assert.equal(r.recommended.freight.id, 'a');
  });

  it('breakdown sums to score / 100', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    const total = r.compatible[0].breakdown.insurance
                + r.compatible[0].breakdown.price
                + r.compatible[0].breakdown.type
                + r.compatible[0].breakdown.headroom;
    assert.ok(Math.abs(total * 100 - r.compatible[0].score) < 0.001);
  });

  it('compatible list ordered by score desc', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    for (let i = 1; i < r.compatible.length; i++) {
      assert.ok(r.compatible[i - 1].score >= r.compatible[i].score);
    }
  });

  it('incompatible reasons are human readable', () => {
    const r = scoreFreights({ chargedKg: 100, commodityAttrs: [] }, FREIGHTS);
    for (const inc of r.incompatible) {
      assert.ok(inc.reasons.length > 0);
      assert.ok(typeof inc.reasons[0] === 'string');
    }
  });

  it('returns recommended=null when nothing is compatible', () => {
    const r = scoreFreights({ chargedKg: 1000, commodityAttrs: [] }, FREIGHTS);
    assert.equal(r.recommended, null);
    assert.equal(r.compatible.length, 0);
  });

  it('rejects when destination does not match', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [], country: 'US' }, FREIGHTS);
    assert.equal(r.compatible.length, 0);
    assert.ok(r.incompatible.every(x => x.reasons.some(r => r.includes('atende'))));
  });
});
