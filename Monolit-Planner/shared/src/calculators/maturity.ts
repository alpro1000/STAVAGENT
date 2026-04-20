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

import type { StructuralElementType } from './pour-decision.js';

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

/** Curing class per ČSN EN 13670 / TKP18 §7.8.3 */
export type CuringClass = 2 | 3 | 4;

/** Parameters for curing time calculation */
export interface CuringParams {
  concrete_class: ConcreteClass;
  temperature_c: number;        // Average ambient temperature (°C)
  cement_type?: CementType;     // Default: CEM_I
  element_type?: ElementType;   // Default: slab (conservative)
  strip_strength_pct?: number;  // Override: required strength % at stripping
  /**
   * Curing class per TKP18 §7.8.3 Table NA.2.
   *   2 = foundations, lean concrete, transition slabs (standard)
   *   3 = substructure (abutments, piers, pier foundations, bearing blocks)
   *   4 = superstructure (deck, cornices) — most demanding
   * When not set, defaults to class 2 (backward-compatible).
   */
  curing_class?: CuringClass;
  /**
   * BUG-Z2 (2026-04-15): exposure class (XF1/XF3/XF4, XC4, XD3…).
   * TKP18 §7.8.3 mandates minimum curing days independent of maturity:
   *   XF1 → min 5 dní, XF3/XF4 → min 7 dní (freeze-thaw cycles).
   * When given, min_curing_days = max(maturity_result, TKP18_minimum).
   * Legacy single-string API — prefer `exposure_classes`.
   */
  exposure_class?: string;
  /**
   * Task 2 (2026-04-20): full multi-class selection per ČSN EN 206+A2.
   * Concrete is typically exposed to multiple actions simultaneously
   * (XF2 + XD1 + XC4 for a bridge deck). `getExposureMinCuringDays` picks
   * the strictest across the array.
   */
  exposure_classes?: string[];
}

/**
 * BUG-Z2 (2026-04-15): TKP18 §7.8.3 minimum curing days by exposure class.
 * These are HARD minima independent of concrete class, temperature, or cement.
 * Freeze-thaw exposure needs time for surface layer to reach freeze-resistance.
 */
const EXPOSURE_MIN_CURING_DAYS: Record<string, number> = {
  // XF — freeze-thaw (most restrictive)
  XF1: 5,   // moderate saturation, no de-icing
  XF2: 5,   // moderate saturation + de-icing
  XF3: 7,   // high saturation, no de-icing
  XF4: 7,   // high saturation + de-icing (bridge decks, curbs)
  // XD — chlorides non-marine
  XD2: 5,
  XD3: 7,
  // XS — chlorides marine
  XS2: 5,
  XS3: 7,
  // XA — chemical attack
  XA2: 5,
  XA3: 7,
};

/** Return the TKP18 minimum curing days for a given exposure class (0 if none).
 *  Task 2 (2026-04-20): accepts an array — picks the max across all classes
 *  so a bridge deck (XF2+XD1+XC4) correctly uses 5d (XF2 max) not 0d
 *  (XC4 alone). Kept backward-compatible with single-string input. */
