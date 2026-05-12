import { el, clear, card, button, badge, input, checkbox } from './components.js';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];
const colorFor = (id) => COLORS[hash(id) % COLORS.length];
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

export function mount(root, store, presetsItems) {
  const render = () => {
    const s = store.get();
    clear(root);

    const items = s.items;
    const list = el('div', { class: 'space-y-2' },
      items.length === 0
        ? [el('p', { class: 'text-base-content/50 text-sm' }, 'Nenhum item ainda.')]
        : items.map((it) => itemRow(it, () => removeItem(it.id), (next) => updateItem(it.id, next))),
    );

    const addBtn = button('+ Adicionar item', () => openAddModal({
      factoryPresets: presetsItems,
      getCustomPresets: () => store.get().customItems ?? [],
      onAdd: addItem,
      onSaveCustom: saveCustomPreset,
      onDeleteCustom: deleteCustomPreset,
    }));
    root.append(card('Items', el('div', {}, [list, el('div', { class: 'pt-2' }, addBtn)])));
  };

  function addItem(it) {
    const s = store.get();
    const id = it.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'i' + Date.now() + Math.random().toString(36).slice(2));
    const item = { ...it, id, color: colorFor(id) };
    if (item.bubbleWrap === undefined) item.bubbleWrap = false;
    if (item.bagged === undefined) item.bagged = false;
    store.update({ items: [...s.items, item] });
  }

  function removeItem(id) {
    const s = store.get();
    store.update({ items: s.items.filter(x => x.id !== id) });
  }

  function updateItem(id, patch) {
    const s = store.get();
    store.update({ items: s.items.map(x => x.id === id ? { ...x, ...patch } : x) });
  }

  // Persist a custom-made item into the user's "meus" preset list so it shows
  // up in the Presets tab on future opens. Stored without per-instance fields
  // (id/color/bubbleWrap/bagged) so each reuse gets its own.
  function saveCustomPreset(item) {
    const s = store.get();
    const existing = s.customItems ?? [];
    const id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const preset = {
      id,
      name: item.name,
      length: item.length,
      width: item.width,
      height: item.height,
      weight: item.weight,
      flags: { ...(item.flags ?? {}) },
      custom: true,
    };
    store.update({ customItems: [...existing, preset] });
  }

  function deleteCustomPreset(id) {
    const s = store.get();
    store.update({ customItems: (s.customItems ?? []).filter(x => x.id !== id) });
  }

  const unsub = store.subscribe(render);
  render();
  return { destroy: () => unsub?.() };
}

