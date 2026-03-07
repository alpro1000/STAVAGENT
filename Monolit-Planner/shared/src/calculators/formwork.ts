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
export function calculateFormwork(params: FormworkCalculatorParams): FormworkCalculatorResult {
  // Validate inputs
  if (params.area_m2 <= 0) throw new Error('area_m2 must be positive');
  if (params.norm_assembly_h_m2 <= 0) throw new Error('norm_assembly_h_m2 must be positive');
  if (params.norm_disassembly_h_m2 <= 0) throw new Error('norm_disassembly_h_m2 must be positive');
  if (params.crew_size <= 0) throw new Error('crew_size must be positive');
  if (params.shift_h <= 0) throw new Error('shift_h must be positive');
  if (params.k <= 0 || params.k > 1) throw new Error('k must be between 0 and 1');
  if (params.wage_czk_h <= 0) throw new Error('wage_czk_h must be positive');
  if (params.strip_wait_hours < 0) throw new Error('strip_wait_hours must be non-negative');
  if (params.move_clean_hours < 0) throw new Error('move_clean_hours must be non-negative');

  // 1. Assembly hours & days
  const assembly_hours = params.area_m2 * params.norm_assembly_h_m2;
  const assembly_days = assembly_hours / (params.crew_size * params.shift_h * params.k);

  // 2. Disassembly hours & days
  const disassembly_hours = params.area_m2 * params.norm_disassembly_h_m2;
  const disassembly_days = disassembly_hours / (params.crew_size * params.shift_h * params.k);

  // 3. Curing/wait days (strip_wait_hours → calendar days, not work-hours)
  const wait_days = params.strip_wait_hours / 24;  // calendar days (curing is 24h)

  // 4. Move & clean days
  const move_clean_days = params.move_clean_hours / params.shift_h;

  // 5. Kit occupancy = full cycle of one capture
  // The kit is physically occupied from assembly start to stripping end + move:
  // [ASM] + [WAIT(rebar+concrete+curing)] + [STR] + [MOVE]
  // Note: rebar and concrete happen while the kit is in place, so they extend wait_days
  // The formwork-only view: assembly + curing + disassembly + move
  // (rebar and concrete are parallel with the kit being in place)
  const kit_occupancy_days = assembly_days + wait_days + disassembly_days + move_clean_days;

  // 6. Labor cost (assembly + disassembly only, not wait time!)
  const cost_labor = (assembly_hours + disassembly_hours) * params.wage_czk_h;

  // Traceability
  const source_tag = params.source_tag || 'USER';
  const confidence = params.confidence !== undefined ? params.confidence : 1.0;
  const assumptions_log = [
    `area=${params.area_m2.toFixed(2)}m²`,
    `norm_in=${params.norm_assembly_h_m2}h/m²`,
    `norm_out=${params.norm_disassembly_h_m2}h/m²`,
    `crew=${params.crew_size}`,
    `shift=${params.shift_h}h`,
    `k=${params.k}`,
    `wage=${params.wage_czk_h}CZK/h`,
    `curing=${wait_days.toFixed(1)}d`,
    `move_clean=${params.move_clean_hours}h`,
    `cycle=A+1+C+D=${roundTo(kit_occupancy_days, 1)}d`,
  ].join(', ');

  return {
    assembly_hours: roundTo(assembly_hours, 2),
    disassembly_hours: roundTo(disassembly_hours, 2),
    assembly_days: roundTo(assembly_days, 2),
    disassembly_days: roundTo(disassembly_days, 2),
    wait_days: roundTo(wait_days, 2),
    move_clean_days: roundTo(move_clean_days, 2),
    kit_occupancy_days: roundTo(kit_occupancy_days, 2),
    cost_labor: roundTo(cost_labor, 2),
    source_tag,
    assumptions_log,
    confidence,
  };
}

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
export function calculateCadenceB(
  assembly_days: number,
  disassembly_days: number,
  rebar_days: number,
  concrete_days: number,
  curing_days: number,
): number {
  const formworkCrewBusy = assembly_days + disassembly_days;
  const flowThrough = rebar_days + concrete_days + curing_days;
  return Math.max(formworkCrewBusy, flowThrough);
}

