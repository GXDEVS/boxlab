// DOM helpers wrapping FlyonUI component classes (.btn, .input, .select, .checkbox, .range, .badge, .card).
// FlyonUI is a Tailwind v4 component library — semantic classes do most of the styling.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v === false || v == null) continue;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// FlyonUI card layout — header optional + body.
export function card(title, body) {
  const inner = el('div', { class: 'card-body p-4 gap-3' });
  if (title) inner.append(el('h3', { class: 'card-title text-sm font-semibold uppercase tracking-wide text-base-content/60' }, title));
  inner.append(body instanceof Node ? body : el('div', {}, body));
  return el('div', { class: 'card bg-base-200/40 border border-base-content/10' }, inner);
}

const BADGE_TONE = {
  zinc: 'badge-soft',
  green: 'badge-soft badge-success',
  red: 'badge-soft badge-error',
  amber: 'badge-soft badge-warning',
  blue: 'badge-soft badge-info',
  primary: 'badge-primary',
};

export function badge(text, tone = 'zinc') {
  return el('span', { class: `badge ${BADGE_TONE[tone] ?? BADGE_TONE.zinc}` }, text);
}

const BUTTON_VARIANT = {
  primary: 'btn btn-primary',
  ghost: 'btn btn-soft',
  danger: 'btn btn-error btn-soft',
  icon: 'btn btn-circle btn-text btn-sm',
};

export function button(label, onClick, variant = 'primary', extraClass = '') {
  return el('button', {
    type: 'button',
    class: `${BUTTON_VARIANT[variant] ?? BUTTON_VARIANT.primary} ${extraClass}`.trim(),
    onclick: onClick,
  }, label);
}

// Form primitives —————————————————————————————

export function input(props = {}) {
  return el('input', { ...props, class: `input ${props.class ?? ''}`.trim() });
}

export function select(props = {}, children = []) {
  return el('select', { ...props, class: `select ${props.class ?? ''}`.trim() }, children);
}

export function checkbox(props = {}) {
  return el('input', { type: 'checkbox', ...props, class: `checkbox checkbox-success ${props.class ?? ''}`.trim() });
}

// Range with optional editable value — clicking the value flips it to a number input
// that writes back through the same onCommit channel.
export function rangeWithEditableValue({ min = 1, max = 100, step = 1, value = 1, label = '', onChange }) {
  const valueBtn = el('button', {
    type: 'button',
    class: 'text-sm tabular-nums px-2 py-0.5 rounded bg-base-content/5 hover:bg-base-content/10 transition-colors min-w-[3.25rem] text-center',
    title: 'Editar valor',
  }, String(value));

  const rangeInput = el('input', {
    type: 'range', min: String(min), max: String(max), step: String(step), value: String(value),
    class: 'range range-primary range-sm w-full',
    'aria-label': label,
  });

  rangeInput.addEventListener('input', () => {
    const v = parseFloat(rangeInput.value);
    valueBtn.textContent = String(v);
    onChange?.(v);
  });

  // Toggle to number input on click
  let editing = false;
  const numInput = el('input', {
    type: 'number', min: String(min), max: String(max), step: String(step),
    class: 'input input-sm w-20 text-sm tabular-nums',
  });

  function commitEdit() {
    if (!editing) return;
    let v = parseFloat(numInput.value);
    if (Number.isNaN(v)) v = parseFloat(rangeInput.value);
    v = Math.max(min, Math.min(max, v));
    rangeInput.value = String(v);
    valueBtn.textContent = String(v);
    if (numInput.parentNode) numInput.parentNode.replaceChild(valueBtn, numInput);
    editing = false;
    onChange?.(v);
  }

  valueBtn.addEventListener('click', () => {
    if (editing) return;
    editing = true;
    numInput.value = rangeInput.value;
    valueBtn.parentNode.replaceChild(numInput, valueBtn);
    numInput.focus();
    numInput.select();
  });

  numInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape') { editing = false; numInput.parentNode.replaceChild(valueBtn, numInput); }
  });
  numInput.addEventListener('blur', commitEdit);

  const labelRow = el('div', { class: 'flex justify-between items-center text-xs text-base-content/70' }, [
    el('span', {}, label),
    valueBtn,
  ]);

  return {
    container: el('div', { class: 'space-y-1' }, [labelRow, rangeInput]),
    rangeInput,
    valueBtn,
    setValue(v) {
      rangeInput.value = String(v);
      valueBtn.textContent = String(v);
      if (editing) numInput.value = String(v);
    },
  };
}
