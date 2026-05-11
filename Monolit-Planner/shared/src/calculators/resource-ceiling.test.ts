/**
 * Unit tests for ResourceCeiling schema + relevance + defaults + merge + feasibility.
 * Foundation tests for Phase 1 R1.
 *
 * Per Phase 0 audit §6.1 + Phase 1 acceptance §5.6.
 */

import { describe, it, expect } from 'vitest';
import {
  RESOURCE_CEILING_DEFAULTS,
  RESOURCE_RELEVANCE_BY_ELEMENT,
  getResourceRelevance,
  getDefaultCeiling,
  applyResourceCeilingDefaults,
  checkCeilingFeasibility,
  type ResourceCeiling,
  type EngineeringDemand,
} from './resource-ceiling.js';
import { decidePourMode } from './pour-decision.js';
import { calculatePourTask } from './pour-task-engine.js';
import { planElement, type PlannerInput } from './planner-orchestrator.js';

describe('ResourceCeiling — relevance flags', () => {
  it('operne_zdi: relevant fields cover workforce + formwork + pumps + cranes', () => {
    const r = getResourceRelevance('operne_zdi');
    expect(r.num_workers_total).toBe(true);
    expect(r.num_carpenters).toBe(true);
    expect(r.num_rebar_workers).toBe(true);
    expect(r.num_pumps).toBe(true);
    expect(r.num_cranes).toBe(true);  // Framax + jeřáb
    expect(r.num_finishers).toBe(false);  // walls don't have finishers
  });

  it('mostovkova_deska: relevant fields include finishers + falsework + backup_pumps + night_shift', () => {
    const r = getResourceRelevance('mostovkova_deska');
    expect(r.num_finishers).toBe(true);
    expect(r.num_falsework_sets).toBe(true);
    expect(r.num_props_sets).toBe(true);
    expect(r.mss_set_available).toBe(true);
    expect(r.num_backup_pumps).toBe(true);
    expect(r.allow_night_shift).toBe(true);
  });

  it('pilota: no formwork, no vibrators, no finishers, no pumps (tremie)', () => {
    const r = getResourceRelevance('pilota');
    expect(r.num_carpenters).toBe(false);   // no formwork — pažnice
    expect(r.num_vibrators).toBe(false);    // tremie pipe self-vibrates
    expect(r.num_finishers).toBe(false);
    expect(r.num_formwork_sets).toBe(false);
    expect(r.num_pumps).toBe(false);        // tremie not pump
    expect(r.num_cranes).toBe(true);        // armokoš transport
  });

  it('podkladni_beton: no rebar workers, no vibrators, no finishers, no formwork', () => {
    const r = getResourceRelevance('podkladni_beton');
    expect(r.num_rebar_workers).toBe(false);  // prostý beton C12/15 X0
    expect(r.num_vibrators).toBe(false);      // kompaktace lištou
    expect(r.num_finishers).toBe(false);
    expect(r.num_formwork_sets).toBe(false);  // přímo do výkopu
  });

  it('rimsa: no formwork sets in ceiling (římsové konzoly fixed na NK)', () => {
    const r = getResourceRelevance('rimsa');
    expect(r.num_formwork_sets).toBe(false);
    expect(r.num_finishers).toBe(true);
    expect(r.num_pumps).toBe(true);
    expect(r.num_cranes).toBe(false);
  });

  it('podzemni_stena: no carpenters (bentonit), no vibrators, but crane', () => {
    const r = getResourceRelevance('podzemni_stena');
    expect(r.num_carpenters).toBe(false);
    expect(r.num_vibrators).toBe(false);
    expect(r.num_formwork_sets).toBe(false);
    expect(r.num_cranes).toBe(true);
  });

  it('unknown element falls back to DEFAULT_RELEVANCE (all true)', () => {
    const r = getResourceRelevance('other');
    expect(r.num_workers_total).toBe(true);
    expect(r.num_carpenters).toBe(true);
    expect(r.num_pumps).toBe(true);
  });

  it('all relevance entries in RESOURCE_RELEVANCE_BY_ELEMENT have num_workers_total=true', () => {
    // Sanity: every element that has a relevance map should accept the
    // total cap (it's the simplest user input).
    for (const [el, map] of Object.entries(RESOURCE_RELEVANCE_BY_ELEMENT)) {
      expect(map!.num_workers_total, `${el} should have num_workers_total relevant`).toBe(true);
    }
  });
});

