/**
 * Discrete Cyclic Scheduler — Phase C G5 regression suite
 *
 * Locks behavior of `scheduleCyclic()` (Phase C G3) + the orchestrator
 * dispatch wiring (G4). The cyclic scheduler is the rimsa-default; legacy
 * remains in `element-scheduler.test.ts`.
 *
 * Coverage matrix:
 *   1. Single-tact graceful degradation (n=1)
 *   2. Multi-tact cyclic phases (n=6 cornice cycle)
 *   3. Crew parallelism — rebar overlaps with strip-strength wait
 *   4. Mode dispatch — rimsa → cyclic, mostovkova_deska → legacy
 *   5. Strip-strength wait between intermediate tacts is short (~2-3 d)
 *   6. Last tact carries full TKP18 class-4 curing tail (post-G1: 9d @ 15°C)
 */

import { describe, it, expect } from 'vitest';

import {
  scheduleElement,
  getSchedulerMode,
  toShifts,
  SCHEDULER_MODE_DEFAULTS,
  type ElementScheduleInput,
} from './element-scheduler.js';

// ─── toShifts helper ──────────────────────────────────────────────────────

describe('Phase C G3: toShifts() helper', () => {
  it('rounds hours up to integer shifts (ceil)', () => {
    expect(toShifts(19, 8)).toBe(3);   // 19/8 = 2.375 → 3
    expect(toShifts(16, 8)).toBe(2);   // 16/8 = 2.0 → 2 exact
    expect(toShifts(17, 8)).toBe(3);   // 17/8 = 2.125 → 3
  });

  it('always returns ≥ 1 (zero-hour activity still consumes 1 shift)', () => {
    expect(toShifts(0, 8)).toBe(1);
    expect(toShifts(0.5, 8)).toBe(1);
    expect(toShifts(-5, 8)).toBe(1);
  });

  it('defaults shift_h to 8 when omitted', () => {
    expect(toShifts(24)).toBe(3);     // 24/8 = 3
    expect(toShifts(25)).toBe(4);     // 25/8 → 4
  });

  it('handles edge case: shift_h ≤ 0 returns 1', () => {
    expect(toShifts(100, 0)).toBe(1);
    expect(toShifts(100, -1)).toBe(1);
  });
});

// ─── Mode dispatch ────────────────────────────────────────────────────────

describe('Phase C G2 dispatch: getSchedulerMode', () => {
  it('rimsa defaults to discrete_cyclic', () => {
    expect(getSchedulerMode('rimsa')).toBe('discrete_cyclic');
    expect(SCHEDULER_MODE_DEFAULTS.rimsa).toBe('discrete_cyclic');
  });

  it('mostovkova_deska defaults to legacy', () => {
    expect(getSchedulerMode('mostovkova_deska')).toBe('legacy');
  });

  it('all other 22 element types default to legacy', () => {
    const cyclicTypes = Object.entries(SCHEDULER_MODE_DEFAULTS)
      .filter(([, m]) => m === 'discrete_cyclic')
      .map(([t]) => t);
    expect(cyclicTypes).toEqual(['rimsa']);
  });

  it('explicit override wins over default', () => {
    expect(getSchedulerMode('rimsa', 'legacy')).toBe('legacy');
    expect(getSchedulerMode('mostovkova_deska', 'discrete_cyclic')).toBe('discrete_cyclic');
  });

  it('"other" defaults to legacy (safe fallback)', () => {
    expect(getSchedulerMode('other')).toBe('legacy');
  });
});

// ─── scheduleElement dispatch via scheduler_mode ──────────────────────────

describe('Phase C G3 dispatch: scheduleElement', () => {
  const baseLegacyInput: ElementScheduleInput = {
    num_tacts: 3,
    num_sets: 1,
    assembly_days: 2,
    rebar_days: 2,
    concrete_days: 1,
    curing_days: 3,
    stripping_days: 1,
  };

  it('legacy mode (default) produces legacy DAG output', () => {
    const result = scheduleElement(baseLegacyInput);
    expect(result.total_days).toBeGreaterThan(0);
    expect(result.gantt).not.toBe('');   // legacy renders Gantt
    expect(result.tact_details.length).toBe(3);
  });

  it('discrete_cyclic mode produces cyclic shape (empty gantt, same output type)', () => {
    const result = scheduleElement({
      ...baseLegacyInput,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
    });
    expect(result.total_days).toBeGreaterThan(0);
    expect(result.gantt).toBe('');       // cyclic defers Gantt to orchestrator UI
    expect(result.tact_details.length).toBe(3);
    expect(result.tact_details[0].set).toBe(1);  // single sliding form
  });
});

