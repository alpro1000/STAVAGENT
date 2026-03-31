/**
 * Lateral Pressure Calculator & Formwork Auto-Filter
 *
 * Calculates fresh concrete lateral pressure on formwork (ČSN EN 12812)
 * and filters the formwork catalog to systems that can withstand it.
 *
 * Also suggests záběrová betonáž (pour stages by height) when full-height
 * pouring would exceed all available systems' pressure limits.
 *
 * Formulas:
 *   p = ρ × g × h × k   (kN/m²)
 *
 *   ρ = 2400 kg/m³ (reinforced concrete density)
 *   g = 9.81 m/s²
 *   h = pour height per stage (m) — NOT total element height if staged
 *   k = pour rate coefficient:
 *       1.0  at ≤ 1 m/h  (gravity, crane bucket)
 *       1.2  at 1–2 m/h  (slow pump, controlled pour)
 *       1.5  at > 2 m/h  (fast pump)
 *
 * Reference: ČSN EN 12812 (Falsework), DIN 18218 (concrete pressure on formwork)
 */

import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Reinforced concrete density (kg/m³) */
const RHO = 2400;
/** Gravitational acceleration (m/s²) */
const G = 9.81;

// ─── Types ──────────────────────────────────────────────────────────────────

/** How concrete is delivered — determines pour rate coefficient k */
export type PourMethod = 'pump' | 'crane_bucket' | 'direct' | 'chute';

/** Result of lateral pressure calculation */
export interface LateralPressureResult {
  /** Calculated lateral pressure (kN/m²) */
  pressure_kn_m2: number;
  /** Pour height used for calculation (m) */
  pour_height_m: number;
  /** Pour rate coefficient used */
  k: number;
  /** Pour method */
  pour_method: PourMethod;
  /** Human-readable formula trace */
  formula: string;
}

/** Result of formwork filtering by pressure */
export interface FormworkFilterResult {
  /** Systems that can withstand the calculated pressure, sorted by rental price (cheapest first) */
  suitable: FormworkSystemSpec[];
  /** Systems that CANNOT withstand the pressure (for info/warnings) */
  rejected: FormworkSystemSpec[];
  /** The calculated pressure they were filtered against */
  pressure_kn_m2: number;
  /** Whether any system with defined pressure can handle it */
  has_suitable: boolean;
}

/** Suggested pour stages when full-height pour exceeds system limits */
export interface PourStagesSuggestion {
  /** Whether staging is needed (pressure exceeds all systems) */
  needs_staging: boolean;
  /** Number of stages (záběry). 1 = no staging needed */
  num_stages: number;
  /** Height per stage (m) */
  stage_height_m: number;
  /** Pressure per stage (kN/m²) — should fit available systems */
  stage_pressure_kn_m2: number;
  /** Max system pressure available (kN/m²) */
  max_system_pressure_kn_m2: number;
  /** Curing pause between stages (hours) — min 12h for vertical elements */
  cure_between_stages_h: number;
  /** Decision log entries */
  decision_log: string[];
}

// ─── Pour rate coefficient ──────────────────────────────────────────────────

/**
 * Get pour rate coefficient k based on delivery method.
 *
 * - pump:         k = 1.5 (fast rise, > 2 m/h)
 * - crane_bucket: k = 1.0 (slow, ≤ 1 m/h)
 * - direct:       k = 1.0 (gravity feed, ≤ 1 m/h)
 * - chute:        k = 1.2 (moderate, 1–2 m/h)
 */
export function getPourRateCoefficient(method: PourMethod): number {
  switch (method) {
    case 'pump':         return 1.5;
    case 'chute':        return 1.2;
    case 'crane_bucket': return 1.0;
    case 'direct':       return 1.0;
    default:             return 1.0;
  }
}

// ─── Core calculation ───────────────────────────────────────────────────────

