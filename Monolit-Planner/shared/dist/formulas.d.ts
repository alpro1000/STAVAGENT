/**
 * Monolit Planner - Calculation Formulas
 * Core business logic for position calculations
 */
import { Position, HeaderKPI, FormworkCalculatorRow } from './types';
/**
 * Calculate labor hours for a position
 */
export declare function calculateLaborHours(crew_size: number, shift_hours: number, days: number): number;
/**
 * Calculate total cost in CZK
 */
export declare function calculateCostCZK(labor_hours: number, wage_czk_ph: number): number;
/**
 * Calculate unit cost in native unit (CZK/MJ)
 */
export declare function calculateUnitCostNative(cost_czk: number, qty: number): number;
/**
 * Calculate unit cost per m³ of concrete (KEY METRIC!)
 * This converts all subtypes to a common denominator: CZK/m³ of concrete
 */
export declare function calculateUnitCostOnM3(cost_czk: number, concrete_m3: number): number;
/**
 * Calculate KROS unit cost with rounding up to nearest 50 CZK step
 */
export declare function calculateKrosUnitCZK(unit_cost_on_m3: number, rounding_step?: number): number;
/**
 * Calculate KROS total cost
 */
export declare function calculateKrosTotalCZK(kros_unit_czk: number, concrete_m3: number): number;
/**
 * Find concrete volume for a part (from beton subtype position)
 */
export declare function findConcreteVolumeForPart(positions: Position[], bridge_id: string, part_name: string): number | null;
/**
 * Calculate all derived fields for a position
 */
export declare function calculatePositionFields(position: Position, allPositions: Position[], config?: {
    rounding_step_kros?: number;
}): Position;
/**
 * Calculate weighted average of a field across positions
 */
export declare function calculateWeightedAverage(positions: Position[], field: keyof Position, weightField?: 'concrete_m3'): number;
/**
 * ⭐ Calculate duration in months
 * Formula: sum_kros_total_czk / (avg_crew × avg_wage × avg_shift × days_per_month)
 */
export declare function calculateEstimatedMonths(sum_kros_total_czk: number, avg_crew_size: number, avg_wage_czk_ph: number, avg_shift_hours: number, days_per_month: number): number;
/**
 * ⭐ Calculate duration in weeks
 * Formula:
 *   days_per_month=30 (calendar days) → divide by 7 (calendar days/week)
 *   days_per_month=22 (working days)  → divide by 5 (working days/week)
 */
export declare function calculateEstimatedWeeks(estimated_months: number, days_per_month: number): number;
/**
 * Calculate complete Header KPI for a bridge
 */
export declare function calculateHeaderKPI(positions: Position[], bridgeParams: {
    span_length_m?: number;
    deck_width_m?: number;
    pd_weeks?: number;
    days_per_month_mode?: 30 | 22;
}, config?: {
    rho_t_per_m3?: number;
}): HeaderKPI;
/**
 * Calculate number of tacts (cycles) for formwork
 * Default: ceil(total_area / set_area), but user can override
 */
export declare function calculateFormworkTacts(total_area_m2: number, set_area_m2: number): number;
/**
 * Calculate formwork term in days (pure formwork work only)
 * termín = taktů × dní_na_takt
 */
export declare function calculateFormworkTerm(num_tacts: number, days_per_tact: number): number;
/**
 * Calculate monthly rental cost per set
 * měsíční_nájem_sada = sada_m² × cena_Kč/m²
 */
export declare function calculateMonthlyRentalPerSet(set_area_m2: number, rental_czk_per_m2_month: number): number;
/**
 * Calculate final rental cost for the usage period
 * konečný_nájem = měsíční_nájem_sada × (termín_dní / 30)
 */
export declare function calculateFinalRentalCost(monthly_rental_per_set: number, term_days: number): number;
/**
 * Calculate total element duration (all work types + curing)
 * Used to determine total element calendar duration for rental calculation
 *
 * Two modes:
 *
 * 1. RCPSP Scheduler (when num_tacts available in formwork_rental metadata):
 *    Builds a DAG of activities per tact, schedules with resource constraints
 *    (formwork sets, crews), finds critical path. Models parallel work on
 *    different sets during curing and rebar overlap with assembly.
 *
 * 2. Simple formula (fallback):
 *    Celk. doba = max(bednění, výztuž) + beton + effectiveCuring + jiné
 *    Parallel prep + curing divided by num_sets.
 *
 * Metadata for RCPSP mode (in formwork_rental position):
 *   { type: "formwork_rental", num_tacts: 4, stripping_days: 1, rebar_lag_pct: 50 }
 */
export declare function calculateElementTotalDays(partPositions: Position[]): number;
/**
 * Generate KROS description for formwork rental position
 */
export declare function generateFormworkKrosDescription(row: Pick<FormworkCalculatorRow, 'construction_name' | 'system_name' | 'system_height' | 'rental_czk_per_m2_month' | 'set_area_m2' | 'monthly_rental_per_set'>): string;
/**
 * Aggregate schedule tact_details into labor-days per subtype.
 *
 * Each tact has phases: assembly, rebar, concrete, curing, stripping, prestress?
 * as [start_day, end_day] tuples.
 *
 * Labor-days = Σ (end - start) across ALL tacts (parallel tacts add up
 * because different crews work simultaneously → labor costs are additive).
 *
 * Exception: curing = calendar span (max end - min start), not labor sum,
 * because curing is a technological pause with 0 workers.
 *
 * @param tacts - Array of TactDetail from ElementScheduleOutput
 * @param fallback - Fallback values when tact_details is empty
 * @returns Aggregated days per subtype
 */
export interface ScheduleFallback {
    numTacts: number;
    assemblyDaysPerTact: number;
    rebarDaysPerTact: number;
    concreteDaysPerTact?: number;
    curingDays: number;
    strippingDaysPerTact: number;
    prestressDaysPerTact?: number;
}
export interface AggregatedScheduleDays {
    bedneni: number;
    vyztuž: number;
    beton: number;
    zrani: number;
    odbedneni: number;
    predpeti: number;
}
export declare function aggregateScheduleDays(tacts: Array<{
    assembly: [number, number];
    rebar: [number, number];
    concrete: [number, number];
    curing: [number, number];
    stripping: [number, number];
    prestress?: [number, number];
}>, fallback?: ScheduleFallback): AggregatedScheduleDays;
