/**
 * Rebar Lite Engine Tests
 */
import { describe, it, expect } from 'vitest';
import { calculateRebarLite, crewForTargetDays } from './rebar-lite.js';

describe('Rebar Lite Engine', () => {
  describe('calculateRebarLite', () => {
    it('estimates mass from element type when not given', () => {
      const result = calculateRebarLite({
        element_type: 'zaklady_piliru',
        volume_m3: 50,
      });
      // BUG 4: zaklady_piliru rebar raised 100→120 kg/m³
      expect(result.mass_kg).toBe(6000);
      expect(result.mass_t).toBe(6);
      expect(result.mass_source).toBe('estimated');
      expect(result.mass_range_kg).toEqual([5000, 7500]);
    });

    it('uses given mass when provided', () => {
      const result = calculateRebarLite({
        element_type: 'zaklady_piliru',
        volume_m3: 50,
        mass_kg: 3000,
      });
      expect(result.mass_kg).toBe(3000);
      expect(result.mass_t).toBe(3);
      expect(result.mass_source).toBe('user');
      expect(result.mass_range_kg).toBeUndefined();
    });

    it('calculates labor hours correctly', () => {
      const result = calculateRebarLite({
        element_type: 'zaklady_piliru',
        volume_m3: 10,
        mass_kg: 1000, // 1 t
        crew_size: 4,
        shift_h: 10,
        k: 0.8,
      });
      // norm = 40 h/t, mass = 1t → 40 hours
      expect(result.labor_hours).toBe(40);
      // duration = 40 / (4 × 10 × 0.8) = 1.25 days
      expect(result.duration_days).toBe(1.25);
    });

    it('provides 3-point estimate', () => {
      const result = calculateRebarLite({
        element_type: 'mostovkova_deska',
        volume_m3: 100,
      });
      expect(result.optimistic_days).toBeLessThan(result.most_likely_days);
      expect(result.pessimistic_days).toBeGreaterThan(result.most_likely_days);
    });

    it('uses element-specific labor norm', () => {
      const foundation = calculateRebarLite({
        element_type: 'zaklady_piliru',
        volume_m3: 10,
        mass_kg: 1000,
      });
      const pier = calculateRebarLite({
        element_type: 'driky_piliru',
        volume_m3: 10,
        mass_kg: 1000,
      });
      // Pier has higher norm (55 vs 40) → longer duration
      expect(pier.duration_days).toBeGreaterThan(foundation.duration_days);
      expect(pier.norm_h_per_t).toBe(55);
      expect(foundation.norm_h_per_t).toBe(40);
    });

    it('recommends crew based on labor', () => {
      const result = calculateRebarLite({
        element_type: 'mostovkova_deska',
        volume_m3: 200, // 200 × 150 = 30000 kg = 30t → 1500 hours
      });
      expect(result.recommended_crew).toBeGreaterThanOrEqual(2);
      expect(result.recommended_crew).toBeLessThanOrEqual(8);
    });

    it('has correct confidence for estimated mass', () => {
      const est = calculateRebarLite({ element_type: 'zaklady_piliru', volume_m3: 50 });
      expect(est.confidence).toBe(0.7);

      const user = calculateRebarLite({ element_type: 'zaklady_piliru', volume_m3: 50, mass_kg: 5000 });
      expect(user.confidence).toBe(0.95);
    });
  });

  describe('crewForTargetDays', () => {
    it('calculates crew needed for target', () => {
      // 1t at 40h/t = 40 labor hours. Target 2 days, shift 10h, k=0.8
      // Needed: 40 / (2 × 10 × 0.8) = 2.5 → ceil = 3
      const crew = crewForTargetDays('zaklady_piliru', 10, 2, 1000, 10, 0.8);
      expect(crew).toBe(3);
    });

    it('returns minimum 2 crew', () => {
      const crew = crewForTargetDays('zaklady_piliru', 1, 100, 100);
      expect(crew).toBeGreaterThanOrEqual(2);
    });

    it('uses estimated mass when not given', () => {
      // BUG 4: 50m³ × 120 kg/m³ = 6000kg = 6t → 6×40=240h
      // Target 5 days: 240/(5×10×0.8)=6 crew
      const crew = crewForTargetDays('zaklady_piliru', 50, 5);
      expect(crew).toBe(6);
    });
  });
});
