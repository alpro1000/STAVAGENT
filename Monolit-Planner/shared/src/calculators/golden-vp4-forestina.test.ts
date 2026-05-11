/**
 * Golden test — VP4 FORESTINA opěrná zeď (regression baseline).
 *
 * Source: user domain memory + Gate 1 audit Section G + element-classifier
 * regression test (`element-classifier.test.ts:842`).
 *
 * Geometry:
 *   - inverted T cross-section (dřík + patka)
 *   - dřík 1450 × 250 mm, patka 800 × 300 mm
 *   - délka 156.4 m, výška 1.75 m
 *   - V = 94.231 m³
 *   - plocha bednění = 547.4 m²
 *   - rebar D12, 5.654 t (~150 kg/m³)
 *
 * Element type: `operne_zdi`.
 * Expected classification: Framax Xlife (rámové bednění, DOKA).
 *
 * VP4 path is unaffected by Gap #8 (no mostovka, no Top 50 / VARIOKIT HD).
 * This fixture should remain stable across Phase 2 Gap #8 fix (regression
 * net for non-mostní pozemní elements).
 *
 * Per `docs/CALCULATOR_PHILOSOPHY.md` §3, numeric assertions use ±10–15 %
 * tolerance.
 */

import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';

describe('Golden — VP4 FORESTINA opěrná zeď', () => {
  const input: PlannerInput = {
    element_type: 'operne_zdi',
    volume_m3: 94.231,
    formwork_area_m2: 547.4,
    height_m: 1.75,
    has_dilatacni_spary: true,
    spara_spacing_m: 10,
    total_length_m: 156.4,
    adjacent_sections: true,
    concrete_class: 'C30/37',
    rebar_mass_kg: 5654,
    rebar_diameter_mm: 12,
  };

  it('returns a plan without throwing', () => {
    const plan = planElement(input);
    expect(plan).toBeDefined();
    expect(plan.element.type).toBe('operne_zdi');
  });

  it('formwork system: TRIO (rámové, pour_role=formwork) — Phase 4 pre-empted by Phase 3 Commit 3 vertical Option W', () => {
    const plan = planElement(input);
    // ✅ Phase 3 Commit 3 pre-emption: VP4 FORESTINA operne_zdi updated
    // from Phase 1 baseline (DUO observed) to canonical TRIO per
    // ELEMENT_CATALOG.recommended_formwork[0] = ['TRIO', 'Framax Xlife',
    // 'MAXIMO', 'Frami Xlife']. Vertical Option W extension caused this
    // pre-emption (was originally Phase 4 Gate 2b scope).
    //
    // Note: Audit Section A.1 mentioned Framax Xlife as canonical for
    // opěrné zdi, but actual repo convention per ELEMENT_CATALOG is TRIO
    // (PERI rámové) first, Framax (DOKA) second. Both valid; preference
    // is repo-level decision. Audit Section 9.3 mapping table will be
    // updated in Phase 5 closeout to reflect actual convention.
    expect(plan.formwork.system.name).toBe('TRIO');
    expect(plan.formwork.system.pour_role).toBe('formwork');
  });

  it('schedule: positive total_days', () => {
    const plan = planElement(input);
    expect(plan.schedule.total_days).toBeGreaterThan(0);
  });

  it('rebar: ~5.654 t passed through ±15 %', () => {
    const plan = planElement(input);
    // Input rebar_mass_kg = 5654 kg (D12 in walls category).
    // Verify the value flows into the plan's rebar result within tolerance.
    // Field is `mass_kg` per RebarLiteResult interface.
    expect(plan.rebar.mass_kg).toBeGreaterThan(5654 * 0.85);
    expect(plan.rebar.mass_kg).toBeLessThan(5654 * 1.15);
  });

  // ─── Resource Ceiling Phase 1 Foundation D scenarios (task §5.6) ─────────
  //
  // Reference A: VP4 FORESTINA operne_zdi for the demo bug
  // *"u nás je fixně X lidí — jak to spočítáš?"*

  describe('Resource Ceiling — Phase 1 acceptance scenarios', () => {
    it('Scenario 1: default ceiling (no user input) → feasible, KB defaults applied', () => {
      // First-time user with no resource_ceiling — engine auto-fills from B4.
      // VP4 default ceiling (operne_zdi): 12 lidí / 2 souprav / 1 čerpadlo / 1 jeřáb.
      const plan = planElement(input);
      expect(plan.resource_ceiling.source).toBe('kb_default');
      expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(12);
      expect(plan.resource_ceiling.equipment?.num_pumps).toBe(1);
      // Foundation C aligned defaults — no violations on default-vs-default.
      expect(plan.resource_violations).toHaveLength(0);
    });

    it('Scenario 2: strop 5 lidí + 1 souprava + 1 čerpadlo → INFEASIBLE with critical violations', () => {
      // Demo bug scenario A — strict SMB strop, engine demand exceeds.
      const inputLowCeiling: PlannerInput = {
        ...input,
        resource_ceiling: {
          workforce: { num_workers_total: 5 },  // scales default breakdown
          formwork: { num_formwork_sets: 1 },
          equipment: { num_pumps: 1 },
        },
      };
      const plan = planElement(inputLowCeiling);

      // User input overrides → source = 'manual', confidence 0.99
      expect(plan.resource_ceiling.source).toBe('manual');
      expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(5);

      // Engine demand: 4 tesaři, 4 železáři, ~3 pour crew → exceeds 5-total ceiling.
      // Per-profession breakdown scales user total 5/12 ≈ 0.417 →
      //   carpenters = round(4 × 0.417) = 2 (less than engine demand 4)
      //   rebar_workers = round(4 × 0.417) = 2 (less than engine demand 4)
      expect(plan.resource_violations.length).toBeGreaterThan(0);
      const violationFields = plan.resource_violations.map(v => v.field);
      expect(violationFields).toContain('num_carpenters');
      expect(violationFields).toContain('num_rebar_workers');

      // All severity should be 'critical' for these
      const criticalCount = plan.resource_violations.filter(v => v.severity === 'critical').length;
      expect(criticalCount).toBeGreaterThan(0);

      // ⛔ KRITICKÉ prefix on at least one message
      const hasCriticalEmoji = plan.warnings.some(w => w.includes('⛔ KRITICKÉ'));
      expect(hasCriticalEmoji).toBe(true);

      // Recovery hint pushed to warnings
      const hasRecoveryHint = plan.warnings.some(w => w.includes('ℹ️ Doporučení'));
      expect(hasRecoveryHint).toBe(true);
    });

    it('Scenario 3: strop 12 lidí + 2 soupravy + 1 čerpadlo → feasible (default-aligned)', () => {
      // Demo bug scenario B — moderate SMB strop matching engine demand.
      const inputMediumCeiling: PlannerInput = {
        ...input,
        resource_ceiling: {
          workforce: { num_workers_total: 12 },
          formwork: { num_formwork_sets: 2 },
          equipment: { num_pumps: 1 },
        },
      };
      const plan = planElement(inputMediumCeiling);

      expect(plan.resource_ceiling.source).toBe('manual');
      expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(12);
      // KB defaults fill remaining fields (e.g. num_cranes from VP4 defaults)
      expect(plan.resource_ceiling.equipment?.num_cranes).toBe(1);

      // Engine demand peak ≤ 4 (formwork or rebar phase max), ceiling 12 → no violation
      expect(plan.resource_violations).toHaveLength(0);
    });
  });
});
