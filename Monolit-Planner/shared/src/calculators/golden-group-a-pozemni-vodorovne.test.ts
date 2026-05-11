/**
 * Golden test — Phase 2 Group A pozemní vodorovné (Resource Ceiling).
 *
 * Per task §6 — Group A covers 6 element types:
 *   `stropni_deska`, `zakladova_deska`, `zakladovy_pas`, `zakladova_patka`,
 *   `podkladni_beton`, `pruvlak`.
 *
 * Each typ má 2 scenarios per task acceptance:
 *   1. Default ceiling (no user input) → feasible, KB defaults applied
 *      (resource_ceiling.source !== 'auto_derived' default per task §6).
 *   2. Low user ceiling (under defaults) → INFEASIBLE with ⛔ violations.
 *
 * Medium (default-matching) scenario covered implicitly by Scenario 1 —
 * default ceiling already aligned with engine demand peak per Phase 1
 * Foundation C learnings.
 *
 * Per `docs/CALCULATOR_PHILOSOPHY.md` §3, numeric assertions use ±10–15 %
 * tolerance. Resource Ceiling assertions are EXACT (deterministic match
 * between engine demand peak and ceiling cap).
 */

import { describe, it, expect } from 'vitest';
import { planElement, type PlannerInput } from './planner-orchestrator.js';

// Common helpers — each test picks a baseline input + low-ceiling override.
function expectKbDefault(plan: ReturnType<typeof planElement>) {
  expect(plan.resource_ceiling.source).toBe('kb_default');
  expect(plan.resource_ceiling.confidence).toBe(0.85);
  // Foundation C invariant: default-vs-default produces no false-positive
  // critical violations.
  const criticals = plan.resource_violations.filter(v => v.severity === 'critical');
  expect(criticals).toHaveLength(0);
}

function expectInfeasibleWithCritical(plan: ReturnType<typeof planElement>) {
  expect(plan.resource_ceiling.source).toBe('manual');
  expect(plan.resource_violations.length).toBeGreaterThan(0);
  const criticals = plan.resource_violations.filter(v => v.severity === 'critical');
  expect(criticals.length).toBeGreaterThan(0);
  const hasCriticalEmoji = plan.warnings.some(w => w.includes('⛔ KRITICKÉ'));
  expect(hasCriticalEmoji).toBe(true);
  const hasRecoveryHint = plan.warnings.some(w => w.includes('ℹ️ Doporučení'));
  expect(hasRecoveryHint).toBe(true);
}

describe('Golden — Phase 2 Group A: stropni_deska', () => {
  const input: PlannerInput = {
    element_type: 'stropni_deska',
    volume_m3: 100,
    formwork_area_m2: 400,
    height_m: 3.0,           // prop height under slab (světlá výška)
    deck_thickness_m: 0.22,
    concrete_class: 'C30/37',
    rebar_mass_kg: 12000,    // ~120 kg/m³ × 100 m³
  };

  it('Scenario 1: default ceiling → feasible, KB defaults applied', () => {
    const plan = planElement(input);
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(12);
    expect(plan.resource_ceiling.formwork?.num_props_sets).toBe(1);
    expect(plan.resource_ceiling.equipment?.num_cranes).toBe(1);
    expectKbDefault(plan);
  });

  it('Scenario 2: strop 5 lidí + 1 souprava + 1 čerpadlo → INFEASIBLE', () => {
    const plan = planElement({
      ...input,
      resource_ceiling: {
        workforce: { num_workers_total: 5 },
        formwork: { num_formwork_sets: 1 },
        equipment: { num_pumps: 1 },
      },
    });
    expectInfeasibleWithCritical(plan);
    const fields = plan.resource_violations.map(v => v.field);
    expect(fields).toContain('num_carpenters');
  });
});

describe('Golden — Phase 2 Group A: zakladova_deska', () => {
  const input: PlannerInput = {
    element_type: 'zakladova_deska',
    volume_m3: 150,
    formwork_area_m2: 80,    // obvodový only — velká plocha bez vnitřku
    height_m: 0.5,
    concrete_class: 'C30/37',
    rebar_mass_kg: 16500,    // ~110 kg/m³ × 150 m³
  };

  it('Scenario 1: default ceiling → feasible (finišéři pro hladičku, bez jeřábu)', () => {
    const plan = planElement(input);
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(10);
    expect(plan.resource_ceiling.workforce?.num_finishers).toBe(1);
    expect(plan.resource_ceiling.equipment?.num_cranes).toBeUndefined();
    expectKbDefault(plan);
  });

  it('Scenario 2: strop 4 lidí + 1 souprava + 1 čerpadlo → INFEASIBLE', () => {
    const plan = planElement({
      ...input,
      resource_ceiling: {
        workforce: { num_workers_total: 4 },
        formwork: { num_formwork_sets: 1 },
        equipment: { num_pumps: 1 },
      },
    });
    expectInfeasibleWithCritical(plan);
  });
});

