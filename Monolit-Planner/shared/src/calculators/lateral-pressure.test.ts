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
