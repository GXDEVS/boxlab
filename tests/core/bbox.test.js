import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bboxOfItems } from '../../src/core/bbox.js';

const item = (id, l, w, h) => ({ id, name: id, length: l, width: w, height: h, weight: 100 });

describe('bboxOfItems', () => {
  it('returns zero box when no items', () => {
    const r = bboxOfItems([]);
    assert.equal(r.length, 0);
    assert.equal(r.width, 0);
    assert.equal(r.height, 0);
    assert.deepEqual(r.positions, []);
  });

  it('single item: bbox equals item dims', () => {
    const r = bboxOfItems([item('a', 13, 4, 3.5)]);
    assert.equal(r.length, 13);
    assert.equal(r.width, 4);
    assert.equal(r.height, 3.5);
    assert.equal(r.positions.length, 1);
  });

  it('multiple items: bbox covers footprint of packed items', () => {
    const r = bboxOfItems([item('a', 5, 5, 5), item('b', 5, 5, 5)]);
    // Two 5×5×5 cubes side-by-side: footprint at minimum 10×5×5 (or some rotation).
    assert.equal(r.positions.length, 2);
    const totalVol = r.length * r.width * r.height;
    assert.ok(totalVol >= 250, `expected ≥250, got ${totalVol}`);
  });
});
