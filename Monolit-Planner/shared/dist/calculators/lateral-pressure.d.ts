/**
 * Lateral Pressure Calculator & Formwork Auto-Filter
 *
 * Calculates fresh concrete lateral pressure on formwork (ČSN EN 12812)
 * and filters the formwork catalog to systems that can withstand it.
 *
 * Also suggests záběrová betonáž (pour stages by height) when full-height
 * pouring would exceed all available systems' pressure limits.
 *
 * Formulas:
 *   p = ρ × g × h × k   (kN/m²)
 *
 *   ρ = 2400 kg/m³ (reinforced concrete density)
 *   g = 9.81 m/s²
 *   h = pour height per stage (m) — NOT total element height if staged
 *   k = pour rate coefficient:
 *       1.0  at ≤ 1 m/h  (gravity, crane bucket)
 *       1.2  at 1–2 m/h  (slow pump, controlled pour)
 *       1.5  at > 2 m/h  (fast pump)
 *
 * Reference: ČSN EN 12812 (Falsework), DIN 18218 (concrete pressure on formwork)
 */
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';
/** How concrete is delivered — used as legacy fallback for k coefficient */
export type PourMethod = 'pump' | 'crane_bucket' | 'direct' | 'chute';
/**
 * Concrete consistency class — primary driver of lateral pressure k coefficient.
 *
 * Per DIN 18218 / ČSN EN 12812:
 *   - 'standard' (S1–S2, slow rise ≤1 m/h) → k = 0.85   ← DEFAULT
 *   - 'plastic'  (S3–S4, controlled pump)  → k = 1.00
 *   - 'scc'      (samozhutnitelný / SCC)   → k = 1.50
 *
 * Use 'scc' ONLY for self-consolidating concrete. Standard is the safe default
 * for most construction work in CZ.
 */
export type ConcreteConsistency = 'standard' | 'plastic' | 'scc';
/** Map consistency → DIN 18218 k coefficient */
export declare function getConsistencyKFactor(consistency: ConcreteConsistency): number;
/** Optional knobs for calculateLateralPressure */
export interface LateralPressureOptions {
    /**
     * Concrete consistency (DIN 18218). Takes precedence over pour_method.
     * Default: 'standard' (k=0.85).
     */
    concrete_consistency?: ConcreteConsistency;
    /** Explicit k-factor override (highest priority). Used for manual tuning. */
    k_factor?: number;
}
/** Result of lateral pressure calculation */
export interface LateralPressureResult {
    /** Calculated lateral pressure (kN/m²) */
    pressure_kn_m2: number;
    /** Pour height used for calculation (m) */
    pour_height_m: number;
    /** Pour rate coefficient used */
    k: number;
    /** Pour method (legacy field, may not match k when consistency is set) */
    pour_method: PourMethod;
    /** Concrete consistency used (only when explicitly provided) */
    concrete_consistency?: ConcreteConsistency;
    /** Human-readable formula trace */
    formula: string;
}
/** Result of formwork filtering by pressure */
export interface FormworkFilterResult {
    /** Systems that can withstand the calculated pressure, sorted by rental price (cheapest first) */
    suitable: FormworkSystemSpec[];
    /** Systems that CANNOT withstand the pressure (for info/warnings) */
    rejected: FormworkSystemSpec[];
    /** The calculated pressure they were filtered against */
    pressure_kn_m2: number;
    /** Whether any system with defined pressure can handle it */
    has_suitable: boolean;
}
/** Suggested pour stages when full-height pour exceeds system limits */
export interface PourStagesSuggestion {
    /** Whether staging is needed (pressure exceeds all systems) */
    needs_staging: boolean;
    /** Number of stages (záběry). 1 = no staging needed */
    num_stages: number;
    /** Height per stage (m) */
    stage_height_m: number;
    /** Pressure per stage (kN/m²) — should fit available systems */
    stage_pressure_kn_m2: number;
    /** Max system pressure available (kN/m²) */
    max_system_pressure_kn_m2: number;
    /** Curing pause between stages (hours) — min 12h for vertical elements */
    cure_between_stages_h: number;
    /** Decision log entries */
    decision_log: string[];
}
/**
 * Get pour rate coefficient k based on delivery method.
 *
 * - pump:         k = 1.5 (fast rise, > 2 m/h)
 * - crane_bucket: k = 1.0 (slow, ≤ 1 m/h)
 * - direct:       k = 1.0 (gravity feed, ≤ 1 m/h)
 * - chute:        k = 1.2 (moderate, 1–2 m/h)
 */
export declare function getPourRateCoefficient(method: PourMethod): number;
/**
 * Calculate lateral pressure of fresh concrete on formwork.
 *
 * p = ρ × g × h × k  (kN/m²)
 *
 * Coefficient k resolution order (highest priority first):
 *   1. options.k_factor       (manual override)
 *   2. options.concrete_consistency (DIN 18218)
 *   3. pour_method            (legacy fallback)
 *
 * @param height_m - Pour height (m). For staged pours, this is per-stage height.
 * @param pour_method - Delivery method (legacy fallback for k coefficient)
 * @param options - Concrete consistency or explicit k override
 * @returns Pressure result with formula trace
 */
export declare function calculateLateralPressure(height_m: number, pour_method?: PourMethod, options?: LateralPressureOptions): LateralPressureResult;
/**
 * Stage count penalty multiplier (BUG-5).
 * Pure cost favors many small záběry; this penalty pushes the algorithm
 * toward systems that need fewer záběry.
 *
 * 1 zabér  = 1.0     (ideal)
 * 2 záběry = 1.0     (still acceptable)
 * 3 záběry = 1.1
 * 4–5      = 1.3
 * 6+       = 1.5
 */
export declare function getStageCountPenalty(stageCount: number): number;
export declare function filterFormworkByPressure(pressure_kn_m2: number, systems: FormworkSystemSpec[], orientation?: 'vertical' | 'horizontal', pour_height_m?: number): FormworkFilterResult;
/**
 * Parse max formwork height from the `heights` array.
 *
 * Examples:
 *   ['2.70', '3.30', '5.40']  → 5.4
 *   ['do 6.00']               → 6.0
 *   ['do 5.50']               → 5.5
 *   ['libovolná']             → Infinity
 *   ['3.00', '6.00', '9.00', '12.00'] → 12.0
 */
export declare function parseMaxHeight(heights: string[]): number;
/**
 * Suggest pour stages (záběry) when full-height pouring exceeds system limits.
 *
 * Logic:
 * 1. Calculate pressure at full height
 * 2. Find max pressure among all available systems
 * 3. If full-height pressure ≤ max system pressure → no staging needed
 * 4. Otherwise: calculate max stage height that fits best system,
 *    then num_stages = ceil(total_height / max_stage_height)
 *
 * @param total_height_m - Total element height
 * @param pour_method - Concrete delivery method
 * @param available_systems - Systems to consider (pre-filtered by category)
 * @returns Staging suggestion
 */
export declare function suggestPourStages(total_height_m: number, pour_method: PourMethod | undefined, available_systems: FormworkSystemSpec[], options?: LateralPressureOptions): PourStagesSuggestion;
/**
 * Infer pour method from element profile.
 *
 * Uses pump_typical flag and element height as heuristics.
 */
export declare function inferPourMethod(pump_typical: boolean, height_m?: number): PourMethod;
