/**
 * Etapa 1 acceptance tests (SPEC §3 — структура намерения + нормализация).
 *
 * Criterion 1: every spec field extracted with source + confidence.
 * Criterion 2: numeric differentiators («tř. 3», «DN 100», «tl. 100 mm»)
 *              preserved through normalization — proven here.
 * Criterion 3: folding symmetric both ways (unaccented finds accented and
 *              vice versa) — unit level + DB round-trip on search_name.
 * Criterion 4: an absent field stays empty — no defaults.
 */

import { extractIntent } from '../src/services/intentExtractor.js';
import { normalizeText, foldDiacritics } from '../src/utils/textNormalizer.js';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

describe('normalizeText — folding + numeric differentiators (criteria 2+3)', () => {
  test('tř. 3 survives normalization with its number', () => {
    const n = normalizeText('Poplatek za uložení stavebního odpadu tř. 3');
    expect(n).toContain('tr 3');
  });

  test('DN 100 survives normalization', () => {
    expect(normalizeText('Potrubí kameninové DN 100')).toContain('dn 100');
  });

  test('tl. 100 mm survives normalization', () => {
    expect(normalizeText('Zateplení fasády EPS tl. 100 mm')).toContain('tl 100 mm');
  });

  test('concrete grade C25/30 survives normalization', () => {
    expect(normalizeText('Podkladní beton C25/30')).toContain('c25/30');
  });

  test('folding is symmetric: accented and unaccented input normalize identically', () => {
    expect(normalizeText('Zdivo nosné z cihel pálených'))
      .toBe(normalizeText('Zdivo nosne z cihel palenych'));
    expect(normalizeText('PŘÍPLATEK za ztížené podmínky'))
      .toBe(normalizeText('PRIPLATEK za ztizene podminky'));
  });

  test('foldDiacritics leaves ASCII and digits untouched', () => {
    expect(foldDiacritics('DN 100 x 50 mm C25/30')).toBe('DN 100 x 50 mm C25/30');
  });
});

describe('extractIntent — field structure (criterion 1)', () => {
  test('every present field carries value + source + confidence', () => {
    const i = extractIntent('Montáž lešení řadového (do výšky 10 m) tl. 100 mm, dodávka a montáž', { unit: 'm2' });
    for (const f of [i.action, i.object, i.unit, i.context, i.supply_scope, ...i.dimensions, ...i.material_specs]) {
      if (f === null) {continue;}
      expect(f).toHaveProperty('value');
      expect(f).toHaveProperty('source');
      expect(typeof f.confidence).toBe('number');
    }
    expect(i.action.value).toBe('montaz');
    expect(i.action.source).toBe('rule');
    expect(i.supply_scope.value).toBe('dodavka_a_montaz');
  });

  test('numeric differentiators land in dimensions/material_specs verbatim', () => {
    const i = extractIntent('Odvoz suti, poplatek za skládku tř. 3, potrubí DN 100, izolace tl. 100 mm');
    expect(i.material_specs.map((s) => s.value)).toContain('tř. 3');
    expect(i.dimensions.map((d) => d.value)).toContain('DN 100');
    expect(i.dimensions.map((d) => d.value)).toContain('tl. 100 mm');
    for (const s of [...i.material_specs, ...i.dimensions]) {
      expect(s.source).toBe('regex');
      expect(s.confidence).toBe(1.0);
    }
  });

  test('search_phrases carry normalized discriminators for the SQL door', () => {
    const i = extractIntent('Zateplení fasády EPS tl. 100 mm, beton C25/30');
    expect(i.search_phrases).toContain('tl 100 mm');
    expect(i.search_phrases).toContain('c25/30');
  });
});

describe('extractIntent — no defaults (criterion 4)', () => {
  test('absent fields stay null / empty', () => {
    const i = extractIntent('Xyzabc qwerty');
    expect(i.action).toBeNull();
    expect(i.unit).toBeNull();
    expect(i.context).toBeNull();
    expect(i.supply_scope).toBeNull();
    expect(i.material_specs).toEqual([]);
    expect(i.dimensions).toEqual([]);
  });

  test('unit comes ONLY from the výměra row, never from description text', () => {
    // "m3" sits right in the text — must NOT be promoted to unit
    const noVymera = extractIntent('Beton základů 12 m3');
    expect(noVymera.unit).toBeNull();

    const withVymera = extractIntent('Beton základů', { unit: 'm3' });
    expect(withVymera.unit).toEqual({ value: 'm3', source: 'vymera', confidence: 1.0 });
  });

  test('bare «montáž» is an action, not an explicit supply statement', () => {
    const i = extractIntent('Montáž zábradlí ocelového');
    expect(i.action.value).toBe('montaz');
    expect(i.supply_scope).toBeNull();
  });

  test('empty input yields an empty structure, no throw', () => {
    const i = extractIntent('');
    expect(i.action).toBeNull();
    expect(i.search_words).toEqual([]);
    expect(i.search_phrases).toEqual([]);
  });
});

