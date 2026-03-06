/**
 * Tariff Versioning Tests
 */
import { describe, it, expect } from 'vitest';
import {
  createRegistry,
  addTariff,
  findActiveTariff,
  getRate,
  getTariffHistory,
  getSuppliersByService,
  comparePrices,
  adjustForInflation,
} from './tariff-versioning.js';
import type { TariffEntry, TariffRegistry } from './tariff-versioning.js';

// ─── Test Data ──────────────────────────────────────────────────────────────

const pumpTariff2025: TariffEntry = {
  id: 'bu-pump-2025',
  supplier_id: 'beton-union',
  supplier_name: 'Beton Union',
  service: 'pump',
  valid_from: '2025-01-01',
  valid_to: '2025-12-31',
  rates: [
    { key: 'operation_per_h', value: 3000, unit: 'CZK/h' },
    { key: 'arrival_fixed', value: 2800, unit: 'CZK' },
    { key: 'arrival_per_km', value: 50, unit: 'CZK/km' },
  ],
  source: 'price_list',
  inflation_index: 100,
};

const pumpTariff2026: TariffEntry = {
  id: 'bu-pump-2026',
  supplier_id: 'beton-union',
  supplier_name: 'Beton Union',
  service: 'pump',
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  rates: [
    { key: 'operation_per_h', value: 3200, unit: 'CZK/h' },
    { key: 'arrival_fixed', value: 3000, unit: 'CZK' },
    { key: 'arrival_per_km', value: 55, unit: 'CZK/km' },
  ],
  source: 'price_list',
  inflation_index: 106,
};

const concreteTariff: TariffEntry = {
  id: 'bu-concrete-2026',
  supplier_id: 'beton-union',
  supplier_name: 'Beton Union',
  service: 'concrete',
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  rates: [
    { key: 'C25_30_per_m3', value: 2850, unit: 'CZK/m³' },
    { key: 'C30_37_per_m3', value: 3100, unit: 'CZK/m³' },
  ],
  source: 'contract',
};

const bergerTariff: TariffEntry = {
  id: 'bg-pump-2026',
  supplier_id: 'berger',
  supplier_name: 'Berger',
  service: 'pump',
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  rates: [
    { key: 'operation_per_h', value: 2800, unit: 'CZK/h' },
    { key: 'volume_per_m3', value: 80, unit: 'CZK/m³' },
  ],
  source: 'quote',
};

function buildTestRegistry(): TariffRegistry {
  let reg = createRegistry(2025);
  reg = addTariff(reg, pumpTariff2025);
  reg = addTariff(reg, pumpTariff2026);
  reg = addTariff(reg, concreteTariff);
  reg = addTariff(reg, bergerTariff);
  return reg;
}

// ─── createRegistry ─────────────────────────────────────────────────────────

describe('createRegistry', () => {
  it('creates empty registry', () => {
    const reg = createRegistry();
    expect(reg.entries).toHaveLength(0);
  });

  it('stores base year', () => {
    const reg = createRegistry(2024);
    expect(reg.base_year).toBe(2024);
  });
});

// ─── addTariff ──────────────────────────────────────────────────────────────

describe('addTariff', () => {
  it('adds entry to registry', () => {
    let reg = createRegistry();
    reg = addTariff(reg, pumpTariff2025);
    expect(reg.entries).toHaveLength(1);
  });

  it('closes overlapping entry', () => {
    let reg = createRegistry();
    // Add 2025 tariff with valid_to = 9999-12-31 (open-ended)
    const openEnded = { ...pumpTariff2025, valid_to: '9999-12-31' };
    reg = addTariff(reg, openEnded);
    // Now add 2026 tariff → should close the 2025 one
    reg = addTariff(reg, pumpTariff2026);

    expect(reg.entries).toHaveLength(2);
    const closed = reg.entries.find(e => e.id === 'bu-pump-2025');
    expect(closed!.valid_to).toBe('2025-12-31'); // Closed day before 2026-01-01
  });
});

// ─── findActiveTariff ───────────────────────────────────────────────────────

describe('findActiveTariff', () => {
  const reg = buildTestRegistry();

  it('finds 2025 tariff for 2025 date', () => {
    const t = findActiveTariff(reg, 'beton-union', 'pump', '2025-06-15');
    expect(t).toBeDefined();
    expect(t!.id).toBe('bu-pump-2025');
  });

  it('finds 2026 tariff for 2026 date', () => {
    const t = findActiveTariff(reg, 'beton-union', 'pump', '2026-03-06');
    expect(t).toBeDefined();
    expect(t!.id).toBe('bu-pump-2026');
  });

  it('returns undefined when no match', () => {
    const t = findActiveTariff(reg, 'beton-union', 'pump', '2024-06-01');
    expect(t).toBeUndefined();
  });

  it('returns undefined for wrong service', () => {
    const t = findActiveTariff(reg, 'beton-union', 'crane', '2026-03-06');
    expect(t).toBeUndefined();
  });
});

