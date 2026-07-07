/**
 * composite-planner tests — Fáze 5 #7, Gate 2 (hermetic, no AI/network).
 * Covers the ratified watch-points:
 *  - AC 3.10 backward-compat: parent-only composite ≡ planProject([parent]) (zero delta).
 *  - Parent = container: aggregate is exactly Σ leaf parts (no parent contribution).
 *  - AC 3.7 exact closure: Σ part volumes == parent total, no m³ lost to rounding.
 *  - ODHAD provenance: estimated parts flagged 'odhad_family_ratio', exact ones 'exact'.
 *  - Fallback (a): no parts → honest "nedetailizováno", never invented parts.
 */

import { describe, it, expect } from 'vitest';
import { planProject } from './project-planner.js';
import { planComposite } from './composite-planner.js';
import type { CompositePartInput } from './composite-planner.js';
import type { PlannerInput } from './planner-orchestrator.js';

const base = {
  concrete_class: 'C30/37',
  exposure_class: 'XF1',
  height_m: 3,
  temperature_c: 15,
  has_dilatacni_spary: false,
} as const;

function parent(volume_m3: number): PlannerInput {
  return { element_type: 'opery_ulozne_prahy', volume_m3, ...base };
}

function part(
  element_type: PlannerInput['element_type'],
  volume_m3?: number,
  part_label?: string,
): CompositePartInput {
  const p: CompositePartInput = { element_type, ...base };
  if (volume_m3 !== undefined) p.volume_m3 = volume_m3;
  if (part_label) p.part_label = part_label;
  return p;
}

describe('planComposite — fallback (a) "nedetailizováno"', () => {
  it('no parts → parent as one element, byte-identical to planProject([parent])', () => {
    const p = parent(100);
    const out = planComposite({ parent: p, parts: [] });
    const direct = planProject([p]);
    expect(out.is_detailed).toBe(false);
    expect(out.parts).toHaveLength(1);
    expect(out.parts[0].volume_source).toBe('exact');
    expect(out.warnings.join(' ')).toMatch(/nedetailizováno/i);
    // AC 3.10 — engine output + aggregate unchanged
    expect(out.aggregate).toEqual(direct.aggregate);
    expect(out.parts[0].plan).toEqual(direct.elements[0].plan);
  });
});

describe('planComposite — all exact parts', () => {
  it('keeps each volume, closes, aggregate = Σ parts (parent contributes 0)', () => {
    const drik = part('driky_piliru', 60, 'dřík');
    const kridla = part('kridla_opery', 40, 'křídla');
    const out = planComposite({ parent: parent(100), parts: [drik, kridla] });
    expect(out.is_detailed).toBe(true);
    expect(out.parts.map((p) => p.volume_source)).toEqual(['exact', 'exact']);
    expect(out.parts.map((p) => p.volume_m3)).toEqual([60, 40]);
    expect(out.parts[0].label).toBe('dřík');
    expect(out.volume_closed).toBe(true);
    const direct = planProject([
      { ...drik, volume_m3: 60 } as PlannerInput,
      { ...kridla, volume_m3: 40 } as PlannerInput,
    ]);
    expect(out.aggregate).toEqual(direct.aggregate);
  });
});

describe('planComposite — all estimate (placeholder ratio split)', () => {
  it('splits total by ratios, flags ODHAD, closes to 100 %', () => {
    const out = planComposite({
      parent: parent(100),
      parts: [part('driky_piliru', undefined, 'dřík'), part('kridla_opery', undefined, 'křídla')],
    });
    expect(out.parts.map((p) => p.volume_source)).toEqual([
      'odhad_family_ratio',
      'odhad_family_ratio',
    ]);
    // weights 0.45 / 0.35 → 56.25 / 43.75
    expect(out.parts[0].volume_m3).toBeCloseTo(56.25, 2);
    expect(out.parts[1].volume_m3).toBeCloseTo(43.75, 2);
    const sum = out.parts.reduce((s, p) => s + p.volume_m3, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9); // exact closure
    expect(out.volume_closed).toBe(true);
  });
});