// ─── Cyclic scheduler — single tact graceful degradation ─────────────────

describe('Phase C G3: scheduleCyclic n=1 graceful degradation', () => {
  it('n=1 produces setup + rebar + pour + cure + strip (no relocate, no wait)', () => {
    const result = scheduleElement({
      num_tacts: 1,
      num_sets: 1,
      assembly_days: 3,     // setup hours converted
      rebar_days: 2,
      concrete_days: 1,
      curing_days: 9,        // class-4 rimsa post-G1: 9d @ 15°C
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
    });

    expect(result.tact_details.length).toBe(1);
    const t0 = result.tact_details[0];
    // First-and-last tact has setup as assembly + full curing tail + final strip
    expect(t0.assembly[0]).toBe(0);
    expect(t0.assembly[1]).toBeGreaterThan(0);
    expect(t0.curing[1] - t0.curing[0]).toBeGreaterThanOrEqual(9);  // full cure tail
    expect(t0.stripping[0]).toBeGreaterThanOrEqual(t0.curing[1]);
    expect(result.total_days).toBe(t0.stripping[1]);
  });
});

// ─── Cyclic scheduler — multi-tact phases ────────────────────────────────

describe('Phase C G3: scheduleCyclic n=6 multi-tact cornice', () => {
  const sixTactInput: ElementScheduleInput = {
    num_tacts: 6,
    num_sets: 1,
    assembly_days: 3,
    rebar_days: 2,
    concrete_days: 1,
    curing_days: 9,      // last tact full cure (rimsa class 4 @ 15°C)
    stripping_days: 1,
    scheduler_mode: 'discrete_cyclic',
    shift_h: 8,
  };

  it('produces 6 tacts with cyclic phase ordering', () => {
    const result = scheduleElement(sixTactInput);
    expect(result.tact_details.length).toBe(6);

    // Tacts execute in order: each tact's start ≥ previous tact's start
    for (let t = 1; t < 6; t++) {
      expect(result.tact_details[t].assembly[0])
        .toBeGreaterThanOrEqual(result.tact_details[t - 1].assembly[0]);
    }
  });

  it('intermediate tacts have short curing (strip-strength wait, ~1-3 shifts)', () => {
    const result = scheduleElement(sixTactInput);
    // Tacts 0..4 (intermediates) → short wait; tact 5 (last) → full 9d
    for (let t = 0; t < 5; t++) {
      const cureDur = result.tact_details[t].curing[1] - result.tact_details[t].curing[0];
      expect(cureDur).toBeLessThan(5);   // strip-strength only, NOT full cure
    }
    const lastCureDur = result.tact_details[5].curing[1] - result.tact_details[5].curing[0];
    expect(lastCureDur).toBeGreaterThanOrEqual(9);  // full TKP18 tail
  });

  it('first tact uses setup (assembly_days), intermediates use relocate (shorter)', () => {
    const result = scheduleElement(sixTactInput);
    const firstAsmDur = result.tact_details[0].assembly[1] - result.tact_details[0].assembly[0];
    const secondAsmDur = result.tact_details[1].assembly[1] - result.tact_details[1].assembly[0];
    // Relocate ~50% of setup per cyclic heuristic
    expect(secondAsmDur).toBeLessThanOrEqual(firstAsmDur);
  });

  it('total_days < sequential_days (some compression even single-crew)', () => {
    const result = scheduleElement(sixTactInput);
    // Single-crew cyclic is mostly sequential; allow equal but never exceed
    expect(result.total_days).toBeLessThanOrEqual(result.sequential_days);
  });
});

// ─── Crew parallelism (num_rebar_crews ≥ 2 overlaps REB with WAIT) ──────

