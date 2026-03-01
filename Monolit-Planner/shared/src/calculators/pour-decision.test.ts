/**
 * Pour Decision Tree Tests
 *
 * Tests for decidePourMode() covering:
 * - Sectional mode (with spáry)
 * - Monolithic mode (without spáry)
 * - Chess scheduling
 * - Multi-pump
 * - Mega pour
 * - T-window by season/retarder
 * - Element defaults
 */

import { describe, it, expect } from 'vitest';
import {
  decidePourMode,
  T_WINDOW_HOURS,
  ELEMENT_DEFAULTS,
  type PourDecisionInput,
} from './pour-decision';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<PourDecisionInput> = {}): PourDecisionInput {
  return {
    element_type: 'rimsa',
    volume_m3: 100,
    has_dilatacni_spary: true,
    spara_spacing_m: 5,
    total_length_m: 30,
    adjacent_sections: true,
    q_eff_m3_h: 30,
    setup_hours: 0.5,
    washout_hours: 0.5,
    season: 'normal',
    use_retarder: false,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Pour Decision Tree v2.0', () => {

  // ────────────────────────────────────────────────────────────────────────
  // T-Window lookup
  // ────────────────────────────────────────────────────────────────────────

  describe('T-Window lookup', () => {
    it('should have correct t_window values', () => {
      expect(T_WINDOW_HOURS.hot.no_retarder).toBe(4);
      expect(T_WINDOW_HOURS.hot.with_retarder).toBe(8);
      expect(T_WINDOW_HOURS.normal.no_retarder).toBe(5);
      expect(T_WINDOW_HOURS.normal.with_retarder).toBe(8);
      expect(T_WINDOW_HOURS.cold.no_retarder).toBe(6);
      expect(T_WINDOW_HOURS.cold.with_retarder).toBe(10);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Sectional mode (spáry = true)
  // ────────────────────────────────────────────────────────────────────────

  describe('Sectional mode', () => {
    it('should detect sectional mode when spáry present', () => {
      const result = decidePourMode(makeInput());
      expect(result.pour_mode).toBe('sectional');
    });

    it('should calculate correct number of sections from spacing', () => {
      // 30m / 5m = 6 sections
      const result = decidePourMode(makeInput({
        total_length_m: 30,
        spara_spacing_m: 5,
        volume_m3: 120,
      }));
      expect(result.num_sections).toBe(6);
      expect(result.section_volume_m3).toBeCloseTo(20, 0);
    });

    it('should combine small sections into one tact', () => {
      // 6 sections × 10m³ each = 60m³ total
      // Q=30, t_window=5h (normal, no retarder), available=4h
      // Max per tact: 30 × 4 = 120m³ → all 6 sections fit in 1 tact? No — floor(120/10) = 12 per tact
      // But 6 sections total → 1 tact
      const result = decidePourMode(makeInput({
        total_length_m: 30,
        spara_spacing_m: 5,
        volume_m3: 60,
        q_eff_m3_h: 30,
      }));
      expect(result.num_sections).toBe(6);
      expect(result.num_tacts).toBeLessThanOrEqual(result.num_sections);
    });

    it('should use chess scheduling for adjacent sections', () => {
      const result = decidePourMode(makeInput({
        adjacent_sections: true,
      }));
      expect(result.sub_mode).toBe('adjacent_chess');
      expect(result.scheduling_mode).toBe('chess');
      expect(result.cure_between_neighbors_h).toBe(24);
    });

    it('should use linear scheduling for independent sections', () => {
      const result = decidePourMode(makeInput({
        element_type: 'zaklady_piliru',
        adjacent_sections: false,
      }));
      expect(result.sub_mode).toBe('independent');
      expect(result.scheduling_mode).toBe('linear');
      expect(result.cure_between_neighbors_h).toBe(0);
    });

    it('should always have 1 pump in sectional mode', () => {
      const result = decidePourMode(makeInput());
      expect(result.pumps_required).toBe(1);
      expect(result.retarder_required).toBe(false);
      expect(result.backup_pump).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Monolithic mode (spáry = false)
  // ────────────────────────────────────────────────────────────────────────

  describe('Monolithic mode', () => {
    it('should detect monolithic mode when no spáry', () => {
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 50,
      }));
      expect(result.pour_mode).toBe('monolithic');
      expect(result.num_tacts).toBe(1);
    });

    it('should use single pump for small volumes', () => {
      // 80m³, Q=30, normal → t=5h, available=4h, max=120m³
      // 80 / 30 = 2.67h + 1h overhead = 3.67h ≤ 5h → 1 pump
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 80,
        q_eff_m3_h: 30,
        season: 'normal',
        use_retarder: false,
      }));
      expect(result.sub_mode).toBe('single_pump');
      expect(result.pumps_required).toBe(1);
      expect(result.retarder_required).toBe(false);
    });

    it('should require retarder when 1 pump barely exceeds window', () => {
      // 200m³, Q=30, normal → pumping=6.67h + 1h = 7.67h
      // t_window normal (no retarder) = 5h → exceeds
      // t_window normal (with retarder) = 8h → 7.67 ≤ 8 → fits with retarder!
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 200,
        q_eff_m3_h: 30,
        season: 'normal',
        use_retarder: false,
      }));
      expect(result.pumps_required).toBe(1);
      expect(result.retarder_required).toBe(true);
    });

    it('should calculate multi-pump for large volumes', () => {
      // 420m³, Q=30, normal+retarder → t=8h, available=7h
      // Max 1 pump: 30×7 = 210m³ < 420 → need 2 pumps
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 420,
        q_eff_m3_h: 30,
        season: 'normal',
        use_retarder: false,
      }));
      expect(result.sub_mode).toBe('multi_pump');
      expect(result.pumps_required).toBe(2);
      expect(result.retarder_required).toBe(true);
    });

    it('should detect mega pour (>500m³) and require backup pump', () => {
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 800,
        q_eff_m3_h: 30,
        season: 'normal',
        use_retarder: true,
      }));
      expect(result.sub_mode).toBe('mega_pour');
      expect(result.pumps_required).toBeGreaterThanOrEqual(2);
      expect(result.backup_pump).toBe(true);
      expect(result.warnings.some(w => w.includes('MEGA'))).toBe(true);
    });

    it('should use linear scheduling for monolithic mode', () => {
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 100,
      }));
      expect(result.scheduling_mode).toBe('linear');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Season / T-window effects
  // ────────────────────────────────────────────────────────────────────────

  describe('Season effects', () => {
    it('hot season should give shorter window', () => {
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 50,
        season: 'hot',
        use_retarder: false,
      }));
      expect(result.t_window_hours).toBe(4);
    });

    it('cold season should give longer window', () => {
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 50,
        season: 'cold',
        use_retarder: false,
      }));
      expect(result.t_window_hours).toBe(6);
    });

    it('retarder should extend window', () => {
      const result = decidePourMode(makeInput({
        has_dilatacni_spary: false,
        volume_m3: 50,
        season: 'normal',
        use_retarder: true,
      }));
      expect(result.t_window_hours).toBe(8);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Element defaults
  // ────────────────────────────────────────────────────────────────────────

  describe('Element defaults catalog', () => {
    it('rimsa should default to adjacent_chess', () => {
      expect(ELEMENT_DEFAULTS.rimsa.typical_sub_mode).toBe('adjacent_chess');
      expect(ELEMENT_DEFAULTS.rimsa.typical_has_spary).toBe(true);
    });

    it('zaklady_piliru should default to independent', () => {
      expect(ELEMENT_DEFAULTS.zaklady_piliru.typical_sub_mode).toBe('independent');
    });

    it('mostovkova_deska should be "depends"', () => {
      expect(ELEMENT_DEFAULTS.mostovkova_deska.typical_has_spary).toBe('depends');
    });

    it('mostni_zavirne_zidky should be monolithic', () => {
      expect(ELEMENT_DEFAULTS.mostni_zavirne_zidky.typical_has_spary).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Decision log (traceability)
  // ────────────────────────────────────────────────────────────────────────

  describe('Traceability', () => {
    it('should produce non-empty decision log', () => {
      const result = decidePourMode(makeInput());
      expect(result.decision_log.length).toBeGreaterThan(0);
    });

    it('should log t_window calculation', () => {
      const result = decidePourMode(makeInput());
      expect(result.decision_log.some(l => l.includes('T-window'))).toBe(true);
    });
  });
});