/**
 * Calculate lateral pressure of fresh concrete on formwork.
 *
 * p = ρ × g × h × k  (kN/m²)
 *
 * @param height_m - Pour height (m). For staged pours, this is per-stage height.
 * @param pour_method - Delivery method (determines k coefficient)
 * @returns Pressure result with formula trace
 */
export function calculateLateralPressure(
  height_m: number,
  pour_method: PourMethod = 'pump',
): LateralPressureResult {
  if (height_m <= 0) {
    return { pressure_kn_m2: 0, pour_height_m: 0, k: 1.0, pour_method, formula: 'h=0 → p=0' };
  }

  const k = getPourRateCoefficient(pour_method);
  // p = ρ × g × h × k / 1000  (convert Pa → kN/m²)
  const pressure = (RHO * G * height_m * k) / 1000;
  const rounded = Math.round(pressure * 10) / 10;

  return {
    pressure_kn_m2: rounded,
    pour_height_m: height_m,
    k,
    pour_method,
    formula: `p = ${RHO} × ${G} × ${height_m} × ${k} / 1000 = ${rounded} kN/m²`,
  };
}

// ─── Formwork filtering ─────────────────────────────────────────────────────

/**
 * Filter formwork systems by pressure capacity.
 *
 * Systems without pressure_kn_m2 (e.g. tradiční tesařské) are always included
 * as they have no defined pressure limit (unlimited with proper bracing).
 *
 * Slab-category systems are excluded for vertical elements (they don't resist lateral pressure).
 *
 * @param pressure_kn_m2 - Required pressure resistance
 * @param systems - Formwork systems to filter (defaults to full catalog)
 * @param orientation - Element orientation ('vertical' | 'horizontal')
 * @returns Filtered result sorted by rental price (cheapest first)
 */
export function filterFormworkByPressure(
  pressure_kn_m2: number,
  systems: FormworkSystemSpec[],
  orientation: 'vertical' | 'horizontal' = 'vertical',
): FormworkFilterResult {
  const suitable: FormworkSystemSpec[] = [];
  const rejected: FormworkSystemSpec[] = [];

  for (const sys of systems) {
    // Skip slab systems for vertical elements (they resist gravity load, not lateral pressure)
    if (orientation === 'vertical' && sys.formwork_category === 'slab') {
      rejected.push(sys);
      continue;
    }

    // Systems without defined pressure → unlimited (tradiční, special)
    if (sys.pressure_kn_m2 == null) {
      suitable.push(sys);
      continue;
    }

    if (sys.pressure_kn_m2 >= pressure_kn_m2) {
      suitable.push(sys);
    } else {
      rejected.push(sys);
    }
  }

  // Sort suitable by rental price (cheapest first), 0-price (tradiční) at end
  suitable.sort((a, b) => {
    // Systems with 0 rental (purchase-based, e.g. tradiční) go last
    if (a.rental_czk_m2_month === 0 && b.rental_czk_m2_month > 0) return 1;
    if (b.rental_czk_m2_month === 0 && a.rental_czk_m2_month > 0) return -1;
    return a.rental_czk_m2_month - b.rental_czk_m2_month;
  });

  return {
    suitable,
    rejected,
    pressure_kn_m2,
    has_suitable: suitable.length > 0,
  };
}

// ─── Max system height parsing ──────────────────────────────────────────────

/**
 * Parse max formwork height from the `heights` array.
 *
 * Examples:
 *   ['2.70', '3.30', '5.40']  → 5.4
 *   ['do 6.00']               → 6.0
 *   ['do 5.50']               → 5.5
 *   ['libovolná']             → Infinity
 *   ['3.00', '6.00', '9.00', '12.00'] → 12.0
 */
export function parseMaxHeight(heights: string[]): number {
  let max = 0;
  for (const h of heights) {
    const trimmed = h.trim().toLowerCase();
    if (trimmed === 'libovolná' || trimmed === 'libovolna') return Infinity;
    // Handle "do X.XX" format
    const doMatch = trimmed.match(/^do\s+([\d.]+)/);
    if (doMatch) {
      max = Math.max(max, parseFloat(doMatch[1]));
      continue;
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      max = Math.max(max, num);
    }
  }
  return max || Infinity; // If no parseable heights, assume unlimited
}

