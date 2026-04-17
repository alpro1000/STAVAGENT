/**
 * Pour Task Engine Tests
 */
import { describe, it, expect } from 'vitest';
import { calculatePourTask, needsPump, quickPourEstimate } from './pour-task-engine.js';

describe('Pour Task Engine', () => {
  describe('calculatePourTask', () => {
    it('calculates basic pour for foundation', () => {
      const result = calculatePourTask({
        element_type: 'zaklady_piliru',
        volume_m3: 40,
      });
      // Foundation max rate = 40 m³/h, but mixer = 40, plant = 60
      // Effective = MIN(40, 40, 60) = 40
      expect(result.effective_rate_m3_h).toBeLessThanOrEqual(40);
      expect(result.pump_needed).toBe(true);
      expect(result.pumps_required).toBe(1);
      expect(result.total_pour_hours).toBeGreaterThan(0);
    });

    it('identifies bottleneck correctly', () => {
      const result = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 120,
        pump_capacity_m3_h: 50,
        mixer_delivery_m3_h: 20, // this is the bottleneck
      });
      expect(result.rate_bottleneck).toBe('mixer');
      expect(result.effective_rate_m3_h).toBe(20);
    });

    it('respects element-specific rate limit', () => {
      const result = calculatePourTask({
        element_type: 'rimsa', // max 20 m³/h
        volume_m3: 30,
        pump_capacity_m3_h: 50,
      });
      expect(result.effective_rate_m3_h).toBe(20);
      expect(result.rate_bottleneck).toBe('element');
    });

    it('warns when pour exceeds time window', () => {
      const result = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 200,
        season: 'hot',
        // hot window = 4h, 200/30 = 6.67h → exceeds
      });
      expect(result.fits_in_window).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.pour_sessions).toBeGreaterThan(1);
    });

    it('retarder extends window', () => {
      const without = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 150,
        season: 'hot',
      });
      const with_ret = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 150,
        season: 'hot',
        use_retarder: true,
      });
      expect(with_ret.pour_window_h).toBeGreaterThan(without.pour_window_h);
    });

    it('recommends backup pump for large volumes', () => {
      const result = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 250,
      });
      expect(result.backup_pump_recommended).toBe(true);
    });

    it('exposes target-window pump scenario when target_window_h is set', () => {
      // BUG-2: actual scenario uses 1 pump, target window scenario calculates
      // how many pumps are needed to fit the requested window.
      const result = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 350,
        target_window_h: 5,
      });
      // Actual scenario = single pump (longer duration)
      expect(result.pumps_for_actual_window.count).toBe(1);
      expect(result.pumps_required).toBe(1);
      // Target scenario = enough pumps to fit 5h window
      expect(result.pumps_for_target_window).toBeDefined();
      expect(result.pumps_for_target_window!.count).toBeGreaterThan(1);
      expect(result.pumps_for_target_window!.target_window_h).toBe(5);
      // Target scenario must be faster than actual
      expect(result.pumps_for_target_window!.pour_duration_h)
        .toBeLessThan(result.pumps_for_actual_window.pour_duration_h);
    });

    it('includes setup and washout in total', () => {
      const result = calculatePourTask({
        element_type: 'zaklady_piliru',
        volume_m3: 40,
        setup_h: 1,
        washout_h: 1,
      });
      // pumping = 40/40 = 1h, total = 1 + 1 + 1 = 3h
      expect(result.total_pour_hours).toBe(3);
      expect(result.pumping_hours).toBe(1);
    });

    it('generates traceability log', () => {
      const result = calculatePourTask({
        element_type: 'driky_piliru',
        volume_m3: 20,
      });
      expect(result.assumptions_log).toContain('driky_piliru');
      expect(result.assumptions_log).toContain('20m³');
    });
  });

  describe('needsPump', () => {
    it('returns true for typical pump elements', () => {
      expect(needsPump('mostovkova_deska', 10)).toBe(true);
      expect(needsPump('zaklady_piliru', 10)).toBe(true);
    });

    it('returns true for large volumes even without pump flag', () => {
      expect(needsPump('mostni_zavirne_zidky', 10)).toBe(true);
    });

    it('returns false for small zaverne zidky', () => {
      expect(needsPump('mostni_zavirne_zidky', 3)).toBe(false);
    });
  });

  describe('quickPourEstimate', () => {
    it('returns hours for quick scheduling', () => {
      const hours = quickPourEstimate('zaklady_piliru', 40);
      // 0.5 + 40/40 + 0.5 = 2h
      expect(hours).toBe(2);
    });

    it('slower elements take longer', () => {
      const fast = quickPourEstimate('zaklady_piliru', 40); // max 40 m³/h
      const slow = quickPourEstimate('rimsa', 40);           // max 20 m³/h
      expect(slow).toBeGreaterThan(fast);
    });
  });

  // ─── Pump-consistency fix (2026-04-16) ─────────────────────────────────
  describe('num_pumps_available input (pump consistency)', () => {
    it('defaults to 1 pump when not provided (backwards compat)', () => {
      const result = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 664,
      });
      expect(result.pumps_required).toBe(1);
    });

    it('forwards the decidePourMode count so rate scales with pumps', () => {
      const onePump = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 664,
        pump_capacity_m3_h: 30,
      });
      const fourPumps = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 664,
        pump_capacity_m3_h: 30,
        num_pumps_available: 4,
      });
      expect(fourPumps.pumps_required).toBe(4);
      // 4 pumps → ~4x the rate → ~4x shorter pumping (subject to mixer/plant caps)
      expect(fourPumps.pumping_hours).toBeLessThan(onePump.pumping_hours);
      // scenario label reflects actual count
      expect(fourPumps.pumps_for_actual_window.scenario).toContain('4');
    });

    it('clamps num_pumps_available to ≥1 (invalid inputs ignored)', () => {
      const result = calculatePourTask({
        element_type: 'mostovkova_deska',
        volume_m3: 120,
        num_pumps_available: 0,
      });
      expect(result.pumps_required).toBe(1);
    });
  });
});
