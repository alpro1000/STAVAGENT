/**
 * position-part-grouping tests — Fáze 5 #7 Phase 2 (Gate 4), hermetic.
 * Proves the part-grouping foundation: untagged rows render flat (back-compat),
 * tagged rows split into structural-part subgroups with subtotals, and the parent
 * (opěra) total is the flat Σ of parts (container — no double-count).
 */

import { describe, it, expect } from 'vitest';
import { groupByStructuralPart, readStructuralPart } from './position-part-grouping.js';
import type { Position } from '../types.js';

const base = {
  bridge_id: 'SO201',
  part_name: 'OPĚRY OP1',
  unit: 'M3',
  qty: 0,
  crew_size: 4,
  wage_czk_ph: 398,
  shift_hours: 10,
  days: 0,
} as const;

function pos(over: Partial<Position> & { subtype: Position['subtype'] }): Position {
  return { ...base, ...over } as Position;
}
function tagged(label: string, over: Partial<Position> & { subtype: Position['subtype'] }): Position {
  return pos({ ...over, metadata: JSON.stringify({ structural_part: label }) });
}

describe('readStructuralPart', () => {
  it('reads structural_part from the metadata JSON', () => {
    expect(readStructuralPart(JSON.stringify({ structural_part: 'dřík', pump_cost_czk: 5 }))).toBe('dřík');
  });
  it('returns null for missing / empty / malformed / undefined metadata', () => {
    expect(readStructuralPart(undefined)).toBeNull();
    expect(readStructuralPart(JSON.stringify({ pump_cost_czk: 5 }))).toBeNull();
    expect(readStructuralPart(JSON.stringify({ structural_part: '' }))).toBeNull();
    expect(readStructuralPart('{not json')).toBeNull();
  });
});

describe('groupByStructuralPart', () => {
  it('legacy rows without tags → flat (has_parts=false, single null group)', () => {
    const rows = [
      pos({ subtype: 'beton', concrete_m3: 100, kros_total_czk: 50000 }),
      pos({ subtype: 'bednění', kros_total_czk: 20000 }),
    ];
    const g = groupByStructuralPart(rows);
    expect(g.has_parts).toBe(false);
    expect(g.subgroups).toHaveLength(1);
    expect(g.subgroups[0].part_label).toBeNull();
    expect(g.subgroups[0].concrete_m3).toBe(100);
    expect(g.subgroups[0].kros_total_czk).toBe(70000);
  });

  it('tagged rows → part subgroups with per-part subtotals; parent = flat Σ (no double-count)', () => {
    const rows = [
      tagged('dřík', { subtype: 'beton', concrete_m3: 60, kros_total_czk: 30000 }),
      tagged('dřík', { subtype: 'bednění', kros_total_czk: 10000 }),
      tagged('křídla', { subtype: 'beton', concrete_m3: 40, kros_total_czk: 20000 }),
    ];
    const g = groupByStructuralPart(rows);
    expect(g.has_parts).toBe(true);
    expect(g.subgroups.map((s) => s.part_label)).toEqual(['dřík', 'křídla']);
    expect(g.subgroups[0].concrete_m3).toBe(60);
    expect(g.subgroups[0].kros_total_czk).toBe(40000);
    expect(g.subgroups[1].concrete_m3).toBe(40);
    // Parent (opěra) = Σ parts; each part's beton counted once → no double-count.
    expect(g.subgroups.reduce((s, sg) => s + sg.concrete_m3, 0)).toBe(100);
    expect(g.subgroups.reduce((s, sg) => s + sg.kros_total_czk, 0)).toBe(60000);
  });

  it('mixed tagged + untagged → tagged first, null group last', () => {
    const rows = [
      pos({ subtype: 'beton', concrete_m3: 5, kros_total_czk: 1000 }),
      tagged('dřík', { subtype: 'beton', concrete_m3: 60, kros_total_czk: 30000 }),
    ];
    const g = groupByStructuralPart(rows);
    expect(g.has_parts).toBe(true);
    expect(g.subgroups.map((s) => s.part_label)).toEqual(['dřík', null]);
  });
});
