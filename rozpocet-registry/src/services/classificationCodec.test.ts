/**
 * Tests for classificationCodec — the pack/unpack helpers that round-trip
 * row-classifier output through the registry-backend `sync_metadata` column.
 *
 * Bug being prevented: a fresh import classified by rowClassifierV2 produces
 * items with rowRole / parentItemId / sectionId / _rawCells / popisDetail.
 * Pre-codec, those fields were dropped on push and never reconstructed on
 * pull, so a localStorage wipe (or cross-device load) silently demoted every
 * project to a flat unclassified list. These tests pin the contract so the
 * classification survives the JSON-blob round-trip both ways.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeClassification,
  deserializeClassification,
  applyClassificationBlob,
  CLASSIFICATION_BLOB_VERSION,
} from './classificationCodec';
import type { ParsedItem } from '../types';

function makeBaseItem(over: Partial<ParsedItem> = {}): ParsedItem {
  return {
    id: 'item-1',
    kod: '014101',
    popis: 'POPLATKY ZA SKLÁDKU',
    popisDetail: [],
    popisFull: 'POPLATKY ZA SKLÁDKU',
    mj: 'M3',
    mnozstvi: 100,
    cenaJednotkova: 5,
    cenaCelkem: 500,
    skupina: null,
    skupinaSuggested: null,
    source: {
      projectId: 'proj-1',
      fileName: 'test.xlsx',
      sheetName: 'SO 204',
      rowStart: 10,
      rowEnd: 10,
      cellRef: 'A10',
    },
    ...over,
  };
}

describe('serializeClassification', () => {
  it('returns null for legacy item with no classification fields', () => {
    expect(serializeClassification(makeBaseItem())).toBeNull();
  });

  it('returns null when only empty arrays / nulls are present', () => {
    const item = makeBaseItem({
      popisDetail: [],
      classificationWarnings: [],
      parentItemId: null,
      sectionId: null,
    });
    expect(serializeClassification(item)).toBeNull();
  });

  it('packs main row with classifier output', () => {
    const item = makeBaseItem({
      rowRole: 'main',
      classificationConfidence: 0.95,
      classificationSource: 'typ-column',
      boqLineNumber: 12,
      source_format: 'EstiCon',
      source_row_index: 42,
      por: 12,
      cenovaSoustava: 'OTSKP 2025',
      originalTyp: 'PP',
      _rawCells: ['12', 'PP', '014101', 'POPLATKY ZA SKLÁDKU', 'M3', '100', '5', '500'],
    });

    const blob = serializeClassification(item);
    expect(blob).not.toBeNull();
    expect(blob!.v).toBe(CLASSIFICATION_BLOB_VERSION);
    expect(blob!.rowRole).toBe('main');
    expect(blob!.classificationConfidence).toBe(0.95);
    expect(blob!.classificationSource).toBe('typ-column');
    expect(blob!.boqLineNumber).toBe(12);
    expect(blob!.source_format).toBe('EstiCon');
    expect(blob!.source_row_index).toBe(42);
    expect(blob!.cenovaSoustava).toBe('OTSKP 2025');
    expect(blob!.originalTyp).toBe('PP');
    expect(Array.isArray(blob!._rawCells)).toBe(true);
    expect(blob!._rawCells).toHaveLength(8);
  });

  it('packs subordinate row with parent link', () => {
    const item = makeBaseItem({
      id: 'sub-1',
      rowRole: 'subordinate',
      subordinateType: 'note',
      parentItemId: 'parent-99',
      classificationConfidence: 'high',
      popisDetail: ['Pozn.: cena bez DPH'],
    });

    const blob = serializeClassification(item);
    expect(blob).not.toBeNull();
    expect(blob!.rowRole).toBe('subordinate');
    expect(blob!.subordinateType).toBe('note');
    expect(blob!.parentItemId).toBe('parent-99');
    expect(blob!.classificationConfidence).toBe('high');
    expect(blob!.popisDetail).toEqual(['Pozn.: cena bez DPH']);
  });

  it('packs section row with sectionId', () => {
    const item = makeBaseItem({
      rowRole: 'section',
      sectionId: 'sec-A',
      popis: 'Zemní práce',
    });

    const blob = serializeClassification(item);
    expect(blob).not.toBeNull();
    expect(blob!.rowRole).toBe('section');
    expect(blob!.sectionId).toBe('sec-A');
  });

  it('omits empty popisDetail but keeps non-empty', () => {
    const empty = serializeClassification(makeBaseItem({ rowRole: 'main', popisDetail: [] }));
    const filled = serializeClassification(makeBaseItem({ rowRole: 'main', popisDetail: ['line'] }));
    expect(empty!.popisDetail).toBeUndefined();
    expect(filled!.popisDetail).toEqual(['line']);
  });

  it('produces a JSON-safe object (round-trips through JSON.stringify)', () => {
    // Backend calls JSON.stringify on whatever the frontend sends — make
    // sure a packed blob survives that round (no functions, no circular
    // refs, primitives + arrays only).
    const item = makeBaseItem({
      rowRole: 'main',
      _rawCells: [1, 'a', null, true, ''],
      popisDetail: ['x', 'y'],
    });
    const blob = serializeClassification(item);
    const after = JSON.parse(JSON.stringify(blob));
    expect(after).toEqual(blob);
  });
});

describe('deserializeClassification', () => {
  it('returns null for null/undefined/empty', () => {
    expect(deserializeClassification(null)).toBeNull();
    expect(deserializeClassification(undefined)).toBeNull();
    expect(deserializeClassification('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(deserializeClassification('{not-json')).toBeNull();
    expect(deserializeClassification('null')).toBeNull();
    expect(deserializeClassification('"string-not-object"')).toBeNull();
  });

  it('returns null for unknown schema version (forward-compat)', () => {
    expect(deserializeClassification(JSON.stringify({ v: 99, rowRole: 'main' }))).toBeNull();
    expect(deserializeClassification(JSON.stringify({ rowRole: 'main' }))).toBeNull(); // missing v
  });

  it('accepts both raw string and pre-parsed object', () => {
    const blob = { v: CLASSIFICATION_BLOB_VERSION, rowRole: 'main' as const };
    expect(deserializeClassification(JSON.stringify(blob))?.rowRole).toBe('main');
    expect(deserializeClassification(blob)?.rowRole).toBe('main');
  });
});

describe('round-trip', () => {
  it('preserves full classified main item end-to-end', () => {
    const original = makeBaseItem({
      rowRole: 'main',
      boqLineNumber: 7,
      classificationConfidence: 0.9,
      classificationSource: 'content-heuristic',
      source_format: 'Komplet',
      source_row_index: 15,
      _rawCells: ['7', '', '014101', 'POPLATKY', 'M3', '100', '5', '500'],
    });

    // Mimic the wire path: pack → JSON.stringify (server-side) → JSON.parse
    // (PG TEXT round-trip) → unpack. This catches any non-JSON-safe value
    // in the blob (Date, undefined, function) before it reaches prod.
    const blob = serializeClassification(original);
    const wire = JSON.stringify(blob);
    const decoded = deserializeClassification(wire);
    const reconstructed: Partial<ParsedItem> = {};
    applyClassificationBlob(reconstructed, decoded);

    expect(reconstructed.rowRole).toBe('main');
    expect(reconstructed.boqLineNumber).toBe(7);
    expect(reconstructed.classificationConfidence).toBe(0.9);
    expect(reconstructed.classificationSource).toBe('content-heuristic');
    expect(reconstructed.source_format).toBe('Komplet');
    expect(reconstructed.source_row_index).toBe(15);
    expect(reconstructed._rawCells).toEqual(['7', '', '014101', 'POPLATKY', 'M3', '100', '5', '500']);
  });

  it('preserves parent link across pack/unpack so subordinates re-attach', () => {
    const sub = makeBaseItem({
      id: 'sub-x',
      rowRole: 'subordinate',
      parentItemId: 'main-y',
      subordinateType: 'calculation',
    });

    const decoded = deserializeClassification(JSON.stringify(serializeClassification(sub)));
    const target: Partial<ParsedItem> = {};
    applyClassificationBlob(target, decoded);

    expect(target.rowRole).toBe('subordinate');
    expect(target.parentItemId).toBe('main-y');
    expect(target.subordinateType).toBe('calculation');
  });

  it('legacy item (no classification) packs to null → no-op apply', () => {
    const legacy = makeBaseItem();
    const blob = serializeClassification(legacy);
    expect(blob).toBeNull();

    const target: Partial<ParsedItem> = { rowRole: 'unknown' };
    applyClassificationBlob(target, deserializeClassification(blob));
    // Pre-existing default not clobbered.
    expect(target.rowRole).toBe('unknown');
  });

  it('does not clobber target fields the blob did not carry', () => {
    const item = makeBaseItem({ rowRole: 'main' }); // no parentItemId in source
    const decoded = deserializeClassification(JSON.stringify(serializeClassification(item)));

    const target: Partial<ParsedItem> = { parentItemId: 'preserved' };
    applyClassificationBlob(target, decoded);
    expect(target.rowRole).toBe('main');
    expect(target.parentItemId).toBe('preserved');
  });

  it('accepts pre-parsed object (defensive — JSONB driver path)', () => {
    // Backend column is currently TEXT (string), but if a future migration
    // flips it to JSONB the pg driver would auto-parse and hand us an
    // object. The codec must accept both forms transparently.
    const item = makeBaseItem({ rowRole: 'main', sectionId: 'sec-A' });
    const blob = serializeClassification(item);
    const decoded = deserializeClassification(blob); // pass object directly
    const target: Partial<ParsedItem> = {};
    applyClassificationBlob(target, decoded);
    expect(target.rowRole).toBe('main');
    expect(target.sectionId).toBe('sec-A');
  });
});
