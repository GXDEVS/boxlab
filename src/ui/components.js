// Small DOM helpers. No framework.

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

export function card(title, body) {
  return el('div', { class: 'rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3' }, [
    title ? el('h3', { class: 'text-sm font-semibold uppercase tracking-wide text-zinc-400' }, title) : null,
    body,
  ]);
}

const TONE_CLASS = {
  zinc: 'bg-zinc-700/50 text-zinc-200',
  green: 'bg-green-700/30 text-green-300',
  red: 'bg-red-700/30 text-red-300',
  amber: 'bg-amber-700/30 text-amber-300',
  blue: 'bg-blue-700/30 text-blue-300',
};

export function badge(text, tone = 'zinc') {
  return el('span', {
    class: `text-xs px-2 py-0.5 rounded ${TONE_CLASS[tone] || TONE_CLASS.zinc}`,
  }, text);
}

const BUTTON_VARIANT = {
  primary: 'bg-green-600 hover:bg-green-500 text-white',
  ghost: 'bg-transparent border border-zinc-700 hover:border-zinc-500 text-zinc-200',
  danger: 'bg-red-700/40 hover:bg-red-700/70 text-red-100',
};

export function button(label, onClick, variant = 'primary') {
  return el('button', {
    class: `px-3 py-2 rounded-lg text-sm transition-colors ${BUTTON_VARIANT[variant]}`,
    onclick: onClick,
  }, label);
}
