import { el, clear, card } from './components.js';

export function mount(root, getResults) {
  function render() {
    clear(root);
    const r = getResults();
    if (!r) {
      root.append(card('Resultado', el('p', { class: 'text-zinc-500 text-sm' }, 'Adicione itens pra começar.')));
      return;
    }
    const { weights, packing } = r;

    const grid = el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-2' }, [
      stat('Volume da caixa', `${weights.volumeCm3.toLocaleString('pt-BR')} cm³`),
      stat('Peso real estimado', `${weights.realWeightG.toFixed(0)} g`),
      stat('Peso cubado (÷5000)', `${(weights.cubicWeightKg * 1000).toFixed(0)} g`),
      stat('Você paga por',
        `${(weights.chargedKg * 1000).toFixed(0)} g`,
        weights.chargedSource === 'cubic' ? 'amber' : 'green'),
    ]);
    root.append(grid);

    if (packing.tooManyItems) {
      root.append(banner('amber', 'Mais de 50 itens — packing 3D desativado por performance.'));
    } else if (packing.fits && packing.positions.length > 0) {
      const msg = weights.chargedSource === 'real'
        ? '✓ Cenário ideal — peso real prevalece.'
        : '⚠ Peso cubado prevalece — caixa folgada pra carga.';
      root.append(banner(weights.chargedSource === 'real' ? 'green' : 'amber', msg));
    } else if (packing.overflow.length > 0) {
      const overflowNames = packing.overflow.map(o => o.name || o.id).join(', ');
      root.append(banner('amber', `⚠ Não couberam: ${overflowNames}. Aumente a caixa.`));
    }
  }

  const STAT_TONE = {
    zinc: '',
    green: 'text-green-400',
    amber: 'text-amber-400',
  };

  function stat(label, value, tone = 'zinc') {
    return el('div', { class: 'rounded-lg bg-zinc-900/60 border border-zinc-800 p-3' }, [
      el('div', { class: 'text-xs text-zinc-400' }, label),
      el('div', { class: `text-xl font-semibold ${STAT_TONE[tone] || ''}` }, value),
    ]);
  }

  const BANNER_TONE = {
    green: 'bg-green-900/30 border-green-700/60 text-green-300',
    amber: 'bg-amber-900/30 border-amber-700/60 text-amber-300',
  };

  function banner(tone, text) {
    return el('div', { class: `rounded-lg border p-3 text-sm ${BANNER_TONE[tone]}` }, text);
  }

  render();
  return { rerender: render, destroy: () => clear(root) };
}
