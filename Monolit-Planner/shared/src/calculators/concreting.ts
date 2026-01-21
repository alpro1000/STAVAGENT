/**
 * Concreting (Pump) Calculator
 * Deterministic calculator for concrete pouring with pump
 *
 * Formula:
 *   pour_hours = setup_hours + (volume_m3 / q_eff_m3_h) + washout_hours
 *   pour_days = pour_hours / shift_h
 *   cost_labor = pour_hours × crew_size × wage_czk_h
 *   cost_pump = pour_hours × pump_rate_czk_h
 *
 * Validation:
 *   exceeds_continuous_window = pour_hours > max_continuous_hours
 */

import type { ConcretingCalculatorParams, ConcretingCalculatorResult } from './types';

/**
 * Calculate concreting parameters with pump
 *
 * @example
 * const result = calculateConcreting({
 *   volume_m3: 20.5,
 *   q_eff_m3_h: 15,
 *   setup_hours: 0.5,
 *   washout_hours: 0.5,
 *   crew_size: 6,
 *   shift_h: 10,
 *   wage_czk_h: 398,
 *   pump_rate_czk_h: 1500,
 *   max_continuous_hours: 12,
 *   source_tag: 'URS_2024_OFFICIAL',
 *   confidence: 0.95
 * });
 *
 * // result.pour_hours = 2.37 ч
 * // result.cost_labor = 5,659 CZK
 * // result.cost_pump = 3,555 CZK
 * // result.exceeds_continuous_window = false ✅
 */
