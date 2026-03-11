/**
 * Tariff Versioning v1.0
 *
 * Tracks historical pricing for construction suppliers (pump, concrete, formwork rental).
 * Enables:
 *   1. Price comparison across time periods
 *   2. Automatic inflation adjustment
 *   3. "What-if" recalculation with different tariff versions
 *   4. Tender price locking (fix prices at contract date)
 *
 * Data model:
 *   TariffRegistry → TariffEntry[] (one per supplier × service × date range)
 *
 * Each tariff entry has:
 *   - valid_from / valid_to: date range
 *   - rates: service-specific pricing
 *   - source: where the price came from (ceník, nabídka, smlouva)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Service type covered by the tariff */
export type TariffService = 'pump' | 'concrete' | 'formwork_rental' | 'transport' | 'crane';

/** Price source traceability */
export type TariffSource = 'price_list' | 'quote' | 'contract' | 'estimated';

/** A single rate item within a tariff */
export interface TariffRate {
  key: string;          // e.g., "operation_per_h", "C30_37_per_m3", "rental_per_m2_month"
  value: number;        // CZK
  unit: string;         // "CZK/h", "CZK/m³", "CZK/m²/měs"
  note?: string;        // Optional note ("min. 3h")
}

/** A tariff entry for one supplier × one service × one time range */
export interface TariffEntry {
  id: string;
  supplier_id: string;
  supplier_name: string;
  service: TariffService;
  valid_from: string;   // ISO date: "2026-01-01"
  valid_to: string;     // ISO date: "2026-12-31" or "9999-12-31" for current
  rates: TariffRate[];
  source: TariffSource;
  /** Optional inflation index (base 100) */
  inflation_index?: number;
  /** Who created/updated this entry */
  created_by?: string;
  created_at?: string;
}

/** Complete registry of tariffs */
export interface TariffRegistry {
  entries: TariffEntry[];
  /** Base year for inflation index (e.g., 2024) */
  base_year?: number;
}

// ─── Registry Operations ────────────────────────────────────────────────────

/**
 * Find the active tariff for a supplier + service at a given date.
 * Returns the most specific (latest valid_from) entry.
 */
export function findActiveTariff(
  registry: TariffRegistry,
  supplier_id: string,
  service: TariffService,
  date: string = today(),
): TariffEntry | undefined {
  const matching = registry.entries
    .filter(e =>
      e.supplier_id === supplier_id &&
      e.service === service &&
      e.valid_from <= date &&
      e.valid_to >= date
    )
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from)); // Latest first

  return matching[0];
}

/**
 * Get a specific rate from a tariff entry by key.
 */
export function getRate(tariff: TariffEntry, key: string): number | undefined {
  const rate = tariff.rates.find(r => r.key === key);
  return rate?.value;
}

/**
 * Get all tariff history for a supplier + service.
 * Sorted by valid_from (newest first).
 */
export function getTariffHistory(
  registry: TariffRegistry,
  supplier_id: string,
  service: TariffService,
): TariffEntry[] {
  return registry.entries
    .filter(e => e.supplier_id === supplier_id && e.service === service)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
}

/**
 * List all suppliers that have tariffs for a given service.
 */
export function getSuppliersByService(
  registry: TariffRegistry,
  service: TariffService,
  date: string = today(),
): Array<{ supplier_id: string; supplier_name: string }> {
  const seen = new Set<string>();
  const result: Array<{ supplier_id: string; supplier_name: string }> = [];

  for (const e of registry.entries) {
    if (e.service === service && e.valid_from <= date && e.valid_to >= date && !seen.has(e.supplier_id)) {
      seen.add(e.supplier_id);
      result.push({ supplier_id: e.supplier_id, supplier_name: e.supplier_name });
    }
  }

  return result;
}

// ─── Price Comparison ───────────────────────────────────────────────────────

export interface PriceComparison {
  supplier_id: string;
  supplier_name: string;
  rate_key: string;
  current_value: number;
  previous_value: number | null;
  change_pct: number | null;
  change_abs: number | null;
}

/**
 * Compare current prices with previous tariff version for a supplier.
 */
export function comparePrices(
  registry: TariffRegistry,
  supplier_id: string,
  service: TariffService,
  date: string = today(),
): PriceComparison[] {
  const history = getTariffHistory(registry, supplier_id, service);
  if (history.length < 1) return [];

  const current = history[0];
  const previous = history.length > 1 ? history[1] : null;

  return current.rates.map(rate => {
    const prevRate = previous?.rates.find(r => r.key === rate.key);
    const prevValue = prevRate?.value ?? null;

    return {
      supplier_id,
      supplier_name: current.supplier_name,
      rate_key: rate.key,
      current_value: rate.value,
      previous_value: prevValue,
      change_pct: prevValue !== null ? roundTo((rate.value - prevValue) / prevValue * 100, 1) : null,
      change_abs: prevValue !== null ? roundTo(rate.value - prevValue, 2) : null,
    };
  });
}

// ─── Inflation Adjustment ───────────────────────────────────────────────────

/**
 * Adjust a tariff's rates by inflation index.
 *
 * @param tariff - Original tariff entry
 * @param target_index - Target inflation index (e.g., 108 = 8% inflation from base)
 * @returns New TariffEntry with adjusted rates
 */
export function adjustForInflation(
  tariff: TariffEntry,
  target_index: number,
): TariffEntry {
  const source_index = tariff.inflation_index ?? 100;
  const factor = target_index / source_index;

  return {
    ...tariff,
    id: `${tariff.id}_adj_${target_index}`,
    rates: tariff.rates.map(r => ({
      ...r,
      value: roundTo(r.value * factor, 2),
      note: r.note ? `${r.note} (adj. ${source_index}→${target_index})` : `adj. ${source_index}→${target_index}`,
    })),
    inflation_index: target_index,
    source: 'estimated',
  };
}

// ─── CRUD helpers ───────────────────────────────────────────────────────────

/**
 * Add a new tariff entry to the registry.
 * If an overlapping entry exists for the same supplier+service, closes it.
 */
export function addTariff(
  registry: TariffRegistry,
  entry: TariffEntry,
): TariffRegistry {
  // Close any overlapping active entries
  const updatedEntries = registry.entries.map(e => {
    if (
      e.supplier_id === entry.supplier_id &&
      e.service === entry.service &&
      e.valid_to >= entry.valid_from &&
      e.valid_from < entry.valid_from
    ) {
      // Close the previous entry the day before the new one starts
      const closedDate = prevDay(entry.valid_from);
      return { ...e, valid_to: closedDate };
    }
    return e;
  });

  return {
    ...registry,
    entries: [...updatedEntries, entry],
  };
}

/**
 * Create an empty registry.
 */
export function createRegistry(base_year?: number): TariffRegistry {
  return { entries: [], base_year };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(isoDate: string): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
