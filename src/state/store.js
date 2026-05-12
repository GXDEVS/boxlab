const SCHEMA_VERSION = 2;
const STORAGE_KEY = 'boxlab.v1';

const DEFAULT_STATE = {
  items: [],
  box: { length: 30, width: 22, height: 15, type: 'box', presetId: 'box-m' },
  packagingOptions: {
    priorityPackaging: false,
    vacuum: false,
    dropBoxes: false,
    removePlasticBags: false,
    airLayerCm: 0,   // espaço de "ar" entre itens e paredes da caixa
    shipMode: 'external',  // 'external' = caixa/bolsa por fora; 'original' = sem caixa externa, usa a caixa do produto
    freightLimitG: 0,  // limite de peso (g) do frete CSSBuy escolhido. 0 = sem limite. Acima do limite, mostra aviso de que o seguro não cobre.
    bagAutoFit: true,  // bolsa plástica se molda aos itens — dims = bbox dos itens. Off = sliders manuais.
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
    const base = structuredClone(DEFAULT_STATE);
    const picked = pick(parsed, PERSIST_FIELDS);
    // Shallow-merge nested objects so new fields added to DEFAULT_STATE
    // (e.g. packagingOptions.freightLimitG) keep their defaults when older
    // persisted blobs don't include them.
    if (picked.packagingOptions) {
      picked.packagingOptions = { ...base.packagingOptions, ...picked.packagingOptions };
    }
    if (picked.box) {
      picked.box = { ...base.box, ...picked.box };
    }
    return { ...base, ...picked };
  } catch {
    return null;
  }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