describe('Golden — Phase 2 Group A: zakladovy_pas', () => {
  const input: PlannerInput = {
    element_type: 'zakladovy_pas',
    volume_m3: 40,
    formwork_area_m2: 120,
    height_m: 0.8,
    concrete_class: 'C30/37',
    rebar_mass_kg: 3200,     // ~80 kg/m³ × 40 m³
  };

  it('Scenario 1: default ceiling → feasible (bez pumps/cranes per relevance)', () => {
    const plan = planElement(input);
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(8);
    expect(plan.resource_ceiling.equipment?.num_pumps).toBeUndefined();
    expect(plan.resource_ceiling.equipment?.num_cranes).toBeUndefined();
    expectKbDefault(plan);
  });

  it('Scenario 2: strop 3 lidí + 1 souprava → INFEASIBLE on carpenters/rebar', () => {
    const plan = planElement({
      ...input,
      resource_ceiling: {
        workforce: { num_workers_total: 3 },
        formwork: { num_formwork_sets: 1 },
      },
    });
    expectInfeasibleWithCritical(plan);
  });
});

describe('Golden — Phase 2 Group A: zakladova_patka', () => {
  const input: PlannerInput = {
    element_type: 'zakladova_patka',
    volume_m3: 8,
    formwork_area_m2: 25,
    height_m: 1.0,
    concrete_class: 'C30/37',
    rebar_mass_kg: 720,      // ~90 kg/m³ × 8 m³
  };

  it('Scenario 1: default ceiling → feasible', () => {
    const plan = planElement(input);
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(8);
    expect(plan.resource_ceiling.formwork?.num_formwork_sets).toBe(2);
    expectKbDefault(plan);
  });

  it('Scenario 2: strop 3 lidí + 0 souprav → INFEASIBLE', () => {
    const plan = planElement({
      ...input,
      resource_ceiling: {
        workforce: { num_workers_total: 3 },
        formwork: { num_formwork_sets: 0 },
      },
    });
    expectInfeasibleWithCritical(plan);
  });
});

describe('Golden — Phase 2 Group A: podkladni_beton', () => {
  // Prostý beton C12/15 X0 — bez výztuže. `rebar_mass_kg: 1` je workaround
  // pro existing orchestrator gap: `calculateRebarLite` throws on mass_t=0
  // (rebar_ratio_kg_m3=0 v ElementProfile vede k 0 estimated). Orchestrator
  // by měl mít explicit gate na podkladni_beton path. Tracked v TODO §
  // "Resource Ceiling Phase 2 follow-ups" pro Phase 3 cleanup.
  const input: PlannerInput = {
    element_type: 'podkladni_beton',
    volume_m3: 30,
    height_m: 0.15,          // thin lean concrete
    concrete_class: 'C12/15',
    rebar_mass_kg: 1,        // workaround — engine demand still produces num_carpenters=4 etc.
  };

  it('Scenario 1: default ceiling → feasible (4 lidí, bez bednění, s pumpou)', () => {
    const plan = planElement(input);
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(4);
    expect(plan.resource_ceiling.workforce?.num_concrete_workers).toBe(3);
    expect(plan.resource_ceiling.formwork).toBeUndefined();
    expect(plan.resource_ceiling.equipment?.num_pumps).toBe(1);
    expectKbDefault(plan);
  });

  it('Scenario 2: strop 2 lidí + 0 čerpadel → INFEASIBLE on workers and pump', () => {
    const plan = planElement({
      ...input,
      resource_ceiling: {
        workforce: { num_workers_total: 2 },
        equipment: { num_pumps: 0 },
      },
    });
    expectInfeasibleWithCritical(plan);
    const fields = plan.resource_violations.map(v => v.field);
    expect(fields).toContain('num_pumps');
  });
});

describe('Golden — Phase 2 Group A: pruvlak', () => {
  const input: PlannerInput = {
    element_type: 'pruvlak',
    volume_m3: 15,
    formwork_area_m2: 80,
    height_m: 3.5,           // prop height under beam
    concrete_class: 'C30/37',
    rebar_mass_kg: 2100,     // ~140 kg/m³ × 15 m³
  };

  it('Scenario 1: default ceiling → feasible (stojky + jeřáb)', () => {
    const plan = planElement(input);
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(10);
    expect(plan.resource_ceiling.formwork?.num_props_sets).toBe(1);
    expect(plan.resource_ceiling.equipment?.num_cranes).toBe(1);
    expectKbDefault(plan);
  });

  it('Scenario 2: strop 4 lidí + 1 souprava + 1 čerpadlo → INFEASIBLE on carpenters/rebar', () => {
    // Pruvlak relevance ponechává `num_cranes: false` (DEFAULT_RELEVANCE)
    // navzdory ElementProfile.needs_crane=true — design choice původního
    // autora: u pozemního průvlaku jeřáb obvykle není ceiling-relevant
    // constraint. Násleí pole jsou: num_carpenters, num_rebar_workers,
    // num_formwork_sets, num_workers_total_sum.
    const plan = planElement({
      ...input,
      resource_ceiling: {
        workforce: { num_workers_total: 4 },
        formwork: { num_formwork_sets: 1 },
        equipment: { num_pumps: 1 },
      },
    });
    expectInfeasibleWithCritical(plan);
    const fields = plan.resource_violations.map(v => v.field);
    expect(fields).toContain('num_carpenters');
    expect(fields).toContain('num_formwork_sets');
  });
});
