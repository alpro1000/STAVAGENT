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

// Žalmanov TZ facts (verbatim quote + anchor from the digest §4.1.6).
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

// Žalmanov NK golden input (Part C — replaces the former temporary fixture).
// All values carry provenance in test-data/tz/SO-202_D6_OV_Z_Zalmanov_golden_test.md:
//   volume 1348.97 = VV 422336 (2697.941) ÷ 2  [VV÷2 per most]
//   C35/45 + XF2     = TZ §2 (VV code band "DO C40/50" = price band, Pattern 53)
//   dvoutrám, š.13.65, trám 2400 konstantní = výkres 202_17
//   tact_volumes ∝ TAKT lengths 43.25/44.25/23.0 m (výkres 202_18 SCHÉMA PŘEDPĚTÍ),
//     NOT the span layout 32/44.5/32 — joints sit past the piers
//   height_m 10.6 = výkres 202_04 (výška pilíře VPRAVO 10600 mm)
//   rebar 234443 kg = VV 422365 (468.886 t) ÷ 2 × 1000
const ZALMANOV_INPUT: PlannerInput = {
  element_type: 'mostovkova_deska',
  volume_m3: 1348.97,
  concrete_class: 'C35/45',
  exposure_class: 'XF2',
  curing_class: 4,
  bridge_deck_subtype: 'dvoutram',
  nk_width_m: 13.65,
  height_m: 10.6,
  has_dilatacni_spary: false,
  construction_technology: 'fixed_scaffolding',
  num_tacts_override: 3,
  tact_volumes: [527.99, 540.20, 280.78],
  is_prestressed: true,
  rebar_mass_kg: 234443,
  temperature_c: 15,
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

describe('Žalmanov (SO-202 OV–Z) — full golden (Part C, all inputs from Žalmanov docs)', () => {
  it('golden 3 etapy (TAKT 43.25/44.25/23.0) → clean: input ≡ TZ, no flag', () => {
    const plan = planElement({ ...ZALMANOV_INPUT, tz_facts: ZALMANOV_TZ_FACTS });
    expect(plan.pour_decision.num_tacts).toBe(3);
    // golden snapshot (engine 2026-06-13): Top 50 falsework, curing class 4 = 9 d
    expect(plan.formwork.system.name).toBe('Top 50');
    expect(plan.formwork.curing_days).toBe(9);
    expect(plan.validation_flags).toBeUndefined();
    expect(plan.warnings.some(isRuleFlagLine)).toBe(false);
  });

  it('Σ tact_volumes ≈ VV NK ÷ 2 (1348.97 m³) — control', () => {
    const sum = ZALMANOV_INPUT.tact_volumes!.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1348.97, 1);
  });

  it('deviation 1 takt → flag: TZ §4.1.6 prescribes three etapy', () => {
    // drop the 3-takt override + per-takt volumes, force 1 monolithic pour
    const { num_tacts_override: _n, tact_volumes: _tv, ...base } = ZALMANOV_INPUT;
    const plan = planElement({
      ...base,
      working_joints_allowed: 'no',
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
});

describe('negative — technology unknown in documents', () => {
  it('no tz_facts on the same deviating input → rule is silent (no flag, no guess)', () => {
    const { working_joints_allowed: _omit, ...base } = KV_INPUT;
    const plan = planElement({ ...base, num_tacts_override: 6 });
    expect(plan.validation_flags).toBeUndefined();
    expect(plan.warnings.some(isRuleFlagLine)).toBe(false);
  });
});