describe('ResourceCeiling — defaults registry', () => {
  it('operne_zdi default: 12 lidí, 4 tesaři, 1 souprava, 1 čerpadlo, 1 jeřáb', () => {
    const d = getDefaultCeiling('operne_zdi')!;
    expect(d.workforce?.num_workers_total).toBe(12);
    expect(d.workforce?.num_carpenters).toBe(4);
    expect(d.formwork?.num_formwork_sets).toBe(2);
    expect(d.equipment?.num_pumps).toBe(1);
    expect(d.equipment?.num_cranes).toBe(1);
    expect(d.source).toBe('kb_default');
    expect(d.confidence).toBe(0.85);
  });

  it('mostovkova_deska default: 21 lidí, MEGA pour ready (2 pumps + 1 backup + skruž)', () => {
    const d = getDefaultCeiling('mostovkova_deska')!;
    expect(d.workforce?.num_workers_total).toBe(21);
    expect(d.workforce?.num_finishers).toBeGreaterThan(0);
    expect(d.formwork?.num_falsework_sets).toBe(1);
    expect(d.equipment?.num_pumps).toBe(2);
    expect(d.equipment?.num_backup_pumps).toBe(1);
    expect(d.time?.allow_night_shift).toBe(true);
  });

  it('Phase 3-7 elements (no default yet) return undefined', () => {
    // Group B-F per task §6 — pozemní svislé (stena/sloup), speciální
    // (pilota/nadrz/podzemni_stena/schodiste), mostní spodní stavba
    // (driky_piliru/opery/...), mostní NK (rigel/...), most svršek (rimsa).
    expect(getDefaultCeiling('rimsa')).toBeUndefined();
    expect(getDefaultCeiling('pilota')).toBeUndefined();
    expect(getDefaultCeiling('stena')).toBeUndefined();
  });

  // ─── Phase 2 Group A defaults — pozemní vodorovné ─────────────────────────
  it('Phase 2 Group A: all 6 pozemní vodorovné typy have defaults', () => {
    expect(getDefaultCeiling('stropni_deska')).toBeDefined();
    expect(getDefaultCeiling('zakladova_deska')).toBeDefined();
    expect(getDefaultCeiling('zakladovy_pas')).toBeDefined();
    expect(getDefaultCeiling('zakladova_patka')).toBeDefined();
    expect(getDefaultCeiling('podkladni_beton')).toBeDefined();
    expect(getDefaultCeiling('pruvlak')).toBeDefined();
  });

  it('stropni_deska default: 12 lidí, 2 soupravy (obrátkovost), 1 čerpadlo, 1 jeřáb, props 1 sada', () => {
    const d = getDefaultCeiling('stropni_deska')!;
    expect(d.workforce?.num_workers_total).toBe(12);
    expect(d.workforce?.num_carpenters).toBe(4);
    expect(d.workforce?.num_finishers).toBe(1);
    expect(d.formwork?.num_formwork_sets).toBe(2);
    expect(d.formwork?.num_props_sets).toBe(1);
    expect(d.equipment?.num_pumps).toBe(1);
    expect(d.equipment?.num_cranes).toBe(1);
    expect(d.source).toBe('kb_default');
    expect(d.confidence).toBe(0.85);
  });

  it('zakladova_deska default: 10 lidí, finišéři (hladička), bez jeřábu', () => {
    const d = getDefaultCeiling('zakladova_deska')!;
    expect(d.workforce?.num_workers_total).toBe(10);
    expect(d.workforce?.num_finishers).toBe(1);
    expect(d.equipment?.num_pumps).toBe(1);
    expect(d.equipment?.num_cranes).toBeUndefined();
  });

  it('zakladovy_pas default: 8 lidí, bez pumps + bez cranes (výsyp / žlab)', () => {
    const d = getDefaultCeiling('zakladovy_pas')!;
    expect(d.workforce?.num_workers_total).toBe(8);
    expect(d.equipment?.num_pumps).toBeUndefined();
    expect(d.equipment?.num_cranes).toBeUndefined();
  });

  it('zakladova_patka default: 8 lidí, 2 soupravy, bez pumps', () => {
    const d = getDefaultCeiling('zakladova_patka')!;
    expect(d.workforce?.num_workers_total).toBe(8);
    expect(d.formwork?.num_formwork_sets).toBe(2);
    expect(d.equipment?.num_pumps).toBeUndefined();
  });

  it('podkladni_beton default: 4 lidí, bez bednění (do výkopu), s pumpou', () => {
    const d = getDefaultCeiling('podkladni_beton')!;
    expect(d.workforce?.num_workers_total).toBe(4);
    expect(d.workforce?.num_concrete_workers).toBe(3);
    expect(d.workforce?.num_rebar_workers).toBeUndefined();
    expect(d.workforce?.num_finishers).toBeUndefined();
    expect(d.formwork).toBeUndefined();
    expect(d.equipment?.num_pumps).toBe(1);
  });

  it('pruvlak default: 10 lidí, 2 soupravy, stojky 1 sada, jeřáb 1', () => {
    const d = getDefaultCeiling('pruvlak')!;
    expect(d.workforce?.num_workers_total).toBe(10);
    expect(d.workforce?.num_finishers).toBe(1);
    expect(d.formwork?.num_formwork_sets).toBe(2);
    expect(d.formwork?.num_props_sets).toBe(1);
    expect(d.equipment?.num_pumps).toBe(1);
    expect(d.equipment?.num_cranes).toBe(1);
  });
});

