/**
 * Tests for the monolith_payload merge guard — the regression that hid the
 * Registry «Předvyplnit TOV» banner on 2026-07-09 (item 272324): a bulk
 * «Exportovat do Registru» wrote a THIN monolith_payload over the RICH one
 * that «Aplikovat» had written, so `hasExtendedCosts()` went false in Registry.
 *
 * The guard must:
 *   - recognise a rich payload the same way rozpocet-registry
 *     tovPrefill.hasExtendedCosts does; and
 *   - emit an atomic UPDATE expression that refuses rich→thin downgrades
 *     while still allowing rich→rich and thin→(thin/empty) writes.
 *
 * Run: node --test stavagent-portal/backend/tests/monolithPayloadMerge.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRichMonolithPayload,
  richPayloadSql,
  monolithPayloadMergeSql,
} from '../src/db/monolithPayloadMerge.js';

// The exact shape export-to-registry.js:153 writes — flat fields, no calc data.
const THIN_PAYLOAD = {
  monolit_position_id: 'br__pos_1',
  part_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C25/30',
  subtype: 'beton',
  crew_size: 4,
  wage_czk_ph: 398,
  shift_hours: 10,
  days: 6,
  cost_czk: 95520,
  kros_total_czk: 100000,
  source_tag: 'MONOLIT_EXPORT',
};

// The shape portalWriteBack.buildMonolithPayload writes for a main beton row.
const RICH_PAYLOAD_COSTS = {
  ...THIN_PAYLOAD,
  source_tag: 'MONOLIT_LIVE',
  costs: { pour_labor_czk: 40000, formwork_labor_czk: 20000, rebar_labor_czk: 15000 },
  resources: { wage_pour_czk_h: 398, pour_shifts: 2, total_formwork_workers: 4 },
  formwork_info: { system_name: 'Framax Xlife', num_tacts: 2, num_sets: 1 },
};

// The shape a sibling (bednění/výztuž) row carries — no costs/resources, but
// exact per-profession labor rows. hasExtendedCosts treats this as rich too.
const RICH_PAYLOAD_TOV = {
  ...THIN_PAYLOAD,
  tov_entries: {
    labor: [{ profession: 'Železář', professionCode: 'ZEL', count: 3, normHours: 97.8 }],
    materials: [],
    source: 'calculator',
  },
};

describe('isRichMonolithPayload — canonical contract (mirrors Registry hasExtendedCosts)', () => {
  it('is rich when both costs and resources are present', () => {
    assert.equal(isRichMonolithPayload(RICH_PAYLOAD_COSTS), true);
  });

  it('is rich when tov_entries.labor has ≥1 entry (sibling rows)', () => {
    assert.equal(isRichMonolithPayload(RICH_PAYLOAD_TOV), true);
  });

  it('is THIN for the flat export payload (the regression trigger)', () => {
    assert.equal(isRichMonolithPayload(THIN_PAYLOAD), false);
  });

  it('requires BOTH costs and resources — costs alone is thin', () => {
    assert.equal(isRichMonolithPayload({ ...THIN_PAYLOAD, costs: { a: 1 } }), false);
    assert.equal(isRichMonolithPayload({ ...THIN_PAYLOAD, resources: { a: 1 } }), false);
  });

  it('an empty tov_entries.labor array is thin', () => {
    assert.equal(
      isRichMonolithPayload({ ...THIN_PAYLOAD, tov_entries: { labor: [], materials: [] } }),
      false,
    );
  });

  it('tov_entries without a labor array is thin', () => {
    assert.equal(isRichMonolithPayload({ ...THIN_PAYLOAD, tov_entries: {} }), false);
  });

  it('null / undefined / non-object are thin (never throws)', () => {
    assert.equal(isRichMonolithPayload(null), false);
    assert.equal(isRichMonolithPayload(undefined), false);
    assert.equal(isRichMonolithPayload('x'), false);
    assert.equal(isRichMonolithPayload(42), false);
  });
});

describe('richPayloadSql — SQL mirror of the contract', () => {
  const sql = richPayloadSql('monolith_payload');

  it('tests costs AND resources as JSON objects', () => {
    assert.match(sql, /jsonb_typeof\(\(monolith_payload\) -> 'costs'\) = 'object'/);
    assert.match(sql, /jsonb_typeof\(\(monolith_payload\) -> 'resources'\) = 'object'/);
  });

  it('tests a non-empty tov_entries.labor array', () => {
    assert.match(sql, /'tov_entries' -> 'labor'/);
    assert.match(sql, /jsonb_array_length/);
    assert.match(sql, />\s*0/);
  });

  it('guards jsonb_array_length behind a jsonb_typeof = array check (never errors on a non-array)', () => {
    // The array length must be read only inside a CASE that first proves the
    // value is an array, else Postgres raises "cannot get array length of a
    // non-array" on a malformed labor value.
    assert.match(
      sql,
      /jsonb_array_length\(\s*CASE WHEN jsonb_typeof\([\s\S]*?'labor'\) = 'array'/,
    );
  });

  it('COALESCEs to false so a thin payload yields false, not NULL (guard-poison regression)', () => {
    // For a thin payload the costs/resources keys are absent →
    // `jsonb_typeof(x -> costs) = object` is NULL. Without COALESCE(..., false)
    // the predicate returns NULL, and the merge guard `existing AND NOT NULL`
    // = NULL → the rich payload gets downgraded anyway. Verified live against
    // Postgres 2026-07-10.
    assert.match(sql, /^COALESCE\(/);
    assert.match(sql, /, false\)$/);
  });
});

describe('monolithPayloadMergeSql — never downgrade rich→thin', () => {
  const merge = monolithPayloadMergeSql('$11');

  it('is a CASE expression, not a bare overwrite or COALESCE-clobber', () => {
    // Regression guard: reverting to `COALESCE($11, monolith_payload)` or `= $11`
    // reintroduces the clobber. (A COALESCE(..., false) inside the boolean
    // predicate is fine — only a COALESCE with a bare param first arg is the
    // overwrite pattern.)
    assert.match(merge, /^CASE/);
    assert.doesNotMatch(merge, /COALESCE\(\$\d+,/);
  });

  it('keeps the stored column when it is rich AND the incoming value is thin', () => {
    // The middle branch: <existing rich> AND NOT <incoming rich> THEN monolith_payload
    assert.match(merge, /AND NOT COALESCE\(/);
    assert.match(merge, /THEN monolith_payload/);
  });

  it('passes the incoming payload through cast to jsonb otherwise', () => {
    assert.match(merge, /\(\$11\)::jsonb/);
    assert.match(merge, /ELSE \(\$11\)::jsonb/);
  });

  it('preserves the existing value when the incoming payload is NULL (cast NULL check)', () => {
    // The NULL check must ALSO cast — a bare `$11 IS NULL` leaves the param
    // type unknown → Postgres 42P08.
    assert.match(merge, /WHEN \(\$11\)::jsonb IS NULL THEN monolith_payload/);
  });

  it('NEVER leaves a bare parameter uncast (42P08 regression guard)', () => {
    // The 2026-07-10 write-back outage: `$1 IS NULL` was uncast, so Postgres
    // could not determine the parameter type and EVERY monolith write 500'd.
    // After removing every `($n)::jsonb`, no bare `$n` may remain anywhere.
    for (const ph of ['$1', '$11']) {
      const m = monolithPayloadMergeSql(ph);
      const stripped = m.split(`(${ph})::jsonb`).join('');
      assert.ok(
        !stripped.includes(ph),
        `bare ${ph} without ::jsonb cast would raise 42P08:\n${m}`,
      );
    }
  });

  it('works with any placeholder index and a custom column', () => {
    const m = monolithPayloadMergeSql('$1', 'monolith_payload');
    assert.match(m, /WHEN \(\$1\)::jsonb IS NULL THEN monolith_payload/);
    assert.match(m, /ELSE \(\$1\)::jsonb/);
  });
});