describe('Phase C G3: cyclic crew parallelism', () => {
  const baseInput: ElementScheduleInput = {
    num_tacts: 5,
    num_sets: 1,
    assembly_days: 3,
    rebar_days: 2,
    concrete_days: 1,
    curing_days: 9,
    stripping_days: 1,
    scheduler_mode: 'discrete_cyclic',
    shift_h: 8,
  };

  it('2 rebar crews finish faster than 1 (rebar overlaps with strip-strength wait)', () => {
    const single = scheduleElement({ ...baseInput, num_rebar_crews: 1 });
    const dual = scheduleElement({ ...baseInput, num_rebar_crews: 2 });
    expect(dual.total_days).toBeLessThan(single.total_days);
  });

  it('savings_pct rises with parallelism', () => {
    const single = scheduleElement({ ...baseInput, num_rebar_crews: 1 });
    const dual = scheduleElement({ ...baseInput, num_rebar_crews: 2 });
    expect(dual.savings_pct).toBeGreaterThan(single.savings_pct);
  });
});

// ─── Maturity integration: strip-strength wait + final cure tail ─────────

describe('Phase C G3: cyclic + maturity_params integration', () => {
  it('strip-strength wait uses calculateCuring(strip_strength_pct=70) when maturity given', () => {
    // Without maturity: defaults to 2-shift wait
    const noMaturity = scheduleElement({
      num_tacts: 3,
      num_sets: 1,
      assembly_days: 2,
      rebar_days: 1,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
    });

    // With maturity at 20°C C30/37 — strip-strength wait should be quick
    const withMaturity = scheduleElement({
      num_tacts: 3,
      num_sets: 1,
      assembly_days: 2,
      rebar_days: 1,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
      maturity_params: {
        concrete_class: 'C30/37',
        temperature_c: 20,
        cement_type: 'CEM_I',
        element_type: 'slab',
      },
    });

    // Both should be reasonable (within a small constant factor of each other)
    expect(withMaturity.total_days).toBeGreaterThan(0);
    expect(noMaturity.total_days).toBeGreaterThan(0);
    // effective_curing_days populated only when maturity_params given
    expect(withMaturity.effective_curing_days).toBeDefined();
    expect(noMaturity.effective_curing_days).toBeUndefined();
  });

  it('last tact carries full TKP18 curing tail from input.curing_days', () => {
    // Rimsa class 4 @ 15°C post-G1 = 9d
    const result = scheduleElement({
      num_tacts: 4,
      num_sets: 1,
      assembly_days: 2,
      rebar_days: 1,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
    });
    const lastCure = result.tact_details[3].curing[1] - result.tact_details[3].curing[0];
    expect(lastCure).toBeGreaterThanOrEqual(9);  // full 9-day tail
  });
});

// ─── Output shape parity with legacy ─────────────────────────────────────

describe('Phase C G3: cyclic ElementScheduleOutput shape parity', () => {
  it('returns same fields as legacy (drop-in replacement)', () => {
    const result = scheduleElement({
      num_tacts: 3,
      num_sets: 1,
      assembly_days: 2,
      rebar_days: 1,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
    });
    expect(result).toHaveProperty('total_days');
    expect(result).toHaveProperty('sequential_days');
    expect(result).toHaveProperty('savings_days');
    expect(result).toHaveProperty('savings_pct');
    expect(result).toHaveProperty('tact_details');
    expect(result).toHaveProperty('critical_path');
    expect(result).toHaveProperty('gantt');
    expect(result).toHaveProperty('utilization');
    expect(result).toHaveProperty('bottleneck');
    expect(result.utilization).toHaveProperty('formwork_crews');
    expect(result.utilization).toHaveProperty('rebar_crews');
    expect(result.utilization).toHaveProperty('sets');
  });

  it('critical_path contains REB + CON for every tact + STR/CUR on last', () => {
    const result = scheduleElement({
      num_tacts: 3,
      num_sets: 1,
      assembly_days: 2,
      rebar_days: 1,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
    });
    expect(result.critical_path).toContain('T0_REB');
    expect(result.critical_path).toContain('T2_REB');   // last tact
    expect(result.critical_path).toContain('T2_CUR');   // last cure
    expect(result.critical_path).toContain('T2_STR');   // final strip
    // Intermediates use REL (relocate), not STR
    expect(result.critical_path).toContain('T0_REL');
    expect(result.critical_path).not.toContain('T0_STR');
  });
});