describe('ResourceCeiling — applyResourceCeilingDefaults (merge logic)', () => {
  it('no user, KB default exists → returns KB default (kb_default source)', () => {
    const merged = applyResourceCeilingDefaults('operne_zdi');
    expect(merged.workforce?.num_workers_total).toBe(12);
    expect(merged.source).toBe('kb_default');
  });

  it('no user, no KB default → returns empty (auto_derived source)', () => {
    const merged = applyResourceCeilingDefaults('rimsa');
    expect(merged.source).toBe('auto_derived');
    expect(merged.confidence).toBe(1.0);
  });

  it('user only, no KB default → returns user (manual source, confidence 0.99 default)', () => {
    const user: ResourceCeiling = {
      workforce: { num_workers_total: 8 },
      equipment: { num_pumps: 1 },
    };
    const merged = applyResourceCeilingDefaults('rimsa', user);
    expect(merged.workforce?.num_workers_total).toBe(8);
    expect(merged.source).toBe('manual');
    expect(merged.confidence).toBe(0.99);
  });

  it('user partial + KB default → user fields WIN, defaults fill gaps', () => {
    const user: ResourceCeiling = {
      workforce: { num_workers_total: 5 },  // user override
      equipment: { num_pumps: 1 },
    };
    const merged = applyResourceCeilingDefaults('operne_zdi', user);
    // User total wins
    expect(merged.workforce?.num_workers_total).toBe(5);
    expect(merged.equipment?.num_pumps).toBe(1);
    // KB defaults fill gaps
    expect(merged.equipment?.num_cranes).toBe(1);  // from defaults
    expect(merged.formwork?.num_formwork_sets).toBe(2);  // from defaults
    expect(merged.source).toBe('manual');
  });

  it('user total only (no breakdown) → scales KB default ratio', () => {
    // VP4 default: 12 total, 4 tesaři, 3 železáři, 3 betonáři, 2 vibrátoři.
    // User gives 6 total → scale = 6/12 = 0.5 → 2 tesaři, ~2 železáři, ~2 betonáři, 1 vibrátor.
    const user: ResourceCeiling = {
      workforce: { num_workers_total: 6 },
    };
    const merged = applyResourceCeilingDefaults('operne_zdi', user);
    expect(merged.workforce?.num_workers_total).toBe(6);
    expect(merged.workforce?.num_carpenters).toBe(2);  // round(4 × 0.5)
    expect(merged.workforce?.num_vibrators).toBe(1);   // round(2 × 0.5)
    expect(merged.source).toBe('manual');
  });

  it('user FULL breakdown → no scaling, user values used as-is', () => {
    const user: ResourceCeiling = {
      workforce: {
        num_workers_total: 8,
        num_carpenters: 2,
        num_rebar_workers: 2,
        num_concrete_workers: 2,
        num_vibrators: 2,
      },
    };
    const merged = applyResourceCeilingDefaults('operne_zdi', user);
    expect(merged.workforce?.num_carpenters).toBe(2);
    expect(merged.workforce?.num_rebar_workers).toBe(2);
  });
});

