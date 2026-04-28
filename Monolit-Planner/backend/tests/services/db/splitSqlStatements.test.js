/**
 * Tests for splitSqlStatements (Monolit copy).
 *
 * This is a lightweight subset of the Portal backend's 18-case suite
 * — same utility, same regression to guard against. Each backend
 * keeps its own copy because the two backends are independent npm
 * packages with different test runners (Portal: node:test;
 * Monolit: jest). When the splitter changes, both copies must be
 * updated together.
 *
 * Run via:
 *   cd Monolit-Planner/backend && npm test -- splitSqlStatements
 */

import { describe, test, expect } from '@jest/globals';
import { splitSqlStatements } from '../../../src/db/splitSqlStatements.js';

describe('splitSqlStatements (Monolit)', () => {
  test('splits simple semicolon-separated statements', () => {
    expect(splitSqlStatements('A; B; C')).toEqual(['A', 'B', 'C']);
  });

  test('returns [] for empty input', () => {
    expect(splitSqlStatements('')).toEqual([]);
    expect(splitSqlStatements('  ;  ;  ')).toEqual([]);
  });

  test('keeps a $$ ... $$ block atomic — the regression case', () => {
    const sql = `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_x') THEN
        ALTER TABLE t ADD CONSTRAINT fk_x FOREIGN KEY (x) REFERENCES y(id);
      END IF;
    END $$;`;
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/DO \$\$ BEGIN/);
    expect(result[0]).toMatch(/END \$\$/);
  });

  test('keeps tagged $body$ ... $body$ block atomic', () => {
    const sql = `CREATE FUNCTION foo() RETURNS void AS $body$
      BEGIN UPDATE t SET x = 1; END;
    $body$ LANGUAGE plpgsql;`;
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(1);
  });

  test('separates two adjacent DO blocks', () => {
    const sql = `DO $$ BEGIN PERFORM 1; END $$;
                 DO $$ BEGIN PERFORM 2; END $$;`;
    expect(splitSqlStatements(sql)).toHaveLength(2);
  });

  test('mixes plain statements and DO blocks', () => {
    const sql = `CREATE TABLE foo (id INT);
                 DO $$ BEGIN ALTER TABLE foo ADD COLUMN bar TEXT; END $$;
                 CREATE INDEX idx_foo ON foo(id);`;
    expect(splitSqlStatements(sql)).toHaveLength(3);
  });

  test('keeps single-quoted string with semicolons intact', () => {
    const sql = `INSERT INTO t (msg) VALUES ('a;b;c');
                 INSERT INTO t (msg) VALUES ('d;e');`;
    expect(splitSqlStatements(sql)).toHaveLength(2);
  });

  test('does not split on semicolons inside -- comments', () => {
    const sql = `-- this; comment; has; semicolons
                 SELECT 1;`;
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/SELECT 1/);
  });

  test('does not match $1, $2 PG parameter markers as quote starters', () => {
    const sql = `INSERT INTO t (a, b) VALUES ($1, $2);
                 INSERT INTO t (a, b) VALUES ($3, $4);`;
    expect(splitSqlStatements(sql)).toHaveLength(2);
  });
});
