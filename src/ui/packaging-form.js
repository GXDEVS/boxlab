import { el, clear, card, select, checkbox, rangeWithEditableValue } from './components.js';

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

export function mount(root, store, presetsPackaging) {
  clear(root);

  const presetsByType = {
    bag: presetsPackaging.filter(p => p.type === 'bag'),
    box: presetsPackaging.filter(p => p.type === 'box'),
  };

  // ── Type toggle (Bolsa | Caixa) — daisyUI join with btn ────
  const typeButtons = {};
  function makeTypeBtn(typeKey, label) {
    const btn = el('button', {
      type: 'button',
      class: 'btn btn-sm join-item',
      onclick: () => onTypeChange(typeKey),
    }, label);
    typeButtons[typeKey] = btn;
    return btn;
  }
  const typeToggle = el('div', { class: 'join' }, [
    makeTypeBtn('bag', '🛍️ Bolsa'),
    makeTypeBtn('box', '📦 Caixa'),
  ]);

  function onTypeChange(typeKey) {
    const s = store.get();
    if (s.box.type === typeKey) return;
    // Reset to first preset of the new type so the UI feels coherent
    const first = presetsByType[typeKey][0];
    if (first) {
      store.update({
        box: {
          length: first.length, width: first.width, height: first.height,
          type: first.type, presetId: first.id,
        },
      });
    } else {
      store.update({ box: { ...s.box, type: typeKey, presetId: null } });
    }
  }

  // ── Preset select (filtered by current type) ───────────────
  const presetSelect = select({
    onchange: (e) => applyPreset(e.target.value),
  });

  function rebuildPresetOptions(typeKey) {
    clear(presetSelect);
    presetSelect.append(el('option', { value: '' }, '— custom (use sliders) —'));
    for (const p of presetsByType[typeKey]) {
      const cleanName = p.name.replace(/^(Bolsa|Caixa)\s*/, '');
      presetSelect.append(el('option', { value: p.id },
        `${cleanName} — ${p.length}×${p.width}×${p.height} cm`));
    }
  }

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

  // ── Mount static structure ───────────────────────────────
  const labelClass = 'block text-xs uppercase tracking-wider text-base-content/60 font-medium';

  // ── Ship mode toggle (external container vs original product box) ─────
  const shipModeButtons = {};
  function makeShipBtn(mode, label, hint) {
    const btn = el('button', {
      type: 'button',
      class: 'btn btn-sm join-item flex-1',
      title: hint,
      onclick: () => store.update({
        packagingOptions: { ...store.get().packagingOptions, shipMode: mode },
      }),
    }, label);
    shipModeButtons[mode] = btn;
    return btn;
  }
  const shipModeToggle = el('div', { class: 'join w-full' }, [
    makeShipBtn('external', '📦 Com caixa externa', 'Você define o container — bolsa ou caixa.'),
    makeShipBtn('original', '✓ Caixa original', 'Sem caixa externa — usa a caixa do próprio produto.'),
  ]);

  // The container settings (Tipo, Preset, sliders, air layer) only make sense
  // in 'external' mode. We keep them in a wrapper so we can toggle visibility.
  const containerBlock = el('div', { class: 'space-y-4' }, [
    el('div', { class: 'space-y-1.5' }, [
      el('label', { class: labelClass }, 'Tipo'),
      typeToggle,
    ]),
    el('div', { class: 'space-y-1.5' }, [
      el('label', { class: labelClass }, 'Preset'),
      presetSelect,
    ]),
    sliderRow,
    el('div', { class: 'space-y-1.5' }, [
      el('label', { class: labelClass }, 'Camada de ar (folga interna)'),
      airSelect,
    ]),
  ]);

  const originalModeHint = el('div', {
    class: 'alert alert-info alert-soft text-xs',
  }, [
    el('iconify-icon', { icon: 'ph:info-bold', width: '16' }),
    el('span', {}, 'Volume e peso usam direto a caixa do produto (com bolha/saco se aplicado). Bom para itens com caixa de transporte robusta.'),
  ]);

  root.append(card('Embalagem', el('div', { class: 'space-y-4' }, [
    el('div', { class: 'space-y-1.5' }, [
      el('label', { class: labelClass }, 'Modo de envio'),
      shipModeToggle,
    ]),
    containerBlock,
    originalModeHint,
    el('div', { class: 'divider-dashed' }),
    el('div', { class: 'space-y-2' }, [
      el('label', { class: labelClass }, 'Opções de embalagem'),
      optsRow,
    ]),
  ])));

  function applyPreset(id) {
    if (!id) return;
    const p = presetsPackaging.find(x => x.id === id);
    if (!p) return;
    store.update({
      box: { length: p.length, width: p.width, height: p.height, type: p.type, presetId: p.id },
    });
  }

  // ── Sync DOM state from store (in place, no rebuild) ─────
  let lastTypeRendered = null;
  function syncFromStore() {
    const s = store.get();

    // Update type toggle visual state — daisyUI uses btn-primary on active
    for (const k of ['bag', 'box']) {
      const active = s.box.type === k;
      typeButtons[k].classList.toggle('btn-primary', active);
    }

    // Ship mode toggle — show container settings only in 'external' mode
    const mode = s.packagingOptions.shipMode ?? 'external';
    for (const k of ['external', 'original']) {
      shipModeButtons[k].classList.toggle('btn-primary', mode === k);
    }
    containerBlock.style.display = mode === 'external' ? '' : 'none';
    originalModeHint.style.display = mode === 'original' ? '' : 'none';

    // Rebuild preset options when type changes
    if (s.box.type !== lastTypeRendered) {
      rebuildPresetOptions(s.box.type);
      lastTypeRendered = s.box.type;
    }

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
  }

  const unsub = store.subscribe(syncFromStore);
  syncFromStore();

  return { destroy: () => unsub?.() };
}
