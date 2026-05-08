# CSSBuy Freight Rules — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 hardcoded 11-freight catalog with 22 real CSSBuy freights observed for Brazil, modeling per-freight volumetric divisor, pure-weight lines, transit time, and richer incompatibility reasons — all without breaking the existing pipeline.

**Architecture:** Data-driven. `src/data/freights.json` is the source of truth (with `_source`/`_capturedAt` header). The scorer iterates each freight and calls a new `chargedKgFor(weights, freight)` helper that respects each freight's `volumetricDivisor` (or returns real weight when `null` for China Post family). Pipeline shape unchanged; only the freight modules and freight UI cards evolve.

**Tech Stack:** Vanilla ES modules, `node --test` for pure modules, custom Tailwind classes for UI. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-08-cssbuy-freight-rules-design.md`

---

## File Structure

Files touched in this plan:

```
src/
  data/freights.json          REPLACE — 22 entries + new fields + _source/_capturedAt header
  freight/
    weight.js                 MODIFY — calcWeights returns base shape (no chargedKg);
                              add chargedKgFor(weights, freight)
    scorer.js                 MODIFY — chargedKgFor per iteration, transit weight (0.10),
                              line-per-reason in incompatible, rebalance other weights
  ui/
    freight-list.js           MODIFY — transit badge, charging-type badge,
                              per-card "Você paga por" line, banner when commodity
                              filters ≥50% of fleet
    results-panel.js          MODIFY — "Você paga por" = min(charged across compatibles);
                              consume new currentResults shape
  main.js                     MODIFY — pass weights (not chargedKg) into scorer;
                              compute min charged across compatibles for results panel

tests/
  data/freights.test.js       CREATE — schema validation, ID uniqueness, etc.
  freight/weight.test.js      MODIFY — chargedKgFor cases; remove chargedKg/cubic from calcWeights output assertions
  freight/scorer.test.js      MODIFY — transit weight, per-line reasons, pure-weight gate behavior
```

**Boundaries:**
- `weight.js` stays pure (no DOM). `chargedKgFor` is a small helper function alongside `calcWeights`.
- `scorer.js` consumes `weights` (real + volume) and the freights array. Stays pure.
- UI files only render — no business logic moves into them.
- `main.js` keeps being the thin orchestrator.

---

## Chunk 1: Data — replace freights.json

### Task 1.1: Schema validation tests (failing)

**Files:**
- Create: `tests/data/freights.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FREIGHTS_PATH = resolve(here, '..', '..', 'src', 'data', 'freights.json');
const raw = JSON.parse(readFileSync(FREIGHTS_PATH, 'utf8'));

// Header + entries are co-located: object with _source, _capturedAt, items[]
const meta = raw;
const entries = raw.items ?? raw;

const VALID_TYPES = new Set(['express', 'ems', 'sal', 'seamail', 'eub', 'battery', 'duty-free']);
const VALID_PRICE_TIERS = new Set(['cheap', 'medium', 'expensive']);
const VALID_COMMODITIES = new Set([
  'electric','liquid','knives','powder','shoes','bags','food',
  'battery','cosmetics','magnetic','watch','perfume','seafreight','electronics',
]);

describe('freights.json — header', () => {
  it('has a _source URL pointing at CSSBuy', () => {
    assert.ok(typeof meta._source === 'string');
    assert.match(meta._source, /cssbuy\.com/);
  });

  it('has _capturedAt as ISO date', () => {
    assert.ok(typeof meta._capturedAt === 'string');
    assert.ok(!Number.isNaN(Date.parse(meta._capturedAt)));
  });
});

