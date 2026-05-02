/**
 * Golden test — SO-202 D6 Karlovy Vary, Most na sil. I/6 v km 0,900.
 *
 * Reference: `test-data/tz/SO-202_D6_most_golden_test.md` (audit Section G).
 *
 * Phase 3 Gate 2a state (commit 2 of 4):
 *   - §5b zaklady_piliru: now asserts canonical Frami Xlife (was Top 50
 *     in Phase 1 baseline; horizontal selector fix in Phase 3 commit 2).
 *   - §5f mostovka: post-Gap-8 canonical (Top 50 = formwork + nosnikove
 *     subtype per Phase 2 + canonical §9.1).
 *   - §5c opery_ulozne_prahy: still snapshots CURRENT (COMAIN) behavior
 *     pending Phase 3 commit 3 (vertical typové elements verification).
 *
 * Per `docs/CALCULATOR_PHILOSOPHY.md` §3, numeric assertions use ±10–15 %
 * tolerance. Classification (system name + pour_role) is exact.
 *
 * Out of scope for Gate 2: Bug #1 curing class 4 (mostovka 5d → 9d), Bug #7
 * prestress days, Bug #11/#12 exposure list. These are tracked separately
 * in the SO-202 markdown spec.
 */

import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';

describe('Golden — SO-202 D6 most na I/6 km 0,900', () => {
  describe('§5b Základ opěry OP1 (C25/30 XF1, ~35 m³, h=1.2m)', () => {
    const input: PlannerInput = {
      element_type: 'zaklady_piliru',
      volume_m3: 35,
      height_m: 1.2,
      has_dilatacni_spary: false,
      concrete_class: 'C25/30',
    };

    it('returns a plan without throwing', () => {
      const plan = planElement(input);
      expect(plan).toBeDefined();
      expect(plan.element.type).toBe('zaklady_piliru');
    });

    it('formwork system: Frami Xlife (rámové, pour_role=formwork) — Phase 3 RESOLVED per canonical §9.4', () => {
      const plan = planElement(input);
      // ✅ Phase 3 Gate 2a (commit 2 of 4) resolved: horizontal selector now
      // respects ELEMENT_CATALOG.recommended_formwork[0] over cheapest sort.
      // Frami Xlife is canonical for foundation elements per §9.4 + SO-202
      // §5b expected output + DOKA katalog. Top 50 (mostovka-class
      // nosníkové bednění) was previously chosen by cheapest-rental sort
      // because Frami Xlife (formwork_category='wall') was excluded from
      // the horizontal pool by ELEMENT_SUITABLE_CATEGORIES['horizontal'] =
      // {'slab', 'universal'}. Selector now bypasses pool filter when
      // recommended[0] is universal-applicable.
      expect(plan.formwork.system.name).toBe('Frami Xlife');
      expect(plan.formwork.system.pour_role).toBe('formwork');
      expect(plan.formwork.system.manufacturer).toBe('DOKA');
    });

    it('schedule: positive total_days', () => {
      const plan = planElement(input);
      expect(plan.schedule.total_days).toBeGreaterThan(0);
    });
  });

  describe('§5c Dřík opěry OP1 (C30/37 XF4, ~55 m³, h=5.0m)', () => {
    const input: PlannerInput = {
      element_type: 'opery_ulozne_prahy',
      volume_m3: 55,
      height_m: 5.0,
      has_dilatacni_spary: false,
      concrete_class: 'C30/37',
    };

    it('formwork system: current returns COMAIN (Phase 1 baseline; canonical §5c expects TRIO/Framax — revisit Phase 3)', () => {
      const plan = planElement(input);
      // ⚠️ Phase 1 baseline snapshot: current selector returns COMAIN (ULMA)
      // for opery_ulozne_prahy. Per canonical SO-202 §5c expected output,
      // canonical answer is TRIO or Framax Xlife (rámové vertikální). This
      // is a separate classification bug from Gap #8 — manufacturer
      // preference / vendor mix issue. Revisited in Phase 3.
      expect(plan.formwork.system.name).toBe('COMAIN');
      expect(plan.formwork.system.pour_role).toBe('formwork');
    });
  });

  describe('§5f Mostovka NK (C30/37 XF2, ~605 m³, 6 polí × 20m)', () => {
    const input: PlannerInput = {
      element_type: 'mostovkova_deska',
      volume_m3: 605,
      formwork_area_m2: 1209.78, // §4: 10.85 × 111.5 m
      height_m: 7.795,           // §1: výška nad terénem LM
      has_dilatacni_spary: false,
      concrete_class: 'C30/37',
      span_m: 20,
      num_spans: 6,
    };

    it('classification: mostovkova_deska needs_supports', () => {
      const plan = planElement(input);
      expect(plan.element.type).toBe('mostovkova_deska');
      expect(plan.element.profile.needs_supports).toBe(true);
    });

    it('formwork system: Top 50 (formwork, nosnikove) — Gap #8 RESOLVED in Gate 2.1', () => {
      const plan = planElement(input);
      // ✅ Gap #8 resolved per canonical doc §9.1: Top 50 is nosníkové
      // bednění (Vrstva 1), pour_role='formwork', formwork_subtype='nosnikove'.
      // DOKA katalog: "Nosníkové bednění Top 50". The actual falsework
      // (Vrstva 3) under bridge decks is Staxo 100, separately calculated
      // by orchestrator via calculateProps().
      expect(plan.formwork.system.name).toBe('Top 50');
      expect(plan.formwork.system.pour_role).toBe('formwork');
      expect(plan.formwork.system.formwork_subtype).toBe('nosnikove');
      expect(plan.formwork.system.manufacturer).toBe('DOKA');
    });

    it('schedule: positive total_days (excludes prestress + curing class bugs)', () => {
      const plan = planElement(input);
      expect(plan.schedule.total_days).toBeGreaterThan(0);
    });
  });
});