/**
 * Calculate 3 strategies for N captures.
 *
 * Uses the correct cadence formula for Strategy B:
 *   cadence = max(A + D, R + B + C)
 *
 * For backward compatibility, also accepts the simpler (cycle_days, curing_days, work_days)
 * signature — but the detailed version is preferred.
 */
export function calculateStrategies(
  cycle_days: number,
  curing_days: number,
  work_days: number,
  num_captures: number,
  transport_days: number = 1,
): StrategyResult[] {
  // Strategy A — Sequential (1 set)
  const totalA = roundTo(num_captures * cycle_days, 1);

  // Strategy B — Overlapping (2 sets)
  // Cadence = max(formwork_crew_busy, flow_through)
  // When we only have (cycle, curing, work), we approximate:
  //   formwork_crew_busy ≈ work_days - rebar - concrete ≈ A + D
  //   flow_through = R + B + C = cycle - A - D = cycle - (work - R - B)
  // Simplified: cadence = max(work_days, cycle_days - work_days + curing_days)
  // But the exact formula is: cadence = max(A+D, R+B+C) which reduces to:
  //   max(work_days, curing_days + rebar + concrete)
  // Without separate A/D/R/B breakdown, use: max(work_days, cycle_days - work_days + curing_days)
  const cadenceB = Math.max(work_days, curing_days + (cycle_days - work_days));
  const totalB = num_captures <= 1
    ? cycle_days
    : roundTo(cycle_days + (num_captures - 1) * cadenceB, 1);

  // Strategy C — Parallel (N sets)
  const totalC = cycle_days;

  return [
    { id: 'A', label: 'Posloupně (1 sada)',   sets: 1,             total_days: totalA, rental_days: totalA + 2 * transport_days },
    { id: 'B', label: 'S překrytím (2 sady)', sets: 2,             total_days: totalB, rental_days: totalB + 2 * transport_days },
    { id: 'C', label: 'Paralelně (plný)',      sets: num_captures,  total_days: totalC, rental_days: totalC + 2 * transport_days },
  ];
}

/**
 * Calculate strategies with full phase breakdown (preferred).
 *
 * Uses the exact cadence formula: max(A+D, R+B+C)
 */
export function calculateStrategiesDetailed(params: {
  assembly_days: number;
  rebar_days: number;
  concrete_days: number;
  curing_days: number;
  disassembly_days: number;
  num_captures: number;
  transport_days?: number;
}): StrategyResult[] {
  const { assembly_days: A, rebar_days: R, concrete_days: B, curing_days: C, disassembly_days: D, num_captures } = params;
  const transport = params.transport_days ?? 1;

  const cycleDays = A + R + B + C + D;

  // Strategy A — Sequential
  const totalA = roundTo(num_captures * cycleDays, 1);

  // Strategy B — Overlapping (exact cadence)
  const cadenceB = calculateCadenceB(A, D, R, B, C);
  const totalB = num_captures <= 1
    ? cycleDays
    : roundTo(cycleDays + (num_captures - 1) * cadenceB, 1);

  // Strategy C — Parallel
  const totalC = cycleDays;

  return [
    { id: 'A', label: 'Posloupně (1 sada)',   sets: 1,            total_days: totalA, rental_days: totalA + 2 * transport },
    { id: 'B', label: 'S překrytím (2 sady)', sets: 2,            total_days: totalB, rental_days: totalB + 2 * transport },
    { id: 'C', label: 'Paralelně (plný)',      sets: num_captures, total_days: totalC, rental_days: totalC + 2 * transport },
  ];
}

/**
 * Calculate maximum concurrent captures limited by formwork kits
 */
export function calculateMaxConcurrentCaptures(
  kit_occupancy_days: number,
  total_captures: number,
  kits_count: number
): number {
  return Math.min(kits_count, total_captures);
}

/**
 * Calculate formwork kit utilization
 */