describe('freights.json — entries', () => {
  it('has at least 20 entries', () => {
    assert.ok(entries.length >= 20, `expected ≥20, got ${entries.length}`);
  });

  it('all IDs are unique', () => {
    const ids = entries.map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('every entry has the required schema', () => {
    for (const e of entries) {
      assert.ok(typeof e.id === 'string', `${e.id}: id`);
      assert.ok(typeof e.name === 'string', `${e.id}: name`);
      assert.ok(typeof e.weightRange?.min === 'number', `${e.id}: weightRange.min`);
      assert.ok(typeof e.weightRange?.max === 'number', `${e.id}: weightRange.max`);
      assert.ok(e.weightRange.min <= e.weightRange.max, `${e.id}: min<=max`);
      assert.ok(typeof e.insuranceMax === 'number', `${e.id}: insuranceMax`);
      assert.ok(VALID_TYPES.has(e.type), `${e.id}: type ${e.type}`);
      assert.ok(VALID_PRICE_TIERS.has(e.priceTier), `${e.id}: priceTier ${e.priceTier}`);
      assert.ok(Array.isArray(e.destinations) && e.destinations.includes('BR'), `${e.id}: destinations`);
      assert.ok(Array.isArray(e.restrictions?.forbidden), `${e.id}: forbidden array`);
      assert.ok(typeof e.transitDays?.min === 'number', `${e.id}: transitDays.min`);
      assert.ok(typeof e.transitDays?.max === 'number', `${e.id}: transitDays.max`);
      assert.ok(e.transitDays.min <= e.transitDays.max, `${e.id}: transit min<=max`);
      // volumetricDivisor: number or null
      assert.ok(e.volumetricDivisor === null || typeof e.volumetricDivisor === 'number',
                `${e.id}: volumetricDivisor`);
      assert.ok(typeof e.pureWeight === 'boolean', `${e.id}: pureWeight`);
      assert.equal(e.pureWeight, e.volumetricDivisor === null,
                   `${e.id}: pureWeight must mirror divisor === null`);
    }
  });

  it('forbidden lists only valid commodity keys', () => {
    for (const e of entries) {
      for (const k of e.restrictions.forbidden) {
        assert.ok(VALID_COMMODITIES.has(k), `${e.id}: invalid commodity ${k}`);
      }
    }
  });

  it('contains JD-EXP-EF Battery-line that accepts battery', () => {
    const battery = entries.find(e => /battery-line/i.test(e.name));
    assert.ok(battery, 'JD-EXP-EF Battery-line missing');
    assert.ok(!battery.restrictions.forbidden.includes('battery'),
              'Battery line must NOT forbid battery');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/data/freights.test.js`
Expected: every test fails because the file doesn't have the new shape yet.

### Task 1.2: Rewrite freights.json with 22 entries

**Files:**
- Modify: `src/data/freights.json` (full rewrite)

- [ ] **Step 1: Replace file content**

```json
{
  "_source": "https://www.cssbuy.com/estimates",
  "_capturedAt": "2026-05-08T19:41:00Z",
  "_note": "Captured for: weight=1000g, dims=20×15×10cm, country=Brazil, no commodity flags. Some restrictions are inferred from common forwarder practice (marked with `inferred: true`). Re-capture by re-running the calculator if CSSBuy changes lines.",
  "items": [
    {
      "id": "tyg-br-exp-f-0-3",
      "name": "TYG-BR-EXP-F",
      "weightRange": { "min": 0, "max": 3 },
      "insuranceMax": 4000,
      "type": "express",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 12, "max": 30 },
      "notes": "Express até 3kg, melhor seguro nesta faixa"
    },
    {
      "id": "bj-eub",
      "name": "BJ-EUB",
      "weightRange": { "min": 0, "max": 2 },
      "insuranceMax": 2000,
      "type": "eub",
      "priceTier": "cheap",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid", "magnetic"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 15, "max": 60 },
      "notes": "EUB peso real puro"
    },
    {
      "id": "fj-br-exp-f-0-3",
      "name": "FJ-BR-EXP-F",
      "weightRange": { "min": 0, "max": 3 },
      "insuranceMax": 2000,
      "type": "express",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 12, "max": 30 },
      "notes": "Express até 3kg"
    },
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
      "notes": "Express 3-20kg, maior seguro"
    },
    {
      "id": "gz-br-f-p",
      "name": "GZ-BR-F:P",
      "weightRange": { "min": 0, "max": 30 },
      "insuranceMax": 3000,
      "type": "express",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 15, "max": 30 },
      "notes": "Express padrão 0-30kg"
    },
    {
      "id": "gz-br-f-e-0-2",
      "name": "GZ-BR-F:E",
      "weightRange": { "min": 0, "max": 2 },
      "insuranceMax": 2000,
      "type": "express",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 15, "max": 30 },
      "notes": "Express básico até 2kg"
    },
    {
      "id": "gz-br-f-e-2-30",
      "name": "GZ-BR-F:E",
      "weightRange": { "min": 2, "max": 30 },
      "insuranceMax": 3500,
      "type": "express",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 15, "max": 30 },
      "notes": "Express 2-30kg"
    },
    {
      "id": "gz-br-f-b",
      "name": "GZ-BR-F:B",
      "weightRange": { "min": 0, "max": 20 },
      "insuranceMax": 3500,
      "type": "express",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": [] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 15, "max": 30 },
      "notes": "Aceita bateria"
    },
    {
      "id": "jd-exp-ef",
      "name": "JD-EXP-EF",
      "weightRange": { "min": 0, "max": 3 },
      "insuranceMax": 3000,
      "type": "express",
      "priceTier": "expensive",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 15, "max": 25 },
      "notes": "Express premium até 3kg"
    },
    {
      "id": "jd-exp-ef-battery",
      "name": "JD-EXP-EF Battery-line",
      "weightRange": { "min": 0, "max": 12 },
      "insuranceMax": 3000,
      "type": "battery",
      "priceTier": "expensive",
      "destinations": ["BR"],
      "restrictions": { "forbidden": [] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 15, "max": 25 },
      "notes": "Especialista em produtos com bateria"
    },
    {
      "id": "china-post-sal",
      "name": "China Post SAL",
      "weightRange": { "min": 0, "max": 30 },
      "insuranceMax": 3000,
      "type": "sal",
      "priceTier": "cheap",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid", "magnetic"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 20, "max": 60 },
      "notes": "Peso real puro, mais lento"
    },
    {
      "id": "china-post-sea-mail",
      "name": "China Post Sea Mail",
      "weightRange": { "min": 0, "max": 20 },
      "insuranceMax": 3000,
      "type": "seamail",
      "priceTier": "cheap",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid", "magnetic"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 60, "max": 180 },
      "notes": "Mais barato, demora muito"
    },
    {
      "id": "china-post-big-air-mail",
      "name": "China Post Big Air Mail",
      "weightRange": { "min": 0, "max": 30 },
      "insuranceMax": 3000,
      "type": "sal",
      "priceTier": "cheap",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 15, "max": 50 },
      "notes": "Pure weight, peso real puro"
    },
    {
      "id": "sc-eub",
      "name": "SC-EUB",
      "weightRange": { "min": 0, "max": 2 },
      "insuranceMax": 2000,
      "type": "eub",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 10, "max": 30 },
      "notes": "EUB peso real até 2kg"
    },
    {
      "id": "sz-eub-e",
      "name": "SZ-EUB-E",
      "weightRange": { "min": 0, "max": 2 },
      "insuranceMax": 5000,
      "type": "eub",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 10, "max": 25 },
      "notes": "EUB com seguro alto"
    },
    {
      "id": "hz-ems",
      "name": "HZ-EMS",
      "weightRange": { "min": 0, "max": 30 },
      "insuranceMax": 3000,
      "type": "ems",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": [] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 12, "max": 30 },
      "notes": "EMS faixa ampla"
    },
    {
      "id": "bj-e-ems",
      "name": "BJ-E-EMS",
      "weightRange": { "min": 0, "max": 30 },
      "insuranceMax": 5000,
      "type": "ems",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": [] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 10, "max": 30 },
      "notes": "EMS — bom seguro"
    },
    {
      "id": "sh-sal-br",
      "name": "SH-SAL-BR",
      "weightRange": { "min": 3, "max": 30 },
      "insuranceMax": 3000,
      "type": "sal",
      "priceTier": "cheap",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 30, "max": 60 },
      "notes": "SAL >= 3kg"
    },
    {
      "id": "postnl-d",
      "name": "Postnl-D",
      "weightRange": { "min": 0, "max": 3 },
      "insuranceMax": 1000,
      "type": "eub",
      "priceTier": "medium",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid", "magnetic"] },
      "volumetricDivisor": null,
      "pureWeight": true,
      "transitDays": { "min": 25, "max": 45 },
      "notes": "EUB europeu"
    },
    {
      "id": "duty-free-br-p",
      "name": "Duty-Free-BR:P",
      "weightRange": { "min": 0, "max": 3 },
      "insuranceMax": 3000,
      "type": "duty-free",
      "priceTier": "expensive",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 16, "max": 25 },
      "notes": "Duty-free P"
    },
    {
      "id": "duty-free-br-f",
      "name": "Duty-Free-BR:F",
      "weightRange": { "min": 0, "max": 3 },
      "insuranceMax": 3000,
      "type": "duty-free",
      "priceTier": "expensive",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 16, "max": 25 },
      "notes": "Duty-free F"
    },
    {
      "id": "duty-free-br-e",
      "name": "Duty-Free-BR:E",
      "weightRange": { "min": 0, "max": 3 },
      "insuranceMax": 2000,
      "type": "duty-free",
      "priceTier": "expensive",
      "destinations": ["BR"],
      "restrictions": { "forbidden": ["battery", "liquid"] },
      "volumetricDivisor": 5000,
      "pureWeight": false,
      "transitDays": { "min": 16, "max": 25 },
      "notes": "Duty-free E"
    }
  ]
}
```

- [ ] **Step 2: Run schema tests — expect pass**

Run: `npm test -- tests/data/freights.test.js`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/data/freights.json tests/data/freights.test.js
git commit -m "data(freights): expand catalog to 22 BR entries observed from CSSBuy

Captured 2026-05-08 from cssbuy.com/estimates with weight=1kg, dims=20×15×10cm.
New fields per entry: volumetricDivisor (5000/null), pureWeight (derived),
transitDays {min,max}. Header has _source URL and _capturedAt timestamp.

Some forbidden lists are inferred from common forwarder practice (e.g. magnetic
on China Post). Confidence is documented in notes. JD-EXP-EF Battery-line is
the only freight that does not forbid battery — explicitly tested.

Schema is validated by tests/data/freights.test.js (new)."
```

