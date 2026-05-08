# CSSBuy Freight Rules — Design

**Data:** 2026-05-08
**Status:** Aprovado — pronto pra plano de implementação
**Spec original:** `2026-05-08-boxlab-cubage-calculator-design.md` (escopo da v1)

## 1. Motivação

O scorer atual modela frete CSSBuy só com 11 entries hardcoded e regra binária `restrictions.forbidden`. Faltam:

- Catálogo real (CSSBuy mostra ~22+ fretes pra Brasil — capturei via `cssbuy.com/estimates`)
- Divisor volumétrico por frete (5000 padrão, alguns 6000, China Post family ignora cubagem)
- Transit time (afeta escolha entre rápido/lento)
- Restrições mais granulares (battery na maioria dos fretes; alguns aceitam só com surcharge)

## 2. Fonte dos dados

CSSBuy não publica tabela de regras. Fonte é a página de cálculo `https://www.cssbuy.com/estimates`:

- Calculadora retorna lista ordenada por preço com badges "Pure Weight" vs "volume", transit, insurance max
- Quando uma commodity é marcada (ex: Battery), cada frete ganha aviso inline "This delivery method cannot transport Battery goods"
- Captura: 2026-05-08, weight 1kg, 20×15×10 cm, destino Brasil
- Lista observada: 19 fretes na consulta sem commodity; com Battery, ~17 ficam incompatíveis e ~2 (JD-EXP-EF Battery-line, GZ-BR-F:B) seguem compatíveis

Header `"_source"` + `"_capturedAt"` no JSON documenta origem. Re-captura é manual.

## 3. Schema do frete

```json
{
  "id": "fj-br-exp-f-3-20",
  "name": "FJ-BR-EXP-F",
  "weightRange": { "min": 3, "max": 20 },
  "insuranceMax": 5000,
  "type": "express",
  "priceTier": "medium",
  "destinations": ["BR"],
  "restrictions": { "forbidden": ["battery", "liquid"] },

  "volumetricDivisor": 5000,
  "pureWeight": false,
  "transitDays": { "min": 12, "max": 30 },
  "notes": "..."
}
```

Campos novos:

- `volumetricDivisor: number | null` — `null` indica linha de peso real puro (China Post family, EMS, EUB, Postnl). Caso contrário 5000 (padrão) ou 6000.
- `pureWeight: bool` — derivado: `volumetricDivisor === null`. Mantido redundante pra leitura fácil de UI.
- `transitDays: { min, max }` — em dias. Usado pra UI (badge) e pra score (premia rápido).

`type` ganha valores: `express | ems | sal | seamail | eub | battery | duty-free`.

`restrictions.forbidden`: array de commodity keys (mesmas chaves do form). Marca `inferred` no JSON-comment pra restrições não confirmadas (`liquid`, `magnetic`, `powder`) — UI pode futuro mostrar "?" — não implementado nesta rodada.

## 4. Catálogo (Brasil, observado)

22 entries cobrindo:

- Express com cubagem: TYG-BR-EXP-F · FJ-BR-EXP-F (0-3kg + 3-20kg) · GZ-BR-F:P · GZ-BR-F:E (0-2kg + 2-30kg) · GZ-BR-F:B · JD-EXP-EF · Duty-Free-BR P/F/E
- Battery dedicada: JD-EXP-EF Battery-line
- EMS pure weight: HZ-EMS · BJ-E-EMS
- EUB pure weight: BJ-EUB · SC-EUB · SZ-EUB-E · Postnl-D
- China Post family: SAL · Sea Mail · Big Air Mail
- Sea: SH-SAL-BR

Insurance e transit observados na captura. Faixas de peso conforme cada code (ex: `:0-3kg`, `:0-30KG`). Multiplas faixas do mesmo code (ex: GZ-BR-F:E 0-2kg vs 2-30kg) são entries separadas com IDs diferentes.

## 5. Pipeline

### 5.1 Weight

`calcWeights(items, box)` retorna `{ realWeightG, realWeightKg, volumeCm3 }`. Removido `chargedKg`/`cubicWeightKg` daqui — passam a ser por-frete.

Novo helper:

```js
chargedKgFor(weights, freight) {
  if (freight.volumetricDivisor == null) return weights.realWeightKg;
  const cubic = weights.volumeCm3 / freight.volumetricDivisor;
  return Math.max(weights.realWeightKg, cubic);
}
```

