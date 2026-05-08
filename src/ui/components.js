// DOM helpers built on the bx-* class system in index.html.
// Pure Tailwind v4 (Play CDN) — no third-party plugin dependencies.

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

// Card with optional title — title sits at top, body below.
export function card(title, body) {
  const children = [];
  if (title) children.push(el('h3', { class: 'bx-card-title' }, title));
  children.push(body instanceof Node ? body : el('div', {}, body));
  return el('div', { class: 'bx-card' }, children);
}

const BADGE_TONE = {
  zinc: 'bx-badge-zinc',
  green: 'bx-badge-green',
  red: 'bx-badge-red',
  amber: 'bx-badge-amber',
  blue: 'bx-badge-blue',
  cyan: 'bx-badge-cyan',
};

export function badge(text, tone = 'zinc') {
  return el('span', { class: `bx-badge ${BADGE_TONE[tone] ?? BADGE_TONE.zinc}` }, text);
}

const BUTTON_VARIANT = {
  primary: 'bx-btn bx-btn-primary',
  ghost: 'bx-btn bx-btn-ghost',
  danger: 'bx-btn bx-btn-danger',
  icon: 'bx-btn bx-btn-ghost bx-btn-icon',
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
  return el('input', { ...props, class: `bx-input ${props.class ?? ''}`.trim() });
}

export function select(props = {}, children = []) {
  return el('select', { ...props, class: `bx-select ${props.class ?? ''}`.trim() }, children);
}

export function checkbox(props = {}) {
  return el('input', { type: 'checkbox', ...props, class: `bx-check ${props.class ?? ''}`.trim() });
}

// Range with editable value — clicking the value pill turns it into a number input.
// On Enter/blur it commits, on Escape it cancels. Range and pill stay in sync.
export function rangeWithEditableValue({ min = 1, max = 100, step = 1, value = 1, label = '', onChange }) {
  const valuePill = el('button', {
    type: 'button',
    class: 'bx-pill',
    title: 'Clique pra digitar',
  }, String(value));

  const rangeInput = el('input', {
    type: 'range',
    min: String(min), max: String(max), step: String(step), value: String(value),
    class: 'bx-range w-full',
    'aria-label': label,
  });
  setRangeFill(rangeInput, value, min, max);

  rangeInput.addEventListener('input', () => {
    const v = parseFloat(rangeInput.value);
    valuePill.textContent = String(v);
    setRangeFill(rangeInput, v, min, max);
    onChange?.(v);
  });

  let editing = false;
  const numInput = el('input', {
    type: 'number', min: String(min), max: String(max), step: String(step),
    class: 'bx-input w-20 text-center tabular',
    style: { padding: '0.25rem 0.4rem', fontSize: '0.85rem', minWidth: '3.4rem' },
  });

  function commit() {
    if (!editing) return;
    let v = parseFloat(numInput.value);
    if (Number.isNaN(v)) v = parseFloat(rangeInput.value);
    v = Math.max(min, Math.min(max, v));
    rangeInput.value = String(v);
    valuePill.textContent = String(v);
    setRangeFill(rangeInput, v, min, max);
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

  const labelRow = el('div', { class: 'flex justify-between items-center text-xs text-white/60' }, [
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
      setRangeFill(rangeInput, v, min, max);
      if (editing) numInput.value = String(v);
    },
  };
}

// Update the gradient fill of a custom range to reflect current value.
function setRangeFill(rangeInput, value, min, max) {
  const pct = ((value - min) / (max - min)) * 100;
  rangeInput.style.setProperty('--bx-fill', `${pct}%`);
}
