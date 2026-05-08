import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyMods } from '../../src/packing/volume-mods.js';

const baseItem = (over = {}) => ({
  id: 'a', name: 'a', length: 10, width: 10, height: 10, weight: 100,
  flags: { hasOriginalBox: false, isSoft: false, hasOriginalPlastic: false },
  coreDims: null,
  ...over,
});

describe('applyMods', () => {
  it('returns deep-copied items, not mutating originals', () => {
    const items = [baseItem()];
    const out = applyMods(items, {});
    out[0].length = 99;
    assert.equal(items[0].length, 10);
  });

  it('vacuum compresses largest dim of soft items by 30%', () => {
    const items = [baseItem({ length: 25, width: 18, height: 4, flags: { isSoft: true, hasOriginalBox: false, hasOriginalPlastic: false } })];
    const out = applyMods(items, { vacuum: true });
    assert.equal(out[0].length, 25 * 0.7);
  });

  it('vacuum does NOT affect non-soft items', () => {
    const items = [baseItem()];
    const out = applyMods(items, { vacuum: true });
    assert.equal(out[0].length, 10);
  });

  it('bubble adds +1cm to all dims of every item', () => {
    const items = [baseItem(), baseItem({ id: 'b', length: 5, width: 5, height: 5 })];
    const out = applyMods(items, { bubbleWrap: true });
    assert.equal(out[0].length, 11);
    assert.equal(out[1].length, 6);
  });

  it('dropBoxes uses coreDims when hasOriginalBox=true', () => {
    const items = [baseItem({
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: { length: 8, width: 7, height: 6 },
    })];
    const out = applyMods(items, { dropBoxes: true });
    assert.deepEqual([out[0].length, out[0].width, out[0].height], [8, 7, 6]);
  });

  it('dropBoxes ignores items missing coreDims', () => {
    const items = [baseItem({
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: null,
    })];
    const out = applyMods(items, { dropBoxes: true });
    assert.equal(out[0].length, 10);
  });

  it('removePlasticBags shrinks dims by 5% on items with hasOriginalPlastic', () => {
    const items = [baseItem({ flags: { hasOriginalBox: false, isSoft: false, hasOriginalPlastic: true } })];
    const out = applyMods(items, { removePlasticBags: true });
    assert.equal(out[0].length, 10 * 0.95);
  });

  it('compose: vacuum + bubble apply in order vacuum then bubble', () => {
    const items = [baseItem({
      length: 10, width: 10, height: 10,
      flags: { isSoft: true, hasOriginalBox: false, hasOriginalPlastic: false },
    })];
    const out = applyMods(items, { vacuum: true, bubbleWrap: true });
    assert.equal(out[0].length, 10 * 0.7 + 1);
  });
});
