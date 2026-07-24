/**
 * §5.2 Level 1 — end-to-end mechanics of the short-query frontoffice strategy,
 * hermetic (stubbed globalThis.fetch; sandbox egress to *.run.app is blocked by
 * the proxy, so the LIVE before/after delta comes from the Cloud Shell run per
 * eval/README).
 *
 * Proves the full chain on the exact class that motivated the work:
 * the 174 family (ručně 174111101 / strojně 174151101). The frontoffice
 * answers the SHORT intent query with the whole sibling family; the re-rank
 * against the FULL original description must put the right sibling on top.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const tmpDb = path.join(os.tmpdir(), `fostrat-test-${process.pid}.db`);
let matchUrsItems;
const requestedUrls = [];

const FAMILY = [
  { code: '174111101', measureUnit: 'm3', type: 'REFERENTIAL',
    description: 'jam, šachet, rýh nebo kolem objektů v těchto vykopávkách',
    fullDescription: 'Zásyp sypaninou z jakékoliv horniny ručně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách' },
  { code: '174151101', measureUnit: 'm3', type: 'REFERENTIAL',
    description: 'jam, šachet, rýh nebo kolem objektů v těchto vykopávkách',
    fullDescription: 'Zásyp sypaninou z jakékoliv horniny strojně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách' },
  { code: '174211101', measureUnit: 'm3', type: 'REFERENTIAL',
    description: 'jam, šachet, rýh nebo kolem objektů v těchto vykopávkách',
    fullDescription: 'Zásyp sypaninou z jakékoliv horniny ručně s uložením výkopku ve vrstvách bez zhutnění jam, šachet, rýh nebo kolem objektů v těchto vykopávkách' },
];

beforeAll(async () => {
  process.env.URS_LEARNING = '0';
  delete process.env.URS_FRONTOFFICE_SEARCH;
  process.env.OTSKP_CATALOG_FILENAME = 'nonexistent-for-fostrat-test.xml';
  process.env.DATABASE_URL = `file:${tmpDb}`;

  // Empty local DB → the local door contributes nothing; the frontoffice
  // stub is the only answering source.
  const db = await open({ filename: tmpDb, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS urs_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    urs_code TEXT UNIQUE NOT NULL, urs_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '', description TEXT,
    section_code TEXT, category_path TEXT, price REAL,
    is_imported INTEGER DEFAULT 1, source TEXT
  )`);
  await db.close();

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    requestedUrls.push(url);
    const u = new URL(url);
    if (u.pathname.startsWith('/v1/version/metadata/')) {
      return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.pathname === '/v1/search') {
      const q = u.searchParams.get('query') || '';
      // The catalog engine answers SHORT queries; a long verbatim line gets
      // nothing (the measured live behaviour: 0/47 answered).
      const items = q.split(/\s+/).length <= 6 && /Zásyp/i.test(q) ? FAMILY : [];
      return new Response(
        JSON.stringify({ advancedSearch: { items, metadata: { totalItems: items.length } } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 404 });
  };

  ({ matchUrsItems } = await import('../src/services/ursMatcher.js'));
});

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch { /* already gone */ }
});

const RUCNE_LINE =
  'Zásyp sypaninou z jakékoliv horniny ručně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách';
const STROJNE_LINE =
  'Zásyp sypaninou z jakékoliv horniny strojně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách';

test('long ručně line: short query is sent and the ručně+se-zhutněním sibling wins top-1', async () => {
  const result = await matchUrsItems(RUCNE_LINE);
  expect(result.length).toBeGreaterThan(0);
  expect(result[0].urs_code).toBe('174111101');
  expect(result[0].source).toBe('urs_frontoffice');
  expect(result[0].is_web_suggestion).toBe(false);

  const searchUrl = requestedUrls.find((u) => u.includes('/v1/search'));
  const sentQuery = new URL(searchUrl).searchParams.get('query');
  expect(sentQuery.split(/\s+/).length).toBeLessThanOrEqual(5);
  expect(sentQuery).toContain('ručně');
});

test('the strojně twin line flips top-1 to 174151101 — the differentiator decides', async () => {
  const result = await matchUrsItems(STROJNE_LINE);
  expect(result[0].urs_code).toBe('174151101');
});

test('catalog candidates outrank nothing silently: all results carry catalog provenance', async () => {
  const result = await matchUrsItems(RUCNE_LINE);
  for (const c of result.filter((r) => r.source === 'urs_frontoffice')) {
    expect(c.catalog_version).toBeDefined();
    expect(typeof c.name_similarity).toBe('number');
  }
});
