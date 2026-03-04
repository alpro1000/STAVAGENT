/**
 * Concrete Maturity & Curing Model
 *
 * Based on ČSN EN 13670 (Execution of concrete structures) Table NA.2
 * and Saul's Maturity Method (Nurse-Saul function).
 *
 * Minimum curing time before stripping depends on:
 *   - Concrete class (C20/25, C25/30, C30/37, etc.)
 *   - Ambient temperature (°C)
 *   - Required strength at stripping (% of f_ck)
 *   - Element type (slab, wall, beam, column)
 *
 * Maturity (M):
 *   M = Σ (T_i + 10) × Δt_i    [°C·hours]
 *   where T_i = average temperature during interval Δt_i
 *   Datum temperature = -10°C (standard for OPC)
 *
 * This model provides:
 *   1. Lookup tables for minimum curing days (ČSN EN 13670)
 *   2. Maturity-based curing estimation
 *   3. strip_wait_hours replacement for formwork calculator
 *
 * Reference: ČSN EN 13670, ČSN EN 206+A2, ČSN 73 6244
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Concrete strength class per EN 206 */
export type ConcreteClass =
  | 'C12/15' | 'C16/20' | 'C20/25' | 'C25/30'
  | 'C30/37' | 'C35/45' | 'C40/50' | 'C45/55'
  | 'C50/60';

/** Cement type (affects early strength gain) */
export type CementType =
  | 'CEM_I'    // OPC — fast early strength
  | 'CEM_II'   // Blended — moderate
  | 'CEM_III'; // Slag — slow early strength

/** Structural element type (affects required strip strength %) */
export type ElementType =
  | 'slab'     // Horizontal — needs 70% f_ck min
  | 'wall'     // Vertical — needs 50% f_ck min (self-supporting sooner)
  | 'beam'     // Horizontal, loaded — needs 70% f_ck min
  | 'column';  // Vertical, compressed — needs 50% f_ck min

/** Parameters for curing time calculation */
export interface CuringParams {
  concrete_class: ConcreteClass;
  temperature_c: number;        // Average ambient temperature (°C)
  cement_type?: CementType;     // Default: CEM_I
  element_type?: ElementType;   // Default: slab (conservative)
  strip_strength_pct?: number;  // Override: required strength % at stripping
}

