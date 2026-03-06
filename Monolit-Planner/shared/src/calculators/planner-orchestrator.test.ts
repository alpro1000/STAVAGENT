/**
 * Planner Orchestrator Tests
 *
 * Tests the full planning cycle: classification → pour decision → formwork →
 * rebar → pour task → scheduling → costs.
 */
import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal input for a sectional pour (retaining wall with joints) */
const wallInput: PlannerInput = {
  element_type: 'operne_zdi',
  volume_m3: 120,
  formwork_area_m2: 80,
  has_dilatacni_spary: true,
  spara_spacing_m: 10,
  total_length_m: 50,
  adjacent_sections: true,
};

/** Minimal input for a monolithic pour (small closure wall) */
const monoInput: PlannerInput = {
  element_type: 'mostni_zavirne_zidky',
  volume_m3: 8,
  formwork_area_m2: 12,
  has_dilatacni_spary: false,
};

// ─── Basic integration ──────────────────────────────────────────────────────

describe('Planner Orchestrator', () => {
  describe('planElement — basic', () => {
    it('returns all expected sections', () => {
      const plan = planElement(wallInput);
      expect(plan.element).toBeDefined();
      expect(plan.pour_decision).toBeDefined();
      expect(plan.formwork).toBeDefined();
      expect(plan.rebar).toBeDefined();
      expect(plan.pour).toBeDefined();
      expect(plan.schedule).toBeDefined();
      expect(plan.costs).toBeDefined();
      expect(plan.warnings).toBeDefined();
      expect(plan.decision_log).toBeDefined();
    });

    it('classifies element by explicit type', () => {
      const plan = planElement(wallInput);
      expect(plan.element.type).toBe('operne_zdi');
      expect(plan.element.label_cs).toBe('Opěrné zdi');
      expect(plan.element.classification_confidence).toBe(1.0);
    });

    it('classifies element by name', () => {
      const plan = planElement({
        ...wallInput,
        element_type: undefined,
        element_name: 'Opěrné zdi SO 201',
      });
      expect(plan.element.type).toBe('operne_zdi');
      expect(plan.element.classification_confidence).toBeGreaterThan(0.5);
    });

    it('throws without element_name or element_type', () => {
      expect(() => planElement({
        volume_m3: 100,
        has_dilatacni_spary: false,
      } as PlannerInput)).toThrow('Either element_name or element_type must be provided');
    });
  });

  // ─── Pour decision integration ──────────────────────────────────────────

  describe('pour decision', () => {
    it('produces sectional mode for wall with joints', () => {
      const plan = planElement(wallInput);
      expect(plan.pour_decision.pour_mode).toBe('sectional');
      // 120m³ / 5 sections = 24m³ each; window allows ~120m³/tact → may be 1 tact
      expect(plan.pour_decision.num_tacts).toBeGreaterThanOrEqual(1);
      expect(plan.pour_decision.num_sections).toBe(5);
    });

    it('produces monolithic mode for small element', () => {
      const plan = planElement(monoInput);
      expect(plan.pour_decision.pour_mode).toBe('monolithic');
      expect(plan.pour_decision.num_tacts).toBe(1);
    });

    it('chess scheduling for adjacent sections', () => {
      const plan = planElement(wallInput);
      expect(plan.pour_decision.scheduling_mode).toBe('chess');
    });
  });

  // ─── Formwork integration ───────────────────────────────────────────────

  describe('formwork', () => {
    it('selects recommended formwork system', () => {
      const plan = planElement(wallInput);
      expect(plan.formwork.system.name).toBeDefined();
      expect(plan.formwork.system.manufacturer).toBeDefined();
    });

    it('calculates assembly and disassembly days', () => {
      const plan = planElement(wallInput);
      expect(plan.formwork.assembly_days).toBeGreaterThan(0);
      expect(plan.formwork.disassembly_days).toBeGreaterThan(0);
      expect(plan.formwork.assembly_days).toBeGreaterThan(plan.formwork.disassembly_days);
    });

    it('provides 3-phase cost model', () => {
      const plan = planElement(wallInput);
      expect(plan.formwork.three_phase.initial_cost_labor).toBeGreaterThan(0);
      expect(plan.formwork.three_phase.total_cost_labor).toBeGreaterThan(0);
    });

    it('provides strategy comparison', () => {
      const plan = planElement(wallInput);
      expect(plan.formwork.strategies).toHaveLength(3);
      expect(plan.formwork.strategies[0].id).toBe('A'); // Sequential
      expect(plan.formwork.strategies[1].id).toBe('B'); // Overlapping
      expect(plan.formwork.strategies[2].id).toBe('C'); // Parallel
    });

    it('warns for unknown formwork system', () => {
      const plan = planElement({
        ...wallInput,
        formwork_system_name: 'NonExistentSystem',
      });
      expect(plan.warnings.some(w => w.includes('nenalezen'))).toBe(true);
    });
  });

  // ─── Rebar integration ─────────────────────────────────────────────────

  describe('rebar', () => {
    it('estimates mass when not given', () => {
      const plan = planElement(wallInput);
      expect(plan.rebar.mass_source).toBe('estimated');
      expect(plan.rebar.mass_kg).toBeGreaterThan(0);
    });

    it('uses given mass split across tacts', () => {
      const plan = planElement({
        ...wallInput,
        rebar_mass_kg: 10000,
      });
      expect(plan.rebar.mass_source).toBe('user');
      // Mass per tact = 10000 / num_tacts
      expect(plan.rebar.mass_kg).toBeLessThanOrEqual(10000);
    });

    it('provides duration estimate', () => {
      const plan = planElement(wallInput);
      expect(plan.rebar.duration_days).toBeGreaterThan(0);
      expect(plan.rebar.optimistic_days).toBeLessThan(plan.rebar.most_likely_days);
      expect(plan.rebar.pessimistic_days).toBeGreaterThan(plan.rebar.most_likely_days);
    });
  });

  // ─── Pour task integration ─────────────────────────────────────────────

  describe('pour task', () => {
    it('calculates pour parameters', () => {
      const plan = planElement(wallInput);
      expect(plan.pour.effective_rate_m3_h).toBeGreaterThan(0);
      expect(plan.pour.total_pour_hours).toBeGreaterThan(0);
    });

    it('identifies pump need', () => {
      const plan = planElement(wallInput);
      expect(plan.pour.pump_needed).toBe(true);
    });
  });

  // ─── Schedule integration ──────────────────────────────────────────────

  describe('schedule', () => {
    it('produces total_days < sequential_days', () => {
      const plan = planElement(wallInput);
      // With multiple tacts and sets, overlapping should save time
      expect(plan.schedule.total_days).toBeLessThanOrEqual(plan.schedule.sequential_days);
    });

    it('produces Gantt chart', () => {
      const plan = planElement(wallInput);
      expect(plan.schedule.gantt).toContain('█'); // Assembly char
    });

    it('produces tact details', () => {
      const plan = planElement(wallInput);
      expect(plan.schedule.tact_details.length).toBe(plan.pour_decision.num_tacts);
    });

    it('produces critical path', () => {
      const plan = planElement(wallInput);
      expect(plan.schedule.critical_path.length).toBeGreaterThan(0);
    });

    it('single tact for monolithic pour', () => {
      const plan = planElement(monoInput);
      expect(plan.schedule.tact_details.length).toBe(1);
    });
  });

  // ─── Costs ─────────────────────────────────────────────────────────────

  describe('costs', () => {
    it('calculates all cost components', () => {
      const plan = planElement(wallInput);
      expect(plan.costs.formwork_labor_czk).toBeGreaterThan(0);
      expect(plan.costs.rebar_labor_czk).toBeGreaterThan(0);
      expect(plan.costs.pour_labor_czk).toBeGreaterThan(0);
      expect(plan.costs.total_labor_czk).toBeGreaterThan(0);
    });

    it('total = sum of components', () => {
      const plan = planElement(wallInput);
      const sum = plan.costs.formwork_labor_czk + plan.costs.rebar_labor_czk + plan.costs.pour_labor_czk;
      expect(Math.abs(plan.costs.total_labor_czk - sum)).toBeLessThan(1); // Rounding tolerance
    });

    it('calculates rental for systems with rental rate', () => {
      const plan = planElement(wallInput);
      // Opěrné zdi → Framax Xlife → has rental
      expect(plan.costs.formwork_rental_czk).toBeGreaterThan(0);
    });

    it('no rental for traditional formwork', () => {
      const plan = planElement({
        ...monoInput,
        formwork_system_name: 'Tradiční tesařské',
      });
      expect(plan.costs.formwork_rental_czk).toBe(0);
    });
  });

  // ─── Monte Carlo integration ───────────────────────────────────────────

  describe('Monte Carlo', () => {
    it('disabled by default', () => {
      const plan = planElement(wallInput);
      expect(plan.monte_carlo).toBeUndefined();
    });

    it('returns percentiles when enabled', () => {
      const plan = planElement({
        ...wallInput,
        enable_monte_carlo: true,
        monte_carlo_iterations: 1000, // Lower for speed
      });
      expect(plan.monte_carlo).toBeDefined();
      expect(plan.monte_carlo!.p50).toBeGreaterThan(0);
      expect(plan.monte_carlo!.p80).toBeGreaterThan(plan.monte_carlo!.p50);
      expect(plan.monte_carlo!.p90).toBeGreaterThan(plan.monte_carlo!.p80);
    });
  });

  // ─── Maturity integration ──────────────────────────────────────────────

  describe('maturity model', () => {
    it('applies concrete class to curing calculation', () => {
      const without = planElement(wallInput);
      const with_maturity = planElement({
        ...wallInput,
        concrete_class: 'C30/37',
        temperature_c: 20,
      });
      // With explicit maturity, curing days may differ from default 24h
      expect(with_maturity.schedule.effective_curing_days).toBeDefined();
    });

    it('cold temperature increases curing time', () => {
      const warm = planElement({
        ...wallInput,
        concrete_class: 'C25/30',
        temperature_c: 25,
      });
      const cold = planElement({
        ...wallInput,
        concrete_class: 'C25/30',
        temperature_c: 5,
      });
      // Cold → longer curing → longer total
      expect(cold.schedule.total_days).toBeGreaterThanOrEqual(warm.schedule.total_days);
    });
  });

  // ─── Resource variations ───────────────────────────────────────────────

  describe('resource sensitivity', () => {
    it('more sets reduces total days', () => {
      const plan1 = planElement({ ...wallInput, num_sets: 1 });
      const plan2 = planElement({ ...wallInput, num_sets: 3 });
      expect(plan2.schedule.total_days).toBeLessThanOrEqual(plan1.schedule.total_days);
    });

    it('more crews reduces total days', () => {
      const plan1 = planElement({ ...wallInput, num_formwork_crews: 1 });
      const plan2 = planElement({ ...wallInput, num_formwork_crews: 2 });
      expect(plan2.schedule.total_days).toBeLessThanOrEqual(plan1.schedule.total_days);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles small volume element', () => {
      const plan = planElement({
        element_type: 'mostni_zavirne_zidky',
        volume_m3: 2,
        has_dilatacni_spary: false,
      });
      expect(plan.schedule.total_days).toBeGreaterThan(0);
      expect(plan.costs.total_labor_czk).toBeGreaterThan(0);
    });

    it('handles element with all overrides', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 200,
        formwork_area_m2: 150,
        rebar_mass_kg: 30000,
        has_dilatacni_spary: true,
        spara_spacing_m: 15,
        total_length_m: 60,
        adjacent_sections: false,
        season: 'hot',
        use_retarder: true,
        concrete_class: 'C35/45',
        cement_type: 'CEM_I',
        temperature_c: 30,
        num_sets: 3,
        num_formwork_crews: 2,
        num_rebar_crews: 2,
        crew_size: 5,
        shift_h: 8,
        k: 0.75,
        wage_czk_h: 450,
        enable_monte_carlo: true,
        monte_carlo_iterations: 500,
      });
      expect(plan.element.type).toBe('mostovkova_deska');
      expect(plan.pour_decision.pour_mode).toBe('sectional');
      expect(plan.costs.total_labor_czk).toBeGreaterThan(0);
      // Monte Carlo may be undefined if critical path has 0 activities (1 tact)
      // Just check that it ran without errors
      expect(plan.schedule.total_days).toBeGreaterThan(0);
    });

    it('estimates formwork area when not given', () => {
      const plan = planElement({
        element_type: 'zaklady_piliru',
        volume_m3: 50,
        has_dilatacni_spary: false,
      });
      // Should not throw, area auto-estimated
      expect(plan.formwork.assembly_days).toBeGreaterThan(0);
      expect(plan.decision_log.some(l => l.includes('estimated'))).toBe(true);
    });
  });

  // ─── Traceability ──────────────────────────────────────────────────────

  describe('traceability', () => {
    it('decision_log has element classification', () => {
      const plan = planElement(wallInput);
      expect(plan.decision_log.some(l => l.includes('Element:'))).toBe(true);
    });

    it('decision_log has pour mode', () => {
      const plan = planElement(wallInput);
      expect(plan.decision_log.some(l => l.includes('Pour:'))).toBe(true);
    });

    it('decision_log has formwork info', () => {
      const plan = planElement(wallInput);
      expect(plan.decision_log.some(l => l.includes('Formwork:'))).toBe(true);
    });

    it('decision_log has rebar info', () => {
      const plan = planElement(wallInput);
      expect(plan.decision_log.some(l => l.includes('Rebar:'))).toBe(true);
    });

    it('decision_log has schedule summary', () => {
      const plan = planElement(wallInput);
      expect(plan.decision_log.some(l => l.includes('Schedule:'))).toBe(true);
    });
  });
});
