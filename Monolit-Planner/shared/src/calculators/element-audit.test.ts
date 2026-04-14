/**
 * Element Audit — Part D of the calculator audit.
 *
 * Runs planElement() against all 22 element types with typical parameters
 * and asserts that after the BUG-1..BUG-6 fixes each element:
 *
 *   1. produces a plan without throwing
 *   2. has a positive total_days
 *   3. has at least one pumps_for_actual_window scenario
 *   4. when vertical + height given: consistency='standard' yields k=0.85
 *   5. when vertical + height given: at least one suitable formwork system
 *      is selected (i.e. filterFormworkByPressure did not exhaust the catalog)
 *   6. has working simultaneous/rostered headcount fields
 *
 * This is a regression net for the 22-type audit — if something regresses
 * in the calculator pipeline, one of these assertions will fire.
 */

import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';
import type { StructuralElementType } from './pour-decision.js';

interface Fixture {
  type: StructuralElementType;
  label: string;
  input: Omit<PlannerInput, 'element_type'>;
}

/** Typical parameters for each of the 22 element types */
const FIXTURES: Fixture[] = [
  // Bridge elements
  { type: 'zaklady_piliru',  label: 'Základy pilířů', input: { volume_m3: 120, height_m: 2.0, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'driky_piliru',    label: 'Dříky pilířů',   input: { volume_m3: 80,  height_m: 8.0, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'rimsa',           label: 'Římsa',          input: { volume_m3: 40,  has_dilatacni_spary: true, spara_spacing_m: 20, total_length_m: 100, adjacent_sections: true, concrete_class: 'C30/37' } },
  { type: 'operne_zdi',      label: 'Opěrné zdi',     input: { volume_m3: 100, height_m: 4.0, has_dilatacni_spary: true, spara_spacing_m: 10, total_length_m: 50, adjacent_sections: true, concrete_class: 'C25/30' } },
  { type: 'mostovkova_deska',label: 'Mostovka',       input: { volume_m3: 400, formwork_area_m2: 600, has_dilatacni_spary: false, concrete_class: 'C30/37', span_m: 25, num_spans: 3 } },
  { type: 'rigel',           label: 'Příčník',        input: { volume_m3: 20,  height_m: 6.0, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'opery_ulozne_prahy', label: 'Opěry',       input: { volume_m3: 60,  height_m: 6.0, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'kridla_opery',    label: 'Křídla opěr',    input: { volume_m3: 30,  height_m: 4.0, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'mostni_zavirne_zidky', label: 'Závěrné zídky', input: { volume_m3: 8, height_m: 1.5, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'prechodova_deska',label: 'Přechodová deska',input: { volume_m3: 20, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  // Building elements
  { type: 'zakladova_deska', label: 'Základová deska',input: { volume_m3: 150, has_dilatacni_spary: false, concrete_class: 'C25/30' } },
  { type: 'zakladovy_pas',   label: 'Základový pás',  input: { volume_m3: 40,  has_dilatacni_spary: false, concrete_class: 'C20/25' } },
  { type: 'zakladova_patka', label: 'Patka',          input: { volume_m3: 10,  has_dilatacni_spary: false, concrete_class: 'C25/30' } },
  { type: 'stropni_deska',   label: 'Stropní deska',  input: { volume_m3: 80,  height_m: 3.0, formwork_area_m2: 350, has_dilatacni_spary: false, concrete_class: 'C25/30' } },
  { type: 'stena',           label: 'Stěna',          input: { volume_m3: 50,  height_m: 3.0, has_dilatacni_spary: false, concrete_class: 'C25/30' } },
  { type: 'sloup',           label: 'Sloup',          input: { volume_m3: 5,   height_m: 4.0, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'pruvlak',         label: 'Průvlak',        input: { volume_m3: 10,  height_m: 3.0, has_dilatacni_spary: false, concrete_class: 'C30/37' } },
  { type: 'schodiste',       label: 'Schodiště',      input: { volume_m3: 8,   height_m: 3.0, has_dilatacni_spary: false, concrete_class: 'C25/30' } },
  { type: 'nadrz',           label: 'Nádrž',          input: { volume_m3: 120, height_m: 4.5, has_dilatacni_spary: true, spara_spacing_m: 6, total_length_m: 20, concrete_class: 'C30/37' } },
  { type: 'podzemni_stena',  label: 'Milánská stěna', input: { volume_m3: 200, has_dilatacni_spary: true, spara_spacing_m: 6, total_length_m: 30, concrete_class: 'C30/37' } },
  { type: 'pilota',          label: 'Pilota',         input: { volume_m3: 30,  has_dilatacni_spary: false, concrete_class: 'C25/30' } },
  { type: 'other',           label: 'Jiný',           input: { volume_m3: 15,  has_dilatacni_spary: false, concrete_class: 'C25/30' } },
];

describe('22-type audit (Part D)', () => {
  // Sanity: full coverage of 22 types
  it('fixture list has 22 unique element types', () => {
    const seen = new Set(FIXTURES.map(f => f.type));
    expect(seen.size).toBe(22);
  });

  for (const fx of FIXTURES) {
    describe(`${fx.type} (${fx.label})`, () => {
      let plan: ReturnType<typeof planElement>;

      it('planElement does not throw', () => {
        plan = planElement({ element_type: fx.type, ...fx.input });
        expect(plan).toBeDefined();
      });

      it('produces a positive schedule total_days', () => {
        expect(plan.schedule.total_days).toBeGreaterThan(0);
      });

      it('emits pumps_for_actual_window scenario (BUG-2)', () => {
        expect(plan.pour.pumps_for_actual_window).toBeDefined();
        expect(plan.pour.pumps_for_actual_window.count).toBeGreaterThanOrEqual(1);
      });

      it('resources expose simultaneous + rostered headcount (BUG-6)', () => {
        expect(plan.resources.pour_simultaneous_headcount).toBeGreaterThan(0);
        expect(plan.resources.pour_rostered_headcount).toBeGreaterThanOrEqual(plan.resources.pour_simultaneous_headcount);
      });

      it('when vertical + height given: k=0.85 (BUG-1 default)', () => {
        if (fx.input.height_m && plan.element.profile.orientation === 'vertical') {
          expect(plan.lateral_pressure).toBeDefined();
          expect(plan.lateral_pressure!.k).toBe(0.85);
        }
      });

      it('selects a formwork system (filter did not exhaust catalog)', () => {
        expect(plan.formwork.system).toBeDefined();
        expect(plan.formwork.system.name).toBeTruthy();
      });
    });
  }

  // Spot check: the SCC consistency raises pressure vs standard
  describe('consistency override end-to-end (BUG-1)', () => {
    it('SCC consistency increases lateral pressure for a tall wall', () => {
      const base = planElement({
        element_type: 'stena', volume_m3: 60, height_m: 4,
        has_dilatacni_spary: false, concrete_class: 'C30/37',
        concrete_consistency: 'standard',
      });
      const scc = planElement({
        element_type: 'stena', volume_m3: 60, height_m: 4,
        has_dilatacni_spary: false, concrete_class: 'C30/37',
        concrete_consistency: 'scc',
      });
      expect(scc.lateral_pressure!.pressure_kn_m2)
        .toBeGreaterThan(base.lateral_pressure!.pressure_kn_m2);
      expect(scc.lateral_pressure!.k).toBe(1.5);
      expect(base.lateral_pressure!.k).toBe(0.85);
    });
  });

  // Spot check: working_joints_allowed routing end-to-end (BUG-4 + Block C)
  describe('working_joints_allowed end-to-end (BUG-4 + Block C)', () => {
    // Block C: default (undefined) now splits a large deck by capacity
    // and emits the "ověřte v RDS" warning instead of silently producing
    // num_tacts=1 on the first run.
    it('large deck default (undefined) — sectional + "ověřte v RDS" warning', () => {
      const plan = planElement({
        element_type: 'mostovkova_deska', volume_m3: 800,
        formwork_area_m2: 1200, has_dilatacni_spary: false,
        concrete_class: 'C30/37',
      });
      expect(plan.pour_decision.num_tacts).toBeGreaterThan(1);
      expect(plan.warnings.some(w => w.includes('nepotvrzeny'))).toBe(true);
    });

    it("explicit 'no' keeps large deck at 1 záběr + nepřetržitá warning", () => {
      const plan = planElement({
        element_type: 'mostovkova_deska', volume_m3: 800,
        formwork_area_m2: 1200, has_dilatacni_spary: false,
        concrete_class: 'C30/37',
        working_joints_allowed: 'no',
      });
      expect(plan.pour_decision.num_tacts).toBe(1);
      expect(plan.warnings.some(w => w.includes('nepřetržitou'))).toBe(true);
    });

    it("'yes' splits into multiple záběry, no ověřte warning", () => {
      const plan = planElement({
        element_type: 'mostovkova_deska', volume_m3: 800,
        formwork_area_m2: 1200, has_dilatacni_spary: false,
        concrete_class: 'C30/37',
        working_joints_allowed: 'yes',
      });
      expect(plan.pour_decision.num_tacts).toBeGreaterThan(1);
      expect(plan.warnings.some(w => w.includes('nepotvrzeny'))).toBe(false);
    });
  });
});
