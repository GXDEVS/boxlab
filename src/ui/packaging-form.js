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

export function mount(root, store, presetsPackaging) {
  const render = () => {
    clear(root);
    const s = store.get();

    const presetSelect = el('select', {
      class: 'bg-zinc-800 rounded p-2 text-sm w-full',
      onchange: (e) => applyPreset(e.target.value),
    }, [
      el('option', { value: '' }, '— preset —'),
      ...presetsPackaging.map(p =>
        el('option', { value: p.id, selected: s.box.presetId === p.id }, p.name)),
    ]);

    const slider = (axis, label, max = 100) => {
      const wrap = el('div', { class: 'space-y-1' });
      const value = el('span', { class: 'text-sm text-zinc-300' }, String(s.box[axis]));
      const input = el('input', {
        type: 'range', min: '1', max: String(max), step: '1', value: String(s.box[axis]),
        class: 'w-full accent-green-500',
        oninput: (e) => {
          const v = parseInt(e.target.value, 10);
          value.textContent = String(v);
          store.update({ box: { ...store.get().box, [axis]: v, presetId: null } });
        },
      });
      wrap.append(
        el('div', { class: 'flex justify-between text-xs text-zinc-400' }, [
          el('span', {}, label), value,
        ]),
        input,
      );
      return wrap;
    };

    const typeRadios = el('div', { class: 'flex gap-3 text-sm' }, [
      radio('Bolsa', s.box.type === 'bag', () => store.update({ box: { ...s.box, type: 'bag' } })),
      radio('Caixa', s.box.type === 'box', () => store.update({ box: { ...s.box, type: 'box' } })),
    ]);

    const opts = el('div', { class: 'flex flex-wrap gap-3 text-sm' },
      PACK_OPTS.map(([k, label]) => optCheck(k, label, s.packagingOptions[k], (val) => {
        store.update({ packagingOptions: { ...s.packagingOptions, [k]: val } });
      })));

    const commodity = el('div', { class: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm' },
      COMMODITY_OPTIONS.map(([k, label]) => optCheck(`c-${k}`, label, (s.commodityAttrs ?? []).includes(k), (val) => {
        const set = new Set(s.commodityAttrs ?? []);
        if (val) set.add(k); else set.delete(k);
        store.update({ commodityAttrs: [...set] });
      })));

    root.append(card('Embalagem', el('div', { class: 'space-y-3' }, [
      typeRadios,
      el('label', { class: 'block text-sm space-y-1' }, [
        el('span', { class: 'text-zinc-400' }, 'Preset'),
        presetSelect,
      ]),
      el('div', { class: 'grid grid-cols-3 gap-3' }, [
        slider('length', 'C (cm)', 100),
        slider('width', 'L (cm)', 100),
        slider('height', 'A (cm)', 60),
      ]),
    ])));

    root.append(card('Opções', opts));
    root.append(card('Atributos da carga', commodity));
  };

  function applyPreset(id) {
    const p = presetsPackaging.find(x => x.id === id);
    if (!p) return;
    store.update({
      box: { length: p.length, width: p.width, height: p.height, type: p.type, presetId: p.id },
    });
  }

  function radio(label, checked, onChange) {
    return el('label', { class: 'flex items-center gap-2' }, [
      el('input', { type: 'radio', name: 'box-type', checked, onchange: onChange, class: 'accent-green-500' }),
      el('span', {}, label),
    ]);
  }

  function optCheck(key, label, checked, onChange) {
    return el('label', { class: 'flex items-center gap-2' }, [
      el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked), class: 'accent-green-500' }),
      el('span', {}, label),
    ]);
  }

  const unsub = store.subscribe(render);
  render();
  return { destroy: () => unsub?.() };
}
