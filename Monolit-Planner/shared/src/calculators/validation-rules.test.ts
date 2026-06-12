/**
 * Hermetic tests — Part B validation rule «calculator input vs technology
 * documented in the TZ». No AI / network / PDF: TZ facts are fed as
 * fixtures whose verbatim quotes + anchors come from the always-readable
 * digests:
 *   test-data/SO_202_D6_KV_OV/D-01-02-01_01_tz_facts.md        (KV)
 *   test-data/SO_202_D6_OV_Z/202_01_TechnickaZprava_tz_facts.md (Žalmanov)
 *
 * Domain stance under test: contradiction = VISIBLE FLAG, never a gate
 * (Žalmanov TZ §4.1.6: «Postup výstavby může budoucí zhotovitel upravit
 * dle svých možností a potřeb»); match = clean, unknown = silent.
 */

import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';
import {
  runValidationRules,
  tzConstructionConsistencyRule,
  VALIDATION_RULES,
} from './validation-rules.js';
import type { TzFacts } from './validation-rules.js';

// ─── TZ-fact fixtures (verbatim from the *_tz_facts.md digests) ─────────────

const KV_TZ_FACTS: TzFacts = {
  construction: {
    technology: 'fixed_scaffolding',
    pour_stages_count: 1,
    quote: 'Předpokládá se betonáž NK na pevné skruži v jednom taktu.',
    anchor: 'TZ §7.2, str. 34',
  },
};

// ⚠️ TEMPORARY fixture — verified facts only (quote + anchor from the
// digest). Part C replaces this with the full Žalmanov golden and this
// block is then scheduled for removal.
const ZALMANOV_TZ_FACTS: TzFacts = {
  construction: {
    technology: 'fixed_scaffolding',
    pour_stages_count: 3,
    quote: 'Výstavba nosné konstrukce se předpokládá na pevné skruži ve třech etapách.',
    anchor: 'TZ §4.1.6, str. 11',
  },
};

// KV PDPS input (golden §5f shape) — 1 takt per TZ §7.2 / §6.11.3
const KV_INPUT: PlannerInput = {
  element_type: 'mostovkova_deska',
  volume_m3: 693.35,
  formwork_area_m2: 1209.78,
  height_m: 7.795,
  nk_width_m: 10.85,
  has_dilatacni_spary: false,
  working_joints_allowed: 'no',
  concrete_class: 'C35/45',
  exposure_class: 'XF2',
  curing_class: 4,
  temperature_c: 15,
  bridge_deck_subtype: 'dvoutram',
  span_m: 20,
  num_spans: 6,
  construction_technology: 'fixed_scaffolding',
  is_prestressed: true,
  prestress_cables_count: 12,
  prestress_tensioning: 'one_sided',
  rebar_mass_kg: 104000,
};

// ⚠️ TEMPORARY Žalmanov input — minimal, NOT a golden (volume = odhad from
// the Pattern 51 calibration note; Part C verifies against VV).
const ZALMANOV_INPUT: PlannerInput = {
  element_type: 'mostovkova_deska',
  volume_m3: 1349,
  height_m: 8,
  has_dilatacni_spary: false,
  concrete_class: 'C35/45',
  construction_technology: 'fixed_scaffolding',
  is_prestressed: true,
};

const isRuleFlagLine = (w: string) => w.includes('Vstup se odchyluje od dokumentace');

describe('validation-rules registry (unit, pure)', () => {
  it('registry contains the TZ construction consistency rule', () => {
    expect(VALIDATION_RULES.map(r => r.rule_id)).toContain('tz_construction_consistency');
  });

  it('no tz_facts → silent (no flag, no guess)', () => {
    expect(runValidationRules({ num_tacts: 6 })).toEqual([]);
    expect(runValidationRules({ tz_facts: {}, num_tacts: 6 })).toEqual([]);
  });

  it('fact present but facet values unknown → silent', () => {
    const flags = runValidationRules({
      tz_facts: { construction: { quote: 'x', anchor: 'TZ §1' } },
      construction_technology: 'mss',
      num_tacts: 6,
    });
    expect(flags).toEqual([]);
  });

  it('input technology undefined (engine auto) → technology facet silent', () => {
    const flags = runValidationRules({
      tz_facts: KV_TZ_FACTS,
      num_tacts: 1,
    });
    expect(flags).toEqual([]);
  });

  it('stage mismatch → 1 warning flag carrying quote + anchor + both values', () => {
    const flags = tzConstructionConsistencyRule.run({
      tz_facts: KV_TZ_FACTS,
      construction_technology: 'fixed_scaffolding',
      num_tacts: 6,
    });
    expect(flags).toHaveLength(1);
    const f = flags[0];
    expect(f.rule_id).toBe('tz_construction_consistency');
    expect(f.severity).toBe('warning');
    expect(f.tz_value).toBe('betonáž v 1 taktu');
    expect(f.input_value).toBe('6 taktů');
    expect(f.tz_quote).toBe(KV_TZ_FACTS.construction!.quote);
    expect(f.tz_anchor).toBe('TZ §7.2, str. 34');
    expect(f.message).toContain('v jednom taktu');
    expect(f.message).toContain('TZ §7.2');
    expect(f.message).toContain('vědomé rozhodnutí zhotovitele');
  });

  it('technology mismatch → flag (pevná skruž per TZ vs MSS input)', () => {
    const flags = tzConstructionConsistencyRule.run({
      tz_facts: KV_TZ_FACTS,
      construction_technology: 'mss',
      num_tacts: 1,
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].tz_value).toBe('pevná skruž');
    expect(flags[0].input_value).toBe('výsuvná skruž (MSS)');
  });

  it('full match → clean, zero noise', () => {
    const flags = tzConstructionConsistencyRule.run({
      tz_facts: KV_TZ_FACTS,
      construction_technology: 'fixed_scaffolding',
      num_tacts: 1,
    });
    expect(flags).toEqual([]);
  });
});

