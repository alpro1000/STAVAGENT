/**
 * Bridge Construction Technology v1.0
 *
 * Recommends construction technology for bridge deck (mostovková deska):
 *   - Pevná skruž (fixed scaffolding) — whole bridge at once
 *   - Posuvná skruž / MSS (movable scaffolding system) — span by span
 *   - Letmá betonáž / CFT (cantilever free casting) — info only
 *
 * Reference data: SO204 (SAFE 2025), SO207 (D6 TZ 2025), SO221 (I/20 TZ 2025)
 */
export type ConstructionTechnology = 'fixed_scaffolding' | 'mss' | 'cantilever';
export interface BridgeTechnologyInput {
    /** Span length of the longest span (m). Key parameter for technology selection. */
    span_m: number;
    /** Free height under the bridge deck (m). Determines prop type (towers vs SL-1). */
    clearance_height_m: number;
    /** Number of bridge spans. Affects fixed vs MSS economics. */
    num_spans: number;
    /** Bridge deck subtype (affects tact duration). */
    deck_subtype?: string;
    /** Is prestressed? Affects tact duration (curing + stressing). */
    is_prestressed?: boolean;
    /** NK width (m). For area calculation. */
    nk_width_m?: number;
}
export interface TechnologyRecommendation {
    /** Recommended technology. */
    recommended: ConstructionTechnology;
    /** Why this technology is recommended (Czech). */
    reason: string;
    /** Available technologies with feasibility. */
    options: TechnologyOption[];
    /** Warnings for the current configuration. */
    warnings: string[];
}
export interface TechnologyOption {
    technology: ConstructionTechnology;
    label_cs: string;
    /** Is this option feasible for the given parameters? */
    feasible: boolean;
    /** Why not feasible (if not). */
    infeasible_reason?: string;
    /** Is this the recommended option? */
    is_recommended: boolean;
}
export interface MSSCostInput {
    /** Span length (m). */
    span_m: number;
    /** Number of spans. */
    num_spans: number;
    /** NK width (m). */
    nk_width_m: number;
    /** Tact duration (days per span). */
    tact_days: number;
    /** Override: mobilization cost (Kč). */
    mobilization_czk_override?: number;
    /** Override: monthly rental (Kč/month). */
    rental_czk_month_override?: number;
    /** Override: demobilization cost (Kč). */
    demobilization_czk_override?: number;
}
export interface MSSCostResult {
    /** Mobilization cost (Kč). */
    mobilization_czk: number;
    /** Monthly rental (Kč/month). */
    rental_czk_month: number;
    /** Rental duration (months). */
    rental_months: number;
    /** Total rental (Kč). */
    rental_total_czk: number;
    /** Demobilization cost (Kč). */
    demobilization_czk: number;
    /** Total MSS cost (Kč). */
    total_czk: number;
    /** Unit cost per m² NK (Kč/m²). */
    unit_cost_czk_m2: number;
    /** NK total area (m²). */
    nk_area_m2: number;
    /** Cost model used. */
    model: 'detailed' | 'simplified';
}
export interface MSSScheduleResult {
    /** MSS setup/mobilization (days). */
    setup_days: number;
    /** Tact duration (days per span). */
    tact_days: number;
    /** Number of tacts (= num_spans). */
    num_tacts: number;
    /** Total construction days (setup + tacts + teardown). */
    total_days: number;
    /** MSS teardown/demobilization (days). */
    teardown_days: number;
    /** Tact breakdown. */
    tact_breakdown: {
        formwork_days: number;
        rebar_days: number;
        concrete_days: number;
        curing_prestress_days: number;
        move_days: number;
    };
}
export declare function recommendBridgeTechnology(input: BridgeTechnologyInput): TechnologyRecommendation;
export declare function calculateMSSCost(input: MSSCostInput): MSSCostResult;
/**
 * Simplified MSS cost model — JC per m² NK.
 * For quick estimates when detailed parameters are not available.
 */
export declare function calculateMSSCostSimplified(span_m: number, nk_area_m2: number, unit_cost_override_czk_m2?: number): MSSCostResult;
export declare function calculateMSSSchedule(num_spans: number, deck_subtype?: string, is_prestressed?: boolean, tact_days_override?: number): MSSScheduleResult;
/**
 * Get default MSS tact duration for a deck subtype.
 */
export declare function getMSSTactDays(deck_subtype?: string): number;
