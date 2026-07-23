/**
 * Kolejové lože — acceptance 5: objem z příčného profilu; chybějící profil
 * → honest-blank s důvodem, NIKDY paušál ani nula.
 */
import { describe, expect, it } from 'vitest';
import type { RailPlannerInput } from '../types.js';
import { calculateBallast } from './ballast.js';
import { resolveAssembly } from './resolve.js';

function run(overrides: Partial<RailPlannerInput>) {
  const input: RailPlannerInput = {
    section_length_m: 1000,
    track_count: 1,
    assembly_id: 'UIC60_bezstykova',
    ...overrides,
  };
  return calculateBallast(input, resolveAssembly(input));
}

describe('kolejové lože z příčného profilu (nikdy paušál)', () => {
  it('bez profilu → NEPOČÍTÁNO s důvodem (ne nula, ne paušál)', () => {
    const b = run({});
    expect(b.loze_objem_m3.status).toBe('nepocitano');
    expect(b.loze_objem_m3.value).toBeNull();
    expect(b.loze_objem_m3.reason_cs).toContain('příčný profil');
    expect(b.warnings.some(w => w.startsWith('⚠️'))).toBe(true);
  });

  it('parametricky: A = 3.4×0.35 + 1.25×0.35² = 1.343125 m² → 1343.1 m³/km', () => {
    const b = run({
      ballast_profile: {
        mode: 'parametric',
        thickness_under_sleeper_m: 0.35,
        crown_width_m: 3.4,
        slope_ratio: 1.25,
      },
    });
    expect(b.loze_prurez_m2.value).toBeCloseTo(1.343125, 5);
    expect(b.loze_objem_m3.value).toBeCloseTo(1343.1, 1);
    expect(b.loze_objem_m3.formula).toContain('1.343125');
  });

  it('plocha z řezu: 4.2 m² × 1000 m = 4200 m³ (conf 0.99, celá formace ×1)', () => {
    const b = run({ track_count: 2, ballast_profile: { mode: 'area', area_m2: 4.2 } });
    expect(b.loze_objem_m3.value).toBe(4200);
    expect(b.loze_objem_m3.confidence).toBe(0.99);
  });

  it('KB preset → hodnoty vzorového listu + povinné ⚠️ potvrzení', () => {
    const b = run({ ballast_profile: { mode: 'preset', preset_id: 'jednokolejna_bezstykova' } });
    expect(b.loze_objem_m3.status).toBe('ok');
    expect(b.loze_objem_m3.confidence).toBeLessThanOrEqual(0.8);
    expect(b.warnings.some(w => w.includes('MUSÍ být potvrzen'))).toBe(true);
  });

  it('vícekolejný parametrický profil → ×koleje + warning o mezikolejním prostoru', () => {
    const b = run({
      track_count: 2,
      ballast_profile: {
        mode: 'parametric',
        thickness_under_sleeper_m: 0.35,
        crown_width_m: 3.4,
        slope_ratio: 1.25,
      },
    });
    expect(b.loze_objem_m3.value).toBeCloseTo(2 * 1343.1, 0);
    expect(b.warnings.some(w => w.includes('mezikolejní prostor'))).toBe(true);
  });

  it('neznámý preset → RailInputError s výčtem povolených', () => {
    expect(() => run({ ballast_profile: { mode: 'preset', preset_id: 'neexistuje' } })).toThrowError(
      /Povolené:/,
    );
  });

  it('převýšení v oblouku → ℹ️ dopad na objem (nezapočteno)', () => {
    const b = run({
      cant_max_mm: 150,
      ballast_profile: { mode: 'preset', preset_id: 'jednokolejna_bezstykova' },
    });
    expect(b.warnings.some(w => w.includes('Převýšení'))).toBe(true);
  });
});