export function calculateConcreting(params: ConcretingCalculatorParams): ConcretingCalculatorResult {
  // Validate inputs
  if (params.volume_m3 <= 0) {
    throw new Error('volume_m3 must be positive');
  }
  if (params.q_eff_m3_h <= 0) {
    throw new Error('q_eff_m3_h must be positive');
  }
  if (params.setup_hours < 0) {
    throw new Error('setup_hours must be non-negative');
  }
  if (params.washout_hours < 0) {
    throw new Error('washout_hours must be non-negative');
  }
  if (params.crew_size <= 0) {
    throw new Error('crew_size must be positive');
  }
  if (params.shift_h <= 0) {
    throw new Error('shift_h must be positive');
  }
  if (params.wage_czk_h <= 0) {
    throw new Error('wage_czk_h must be positive');
  }
  if (params.pump_rate_czk_h <= 0) {
    throw new Error('pump_rate_czk_h must be positive');
  }
  if (params.max_continuous_hours <= 0) {
    throw new Error('max_continuous_hours must be positive');
  }

  // ============================================
  // DETERMINISTIC CALCULATIONS
  // ============================================

  // 1. Pouring time = setup + pumping + washout
  const pumping_hours = params.volume_m3 / params.q_eff_m3_h;
  const pour_hours = params.setup_hours + pumping_hours + params.washout_hours;

  // 2. Duration in days
  const pour_days = pour_hours / params.shift_h;

  // 3. Labor cost
  const cost_labor = pour_hours * params.crew_size * params.wage_czk_h;

  // 4. Pump cost
  const cost_pump = pour_hours * params.pump_rate_czk_h;

  // ============================================
  // VALIDATION: Continuous pour window
  // ============================================

  const exceeds_continuous_window = pour_hours > params.max_continuous_hours;

  let warning: string | null = null;
  if (exceeds_continuous_window) {
    warning = `⚠️ Время бетонирования ${pour_hours.toFixed(1)}ч превышает окно непрерывности ${params.max_continuous_hours}ч. Требуется рабочий шов или разбиение на такты.`;
  }

  // ============================================
  // TRACEABILITY
  // ============================================

  const source_tag = params.source_tag || 'USER';
  const confidence = params.confidence !== undefined ? params.confidence : 1.0;

  const assumptions_log = [
    `volume=${params.volume_m3.toFixed(2)}m³`,
    `Q_eff=${params.q_eff_m3_h}m³/h`,
    `setup=${params.setup_hours}h`,
    `washout=${params.washout_hours}h`,
    `crew=${params.crew_size}`,
    `shift=${params.shift_h}h`,
    `wage=${params.wage_czk_h}CZK/h`,
    `pump_rate=${params.pump_rate_czk_h}CZK/h`,
    `max_continuous=${params.max_continuous_hours}h`
  ].join(', ');

  // ============================================
  // RETURN RESULT
  // ============================================

  return {
    pour_hours: roundTo(pour_hours, 2),
    pour_days: roundTo(pour_days, 2),
    cost_labor: roundTo(cost_labor, 2),
    cost_pump: roundTo(cost_pump, 2),

    // Validation
    exceeds_continuous_window,
    warning,

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
 * Calculate required effective pump capacity to fit within time window
 *
 * @param volume_m3 - Volume to pour (m³)
 * @param max_continuous_hours - Maximum continuous pour window (h)
 * @param setup_hours - Setup time (h)
 * @param washout_hours - Washout time (h)
 * @returns Required Q_eff (m³/h)
 *
 * @example
 * // Need to pour 41m³ within 12h window, setup+washout = 1h
 * const required_q = calculateRequiredPumpCapacity(41, 12, 0.5, 0.5);
 * // required_q = 3.73 m³/h (slow enough to fit in window)
 *
 * // With only 6h window:
 * const required_q = calculateRequiredPumpCapacity(41, 6, 0.5, 0.5);
 * // required_q = 8.2 m³/h (need faster pump!)
 */
export function calculateRequiredPumpCapacity(
  volume_m3: number,
  max_continuous_hours: number,
  setup_hours: number,
  washout_hours: number
): number {
  // Available time for actual pumping
  const available_pumping_hours = max_continuous_hours - setup_hours - washout_hours;

  if (available_pumping_hours <= 0) {
    throw new Error('max_continuous_hours must be greater than setup + washout');
  }

  // Required capacity
  const required_q_eff = volume_m3 / available_pumping_hours;

  return roundTo(required_q_eff, 2);
}

/**
 * Calculate optimal number of captures (takts) for given volume
 *
 * @param total_volume_m3 - Total volume to pour (m³)
 * @param q_eff_m3_h - Available pump capacity (m³/h)
 * @param max_continuous_hours - Maximum continuous pour window (h)
 * @param setup_hours - Setup time per capture (h)
 * @param washout_hours - Washout time per capture (h)
 * @returns Recommended number of captures
 *
 * @example
 * // 82m³ total, Q_eff=15m³/h, 12h window, setup+washout=1h
 * const captures = calculateOptimalCaptures(82, 15, 12, 0.5, 0.5);
 * // captures = 2 (41m³ per capture fits in 12h window)
 */
export function calculateOptimalCaptures(
  total_volume_m3: number,
  q_eff_m3_h: number,
  max_continuous_hours: number,
  setup_hours: number,
  washout_hours: number
): number {
  // Available time for actual pumping per capture
  const available_pumping_hours = max_continuous_hours - setup_hours - washout_hours;

  if (available_pumping_hours <= 0) {
    throw new Error('max_continuous_hours must be greater than setup + washout');
  }

  // Maximum volume per capture
  const max_volume_per_capture = q_eff_m3_h * available_pumping_hours;

  // Number of captures needed
  const captures = Math.ceil(total_volume_m3 / max_volume_per_capture);

  return captures;
}

/**
 * Calculate pump utilization
 *
 * @param total_pour_hours - Total hours pump is working
 * @param project_duration_days - Total project duration
 * @param shift_hours - Hours per shift
 * @returns Utilization rate (0-1)
 *
 * @example
 * // Pump works 20 hours total, project is 50 days × 10h/day = 500h
 * const util = calculatePumpUtilization(20, 50, 10);
 * // util = 0.04 (4% utilization - pump is underutilized!)
 */
export function calculatePumpUtilization(
  total_pour_hours: number,
  project_duration_days: number,
  shift_hours: number
): number {
  if (project_duration_days <= 0 || shift_hours <= 0) {
    return 0;
  }

  const total_available_hours = project_duration_days * shift_hours;

  return Math.min(total_pour_hours / total_available_hours, 1.0);
}
