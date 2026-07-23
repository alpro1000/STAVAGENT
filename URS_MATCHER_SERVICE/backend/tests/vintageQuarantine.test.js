/**
 * Quarantine of the 2018-vintage ÚRS data (ratified 2026-07-23).
 *
 * Contract: rows imported from the URS201801 (2018) export (source='kros')
 * NEVER participate in code proposals — full exclusion from the output, not a
 * weight reduction. Rows from current-vintage sources (source='otskp', NULL)
 * are untouched. Rollback valve: URS_ALLOW_2018_CATALOG=1.
 *
 * Hermetic: own temp DB via DATABASE_URL, matcher imported after env is set,
 * OTSKP supplement pinned to a nonexistent catalog (pure local door).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const tmpDb = path.join(os.tmpdir(), `vintage-test-${process.pid}.db`);
let matchUrsItems;

beforeAll(async () => {
  process.env.URS_LEARNING = '0';
  process.env.URS_FRONTOFFICE_SEARCH = '0';
  process.env.OTSKP_CATALOG_FILENAME = 'nonexistent-for-vintage-test.xml';
  process.env.DATABASE_URL = `file:${tmpDb}`;
  delete process.env.URS_ALLOW_2018_CATALOG;

  const db = await open({ filename: tmpDb, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS urs_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    urs_code TEXT UNIQUE NOT NULL, urs_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '', description TEXT,
    section_code TEXT, category_path TEXT, price REAL,
    is_imported INTEGER DEFAULT 1, source TEXT
  )`);
  // Same strong name twice: one 2018-vintage row, one current-vintage row.
  const rows = [
    ['111111111', 'Zdivo nosné vnitřní z cihel pálených', 'kros'],
    ['222222222', 'Zdivo nosné vnitřní z cihel pálených dutinových', 'otskp'],
    ['333333333', 'Zásyp jam sypaninou se zhutněním', 'kros'],
  ];
  for (const [code, name, source] of rows) {
    await db.run('INSERT INTO urs_items (urs_code, urs_name, source) VALUES (?, ?, ?)', [code, name, source]);
  }
  await db.close();

  ({ matchUrsItems } = await import('../src/services/ursMatcher.js'));
});

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch { /* already gone */ }
});

test('2018-vintage (kros) rows never appear in proposals by default', async () => {
  const result = await matchUrsItems('Zdivo nosné vnitřní z cihel pálených');
  const codes = result.map((c) => c.urs_code);
  expect(codes).not.toContain('111111111');   // exact-name 2018 row: excluded
  expect(codes).toContain('222222222');        // current-vintage sibling: proposed
});

test('a query whose ONLY match is 2018-vintage yields an honest empty result', async () => {
  const result = await matchUrsItems('Zásyp jam sypaninou se zhutněním');
  expect(result.filter((c) => c.source === 'local')).toEqual([]);
});

test('URS_ALLOW_2018_CATALOG=1 rollback valve re-admits the rows', async () => {
  process.env.URS_ALLOW_2018_CATALOG = '1';
  try {
    const result = await matchUrsItems('Zdivo nosné vnitřní z cihel pálených');
    expect(result.map((c) => c.urs_code)).toContain('111111111');
  } finally {
    delete process.env.URS_ALLOW_2018_CATALOG;
  }
});
