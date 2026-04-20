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
      // v4.24 BUG A: zaklady_piliru default diameter D14 → slabs_foundations
      // matrix = 14.0 h/t (methvin.co). mass = 1t → 14 hours.
      expect(result.labor_hours).toBe(14);
      expect(result.norm_h_per_t).toBe(14.0);
      expect(result.norm_source).toBe('matrix');
      expect(result.norm_category).toBe('slabs_foundations');
      expect(result.norm_diameter_mm).toBe(14);
      // duration = 14 / (4 × 10 × 0.8) = 0.4375 → rounded 0.44 days
      expect(result.duration_days).toBeCloseTo(0.44, 2);
    });

    it('respects user-provided rebar_diameter_mm', () => {
      // operne_zdi (walls) D12 = 17.3 h/t (live VP4 case)
      const d12 = calculateRebarLite({
        element_type: 'operne_zdi',
        volume_m3: 94.231,
        mass_kg: 5654,
        rebar_diameter_mm: 12,
      });
      expect(d12.norm_h_per_t).toBe(17.3);
      expect(d12.norm_category).toBe('walls');
      expect(d12.norm_diameter_mm).toBe(12);
      // 5.654 t × 17.3 h/t = 97.8 hours (was ~254 with legacy 45 h/t).
      expect(d12.labor_hours).toBeCloseTo(97.8, 1);
    });

    it('falls back to legacy norm for unusual diameter (D18 not in matrix)', () => {
      const r = calculateRebarLite({
        element_type: 'operne_zdi',
        volume_m3: 10,
        mass_kg: 1000,
        rebar_diameter_mm: 18,
      });
      expect(r.norm_source).toBe('legacy');
      // Legacy per-element rate for operne_zdi = 45 h/t.
      expect(r.norm_h_per_t).toBe(45);
    });

    it('pile element always uses legacy rate (armokoš workflow not in matrix)', () => {
      const pile = calculateRebarLite({
        element_type: 'pilota',
        volume_m3: 20,
        mass_kg: 1000,
      });
      expect(pile.norm_source).toBe('legacy');
      // pilota profile rebar_norm_h_per_t (unchanged from pre-v4.24).
      expect(pile.labor_hours).toBe(pile.mass_t * pile.norm_h_per_t);
    });

    it('provides 3-point estimate', () => {
      const result = calculateRebarLite({
        element_type: 'mostovkova_deska',
        volume_m3: 100,
      });
      expect(result.optimistic_days).toBeLessThan(result.most_likely_days);
      expect(result.pessimistic_days).toBeGreaterThan(result.most_likely_days);
    });

    it('uses diameter-aware norm (v4.24 matrix)', () => {
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
      // v4.24: foundation default D14 (slabs_foundations) = 14.0 h/t,
      // pier default D25 (beams_columns) = 9.2 h/t. Thicker bars in
      // pier → fewer pieces per tonne → less tying time per tonne.
      expect(foundation.norm_h_per_t).toBe(14.0);
      expect(pier.norm_h_per_t).toBe(9.2);
      expect(foundation.duration_days).toBeGreaterThan(pier.duration_days);
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
      // v4.24: zaklady_piliru D14 (slabs_foundations) = 14 h/t.
      // 1t × 14 = 14 labor hours. Target 2 days, shift 10h, k=0.8.
      // Needed: 14 / (2 × 10 × 0.8) = 0.875 → ceil = 1, min floor = 2.
      const crew = crewForTargetDays('zaklady_piliru', 10, 2, 1000, 10, 0.8);
      expect(crew).toBe(2);
    });

    it('returns minimum 2 crew', () => {
      const crew = crewForTargetDays('zaklady_piliru', 1, 100, 100);
      expect(crew).toBeGreaterThanOrEqual(2);
    });

    it('uses estimated mass when not given', () => {
      // v4.24: 50m³ × 120 kg/m³ = 6000kg = 6t → 6×14=84 hours.
      // Target 5 days: 84/(5×10×0.8)=2.1 → ceil = 3.
      const crew = crewForTargetDays('zaklady_piliru', 50, 5);
      expect(crew).toBe(3);
    });
  });
});