function itemRow(it, onRemove, onPatch) {
  const bubbleToggle = checkbox({
    checked: !!it.bubbleWrap,
    title: 'Aplicar plástico bolha neste item',
    onchange: (e) => onPatch({ bubbleWrap: e.target.checked }),
  });
  const bagToggle = checkbox({
    checked: !!it.bagged,
    title: 'Pôr este item em saco plástico',
    onchange: (e) => onPatch({ bagged: e.target.checked }),
  });

  return el('div', {
    class: 'flex items-center gap-3 p-2.5 rounded-box bg-base-300/50 border border-base-content/5 transition-colors hover:bg-base-300',
  }, [
    el('span', {
      class: 'inline-block w-2.5 h-2.5 rounded shrink-0',
      style: { background: it.color, boxShadow: `0 0 10px ${it.color}66` },
    }),
    el('div', { class: 'flex-1 min-w-0' }, [
      el('div', { class: 'text-sm font-medium truncate flex items-center gap-1.5' }, [
        el('span', {}, it.name),
        it.flags?.hasOriginalBox
          ? el('span', { class: 'badge badge-xs badge-success badge-soft', title: 'Tem caixa original — pode dispensar caixa externa' }, '✓ caixa')
          : null,
      ]),
      el('div', { class: 'text-xs text-base-content/50 tabular' },
        `${fmt(it.length)}×${fmt(it.width)}×${fmt(it.height)} cm · ${it.weight} g`),
    ]),
    el('label', { class: 'flex items-center gap-1.5 text-xs text-base-content/70 cursor-pointer select-none', title: 'Plástico bolha' }, [
      bubbleToggle,
      el('span', { class: 'text-base' }, '🫧'),
    ]),
    el('label', { class: 'flex items-center gap-1.5 text-xs text-base-content/70 cursor-pointer select-none', title: 'Em saco plástico' }, [
      bagToggle,
      el('span', { class: 'text-base' }, '🛍️'),
    ]),
    button('×', onRemove, 'icon'),
  ]);
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function openAddModal({ factoryPresets, getCustomPresets, onAdd, onSaveCustom, onDeleteCustom }) {
  // daisyUI modal as a div (avoids <dialog>'s quirky event/close behavior).
  const dlg = el('div', { class: 'modal modal-open' });
  const box = el('div', { class: 'modal-box max-w-lg space-y-4' });
  dlg.append(box);

  let activeTab = 'presets';
  const close = () => dlg.remove();
  // Esc key closes
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  function tabBtn(key, label) {
    return el('button', {
      type: 'button',
      role: 'tab',
      class: `tab ${activeTab === key ? 'tab-active' : ''}`,
      onclick: () => { activeTab = key; renderBody(); },
    }, label);
  }

  function presetRow(p, { isCustom }) {
    const dims = el('span', { class: 'text-xs text-base-content/50 tabular' },
      `${fmt(p.length)}×${fmt(p.width)}×${fmt(p.height)} cm · ${p.weight}g`);

    const left = el('span', { class: 'text-left flex items-center gap-1.5 min-w-0' }, [
      el('span', { class: 'truncate' }, p.name),
      isCustom ? el('span', { class: 'badge badge-xs badge-primary badge-soft shrink-0', title: 'Salvo por você' }, 'meus') : null,
    ]);

    const pickBtn = el('button', {
      type: 'button',
      class: 'btn btn-ghost flex-1 justify-between',
      onclick: () => { onAdd({ ...p }); close(); },
    }, [left, dims]);

    if (!isCustom) return pickBtn;

    const delBtn = el('button', {
      type: 'button',
      class: 'btn btn-ghost btn-square btn-sm text-base-content/50 hover:text-error',
      title: 'Remover dos meus produtos',
      onclick: (e) => { e.stopPropagation(); onDeleteCustom(p.id); renderBody(); },
    }, '×');

    return el('div', { class: 'flex items-center gap-1' }, [pickBtn, delBtn]);
  }

  function renderBody() {
    clear(box);
    box.append(el('div', { class: 'flex items-center justify-between' }, [
      el('h2', { class: 'text-lg font-semibold' }, '＋ Adicionar item'),
      button('×', close, 'icon'),
    ]));

    box.append(el('div', { class: 'tabs tabs-bordered', role: 'tablist' }, [
      tabBtn('presets', 'Presets'),
      tabBtn('custom', 'Custom'),
    ]));

    if (activeTab === 'presets') {
      const customs = getCustomPresets();
      const rows = [];
      if (customs.length > 0) {
        rows.push(el('div', { class: 'text-xs uppercase tracking-wider text-base-content/50 px-1 pt-1' }, 'Meus produtos'));
        for (const p of customs) rows.push(presetRow(p, { isCustom: true }));
        rows.push(el('div', { class: 'divider-dashed' }));
        rows.push(el('div', { class: 'text-xs uppercase tracking-wider text-base-content/50 px-1' }, 'Padrão'));
      }
      for (const p of factoryPresets) rows.push(presetRow(p, { isCustom: false }));
      box.append(el('div', { class: 'space-y-2 max-h-96 overflow-y-auto' }, rows));
    } else {
      const inputs = {};

      function field(k, label, type = 'number', step = '0.1') {
        const props = { name: k, type, class: 'w-full' };
        if (step) props.step = step;
        if (type === 'number') props.min = '0';
        const i = input(props);
        inputs[k] = i;
        return el('label', { class: 'form-control' }, [
          el('span', { class: 'label-text text-xs uppercase tracking-wider text-base-content/60 mb-1' }, label),
          i,
        ]);
      }

      function flagCheck(key, label) {
        const c = checkbox({ name: key });
        inputs[key] = c;
        return el('label', { class: 'flex items-center gap-2 text-sm cursor-pointer select-none' }, [c, el('span', {}, label)]);
      }

      // daisyUI toggle for "save to my products" — stands out from the regular flags.
      const saveToggle = el('input', {
        type: 'checkbox',
        class: 'toggle toggle-primary toggle-sm',
        name: 'saveToList',
      });
      inputs.saveToList = saveToggle;

      box.append(el('div', { class: 'space-y-3' }, [
        field('name', 'Nome', 'text', null),
        el('div', { class: 'grid grid-cols-3 gap-2' }, [
          field('length', 'C (cm)'),
          field('width', 'L (cm)'),
          field('height', 'A (cm)'),
        ]),
        field('weight', 'Peso (g)', 'number', '1'),
        el('div', { class: 'space-y-2 pt-1' }, [
          el('div', { class: 'text-xs uppercase tracking-wider text-base-content/60 font-medium' }, 'Flags'),
          el('div', { class: 'grid grid-cols-2 gap-2' }, [
            flagCheck('hasOriginalBox', 'Tem caixa original'),
            flagCheck('isSoft', 'É macio (soft)'),
            flagCheck('hasOriginalPlastic', 'Tem plástico original'),
            flagCheck('bubbleWrap', '🫧 Aplicar bolha'),
            flagCheck('bagged', '🛍️ Em saco plástico'),
          ]),
        ]),
        el('label', {
          class: 'flex items-start gap-3 p-3 rounded-box bg-base-300/40 border border-base-content/10 cursor-pointer select-none',
        }, [
          saveToggle,
          el('div', { class: 'flex-1 min-w-0' }, [
            el('div', { class: 'text-sm font-medium' }, 'Salvar este produto na lista'),
            el('div', { class: 'text-xs text-base-content/60' }, 'Fica salvo na aba Presets como "meus" pra reusar depois.'),
          ]),
        ]),
        button('Adicionar item', () => {
          const item = {
            name: inputs.name.value || 'Item sem nome',
            length: parseFloat(inputs.length.value),
            width: parseFloat(inputs.width.value),
            height: parseFloat(inputs.height.value),
            weight: parseFloat(inputs.weight.value),
            flags: {
              hasOriginalBox: inputs.hasOriginalBox.checked,
              isSoft: inputs.isSoft.checked,
              hasOriginalPlastic: inputs.hasOriginalPlastic.checked,
            },
            bubbleWrap: inputs.bubbleWrap.checked,
            bagged: inputs.bagged.checked,
            coreDims: null,
          };
          if (!(item.length > 0 && item.width > 0 && item.height > 0 && item.weight > 0)) return;
          if (inputs.saveToList.checked) onSaveCustom(item);
          onAdd(item);
          close();
        }, 'primary', 'w-full mt-2'),
      ]));
    }
  }

  document.body.append(dlg);
  renderBody();
  // Click on backdrop closes — defer one tick so the click that opened this
  // modal doesn't bubble straight into the close handler.
  setTimeout(() => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  }, 0);
}
