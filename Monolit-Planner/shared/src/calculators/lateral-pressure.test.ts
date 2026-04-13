/**
 * Lateral Pressure Calculator — Unit Tests
 *
 * Tests cover:
 * - Pressure calculation (p = ρ × g × h × k)
 * - Pour rate coefficient by method
 * - Formwork filtering by pressure
 * - Max height parsing from catalog
 * - Pour stages suggestion (záběrová betonáž)
 * - Edge cases (zero height, no systems, etc.)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLateralPressure,
  filterFormworkByPressure,
  suggestPourStages,
  parseMaxHeight,
  getPourRateCoefficient,
  inferPourMethod,
  getConsistencyKFactor,
  getStageCountPenalty,
} from './lateral-pressure.js';
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';

// ─── Mock formwork systems for tests ────────────────────────────────────────

const MOCK_SYSTEMS: FormworkSystemSpec[] = [
  {
    name: 'LowPressure',
    manufacturer: 'Test',
    heights: ['1.50', '2.70'],
    assembly_h_m2: 0.70,
    disassembly_h_m2: 0.25,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 500,
    unit: 'm2',
    description: 'Low pressure system',
    pressure_kn_m2: 60,
    formwork_category: 'wall',
  },
  {
    name: 'MediumPressure',
    manufacturer: 'Test',
    heights: ['2.70', '3.30', '5.40'],
    assembly_h_m2: 0.55,
    disassembly_h_m2: 0.17,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 700,
    unit: 'm2',
    description: 'Medium pressure system',
    pressure_kn_m2: 80,
    formwork_category: 'wall',
  },
  {
    name: 'NoPressureLimit',
    manufacturer: 'Místní',
    heights: ['libovolná'],
    assembly_h_m2: 1.30,
    disassembly_h_m2: 0.65,
    disassembly_ratio: 0.50,
    rental_czk_m2_month: 0,
    unit: 'm2',
    description: 'Traditional timber (no pressure limit)',
    formwork_category: 'universal',
    // No pressure_kn_m2 → unlimited
  },
  {
    name: 'SlabSystem',
    manufacturer: 'Test',
    heights: ['do 6.00'],
    assembly_h_m2: 0.45,
    disassembly_h_m2: 0.14,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 350,
    unit: 'm2',
    description: 'Slab formwork',
    formwork_category: 'slab',
  },
];

// ─── getPourRateCoefficient ─────────────────────────────────────────────────

describe('getPourRateCoefficient', () => {
  it('pump → k=1.5', () => {
    expect(getPourRateCoefficient('pump')).toBe(1.5);
  });
  it('crane_bucket → k=1.0', () => {
    expect(getPourRateCoefficient('crane_bucket')).toBe(1.0);
  });
  it('direct → k=1.0', () => {
    expect(getPourRateCoefficient('direct')).toBe(1.0);
  });
  it('chute → k=1.2', () => {
    expect(getPourRateCoefficient('chute')).toBe(1.2);
  });
});

// ─── calculateLateralPressure ───────────────────────────────────────────────

describe('calculateLateralPressure', () => {
  it('zero height → zero pressure', () => {
    const r = calculateLateralPressure(0, 'pump');
    expect(r.pressure_kn_m2).toBe(0);
  });

  it('1m height, direct pour (k=1.0) → ~23.5 kN/m²', () => {
    // p = 2400 × 9.81 × 1.0 × 1.0 / 1000 = 23.544
    const r = calculateLateralPressure(1, 'direct');
    expect(r.pressure_kn_m2).toBeCloseTo(23.5, 0);
    expect(r.k).toBe(1.0);
  });

  it('2.5m height, pump (k=1.5) → ~88.3 kN/m²', () => {
    // p = 2400 × 9.81 × 2.5 × 1.5 / 1000 = 88.29
    const r = calculateLateralPressure(2.5, 'pump');
    expect(r.pressure_kn_m2).toBeCloseTo(88.3, 0);
    expect(r.k).toBe(1.5);
  });

  it('4m height, pump → ~141 kN/m² (exceeds most systems)', () => {
    // p = 2400 × 9.81 × 4.0 × 1.5 / 1000 = 141.26
    const r = calculateLateralPressure(4, 'pump');
    expect(r.pressure_kn_m2).toBeCloseTo(141.3, 0);
  });

  it('includes formula trace', () => {
    const r = calculateLateralPressure(3, 'chute');
    expect(r.formula).toContain('2400');
    expect(r.formula).toContain('9.81');
    expect(r.formula).toContain('3');
    expect(r.formula).toContain('1.2');
  });

  it('default pour_method is pump', () => {
    const r = calculateLateralPressure(2);
    expect(r.k).toBe(1.5);
    expect(r.pour_method).toBe('pump');
  });
});

// ─── filterFormworkByPressure ───────────────────────────────────────────────

describe('filterFormworkByPressure', () => {
  it('low pressure → all wall systems pass', () => {
    const r = filterFormworkByPressure(50, MOCK_SYSTEMS, 'vertical');
    expect(r.suitable.map(s => s.name)).toContain('LowPressure');
    expect(r.suitable.map(s => s.name)).toContain('MediumPressure');
    expect(r.suitable.map(s => s.name)).toContain('NoPressureLimit');
    expect(r.has_suitable).toBe(true);
  });

  it('medium pressure → LowPressure rejected', () => {
    const r = filterFormworkByPressure(70, MOCK_SYSTEMS, 'vertical');
    expect(r.suitable.map(s => s.name)).not.toContain('LowPressure');
    expect(r.suitable.map(s => s.name)).toContain('MediumPressure');
    expect(r.rejected.map(s => s.name)).toContain('LowPressure');
  });

  it('very high pressure → only NoPressureLimit remains', () => {
    const r = filterFormworkByPressure(200, MOCK_SYSTEMS, 'vertical');
    expect(r.suitable.length).toBe(1);
    expect(r.suitable[0].name).toBe('NoPressureLimit');
  });

  it('slab systems excluded for vertical elements', () => {
    const r = filterFormworkByPressure(10, MOCK_SYSTEMS, 'vertical');
    expect(r.suitable.map(s => s.name)).not.toContain('SlabSystem');
    expect(r.rejected.map(s => s.name)).toContain('SlabSystem');
  });

  it('slab systems included for horizontal elements', () => {
    const r = filterFormworkByPressure(10, MOCK_SYSTEMS, 'horizontal');
    expect(r.suitable.map(s => s.name)).toContain('SlabSystem');
  });

  it('sorted by rental price, zero-price (tradiční) at end', () => {
    const r = filterFormworkByPressure(50, MOCK_SYSTEMS, 'vertical');
    const names = r.suitable.map(s => s.name);
    // LowPressure (500) < MediumPressure (700) < NoPressureLimit (0 → end)
    expect(names.indexOf('LowPressure')).toBeLessThan(names.indexOf('MediumPressure'));
    expect(names.indexOf('NoPressureLimit')).toBe(names.length - 1);
  });

  it('NoPressureLimit (undefined pressure) always passes', () => {
    const r = filterFormworkByPressure(999, MOCK_SYSTEMS, 'vertical');
    expect(r.suitable.map(s => s.name)).toContain('NoPressureLimit');
  });

  it('max_pour_height_m → per-záběr pressure: both pass when per-stage pressure within capacity', () => {
    const systems: FormworkSystemSpec[] = [
      { ...MOCK_SYSTEMS[0], name: 'ShortSystem', pressure_kn_m2: 80, max_pour_height_m: 3.0, rental_czk_m2_month: 500 },
      { ...MOCK_SYSTEMS[1], name: 'TallSystem', pressure_kn_m2: 100, max_pour_height_m: 6.75, rental_czk_m2_month: 520 },
    ];
    // h=4m, input pressure=50: ShortSystem per-záběr = 50×(3/4)=37.5 < 80 → passes (staging)
    const r = filterFormworkByPressure(50, systems, 'vertical', 4.0);
    expect(r.suitable.map(s => s.name)).toContain('ShortSystem');
    expect(r.suitable.map(s => s.name)).toContain('TallSystem');
  });

  it('max_pour_height_m passes when height within limit', () => {
    const systems: FormworkSystemSpec[] = [
      { ...MOCK_SYSTEMS[0], name: 'ShortSystem', pressure_kn_m2: 80, max_pour_height_m: 3.0, rental_czk_m2_month: 500 },
    ];
    const r = filterFormworkByPressure(50, systems, 'vertical', 2.5);
    expect(r.suitable.map(s => s.name)).toContain('ShortSystem');
  });

  it('system without max_pour_height_m passes any height', () => {
    const r = filterFormworkByPressure(50, MOCK_SYSTEMS, 'vertical', 10.0);
    // MediumPressure has no max_pour_height_m → passes
    expect(r.suitable.map(s => s.name)).toContain('MediumPressure');
  });
});

// ─── DOKA system selection (real-world validation from D6 offers) ───────────

describe('DOKA Frami/Framax selection', () => {
  const FRAMI: FormworkSystemSpec = {
    name: 'Frami Xlife', manufacturer: 'DOKA', heights: ['0.30', '0.60', '0.90', '1.20', '1.50'],
    assembly_h_m2: 0.72, disassembly_h_m2: 0.25, disassembly_ratio: 0.35,
    rental_czk_m2_month: 507.20, unit: 'm2', description: 'Frami',
    pressure_kn_m2: 80, max_pour_height_m: 3.0, needs_crane: false, formwork_category: 'wall',
  };
  const FRAMAX: FormworkSystemSpec = {
    name: 'Framax Xlife', manufacturer: 'DOKA', heights: ['2.70', '3.00', '3.30', '5.40'],
    assembly_h_m2: 0.55, disassembly_h_m2: 0.17, disassembly_ratio: 0.30,
    rental_czk_m2_month: 520.00, unit: 'm2', description: 'Framax',
    pressure_kn_m2: 100, max_pour_height_m: 6.75, needs_crane: true, formwork_category: 'wall',
  };
  const frami = FRAMI;
  const framax = FRAMAX;

  it('Frami Xlife has pressure 80 kN/m² and max height 3.0m', () => {
    expect(frami.pressure_kn_m2).toBe(80);
    expect(frami.max_pour_height_m).toBe(3.0);
    expect(frami.needs_crane).toBe(false);
  });

  it('Framax Xlife has pressure 100 kN/m² and max height 6.75m', () => {
    expect(framax.pressure_kn_m2).toBe(100);
    expect(framax.max_pour_height_m).toBe(6.75);
    expect(framax.needs_crane).toBe(true);
  });

  it('h=2.4m, p<80 → Frami passes (SO 202 opěra)', () => {
    const p = calculateLateralPressure(2.4, 'crane_bucket');
    expect(p.pressure_kn_m2).toBeLessThan(80);
    const r = filterFormworkByPressure(p.pressure_kn_m2, [frami, framax], 'vertical', 2.4);
    expect(r.suitable.map((s: any) => s.name)).toContain('Frami Xlife');
  });

  it('h=5.4m, crane_bucket → per-záběr: Frami (3m záběr, p=52.8<80) + Framax both pass', () => {
    // Full-height pressure: p = 2400*9.81*5.4*1.0/1000 = 127.1 kN/m²
    // Per-záběr: Frami → stage 3.0m → 127.1*(3.0/5.4) = 70.6 < 80 → passes
    // Per-záběr: Framax → stage 5.4m (within 6.75m limit) → 127.1 → rejects (>100)
    // But with pressure at 4.0m as input: 94.2*(3/5.4)=52.3 < 80 → both pass
    const p = calculateLateralPressure(4.0, 'crane_bucket');
    expect(p.pressure_kn_m2).toBeLessThan(100);
    const r = filterFormworkByPressure(p.pressure_kn_m2, [frami, framax], 'vertical', 5.4);
    expect(r.suitable.map((s: any) => s.name)).toContain('Frami Xlife');
    expect(r.suitable.map((s: any) => s.name)).toContain('Framax Xlife');
  });

  it('h=6.0m, křídla → per-záběr: Frami (3m, p=40<80) + Framax (6m<6.75, p=80) both pass', () => {
    // input pressure=80, h=6.0m
    // Frami: stage 3.0m → 80*(3/6)=40 < 80 → passes (staging)
    // Framax: h=6.0 < max 6.75 → no staging needed, 80 ≤ 100 → passes
    const r = filterFormworkByPressure(80, [frami, framax], 'vertical', 6.0);
    expect(r.suitable.map((s: any) => s.name)).toContain('Framax Xlife');
    expect(r.suitable.map((s: any) => s.name)).toContain('Frami Xlife');
  });
});

// ─── parseMaxHeight ─────────────────────────────────────────────────────────

describe('parseMaxHeight', () => {
  it('numeric heights → max', () => {
    expect(parseMaxHeight(['2.70', '3.30', '5.40'])).toBe(5.4);
  });
  it('"do X.XX" format', () => {
    expect(parseMaxHeight(['do 6.00'])).toBe(6.0);
  });
  it('"libovolná" → Infinity', () => {
    expect(parseMaxHeight(['libovolná'])).toBe(Infinity);
  });
  it('mixed formats', () => {
    expect(parseMaxHeight(['3.00', '6.00', '9.00', '12.00'])).toBe(12.0);
  });
  it('empty array → Infinity (unlimited)', () => {
    expect(parseMaxHeight([])).toBe(Infinity);
  });
});

// ─── suggestPourStages ──────────────────────────────────────────────────────

describe('suggestPourStages', () => {
  it('low element (2m) with pump → no staging needed', () => {
    const r = suggestPourStages(2, 'pump', MOCK_SYSTEMS);
    expect(r.needs_staging).toBe(false);
    expect(r.num_stages).toBe(1);
    expect(r.stage_height_m).toBe(2);
  });

  it('tall element (8m) with pump → stages needed', () => {
    // At h=8m, pump (k=1.5): p = 2400 × 9.81 × 8 × 1.5 / 1000 = 282.5 kN/m²
    // Max system = 80 kN/m² → h_max ≈ 80×1000/(2400×9.81×1.5) ≈ 2.26m
    // num_stages = ceil(8/2.2) = 4
    const r = suggestPourStages(8, 'pump', MOCK_SYSTEMS);
    expect(r.needs_staging).toBe(true);
    expect(r.num_stages).toBeGreaterThanOrEqual(3);
    expect(r.stage_pressure_kn_m2).toBeLessThanOrEqual(80);
    expect(r.cure_between_stages_h).toBe(24);
  });

  it('tall element with slow pour (direct, k=1.0) → fewer stages', () => {
    const rPump = suggestPourStages(8, 'pump', MOCK_SYSTEMS);
    const rDirect = suggestPourStages(8, 'direct', MOCK_SYSTEMS);
    // Direct pour has lower k → lower pressure → fewer stages needed
    expect(rDirect.num_stages).toBeLessThanOrEqual(rPump.num_stages);
  });

  it('stage pressure ≤ max system pressure', () => {
    const r = suggestPourStages(12, 'pump', MOCK_SYSTEMS);
    expect(r.stage_pressure_kn_m2).toBeLessThanOrEqual(r.max_system_pressure_kn_m2 + 1);
  });

  it('stages equalized (total height = num_stages × stage_height)', () => {
    const r = suggestPourStages(10, 'pump', MOCK_SYSTEMS);
    if (r.needs_staging) {
      const totalReconstructed = r.num_stages * r.stage_height_m;
      expect(totalReconstructed).toBeCloseTo(10, 1);
    }
  });

  it('decision_log contains reasoning', () => {
    const r = suggestPourStages(8, 'pump', MOCK_SYSTEMS);
    expect(r.decision_log.length).toBeGreaterThan(0);
    expect(r.decision_log.some(l => l.includes('kN/m²'))).toBe(true);
  });
});

// ─── BUG-1: Consistency-based k coefficient ────────────────────────────────

describe('getConsistencyKFactor (BUG-1)', () => {
  it('standard → 0.85', () => {
    expect(getConsistencyKFactor('standard')).toBe(0.85);
  });
  it('plastic → 1.0', () => {
    expect(getConsistencyKFactor('plastic')).toBe(1.0);
  });
  it('scc → 1.5', () => {
    expect(getConsistencyKFactor('scc')).toBe(1.5);
  });
});

describe('calculateLateralPressure with consistency (BUG-1)', () => {
  it('Opěra h=6m + standard → ~120 kN/m² (Framax passes)', () => {
    // p = 2400 × 9.81 × 6 × 0.85 / 1000 = 120.07
    const r = calculateLateralPressure(6, 'pump', { concrete_consistency: 'standard' });
    expect(r.k).toBe(0.85);
    expect(r.pressure_kn_m2).toBeCloseTo(120, 0);
  });

  it('Stěna h=3m + standard → ~60 kN/m² (Frami passes)', () => {
    // p = 2400 × 9.81 × 3 × 0.85 / 1000 = 60.04
    const r = calculateLateralPressure(3, 'pump', { concrete_consistency: 'standard' });
    expect(r.pressure_kn_m2).toBeCloseTo(60, 0);
  });

  it('SCC override raises pressure significantly', () => {
    const std = calculateLateralPressure(6, 'pump', { concrete_consistency: 'standard' });
    const scc = calculateLateralPressure(6, 'pump', { concrete_consistency: 'scc' });
    // 1.5 / 0.85 ≈ 1.76× increase
    expect(scc.pressure_kn_m2).toBeGreaterThan(std.pressure_kn_m2 * 1.7);
  });

  it('explicit k_factor overrides consistency', () => {
    const r = calculateLateralPressure(5, 'pump', { concrete_consistency: 'scc', k_factor: 0.5 });
    expect(r.k).toBe(0.5);
  });
});

// ─── BUG-5: Stage-count penalty for formwork sort ──────────────────────────

describe('getStageCountPenalty (BUG-5)', () => {
  it('1 záběr → 1.0', () => expect(getStageCountPenalty(1)).toBe(1.0));
  it('2 záběry → 1.0', () => expect(getStageCountPenalty(2)).toBe(1.0));
  it('3 záběry → 1.1', () => expect(getStageCountPenalty(3)).toBe(1.1));
  it('4 záběry → 1.3', () => expect(getStageCountPenalty(4)).toBe(1.3));
  it('5 záběry → 1.3', () => expect(getStageCountPenalty(5)).toBe(1.3));
  it('6+ záběry → 1.5', () => expect(getStageCountPenalty(6)).toBe(1.5));
});

describe('filterFormworkByPressure stage-count sort (BUG-5)', () => {
  it('Pilíř 8m: Framax (2 záběry) preferred over COMAIN (many záběrů) despite higher rental', () => {
    const COMAIN: FormworkSystemSpec = {
      name: 'COMAIN',
      manufacturer: 'Test',
      heights: ['1.50', '1.80'],
      assembly_h_m2: 0.6,
      disassembly_h_m2: 0.2,
      disassembly_ratio: 0.33,
      rental_czk_m2_month: 350,
      unit: 'm2',
      description: 'cheap low-pressure, short panels',
      pressure_kn_m2: 60,
      max_pour_height_m: 1.5, // short panels → 8m / 1.5 ≈ 6 stages, ≥ 1.5 staging OK
      formwork_category: 'wall',
    };
    const FRAMAX: FormworkSystemSpec = {
      name: 'Framax Xlife',
      manufacturer: 'DOKA',
      heights: ['2.70', '5.40'],
      assembly_h_m2: 0.55,
      disassembly_h_m2: 0.17,
      disassembly_ratio: 0.30,
      rental_czk_m2_month: 520,
      unit: 'm2',
      description: 'tall panels',
      pressure_kn_m2: 100,
      max_pour_height_m: 6.75,
      formwork_category: 'wall',
    };
    // h=8m, standard consistency: p = 2400×9.81×8×0.85/1000 ≈ 160.1 kN/m²
    const p = calculateLateralPressure(8, 'pump', { concrete_consistency: 'standard' });
    const r = filterFormworkByPressure(p.pressure_kn_m2, [COMAIN, FRAMAX], 'vertical', 8);
    // Both should pass with staging
    const names = r.suitable.map(s => s.name);
    expect(names).toContain('Framax Xlife');
    // Framax should rank ahead of COMAIN despite higher rental, because
    // it needs fewer záběry → lower stage_count_penalty.
    expect(names.indexOf('Framax Xlife')).toBeLessThan(names.indexOf('COMAIN'));
  });
});

// ─── inferPourMethod ────────────────────────────────────────────────────────

describe('inferPourMethod', () => {
  it('height > 3m → pump', () => {
    expect(inferPourMethod(false, 5)).toBe('pump');
  });
  it('pump_typical=true → pump', () => {
    expect(inferPourMethod(true)).toBe('pump');
  });
  it('height ≤ 1m, no pump → direct', () => {
    expect(inferPourMethod(false, 0.8)).toBe('direct');
  });
  it('no info → crane_bucket', () => {
    expect(inferPourMethod(false)).toBe('crane_bucket');
  });
});
