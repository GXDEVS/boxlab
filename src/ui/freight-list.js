import { el, clear, card, badge } from './components.js';

export function mount(root, getFreightResult) {
  let collapsed = true;

  function render() {
    clear(root);
    const r = getFreightResult();
    if (!r) {
      root.append(card('Frete', el('p', { class: 'text-white/40 text-sm' }, 'Aguardando dados.')));
      return;
    }
    const { recommended, compatible, incompatible } = r;

    if (recommended) {
      root.append(card('★ Frete recomendado', recommendedCard(recommended)));
    } else {
      root.append(card('Frete', el('p', { class: 'text-amber-400 text-sm' },
        'Nenhum frete compatível com peso/restrições atuais.')));
    }

    const others = compatible.filter(x => x.freight.id !== recommended?.freight.id);
    if (others.length) {
      root.append(card(`Outros compatíveis (${others.length})`,
        el('div', { class: 'space-y-2' }, others.map(x => freightCard(x, false)))));
    }

    if (incompatible.length) {
      const toggle = el('button', {
        type: 'button',
        class: 'text-xs text-white/50 hover:text-white/80 transition-colors flex items-center gap-1',
        onclick: () => { collapsed = !collapsed; render(); },
      }, [
        el('span', {}, collapsed ? '▸' : '▾'),
        el('span', {}, `Não compatíveis (${incompatible.length})`),
      ]);
      const list = collapsed ? null : el('div', { class: 'space-y-2 mt-3' }, incompatible.map(incompatibleRow));
      root.append(card(null, el('div', {}, [toggle, list])));
    }
  }

  function recommendedCard(scored) {
    const f = scored.freight;
    return el('div', {
      class: 'rounded-xl p-4 space-y-3',
      style: {
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.10), rgba(34, 211, 238, 0.05))',
        border: '1px solid rgba(52, 211, 153, 0.35)',
        boxShadow: '0 0 0 1px rgba(52, 211, 153, 0.05) inset, 0 30px 60px -30px rgba(16, 185, 129, 0.3)',
      },
    }, [
      el('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        el('span', { class: 'font-bold text-base' }, f.name),
        badge(`¥${f.insuranceMax} seguro`, 'green'),
        badge(`${f.weightRange.min}-${f.weightRange.max}kg`, 'blue'),
        badge(priceLabel(f.priceTier), priceTone(f.priceTier)),
        badge(f.type, 'cyan'),
      ]),
      f.notes ? el('div', { class: 'text-xs text-white/60' }, f.notes) : null,
      scoreBreakdown(scored.breakdown, scored.score),
    ]);
  }

  function freightCard(scored, isRecommended) {
    const f = scored.freight;
    return el('div', {
      class: 'rounded-lg p-3 transition-colors hover:bg-white/[0.03]',
      style: {
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      },
    }, [
      el('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        el('span', { class: 'font-semibold' }, f.name),
        badge(`¥${f.insuranceMax}`, 'green'),
        badge(`${f.weightRange.min}-${f.weightRange.max}kg`, 'blue'),
        badge(priceLabel(f.priceTier), priceTone(f.priceTier)),
        badge(f.type, 'cyan'),
      ]),
      f.notes ? el('div', { class: 'text-xs text-white/50 mt-1' }, f.notes) : null,
    ]);
  }

  function priceLabel(tier) {
    return tier === 'cheap' ? 'barato' : tier === 'expensive' ? 'caro' : 'médio';
  }
  function priceTone(tier) {
    return tier === 'cheap' ? 'green' : tier === 'expensive' ? 'red' : 'amber';
  }

  function scoreBreakdown(b, score) {
    const bar = (label, val) => el('div', { class: 'flex items-center gap-2' }, [
      el('span', { class: 'text-xs text-white/60 w-20' }, label),
      el('div', { class: 'flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden' }, [
        el('div', {
          class: 'h-full',
          style: {
            width: `${Math.min(100, val * 100 / 0.5)}%`,
            background: 'linear-gradient(90deg, #34d399, #22d3ee)',
          },
        }),
      ]),
      el('span', { class: 'text-xs text-white/70 tabular w-10 text-right' }, `${(val * 100).toFixed(0)}%`),
    ]);
    return el('div', { class: 'space-y-1.5 pt-2 border-t border-white/5' }, [
      bar('Seguro', b.insurance),
      bar('Preço', b.price),
      bar('Tipo', b.type),
      bar('Headroom', b.headroom),
      el('div', { class: 'flex justify-between items-center pt-1 mt-1 border-t border-white/5' }, [
        el('span', { class: 'text-xs uppercase tracking-wide text-white/40 font-medium' }, 'Score total'),
        el('span', { class: 'text-base font-bold tabular text-emerald-400' }, `${score.toFixed(1)} / 100`),
      ]),
    ]);
  }

  function incompatibleRow({ freight, reasons }) {
    return el('div', {
      class: 'rounded-lg p-2.5',
      style: {
        background: 'rgba(244, 63, 94, 0.04)',
        border: '1px solid rgba(244, 63, 94, 0.18)',
      },
    }, [
      el('div', { class: 'font-semibold text-sm' }, freight.name),
      el('ul', { class: 'mt-1 text-xs text-rose-300 space-y-0.5' },
        reasons.map(r => el('li', { class: 'flex gap-1.5' }, [
          el('span', { class: 'text-rose-500' }, '•'),
          el('span', {}, r),
        ]))),
    ]);
  }

  render();
  return { rerender: render, destroy: () => clear(root) };
}
