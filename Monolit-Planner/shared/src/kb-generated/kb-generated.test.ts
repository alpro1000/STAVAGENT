/**
 * Knowledge codegen round-trip integrity tests.
 *
 * Verifies that generated modules:
 *  - Export expected symbols
 *  - Values match source YAML expectations
 *  - Engines that consume them (maturity, lateral-pressure, formwork)
 *    still expose backward-compatible behavior
 *
 * Source: docs/specs/knowledge-codegen-pipeline/tasks.md T7
 */

import { describe, it, expect } from 'vitest';

// ─── TKP18 maturity ─────────────────────────────────────────────────────

import {
  CURING_DAYS_TABLE,
  EXPOSURE_MIN_CURING_DAYS,
  TKP18_ABSOLUTE_MIN_DAYS,
  CEMENT_SPEED,
  T_DATUM,
  DEFAULT_CURING_CLASS_BY_ELEMENT,
  ZDS_EXCEPTION,
  SOURCE_CITATION as TKP18_CITATION,
} from './tkp18-maturity.js';

describe('kb-generated: tkp18-maturity', () => {
  it('exports CURING_DAYS_TABLE with 5 temperature bands', () => {
    expect(CURING_DAYS_TABLE).toHaveLength(5);
  });

  it('table covers full temperature range -5°C → 50°C without gaps', () => {
    const sorted = [...CURING_DAYS_TABLE].sort((a, b) => a.temp_min - b.temp_min);
    expect(sorted[0].temp_min).toBe(-5);
    expect(sorted[sorted.length - 1].temp_max).toBe(50);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].temp_min).toBe(sorted[i - 1].temp_max);
    }
  });

  it('every row carries all 3 concrete groups × 3 curing classes (45 cells total)', () => {
    let cellCount = 0;
    for (const row of CURING_DAYS_TABLE) {
      const groups = Object.keys(row.days);
      expect(groups).toEqual(expect.arrayContaining(['C12-C16', 'C20-C25', 'C30+']));
      for (const g of groups) {
        const classes = Object.keys(row.days[g]);
        expect(classes).toEqual(expect.arrayContaining(['2', '3', '4']));
        cellCount += 3;
      }
    }
    expect(cellCount).toBe(45);
  });

  it('exposure-class minimums include XF/XD/XS/XA per TKP18 §7.8.3', () => {
    expect(EXPOSURE_MIN_CURING_DAYS.XF1).toBe(5);
    expect(EXPOSURE_MIN_CURING_DAYS.XF4).toBe(7);
    expect(EXPOSURE_MIN_CURING_DAYS.XD3).toBe(7);
    expect(EXPOSURE_MIN_CURING_DAYS.XS3).toBe(7);
    expect(EXPOSURE_MIN_CURING_DAYS.XA3).toBe(7);
  });

  it('TKP18 absolute minimum is 5 days for PK bridges', () => {
    expect(TKP18_ABSOLUTE_MIN_DAYS).toBe(5);
  });

  it('cement speed factor: CEM_I=1, CEM_II=0.85, CEM_III=0.6', () => {
    expect(CEMENT_SPEED.CEM_I).toBe(1);
    expect(CEMENT_SPEED.CEM_II).toBe(0.85);
    expect(CEMENT_SPEED.CEM_III).toBe(0.6);
  });

  it('Nurse-Saul datum temperature is -10°C', () => {
    expect(T_DATUM).toBe(-10);
  });

  it('superstructure elements (mostovkova_deska, rimsa, rigel) default to curing class 4', () => {
    expect(DEFAULT_CURING_CLASS_BY_ELEMENT.mostovkova_deska).toBe(4);
    expect(DEFAULT_CURING_CLASS_BY_ELEMENT.rimsa).toBe(4);
    expect(DEFAULT_CURING_CLASS_BY_ELEMENT.rigel).toBe(4);
  });

  it('substructure elements (opery, driky, zaklady_piliru, kridla) default to curing class 3', () => {
    expect(DEFAULT_CURING_CLASS_BY_ELEMENT.opery_ulozne_prahy).toBe(3);
    expect(DEFAULT_CURING_CLASS_BY_ELEMENT.driky_piliru).toBe(3);
    expect(DEFAULT_CURING_CLASS_BY_ELEMENT.zaklady_piliru).toBe(3);
    expect(DEFAULT_CURING_CLASS_BY_ELEMENT.kridla_opery).toBe(3);
  });

  it('ZDS exception default = 5 days, XF3/XF4 = 7 days', () => {
    expect(ZDS_EXCEPTION.default_days).toBe(5);
    expect(ZDS_EXCEPTION.xf3_xf4_days).toBe(7);
  });

  it('source citation references TKP18 06/2025 PDF on pjpk.rsd.cz', () => {
    expect(TKP18_CITATION.pdf_reference).toContain('pjpk.rsd.cz');
    expect(TKP18_CITATION.norm).toContain('TKP18');
  });
});

// ─── ÚRS/OTSKP routing ──────────────────────────────────────────────────

import {
  URS_OTSKP_ROUTING,
  getCatalogPriority,
} from './urs-otskp-routing.js';