export function getExposureMinCuringDays(
  exposure: string | string[] | undefined,
): number {
  if (!exposure) return 0;
  const arr = Array.isArray(exposure) ? exposure : [exposure];
  let max = 0;
  for (const c of arr) {
    if (!c) continue;
    const v = EXPOSURE_MIN_CURING_DAYS[c.toUpperCase()] ?? 0;
    if (v > max) max = v;
  }
  return max;
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
  curing_class: CuringClass;      // Which curing class was used
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
 * Minimum curing days by temperature range, concrete class, and curing class.
 * Per ČSN EN 13670, Table NA.2 + TKP18 §7.8.3 (bridge classes 3/4).
 *
 * Curing classes (TKP18):
 *   class_2: standard (foundations, lean concrete, building elements)
 *   class_3: substructure (abutments, piers, pier foundations)
 *   class_4: superstructure (bridge deck, cornices) — most demanding
 *
 * Values are for CEM I, horizontal elements (slab/beam).
 * Vertical elements (wall/column) get ×0.7 adjustment.
 */
const CURING_DAYS_TABLE: {
  temp_min: number;
  temp_max: number;
  days: Record<string, Record<CuringClass, number>>; // class group → curing class → days
}[] = [
  // t < 5°C — very slow hydration
  { temp_min: -5, temp_max: 5, days: {
    'C12-C16': { 2: 7,  3: 12, 4: 22 },
    'C20-C25': { 2: 5,  3: 9,  4: 18 },
    'C30+':    { 2: 4,  3: 7,  4: 14 },
  }},
  // 5°C ≤ t < 10°C
  { temp_min: 5, temp_max: 10, days: {
    'C12-C16': { 2: 5,  3: 9,  4: 18 },
    'C20-C25': { 2: 4,  3: 7,  4: 13 },
    'C30+':    { 2: 3,  3: 5,  4: 9 },
  }},
  // 10°C ≤ t < 15°C
  { temp_min: 10, temp_max: 15, days: {
    'C12-C16': { 2: 4,  3: 7,  4: 13 },
    'C20-C25': { 2: 3,  3: 5,  4: 9 },
    'C30+':    { 2: 2,  3: 4,  4: 7 },
  }},
  // 15°C ≤ t < 25°C — optimal range
  { temp_min: 15, temp_max: 25, days: {
    'C12-C16': { 2: 3,   3: 5,   4: 10 },
    'C20-C25': { 2: 2,   3: 4,   4: 9 },
    'C30+':    { 2: 1.5, 3: 2.5, 4: 5 },
  }},
  // t ≥ 25°C — fast but need wet curing!
  { temp_min: 25, temp_max: 50, days: {
    'C12-C16': { 2: 2,   3: 3.5, 4: 7 },
    'C20-C25': { 2: 1.5, 3: 2.5, 4: 5 },
    'C30+':    { 2: 1,   3: 1.5, 4: 3 },
  }},
];

/** TKP18 absolute minimum curing for any bridge element (PK). */
const TKP18_ABSOLUTE_MIN_DAYS = 5;

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
      curing_class: params.curing_class ?? 2,
      warning: 'Temperature below -10°C: concrete must not be placed (ČSN EN 13670)',
    };
  }

  const group = classGroup(params.concrete_class);
  const stripPct = params.strip_strength_pct ?? STRIP_STRENGTH_PCT[element];
  const curingClass: CuringClass = params.curing_class ?? 2;

  // Find temperature row
  let baseDays: number;
  if (temp < -5) {
    // Below table range — extrapolate conservatively
    baseDays = curingClass === 4 ? 30 : curingClass === 3 ? 18 : 10;
  } else {
    const row = CURING_DAYS_TABLE.find(r => temp >= r.temp_min && temp < r.temp_max);
    const classRow = row ? row.days[group] : CURING_DAYS_TABLE[CURING_DAYS_TABLE.length - 1].days[group];
    baseDays = classRow[curingClass];
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
  let minDays = Math.ceil(adjustedDays * 2) / 2;

  // BUG-Z2 (2026-04-15): enforce TKP18 §7.8.3 exposure-class minimum.
  // Example: XF3 patka zima → maturity says 1.5d, TKP18 says ≥7d → 7d wins.
  // Task 2 (2026-04-20): array-aware — strictest across selected classes.
  const exposureMin = getExposureMinCuringDays(
    params.exposure_classes ?? params.exposure_class,
  );
  if (exposureMin > minDays) {
    minDays = exposureMin;
  }

  // TKP18 absolute minimum for PK (pozemní komunikace) bridge elements: 5 dní.
  // For curing class 3/4 this is always exceeded, but class 2 at warm temps could go below.
  if (curingClass >= 3 && minDays < TKP18_ABSOLUTE_MIN_DAYS) {
    minDays = TKP18_ABSOLUTE_MIN_DAYS;
  }

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
    curing_class: curingClass,
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

// ─── Construction Type Mapping ──────────────────────────────────────────────

/**
 * Construction type as used in formwork-assistant (bridge/building elements)
 * Maps to ElementType + orientation for the curing calculation.
 */
export type ConstructionType =
  | 'zakladove_pasy'   // Foundation strips / piles
  | 'steny'            // Walls / abutments
  | 'pilire_mostu'     // Bridge piers
  | 'sloupy'           // Columns
  | 'mostovka'         // Bridge deck / floor slab
  | 'rimsy'            // Cornices / cantilevers
  | 'stropni_deska'    // Floor slab (building)
  | 'pruvlak'          // Beam / girder (building)
  | 'schodiste';       // Staircase

/** Season (temperature range) — maps to average temperature */
export type Season = 'leto' | 'podzim_jaro' | 'zima';

/** Average temperature for each season (°C) */
export const SEASON_TEMPERATURES: Record<Season, number> = {
  leto: 20,          // >15°C — summer
  podzim_jaro: 10,   // 5–15°C — spring/autumn
  zima: 2,           // <5°C — winter
};

/** Map construction type → ElementType */
const CONSTRUCTION_TO_ELEMENT: Record<ConstructionType, ElementType> = {
  zakladove_pasy: 'wall',    // Foundation = massive, similar to wall
  steny:         'wall',
  pilire_mostu:  'column',
  sloupy:        'column',
  mostovka:      'slab',     // Horizontal, heavily loaded
  rimsy:         'beam',     // Cantilever, horizontal
  stropni_deska: 'slab',    // Floor slab = horizontal
  pruvlak:       'beam',    // Beam = horizontal
  schodiste:     'slab',    // Staircase = sloped horizontal
};

/** Orientation — affects whether props are needed */
export const CONSTRUCTION_ORIENTATION: Record<ConstructionType, 'vertical' | 'horizontal'> = {
  zakladove_pasy: 'vertical',
  steny:          'vertical',
  pilire_mostu:   'vertical',
  sloupy:         'vertical',
  mostovka:       'horizontal',
  rimsy:          'horizontal',
  stropni_deska:  'horizontal',
  pruvlak:        'horizontal',
  schodiste:      'horizontal',
};

/**
 * Minimum prop retention days for horizontal elements (ČSN EN 13670 + TKP17)
 *
 * Props must remain under horizontal structures much longer than side formwork
 * because the element must carry its own weight + live loads.
 * Side formwork can be stripped when concrete reaches 50–70% f_ck,
 * but props stay until concrete reaches near-full design strength.
 */
export const PROPS_MIN_DAYS: Partial<Record<ConstructionType, Record<Season, number>>> = {
  mostovka:      { leto: 14, podzim_jaro: 21, zima: 28 },  // ČSN 73 6244 + TKP17
  rimsy:         { leto: 7,  podzim_jaro: 10, zima: 14 },
  stropni_deska: { leto: 7,  podzim_jaro: 14, zima: 21 },  // ČSN EN 13670, běžný strop
  pruvlak:       { leto: 10, podzim_jaro: 14, zima: 21 },  // průvlaky = vyšší zatížení
  schodiste:     { leto: 7,  podzim_jaro: 14, zima: 21 },  // schodiště = šikmý strop
};

/** Labels for construction types (Czech) */
export const CONSTRUCTION_LABELS: Record<ConstructionType, string> = {
  zakladove_pasy: 'Základové pásy / piloty',
  pilire_mostu:   'Pilíře mostu',
  mostovka:       'Mostovka / deska',
  steny:          'Stěny / opěry',
  sloupy:         'Sloupy',
  rimsy:          'Římsy / konzoly',
  stropni_deska:  'Stropní / podlahová deska',
  pruvlak:        'Průvlak / trám',
  schodiste:      'Schodiště',
};

/** Labels for seasons (Czech) */
export const SEASON_LABELS: Record<Season, string> = {
  leto:        'léto (>15 °C)',
  podzim_jaro: 'podzim/jaro (5–15 °C)',
  zima:        'zima (<5 °C)',
};

/**
 * High-level curing calculation for a construction type + season.
 *
 * This is the **single entry point** for all curing calculations.
 * It maps construction_type → ElementType and season → temperature,
 * then delegates to calculateCuring().
 *
 * Returns:
 *   - min_curing_days: When side formwork can be stripped
 *   - props_min_days: When props can be removed (horizontal only, 0 for vertical)
 *
 * @example
 * const result = calculateConstructionCuring({
 *   construction_type: 'mostovka',
 *   season: 'podzim_jaro',
 *   concrete_class: 'C30/37',
 *   cement_type: 'CEM_I',
 * });
 * // result.curing.min_curing_days = 3
 * // result.props_min_days = 21
 */
export function calculateConstructionCuring(params: {
  construction_type: ConstructionType;
  season: Season;
  concrete_class?: ConcreteClass;
  cement_type?: CementType;
}): {
  curing: CuringResult;
  props_min_days: number;
  orientation: 'vertical' | 'horizontal';
} {
  const elementType = CONSTRUCTION_TO_ELEMENT[params.construction_type];
  const temperature = SEASON_TEMPERATURES[params.season];
  const concreteClass = params.concrete_class || 'C30/37';
  const cementType = params.cement_type || 'CEM_I';

  const curing = calculateCuring({
    concrete_class: concreteClass,
    temperature_c: temperature,
    cement_type: cementType,
    element_type: elementType,
  });

  // Props retention for horizontal elements
  const propsRow = PROPS_MIN_DAYS[params.construction_type];
  const propsMinDays = propsRow ? (propsRow[params.season] || 0) : 0;

  return {
    curing,
    props_min_days: propsMinDays,
    orientation: CONSTRUCTION_ORIENTATION[params.construction_type],
  };
}

// ─── Default curing class per element type ──────────────────────────────────

/**
 * Default curing class per element type (TKP18 §7.8.3).
 *
 *   4 = superstructure (mostovka, římsa) — highest demands
 *   3 = substructure (opěry, pilíře, základy pilířů, křídla, závěrné zídky, podložiskový blok)
 *   2 = foundations, lean concrete, building elements, transition slabs
 */
export const DEFAULT_CURING_CLASS: Partial<Record<StructuralElementType, CuringClass>> = {
  // Class 4 — superstructure (NK)
  mostovkova_deska: 4,
  rimsa: 4,
  rigel: 4,
  // Class 3 — substructure
  opery_ulozne_prahy: 3,
  driky_piliru: 3,
  zaklady_piliru: 3,
  kridla_opery: 3,
  mostni_zavirne_zidky: 3,
  podlozkovy_blok: 3,
  operne_zdi: 3,
  // Class 2 — everything else (default)
  // pilota, podkladni_beton, prechodova_deska, building elements → 2
};

/** Get the default curing class for an element type. Returns 2 if not mapped. */
export function getDefaultCuringClass(elementType: StructuralElementType): CuringClass {
  return DEFAULT_CURING_CLASS[elementType] ?? 2;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
