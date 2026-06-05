/**
 * Element Classifier — W3 parity golden baseline (TASK_2b, Gate 0)
 * ================================================================
 *
 * This file is the regression harness for "the engine classifies element types
 * as well as the W3 (MCP) side". It is split into two contracts:
 *
 *   1. CONTROLS — cases the engine ALREADY classifies correctly. They are
 *      head-noun-independent (the governing noun is unambiguous) and must stay
 *      green after EVERY gate. A control regression is a hard STOP on the gate
 *      that caused it (per owner amendment).
 *
 *   2. RED targets — cases the engine currently gets WRONG. Each is written with
 *      its W3-correct target and marked `it.fails` so CI stays green until the
 *      owning gate flips it. When a gate fixes the case, `it.fails` itself starts
 *      failing (the test now passes) → that is the signal to convert `.fails`
 *      into a plain `it` in the same gate.
 *
 * Oracle = the W3 Python goldens (the source of truth for "correct"):
 *   concrete-agent/.../tests/test_mcp_golden_so250.py   (#63–#70)
 *   concrete-agent/.../tests/test_mcp_golden_so250b.py  (#73–#76)
 *
 * W3 → engine type-vocabulary map (W3 emits a different vocabulary):
 *   W3 operna_zed   → engine operne_zdi
 *   W3 zaklady      → engine (no bare type) — foundation family; exact target
 *                     resolved when the head-noun layer lands (Gate 2). RED here
 *                     asserts only "not the residual 'other'".
 *   W3 zdivo_obklad → engine: NONE today → the explicit reject value (Gate 3).
 *   W3 driky_piliru / mostovkova_deska / rimsa → identical names.
 *
 * Context-dependent cases that need the Gate-2 context API (the engine's
 * ClassificationContext currently carries only `is_bridge`, not the
 * bridge | retaining_wall | building construction-context that W3 keys off):
 *   #63 "Dřík konstrukce" @ retaining_wall → operne_zdi
 *   #74 "Dřík" @ retaining_wall            → operne_zdi
 * They are intentionally NOT in this file yet — they land with the context API
 * in Gate 2 so they can be expressed without a type error.
 */
import { describe, it, expect } from 'vitest';
import { classifyElement } from './element-classifier.js';
import { planElement, type PlannerInput } from '../calculators/planner-orchestrator.js';
import { ELEMENT_CLASSIFICATION_RULES as KB } from '../kb-generated/element-classification-rules.js';

// ── Directed roll-up: engine-fine type → coarse parity family, and W3-coarse
//    type → the same family (condition 1: parity at the FAMILY level — the
//    engine may be MORE precise, never cross into a foreign family). Transitory:
//    used only until the MCP side delegates typing to the engine.
const familyOf = (engineType: string): string | undefined =>
  (KB.type_core as Record<string, { family: string }>)[engineType]?.family;
const w3Family = (w3CoarseType: string): string | undefined =>
  (KB.w3_family as Record<string, string>)[w3CoarseType];
/** Assert the engine output rolls up to the same family as the W3 expectation. */
const expectW3Family = (engineType: string, w3Expected: string) =>
  expect(familyOf(engineType)).toBe(w3Family(w3Expected));

describe('W3 parity — CONTROLS (must stay green after every gate)', () => {
  it('foundation of a pier (head unambiguous)', () => {
    expect(classifyElement('ZÁKLADY PILÍŘŮ').element_type).toBe('zaklady_piliru');
  });
  it('bridge deck', () => {
    expect(classifyElement('Mostovková deska').element_type).toBe('mostovkova_deska');
  });
  it('cornice (OTSKP rung — pos.317325 analogue, src=otskp, conf 1.0)', () => {
    const r = classifyElement('ŘÍMSOVÁ DESKA');
    expect(r.element_type).toBe('rimsa');
    // The OTSKP code-rung is genuine 1.0 and must NOT be touched by the
    // keyword-honesty fix (Gate 3). This pins it as a regression control.
    expect(r.classification_source).toBe('otskp');
    expect(r.confidence).toBe(1.0);
  });
  it('retaining wall (pozemní)', () => {
    expect(classifyElement('Opěrná stěna levá').element_type).toBe('operne_zdi');
  });
  it('#64 pier shaft stays a pier in bridge context', () => {
    expect(classifyElement('Dříky pilířů P1-P4', { is_bridge: true }).element_type).toBe('driky_piliru');
    expect(classifyElement('Dříky pilířů', { is_bridge: true }).element_type).toBe('driky_piliru');
  });
  it('#67 "Římsa-kotevní trám" stays a římsa (říms beats trám)', () => {
    expect(classifyElement('Římsa-kotevní trám').element_type).toBe('rimsa');
  });
  it('#73 generic "Dřík" under a bridge is a pier', () => {
    expect(classifyElement('Dřík', { is_bridge: true }).element_type).toBe('driky_piliru');
  });
});

