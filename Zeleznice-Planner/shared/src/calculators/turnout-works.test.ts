/**
 * Výhybky — acceptance 7: kusové konstrukce, h/ks podle tvaru; metrická a
 * kusová metrika se nemíchají; montáž bez normy = honest-blank.
 */
import { describe, expect, it } from 'vitest';
import { calculateTurnoutWorks, findTurnoutForm } from './turnout-works.js';

describe('výhybky jako kusové konstrukce', () => {
  it('J60 1:9-300 ×2 → podbití 2 × střed(0.58–0.75)=0.67 h/ks = 1.34 h', () => {
    const { results } = calculateTurnoutWorks(
      { section_length_m: 1000, track_count: 1, assembly_id: 'UIC60_bezstykova', turnouts: [{ form_id: 'J60_1_9_300', count: 2 }] },
      'bezstykova',
    );
    expect(results[0].podbiti_hours.value).toBeCloseTo(1.34, 2);
    expect(results[0].podbiti_hours.unit).toBe('h');
    expect(results[0].podbiti_hours.formula).toContain('h/ks');
  });

  it('složitý tvar 1:26,5-2500 → vyšší pracnost (3–4.5 h/ks)', () => {
    const { results } = calculateTurnoutWorks(
      { section_length_m: 1000, track_count: 1, assembly_id: 'UIC60_bezstykova', turnouts: [{ form_id: 'J60_1_26_5_2500', count: 1 }] },
      'bezstykova',
    );
    expect(results[0].podbiti_hours.value).toBeCloseTo(3.75, 2);
    expect(results[0].complexity).toBe('slozita');
  });

  it('montáž bez normy v KB → honest-blank + ⚠️; user norma (h/ks) ji doplní', () => {
    const base = { section_length_m: 1000, track_count: 1, assembly_id: 'UIC60_bezstykova', turnouts: [{ form_id: 'J60_1_11_300', count: 3 }] };
    const blank = calculateTurnoutWorks(base, 'bezstykova');
    expect(blank.results[0].montaz_hours.status).toBe('nepocitano');
    expect(blank.warnings.some(w => w.includes('Montáž výhybek'))).toBe(true);

    const withNorm = calculateTurnoutWorks(
      { ...base, user_machine_norms: [{ machine_id: 'jerab_montaz_vyhybek', rate_value: 12, rate_unit: 'h/ks' }] },
      'bezstykova',
    );
    expect(withNorm.results[0].montaz_hours.value).toBe(36);
    expect(withNorm.results[0].montaz_hours.confidence).toBe(0.99);
  });

  it('vevaření do BK: 6 svarů/ks jen u bezstykové; stykovaná → NEPOČÍTÁNO', () => {
    const bk = calculateTurnoutWorks(
      { section_length_m: 1000, track_count: 1, assembly_id: 'UIC60_bezstykova', turnouts: [{ form_id: 'J60_1_9_300', count: 2 }] },
      'bezstykova',
    );
    expect(bk.results[0].bk_svary_ks.value).toBe(12);
    const styk = calculateTurnoutWorks(
      { section_length_m: 1000, track_count: 1, assembly_id: 'S49_stykovana', turnouts: [{ form_id: 'J60_1_9_300', count: 2 }] },
      'stykovana',
    );
    expect(styk.results[0].bk_svary_ks.status).toBe('nepocitano');
  });

  it('neznámý tvar → RailInputError s výčtem povolených', () => {
    expect(() => findTurnoutForm('J60_neexistuje')).toThrowError(/Povolené:/);
  });
});
