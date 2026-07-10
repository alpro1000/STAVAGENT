/**
 * Regression guard for the kiosk-write audit-log 42P08.
 *
 * The write-back audit INSERTs in position-instances.js (monolith AND dov)
 * used to bind $1 (the position_instance_id) in TWO places at once:
 *   - the SELECT-list, feeding position_audit_log.position_instance_id, and
 *   - the WHERE, feeding portal_positions.position_instance_id.
 * On prod those two columns had drifted to different types (the audit table
 * predates the UUID standardization, so `CREATE TABLE IF NOT EXISTS` never
 * migrated its position_instance_id from legacy TEXT while portal_positions is
 * UUID). Postgres then deduced $1 as BOTH uuid AND text and raised
 *   ERROR: inconsistent types deduced for parameter $1 / DETAIL: uuid versus text
 * on every write. For the monolith path this was non-fatal (audit rows lost +
 * log spam); for the DOV path the INSERT sat INSIDE the BEGIN/COMMIT, so the
 * 42P08 rolled back the whole dov_payload write. Reproduced + fixed live
 * against Postgres 16 on 2026-07-10 (drift scenario: audit col TEXT,
 * portal_positions UUID).
 *
 * Fix: source the audit column from the JOINed row (pp.position_instance_id)
 * so the bound param appears in exactly ONE type context (the WHERE). This
 * test pins that shape for EVERY audit INSERT that joins portal_positions, so
 * a future edit (or a new kiosk write path copied from an old shape) can't
 * reintroduce the dual-context bind.
 *
 * Run: node --test stavagent-portal/backend/tests/auditLogInsert.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const routeSrc = readFileSync(
  join(__dirname, '../src/routes/position-instances.js'),
  'utf8',
);

/**
 * Extract every position_audit_log INSERT that selects FROM portal_positions
 * (the shape vulnerable to the dual-context bind). VALUES-style inserts bind
 * each param once by construction and are not in scope. Each SQL template
 * literal contains no backticks, so `[^\`]*` bounds the match to ONE statement
 * — a lazy [\s\S]*? would run past a VALUES insert into the next SELECT one.
 */
const auditInserts = [...routeSrc.matchAll(
  /INSERT INTO position_audit_log[^`]*/g,
)].map(m => m[0].trimEnd()).filter(sql => sql.includes('FROM portal_positions pp'));

describe('audit INSERTs joining portal_positions — no dual-type-context param bind', () => {
  it('covers both kiosk write paths (monolith_written + dov_written)', () => {
    assert.equal(auditInserts.length, 2, `expected 2 SELECT-style audit INSERTs, found ${auditInserts.length}`);
    assert.ok(auditInserts.some(sql => sql.includes("'monolith_written'")), 'monolith_written INSERT missing');
    assert.ok(auditInserts.some(sql => sql.includes("'dov_written'")), 'dov_written INSERT missing');
  });

  for (const [i, sql] of auditInserts.entries()) {
    const label = sql.includes("'monolith_written'") ? 'monolith_written'
      : sql.includes("'dov_written'") ? 'dov_written'
      : `#${i}`;

    it(`${label}: sources position_instance_id from the JOINed row, not the bound param`, () => {
      // The audit column must be filled from pp.position_instance_id so its
      // value assignment-casts to whatever type the audit column actually is.
      assert.match(sql, /pp\.position_instance_id,\s*\$2/);
    });

    it(`${label}: does NOT bind $1 in the SELECT-list (the 42P08 trigger)`, () => {
      // The buggy shape put $1 as the fourth SELECT column:
      //   SELECT '<event>', '<actor>', po.portal_project_id, $1, $2
      // which reused $1 alongside the WHERE — inconsistent-type deduction.
      assert.doesNotMatch(sql, /portal_project_id,\s*\$1\s*,\s*\$2/);
    });

    it(`${label}: binds the id exactly once, in the WHERE`, () => {
      const occurrences = (sql.match(/\$1\b/g) || []).length;
      assert.equal(occurrences, 1, `expected $1 exactly once, found ${occurrences}:\n${sql}`);
      assert.match(sql, /WHERE pp\.position_instance_id = \$1$/);
    });
  }
});

describe('DOV write path — audit failure must not roll back the payload', () => {
  it('the dov handler no longer wraps the payload UPDATE + audit in one transaction', () => {
    // The old shape was BEGIN → UPDATE dov_payload → audit INSERT → COMMIT,
    // so an audit 42P08 rolled the payload back. The fixed shape has no
    // BEGIN between the dov handler start and its audit INSERT, and the
    // audit sits in its own try/catch (non-fatal), mirroring the monolith
    // handler.
    const dovStart = routeSrc.indexOf("router.post('/:instanceId/dov'");
    assert.ok(dovStart >= 0, 'dov write handler not found');
    const dovAudit = routeSrc.indexOf("'dov_written'", dovStart);
    assert.ok(dovAudit >= 0, 'dov audit INSERT not found');
    const handlerSlice = routeSrc.slice(dovStart, dovAudit);
    assert.ok(!handlerSlice.includes("query('BEGIN')"), 'dov handler still opens a transaction around the payload write');
    assert.match(handlerSlice, /try\s*{\s*[^}]*$/, 'dov audit INSERT is not inside its own try block');
  });
});
