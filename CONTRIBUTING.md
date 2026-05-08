# Contribuindo com o BoxLab

Obrigado pelo interesse! Este guia descreve como abrir issues, branches, commits e pull requests.

## Antes de começar

- Leia o [README](./README.md) pra entender o que é o projeto
- Veja o spec em `docs/superpowers/specs/` e o plano de implementação em `docs/superpowers/plans/`
- Instale Node 20+ (testes usam `node --test`)

```bash
npm install   # apenas pra resolver scripts (sem dependências runtime)
npm test      # roda os testes
npm run serve # serve a página localmente em http://localhost:8080
```

## Fluxo

```
issue → branch → commits → pull request → review → squash merge em main
```

A branch `main` é sempre deployable (GitHub Pages serve direto dela).

## Issues

Abra uma issue antes de PRs grandes. Use os templates:

- **Bug**: o que aconteceu, passos, comportamento esperado
- **Feature**: motivação, proposta, alternativas consideradas

Pra correções pequenas (typos, lint), pode pular a issue.

## Branches

Sempre saia da `main` atualizada:

```bash
git checkout main
git pull origin main
git checkout -b <tipo>/<descricao-curta>
```

**Convenção de nome:** `<tipo>/<kebab-case>`

| Prefixo | Quando usar |
|---|---|
| `feat/` | nova funcionalidade |
| `fix/` | bugfix |
| `docs/` | só documentação |
| `chore/` | tooling, config, deps |
| `refactor/` | refactor sem mudança de comportamento |
| `test/` | só testes |
| `perf/` | melhoria de performance |

Exemplos: `feat/three-orbit-controls`, `fix/cubic-weight-rounding`, `docs/contributing-guide`.

## Commits — Conventional Commits

Mensagem no formato:

```
<tipo>(<escopo opcional>): <descrição curta>

<corpo opcional explicando o "porquê", não o "o quê">
```

**Tipos**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `style`, `build`, `ci`.

**Exemplos**:

- `feat(packing): add First-Fit Decreasing 3D algorithm`
- `fix(freight): correct headroom score when min equals max`
- `docs: explain volumetric weight formula in README`
- `refactor(state): extract persist logic into helper`

**Regras**:

- Descrição em minúsculas, sem ponto final
- ≤72 caracteres na primeira linha
- Imperativo (`add`, não `added`)
- Cada commit deve passar nos testes (`npm test`)
- Commits frequentes e pequenos > commits grandes ocasionais

## Pull Requests

1. Push da branch:

   ```bash
   git push -u origin <tipo>/<descricao>
   ```

2. Abra o PR pra `main`, preencha o template

3. Marque issue relacionada com `Closes #<N>` no corpo do PR

4. Espere o CI rodar (`.github/workflows/ci.yml` executa `npm test`)

5. Resolva comentários do review

6. Quando aprovado, será feito **squash merge** pra manter o histórico de `main` linear

### Checklist do PR

- [ ] `npm test` passa local
- [ ] Mudanças cobertas por teste (módulos puros) ou smoke manual descrito (UI/Three)
- [ ] Sem `console.log` esquecido
- [ ] README/docs atualizados se UI ou comportamento mudou
- [ ] Sem arquivos não relacionados ao escopo do PR

## Estilo de código

- **JS**: ES Modules nativos, `const`/`let` (nunca `var`), arrow functions onde fizer sentido
- **JSON**: 2 espaços, sem trailing commas
- **Markdown**: linhas curtas, listas com `-`, code fences com linguagem
- Sem framework reativo — store próprio com pub/sub
- Módulos puros (`state/`, `packing/`, `freight/`) **não** podem importar `ui/` nem `three/`

## Testes

- Módulos puros: `node --test` (built-in)
- UI/Three: smoke manual no browser, descrito no PR

```bash
npm test                                    # tudo
node --test tests/packing/ffd3d.test.js     # arquivo específico
```

## Reportando vulnerabilidades

Pra problemas de segurança, **não abra issue pública**. Mande pra security@boxlab.invalid (ou contato direto com mantenedores no GitHub).

## Código de conduta

Seja respeitoso. Não toleramos assédio, discriminação ou comportamento hostil. Decisões finais cabem aos mantenedores.
