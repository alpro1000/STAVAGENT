/**
 * tubus-engine — hermetické testy (24. typ, task v2.1, PR1 Wave 2).
 * Kalibrace: golden test-data/tz/SO-11-20-04_podchod_golden_test.md §2.2/§2.3.
 * Turnov DC: L = 61,23/10 = 6,123 m · W 5,5 · H 3,0 · tb/tw 0,5 · tt 0,45.
 */
import { describe, expect, it } from 'vitest';

import {
  computeTubusPhases,
  decideTubusTechnology,
  tubusGeometricVolume,
  tubusPourCount,
  TUBUS_PHASE_REBAR_CATEGORY,
  TubusGeometry,
} from './tubus-engine';

const TURNOV: TubusGeometry = {
  dc_count: 10,
  clear_width_m: 5.5,
  clear_height_m: 3.0,
  bottom_thickness_m: 0.5,
  wall_thickness_m: 0.5,
  top_thickness_m: 0.45,
  section_length_m: 6.123,
};

describe('computeTubusPhases — §2.10 deterministic geometry (Turnov)', () => {
  const phases = computeTubusPhases(TURNOV);
  const byKey = Object.fromEntries(phases.map(p => [p.phase, p]));

  it('emits exactly the three frame phases in construction order', () => {
    expect(phases.map(p => p.phase)).toEqual(['spodni_deska', 'steny', 'stropni_deska']);
  });

  it('bottom slab: outer width carries both walls (5.5 + 2×0.5 = 6.5)', () => {
    expect(byKey.spodni_deska.volume_m3_per_dc).toBeCloseTo(6.123 * 6.5 * 0.5, 2); // 19.90
    expect(byKey.spodni_deska.formwork_m2_per_dc).toBeCloseTo(2 * (6.123 + 6.5) * 0.5, 2); // 12.62
  });

  it('walls: both faces of both walls at CLEAR height 3.0', () => {
    expect(byKey.steny.volume_m3_per_dc).toBeCloseTo(2 * 6.123 * 3.0 * 0.5, 2); // 18.37
    expect(byKey.steny.formwork_m2_per_dc).toBeCloseTo(4 * 6.123 * 3.0, 2); // 73.48
  });

  it('top slab: soffit = section × CLEAR width + edge strip', () => {
    expect(byKey.stropni_deska.volume_m3_per_dc).toBeCloseTo(6.123 * 6.5 * 0.45, 2); // 17.91
    expect(byKey.stropni_deska.formwork_m2_per_dc).toBeCloseTo(
      6.123 * 5.5 + 2 * (6.123 + 6.5) * 0.45, 2); // 45.04
  });

  it('AC14 anchor: top slab (tl. 450 mm) NEVER gets the V/0.25 heuristic area', () => {
    // Zakázaná breakdown heuristika (pin #1514) by dala 17.91 / 0.25 = 71.65 m².
    const forbidden = byKey.stropni_deska.volume_m3_per_dc / 0.25;
    expect(Math.abs(byKey.stropni_deska.formwork_m2_per_dc - forbidden)).toBeGreaterThan(20);
  });

  it('Q4: per-phase rebar categories — slabs for dno+strop, walls for stěny', () => {
    expect(byKey.spodni_deska.rebar_category).toBe('slabs_foundations');
    expect(byKey.steny.rebar_category).toBe('walls');
    expect(byKey.stropni_deska.rebar_category).toBe('slabs_foundations');
    expect(TUBUS_PHASE_REBAR_CATEGORY.steny).toBe('walls');
  });
});

describe('tubusGeometricVolume — cross-check, never a replacement (Q10)', () => {
  it('Turnov: ~562 m³ geometric tubus vs 1 046.8 m³ výkaz (incl. schodiště) — the gap is DOCUMENTED, not an error', () => {
    const v = tubusGeometricVolume(TURNOV);
    expect(v).toBeCloseTo(561.79, 0);
    // Výkaz 389325 kryje rám podchodu I schodišť — geometrie samotného tubusu
    // je ~54 % položky. Engine tohle NIKDY tiše nesrovnává na výkaz.
    expect(v).toBeLessThan(1046.8);
  });
});

describe('decideTubusTechnology — §2.4 data-driven, both calibration cases', () => {
  it('Turnov profile (10 DC but PB3 relief + shafts/stairs + two staged pits) → A conventional', () => {
    const d = decideTubusTechnology({
      dc_count: 10, visual_concrete: true, internal_structures: true, staged_pits: true,
    });
    expect(d.choice).toBe('conventional');
    expect(d.phases_per_dc).toBe(3);
    expect(d.alternative).toBe('traveler');
    expect(d.reasons_cs.length).toBeGreaterThanOrEqual(3);
    // 10 DC by mluvilo pro vozík — zdůvodnění to musí přiznat (obě varianty viditelné).
    expect(d.reasons_cs.join(' ')).toContain('vozík');
  });

  it('kolektor, 30 constant sections → B traveler (walls+top = one pour, 2 phases)', () => {
    const d = decideTubusTechnology({ dc_count: 30 });
    expect(d.choice).toBe('traveler');
    expect(d.phases_per_dc).toBe(2);
    expect(d.alternative).toBe('conventional');
  });

  it('small propustek (3 DC, clean section) → conventional (mobilizace vozíku se nevrátí)', () => {
    const d = decideTubusTechnology({ dc_count: 3 });
    expect(d.choice).toBe('conventional');
    expect(d.phases_per_dc).toBe(3);
  });
});

describe('tubusPourCount — §2.3 / golden AC4', () => {
  it('10 DC × 3 fáze (konvenční) = 30 betonáží rámu', () => {
    expect(tubusPourCount(10, 3)).toBe(30);
  });
  it('10 DC × 2 fáze (vozík) = 20 betonáží rámu', () => {
    expect(tubusPourCount(10, 2)).toBe(20);
  });
});
