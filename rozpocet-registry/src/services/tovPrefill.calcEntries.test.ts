/**
 * Calculator → TOV bridge (2026-07-08): the write-back payload now carries
 * the exact tov_entries written by «Aplikovat». Prefill must prefer those
 * rows (incl. Ošetřovatel/Předpětí), fall back to the legacy costs/resources
 * reconstruction, and the refresh merge must replace ONLY calculator rows.
 */
import { describe, it, expect } from 'vitest';
import {
  hasExtendedCosts,
  prefillTOVFromMonolit,
  mergeCalcRefresh,
  isCalcLaborRow,
} from './tovPrefill';
import type { MonolithPayload } from '../types/item';
import type { TOVData, LaborResource } from '../types/unified';

function basePayload(extra: Partial<MonolithPayload> = {}): MonolithPayload {
  return {
    monolit_position_id: 'pos-1',
    monolit_project_id: 'PRT_x_1',
    part_name: 'ZÁKLADY',
    subtype: 'beton',
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: 2,
    labor_hours: 80,
    cost_czk: 31840,
    source_tag: 'MONOLIT_LIVE',
    confidence: 1.0,
    calculated_at: '2026-07-08T10:00:00Z',
    ...extra,
  } as MonolithPayload;
}

const CALC_ENTRIES: NonNullable<MonolithPayload['tov_entries']> = {
  labor: [
    { id: 'tov-1', profession: 'Betonář', professionCode: 'BET', count: 4, hours: 80, normHours: 64, hourlyRate: 398, totalCost: 31840, source: 'calculator' },
    { id: 'tov-2', profession: 'Ošetřovatel betonu', professionCode: 'OSE', count: 1, hours: 45, normHours: 36, hourlyRate: 320, totalCost: 14400, source: 'calculator' },
    { id: 'tov-3', profession: 'Specialista předpětí', professionCode: 'PRE', count: 2, hours: 40, normHours: 32, hourlyRate: 550, totalCost: 22000, source: 'calculator' },
  ],
  materials: [
    { id: 'tov-mat-1', name: 'Pronájem Framax Xlife (DOKA)', quantity: 547.4, unit: 'm²', unitPrice: 320, totalCost: 87600, rentalMonths: 0.5 },
  ],
  source: 'calculator',
  calculated_at: '2026-07-08T10:00:00Z',
};

describe('hasExtendedCosts with tov_entries', () => {
  it('true when only tov_entries present (no costs/resources)', () => {
    expect(hasExtendedCosts(basePayload({ tov_entries: CALC_ENTRIES }))).toBe(true);
  });
  it('false on the basic payload', () => {
    expect(hasExtendedCosts(basePayload())).toBe(false);
  });
});

describe('prefillTOVFromMonolit with calculator entries', () => {
  it('maps the exact rows verbatim — professions incl. Ošetřovatel and Předpětí', () => {
    const tov = prefillTOVFromMonolit(basePayload({ tov_entries: CALC_ENTRIES }))!;
    expect(tov.labor.map(l => l.profession)).toEqual([
      'Betonář', 'Ošetřovatel betonu', 'Specialista předpětí',
    ]);
    const bet = tov.labor[0];
    expect(bet.normHours).toBe(64);
    expect(bet.count).toBe(4);
    expect(bet.hours).toBe(16); // per-worker = normHours / count
    expect(bet.totalCost).toBe(31840); // preserved verbatim (presence × rate)
    expect(bet.linkedCalcId).toBe('pos-1');
    expect(tov.laborSummary.totalNormHours).toBe(64 + 36 + 32);
  });

  it('rental materials land in Materials when formwork_info is absent (linked bednění position)', () => {
    const tov = prefillTOVFromMonolit(basePayload({ tov_entries: CALC_ENTRIES }))!;
    const rental = tov.materials.find(m => m.name.includes('Pronájem'));
    expect(rental).toBeDefined();
    expect(rental!.totalCost).toBe(87600);
  });

  it('falls back to costs/resources reconstruction when tov_entries absent', () => {
    const tov = prefillTOVFromMonolit(basePayload({
      costs: {
        formwork_labor_czk: 0, rebar_labor_czk: 0, pour_labor_czk: 31840,
        pour_night_premium_czk: 0, total_labor_czk: 31840,
        formwork_rental_czk: 0, props_labor_czk: 0, props_rental_czk: 0,
      },
      resources: {
        total_formwork_workers: 0, total_rebar_workers: 0,
        crew_size_formwork: 0, crew_size_rebar: 0, shift_h: 10,
        wage_formwork_czk_h: 385, wage_rebar_czk_h: 420, wage_pour_czk_h: 398,
        pour_shifts: 1,
      },
    }))!;
    expect(tov.labor.some(l => l.profession === 'Betonář')).toBe(true);
  });

  it('returns undefined on the basic payload', () => {
    expect(prefillTOVFromMonolit(basePayload())).toBeUndefined();
  });
});

describe('mergeCalcRefresh', () => {
  const manualRow: LaborResource = {
    id: 'labor-manual-1', profession: 'Jeřábník', count: 1,
    hours: 8, normHours: 8, hourlyRate: 450, totalCost: 3600,
  };

  it('replaces calculator rows, keeps manual rows, machinery and materials', () => {
    const fresh = prefillTOVFromMonolit(basePayload({ tov_entries: CALC_ENTRIES }))!;
    const prev: TOVData = {
      ...fresh,
      labor: [manualRow, ...fresh.labor.map(l => ({ ...l, normHours: 1 }))], // stale calc rows
      machinery: [{ id: 'mach-manual', type: 'Autojeřáb', count: 1, hours: 8, machineHours: 8, hourlyRate: 1200, totalCost: 9600 }],
    };

    const merged = mergeCalcRefresh(prev, fresh);
    expect(merged.labor.filter(l => !isCalcLaborRow(l))).toHaveLength(1);
    expect(merged.labor.find(l => l.profession === 'Jeřábník')).toBeDefined();
    // stale calc rows replaced by fresh ones (normHours back to real values)
    expect(merged.labor.find(l => l.profession === 'Betonář')!.normHours).toBe(64);
    expect(merged.machinery).toHaveLength(1); // untouched
    expect(merged.laborSummary.totalNormHours).toBe(8 + 64 + 36 + 32);
  });
});
