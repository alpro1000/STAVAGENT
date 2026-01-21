/**
 * Formwork Calculator
 * Deterministic calculator for formwork assembly/disassembly
 *
 * Phases:
 *   1. Assembly (монтаж)
 *   2. Wait for stripping (выдержка бетона)
 *   3. Disassembly (демонтаж)
 *   4. Move & clean (перестановка и очистка)
 *
 * Formulas:
 *   assembly_hours = area_m2 × norm_assembly_h_m2
 *   disassembly_hours = area_m2 × norm_disassembly_h_m2
 *   assembly_days = assembly_hours / (crew_size × shift_h × k)
 *   disassembly_days = disassembly_hours / (crew_size × shift_h × k)
 *   wait_days = strip_wait_hours / shift_h
 *   move_clean_days = move_clean_hours / shift_h
 *   kit_occupancy_days = assembly_days + wait_days + disassembly_days + move_clean_days
 *   cost_labor = (assembly_hours + disassembly_hours) × wage_czk_h
 *
 * NOTE: cost_rental calculated in Schedule Engine based on actual calendar!
 */

import type { FormworkCalculatorParams, FormworkCalculatorResult } from './types.js';

/**
 * Calculate formwork parameters
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
 *   strip_wait_hours: 72,
 *   move_clean_hours: 2,
 *   source_tag: 'URS_2024_OFFICIAL',
 *   confidence: 0.95
 * });
 *
 * // result.assembly_hours = 65.6 ч
 * // result.disassembly_hours = 24.6 ч
 * // result.kit_occupancy_days = 10.22 дня
 * // result.cost_labor = 35,900 CZK
 */
export function calculateFormwork(params: FormworkCalculatorParams): FormworkCalculatorResult {
  // Validate inputs
  if (params.area_m2 <= 0) {
    throw new Error('area_m2 must be positive');
  }
  if (params.norm_assembly_h_m2 <= 0) {
    throw new Error('norm_assembly_h_m2 must be positive');
  }
  if (params.norm_disassembly_h_m2 <= 0) {
    throw new Error('norm_disassembly_h_m2 must be positive');
  }
  if (params.crew_size <= 0) {
    throw new Error('crew_size must be positive');
  }
  if (params.shift_h <= 0) {
    throw new Error('shift_h must be positive');
  }
  if (params.k <= 0 || params.k > 1) {
    throw new Error('k (time utilization) must be between 0 and 1');
  }
  if (params.wage_czk_h <= 0) {
    throw new Error('wage_czk_h must be positive');
  }
  if (params.strip_wait_hours < 0) {
    throw new Error('strip_wait_hours must be non-negative');
  }
  if (params.move_clean_hours < 0) {
    throw new Error('move_clean_hours must be non-negative');
  }

  // ============================================
  // DETERMINISTIC CALCULATIONS
  // ============================================

  // 1. Assembly hours
  const assembly_hours = params.area_m2 * params.norm_assembly_h_m2;

  // 2. Disassembly hours
  const disassembly_hours = params.area_m2 * params.norm_disassembly_h_m2;

  // 3. Assembly days
  const assembly_days = assembly_hours / (params.crew_size * params.shift_h * params.k);

  // 4. Disassembly days
  const disassembly_days = disassembly_hours / (params.crew_size * params.shift_h * params.k);

  // 5. Wait days (технологическая пауза)
  const wait_days = params.strip_wait_hours / params.shift_h;

  // 6. Move & clean days
  const move_clean_days = params.move_clean_hours / params.shift_h;

  // 7. Kit occupancy (полная занятость комплекта опалубки)
  const kit_occupancy_days = assembly_days + wait_days + disassembly_days + move_clean_days;

  // 8. Labor cost (only for assembly + disassembly, NOT wait time!)
  const cost_labor = (assembly_hours + disassembly_hours) * params.wage_czk_h;

  // ============================================
  // TRACEABILITY
  // ============================================

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
    `strip_wait=${params.strip_wait_hours}h`,
    `move_clean=${params.move_clean_hours}h`
  ].join(', ');

  // ============================================
  // RETURN RESULT
  // ============================================

  return {
    assembly_hours: roundTo(assembly_hours, 2),
    disassembly_hours: roundTo(disassembly_hours, 2),
    assembly_days: roundTo(assembly_days, 2),
    disassembly_days: roundTo(disassembly_days, 2),
    wait_days: roundTo(wait_days, 2),
    move_clean_days: roundTo(move_clean_days, 2),
    kit_occupancy_days: roundTo(kit_occupancy_days, 2),

    cost_labor: roundTo(cost_labor, 2),
    // NOTE: cost_rental calculated in Schedule Engine!

    // Traceability
    source_tag,
    assumptions_log,
    confidence
  };
}

/**
 * Helper: Round to N decimal places
 */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate maximum concurrent captures limited by formwork kits
 *
 * @param kit_occupancy_days - Occupancy of ONE kit for ONE capture
 * @param total_captures - Total number of captures in project
 * @param kits_count - Number of formwork kits available
 * @returns Maximum concurrent captures
 *
 * @example
 * // Kit occupies 10 days per capture, 4 captures total, 1 kit available
 * const maxConcurrent = calculateMaxConcurrentCaptures(10, 4, 1);
 * // maxConcurrent = 1 (sequential work)
 *
 * // With 2 kits:
 * const maxConcurrent = calculateMaxConcurrentCaptures(10, 4, 2);
 * // maxConcurrent = 2 (can work on 2 captures simultaneously)
 */
export function calculateMaxConcurrentCaptures(
  kit_occupancy_days: number,
  total_captures: number,
  kits_count: number
): number {
  // With k=1 kit, can work on 1 capture at a time (sequential)
  // With k=2 kits, can work on 2 captures simultaneously (parallel)
  return Math.min(kits_count, total_captures);
}

/**
 * Calculate formwork kit utilization
 *
 * @param kit_occupancy_days - Days each kit is occupied
 * @param project_duration_days - Total project duration
 * @param kits_count - Number of kits
 * @returns Utilization rate (0-1)
 *
 * @example
 * // 1 kit occupied 40 days out of 50 days total
 * const util = calculateKitUtilization(40, 50, 1);
 * // util = 0.8 (80% utilization)
 */
export function calculateKitUtilization(
  kit_occupancy_days: number,
  project_duration_days: number,
  kits_count: number
): number {
  if (project_duration_days <= 0 || kits_count <= 0) {
    return 0;
  }

  // Total available kit-days = project_duration × kits_count
  const total_available_kit_days = project_duration_days * kits_count;

  // Utilization = occupied / available
  const utilization = kit_occupancy_days / total_available_kit_days;

  return Math.min(utilization, 1.0); // Cap at 100%
}
