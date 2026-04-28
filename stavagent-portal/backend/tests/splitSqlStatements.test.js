/**
 * Tests for splitSqlStatements — guards against the
 * `unterminated dollar-quoted string` regression that bricked
 * production migrations on 2026-04-28 (Cloud Run revision
 * stavagent-portal-backend-00255-srx).
 *
 * Run: node --test stavagent-portal/backend/tests/splitSqlStatements.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitSqlStatements } from '../src/db/splitSqlStatements.js';

describe('splitSqlStatements', () => {
  describe('basic splitting', () => {
    it('returns [] for empty / whitespace-only input', () => {
      assert.deepEqual(splitSqlStatements(''), []);
      assert.deepEqual(splitSqlStatements('   '), []);
      assert.deepEqual(splitSqlStatements(';;;'), []);
      assert.deepEqual(splitSqlStatements('  ;  ;  '), []);
    });

    it('returns [] for non-string input', () => {
      // @ts-expect-error — defensive
      assert.deepEqual(splitSqlStatements(null), []);
      // @ts-expect-error
      assert.deepEqual(splitSqlStatements(undefined), []);
    });

    it('splits simple semicolon-separated statements', () => {
      assert.deepEqual(splitSqlStatements('A; B; C'), ['A', 'B', 'C']);
    });

    it('handles trailing semicolon', () => {
      assert.deepEqual(splitSqlStatements('A; B;'), ['A', 'B']);
    });

    it('handles statement without trailing semicolon', () => {
      assert.deepEqual(splitSqlStatements('SELECT 1'), ['SELECT 1']);
    });

    it('trims leading/trailing whitespace on each statement', () => {
      assert.deepEqual(
        splitSqlStatements('  A  ;\n\t B  ;'),
        ['A', 'B'],
      );
    });
  });

  describe('dollar-quoted blocks (the regression case)', () => {
    it('keeps a $$ ... $$ block atomic even with inner semicolons', () => {
      // This is the exact pattern from schema-postgres.sql:359-366 that
      // triggered the production migration failure.
      const sql = `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org_id') THEN
          ALTER TABLE users ADD CONSTRAINT fk_users_org_id
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
          END IF;
        END $$;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 1, `expected 1 atomic statement, got ${result.length}`);
      assert.match(result[0], /DO \$\$ BEGIN/);
      assert.match(result[0], /END \$\$/);
    });

    it('keeps a tagged $body$ ... $body$ block atomic', () => {
      const sql = `CREATE FUNCTION foo() RETURNS void AS $body$
        BEGIN
          UPDATE users SET org_id = NULL;
          RAISE NOTICE 'done';
        END;
      $body$ LANGUAGE plpgsql;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 1);
      assert.match(result[0], /\$body\$/);
    });

    it('separates two adjacent DO blocks correctly', () => {
      const sql = `DO $$ BEGIN PERFORM 1; END $$;
                   DO $$ BEGIN PERFORM 2; END $$;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 2);
      assert.match(result[0], /PERFORM 1/);
      assert.match(result[1], /PERFORM 2/);
    });

    it('mixes plain statements and DO blocks', () => {
      const sql = `CREATE TABLE foo (id INT);
                   DO $$ BEGIN ALTER TABLE foo ADD COLUMN bar TEXT; END $$;
                   CREATE INDEX idx_foo ON foo(id);`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 3);
      assert.match(result[0], /CREATE TABLE foo/);
      assert.match(result[1], /DO \$\$ BEGIN/);
      assert.match(result[2], /CREATE INDEX/);
    });

    it('recognises differently-tagged blocks independently', () => {
      // $$ ... $$ followed by $tag$ ... $tag$
      const sql = `DO $$ SELECT 1; $$;
                   CREATE FUNCTION bar() RETURNS int AS $func$ SELECT 2; $func$ LANGUAGE sql;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 2);
    });

    it('does not match $word as a delimiter when not followed by $', () => {
      // $1, $2 are PG parameter markers — must NOT be treated as
      // dollar-quote starters.
      const sql = `INSERT INTO t (a, b) VALUES ($1, $2);
                   INSERT INTO t (a, b) VALUES ($3, $4);`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 2);
    });
  });

  describe('comments', () => {
    it('keeps a -- single-line comment with semicolons inside the buffer', () => {
      // Comments should NOT cause splits — semicolons inside comments
      // are part of the statement (or at least, irrelevant). The buffer
      // can include them; what matters is that they don't FIRE a split.
      const sql = `-- this; comment; has; semicolons
                   SELECT 1;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 1);
      assert.match(result[0], /SELECT 1/);
    });

    it('keeps a /* block comment */ with semicolons intact', () => {
      const sql = `/* DROP TABLE users; -- joke */
                   SELECT 2;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 1);
      assert.match(result[0], /SELECT 2/);
    });

    it('handles mixed -- and /* */ comments around DO block', () => {
      const sql = `-- migration: add fk
                   /* idempotent */
                   DO $$ BEGIN PERFORM 1; END $$;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 1);
      assert.match(result[0], /DO \$\$ BEGIN/);
    });
  });

  describe('string literals', () => {
    it('keeps a single-quoted string with semicolons atomic', () => {
      const sql = `INSERT INTO t (msg) VALUES ('a;b;c');
                   INSERT INTO t (msg) VALUES ('d;e');`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 2);
      assert.match(result[0], /'a;b;c'/);
      assert.match(result[1], /'d;e'/);
    });

    it("handles PostgreSQL escaped quote '' inside string", () => {
      const sql = `INSERT INTO t (msg) VALUES ('it''s; a; test');
                   SELECT 1;`;
      const result = splitSqlStatements(sql);
      assert.equal(result.length, 2);
      assert.match(result[0], /'it''s; a; test'/);
    });
  });

  describe('real-world fragment from schema-postgres.sql', () => {
    it('splits the actual problematic block + surrounding statements correctly', () => {
      // Verbatim transcription of the production-breaking section.
      const sql = `
        CREATE TABLE IF NOT EXISTS organizations (
          id UUID PRIMARY KEY,
          owner_id INT NOT NULL,
          slug TEXT
        );

        -- Runs after CREATE TABLE pass, so organizations already exists.
        -- Uses DO block to avoid "already exists" errors in Cloud SQL logs.
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org_id'
          ) THEN
            ALTER TABLE users ADD CONSTRAINT fk_users_org_id
              FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
          END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
        CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
      `;
      const result = splitSqlStatements(sql);
      // Expect 4 statements: CREATE TABLE, DO block, two CREATE INDEX
      assert.equal(result.length, 4, `expected 4, got ${result.length}: ${JSON.stringify(result.map(s => s.slice(0, 40)))}`);
      assert.match(result[0], /CREATE TABLE IF NOT EXISTS organizations/);
      assert.match(result[1], /DO \$\$ BEGIN[\s\S]*END \$\$/);
      assert.match(result[2], /CREATE INDEX IF NOT EXISTS idx_organizations_owner/);
      assert.match(result[3], /CREATE INDEX IF NOT EXISTS idx_organizations_slug/);
    });
  });
});
