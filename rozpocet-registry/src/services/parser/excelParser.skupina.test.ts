/**
 * Regression test: the parser must read a pre-existing "Skupina" column from
 * the imported file (as written by the Registry export), so the
 * export → import round-trip — and a re-import after deleting the project —
 * keeps the user's work-group assignments instead of forcing a re-classify.
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelSheet } from './excelParser';
import { defaultImportConfig } from '../../config/defaultConfig';
import type { ImportConfig } from '../../types/config';

function bookFromAoa(aoa: unknown[][]): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'List1');
  return wb;
}

const config: ImportConfig = {
  ...defaultImportConfig,
  sheetName: 'List1',
  sheetIndex: 0,
};

describe('excelParser — Skupina column round-trip', () => {
  it('reads work groups from a "Skupina" column when present', async () => {
    // Header row mirrors the export: Kód, Popis, MJ, Množství, Cena j., Cena c., Skupina
    const wb = bookFromAoa([
      ['Kód', 'Popis', 'MJ', 'Množství', 'Cena jednotková', 'Cena celkem', 'Skupina'],
      ['272321', 'Základ ze železobetonu', 'm3', 10, 3000, 30000, 'BETON_MONOLIT'],
      ['630911', 'Bednění stěn', 'm2', 20, 500, 10000, 'BEDNENI'],
      ['SEKCE-A', 'Nadpis sekce', '', '', '', '', 'SEKCE'],
    ]);

    const { items } = await parseExcelSheet(wb, {
      config,
      fileName: 'reimport.xlsx',
      projectId: 'p1',
    });

    const beton = items.find(i => i.kod === '272321');
    const bedneni = items.find(i => i.kod === '630911');
    expect(beton?.skupina).toBe('BETON_MONOLIT');
    expect(bedneni?.skupina).toBe('BEDNENI');
    // 'SEKCE' is a section marker, not a work group → must not become a skupina.
    const sekce = items.find(i => i.kod === 'SEKCE-A');
    if (sekce) expect(sekce.skupina).toBeNull();
  });

  it('leaves skupina null when the file has no "Skupina" column', async () => {
    const wb = bookFromAoa([
      ['Kód', 'Popis', 'MJ', 'Množství', 'Cena jednotková', 'Cena celkem'],
      ['272321', 'Základ ze železobetonu', 'm3', 10, 3000, 30000],
    ]);

    const { items } = await parseExcelSheet(wb, {
      config,
      fileName: 'fresh.xlsx',
      projectId: 'p2',
    });

    expect(items.find(i => i.kod === '272321')?.skupina).toBeNull();
  });
});
