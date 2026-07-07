/**
 * Phase 5 Step 1 — project wrapper tests (hermetic, no AI/network).
 * Proves: (1) one-element parity — planProject([x]).elements[0].plan ≡
 * planElement(x); (2) project aggregation sums volume/Nh/money/schedule;
 * (3) honest-blank — a failing element is isolated + counted, never voids
 * the project; (4) empty project → schedule null (NEPOČÍTÁNO).
 */

import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';
import { planProject } from './project-planner.js';
import { buildLaborProjection } from './labor-projection.js';

const WALL: PlannerInput = {
  element_type: 'stena',
  volume_m3: 30,
  concrete_class: 'C25/30',
  exposure_class: 'XC3',
  height_m: 2.8,
  has_dilatacni_spary: false,
  temperature_c: 15,
};

const FOOTING: PlannerInput = {
  element_type: 'zaklady_piliru',
  volume_m3: 45,
  concrete_class: 'C30/37',
  exposure_class: 'XF1',
  has_dilatacni_spary: false,
  temperature_c: 15,
};

describe('planProject — one-element parity (Path A back-compat)', () => {
  it('planProject([x]).elements[0].plan deep-equals planElement(x)', () => {
    const direct = planElement(WALL);
    const viaProject = planProject([WALL]);
    expect(viaProject.elements).toHaveLength(1);
    expect(viaProject.elements[0].ok).toBe(true);
    // Byte-for-byte identical engine output — the core is untouched.
    expect(viaProject.elements[0].plan).toEqual(direct);
  });

  it('single-element aggregate mirrors the element', () => {
    const direct = planElement(WALL);
    const labor = buildLaborProjection(direct);
    const proj = planProject([WALL]);
    expect(proj.aggregate.total_concrete_m3).toBeCloseTo(30, 2);
    expect(proj.aggregate.total_norm_hours).toBeCloseTo(labor.total_norm_hours, 1);
    expect(proj.aggregate.schedule_total_days).toBeCloseTo(direct.schedule.total_days, 2);
    expect(proj.aggregate.elements_calculated).toBe(1);
    expect(proj.aggregate.elements_uncalculated).toBe(0);
  });
});

describe('planProject — aggregation across multiple elements', () => {
  it('sums volume / Nh / schedule (sequential), counts calculated', () => {
    const wall = planElement(WALL);
    const footing = planElement(FOOTING);
    const proj = planProject([WALL, FOOTING]);

    expect(proj.elements).toHaveLength(2);
    expect(proj.aggregate.elements_total).toBe(2);
    expect(proj.aggregate.elements_calculated).toBe(2);
    expect(proj.aggregate.total_concrete_m3).toBeCloseTo(75, 2); // 30 + 45

    const expectedDays = wall.schedule.total_days + footing.schedule.total_days;
    expect(proj.aggregate.schedule_total_days).toBeCloseTo(expectedDays, 2); // sequential SUM

    const expectedNorm = buildLaborProjection(wall).total_norm_hours
      + buildLaborProjection(footing).total_norm_hours;
    expect(proj.aggregate.total_norm_hours).toBeCloseTo(expectedNorm, 1);
    expect(proj.aggregate.total_cost_czk).toBeGreaterThan(0);
  });
});

describe('planProject — honest-blank on a failing element', () => {
  it('isolates a failing element, keeps the rest, counts Nevypočtených', () => {
    // Sprint B note: podkladni_beton with rebar=0 (the previous BAD fixture)
    // no longer throws — zero rebar is a valid prostý-beton state. The
    // honest-blank case is now a mandatory-input gap: volume_m3=0 raises a
    // typed UncalculatedError; it must NOT void the whole project.
    const BAD: PlannerInput = {
      element_type: 'stena',
      volume_m3: 0,
      concrete_class: 'C25/30',
      temperature_c: 15,
    };
    const proj = planProject([WALL, BAD]);
    expect(proj.aggregate.elements_total).toBe(2);
    expect(proj.aggregate.elements_calculated).toBe(1);
    expect(proj.aggregate.elements_uncalculated).toBe(1);
    // The good element's numbers are still summed (partial total).
    expect(proj.aggregate.total_concrete_m3).toBeCloseTo(30, 2);
    expect(proj.aggregate.schedule_total_days).not.toBeNull();
    const bad = proj.elements.find(e => !e.ok)!;
    expect(bad.error).toContain('NEPOČÍTÁNO');
    expect(bad.label).toBe('stena');
  });

  it('empty project → schedule null (honest NEPOČÍTÁNO, not 0)', () => {
    const proj = planProject([]);
    expect(proj.aggregate.elements_total).toBe(0);
    expect(proj.aggregate.schedule_total_days).toBeNull();
    expect(proj.aggregate.total_concrete_m3).toBe(0);
  });
});
