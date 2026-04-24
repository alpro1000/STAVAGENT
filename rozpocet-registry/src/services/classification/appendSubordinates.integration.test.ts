/**
 * Integration tests for the full import pipeline on real .xlsx fixtures.
 *
 * Guards against the parser-gap regression (user-reported 2026-04-24): in
 * standard mode excelParser creates a ParsedItem only for main-code rows
 * and absorbs PP / VV / TS text into the preceding main's popisDetail[].
 * The v1.1 classifier correctly produces 'subordinate' rows but
 * mergeV2IntoParsedItems only updates existing items — never inserts.
 * Result: zero subordinates reach the Registry store.
 *
 * This test replicates the ImportModal pipeline end-to-end (parser →
 * classifyRows → classifySheet → mergeV2IntoParsedItems →
 * appendMissingSubordinates) and asserts subordinates land in the final
 * ParsedItem array with resolvable parent mains on every fixture.
 *
 * Column layouts are hardcoded per fixture per ROW_CLASSIFICATION_ALGORITHM
 * v1.1 §1 template hints (EstiCon → kod C / popis E; Komplet → kod E /
 * popis F). These are the producer signatures Registry users select via
 * ImportModal template picker in production.
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
import type { ImportConfig } from '../../types';
import type { ParsedItem } from '../../types';
import type { ClassificationResult, TemplateHint } from './classifierTypes';

const FIXTURES_DIR = resolve(__dirname, '../../../docs');

/**
 * Load a workbook from docs/ and return both the XLSX handle (for parser)
 * and a list of sheet names.
 */
function loadWorkbook(filename: string): XLSX.WorkBook {
  const buf = readFileSync(resolve(FIXTURES_DIR, filename));
  return XLSX.read(buf, { type: 'buffer' });
}

interface PipelineResult {
  sheetName: string;
  finalItems: ParsedItem[];
  v2Result: ClassificationResult;
  appended: number;
  clearedDetail: number;
}

/**
 * Run the full ImportModal pipeline against one sheet and return the
 * final ParsedItem[] that would land in the store.
 *
 * Deliberately uses standard (non-flexible) parser mode so the parser-gap
 * scenario is actually exercised — otherwise every row becomes a parsed
 * item and there's nothing for `appendMissingSubordinates` to do.
 */
async function runFullPipeline(
  workbook: XLSX.WorkBook,
  sheetName: string,
  parserColumns: ImportConfig['columns'],
  templateHint: TemplateHint,
): Promise<PipelineResult> {
  const parseConfig: ImportConfig = {
    ...defaultImportConfig,
    templateName: 'test-' + sheetName,
    sheetName,
    sheetIndex: 0,
    dataStartRow: 1,
    columns: parserColumns,
    flexibleMode: false,
  };

  const result = await parseExcelSheet(workbook, {
    config: parseConfig,
    fileName: 'test.xlsx',
    projectId: 'test-project',
  });

  const classifiedRowItems = classifyRows(result.items).items;

  const rawRows = extractRawRows(workbook, sheetName);
  const v2Result = classifySheet(rawRows, {
    sheetName,
    templateHint,
    preserveRawCells: true,
  });

  mergeV2IntoParsedItems(classifiedRowItems, v2Result);
  const { appended, clearedDetail } = appendMissingSubordinates(
    classifiedRowItems,
    v2Result,
    {
      projectId: 'test-project',
      fileName: 'test.xlsx',
      sheetName,
    },
  );

  return {
    sheetName,
    finalItems: classifiedRowItems,
    v2Result,
    appended,
    clearedDetail,
  };
}

