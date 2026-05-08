import { el, clear, card, badge } from './components.js';

const EXCLUSOES_TEXT = `🚫 O QUE O SEGURO NÃO COBRE:
• Taxas alfandegárias, impostos ou multas governamentais
• Apreensão alfandegária por falta de documentos (RCV, RCE, CNPJ)
• Informações incompletas do destinatário (CPF/nome divergentes, endereço errado, nome incompleto)
• Endereço incorreto fornecido pelo cliente
• Declaração falsa ou itens ocultos
• Itens frágeis sem proteção extra (ex: celular só com plástico bolha)
• Pequenos amassados ou danos na embalagem externa
• Itens restritos ou proibidos (drones, pirataria, etc.)
• Custos de frete de devolução para DHL, UPS, FedEx ou Aramex`;

export function mount(root, getFreightResult) {
  let collapsed = true;

  function render() {
    clear(root);
    const r = getFreightResult();
    if (!r) {
      root.append(card('Frete', el('p', { class: 'text-zinc-500 text-sm' }, 'Aguardando dados.')));
      return;
    }
    const { recommended, compatible, incompatible } = r;

    if (recommended) {
      root.append(card('★ Frete recomendado', freightCard(recommended, true)));
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
        class: 'text-xs underline text-zinc-400',
        onclick: () => { collapsed = !collapsed; render(); },
      }, `${collapsed ? '▸' : '▾'} Não compatíveis (${incompatible.length})`);
      const list = collapsed ? null : el('div', { class: 'space-y-2 mt-2' }, incompatible.map(incompatibleRow));
      root.append(card(null, el('div', {}, [toggle, list])));
    }

    root.append(card('Exclusões do seguro', el('pre', {
      id: 'exclusoes',
      class: 'whitespace-pre-wrap text-xs text-zinc-400 font-sans',
    }, EXCLUSOES_TEXT)));
  }

  function freightCard(scored, isRecommended) {
    const f = scored.freight;
    const priceTone = f.priceTier === 'cheap' ? 'green' : f.priceTier === 'expensive' ? 'red' : 'amber';
    return el('div', {
      class: `rounded-lg p-3 border ${isRecommended ? 'border-green-600 bg-green-900/10' : 'border-zinc-700 bg-zinc-900/40'}`,
    }, [
      el('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        el('span', { class: 'font-semibold' }, f.name),
        badge(`¥${f.insuranceMax} seguro`, 'green'),
        badge(`${f.weightRange.min}-${f.weightRange.max}kg`, 'blue'),
        badge(f.priceTier, priceTone),
        badge(f.type, 'zinc'),
      ]),
      f.notes ? el('div', { class: 'text-xs text-zinc-400 mt-1' }, f.notes) : null,
      isRecommended ? scoreBreakdown(scored.breakdown, scored.score) : null,
    ]);
  }

  function scoreBreakdown(b, score) {
    return el('div', { class: 'text-xs text-zinc-400 mt-2 grid grid-cols-2 gap-x-4' }, [
      el('span', {}, `Seguro: ${(b.insurance * 100).toFixed(0)}%`),
      el('span', {}, `Preço: ${(b.price * 100).toFixed(0)}%`),
      el('span', {}, `Tipo: ${(b.type * 100).toFixed(0)}%`),
      el('span', {}, `Headroom: ${(b.headroom * 100).toFixed(0)}%`),
      el('span', { class: 'col-span-2 text-zinc-300' }, `Score total: ${score.toFixed(1)}/100`),
    ]);
  }

  function incompatibleRow({ freight, reasons }) {
    return el('div', { class: 'rounded-lg p-2 border border-red-900/50 bg-red-900/10' }, [
      el('div', { class: 'font-semibold text-sm' }, freight.name),
      el('ul', { class: 'list-disc ml-4 text-xs text-red-300' },
        reasons.map(r => el('li', {}, r))),
    ]);
  }

  render();
  return { rerender: render, destroy: () => clear(root) };
}
