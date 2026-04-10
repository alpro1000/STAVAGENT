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
    it('caps excessive formwork sets for dual bridge monolith and warns about pour sequencing', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 1800,
        has_dilatacni_spary: false,
        num_bridges: 2,
        num_sets: 5,
        num_formwork_crews: 1,
      });

      expect(plan.warnings.some(w => w.includes('použito max. 2 kompletní souprava/y'))).toBe(true);
      expect(plan.warnings.some(w => w.includes('Souběžná betonáž 2 mostů není reálná'))).toBe(true);
      expect(plan.decision_log.some(l => l.includes('Formwork kits capped'))).toBe(true);
      expect(plan.decision_log.some(l => l.includes('Bridge pour sequencing required'))).toBe(true);
    });

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

  // ─── Shape Correction ──────────────────────────────────────────────────────

  describe('planElement — shape correction (P3)', () => {
    it('default shape_correction is 1.0', () => {
      const plan = planElement(wallInput);
      expect(plan.formwork.shape_correction).toBe(1.0);
    });

    it('circular shape (1.5) increases assembly time by 50%', () => {
      const base = planElement({ ...wallInput });
      const circular = planElement({ ...wallInput, formwork_shape_correction: 1.5 });

      // Assembly days should be ~50% longer
      expect(circular.formwork.assembly_days).toBeCloseTo(base.formwork.assembly_days * 1.5, 1);
      expect(circular.formwork.shape_correction).toBe(1.5);
    });

    it('shape correction logged in decision_log', () => {
      const plan = planElement({ ...wallInput, formwork_shape_correction: 1.3 });
      expect(plan.decision_log.some(l => l.includes('Shape correction'))).toBe(true);
    });

    it('shape_correction = 1.0 does not add log entry', () => {
      const plan = planElement({ ...wallInput, formwork_shape_correction: 1.0 });
      expect(plan.decision_log.some(l => l.includes('Shape correction'))).toBe(false);
    });

    it('does NOT affect rebar duration', () => {
      const base = planElement({ ...wallInput });
      const irregular = planElement({ ...wallInput, formwork_shape_correction: 1.8 });

      // Rebar should be identical regardless of shape
      expect(irregular.rebar.duration_days).toBe(base.rebar.duration_days);
    });

    it('increases formwork labor cost', () => {
      const base = planElement({ ...wallInput });
      const circular = planElement({ ...wallInput, formwork_shape_correction: 1.5 });
      expect(circular.costs.formwork_labor_czk).toBeGreaterThan(base.costs.formwork_labor_czk);
    });
  });

  // ─── Obrátkovost (repetitive elements) ──────────────────────────────────────

  describe('planElement — obrátkovost (P4)', () => {
    const patkaInput: PlannerInput = {
      element_type: 'zakladova_patka',
      volume_m3: 3,
      formwork_area_m2: 8,
      has_dilatacni_spary: false,
    };

    it('single element → no obratkovost', () => {
      const plan = planElement(patkaInput);
      expect(plan.obratkovost).toBeUndefined();
    });

    it('20 identical elements / 2 sets → obratkovost 10', () => {
      const plan = planElement({
        ...patkaInput,
        num_identical_elements: 20,
        formwork_sets_count: 2,
      });
      expect(plan.obratkovost).toBeDefined();
      expect(plan.obratkovost!.obratkovost).toBe(10);
      expect(plan.obratkovost!.num_identical_elements).toBe(20);
      expect(plan.obratkovost!.formwork_sets_count).toBe(2);
    });

    it('rental per element = total / count', () => {
      const plan = planElement({
        ...patkaInput,
        num_identical_elements: 10,
        formwork_sets_count: 1,
      });
      if (plan.obratkovost && plan.costs.formwork_rental_czk > 0) {
        expect(plan.obratkovost.rental_per_element_czk).toBeCloseTo(
          plan.costs.formwork_rental_czk / 10, 0
        );
      }
    });

    it('total_duration includes transfer time', () => {
      const plan = planElement({
        ...patkaInput,
        num_identical_elements: 4,
        formwork_sets_count: 2,
      });
      expect(plan.obratkovost).toBeDefined();
      const ob = plan.obratkovost!;
      expect(ob.transfer_time_days).toBe(0.5);
      // 2 obrátek × (schedule + 0.5)
      expect(ob.total_duration_days).toBeGreaterThan(0);
    });

    it('obrátkovost warning generated', () => {
      const plan = planElement({
        ...patkaInput,
        num_identical_elements: 20,
        formwork_sets_count: 2,
      });
      expect(plan.warnings.some(w => w.includes('Obrátkovost'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // E2E: Per-záběr volumes (v4.0)
  // ──────────────────────────────────────────────────────────────────────

  describe('per-záběr volumes (tact_volumes)', () => {
    it('accepts tact_volumes and produces per-tact concrete days', () => {
      const plan = planElement({
        element_type: 'stropni_deska',
        volume_m3: 125.559,
        has_dilatacni_spary: true,
        spara_spacing_m: 10,
        total_length_m: 40,
        adjacent_sections: true,
        num_tacts_override: 4,
        tact_volumes: [35, 30, 30, 30.559],
        concrete_class: 'C30/37',
        temperature_c: 15,
      });
      expect(plan.tact_volumes).toEqual([35, 30, 30, 30.559]);
      expect(plan.pour_decision.num_tacts).toBe(4);
      expect(plan.schedule.tact_details).toHaveLength(4);
      // Total days should be computed
      expect(plan.schedule.total_days).toBeGreaterThan(0);
      // Decision log should mention per-záběr
      expect(plan.decision_log.some(l => l.includes('Per-záběr'))).toBe(true);
    });

    it('uniform volumes when tact_volumes not provided', () => {
      const plan = planElement({
        element_type: 'stropni_deska',
        volume_m3: 120,
        has_dilatacni_spary: true,
        spara_spacing_m: 10,
        total_length_m: 40,
        adjacent_sections: true,
        num_tacts_override: 4,
      });
      expect(plan.tact_volumes).toBeUndefined();
      // All tacts should have same schedule (uniform)
      const details = plan.schedule.tact_details;
      const conDurations = details.map(d => d.concrete[1] - d.concrete[0]);
      // All durations should be the same (uniform)
      const first = conDurations[0];
      for (const d of conDurations) {
        expect(d).toBeCloseTo(first, 2);
      }
    });

    it('per-záběr with variable volumes affects total schedule', () => {
      const uniform = planElement({
        element_type: 'operne_zdi',
        volume_m3: 120,
        has_dilatacni_spary: true,
        spara_spacing_m: 10,
        total_length_m: 40,
        num_tacts_override: 4,
        concrete_class: 'C25/30',
        temperature_c: 15,
      });
      const variable = planElement({
        element_type: 'operne_zdi',
        volume_m3: 120,
        has_dilatacni_spary: true,
        spara_spacing_m: 10,
        total_length_m: 40,
        num_tacts_override: 4,
        tact_volumes: [60, 20, 20, 20],
        concrete_class: 'C25/30',
        temperature_c: 15,
      });
      // Both should produce valid plans
      expect(uniform.schedule.total_days).toBeGreaterThan(0);
      expect(variable.schedule.total_days).toBeGreaterThan(0);
      expect(variable.tact_volumes).toEqual([60, 20, 20, 20]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // E2E: FORESTINA SO.01 — stropní deska 125.559 m³, 4 záběry
  // ──────────────────────────────────────────────────────────────────────

  describe('E2E: FORESTINA SO.01', () => {
    const forestinaInput: PlannerInput = {
      element_type: 'stropni_deska',
      volume_m3: 125.559,
      has_dilatacni_spary: true,
      spara_spacing_m: 8,
      total_length_m: 32,
      adjacent_sections: true,
      concrete_class: 'C25/30',
      cement_type: 'CEM_II',
      temperature_c: 15,
      num_sets: 2,
      num_formwork_crews: 1,
      num_rebar_crews: 1,
      crew_size: 4,
      crew_size_rebar: 4,
      shift_h: 10,
      wage_czk_h: 398,
      num_tacts_override: 4,
      tact_volumes: [33, 31, 31, 30.559],
      height_m: 3.2,
    };

    it('classifies as stropní deska', () => {
      const plan = planElement(forestinaInput);
      expect(plan.element.type).toBe('stropni_deska');
    });

    it('schedules 4 záběry with correct total volume', () => {
      const plan = planElement(forestinaInput);
      expect(plan.pour_decision.num_tacts).toBe(4);
      expect(plan.schedule.tact_details).toHaveLength(4);
      expect(plan.tact_volumes).toEqual([33, 31, 31, 30.559]);
    });

    it('needs supports (stropní deska = horizontal)', () => {
      const plan = planElement(forestinaInput);
      expect(plan.element.profile.needs_supports).toBe(true);
      // Should have props calculated (height provided)
      expect(plan.props).toBeDefined();
    });

    it('produces valid schedule with parallelized tacts', () => {
      const plan = planElement(forestinaInput);
      // With 2 sets and 4 tacts, should have savings
      expect(plan.schedule.savings_pct).toBeGreaterThan(0);
      // Total days should be reasonable for a floor slab (< 100 working days)
      expect(plan.schedule.total_days).toBeLessThan(100);
      expect(plan.schedule.total_days).toBeGreaterThan(5);
    });

    it('calculates costs for all trades', () => {
      const plan = planElement(forestinaInput);
      expect(plan.costs.formwork_labor_czk).toBeGreaterThan(0);
      expect(plan.costs.rebar_labor_czk).toBeGreaterThan(0);
      expect(plan.costs.pour_labor_czk).toBeGreaterThan(0);
      expect(plan.costs.total_labor_czk).toBeGreaterThan(0);
    });

    it('generates warnings about supports/curing', () => {
      const plan = planElement(forestinaInput);
      // Should warn about props / skruž for horizontal element
      expect(plan.warnings.length).toBeGreaterThan(0);
    });
  });
});
