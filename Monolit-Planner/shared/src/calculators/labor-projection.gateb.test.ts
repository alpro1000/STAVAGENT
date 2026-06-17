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

  it('is null without a contact-area norm basis (honest-blank, no fabricated 0.6)', () => {
    const plan = planElement({
      element_type: 'operne_zdi', volume_m3: 120, height_m: 4,
      formwork_area_m2: 120, concrete_class: 'C30/37', has_dilatacni_spary: false,
    });
    expect(plan.formwork.contact_area_m2 ?? 0).toBe(0);
    expect(buildLaborProjection(plan).formwork_recommended_crew).toBeNull();
  });
});
