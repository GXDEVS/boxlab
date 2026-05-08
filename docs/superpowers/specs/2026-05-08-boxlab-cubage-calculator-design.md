# BoxLab — Calculadora 3D de Cubagem CSSBuy

**Data:** 2026-05-08
**Status:** Design aprovado — pronto pra plano de implementação

---

## 1. Objetivo

Página única, sem login, hospedada no GitHub Pages, que ajuda usuários do CSSBuy a:

1. Adicionar itens (com dimensões e peso) e visualizar como eles se acomodam dentro de uma embalagem (caixa ou bolsa) num preview 3D auto-empacotado.
2. Calcular volume da embalagem, peso real, peso cubado (volume / 5000) e qual prevalece (o que vai ser cobrado).
3. Recomendar o melhor frete CSSBuy a partir de uma lista de 11 fretes conhecidos, considerando faixa de peso aceita, cobertura máxima de seguro, restrições de commodity e país de destino (Brasil).
4. Mostrar avisos sobre exclusões do seguro CSSBuy.

Foco: Brasil. Sem multi-país na v1.

## 2. Stack

- **HTML + ES Modules nativos** (sem build step)
- **Tailwind v4** via CDN (Play CDN)
- **FlyonUI** via CDN (componentes acessíveis baseados em Tailwind)
- **Three.js** via importmap (CDN)
- **Deploy:** push direto pro repositório → GitHub Pages serve `index.html` da raiz
- **Persistência:** `localStorage` (chave `boxlab.v1`) para `customItems` e última config de UI
- **Sem framework reativo** — store próprio com pub/sub mínimo

Razão: o app cabe num site estático, evita CI/build, e ES modules + importmap dão isolamento de unidades sem build. Vite/Webpack ficam disponíveis se o app crescer.

## 3. Arquitetura

```
boxlab/
├── index.html                shell único, importmap com three/flyonui
├── src/
│   ├── main.js               bootstrap, conecta tudo
│   ├── state/
│   │   └── store.js          estado central + pub/sub
│   ├── data/
│   │   ├── presets-items.json     DJI Pocket 2, Telesin, etc.
│   │   ├── presets-packaging.json bolsa P/M/G, caixa P/M/G CSSBuy
│   │   └── freights.json     11 fretes (weight tiers, restrições, seguro)
│   ├── packing/
│   │   ├── ffd3d.js          First-Fit Decreasing 3D + Extreme Points
│   │   └── volume-mods.js    aplica vácuo/bolha/dropbox/plastic
│   ├── freight/
│   │   ├── scorer.js         score multi-critério + filtros (gates)
│   │   └── weight.js         peso real vs cubado (÷5000)
│   ├── ui/
│   │   ├── item-list.js      add/edit/remove items, modal preset
│   │   ├── packaging-form.js sliders C×L×A + presets + checkboxes
│   │   ├── results-panel.js  cards de volume/peso/cubado/paga-por
│   │   ├── freight-list.js   lista compatíveis + recomendado + colapsável
│   │   └── components.js     helpers que envolvem FlyonUI
│   └── three/
│       ├── scene.js          camera, lights, renderer, OrbitControls
│       ├── box-mesh.js       wireframe da caixa externa
│       └── item-mesh.js      cubos coloridos dos itens, label, hover
├── assets/
│   └── icons/                svgs locais
├── tests/                    espelha src/, node --test
└── README.md
```

**Princípios:**
- Cada módulo tem uma responsabilidade clara e interface explícita
- UI nunca toca Three.js diretamente — passa box+positions pra `three/scene.js`
- `packing/`, `freight/` e `state/` são puros (testáveis sem DOM/WebGL)
- Dados em JSON editáveis sem tocar código

## 4. Estado e fluxo de dados