describe('W3 parity — GREEN at Gate 2b (head-noun + context layer)', () => {
  it('#68 NK head beats "trám" modifier → deck family (was rigel)', () => {
    const t = classifyElement('Trámy dvoutrámové nosné konstrukce', { is_bridge: true }).element_type;
    expectW3Family(t, 'mostovkova_deska');           // family parity
    expect(t).toBe('mostovkova_deska');              // engine-suite pins the fine type
  });
  it('#66 head noun "základ" rolls up to the foundation family (was "other")', () => {
    const t = classifyElement('Železobetonový základ 0,56×2,75').element_type;
    expectW3Family(t, 'zaklady');                    // W3 'zaklady' → foundation
    expect(familyOf(t)).toBe('foundation');
    // Fine type (zaklady_piliru vs zakladovy_pas) is the engine suite's concern,
    // NOT W3 parity — so it is intentionally not pinned here.
  });
  it('#74 bare "Dřík" with no context defaults to the wall family, not pier', () => {
    const t = classifyElement('Dřík').element_type;
    expectW3Family(t, 'operna_zed');                 // W3 'operna_zed' → wall
    expect(t).toBe('operne_zdi');
  });
  it('#63 "Dřík konstrukce" in retaining_wall context is a wall, not a pier', () => {
    const t = classifyElement('Dřík konstrukce', { construction_context: 'retaining_wall' }).element_type;
    expectW3Family(t, 'operna_zed');
    expect(t).toBe('operne_zdi');
  });
});

describe('W3 parity — LIVE path (orchestrator planElement, not hand-fed context)', () => {
  // Proves the head-noun layer fires through the real engine entry point
  // (planElement → classifyElement), driven only by is_bridge — exactly what the
  // orchestrator and UI supply. element_type omitted so the name is classified.
  const base: PlannerInput = {
    volume_m3: 120, formwork_area_m2: 80,
    has_dilatacni_spary: true, spara_spacing_m: 10, total_length_m: 50, adjacent_sections: true,
  };
  const liveType = (element_name: string, is_bridge: boolean) =>
    planElement({ ...base, element_type: undefined, element_name, is_bridge }).element.type;

  it('#74 live: bare "Dřík" on a non-bridge object → wall (operne_zdi)', () => {
    expect(liveType('Dřík', false)).toBe('operne_zdi');
  });
  it('#73 live: "Dřík" on a bridge object (is_bridge) → pier (driky_piliru)', () => {
    expect(liveType('Dřík', true)).toBe('driky_piliru');
  });
  it('#68 live: NK head beats "trám" on a bridge object → mostovkova_deska', () => {
    expect(liveType('Trámy dvoutrámové nosné konstrukce', true)).toBe('mostovkova_deska');
  });
  // The #63 OUTCOME (a retaining-wall dřík → wall) is identical to #74's
  // non-bridge result and is thus also reachable live via is_bridge=false; the
  // explicit construction_context='retaining_wall' is test-only + inert in 2b
  // (no rule distinguishes retaining_wall from building yet). See
  // resolveConstructionContext() for the threading plan when that changes.
});

describe('W3 parity — RED targets (flip .fails → it at the owning gate)', () => {
  // ── Gate 3 — reject ────────────────────────────────────────────────────────
  it.fails('#65 [Gate3] "obklad … do dříku" is cladding (reject), never a pier', () => {
    // Head is *obklad*; "do dříku" is a prepositional tail. Target = the explicit
    // reject value (W3 zdivo_obklad). Until that exists, assert "not a pier".
    expect(classifyElement('Lícový obklad z lomového kamene kotvený do dříku').element_type)
      .not.toBe('driky_piliru');
  });

  // ── Gate 3 — honest confidence ─────────────────────────────────────────────
  it.fails('[Gate3] keyword-fallback must NOT report a fake 1.0 confidence', () => {
    // "Opěrná stěna levá" matches by keyword (src=keywords) yet the engine
    // currently reports confidence 1.0 — the bogus "z klíčových slov 100%".
    const r = classifyElement('Opěrná stěna levá');
    expect(r.classification_source).toBe('keywords');
    expect(r.confidence).toBeLessThan(1.0);
  });

  // ── Gate 4 — dřík/opěra suppression ────────────────────────────────────────
  it.fails('[Gate4] "Dřík opěry" is an abutment (opery_ulozne_prahy), not a pier', () => {
    expect(classifyElement('Dřík opěry OP1', { is_bridge: true }).element_type)
      .toBe('opery_ulozne_prahy');
  });
});
