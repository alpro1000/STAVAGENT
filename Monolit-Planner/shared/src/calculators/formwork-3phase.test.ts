/**
 * 3-Phase Formwork Cost Model Tests
 */
import { describe, it, expect } from 'vitest';
import { calculateThreePhaseFormwork, PHASE_MULTIPLIERS } from './formwork.js';

describe('3-Phase Formwork Cost Model', () => {
  const baseParams = {
    area_m2: 82,
    norm_assembly_h_m2: 0.72,
    norm_disassembly_h_m2: 0.25,
    crew_size: 4,
    shift_h: 10,
    k: 0.8,
    wage_czk_h: 398,
  };

  it('calculates single tact correctly', () => {
    const result = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      1
    );
    expect(result.middle_tact_count).toBe(0);
    expect(result.total_cost_labor).toBe(result.initial_cost_labor);
  });

  it('calculates 2 tacts (initial + final)', () => {
    const result = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      2
    );
    expect(result.middle_tact_count).toBe(0);
    expect(result.total_cost_labor).toBeCloseTo(
      result.initial_cost_labor + result.final_cost_labor,
      0
    );
  });

  it('calculates 5 tacts (1 initial + 3 middle + 1 final)', () => {
    const result = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      5
    );
    expect(result.middle_tact_count).toBe(3);
    expect(result.total_cost_labor).toBeCloseTo(
      result.initial_cost_labor + 3 * result.middle_cost_labor + result.final_cost_labor,
      0
    );
  });

  it('initial costs more than middle', () => {
    const result = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      5
    );
    expect(result.initial_cost_labor).toBeGreaterThan(result.middle_cost_labor);
  });

  it('final costs less than middle', () => {
    const result = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      5
    );
    expect(result.final_cost_labor).toBeLessThan(result.middle_cost_labor);
  });

  it('initial assembly takes longer than middle', () => {
    const result = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      5
    );
    expect(result.initial_days).toBeGreaterThan(result.middle_days);
  });

  it('phase multipliers are sensible', () => {
    expect(PHASE_MULTIPLIERS.initial_assembly).toBeGreaterThan(1);
    expect(PHASE_MULTIPLIERS.cycle_relocation).toBe(1);
    expect(PHASE_MULTIPLIERS.final_stripping).toBeLessThan(1);
  });

  it('total cost scales with number of tacts', () => {
    const r3 = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      3
    );
    const r10 = calculateThreePhaseFormwork(
      ...Object.values(baseParams) as [number, number, number, number, number, number, number],
      10
    );
    expect(r10.total_cost_labor).toBeGreaterThan(r3.total_cost_labor);
  });
});
