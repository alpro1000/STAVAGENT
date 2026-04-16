/**
 * Pile Engine — unit tests
 *
 * Coverage:
 *   1. Productivity table lookup (catalog + interpolation + clamping)
 *   2. Volume helpers (single pile, count derivation)
 *   3. calculatePileDrilling — defaults, schedule arithmetic, costs
 *   4. Optional pile cap (hlavice) adds days + labor
 *   5. Two acceptance scenarios from the task spec:
 *      - Test 1: Mostní piloty SO-202 (Ø900 × 12m × 16, pod HPV, hlavice)
 *      - Test 2: Pozemní piloty (Ø600 × 8m × 42, CFA soudržná, no cap)
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePileDrilling,
  calculatePileVolume,
  derivePileCount,
  getPileProductivity,
  getHeadsPerShift,
} from './pile-engine.js';
import { planElement } from './planner-orchestrator.js';

describe('Pile Engine', () => {
  // ─── Productivity table ───────────────────────────────────────────────
  describe('getPileProductivity', () => {
    it('returns catalog mid-range for Ø600 CFA cohesive', () => {
      // Spec: Ø600 CFA soudržná = 5–8 → mid 6.5
      expect(getPileProductivity(600, 'cohesive', 'cfa')).toBe(6.5);
    });

    it('returns catalog mid-range for Ø900 cased below_gwt', () => {
      // Spec: Ø900 cased pod HPV = 1–2 → mid 1.5
      expect(getPileProductivity(900, 'below_gwt', 'cased')).toBe(1.5);
    });

    it('returns catalog mid-range for Ø1500 rock', () => {
      // Spec: Ø1500 rock = 0.3–0.5 → 0.4
      expect(getPileProductivity(1500, 'rock', 'cfa')).toBe(0.4);
    });

    it('CFA is faster than cased for same diameter+geology', () => {
      const cfa = getPileProductivity(600, 'cohesive', 'cfa');
      const cased = getPileProductivity(600, 'cohesive', 'cased');
      expect(cfa).toBeGreaterThan(cased);
    });

    it('cohesive geology is faster than below_gwt', () => {
      const cohesive = getPileProductivity(900, 'cohesive', 'cased');
      const belowGwt = getPileProductivity(900, 'below_gwt', 'cased');
      expect(cohesive).toBeGreaterThan(belowGwt);
    });

    it('rock is the slowest geology for same diameter', () => {
      const cohesive = getPileProductivity(1200, 'cohesive', 'cfa');
      const rock = getPileProductivity(1200, 'rock', 'cfa');
      expect(rock).toBeLessThan(cohesive);
    });

    it('larger diameter = lower productivity', () => {
      const small = getPileProductivity(600, 'cohesive', 'cfa');
      const medium = getPileProductivity(900, 'cohesive', 'cfa');
      const large = getPileProductivity(1500, 'cohesive', 'cfa');
      expect(small).toBeGreaterThan(medium);
      expect(medium).toBeGreaterThan(large);
    });

    it('clamps below catalog minimum (Ø400 → uses Ø600 row)', () => {
      const ø400 = getPileProductivity(400, 'cohesive', 'cfa');
      const ø600 = getPileProductivity(600, 'cohesive', 'cfa');
      expect(ø400).toBe(ø600);
    });

    it('clamps above catalog maximum (Ø1800 → uses Ø1500 row)', () => {
      const ø1800 = getPileProductivity(1800, 'cohesive', 'cfa');
      const ø1500 = getPileProductivity(1500, 'cohesive', 'cfa');
      expect(ø1800).toBe(ø1500);
    });

    it('interpolates Ø750 between Ø600 and Ø900 catalog rows', () => {
      const ø750 = getPileProductivity(750, 'cohesive', 'cfa');
      const ø600 = getPileProductivity(600, 'cohesive', 'cfa');
      const ø900 = getPileProductivity(900, 'cohesive', 'cfa');
      // Ø750 falls between Ø600 (6.5) and Ø900 (4.0)
      expect(ø750).toBeLessThan(ø600);
      expect(ø750).toBeGreaterThan(ø900);
    });
  });

  // ─── Volume helpers ───────────────────────────────────────────────────
  describe('calculatePileVolume', () => {
    it('Ø600 × 10m = π × 0.3² × 10 ≈ 2.83 m³', () => {
      const v = calculatePileVolume(600, 10);
      expect(v).toBeCloseTo(2.827, 2);
    });

    it('Ø900 × 12m = π × 0.45² × 12 ≈ 7.63 m³', () => {
      const v = calculatePileVolume(900, 12);
      expect(v).toBeCloseTo(7.634, 2);
    });

    it('Ø1500 × 25m = π × 0.75² × 25 ≈ 44.18 m³', () => {
      const v = calculatePileVolume(1500, 25);
      expect(v).toBeCloseTo(44.18, 1);
    });
  });

  describe('derivePileCount', () => {
    it('30 m³ ÷ 2.83 m³/pilota (Ø600 × 10m) ≈ 11', () => {
      expect(derivePileCount(30, 600, 10)).toBe(11);
    });

    it('122 m³ ÷ 7.63 m³/pilota (Ø900 × 12m) ≈ 16', () => {
      expect(derivePileCount(122, 900, 12)).toBe(16);
    });

    it('returns at least 1 for tiny volumes', () => {
      expect(derivePileCount(0.5, 1500, 30)).toBe(1);
    });
  });

  // ─── calculatePileDrilling ────────────────────────────────────────────
  describe('calculatePileDrilling — defaults', () => {
    it('uses Ø600 / 10m / cohesive / cfa when nothing given', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      expect(r.diameter_mm).toBe(600);
      expect(r.length_m).toBe(10);
      expect(r.geology).toBe('cohesive');
      expect(r.casing_method).toBe('cfa');
      expect(r.rebar_index_kg_m3).toBe(40);
    });

    it('derives count from volume when not given', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      expect(r.count).toBe(11); // 30 ÷ 2.83
    });

    it('respects explicit count over derived', () => {
      const r = calculatePileDrilling({ volume_m3: 30, count: 5 });
      expect(r.count).toBe(5);
    });

    it('produces positive total_days', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      expect(r.total_days).toBeGreaterThan(0);
    });

    it('schedule = drilling + 7d pause + head adjustment (no cap)', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      expect(r.total_days).toBe(r.drilling_days + 7 + r.head_adjustment_days);
      expect(r.technological_pause_days).toBe(7);
      expect(r.pile_cap_days).toBeUndefined();
    });

    it('rebar mass = design total × rebar_index_kg_m3 (overpouring has no cage)', () => {
      // BUG-P2: volume_m3 is interpreted as DESIGN volume, so 100 × 50 = 5000.
      const r = calculatePileDrilling({ volume_m3: 100, rebar_index_kg_m3: 50 });
      expect(r.rebar_total_kg).toBe(5000);
    });

    it('costs.total_labor_czk = drilling_rig + crane + crew + head_adj + integrity', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      const sum =
        r.costs.drilling_rig_czk +
        r.costs.crane_czk +
        r.costs.crew_labor_czk +
        r.costs.head_adjustment_labor_czk +
        r.costs.pile_cap_labor_czk +
        r.costs.integrity_tests_czk;
      expect(r.costs.total_labor_czk).toBe(sum);
    });

    it('emits a Czech traceability log with at least 5 lines', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      expect(r.log.length).toBeGreaterThanOrEqual(5);
      expect(r.log.some(l => l.includes('Pilota'))).toBe(true);
      expect(r.log.some(l => l.includes('Produktivita'))).toBe(true);
    });
  });

  // ─── Optional pile cap ────────────────────────────────────────────────
  describe('calculatePileDrilling — with hlavice', () => {
    it('adds pile_cap_days to total_days when cap is given', () => {
      const noCap = calculatePileDrilling({ volume_m3: 30 });
      const withCap = calculatePileDrilling({
        volume_m3: 30,
        pile_cap: { length_m: 1.2, width_m: 1.2, height_m: 0.6 },
      });
      expect(withCap.pile_cap_days).toBeDefined();
      expect(withCap.pile_cap_days!).toBeGreaterThan(0);
      expect(withCap.total_days).toBeGreaterThan(noCap.total_days);
    });

    it('cap labor cost is non-zero', () => {
      const r = calculatePileDrilling({
        volume_m3: 30,
        pile_cap: { length_m: 1.5, width_m: 1.5, height_m: 0.8 },
      });
      expect(r.costs.pile_cap_labor_czk).toBeGreaterThan(0);
      expect(r.costs.total_labor_czk).toBeGreaterThan(r.costs.pile_cap_labor_czk);
    });

    it('omits pile_cap_days when cap is not given', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      expect(r.pile_cap_days).toBeUndefined();
      expect(r.costs.pile_cap_labor_czk).toBe(0);
    });
  });

  // ─── Acceptance scenarios from task spec ──────────────────────────────
  describe('Acceptance scenario 1: Mostní piloty SO-202 (D6 Karlovy Vary)', () => {
    // Ø900 × 12m × 16 piloty, s pažnicí pod HPV, hlavice 1.5×1.5×0.8m
    // Spec expectations:
    //   Volume 1 piloty: π × 0.45² × 12 ≈ 7.63 m³
    //   Volume celkem: ~122 m³
    //   Productivity: ~1.5 pilot/směna (Ø900, cased, below_gwt → mid of 1–2)
    //   Drilling: ceil(16 / 1.5) = 11 dní
    //   Head:     ceil(16 / 3)   = 6 dní
    //   Total:    11 + 7 + 6 + cap ≈ 24+ dní
    const r = calculatePileDrilling({
      diameter_mm: 900,
      length_m: 12,
      count: 16,
      volume_m3: 122,
      geology: 'below_gwt',
      casing_method: 'cased',
      concrete_class: 'C30/37',
      pile_cap: { length_m: 1.5, width_m: 1.5, height_m: 0.8 },
    });

    it('volume per pile ≈ 7.63 m³ (design)', () => {
      expect(r.volume_per_pile_m3).toBeCloseTo(7.63, 1);
    });

    it('total volume includes +0.5m overpouring loss (122 m³ design → ~127 m³ odlité)', () => {
      // BUG-P2: 16 × π × 0.45² × 0.5 ≈ 5.09 m³ extra → 122 + 5.1 ≈ 127.1.
      expect(r.overpouring_loss_m3).toBeCloseTo(5.1, 1);
      expect(r.total_volume_m3).toBeCloseTo(127.1, 1);
    });

    it('productivity for Ø900 cased below_gwt = 1.5 pilot/shift', () => {
      expect(r.productivity_pile_per_shift).toBe(1.5);
    });

    it('drilling days = ceil(16 / 1.5) = 11', () => {
      expect(r.drilling_days).toBe(11);
    });

    it('head adjustment days: Ø900 → 3 hlav/směna → ceil(16/3) = 6', () => {
      // BUG-P3: heads_per_shift now depends on diameter. Ø900 = 3.
      expect(r.heads_per_shift_used).toBe(3);
      expect(r.head_adjustment_days).toBe(6);
    });

    it('schedule includes drilling + 7d pause + head + cap', () => {
      const expected = 11 + 7 + 6 + (r.pile_cap_days ?? 0);
      expect(r.total_days).toBe(expected);
      // Total ≥ 24 (drilling 11 + pause 7 + head 6) and the cap adds at
      // least 1 day of work + 7 days of curing.
      expect(r.total_days).toBeGreaterThanOrEqual(24);
    });

    // BUG 3: Ø900 now defaults to 90 kg/m³ (was 40) — mostní piloty
    it('rebar mass = 122 × 90 = 10980 kg (design volume, Ø900 bridge default)', () => {
      expect(r.rebar_total_kg).toBe(10980);
    });

    it('concrete_class echoed in result', () => {
      expect(r.concrete_class).toBe('C30/37');
    });
  });

  describe('Acceptance scenario 2: Pozemní piloty (bytový dům)', () => {
    // Ø600 × 8m × 42, CFA soudržná, no cap
    // Spec expectations (post BUG-P3 fix):
    //   Volume 1 piloty: π × 0.3² × 8 ≈ 2.26 m³
    //   Volume celkem (design): ~95 m³
    //   Productivity: ~6.5 pilot/směna (Ø600 CFA cohesive)
    //   Drilling: ceil(42 / 6.5) = 7 dní
    //   Head:     ceil(42 / 5)   = 9 dní (Ø600 = 5 hlav/směna)
    //   Total:    7 + 7 + 9 = 23 dní
    const r = calculatePileDrilling({
      diameter_mm: 600,
      length_m: 8,
      count: 42,
      volume_m3: 95,
      geology: 'cohesive',
      casing_method: 'cfa',
    });

    it('volume per pile ≈ 2.26 m³', () => {
      expect(r.volume_per_pile_m3).toBeCloseTo(2.26, 1);
    });

    it('productivity for Ø600 CFA cohesive = 6.5 pilot/shift', () => {
      expect(r.productivity_pile_per_shift).toBe(6.5);
    });

    it('drilling days = ceil(42 / 6.5) = 7', () => {
      expect(r.drilling_days).toBe(7);
    });

    it('head adjustment days: Ø600 → 5 hlav/směna → ceil(42/5) = 9', () => {
      // BUG-P3: Ø600 is fast to chip → 5 hlav/směna, not the old hardcoded 3.
      expect(r.heads_per_shift_used).toBe(5);
      expect(r.head_adjustment_days).toBe(9);
    });

    it('total schedule = 7 + 7 + 9 = 23 dní', () => {
      expect(r.total_days).toBe(23);
    });

    it('no pile cap → pile_cap_days undefined', () => {
      expect(r.pile_cap_days).toBeUndefined();
    });
  });

  // ─── BUG-P2 / P3 / P4 regression ─────────────────────────────────────
  describe('BUG-P2 overpouring', () => {
    it('default 0.5 m adds loss proportional to diameter²', () => {
      // Ø600 × 8m × 42, overpouring 0.5 m
      // extra = 42 × π × 0.3² × 0.5 ≈ 5.94 m³
      const r = calculatePileDrilling({
        diameter_mm: 600, length_m: 8, count: 42,
        volume_m3: 95, geology: 'cohesive', casing_method: 'cfa',
      });
      expect(r.overpouring_m).toBe(0.5);
      expect(r.overpouring_loss_m3).toBeCloseTo(5.94, 1);
      expect(r.total_volume_m3).toBeCloseTo(100.9, 1);
    });

    it('overpouring_m=0 disables loss', () => {
      const r = calculatePileDrilling({
        diameter_mm: 600, length_m: 8, count: 42,
        volume_m3: 95, overpouring_m: 0,
      });
      expect(r.overpouring_loss_m3).toBe(0);
      expect(r.total_volume_m3).toBe(95);
    });

    it('overpouring_m=1.0 doubles the loss', () => {
      const small = calculatePileDrilling({
        diameter_mm: 600, length_m: 8, count: 42, volume_m3: 95, overpouring_m: 0.5,
      });
      const big = calculatePileDrilling({
        diameter_mm: 600, length_m: 8, count: 42, volume_m3: 95, overpouring_m: 1.0,
      });
      expect(big.overpouring_loss_m3).toBeCloseTo(small.overpouring_loss_m3 * 2, 1);
    });
  });

  describe('BUG-P3 getHeadsPerShift', () => {
    it('Ø600 = 5 hlav/směna', () => {
      expect(getHeadsPerShift(600)).toBe(5);
    });
    it('Ø900 = 3 hlav/směna', () => {
      expect(getHeadsPerShift(900)).toBe(3);
    });
    it('Ø1200 = 2 hlav/směna', () => {
      expect(getHeadsPerShift(1200)).toBe(2);
    });
    it('Ø1500 = 1.5 hlav/směna', () => {
      expect(getHeadsPerShift(1500)).toBe(1.5);
    });
    it('Ø750 interpolated between Ø600 (5) and Ø900 (3) → 4', () => {
      expect(getHeadsPerShift(750)).toBe(4);
    });
    it('Ø400 clamped to Ø600 row', () => {
      expect(getHeadsPerShift(400)).toBe(5);
    });
    it('Ø1800 clamped to Ø1500 row', () => {
      expect(getHeadsPerShift(1800)).toBe(1.5);
    });
  });

  describe('BUG-P4 integrity tests (CHA/PIT)', () => {
    it('no counts → integrity_tests undefined, cost 0', () => {
      const r = calculatePileDrilling({ volume_m3: 30 });
      expect(r.integrity_tests).toBeUndefined();
      expect(r.costs.integrity_tests_czk).toBe(0);
    });

    it('16× CHA @ 40k + 108× PIT @ 5k = 1 180 000 Kč (SO-202)', () => {
      const r = calculatePileDrilling({
        diameter_mm: 900, length_m: 12, count: 124, volume_m3: 946,
        geology: 'below_gwt', casing_method: 'cased',
        cha_test_count: 16, pit_test_count: 108,
      });
      expect(r.integrity_tests).toBeDefined();
      expect(r.integrity_tests!.cha_count).toBe(16);
      expect(r.integrity_tests!.pit_count).toBe(108);
      expect(r.integrity_tests!.cha_czk).toBe(16 * 40_000);
      expect(r.integrity_tests!.pit_czk).toBe(108 * 5_000);
      expect(r.integrity_tests!.total_czk).toBe(16 * 40_000 + 108 * 5_000);
      expect(r.costs.integrity_tests_czk).toBe(r.integrity_tests!.total_czk);
    });

    it('custom price overrides default', () => {
      const r = calculatePileDrilling({
        volume_m3: 30, cha_test_count: 2, cha_test_czk: 50_000,
      });
      expect(r.integrity_tests!.cha_czk).toBe(100_000);
    });
  });

  // ─── Orchestrator integration: planElement routes piles correctly ────
  describe('planElement pile branch', () => {
    it('returns a PlannerOutput with plan.pile populated', () => {
      const plan = planElement({
        element_type: 'pilota',
        volume_m3: 30,
        has_dilatacni_spary: false,
        concrete_class: 'C25/30',
      });
      expect(plan.pile).toBeDefined();
      expect(plan.pile!.diameter_mm).toBe(600);
      expect(plan.pile!.total_days).toBeGreaterThan(0);
    });

    it('does NOT populate lateral_pressure for piles', () => {
      const plan = planElement({
        element_type: 'pilota',
        volume_m3: 30,
        has_dilatacni_spary: false,
        concrete_class: 'C25/30',
      });
      expect(plan.lateral_pressure).toBeUndefined();
    });

    it('does NOT populate props for piles', () => {
      const plan = planElement({
        element_type: 'pilota',
        volume_m3: 30,
        has_dilatacni_spary: false,
        concrete_class: 'C25/30',
      });
      expect(plan.props).toBeUndefined();
    });

    it('formwork.assembly_days = 0 for piles (no formwork work)', () => {
      const plan = planElement({
        element_type: 'pilota',
        volume_m3: 30,
        has_dilatacni_spary: false,
        concrete_class: 'C25/30',
      });
      expect(plan.formwork.assembly_days).toBe(0);
      expect(plan.formwork.disassembly_days).toBe(0);
      expect(plan.formwork.three_phase.total_cost_labor).toBe(0);
    });

    it('pour_decision.num_tacts = 1 always for piles', () => {
      const plan = planElement({
        element_type: 'pilota',
        volume_m3: 100,
        pile_count: 24,
        pile_diameter_mm: 900,
        pile_length_m: 12,
        has_dilatacni_spary: false,
        concrete_class: 'C30/37',
      });
      expect(plan.pour_decision.num_tacts).toBe(1);
    });

    it('schedule.total_days matches pile.total_days', () => {
      const plan = planElement({
        element_type: 'pilota',
        volume_m3: 95,
        pile_count: 42,
        pile_diameter_mm: 600,
        pile_length_m: 8,
        pile_geology: 'cohesive',
        pile_casing_method: 'cfa',
        has_dilatacni_spary: false,
        concrete_class: 'C25/30',
      });
      expect(plan.schedule.total_days).toBe(plan.pile!.total_days);
      // Post BUG-P3: Ø600 heads=5 → ceil(42/5)=9 days. Total 7+7+9=23.
      expect(plan.schedule.total_days).toBe(23);
    });

    it('plan.pile is undefined for non-pile elements', () => {
      const plan = planElement({
        element_type: 'stena',
        volume_m3: 50,
        height_m: 3.0,
        has_dilatacni_spary: false,
        concrete_class: 'C25/30',
      });
      expect(plan.pile).toBeUndefined();
    });

    it('forwards pile_cap fields to the engine', () => {
      const plan = planElement({
        element_type: 'pilota',
        volume_m3: 122,
        pile_count: 16,
        pile_diameter_mm: 900,
        pile_length_m: 12,
        pile_geology: 'below_gwt',
        pile_casing_method: 'cased',
        has_pile_cap: true,
        pile_cap_length_m: 1.5,
        pile_cap_width_m: 1.5,
        pile_cap_height_m: 0.8,
        has_dilatacni_spary: false,
        concrete_class: 'C30/37',
      });
      expect(plan.pile!.pile_cap_days).toBeDefined();
      expect(plan.pile!.pile_cap_days!).toBeGreaterThan(0);
    });
  });
});
