# BoxLab Cubage Calculator — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, GitHub Pages-hosted single-page app that helps CSSBuy shoppers calculate volumetric cubage with a 3D auto-pack preview and recommends the best CSSBuy freight from an 11-option ranking.

**Architecture:** Vanilla JS with native ES Modules (no build step). Pure logic modules (`state`, `packing`, `freight`) are unit-tested with `node --test`. UI modules render through FlyonUI components. Three.js renders the 3D preview. A central `store.js` with pub/sub coordinates state changes. JSON files hold preset and freight data.

**Tech Stack:** HTML + ES Modules • Tailwind v4 (Play CDN `@tailwindcss/browser`) • FlyonUI (CDN) • Three.js (importmap) • `node --test` • localStorage for persistence • GitHub Pages

**Spec:** `docs/superpowers/specs/2026-05-08-boxlab-cubage-calculator-design.md`

---

## File Structure

Files created in this plan:

```
boxlab/
├── index.html                          shell, importmap, FlyonUI/Tailwind CDN
├── package.json                        only: test script + minimal metadata
├── .gitignore
├── README.md                           how to run, how to deploy
├── src/
│   ├── main.js                         bootstrap, wires modules to store
│   ├── state/
│   │   └── store.js                    pub/sub + persist + restore
│   ├── data/
│   │   ├── presets-items.json
│   │   ├── presets-packaging.json
│   │   └── freights.json
│   ├── packing/
│   │   ├── ffd3d.js                    First-Fit Decreasing 3D + Extreme Points
│   │   └── volume-mods.js              vácuo / bolha / drop / plastic
│   ├── freight/
│   │   ├── weight.js                   real, cubic, charged
│   │   └── scorer.js                   gates + score + breakdown
│   ├── ui/
│   │   ├── components.js               FlyonUI helpers
│   │   ├── item-list.js                add/edit/remove + modal
│   │   ├── packaging-form.js           sliders + presets + options
│   │   ├── results-panel.js            4 cards + status banner
│   │   └── freight-list.js             recommended + compatible + collapsed
│   └── three/
│       ├── scene.js                    camera, lights, OrbitControls
│       ├── box-mesh.js                 wireframe da caixa
│       └── item-mesh.js                cubos + hover tooltip
├── assets/
│   └── icons/
└── tests/
    ├── state/
    │   └── store.test.js
    ├── packing/
    │   ├── volume-mods.test.js
    │   └── ffd3d.test.js
    └── freight/
        ├── weight.test.js
        └── scorer.test.js
```

Boundaries:
- `state/`, `packing/`, `freight/` are **pure** (no DOM, no globals, no fetch). They're imported by tests directly.
- `ui/` and `three/` are the only modules that touch the DOM / WebGL.
- `main.js` is the only orchestrator. Other modules expose explicit functions and don't import each other across the pure/UI boundary.

---

## Chunk 1: Project scaffold

### Task 1.1: Initialize repository and basic files

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/.gitignore`
- Create: `/home/gxdev/Projetos/BoxLab/package.json`
- Create: `/home/gxdev/Projetos/BoxLab/README.md`

- [ ] **Step 1: Initialize git**

```bash
cd /home/gxdev/Projetos/BoxLab
git init -b main
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.DS_Store
*.log
.vscode/
.idea/
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "boxlab",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Calculadora 3D de cubagem CSSBuy",
  "scripts": {
    "test": "node --test tests/**/*.test.js",
    "serve": "python3 -m http.server 8080"
  }
}
```

- [ ] **Step 4: Create `README.md` skeleton**

```markdown
# BoxLab

Calculadora 3D de cubagem para envios CSSBuy. Brasil-first.

## Rodando localmente

```bash
npm run serve
# abre http://localhost:8080
```

## Testes

```bash
npm test
```

## Deploy