```
[User input] ──▶ store.update()
                     │
                     ▼
              [pub/sub notify]
              ┌──────┴──────────┬────────────────┐
              ▼                 ▼                ▼
       packing.recalc()   freight.score()   three.render()
              │                 │                │
              ▼                 ▼                ▼
        positions[]       ranked freights   updated 3D
              │                 │                │
              └────────┬────────┴────────────────┘
                       ▼
                  results-panel
                  freight-list
                  3D viewport
```

### 4.1 Forma do estado

```js
{
  items: [
    {
      id: string,
      name: string,
      length: number,    // cm
      width: number,     // cm
      height: number,    // cm
      weight: number,    // g
      flags: {
        hasOriginalBox: bool,
        isSoft: bool,
        hasOriginalPlastic: bool
      },
      coreDims: { length, width, height } | null,  // dims sem caixa original; usado quando Drop boxes é toggled e hasOriginalBox=true. null = ignora toggle pra esse item.
      color: string      // gerado deterministicamente do hash do id
    }
  ],
  box: {
    length: number,
    width: number,
    height: number,
    type: 'bag' | 'box',
    presetId: string | null
  },
  packagingOptions: {
    priorityPackaging: bool,
    vacuum: bool,
    bubbleWrap: bool,
    dropBoxes: bool,
    removePlasticBags: bool
  },
  commodityAttrs: Set<string>,    // 'electric','liquid','battery','magnetic','cosmetics','perfume','food','knives','powder','shoes','bags','watch','seafreight','electronics'
  customItems: Item[]              // sincronizado com localStorage
}
```

País de destino é fixo `'BR'` na v1, não entra no estado.

### 4.2 Pipeline de cálculo (rodando a cada mudança aplicável)

1. `volume-mods.applyMods(items, options)` → `effectiveItems` com dimensões ajustadas. Itens originais ficam imutáveis.
2. `packing.ffd3d(effectiveItems, box)` → `{ positions, fits, overflow, suggestedMinBox }`
3. `weight.calc(items, packing.boxVolume)` → `{ realWeightG, realWeightKg, cubicWeightKg, chargedKg }`. Convenção CSSBuy: `cubicWeightKg = boxVolume_cm3 / 5000`. `realWeightKg = sum(items.weight) / 1000`. `chargedKg = max(realWeightKg, cubicWeightKg)`. UI mostra valores em g pra peso real e kg pra cubado quando útil.
4. `freight.score(charged, commodityAttrs, freights)` → `{ recommended, compatible[], incompatible[] }`
5. UI renderiza cards de resultado, lista de freights e atualiza a viewport 3D

### 4.3 Persistência

- `customItems` e última config (`box`, `packagingOptions`) → `localStorage` chave `boxlab.v1`
- Schema versionado (`{ version: 1, ... }`); se versão difere, descarta storage e recomeça
- Try/catch em parse — falha silenciosa com log

## 5. Algoritmo de packing

### 5.1 First-Fit Decreasing 3D com Extreme Points

```
1. Aplica volume-mods (vácuo, bolha, dropbox, plastic)
2. Ordena itens por volume desc
3. Inicializa extreme_points = [{0,0,0}]
4. Para cada item:
     melhor_pos = null; melhor_score = ∞
     Para cada extreme_point ep:
       Para cada uma das 6 rotações ortogonais:
         Se cabe em ep nessa rotação E não colide com itens já posicionados:
           score = ep.x + ep.y*L + ep.z*L*W   // chão > frente > esquerda
           Se score < melhor_score: salva (ep, rotação)
     Se nenhum lugar cabe:
       overflow.push(item); continue
     Posiciona item, remove ep usado
     Adiciona 3 novos extreme points: cantos +x, +y, +z do item
     Filtra eps dominados (que ficam dentro de algum item posicionado)
5. Retorna { positions, overflow, packingFootprint, suggestedMinBox }
```

Onde `suggestedMinBox` = bounding box dos itens posicionados quando há overflow, indicando a menor caixa que precisaria pra caber tudo (heurística — não garantia).

### 5.2 Decisões e limites

