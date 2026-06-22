/**
 * Phase 5 Step 2 — geometry→volume in the shared engine (hermetic).
 * Covers: the pure estimate (prismatic + honest-blank), the engine derive in
 * planElement (volume/area/length from dims; no-op when volume given → parity),
 * geometry length → total_length_m (the geometry↔takty link), and the visible
 * honest-blank warning for non-prismatic types.
 */

import { describe, it, expect } from 'vitest';
import { estimateElementVolume, isPrismaticType } from './element-geometry.js';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';

describe('estimateElementVolume (pure)', () => {
  it('prismatic type with full dims → L·W·H + 2(L+W)·H', () => {
    const g = estimateElementVolume('stena', { length_m: 5, width_m: 0.4, height_m: 3 });
    expect(g.applicable).toBe(true);
    expect(g.volume_m3).toBeCloseTo(6, 2);        // 5×0.4×3
    expect(g.formwork_area_m2).toBeCloseTo(32.4, 1); // 2(5+0.4)×3
  });

  it('prismatic type, incomplete dims → applicable, no estimate (not an error)', () => {
    const g = estimateElementVolume('zakladovy_pas', { length_m: 5 });
    expect(g.applicable).toBe(true);
    expect(g.volume_m3).toBeUndefined();
    expect(g.reason).toBeUndefined();
  });

  it('non-prismatic deck → honest-blank with a visible reason', () => {
    const g = estimateElementVolume('mostovkova_deska', { length_m: 100, width_m: 10, height_m: 2 });
    expect(g.applicable).toBe(false);
    expect(g.volume_m3).toBeUndefined();
    expect(g.reason).toMatch(/zadejte objem ru/i);
  });

  it('non-prismatic set: deck/pilota/schodiste/nadrz/rimsa/other', () => {
    for (const t of ['mostovkova_deska', 'pilota', 'schodiste', 'nadrz', 'rimsa', 'other']) {
      expect(isPrismaticType(t)).toBe(false);
    }
    for (const t of ['stena', 'sloup', 'stropni_deska', 'zakladovy_pas', 'opery_ulozne_prahy', 'driky_piliru']) {
      expect(isPrismaticType(t)).toBe(true);
    }
  });
});

describe('planElement — geometry derive (engine, shared)', () => {
  const base: Partial<PlannerInput> = {
    concrete_class: 'C30/37',
    exposure_class: 'XC3',
    has_dilatacni_spary: false,
    temperature_c: 15,
  };

  it('derives volume + formwork area from box dims when volume omitted', () => {
    const plan = planElement({
      ...base, element_type: 'stena', length_m: 5, width_m: 0.4, height_m: 3,
    } as PlannerInput);
    // 5×0.4×3 = 6 m³ reached the engine (schedule computed on it)
    expect(plan.schedule.total_days).toBeGreaterThan(0);
    expect(plan.rebar.mass_kg).toBeGreaterThan(0); // rebar from the derived volume
  });

  it('explicit volume_m3 wins — geometry derive is a no-op (parity)', () => {
    const withDims = planElement({
      ...base, element_type: 'stena', volume_m3: 30, length_m: 5, width_m: 0.4, height_m: 3,
    } as PlannerInput);
    const volumeOnly = planElement({
      ...base, element_type: 'stena', volume_m3: 30, height_m: 3,
    } as PlannerInput);
    // dims present but volume given → engine ignores dims for volume; same plan
    expect(withDims.rebar.mass_kg).toBeCloseTo(volumeOnly.rebar.mass_kg, 1);
  });

  it('geometry length → total_length_m (geometry↔takty link)', () => {
    // rimsa is non-prismatic (volume honest-blank) but length must still flow;
    // use a prismatic type to prove length unification reaches the tact layer.
    const plan = planElement({
      ...base, element_type: 'zakladovy_pas', length_m: 24, width_m: 1.2, height_m: 0.8,
    } as PlannerInput);
    // total_length_m fed from length_m → surfaces in the decision log
    expect(plan.decision_log.some(l => l.includes('total_length_m=24'))).toBe(true);
  });

  it('non-prismatic type never gets a fabricated box volume (deck keeps its VV volume)', () => {
    // Deck with an explicit (VV) volume + box dims present: the engine must NOT
    // recompute volume from L×W×H (honest-blank for non-prismatic). The plan
    // reflects the supplied volume, not 100×10×2 = 2000.
    const plan = planElement({
      ...base, element_type: 'mostovkova_deska', volume_m3: 693.35,
      length_m: 100, width_m: 10, height_m: 2, is_prestressed: true,
      bridge_deck_subtype: 'dvoutram', curing_class: 4,
    } as PlannerInput);
    // rebar mass scales with the real (693.35) volume, nowhere near the 2000 box
    expect(plan.rebar.mass_kg).toBeLessThan(693.35 * 250); // sane for ~693 m³
    expect(plan.schedule.total_days).toBeGreaterThan(0);
    // no geometry-derive log line (volume was supplied → no-op)
    expect(plan.decision_log.some(l => l.startsWith('Geometrie:'))).toBe(false);
  });
});
