/**
 * Tubus path v orchestratoru — AC pins (task v2.1 §5; golden SO 11-20-04).
 * Hermetické: bez sítě/DB/AI (AC13).
 */
import { describe, expect, it } from 'vitest';

import { planElement, UncalculatedError, PlannerInput } from './planner-orchestrator';
import { REBAR_RATES_MATRIX, RebarCategory } from '../classifiers/element-classifier';

const TURNOV_INPUT: PlannerInput = {
  element_type: 'uzavreny_ram_tubus',
  volume_m3: 1046.8,            // výkaz 389325 — primární (Q10)
  concrete_class: 'C30/37',
  exposure_classes: ['XD1', 'XC4', 'XF2', 'XA1'],
  tubus_dc_count: 10,
  tubus_clear_width_m: 5.5,
  tubus_clear_height_m: 3.0,
  tubus_bottom_thickness_m: 0.5,
  tubus_wall_thickness_m: 0.5,
  tubus_top_thickness_m: 0.45,
  tubus_section_length_m: 6.123,
  tubus_visual_concrete: true,      // PB3 + reliéf «Skal»
  tubus_internal_structures: true,  // niky, výtahové šachty, schodiště
};

describe('tubus path — golden SO 11-20-04', () => {
  const plan = planElement(TURNOV_INPUT);

  it('AC4: 10 DC × 3 fáze = 30 betonáží rámu; DC převzat ze vstupu (AC3)', () => {
    expect(plan.tubus).toBeDefined();
    expect(plan.tubus!.dc_count).toBe(10);
    expect(plan.tubus!.pour_count).toBe(30);
    expect(plan.pour_decision.num_tacts).toBe(30);
  });

  it('AC7 (párově): pracovní výška podpěr = 3,0 — a 2,65 ani 0,45 se do ní NEdostanou', () => {
    expect(plan.tubus!.support_height_m).toBe(3.0);
    expect(plan.tubus!.support_height_m).not.toBe(2.65); // volná výška pod podhledem
    expect(plan.tubus!.support_height_m).not.toBe(0.45); // tloušťka stropní desky
  });

  it('AC6: Turnov profil → technologie A konvenční, obě varianty viditelné', () => {
    expect(plan.tubus!.technology.choice).toBe('conventional');
    expect(plan.tubus!.technology.phases_per_dc).toBe(3);
    expect(plan.tubus!.technology.alternative).toBe('traveler');
    expect(plan.tubus!.technology.reasons_cs.length).toBeGreaterThanOrEqual(2);
  });

  it('AC9/§2.5: PB3 → nosníkový stěnový systém (Top 50), R-příplatek v warnings', () => {
    expect(plan.tubus!.wall_formwork_system).toBe('Top 50');
    expect(plan.warnings.join(' ')).toContain('R-položkový příplatek');
  });

  it('AC12: XD1+XC4+XF2+XA1 z golden NEvyvolá varování «neobvyklá kombinace»', () => {
    const w = plan.warnings.join(' ');
    expect(w).not.toMatch(/neobvykl|Vyberte jednu z/i);
  });

  it('Q10: geometrie je cross-check (~562 m³), výkaz 1046,8 se tiše NEnahrazuje', () => {
    expect(plan.tubus!.geometric_volume_m3).toBeCloseTo(561.79, 0);
    expect(plan.pour_decision).toBeDefined(); // plán běží na výkazovém objemu
  });

  it('Q4: per-fáze rozdělení výztuže nese kategorie a hmotnosti dle podílu objemu', () => {
    const per = plan.tubus!.rebar_per_phase;
    expect(per.map(p => p.category)).toEqual(['slabs_foundations', 'walls', 'slabs_foundations']);
    const total = per.reduce((s, p) => s + p.mass_kg, 0);
    expect(total).toBeGreaterThan(0.99 * 1046.8 * 131 * 0.98); // ≈ V × 131 (n=1)
  });
});