describe('full pipeline: D6_202.xlsx (EstiCon)', () => {
  // EstiCon layout — typ col 0, por col 1, kod col 2 → C; popis col 4 → E.
  const parserColumns: ImportConfig['columns'] = {
    kod: 'C',
    popis: 'E',
    mj: 'F',
    mnozstvi: 'G',
    cenaJednotkova: 'H',
    cenaCelkem: 'I',
  };

  let results: PipelineResult[];

  beforeAll(async () => {
    const wb = loadWorkbook('TEST__ROZPOČET__D6_202.xlsx');
    results = await Promise.all(
      wb.SheetNames.map((name) =>
        runFullPipeline(wb, name, parserColumns, 'esticon'),
      ),
    );
  });

  it('produces subordinates in the final ParsedItem array on at least one sheet', () => {
    const totalSubs = results.reduce(
      (sum, r) => sum + r.finalItems.filter((i) => i.rowRole === 'subordinate').length,
      0,
    );
    expect(totalSubs).toBeGreaterThan(0);
  });

  it('every classified subordinate reaches the final store', () => {
    for (const r of results) {
      const subsInStore = r.finalItems.filter((i) => i.rowRole === 'subordinate').length;
      // The classifier's count is the source of truth — every subordinate
      // in v2Result.items must be represented as a ParsedItem in the
      // final array (either pre-existed from parser or appended by us).
      expect(subsInStore).toBe(r.v2Result.subordinateCount);
    }
  });

  it('every subordinate resolves to a real parent main in the same sheet', () => {
    for (const r of results) {
      const byId = new Map(r.finalItems.map((i) => [i.id, i]));
      for (const sub of r.finalItems) {
        if (sub.rowRole !== 'subordinate') continue;
        expect(sub.parentItemId, `subordinate at row ${sub.source.rowStart} must have a parent id`).toBeTruthy();
        const parent = byId.get(sub.parentItemId!);
        expect(parent, `parent ${sub.parentItemId} must exist in the sheet`).toBeDefined();
        expect(parent?.rowRole, 'parent must be a main').toBe('main');
      }
    }
  });

  it('appendMissingSubordinates actually fired (parser gap reproduced)', () => {
    // Sanity: if the parser already produced every row as an item (e.g.
    // someone switched default to flexibleMode), `appended` would be 0
    // and this test would no longer guard the regression. Assert the
    // gap was exercised on at least one sheet.
    const anyAppended = results.some((r) => r.appended > 0);
    expect(anyAppended).toBe(true);
  });
});

describe('full pipeline: Kyšice.xlsx (Komplet OTSKP)', () => {
  // Komplet layout — por col 2, typ col 3, kod col 4 → E; popis col 5 → F.
  const parserColumns: ImportConfig['columns'] = {
    kod: 'E',
    popis: 'F',
    mj: 'G',
    mnozstvi: 'H',
    cenaJednotkova: 'I',
    cenaCelkem: 'J',
  };

  let results: PipelineResult[];

  beforeAll(async () => {
    const wb = loadWorkbook('011-26_-_I-26_Kyšice_-_Plzeň__Hřbitovní.xlsx');
    results = await Promise.all(
      wb.SheetNames.map((name) =>
        runFullPipeline(wb, name, parserColumns, 'komplet'),
      ),
    );
  });

  it('produces subordinates in the final ParsedItem array on at least one sheet', () => {
    const totalSubs = results.reduce(
      (sum, r) => sum + r.finalItems.filter((i) => i.rowRole === 'subordinate').length,
      0,
    );
    expect(totalSubs).toBeGreaterThan(0);
  });

  it('every classified subordinate reaches the final store', () => {
    for (const r of results) {
      const subsInStore = r.finalItems.filter((i) => i.rowRole === 'subordinate').length;
      expect(subsInStore).toBe(r.v2Result.subordinateCount);
    }
  });

  it('every subordinate resolves to a real parent main in the same sheet', () => {
    for (const r of results) {
      const byId = new Map(r.finalItems.map((i) => [i.id, i]));
      for (const sub of r.finalItems) {
        if (sub.rowRole !== 'subordinate') continue;
        expect(sub.parentItemId).toBeTruthy();
        const parent = byId.get(sub.parentItemId!);
        expect(parent).toBeDefined();
        expect(parent?.rowRole).toBe('main');
      }
    }
  });
});

describe('full pipeline: Veselí.xlsx (Komplet ÚRS)', () => {
  const parserColumns: ImportConfig['columns'] = {
    kod: 'E',
    popis: 'F',
    mj: 'G',
    mnozstvi: 'H',
    cenaJednotkova: 'I',
    cenaCelkem: 'J',
  };

  let results: PipelineResult[];

  beforeAll(async () => {
    const wb = loadWorkbook('IO01_-_ZTV_Veselí_u_Přelouče__zadání_.xlsx');
    results = await Promise.all(
      wb.SheetNames.map((name) =>
        runFullPipeline(wb, name, parserColumns, 'komplet'),
      ),
    );
  });

  it('produces subordinates in the final ParsedItem array on at least one sheet', () => {
    const totalSubs = results.reduce(
      (sum, r) => sum + r.finalItems.filter((i) => i.rowRole === 'subordinate').length,
      0,
    );
    expect(totalSubs).toBeGreaterThan(0);
  });

  it('every classified subordinate reaches the final store', () => {
    for (const r of results) {
      const subsInStore = r.finalItems.filter((i) => i.rowRole === 'subordinate').length;
      expect(subsInStore).toBe(r.v2Result.subordinateCount);
    }
  });

  it('every subordinate resolves to a real parent main in the same sheet', () => {
    for (const r of results) {
      const byId = new Map(r.finalItems.map((i) => [i.id, i]));
      for (const sub of r.finalItems) {
        if (sub.rowRole !== 'subordinate') continue;
        expect(sub.parentItemId).toBeTruthy();
        const parent = byId.get(sub.parentItemId!);
        expect(parent).toBeDefined();
        expect(parent?.rowRole).toBe('main');
      }
    }
  });
});