- **Sem rotação livre** — só permutações ortogonais das 3 dimensões (6 rotações)
- **AABB collision** simples — sem rotações angulares
- **Limit hard:** >50 itens não roda packing (perf + UX) — banner avisa
- **Itens não-cuboides:** não suportados na v1
- **Múltiplas caixas (split em envios):** não suportado na v1

### 5.3 Volume mods

| Toggle | Aplica em | Efeito |
|---|---|---|
| Vácuo | itens com `isSoft=true` | comprime maior dimensão em 30% |
| Bolha | todos | +1cm em cada uma das 3 dimensões |
| Drop boxes | itens com `hasOriginalBox=true` | substitui dims pelas do "miolo" (item armazena `coreDims` opcional; se não houver, ignora toggle pra esse item) |
| Remove plastic bags | itens com `hasOriginalPlastic=true` | −5% no volume (proporcional nas 3 dims) |

Toggles que não se aplicam ao item ficam visualmente ativos mas com tooltip "Não afeta este item".

## 6. Freight scoring

### 6.1 Modelo (`freights.json`)

```json
{
  "id": "FJ-BR-EXP-F-3-20",
  "name": "FJ-BR-EXP-F",
  "weightRange": { "min": 3, "max": 20 },
  "insuranceMax": 5000,
  "type": "express",
  "priceTier": "medium",
  "destinations": ["BR"],
  "restrictions": {
    "forbidden": [],
    "requiresExtra": ["battery"]
  },
  "notes": "Express padrão Brasil"
}
```

Os 11 fretes do ranking de cobertura são todos pré-cadastrados:

1. FJ-BR-EXP-F (3–20kg) — ¥5000
2. BJ-E-EMS (0–30kg) — ¥5000
3. TYG-BR-EXP-F (0–3kg) — ¥4000
4. GZ-BR-F:B (0–20kg) — ¥3500
5. JD-EXP-EF (0–3kg) — ¥3000
6. GZ-BR-F:P (0–30kg) — ¥3000
7. JD Battery (0–12kg) — ¥3000
8. China Post SAL (0–30kg) — ¥3000
9. China Post Sea Mail (0–20kg) — ¥3000
10. FJ-BR-EXP-F (0–3kg) — ¥2000
11. GZ-BR-F:E (0–2kg) — ¥2000

### 6.2 Score

```
Score = 100 * gates * sum(weights)

Gates (binário — falha = score 0, vai pra incompatible):
  G1: weightRange.min ≤ chargedKg ≤ weightRange.max
  G2: destinations.includes('BR')
  G3: !forbidden.intersects(commodityAttrs)
  // (Sem gate de dimensões máximas na v1 — fretes da lista não têm
  // limite dimensional separado documentado. Adicionar campo opcional
  // `maxBoxDims` se aparecer no futuro.)

Pesos (somam 1.0):
  W1 (0.45) = insuranceMax / 5000
  W2 (0.20) = priceScore(priceTier, userPref='balance')
  W3 (0.20) = typeScore(type, userPref='balance')
  W4 (0.15) = headroomScore = clamp(1 - abs(charged - mid)/(max-min)*2, 0, 1)
```

`headroomScore` penaliza fretes onde o peso está colado no limite da faixa (risco de rejeição na origem).

Estrutura de `userPref` deixada aberta (`balance` por padrão na v1; futuro: `cheap`/`fast`).

### 6.3 Saída

```js
{
  recommended: { freight, score, breakdown: { insurance, price, type, headroom } },
  compatible: [ ...ordenado por score desc ],
  incompatible: [
    {
      freight,
      reasons: [
        'Peso fora da faixa (0-3kg, você tem 4.2kg)',
        'Não aceita battery'
      ]
    }
  ]
}
```

### 6.4 UI da lista

- Card RECOMENDADO destacado (badge verde, breakdown do score visível)
- Lista compatíveis: nome, faixa peso, seguro ¥, badges (tipo, preço)
- Seção colapsável "Não compatíveis (N)" com motivo em vermelho por frete
- Tooltip "?" e link com texto completo das exclusões do seguro
- Banner fixo com aviso resumido das exclusões (no topo da seção freight)