### 5.2 Scorer

Gates inalterados:

- G1: `chargedKgFor(weights, freight)` está dentro de `weightRange`
- G2: `destinations.includes(country)`
- G3: `restrictions.forbidden ∩ commodityAttrs == ∅`

Score (pesos somam 1.0):

| Critério | Peso | Fórmula |
|---|---|---|
| Insurance | 0.40 | `insuranceMax / 5000` clamped 0–1 |
| Price | 0.20 | `PRICE_SCORE[priceTier]` |
| Type | 0.15 | `TYPE_SCORE[type]` |
| Headroom | 0.15 | `1 − 2·|charged − mid| / (max − min)` |
| **Transit (novo)** | **0.10** | `1 − avg(transitDays.min, max)/60` clamped |

Reasons no array `incompatible`: cada commodity proibida vira uma linha separada (`Não aceita Battery`, `Não aceita Liquid`), em vez de juntar numa string.

### 5.3 results-panel

Card "Você paga por" mostra **min entre fretes compatíveis** (não global). Tooltip: "Varia por frete; melhor caso entre compatíveis".

### 5.4 freight-list

Cada card adiciona badges:

- `🕒 12-30d` — transit
- `📦 cubado ÷5000` ou `⚖️ peso real` — modelo de cobrança
- "Você paga por: Xg (real|cubado)" — peso cobrado por esse frete específico

Score breakdown: 5 barras (insurance, price, type, headroom, transit).

Banner contextual: se commodity selecionado filtra ≥50% dos fretes, sugere a alternativa (ex: "Battery filtra 17 fretes. Use JD-EXP-EF Battery-line.").

## 6. Testes

### Novos / modificados

`tests/freight/weight.test.js`:

- `chargedKgFor` com `volumetricDivisor=null` → real
- `chargedKgFor` com divisor 6000 produz cubic menor que com 5000
- `chargedKgFor` retorna max(real, cubic)

`tests/freight/scorer.test.js`:

- Pesos somam 1.0 (regression)
- Transit influencia score
- Frete pure-weight passa G1 mesmo com volume grande (porque charged = real)
- Reasons listam restrictions linha-a-linha

`tests/data/freights.test.js` (novo):

- Schema válido em todos os entries
- IDs únicos
- `pureWeight === (volumetricDivisor === null)`
- `weightRange.min ≤ weightRange.max`
- `restrictions.forbidden` contém só keys do conjunto válido
- `transitDays.min ≤ transitDays.max`

Total: 41 → ~50.

## 7. Smoke checklist

- [ ] Página carrega, sem erros novos no console
- [ ] Lista mostra ~22 fretes (compatíveis + incompatíveis combinados)
- [ ] `commodityAttrs=['battery']` → JD-EXP-EF Battery-line + GZ-BR-F:B compatíveis; resto na seção colapsável com motivo "Não aceita Battery"
- [ ] Frete pure-weight (China Post Sea Mail): aumentar dimensões da caixa não muda peso cobrado mostrado
- [ ] Frete cubado: aumentar dimensões muda peso cobrado mostrado por esse card
- [ ] Banner contextual aparece quando battery filtra mais da metade

## 8. Fora de escopo

- Outros países além de BR
- Surcharges (ex: bateria com taxa extra)
- Auto-update do JSON via scrape (decisão consciente — viola estaticidade do site)
- Validação de inferred restrictions (`liquid`, `magnetic`) — flag fica no comment, UX "?" depois
- Preferência fast/cheap configurável (score balanceado já guia)

## 9. Decisões registradas

| # | Decisão | Razão |
|---|---|---|
| 1 | Modelo estático em JSON, não scraping | Mantém site puro/estático, sem CORS/quebra |
| 2 | Per-freight charged weight | Realidade: divisor varia, China Post = real puro |
| 3 | Transit como 5º peso, 10% | Diferenciador real entre fretes (10-30d vs 60-180d) |
| 4 | Reasons linha-a-linha | UX da própria CSSBuy é assim; mais legível |
| 5 | Inferred flag por restriction | Honesto sobre incerteza; sem bloquear lançamento |
| 6 | Header `_source` / `_capturedAt` | Manutenibilidade — quem atualiza saberá quando foi capturado |
