/**
 * Honest-refusal floor for the fuzzy local door (ratified «go floor»).
 *
 * Contract: the local door never returns a fuzzy candidate whose confidence
 * (Levenshtein scale) is below CONFIDENCE_THRESHOLDS.MEDIUM (0.6). A line
 * where nothing clears the floor yields an honest empty local result instead
 * of top-5 noise. Other doors' scales (otskp / frontoffice / web) are NOT
 * touched by this floor.
 *
 * Hermetic: seeds its own temp SQLite DB via DATABASE_URL and imports the
 * matcher dynamically AFTER the env is pinned.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const tmpDb = path.join(os.tmpdir(), `floor-test-${process.pid}.db`);
let matchUrsItems;

beforeAll(async () => {
  process.env.URS_LEARNING = '0';
  process.env.URS_FRONTOFFICE_SEARCH = '0';
  // Point the OTSKP supplement door at a nonexistent catalog (fail-soft []) so
  // the assertions see the PURE local door — otherwise supplement candidates
  // (their own scale, up to 1.0) crowd sub-floor locals out of the merged top-5
  // and the floor assertions pass/fail for the wrong reason.
  process.env.OTSKP_CATALOG_FILENAME = 'nonexistent-for-floor-test.xml';
  process.env.DATABASE_URL = `file:${tmpDb}`;

  const db = await open({ filename: tmpDb, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS urs_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    urs_code TEXT UNIQUE NOT NULL, urs_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '', description TEXT,
    section_code TEXT, category_path TEXT, price REAL,
    is_imported INTEGER DEFAULT 1
  )`);
  // Strong row: near-identical to the strong query (similarity > 0.8 → conf 0.9).
  // Weak rows: share one searchable word with the weak query so the SQL
  // pre-filter returns them, but full-string similarity stays far below 0.6.
  const rows = [
    ['111111111', 'Zdivo nosné vnitřní z cihel pálených'],
    ['222222222', 'Montáž potrubí plastového odpadního svařovaného v zemi'],
    ['333333333', 'Demontáž potrubí litinového kanalizačního včetně tvarovek a uložení'],
  ];
  for (const [code, name] of rows) {
    await db.run('INSERT INTO urs_items (urs_code, urs_name) VALUES (?, ?)', [code, name]);
  }
  await db.close();

  ({ matchUrsItems } = await import('../src/services/ursMatcher.js'));
});

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch { /* already gone */ }
});

test('no fuzzy local candidate below the MEDIUM floor is ever returned', async () => {
  // Shares the word "potrubí" with two seeded rows (SQL pre-filter hits) but the
  // full description is a different work — similarity lands well under 0.6.
  const result = await matchUrsItems('Oprava potrubí betonového kruhového');
  const local = result.filter((c) => c.source === 'local');
  for (const c of local) {
    expect(c.confidence).toBeGreaterThanOrEqual(0.6);
  }
});

test('a strong fuzzy match survives the floor', async () => {
  const result = await matchUrsItems('Zdivo nosné vnitřní z cihel pálených');
  const local = result.filter((c) => c.source === 'local');
  expect(local.length).toBeGreaterThan(0);
  expect(local[0].urs_code).toBe('111111111');
  expect(local[0].confidence).toBeGreaterThanOrEqual(0.6);
});

test('URS_LOCAL_CONF_FLOOR=0 rollback valve restores pre-floor behaviour', async () => {
  process.env.URS_LOCAL_CONF_FLOOR = '0';
  try {
    const result = await matchUrsItems('Oprava potrubí betonového kruhového');
    const local = result.filter((c) => c.source === 'local');
    // With the valve open, sub-floor fuzzy noise flows again.
    expect(local.some((c) => c.confidence < 0.6)).toBe(true);
  } finally {
    delete process.env.URS_LOCAL_CONF_FLOOR;
  }
});
