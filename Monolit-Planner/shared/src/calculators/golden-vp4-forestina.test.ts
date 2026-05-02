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
});