/** Result of curing calculation */
export interface CuringResult {
  min_curing_days: number;        // Minimum curing time (calendar days)
  min_curing_hours: number;       // Same in hours (for formwork calculator)
  strip_strength_pct: number;     // Required strength at stripping (%)
  estimated_strength_pct: number; // Estimated strength at strip time (%)
  maturity_index: number;         // Maturity index M (°C·hours)
  temperature_c: number;
  concrete_class: ConcreteClass;
  cement_type: CementType;
  element_type: ElementType;
  warning: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** f_ck values (MPa) for each concrete class */
const FCK: Record<ConcreteClass, number> = {
  'C12/15': 12, 'C16/20': 16, 'C20/25': 20, 'C25/30': 25,
  'C30/37': 30, 'C35/45': 35, 'C40/50': 40, 'C45/55': 45,
  'C50/60': 50,
};

/** Minimum required strip strength as % of f_ck, by element type */
const STRIP_STRENGTH_PCT: Record<ElementType, number> = {
  slab: 70,    // Horizontal, self-weight + live
  beam: 70,    // Horizontal, bending
  wall: 50,    // Vertical, self-supporting
  column: 50,  // Vertical, self-supporting
};

/**
 * Minimum curing days by temperature range and concrete class
 * Per ČSN EN 13670, Table NA.2 (simplified)
 *
 * Rows: temperature ranges (°C)
 * Cols: concrete class groups
 *
 * These assume CEM I, horizontal elements (slab/beam).
 * Vertical elements (wall/column) get ~60% of these values.
 */
const CURING_DAYS_TABLE: {
  temp_min: number;
  temp_max: number;
  days: Record<string, number>; // class group → days
}[] = [
  // t < 5°C — very slow hydration
  { temp_min: -5, temp_max: 5,   days: { 'C12-C16': 7, 'C20-C25': 5, 'C30+': 4 } },
  // 5°C ≤ t < 10°C
  { temp_min: 5,  temp_max: 10,  days: { 'C12-C16': 5, 'C20-C25': 4, 'C30+': 3 } },
  // 10°C ≤ t < 15°C
  { temp_min: 10, temp_max: 15,  days: { 'C12-C16': 4, 'C20-C25': 3, 'C30+': 2 } },
  // 15°C ≤ t < 25°C — optimal range
  { temp_min: 15, temp_max: 25,  days: { 'C12-C16': 3, 'C20-C25': 2, 'C30+': 1.5 } },
  // t ≥ 25°C — fast but need wet curing!
  { temp_min: 25, temp_max: 50,  days: { 'C12-C16': 2, 'C20-C25': 1.5, 'C30+': 1 } },
];

/**
 * Cement type speed factor (relative to CEM I = 1.0)
 * CEM III (slag) is ~40% slower in early age
 */
const CEMENT_SPEED: Record<CementType, number> = {
  CEM_I: 1.0,
  CEM_II: 0.85,
  CEM_III: 0.6,
};

/** Datum temperature for Nurse-Saul maturity (°C) */
const T_DATUM = -10;

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Get the class group key for the lookup table
 */
function classGroup(cls: ConcreteClass): string {
  const fck = FCK[cls];
  if (fck <= 16) return 'C12-C16';
  if (fck <= 25) return 'C20-C25';
  return 'C30+';
}

/**
 * Calculate minimum curing time before stripping
 *
 * Primary method: ČSN EN 13670 Table NA.2 lookup
 * Adjusted for cement type and element type
 */
export function calculateCuring(params: CuringParams): CuringResult {
  const cement = params.cement_type || 'CEM_I';
  const element = params.element_type || 'slab';
  const temp = params.temperature_c;

  // Validate temperature
  if (temp < -10) {
    return {
      min_curing_days: Infinity,
      min_curing_hours: Infinity,
      strip_strength_pct: STRIP_STRENGTH_PCT[element],
      estimated_strength_pct: 0,
      maturity_index: 0,
      temperature_c: temp,
      concrete_class: params.concrete_class,
      cement_type: cement,
      element_type: element,
      warning: 'Temperature below -10°C: concrete must not be placed (ČSN EN 13670)',
    };
  }

  const group = classGroup(params.concrete_class);
  const stripPct = params.strip_strength_pct ?? STRIP_STRENGTH_PCT[element];

  // Find temperature row
  let baseDays: number;
  if (temp < -5) {
    // Below table range — extrapolate conservatively
    baseDays = 10;
  } else {
    const row = CURING_DAYS_TABLE.find(r => temp >= r.temp_min && temp < r.temp_max);
    baseDays = row ? row.days[group] : CURING_DAYS_TABLE[CURING_DAYS_TABLE.length - 1].days[group];
  }

  // Adjust for cement type (slower cement = longer curing)
  const cementFactor = 1 / CEMENT_SPEED[cement];
  let adjustedDays = baseDays * cementFactor;

  // Adjust for element type — vertical elements strip faster
  if (element === 'wall' || element === 'column') {
    adjustedDays *= 0.7;  // 30% faster for vertical elements
  }

  // If custom strip strength is higher than default, scale proportionally
  const defaultStripPct = STRIP_STRENGTH_PCT[element];
  if (stripPct > defaultStripPct) {
    adjustedDays *= stripPct / defaultStripPct;
  }

  // Round up to nearest 0.5 day
  const minDays = Math.ceil(adjustedDays * 2) / 2;
  const minHours = minDays * 24;

  // Estimate maturity index at curing time
  const maturityIndex = (temp - T_DATUM) * minHours;

  // Estimate achieved strength % (simplified Plowman log model)
  const estimatedPct = estimateStrengthPct(maturityIndex, params.concrete_class, cement);

  // Warnings
  let warning: string | null = null;
  if (temp < 5) {
    warning = 'Low temperature: consider heating/insulation. Risk of frost damage if T < 0°C.';
  } else if (temp > 35) {
    warning = 'High temperature: mandatory wet curing. Risk of thermal cracking and reduced long-term strength.';
  }

  return {
    min_curing_days: minDays,
    min_curing_hours: minHours,
    strip_strength_pct: stripPct,
    estimated_strength_pct: round2(estimatedPct),
    maturity_index: round2(maturityIndex),
    temperature_c: temp,
    concrete_class: params.concrete_class,
    cement_type: cement,
    element_type: element,
    warning,
  };
}

/**
 * Estimate strength achieved as % of f_ck using Plowman's log-maturity relation
 *
 * f(M) = a + b × ln(M)
 *
 * Coefficients calibrated to typical OPC concrete:
 *   - At M ≈ 500 °C·h  → ~30% f_ck
 *   - At M ≈ 1500 °C·h → ~70% f_ck
 *   - At M ≈ 4000 °C·h → ~100% f_ck
 */
function estimateStrengthPct(
  maturityIndex: number,
  _concreteClass: ConcreteClass,
  cementType: CementType,
): number {
  if (maturityIndex <= 0) return 0;

  // Plowman coefficients (for CEM I)
  const a = -58;
  const b = 19;

  let pct = a + b * Math.log(maturityIndex);

  // Adjust for cement type
  pct *= CEMENT_SPEED[cementType];

  return Math.max(0, Math.min(100, pct));
}

/**
 * Convert legacy strip_wait_hours to maturity-based curing hours
 *
 * Drop-in replacement for fixed strip_wait_hours in FormworkCalculatorParams.
 * Returns the temperature- and class-adjusted value.
 */
export function getStripWaitHours(
  concrete_class: ConcreteClass,
  temperature_c: number,
  element_type: ElementType = 'slab',
  cement_type: CementType = 'CEM_I',
): number {
  const result = calculateCuring({
    concrete_class,
    temperature_c,
    cement_type,
    element_type,
  });
  return result.min_curing_hours;
}

/**
 * Calculate Nurse-Saul maturity index from temperature history
 *
 * M = Σ (T_i - T_datum) × Δt_i
 *
 * @param readings - Array of { temp_c, hours } intervals
 * @returns Maturity index in °C·hours
 */
export function calculateMaturityIndex(
  readings: { temp_c: number; hours: number }[],
): number {
  let M = 0;
  for (const r of readings) {
    const effectiveTemp = Math.max(r.temp_c - T_DATUM, 0); // No negative contribution
    M += effectiveTemp * r.hours;
  }
  return round2(M);
}

/**
 * Estimate curing days for a monthly temperature profile
 *
 * Useful for PERT integration: given month → average temperature → curing days
 * Returns optimistic (warm month), most_likely (planned month), pessimistic (cold month)
 */
export function curingThreePoint(
  concrete_class: ConcreteClass,
  element_type: ElementType,
  month_avg_temp_c: number,
  cement_type: CementType = 'CEM_I',
): { optimistic_hours: number; most_likely_hours: number; pessimistic_hours: number } {
  // Most likely: use the given average temperature
  const ml = getStripWaitHours(concrete_class, month_avg_temp_c, element_type, cement_type);

  // Optimistic: +5°C warmer (good weather spell)
  const opt = getStripWaitHours(concrete_class, month_avg_temp_c + 5, element_type, cement_type);

  // Pessimistic: -8°C colder (cold spell, rain)
  const pes = getStripWaitHours(concrete_class, month_avg_temp_c - 8, element_type, cement_type);

  return {
    optimistic_hours: opt,
    most_likely_hours: ml,
    pessimistic_hours: pes,
  };
}

// ─── Monthly Average Temperatures (Czech Republic) ──────────────────────────

/**
 * Typical average monthly temperatures for Czech Republic (Prague)
 * Used as defaults when no site-specific data is available
 */
export const CZ_MONTHLY_TEMPS: Record<number, number> = {
  1: -1,   // January
  2: 1,    // February
  3: 5,    // March
  4: 10,   // April
  5: 15,   // May
  6: 18,   // June
  7: 20,   // July
  8: 19,   // August
  9: 15,   // September
  10: 10,  // October
  11: 4,   // November
  12: 0,   // December
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
