import { describe, it, expect } from 'vitest';
import { planElement } from '@stavagent/monolit-shared';
import { pourCrewRecommended } from './helpers';

/**
 * §4 parity Gate A — the Betonáž card's "Betonáři / záběr" number must come
 * from the engine (resources.pour_crew_breakdown.total), not a UI re-derive.
 * Before the fix the card recomputed max(3, ceil(tactVol/20)) inline, which
 * diverged from the engine for non-trivial pours (engine 5 vs inline 6 on
 * operne_zdi 120 / mostovka 664).
 */
describe('pourCrewRecommended — card reads the engine pour crew', () => {
  it('returns exactly resources.pour_crew_breakdown.total (single source)', () => {
    const plan = planElement({
      element_type: 'operne_zdi', volume_m3: 120, height_m: 4,
      concrete_class: 'C30/37', has_dilatacni_spary: false,
    });
    expect(pourCrewRecommended(plan)).toBe(plan.resources.pour_crew_breakdown.total);
  });

  it('structural pour < 20 m³ → 3 (2 ukládka + 1 vibrace, řízení 0)', () => {
    const plan = planElement({
      element_type: 'stena', volume_m3: 15, height_m: 3,
      concrete_class: 'C25/30', has_dilatacni_spary: false,
    });
    const bd = plan.resources.pour_crew_breakdown;
    expect(bd.total).toBe(3);
    expect(bd.ukladani + bd.vibrace).toBe(3);
    expect(bd.rizeni).toBe(0);
    expect(pourCrewRecommended(plan)).toBe(3);
  });

  it('reads the engine value where it diverges from the old inline max(3, ceil(V/20))', () => {
    const plan = planElement({
      element_type: 'mostovkova_deska', volume_m3: 664, height_m: 8,
      formwork_area_m2: 1000, concrete_class: 'C35/45',
      span_m: 30, num_spans: 1, has_dilatacni_spary: false,
    });
    const engineTotal = plan.resources.pour_crew_breakdown.total;
    expect(pourCrewRecommended(plan)).toBe(engineTotal);
    // prove the new source genuinely differs from the retired UI formula
    const tactVol = plan.pour_decision.tact_volume_m3 ?? 0;
    const oldInline = Math.min(10, Math.max(3, Math.ceil(tactVol / 20)));
    expect(pourCrewRecommended(plan)).not.toBe(oldInline);
  });
});