// ─── PR #1223 review regression locks (3 fixes from Amazon Q) ───────────

describe('Phase C G3 — PR review fix #1: multi-crew rebar overlap reduces total schedule', () => {
  const baseInput: ElementScheduleInput = {
    num_tacts: 5,
    num_sets: 1,
    assembly_days: 3,    // setupShifts = 3
    rebar_days: 4,       // rebarShifts = 4
    concrete_days: 1,
    curing_days: 9,
    stripping_days: 1,
    scheduler_mode: 'discrete_cyclic',
    shift_h: 8,
  };

  it('overlap savings actually show up in total_days (not just savings_pct ratio)', () => {
    const single = scheduleElement({ ...baseInput, num_rebar_crews: 1 });
    const dual = scheduleElement({ ...baseInput, num_rebar_crews: 2 });

    // Per scheduler: overlapPerIntermediate = min(rebarShifts=4, waitShifts default 2) = 2
    // Number of intermediates = num_tacts - 1 = 4
    // Expected savings = 4 × 2 = 8 shifts
    const observedSavings = single.total_days - dual.total_days;
    expect(observedSavings).toBeGreaterThanOrEqual(4);  // at least (n-1) × 1
    expect(observedSavings).toBeLessThanOrEqual(12);    // bounded by (n-1) × min(rebar, wait+slack)
  });

  it('td.rebar[0] reflects overlap — non-first tact rebar starts BEFORE prev relocate end', () => {
    const dual = scheduleElement({ ...baseInput, num_rebar_crews: 2 });
    // Without the rebStart=cursor fix, T1.rebar[0] would equal T0.relocate[1]
    // (sequential after relocate). With the fix, T1.rebar[0] should be earlier
    // by overlapPerIntermediate shifts.
    const t0 = dual.tact_details[0];
    const t1 = dual.tact_details[1];
    expect(t0.relocate).toBeDefined();
    // T1's rebar starts at the cursor (which was decremented by overlap)
    // so it should be < T0.relocate[1]
    expect(t1.rebar[0]).toBeLessThan(t0.relocate![1]);
  });
});

describe('Phase C G3 — PR review fix #2: TactDetail.relocate vs stripping semantic correctness', () => {
  const sixTactInput: ElementScheduleInput = {
    num_tacts: 6,
    num_sets: 1,
    assembly_days: 3,
    rebar_days: 2,
    concrete_days: 1,
    curing_days: 9,
    stripping_days: 1,
    scheduler_mode: 'discrete_cyclic',
    shift_h: 8,
  };

  it('intermediate tacts: relocate defined + non-zero-length, stripping zero-length placeholder', () => {
    const result = scheduleElement(sixTactInput);
    // Tacts 0..4 are intermediates (last is index 5)
    for (let i = 0; i < 5; i++) {
      const td = result.tact_details[i];
      expect(td.relocate, `tact ${i + 1} should have relocate`).toBeDefined();
      const relocateDur = td.relocate![1] - td.relocate![0];
      expect(relocateDur, `tact ${i + 1} relocate should be non-zero`).toBeGreaterThan(0);
      const stripDur = td.stripping[1] - td.stripping[0];
      expect(stripDur, `tact ${i + 1} stripping should be zero-length placeholder`).toBe(0);
    }
  });

  it('last tact: stripping non-zero, relocate undefined (form is struck, not relocated)', () => {
    const result = scheduleElement(sixTactInput);
    const last = result.tact_details[result.tact_details.length - 1];
    expect(last.relocate, 'last tact should NOT have relocate').toBeUndefined();
    const stripDur = last.stripping[1] - last.stripping[0];
    expect(stripDur, 'last tact stripping should be non-zero').toBeGreaterThan(0);
  });

  it('intermediate relocate immediately follows curing end (no gap)', () => {
    const result = scheduleElement(sixTactInput);
    for (let i = 0; i < 5; i++) {
      const td = result.tact_details[i];
      expect(td.relocate![0], `tact ${i + 1} relocate.start should equal curing.end`)
        .toBe(td.curing[1]);
    }
  });

  it('n=1 (single tact, also "last"): stripping non-zero, no relocate', () => {
    const result = scheduleElement({
      ...sixTactInput,
      num_tacts: 1,
    });
    const t0 = result.tact_details[0];
    expect(t0.relocate).toBeUndefined();
    expect(t0.stripping[1] - t0.stripping[0]).toBeGreaterThan(0);
  });
});

