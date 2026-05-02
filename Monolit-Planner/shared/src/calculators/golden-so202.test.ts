/**
 * Golden test — SO-202 D6 Karlovy Vary, Most na sil. I/6 v km 0,900.
 *
 * Reference: `test-data/tz/SO-202_D6_most_golden_test.md` (audit Section G).
 *
 * Phase 1 baseline (Gate 2.0): tests assert CURRENT behavior, including the
 * known Gap #8 BUG (Top 50 / VARIOKIT HD 200 misclassified as `pour_role:
 * 'falsework'`). Phase 2 of Gate 2 will INVERT the buggy assertions when
 * Gap #8 is fixed in `formwork-systems.ts`.
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

    it('formwork system: current returns Top 50 (Phase 1 baseline; canonical §9.4 says Frami Xlife — revisit Phase 3)', () => {
      const plan = planElement(input);
      // ⚠️ Phase 1 baseline snapshot: current selector returns Top 50 for
      // zaklady_piliru. Per canonical §9.4 + SO-202 §5b expected output, the
      // canonical answer is Frami Xlife (rámové, lehké). This mismatch is a
      // separate classification bug from Gap #8 (Top 50 pour_role) and will
      // be revisited in Phase 3 (Gate 2a mostní verification).
      expect(plan.formwork.system.name).toBe('Top 50');
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

    it('formwork system: Top 50 (Phase 1 baseline — Gap #8 BUG documents pour_role)', () => {
      const plan = planElement(input);
      // ⚠️ Phase 1 baseline assertion. Gap #8 documents that:
      //   - fwSystem.name = 'Top 50' (correct)
      //   - fwSystem.pour_role = 'falsework' (BUG per canonical §9.1 — should be 'formwork')
      // Phase 2 of Gate 2 INVERTS the pour_role assertion to 'formwork' as part
      // of Gap #8 fix. See: AUDIT_Podpera_Terminologie.md Section C.3 Gap #8.
      expect(plan.formwork.system.name).toBe('Top 50');
      expect(plan.formwork.system.pour_role).toBe('falsework');
      expect(plan.formwork.system.manufacturer).toBe('DOKA');
    });

    it('schedule: positive total_days (excludes prestress + curing class bugs)', () => {
      const plan = planElement(input);
      expect(plan.schedule.total_days).toBeGreaterThan(0);
    });
  });
});
