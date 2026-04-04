/**
 * Rebar Calculator
 * Deterministic calculator for reinforcement work
 *
 * Formula:
 *   labor_hours = mass_t × norm_h_per_t
 *   duration_days = labor_hours / (crew_size × shift_h × k)
 *   cost_labor = labor_hours × wage_czk_h
 */
import type { RebarCalculatorParams, RebarCalculatorResult } from './types.js';
/**
 * Calculate rebar work parameters
 *
 * @example
 * const result = calculateRebar({
 *   mass_t: 2.05,
 *   norm_h_per_t: 50,
 *   crew_size: 4,
 *   shift_h: 10,
 *   k: 0.8,
 *   wage_czk_h: 398,
 *   source_tag: 'URS_2024_OFFICIAL',
 *   confidence: 0.95
 * });
 *
 * // result.labor_hours = 102.5 ч
 * // result.duration_days = 3.20 дня
 * // result.cost_labor = 40,795 CZK
 */
export declare function calculateRebar(params: RebarCalculatorParams): RebarCalculatorResult;
