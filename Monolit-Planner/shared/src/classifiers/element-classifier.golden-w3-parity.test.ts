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

describe('W3 parity — RED targets (flip .fails → it at the owning gate)', () => {
  // ── Gate 2 — head-noun layer ───────────────────────────────────────────────
  it.fails('#68 [Gate2] NK head beats "trám" modifier → mostovkova_deska (now: rigel)', () => {
    expect(classifyElement('Trámy dvoutrámové nosné konstrukce', { is_bridge: true }).element_type)
      .toBe('mostovkova_deska');
  });
  it.fails('#66 [Gate2] head noun "základ" must not fall to residual "other"', () => {
    // Exact foundation target resolved with the head-noun layer; here we only
    // assert it stops being the residual category.
    expect(classifyElement('Železobetonový základ 0,56×2,75').element_type)
      .not.toBe('other');
  });
  it.fails('#74 [Gate2] bare "Dřík" with no bridge context defaults to wall, not pier', () => {
    // W3 default direction: a stem with no context is a wall stem (operne_zdi),
    // not a bridge pier. Engine currently defaults to driky_piliru.
    expect(classifyElement('Dřík').element_type).toBe('operne_zdi');
  });

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
