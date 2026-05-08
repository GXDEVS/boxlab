import { el, clear, card, select, checkbox, rangeWithEditableValue } from './components.js';

const COMMODITY_OPTIONS = [
  ['electric', 'Electric'], ['liquid', 'Liquid'], ['knives', 'Knives'],
  ['powder', 'Powder'], ['shoes', 'Shoes'], ['bags', 'Bags'],
  ['food', 'Food'], ['battery', 'Battery'], ['cosmetics', 'Cosmetics'],
  ['magnetic', 'Magnetic'], ['watch', 'Watch'], ['perfume', 'Perfume'],
  ['seafreight', 'Sea freight'], ['electronics', 'Electronic Products'],
];

const PACK_OPTS = [
  ['vacuum', 'Vácuo (compress soft)'],
  ['dropBoxes', 'Drop boxes (remove caixinha)'],
  ['removePlasticBags', 'Remove plastic bags'],
];

const SLIDER_AXES = [
  { axis: 'length', label: 'Comprimento (cm)', max: 100 },
  { axis: 'width',  label: 'Largura (cm)',     max: 100 },
  { axis: 'height', label: 'Altura (cm)',      max: 60 },
];

const AIR_LAYER_OPTIONS = [
  { value: 0, label: 'Sem camada de ar' },
  { value: 1, label: '+1 cm (folga leve)' },
  { value: 2, label: '+2 cm (folga média)' },
  { value: 3, label: '+3 cm (bem folgado)' },
];

// Build DOM once on mount; subscribe to store and update properties in place.
// This avoids losing the slider drag gesture when state changes.
export function mount(root, store, presetsPackaging) {
  clear(root);

  // ── Preset select ──────────────────────────────────────────
  const presetSelect = select({
    onchange: (e) => applyPreset(e.target.value),
  }, [
    el('option', { value: '' }, '— custom (use sliders) —'),
    ...presetsPackaging.map((p) => {
      const typeLabel = p.type === 'bag' ? 'Bolsa' : 'Caixa';
      const cleanName = p.name.replace(/^(Bolsa|Caixa)\s*/, '');
      return el('option', { value: p.id },
        `${typeLabel} ${cleanName} — ${p.length}×${p.width}×${p.height} cm`);
    }),
  ]);

  // ── Sliders editáveis ─────────────────────────────────────
  const sliders = {};
  const sliderRow = el('div', { class: 'grid grid-cols-1 sm:grid-cols-3 gap-3' });
  for (const { axis, label, max } of SLIDER_AXES) {
    const initial = store.get().box[axis];
    const slider = rangeWithEditableValue({
      min: 1, max, step: 1, value: initial, label,
      onChange: (v) => {
        store.update({ box: { ...store.get().box, [axis]: v, presetId: null } });
      },
    });
    sliders[axis] = slider;
    sliderRow.append(slider.container);
  }

  // ── Air layer select ──────────────────────────────────────
  const airSelect = select({
    onchange: (e) => {
      const v = parseInt(e.target.value, 10) || 0;
      store.update({ packagingOptions: { ...store.get().packagingOptions, airLayerCm: v } });
    },
  }, AIR_LAYER_OPTIONS.map(o => el('option', { value: String(o.value) }, o.label)));

  // ── Packaging option toggles ──────────────────────────────
  const optInputs = {};
  const optsRow = el('div', { class: 'flex flex-wrap gap-3 text-sm' });
  for (const [k, label] of PACK_OPTS) {
    const c = checkbox({
      onchange: (e) => {
        store.update({
          packagingOptions: { ...store.get().packagingOptions, [k]: e.target.checked },
        });
      },
    });
    optInputs[k] = c;
    optsRow.append(el('label', { class: 'flex items-center gap-2 cursor-pointer' }, [c, el('span', {}, label)]));
  }

  // ── Commodity attribute checkboxes ───────────────────────
  const commodityInputs = {};
  const commodityRow = el('div', { class: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm' });
  for (const [k, label] of COMMODITY_OPTIONS) {
    const c = checkbox({
      onchange: (e) => {
        const set = new Set(store.get().commodityAttrs ?? []);
        if (e.target.checked) set.add(k); else set.delete(k);
        store.update({ commodityAttrs: [...set] });
      },
    });
    commodityInputs[k] = c;
    commodityRow.append(el('label', { class: 'flex items-center gap-2 cursor-pointer' }, [c, el('span', {}, label)]));
  }

  // ── Mount static structure ───────────────────────────────
  root.append(card('Embalagem', el('div', { class: 'space-y-4' }, [
    el('div', { class: 'space-y-1.5' }, [
      el('label', { class: 'block text-xs uppercase tracking-wide text-white/50 font-medium' }, 'Preset'),
      presetSelect,
    ]),
    sliderRow,
    el('div', { class: 'space-y-1.5' }, [
      el('label', { class: 'block text-xs uppercase tracking-wide text-white/50 font-medium' }, 'Camada de ar (folga interna)'),
      airSelect,
    ]),
  ])));
  root.append(card('Opções de embalagem', optsRow));
  root.append(card('Atributos da carga', commodityRow));

  function applyPreset(id) {
    if (!id) return;
    const p = presetsPackaging.find(x => x.id === id);
    if (!p) return;
    store.update({
      box: { length: p.length, width: p.width, height: p.height, type: p.type, presetId: p.id },
    });
  }

  // ── Sync DOM state from store (in place, no rebuild) ─────
  function syncFromStore() {
    const s = store.get();

    const desired = s.box.presetId ?? '';
    if (presetSelect.value !== desired) presetSelect.value = desired;

    for (const { axis } of SLIDER_AXES) {
      const v = s.box[axis];
      sliders[axis].setValue(v);
    }

    const air = String(s.packagingOptions.airLayerCm ?? 0);
    if (airSelect.value !== air) airSelect.value = air;

    for (const [k] of PACK_OPTS) {
      const want = !!s.packagingOptions[k];
      if (optInputs[k].checked !== want) optInputs[k].checked = want;
    }

    const attrs = new Set(s.commodityAttrs ?? []);
    for (const [k] of COMMODITY_OPTIONS) {
      const want = attrs.has(k);
      if (commodityInputs[k].checked !== want) commodityInputs[k].checked = want;
    }
  }

  const unsub = store.subscribe(syncFromStore);
  syncFromStore();

  return { destroy: () => unsub?.() };
}
