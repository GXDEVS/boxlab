import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyMods } from '../../src/packing/volume-mods.js';

const baseItem = (over = {}) => ({
  id: 'a', name: 'a', length: 10, width: 10, height: 10, weight: 100,
  flags: { hasOriginalBox: false, isSoft: false, hasOriginalPlastic: false },
  coreDims: null,
  bubbleWrap: false,
  originalBoxWeight: 0,
  originalPlasticWeight: 0,
  ...over,
});

describe('applyMods — dimensions', () => {
  it('returns deep-copied items, not mutating originals', () => {
    const items = [baseItem()];
    const out = applyMods(items, {});
    out[0].length = 99;
    assert.equal(items[0].length, 10);
  });

  it('vacuum compresses largest dim of soft items by 30%', () => {
    const items = [baseItem({
      length: 25, width: 18, height: 4,
      flags: { isSoft: true, hasOriginalBox: false, hasOriginalPlastic: false },
    })];
    const out = applyMods(items, { vacuum: true });
    assert.equal(out[0].length, 25 * 0.7);
  });

  it('per-item bubbleWrap adds +1cm to all dims', () => {
    const items = [baseItem({ bubbleWrap: true })];
    const out = applyMods(items, {});
    assert.equal(out[0].length, 11);
  });

  it('dropBoxes uses coreDims', () => {
    const items = [baseItem({
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: { length: 8, width: 7, height: 6 },
    })];
    const out = applyMods(items, { dropBoxes: true });
    assert.deepEqual([out[0].length, out[0].width, out[0].height], [8, 7, 6]);
  });

  it('air layer applies uniformly to all items', () => {
    const items = [baseItem(), baseItem({ id: 'b', length: 5, width: 5, height: 5 })];
    const out = applyMods(items, { airLayerCm: 1 });
    assert.equal(out[0].length, 11);
    assert.equal(out[1].length, 6);
  });
});

describe('applyMods — weight effects', () => {
  it('vacuum does not change weight', () => {
    const items = [baseItem({
      flags: { isSoft: true, hasOriginalBox: false, hasOriginalPlastic: false },
    })];
    const out = applyMods(items, { vacuum: true });
    assert.equal(out[0].weight, 100);
  });

  it('air layer does not change weight', () => {
    const items = [baseItem()];
    const out = applyMods(items, { airLayerCm: 3 });
    assert.equal(out[0].weight, 100);
  });

  it('dropBoxes subtracts originalBoxWeight when applied', () => {
    const items = [baseItem({
      weight: 200,
      originalBoxWeight: 60,
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: { length: 5, width: 5, height: 5 },
    })];
    const out = applyMods(items, { dropBoxes: true });
    assert.equal(out[0].weight, 140);
  });

  it('dropBoxes does not subtract weight if hasOriginalBox=false', () => {
    const items = [baseItem({ weight: 200, originalBoxWeight: 60 })];
    const out = applyMods(items, { dropBoxes: true });
    assert.equal(out[0].weight, 200);
  });

  it('removePlasticBags subtracts originalPlasticWeight', () => {
    const items = [baseItem({
      weight: 100,
      originalPlasticWeight: 8,
      flags: { hasOriginalBox: false, isSoft: false, hasOriginalPlastic: true },
    })];
    const out = applyMods(items, { removePlasticBags: true });
    assert.equal(out[0].weight, 92);
  });

  it('per-item bubbleWrap adds bubble weight by surface area', () => {
    // 10×10×10 -> after bubble dims 11×11×11; surface = 6*121 = 726; weight ~7g rounded
    const items = [baseItem({ bubbleWrap: true })];
    const out = applyMods(items, {});
    // Surface of bubble-inflated item: 2*(11*11+11*11+11*11) = 726, /100 = 7
    assert.equal(out[0].weight, 100 + 7);
  });

  it('weight cannot go below 0 (heavy box subtraction is clamped)', () => {
    const items = [baseItem({
      weight: 30,
      originalBoxWeight: 60,
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: { length: 5, width: 5, height: 5 },
    })];
    const out = applyMods(items, { dropBoxes: true });
    assert.equal(out[0].weight, 0);
  });

  it('compose: dropBoxes + bubble — subtract box weight then add bubble weight', () => {
    const items = [baseItem({
      length: 10, width: 10, height: 10,
      weight: 200,
      originalBoxWeight: 50,
      bubbleWrap: true,
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: { length: 9, width: 9, height: 9 },
    })];
    const out = applyMods(items, { dropBoxes: true });
    // dropBoxes: dims 9×9×9, weight 200-50=150
    // bubble: dims 10×10×10, surface=600, weight 150+6=156
    assert.equal(out[0].length, 10);
    assert.equal(out[0].weight, 150 + Math.round(600 / 100));
  });
});