### 6.5 Texto de exclusões do seguro

Texto literal exibido (acessível via tooltip e link):

```
🚫 O QUE O SEGURO NÃO COBRE:
• Taxas alfandegárias, impostos ou multas governamentais
• Apreensão alfandegária por falta de documentos (RCV, RCE, CNPJ)
• Informações incompletas do destinatário (CPF/nome divergentes,
  endereço errado, nome incompleto)
• Endereço incorreto fornecido pelo cliente
• Declaração falsa ou itens ocultos
• Itens frágeis sem proteção extra (ex: celular só com plástico bolha)
• Pequenos amassados ou danos na embalagem externa
• Itens restritos ou proibidos (drones, pirataria, etc.)
• Custos de frete de devolução para DHL, UPS, FedEx ou Aramex
```

## 7. UI / Layout

Tema dark (matching screenshots). Tailwind v4 + FlyonUI.

### 7.1 Desktop (≥lg)

```
┌───────────────────────────────────────────────────────────────────┐
│  BoxLab — Calculadora de Cubagem CSSBuy        [link exclusões]   │
├──────────────────────────────┬────────────────────────────────────┤
│  COLUNA ESQUERDA (form)      │  COLUNA DIREITA (preview)          │
│                              │                                    │
│  ── Items ──                 │  ┌──────────────────────────────┐  │
│  [+ Adicionar item]          │  │ slider C │ slider L │ slider A│ │
│  [card item][card item]      │  ├──────────────────────────────┤  │
│                              │  │   [3D Three.js viewport]     │  │
│  ── Embalagem ──             │  │   wireframe + cubos          │  │
│  ◉ Bolsa  ○ Caixa            │  │   OrbitControls              │  │
│  Preset: [Caixa M ▾]         │  └──────────────────────────────┘  │
│                              │  ┌─────┬─────┬─────┬─────┐         │
│  ── Opções ──                │  │ Vol │ Real│ Cub │Paga │         │
│  ☑ Bolha   ☐ Drop boxes      │  └─────┴─────┴─────┴─────┘         │
│  ☐ Vácuo   ☐ Remove plastic  │  [✓ banner status]                 │
│                              │                                    │
│  ── Atributos ──             │  ── Frete recomendado ──           │
│  ☐ Battery ☐ Liquid          │  [card destaque]                   │
│  ☐ Magnetic ☐ ...            │  ── Outros compatíveis (N) ──      │
│                              │  [cards menores]                   │
│                              │  ▸ Não compatíveis (N)             │
└──────────────────────────────┴────────────────────────────────────┘
```

### 7.2 Mobile (<lg)

Stack vertical: form em cima, sliders + 3D + resultados embaixo.

### 7.3 Componentes FlyonUI

Card, Button, Input, Range slider, Checkbox, Radio, Select, Modal (add item), Tooltip, Badge, Collapse, Toast.

### 7.4 Modal "Adicionar item"

- Tabs: `Presets` | `Custom` | `Meus salvos`
- **Presets:** grid com card (ícone, nome, dims)
- **Custom:** form (nome, dims, peso, flags `hasOriginalBox`, `isSoft`, `hasOriginalPlastic`)
- Botão "Salvar nos meus" no Custom → vai pro localStorage

### 7.5 Three.js viewport

- Câmera perspectiva, posição inicial isométrica
- OrbitControls (rotacionar, zoom; suporte mouse + touch)
- Caixa: `LineSegments` wireframe laranja semi-transparente
- Itens: `BoxGeometry`, cor única por item, opacidade 0.85, edges destacadas
- Hover/click → highlight + tooltip flutuante (nome, dims)
- Botão "Reset camera" no canto

### 7.6 Acessibilidade

- Labels em todos inputs
- Botões só-ícone com `aria-label`
- Foco visível (Tailwind ring)
- Contraste WCAG AA no dark theme