describe('ResourceCeiling — checkCeilingFeasibility', () => {
  it('feasible when demand <= ceiling on all relevant fields', () => {
    const ceiling: ResourceCeiling = {
      workforce: { num_carpenters: 4, num_rebar_workers: 3 },
      equipment: { num_pumps: 2, num_cranes: 1 },
    };
    const demand: EngineeringDemand = {
      workforce: { num_carpenters: 4, num_rebar_workers: 3 },
      equipment: { num_pumps: 1, num_cranes: 1 },
      total_days: 30,
    };
    const result = checkCeilingFeasibility(ceiling, demand, 'operne_zdi');
    expect(result.feasible).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('INFEASIBLE when pumps demand > ceiling (the demo bug scenario)', () => {
    // User has 1 pump. Engine wants 3. → ⛔ KRITICKÉ.
    const ceiling: ResourceCeiling = {
      equipment: { num_pumps: 1 },
    };
    const demand: EngineeringDemand = {
      equipment: { num_pumps: 3 },
    };
    const result = checkCeilingFeasibility(ceiling, demand, 'mostovkova_deska');
    expect(result.feasible).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('num_pumps');
    expect(result.violations[0].severity).toBe('critical');
    expect(result.violations[0].message).toContain('⛔');
    expect(result.recovery_hints.length).toBeGreaterThan(0);
    expect(result.recovery_hints[0]).toContain('Rozdělit');
  });

  it('INFEASIBLE — multiple violations stacked (the demo bug full scenario)', () => {
    // User: 12 lidí, 1 souprava, 1 čerpadlo. Engine wants 21 lidí, 2 souprav, 2 čerpadla.
    const ceiling: ResourceCeiling = {
      workforce: { num_workers_total: 12, num_carpenters: 4, num_rebar_workers: 3, num_concrete_workers: 3, num_vibrators: 2 },
      formwork: { num_formwork_sets: 1 },
      equipment: { num_pumps: 1 },
    };
    const demand: EngineeringDemand = {
      workforce: { num_carpenters: 6, num_rebar_workers: 4, num_concrete_workers: 6, num_vibrators: 3, num_finishers: 2 },
      formwork: { num_formwork_sets: 2 },
      equipment: { num_pumps: 2 },
    };
    const result = checkCeilingFeasibility(ceiling, demand, 'mostovkova_deska');
    expect(result.feasible).toBe(false);
    // Expect at least violations: num_carpenters, num_concrete_workers, num_formwork_sets, num_pumps, num_workers_total_sum
    expect(result.violations.length).toBeGreaterThanOrEqual(4);
    const fields = result.violations.map(v => v.field);
    expect(fields).toContain('num_carpenters');
    expect(fields).toContain('num_pumps');
    expect(fields).toContain('num_formwork_sets');
  });

  it('total_workers_sum check: per-profession breakdown sums > total ceiling', () => {
    // User: total 10. Demand: 4+3+3+2 = 12 → ⛔ on num_workers_total_sum.
    const ceiling: ResourceCeiling = {
      workforce: { num_workers_total: 10 },
    };
    const demand: EngineeringDemand = {
      workforce: { num_carpenters: 4, num_rebar_workers: 3, num_concrete_workers: 3, num_vibrators: 2 },
    };
    const result = checkCeilingFeasibility(ceiling, demand, 'operne_zdi');
    expect(result.feasible).toBe(false);
    const totalViolation = result.violations.find(v => v.field === 'num_workers_total_sum');
    expect(totalViolation).toBeDefined();
    expect(totalViolation!.required).toBe(12);
    expect(totalViolation!.available).toBe(10);
  });

  it('deadline_days check: engine days > ceiling deadline → ⛔', () => {
    const ceiling: ResourceCeiling = {
      time: { deadline_days: 30 },
    };
    const demand: EngineeringDemand = { total_days: 45 };
    const result = checkCeilingFeasibility(ceiling, demand, 'operne_zdi');
    expect(result.feasible).toBe(false);
    expect(result.violations[0].field).toBe('deadline_days');
    expect(result.recovery_hints[0]).toContain('2. směnu');
  });

  it('relevance gates: irrelevant fields skipped (rimsa num_formwork_sets ignored)', () => {
    // Rimsa relevance: num_formwork_sets=false. Even if ceiling+demand both
    // set the field, no violation should fire.
    const ceiling: ResourceCeiling = {
      formwork: { num_formwork_sets: 1 },
    };
    const demand: EngineeringDemand = {
      formwork: { num_formwork_sets: 5 },  // would violate if relevant
    };
    const result = checkCeilingFeasibility(ceiling, demand, 'rimsa');
    expect(result.feasible).toBe(true);
    expect(result.violations.find(v => v.field === 'num_formwork_sets')).toBeUndefined();
  });
});

describe('ResourceCeiling — VP4 FORESTINA demo scenarios (Phase 1 acceptance §5.6)', () => {
  // Reference A: VP4 operne_zdi golden test (94.231 m³).

  it('VP4 with strop 5 lidí + 1 souprava + 1 čerpadlo: relevance check (not yet integrated with engine)', () => {
    const userCeiling: ResourceCeiling = {
      workforce: { num_workers_total: 5 },
      formwork: { num_formwork_sets: 1 },
      equipment: { num_pumps: 1 },
    };
    const merged = applyResourceCeilingDefaults('operne_zdi', userCeiling);
    // User's 5 total scales the default breakdown.
    expect(merged.workforce?.num_workers_total).toBe(5);
    // VP4 default total = 12; scale = 5/12 ≈ 0.417.
    // num_carpenters = round(4 × 0.417) = 2.
    expect(merged.workforce?.num_carpenters).toBe(2);
    expect(merged.source).toBe('manual');
  });

  it('VP4 with strop 12p + 2s + 1p: full breakdown coverage', () => {
    const userCeiling: ResourceCeiling = {
      workforce: { num_workers_total: 12 },
      formwork: { num_formwork_sets: 2 },
      equipment: { num_pumps: 1 },
    };
    const merged = applyResourceCeilingDefaults('operne_zdi', userCeiling);
    expect(merged.workforce?.num_workers_total).toBe(12);
    expect(merged.formwork?.num_formwork_sets).toBe(2);
    expect(merged.equipment?.num_pumps).toBe(1);
    // Crane comes from defaults (relevant for opěrné_zdi Framax)
    expect(merged.equipment?.num_cranes).toBe(1);
  });

  // ─── Foundation B integration: planElement returns resource_ceiling ──────

  it('Foundation B: planElement returns effective resource_ceiling on output', () => {
    const input: PlannerInput = {
      element_type: 'operne_zdi',
      volume_m3: 94.231,
      formwork_area_m2: 547.4,
      height_m: 1.75,
      has_dilatacni_spary: true,
      spara_spacing_m: 10,
      total_length_m: 156.4,
      adjacent_sections: true,
      concrete_class: 'C30/37',
      rebar_mass_kg: 5654,
      rebar_diameter_mm: 12,
    };
    const plan = planElement(input);
    // Foundation B: ceiling resolved at entry, exposed on output.
    expect(plan.resource_ceiling).toBeDefined();
    expect(plan.resource_ceiling.source).toBe('kb_default');  // VP4 → operne_zdi defaults
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(12);
    expect(plan.resource_ceiling.equipment?.num_pumps).toBe(1);
    // Foundation B: violations empty (engine integration is Foundation C).
    expect(Array.isArray(plan.resource_violations)).toBe(true);
    expect(plan.resource_violations).toHaveLength(0);
  });

  it('Foundation B: user-supplied ceiling propagates through planElement', () => {
    const input: PlannerInput = {
      element_type: 'operne_zdi',
      volume_m3: 94.231,
      formwork_area_m2: 547.4,
      height_m: 1.75,
      has_dilatacni_spary: true,
      spara_spacing_m: 10,
      total_length_m: 156.4,
      adjacent_sections: true,
      concrete_class: 'C30/37',
      rebar_mass_kg: 5654,
      rebar_diameter_mm: 12,
      // Demo bug scenario: user has 5 lidí strop
      resource_ceiling: {
        workforce: { num_workers_total: 5 },
        equipment: { num_pumps: 1 },
      },
    };
    const plan = planElement(input);
    // User input WINS (0.99) → source = 'manual'
    expect(plan.resource_ceiling.source).toBe('manual');
    expect(plan.resource_ceiling.workforce?.num_workers_total).toBe(5);
    // Scaling: 5/12 ≈ 0.417 → carpenters round(4 × 0.417) = 2
    expect(plan.resource_ceiling.workforce?.num_carpenters).toBe(2);
  });

  // ─── R3 smoke test: pump-count consistency (v4.20 fix verification) ──────

  it('R3 smoke: pour-task.pumps_required === pour-decision.pumps_required (v4.20 invariant)', () => {
    // MEGA pour SO-203 scenario forces multi-pump.
    const decision = decidePourMode({
      element_type: 'mostovkova_deska',
      volume_m3: 664,
      has_dilatacni_spary: false,
      working_joints_allowed: 'no',  // strictly monolithic, forces multi-pump
      season: 'normal',
    });
    expect(decision.pumps_required).toBeGreaterThan(1);  // sanity: MEGA pour needs >1 pump

    // Forward decision into pour-task (per orchestrator pattern at line 1641).
    const task = calculatePourTask({
      element_type: 'mostovkova_deska',
      volume_m3: 664,
      num_pumps_available: decision.pumps_required,
    });
    // Per v4.20 invariant: pour-task uses num_pumps_available verbatim.
    expect(task.pumps_required).toBe(decision.pumps_required);
  });

  it('R3 smoke: small pour still consistent (single-pump baseline)', () => {
    const decision = decidePourMode({
      element_type: 'operne_zdi',
      volume_m3: 94,
      has_dilatacni_spary: true,
      spara_spacing_m: 10,
      total_length_m: 156,
      adjacent_sections: true,
      season: 'normal',
    });
    const task = calculatePourTask({
      element_type: 'operne_zdi',
      volume_m3: 94,
      num_pumps_available: decision.pumps_required,
    });
    expect(task.pumps_required).toBe(decision.pumps_required);
    expect(task.pumps_required).toBe(1);  // VP4 fits 1 pump
  });

  it('R4 smoke: pour-task ignores input.crew_size (informational only)', () => {
    // Set drastically different crew_size values — output rate/duration must
    // be identical because the field is informational only (R4 fix verifies
    // the dead-input nature is intentional).
    const baseInput = {
      element_type: 'operne_zdi' as const,
      volume_m3: 94,
      num_pumps_available: 1,
      season: 'normal' as const,
    };
    const taskWith2 = calculatePourTask({ ...baseInput, crew_size: 2 });
    const taskWith20 = calculatePourTask({ ...baseInput, crew_size: 20 });
    expect(taskWith2.effective_rate_m3_h).toBe(taskWith20.effective_rate_m3_h);
    expect(taskWith2.pumping_hours).toBe(taskWith20.pumping_hours);
    expect(taskWith2.pumps_required).toBe(taskWith20.pumps_required);
  });

  it('SO-203 mostovka with strop 12p + 1s + 1p: INFEASIBLE (engine demand exceeds)', () => {
    // SO-203 ~664 m³ → engine demand: 21 lidí, 2 souprav, 2 čerpadel.
    // User: 12 lidí, 1 souprava, 1 čerpadlo → multiple violations.
    const userCeiling: ResourceCeiling = {
      workforce: { num_workers_total: 12 },
      formwork: { num_formwork_sets: 1, num_falsework_sets: 1 },
      equipment: { num_pumps: 1 },
    };
    const demand: EngineeringDemand = {
      workforce: { num_carpenters: 4, num_rebar_workers: 4, num_concrete_workers: 6, num_vibrators: 3, num_finishers: 2 },
      formwork: { num_formwork_sets: 1 },
      equipment: { num_pumps: 2 },
    };
    const merged = applyResourceCeilingDefaults('mostovkova_deska', userCeiling);
    const result = checkCeilingFeasibility(merged, demand, 'mostovkova_deska');
    expect(result.feasible).toBe(false);
    // Expect violations: num_pumps (1 < 2) + num_workers_total_sum (12 < 19)
    const fields = result.violations.map(v => v.field);
    expect(fields).toContain('num_pumps');
    // Recovery hints must include split suggestion
    expect(result.recovery_hints.some(h => h.includes('záběrů') || h.includes('záběr'))).toBe(true);
  });
});