// ─── getRate ────────────────────────────────────────────────────────────────

describe('getRate', () => {
  it('finds rate by key', () => {
    expect(getRate(pumpTariff2026, 'operation_per_h')).toBe(3200);
    expect(getRate(pumpTariff2026, 'arrival_fixed')).toBe(3000);
  });

  it('returns undefined for missing key', () => {
    expect(getRate(pumpTariff2026, 'nonexistent')).toBeUndefined();
  });
});

// ─── getTariffHistory ───────────────────────────────────────────────────────

describe('getTariffHistory', () => {
  const reg = buildTestRegistry();

  it('returns history newest first', () => {
    const history = getTariffHistory(reg, 'beton-union', 'pump');
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe('bu-pump-2026'); // Newest first
    expect(history[1].id).toBe('bu-pump-2025');
  });

  it('empty for non-existent supplier', () => {
    expect(getTariffHistory(reg, 'nonexistent', 'pump')).toHaveLength(0);
  });
});

// ─── getSuppliersByService ──────────────────────────────────────────────────

describe('getSuppliersByService', () => {
  const reg = buildTestRegistry();

  it('lists pump suppliers', () => {
    const suppliers = getSuppliersByService(reg, 'pump', '2026-06-01');
    expect(suppliers).toHaveLength(2); // Beton Union + Berger
    expect(suppliers.map(s => s.supplier_id)).toContain('beton-union');
    expect(suppliers.map(s => s.supplier_id)).toContain('berger');
  });

  it('lists concrete suppliers', () => {
    const suppliers = getSuppliersByService(reg, 'concrete', '2026-06-01');
    expect(suppliers).toHaveLength(1);
    expect(suppliers[0].supplier_id).toBe('beton-union');
  });

  it('empty for service with no tariffs', () => {
    expect(getSuppliersByService(reg, 'crane', '2026-06-01')).toHaveLength(0);
  });
});

// ─── comparePrices ──────────────────────────────────────────────────────────

describe('comparePrices', () => {
  const reg = buildTestRegistry();

  it('compares 2025 vs 2026 rates', () => {
    const comparison = comparePrices(reg, 'beton-union', 'pump', '2026-06-01');
    expect(comparison.length).toBe(3); // 3 rates

    const opRate = comparison.find(c => c.rate_key === 'operation_per_h');
    expect(opRate).toBeDefined();
    expect(opRate!.current_value).toBe(3200);
    expect(opRate!.previous_value).toBe(3000);
    expect(opRate!.change_abs).toBe(200);
    expect(opRate!.change_pct).toBeCloseTo(6.7, 0);
  });

  it('shows null change when no previous tariff', () => {
    const comparison = comparePrices(reg, 'berger', 'pump', '2026-06-01');
    expect(comparison.length).toBeGreaterThan(0);
    expect(comparison[0].previous_value).toBeNull();
    expect(comparison[0].change_pct).toBeNull();
  });
});

// ─── adjustForInflation ─────────────────────────────────────────────────────

describe('adjustForInflation', () => {
  it('adjusts rates by inflation factor', () => {
    // 2025 tariff (index 100) → target index 110 (10% inflation)
    const adjusted = adjustForInflation(pumpTariff2025, 110);
    const opRate = adjusted.rates.find(r => r.key === 'operation_per_h');
    expect(opRate!.value).toBe(3300); // 3000 × 1.10 = 3300
  });

  it('preserves all rates', () => {
    const adjusted = adjustForInflation(pumpTariff2025, 105);
    expect(adjusted.rates).toHaveLength(pumpTariff2025.rates.length);
  });

  it('marks source as estimated', () => {
    const adjusted = adjustForInflation(pumpTariff2025, 108);
    expect(adjusted.source).toBe('estimated');
  });

  it('updates inflation_index', () => {
    const adjusted = adjustForInflation(pumpTariff2025, 115);
    expect(adjusted.inflation_index).toBe(115);
  });

  it('creates unique id', () => {
    const adjusted = adjustForInflation(pumpTariff2025, 108);
    expect(adjusted.id).toContain('adj_108');
    expect(adjusted.id).not.toBe(pumpTariff2025.id);
  });

  it('adds note about adjustment', () => {
    const adjusted = adjustForInflation(pumpTariff2025, 110);
    expect(adjusted.rates[0].note).toContain('100→110');
  });

  it('deflation works too', () => {
    // Target 95 < source 100 → rates decrease
    const adjusted = adjustForInflation(pumpTariff2025, 95);
    const opRate = adjusted.rates.find(r => r.key === 'operation_per_h');
    expect(opRate!.value).toBe(2850); // 3000 × 0.95
  });
});
