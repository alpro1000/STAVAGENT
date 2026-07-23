/**
 * Golden testy rozdělení pražců (TASK §3.3, acceptance 3+4) — tabulka
 * ÚRS 824-1 přílohy se reprodukuje 1:1, včetně pravidla dvojčitého pražce
 * a odlišného vzorce pro pražce Y.
 */
import { describe, expect, it } from 'vitest';
import type { RailPlannerInput } from '../types.js';
import { resolveAssembly } from './resolve.js';
import { calculateTrackQuantities } from './track-quantities.js';

function calc(overrides: Partial<RailPlannerInput>): ReturnType<typeof calculateTrackQuantities> {
  const input: RailPlannerInput = {
    section_length_m: 1000,
    track_count: 1,
    assembly_id: 'UIC60_bezstykova',
    ...overrides,
  };
  return calculateTrackQuantities(input, resolveAssembly(input));
}

describe('rozdělení pražců — golden tabulka §3.3 (1 km, 1 kolej)', () => {
  it.each([
    ['S49_stykovana', 'b', 25, 1360],
    ['S49_stykovana', 'c', 25, 1520],
    ['S49_stykovana', 'd', 25, 1640],
    ['S49_stykovana', 'e', 25, 1840],
    ['R65_stykovana', 'c', 25, 1520],
    ['R65_stykovana', 'd', 25, 1640],
    ['R65_stykovana', 'e', 25, 1840],
    ['S49_bezstykova', 'u', 25, 1680],
    ['UIC60_bezstykova', 'u', 25, 1680],
    ['UIC60_bezstykova', 'u', 20, 1700],
  ])('%s rozdělení %s @ %i m → %i ks/km', (assembly, spacing, fieldLen, expected) => {
    const q = calc({ assembly_id: assembly, spacing_code: spacing, field_length_m: fieldLen });
    expect(q.prazce_ks.status).toBe('ok');
    expect(q.prazce_ks.value).toBe(expected);
    expect(q.prazce_ks.formula).toContain('ks/km');
    expect(q.prazce_ks.source.document).toContain('824-1');
  });

  it('T stykovaná sdílí řádky S49 (b/c/d/e) — ale +dvojčité u styků (dřevěné pražce)', () => {
    // 1 km / pole 25 m → 40 polí → 39 vnitřních styků → +39 dvojčitých
    const q = calc({ assembly_id: 'T_stykovana', spacing_code: 'd' });
    expect(q.prazce_ks.value).toBe(1640 + 39);
    expect(q.prazce_ks.formula).toContain('dvojčitých');
  });

  it('betonové pražce stykované koleje dvojčité NEmají', () => {
    const q = calc({ assembly_id: 'S49_stykovana', spacing_code: 'd' });
    expect(q.prazce_ks.value).toBe(1640);
  });

  it('částečný úsek se zaokrouhluje nahoru po kolejích (500 m S49 d → 820)', () => {
    const q = calc({ assembly_id: 'S49_stykovana', spacing_code: 'd', section_length_m: 500 });
    expect(q.prazce_ks.value).toBe(820);
  });

  it('vícekolejný úsek počítá NA KOLEJ (2 koleje UIC60 u/25 → 3360)', () => {
    const q = calc({ track_count: 2 });
    expect(q.prazce_ks.value).toBe(2 * 1680);
  });
});

describe('pražce Y — samostatný vzorec z rozteče (ne tabulka)', () => {
  it('300 m / rozteč 0.6 m → 500 ks (KB default, conf 0.7 + warning)', () => {
    const q = calc({ assembly_id: 'Y_ocelove_prazce', section_length_m: 300 });
    expect(q.prazce_ks.value).toBe(500);
    expect(q.prazce_ks.confidence).toBe(0.7);
    expect(q.warnings.some(w => w.includes('Rozteč pražců Y'))).toBe(true);
  });

  it('uživatelská rozteč má prioritu (0.5 m → 600 ks, conf 0.99)', () => {
    const q = calc({ assembly_id: 'Y_ocelove_prazce', section_length_m: 300, y_sleeper_spacing_m: 0.5 });
    expect(q.prazce_ks.value).toBe(600);
    expect(q.prazce_ks.confidence).toBe(0.99);
  });
});

describe('kolejnice + upevnění (acceptance 3)', () => {
  it('UIC 60, 1 km, 1 kolej → 2000 m pásů, 120.42 t (60.21 kg/m, EN 13674-1)', () => {
    const q = calc({});
    expect(q.kolejnice_delka_m.value).toBe(2000);
    expect(q.kolejnice_hmotnost_t.value).toBeCloseTo(120.42, 2);
    expect(q.kolejnice_hmotnost_t.source.document).toContain('13674');
  });

  it('tvar T bez hmotnosti v KB → honest-blank (žádná fabrikace)', () => {
    const q = calc({ assembly_id: 'T_stykovana' });
    expect(q.kolejnice_hmotnost_t.status).toBe('nepocitano');
    expect(q.kolejnice_hmotnost_t.value).toBeNull();
    expect(q.warnings.some(w => w.includes('Hmotnost kolejnic NEPOČÍTÁNA'))).toBe(true);
  });

  it('upevnění = pražce × uzly (betonové 2/pražec; Y 3/pražec)', () => {
    const beton = calc({});
    expect(beton.upevneni_komplety_ks.value).toBe(1680 * 2);
    const y = calc({ assembly_id: 'Y_ocelove_prazce', section_length_m: 300 });
    expect(y.upevneni_komplety_ks.value).toBe(500 * 3);
  });

  it('hmotnost pražců pro dopravu (1680 × 304 kg → 510.72 t)', () => {
    const q = calc({});
    expect(q.prazce_hmotnost_t.value).toBeCloseTo(510.72, 1);
  });
});

describe('styky vs svary — stykovaná/bezstyková se nemíchají', () => {
  it('stykovaná 1 km: 40 polí, 78 vnitřních styků; svary NEPOČÍTÁNY', () => {
    const q = calc({ assembly_id: 'S49_stykovana' });
    expect(q.kolejova_pole_ks.value).toBe(40);
    expect(q.styky_ks.value).toBe(39 * 2);
    expect(q.svary_mezipasove_ks.status).toBe('nepocitano');
  });

  it('bezstyková 1 km, dodávka 75 m: 13 svarů/pás → 26; závěrné 4; pole NEPOČÍTÁNA', () => {
    const q = calc({});
    expect(q.svary_mezipasove_ks.value).toBe((Math.ceil(1000 / 75) - 1) * 2);
    expect(q.zaverne_svary_ks.value).toBe(4);
    expect(q.kolejova_pole_ks.status).toBe('nepocitano');
  });

  it('uživatelská dodávaná délka pásů (120 m → 8 svarů/pás → 16, conf 0.99)', () => {
    const q = calc({ rail_delivery_length_m: 120 });
    expect(q.svary_mezipasove_ks.value).toBe((Math.ceil(1000 / 120) - 1) * 2);
    expect(q.svary_mezipasove_ks.confidence).toBe(0.99);
  });
});

describe('replay guarantee — každé číslo nese vzorec a zdroj', () => {
  it('všechny OK výměry mají neprázdný formula + source.document', () => {
    const q = calc({});
    for (const key of ['prazce_ks', 'kolejnice_delka_m', 'kolejnice_hmotnost_t', 'upevneni_komplety_ks'] as const) {
      const quantity = q[key];
      expect(quantity.formula.length).toBeGreaterThan(3);
      expect(quantity.source.document.length).toBeGreaterThan(2);
      expect(quantity.confidence).toBeGreaterThan(0);
    }
  });
});
