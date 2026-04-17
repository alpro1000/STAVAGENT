/**
 * Planner Orchestrator Tests
 *
 * Tests the full planning cycle: classification → pour decision → formwork →
 * rebar → pour task → scheduling → costs.
 */
import { describe, it, expect } from 'vitest';
import { planElement, computePourCrewByPumps } from './planner-orchestrator.js';
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
  // Block C: explicit 'no' is required to reach strict monolithic mode;
  // default undefined now routes to sectional-by-capacity + "ověřte v RDS".
  working_joints_allowed: 'no',
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

    it('warns and ignores mismatched tact_volumes length', () => {
      const plan = planElement({
        element_type: 'operne_zdi',
        volume_m3: 120,
        has_dilatacni_spary: true,
        spara_spacing_m: 10,
        total_length_m: 40,
        num_tacts_override: 4,
        tact_volumes: [60, 30, 30], // 3 volumes but 4 tacts → mismatch
        concrete_class: 'C25/30',
        temperature_c: 15,
      });
      // Should produce valid plan (tact_volumes ignored)
      expect(plan.schedule.total_days).toBeGreaterThan(0);
      expect(plan.tact_volumes).toBeUndefined();
      // Should warn about mismatch
      expect(plan.warnings.some(w => w.includes('tact_volumes') && w.includes('ignorováno'))).toBe(true);
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

  // ─── RECOMMENDED_EXPOSURE — no false-positive warnings (BUG 1/2/10) ───────

  describe('RECOMMENDED_EXPOSURE — no false-positive warnings', () => {
    it('SO-202 opery dřík XF4: no false-positive', () => {
      const plan = planElement({
        element_type: 'opery_ulozne_prahy',
        volume_m3: 40,
        formwork_area_m2: 60,
        height_m: 5,
        concrete_class: 'C30/37',
        exposure_class: 'XF4',
      });
      const exposureWarning = plan.warnings.find(w => w.includes('neobvyklá'));
      expect(exposureWarning).toBeUndefined();
    });

    it('SO-202 pilíř P4 XF2: no false-positive', () => {
      const plan = planElement({
        element_type: 'driky_piliru',
        volume_m3: 20,
        formwork_area_m2: 44,
        height_m: 6,
        concrete_class: 'C35/45',
        exposure_class: 'XF2',
      });
      const exposureWarning = plan.warnings.find(w => w.includes('neobvyklá'));
      expect(exposureWarning).toBeUndefined();
    });

    it('mostni_zavirne_zidky XF4: no false-positive', () => {
      const plan = planElement({
        element_type: 'mostni_zavirne_zidky',
        volume_m3: 3,
        formwork_area_m2: 8,
        concrete_class: 'C30/37',
        exposure_class: 'XF4',
      });
      const exposureWarning = plan.warnings.find(w => w.includes('neobvyklá'));
      expect(exposureWarning).toBeUndefined();
    });

    it('driky_piliru XA3 DOES produce warning (not in recommended)', () => {
      const plan = planElement({
        element_type: 'driky_piliru',
        volume_m3: 20,
        height_m: 6,
        concrete_class: 'C35/45',
        exposure_class: 'XA3',
      });
      const exposureWarning = plan.warnings.find(w => w.includes('neobvyklá'));
      expect(exposureWarning).toBeDefined();
    });
  });

  // ─── BUG 4: Prestress formula (wait + stressing + grouting) ──────────

  describe('planElement — prestress realistic formula', () => {
    it('SO-202 NK 12 cables jednostranné → ≥11 days (7+2+2)', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 500,
        formwork_area_m2: 400,
        height_m: 8,
        concrete_class: 'C35/45',
        is_prestressed: true,
        prestress_cables_count: 12,
        prestress_tensioning: 'one_sided',
      });
      expect(plan.prestress).toBeDefined();
      // wait_for_strength ≥7, stressing ceil(12/6)=2, grouting ceil(12/8)=2 → ≥11
      expect(plan.prestress!.days).toBeGreaterThanOrEqual(11);
    });

    it('default (no cable count) → ≥11 days (7+2+2 defaults)', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 500,
        formwork_area_m2: 400,
        height_m: 8,
        concrete_class: 'C35/45',
        is_prestressed: true,
      });
      expect(plan.prestress).toBeDefined();
      // wait ≥7, stressing default 2, grouting default 2 → ≥11
      expect(plan.prestress!.days).toBeGreaterThanOrEqual(11);
    });

    it('override still works', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 500,
        formwork_area_m2: 400,
        height_m: 8,
        is_prestressed: true,
        prestress_days_override: 15,
      });
      expect(plan.prestress!.days).toBe(15);
    });
  });

  // ─── BUG 7: num_bridges schedule multiplier ────────────────────────────

  describe('planElement — num_bridges schedule', () => {
    it('num_bridges=2 monolithic small volume → 2 tacts (1 per bridge)', () => {
      // Small volume so capacity-based splitting doesn't exceed 2 tacts
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 60,
        formwork_area_m2: 100,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
        num_bridges: 2,
      });
      // Multi-bridge override: 1→2 tacts (each bridge = 1 tact)
      expect(plan.pour_decision.num_tacts).toBe(2);
    });

    it('num_bridges=1 monolithic small volume → 1 tact', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 60,
        formwork_area_m2: 100,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
        num_bridges: 1,
      });
      expect(plan.pour_decision.num_tacts).toBe(1);
    });
  });

  // ─── Mostovka B1 (2026-04-16): tesaři sequence podpěry+bednění ───────
  describe('planElement — tesaři crew sequencing (B1)', () => {
    const baseInput: PlannerInput = {
      element_type: 'mostovkova_deska',
      volume_m3: 120,
      formwork_area_m2: 100,
      concrete_class: 'C35/45',
      has_dilatacni_spary: false,
      working_joints_allowed: 'no',
    };

    it('schedule total_days grows when height_m is given (props now on critical path)', () => {
      const withoutHeight = planElement(baseInput);
      const withHeight = planElement({ ...baseInput, height_m: 8 });
      // Height triggers calculateProps → asm/dis days roll into ASM/STR.
      // Because the same tesaři crew now has more sequential work, total
      // days must be ≥ the height-less plan.
      expect(withHeight.schedule.total_days).toBeGreaterThanOrEqual(withoutHeight.schedule.total_days);
      expect(withHeight.props).toBeDefined();
      expect(withHeight.props!.assembly_days).toBeGreaterThan(0);
    });

    it('decision log records combined tesaři sequence for horizontal element with props', () => {
      const plan = planElement({ ...baseInput, height_m: 8 });
      const hasSequenceLog = plan.decision_log.some(l =>
        l.includes('Tesaři sequence per tact') && l.includes('podpěry') && l.includes('bednění'),
      );
      expect(hasSequenceLog).toBe(true);
    });

    it('vertical element without needs_supports: no props inflation (stěna)', () => {
      const plan = planElement({
        element_type: 'stena',
        volume_m3: 40,
        formwork_area_m2: 60,
        height_m: 3,
        concrete_class: 'C30/37',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
      });
      expect(plan.props).toBeUndefined();
      const hasSequenceLog = plan.decision_log.some(l => l.includes('Tesaři sequence per tact'));
      expect(hasSequenceLog).toBe(false);
    });
  });

  // ─── MEGA pour Bug 1 (2026-04-16): crew size scales with pump count ──
  describe('computePourCrewByPumps', () => {
    it('1 pump yields 8 lidí (task spec table row: 100 m³)', () => {
      const b = computePourCrewByPumps(1);
      expect(b).toEqual({
        ukladani: 2, vibrace: 2, finiseri: 1, rizeni: 3,
        total: 8, pumps_used: 1,
      });
    });

    it('2 pumps yields 12 lidí (task spec table row: 300 m³)', () => {
      const b = computePourCrewByPumps(2);
      expect(b.ukladani).toBe(4);
      expect(b.vibrace).toBe(3);
      expect(b.finiseri).toBe(2);
      expect(b.rizeni).toBe(3);
      expect(b.total).toBe(12);
    });

    it('3 pumps yields 17 lidí (task spec table row: 664 m³)', () => {
      expect(computePourCrewByPumps(3).total).toBe(17);
    });

    it('4 pumps yields 21 lidí (task spec table row: 1000+ m³)', () => {
      expect(computePourCrewByPumps(4).total).toBe(21);
    });

    it('clamps invalid pump count to 1 (0/negative/float)', () => {
      expect(computePourCrewByPumps(0).pumps_used).toBe(1);
      expect(computePourCrewByPumps(-3).pumps_used).toBe(1);
      expect(computePourCrewByPumps(1.7).pumps_used).toBe(1);
    });
  });

  describe('planElement — pour crew derived from pumps (Bug 1)', () => {
    it('exposes pour_crew_breakdown on resources', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 120,
        formwork_area_m2: 100,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
      });
      expect(plan.resources.pour_crew_breakdown).toBeDefined();
      expect(plan.resources.pour_crew_breakdown.total).toBeGreaterThan(0);
      // total = ukladani + vibrace + finiseri + rizeni
      const b = plan.resources.pour_crew_breakdown;
      expect(b.ukladani + b.vibrace + b.finiseri + b.rizeni).toBe(b.total);
    });

    it('small pour (1 pump) gets 8-person pour crew (universal formula)', () => {
      const plan = planElement({
        element_type: 'zakladova_deska',
        volume_m3: 50,
        formwork_area_m2: 40,
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
      });
      expect(plan.resources.pour_crew_breakdown.pumps_used).toBe(1);
      expect(plan.resources.pour_simultaneous_headcount).toBe(8);
    });

    it('large monolithic pour (multi-pump) scales crew proportionally', () => {
      const small = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 100,
        formwork_area_m2: 100,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
      });
      const mega = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 800,
        formwork_area_m2: 400,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
      });
      // Larger pour needs more pumps → bigger crew (no decrease ever)
      expect(mega.resources.pour_crew_breakdown.pumps_used)
        .toBeGreaterThanOrEqual(small.resources.pour_crew_breakdown.pumps_used);
      expect(mega.resources.pour_simultaneous_headcount)
        .toBeGreaterThanOrEqual(small.resources.pour_simultaneous_headcount);
    });
  });

  // ─── MEGA pour Bug 2 (2026-04-16): multi-shift crew relief ───────────
  describe('planElement — multi-shift crew relief (Bug 2)', () => {
    it('pour fitting in 1 shift → numPourShifts=1, no night premium', () => {
      const plan = planElement({
        element_type: 'zakladova_deska',
        volume_m3: 80,
        formwork_area_m2: 60,
        concrete_class: 'C25/30',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
        shift_h: 10,
      });
      expect(plan.resources.pour_shifts).toBe(1);
      expect(plan.resources.pour_has_night_premium).toBe(false);
      expect(plan.costs.pour_night_premium_czk).toBe(0);
    });

    it('continuous pour > shift triggers multi-shift (tight shift_h edge case)', () => {
      // After Bug 3 fix, decidePourMode sizes pumps to fit the pour window
      // (≤8 h with retarder), which in practice always ≤ the default 10 h
      // shift. The multi-shift branch fires for edge cases — here we
      // simulate one by using shift_h=5 so a normal monolithic pour
      // crosses the shift boundary even with the multi-pump fit.
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 600,
        formwork_area_m2: 400,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
        shift_h: 5,
      });
      expect(plan.resources.pour_shifts).toBeGreaterThanOrEqual(2);
      expect(plan.resources.pour_rostered_headcount).toBe(
        plan.resources.pour_simultaneous_headcount * plan.resources.pour_shifts,
      );
      expect(plan.resources.pour_has_night_premium).toBe(true);
      expect(plan.costs.pour_night_premium_czk).toBeGreaterThan(0);
    });

    it('cost scales with person-hours, not per-worker-per-shift × shifts', () => {
      // Same tight-shift edge case to actually hit the multi-shift path
      // we want to verify. Cost should equal crew × pour_hours × wage
      // + night premium, NOT crew × shift × num_shifts × wage (which
      // would over-pay the partial 2nd shift under the old formula).
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 500,
        formwork_area_m2: 300,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
        shift_h: 5,
        wage_pour_czk_h: 400,
      });
      const crew = plan.resources.pour_simultaneous_headcount;
      const pourH = plan.pour.total_pour_hours;
      const shift = plan.resources.shift_h;
      const nightH = Math.max(0, pourH - shift);
      const expectedBase = crew * pourH * 400;
      const expectedNight = crew * nightH * 400 * 0.10;
      const expected = (expectedBase + expectedNight) * plan.pour_decision.num_tacts;
      // 1% tolerance for rounding
      expect(Math.abs(plan.costs.pour_labor_czk - expected) / expected).toBeLessThan(0.01);
    });

    it('warning text shows total headcount = crew × shifts and cites §116', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska',
        volume_m3: 600,
        formwork_area_m2: 400,
        height_m: 8,
        concrete_class: 'C35/45',
        has_dilatacni_spary: false,
        working_joints_allowed: 'no',
        shift_h: 5,
      });
      const hasMultiShiftWarning = plan.warnings.some(w =>
        w.includes('směny') && w.includes('celkem') && w.includes('+10%')
      );
      expect(hasMultiShiftWarning).toBe(true);
    });
  });

  // ─── Mostovka E2 (2026-04-16): two-phase pour for trámový subtype ────
  describe('planElement — dvoutrám 2-fáze pour (E2)', () => {
    const baseTramInput: PlannerInput = {
      element_type: 'mostovkova_deska',
      volume_m3: 120,
      formwork_area_m2: 100,
      height_m: 8,
      concrete_class: 'C35/45',
      has_dilatacni_spary: false,
      working_joints_allowed: 'no',
    };

    it('dvoutrám triggers 6h technological pauza warning + log', () => {
      const plan = planElement({ ...baseTramInput, bridge_deck_subtype: 'dvoutram' });
      const hasWarning = plan.warnings.some(w => w.includes('2 fázích') && w.includes('pauza'));
      expect(hasWarning).toBe(true);
      const hasLog = plan.decision_log.some(l => l.includes('Two-phase mostovka pour'));
      expect(hasLog).toBe(true);
    });

    it('deskovy subtype (1 fáze) does NOT get the 2-fáze pauza', () => {
      const plan = planElement({ ...baseTramInput, bridge_deck_subtype: 'deskovy' });
      const hasLog = plan.decision_log.some(l => l.includes('Two-phase mostovka pour'));
      expect(hasLog).toBe(false);
    });
  });

  // ─── Terminology Commit 3 (2026-04-17): MSS orchestrator path ────────
  describe('planElement — MSS path (construction_technology=mss)', () => {
    const baseMssInput: PlannerInput = {
      element_type: 'mostovkova_deska',
      volume_m3: 800,
      formwork_area_m2: 500,
      height_m: 10,
      concrete_class: 'C35/45',
      has_dilatacni_spary: false,
      working_joints_allowed: 'no',
      construction_technology: 'mss',
      span_m: 36,
      num_spans: 6,
      nk_width_m: 12,
    };

    it('is_mss_path flag is true when construction_technology=mss', () => {
      const plan = planElement(baseMssInput);
      expect(plan.costs.is_mss_path).toBe(true);
    });

    it('formwork + props rentals are zero (bundled in MSS rental)', () => {
      const plan = planElement(baseMssInput);
      expect(plan.costs.formwork_rental_czk).toBe(0);
      expect(plan.costs.props_rental_czk).toBe(0);
    });

    it('MSS mobilization + demobilization + rental are exposed', () => {
      const plan = planElement(baseMssInput);
      expect(plan.costs.mss_mobilization_czk).toBeGreaterThan(0);
      expect(plan.costs.mss_demobilization_czk).toBeGreaterThan(0);
      expect(plan.costs.mss_rental_czk).toBeGreaterThan(0);
    });

    it('formwork_labor_czk includes MSS mobilization + demobilization', () => {
      const plan = planElement(baseMssInput);
      expect(plan.costs.formwork_labor_czk)
        .toBeGreaterThanOrEqual(plan.costs.mss_mobilization_czk + plan.costs.mss_demobilization_czk);
    });

    it('props are skipped on MSS path (propsResult undefined)', () => {
      const plan = planElement(baseMssInput);
      expect(plan.props).toBeUndefined();
      const skipLog = plan.decision_log.some(l =>
        l.includes('Props: skipped') && l.includes('MSS integrated')
      );
      expect(skipLog).toBe(true);
    });

    it('fwSystem selected is mss_integrated (DOKA MSS by default)', () => {
      const plan = planElement(baseMssInput);
      expect(plan.formwork.system.name).toBe('DOKA MSS');
      expect(plan.formwork.system.pour_role).toBe('mss_integrated');
    });

    it('MSS decision_log records reuse factor + mobilization flow', () => {
      const plan = planElement(baseMssInput);
      const hasReuseLog = plan.decision_log.some(l =>
        l.includes('MSS reuse factor') && l.includes('0.35')
      );
      expect(hasReuseLog).toBe(true);
      const hasCostLog = plan.decision_log.some(l =>
        l.includes('MSS costs') && l.includes('formwork_labor')
      );
      expect(hasCostLog).toBe(true);
    });

    it('PERI vendor picks VARIOKIT Mobile (MSS shortcut is vendor-aware)', () => {
      const plan = planElement({ ...baseMssInput, preferred_manufacturer: 'PERI' });
      expect(plan.formwork.system.name).toBe('VARIOKIT Mobile');
    });

    it('non-MSS plan has is_mss_path=false + zeroed MSS fields', () => {
      const plan = planElement({
        ...baseMssInput,
        construction_technology: 'fixed_scaffolding',
      });
      expect(plan.costs.is_mss_path).toBe(false);
      expect(plan.costs.mss_mobilization_czk).toBe(0);
      expect(plan.costs.mss_rental_czk).toBe(0);
    });
  });
});