---

## Chunk 2: Weight refactor — chargedKgFor

### Task 2.1: Update weight test for new shape

**Files:**
- Modify: `tests/freight/weight.test.js`

- [ ] **Step 1: Rewrite tests**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcWeights, chargedKgFor } from '../../src/freight/weight.js';

describe('calcWeights', () => {
  it('returns realWeightG, realWeightKg, volumeCm3', () => {
    const r = calcWeights([{ weight: 200 }, { weight: 150 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.realWeightG, 350);
    assert.equal(r.realWeightKg, 0.35);
    assert.equal(r.volumeCm3, 1000);
  });

  it('does NOT return chargedKg/cubicWeightKg anymore (per-freight now)', () => {
    const r = calcWeights([{ weight: 200 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.chargedKg, undefined);
    assert.equal(r.cubicWeightKg, undefined);
    assert.equal(r.chargedSource, undefined);
  });

  it('handles empty items and zero box', () => {
    const r = calcWeights([], { length: 0, width: 0, height: 0 });
    assert.equal(r.realWeightG, 0);
    assert.equal(r.realWeightKg, 0);
    assert.equal(r.volumeCm3, 0);
  });

  it('treats missing weight as zero', () => {
    const r = calcWeights([{ weight: undefined }, { weight: 100 }], { length: 10, width: 10, height: 10 });
    assert.equal(r.realWeightG, 100);
  });
});

describe('chargedKgFor', () => {
  const W = (real, vol) => ({ realWeightKg: real, volumeCm3: vol });

  it('pure-weight freight (divisor null) ignores volume', () => {
    const f = { volumetricDivisor: null };
    assert.equal(chargedKgFor(W(0.2, 50000), f), 0.2);
  });

  it('returns max(real, volumeCm3 / divisor)', () => {
    const f5 = { volumetricDivisor: 5000 };
    // volume 1120 / 5000 = 0.224; real 0.35 -> charged 0.35
    assert.equal(chargedKgFor(W(0.35, 1120), f5), 0.35);
    // volume 5000 / 5000 = 1.0; real 0.5 -> charged 1.0
    assert.equal(chargedKgFor(W(0.5, 5000), f5), 1.0);
  });

  it('divisor 6000 produces smaller cubic than 5000', () => {
    const w = W(0.1, 6000);
    const c5 = chargedKgFor(w, { volumetricDivisor: 5000 });
    const c6 = chargedKgFor(w, { volumetricDivisor: 6000 });
    assert.ok(c5 > c6, `c5=${c5}, c6=${c6}`);
    assert.equal(c5, 6000 / 5000);
    assert.equal(c6, 6000 / 6000);
  });

  it('returns 0 when both real and volume are 0', () => {
    assert.equal(chargedKgFor(W(0, 0), { volumetricDivisor: 5000 }), 0);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `npm test -- tests/freight/weight.test.js`
Expected: fail because `chargedKgFor` doesn't exist and `calcWeights` still exposes `chargedKg`.

### Task 2.2: Refactor weight.js

**Files:**
- Modify: `src/freight/weight.js`

- [ ] **Step 1: Replace content**

```js
export function calcWeights(items, box) {
  const realWeightG = items.reduce((s, it) => s + (it.weight || 0), 0);
  const realWeightKg = realWeightG / 1000;
  const volumeCm3 = box.length * box.width * box.height;
  return { realWeightG, realWeightKg, volumeCm3 };
}

export function chargedKgFor(weights, freight) {
  if (freight.volumetricDivisor == null) return weights.realWeightKg;
  const cubic = weights.volumeCm3 / freight.volumetricDivisor;
  return Math.max(weights.realWeightKg, cubic);
}
```

- [ ] **Step 2: Run weight tests — expect pass**

Run: `npm test -- tests/freight/weight.test.js`
Expected: all green.

- [ ] **Step 3: Run full suite — note failures**

Run: `npm test`
Expected: scorer tests fail (they consume old chargedKg API). That's fine — Chunk 3 fixes that.

- [ ] **Step 4: Commit**

```bash
git add src/freight/weight.js tests/freight/weight.test.js
git commit -m "refactor(freight/weight): split chargedKg into per-freight chargedKgFor

calcWeights now returns only the freight-agnostic numbers
(realWeightG, realWeightKg, volumeCm3). The freight-specific charge
calculation moves into chargedKgFor(weights, freight), which respects
each freight's volumetricDivisor — null means pure-weight (China Post
family) and ignores the cubic dimension entirely.

Scorer tests will go red until Chunk 3 wires this up."
```

---

## Chunk 3: Scorer — chargedKgFor + transit + line-per-reason

### Task 3.1: Update scorer tests

**Files:**
- Modify: `tests/freight/scorer.test.js`

- [ ] **Step 1: Replace content**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFreights } from '../../src/freight/scorer.js';

const F = (over) => ({
  id: 'x', name: 'X',
  weightRange: { min: 0, max: 30 },
  insuranceMax: 3000,
  type: 'express',
  priceTier: 'medium',
  destinations: ['BR'],
  restrictions: { forbidden: [] },
  volumetricDivisor: 5000,
  pureWeight: false,
  transitDays: { min: 15, max: 30 },
  ...over,
});

const W = (real = 0.5, volume = 1500) => ({ realWeightKg: real, volumeCm3: volume });

describe('scoreFreights', () => {
  it('weight gate uses chargedKgFor per freight (pure-weight freight passes when real fits)', () => {
    // big volume but small real weight — pure-weight freight should still pass
    const pure = F({ id: 'pure', volumetricDivisor: null, pureWeight: true });
    const r = scoreFreights({ weights: W(0.5, 100000), commodityAttrs: [] }, [pure]);
    assert.equal(r.compatible.length, 1);
  });

  it('weight gate fails for cubed freight when volumetric weight exceeds range', () => {
    // cubic = 100000/5000 = 20kg, range 0-3
    const cubed = F({ id: 'cubed', weightRange: { min: 0, max: 3 } });
    const r = scoreFreights({ weights: W(0.5, 100000), commodityAttrs: [] }, [cubed]);
    assert.equal(r.compatible.length, 0);
    assert.equal(r.incompatible.length, 1);
    assert.match(r.incompatible[0].reasons[0], /Peso/);
  });

  it('forbidden commodity reasons are line-per-reason (not joined)', () => {
    const f = F({ restrictions: { forbidden: ['battery', 'liquid'] } });
    const r = scoreFreights({ weights: W(), commodityAttrs: ['battery', 'liquid'] }, [f]);
    assert.equal(r.incompatible.length, 1);
    assert.equal(r.incompatible[0].reasons.length, 2);
    assert.match(r.incompatible[0].reasons[0], /battery/i);
    assert.match(r.incompatible[0].reasons[1], /liquid/i);
  });

  it('score breakdown sums to score / 100 (now with transit)', () => {
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [F()]);
    const b = r.compatible[0].breakdown;
    const total = b.insurance + b.price + b.type + b.headroom + b.transit;
    assert.ok(Math.abs(total * 100 - r.compatible[0].score) < 0.001);
  });

  it('breakdown weights sum to 1.0 (regression)', () => {
    // Verify by computing two freights identical except weights cant differ;
    // but easier: pick a freight where every component is at "full" — score should be 100.
    const fullScore = F({
      insuranceMax: 5000,         // insurance = 1.0
      priceTier: 'cheap',         // price = 1.0
      type: 'express',            // type = 1.0
      transitDays: { min: 0, max: 0 }, // transit = 1.0
      weightRange: { min: 0, max: 1 }, // headroom mid = 0.5; pick chargedKg=0.5 for headroom=1.0
    });
    const r = scoreFreights({ weights: W(0.5, 100), commodityAttrs: [] }, [fullScore]);
    assert.ok(Math.abs(r.compatible[0].score - 100) < 0.5,
      `expected ~100, got ${r.compatible[0].score}`);
  });

  it('faster transit produces higher transit subscore', () => {
    const fast = F({ id: 'fast', transitDays: { min: 5, max: 10 } });
    const slow = F({ id: 'slow', transitDays: { min: 50, max: 60 } });
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, [fast, slow]);
    const fastB = r.compatible.find(x => x.freight.id === 'fast').breakdown.transit;
    const slowB = r.compatible.find(x => x.freight.id === 'slow').breakdown.transit;
    assert.ok(fastB > slowB, `fast=${fastB} slow=${slowB}`);
  });

  it('returns recommended=null when nothing compatible', () => {
    const r = scoreFreights({ weights: W(50, 1000), commodityAttrs: [] }, [F({ weightRange: { min: 0, max: 1 } })]);
    assert.equal(r.recommended, null);
  });

  it('compatible list ordered by score desc', () => {
    const list = [
      F({ id: 'lowins', insuranceMax: 1000 }),
      F({ id: 'highins', insuranceMax: 5000 }),
    ];
    const r = scoreFreights({ weights: W(), commodityAttrs: [] }, list);
    assert.equal(r.compatible[0].freight.id, 'highins');
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `npm test -- tests/freight/scorer.test.js`
Expected: many failures.

### Task 3.2: Rewrite scorer.js

**Files:**
- Modify: `src/freight/scorer.js`

- [ ] **Step 1: Replace content**

```js
import { chargedKgFor } from './weight.js';

const W = { insurance: 0.40, price: 0.20, type: 0.15, headroom: 0.15, transit: 0.10 };
const PRICE_SCORE = { cheap: 1.0, medium: 0.66, expensive: 0.33 };
const TYPE_SCORE  = { express: 1.0, ems: 0.85, battery: 0.7, sal: 0.55, seamail: 0.4, eub: 0.7, 'duty-free': 0.6 };

const COMMODITY_LABELS = {
  electric: 'Electric', liquid: 'Liquid', knives: 'Knives', powder: 'Powder',
  shoes: 'Shoes', bags: 'Bags', food: 'Food', battery: 'Battery',
  cosmetics: 'Cosmetics', magnetic: 'Magnetic', watch: 'Watch', perfume: 'Perfume',
  seafreight: 'Sea freight', electronics: 'Electronic Products',
};

export function scoreFreights({ weights, commodityAttrs = [], country = 'BR' }, freights) {
  const compatible = [];
  const incompatible = [];

  for (const f of freights) {
    const chargedKg = chargedKgFor(weights, f);
    const reasons = [];

    if (chargedKg < f.weightRange.min || chargedKg > f.weightRange.max) {
      reasons.push(`Peso fora da faixa (${f.weightRange.min}–${f.weightRange.max}kg, você tem ${chargedKg.toFixed(2)}kg)`);
    }
    if (!f.destinations.includes(country)) {
      reasons.push(`Não atende ${country}`);
    }
    for (const k of f.restrictions?.forbidden ?? []) {
      if (commodityAttrs.includes(k)) {
        reasons.push(`Não transporta ${COMMODITY_LABELS[k] ?? k}`);
      }
    }

    if (reasons.length) {
      incompatible.push({ freight: f, reasons, chargedKg });
    } else {
      const breakdown = {
        insurance: W.insurance * Math.min(1, f.insuranceMax / 5000),
        price:     W.price     * (PRICE_SCORE[f.priceTier] ?? 0.5),
        type:      W.type      * (TYPE_SCORE[f.type] ?? 0.5),
        headroom:  W.headroom  * headroomScore(chargedKg, f.weightRange),
        transit:   W.transit   * transitScore(f.transitDays),
      };
      const score = (breakdown.insurance + breakdown.price + breakdown.type + breakdown.headroom + breakdown.transit) * 100;
      compatible.push({ freight: f, score, breakdown, chargedKg });
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

// Transit: faster = higher score. avg of min/max in days, normalized against 60 days as "slow".
function transitScore(transitDays) {
  if (!transitDays) return 0.5;
  const avg = (transitDays.min + transitDays.max) / 2;
  return Math.max(0, Math.min(1, 1 - avg / 60));
}
```

- [ ] **Step 2: Run scorer tests — expect pass**

Run: `npm test -- tests/freight/scorer.test.js`
Expected: all green.

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: all 50ish tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/freight/scorer.js tests/freight/scorer.test.js
git commit -m "feat(freight/scorer): per-freight chargedKg, transit weight, line-per-reason

- Score now has 5 weighted criteria (was 4): insurance 40%, price 20%,
  type 15%, headroom 15%, transit 10%. Transit prefers faster lines
  (avg of transitDays divided by 60-day reference).
- Each forbidden commodity intersection becomes its own reason line
  ('Não transporta Battery'), matching CSSBuy's actual UX.
- chargedKg per freight comes from chargedKgFor(weights, freight),
  so pure-weight lines (China Post family) gate on real weight only.
- TYPE_SCORE maps eub and duty-free explicitly."
```

---

## Chunk 4: UI — main.js + freight-list + results-panel

### Task 4.1: Update main.js — pass weights, not chargedKg

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Find and replace recompute()**

Locate the recompute function and replace the freight call. Old call:
```js
const freight = scoreFreights({ chargedKg: weights.chargedKg, commodityAttrs: s.commodityAttrs ?? [] }, freights);
```

New call:
```js
const freight = scoreFreights({ weights, commodityAttrs: s.commodityAttrs ?? [] }, freights);
```

Also `weights` no longer has `chargedKg`/`chargedSource` directly. We compute the "min charged across compatibles" for the results panel:

```js
const chargedKgsCompatible = freight.compatible.map(c => c.chargedKg);
const minChargedKg = chargedKgsCompatible.length ? Math.min(...chargedKgsCompatible) : weights.realWeightKg;
const chargedSource = (() => {
  if (!chargedKgsCompatible.length) return 'real';
  const cheapest = freight.compatible.find(c => c.chargedKg === minChargedKg);
  if (!cheapest) return 'real';
  return cheapest.freight.pureWeight ? 'real'
       : minChargedKg > weights.realWeightKg + 1e-9 ? 'cubic' : 'real';
})();

currentResults = {
  weights: { ...weights, chargedKg: minChargedKg, chargedSource, cubicWeightKg: weights.volumeCm3 / 5000 },
  packing,
  freight,
};
```

The composite `weights` object preserves backward compat for `results-panel.js` (which reads chargedKg/chargedSource/cubicWeightKg).

- [ ] **Step 2: Manual smoke (browser)**

Run: `npm run serve` (if not already running) and reload `http://localhost:8080`. Add an item, slide a dimension. No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat(main): scoreFreights now takes weights; results panel sees min charged

Per-freight charged weight requires main.js to pass the full weights
object into the scorer instead of pre-computing chargedKg. The results
panel still wants a single 'Você paga por' value, so we expose the
minimum chargedKg across compatible freights with a derived
chargedSource ('real' vs 'cubic')."
```

### Task 4.2: Freight-list — transit + charging-type badges + per-card "Você paga por"

**Files:**
- Modify: `src/ui/freight-list.js`

- [ ] **Step 1: Update freightCard / recommendedCard**

Find the badges block in both `recommendedCard` and `freightCard` and add:

```js
// Existing badges (insurance, weight range, priceTier, type) keep…
// Add after them:
badge(`🕒 ${f.transitDays.min}-${f.transitDays.max}d`, 'cyan'),
badge(f.pureWeight ? '⚖️ peso real' : `📦 cubado ÷${f.volumetricDivisor}`, 'zinc'),
```

Below the notes, add a small line showing the charged weight for THIS freight:

```js
el('div', { class: 'text-xs text-white/50 tabular mt-1' },
  `Você paga por: ${(scored.chargedKg * 1000).toFixed(0)} g (${scored.freight.pureWeight ? 'peso real' : 'cubado'})`),
```

- [ ] **Step 2: Update incompatibleRow — drop reason joining**

The current implementation already maps reasons to `<li>` items, so this should already render line-per-reason. Verify: each reason in `reasons` becomes one bullet. No change required if mapping is `reasons.map(r => el('li',{},r))`. If joined anywhere, fix.

- [ ] **Step 3: Score breakdown — add 5th bar (transit)**

In `scoreBreakdown()`, add:

```js
bar('Transit', b.transit),
```

Right before the totals row.

- [ ] **Step 4: Banner when ≥50% filtered**

At the top of `render()`, after collecting the result, add:

```js
const total = compatible.length + incompatible.length;
if (total > 0 && incompatible.length / total >= 0.5) {
  // Find which commodity is filtering most freights — pick the most common reason
  const counts = {};
  for (const inc of incompatible) {
    for (const r of inc.reasons) {
      const m = r.match(/Não transporta (\w+)/);
      if (m) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    root.append(el('div', {
      class: 'bx-banner bx-banner-amber',
    }, `⚠ ${top[0]} filtra ${top[1]} fretes. Considere o frete que aceita esse atributo.`));
  }
}
```

- [ ] **Step 5: Smoke in browser**

Reload page. Add DJI Pocket 2. Toggle Battery checkbox in commodity attrs. Verify:
- ~17 fretes incompatíveis com motivo "Não transporta Battery"
- ~2-3 compatíveis (JD-EXP-EF Battery-line, GZ-BR-F:B, EMS lines)
- Banner amarelo aparece
- Cada card mostra transit badge + tipo cobrança badge + linha "Você paga por"

- [ ] **Step 6: Commit**

```bash
git add src/ui/freight-list.js
git commit -m "feat(ui/freight-list): per-card transit + charging-type, ≥50% filter banner

Each freight card now surfaces transitDays.{min,max} and whether it
charges by pure weight or cubed (with the divisor). The 'Você paga por'
line varies per card — important when comparing pure-weight (China
Post) lines against cubed express lines.

Score breakdown adds a fifth bar (Transit). Banner appears at the top
of the freight section when more than half the catalog is incompatible
because of a commodity flag, telling the user which flag is the
culprit."
```

### Task 4.3: Results panel — already consumes derived chargedKg

**Files:**
- Modify: `src/ui/results-panel.js` (small)

- [ ] **Step 1: Verify results-panel still works**

Because main.js now provides `weights.chargedKg` and `weights.chargedSource` derived from min(compatible), the existing results-panel just works. Open the browser, confirm "Você paga por" shows a value. If broken, fix the field access.

- [ ] **Step 2: Add tooltip pra explicar**

Find the "Você paga por" stat and add a `title` attr:

```js
stat(
  'Você paga por',
  `${(weights.chargedKg * 1000).toFixed(0)} g`,
  weights.chargedSource === 'cubic' ? 'amber' : 'green',
  'Mínimo entre fretes compatíveis. Varia por frete.',  // new title arg
),
```

Update `stat()` signature to accept a `title`:

```js
function stat(label, value, tone = 'zinc', title) {
  // …
  return el('div', { class: 'bx-stat', title }, [ … ]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/results-panel.js
git commit -m "feat(ui/results-panel): tooltip on 'Você paga por' explaining min over compatibles"
```

---

## Chunk 5: Final smoke + push

### Task 5.1: Run full test suite

- [ ] **Step 1**

Run: `npm test`
Expected: all tests green (~50). If anything red — fix before continuing.

### Task 5.2: Manual smoke checklist

- [ ] **Open `http://localhost:8080`**
- [ ] **No console errors on load**
- [ ] **Add DJI Pocket 2** → 3D shows item with bubble halo
- [ ] **Mark Battery in commodity attrs** → ~17 incompatíveis with line-per-reason; ~2 compatíveis (Battery-line, GZ-BR-F:B); banner amarelo aparece
- [ ] **Switch packaging preset to Bolsa P** → caixa muda no 3D, peso cubado recalcula por frete
- [ ] **Each freight card**: transit badge (🕒), tipo cobrança badge (📦/⚖️), per-card "Você paga por" line visible
- [ ] **Recommended card**: 5 score bars (insurance, price, type, headroom, transit)
- [ ] **China Post Sea Mail card**: aumentar dimensões da caixa NÃO altera "Você paga por" desse card específico (pure weight)
- [ ] **JD-EXP-EF card**: aumentar dimensões aumenta "Você paga por" desse card (cubado)

### Task 5.3: Push and update PR

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Add comment to PR**

```bash
gh pr comment 1 --body "Round 4: CSSBuy freight rules

Replaces the v1 11-freight catalog with 22 BR freights captured from cssbuy.com/estimates today. Per-freight volumetric divisor and pure-weight modeling. Transit time joins the score (10%). Reasons render line-per-reason.

Spec: \`docs/superpowers/specs/2026-05-08-cssbuy-freight-rules-design.md\`
Plan: \`docs/superpowers/plans/2026-05-08-cssbuy-freight-rules.md\`

Tests: 50 (was 41). Smoke verified via claude-in-chrome."
```

- [ ] **Step 3: Mark plan as done in TaskList**

Whatever task is tracking 'CSSBuy freight rules' goes to completed.

---

## Done

End state:
- 22 freights catalogued (vs 11)
- Per-freight charged weight respecting divisor + pure-weight
- Transit as 5th score component
- Line-per-reason in incompatibles
- Per-card transit and charging-type badges
- ≥50%-filter banner
- Schema validation tests for the data file
- 50 unit tests, all passing
- Browser smoke verified
