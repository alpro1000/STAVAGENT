/**
 * Regression guard for the audit-log write discipline in position-instances.js.
 *
 * Two prod incident classes define the contract this file pins:
 *
 * 1. 42P08 dual-type-context bind: binding ONE parameter as both the audit
 *    column value (SELECT-list) and the portal_positions filter (WHERE) made
 *    Postgres deduce it as two drifted column types (legacy TEXT audit table
 *    vs UUID portal_positions) → `inconsistent types deduced for parameter` on
 *    every kiosk write. Reproduced + fixed live against Postgres 16
 *    (2026-07-10). The safe shape sources the audit column from the JOINed row
 *    (pp.position_instance_id) so the param binds in exactly ONE context.
 *
 * 2. Audit-inside-transaction: an audit INSERT between BEGIN and COMMIT made
 *    any audit failure (schema drift) roll back the PRIMARY write it was
 *    documenting (dov_payload lost with a 500; earlier the missing `actor`
 *    column killed monolith write-backs for weeks).
 *
 * Both are now encoded once in the writeAuditLog helper; every event routes
 * through it, and audit calls run AFTER the transaction commits. These tests
 * pin the helper's shape, the routing, and the after-commit placement — with
 * alias-agnostic and quote-agnostic checks, because the previous version of
 * this test was evadable ('FROM portal_positions pp' literal alias filter,
 * single-quote-only BEGIN check).
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
 * Every position_audit_log INSERT template literal in the file. Each SQL
 * template contains no backticks, so `[^\`]*` bounds the match to ONE
 * statement (a lazy [\s\S]*? would run across statements).
 */
const allAuditInserts = [...routeSrc.matchAll(
  /INSERT INTO position_audit_log[^`]*/g,
)].map(m => m[0].trimEnd());

describe('audit INSERT shapes — no dual-type-context param bind (42P08)', () => {
  it('exactly the two helper shapes exist (SELECT-style + VALUES-style), both inside writeAuditLog', () => {
    assert.equal(
      allAuditInserts.length, 2,
      `expected exactly 2 audit INSERT literals (both in writeAuditLog), found ${allAuditInserts.length} — ` +
      'a new inline audit INSERT outside the helper reintroduces the shape-drift risk; route new events through writeAuditLog',
    );
    const helperStart = routeSrc.indexOf('async function writeAuditLog');
    assert.ok(helperStart >= 0, 'writeAuditLog helper not found');
    for (const sql of allAuditInserts) {
      assert.ok(
        routeSrc.indexOf(sql) > helperStart,
        `an audit INSERT lives outside the writeAuditLog helper:\n${sql}`,
      );
    }
  });

  // Alias-agnostic: any SELECT-style audit INSERT joining portal_positions
  // (whatever the alias) must bind its WHERE parameter exactly once.
  for (const sql of allAuditInserts.filter(s => /FROM\s+portal_positions/i.test(s))) {
    it('SELECT-style: sources the audit column from the JOINed row, not a bound param', () => {
      assert.match(sql, /SELECT \$1, \$2, po\.portal_project_id, pp\.position_instance_id, \$3, \$4/);
    });

    it('SELECT-style: binds the instance id exactly once, in the WHERE', () => {
      const whereParam = sql.match(/WHERE\s+\w+\.position_instance_id\s*=\s*(\$\d+)/)?.[1];
      assert.ok(whereParam, `no WHERE position_instance_id = $n found:\n${sql}`);
      const occurrences = (sql.match(new RegExp(`\\${whereParam}\\b`, 'g')) || []).length;
      assert.equal(
        occurrences, 1,
        `expected ${whereParam} exactly once (dual-context bind → 42P08 on drifted schema), found ${occurrences}:\n${sql}`,
      );
    });
  }
});

describe('writeAuditLog helper — non-fatal by construction', () => {
  const helperSrc = routeSrc.slice(
    routeSrc.indexOf('async function writeAuditLog'),
    routeSrc.indexOf('function formatPositionInstance'),
  );

  it('wraps both INSERT shapes in a catch that only warns', () => {
    assert.match(helperSrc, /catch \(auditErr\)/);
    assert.match(helperSrc, /console\.warn/);
    assert.ok(!/\bthrow\b/.test(helperSrc), 'writeAuditLog must never rethrow — audit is telemetry');
  });
});

describe('every audit event routes through the helper, AFTER any transaction commits', () => {
  const EVENTS = ['monolith_written', 'dov_written', 'template_saved', 'template_applied', 'bulk_import'];

  for (const event of EVENTS) {
    it(`${event}: call site uses writeAuditLog and is not inside a BEGIN…COMMIT window`, () => {
      const callRe = new RegExp(`writeAuditLog\\(client, '${event}'`);
      const m = routeSrc.match(callRe);
      assert.ok(m, `no writeAuditLog call for ${event}`);
      const callIdx = routeSrc.indexOf(m[0]);

      // Quote-agnostic: the LAST transaction verb textually before the call
      // must not be BEGIN — i.e. the audit runs after COMMIT/ROLLBACK (or in
      // a handler with no transaction at all).
      const verbs = [...routeSrc.slice(0, callIdx).matchAll(/query\(\s*["'`](BEGIN|COMMIT|ROLLBACK)/g)];
      const lastVerb = verbs.length ? verbs[verbs.length - 1][1] : null;
      assert.notEqual(
        lastVerb, 'BEGIN',
        `${event} audit call sits inside an open transaction — an audit failure would roll back the primary write`,
      );
    });
  }
});

describe('kiosk write handlers — payload write must not share a transaction with anything', () => {
  for (const route of ["router.post('/:instanceId/monolith'", "router.post('/:instanceId/dov'"] ) {
    it(`${route.includes('monolith') ? 'monolith' : 'dov'} handler opens no transaction (quote-agnostic)`, () => {
      const start = routeSrc.indexOf(route);
      assert.ok(start >= 0, `handler ${route} not found`);
      // Handler ends at the next router.<verb>( declaration.
      const rest = routeSrc.slice(start + route.length);
      const end = rest.search(/router\.(get|post|put|delete|patch)\(/);
      const handlerSrc = rest.slice(0, end === -1 ? undefined : end);
      assert.ok(
        !/query\(\s*["'`]BEGIN/.test(handlerSrc),
        'kiosk write handler opens a transaction — the single atomic UPDATE + post-write non-fatal audit contract is broken',
      );
    });
  }
});
