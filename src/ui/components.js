// DOM helpers thin-wrapping daisyUI v5 component classes.

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

// daisyUI card with a title + body.
export function card(title, body) {
  const inner = el('div', { class: 'card-body p-4 gap-3' });
  if (title) inner.append(el('h3', { class: 'card-title text-xs font-semibold uppercase tracking-wider text-base-content/60' }, title));
  inner.append(body instanceof Node ? body : el('div', {}, body));
  return el('div', { class: 'card bg-base-200 border border-base-content/10' }, inner);
}

const BADGE_TONE = {
  zinc: 'badge-soft',
  green: 'badge-success badge-soft',
  red: 'badge-error badge-soft',
  amber: 'badge-warning badge-soft',
  blue: 'badge-info badge-soft',
  cyan: 'badge-info badge-soft',
  primary: 'badge-primary',
};

export function badge(text, tone = 'zinc') {
  return el('span', { class: `badge badge-sm ${BADGE_TONE[tone] ?? BADGE_TONE.zinc}` }, text);
}

const BUTTON_VARIANT = {
  primary: 'btn btn-primary',
  ghost: 'btn btn-ghost',
  danger: 'btn btn-error btn-soft',
  icon: 'btn btn-ghost btn-square btn-sm',
};

export function button(label, onClick, variant = 'primary', extraClass = '') {
  return el('button', {
    type: 'button',
    class: `${BUTTON_VARIANT[variant] ?? BUTTON_VARIANT.primary} ${extraClass}`.trim(),
    onclick: onClick,
  }, label);
}

// Form primitives ───────────────────────────────────────────

export function input(props = {}) {
  return el('input', { ...props, class: `input ${props.class ?? ''}`.trim() });
}

export function select(props = {}, children = []) {
  return el('select', { ...props, class: `select ${props.class ?? ''}`.trim() }, children);
}

export function checkbox(props = {}) {
  return el('input', { type: 'checkbox', ...props, class: `checkbox checkbox-primary checkbox-sm ${props.class ?? ''}`.trim() });
}

// Range with editable value pill.
// Click the value to turn it into a number input. Enter/blur commits.
// daisyUI already styles `range range-primary range-sm` for us.
export function rangeWithEditableValue({ min = 1, max = 100, step = 1, value = 1, label = '', onChange }) {
  const valuePill = el('button', {
    type: 'button',
    class: 'pill',
    title: 'Clique pra digitar',
  }, String(value));

  const rangeInput = el('input', {
    type: 'range',
    min: String(min), max: String(max), step: String(step), value: String(value),
    class: 'range range-primary range-sm w-full',
    'aria-label': label,
  });

  rangeInput.addEventListener('input', () => {
    const v = parseFloat(rangeInput.value);
    valuePill.textContent = String(v);
    onChange?.(v);
  });

  let editing = false;
  const numInput = el('input', {
    type: 'number', min: String(min), max: String(max), step: String(step),
    class: 'input input-sm w-20 text-center tabular',
  });

  function commit() {
    if (!editing) return;
    let v = parseFloat(numInput.value);
    if (Number.isNaN(v)) v = parseFloat(rangeInput.value);
    v = Math.max(min, Math.min(max, v));
    rangeInput.value = String(v);
    valuePill.textContent = String(v);
    if (numInput.parentNode) numInput.parentNode.replaceChild(valuePill, numInput);
    editing = false;
    onChange?.(v);
  }

  valuePill.addEventListener('click', () => {
    if (editing) return;
    editing = true;
    numInput.value = rangeInput.value;
    valuePill.parentNode.replaceChild(numInput, valuePill);
    numInput.focus();
    numInput.select();
  });

  numInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') {
      editing = false;
      if (numInput.parentNode) numInput.parentNode.replaceChild(valuePill, numInput);
    }
  });
  numInput.addEventListener('blur', commit);

  const labelRow = el('div', { class: 'flex justify-between items-center text-xs text-base-content/70' }, [
    el('span', {}, label),
    valuePill,
  ]);

  return {
    container: el('div', { class: 'space-y-1.5' }, [labelRow, rangeInput]),
    rangeInput,
    valuePill,
    setValue(v) {
      rangeInput.value = String(v);
      valuePill.textContent = String(v);
      if (editing) numInput.value = String(v);
    },
  };
}
