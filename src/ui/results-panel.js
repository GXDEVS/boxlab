import { el, clear, card } from './components.js';

export function mount(root, getResults) {
  function render() {
    clear(root);
    const r = getResults();
    if (!r) {
      root.append(card('Resultado', el('p', { class: 'text-white/40 text-sm' }, 'Adicione itens pra começar.')));
      return;
    }
    const { weights, packing } = r;

    const grid = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-2' }, [
      stat('Volume da caixa', `${weights.volumeCm3.toLocaleString('pt-BR')} cm³`),
      stat('Peso real estimado', `${weights.realWeightG.toFixed(0)} g`),
      stat('Peso cubado (÷5000)', `${(weights.cubicWeightKg * 1000).toFixed(0)} g`),
      stat(
        'Você paga por',
        `${(weights.chargedKg * 1000).toFixed(0)} g`,
        weights.chargedSource === 'cubic' ? 'amber' : 'green',
      ),
    ]);
    root.append(grid);

    if (packing.tooManyItems) {
      root.append(banner('amber', '⚠ Mais de 50 itens — packing 3D desativado por performance.'));
    } else if (packing.fits && packing.positions.length > 0) {
      const msg = weights.chargedSource === 'real'
        ? '✓ Cenário ideal — peso real prevalece, você paga pelo peso real.'
        : '⚠ Peso cubado prevalece — caixa folgada pra carga, considere reduzir.';
      root.append(banner(weights.chargedSource === 'real' ? 'green' : 'amber', msg));
    } else if (packing.overflow.length > 0) {
      const overflowNames = packing.overflow.map(o => o.name || o.id).join(', ');
      root.append(banner('amber', `⚠ Não couberam: ${overflowNames}. Aumente a caixa.`));
    }
  }

  function stat(label, value, tone = 'zinc') {
    const valueClass = tone === 'amber' ? 'bx-stat-value bx-stat-value-amber'
                     : tone === 'green' ? 'bx-stat-value bx-stat-value-green'
                     : 'bx-stat-value';
    return el('div', { class: 'bx-stat' }, [
      el('div', { class: 'bx-stat-label' }, label),
      el('div', { class: valueClass }, value),
    ]);
  }

  function banner(tone, text) {
    return el('div', { class: `bx-banner bx-banner-${tone}` }, text);
  }

  render();
  return { rerender: render, destroy: () => clear(root) };
}