// ─── Pour stages suggestion ─────────────────────────────────────────────────

/**
 * Suggest pour stages (záběry) when full-height pouring exceeds system limits.
 *
 * Logic:
 * 1. Calculate pressure at full height
 * 2. Find max pressure among all available systems
 * 3. If full-height pressure ≤ max system pressure → no staging needed
 * 4. Otherwise: calculate max stage height that fits best system,
 *    then num_stages = ceil(total_height / max_stage_height)
 *
 * @param total_height_m - Total element height
 * @param pour_method - Concrete delivery method
 * @param available_systems - Systems to consider (pre-filtered by category)
 * @returns Staging suggestion
 */
export function suggestPourStages(
  total_height_m: number,
  pour_method: PourMethod = 'pump',
  available_systems: FormworkSystemSpec[],
): PourStagesSuggestion {
  const log: string[] = [];
  const k = getPourRateCoefficient(pour_method);

  // Find max pressure capacity among all systems
  const pressures = available_systems
    .map(s => s.pressure_kn_m2)
    .filter((p): p is number => p != null && p > 0);

  const maxSystemPressure = pressures.length > 0 ? Math.max(...pressures) : 80; // fallback 80 kN/m²
  log.push(`Max system pressure: ${maxSystemPressure} kN/m² (from ${pressures.length} systems)`);

  // Full-height pressure
  const fullPressure = calculateLateralPressure(total_height_m, pour_method);
  log.push(`Full height ${total_height_m}m: ${fullPressure.pressure_kn_m2} kN/m² (k=${k})`);

  if (fullPressure.pressure_kn_m2 <= maxSystemPressure) {
    log.push(`No staging needed: ${fullPressure.pressure_kn_m2} ≤ ${maxSystemPressure} kN/m²`);
    return {
      needs_staging: false,
      num_stages: 1,
      stage_height_m: total_height_m,
      stage_pressure_kn_m2: fullPressure.pressure_kn_m2,
      max_system_pressure_kn_m2: maxSystemPressure,
      cure_between_stages_h: 0,
      decision_log: log,
    };
  }

  // Calculate max stage height: h_max = P_max / (ρ × g × k / 1000)
  const hMax = (maxSystemPressure * 1000) / (RHO * G * k);
  const hMaxRounded = Math.floor(hMax * 10) / 10; // Round down for safety
  log.push(`Max stage height: ${hMaxRounded}m (for ${maxSystemPressure} kN/m², k=${k})`);

  // Number of stages
  const numStages = Math.ceil(total_height_m / hMaxRounded);
  // Equalize stage heights
  const stageHeight = Math.round((total_height_m / numStages) * 100) / 100;

  // Verify stage pressure
  const stagePressure = calculateLateralPressure(stageHeight, pour_method);
  log.push(`${numStages} stages × ${stageHeight}m = ${stagePressure.pressure_kn_m2} kN/m² per stage`);

  return {
    needs_staging: true,
    num_stages: numStages,
    stage_height_m: stageHeight,
    stage_pressure_kn_m2: stagePressure.pressure_kn_m2,
    max_system_pressure_kn_m2: maxSystemPressure,
    // Min 12h between vertical stages (concrete must self-support before next pour)
    cure_between_stages_h: 24,
    decision_log: log,
  };
}

/**
 * Infer pour method from element profile.
 *
 * Uses pump_typical flag and element height as heuristics.
 */
export function inferPourMethod(
  pump_typical: boolean,
  height_m?: number,
): PourMethod {
  if (height_m != null && height_m > 3) return 'pump';
  if (pump_typical) return 'pump';
  if (height_m != null && height_m <= 1) return 'direct';
  return 'crane_bucket';
}
