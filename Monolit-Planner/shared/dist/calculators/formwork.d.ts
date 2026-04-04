/**
 * Formwork Calculator v2
 * Deterministic calculator for formwork assembly/disassembly with:
 *   - Full cycle: [MONTÁŽ] → [ARMOVÁNÍ] → [BETONÁŽ 1d] → [ZRÁNÍ min.] → [DEMONTÁŽ]
 *   - 3 strategies: A (sequential), B (overlapping), C (parallel)
 *   - Curing by construction type × temperature (ČSN EN 13670)
 *   - Reinforcement integration
 *   - Rental cost optimization
 *
 * Formulas:
 *   assembly_hours = area_m2 × norm_assembly_h_m2
 *   assembly_days  = assembly_hours / (crew_size × shift_h × k)
 *   cycle_days     = A + R + 1 + C + D
 *   Strategy A:    total = N × cycle
 *   Strategy B:    total = (N-1) × stride + cycle, stride = cycle - overlap
 *   Strategy C:    total = cycle
 */
import type { FormworkCalculatorParams, FormworkCalculatorResult } from './types.js';
/**
 * Calculate formwork parameters (legacy compatible)
 *
 * @example
 * const result = calculateFormwork({
 *   area_m2: 82,
 *   norm_assembly_h_m2: 0.8,
 *   norm_disassembly_h_m2: 0.3,
 *   crew_size: 4,
 *   shift_h: 10,
 *   k: 0.8,
 *   wage_czk_h: 398,
 *   strip_wait_hours: 24,  // maps to curing_days
 *   move_clean_hours: 2,
 * });
 */
export declare function calculateFormwork(params: FormworkCalculatorParams): FormworkCalculatorResult;
/**
 * Strategy comparison for N captures with different set counts.
 *
 * @param cycle_days - Full cycle of one capture (A + R + B + C + D)
 * @param curing_days - Curing portion of the cycle
 * @param work_days - Work portion (A + R + B + D = cycle - curing)
 * @param num_captures - Total number of captures (tacts)
 */
export interface StrategyResult {
    id: string;
    label: string;
    sets: number;
    total_days: number;
    rental_days: number;
}
/**
 * Calculate cadence for Strategy B (overlapping, 2 sets).
 *
 * The cadence determines how often a new tact can start.
 * It's the LONGER of two constraints:
 *   1. formwork_crew_busy = A + D (crew does assembly then disassembly)
 *   2. flow_through = R + B + C (rebar + pour + cure before stripping is possible)
 *
 * The crew cannot start the next tact until BOTH constraints are satisfied.
 *
 * @param assembly_days - Formwork assembly days (A)
 * @param disassembly_days - Formwork disassembly days (D)
 * @param rebar_days - Reinforcement days (R), 0 if no rebar
 * @param concrete_days - Concrete pouring days (B), typically 1
 * @param curing_days - Curing/wait days (C)
 */
export declare function calculateCadenceB(assembly_days: number, disassembly_days: number, rebar_days: number, concrete_days: number, curing_days: number): number;
/**
 * Calculate 3 strategies for N captures.
 *
 * Uses the correct cadence formula for Strategy B:
 *   cadence = max(A + D, R + B + C)
 *
 * For backward compatibility, also accepts the simpler (cycle_days, curing_days, work_days)
 * signature — but the detailed version is preferred.
 */
export declare function calculateStrategies(cycle_days: number, curing_days: number, work_days: number, num_captures: number, transport_days?: number): StrategyResult[];
/**
 * Calculate strategies with full phase breakdown (preferred).
 *
 * Uses the exact cadence formula: max(A+D, R+B+C)
 */
export declare function calculateStrategiesDetailed(params: {
    assembly_days: number;
    rebar_days: number;
    concrete_days: number;
    curing_days: number;
    disassembly_days: number;
    num_captures: number;
    transport_days?: number;
}): StrategyResult[];
/**
 * Calculate maximum concurrent captures limited by formwork kits
 */
export declare function calculateMaxConcurrentCaptures(kit_occupancy_days: number, total_captures: number, kits_count: number): number;
/**
 * Calculate formwork kit utilization
 */
export declare function calculateKitUtilization(kit_occupancy_days: number, project_duration_days: number, kits_count: number): number;
/**
 * Calculate full rental duration including ALL phases the kit is occupied.
 *
 * The formwork set is physically in place from assembly start to stripping end.
 * This includes phases that are NOT formwork labor:
 *   - Rebar installation (different crew, kit in place)
 *   - Concrete pouring (different crew, kit in place)
 *   - Curing wait (no crew, kit in place)
 *
 * Use this for rental cost instead of kit_occupancy_days when rebar/concrete
 * days are known. Falls back to kit_occupancy_days if no rebar/concrete data.
 *
 * Full cycle: [ASM] + max(0, REB - ASM_overlap) + [CON] + [CUR] + [STR] + [MOVE]
 *
 * @param assembly_days - Formwork assembly duration
 * @param rebar_days - Rebar installation duration (0 if unknown)
 * @param concrete_days - Concrete pouring duration (default 1)
 * @param curing_days - Curing/wait before stripping
 * @param stripping_days - Formwork disassembly duration
 * @param move_clean_days - Move + clean duration
 * @param rebar_overlap_days - How much rebar overlaps with assembly (default 0)
 */
export declare function calculateFullCycleRentalDays(assembly_days: number, rebar_days: number, concrete_days: number, curing_days: number, stripping_days: number, move_clean_days: number, rebar_overlap_days?: number): number;
/**
 * Phase multipliers for formwork labor.
 * Based on industry practice: first tact ~15% more, middle standard, last ~10% less.
 */
export declare const PHASE_MULTIPLIERS: {
    readonly initial_assembly: 1.15;
    readonly cycle_relocation: 1;
    readonly final_stripping: 0.9;
};
export interface ThreePhaseCostResult {
    /** First tact: assembly + disassembly labor cost (CZK) */
    initial_cost_labor: number;
    /** Per middle tact: relocation + disassembly labor cost (CZK) */
    middle_cost_labor: number;
    /** Last tact: disassembly-only labor cost (CZK) */
    final_cost_labor: number;
    /** Total labor cost across all tacts */
    total_cost_labor: number;
    /** First tact duration (days) */
    initial_days: number;
    /** Middle tact duration (days) */
    middle_days: number;
    /** Final stripping duration (days) */
    final_days: number;
    /** Number of middle tacts (may be 0) */
    middle_tact_count: number;
}
/**
 * Calculate formwork labor differentiated by phase (first / middle / last tact).
 *
 * @param area_m2 - Formwork area per tact
 * @param norm_assembly_h_m2 - Assembly labor norm (h/m²)
 * @param norm_disassembly_h_m2 - Disassembly labor norm (h/m²)
 * @param crew_size - Crew size
 * @param shift_h - Shift hours
 * @param k - Time utilization (0-1)
 * @param wage_czk_h - Wage (CZK/h)
 * @param num_captures - Total number of captures/tacts
 *
 * @example
 * // 5 captures, 82 m²
 * calculateThreePhaseFormwork(82, 0.72, 0.25, 4, 10, 0.8, 398, 5)
 * // → initial ~15% more, 3 middle standard, final ~10% less
 */
export declare function calculateThreePhaseFormwork(area_m2: number, norm_assembly_h_m2: number, norm_disassembly_h_m2: number, crew_size: number, shift_h: number, k: number, wage_czk_h: number, num_captures: number): ThreePhaseCostResult;
