import { el, clear, card, button } from './components.js';

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
        ? [el('p', { class: 'text-zinc-500 text-sm' }, 'Nenhum item ainda.')]
        : items.map((it) => itemRow(it, () => removeItem(it.id))),
    );

    const addBtn = button('+ Adicionar item', () => openAddModal(presetsItems, addItem));
    root.append(card('Items', el('div', {}, [list, el('div', { class: 'pt-2' }, addBtn)])));
  };

  function addItem(it) {
    const s = store.get();
    const id = it.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'i' + Date.now() + Math.random().toString(36).slice(2));
    const item = { ...it, id, color: colorFor(id) };
    store.update({ items: [...s.items, item] });
  }

  function removeItem(id) {
    const s = store.get();
    store.update({ items: s.items.filter(x => x.id !== id) });
  }

  const unsub = store.subscribe(render);
  render();
  return { destroy: () => unsub?.() };
}

function itemRow(it, onRemove) {
  return el('div', { class: 'flex items-center gap-3 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800' }, [
    el('span', { class: 'inline-block w-3 h-3 rounded shrink-0', style: { background: it.color } }),
    el('div', { class: 'flex-1 min-w-0' }, [
      el('div', { class: 'text-sm font-medium truncate' }, it.name),
      el('div', { class: 'text-xs text-zinc-400' }, `${it.length}×${it.width}×${it.height} cm · ${it.weight} g`),
    ]),
    button('×', onRemove, 'danger'),
  ]);
}

function openAddModal(presets, onAdd) {
  const overlay = el('div', { class: 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4' });
  const dialog = el('div', { class: 'bg-zinc-900 rounded-xl p-5 w-full max-w-lg space-y-4 border border-zinc-700 max-h-[90vh] overflow-y-auto' });

  let activeTab = 'presets';

  function tabBtn(key, label) {
    return button(label, () => { activeTab = key; renderBody(); }, activeTab === key ? 'primary' : 'ghost');
  }

  const tabs = el('div', { class: 'flex gap-2' }, []);
  const body = el('div', {});
  const close = () => overlay.remove();

  function renderTabs() {
    clear(tabs);
    tabs.append(tabBtn('presets', 'Presets'), tabBtn('custom', 'Custom'));
  }

  function renderBody() {
    renderTabs();
    clear(body);
    if (activeTab === 'presets') {
      body.append(el('div', { class: 'grid grid-cols-1 gap-2' },
        presets.map(p => button(`${p.name} — ${p.length}×${p.width}×${p.height} cm · ${p.weight} g`,
          () => { onAdd({ ...p }); close(); }, 'ghost'))));
    } else {
      const inputs = {};
      function field(k, label, type = 'number', step = '0.1') {
        const id = `f-${k}`;
        const i = el('input', { id, type, class: 'w-full bg-zinc-800 rounded p-2 text-sm', step });
        inputs[k] = i;
        return el('label', { class: 'block text-sm space-y-1' }, [
          el('span', { class: 'text-zinc-400' }, label),
          i,
        ]);
      }
      function checkbox(key, label) {
        const id = `f-${key}`;
        return el('label', { class: 'flex items-center gap-2' }, [
          el('input', { id, type: 'checkbox', class: 'accent-green-500' }),
          el('span', {}, label),
        ]);
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
          checkbox('hasOriginalBox', 'Tem caixa original'),
          checkbox('isSoft', 'É macio (soft)'),
          checkbox('hasOriginalPlastic', 'Tem plástico original'),
        ]),
        button('Adicionar', () => {
          const flags = ['hasOriginalBox', 'isSoft', 'hasOriginalPlastic']
            .reduce((acc, k) => { acc[k] = document.getElementById(`f-${k}`).checked; return acc; }, {});
          const item = {
            name: inputs.name.value || 'Item sem nome',
            length: parseFloat(inputs.length.value),
            width: parseFloat(inputs.width.value),
            height: parseFloat(inputs.height.value),
            weight: parseFloat(inputs.weight.value),
            flags,
            coreDims: null,
          };
          if (!(item.length > 0 && item.width > 0 && item.height > 0 && item.weight > 0)) return;
          onAdd(item);
          close();
        }),
      ]));
    }
  }

  dialog.append(
    el('div', { class: 'flex items-center justify-between' }, [
      el('h2', { class: 'text-lg font-semibold' }, 'Adicionar item'),
      button('×', close, 'ghost'),
    ]),
    tabs, body,
  );
  overlay.append(dialog);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  renderBody();
}
