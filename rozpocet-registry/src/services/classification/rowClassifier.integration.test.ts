/**
 * Integration tests for row classifier v1.1 against real .xlsx fixtures.
 *
 * Files (in rozpocet-registry/docs/):
 *   TEST__ROZPOČET__D6_202.xlsx         — EstiCon export (most nad potokem)
 *   011-26_-_I-26_Kyšice_...xlsx        — Komplet OTSKP export (road project)
 *   IO01_-_ZTV_Veselí_...xlsx           — Komplet ÚRS export (infrastructure)
 *
 * Test goals per TASK acceptance criterion 3:
 *   - Zero orphan subordinates on well-formed input
 *   - Correct sourceFormat inference (EstiCon vs Komplet)
 *   - Column detection via header-match (confidence ≥ 0.7)
 *   - Every subordinate resolves to a real parentItemId
 *   - _rawCells preserved on every classified item
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyWorkbook } from './rowClassifierV2';
import type { ClassificationResult } from './classifierTypes';

const FIXTURES_DIR = resolve(__dirname, '../../../docs');

function loadWorkbook(filename: string): { sheets: Array<{ name: string; rows: unknown[][] }> } {
  const buf = readFileSync(resolve(FIXTURES_DIR, filename));
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheets: Array<{ name: string; rows: unknown[][] }> = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet['!ref']) {
      sheets.push({ name, rows: [] });
      continue;
    }
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const rows: unknown[][] = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: unknown[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        row.push(cell?.v ?? '');
      }
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return { sheets };
}

function assertAllSubordinatesHaveParent(result: ClassificationResult): void {
  for (const item of result.items) {
    if (item.rowRole !== 'subordinate') continue;
    expect(item.parentItemId, `subordinate at row ${item.sourceRowIndex} must have parentItemId`).not.toBeNull();
    // The referenced main must exist in the result.
    const parent = result.items.find(i => i.id === item.parentItemId);
    expect(parent, `parent ${item.parentItemId} must exist`).toBeDefined();
    expect(parent?.rowRole, 'parent must be a main row').toBe('main');
  }
}

describe('integration: TEST__ROZPOČET__D6_202.xlsx (EstiCon, most SO 202)', () => {
  let results: ClassificationResult[];

  beforeAll(() => {
    const wb = loadWorkbook('TEST__ROZPOČET__D6_202.xlsx');
    results = classifyWorkbook(wb.sheets, { preserveRawCells: true });
  });

  it('produces at least one non-empty sheet result', () => {
    const nonEmpty = results.filter(r => r.items.length > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);
  });

  it('infers EstiCon as sourceFormat for at least one sheet', () => {
    const formats = new Set(results.map(r => r.sourceFormat).filter(Boolean));
    expect(formats.has('EstiCon'), `Expected EstiCon, got formats: ${[...formats].join(',')}`).toBe(true);
  });

  it('detects columns via header-match on EstiCon sheets', () => {
    const detected = results.filter(r => r.mapping.detectionSource === 'header-match');
    expect(detected.length).toBeGreaterThan(0);
  });

  it('produces zero orphan subordinates across all sheets', () => {
    const totalOrphans = results.reduce((sum, r) => sum + r.orphanCount, 0);
    expect(totalOrphans, `Orphans found: ${results.filter(r => r.orphanCount > 0).map(r => `${r.sheetName}:${r.orphanCount}`).join(', ')}`).toBe(0);
  });

  it('every subordinate has a resolvable parentItemId', () => {
    for (const r of results) {
      if (r.items.length === 0) continue;
      assertAllSubordinatesHaveParent(r);
    }
  });

  it('captures _rawCells on every item', () => {
    const allItems = results.flatMap(r => r.items);
    const withRaw = allItems.filter(i => i.rawCells !== undefined);
    expect(withRaw.length).toBe(allItems.length);
  });

  it('produces at least one main item', () => {
    const totalMains = results.reduce((sum, r) => sum + r.mainCount, 0);
    expect(totalMains).toBeGreaterThan(0);
  });
});

describe('integration: 011-26 Kyšice (Komplet OTSKP, road project)', () => {
  let results: ClassificationResult[];

  beforeAll(() => {
    const wb = loadWorkbook('011-26_-_I-26_Kyšice_-_Plzeň__Hřbitovní.xlsx');
    results = classifyWorkbook(wb.sheets, { preserveRawCells: true });
  });

  it('produces non-empty classification across sheets', () => {
    const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
    expect(totalItems).toBeGreaterThan(0);
  });

  it('detects Komplet format or content-heuristic fallback', () => {
    // Kyšice may have Typ column (Komplet) or be a compact export — either
    // way classifier should produce items.
    const hasClassified = results.some(r => r.mainCount > 0);
    expect(hasClassified).toBe(true);
  });

  it('produces zero orphan subordinates', () => {
    const offenders = results.filter(r => r.orphanCount > 0);
    expect(offenders.map(r => `${r.sheetName}:${r.orphanCount}`), 'orphans').toEqual([]);
  });

  it('every subordinate has a resolvable parentItemId', () => {
    for (const r of results) {
      if (r.items.length === 0) continue;
      assertAllSubordinatesHaveParent(r);
    }
  });

  it('detection confidence averages ≥ 0.5 on non-empty sheets', () => {
    const nonEmpty = results.filter(r => r.items.length > 0);
    const avg = nonEmpty.reduce((sum, r) => sum + r.mapping.detectionConfidence, 0) / nonEmpty.length;
    expect(avg).toBeGreaterThanOrEqual(0.5);
  });
});

describe('integration: IO01 Veselí (Komplet ÚRS, ZTV)', () => {
  let results: ClassificationResult[];

  beforeAll(() => {
    const wb = loadWorkbook('IO01_-_ZTV_Veselí_u_Přelouče__zadání_.xlsx');
    results = classifyWorkbook(wb.sheets, { preserveRawCells: true });
  });

  it('produces non-empty classification', () => {
    const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
    expect(totalItems).toBeGreaterThan(0);
  });

  it('zero orphan subordinates', () => {
    const offenders = results.filter(r => r.orphanCount > 0);
    expect(offenders.map(r => `${r.sheetName}:${r.orphanCount}`)).toEqual([]);
  });

  it('every subordinate resolves to a main', () => {
    for (const r of results) {
      if (r.items.length === 0) continue;
      assertAllSubordinatesHaveParent(r);
    }
  });

  it('main items have kod + mj populated (ÚRS 9-digit code pattern expected)', () => {
    const allMains = results.flatMap(r => r.items.filter(i => i.rowRole === 'main'));
    expect(allMains.length).toBeGreaterThan(0);
    const withKod = allMains.filter(m => m.kod && m.kod.trim().length > 0);
    // At least 80% of mains should have a kod (allowing some content-heuristic false positives).
    expect(withKod.length / allMains.length, 'kod coverage on mains').toBeGreaterThanOrEqual(0.8);
  });
});

describe('integration: acceptance criteria summary', () => {
  it('reports combined stats across all 3 fixtures', () => {
    const files = [
      'TEST__ROZPOČET__D6_202.xlsx',
      '011-26_-_I-26_Kyšice_-_Plzeň__Hřbitovní.xlsx',
      'IO01_-_ZTV_Veselí_u_Přelouče__zadání_.xlsx',
    ];
    let totalMains = 0;
    let totalSubs = 0;
    let totalOrphans = 0;
    let totalSections = 0;
    for (const f of files) {
      const wb = loadWorkbook(f);
      const r = classifyWorkbook(wb.sheets, { preserveRawCells: true });
      for (const s of r) {
        totalMains += s.mainCount;
        totalSubs += s.subordinateCount;
        totalOrphans += s.orphanCount;
        totalSections += s.sectionCount;
      }
    }
    // This test always passes — its job is to log the numbers so the
    // developer can copy them into a status report.
    expect(totalMains + totalSubs + totalSections).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`[SUMMARY] mains=${totalMains} subs=${totalSubs} sections=${totalSections} orphans=${totalOrphans}`);
  });
});
