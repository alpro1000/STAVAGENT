import { describe, it, expect } from 'vitest';
import {
  recommendBridgeTechnology,
  calculateMSSCost,
  calculateMSSSchedule,
  getMSSTactDays,
} from './bridge-technology.js';

describe('recommendBridgeTechnology', () => {
  it('recommends fixed scaffolding for short bridge with few spans', () => {
    const r = recommendBridgeTechnology({
      span_m: 25,
      clearance_height_m: 7,
      num_spans: 3,
    });
    expect(r.recommended).toBe('fixed_scaffolding');
    expect(r.options.find(o => o.technology === 'fixed_scaffolding')!.feasible).toBe(true);
  });

  it('recommends MSS for short span but many spans (>=4)', () => {
    const r = recommendBridgeTechnology({
      span_m: 36,
      clearance_height_m: 10,
      num_spans: 9,
    });
    expect(r.recommended).toBe('mss');
    expect(r.reason).toContain('4+');
  });

  it('recommends MSS for span > 40m', () => {
    const r = recommendBridgeTechnology({
      span_m: 50,
      clearance_height_m: 12,
      num_spans: 5,
    });
    expect(r.recommended).toBe('mss');
    expect(r.reason).toContain('40m');
  });

  it('marks fixed scaffolding infeasible for height > 25m', () => {
    const r = recommendBridgeTechnology({
      span_m: 30,
      clearance_height_m: 30,
      num_spans: 3,
    });
    expect(r.options.find(o => o.technology === 'fixed_scaffolding')!.feasible).toBe(false);
    expect(r.recommended).toBe('mss');
  });

  it('marks MSS infeasible for span < 25m', () => {
    const r = recommendBridgeTechnology({
      span_m: 20,
      clearance_height_m: 6,
      num_spans: 2,
    });
    expect(r.options.find(o => o.technology === 'mss')!.feasible).toBe(false);
    expect(r.recommended).toBe('fixed_scaffolding');
  });

  it('marks cantilever feasible only for komorový + span > 80m', () => {
    const r1 = recommendBridgeTechnology({
      span_m: 100,
      clearance_height_m: 15,
      num_spans: 3,
      deck_subtype: 'jednokomora',
    });
    expect(r1.options.find(o => o.technology === 'cantilever')!.feasible).toBe(true);
    expect(r1.recommended).toBe('cantilever');

    const r2 = recommendBridgeTechnology({
      span_m: 100,
      clearance_height_m: 15,
      num_spans: 3,
      deck_subtype: 'dvoutram',
    });
    expect(r2.options.find(o => o.technology === 'cantilever')!.feasible).toBe(false);
  });

  it('warns about composite (spřažený) construction', () => {
    const r = recommendBridgeTechnology({
      span_m: 20,
      clearance_height_m: 6,
      num_spans: 3,
      deck_subtype: 'sprazeny',
    });
    expect(r.warnings.some(w => w.includes('Spřažená'))).toBe(true);
  });

  it('warns about height > 8m requiring crane', () => {
    const r = recommendBridgeTechnology({
      span_m: 30,
      clearance_height_m: 12,
      num_spans: 3,
    });
    expect(r.warnings.some(w => w.includes('jeřáb'))).toBe(true);
  });

  it('warns about height > 20m requiring SL-1', () => {
    const r = recommendBridgeTechnology({
      span_m: 30,
      clearance_height_m: 22,
      num_spans: 3,
    });
    expect(r.warnings.some(w => w.includes('SL-1'))).toBe(true);
  });

  it('suggests MSS as alternative for fixed + 4+ spans', () => {
    const r = recommendBridgeTechnology({
      span_m: 30,
      clearance_height_m: 7,
      num_spans: 5,
    });
    expect(r.recommended).toBe('mss');
  });

  // SO204 reference: 3 spans, 31m, deskový → fixed scaffolding
  it('SO204: 3 spans × 31m → fixed scaffolding', () => {
    const r = recommendBridgeTechnology({
      span_m: 31,
      clearance_height_m: 7,
      num_spans: 3,
      deck_subtype: 'deskovy',
      is_prestressed: true,
    });
    expect(r.recommended).toBe('fixed_scaffolding');
  });

  // SO207 reference: 9 spans × 36m, dvoutrám → MSS
  it('SO207: 9 spans × 36m → MSS', () => {
    const r = recommendBridgeTechnology({
      span_m: 36,
      clearance_height_m: 10,
      num_spans: 9,
      deck_subtype: 'dvoutram',
      is_prestressed: true,
    });
    expect(r.recommended).toBe('mss');
  });
});

describe('calculateMSSCost', () => {
  it('calculates MSS cost for SO207-like bridge', () => {
    const r = calculateMSSCost({
      span_m: 36,
      num_spans: 9,
      nk_width_m: 14,
      tact_days: 21,
    });
    expect(r.nk_area_m2).toBe(36 * 9 * 14); // 4536 m²
    expect(r.mobilization_czk).toBe(4_500_000); // small MSS (<=40m)
    expect(r.rental_czk_month).toBe(1_200_000);
    expect(r.demobilization_czk).toBe(2_250_000); // 50% of mob
    expect(r.total_czk).toBeGreaterThan(10_000_000);
    expect(r.unit_cost_czk_m2).toBeGreaterThan(2000);
    expect(r.model).toBe('detailed');
  });

  it('accepts overrides for mobilization and rental', () => {
    const r = calculateMSSCost({
      span_m: 36,
      num_spans: 9,
      nk_width_m: 14,
      tact_days: 21,
      mobilization_czk_override: 5_000_000,
      rental_czk_month_override: 1_500_000,
    });
    expect(r.mobilization_czk).toBe(5_000_000);
    expect(r.rental_czk_month).toBe(1_500_000);
  });
});

describe('calculateMSSSchedule', () => {
  it('calculates MSS schedule for 9 spans dvoutrám', () => {
    const r = calculateMSSSchedule(9, 'dvoutram', true);
    expect(r.num_tacts).toBe(9);
    expect(r.tact_days).toBeGreaterThanOrEqual(21);
    expect(r.setup_days).toBe(30);
    expect(r.teardown_days).toBe(15);
    expect(r.total_days).toBe(30 + 9 * r.tact_days + 15);
  });

  it('calculates shorter tacts for deskový', () => {
    const r = calculateMSSSchedule(5, 'deskovy', false);
    expect(r.tact_days).toBeLessThanOrEqual(21); // deskovy = 14 base
  });

  it('accepts tact_days override', () => {
    const r = calculateMSSSchedule(5, 'deskovy', false, 25);
    expect(r.tact_days).toBe(25);
    expect(r.total_days).toBe(30 + 5 * 25 + 15);
  });

  it('komorový has longest tact', () => {
    const r = calculateMSSSchedule(5, 'jednokomora', true);
    expect(r.tact_days).toBeGreaterThanOrEqual(28);
  });
});

describe('getMSSTactDays', () => {
  it('returns defaults by subtype', () => {
    expect(getMSSTactDays('deskovy')).toBe(14);
    expect(getMSSTactDays('dvoutram')).toBe(21);
    expect(getMSSTactDays('jednokomora')).toBe(28);
  });

  it('returns 14 for unknown subtype', () => {
    expect(getMSSTactDays(undefined)).toBe(14);
    expect(getMSSTactDays('unknown')).toBe(14);
  });
});
