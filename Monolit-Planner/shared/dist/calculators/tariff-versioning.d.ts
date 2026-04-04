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
/** Service type covered by the tariff */
export type TariffService = 'pump' | 'concrete' | 'formwork_rental' | 'transport' | 'crane';
/** Price source traceability */
export type TariffSource = 'price_list' | 'quote' | 'contract' | 'estimated';
/** A single rate item within a tariff */
export interface TariffRate {
    key: string;
    value: number;
    unit: string;
    note?: string;
}
/** A tariff entry for one supplier × one service × one time range */
export interface TariffEntry {
    id: string;
    supplier_id: string;
    supplier_name: string;
    service: TariffService;
    valid_from: string;
    valid_to: string;
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
/**
 * Find the active tariff for a supplier + service at a given date.
 * Returns the most specific (latest valid_from) entry.
 */
export declare function findActiveTariff(registry: TariffRegistry, supplier_id: string, service: TariffService, date?: string): TariffEntry | undefined;
/**
 * Get a specific rate from a tariff entry by key.
 */
export declare function getRate(tariff: TariffEntry, key: string): number | undefined;
/**
 * Get all tariff history for a supplier + service.
 * Sorted by valid_from (newest first).
 */
export declare function getTariffHistory(registry: TariffRegistry, supplier_id: string, service: TariffService): TariffEntry[];
/**
 * List all suppliers that have tariffs for a given service.
 */
export declare function getSuppliersByService(registry: TariffRegistry, service: TariffService, date?: string): Array<{
    supplier_id: string;
    supplier_name: string;
}>;
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
export declare function comparePrices(registry: TariffRegistry, supplier_id: string, service: TariffService, date?: string): PriceComparison[];
/**
 * Adjust a tariff's rates by inflation index.
 *
 * @param tariff - Original tariff entry
 * @param target_index - Target inflation index (e.g., 108 = 8% inflation from base)
 * @returns New TariffEntry with adjusted rates
 */
export declare function adjustForInflation(tariff: TariffEntry, target_index: number): TariffEntry;
/**
 * Add a new tariff entry to the registry.
 * If an overlapping entry exists for the same supplier+service, closes it.
 */
export declare function addTariff(registry: TariffRegistry, entry: TariffEntry): TariffRegistry;
/**
 * Create an empty registry.
 */
export declare function createRegistry(base_year?: number): TariffRegistry;
