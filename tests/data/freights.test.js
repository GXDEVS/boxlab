import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FREIGHTS_PATH = resolve(here, '..', '..', 'src', 'data', 'freights.json');
const raw = JSON.parse(readFileSync(FREIGHTS_PATH, 'utf8'));

const meta = raw;
const entries = raw.items ?? raw;

const VALID_TYPES = new Set(['express', 'ems', 'sal', 'seamail', 'eub', 'battery', 'duty-free']);
const VALID_PRICE_TIERS = new Set(['cheap', 'medium', 'expensive']);
const VALID_COMMODITIES = new Set([
  'electric', 'liquid', 'knives', 'powder', 'shoes', 'bags', 'food',
  'battery', 'cosmetics', 'magnetic', 'watch', 'perfume', 'seafreight', 'electronics',
]);

describe('freights.json — header', () => {
  it('has a _source URL pointing at CSSBuy', () => {
    assert.ok(typeof meta._source === 'string');
    assert.match(meta._source, /cssbuy\.com/);
  });

  it('has _capturedAt as parseable ISO date', () => {
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
      assert.ok(e.volumetricDivisor === null || typeof e.volumetricDivisor === 'number',
                `${e.id}: volumetricDivisor`);
      assert.ok(typeof e.pureWeight === 'boolean', `${e.id}: pureWeight`);
      assert.equal(e.pureWeight, e.volumetricDivisor === null,
                   `${e.id}: pureWeight must mirror divisor === null`);
    }
  });

  it('forbidden lists contain only valid commodity keys', () => {
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
