import { el, clear, card } from './components.js';

export function mount(root, getResults) {
  function render() {
    clear(root);
    const r = getResults();
    if (!r) {
      root.append(card('Resultado', el('p', { class: 'text-base-content/40 text-sm' }, 'Adicione itens pra começar.')));
      return;
    }
    const { weights, packing, freightLimitG } = r;
    const chargedG = weights.chargedKg * 1000;
    const overFreight = freightLimitG > 0 && chargedG > freightLimitG;

    const grid = el('div', { class: 'stats stats-horizontal w-full bg-base-200 border border-base-content/10 shadow-none' }, [
      stat('Volume da caixa', `${weights.volumeCm3.toLocaleString('pt-BR')} cm³`),
      stat('Peso real estimado', `${weights.realWeightG.toFixed(0)} g`),
      stat('Peso cubado (÷5000)', `${(weights.cubicWeightKg * 1000).toFixed(0)} g`,
           '', 'Estimativa com divisor padrão 5000.'),
      stat(
        'Você paga por',
        `${(weights.chargedKg * 1000).toFixed(0)} g`,
        weights.chargedSource === 'cubic' ? 'text-warning' : 'text-primary',
        weights.chargedSource === 'cubic' ? 'Peso cubado prevalece.' : 'Peso real prevalece.',
      ),
    ]);
    root.append(grid);

    if (packing.tooManyItems) {
      root.append(alertBox('warning', '⚠ Mais de 50 itens — packing 3D desativado por performance.'));
    } else if (packing.fits && packing.positions.length > 0) {
      const isReal = weights.chargedSource === 'real';
      const msg = isReal
        ? '✓ Cenário ideal — peso real prevalece, você paga pelo peso real.'
        : '⚠ Peso cubado prevalece — caixa folgada pra carga, considere reduzir.';
      root.append(alertBox(isReal ? 'success' : 'warning', msg));
    } else if (packing.overflow.length > 0) {
      const overflowNames = packing.overflow.map(o => o.name || o.id).join(', ');
      root.append(alertBox('warning', `⚠ Não couberam: ${overflowNames}. Aumente a caixa.`));
    }

    if (overFreight) {
      const excess = Math.round(chargedG - freightLimitG);
      root.append(alertBox('error',
        `⚠ Peso cobrado (${Math.round(chargedG)} g) ultrapassa o limite do frete escolhido (${freightLimitG} g) — excedeu em ${excess} g. O seguro pode não cobrir.`));
    }
  }

  function stat(label, value, valueClass = '', title) {
    return el('div', { class: 'stat px-4 py-3', title: title || undefined }, [
      el('div', { class: 'stat-title text-xs uppercase tracking-wider' }, label),
      el('div', { class: `stat-value text-2xl tabular ${valueClass}` }, value),
    ]);
  }

  function alertBox(tone, text) {
    return el('div', { class: `alert alert-${tone} alert-soft` }, text);
  }

  render();
  return { rerender: render, destroy: () => clear(root) };
}
