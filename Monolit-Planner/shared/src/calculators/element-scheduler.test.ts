/**
 * Element Scheduler Tests — RCPSP Graph-Based Construction Scheduling
 *
 * Tests for scheduleElement() covering:
 * - Single tact (trivial case)
 * - Multi-tact sequential (1 set)
 * - Multi-tact parallel (2+ sets)
 * - Rebar overlap (SS lag variants)
 * - Multiple crews
 * - Critical path correctness
 * - Edge cases
 * - Gantt chart output
 */

import { describe, it, expect } from 'vitest';
import { scheduleElement, type ElementScheduleInput, type ElementScheduleOutput } from './element-scheduler';

// Helper to build input with defaults
function makeInput(overrides: Partial<ElementScheduleInput> = {}): ElementScheduleInput {
  return {
    num_tacts: 4,
    num_sets: 2,
    assembly_days: 3,
    rebar_days: 2,
    concrete_days: 1,
    curing_days: 5,
    stripping_days: 1,
    num_formwork_crews: 1,
    num_rebar_crews: 1,
    rebar_lag_pct: 50,   // rebar starts halfway through assembly
    ...overrides,
  };
}

describe('Element Scheduler — RCPSP', () => {
  // ──────────────────────────────────────────────────────────────────────
  // 1. Edge cases
  // ──────────────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should return 0 for 0 tacts', () => {
      const result = scheduleElement(makeInput({ num_tacts: 0 }));
      expect(result.total_days).toBe(0);
      expect(result.tact_details).toHaveLength(0);
    });

    it('should handle single tact correctly', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 1,
        num_sets: 1,
        assembly_days: 3,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 100,  // sequential: rebar after assembly
      }));

      // Single tact, sequential: 3 + 2 + 1 + 5 + 1 = 12
      expect(result.total_days).toBe(12);
      expect(result.sequential_days).toBe(12);
      expect(result.savings_pct).toBe(0);
      expect(result.tact_details).toHaveLength(1);
    });

    it('should handle single tact with rebar overlap', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 1,
        num_sets: 1,
        assembly_days: 4,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 50,  // rebar starts at day 2 (50% of 4)
      }));

      // ASM: 0-4, REB: 2-4, CON: 4-5, CUR: 5-10, STR: 10-11
      expect(result.total_days).toBe(11);
      // Sequential baseline: 4+2+1+5+1 = 13
      expect(result.sequential_days).toBe(13);
    });

    it('should cap num_sets to num_tacts', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 2,
        num_sets: 5,  // more sets than tacts
      }));

      // Should effectively use 2 sets (capped)
      expect(result.tact_details).toHaveLength(2);
      expect(result.total_days).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Sequential scheduling (1 set)
  // ──────────────────────────────────────────────────────────────────────

  describe('Sequential (1 set)', () => {
    it('should schedule all tacts sequentially with 1 set', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 3,
        num_sets: 1,
        assembly_days: 2,
        rebar_days: 1,
        concrete_days: 1,
        curing_days: 3,
        stripping_days: 1,
        rebar_lag_pct: 100,  // sequential rebar
      }));

      // Per tact: 2+1+1+3+1 = 8 days
      // 3 tacts × 8 = 24 days (sequential, no overlap possible with 1 set)
      expect(result.total_days).toBe(24);
      expect(result.sequential_days).toBe(24);
      expect(result.savings_pct).toBe(0);
    });

    it('should still overlap rebar with assembly even with 1 set', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 2,
        num_sets: 1,
        assembly_days: 4,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 3,
        stripping_days: 1,
        rebar_lag_pct: 50,  // rebar starts at 50% of assembly
      }));

      // Tact 1: ASM 0-4, REB 2-4, CON 4-5, CUR 5-8, STR 8-9
      // Tact 2: ASM 9-13, REB 11-13, CON 13-14, CUR 14-17, STR 17-18
      // Total: 18
      expect(result.total_days).toBe(18);
      // Sequential baseline: 2 × (4+2+1+3+1) = 22
      expect(result.sequential_days).toBe(22);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. Parallel scheduling (2+ sets) — THE KEY FEATURE
  // ──────────────────────────────────────────────────────────────────────

  describe('Parallel (2 sets)', () => {
    it('should overlap work on 2 sets during curing', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
        assembly_days: 3,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 100,  // sequential rebar for clarity
        num_formwork_crews: 1,
        num_rebar_crews: 1,
      }));

      // With 2 sets, while T1 cures on set 1, FW crew does T2 on set 2
      // Much less than sequential: 4 × (3+2+1+5+1) = 48
      expect(result.total_days).toBeLessThan(result.sequential_days);
      expect(result.savings_pct).toBeGreaterThan(0);

      // Verify tact-set assignments: T1→S1, T2→S2, T3→S1, T4→S2
      expect(result.tact_details[0].set).toBe(1);
      expect(result.tact_details[1].set).toBe(2);
      expect(result.tact_details[2].set).toBe(1);
      expect(result.tact_details[3].set).toBe(2);
    });

    it('should schedule T2 during T1 curing', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 2,
        num_sets: 2,
        assembly_days: 2,
        rebar_days: 1,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 100,
        num_formwork_crews: 1,
        num_rebar_crews: 1,
      }));

      const t1 = result.tact_details[0];
      const t2 = result.tact_details[1];

      // T1: ASM 0-2, REB 2-3, CON 3-4, CUR 4-9, STR 9-10
      // T2: ASM 2-4 (FW crew free after T1 ASM), REB needs to wait for rebar crew...
      // Actually: T1 ASM 0-2, FW free at 2
      //           T2 ASM 2-4 (FW), T1 REB 2-3 (RB), T2 REB 4-5 (RB)
      //           T1 CON 3-4, T2 CON 5-6
      //           T1 CUR 4-9, T2 CUR 6-11
      //           T1 STR 9-10 (FW free at 4 after T2 ASM, but need to wait for curing)
      //           T2 STR 11-12

      // T2 assembly starts during T1's work (overlap!)
      expect(t2.assembly[0]).toBeLessThan(t1.stripping[0]);

      // Total should be much less than 2 × 10 = 20
      expect(result.total_days).toBeLessThan(20);
    });

    it('should achieve ~50% savings with 2 sets and long curing', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 6,
        num_sets: 2,
        assembly_days: 2,
        rebar_days: 1,
        concrete_days: 1,
        curing_days: 8,  // long curing — plenty of time for parallel work
        stripping_days: 1,
        rebar_lag_pct: 100,
      }));

      // Sequential: 6 × (2+1+1+8+1) = 78
      // With 2 sets, roughly half: ~39 + overhead
      expect(result.savings_pct).toBeGreaterThan(30);
    });
  });

  describe('Parallel (3 sets)', () => {
    it('should further reduce time with 3 sets', () => {
      const result2 = scheduleElement(makeInput({
        num_tacts: 6,
        num_sets: 2,
        assembly_days: 2,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 7,
        stripping_days: 1,
        rebar_lag_pct: 50,
      }));

      const result3 = scheduleElement(makeInput({
        num_tacts: 6,
        num_sets: 3,
        assembly_days: 2,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 7,
        stripping_days: 1,
        rebar_lag_pct: 50,
      }));

      // 3 sets should be <= 2 sets (more parallelism)
      expect(result3.total_days).toBeLessThanOrEqual(result2.total_days);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Rebar overlap (SS lag)
  // ──────────────────────────────────────────────────────────────────────

  describe('Rebar overlap modes', () => {
    it('rebar_lag_pct=0 means full overlap (rebar starts with assembly)', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 1,
        num_sets: 1,
        assembly_days: 4,
        rebar_days: 3,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 0,
      }));

      const t = result.tact_details[0];
      // Rebar starts at same time as assembly (lag = 0)
      expect(t.rebar[0]).toBe(t.assembly[0]);
      // CON starts after max(ASM finish, REB finish) = max(4, 3) = 4
      expect(t.concrete[0]).toBe(4);
      // Total: 4 (prep) + 1 + 5 + 1 = 11
      expect(result.total_days).toBe(11);
    });

    it('rebar_lag_pct=100 means sequential (rebar after assembly)', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 1,
        num_sets: 1,
        assembly_days: 4,
        rebar_days: 3,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 100,
      }));

      const t = result.tact_details[0];
      // Rebar starts after assembly finishes
      expect(t.rebar[0]).toBe(t.assembly[1]);
      // Total: 4 + 3 + 1 + 5 + 1 = 14
      expect(result.total_days).toBe(14);
    });

    it('rebar_lag_pct=50 gives partial overlap', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 1,
        num_sets: 1,
        assembly_days: 4,
        rebar_days: 3,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 50,
      }));

      const t = result.tact_details[0];
      // Rebar starts at day 2 (50% of 4)
      expect(t.rebar[0]).toBe(2);
      // REB finishes at 5, ASM finishes at 4 → CON starts at 5
      expect(t.concrete[0]).toBe(5);
      // Total: 5 + 1 + 5 + 1 = 12
      expect(result.total_days).toBe(12);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Multiple crews
  // ──────────────────────────────────────────────────────────────────────

  describe('Multiple crews', () => {
    it('2 formwork crews should allow parallel assembly on 2 sets', () => {
      const result1 = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
        assembly_days: 3,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        num_formwork_crews: 1,
        rebar_lag_pct: 100,
      }));

      const result2 = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
        assembly_days: 3,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        num_formwork_crews: 2,  // 2 FW crews!
        rebar_lag_pct: 100,
      }));

      // 2 crews should be faster or equal
      expect(result2.total_days).toBeLessThanOrEqual(result1.total_days);
    });

    it('2 rebar crews should help when rebar is the bottleneck', () => {
      const result1 = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
        assembly_days: 2,
        rebar_days: 4,  // rebar takes longer than assembly
        concrete_days: 1,
        curing_days: 3,
        stripping_days: 1,
        num_rebar_crews: 1,
        rebar_lag_pct: 50,
      }));

      const result2 = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
        assembly_days: 2,
        rebar_days: 4,
        concrete_days: 1,
        curing_days: 3,
        stripping_days: 1,
        num_rebar_crews: 2,  // 2 RB crews!
        rebar_lag_pct: 50,
      }));

      // 2 rebar crews should be faster or equal
      expect(result2.total_days).toBeLessThanOrEqual(result1.total_days);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Critical path
  // ──────────────────────────────────────────────────────────────────────

  describe('Critical path', () => {
    it('should identify critical activities', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 2,
        num_sets: 1,
        assembly_days: 3,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 100,
      }));

      // With 1 set, everything is on the critical path (sequential)
      expect(result.critical_path.length).toBeGreaterThan(0);
      // Assembly of tact 1 should be critical
      expect(result.critical_path).toContain('T0_ASM');
    });

    it('should have non-critical activities with 2 sets', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
        assembly_days: 2,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 7,
        stripping_days: 1,
        rebar_lag_pct: 100,
      }));

      // With 2 sets and long curing, one set's chain is critical,
      // the other has slack
      // Not all activities should be critical
      expect(result.critical_path.length).toBeLessThan(result.tact_details.length * 5);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Tact detail correctness
  // ──────────────────────────────────────────────────────────────────────

  describe('Tact detail correctness', () => {
    it('should have correct precedence within each tact', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 3,
        num_sets: 2,
        assembly_days: 3,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 5,
        stripping_days: 1,
        rebar_lag_pct: 50,
      }));

      for (const td of result.tact_details) {
        // CON starts after both ASM and REB finish
        expect(td.concrete[0]).toBeGreaterThanOrEqual(td.assembly[1]);
        expect(td.concrete[0]).toBeGreaterThanOrEqual(td.rebar[1]);
        // CUR starts after CON
        expect(td.curing[0]).toBeGreaterThanOrEqual(td.concrete[1]);
        // STR starts after CUR
        expect(td.stripping[0]).toBeGreaterThanOrEqual(td.curing[1]);
        // REB starts after SS lag from ASM
        expect(td.rebar[0]).toBeGreaterThanOrEqual(td.assembly[0]);
      }
    });

    it('should have correct cross-tact precedence on same set', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
      }));

      // T3 (set 1) must start after T1 (set 1) stripping
      const t1 = result.tact_details[0]; // tact 1, set 1
      const t3 = result.tact_details[2]; // tact 3, set 1
      expect(t3.assembly[0]).toBeGreaterThanOrEqual(t1.stripping[1]);

      // T4 (set 2) must start after T2 (set 2) stripping
      const t2 = result.tact_details[1]; // tact 2, set 2
      const t4 = result.tact_details[3]; // tact 4, set 2
      expect(t4.assembly[0]).toBeGreaterThanOrEqual(t2.stripping[1]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. Gantt chart
  // ──────────────────────────────────────────────────────────────────────

  describe('Gantt chart', () => {
    it('should produce non-empty gantt for multi-tact schedule', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
      }));

      expect(result.gantt).toBeTruthy();
      expect(result.gantt).toContain('S1');
      expect(result.gantt).toContain('S2');
      expect(result.gantt).toContain('FW');
      expect(result.gantt).toContain('RB');
      expect(result.gantt).toContain('montáž');
    });

    it('should produce empty gantt for 0 tacts', () => {
      const result = scheduleElement(makeInput({ num_tacts: 0 }));
      expect(result.gantt).toBe('');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. Utilization
  // ──────────────────────────────────────────────────────────────────────

  describe('Utilization', () => {
    it('should compute valid utilization values', () => {
      const result = scheduleElement(makeInput({
        num_tacts: 4,
        num_sets: 2,
      }));

      expect(result.utilization.formwork_crews).toBeGreaterThan(0);
      expect(result.utilization.formwork_crews).toBeLessThanOrEqual(1);
      expect(result.utilization.rebar_crews).toBeGreaterThan(0);
      expect(result.utilization.rebar_crews).toBeLessThanOrEqual(1);
      expect(result.utilization.sets).toHaveLength(2);
      for (const s of result.utilization.sets) {
        expect(s).toBeGreaterThan(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 10. Real-world scenario: bridge foundation
  // ──────────────────────────────────────────────────────────────────────

  describe('Real-world: bridge foundation', () => {
    it('should schedule 4 foundation tacts with 2 sets realistically', () => {
      const result = scheduleElement({
        num_tacts: 4,
        num_sets: 2,
        assembly_days: 3,    // 3 days to assemble formwork per tact
        rebar_days: 2,       // 2 days to tie rebar per tact
        concrete_days: 1,    // 1 day to pour concrete
        curing_days: 5,      // 5 days curing before stripping
        stripping_days: 1,   // 1 day to strip formwork
        num_formwork_crews: 1,
        num_rebar_crews: 1,
        rebar_lag_pct: 50,   // rebar starts halfway through assembly
      });

      // Sequential baseline: 4 × (3+2+1+5+1) = 48 days
      expect(result.sequential_days).toBe(48);

      // Parallel should be significantly less
      expect(result.total_days).toBeLessThan(30);
      expect(result.savings_pct).toBeGreaterThan(30);

      // Should have Gantt output
      expect(result.gantt.split('\n').length).toBeGreaterThan(3);
    });

    it('should show impact of adding a third set', () => {
      const base = {
        num_tacts: 6,
        assembly_days: 3,
        rebar_days: 2,
        concrete_days: 1,
        curing_days: 7,
        stripping_days: 1,
        num_formwork_crews: 1,
        num_rebar_crews: 1,
        rebar_lag_pct: 50,
      };

      const r1 = scheduleElement({ ...base, num_sets: 1 });
      const r2 = scheduleElement({ ...base, num_sets: 2 });
      const r3 = scheduleElement({ ...base, num_sets: 3 });

      // More sets → shorter duration
      expect(r2.total_days).toBeLessThan(r1.total_days);
      expect(r3.total_days).toBeLessThanOrEqual(r2.total_days);

      // 1 set should equal sequential (no overlap)
      // Actually with rebar overlap, 1 set still saves some time
      expect(r1.total_days).toBeLessThanOrEqual(r1.sequential_days);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 11. Comparison tests (parametric)
  // ──────────────────────────────────────────────────────────────────────

  describe('Parametric comparisons', () => {
    it('more sets always ≤ fewer sets', () => {
      for (const numTacts of [2, 4, 6, 8]) {
        let prevDays = Infinity;
        for (const numSets of [1, 2, 3, 4]) {
          const r = scheduleElement(makeInput({ num_tacts: numTacts, num_sets: numSets }));
          expect(r.total_days).toBeLessThanOrEqual(prevDays);
          prevDays = r.total_days;
        }
      }
    });

    it('more crews always ≤ fewer crews', () => {
      for (const numCrews of [1, 2, 3]) {
        const r1 = scheduleElement(makeInput({ num_formwork_crews: numCrews }));
        const r2 = scheduleElement(makeInput({ num_formwork_crews: numCrews + 1 }));
        expect(r2.total_days).toBeLessThanOrEqual(r1.total_days);
      }
    });

    it('less rebar lag always ≤ more lag (more overlap = faster)', () => {
      let prevDays = 0;
      for (const lag of [0, 25, 50, 75, 100]) {
        const r = scheduleElement(makeInput({ rebar_lag_pct: lag }));
        expect(r.total_days).toBeGreaterThanOrEqual(prevDays);
        prevDays = r.total_days;
      }
    });
  });
});
