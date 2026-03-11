/**
 * Concrete Maturity & Curing Model Tests
 */
import { describe, it, expect } from 'vitest';
import {
  calculateCuring,
  getStripWaitHours,
  calculateMaturityIndex,
  curingThreePoint,
  CZ_MONTHLY_TEMPS,
  type ConcreteClass,
} from './maturity';

describe('Concrete Maturity & Curing Model', () => {
  // ─── calculateCuring ──────────────────────────────────────────

  describe('calculateCuring', () => {
    it('should return ~2 days for C30/37 at 20°C slab', () => {
      const result = calculateCuring({
        concrete_class: 'C30/37',
        temperature_c: 20,
        element_type: 'slab',
      });
      // C30+ at 15-25°C → 1.5 base days, CEM I factor 1.0, slab factor 1.0 → rounds to 1.5
      expect(result.min_curing_days).toBeGreaterThanOrEqual(1);
      expect(result.min_curing_days).toBeLessThanOrEqual(3);
      expect(result.warning).toBeNull();
    });

    it('should return longer for C20/25 at 5°C', () => {
      const result = calculateCuring({
        concrete_class: 'C20/25',
        temperature_c: 5,
        element_type: 'slab',
      });
      // C20-C25 at 5-10°C → 4 days base
      expect(result.min_curing_days).toBeGreaterThanOrEqual(3);
      expect(result.min_curing_days).toBeLessThanOrEqual(6);
    });

    it('should return shorter for wall (vertical) vs slab', () => {
      const slab = calculateCuring({
        concrete_class: 'C25/30',
        temperature_c: 15,
        element_type: 'slab',
      });
      const wall = calculateCuring({
        concrete_class: 'C25/30',
        temperature_c: 15,
        element_type: 'wall',
      });
      expect(wall.min_curing_days).toBeLessThan(slab.min_curing_days);
    });

    it('should return longer for CEM_III vs CEM_I', () => {
      const cemI = calculateCuring({
        concrete_class: 'C30/37',
        temperature_c: 20,
        cement_type: 'CEM_I',
      });
      const cemIII = calculateCuring({
        concrete_class: 'C30/37',
        temperature_c: 20,
        cement_type: 'CEM_III',
      });
      expect(cemIII.min_curing_days).toBeGreaterThan(cemI.min_curing_days);
    });

    it('should return Infinity for T < -10°C', () => {
      const result = calculateCuring({
        concrete_class: 'C30/37',
        temperature_c: -15,
      });
      expect(result.min_curing_days).toBe(Infinity);
      expect(result.warning).toContain('-10°C');
    });

    it('should warn at low temperature', () => {
      const result = calculateCuring({
        concrete_class: 'C25/30',
        temperature_c: 3,
      });
      expect(result.warning).toContain('Low temperature');
    });

    it('should warn at high temperature', () => {
      const result = calculateCuring({
        concrete_class: 'C25/30',
        temperature_c: 38,
      });
      expect(result.warning).toContain('High temperature');
    });

    it('should increase curing for higher strip strength requirement', () => {
      const normal = calculateCuring({
        concrete_class: 'C30/37',
        temperature_c: 20,
        element_type: 'slab',
      });
      const high = calculateCuring({
        concrete_class: 'C30/37',
        temperature_c: 20,
        element_type: 'slab',
        strip_strength_pct: 90,
      });
      expect(high.min_curing_days).toBeGreaterThanOrEqual(normal.min_curing_days);
    });

    it('should compute maturity index', () => {
      const result = calculateCuring({
        concrete_class: 'C25/30',
        temperature_c: 20,
      });
      // M = (20 - (-10)) × hours = 30 × hours
      expect(result.maturity_index).toBeGreaterThan(0);
    });
  });

  // ─── getStripWaitHours ────────────────────────────────────────

  describe('getStripWaitHours', () => {
    it('should return hours for formwork calculator integration', () => {
      const hours = getStripWaitHours('C30/37', 20, 'slab');
      expect(hours).toBeGreaterThan(0);
      expect(hours % 12).toBe(0); // Should be multiple of 12 (0.5-day granularity × 24)
    });

    it('should decrease with higher temperature', () => {
      const cold = getStripWaitHours('C25/30', 5);
      const warm = getStripWaitHours('C25/30', 20);
      expect(warm).toBeLessThan(cold);
    });

    it('should decrease with higher concrete class', () => {
      const low = getStripWaitHours('C16/20', 15);
      const high = getStripWaitHours('C40/50', 15);
      expect(high).toBeLessThanOrEqual(low);
    });
  });

  // ─── calculateMaturityIndex ───────────────────────────────────

  describe('calculateMaturityIndex', () => {
    it('should compute M = Σ(T - T_datum) × Δt', () => {
      // Constant 20°C for 48 hours
      const M = calculateMaturityIndex([
        { temp_c: 20, hours: 48 },
      ]);
      // M = (20 - (-10)) × 48 = 30 × 48 = 1440
      expect(M).toBe(1440);
    });

    it('should handle varying temperatures', () => {
      const M = calculateMaturityIndex([
        { temp_c: 10, hours: 24 },  // (10+10) × 24 = 480
        { temp_c: 20, hours: 24 },  // (20+10) × 24 = 720
      ]);
      expect(M).toBe(1200);
    });

    it('should clamp negative contribution to 0', () => {
      const M = calculateMaturityIndex([
        { temp_c: -15, hours: 24 },  // T < T_datum → 0 contribution
        { temp_c: 20, hours: 24 },   // 720
      ]);
      expect(M).toBe(720);
    });
  });

  // ─── curingThreePoint ─────────────────────────────────────────

  describe('curingThreePoint', () => {
    it('should return optimistic < most_likely < pessimistic', () => {
      const tp = curingThreePoint('C30/37', 'slab', 15);
      expect(tp.optimistic_hours).toBeLessThanOrEqual(tp.most_likely_hours);
      expect(tp.most_likely_hours).toBeLessThanOrEqual(tp.pessimistic_hours);
    });

    it('should give wider range for shoulder months', () => {
      // March: avg 5°C, pessimistic could go to -3°C
      const march = curingThreePoint('C25/30', 'slab', 5);
      // July: avg 20°C, pessimistic goes to 12°C (still warm)
      const july = curingThreePoint('C25/30', 'slab', 20);

      const marchRange = march.pessimistic_hours - march.optimistic_hours;
      const julyRange = july.pessimistic_hours - july.optimistic_hours;
      // Cold months should have wider range due to nonlinear curing curve
      expect(marchRange).toBeGreaterThanOrEqual(julyRange);
    });
  });

  // ─── CZ Monthly Temps ─────────────────────────────────────────

  describe('CZ_MONTHLY_TEMPS', () => {
    it('should have 12 months', () => {
      expect(Object.keys(CZ_MONTHLY_TEMPS)).toHaveLength(12);
    });

    it('should have coldest in January, warmest in July', () => {
      expect(CZ_MONTHLY_TEMPS[1]).toBeLessThan(CZ_MONTHLY_TEMPS[7]);
      expect(CZ_MONTHLY_TEMPS[7]).toBeGreaterThanOrEqual(CZ_MONTHLY_TEMPS[6]);
    });
  });

  // ─── Integration: curing across all concrete classes ──────────

  describe('Integration: all concrete classes', () => {
    const classes: ConcreteClass[] = [
      'C12/15', 'C16/20', 'C20/25', 'C25/30',
      'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60',
    ];

    it('higher class = shorter or equal curing at same temperature', () => {
      for (let i = 0; i < classes.length - 1; i++) {
        const lower = getStripWaitHours(classes[i], 15, 'slab');
        const higher = getStripWaitHours(classes[i + 1], 15, 'slab');
        expect(higher).toBeLessThanOrEqual(lower);
      }
    });

    it('all classes produce finite results at 15°C', () => {
      for (const cls of classes) {
        const result = calculateCuring({ concrete_class: cls, temperature_c: 15 });
        expect(result.min_curing_days).toBeGreaterThan(0);
        expect(result.min_curing_days).toBeLessThan(20);
      }
    });
  });
});