Push pra branch `main`. GitHub Pages serve a raiz.
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json README.md
git commit -m "chore: initialize project scaffold"
```

### Task 1.2: Create directory structure

**Files:**
- Create: dir tree under `src/` and `tests/`
- Create: `assets/icons/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/state src/data src/packing src/freight src/ui src/three
mkdir -p tests/state tests/packing tests/freight
mkdir -p assets/icons
touch assets/icons/.gitkeep
```

- [ ] **Step 2: Commit empty structure**

```bash
git add assets/
git commit -m "chore: scaffold directory structure"
```

### Task 1.3: HTML shell with importmap and CDN

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/index.html`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="pt-BR" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BoxLab — Calculadora de Cubagem CSSBuy</title>

    <!-- Tailwind v4 Play CDN -->
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

    <!-- FlyonUI -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flyonui@latest/dist/full.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/flyonui@latest/flyonui.js" defer></script>

    <!-- Importmap for ES module aliases (three) -->
    <script type="importmap">
      {
        "imports": {
          "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
          "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
        }
      }
    </script>

    <style>
      html, body { height: 100%; }
      body { background: #0b0e14; color: #e5e7eb; }
      #three-viewport { width: 100%; aspect-ratio: 16 / 9; background: #0f1218; border-radius: 0.75rem; }
    </style>
  </head>
  <body class="font-sans antialiased">
    <div id="app" class="min-h-screen p-4 lg:p-8 max-w-7xl mx-auto">
      <header class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold">BoxLab — Calculadora de Cubagem CSSBuy</h1>
        <a href="#exclusoes" class="text-sm underline">Exclusões do seguro</a>
      </header>

      <main class="grid lg:grid-cols-2 gap-6">
        <section id="form-column" class="space-y-6"></section>
        <section id="preview-column" class="space-y-6"></section>
      </main>
    </div>

    <script type="module" src="./src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Smoke test in browser**

```bash
npm run serve
# open http://localhost:8080
# expected: page loads, dark bg, header visible, no console errors
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: HTML shell with Tailwind + FlyonUI + Three.js importmap"
```

### Task 1.4: main.js stub

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/main.js`

- [ ] **Step 1: Write minimal `main.js`**

```js
// Bootstrap. Modules will be wired here as they're added.
console.log('[boxlab] booting');
```

- [ ] **Step 2: Reload browser, confirm console message**

Expected: `[boxlab] booting` in DevTools console.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: main.js stub"
```

---

## Chunk 2: Data files

These are the static JSON catalogs the app consumes. Keep small at first; grow later.

### Task 2.1: Presets — items (catalog)

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/data/presets-items.json`

- [ ] **Step 1: Write JSON**

```json
[
  {
    "id": "dji-pocket-2",
    "name": "DJI Pocket 2 (com capa)",
    "length": 13,
    "width": 4,
    "height": 3.5,
    "weight": 200,
    "flags": { "hasOriginalBox": true, "isSoft": false, "hasOriginalPlastic": true },
    "coreDims": { "length": 12, "width": 3.5, "height": 3 }
  },
  {
    "id": "telesin-case",
    "name": "Caixinha Telesin",
    "length": 7,
    "width": 5,
    "height": 4,
    "weight": 80,
    "flags": { "hasOriginalBox": true, "isSoft": false, "hasOriginalPlastic": false },
    "coreDims": { "length": 6, "width": 4, "height": 3 }
  },
  {
    "id": "tshirt-cotton",
    "name": "Camiseta de algodão",
    "length": 25,
    "width": 18,
    "height": 4,
    "weight": 200,
    "flags": { "hasOriginalBox": false, "isSoft": true, "hasOriginalPlastic": true },
    "coreDims": null
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/data/presets-items.json
git commit -m "data: initial item presets (DJI Pocket, Telesin, t-shirt)"
```

### Task 2.2: Presets — packaging (CSSBuy bag/box sizes)

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/data/presets-packaging.json`

- [ ] **Step 1: Write JSON**

```json
[
  { "id": "bag-s", "type": "bag", "name": "Bolsa P", "length": 25, "width": 20, "height": 5 },
  { "id": "bag-m", "type": "bag", "name": "Bolsa M", "length": 35, "width": 25, "height": 8 },
  { "id": "bag-l", "type": "bag", "name": "Bolsa G", "length": 45, "width": 35, "height": 12 },
  { "id": "box-s", "type": "box", "name": "Caixa P", "length": 20, "width": 15, "height": 10 },
  { "id": "box-m", "type": "box", "name": "Caixa M", "length": 30, "width": 22, "height": 15 },
  { "id": "box-l", "type": "box", "name": "Caixa G", "length": 45, "width": 35, "height": 25 }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/data/presets-packaging.json
git commit -m "data: packaging presets (bag/box S/M/L)"
```

### Task 2.3: Freights catalog

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/data/freights.json`

- [ ] **Step 1: Write JSON (11 freights from spec section 6.1)**

```json
[
  {
    "id": "fj-br-exp-f-3-20",
    "name": "FJ-BR-EXP-F",
    "weightRange": { "min": 3, "max": 20 },
    "insuranceMax": 5000,
    "type": "express",
    "priceTier": "medium",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "Express padrão Brasil — 3 a 20kg"
  },
  {
    "id": "bj-e-ems",
    "name": "BJ-E-EMS",
    "weightRange": { "min": 0, "max": 30 },
    "insuranceMax": 5000,
    "type": "ems",
    "priceTier": "medium",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "EMS — bom seguro, faixa ampla de peso"
  },
  {
    "id": "tyg-br-exp-f",
    "name": "TYG-BR-EXP-F",
    "weightRange": { "min": 0, "max": 3 },
    "insuranceMax": 4000,
    "type": "express",
    "priceTier": "medium",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "Express até 3kg"
  },
  {
    "id": "gz-br-f-b",
    "name": "GZ-BR-F:B",
    "weightRange": { "min": 0, "max": 20 },
    "insuranceMax": 3500,
    "type": "express",
    "priceTier": "medium",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "Express padrão"
  },
  {
    "id": "jd-exp-ef",
    "name": "JD-EXP-EF",
    "weightRange": { "min": 0, "max": 3 },
    "insuranceMax": 3000,
    "type": "express",
    "priceTier": "expensive",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "Express premium até 3kg"
  },
  {
    "id": "gz-br-f-p",
    "name": "GZ-BR-F:P",
    "weightRange": { "min": 0, "max": 30 },
    "insuranceMax": 3000,
    "type": "express",
    "priceTier": "medium",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "Express padrão até 30kg"
  },
  {
    "id": "jd-battery",
    "name": "JD Battery",
    "weightRange": { "min": 0, "max": 12 },
    "insuranceMax": 3000,
    "type": "battery",
    "priceTier": "expensive",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": ["battery"] },
    "notes": "Único frete que aceita itens com bateria"
  },
  {
    "id": "china-post-sal",
    "name": "China Post SAL",
    "weightRange": { "min": 0, "max": 30 },
    "insuranceMax": 3000,
    "type": "sal",
    "priceTier": "cheap",
    "destinations": ["BR"],
    "restrictions": { "forbidden": ["battery", "liquid", "magnetic"], "requiresExtra": [] },
    "notes": "Mais barato, mais lento"
  },
  {
    "id": "china-post-sea-mail",
    "name": "China Post Sea Mail",
    "weightRange": { "min": 0, "max": 20 },
    "insuranceMax": 3000,
    "type": "seamail",
    "priceTier": "cheap",
    "destinations": ["BR"],
    "restrictions": { "forbidden": ["battery", "liquid", "magnetic"], "requiresExtra": [] },
    "notes": "Mais barato ainda, demora muito"
  },
  {
    "id": "fj-br-exp-f-0-3",
    "name": "FJ-BR-EXP-F (0-3kg)",
    "weightRange": { "min": 0, "max": 3 },
    "insuranceMax": 2000,
    "type": "express",
    "priceTier": "medium",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "Mesma rota FJ, mas faixa pequena"
  },
  {
    "id": "gz-br-f-e",
    "name": "GZ-BR-F:E",
    "weightRange": { "min": 0, "max": 2 },
    "insuranceMax": 2000,
    "type": "express",
    "priceTier": "cheap",
    "destinations": ["BR"],
    "restrictions": { "forbidden": [], "requiresExtra": [] },
    "notes": "Express básico até 2kg"
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/data/freights.json
git commit -m "data: 11 CSSBuy freights with weight tiers and restrictions"
```

---

## Chunk 3: State store

### Task 3.1: Write failing test for `createStore`

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/tests/state/store.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/state/store.js';

describe('createStore', () => {
  it('returns initial state', () => {
    const store = createStore();
    const s = store.get();
    assert.deepEqual(s.items, []);
    assert.equal(s.box.type, 'box');
    assert.equal(s.packagingOptions.bubbleWrap, false);
  });

  it('update merges shallowly and notifies subscribers', () => {
    const store = createStore();
    let received = null;
    store.subscribe((s) => { received = s; });
    store.update({ items: [{ id: 'a' }] });
    assert.equal(received.items[0].id, 'a');
  });

  it('subscribe returns an unsubscribe function', () => {
    const store = createStore();
    let count = 0;
    const off = store.subscribe(() => { count++; });
    store.update({});
    off();
    store.update({});
    assert.equal(count, 1);
  });

  it('persists and restores via injected storage', () => {
    const fakeStorage = {
      data: {},
      getItem(k) { return this.data[k] ?? null; },
      setItem(k, v) { this.data[k] = v; },
    };
    const s1 = createStore({ storage: fakeStorage });
    s1.update({ box: { length: 99, width: 88, height: 77, type: 'bag', presetId: null } });

    const s2 = createStore({ storage: fakeStorage });
    assert.equal(s2.get().box.length, 99);
  });

  it('discards corrupted storage', () => {
    const fakeStorage = {
      getItem() { return '{ this is not json'; },
      setItem() {},
    };
    const s = createStore({ storage: fakeStorage });
    assert.deepEqual(s.get().items, []);
  });

  it('discards storage with wrong schema version', () => {
    const fakeStorage = {
      getItem() { return JSON.stringify({ version: 999, box: { length: 0 } }); },
      setItem() {},
    };
    const s = createStore({ storage: fakeStorage });
    assert.deepEqual(s.get().items, []);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test
```

Expected: `Cannot find module '../../src/state/store.js'`.

### Task 3.2: Implement `createStore`

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/state/store.js`

- [ ] **Step 1: Write implementation**

```js
const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'boxlab.v1';

const DEFAULT_STATE = {
  items: [],
  box: { length: 30, width: 22, height: 15, type: 'box', presetId: 'box-m' },
  packagingOptions: {
    priorityPackaging: false,
    vacuum: false,
    bubbleWrap: true,
    dropBoxes: false,
    removePlasticBags: false,
  },
  commodityAttrs: [],
  customItems: [],
};

const PERSIST_FIELDS = ['box', 'packagingOptions', 'customItems'];

export function createStore({ storage } = {}) {
  storage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);

  let state = restore(storage) ?? structuredClone(DEFAULT_STATE);
  const subscribers = new Set();

  function persist() {
    if (!storage) return;
    const payload = { version: SCHEMA_VERSION };
    for (const k of PERSIST_FIELDS) payload[k] = state[k];
    try { storage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
  }

  return {
    get: () => state,
    update(patch) {
      state = { ...state, ...patch };
      persist();
      for (const fn of subscribers) fn(state);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

function restore(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem('boxlab.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== SCHEMA_VERSION) return null;
    return { ...structuredClone(DEFAULT_STATE), ...pick(parsed, PERSIST_FIELDS) };
  } catch {
    return null;
  }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
```

- [ ] **Step 2: Run tests — expect all pass**

```bash
npm test
```

Expected: 6 passing.

- [ ] **Step 3: Commit**

```bash
git add src/state/store.js tests/state/store.test.js
git commit -m "feat(state): pub/sub store with localStorage persistence"
```

---

## Chunk 4: Packing modules

### Task 4.1: `volume-mods.js` — failing tests

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/tests/packing/volume-mods.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyMods } from '../../src/packing/volume-mods.js';

const baseItem = (over = {}) => ({
  id: 'a', name: 'a', length: 10, width: 10, height: 10, weight: 100,
  flags: { hasOriginalBox: false, isSoft: false, hasOriginalPlastic: false },
  coreDims: null,
  ...over,
});

describe('applyMods', () => {
  it('returns deep-copied items, not mutating originals', () => {
    const items = [baseItem()];
    const out = applyMods(items, {});
    out[0].length = 99;
    assert.equal(items[0].length, 10);
  });

  it('vacuum compresses largest dim of soft items by 30%', () => {
    const items = [baseItem({ length: 25, width: 18, height: 4, flags: { isSoft: true, hasOriginalBox: false, hasOriginalPlastic: false } })];
    const out = applyMods(items, { vacuum: true });
    assert.equal(out[0].length, 25 * 0.7);
  });

  it('vacuum does NOT affect non-soft items', () => {
    const items = [baseItem()];
    const out = applyMods(items, { vacuum: true });
    assert.equal(out[0].length, 10);
  });

  it('bubble adds +1cm to all dims of every item', () => {
    const items = [baseItem(), baseItem({ id: 'b', length: 5, width: 5, height: 5 })];
    const out = applyMods(items, { bubbleWrap: true });
    assert.equal(out[0].length, 11);
    assert.equal(out[1].length, 6);
  });

  it('dropBoxes uses coreDims when hasOriginalBox=true', () => {
    const items = [baseItem({
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: { length: 8, width: 7, height: 6 },
    })];
    const out = applyMods(items, { dropBoxes: true });
    assert.deepEqual([out[0].length, out[0].width, out[0].height], [8, 7, 6]);
  });

  it('dropBoxes ignores items missing coreDims', () => {
    const items = [baseItem({
      flags: { hasOriginalBox: true, isSoft: false, hasOriginalPlastic: false },
      coreDims: null,
    })];
    const out = applyMods(items, { dropBoxes: true });
    assert.equal(out[0].length, 10);
  });

  it('removePlasticBags shrinks dims by 5% on items with hasOriginalPlastic', () => {
    const items = [baseItem({ flags: { hasOriginalBox: false, isSoft: false, hasOriginalPlastic: true } })];
    const out = applyMods(items, { removePlasticBags: true });
    assert.equal(out[0].length, 10 * 0.95);
  });

  it('compose: vacuum + bubble apply in order vacuum then bubble', () => {
    const items = [baseItem({
      length: 10, width: 10, height: 10,
      flags: { isSoft: true, hasOriginalBox: false, hasOriginalPlastic: false },
    })];
    const out = applyMods(items, { vacuum: true, bubbleWrap: true });
    assert.equal(out[0].length, 10 * 0.7 + 1);
  });
});
```

- [ ] **Step 2: Run — expect failure (module missing)**

```bash
npm test
```

### Task 4.2: Implement `volume-mods.js`

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/packing/volume-mods.js`

- [ ] **Step 1: Implementation**

```js
// Order matters: dropBoxes -> removePlasticBags -> vacuum -> bubbleWrap
export function applyMods(items, options = {}) {
  return items.map((it) => {
    let out = { ...it, flags: { ...it.flags } };

    if (options.dropBoxes && out.flags.hasOriginalBox && out.coreDims) {
      out.length = out.coreDims.length;
      out.width = out.coreDims.width;
      out.height = out.coreDims.height;
    }

    if (options.removePlasticBags && out.flags.hasOriginalPlastic) {
      out.length *= 0.95;
      out.width *= 0.95;
      out.height *= 0.95;
    }

    if (options.vacuum && out.flags.isSoft) {
      const dims = ['length', 'width', 'height'];
      const largest = dims.reduce((a, b) => (out[a] >= out[b] ? a : b));
      out[largest] *= 0.7;
    }

    if (options.bubbleWrap) {
      out.length += 1;
      out.width += 1;
      out.height += 1;
    }

    return out;
  });
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 8 passing.

- [ ] **Step 3: Commit**

```bash
git add src/packing/volume-mods.js tests/packing/volume-mods.test.js
git commit -m "feat(packing): volume modifiers (vacuum, bubble, drop, plastic)"
```

### Task 4.3: `ffd3d.js` — failing tests

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/tests/packing/ffd3d.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pack } from '../../src/packing/ffd3d.js';

const item = (id, l, w, h) => ({ id, name: id, length: l, width: w, height: h, weight: 100 });

describe('pack (ffd3d)', () => {
  it('places single item that fits at origin', () => {
    const r = pack([item('a', 5, 5, 5)], { length: 10, width: 10, height: 10 });
    assert.equal(r.fits, true);
    assert.equal(r.positions.length, 1);
    assert.equal(r.overflow.length, 0);
    assert.deepEqual([r.positions[0].x, r.positions[0].y, r.positions[0].z], [0, 0, 0]);
  });

  it('reports overflow for item bigger than box', () => {
    const r = pack([item('a', 20, 5, 5)], { length: 10, width: 10, height: 10 });
    assert.equal(r.fits, false);
    assert.equal(r.overflow.length, 1);
    assert.equal(r.overflow[0].id, 'a');
  });

  it('places two items side by side along X', () => {
    const r = pack([item('a', 4, 4, 4), item('b', 4, 4, 4)], { length: 10, width: 10, height: 10 });
    assert.equal(r.fits, true);
    assert.equal(r.positions.length, 2);
    // FFD sorts by volume desc; tied items keep relative order
    const ids = r.positions.map(p => p.id).sort();
    assert.deepEqual(ids, ['a', 'b']);
  });

  it('rotates an item to make it fit', () => {
    // box 10x10x2 — item 8x2x2 fits, but item 2x2x8 only fits if rotated
    const r = pack([item('a', 2, 2, 8)], { length: 10, width: 10, height: 2 });
    assert.equal(r.fits, true);
    assert.equal(r.positions[0].rotated, true);
  });

  it('skips items with zero or negative dim, marks as overflow', () => {
    const r = pack([item('a', 0, 5, 5), item('b', 5, 5, 5)], { length: 10, width: 10, height: 10 });
    assert.equal(r.positions.length, 1);
    assert.equal(r.overflow.length, 1);
    assert.equal(r.overflow[0].id, 'a');
  });

  it('orders by volume desc (FFD)', () => {
    const items = [
      item('small', 1, 1, 1),
      item('big', 5, 5, 5),
      item('mid', 3, 3, 3),
    ];
    const r = pack(items, { length: 10, width: 10, height: 10 });
    assert.equal(r.positions[0].id, 'big');
    assert.equal(r.positions[1].id, 'mid');
    assert.equal(r.positions[2].id, 'small');
  });

  it('returns hard-limit warning when items exceed 50', () => {
    const items = Array.from({ length: 51 }, (_, i) => item(String(i), 1, 1, 1));
    const r = pack(items, { length: 10, width: 10, height: 10 });
    assert.equal(r.tooManyItems, true);
    assert.deepEqual(r.positions, []);
  });

  it('exposes packingFootprint bbox of placed items', () => {
    const r = pack([item('a', 4, 4, 4), item('b', 4, 4, 4)], { length: 10, width: 10, height: 10 });
    assert.ok(r.packingFootprint);
    assert.ok(r.packingFootprint.length >= 4);
    assert.ok(r.packingFootprint.width >= 4);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test
```

### Task 4.4: Implement `ffd3d.js`

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/packing/ffd3d.js`

- [ ] **Step 1: Implementation**

```js
const HARD_LIMIT = 50;

export function pack(items, box) {
  if (items.length > HARD_LIMIT) {
    return { fits: false, positions: [], overflow: items.slice(), tooManyItems: true, packingFootprint: null };
  }

  const valid = [];
  const invalid = [];
  for (const it of items) {
    if (it.length > 0 && it.width > 0 && it.height > 0) valid.push(it);
    else invalid.push(it);
  }

  // FFD: sort by volume desc
  valid.sort((a, b) => b.length * b.width * b.height - a.length * a.width * a.height);

  const placed = [];        // [{x,y,z, l,w,h}]
  const positions = [];      // [{id,x,y,z, dims:[l,w,h], rotated}]
  const overflow = [...invalid];
  let extremePoints = [{ x: 0, y: 0, z: 0 }];

  for (const it of valid) {
    let best = null;
    let bestScore = Infinity;

    for (const ep of extremePoints) {
      for (const rot of rotations(it)) {
        if (!fitsInBox(ep, rot, box)) continue;
        if (collides(ep, rot, placed)) continue;
        const score = ep.x + ep.y * box.length + ep.z * box.length * box.width;
        if (score < bestScore) {
          bestScore = score;
          best = { ep, rot };
        }
      }
    }

    if (!best) {
      overflow.push(it);
      continue;
    }

    const { ep, rot } = best;
    placed.push({ x: ep.x, y: ep.y, z: ep.z, l: rot.length, w: rot.width, h: rot.height });
    positions.push({
      id: it.id,
      x: ep.x, y: ep.y, z: ep.z,
      dims: [rot.length, rot.width, rot.height],
      rotated: rot.rotated,
    });

    // Update extreme points: remove used, add 3 new corners, prune dominated
    extremePoints = extremePoints.filter(p => !(p.x === ep.x && p.y === ep.y && p.z === ep.z));
    extremePoints.push({ x: ep.x + rot.length, y: ep.y, z: ep.z });
    extremePoints.push({ x: ep.x, y: ep.y + rot.width, z: ep.z });
    extremePoints.push({ x: ep.x, y: ep.y, z: ep.z + rot.height });
    extremePoints = pruneDominated(extremePoints, placed);
  }

  const fits = overflow.length === 0;
  const packingFootprint = placed.length === 0 ? null : footprint(placed);

  return { fits, positions, overflow, tooManyItems: false, packingFootprint };
}

function rotations(it) {
  const dims = [it.length, it.width, it.height];
  const seen = new Set();
  const out = [];
  // 6 permutations of (l,w,h)
  const perms = [
    [0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0],
  ];
  for (const [a,b,c] of perms) {
    const key = `${dims[a]}|${dims[b]}|${dims[c]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      length: dims[a], width: dims[b], height: dims[c],
      rotated: !(a === 0 && b === 1 && c === 2),
    });
  }
  return out;
}

function fitsInBox(ep, rot, box) {
  return ep.x + rot.length <= box.length
      && ep.y + rot.width  <= box.width
      && ep.z + rot.height <= box.height;
}

function collides(ep, rot, placed) {
  const a = { x1: ep.x, y1: ep.y, z1: ep.z, x2: ep.x + rot.length, y2: ep.y + rot.width, z2: ep.z + rot.height };
  for (const p of placed) {
    const b = { x1: p.x, y1: p.y, z1: p.z, x2: p.x + p.l, y2: p.y + p.w, z2: p.z + p.h };
    if (a.x1 < b.x2 && a.x2 > b.x1 &&
        a.y1 < b.y2 && a.y2 > b.y1 &&
        a.z1 < b.z2 && a.z2 > b.z1) return true;
  }
  return false;
}

function pruneDominated(eps, placed) {
  return eps.filter(p => !placed.some(b =>
    p.x >= b.x && p.x < b.x + b.l &&
    p.y >= b.y && p.y < b.y + b.w &&
    p.z >= b.z && p.z < b.z + b.h
  ));
}

function footprint(placed) {
  let l = 0, w = 0, h = 0;
  for (const p of placed) {
    l = Math.max(l, p.x + p.l);
    w = Math.max(w, p.y + p.w);
    h = Math.max(h, p.z + p.h);
  }
  return { length: l, width: w, height: h };
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/packing/ffd3d.js tests/packing/ffd3d.test.js
git commit -m "feat(packing): First-Fit Decreasing 3D with extreme points"
```

---

## Chunk 5: Freight modules

### Task 5.1: `weight.js` — failing tests

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/tests/freight/weight.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcWeights } from '../../src/freight/weight.js';

describe('calcWeights', () => {
  it('sums real weight in grams', () => {
    const r = calcWeights([{ weight: 200 }, { weight: 150 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.realWeightG, 350);
    assert.equal(r.realWeightKg, 0.35);
  });

  it('cubic = volume_cm3 / 5000 (kg)', () => {
    const r = calcWeights([], { length: 16, width: 10, height: 7 });
    // 1120 / 5000 = 0.224 kg
    assert.equal(r.cubicWeightKg, 1120 / 5000);
  });

  it('chargedKg = max(real, cubic)', () => {
    const r = calcWeights([{ weight: 350 }], { length: 16, width: 10, height: 7 });
    // real=0.35, cubic=0.224  -> charged=0.35
    assert.equal(r.chargedKg, 0.35);
    assert.equal(r.chargedSource, 'real');
  });

  it('cubic prevails when greater', () => {
    const r = calcWeights([{ weight: 100 }], { length: 50, width: 50, height: 50 });
    assert.equal(r.chargedSource, 'cubic');
  });
});
```

- [ ] **Step 2: Run — expect failure**

### Task 5.2: Implement `weight.js`

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/freight/weight.js`

- [ ] **Step 1: Implementation**

```js
export function calcWeights(items, box) {
  const realWeightG = items.reduce((s, it) => s + (it.weight || 0), 0);
  const realWeightKg = realWeightG / 1000;
  const volumeCm3 = box.length * box.width * box.height;
  const cubicWeightKg = volumeCm3 / 5000;
  const chargedKg = Math.max(realWeightKg, cubicWeightKg);
  const chargedSource = realWeightKg >= cubicWeightKg ? 'real' : 'cubic';
  return { realWeightG, realWeightKg, cubicWeightKg, chargedKg, chargedSource, volumeCm3 };
}
```

- [ ] **Step 2: Run tests** → all pass

- [ ] **Step 3: Commit**

```bash
git add src/freight/weight.js tests/freight/weight.test.js
git commit -m "feat(freight): real/cubic/charged weight calculator"
```

### Task 5.3: `scorer.js` — failing tests

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/tests/freight/scorer.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFreights } from '../../src/freight/scorer.js';

const FREIGHTS = [
  {
    id: 'a', name: 'A', weightRange: { min: 0, max: 3 }, insuranceMax: 5000,
    type: 'express', priceTier: 'medium', destinations: ['BR'],
    restrictions: { forbidden: [], requiresExtra: [] },
  },
  {
    id: 'b', name: 'B', weightRange: { min: 0, max: 30 }, insuranceMax: 3000,
    type: 'sal', priceTier: 'cheap', destinations: ['BR'],
    restrictions: { forbidden: ['battery'], requiresExtra: [] },
  },
  {
    id: 'c', name: 'C', weightRange: { min: 5, max: 20 }, insuranceMax: 4000,
    type: 'express', priceTier: 'medium', destinations: ['BR'],
    restrictions: { forbidden: [], requiresExtra: [] },
  },
];

describe('scoreFreights', () => {
  it('filters out by weight gate', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    const ids = r.compatible.map(x => x.freight.id);
    assert.ok(ids.includes('a'));
    assert.ok(ids.includes('b'));
    assert.ok(!ids.includes('c'));
    assert.equal(r.incompatible.find(x => x.freight.id === 'c').reasons[0].match(/Peso/), null === null ? assert.ok : assert.fail);
  });

  it('filters out by commodity gate', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: ['battery'] }, FREIGHTS);
    assert.ok(!r.compatible.find(x => x.freight.id === 'b'));
    assert.ok(r.incompatible.find(x => x.freight.id === 'b'));
  });

  it('recommended = highest score among compatible', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    // A has insurance=5000, weight in middle of 0-3 → highest
    assert.equal(r.recommended.freight.id, 'a');
  });

  it('breakdown sums to score / 100', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    const total = r.compatible[0].breakdown.insurance
                + r.compatible[0].breakdown.price
                + r.compatible[0].breakdown.type
                + r.compatible[0].breakdown.headroom;
    assert.ok(Math.abs(total * 100 - r.compatible[0].score) < 0.001);
  });

  it('compatible list ordered by score desc', () => {
    const r = scoreFreights({ chargedKg: 1, commodityAttrs: [] }, FREIGHTS);
    for (let i = 1; i < r.compatible.length; i++) {
      assert.ok(r.compatible[i-1].score >= r.compatible[i].score);
    }
  });

  it('incompatible reasons are human readable', () => {
    const r = scoreFreights({ chargedKg: 100, commodityAttrs: [] }, FREIGHTS);
    for (const inc of r.incompatible) {
      assert.ok(inc.reasons.length > 0);
      assert.ok(typeof inc.reasons[0] === 'string');
    }
  });
});
```

- [ ] **Step 2: Run — expect failure**

### Task 5.4: Implement `scorer.js`

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/freight/scorer.js`

- [ ] **Step 1: Implementation**

```js
const W = { insurance: 0.45, price: 0.20, type: 0.20, headroom: 0.15 };
const PRICE_SCORE = { cheap: 1.0, medium: 0.66, expensive: 0.33 };
const TYPE_SCORE = { express: 1.0, ems: 0.85, battery: 0.7, sal: 0.55, seamail: 0.4 };

export function scoreFreights({ chargedKg, commodityAttrs = [], country = 'BR' }, freights) {
  const compatible = [];
  const incompatible = [];

  for (const f of freights) {
    const reasons = [];
    if (chargedKg < f.weightRange.min || chargedKg > f.weightRange.max) {
      reasons.push(`Peso fora da faixa (${f.weightRange.min}-${f.weightRange.max}kg, você tem ${chargedKg.toFixed(2)}kg)`);
    }
    if (!f.destinations.includes(country)) {
      reasons.push(`Não atende ${country}`);
    }
    const blocked = (f.restrictions?.forbidden ?? []).filter(x => commodityAttrs.includes(x));
    if (blocked.length) {
      reasons.push(`Não aceita: ${blocked.join(', ')}`);
    }

    if (reasons.length) {
      incompatible.push({ freight: f, reasons });
    } else {
      const breakdown = {
        insurance: W.insurance * (f.insuranceMax / 5000),
        price:     W.price     * (PRICE_SCORE[f.priceTier] ?? 0.5),
        type:      W.type      * (TYPE_SCORE[f.type] ?? 0.5),
        headroom:  W.headroom  * headroomScore(chargedKg, f.weightRange),
      };
      const score = (breakdown.insurance + breakdown.price + breakdown.type + breakdown.headroom) * 100;
      compatible.push({ freight: f, score, breakdown });
    }
  }

  compatible.sort((a, b) => b.score - a.score);
  return { recommended: compatible[0] ?? null, compatible, incompatible };
}

function headroomScore(charged, range) {
  const min = range.min, max = range.max;
  if (max === min) return 1;
  const mid = (min + max) / 2;
  const dist = Math.abs(charged - mid);
  return Math.max(0, Math.min(1, 1 - 2 * dist / (max - min)));
}
```

- [ ] **Step 2: Run tests** → all pass

- [ ] **Step 3: Commit**

```bash
git add src/freight/scorer.js tests/freight/scorer.test.js
git commit -m "feat(freight): multi-criteria scorer with gates and breakdown"
```

---

## Chunk 6: UI modules

UI modules are not unit-tested with `node --test` (they touch DOM). They're tested manually via the browser at the end of each task.

Each UI module exposes a `mount(rootEl, store)` function that returns `{ destroy }`. The module reads from `store.get()`, subscribes to changes, and writes back via `store.update(...)`.

### Task 6.1: `components.js` — FlyonUI wrappers

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/ui/components.js`

- [ ] **Step 1: Implementation**

```js
// Small DOM helpers. Avoid frameworks.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function card(title, body) {
  return el('div', { class: 'rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3' }, [
    title ? el('h3', { class: 'text-sm font-semibold uppercase tracking-wide text-zinc-400' }, title) : null,
    body,
  ]);
}

export function badge(text, tone = 'zinc') {
  const tones = {
    zinc: 'bg-zinc-700/50 text-zinc-200',
    green: 'bg-green-700/30 text-green-300',
    red: 'bg-red-700/30 text-red-300',
    amber: 'bg-amber-700/30 text-amber-300',
    blue: 'bg-blue-700/30 text-blue-300',
  };
  return el('span', { class: `text-xs px-2 py-0.5 rounded ${tones[tone] || tones.zinc}` }, text);
}

export function button(label, onClick, variant = 'primary') {
  const styles = {
    primary: 'bg-green-600 hover:bg-green-500 text-white',
    ghost: 'bg-transparent border border-zinc-700 hover:border-zinc-500',
    danger: 'bg-red-700/40 hover:bg-red-700/70',
  };
  return el('button', { class: `px-3 py-2 rounded-lg text-sm ${styles[variant]}`, onclick: onClick }, label);
}
```

- [ ] **Step 2: Smoke check via browser console**

(no test, just sanity)

- [ ] **Step 3: Commit**

```bash
git add src/ui/components.js
git commit -m "feat(ui): minimal DOM helpers and styled primitives"
```

### Task 6.2: `item-list.js` — list with add/edit/remove

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/ui/item-list.js`

- [ ] **Step 1: Implementation**

```js
import { el, clear, card, button, badge } from './components.js';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];
const colorFor = (id) => COLORS[hash(id) % COLORS.length];
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

export function mount(root, store, presetsItems) {
  let unsub = null;

  const render = () => {
    const s = store.get();
    clear(root);

    const items = s.items;
    const list = el('div', { class: 'space-y-2' },
      items.length === 0
        ? [el('p', { class: 'text-zinc-500 text-sm' }, 'Nenhum item ainda.')]
        : items.map((it) => itemRow(it, () => removeItem(it.id))),
    );

    const addBtn = button('+ Adicionar item', () => openAddModal(presetsItems, (newItem) => addItem(newItem)));

    root.append(card('Items', el('div', {}, [list, el('div', { class: 'pt-2' }, addBtn)])));
  };

  function addItem(it) {
    const s = store.get();
    const item = { ...it, id: it.id ?? crypto.randomUUID(), color: colorFor(it.id ?? it.name) };
    store.update({ items: [...s.items, item] });
  }

  function removeItem(id) {
    const s = store.get();
    store.update({ items: s.items.filter(x => x.id !== id) });
  }

  unsub = store.subscribe(render);
  render();
  return { destroy: () => unsub?.() };
}

function itemRow(it, onRemove) {
  return el('div', { class: 'flex items-center gap-3 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800' }, [
    el('span', { class: 'inline-block w-3 h-3 rounded', style: { background: it.color } }),
    el('div', { class: 'flex-1' }, [
      el('div', { class: 'text-sm font-medium' }, it.name),
      el('div', { class: 'text-xs text-zinc-400' }, `${it.length}×${it.width}×${it.height} cm · ${it.weight} g`),
    ]),
    button('×', onRemove, 'danger'),
  ]);
}

function openAddModal(presets, onAdd) {
  const overlay = el('div', { class: 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4' });
  const dialog = el('div', { class: 'bg-zinc-900 rounded-xl p-5 w-full max-w-lg space-y-4 border border-zinc-700' });

  let activeTab = 'presets';
  const tabBtn = (key, label) => button(label, () => { activeTab = key; renderBody(); }, activeTab === key ? 'primary' : 'ghost');
  const tabs = el('div', { class: 'flex gap-2' }, [
    tabBtn('presets', 'Presets'),
    tabBtn('custom', 'Custom'),
  ]);

  const body = el('div', {});

  const close = () => overlay.remove();

  function renderBody() {
    clear(body);
    if (activeTab === 'presets') {
      body.append(el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
        presets.map((p) => button(`${p.name} — ${p.length}×${p.width}×${p.height}`, () => { onAdd({ ...p }); close(); }, 'ghost'))));
    } else {
      const inputs = {};
      const field = (k, label, type = 'number') => {
        const id = `f-${k}`;
        const i = el('input', { id, type, class: 'w-full bg-zinc-800 rounded p-2 text-sm', step: '0.1' });
        inputs[k] = i;
        return el('label', { class: 'block text-sm space-y-1' }, [el('span', { class: 'text-zinc-400' }, label), i]);
      };
      body.append(
        el('div', { class: 'space-y-3' }, [
          field('name', 'Nome', 'text'),
          el('div', { class: 'grid grid-cols-3 gap-2' }, [
            field('length', 'C (cm)'),
            field('width', 'L (cm)'),
            field('height', 'A (cm)'),
          ]),
          field('weight', 'Peso (g)'),
          el('div', { class: 'flex flex-wrap gap-3 text-sm' }, [
            checkbox('hasOriginalBox', 'Tem caixa original'),
            checkbox('isSoft', 'É macio (soft)'),
            checkbox('hasOriginalPlastic', 'Tem plástico original'),
          ]),
          button('Adicionar', () => {
            const flags = ['hasOriginalBox', 'isSoft', 'hasOriginalPlastic']
              .reduce((acc, k) => { acc[k] = document.getElementById(`f-${k}`).checked; return acc; }, {});
            const item = {
              name: inputs.name.value || 'Item sem nome',
              length: parseFloat(inputs.length.value),
              width: parseFloat(inputs.width.value),
              height: parseFloat(inputs.height.value),
              weight: parseFloat(inputs.weight.value),
              flags, coreDims: null,
            };
            if (!(item.length > 0 && item.width > 0 && item.height > 0 && item.weight > 0)) return;
            onAdd(item);
            close();
          }),
        ]));
    }
  }

  function checkbox(key, label) {
    const id = `f-${key}`;
    return el('label', { class: 'flex items-center gap-2' }, [
      el('input', { id, type: 'checkbox', class: 'accent-green-500' }),
      el('span', {}, label),
    ]);
  }

  dialog.append(
    el('div', { class: 'flex items-center justify-between' }, [
      el('h2', { class: 'text-lg font-semibold' }, 'Adicionar item'),
      button('×', close, 'ghost'),
    ]),
    tabs, body,
  );
  overlay.append(dialog);
  document.body.append(overlay);
  renderBody();
}
```

- [ ] **Step 2: Manual smoke**: load page (after `main.js` wiring later) and confirm rendering. Defer to integration step.

- [ ] **Step 3: Commit**

```bash
git add src/ui/item-list.js
git commit -m "feat(ui): item list with preset/custom modal"
```

### Task 6.3: `packaging-form.js` — sliders, presets, options

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/ui/packaging-form.js`

- [ ] **Step 1: Implementation**

```js
import { el, clear, card, button, badge } from './components.js';

const COMMODITY_OPTIONS = [
  ['electric', 'Electric'], ['liquid', 'Liquid'], ['knives', 'Knives'],
  ['powder', 'Powder'], ['shoes', 'Shoes'], ['bags', 'Bags'],
  ['food', 'Food'], ['battery', 'Battery'], ['cosmetics', 'Cosmetics'],
  ['magnetic', 'Magnetic'], ['watch', 'Watch'], ['perfume', 'Perfume'],
  ['seafreight', 'Sea freight'], ['electronics', 'Electronic Products'],
];

const PACK_OPTS = [
  ['vacuum', 'Vácuo (compress soft)'],
  ['bubbleWrap', 'Bolha'],
  ['dropBoxes', 'Drop boxes (remove caixinha)'],
  ['removePlasticBags', 'Remove plastic bags'],
];

export function mount(root, store, presetsPackaging) {
  let unsub = null;

  const render = () => {
    clear(root);
    const s = store.get();

    const presetSelect = el('select', { class: 'bg-zinc-800 rounded p-2 text-sm w-full',
      onchange: (e) => applyPreset(e.target.value),
    }, [
      el('option', { value: '' }, '— preset —'),
      ...presetsPackaging.map(p => el('option', { value: p.id, selected: s.box.presetId === p.id }, p.name)),
    ]);

    const slider = (axis, label, max = 100) => {
      const wrap = el('div', { class: 'space-y-1' });
      const value = el('span', { class: 'text-sm text-zinc-300' }, String(s.box[axis]));
      const input = el('input', {
        type: 'range', min: '1', max: String(max), step: '1', value: String(s.box[axis]),
        class: 'w-full',
        oninput: (e) => {
          const v = parseInt(e.target.value, 10);
          value.textContent = String(v);
          store.update({ box: { ...store.get().box, [axis]: v, presetId: null } });
        },
      });
      wrap.append(el('div', { class: 'flex justify-between text-xs text-zinc-400' }, [el('span', {}, label), value]), input);
      return wrap;
    };

    const typeRadios = el('div', { class: 'flex gap-3' }, [
      radio('Bolsa', s.box.type === 'bag', () => store.update({ box: { ...s.box, type: 'bag' } })),
      radio('Caixa', s.box.type === 'box', () => store.update({ box: { ...s.box, type: 'box' } })),
    ]);

    const opts = el('div', { class: 'flex flex-wrap gap-3 text-sm' },
      PACK_OPTS.map(([k, label]) => optCheck(k, label, s.packagingOptions[k], (val) => {
        store.update({ packagingOptions: { ...s.packagingOptions, [k]: val } });
      })));

    const commodity = el('div', { class: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm' },
      COMMODITY_OPTIONS.map(([k, label]) => optCheck(`c-${k}`, label, (s.commodityAttrs ?? []).includes(k), (val) => {
        const set = new Set(s.commodityAttrs ?? []);
        if (val) set.add(k); else set.delete(k);
        store.update({ commodityAttrs: [...set] });
      })));

    root.append(card('Embalagem', el('div', { class: 'space-y-3' }, [
      typeRadios,
      el('label', { class: 'block text-sm space-y-1' }, [
        el('span', { class: 'text-zinc-400' }, 'Preset'),
        presetSelect,
      ]),
      el('div', { class: 'grid grid-cols-3 gap-3' }, [
        slider('length', 'C (cm)', 100),
        slider('width', 'L (cm)', 100),
        slider('height', 'A (cm)', 60),
      ]),
    ])));

    root.append(card('Opções', opts));
    root.append(card('Atributos da carga', commodity));
  };

  function applyPreset(id) {
    const p = presetsPackaging.find(x => x.id === id);
    if (!p) return;
    store.update({ box: { length: p.length, width: p.width, height: p.height, type: p.type, presetId: p.id } });
  }

  function radio(label, checked, onChange) {
    return el('label', { class: 'flex items-center gap-2 text-sm' }, [
      el('input', { type: 'radio', name: 'box-type', checked, onchange: onChange, class: 'accent-green-500' }),
      el('span', {}, label),
    ]);
  }

  function optCheck(key, label, checked, onChange) {
    return el('label', { class: 'flex items-center gap-2' }, [
      el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked), class: 'accent-green-500' }),
      el('span', {}, label),
    ]);
  }

  unsub = store.subscribe(render);
  render();
  return { destroy: () => unsub?.() };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/packaging-form.js
git commit -m "feat(ui): packaging form with sliders, presets, options, commodity attrs"
```

### Task 6.4: `results-panel.js` — 4 cards + status banner

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/ui/results-panel.js`

- [ ] **Step 1: Implementation**

```js
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
      stat('Você paga por', `${(weights.chargedKg * 1000).toFixed(0)} g`, weights.chargedSource === 'cubic' ? 'amber' : 'green'),
    ]);
    root.append(grid);

    if (packing.tooManyItems) {
      root.append(banner('amber', 'Mais de 50 itens — packing 3D desativado por performance.'));
    } else if (packing.fits) {
      root.append(banner('green', `✓ Cenário ideal — ${weights.chargedSource === 'real' ? 'peso real prevalece' : 'peso cubado prevalece'}.`));
    } else {
      const overflowNames = packing.overflow.map(o => o.name || o.id).join(', ');
      root.append(banner('amber', `⚠ Não couberam: ${overflowNames}. Aumente a caixa.`));
    }
  }

  function stat(label, value, tone = 'zinc') {
    const tones = {
      zinc: '', green: 'text-green-400', amber: 'text-amber-400',
    };
    return el('div', { class: 'rounded-lg bg-zinc-900/60 border border-zinc-800 p-3' }, [
      el('div', { class: 'text-xs text-zinc-400' }, label),
      el('div', { class: `text-xl font-semibold ${tones[tone] || ''}` }, value),
    ]);
  }

  function banner(tone, text) {
    const tones = {
      green: 'bg-green-900/30 border-green-700/60 text-green-300',
      amber: 'bg-amber-900/30 border-amber-700/60 text-amber-300',
    };
    return el('div', { class: `rounded-lg border p-3 text-sm ${tones[tone]}` }, text);
  }

  render();
  return { rerender: render, destroy: () => clear(root) };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/results-panel.js
git commit -m "feat(ui): results panel with 4 metric cards and status banner"
```

### Task 6.5: `freight-list.js` — recommended + compatible + collapsed

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/ui/freight-list.js`

- [ ] **Step 1: Implementation**

```js
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
    }

    const others = compatible.filter(x => x.freight.id !== recommended?.freight.id);
    if (others.length) {
      root.append(card(`Outros compatíveis (${others.length})`,
        el('div', { class: 'space-y-2' }, others.map(x => freightCard(x, false)))));
    }

    if (incompatible.length) {
      const button = el('button', {
        class: 'text-xs underline text-zinc-400',
        onclick: () => { collapsed = !collapsed; render(); },
      }, `${collapsed ? '▸' : '▾'} Não compatíveis (${incompatible.length})`);
      const list = collapsed ? null : el('div', { class: 'space-y-2 mt-2' }, incompatible.map(incompatibleRow));
      root.append(card(null, el('div', {}, [button, list])));
    }

    root.append(card('Exclusões do seguro', el('pre', {
      id: 'exclusoes',
      class: 'whitespace-pre-wrap text-xs text-zinc-400',
    }, EXCLUSOES_TEXT)));
  }

  function freightCard(scored, isRecommended) {
    const f = scored.freight;
    return el('div', { class: `rounded-lg p-3 border ${isRecommended ? 'border-green-600 bg-green-900/10' : 'border-zinc-700 bg-zinc-900/40'}` }, [
      el('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        el('span', { class: 'font-semibold' }, f.name),
        badge(`¥${f.insuranceMax} seguro`, 'green'),
        badge(`${f.weightRange.min}-${f.weightRange.max}kg`, 'blue'),
        badge(f.priceTier, f.priceTier === 'cheap' ? 'green' : f.priceTier === 'expensive' ? 'red' : 'amber'),
        badge(f.type, 'zinc'),
      ]),
      el('div', { class: 'text-xs text-zinc-400 mt-1' }, f.notes || ''),
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
      el('ul', { class: 'list-disc ml-4 text-xs text-red-300' }, reasons.map(r => el('li', {}, r))),
    ]);
  }

  render();
  return { rerender: render, destroy: () => clear(root) };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/freight-list.js
git commit -m "feat(ui): freight list with recommended + compatible + collapsed incompatibles"
```

---

## Chunk 7: Three.js modules

### Task 7.1: `scene.js` — scene setup + render loop

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/three/scene.js`

- [ ] **Step 1: Implementation**

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(canvasParent) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1218);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(40, 30, 40);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  canvasParent.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(20, 30, 20);
  scene.add(dir);

  const group = new THREE.Group();
  scene.add(group);

  let raf = 0;
  function loop() {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  function resize() {
    const w = canvasParent.clientWidth;
    const h = canvasParent.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvasParent);

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.dispose();
  }

  return { scene, group, camera, controls, dispose, resetCamera: () => { camera.position.set(40, 30, 40); controls.target.set(0, 0, 0); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/three/scene.js
git commit -m "feat(three): scene + camera + orbit controls + render loop"
```

### Task 7.2: `box-mesh.js` — wireframe da caixa

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/three/box-mesh.js`

- [ ] **Step 1: Implementation**

```js
import * as THREE from 'three';

export function makeBoxMesh(box) {
  const geo = new THREE.BoxGeometry(box.length, box.height, box.width);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xff7a45 });
  const lines = new THREE.LineSegments(edges, mat);
  // Center at half-dims so origin is at minimum corner
  lines.position.set(box.length / 2, box.height / 2, box.width / 2);
  geo.dispose();
  return { mesh: lines, dispose() { edges.dispose(); mat.dispose(); } };
}
```

Note: Three.js convention here uses (x=length, y=height, z=width).

- [ ] **Step 2: Commit**

```bash
git add src/three/box-mesh.js
git commit -m "feat(three): wireframe box mesh"
```

### Task 7.3: `item-mesh.js` — cubos coloridos

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/src/three/item-mesh.js`

- [ ] **Step 1: Implementation**

```js
import * as THREE from 'three';

export function makeItemMesh(position, item) {
  const [l, w, h] = position.dims;  // l=length, w=width, h=height
  const geo = new THREE.BoxGeometry(l, h, w);  // map to (x, y=height, z=width)
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.color || '#3b82f6'),
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x + l / 2, position.z + h / 2, position.y + w / 2);
  mesh.userData = { id: item.id, name: item.name, dims: [l, w, h] };

  // Edges
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
  const lines = new THREE.LineSegments(edges, lineMat);
  mesh.add(lines);

  return {
    mesh,
    dispose() {
      geo.dispose(); mat.dispose();
      edges.dispose(); lineMat.dispose();
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/three/item-mesh.js
git commit -m "feat(three): colored item mesh with edges"
```

---

## Chunk 8: Integration in main.js + finalization

### Task 8.1: Wire everything in `main.js`

**Files:**
- Modify: `/home/gxdev/Projetos/BoxLab/src/main.js`
- Modify: `/home/gxdev/Projetos/BoxLab/index.html` (add `#three-viewport` and reset btn)

- [ ] **Step 1: Update `index.html` preview column structure**

Find the `<section id="preview-column">` element and update to:

```html
<section id="preview-column" class="space-y-6">
  <div id="three-viewport-wrap" class="relative">
    <div id="three-viewport"></div>
    <button id="reset-camera" class="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700">Reset câmera</button>
  </div>
  <div id="results"></div>
  <div id="freights"></div>
</section>
```

And update form column:

```html
<section id="form-column" class="space-y-6">
  <div id="items-mount"></div>
  <div id="packaging-mount"></div>
</section>
```

- [ ] **Step 2: Implement `main.js`**

```js
import { createStore } from './state/store.js';
import { applyMods } from './packing/volume-mods.js';
import { pack } from './packing/ffd3d.js';
import { calcWeights } from './freight/weight.js';
import { scoreFreights } from './freight/scorer.js';

import * as itemList from './ui/item-list.js';
import * as packagingForm from './ui/packaging-form.js';
import * as resultsPanel from './ui/results-panel.js';
import * as freightList from './ui/freight-list.js';

import { createScene } from './three/scene.js';
import { makeBoxMesh } from './three/box-mesh.js';
import { makeItemMesh } from './three/item-mesh.js';

import * as THREE from 'three';

const presetsItems     = await fetch('./src/data/presets-items.json').then(r => r.json());
const presetsPackaging = await fetch('./src/data/presets-packaging.json').then(r => r.json());
const freights         = await fetch('./src/data/freights.json').then(r => r.json());

const store = createStore();

// --- UI mounts ---
itemList.mount(document.getElementById('items-mount'), store, presetsItems);
packagingForm.mount(document.getElementById('packaging-mount'), store, presetsPackaging);

// --- Three.js ---
const viewport = document.getElementById('three-viewport');
let three;
try {
  three = createScene(viewport);
  document.getElementById('reset-camera').addEventListener('click', () => three.resetCamera());
} catch (e) {
  viewport.innerHTML = '<div class="p-6 text-center text-zinc-400">3D indisponível neste navegador. O cálculo continua funcionando.</div>';
  console.error('three init failed', e);
}

// --- Pipeline ---
let currentResults = null;
const results = resultsPanel.mount(document.getElementById('results'), () => currentResults);
const freightUI = freightList.mount(document.getElementById('freights'), () => currentResults?.freight ?? null);

let debounceTimer = 0;
function recompute() {
  const s = store.get();
  const effective = applyMods(s.items, s.packagingOptions);
  const packing = pack(effective, s.box);
  // attach color back to positions for three.js
  for (const p of packing.positions) {
    const orig = s.items.find(i => i.id === p.id);
    p.color = orig?.color || '#3b82f6';
    p.name = orig?.name;
  }
  const weights = calcWeights(s.items, s.box);
  const freight = scoreFreights({ chargedKg: weights.chargedKg, commodityAttrs: s.commodityAttrs ?? [] }, freights);
  currentResults = { weights, packing, freight };
  results.rerender();
  freightUI.rerender();
  if (three) renderThree(s.box, packing.positions, s.items);
}

function renderThree(box, positions, items) {
  // Clear group
  while (three.group.children.length) {
    const c = three.group.children.pop();
    c.geometry?.dispose?.();
    c.material?.dispose?.();
    three.group.remove(c);
  }
  // Box wireframe
  const { mesh: boxMesh } = makeBoxMesh(box);
  // re-center group so the box is centered on origin
  three.group.position.set(-box.length / 2, -box.height / 2, -box.width / 2);
  three.group.add(boxMesh);
  // Items
  for (const p of positions) {
    const item = items.find(i => i.id === p.id);
    if (!item) continue;
    const { mesh } = makeItemMesh(p, { ...item, color: p.color });
    three.group.add(mesh);
  }
  // Adjust camera distance based on box diagonal
  const diag = Math.hypot(box.length, box.width, box.height);
  three.camera.far = Math.max(1000, diag * 5);
  three.camera.updateProjectionMatrix();
}

store.subscribe(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(recompute, 80);
});

recompute();

if (new URL(location.href).searchParams.get('debug') === '1') {
  window.__boxlab = { store, recompute };
  console.log('[boxlab] debug mode on, window.__boxlab available');
}
```

- [ ] **Step 3: Smoke test in browser**

```bash
npm run serve
# open http://localhost:8080
```

Manual test checklist:
- [ ] Page loads without console errors
- [ ] Add a preset item → appears in list, 3D shows a cube
- [ ] Add a second item → 3D packs both
- [ ] Move sliders → 3D box changes size, items reposition
- [ ] Switch to a smaller preset packaging → some items report overflow
- [ ] Toggle Bolha → items grow slightly in 3D
- [ ] Toggle Drop boxes → preset items with `coreDims` shrink
- [ ] "Você paga por" turns amber when cubic > real
- [ ] Frete recomendado updates as weight changes
- [ ] Marcar `battery` → "JD Battery" sobe na lista, outros viram incompatíveis
- [ ] "Não compatíveis (N)" abre/fecha
- [ ] Reset câmera funciona

- [ ] **Step 4: Run tests one last time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main.js index.html
git commit -m "feat: wire all modules in main.js — full pipeline"
```

### Task 8.2: README finalization

**Files:**
- Modify: `/home/gxdev/Projetos/BoxLab/README.md`

- [ ] **Step 1: Replace README content**

```markdown
# BoxLab

Calculadora 3D de cubagem para envios CSSBuy. Site estático rodando 100% no browser, sem backend.

## Features

- Adiciona itens (presets ou custom) com peso e dimensões
- Auto-pack 3D dos itens dentro da caixa (FFD3D + Extreme Points)
- Mostra volume, peso real, peso cubado (÷5000) e o que prevalece
- Recomenda o melhor frete CSSBuy entre 11 opções (ranking de cobertura de seguro)
- Persiste itens e configurações no localStorage

## Como rodar localmente

Precisa de qualquer servidor estático (a importação dinâmica de JSON exige HTTP, não `file://`):

```bash
npm run serve
# abre http://localhost:8080
```

Ou:

```bash
npx http-server .
```

## Testes

```bash
npm test
```

Os módulos puros (`state/`, `packing/`, `freight/`) têm cobertura via `node --test`. UI e Three.js são testados manualmente.

## Deploy no GitHub Pages

1. Push pra `main`
2. Settings → Pages → Source: branch `main`, path `/` (root)
3. Site fica em `https://<user>.github.io/<repo>/`

Sem build step, sem CI obrigatório.

## Estrutura

```
index.html              shell
src/
  main.js               orquestra tudo
  state/store.js        pub/sub + persist
  data/                 presets e fretes em JSON
  packing/              FFD3D + volume mods
  freight/              weight + scorer
  ui/                   componentes DOM
  three/                cena, caixa, items
tests/                  espelha src/
```

## Debug

Adiciona `?debug=1` na URL — `window.__boxlab` fica disponível no console.

## Limitações conhecidas

- Apenas Brasil como destino
- Itens cuboides apenas (sem cilindros)
- Preço dos fretes em ranges qualitativos (cheap/medium/expensive), sem ¥/R$
- Sem split em múltiplas caixas
- FFD heurístico — não garante empacotamento ótimo
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: complete README with usage, deploy, and limitations"
```

### Task 8.3: GitHub Pages config (optional)

**Files:**
- Create: `/home/gxdev/Projetos/BoxLab/.nojekyll`

- [ ] **Step 1: Create `.nojekyll`**

```bash
touch .nojekyll
```

Reason: prevents GitHub Pages from treating `_files` as Jekyll partials. Common best practice for static sites.

- [ ] **Step 2: Commit**

```bash
git add .nojekyll
git commit -m "chore: disable Jekyll on GitHub Pages"
```

---

## Done

At the end of all chunks the site is deploy-ready and fully functional locally. To publish:

```bash
git remote add origin <repo-url>
git push -u origin main
# Then enable Pages in the GitHub UI
```
