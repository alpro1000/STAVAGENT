/**
 * Position Defaults — Frontend Constants
 *
 * Single source of truth for default position values in the frontend.
 * Mirrors backend/src/utils/positionDefaults.js POSITION_DEFAULTS.
 *
 * These are used as:
 *   - Initial form state for new position modals (AddPositionModal, AddWorkModal)
 *   - Fallback values when position fields are missing
 *   - Default values in the calculator form (PlannerPage DEFAULT_FORM)
 *
 * Per-project overrides live in ProjectConfig.defaults (FlatProjectSettings).
 * When FlatProjectSettings is loaded, it overrides these defaults from
 * config.defaults.DEFAULT_WAGE_CZK_PH and DEFAULT_SHIFT_HOURS.
 */

export const DEFAULT_CREW_SIZE = 4;           // Standard crew (4 workers per brigade)
export const DEFAULT_CREW_SIZE_REBAR = 4;     // Rebar crew (same size)
export const DEFAULT_CREW_SIZE_POUR = 6;      // Concrete pour crew (larger)
export const DEFAULT_WAGE_CZK_PH = 398;       // Czech construction worker wage (Kč/h)
export const DEFAULT_SHIFT_HOURS = 10;        // Standard 10h working day
export const DEFAULT_K_UTILIZATION = 0.8;     // Time utilization coefficient

/** Full position defaults as a single object (mirrors backend POSITION_DEFAULTS) */
export const POSITION_DEFAULTS = {
  crew_size: DEFAULT_CREW_SIZE,
  wage_czk_ph: DEFAULT_WAGE_CZK_PH,
  shift_hours: DEFAULT_SHIFT_HOURS,
  days: 0,
  qty: 0,
} as const;
