/**
 * Concrete Maturity & Curing Model
 *
 * Based on ČSN EN 13670 (Execution of concrete structures) Table NA.2
 * and Saul's Maturity Method (Nurse-Saul function).
 *
 * Minimum curing time before stripping depends on:
 *   - Concrete class (C20/25, C25/30, C30/37, etc.)
 *   - Ambient temperature (°C)
 *   - Required strength at stripping (% of f_ck)
 *   - Element type (slab, wall, beam, column)
 *
 * Maturity (M):
 *   M = Σ (T_i + 10) × Δt_i    [°C·hours]
 *   where T_i = average temperature during interval Δt_i
 *   Datum temperature = -10°C (standard for OPC)
 *
 * This model provides:
 *   1. Lookup tables for minimum curing days (ČSN EN 13670)
 *   2. Maturity-based curing estimation
 *   3. strip_wait_hours replacement for formwork calculator
 *
 * Reference: ČSN EN 13670, ČSN EN 206+A2, ČSN 73 6244
 */
/** Concrete strength class per EN 206 */
export type ConcreteClass = 'C12/15' | 'C16/20' | 'C20/25' | 'C25/30' | 'C30/37' | 'C35/45' | 'C40/50' | 'C45/55' | 'C50/60';
/** Cement type (affects early strength gain) */
export type CementType = 'CEM_I' | 'CEM_II' | 'CEM_III';
/** Structural element type (affects required strip strength %) */
export type ElementType = 'slab' | 'wall' | 'beam' | 'column';
/** Parameters for curing time calculation */
export interface CuringParams {
    concrete_class: ConcreteClass;
    temperature_c: number;
    cement_type?: CementType;
    element_type?: ElementType;
    strip_strength_pct?: number;
    /**
     * BUG-Z2 (2026-04-15): exposure class (XF1/XF3/XF4, XC4, XD3…).
     * TKP18 §7.8.3 mandates minimum curing days independent of maturity:
     *   XF1 → min 5 dní, XF3/XF4 → min 7 dní (freeze-thaw cycles).
     * When given, min_curing_days = max(maturity_result, TKP18_minimum).
     */
    exposure_class?: string;
}
/** Return the TKP18 minimum curing days for a given exposure class (0 if none). */
export declare function getExposureMinCuringDays(exposureClass: string | undefined): number;
/** Result of curing calculation */
export interface CuringResult {
    min_curing_days: number;
    min_curing_hours: number;
    strip_strength_pct: number;
    estimated_strength_pct: number;
    maturity_index: number;
    temperature_c: number;
    concrete_class: ConcreteClass;
    cement_type: CementType;
    element_type: ElementType;
    warning: string | null;
}
/**
 * Calculate minimum curing time before stripping
 *
 * Primary method: ČSN EN 13670 Table NA.2 lookup
 * Adjusted for cement type and element type
 */
export declare function calculateCuring(params: CuringParams): CuringResult;
/**
 * Convert legacy strip_wait_hours to maturity-based curing hours
 *
 * Drop-in replacement for fixed strip_wait_hours in FormworkCalculatorParams.
 * Returns the temperature- and class-adjusted value.
 */
export declare function getStripWaitHours(concrete_class: ConcreteClass, temperature_c: number, element_type?: ElementType, cement_type?: CementType): number;
/**
 * Calculate Nurse-Saul maturity index from temperature history
 *
 * M = Σ (T_i - T_datum) × Δt_i
 *
 * @param readings - Array of { temp_c, hours } intervals
 * @returns Maturity index in °C·hours
 */
export declare function calculateMaturityIndex(readings: {
    temp_c: number;
    hours: number;
}[]): number;
/**
 * Estimate curing days for a monthly temperature profile
 *
 * Useful for PERT integration: given month → average temperature → curing days
 * Returns optimistic (warm month), most_likely (planned month), pessimistic (cold month)
 */
export declare function curingThreePoint(concrete_class: ConcreteClass, element_type: ElementType, month_avg_temp_c: number, cement_type?: CementType): {
    optimistic_hours: number;
    most_likely_hours: number;
    pessimistic_hours: number;
};
/**
 * Typical average monthly temperatures for Czech Republic (Prague)
 * Used as defaults when no site-specific data is available
 */
export declare const CZ_MONTHLY_TEMPS: Record<number, number>;
/**
 * Construction type as used in formwork-assistant (bridge/building elements)
 * Maps to ElementType + orientation for the curing calculation.
 */
export type ConstructionType = 'zakladove_pasy' | 'steny' | 'pilire_mostu' | 'sloupy' | 'mostovka' | 'rimsy' | 'stropni_deska' | 'pruvlak' | 'schodiste';
/** Season (temperature range) — maps to average temperature */
export type Season = 'leto' | 'podzim_jaro' | 'zima';
/** Average temperature for each season (°C) */
export declare const SEASON_TEMPERATURES: Record<Season, number>;
/** Orientation — affects whether props are needed */
export declare const CONSTRUCTION_ORIENTATION: Record<ConstructionType, 'vertical' | 'horizontal'>;
/**
 * Minimum prop retention days for horizontal elements (ČSN EN 13670 + TKP17)
 *
 * Props must remain under horizontal structures much longer than side formwork
 * because the element must carry its own weight + live loads.
 * Side formwork can be stripped when concrete reaches 50–70% f_ck,
 * but props stay until concrete reaches near-full design strength.
 */
export declare const PROPS_MIN_DAYS: Partial<Record<ConstructionType, Record<Season, number>>>;
/** Labels for construction types (Czech) */
export declare const CONSTRUCTION_LABELS: Record<ConstructionType, string>;
/** Labels for seasons (Czech) */
export declare const SEASON_LABELS: Record<Season, string>;
/**
 * High-level curing calculation for a construction type + season.
 *
 * This is the **single entry point** for all curing calculations.
 * It maps construction_type → ElementType and season → temperature,
 * then delegates to calculateCuring().
 *
 * Returns:
 *   - min_curing_days: When side formwork can be stripped
 *   - props_min_days: When props can be removed (horizontal only, 0 for vertical)
 *
 * @example
 * const result = calculateConstructionCuring({
 *   construction_type: 'mostovka',
 *   season: 'podzim_jaro',
 *   concrete_class: 'C30/37',
 *   cement_type: 'CEM_I',
 * });
 * // result.curing.min_curing_days = 3
 * // result.props_min_days = 21
 */
export declare function calculateConstructionCuring(params: {
    construction_type: ConstructionType;
    season: Season;
    concrete_class?: ConcreteClass;
    cement_type?: CementType;
}): {
    curing: CuringResult;
    props_min_days: number;
    orientation: 'vertical' | 'horizontal';
};
