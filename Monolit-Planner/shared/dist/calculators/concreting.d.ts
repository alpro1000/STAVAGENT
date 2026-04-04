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
import type { ConcretingCalculatorParams, ConcretingCalculatorResult } from './types.js';
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
export declare function calculateConcreting(params: ConcretingCalculatorParams): ConcretingCalculatorResult;
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
export declare function calculateRequiredPumpCapacity(volume_m3: number, max_continuous_hours: number, setup_hours: number, washout_hours: number): number;
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
export declare function calculateOptimalCaptures(total_volume_m3: number, q_eff_m3_h: number, max_continuous_hours: number, setup_hours: number, washout_hours: number): number;
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
export declare function calculatePumpUtilization(total_pour_hours: number, project_duration_days: number, shift_hours: number): number;
