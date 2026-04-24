/**
 * End-to-end tests for classifySheet orchestrator — ALGORITHM v1.1.
 *
 * Uses synthetic row data to verify the integrated pipeline (detectColumns
 * → classify → parent-link) produces correct results. Real .xlsx fixtures
 * are covered by the separate integration test file.
 */

import { describe, it, expect } from 'vitest';
import { classifySheet } from './rowClassifierV2';

describe('classifySheet — EstiCon-style input', () => {
  const esticonRows: unknown[][] = [
    // Header + metadata
    ['Krycí list — SO 202'],
    [],
    // Real header at row 2
    ['Typ', 'Poř.', 'Kód', 'Varianta', 'Popis', 'MJ', 'Množství', 'J.cena', 'Celkem'],
    // Section
    ['SO', null, null, null, 'SO 202 Most nad potokem', null, null, null, null],
    ['SD', null, null, null, 'Zemní práce', null, null, null, null],
    // Main + subs
    ['P', 1, '121101', 'kn', 'Výkop jámy', 'm3', 45, 150, 6750],
    ['PP', null, null, null, 'Včetně odvozu', null, null, null, null],
    ['VV', null, null, null, '45*1 = 45', null, null, null, null],
    ['P', 2, '174101', 'kn', 'Zásyp', 'm3', 32, 80, 2560],
    // Next section
    ['SD', null, null, null, 'Základy', null, null, null, null],
    ['P', 3, '231112', 'kn', 'Beton základů C25/30', 'm3', 12, 3200, 38400],
    ['PP', null, null, null, 'Dle TKP', null, null, null, null],
  ];

  it('detects Typ column via header match', () => {
    const r = classifySheet(esticonRows, { sheetName: 'SO202' });
    expect(r.mapping.detectionSource).toBe('header-match');
    expect(r.mapping.typ).toBe(0);
  });

  it('classifies rows via Typ fast path', () => {
    const r = classifySheet(esticonRows, { sheetName: 'SO202' });
    expect(r.sourceFormat).toBe('EstiCon');
    expect(r.sectionCount).toBe(3);   // SO + 2 SD
    expect(r.mainCount).toBe(3);      // 3 P
    expect(r.subordinateCount).toBe(3); // PP + VV (under Výkop) + PP (under Beton)
  });

  it('links subordinates to correct main across sections', () => {
    const r = classifySheet(esticonRows, { sheetName: 'SO202' });
    const mains = r.items.filter(i => i.rowRole === 'main');
    const mainByKod = new Map(mains.map(m => [m.kod, m.id]));

    const subordinates = r.items.filter(i => i.rowRole === 'subordinate');
    const firstVykopSubs = subordinates.filter(s => s.parentItemId === mainByKod.get('121101'));
    expect(firstVykopSubs.length).toBe(2); // PP + VV

    const betonSubs = subordinates.filter(s => s.parentItemId === mainByKod.get('231112'));
    expect(betonSubs.length).toBe(1); // PP Dle TKP
  });

  it('reports zero orphans on well-formed input', () => {
    const r = classifySheet(esticonRows, { sheetName: 'SO202' });
    expect(r.orphanCount).toBe(0);
  });

  it('tags each main with its enclosing section', () => {
    const r = classifySheet(esticonRows, { sheetName: 'SO202' });
    const betonMain = r.items.find(i => i.kod === '231112');
    const osnovy = r.items.filter(i => i.rowRole === 'section');
    const zakladyId = osnovy.find(s => s.popis.includes('Základy'))?.id;
    expect(betonMain?.sectionId).toBe(zakladyId);
  });

  it('captures raw cells by default', () => {
    const r = classifySheet(esticonRows, { sheetName: 'SO202' });
    const firstMain = r.items.find(i => i.rowRole === 'main');
    expect(firstMain?.rawCells).toBeDefined();
    expect(firstMain?.rawCells?.length).toBeGreaterThan(0);
  });

  it('skips raw cell capture when disabled', () => {
    const r = classifySheet(esticonRows, { sheetName: 'SO202', preserveRawCells: false });
    expect(r.items[0].rawCells).toBeUndefined();
  });
});

describe('classifySheet — Komplet-style input', () => {
  const kompletRows: unknown[][] = [
    ['Pozice č.', 'Typ', 'Kód', 'Popis', 'MJ', 'Množství', 'J.cena', 'Celkem'],
    [null, 'D', null, 'Zemní práce', null, null, null, null],
    [1, 'K', '121101', 'Výkop', 'm3', 45, 150, 6750],
    [null, 'PP', null, 'Detail', null, null, null, null],
    [null, 'VV', null, '45*1=45', null, null, null, null],
    [null, 'D', null, 'Základy', null, null, null, null],
    [2, 'K', '231112', 'Beton', 'm3', 12, 3200, 38400],
  ];

  it('correctly infers Komplet source format', () => {
    const r = classifySheet(kompletRows, { sheetName: 'K1' });
    expect(r.sourceFormat).toBe('Komplet');
    expect(r.sectionCount).toBe(2);
    expect(r.mainCount).toBe(2);
  });
});