describe('tubus path — honest-blank + prefab + traveler', () => {
  it('§2.10: chybějící geometrie → typed NEPOČÍTÁNO s výčtem polí, žádný default', () => {
    expect(() => planElement({
      element_type: 'uzavreny_ram_tubus', volume_m3: 500, tubus_dc_count: 10,
    } as PlannerInput)).toThrowError(UncalculatedError);
    try {
      planElement({ element_type: 'uzavreny_ram_tubus', volume_m3: 500 } as PlannerInput);
    } catch (e) {
      const u = e as UncalculatedError;
      expect(u.uncalculated).toBe(true);
      expect(u.missing_fields).toContain('tubus_dc_count');
      expect(u.missing_fields).toContain('tubus_clear_height_m');
    }
  });

  it('AC2: prefab → žádný opalubkový plán (typed odmítnutí směrem na MCP montáž)', () => {
    expect(() => planElement({
      ...TURNOV_INPUT, construction_mode: 'prefab',
    })).toThrowError(/prefabrikovan/);
  });

  it('AC5: vozík (kolektor 30 konstantních sekcí) → 2 fáze na DC', () => {
    const plan = planElement({
      element_type: 'uzavreny_ram_tubus',
      volume_m3: 900,
      tubus_dc_count: 30,
      tubus_clear_width_m: 3.0,
      tubus_clear_height_m: 2.5,
      tubus_bottom_thickness_m: 0.4,
      tubus_wall_thickness_m: 0.4,
      tubus_top_thickness_m: 0.4,
      tubus_section_length_m: 8,
    });
    expect(plan.tubus!.technology.choice).toBe('traveler');
    expect(plan.tubus!.pour_count).toBe(60);
  });

  it('AC8: vynucená technologie ze vstupu je respektována + zdůvodněna', () => {
    const plan = planElement({ ...TURNOV_INPUT, tubus_technology: 'traveler' });
    expect(plan.tubus!.technology.choice).toBe('traveler');
    expect(plan.tubus!.pour_count).toBe(20);
    expect(plan.warnings.join(' ')).toContain('vynucena vstupem');
  });

  it('Q3: exposure_from_documentation potlačí allow-list varování (bez flagu = standard)', () => {
    const odd = { ...TURNOV_INPUT, exposure_classes: ['XS3'] }; // mořská voda — atyp pro tubus
    const withWarn = planElement(odd);
    expect(withWarn.warnings.join(' ')).toMatch(/XS3|Vyberte/);
    const suppressed = planElement({ ...odd, exposure_from_documentation: true });
    expect(suppressed.warnings.join(' ')).not.toMatch(/XS3.*Vyberte|Vyberte.*XS3/);
  });
});

describe('tubus path — AC8 SKRUŽ vs. STOJKY (oboustranné, živá čísla)', () => {
  it('Turnov: strop 450 mm nad světlou 3,0 m → STOJKY; žádné skruž-varování', () => {
    const plan = planElement(TURNOV_INPUT);
    const support = plan.tubus!.support;
    expect(support.type).toBe('stojky');
    expect(support.load_kn_m2).toBeCloseTo(12.75, 2);
    // Falešná «skruž» na Turnově = třída falešného varování z retro-listu.
    expect(plan.warnings.join(' ')).not.toContain('SKRUŽ');
    expect(plan.decision_log.join(' ')).toContain('STOJKY');
  });

  it('syntetický podjezd 6,5 m / strop 800 mm → SKRUŽ + viditelné varování se statickým posouzením', () => {
    const plan = planElement({
      ...TURNOV_INPUT,
      tubus_clear_height_m: 6.5,
      tubus_top_thickness_m: 0.8,
    });
    const support = plan.tubus!.support;
    expect(support.type).toBe('skruz');
    expect(support.load_kn_m2).toBeCloseTo(21.5, 2);
    const warn = plan.warnings.join(' ');
    expect(warn).toContain('SKRUŽ');
    expect(warn).toContain('statickým posouzením');
    // AC7 drží i tady: pracovní výška = světlá výška, ne tloušťka stropu.
    expect(plan.tubus!.support_height_m).toBe(6.5);
  });
});

describe('tubus path — 2026-07-17 live-finding fixes (lišní pole / pravdivé dropdowny)', () => {
  it('Průměr hlavní výztuže override: D25 řídí normy per fáze — dropdown není ignorován', () => {
    const planDef = planElement(TURNOV_INPUT);
    const plan25 = planElement({ ...TURNOV_INPUT, rebar_diameter_mm: 25 });
    for (const p of plan25.tubus!.rebar_per_phase) {
      expect(p.norm_h_per_t).toBe(
        REBAR_RATES_MATRIX[p.category as RebarCategory][25],
      );
    }
    // ... a liší se od defaultního D16 plánu (walls 12.2 vs 7.2 h/t).
    expect(plan25.tubus!.rebar_per_phase.map(p => p.norm_h_per_t))
      .not.toEqual(planDef.tubus!.rebar_per_phase.map(p => p.norm_h_per_t));
  });

  it('non-prismatic gate: box dims L×W×H NIKDY nefabrikují objem tubusu (dutý rám) — chybějící výkaz = typed NEPOČÍTÁNO', () => {
    const { volume_m3: _drop, ...noVolume } = TURNOV_INPUT;
    const withBoxDims = {
      ...noVolume, length_m: 61.2, width_m: 6.5, height_m: 3.95,
    } as unknown as PlannerInput;
    expect(() => planElement(withBoxDims)).toThrowError(UncalculatedError);
    try {
      planElement(withBoxDims);
    } catch (e) {
      const u = e as UncalculatedError;
      expect(u.uncalculated).toBe(true);
      expect(u.missing_fields).toContain('volume_m3');
    }
  });
});
