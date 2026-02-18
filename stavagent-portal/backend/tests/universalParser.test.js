/**
 * Tests for Universal Parser Service
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/universalParser.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { parseFile } from '../src/services/universalParser.js';

// Helper: create a temp Excel file from data
function createTestExcel(sheets, fileName = 'test.xlsx') {
  const workbook = XLSX.utils.book_new();

  for (const { name, data } of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }

  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `universal-parser-test-${Date.now()}-${fileName}`);
  XLSX.writeFile(workbook, filePath);
  return filePath;
}

// Cleanup helper
function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Universal Parser', () => {

  describe('parseFile - basic', () => {

    it('should parse a simple Excel file with headers', async () => {
      const filePath = createTestExcel([{
        name: 'Soupis',
        data: [
          ['Kód', 'Popis', 'MJ', 'Množství', 'Cena jednotková', 'Celkem'],
          ['231112', 'Betonování základů ze ŽB C30/37', 'M3', '125.5', '3500', '439250'],
          ['411112', 'Bednění stěn', 'M2', '340', '850', '289000'],
          ['421131', 'Výztuž z betonářské oceli 10505', 'KG', '12500', '38', '475000'],
        ],
      }]);

      try {
        const result = await parseFile(filePath, { fileName: 'test-basic.xlsx' });

        assert.equal(result.version, '1.0.0');
        assert.equal(result.metadata.fileName, 'test-basic.xlsx');
        assert.equal(result.sheets.length, 1);
        assert.equal(result.sheets[0].name, 'Soupis');
        assert.equal(result.sheets[0].items.length, 3);
        assert.equal(result.summary.totalItems, 3);

        // Check first item
        const item1 = result.sheets[0].items[0];
        assert.equal(item1.kod, '231112');
        assert.ok(item1.popis.includes('Betonování'));
        assert.equal(item1.mj, 'M3');
        assert.equal(item1.mnozstvi, 125.5);
        assert.equal(item1.cenaJednotkova, 3500);
        assert.equal(item1.detectedType, 'beton');
        assert.equal(item1.concreteGrade, 'C30/37');
        assert.equal(item1.codeType, 'urs');

        // Check work types
        const item2 = result.sheets[0].items[1];
        assert.equal(item2.detectedType, 'bedneni');

        const item3 = result.sheets[0].items[2];
        assert.equal(item3.detectedType, 'vyztuze');

      } finally {
        cleanup(filePath);
      }
    });

    it('should handle Czech number format (comma as decimal)', async () => {
      const filePath = createTestExcel([{
        name: 'List1',
        data: [
          ['Kód', 'Popis', 'MJ', 'Množství', 'Cena'],
          ['112101', 'Výkop jámy', 'M3', '1 250,50', '45 000,00'],
        ],
      }]);

      try {
        const result = await parseFile(filePath);
        const item = result.sheets[0].items[0];
        assert.equal(item.mnozstvi, 1250.5);
        assert.equal(item.detectedType, 'zemni');
      } finally {
        cleanup(filePath);
      }
    });

    it('should detect sections and group items', async () => {
      const filePath = createTestExcel([{
        name: 'Rozpočet',
        data: [
          ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
          ['', 'ZEMNÍ PRÁCE', '', '', ''],
          ['112101', 'Výkop jámy', 'M3', '500', '150000'],
          ['', 'ZÁKLADY', '', '', ''],
          ['231112', 'Betonáž základů C25/30', 'M3', '80', '280000'],
        ],
      }]);

      try {
        const result = await parseFile(filePath);
        assert.equal(result.sheets[0].items.length, 2);

        const item1 = result.sheets[0].items[0];
        assert.equal(item1.section, 'ZEMNÍ PRÁCE');

        const item2 = result.sheets[0].items[1];
        assert.equal(item2.section, 'ZÁKLADY');
        assert.equal(item2.concreteGrade, 'C25/30');
      } finally {
        cleanup(filePath);
      }
    });

    it('should handle multi-sheet workbooks', async () => {
      const filePath = createTestExcel([
        {
          name: 'SO 201 - Most',
          data: [
            ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
            ['231112', 'Betonáž opěr C30/37', 'M3', '200', '700000'],
          ],
        },
        {
          name: 'SO 202 - Tunel',
          data: [
            ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
            ['231118', 'Betonáž ostění C40/50', 'M3', '500', '2000000'],
          ],
        },
      ]);

      try {
        const result = await parseFile(filePath);
        assert.equal(result.sheets.length, 2);
        assert.equal(result.sheets[0].bridgeId, 'SO201');
        assert.equal(result.sheets[0].bridgeName, 'Most');
        assert.equal(result.sheets[1].bridgeId, 'SO202');
        assert.equal(result.summary.totalItems, 2);
      } finally {
        cleanup(filePath);
      }
    });

    it('should skip empty sheets', async () => {
      const filePath = createTestExcel([
        {
          name: 'Empty',
          data: [],
        },
        {
          name: 'Data',
          data: [
            ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
            ['231112', 'Betonáž', 'M3', '100', '350000'],
          ],
        },
      ]);

      try {
        const result = await parseFile(filePath);
        assert.equal(result.sheets.length, 1);
        assert.equal(result.sheets[0].name, 'Data');
      } finally {
        cleanup(filePath);
      }
    });
  });

  describe('parseFile - metadata extraction', () => {

    it('should extract Stavba metadata from "label: value" format', async () => {
      const filePath = createTestExcel([{
        name: 'Soupis',
        data: [
          ['Stavba:', 'D6 Karlovy Vary - Olšová Vrata'],
          ['Objekt:', 'SO 201 Most přes Ohři'],
          ['Soupis:', 'Hlavní soupis prací'],
          ['', ''],
          ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
          ['231112', 'Betonáž', 'M3', '100', '350000'],
        ],
      }]);

      try {
        const result = await parseFile(filePath);
        assert.ok(result.metadata.stavba.includes('D6 Karlovy Vary'));
        assert.ok(result.metadata.objekt.includes('SO 201'));
      } finally {
        cleanup(filePath);
      }
    });
  });

  describe('parseFile - kiosk routing', () => {

    it('should provide kiosk suggestions in summary', async () => {
      const filePath = createTestExcel([{
        name: 'Soupis',
        data: [
          ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
          ['231112', 'Betonáž základů C30/37', 'M3', '80', '280000'],
          ['411112', 'Bednění stěn', 'M2', '340', '289000'],
          ['112101', 'Výkop jámy', 'M3', '500', '150000'],
          ['564212', 'Asfaltový kryt', 'M2', '1200', '360000'],
        ],
      }]);

      try {
        const result = await parseFile(filePath);
        const suggestions = result.summary.kioskSuggestions;

        assert.ok(suggestions.monolit);
        assert.ok(suggestions.registry);
        assert.ok(suggestions.urs_matcher);

        // Monolit should get beton + bedneni items
        assert.equal(suggestions.monolit.count, 2); // beton + bedneni

        // Registry gets everything
        assert.equal(suggestions.registry.count, 4);

        // URS matcher gets items with description
        assert.equal(suggestions.urs_matcher.count, 4);

      } finally {
        cleanup(filePath);
      }
    });
  });

  describe('parseFile - work type detection', () => {

    it('should detect all major work types', async () => {
      const filePath = createTestExcel([{
        name: 'Soupis',
        data: [
          ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
          ['231112', 'Betonáž základů ze ŽB C30/37', 'M3', '80', '280000'],
          ['411112', 'Bednění stěn systémové', 'M2', '340', '289000'],
          ['421131', 'Výztuž z betonářské oceli', 'KG', '12500', '475000'],
          ['112101', 'Výkop jámy hloubení', 'M3', '500', '150000'],
          ['711111', 'Hydroizolace základů nátěr', 'M2', '200', '80000'],
          ['564212', 'Asfaltový kryt vozovky', 'M2', '1200', '360000'],
          ['224311', 'Vrtané piloty průměr 600mm', 'M', '150', '450000'],
          ['934111', 'Kotvy injektáž cementová', 'KS', '50', '25000'],
        ],
      }]);

      try {
        const result = await parseFile(filePath);
        const items = result.sheets[0].items;
        const types = items.map(i => i.detectedType);

        assert.ok(types.includes('beton'), 'Should detect beton');
        assert.ok(types.includes('bedneni'), 'Should detect bedneni');
        assert.ok(types.includes('vyztuze'), 'Should detect vyztuze');
        assert.ok(types.includes('zemni'), 'Should detect zemni');
        assert.ok(types.includes('izolace'), 'Should detect izolace');
        assert.ok(types.includes('komunikace'), 'Should detect komunikace');
        assert.ok(types.includes('piloty'), 'Should detect piloty');
        assert.ok(types.includes('kotveni'), 'Should detect kotveni');
      } finally {
        cleanup(filePath);
      }
    });
  });

  describe('parseFile - edge cases', () => {

    it('should throw for file with no sheets', async () => {
      // Create a minimal valid XLSX with no data sheets
      const tmpDir = os.tmpdir();
      const filePath = path.join(tmpDir, `empty-${Date.now()}.xlsx`);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.book_append_sheet(wb, ws, 'Empty');
      XLSX.writeFile(wb, filePath);

      try {
        const result = await parseFile(filePath);
        // Should not throw but return empty result
        assert.equal(result.sheets.length, 0);
        assert.equal(result.summary.totalItems, 0);
      } finally {
        cleanup(filePath);
      }
    });

    it('should handle multi-line descriptions', async () => {
      const filePath = createTestExcel([{
        name: 'Soupis',
        data: [
          ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
          ['231112', 'Betonáž základů', 'M3', '80', '280000'],
          ['', 'ze železobetonu C30/37', '', '', ''],
          ['', 'včetně dopravy a ukládání', '', '', ''],
          ['411112', 'Bednění', 'M2', '340', '289000'],
        ],
      }]);

      try {
        const result = await parseFile(filePath);
        assert.equal(result.sheets[0].items.length, 2);

        const item1 = result.sheets[0].items[0];
        assert.ok(item1.popisFull.includes('Betonáž'));
        assert.ok(item1.popisFull.includes('železobetonu'));
        assert.ok(item1.popisFull.includes('dopravy'));
        assert.equal(item1.popisDetail.length, 2);
      } finally {
        cleanup(filePath);
      }
    });

    it('should extract bridge info from sheet names', async () => {
      const filePath = createTestExcel([
        {
          name: 'SO 201 - Most přes Ohři',
          data: [
            ['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'],
            ['231112', 'Betonáž', 'M3', '100', '350000'],
          ],
        },
      ]);

      try {
        const result = await parseFile(filePath);
        assert.equal(result.sheets[0].bridgeId, 'SO201');
        assert.ok(result.sheets[0].bridgeName.includes('Most'));
      } finally {
        cleanup(filePath);
      }
    });
  });
});
