/**
 * Regression tests for the v2-UUID translation gap on the
 * `reclassifySheet` path (registryStore.ts).
 *
 * Bug user-reported 2026-04-25: clicking "Překlasifikovat" in the
 * ItemsTable toolbar showed the correct breakdown in the status text
 * ("hlavní 106 / podřízené 489") but the chevrons + subordinate
 * collapse-expand display in the table disappeared. Items rendered
 * as a flat list with no hierarchy.
 *
 * Root cause: `mergeV2IntoParsedItems` writes raw v2-internal UUIDs
 * into `parsed.parentItemId`. Those UUIDs do NOT match any
 * `parsed.id` in the items array — they're the classifier's own
 * ID space. ItemsTable's `effectiveParentMap` walks `item.parentItemId
 * || currentMainId`, hits the truthy-but-broken v2 UUID, and
 * SKIPS the proximity fallback to `currentMainId`. Result:
 * `subordinateCounts` map is empty → no chevrons, no grouping.
 *
 * The initial-import flow runs `appendMissingSubordinates` AFTER
 * merge, which retranslates all v2 refs into real `parsed.id`s as a
 * side effect. The reclassify flow used to skip that call, leaving
 * the broken IDs in place. Fix: registryStore.reclassifySheet now
 * also calls `appendMissingSubordinates`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseExcelSheet } from '../parser/excelParser';
import { classifyRows } from './rowClassificationService';
import { classifySheet } from './rowClassifierV2';
import {
  extractRawRows,
  mergeV2IntoParsedItems,
  appendMissingSubordinates,
} from './importAdapter';
import { defaultImportConfig } from '../../config/defaultConfig';
import type { ImportConfig, ParsedItem } from '../../types';

const FIXTURES_DIR = resolve(__dirname, '../../../docs');

function loadWorkbook(filename: string): XLSX.WorkBook {
  const buf = readFileSync(resolve(FIXTURES_DIR, filename));
  return XLSX.read(buf, { type: 'buffer' });
}

/** Run the import pipeline once to seed items with `_rawCells`,
 *  matching what's in the Registry store after a fresh import. */
async function importOnce(): Promise<{ workbook: XLSX.WorkBook; sheetName: string; items: ParsedItem[] }> {
  const workbook = loadWorkbook('TEST__ROZPOČET__D6_202.xlsx');
  const sheetName = workbook.SheetNames[0];

  const parseConfig: ImportConfig = {
    ...defaultImportConfig,
    templateName: 'reclassify-test',
    sheetName,
    sheetIndex: 0,
    dataStartRow: 1,
    columns: { kod: 'C', popis: 'E', mj: 'F', mnozstvi: 'G', cenaJednotkova: 'H', cenaCelkem: 'I' },
    flexibleMode: false,
  };

  const result = await parseExcelSheet(workbook, {
    config: parseConfig,
    fileName: 'test.xlsx',
    projectId: 'test-project',
  });

  const items = classifyRows(result.items).items;
  const rawRows = extractRawRows(workbook, sheetName);
  const v2 = classifySheet(rawRows, {
    sheetName,
    templateHint: 'esticon',
    preserveRawCells: true,
  });
  mergeV2IntoParsedItems(items, v2);
  appendMissingSubordinates(items, v2, {
    projectId: 'test-project',
    fileName: 'test.xlsx',
    sheetName,
  });

  return { workbook, sheetName, items };
}

