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
  // [A] + [C] + [D] + [move]  (concrete day is tracked separately in the backend engine)
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
  // While one capture cures, the crew works on the next with the second set
  const overlap = Math.max(0, curing_days - work_days);
  const stride = roundTo(cycle_days - overlap, 1);
  const totalB = num_captures <= 1
    ? cycle_days
    : roundTo((num_captures - 1) * stride + cycle_days, 1);

  // Strategy C — Parallel (N sets)
  const totalC = cycle_days;

  return [
    { id: 'A', label: 'Posloupně (1 sada)',   sets: 1,             total_days: totalA, rental_days: totalA + 2 * transport_days },
    { id: 'B', label: 'S překrytím (2 sady)', sets: 2,             total_days: totalB, rental_days: totalB + 2 * transport_days },
    { id: 'C', label: 'Paralelně (plný)',      sets: num_captures,  total_days: totalC, rental_days: totalC + 2 * transport_days },
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

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
