import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/state/store.js';

describe('createStore', () => {
  it('returns initial state', () => {
    const store = createStore({ storage: null });
    const s = store.get();
    assert.deepEqual(s.items, []);
    assert.equal(s.box.type, 'box');
    assert.equal(s.packagingOptions.airLayerCm, 0);
    assert.equal(s.packagingOptions.dropBoxes, false);
  });

  it('update merges shallowly and notifies subscribers', () => {
    const store = createStore({ storage: null });
    let received = null;
    store.subscribe((s) => { received = s; });
    store.update({ items: [{ id: 'a' }] });
    assert.equal(received.items[0].id, 'a');
  });

  it('subscribe returns an unsubscribe function', () => {
    const store = createStore({ storage: null });
    let count = 0;
    const off = store.subscribe(() => { count++; });
    store.update({});
    off();
    store.update({});
    assert.equal(count, 1);
  });

  it('persists and restores via injected storage', () => {
    const fakeStorage = {
      data: {},
      getItem(k) { return this.data[k] ?? null; },
      setItem(k, v) { this.data[k] = v; },
    };
    const s1 = createStore({ storage: fakeStorage });
    s1.update({ box: { length: 99, width: 88, height: 77, type: 'bag', presetId: null } });

    const s2 = createStore({ storage: fakeStorage });
    assert.equal(s2.get().box.length, 99);
    assert.equal(s2.get().box.type, 'bag');
  });

  it('discards corrupted storage', () => {
    const fakeStorage = {
      getItem() { return '{ this is not json'; },
      setItem() {},
    };
    const s = createStore({ storage: fakeStorage });
    assert.deepEqual(s.get().items, []);
  });

  it('discards storage with wrong schema version', () => {
    const fakeStorage = {
      getItem() { return JSON.stringify({ version: 999, box: { length: 0 } }); },
      setItem() {},
    };
    const s = createStore({ storage: fakeStorage });
    // box should fall back to default, not the version-999 garbage
    assert.equal(s.get().box.type, 'box');
    assert.deepEqual(s.get().items, []);
  });

  it('does not persist transient state (items, commodityAttrs)', () => {
    const fakeStorage = {
      data: {},
      getItem(k) { return this.data[k] ?? null; },
      setItem(k, v) { this.data[k] = v; },
    };
    const s1 = createStore({ storage: fakeStorage });
    s1.update({ items: [{ id: 'x', name: 'X' }], commodityAttrs: ['battery'] });

    const s2 = createStore({ storage: fakeStorage });
    assert.deepEqual(s2.get().items, []);
    assert.deepEqual(s2.get().commodityAttrs, []);
  });
});
