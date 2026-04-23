/**
 * Unit tests for the Typ-column fast-path classifier — ALGORITHM v1.1 §2.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyTypRow,
  inferSourceFormat,
  normalizeTypMarker,
} from './typColumnClassifier';
import type { ColumnMapping, RawRow } from './classifierTypes';

function mkMapping(overrides: Partial<ColumnMapping> = {}): ColumnMapping {
  return {
    headerRowIndex: 0,
    dataStartRow: 1,
    kod: 2,
    popis: 4,
    mj: 5,
    mnozstvi: 6,
    cenaJednotkova: 7,
    cenaCelkem: 8,
    typ: 0,
    por: 1,
    cenovaSoustava: null,
    varianta: 3,
    detectionConfidence: 0.9,
    detectionSource: 'header-match',
    ...overrides,
  };
}

function mkRow(cells: unknown[]): RawRow {
  return { cells, sourceRowIndex: 5, sourceSheetName: 'Sheet1' };
}

describe('normalizeTypMarker', () => {
  it('uppercases + trims input', () => {
    expect(normalizeTypMarker('  pp  ')).toBe('PP');
    expect(normalizeTypMarker('k')).toBe('K');
  });
  it('returns empty for null/undefined/empty', () => {
    expect(normalizeTypMarker(null)).toBe('');
    expect(normalizeTypMarker(undefined)).toBe('');
    expect(normalizeTypMarker('')).toBe('');
  });
});

describe('inferSourceFormat', () => {
  it('identifies EstiCon by unique markers dominating', () => {
    expect(inferSourceFormat(['SO', 'O', 'P', 'P', 'TS', 'P'])).toBe('EstiCon');
  });
  it('identifies Komplet by unique markers dominating', () => {
    expect(inferSourceFormat(['D', 'K', 'K', 'PSC', 'K'])).toBe('Komplet');
  });
  it('returns null for shared-only markers (PP/VV)', () => {
    expect(inferSourceFormat(['PP', 'VV', 'PP'])).toBeNull();
  });
  it('returns null for empty batch', () => {
    expect(inferSourceFormat([])).toBeNull();
  });
  it('returns null when counts are close (ambiguous)', () => {
    expect(inferSourceFormat(['SO', 'D', 'P', 'K'])).toBeNull();
  });
});

describe('classifyTypRow', () => {
  it('classifies EstiCon P as main with confidence 1.0', () => {
    const mapping = mkMapping();
    const result = classifyTypRow(
      mkRow(['P', 1, '231112', 'kn', 'Beton C25/30', 'm3', 45, 3200, 144000]),
      mapping,
      'EstiCon',
    );
    expect(result?.rowRole).toBe('main');
    expect(result?.classificationConfidence).toBe(1.0);
    expect(result?.classificationSource).toBe('typ-column');
    expect(result?.kod).toBe('231112');
    expect(result?.popis).toBe('Beton C25/30');
    expect(result?.mj).toBe('m3');
    expect(result?.mnozstvi).toBe(45);
    expect(result?.sourceFormat).toBe('EstiCon');
  });

  it('classifies Komplet K as main', () => {
    const mapping = mkMapping();
    const result = classifyTypRow(
      mkRow(['K', 1, '231112', '', 'Beton', 'm3', 45, 3200, 144000]),
      mapping,
      'Komplet',
    );
    expect(result?.rowRole).toBe('main');
  });

  it('classifies SO/O/O1/SD as section', () => {
    const mapping = mkMapping();
    for (const marker of ['SO', 'O', 'O1', 'SD', 'D']) {
      const result = classifyTypRow(
        mkRow([marker, null, null, null, `Section ${marker}`, null, null, null, null]),
        mapping,
        null,
      );
      expect(result?.rowRole, `marker ${marker}`).toBe('section');
    }
  });

  it('classifies PP/VV/TS/PSC as subordinate', () => {
    const mapping = mkMapping();
    for (const marker of ['PP', 'VV', 'TS', 'PSC']) {
      const result = classifyTypRow(
        mkRow([marker, null, null, null, `Sub ${marker}`, null, null, null, null]),
        mapping,
        null,
      );
      expect(result?.rowRole, `marker ${marker}`).toBe('subordinate');
    }
  });

  it('downgrades unknown marker to unknown with confidence 0', () => {
    const mapping = mkMapping();
    const result = classifyTypRow(
      mkRow(['XYZ', 1, '231112', '', 'Something', 'm3', 45, 3200, 144000]),
      mapping,
      null,
    );
    expect(result?.rowRole).toBe('unknown');
    expect(result?.classificationConfidence).toBe(0);
    expect(result?.originalTyp).toBe('XYZ');
  });

  it('skips rows with empty typ and empty popis (edge §6.8)', () => {
    const mapping = mkMapping();
    const result = classifyTypRow(
      mkRow(['', '', '', '', '', '', '', '', '']),
      mapping,
      null,
    );
    expect(result).toBeNull();
  });

  it('parses CZ decimal comma numbers', () => {
    const mapping = mkMapping();
    const result = classifyTypRow(
      mkRow(['K', 1, '231112', '', 'Beton', 'm3', '1 020,341', 3200, 144000]),
      mapping,
      null,
    );
    expect(result?.mnozstvi).toBeCloseTo(1020.341, 3);
  });

  it('rejects #REF! as null, not NaN', () => {
    const mapping = mkMapping();
    const result = classifyTypRow(
      mkRow(['K', 1, '231112', '', 'Beton', 'm3', '#REF!', 3200, 144000]),
      mapping,
      null,
    );
    expect(result?.mnozstvi).toBeNull();
  });

  it('normalizes MJ to lowercase (edge §6.5)', () => {
    const mapping = mkMapping();
    const result = classifyTypRow(
      mkRow(['K', 1, '231112', '', 'Beton', 'M3', 45, 3200, 144000]),
      mapping,
      null,
    );
    expect(result?.mj).toBe('m3');
  });

  it('produces deterministic id for same input', () => {
    const mapping = mkMapping();
    const row = mkRow(['K', 1, '231112', '', 'Beton', 'm3', 45, 3200, 144000]);
    const a = classifyTypRow(row, mapping, null);
    const b = classifyTypRow(row, mapping, null);
    expect(a?.id).toBe(b?.id);
  });

  it('throws when mapping.typ is null (contract violation)', () => {
    const mapping = mkMapping({ typ: null });
    expect(() =>
      classifyTypRow(mkRow(['K', 1, '231112', '', 'Beton', 'm3', 45, 3200, 144000]), mapping, null),
    ).toThrow(/classifyTypRow called without mapping\.typ/);
  });
});