export function calculateKitUtilization(
  kit_occupancy_days: number,
  project_duration_days: number,
  kits_count: number
): number {
  if (project_duration_days <= 0 || kits_count <= 0) return 0;
  const total_available_kit_days = project_duration_days * kits_count;
  const utilization = kit_occupancy_days / total_available_kit_days;
  return Math.min(utilization, 1.0);
}

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
export function calculateFullCycleRentalDays(
  assembly_days: number,
  rebar_days: number,
  concrete_days: number,
  curing_days: number,
  stripping_days: number,
  move_clean_days: number,
  rebar_overlap_days: number = 0,
): number {
  // Rebar has an SS lag: rebar_overlap_days = when rebar STARTS (days from project start)
  // Rebar ends at: rebar_overlap_days + rebar_days
  // Critical path: max(assembly end, rebar end)
  const prepDays = Math.max(assembly_days, rebar_overlap_days + rebar_days);

  const fullCycle = prepDays + concrete_days + curing_days + stripping_days + move_clean_days;

  return roundTo(fullCycle, 1);
}

// ─── 3-Phase Formwork Cost Model ────────────────────────────────────────────
// First tact, middle tacts, and final tact have different labor costs:
// - Initial assembly: higher cost (first-time layout, marking, alignment)
// - Cycle relocation: standard (crew experienced, kit pre-assembled)
// - Final stripping: lower cost (no reassembly, just clean removal)

/**
 * Phase multipliers for formwork labor.
 * Based on industry practice: first tact ~15% more, middle standard, last ~10% less.
 */
export const PHASE_MULTIPLIERS = {
  initial_assembly: 1.15,
  cycle_relocation: 1.0,
  final_stripping: 0.90,
} as const;

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
export function calculateThreePhaseFormwork(
  area_m2: number,
  norm_assembly_h_m2: number,
  norm_disassembly_h_m2: number,
  crew_size: number,
  shift_h: number,
  k: number,
  wage_czk_h: number,
  num_captures: number,
): ThreePhaseCostResult {
  const effective_h = crew_size * shift_h * k;

  // Base hours
  const asm_hours = area_m2 * norm_assembly_h_m2;
  const dis_hours = area_m2 * norm_disassembly_h_m2;

  // Phase 1: Initial assembly (higher effort — first-time layout)
  const init_asm_hours = asm_hours * PHASE_MULTIPLIERS.initial_assembly;
  const init_dis_hours = dis_hours; // stripping is always standard in first tact
  const initial_cost_labor = roundTo((init_asm_hours + init_dis_hours) * wage_czk_h, 2);
  const initial_days = roundTo((init_asm_hours + init_dis_hours) / effective_h, 2);

  // Phase 2: Middle tacts (relocation = standard)
  const mid_asm_hours = asm_hours * PHASE_MULTIPLIERS.cycle_relocation;
  const mid_dis_hours = dis_hours;
  const middle_cost_labor = roundTo((mid_asm_hours + mid_dis_hours) * wage_czk_h, 2);
  const middle_days = roundTo((mid_asm_hours + mid_dis_hours) / effective_h, 2);

  // Phase 3: Final stripping (easier — just remove, no re-assembly)
  const final_dis_hours = dis_hours * PHASE_MULTIPLIERS.final_stripping;
  const final_cost_labor = roundTo(final_dis_hours * wage_czk_h, 2);
  const final_days = roundTo(final_dis_hours / effective_h, 2);

  // Count: 1 initial + (N-2) middle + 1 final  (if N >= 2)
  const middle_tact_count = Math.max(0, num_captures - 2);
  const has_final = num_captures >= 2;

  let total_cost_labor: number;
  if (num_captures <= 1) {
    // Only one tact: initial assembly + stripping
    total_cost_labor = initial_cost_labor;
  } else {
    total_cost_labor = initial_cost_labor
      + middle_tact_count * middle_cost_labor
      + (has_final ? final_cost_labor : 0);
  }

  return {
    initial_cost_labor,
    middle_cost_labor,
    final_cost_labor,
    total_cost_labor: roundTo(total_cost_labor, 2),
    initial_days,
    middle_days,
    final_days,
    middle_tact_count,
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
