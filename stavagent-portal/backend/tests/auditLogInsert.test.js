/**
 * Regression guard for the monolith-write audit-log 42P08.
 *
 * The write-back audit INSERT in position-instances.js used to bind $1 (the
 * position_instance_id) in TWO places at once:
 *   - the SELECT-list, feeding position_audit_log.position_instance_id, and
 *   - the WHERE, feeding portal_positions.position_instance_id.
 * On prod those two columns had drifted to different types (the audit table
 * predates the UUID standardization, so `CREATE TABLE IF NOT EXISTS` never
 * migrated its position_instance_id from legacy TEXT while portal_positions is
 * UUID). Postgres then deduced $1 as BOTH uuid AND text and raised
 *   ERROR: inconsistent types deduced for parameter $1 / DETAIL: uuid versus text
 * on every write. The try/catch made it non-fatal, but audit rows were never
 * written and the logs were spammed. Reproduced + fixed live against Postgres
 * 16 on 2026-07-10 (drift scenario: audit col TEXT, portal_positions UUID).
 *
 * Fix: source the audit column from the JOINed row (pp.position_instance_id) so
 * the bound param appears in exactly ONE type context (the WHERE). This test
 * pins that shape so a future edit can't reintroduce the dual-context bind.
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

// Isolate the monolith-write audit INSERT (the one that logs 'monolith_written').
const auditInsert = (() => {
  const marker = "INSERT INTO position_audit_log";
  const start = routeSrc.indexOf(marker, routeSrc.indexOf("'monolith_written'") - 400);
  assert.ok(start >= 0, 'could not locate the monolith audit INSERT');
  // The SQL literal ends at the closing backtick of the template string.
  const end = routeSrc.indexOf('`', start);
  return routeSrc.slice(start, end);
})();

describe('monolith-write audit INSERT — no dual-type-context param bind', () => {
  it("sources position_instance_id from the JOINed row, not the bound param", () => {
    // The audit column must be filled from pp.position_instance_id so its value
    // assignment-casts to whatever type the audit column actually is.
    assert.match(auditInsert, /pp\.position_instance_id,\s*\$2/);
  });

  it("does NOT bind $1 in the SELECT-list (the 42P08 trigger)", () => {
    // The buggy shape put $1 as the fourth SELECT column:
    //   SELECT 'monolith_written', 'kiosk:monolit', po.portal_project_id, $1, $2
    // which reused $1 alongside the WHERE — inconsistent-type deduction.
    assert.doesNotMatch(auditInsert, /portal_project_id,\s*\$1\s*,\s*\$2/);
  });

  it("still binds the id exactly once, in the WHERE", () => {
    const occurrences = (auditInsert.match(/\$1\b/g) || []).length;
    assert.equal(occurrences, 1, `expected $1 exactly once, found ${occurrences}:\n${auditInsert}`);
    assert.match(auditInsert, /WHERE pp\.position_instance_id = \$1/);
  });
});