describe('production-method modifiers (ratified 2026-07-23, KROS family 174)', () => {
  // Live case: a «ručně» query was answered with the REAL code 174151101
  // «strojně» — one digit apart, plausible name. The modifier fields make the
  // differentiator structural; Etapa 2 turns them into hard gates.
  const RUCNE =
    'Zásyp sypaninou z jakékoliv horniny ručně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách';
  const STROJNE =
    'Zásyp sypaninou z jakékoliv horniny strojně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách';

  test('ručně / strojně extracted as execution_method with source+confidence', () => {
    const a = extractIntent(RUCNE);
    const b = extractIntent(STROJNE);
    expect(a.execution_method).toEqual({ value: 'rucne', source: 'rule', confidence: 1.0 });
    expect(b.execution_method).toEqual({ value: 'strojne', source: 'rule', confidence: 1.0 });
  });

  test('the 174111101/174151101 pair differs ONLY in execution_method', () => {
    const a = extractIntent(RUCNE);
    const b = extractIntent(STROJNE);
    expect(a.execution_method.value).not.toBe(b.execution_method.value);
    expect(a.compaction).toEqual(b.compaction);
    expect(a.action).toEqual(b.action);
    expect(a.material_specs).toEqual(b.material_specs);
    expect(a.dimensions).toEqual(b.dimensions);
  });

  test('se zhutněním / bez zhutnění extracted as compaction', () => {
    expect(extractIntent(RUCNE).compaction)
      .toEqual({ value: 'se_zhutnenim', source: 'rule', confidence: 1.0 });
    expect(extractIntent('Zásyp jam bez zhutnění').compaction)
      .toEqual({ value: 'bez_zhutneni', source: 'rule', confidence: 1.0 });
    expect(extractIntent('Obsyp potrubí vč. zhutnění').compaction.value)
      .toBe('se_zhutnenim');
  });

  test('inflected adjective form («ruční výkop») matches at lower confidence', () => {
    const i = extractIntent('Ruční výkop jam v hornině tř. 3');
    expect(i.execution_method.value).toBe('rucne');
    expect(i.execution_method.confidence).toBe(0.8);
  });

  test('absence stays null — never read as either value (no defaults)', () => {
    const i = extractIntent('Zásyp sypaninou z jakékoliv horniny s uložením výkopku');
    expect(i.execution_method).toBeNull();
    expect(i.compaction).toBeNull();
  });

  test('contradictory signals in one line yield null, not a guess', () => {
    expect(extractIntent('Zásyp ručně i strojně dle podmínek').execution_method).toBeNull();
  });

  test('«strojovna» and «ručník» do not false-positive the method', () => {
    expect(extractIntent('Vybavení strojovny výtahu').execution_method).toBeNull();
    expect(extractIntent('Držák ručníků nerezový').execution_method).toBeNull();
  });
});

describe('search_name DB round-trip — folding both ways (criterion 3)', () => {
  // Mirrors the door's candidate SQL (SEARCH_EXPR in ursMatcher.js) against an
  // in-memory DB whose search_name is written exactly like the importers write
  // it: normalizeText(name + ' ' + description).
  const SEARCH_EXPR =
    "COALESCE(search_name, LOWER(urs_name) || ' ' || LOWER(COALESCE(description, '')))";
  let db;

  beforeAll(async () => {
    db = await open({ filename: ':memory:', driver: sqlite3.Database });
    await db.exec(`CREATE TABLE urs_items (
      urs_code TEXT UNIQUE, urs_name TEXT, description TEXT, search_name TEXT
    )`);
    const rows = [
      ['311238114', 'Zdivo nosné vnitřní z cihel pálených', null],
      ['622211011', 'Montáž kontaktního zateplení vnějších stěn z polystyrénových desek tl. do 120 mm', null],
    ];
    for (const [code, name, desc] of rows) {
      await db.run(
        'INSERT INTO urs_items VALUES (?, ?, ?, ?)',
        [code, name, desc, normalizeText(`${name} ${desc || ''}`)]
      );
    }
  });

  afterAll(async () => { await db.close(); });

  async function candidates(queryText) {
    const words = normalizeText(queryText).split(/\s+/).filter((w) => w.length > 2);
    const conditions = words.map(() => `(${SEARCH_EXPR} LIKE ?)`);
    return db.all(
      `SELECT urs_code FROM urs_items WHERE ${conditions.join(' OR ')}`,
      words.map((w) => `%${w}%`)
    );
  }

  test('unaccented query finds the accented item', async () => {
    const rows = await candidates('zdivo nosne cihel palenych');
    expect(rows.map((r) => r.urs_code)).toContain('311238114');
  });

  test('accented query finds the item too (symmetry)', async () => {
    const rows = await candidates('Zdivo nosné z cihel pálených');
    expect(rows.map((r) => r.urs_code)).toContain('311238114');
  });

  test('accented query with uppercase diacritics still matches', async () => {
    const rows = await candidates('ZATEPLENÍ STĚN POLYSTYRÉNOVÝCH');
    expect(rows.map((r) => r.urs_code)).toContain('622211011');
  });

  test('legacy row without search_name falls back to old ASCII behaviour', async () => {
    await db.run(
      'INSERT INTO urs_items VALUES (?, ?, ?, NULL)',
      ['998276101', 'Presun hmot pro trubni vedeni', null]
    );
    const rows = await candidates('presun hmot trubni');
    expect(rows.map((r) => r.urs_code)).toContain('998276101');
  });
});
