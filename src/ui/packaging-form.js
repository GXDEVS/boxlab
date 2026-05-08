import { el, clear, card } from './components.js';

const COMMODITY_OPTIONS = [
  ['electric', 'Electric'], ['liquid', 'Liquid'], ['knives', 'Knives'],
  ['powder', 'Powder'], ['shoes', 'Shoes'], ['bags', 'Bags'],
  ['food', 'Food'], ['battery', 'Battery'], ['cosmetics', 'Cosmetics'],
  ['magnetic', 'Magnetic'], ['watch', 'Watch'], ['perfume', 'Perfume'],
  ['seafreight', 'Sea freight'], ['electronics', 'Electronic Products'],
];

const PACK_OPTS = [
  ['vacuum', 'Vácuo (compress soft)'],
  ['bubbleWrap', 'Bolha'],
  ['dropBoxes', 'Drop boxes (remove caixinha)'],
  ['removePlasticBags', 'Remove plastic bags'],
];

const SLIDER_AXES = [
  { axis: 'length', label: 'C (cm)', max: 100 },
  { axis: 'width',  label: 'L (cm)', max: 100 },
  { axis: 'height', label: 'A (cm)', max: 60 },
];

// Build DOM once on mount; subscribe to store and update properties in place.
// This avoids losing the slider drag gesture when state changes.
export function mount(root, store, presetsPackaging) {
  clear(root);

  // ── Preset select ──────────────────────────────────────────
  const presetSelect = el('select', {
    class: 'bg-zinc-800 rounded p-2 text-sm w-full',
    onchange: (e) => applyPreset(e.target.value),
  });
  presetSelect.append(el('option', { value: '' }, '— custom (use sliders) —'));
  for (const p of presetsPackaging) {
    const typeLabel = p.type === 'bag' ? 'Bolsa' : 'Caixa';
    presetSelect.append(el('option', { value: p.id },
      `${typeLabel} ${p.name.replace(/^(Bolsa|Caixa)\s*/, '')} — ${p.length}×${p.width}×${p.height} cm`));
  }

  // ── Sliders ───────────────────────────────────────────────
  const sliders = {};
  const sliderRow = el('div', { class: 'grid grid-cols-3 gap-3' });
  for (const { axis, label, max } of SLIDER_AXES) {
    const valueSpan = el('span', { class: 'text-sm text-zinc-300 tabular-nums' }, '0');
    const input = el('input', {
      type: 'range', min: '1', max: String(max), step: '1', value: '1',
      class: 'w-full accent-green-500',
      oninput: (e) => {
        const v = parseInt(e.target.value, 10);
        valueSpan.textContent = String(v);
        // Mark this update as "from us" so syncFromStore skips reverting
        store.update({ box: { ...store.get().box, [axis]: v, presetId: null } });
      },
    });
    sliders[axis] = { input, valueSpan };
    sliderRow.append(el('div', { class: 'space-y-1' }, [
      el('div', { class: 'flex justify-between text-xs text-zinc-400' }, [
        el('span', {}, label),
        valueSpan,
      ]),
      input,
    ]));
  }

  // ── Packaging option toggles ──────────────────────────────
  const optInputs = {};
  const optsRow = el('div', { class: 'flex flex-wrap gap-3 text-sm' });
  for (const [k, label] of PACK_OPTS) {
    const input = el('input', {
      type: 'checkbox',
      class: 'accent-green-500',
      onchange: (e) => {
        store.update({
          packagingOptions: { ...store.get().packagingOptions, [k]: e.target.checked },
        });
      },
    });
    optInputs[k] = input;
    optsRow.append(el('label', { class: 'flex items-center gap-2' }, [input, el('span', {}, label)]));
  }

  // ── Commodity attribute checkboxes ───────────────────────
  const commodityInputs = {};
  const commodityRow = el('div', { class: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm' });
  for (const [k, label] of COMMODITY_OPTIONS) {
    const input = el('input', {
      type: 'checkbox',
      class: 'accent-green-500',
      onchange: (e) => {
        const set = new Set(store.get().commodityAttrs ?? []);
        if (e.target.checked) set.add(k); else set.delete(k);
        store.update({ commodityAttrs: [...set] });
      },
    });
    commodityInputs[k] = input;
    commodityRow.append(el('label', { class: 'flex items-center gap-2' }, [input, el('span', {}, label)]));
  }

  // ── Mount static structure ───────────────────────────────
  root.append(card('Embalagem', el('div', { class: 'space-y-3' }, [
    el('label', { class: 'block text-sm space-y-1' }, [
      el('span', { class: 'text-zinc-400' }, 'Preset'),
      presetSelect,
    ]),
    sliderRow,
  ])));
  root.append(card('Opções', optsRow));
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

    // Preset select — only set if value differs (avoid stomping mid-edit)
    const desired = s.box.presetId ?? '';
    if (presetSelect.value !== desired) presetSelect.value = desired;

    // Sliders — only update if value differs (so user drag isn't reverted)
    for (const { axis } of SLIDER_AXES) {
      const v = s.box[axis];
      const sl = sliders[axis];
      if (sl.input.value !== String(v)) sl.input.value = String(v);
      if (sl.valueSpan.textContent !== String(v)) sl.valueSpan.textContent = String(v);
    }

    // Option toggles
    for (const [k] of PACK_OPTS) {
      const want = !!s.packagingOptions[k];
      if (optInputs[k].checked !== want) optInputs[k].checked = want;
    }

    // Commodity checkboxes
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
