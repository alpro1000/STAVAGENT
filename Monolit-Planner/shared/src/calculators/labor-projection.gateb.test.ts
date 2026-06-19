import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import { buildLaborProjection, K_UTIL } from './labor-projection.js';
import { LABOR_NORMS } from './labor-norms.js';

/**
 * §4 parity Gate B — the recommended tesaři crew must come from the engine and
 * be derived from the SAME formwork Nh the labor calc uses
 * (skruz_bedneni_nh_per_m2_kontakt × contact_area), via the rebar pattern. The
 * old frontend 0.6 Nh/m² inline was a duplicate of that norm and is removed.
 */
describe('§4 parity Gate B — tesaři recommendation from the engine formwork norm', () => {
  it('derives formwork_recommended_crew from the SAME Nh as the labor calc', () => {
    const plan = planElement({
      element_type: 'operne_zdi', volume_m3: 120, height_m: 4,
      formwork_area_m2: 120, formwork_contact_area_m2: 300,
      concrete_class: 'C30/37', has_dilatacni_spary: false,
    });
    const proj = buildLaborProjection(plan);
    const contact = plan.formwork.contact_area_m2 ?? 0;
    expect(contact).toBeGreaterThan(0);
    // The recommendation must use the very same totalFwNh the labor table uses.
    const totalFwNh = LABOR_NORMS.skruz_bedneni_nh_per_m2_kontakt.value * contact;
    const expected = Math.max(2, Math.min(8, Math.ceil(totalFwNh / (5 * plan.resources.shift_h * K_UTIL))));
    expect(proj.formwork_recommended_crew).toBe(expected);
  });

  it('§6: prismatic wall without contact → ODHAD from the two-sided box → crew not null', () => {
    const plan = planElement({
      element_type: 'operne_zdi', volume_m3: 120, height_m: 4,
      formwork_area_m2: 120, concrete_class: 'C30/37', has_dilatacni_spary: false,
    });
    // BEFORE #6: contact_area_m2 = 0 (passthrough only) → formwork_recommended_crew = null.
    // AFTER  #6: contact ODHAD = formwork_area_m2 (factor 1.0, two-sided box) → the
    //           skruz_bedneni norm fires → crew derived. Source flagged 'odhad'.
    expect(plan.formwork.contact_area_source).toBe('odhad');
    expect(plan.formwork.contact_area_m2).toBeGreaterThan(0);
    expect(buildLaborProjection(plan).formwork_recommended_crew).not.toBeNull();
    // ODHAD provenance is a visible warning naming the two-sided assumption (#4).
    expect(plan.warnings.some(w => w.includes('ODHAD') && w.includes('dvoustranné'))).toBe(true);
  });

  it('user-supplied contact → source "user", no ODHAD warning', () => {
    const plan = planElement({
      element_type: 'operne_zdi', volume_m3: 120, height_m: 4,
      formwork_area_m2: 120, formwork_contact_area_m2: 300,
      concrete_class: 'C30/37', has_dilatacni_spary: false,
    });
    expect(plan.formwork.contact_area_source).toBe('user');
    expect(plan.formwork.contact_area_m2).toBe(300);
    expect(plan.warnings.some(w => w.includes('Plocha bednění ODHAD'))).toBe(false);
  });

  it('§6: non-prismatic (deck) without contact stays honest-blank → crew null', () => {
    // mostovka is non-prismatic → §6 does NOT derive a contact ODHAD → §4-B
    // honest-blank preserved (no fabricated 0.6, crew null).
    const plan = planElement({
      element_type: 'mostovkova_deska', volume_m3: 200, height_m: 6,
      nk_width_m: 10, span_m: 20, num_spans: 2,
      concrete_class: 'C35/45', has_dilatacni_spary: false,
    });
    expect(plan.formwork.contact_area_m2 ?? 0).toBe(0);
    expect(plan.formwork.contact_area_source).toBeUndefined();
    expect(buildLaborProjection(plan).formwork_recommended_crew).toBeNull();
  });
});
