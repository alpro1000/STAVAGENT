/**
 * Shared Pump Engine Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getDayType,
  calculateArrival,
  calculateOperation,
  calculateSurcharges,
  calculatePumpCost,
  compareSuppliers,
  quickPumpEstimate,
} from './pump-engine.js';
import type { SupplierData, PumpSpec, PumpCostInput } from './pump-engine.js';

// ─── Test data (mirrors Czech market structure) ─────────────────────────────

const betonUnion: SupplierData = {
  id: 'bu',
  name: 'Beton Union',
  billing_model: 'hourly',
  pumps: [
    { name: 'S36X', reach_m: 36, arrival_fixed: 3000, arrival_per_km: 55, operation_per_h: 3200 },
    { name: 'S47X', reach_m: 47, arrival_fixed: 4000, arrival_per_km: 65, operation_per_h: 4800 },
  ],
  hose_per_m_per_day: 50,
  surcharges: {
    saturday: { model: 'flat', value: 2000 },
    sunday: { model: 'flat', value: 3000 },
    night: { model: 'flat', value: 2500 },
  },
};

const berger: SupplierData = {
  id: 'bg',
  name: 'Berger',
  billing_model: 'hourly_plus_m3',
  pumps: [
    { name: 'M36', reach_m: 36, arrival_per_km: 50, operation_per_h: 2800, volume_per_m3: 80 },
  ],
  surcharges: {
    saturday: { model: 'percentage', value: 50 },
    sunday: { model: 'percentage', value: 100 },
    night: { model: 'percentage', value: 50 },
  },
};

const frisch: SupplierData = {
  id: 'fr',
  name: 'Frischbeton',
  billing_model: 'per_15min',
  pumps: [
    { name: 'P42', reach_m: 42, arrival_fixed: 5000, operation_per_15min: 950 },
  ],
  surcharges: {
    sunday: { model: 'per_hour', value: 500 },
    night: { model: 'per_hour', value: 400 },
  },
};

const allSuppliers = [betonUnion, berger, frisch];

// ─── getDayType ─────────────────────────────────────────────────────────────

describe('getDayType', () => {
  it('weekday', () => {
    expect(getDayType(new Date(2026, 2, 2))).toBe('workday'); // Monday
  });

  it('saturday', () => {
    expect(getDayType(new Date(2026, 2, 7))).toBe('saturday');
  });

  it('sunday', () => {
    expect(getDayType(new Date(2026, 2, 8))).toBe('sunday');
  });

  it('holiday (Jan 1)', () => {
    expect(getDayType(new Date(2026, 0, 1))).toBe('holiday');
  });

  it('holiday (Easter Monday 2026 = Apr 6)', () => {
    expect(getDayType(new Date(2026, 3, 6))).toBe('holiday');
  });

  it('Good Friday 2026 = Apr 3 is holiday', () => {
    expect(getDayType(new Date(2026, 3, 3))).toBe('holiday');
  });
});

// ─── calculateArrival ───────────────────────────────────────────────────────

describe('calculateArrival', () => {
  it('fixed + per_km (Beton Union)', () => {
    const cost = calculateArrival(betonUnion.pumps[0], 30);
    // 3000 + 30 × 55 × 2 = 3000 + 3300 = 6300
    expect(cost).toBe(6300);
  });

  it('per_km only (Berger)', () => {
    const cost = calculateArrival(berger.pumps[0], 20);
    // 20 × 50 × 2 = 2000
    expect(cost).toBe(2000);
  });

  it('fixed only (Frischbeton)', () => {
    const cost = calculateArrival(frisch.pumps[0], 50);
    // 5000 (fixed, no per_km)
    expect(cost).toBe(5000);
  });

  it('zero distance', () => {
    const cost = calculateArrival(betonUnion.pumps[0], 0);
    expect(cost).toBe(3000); // just fixed
  });
});

// ─── calculateOperation ─────────────────────────────────────────────────────

describe('calculateOperation', () => {
  it('hourly model', () => {
    const cost = calculateOperation('hourly', betonUnion.pumps[0], 4, 60);
    expect(cost).toBe(3200 * 4); // 12800
  });

  it('hourly_plus_m3 model', () => {
    const cost = calculateOperation('hourly_plus_m3', berger.pumps[0], 4, 60);
    expect(cost).toBe(2800 * 4 + 80 * 60); // 11200 + 4800 = 16000
  });

  it('per_15min model', () => {
    const cost = calculateOperation('per_15min', frisch.pumps[0], 3.5, 50);
    // ceil(3.5 × 4) = 14 quarters × 950 = 13300
    expect(cost).toBe(14 * 950);
  });

  it('per_15min rounds up partial quarters', () => {
    const cost = calculateOperation('per_15min', frisch.pumps[0], 1.1, 20);
    // ceil(1.1 × 4) = ceil(4.4) = 5 quarters
    expect(cost).toBe(5 * 950);
  });
});

// ─── calculateSurcharges ────────────────────────────────────────────────────

describe('calculateSurcharges', () => {
  it('no surcharges on workday', () => {
    const result = calculateSurcharges(betonUnion.surcharges, 10000, 4, new Date(2026, 2, 2));
    expect(result.day_type).toBe('workday');
    expect(result.total_czk).toBe(0);
  });

  it('flat saturday surcharge (Beton Union)', () => {
    const result = calculateSurcharges(betonUnion.surcharges, 10000, 4, new Date(2026, 2, 7));
    expect(result.day_type).toBe('saturday');
    expect(result.saturday_czk).toBe(2000);
    expect(result.total_czk).toBe(2000);
  });

  it('percentage sunday surcharge (Berger)', () => {
    const result = calculateSurcharges(berger.surcharges, 10000, 4, new Date(2026, 2, 8));
    expect(result.day_type).toBe('sunday');
    expect(result.sunday_czk).toBe(10000); // 100%
  });

  it('per_hour night surcharge (Frischbeton)', () => {
    const result = calculateSurcharges(frisch.surcharges, 10000, 4, undefined, true);
    expect(result.is_night).toBe(true);
    expect(result.night_czk).toBe(400 * 4); // 1600
  });

  it('holiday uses sunday rate when holiday not specified', () => {
    // Jan 1 2026 is holiday (Thursday)
    const result = calculateSurcharges(berger.surcharges, 10000, 4, new Date(2026, 0, 1));
    expect(result.day_type).toBe('holiday');
    expect(result.holiday_czk).toBe(10000); // falls back to sunday: 100%
  });

  it('no surcharges when config undefined', () => {
    const result = calculateSurcharges(undefined, 10000, 4, new Date(2026, 2, 7));
    expect(result.total_czk).toBe(0);
  });
});

// ─── calculatePumpCost ──────────────────────────────────────────────────────

describe('calculatePumpCost', () => {
  const baseInput: PumpCostInput = {
    distance_km: 30,
    hours: 4,
    volume_m3: 60,
    num_arrivals: 1,
    min_reach_m: 30,
  };

  it('full cost for Beton Union S36X', () => {
    const result = calculatePumpCost(betonUnion, betonUnion.pumps[0], baseInput);
    expect(result.supplier_id).toBe('bu');
    expect(result.pump_name).toBe('S36X');
    expect(result.arrival_czk).toBe(6300);
    expect(result.operation_czk).toBe(12800);
    expect(result.total_czk).toBe(6300 + 12800); // no surcharges
    expect(result.cost_per_m3).toBeGreaterThan(0);
  });

  it('includes hose cost', () => {
    const result = calculatePumpCost(betonUnion, betonUnion.pumps[0], {
      ...baseInput,
      extra_hose_m: 20,
    });
    expect(result.hose_czk).toBe(50 * 20); // 1000
  });

  it('includes surcharges on Saturday', () => {
    const result = calculatePumpCost(betonUnion, betonUnion.pumps[0], {
      ...baseInput,
      date: new Date(2026, 2, 7), // Saturday
    });
    expect(result.surcharges.saturday_czk).toBe(2000);
    expect(result.total_czk).toBe(6300 + 12800 + 2000);
  });

  it('cost_per_m3 calculated correctly', () => {
    const result = calculatePumpCost(betonUnion, betonUnion.pumps[0], baseInput);
    expect(result.cost_per_m3).toBeCloseTo(result.total_czk / 60, 1);
  });
});

// ─── compareSuppliers ───────────────────────────────────────────────────────

describe('compareSuppliers', () => {
  it('returns results sorted by total', () => {
    const results = compareSuppliers(allSuppliers, {
      distance_km: 30,
      hours: 4,
      volume_m3: 60,
      num_arrivals: 1,
      min_reach_m: 30,
    });
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].total_czk).toBeGreaterThanOrEqual(results[i - 1].total_czk);
    }
  });

  it('filters by min_reach_m', () => {
    const all = compareSuppliers(allSuppliers, {
      distance_km: 30,
      hours: 4,
      volume_m3: 60,
      num_arrivals: 1,
      min_reach_m: 40,
    });
    // Only pumps with reach >= 40m
    for (const r of all) {
      expect(r.pump_reach_m).toBeGreaterThanOrEqual(40);
    }
  });

  it('empty results when no pumps match reach', () => {
    const results = compareSuppliers(allSuppliers, {
      distance_km: 30,
      hours: 4,
      volume_m3: 60,
      num_arrivals: 1,
      min_reach_m: 100, // No pump reaches 100m
    });
    expect(results.length).toBe(0);
  });
});

// ─── quickPumpEstimate ──────────────────────────────────────────────────────

describe('quickPumpEstimate', () => {
  it('returns reasonable estimate for 4h pour', () => {
    const est = quickPumpEstimate({ volume_m3: 60, hours: 4 });
    expect(est.estimated_czk).toBeGreaterThan(10000);
    expect(est.estimated_czk).toBeLessThan(50000);
    expect(est.rate_czk_h).toBe(3500);
  });

  it('longer pour costs more', () => {
    const short = quickPumpEstimate({ volume_m3: 30, hours: 2 });
    const long = quickPumpEstimate({ volume_m3: 120, hours: 6 });
    expect(long.estimated_czk).toBeGreaterThan(short.estimated_czk);
  });

  it('distance affects arrival', () => {
    const near = quickPumpEstimate({ volume_m3: 60, hours: 4, distance_km: 10 });
    const far = quickPumpEstimate({ volume_m3: 60, hours: 4, distance_km: 80 });
    expect(far.arrival_czk).toBeGreaterThan(near.arrival_czk);
  });
});