describe('kb-generated: urs-otskp-routing', () => {
  it('routes verejna project → OTSKP primary', () => {
    expect(getCatalogPriority('verejna')[0]).toBe('OTSKP');
  });

  it('routes privatni project → URS primary (OTSKP irrelevant)', () => {
    const order = getCatalogPriority('privatni');
    expect(order[0]).toBe('URS');
    expect(order).not.toContain('OTSKP');
  });

  it('routes design_build project → URS + OTSKP both columns', () => {
    const order = getCatalogPriority('design_build');
    expect(order).toEqual(expect.arrayContaining(['URS', 'OTSKP']));
    expect(order).toHaveLength(2);
  });

  it('every project type carries non-empty source_examples', () => {
    for (const t of ['verejna', 'privatni', 'design_build'] as const) {
      expect(URS_OTSKP_ROUTING[t].source_examples.length).toBeGreaterThan(0);
    }
  });

  it('unknown project type defaults to URS (safe fallback)', () => {
    // @ts-expect-error testing runtime safety with invalid input
    expect(getCatalogPriority('unknown_type')).toEqual(['URS']);
  });
});

// ─── DOKA Frami catalog ─────────────────────────────────────────────────

import { KB_DOKA_FORMWORK_SYSTEMS } from './doka-frami-catalog.js';

describe('kb-generated: doka-frami-catalog', () => {
  it('exports 10 DOKA systems (Frami, Framax, Top 50, Dokaflex, SL-1, 3× Římsové, Staxo, MSS)', () => {
    expect(KB_DOKA_FORMWORK_SYSTEMS.length).toBe(10);
  });

  it('every system has DOKA manufacturer', () => {
    for (const s of KB_DOKA_FORMWORK_SYSTEMS) {
      expect(s.manufacturer).toBe('DOKA');
    }
  });

  it('every system carries a positive assembly_h_m2 norm', () => {
    for (const s of KB_DOKA_FORMWORK_SYSTEMS) {
      expect(s.assembly_h_m2).toBeGreaterThan(0);
    }
  });

  it('Frami Xlife pressure is 80 kN/m² (BUG 6 baseline)', () => {
    const frami = KB_DOKA_FORMWORK_SYSTEMS.find(s => s.name === 'Frami Xlife');
    expect(frami).toBeDefined();
    expect(frami!.pressure_kn_m2).toBe(80);
  });

  it('Framax Xlife pressure is 120 kN/m² (BUG 6 fixed value, TIE+walers)', () => {
    const framax = KB_DOKA_FORMWORK_SYSTEMS.find(s => s.name === 'Framax Xlife');
    expect(framax).toBeDefined();
    expect(framax!.pressure_kn_m2).toBe(120);
  });

  it('DOKA MSS has mss_reuse_factor 0.35 + rental 0 (bundled cost)', () => {
    const mss = KB_DOKA_FORMWORK_SYSTEMS.find(s => s.name === 'DOKA MSS');
    expect(mss).toBeDefined();
    expect(mss!.mss_reuse_factor).toBe(0.35);
    expect(mss!.rental_czk_m2_month).toBe(0);
    expect(mss!.pour_role).toBe('mss_integrated');
  });

  it('Římsová systems use unit=bm (not m2)', () => {
    const rims = KB_DOKA_FORMWORK_SYSTEMS.filter(s => s.name.startsWith('Římsov'));
    expect(rims.length).toBeGreaterThanOrEqual(2);
    for (const r of rims) {
      expect(r.unit).toBe('bm');
    }
  });

  it('Staxo 100 is pour_role=props with applicable_element_types including mostovkova_deska', () => {
    const staxo = KB_DOKA_FORMWORK_SYSTEMS.find(s => s.name === 'Staxo 100');
    expect(staxo).toBeDefined();
    expect(staxo!.pour_role).toBe('props');
    expect(staxo!.applicable_element_types).toContain('mostovkova_deska');
  });
});

// ─── Lateral pressure formulas ──────────────────────────────────────────

import {
  LATERAL_PRESSURE_CONSTANTS,
  K_FACTORS_BY_CONSISTENCY,
  POUR_RATE_TO_K,
  RHO_KG_M3,
  G_M_S2,
  getKFactorForConsistency,
  getKFromPourRate,
} from './lateral-pressure-formulas.js';