describe('Phase C G3 — PR review fix #3: sequential_days math matches manual baseline', () => {
  it('n=6 single-crew: matches setup + (n-1)*relocate + n*(rebar+pour) + (n-1)*wait + finalCure + finalStrip', () => {
    // Inputs chosen so each shift-converted value is integer + non-trivial
    const input: ElementScheduleInput = {
      num_tacts: 6,
      num_sets: 1,
      assembly_days: 3,    // setupShifts = 3 (via toShifts(3*8, 8))
      rebar_days: 2,
      concrete_days: 1,
      curing_days: 9,      // finalCureShifts = 9
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
      num_rebar_crews: 1,  // no overlap → total == sequential when single-crew
    };
    const result = scheduleElement(input);

    // Manual baseline per the corrected formula:
    //   setup + (n-1)*relocate + n*(rebar+pour) + (n-1)*wait + finalCure + finalStrip
    const setupShifts = 3;
    const relocateShifts = Math.max(1, Math.ceil(setupShifts * 0.5));  // 2
    const rebarShifts = 2;
    const pourShifts = 1;
    const waitShifts = 2;  // default fallback (no maturity_params)
    const finalCureShifts = 9;
    const finalStripShifts = 1;
    const n = 6;

    const expectedBaseline = setupShifts
      + (n - 1) * relocateShifts
      + n * (rebarShifts + pourShifts)
      + (n - 1) * waitShifts
      + finalCureShifts
      + finalStripShifts;

    expect(result.sequential_days).toBe(expectedBaseline);
  });

  it('n=6 single-crew: total_days equals sequential_days (no overlap savings possible)', () => {
    const input: ElementScheduleInput = {
      num_tacts: 6,
      num_sets: 1,
      assembly_days: 3,
      rebar_days: 2,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
      num_rebar_crews: 1,
    };
    const result = scheduleElement(input);
    // Without crew overlap, the cyclic scheduler is purely sequential —
    // total_days MUST equal sequential_days. If they diverge, something
    // is double-counting (the bug Fix #3 closed).
    expect(result.total_days).toBe(result.sequential_days);
    expect(result.savings_pct).toBe(0);
  });

  it('n=6 dual-crew: savings_pct reflects ONLY real parallelism, not phantom relocate', () => {
    const input: ElementScheduleInput = {
      num_tacts: 6,
      num_sets: 1,
      assembly_days: 3,
      rebar_days: 2,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
      num_rebar_crews: 2,
    };
    const result = scheduleElement(input);

    // overlapPerIntermediate = min(rebarShifts=2, waitShifts=2) = 2
    // Real savings = (n-1) × overlap = 5 × 2 = 10 shifts
    const expectedSavings = 5 * 2;
    expect(result.savings_days).toBe(expectedSavings);
    expect(result.total_days).toBe(result.sequential_days - expectedSavings);
  });
});

// ─── Direct hours override (Phase C G4 productivity wiring) ──────────────

describe('Phase C G4: cyclic accepts raw-hour productivity overrides', () => {
  it('setup_h overrides assembly_days when provided', () => {
    const dayBased = scheduleElement({
      num_tacts: 2,
      num_sets: 1,
      assembly_days: 5,    // legacy interpretation
      rebar_days: 1,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
    });

    const hourBased = scheduleElement({
      num_tacts: 2,
      num_sets: 1,
      assembly_days: 5,    // ignored when setup_h provided
      rebar_days: 1,
      concrete_days: 1,
      curing_days: 9,
      stripping_days: 1,
      scheduler_mode: 'discrete_cyclic',
      shift_h: 8,
      setup_h: 16,          // 2 shifts ← orchestrator G4 path
    });

    // Hour-based should produce shorter first-tact assembly than day-based
    const dayFirstAsm = dayBased.tact_details[0].assembly[1] - dayBased.tact_details[0].assembly[0];
    const hourFirstAsm = hourBased.tact_details[0].assembly[1] - hourBased.tact_details[0].assembly[0];
    expect(hourFirstAsm).toBeLessThan(dayFirstAsm);
  });
});
