/**
 * warnings_structured (v4.22 Phase 2, shipped 2026-07) — hermetic suite.
 *
 * The parallel severity field mirrors legacy `warnings: string[]` 1:1 via the
 * ⛔/🚨 (critical) / ⚠️ (warning) / ℹ️ (info) emoji-prefix convention.
 */
import { describe, it, expect } from 'vitest';
import { planElement, structureWarnings } from './planner-orchestrator.js';

describe('structureWarnings — prefix classification', () => {
  it('classifies the three canonical prefixes', () => {
    const out = structureWarnings([
      '⛔ KRITICKÉ: objem nesedí',
      '⚠️ Neobvyklá hodnota',
      'ℹ️ Jen pro informaci',
    ]);
    expect(out.map(w => w.severity)).toEqual(['critical', 'warning', 'info']);
    // Messages preserved verbatim, same order as legacy warnings[]
    expect(out[0].message).toContain('objem nesedí');
  });

  it('legacy 🚨 prefix (v4.19 D1) reads as critical', () => {
    expect(structureWarnings(['🚨 KRITICKÉ: chybí výška'])[0].severity).toBe('critical');
  });

  it('unprefixed message defaults to warning (historical orange rendering)', () => {
    expect(structureWarnings(['Doporučeno ověřit v RDS'])[0].severity).toBe('warning');
  });

  it('mixed emojis — the EARLIEST marker decides', () => {
    expect(structureWarnings(['⚠️ Pozor: viz ℹ️ nápověda'])[0].severity).toBe('warning');
    expect(structureWarnings(['ℹ️ Info cituje ⚠️ varování'])[0].severity).toBe('info');
  });
});

describe('warnings_structured on PlannerOutput', () => {
  it('mirrors warnings 1:1 on the main path', () => {
    const plan = planElement({
      element_type: 'stena',
      volume_m3: 50,
      height_m: 3,
      concrete_class: 'C25/30',
    });
    expect(plan.warnings_structured).toHaveLength(plan.warnings.length);
    expect(plan.warnings_structured.map(w => w.message)).toEqual(plan.warnings);
  });

  it('SO-207 class input mistake surfaces as critical (volume-vs-geometry)', () => {
    // V=605 m³ entered for a 9×36 m × 13 m estakáda (~4 000 m³ expected)
    const plan = planElement({
      element_type: 'mostovkova_deska',
      volume_m3: 605,
      height_m: 10,
      span_m: 36,
      num_spans: 9,
      nk_width_m: 13,
      concrete_class: 'C30/37',
    });
    expect(plan.warnings_structured.some(w => w.severity === 'critical')).toBe(true);
    // The critical lands at the TOP (warnings.unshift in the engine)
    expect(plan.warnings_structured[0].severity).toBe('critical');
  });

  it('pile path carries the field too', () => {
    const plan = planElement({
      element_type: 'pilota',
      volume_m3: 0,
      pile_diameter_mm: 900,
      pile_length_m: 12,
      pile_count: 8,
      concrete_class: 'C25/30',
    });
    expect(Array.isArray(plan.warnings_structured)).toBe(true);
    expect(plan.warnings_structured).toHaveLength(plan.warnings.length);
  });
});