describe('kb-generated: lateral-pressure-formulas', () => {
  it('exports ρ=2400 kg/m³, g=9.81 m/s²', () => {
    expect(RHO_KG_M3).toBe(2400);
    expect(G_M_S2).toBe(9.81);
    expect(LATERAL_PRESSURE_CONSTANTS.rho_kg_m3).toBe(2400);
    expect(LATERAL_PRESSURE_CONSTANTS.g_m_s2).toBe(9.81);
  });

  it('k-factors: standard=0.85, plastic=1.0, scc=1.5 (DIN 18218)', () => {
    expect(K_FACTORS_BY_CONSISTENCY.standard).toBe(0.85);
    expect(K_FACTORS_BY_CONSISTENCY.plastic).toBe(1.0);
    expect(K_FACTORS_BY_CONSISTENCY.scc).toBe(1.5);
  });

  it('getKFactorForConsistency returns expected values', () => {
    expect(getKFactorForConsistency('standard')).toBe(0.85);
    expect(getKFactorForConsistency('plastic')).toBe(1.0);
    expect(getKFactorForConsistency('scc')).toBe(1.5);
  });

  it('pour-rate bands cover [≤1, 1–2, >2] m/h with k=1.0, 1.2, 1.5', () => {
    expect(POUR_RATE_TO_K.length).toBe(3);
    expect(getKFromPourRate(0.5)).toBe(1.0);
    expect(getKFromPourRate(1.5)).toBe(1.2);
    expect(getKFromPourRate(3.0)).toBe(1.5);
  });
});

// ─── Pour sequences (Pokorný/Suchánek) ──────────────────────────────────

import {
  POUR_SEQUENCES,
  getPourSequence,
} from './ucebnice-mostu-pour.js';

describe('kb-generated: ucebnice-mostu-pour', () => {
  it('covers core mostní elements (zaklady, driky, opery, mostovka, rimsa, pilota)', () => {
    const required = [
      'zaklady_piliru',
      'driky_piliru',
      'opery_ulozne_prahy',
      'mostovkova_deska',
      'rimsa',
      'pilota',
    ];
    for (const el of required) {
      expect(POUR_SEQUENCES[el], `missing ${el}`).toBeDefined();
    }
  });

  it('rimsa sequence enforces chess pattern (lichá then sudá)', () => {
    const rimsa = getPourSequence('rimsa');
    expect(rimsa).toBeDefined();
    expect(rimsa!.recommended_sequence[0].zone).toMatch(/lich/i);
    expect(rimsa!.recommended_sequence[1].zone).toMatch(/sud/i);
  });

  it('pilota workflow lists drilling → armokoš → betonáž kontraktorem → hlava', () => {
    const pilota = getPourSequence('pilota');
    expect(pilota).toBeDefined();
    expect(pilota!.recommended_sequence.length).toBeGreaterThanOrEqual(4);
    expect(pilota!.recommended_sequence[0].zone).toMatch(/vrtán|pažen|bentonit/i);
    expect(pilota!.recommended_sequence.some(s => /armoko/i.test(s.zone))).toBe(true);
    expect(pilota!.recommended_sequence.some(s => /kontraktor|tremi/i.test(s.zone))).toBe(true);
  });

  it('every sequence carries a source_section citation', () => {
    for (const [el, seq] of Object.entries(POUR_SEQUENCES)) {
      expect(seq.source_section, `${el} missing source_section`).toBeTruthy();
    }
  });

  it('getPourSequence returns undefined for unknown element', () => {
    expect(getPourSequence('totally_made_up_element')).toBeUndefined();
  });
});

// ─── Engine wire-up — backward compatibility ────────────────────────────

import { calculateCuring, getDefaultCuringClass } from '../calculators/maturity.js';
import { getConsistencyKFactor } from '../calculators/lateral-pressure.js';
import { FORMWORK_SYSTEMS, findFormworkSystem } from '../constants-data/formwork-systems.js';

describe('kb-generated: engine wire-up backward compat', () => {
  it('maturity engine uses KB curing class defaults', () => {
    expect(getDefaultCuringClass('mostovkova_deska')).toBe(4);
    expect(getDefaultCuringClass('opery_ulozne_prahy')).toBe(3);
    expect(getDefaultCuringClass('pilota')).toBe(2);  // not in KB map → fallback
  });

  it('maturity engine returns sane values for C30/37 + 15°C + class 2', () => {
    const result = calculateCuring({
      concrete_class: 'C30/37',
      temperature_c: 15,
      cement_type: 'CEM_I',
      element_type: 'slab',
      curing_class: 2,
    });
    expect(result.min_curing_days).toBeGreaterThan(0);
    expect(result.min_curing_days).toBeLessThan(10);
  });

  it('lateral pressure engine uses KB k-factors', () => {
    expect(getConsistencyKFactor('standard')).toBe(0.85);
    expect(getConsistencyKFactor('scc')).toBe(1.5);
  });

  it('formwork catalog still resolves all DOKA systems by name (after KB swap)', () => {
    expect(findFormworkSystem('Frami Xlife')).toBeDefined();
    expect(findFormworkSystem('Framax Xlife')).toBeDefined();
    expect(findFormworkSystem('Top 50')).toBeDefined();
    expect(findFormworkSystem('Dokaflex')).toBeDefined();
    expect(findFormworkSystem('Staxo 100')).toBeDefined();
    expect(findFormworkSystem('DOKA MSS')).toBeDefined();
  });

  it('FORMWORK_SYSTEMS contains both KB DOKA + hardcoded PERI/ULMA/NOE entries', () => {
    const manufacturers = new Set(FORMWORK_SYSTEMS.map(s => s.manufacturer));
    expect(manufacturers.has('DOKA')).toBe(true);
    expect(manufacturers.has('PERI')).toBe(true);
  });
});