describe('KV (SO-202 KV–OV) — engine-integrated, hermetic', () => {
  it('input 1 takt (PDPS) + TZ facts → clean: no flag, no noise', () => {
    const plan = planElement({ ...KV_INPUT, tz_facts: KV_TZ_FACTS });
    expect(plan.pour_decision.num_tacts).toBe(1);
    expect(plan.validation_flags).toBeUndefined();
    expect(plan.warnings.some(isRuleFlagLine)).toBe(false);
  });

  it('input 6 taktů → flag with the §7.2 quote, in both surfaces', () => {
    // 6-takt deviation: drop the working-joints prohibition, force 6 tacts
    const { working_joints_allowed: _omit, ...base } = KV_INPUT;
    const plan = planElement({
      ...base,
      num_tacts_override: 6,
      tz_facts: KV_TZ_FACTS,
    });
    expect(plan.pour_decision.num_tacts).toBe(6);
    // structured sibling
    expect(plan.validation_flags).toBeDefined();
    const f = plan.validation_flags!.find(x => x.rule_id === 'tz_construction_consistency')!;
    expect(f.tz_quote).toBe('Předpokládá se betonáž NK na pevné skruži v jednom taktu.');
    expect(f.tz_anchor).toBe('TZ §7.2, str. 34');
    expect(f.input_value).toBe('6 taktů');
    // legacy warnings[] surface (rendered by the existing banner)
    expect(plan.warnings.some(isRuleFlagLine)).toBe(true);
    // flag, NOT a gate — the plan is still produced in full
    expect(plan.schedule.total_days).toBeGreaterThan(0);
  });
});

describe('Žalmanov (SO-202 OV–Z) — TEMPORARY hermetic fixture (Part C replaces with full golden)', () => {
  it('input 1 takt → flag: TZ §4.1.6 prescribes three etapy', () => {
    const plan = planElement({
      ...ZALMANOV_INPUT,
      working_joints_allowed: 'no', // forces 1 monolithic takt
      tz_facts: ZALMANOV_TZ_FACTS,
    });
    expect(plan.pour_decision.num_tacts).toBe(1);
    const f = plan.validation_flags!.find(x => x.rule_id === 'tz_construction_consistency')!;
    expect(f.tz_value).toBe('betonáž ve 3 etapách');
    expect(f.tz_quote).toContain('na pevné skruži ve třech etapách');
    expect(f.tz_anchor).toBe('TZ §4.1.6, str. 11');
    expect(f.input_value).toBe('1 takt');
    expect(plan.warnings.some(isRuleFlagLine)).toBe(true);
  });

  it('input 3 etapy → clean', () => {
    const plan = planElement({
      ...ZALMANOV_INPUT,
      num_tacts_override: 3,
      tz_facts: ZALMANOV_TZ_FACTS,
    });
    expect(plan.pour_decision.num_tacts).toBe(3);
    expect(plan.validation_flags).toBeUndefined();
    expect(plan.warnings.some(isRuleFlagLine)).toBe(false);
  });
});

describe('negative — technology unknown in documents', () => {
  it('no tz_facts on the same deviating input → rule is silent (no flag, no guess)', () => {
    const { working_joints_allowed: _omit, ...base } = KV_INPUT;
    const plan = planElement({ ...base, num_tacts_override: 6 });
    expect(plan.validation_flags).toBeUndefined();
    expect(plan.warnings.some(isRuleFlagLine)).toBe(false);
  });
});
