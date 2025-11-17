/**
 * Calculator service
 * Uses shared formulas to calculate position fields and KPI
 */

import {
  calculatePositionFields,
  calculateHeaderKPI
} from '@monolit/shared';

/**
 * Calculate all positions with derived fields
 */
export function calculatePositions(positions, config) {
  const { defaults } = config;

  // First pass: calculate all fields
  const calculated = positions.map(pos =>
    calculatePositionFields(pos, positions, {
      rounding_step_kros: defaults.ROUNDING_STEP_KROS
    })
  );

  return calculated;
}

/**
 * Calculate header KPI for a bridge
 */
export function calculateKPI(positions, bridgeParams, config) {
  const { defaults } = config;

  return calculateHeaderKPI(positions, bridgeParams, {
    rho_t_per_m3: defaults.RHO_T_PER_M3
  });
}