### 7.7 Performance

- Pipeline debounced 80ms quando vem de slider (evita rebuild Three.js a cada frame)
- Three.js: dispose explícito de geometries/materials no rebuild
- Add/remove de itens não tem debounce (instant)

## 8. Testing

`node --test` (built-in) nos módulos puros, manual no resto.

| Módulo | Tipo | Notas |
|---|---|---|
| `packing/ffd3d.js` | unit | fixtures: 1 cabe / N cabem / não cabe / dim 0 / volume 0 |
| `packing/volume-mods.js` | unit | vácuo só em soft, bolha em todos, drop só com flag, idempotência |
| `freight/scorer.js` | unit | gates, ranking, breakdown, charged correto |
| `freight/weight.js` | unit | charged = max(real, cubic), arredondamentos |
| `state/store.js` | unit | pub/sub, persist/restore, schema migration descarta |
| `ui/*` | manual | browser real |
| `three/*` | manual | inspeção visual + DevTools memory |

`package.json` mínimo:
```json
{ "scripts": { "test": "node --test tests/**/*.test.js" } }
```

Sem E2E, sem visual regression, sem coverage thresholds.

## 9. Error handling

| Cenário | Tratamento |
|---|---|
| `localStorage.parse` falha | try/catch silencioso, descarta storage corrompido |
| Dim/peso inválido | validação no form, submit bloqueado, toast |
| FFD3D não posiciona tudo | retorna `overflow`, banner amarelo + sugere caixa mín |
| Three.js falha ao carregar | placeholder "3D indisponível — cálculo continua" |
| Imagens preset 404 | fallback ícone genérico |
| Importmap não resolve | erro no console, página continua sem 3D |
| Sem WebGL | feature-detect, mesma mensagem do fallback Three.js |
| FlyonUI não carregado | UI degrada (sem animations) mas funcional |

### 9.1 Validações

- Dims: número positivo, max 200cm, step 0.1
- Peso: número positivo, max 50000g
- Pelo menos 1 item antes de calcular freight
- Caixa: dims ≥ menor item ou warning

### 9.2 Debug

- `?debug=1` na URL → console verbose com cada passo do pipeline + tempos
- Sem analytics, sem telemetria

### 9.3 Browser support

- Chrome/Edge/Firefox/Safari últimas 2 versões
- ES Modules + importmap → todos suportados
- Sem suporte IE / Safari <16

## 10. Fora de escopo (YAGNI)

Explicitamente não vai ser feito na v1:

- Multi-país (só Brasil)
- Preço estimado em ¥/R$ (só ranges qualitativos cheap/medium/expensive)
- Login / contas / sync entre devices
- Múltiplas caixas (split de envio)
- Itens não-cuboides (cilindros, esferas)
- Rotação livre não-ortogonal
- Preferência fast/cheap (estrutura aberta, exposto só `balance`)
- Backend, API, integração real com CSSBuy
- Internacionalização (PT-BR fixo)
- PWA / offline first
- Testes E2E

Esses ficam como possíveis evoluções futuras; o design não impede que sejam adicionados depois.

## 11. Decisões registradas

| # | Decisão | Razão |
|---|---|---|
| 1 | 3D auto-pack (vs manual / lado-a-lado) | usuário pediu; FFD3D viável em JS |
| 2 | Presets + custom + localStorage | reúso, sem backend |
| 3 | Presets de embalagem CSSBuy + sliders | combina conveniência + ajuste fino |
| 4 | Score híbrido recomendado + lista com badges | transparência + guidance |
| 5 | Só Brasil | maioria dos fretes da lista é -BR-, simplifica MUITO |
| 6 | 4 mods de volume (vácuo, bolha, drop, plastic) | drop+bolha são os de alto impacto; outros opcionais |
| 7 | Preço em ranges qualitativos | tabela ¥/kg muda demais, manutenção alta |
| 8 | Stack: HTML + ES modules + CDN | greenfield, GitHub Pages, sem CI |
