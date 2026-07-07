/**
 * Soft-degradation class (2026-07, audit Sprint B) — hermetic suite.
 *
 * Domain rule (honest-blank at computation level, root CLAUDE.md P2 class
 * ticket): a missing MANDATORY input must mark the element NEPOČÍTÁNO and be
 * skipped in aggregation — never crash deep in the pipeline with a cryptic
 * guard message, and never fabricate a result.
 *
 * Three symptoms of the one class:
 *  (a) podkladni_beton (rebar_ratio=0 by design) crashed calculateRebarLite
 *      with "mass_t must be positive" → now an honest zero-rebar result;
 *  (b) mostovkova_deska without height_m fell through to
 *      recommended_formwork[0] = MULTIFLEX (building slab system whose
 *      allow-list EXCLUDES bridge decks) → now first APPLICABLE recommendation;
 *  (c) volume 0 / non-derivable ran until a deep scheduler/concreting throw →
 *      now an early typed UncalculatedError that planProject records as
 *      elements_uncalculated.
 */
import { describe, it, expect } from 'vitest';
import { planElement, UncalculatedError } from './planner-orchestrator.js';
import { planProject } from './project-planner.js';
import { calculateRebarLite } from './rebar-lite.js';
import { recommendFormwork } from '../classifiers/element-classifier.js';

describe('Soft degradation (a) — zero rebar is a valid state, not a crash', () => {
  it('calculateRebarLite returns honest zeros for podkladni_beton (rebar_ratio=0)', () => {
    const r = calculateRebarLite({ element_type: 'podkladni_beton', volume_m3: 30 });
    expect(r.mass_kg).toBe(0);
    expect(r.labor_hours).toBe(0);
    expect(r.duration_days).toBe(0);
    expect(r.cost_labor).toBe(0);
    expect(r.confidence).toBe(1.0);
    expect(r.assumptions_log).toContain('bez výztuže');
  });

  it('planElement(podkladni_beton) computes end-to-end without rebar workaround', () => {
    const plan = planElement({
      element_type: 'podkladni_beton',
      volume_m3: 30,
      height_m: 0.15,
      concrete_class: 'C12/15',
    });
    expect(plan.rebar.mass_kg).toBe(0);
    expect(plan.rebar.cost_labor).toBe(0);
    // The rest of the plan is real, not zeroed
    expect(plan.pour.total_pour_hours).toBeGreaterThan(0);
    expect(plan.costs.total_labor_czk).toBeGreaterThan(0);
  });
});

describe('Soft degradation (b) — no-height selector respects allow-lists', () => {
  it('mostovkova_deska without height never gets a building-slab system', () => {
    const sys = recommendFormwork('mostovkova_deska');
    // MULTIFLEX / Dokaflex / SKYDECK / CC-4 are formwork_props with
    // applicable_element_types EXCLUDING mostovkova_deska (v4.21).
    expect(sys.applicable_element_types === undefined
      || sys.applicable_element_types.includes('mostovkova_deska')).toBe(true);
    expect(sys.name).not.toBe('MULTIFLEX');
    expect(sys.pour_role).not.toBe('formwork_props');
  });

  it('planElement(mostovkova_deska, no height) carries an applicable system + KRITICKÉ warning', () => {
    const plan = planElement({
      element_type: 'mostovkova_deska',
      volume_m3: 600,
      concrete_class: 'C30/37',
    });
    const sys = plan.formwork.system;
    expect(sys.applicable_element_types === undefined
      || sys.applicable_element_types.includes('mostovkova_deska')).toBe(true);
    expect(sys.name).not.toBe('MULTIFLEX');
    // v4.19 D1 partial-plan design preserved: missing height stays a visible
    // KRITICKÉ warning, NOT an UncalculatedError (deck volume comes from VV).
    expect(plan.warnings.some(w => w.includes('KRITICKÉ'))).toBe(true);
  });
});

describe('Soft degradation (c) — missing volume → typed NEPOČÍTÁNO, not a deep crash', () => {
  it('volume_m3=0 throws UncalculatedError with Czech reason + missing_fields', () => {
    let caught: unknown;
    try {
      planElement({ element_type: 'stena', volume_m3: 0, height_m: 3 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UncalculatedError);
    const err = caught as UncalculatedError;
    expect(err.uncalculated).toBe(true);
    expect(err.missing_fields).toEqual(['volume_m3']);
    expect(err.message).toContain('NEPOČÍTÁNO');
    expect(err.message).not.toContain('mass_t');
  });

  it('non-prismatic type with dims but no volume degrades honestly (nadrz)', () => {
    let caught: unknown;
    try {
      planElement({
        element_type: 'nadrz',
        volume_m3: 0,
        length_m: 10, width_m: 4, height_m: 3,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UncalculatedError);
    expect((caught as UncalculatedError).message).toContain('poctivě odvodit');
  });

  it('prismatic type with dims derives volume and computes (no error)', () => {
    const plan = planElement({
      element_type: 'stena',
      volume_m3: 0,
      length_m: 10, width_m: 0.3, height_m: 3,
    });
    expect(plan.pour_decision.num_tacts).toBeGreaterThan(0);
    expect(plan.costs.total_labor_czk).toBeGreaterThan(0);
  });

  it('pilota stays exempt — volume derived from pile geometry', () => {
    const plan = planElement({
      element_type: 'pilota',
      volume_m3: 0,
      pile_diameter_mm: 900,
      pile_length_m: 12,
      pile_count: 8,
      concrete_class: 'C25/30',
    });
    expect(plan.pile).toBeDefined();
  });

  it('planProject records the uncalculated element, aggregates the rest (honest partial)', () => {
    const out = planProject([
      { element_type: 'stena', volume_m3: 50, height_m: 3 },
      { element_type: 'stena', volume_m3: 0, height_m: 3 },
    ]);
    expect(out.aggregate.elements_total).toBe(2);
    expect(out.aggregate.elements_calculated).toBe(1);
    expect(out.aggregate.elements_uncalculated).toBe(1);
    const failed = out.elements.find(e => !e.ok);
    expect(failed?.error).toContain('NEPOČÍTÁNO');
    expect(out.aggregate.total_cost_czk).toBeGreaterThan(0);
  });
});