describe('classifySheet — content-heuristic path (no Typ column)', () => {
  const rtsRows: unknown[][] = [
    ['Kód', 'Popis', 'MJ', 'Množství', 'J.cena', 'Celkem'],
    ['1', 'Zemní práce', '', '', '', ''],                // section
    ['121101', 'Výkop jámy', 'm3', 45, 150, 6750],       // main
    ['', 'Poznámka — dle TKP', '', '', '', ''],          // subordinate
    ['2', 'Základy', '', '', '', ''],                    // section
    ['231112', 'Beton základů', 'm3', 12, 3200, 38400],  // main
  ];

  it('detects no Typ column → falls through to content heuristic', () => {
    const r = classifySheet(rtsRows, { sheetName: 'RTS' });
    expect(r.mapping.typ).toBeNull();
    expect(r.items.every(i => i.classificationSource === 'content-heuristic')).toBe(true);
  });

  it('classifies correctly via heuristics', () => {
    const r = classifySheet(rtsRows, { sheetName: 'RTS' });
    expect(r.sectionCount).toBe(2);
    expect(r.mainCount).toBe(2);
    expect(r.subordinateCount).toBe(1);
    expect(r.orphanCount).toBe(0);
  });
});

describe('classifySheet — degenerate inputs', () => {
  it('handles empty sheet gracefully', () => {
    const r = classifySheet([], { sheetName: 'Empty' });
    expect(r.items).toEqual([]);
    expect(r.mainCount).toBe(0);
  });

  it('returns safe result when no popis column found', () => {
    const rows: unknown[][] = [[1, 2, 3], [4, 5, 6]];
    const r = classifySheet(rows, { sheetName: 'Numeric' });
    // Content heuristic will pick popis=0 as last-resort — still produces classifiable items.
    expect(r.items).toBeDefined();
  });
});

describe('classifySheet — mappingOverride (persisted mapping path)', () => {
  // Reconstructed sparse stream — header row intentionally absent, mirroring
  // what reclassifySheet() produces from per-item _rawCells (parser drops the
  // header at import time, so the stream starts straight at data rows).
  const sparseRows: unknown[][] = [];
  sparseRows[3] = ['P', 1, '121101', 'kn', 'Výkop jámy', 'm3', 45, 150, 6750];
  sparseRows[4] = ['PP', null, null, null, 'Včetně odvozu', null, null, null, null];
  sparseRows[5] = ['P', 2, '231112', 'kn', 'Beton C25/30', 'm3', 12, 3200, 38400];

  const savedMapping = {
    headerRowIndex: 2,
    dataStartRow: 3,
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
    detectionSource: 'header-match' as const,
  };

  it('skips detectColumns and uses the provided mapping verbatim', () => {
    const r = classifySheet(sparseRows, {
      sheetName: 'SparseEstiCon',
      mappingOverride: savedMapping,
    });
    expect(r.mapping).toEqual(savedMapping);
    expect(r.mapping.typ).toBe(0);
    expect(r.mapping.dataStartRow).toBe(3);
  });

  it('classifies correctly through Typ fast path with pre-resolved mapping', () => {
    const r = classifySheet(sparseRows, {
      sheetName: 'SparseEstiCon',
      mappingOverride: savedMapping,
    });
    expect(r.mainCount).toBe(2);
    expect(r.subordinateCount).toBe(1);
    expect(r.sourceFormat).toBe('EstiCon');
  });

  it('mappingOverride takes precedence over templateHint', () => {
    // Deliberately misleading hint — if override were ignored we would get
    // urs-standard positions (kod=0) which collide with the Typ column in
    // these rows.
    const r = classifySheet(sparseRows, {
      sheetName: 'SparseEstiCon',
      mappingOverride: savedMapping,
      templateHint: 'urs-standard',
    });
    expect(r.mapping.detectionSource).toBe('header-match');
    expect(r.mapping.kod).toBe(2);
  });

  it('degrades gracefully on empty input with override provided', () => {
    const r = classifySheet([], {
      sheetName: 'Empty',
      mappingOverride: savedMapping,
    });
    expect(r.items).toEqual([]);
    // Override is echoed back so caller can inspect it even on empty input.
    expect(r.mapping).toEqual(savedMapping);
  });
});

describe('classifySheet — per-sheet isolation (edge §6.13)', () => {
  it('does not leak currentMainId across classifySheet calls', () => {
    // Header rows need ≥ 3 known-keyword hits to be detected; using 4
    // columns so both sheets pass header-match strategy.
    const sheet1: unknown[][] = [
      ['Typ', 'Kód', 'Popis', 'MJ'],
      ['P', '111111', 'Main from sheet 1', 'm3'],
    ];
    const sheet2: unknown[][] = [
      ['Typ', 'Kód', 'Popis', 'MJ'],
      ['PP', '', 'Orphan from sheet 2', ''],
    ];
    const r1 = classifySheet(sheet1, { sheetName: 'S1' });
    const r2 = classifySheet(sheet2, { sheetName: 'S2' });
    expect(r1.mainCount).toBe(1);
    expect(r2.orphanCount).toBe(1);
  });
});
