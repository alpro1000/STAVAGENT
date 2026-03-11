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
export function calculateRebar(params: RebarCalculatorParams): RebarCalculatorResult {
  // Validate inputs
  if (params.mass_t <= 0) {
    throw new Error('mass_t must be positive');
  }
  if (params.norm_h_per_t <= 0) {
    throw new Error('norm_h_per_t must be positive');
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

  // ============================================
  // DETERMINISTIC CALCULATIONS
  // ============================================

  // 1. Labor hours = mass × norm
  const labor_hours = params.mass_t * params.norm_h_per_t;

  // 2. Duration in days = labor_hours / (crew × shift × utilization)
  const duration_days = labor_hours / (params.crew_size * params.shift_h * params.k);

  // 3. Labor cost = labor_hours × wage
  const cost_labor = labor_hours * params.wage_czk_h;

  // ============================================
  // TRACEABILITY
  // ============================================

  const source_tag = params.source_tag || 'USER';
  const confidence = params.confidence !== undefined ? params.confidence : 1.0;

  // Build assumptions log (для трассируемости)
  const assumptions_log = [
    `mass=${params.mass_t.toFixed(3)}t`,
    `norm=${params.norm_h_per_t}h/t`,
    `crew=${params.crew_size}`,
    `shift=${params.shift_h}h`,
    `k=${params.k}`,
    `wage=${params.wage_czk_h}CZK/h`
  ].join(', ');

  // ============================================
  // RETURN RESULT
  // ============================================

  return {
    labor_hours: roundTo(labor_hours, 2),
    duration_days: roundTo(duration_days, 2),
    cost_labor: roundTo(cost_labor, 2),

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
