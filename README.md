# BoxLab

Calculadora 3D de cubagem para envios CSSBuy. Site estático rodando 100% no browser, sem backend.

> 🚧 Em desenvolvimento. Veja o [plano de implementação](./docs/superpowers/plans/2026-05-08-boxlab-cubage-calculator.md) e o [spec](./docs/superpowers/specs/2026-05-08-boxlab-cubage-calculator-design.md).

## O que faz

- Adiciona itens (presets ou custom) com peso e dimensões
- Auto-pack 3D dentro da caixa (FFD3D + Extreme Points)
- Calcula volume, peso real, peso cubado (÷5000) e qual prevalece
- Recomenda o melhor frete CSSBuy entre 11 opções, considerando ranking de cobertura de seguro, faixa de peso aceita e restrições de commodity
- Persiste itens e configurações no localStorage

## Stack

HTML + ES Modules nativos (sem build step) · Tailwind v4 (Play CDN) · FlyonUI · Three.js · `node --test`

## Rodando localmente

```bash
npm run serve
# abre http://localhost:8080
```

A importação dinâmica de JSON exige HTTP — não funciona com `file://`.

## Testes

```bash
npm test
```

Os módulos puros (`state/`, `packing/`, `freight/`) têm cobertura via `node --test`. UI e Three.js são testados manualmente no browser.

## Deploy

GitHub Pages servindo a raiz da `main`:

1. Push pra `main`
2. **Settings** → **Pages** → Source: branch `main`, path `/`
3. Site fica em `https://gxdevs.github.io/boxlab/`

Sem build, sem CI obrigatório pra deploy.

## Estrutura

```
index.html              shell, importmap, CDN
src/
  main.js               orquestra tudo
  state/store.js        pub/sub + persist
  data/                 presets e fretes em JSON
  packing/              FFD3D + volume mods
  freight/              weight + scorer
  ui/                   componentes DOM
  three/                cena, caixa, items
tests/                  espelha src/
docs/superpowers/       spec + plano de implementação
```

## Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) — convenção de branches, conventional commits, fluxo de PR.

## Limitações conhecidas

- Apenas Brasil como destino
- Itens cuboides apenas (sem cilindros)
- Preço dos fretes em ranges qualitativos (cheap/medium/expensive)
- Sem split em múltiplas caixas
- FFD heurístico — não garante empacotamento ótimo

## Licença

[Apache License 2.0](./LICENSE) — Copyright 2026 GXDEVS.