describe('reclassifySheet — v2-UUID translation regression', () => {
  let imported: Awaited<ReturnType<typeof importOnce>>;

  beforeAll(async () => {
    imported = await importOnce();
  });

  it('post-import: every subordinate.parentItemId resolves to an in-sheet main', () => {
    // Baseline — initial import already runs append + retranslate, so
    // this should be green. Asserting it gives us a known-good
    // starting state before the reclassify simulation below.
    const byId = new Map(imported.items.map((i) => [i.id, i]));
    const subs = imported.items.filter((i) => i.rowRole === 'subordinate');
    expect(subs.length).toBeGreaterThan(0);
    for (const sub of subs) {
      expect(sub.parentItemId).toBeTruthy();
      const parent = byId.get(sub.parentItemId!);
      expect(parent, `parent ${sub.parentItemId} for sub at row ${sub.source.rowStart} must exist`).toBeDefined();
      expect(parent?.rowRole).toBe('main');
    }
  });

  it('reclassify with merge-only (no append) leaves dangling v2-UUIDs in parentItemId — repro of the bug', () => {
    // Simulate the BROKEN reclassify path: clone items, run only
    // mergeV2IntoParsedItems (the pre-fix `reclassifySheet`).
    const cloned = imported.items.map((i) => ({ ...i }));
    const rawRows = extractRawRows(imported.workbook, imported.sheetName);

    // Reconstruct rows from preserved _rawCells (matches the actual
    // reclassify implementation in registryStore.ts).
    const maxIdx = Math.max(0, ...cloned.map((i) => i.source_row_index ?? 0));
    const rows: unknown[][] = Array.from({ length: maxIdx + 1 }, () => []);
    for (const item of cloned) {
      if (item.source_row_index !== undefined && item._rawCells) {
        rows[item.source_row_index] = item._rawCells.slice();
      }
    }
    const v2 = classifySheet(rows, {
      sheetName: imported.sheetName,
      templateHint: 'esticon',
      preserveRawCells: false,
    });
    mergeV2IntoParsedItems(cloned, v2);
    // NOTE: NO appendMissingSubordinates here — this is the bug.

    // Now check: for each subordinate, can its parentItemId be found
    // in the items array? Pre-fix this should fail for the majority
    // of subordinates because parentItemId now holds v2-internal UUIDs.
    void rawRows; // keep ref so eslint doesn't flag unused
    const idSet = new Set(cloned.map((i) => i.id));
    const subs = cloned.filter((i) => i.rowRole === 'subordinate' && i.parentItemId);
    const broken = subs.filter((s) => !idSet.has(s.parentItemId!));
    // The bug guarantees broken > 0 (every classified subordinate's
    // parentItemId points to a v2 UUID not in the items array).
    expect(broken.length).toBeGreaterThan(0);
  });

  it('reclassify with merge + appendMissingSubordinates: parentItemIds resolve again — fix verified', () => {
    // Simulate the FIXED reclassify path.
    const cloned = imported.items.map((i) => ({ ...i }));
    const maxIdx = Math.max(0, ...cloned.map((i) => i.source_row_index ?? 0));
    const rows: unknown[][] = Array.from({ length: maxIdx + 1 }, () => []);
    for (const item of cloned) {
      if (item.source_row_index !== undefined && item._rawCells) {
        rows[item.source_row_index] = item._rawCells.slice();
      }
    }
    const v2 = classifySheet(rows, {
      sheetName: imported.sheetName,
      templateHint: 'esticon',
      preserveRawCells: false,
    });
    mergeV2IntoParsedItems(cloned, v2);
    appendMissingSubordinates(cloned, v2, {
      projectId: 'test-project',
      fileName: '<reclassify>',
      sheetName: imported.sheetName,
    });

    // Now every subordinate's parentItemId should resolve to a real
    // parent main in the same sheet — same invariant as the post-
    // import baseline test above.
    const byId = new Map(cloned.map((i) => [i.id, i]));
    const subs = cloned.filter((i) => i.rowRole === 'subordinate');
    expect(subs.length).toBeGreaterThan(0);
    for (const sub of subs) {
      expect(sub.parentItemId, `subordinate at row ${sub.source.rowStart} must have a parent id`).toBeTruthy();
      const parent = byId.get(sub.parentItemId!);
      expect(parent, `parent ${sub.parentItemId} must exist after reclassify`).toBeDefined();
      expect(parent?.rowRole).toBe('main');
    }
  });
});
