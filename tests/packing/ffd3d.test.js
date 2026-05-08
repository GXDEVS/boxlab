import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pack } from '../../src/packing/ffd3d.js';

const item = (id, l, w, h) => ({ id, name: id, length: l, width: w, height: h, weight: 100 });

describe('pack (ffd3d)', () => {
  it('places single item that fits at origin', () => {
    const r = pack([item('a', 5, 5, 5)], { length: 10, width: 10, height: 10 });
    assert.equal(r.fits, true);
    assert.equal(r.positions.length, 1);
    assert.equal(r.overflow.length, 0);
    assert.deepEqual([r.positions[0].x, r.positions[0].y, r.positions[0].z], [0, 0, 0]);
  });

  it('reports overflow for item bigger than box', () => {
    const r = pack([item('a', 20, 5, 5)], { length: 10, width: 10, height: 10 });
    assert.equal(r.fits, false);
    assert.equal(r.overflow.length, 1);
    assert.equal(r.overflow[0].id, 'a');
  });

  it('places two items side by side', () => {
    const r = pack([item('a', 4, 4, 4), item('b', 4, 4, 4)], { length: 10, width: 10, height: 10 });
    assert.equal(r.fits, true);
    assert.equal(r.positions.length, 2);
    const ids = r.positions.map(p => p.id).sort();
    assert.deepEqual(ids, ['a', 'b']);
  });

  it('rotates an item to make it fit', () => {
    // box 10x10x2 — item 2x2x8 only fits if rotated
    const r = pack([item('a', 2, 2, 8)], { length: 10, width: 10, height: 2 });
    assert.equal(r.fits, true);
    assert.equal(r.positions[0].rotated, true);
  });

  it('skips items with zero or negative dim, marks as overflow', () => {
    const r = pack([item('a', 0, 5, 5), item('b', 5, 5, 5)], { length: 10, width: 10, height: 10 });
    assert.equal(r.positions.length, 1);
    assert.equal(r.overflow.length, 1);
    assert.equal(r.overflow[0].id, 'a');
  });

  it('orders by volume desc (FFD)', () => {
    const items = [
      item('small', 1, 1, 1),
      item('big', 5, 5, 5),
      item('mid', 3, 3, 3),
    ];
    const r = pack(items, { length: 10, width: 10, height: 10 });
    assert.equal(r.positions[0].id, 'big');
    assert.equal(r.positions[1].id, 'mid');
    assert.equal(r.positions[2].id, 'small');
  });

  it('returns hard-limit warning when items exceed 50', () => {
    const items = Array.from({ length: 51 }, (_, i) => item(String(i), 1, 1, 1));
    const r = pack(items, { length: 10, width: 10, height: 10 });
    assert.equal(r.tooManyItems, true);
    assert.deepEqual(r.positions, []);
  });

  it('exposes packingFootprint bbox of placed items', () => {
    const r = pack([item('a', 4, 4, 4), item('b', 4, 4, 4)], { length: 10, width: 10, height: 10 });
    assert.ok(r.packingFootprint);
    assert.ok(r.packingFootprint.length >= 4);
    assert.ok(r.packingFootprint.width >= 4);
  });

  it('placed items do not overlap', () => {
    const items = [
      item('a', 4, 4, 4),
      item('b', 4, 4, 4),
      item('c', 4, 4, 4),
    ];
    const r = pack(items, { length: 10, width: 10, height: 10 });
    assert.equal(r.positions.length, 3);
    for (let i = 0; i < r.positions.length; i++) {
      for (let j = i + 1; j < r.positions.length; j++) {
        const a = r.positions[i], b = r.positions[j];
        const overlap =
          a.x < b.x + b.dims[0] && a.x + a.dims[0] > b.x &&
          a.y < b.y + b.dims[1] && a.y + a.dims[1] > b.y &&
          a.z < b.z + b.dims[2] && a.z + a.dims[2] > b.z;
        assert.equal(overlap, false, `items ${a.id} and ${b.id} overlap`);
      }
    }
  });
});
