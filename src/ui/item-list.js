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

    const addBtn = button('+ Adicionar item', () => openAddModal(presetsItems, addItem));
    root.append(card('Items', el('div', {}, [list, el('div', { class: 'pt-2' }, addBtn)])));
  };

  function addItem(it) {
    const s = store.get();
    const id = it.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'i' + Date.now() + Math.random().toString(36).slice(2));
    const item = { ...it, id, color: colorFor(id) };
    if (item.bubbleWrap === undefined) item.bubbleWrap = false;
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

  const unsub = store.subscribe(render);
  render();
  return { destroy: () => unsub?.() };
}

function itemRow(it, onRemove, onPatch) {
  const bubbleToggle = checkbox({
    checked: !!it.bubbleWrap,
    title: 'Bolha pra esse item',
    onchange: (e) => onPatch({ bubbleWrap: e.target.checked }),
  });
  bubbleToggle.classList.add('checkbox-xs');

  return el('div', { class: 'flex items-center gap-3 p-2 rounded-lg bg-base-content/5 border border-base-content/10' }, [
    el('span', { class: 'inline-block w-3 h-3 rounded shrink-0', style: { background: it.color } }),
    el('div', { class: 'flex-1 min-w-0' }, [
      el('div', { class: 'text-sm font-medium truncate' }, it.name),
      el('div', { class: 'text-xs text-base-content/60' },
        `${fmt(it.length)}×${fmt(it.width)}×${fmt(it.height)} cm · ${it.weight} g`),
    ]),
    el('label', { class: 'flex items-center gap-1 text-xs text-base-content/70 cursor-pointer', title: 'Aplicar bolha neste item' }, [
      bubbleToggle,
      el('span', {}, '🫧'),
    ]),
    button('×', onRemove, 'icon'),
  ]);
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function openAddModal(presets, onAdd) {
  const overlay = el('div', { class: 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4' });
  const dialog = el('div', { class: 'card bg-base-100 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-base-content/10' });
  const body = el('div', { class: 'card-body p-5 gap-4' });
  dialog.append(body);

  let activeTab = 'presets';
  const close = () => overlay.remove();

  function tabBtn(key, label) {
    return el('button', {
      type: 'button',
      class: `tab ${activeTab === key ? 'tab-active' : ''}`,
      onclick: () => { activeTab = key; renderBody(); },
    }, label);
  }

  function renderBody() {
    clear(body);
    body.append(el('div', { class: 'flex items-center justify-between' }, [
      el('h2', { class: 'card-title text-lg' }, 'Adicionar item'),
      button('×', close, 'icon'),
    ]));

    const tabs = el('div', { class: 'tabs tabs-bordered gap-2' }, [
      tabBtn('presets', 'Presets'),
      tabBtn('custom', 'Custom'),
    ]);
    body.append(tabs);

    if (activeTab === 'presets') {
      body.append(el('div', { class: 'grid grid-cols-1 gap-2' },
        presets.map(p => button(
          `${p.name} — ${fmt(p.length)}×${fmt(p.width)}×${fmt(p.height)} cm · ${p.weight} g`,
          () => { onAdd({ ...p }); close(); },
          'ghost',
          'justify-start',
        ))));
    } else {
      const inputs = {};

      function field(k, label, type = 'number', step = '0.1') {
        const props = { name: k, type, step };
        if (type === 'number') props.min = '0';
        const i = input({ ...props, class: 'w-full' });
        inputs[k] = i;
        return el('label', { class: 'block text-sm space-y-1' }, [
          el('span', { class: 'text-base-content/70' }, label),
          i,
        ]);
      }

      function flagCheck(key, label) {
        const c = checkbox({ name: key });
        inputs[key] = c;
        return el('label', { class: 'flex items-center gap-2 text-sm' }, [c, el('span', {}, label)]);
      }

      body.append(el('div', { class: 'space-y-3' }, [
        field('name', 'Nome', 'text', null),
        el('div', { class: 'grid grid-cols-3 gap-2' }, [
          field('length', 'C (cm)'),
          field('width', 'L (cm)'),
          field('height', 'A (cm)'),
        ]),
        field('weight', 'Peso (g)', 'number', '1'),
        el('div', { class: 'flex flex-wrap gap-3 text-sm' }, [
          flagCheck('hasOriginalBox', 'Tem caixa original'),
          flagCheck('isSoft', 'É macio (soft)'),
          flagCheck('hasOriginalPlastic', 'Tem plástico original'),
          flagCheck('bubbleWrap', '🫧 Aplicar bolha'),
        ]),
        button('Adicionar', () => {
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
            coreDims: null,
          };
          if (!(item.length > 0 && item.width > 0 && item.height > 0 && item.weight > 0)) return;
          onAdd(item);
          close();
        }),
      ]));
    }
  }

  overlay.append(dialog);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  renderBody();
}