describe('planComposite — partial split (watch-point #3: exact closure)', () => {
  it('exact dřík + estimate křídla → Σ == total EXACTLY', () => {
    const out = planComposite({
      parent: parent(100),
      parts: [part('driky_piliru', 60, 'dřík'), part('kridla_opery', undefined, 'křídla')],
    });
    expect(out.parts[0].volume_source).toBe('exact');
    expect(out.parts[1].volume_source).toBe('odhad_family_ratio');
    expect(out.parts[1].volume_m3).toBeCloseTo(40, 6);
    const sum = out.parts.reduce((s, p) => s + p.volume_m3, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
    expect(out.volume_closed).toBe(true);
  });

  it('messy numbers: 1 exact + 3 estimates, last absorbs residual, Σ == total exactly', () => {
    const total = 123.45;
    const out = planComposite({
      parent: parent(total),
      parts: [
        part('driky_piliru', 77.77, 'dřík'),
        part('opery_ulozne_prahy', undefined, 'práh'),
        part('mostni_zavirne_zidky', undefined, 'zídka'),
        part('kridla_opery', undefined, 'křídla'),
      ],
    });
    const sum = out.parts.reduce((s, p) => s + p.volume_m3, 0);
    expect(Math.abs(sum - total)).toBeLessThan(1e-9);
    expect(out.volume_closed).toBe(true);
    // exactly one exact part, three estimated
    expect(out.parts.filter((p) => p.volume_source === 'exact')).toHaveLength(1);
    expect(out.parts.filter((p) => p.volume_source === 'odhad_family_ratio')).toHaveLength(3);
  });
});

describe('planComposite — exact parts exceed total', () => {
  it('warns and does not silently force closure', () => {
    const out = planComposite({
      parent: parent(100),
      parts: [part('driky_piliru', 60), part('kridla_opery', 60)],
    });
    expect(out.volume_closed).toBe(false);
    expect(out.warnings.join(' ')).toMatch(/překračuje/i);
  });
});

describe('planComposite — opěra template (Gate 5: dřík + práh + zídka + křídla)', () => {
  // Mirrors the frontend ABUTMENT_PART_TEMPLATE the Gate 5 panel seeds:
  // four ODHAD parts whose types map 1:1 to PLACEHOLDER_PART_VOLUME_RATIOS.
  const template = (): CompositePartInput[] => [
    part('driky_piliru', undefined, 'Dřík'),
    part('opery_ulozne_prahy', undefined, 'Úložný práh'),
    part('mostni_zavirne_zidky', undefined, 'Závěrná zídka'),
    part('kridla_opery', undefined, 'Křídla'),
  ];

  it('each part computes its own plan (bednění/takty/beton) and Σ == total', () => {
    const total = 240;
    const out = planComposite({ parent: parent(total), parts: template(), parent_label: 'OPĚRA OP1' });
    expect(out.is_detailed).toBe(true);
    expect(out.parts).toHaveLength(4);
    // labels carry through (→ structural_part tags on apply)
    expect(out.parts.map((p) => p.label)).toEqual(['Dřík', 'Úložný práh', 'Závěrná zídka', 'Křídla']);
    // every part has its own engine plan with a formwork system + tact count
    for (const p of out.parts) {
      expect(p.plan).toBeDefined();
      expect(p.plan!.formwork.system.name).toBeTruthy();
      expect(p.plan!.pour_decision.num_tacts).toBeGreaterThanOrEqual(1);
      expect(p.volume_source).toBe('odhad_family_ratio');
    }
    // 100 % closure, no m³ lost
    const sum = out.parts.reduce((s, p) => s + p.volume_m3, 0);
    expect(Math.abs(sum - total)).toBeLessThan(1e-9);
    expect(out.volume_closed).toBe(true);
  });

  it('mixed: exact dřík keeps its volume, the rest share the remainder', () => {
    const total = 200;
    const parts = template();
    parts[0].volume_m3 = 120; // dřík exact
    const out = planComposite({ parent: parent(total), parts });
    expect(out.parts[0].volume_source).toBe('exact');
    expect(out.parts[0].volume_m3).toBe(120);
    expect(out.parts.slice(1).every((p) => p.volume_source === 'odhad_family_ratio')).toBe(true);
    const sum = out.parts.reduce((s, p) => s + p.volume_m3, 0);
    expect(Math.abs(sum - total)).toBeLessThan(1e-9);
  });
});

describe('planComposite — one-element parity (AC 3.10)', () => {
  it('parent-only composite ≡ planProject([parent]) (zero delta)', () => {
    const p = parent(45);
    const out = planComposite({ parent: p });
    const direct = planProject([p]);
    expect(out.aggregate).toEqual(direct.aggregate);
    expect(out.parts[0].plan).toEqual(direct.elements[0].plan);
  });
});
