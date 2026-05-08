const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'boxlab.v1';

const DEFAULT_STATE = {
  items: [],
  box: { length: 30, width: 22, height: 15, type: 'box', presetId: 'box-m' },
  packagingOptions: {
    priorityPackaging: false,
    vacuum: false,
    bubbleWrap: true,
    dropBoxes: false,
    removePlasticBags: false,
  },
  commodityAttrs: [],
  customItems: [],
};

const PERSIST_FIELDS = ['box', 'packagingOptions', 'customItems'];

export function createStore({ storage } = {}) {
  if (storage === undefined) {
    storage = typeof localStorage !== 'undefined' ? localStorage : null;
  }

  let state = restore(storage) ?? structuredClone(DEFAULT_STATE);
  const subscribers = new Set();

  function persist() {
    if (!storage) return;
    const payload = { version: SCHEMA_VERSION };
    for (const k of PERSIST_FIELDS) payload[k] = state[k];
    try { storage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
  }

  return {
    get: () => state,
    update(patch) {
      state = { ...state, ...patch };
      persist();
      for (const fn of subscribers) fn(state);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

function restore(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== SCHEMA_VERSION) return null;
    return { ...structuredClone(DEFAULT_STATE), ...pick(parsed, PERSIST_FIELDS) };
  } catch {
    return null;
  }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
