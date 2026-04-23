/**
 * Unit tests for detectColumns — ROW_CLASSIFICATION_ALGORITHM v1.1 §1.
 * Covers: header-text match, content heuristics, template hints, edge cases.
 */

import { describe, it, expect } from 'vitest';
import { detectColumns } from './columnAutoDetect';

describe('detectColumns', () => {
  describe('header-text match strategy', () => {
    it('finds a standard URS header row with all 6 columns', () => {
      const rows = [
        ['Kód', 'Popis', 'MJ', 'Množství', 'Cena jednotková', 'Cena celkem'],
        ['231112', 'Beton základů', 'm3', 45, 3200, 144000],
      ];
      const m = detectColumns(rows);
      expect(m.detectionSource).toBe('header-match');
      expect(m.headerRowIndex).toBe(0);
      expect(m.dataStartRow).toBe(1);
      expect(m.kod).toBe(0);
      expect(m.popis).toBe(1);
      expect(m.mj).toBe(2);
      expect(m.mnozstvi).toBe(3);
      expect(m.cenaJednotkova).toBe(4);
      expect(m.cenaCelkem).toBe(5);
      expect(m.typ).toBeNull();
    });

    it('tolerates CZ accents and case variations', () => {
      const rows = [
        ['KÓD', 'popis', 'M.J.', 'MNOŽSTVÍ', 'J.CENA', 'Celkem'],
        ['231112', 'Beton základů', 'm3', 45, 3200, 144000],
      ];
      const m = detectColumns(rows);
      expect(m.detectionSource).toBe('header-match');
      expect(m.kod).toBe(0);
      expect(m.popis).toBe(1);
      expect(m.mj).toBe(2);
      expect(m.mnozstvi).toBe(3);
      expect(m.cenaJednotkova).toBe(4);
      expect(m.cenaCelkem).toBe(5);
    });

    it('locates a deep header row (Komplet-style at row 120)', () => {
      const rows: unknown[][] = [];
      for (let i = 0; i < 120; i++) rows.push(['filler', '', '', '']);
      rows.push(['PČ', 'Typ', 'Kód', 'Popis', 'MJ', 'Množství', 'J.cena', 'Celkem']);
      rows.push([1, 'K', '231112', 'Beton', 'm3', 45, 3200, 144000]);
      const m = detectColumns(rows);
      expect(m.detectionSource).toBe('header-match');
      expect(m.headerRowIndex).toBe(120);
      expect(m.typ).toBe(1);
      expect(m.por).toBe(0);
      expect(m.kod).toBe(2);
    });

    it('detects Typ column when present', () => {
      const rows = [
        ['Typ', 'Kód', 'Popis', 'MJ', 'Množství'],
        ['K', '231112', 'Beton', 'm3', 45],
      ];
      const m = detectColumns(rows);
      expect(m.typ).toBe(0);
      expect(m.kod).toBe(1);
    });

    it('detects Varianta column (EstiCon-specific)', () => {
      const rows = [
        ['Typ', 'Poř.', 'Kód', 'Varianta', 'Popis', 'MJ', 'Množství'],
        ['P', 1, '231112', 'kn', 'Beton', 'm3', 45],
      ];
      const m = detectColumns(rows);
      expect(m.varianta).toBe(3);
    });

    it('fails header match when fewer than 3 keywords present', () => {
      const rows = [
        ['Random', 'Header', 'Text', 'Here'],           // 0 hits
        ['Code', 'Price', '', ''],                       // 0 hits (not Kód/Cena, not recognized)
        ['231112', 'Beton', 'm3', 45],                   // content
      ];
      const m = detectColumns(rows);
      // Fell through to content-heuristic — and content heuristic will not
      // have detected a header row either, since the sample is tiny.
      expect(m.detectionSource).toBe('content-heuristic');
      expect(m.headerRowIndex).toBeNull();
    });
  });

  describe('content-heuristic fallback', () => {
    it('identifies kod column by OTSKP regex density', () => {
      const rows: unknown[][] = [];
      for (let i = 0; i < 20; i++) {
        rows.push([`23111${i % 10}`, `Beton pos ${i}`, 'm3', 10 + i]);
      }
      const m = detectColumns(rows);
      expect(m.detectionSource).toBe('content-heuristic');
      expect(m.kod).toBe(0);
      expect(m.popis).toBe(1);
      expect(m.mj).toBe(2);
    });

    it('identifies mj column by unit regex density', () => {
      const rows: unknown[][] = [];
      for (let i = 0; i < 20; i++) {
        rows.push([`23111${i % 10}`, `Description ${i}`, 'm3', 10 + i, 100 + i]);
      }
      const m = detectColumns(rows);
      expect(m.mj).toBe(2);
    });

    it('handles content-only sheets without any header row', () => {
      const rows: unknown[][] = [
        ['', '', '', ''],
        ['231112', 'Beton základů C25/30', 'm3', 45],
        ['231113', 'Beton stropů C30/37', 'm3', 32],
        ['231114', 'Beton schodiště', 'm3', 8],
        ['231115', 'Beton sloupů C35/45', 'm3', 12],
      ];
      const m = detectColumns(rows);
      expect(m.detectionSource).toBe('content-heuristic');
      expect(m.popis).toBe(1);
    });

    it('returns safe empty mapping for empty input', () => {
      const m = detectColumns([]);
      expect(m.popis).toBe(-1);
      expect(m.detectionConfidence).toBe(0);
    });
  });

  describe('template-hint strategy', () => {
    it('accepts a valid urs-standard hint when text density passes', () => {
      const rows: unknown[][] = [];
      for (let i = 0; i < 10; i++) {
        rows.push([`23111${i}`, `Description row ${i} with text`, 'm3', i * 5, 100, i * 500]);
      }
      const m = detectColumns(rows, 'urs-standard');
      expect(m.detectionSource).toBe('template-hint');
      expect(m.kod).toBe(0);
      expect(m.popis).toBe(1);
      expect(m.detectionConfidence).toBe(0.85);
    });

    it('rejects a hint when popis column is non-text and falls through', () => {
      const rows: unknown[][] = [];
      for (let i = 0; i < 20; i++) {
        // Column 1 is all numbers → hint's "popis=col 1" is wrong
        rows.push([`23111${i}`, i * 10, 'm3', i]);
      }
      const m = detectColumns(rows, 'urs-standard');
      // Hint rejected → header scan also fails → content heuristic wins.
      expect(m.detectionSource).toBe('content-heuristic');
    });

    it('accepts null hint and runs auto-detection', () => {
      const rows = [
        ['Kód', 'Popis', 'MJ', 'Množství'],
        ['231112', 'Beton', 'm3', 45],
      ];
      const m = detectColumns(rows, null);
      expect(m.detectionSource).toBe('header-match');
    });
  });

  describe('confidence', () => {
    it('scales header-match confidence with number of hits', () => {
      const minimal = detectColumns([
        ['Kód', 'Popis', 'MJ'],
        ['231112', 'Beton', 'm3'],
      ]);
      expect(minimal.detectionConfidence).toBeCloseTo(0.8, 1);

      const full = detectColumns([
        ['Kód', 'Popis', 'MJ', 'Množství', 'J.cena', 'Cena celkem'],
        ['231112', 'Beton', 'm3', 45, 3200, 144000],
      ]);
      expect(full.detectionConfidence).toBeCloseTo(1.0, 1);
    });

    it('gives content-heuristic a lower confidence cap', () => {
      const rows: unknown[][] = [];
      for (let i = 0; i < 20; i++) {
        rows.push([`23111${i % 10}`, `Beton pos ${i}`, 'm3', 10 + i]);
      }
      const m = detectColumns(rows);
      expect(m.detectionConfidence).toBeLessThanOrEqual(0.5);
    });
  });
});
