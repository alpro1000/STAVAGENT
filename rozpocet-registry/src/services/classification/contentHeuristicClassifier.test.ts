/**
 * Unit tests for the content-heuristic classifier — ALGORITHM v1.1 §3.
 */

import { describe, it, expect } from 'vitest';
import { classifyContentRow } from './contentHeuristicClassifier';
import type { ColumnMapping, RawRow } from './classifierTypes';

function mkMapping(overrides: Partial<ColumnMapping> = {}): ColumnMapping {
  return {
    headerRowIndex: 0,
    dataStartRow: 1,
    kod: 0,
    popis: 1,
    mj: 2,
    mnozstvi: 3,
    cenaJednotkova: 4,
    cenaCelkem: 5,
    typ: null,
    por: null,
    cenovaSoustava: null,
    varianta: null,
    detectionConfidence: 0.6,
    detectionSource: 'content-heuristic',
    ...overrides,
  };
}

function mkRow(cells: unknown[]): RawRow {
  return { cells, sourceRowIndex: 10, sourceSheetName: 'S1' };
}

describe('classifyContentRow — Rule 1 section', () => {
  it('short kod (1-2 digits) → section with confidence 0.9', () => {
    const r = classifyContentRow(mkRow(['1', 'Zemní práce', '', '', '', '']), mkMapping());
    expect(r?.rowRole).toBe('section');
    expect(r?.classificationConfidence).toBe(0.9);
  });

  it('two-digit kod → section', () => {
    const r = classifyContentRow(mkRow(['99', 'Závěr', '', '', '', '']), mkMapping());
    expect(r?.rowRole).toBe('section');
  });

  it('CZ section keyword + empty unit/qty → section', () => {
    const r = classifyContentRow(mkRow(['', 'Zemní práce', '', '', '', '']), mkMapping());
    expect(r?.rowRole).toBe('section');
    expect(r?.classificationConfidence).toBe(0.85);
  });

  it('CZ section keyword with accents → section', () => {
    const r = classifyContentRow(mkRow(['', 'Úpravy povrchů', '', '', '', '']), mkMapping());
    expect(r?.rowRole).toBe('section');
  });

  it('section keyword BUT with mj+mnozstvi is NOT section (guards against ambiguity)', () => {
    const r = classifyContentRow(mkRow(['231112', 'Zemní práce výkop', 'm3', 45, 100, 4500]), mkMapping());
    expect(r?.rowRole).toBe('main');
  });
});

describe('classifyContentRow — Rule 2 main', () => {
  it('kod + mj + mnozstvi + OTSKP code → main', () => {
    const r = classifyContentRow(mkRow(['231112', 'Beton', 'm3', 45, 3200, 144000]), mkMapping());
    expect(r?.rowRole).toBe('main');
    expect(r?.classificationConfidence).toBe(0.9);
  });

  it('ÚRS 9-digit kod → main', () => {
    const r = classifyContentRow(mkRow(['123456789', 'Popis', 'm3', 45, 3200, 144000]), mkMapping());
    expect(r?.rowRole).toBe('main');
  });

  it('custom alphanumeric kod → main', () => {
    const r = classifyContentRow(mkRow(['SO-101', 'Popis', 'm3', 45, 3200, 144000]), mkMapping());
    expect(r?.rowRole).toBe('main');
  });

  it('kod without mj → not main, falls through', () => {
    const r = classifyContentRow(mkRow(['231112', 'Popis bez jednotky', '', '', '', '']), mkMapping());
    expect(r?.rowRole).toBe('subordinate');
  });

  it('kod without mnozstvi → not main', () => {
    const r = classifyContentRow(mkRow(['231112', 'Popis', 'm3', 0, 0, 0]), mkMapping());
    expect(r?.rowRole).toBe('subordinate');
  });
});

describe('classifyContentRow — Rule 3 subordinate', () => {
  it('popis only → subordinate with confidence 0.7', () => {
    const r = classifyContentRow(mkRow(['', 'Detail poznámka', '', '', '', '']), mkMapping());
    expect(r?.rowRole).toBe('subordinate');
    expect(r?.classificationConfidence).toBe(0.7);
  });
});

describe('classifyContentRow — Rule 4 unknown / skip', () => {
  it('completely empty row → null (skip signal)', () => {
    const r = classifyContentRow(mkRow(['', '', '', '', '', '']), mkMapping());
    expect(r).toBeNull();
  });

  it('row with only mnozstvi (no kod no popis) → null', () => {
    const r = classifyContentRow(mkRow(['', '', '', null, '', '']), mkMapping());
    expect(r).toBeNull();
  });
});

describe('classifyContentRow — edge cases', () => {
  it('handles CZ decimal commas in mnozstvi', () => {
    const r = classifyContentRow(
      mkRow(['231112', 'Beton', 'm3', '1 020,341', 3200, 144000]),
      mkMapping(),
    );
    expect(r?.mnozstvi).toBeCloseTo(1020.341, 3);
  });

  it('rejects #REF! as null', () => {
    const r = classifyContentRow(
      mkRow(['231112', 'Beton', 'm3', '#REF!', 3200, 144000]),
      mkMapping(),
    );
    expect(r?.mnozstvi).toBeNull();
  });

  it('lowercases mj', () => {
    const r = classifyContentRow(mkRow(['231112', 'Beton', 'M3', 45, 3200, 144000]), mkMapping());
    expect(r?.mj).toBe('m3');
  });

  it('classificationSource is always content-heuristic', () => {
    const r = classifyContentRow(mkRow(['1', 'Zemní práce', '', '', '', '']), mkMapping());
    expect(r?.classificationSource).toBe('content-heuristic');
    expect(r?.sourceFormat).toBeNull();
    expect(r?.originalTyp).toBeNull();
  });
});
