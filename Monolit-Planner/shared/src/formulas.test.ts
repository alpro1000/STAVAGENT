/**
 * Formulas Tests - Critical Business Logic
 * Testing KROS rounding, unit costs, duration calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateKrosUnitCZK,
  calculateUnitCostOnM3,
  calculateLaborHours,
  calculateCostCZK,
  calculateUnitCostNative,
  calculateKrosTotalCZK,
  calculateEstimatedMonths,
  calculateEstimatedWeeks,
  calculateWeightedAverage,
  calculatePositionFields,
  findConcreteVolumeForPart,
  calculateHeaderKPI,
  calculateFormworkTacts,
  calculateFormworkTerm,
  calculateMonthlyRentalPerSet,
  calculateFinalRentalCost,
  calculateElementTotalDays,
  generateFormworkKrosDescription
} from './formulas';
import type { Position } from './types';

describe('KROS Rounding', () => {
  it('should round up to nearest 50 CZK', () => {
    expect(calculateKrosUnitCZK(501)).toBe(550);
    expect(calculateKrosUnitCZK(500)).toBe(500);
    expect(calculateKrosUnitCZK(499)).toBe(500);
    expect(calculateKrosUnitCZK(451)).toBe(500);
    expect(calculateKrosUnitCZK(450)).toBe(450);
    expect(calculateKrosUnitCZK(449)).toBe(450);
  });

  it('should handle edge cases', () => {
    expect(calculateKrosUnitCZK(0)).toBe(0);
    expect(calculateKrosUnitCZK(1)).toBe(50);
    expect(calculateKrosUnitCZK(49)).toBe(50);
    expect(calculateKrosUnitCZK(50)).toBe(50);
    expect(calculateKrosUnitCZK(51)).toBe(100);
  });

  it('should support custom rounding step', () => {
    expect(calculateKrosUnitCZK(525, 100)).toBe(600);
    expect(calculateKrosUnitCZK(500, 100)).toBe(500);
    expect(calculateKrosUnitCZK(499, 100)).toBe(500);
  });

  it('should handle large values', () => {
    expect(calculateKrosUnitCZK(10001)).toBe(10050);
    expect(calculateKrosUnitCZK(999999)).toBe(1000000);
  });
});

describe('Unit Cost Calculations', () => {
  describe('calculateUnitCostOnM3', () => {
    it('should calculate cost per m³ correctly', () => {
      expect(calculateUnitCostOnM3(50000, 100)).toBe(500);
      expect(calculateUnitCostOnM3(60000, 100)).toBe(600);
      expect(calculateUnitCostOnM3(100000, 200)).toBe(500);
    });

    it('should handle zero volume', () => {
      expect(calculateUnitCostOnM3(50000, 0)).toBe(0);
    });

    it('should handle decimal volumes', () => {
      expect(calculateUnitCostOnM3(50000, 7.838)).toBeCloseTo(6379.18, 1);
    });
  });

  describe('calculateUnitCostNative', () => {
    it('should calculate native unit cost', () => {
      expect(calculateUnitCostNative(50000, 100)).toBe(500);
      expect(calculateUnitCostNative(20000, 45.5)).toBeCloseTo(439.56, 2);
    });

    it('should handle zero quantity', () => {
      expect(calculateUnitCostNative(50000, 0)).toBe(0);
    });
  });
});

describe('Labor and Cost Calculations', () => {
  it('should calculate labor hours correctly', () => {
    expect(calculateLaborHours(10, 8, 5)).toBe(400);  // 10 * 8 * 5
    expect(calculateLaborHours(5, 8, 10)).toBe(400);  // 5 * 8 * 10
  });

  it('should calculate total cost correctly', () => {
    expect(calculateCostCZK(400, 200)).toBe(80000);  // 400h * 200 CZK/h
    expect(calculateCostCZK(100, 150)).toBe(15000);  // 100h * 150 CZK/h
  });

  it('should calculate KROS total cost', () => {
    expect(calculateKrosTotalCZK(500, 100)).toBe(50000);  // 500 * 100
    expect(calculateKrosTotalCZK(550, 100)).toBe(55000);  // 550 * 100
  });
});

describe('Duration Calculations', () => {
  it('should calculate estimated months correctly', () => {
    // 1.5M CZK / (10 crew * 200 CZK/h * 8h * 22 days) = 1.5M / 352000 ≈ 4.26 months
    const months = calculateEstimatedMonths(
      1500000,  // total cost
      10,       // crew size
      200,      // wage per hour
      8,        // shift hours
      22        // days per month
    );
    expect(months).toBeCloseTo(4.26, 2);
  });

  it('should calculate zero when cost per day is zero', () => {
    expect(calculateEstimatedMonths(1000000, 0, 200, 8, 22)).toBe(0);
    expect(calculateEstimatedMonths(1000000, 10, 0, 8, 22)).toBe(0);
  });

  it('should calculate estimated weeks', () => {
    const weeks = calculateEstimatedWeeks(4.26, 22);
    // 4.26 months * 22 days / 7 = 13.39 weeks
    expect(weeks).toBeCloseTo(13.39, 1);
  });

  it('should handle 30-day month mode', () => {
    const weeks = calculateEstimatedWeeks(4, 30);
    // 4 months * 30 days / 7 = 17.14 weeks
    expect(weeks).toBeCloseTo(17.14, 2);
  });
});

describe('Weighted Average', () => {
  const positions: Position[] = [
    {
      position_id: '1',
      bridge_id: 'test',
      part_name: 'Opěra 1',
      subtype: 'beton',
      crew_size: 10,
      concrete_m3: 100,
      wage_czk_ph: 200
    } as unknown as Position,
    {
      position_id: '2',
      bridge_id: 'test',
      part_name: 'Opěra 2',
      subtype: 'beton',
      crew_size: 5,
      concrete_m3: 50,
      wage_czk_ph: 180
    } as unknown as Position
  ];

  it('should calculate weighted average crew size', () => {
    // (10*100 + 5*50) / (100+50) = 1250 / 150 = 8.33
    const avg = calculateWeightedAverage(positions, 'crew_size');
    expect(avg).toBeCloseTo(8.33, 2);
  });

  it('should calculate weighted average wage', () => {
    // (200*100 + 180*50) / (100+50) = 29000 / 150 = 193.33
    const avg = calculateWeightedAverage(positions, 'wage_czk_ph');
    expect(avg).toBeCloseTo(193.33, 2);
  });

  it('should return 0 for empty positions', () => {
    expect(calculateWeightedAverage([], 'crew_size')).toBe(0);
  });

  it('should skip positions with zero weight', () => {
    const positionsWithZero: Position[] = [
      ...positions,
      {
        position_id: '3',
        bridge_id: 'test',
        part_name: 'Other',
        subtype: 'beton',
        crew_size: 999,
        concrete_m3: 0,  // Zero weight - should be skipped
        wage_czk_ph: 999
      } as unknown as Position
    ];

    const avg = calculateWeightedAverage(positionsWithZero, 'crew_size');
    expect(avg).toBeCloseTo(8.33, 2);  // Same as without zero-weight position
  });
});

describe('findConcreteVolumeForPart', () => {
  const positions: Position[] = [
    {
      position_id: '1',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'beton',
      qty: 100
    } as unknown as Position,
    {
      position_id: '2',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'bednění',
      qty: 200
    } as unknown as Position,
    {
      position_id: '3',
      bridge_id: 'SO-02',
      part_name: 'Opěra 2',
      subtype: 'beton',
      qty: 150
    } as unknown as Position
  ];

  it('should find concrete volume for matching bridge and part', () => {
    const volume = findConcreteVolumeForPart(positions, 'SO-01', 'Opěra 1');
    expect(volume).toBe(100);
  });

  it('should return null when no beton position found', () => {
    const volume = findConcreteVolumeForPart(positions, 'SO-01', 'Nonexistent');
    expect(volume).toBe(null);
  });

  it('should match exact bridge_id', () => {
    const volume = findConcreteVolumeForPart(positions, 'SO-02', 'Opěra 2');
    expect(volume).toBe(150);
  });
});

describe('calculatePositionFields', () => {
  it('should calculate all fields for бетон position', () => {
    const position: Position = {
      position_id: '1',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'beton',
      item_name: 'Beton C30/37',
      qty: 100,          // Volume in m³
      crew_size: 10,
      shift_hours: 8,
      days: 5,
      wage_czk_ph: 200
    } as unknown as Position;

    const result = calculatePositionFields(position, [position]);

    expect(result.labor_hours).toBe(400);              // 10 * 8 * 5
    expect(result.cost_czk).toBe(80000);               // 400 * 200
    expect(result.unit_cost_native).toBe(800);         // 80000 / 100
    expect(result.concrete_m3).toBe(100);              // Same as qty for бетон
    expect(result.unit_cost_on_m3).toBe(800);          // 80000 / 100
    expect(result.kros_unit_czk).toBe(800);            // ceil(800/50)*50 = 800
    expect(result.kros_total_czk).toBe(80000);         // 800 * 100
    expect(result.has_rfi).toBe(false);
  });

  it('should calculate fields for bednění position (finds бетон)', () => {
    const betonPosition: Position = {
      position_id: '1',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'beton',
      qty: 100,
      crew_size: 10,
      shift_hours: 8,
      days: 5,
      wage_czk_ph: 200
    } as unknown as Position;

    const bedeniPosition: Position = {
      position_id: '2',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'bednění',
      item_name: 'Bednění stěn',
      qty: 200,          // Area in m²
      crew_size: 5,
      shift_hours: 8,
      days: 10,
      wage_czk_ph: 180
    } as unknown as Position;

    const result = calculatePositionFields(bedeniPosition, [betonPosition, bedeniPosition]);

    expect(result.labor_hours).toBe(400);              // 5 * 8 * 10
    expect(result.cost_czk).toBe(72000);               // 400 * 180
    expect(result.unit_cost_native).toBe(360);         // 72000 / 200 (CZK/m²)
    expect(result.concrete_m3).toBe(100);              // From бетон position
    expect(result.unit_cost_on_m3).toBe(720);          // 72000 / 100 (CZK/m³)
    expect(result.kros_unit_czk).toBe(750);            // ceil(720/50)*50 = 750
    expect(result.kros_total_czk).toBe(75000);         // 750 * 100
  });

  it('should set RFI when concrete volume is missing', () => {
    const position: Position = {
      position_id: '1',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'beton',
      qty: 0,            // Missing volume!
      crew_size: 10,
      shift_hours: 8,
      days: 5,
      wage_czk_ph: 200
    } as unknown as Position;

    const result = calculatePositionFields(position, [position]);

    expect(result.has_rfi).toBe(true);
    expect(result.rfi_message).toContain('Chybí objem betonu');
  });

  it('should set RFI when days is zero', () => {
    const position: Position = {
      position_id: '1',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'beton',
      qty: 100,
      crew_size: 10,
      shift_hours: 8,
      days: 0,           // Zero days!
      wage_czk_ph: 200
    } as unknown as Position;

    const result = calculatePositionFields(position, [position]);

    expect(result.has_rfi).toBe(true);
    expect(result.rfi_message).toContain('Chybí počet dní');
  });

  it('should support custom KROS rounding step', () => {
    const position: Position = {
      position_id: '1',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'beton',
      qty: 100,
      crew_size: 10,
      shift_hours: 8,
      days: 5,
      wage_czk_ph: 200
    } as unknown as Position;

    const result = calculatePositionFields(
      position,
      [position],
      { rounding_step_kros: 100 }
    );

    expect(result.kros_unit_czk).toBe(800);  // ceil(800/100)*100 = 800
  });
});

describe('calculateHeaderKPI', () => {
  const positions: Position[] = [
    {
      position_id: '1',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'beton',
      qty: 100,
      concrete_m3: 100,
      kros_total_czk: 80000,
      crew_size: 10,
      wage_czk_ph: 200,
      shift_hours: 8
    } as unknown as Position,
    {
      position_id: '2',
      bridge_id: 'SO-01',
      part_name: 'Opěra 1',
      subtype: 'bednění',
      qty: 200,
      concrete_m3: 100,
      kros_total_czk: 75000,
      crew_size: 5,
      wage_czk_ph: 180,
      shift_hours: 8
    } as unknown as Position
  ];

  it('should calculate complete KPI', () => {
    const kpi = calculateHeaderKPI(positions, {}, {});

    expect(kpi.sum_concrete_m3).toBe(100);
    expect(kpi.sum_kros_total_czk).toBe(155000);
    expect(kpi.project_unit_cost_czk_per_m3).toBe(1550);  // 155000 / 100
    expect(kpi.project_unit_cost_czk_per_t).toBeCloseTo(645.83, 2);  // 1550 / 2.4
  });

  it('should calculate duration with 22-day month mode', () => {
    const kpi = calculateHeaderKPI(
      positions,
      { days_per_month_mode: 22 },
      {}
    );

    expect(kpi.days_per_month_mode).toBe(22);
    expect(kpi.estimated_months).toBeGreaterThan(0);
    expect(kpi.estimated_weeks).toBeGreaterThan(0);
  });

  it('should calculate duration with 30-day month mode', () => {
    const kpi = calculateHeaderKPI(
      positions,
      { days_per_month_mode: 30 },
      {}
    );

    expect(kpi.days_per_month_mode).toBe(30);
    // 30-day mode should give longer duration in months (same days, more days/month)
  });

  it('should include bridge parameters', () => {
    const kpi = calculateHeaderKPI(
      positions,
      {
        span_length_m: 25,
        deck_width_m: 10.5,
        pd_weeks: 12
      },
      {}
    );

    expect(kpi.span_length_m).toBe(25);
    expect(kpi.deck_width_m).toBe(10.5);
    expect(kpi.pd_weeks).toBe(12);
  });

  it('should use custom concrete density', () => {
    const kpi = calculateHeaderKPI(
      positions,
      {},
      { rho_t_per_m3: 2.5 }
    );

    expect(kpi.rho_t_per_m3).toBe(2.5);
    expect(kpi.project_unit_cost_czk_per_t).toBe(kpi.project_unit_cost_czk_per_m3 / 2.5);
  });

  it('should handle empty positions', () => {
    const kpi = calculateHeaderKPI([], {}, {});

    expect(kpi.sum_concrete_m3).toBe(0);
    expect(kpi.sum_kros_total_czk).toBe(0);
    expect(kpi.project_unit_cost_czk_per_m3).toBe(0);
    expect(kpi.estimated_months).toBe(0);
  });
});

// ============================================================
// FORMWORK CALCULATOR TESTS
// ============================================================

describe('Formwork Calculator', () => {
  describe('calculateFormworkTacts', () => {
    it('should calculate number of tacts', () => {
      expect(calculateFormworkTacts(127.2, 31.8)).toBe(4);   // 127.2 / 31.8 = 4.0
      expect(calculateFormworkTacts(208.5, 41.7)).toBe(5);   // 208.5 / 41.7 = 5.0
    });

    it('should round up partial tacts', () => {
      expect(calculateFormworkTacts(100, 31.8)).toBe(4);     // 3.14 → 4
      expect(calculateFormworkTacts(50, 31.8)).toBe(2);      // 1.57 → 2
    });

    it('should handle zero set area', () => {
      expect(calculateFormworkTacts(127.2, 0)).toBe(1);
    });
  });

  describe('calculateFormworkTerm', () => {
    it('should calculate formwork term', () => {
      expect(calculateFormworkTerm(4, 3)).toBe(12);     // 4 tacts × 3 days
      expect(calculateFormworkTerm(5, 3)).toBe(15);     // 5 tacts × 3 days
    });
  });

  describe('calculateMonthlyRentalPerSet', () => {
    it('should calculate monthly rental for Základ OP', () => {
      // 31.8 m² × 507.20 Kč/m² = 16,128.96 Kč
      const rental = calculateMonthlyRentalPerSet(31.8, 507.20);
      expect(rental).toBeCloseTo(16128.96, 2);
    });

    it('should calculate monthly rental for Základ Pilířů', () => {
      // 41.7 m² × 454.40 Kč/m² = 18,948.48 Kč
      const rental = calculateMonthlyRentalPerSet(41.7, 454.40);
      expect(rental).toBeCloseTo(18948.48, 2);
    });
  });

  describe('calculateFinalRentalCost', () => {
    it('should calculate final rental for Základ OP (12 days)', () => {
      // 16,128.96 × (12 / 30) = 6,451.58
      const cost = calculateFinalRentalCost(16128.96, 12);
      expect(cost).toBeCloseTo(6451.58, 1);
    });

    it('should calculate final rental for Základ Pilířů (15 days)', () => {
      // 18,948.48 × (15 / 30) = 9,474.24
      const cost = calculateFinalRentalCost(18948.48, 15);
      expect(cost).toBeCloseTo(9474.24, 2);
    });

    it('should return 0 for zero days', () => {
      expect(calculateFinalRentalCost(16128.96, 0)).toBe(0);
    });
  });
});

describe('Element Total Days', () => {
  it('should use max(bednění, výztuž) for parallel work + beton + curing', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'Základ', subtype: 'bednění', days: 3, qty: 127 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'Základ', subtype: 'výztuž', days: 5, qty: 5800 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'Základ', subtype: 'beton', days: 2, curing_days: 5, qty: 45 } as unknown as Position,
    ];

    // max(3, 5) + 2 (beton) + 5 (curing) = 12  (bednění & výztuž parallel)
    expect(calculateElementTotalDays(positions)).toBe(12);
  });

  it('should use max curing_days when multiple beton positions', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 1, curing_days: 3, qty: 10 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 2, curing_days: 7, qty: 20 } as unknown as Position,
    ];

    // 1 + 2 (beton days) + 7 (max curing) = 10
    expect(calculateElementTotalDays(positions)).toBe(10);
  });

  it('should use default 3 curing days when curing_days not set', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'bednění', days: 4, qty: 100 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 2, qty: 50 } as unknown as Position,
    ];

    // 4 (bednění) + 2 (beton) + 3 (default curing) = 9
    expect(calculateElementTotalDays(positions)).toBe(9);
  });

  it('should use 0 curing when explicitly set to 0', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'bednění', days: 4, qty: 100 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 2, curing_days: 0, qty: 50 } as unknown as Position,
    ];

    // 4 (bednění) + 2 (beton) + 0 (explicit zero curing) = 6
    expect(calculateElementTotalDays(positions)).toBe(6);
  });

  it('should divide curing by num_sets from rental positions', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'bednění', days: 3, qty: 127 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'výztuž', days: 5, qty: 5800 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 2, curing_days: 6, qty: 45 } as unknown as Position,
      // Rental position with num_sets = 2 (stored as qty)
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'jiné', days: 12, qty: 2,
        metadata: JSON.stringify({ type: 'formwork_rental', calculator_id: 'calc-1' })
      } as unknown as Position,
    ];

    // max(3, 5) + 2 (beton) + 6/2 (curing÷sets) = 10
    expect(calculateElementTotalDays(positions)).toBe(10);
  });

  it('should divide curing by num_sets with object metadata', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 1, curing_days: 9, qty: 30 } as unknown as Position,
      // Rental position with num_sets = 3, object metadata
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'jiné', days: 10, qty: 3,
        metadata: { type: 'formwork_rental', calculator_id: 'calc-1' }
      } as unknown as Position,
    ];

    // 1 (beton) + 9/3 (curing÷3 sets) = 4
    expect(calculateElementTotalDays(positions)).toBe(4);
  });

  it('should return 0 for empty positions', () => {
    expect(calculateElementTotalDays([])).toBe(0);
  });

  // ── RCPSP Scheduler integration (num_tacts in metadata) ───────────

  it('should use RCPSP scheduler when num_tacts is in metadata (4 tacts, 2 sets)', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'bednění', days: 12, qty: 127 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'výztuž', days: 8, qty: 5800 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 4, curing_days: 5, qty: 45 } as unknown as Position,
      // Rental with num_tacts=4 → enables RCPSP scheduler
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'jiné', days: 12, qty: 2,
        metadata: { type: 'formwork_rental', calculator_id: 'calc-1', num_tacts: 4, stripping_days: 1, rebar_lag_pct: 50 }
      } as unknown as Position,
    ];

    const result = calculateElementTotalDays(positions);

    // Per tact: ASM=3, REB=2, CON=1, CUR=5, STR=1
    // With 2 sets, parallel work during curing → much less than sequential
    // Sequential: 4 × (3+2+1+5+1) = 48
    // Simple formula: max(12,8) + 4 + 5/2 = 18.5
    // RCPSP: properly models interleaving → should be < 48 but realistic
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(48); // less than sequential
  });

  it('should use RCPSP scheduler with 1 set (sequential)', () => {
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'bednění', days: 6, qty: 100 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 2, curing_days: 5, qty: 40 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'jiné', days: 10, qty: 1,
        metadata: JSON.stringify({ type: 'formwork_rental', num_tacts: 2, stripping_days: 1, rebar_lag_pct: 100 })
      } as unknown as Position,
    ];

    const result = calculateElementTotalDays(positions);

    // 1 set, 2 tacts, sequential rebar: per tact = 3+0+1+5+1=10, total=20
    expect(result).toBe(20);
  });

  it('should show significant savings with RCPSP scheduler vs sequential', () => {
    // Compare: with scheduler (2 sets) vs sequential equivalent
    const positionsScheduled: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'bednění', days: 12, qty: 127 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'výztuž', days: 8, qty: 5800 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 4, curing_days: 7, qty: 45 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'jiné', days: 12, qty: 2,
        metadata: { type: 'formwork_rental', calculator_id: 'calc-1', num_tacts: 4 }
      } as unknown as Position,
    ];

    const scheduled = calculateElementTotalDays(positionsScheduled);

    // Sequential baseline: 4 × (3+2+1+7+1) = 56
    // With 2 sets + RCPSP, significant savings
    expect(scheduled).toBeLessThan(56);
    expect(scheduled).toBeGreaterThan(10);
  });

  it('should fallback to simple formula when no num_tacts in metadata', () => {
    // Same positions but WITHOUT num_tacts → fallback
    const positions: Position[] = [
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'bednění', days: 3, qty: 127 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'výztuž', days: 5, qty: 5800 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'beton', days: 2, curing_days: 6, qty: 45 } as unknown as Position,
      { bridge_id: 'SO-01', part_name: 'X', subtype: 'jiné', days: 12, qty: 2,
        metadata: { type: 'formwork_rental', calculator_id: 'calc-1' }  // NO num_tacts
      } as unknown as Position,
    ];

    // Fallback: max(3, 5) + 2 + 6/2 = 10
    expect(calculateElementTotalDays(positions)).toBe(10);
  });
});

describe('generateFormworkKrosDescription', () => {
  it('should generate correct description', () => {
    const desc = generateFormworkKrosDescription({
      construction_name: 'Základ OP (sada: 1x základ / dilatace / LM)',
      system_name: 'Frami Xlife',
      system_height: 'h= 0,9 m',
      rental_czk_per_m2_month: 507.20,
      set_area_m2: 31.80,
      monthly_rental_per_set: 16128.96
    });

    expect(desc).toContain('Bednění - Základ OP');
    expect(desc).toContain('Frami Xlife');
    expect(desc).toContain('h= 0,9 m');
    expect(desc).toContain('Kč/m2');
    expect(desc).toContain('Kč/sada/měsíc');
  });
});
