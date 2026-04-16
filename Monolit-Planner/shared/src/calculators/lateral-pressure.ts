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

/** How concrete is delivered — used as legacy fallback for k coefficient */
export type PourMethod = 'pump' | 'crane_bucket' | 'direct' | 'chute';

/**
 * Concrete consistency class — primary driver of lateral pressure k coefficient.
 *
 * Per DIN 18218 / ČSN EN 12812:
 *   - 'standard' (S1–S2, slow rise ≤1 m/h) → k = 0.85   ← DEFAULT
 *   - 'plastic'  (S3–S4, controlled pump)  → k = 1.00
 *   - 'scc'      (samozhutnitelný / SCC)   → k = 1.50
 *
 * Use 'scc' ONLY for self-consolidating concrete. Standard is the safe default
 * for most construction work in CZ.
 */
export type ConcreteConsistency = 'standard' | 'plastic' | 'scc';

/** Map consistency → DIN 18218 k coefficient */
export function getConsistencyKFactor(consistency: ConcreteConsistency): number {
  switch (consistency) {
    case 'standard': return 0.85;
    case 'plastic':  return 1.00;
    case 'scc':      return 1.50;
    default:         return 0.85;
  }
}

/** Optional knobs for calculateLateralPressure */
export interface LateralPressureOptions {
  /**
   * Concrete consistency (DIN 18218). Takes precedence over pour_method.
   * Default: 'standard' (k=0.85).
   */
  concrete_consistency?: ConcreteConsistency;
  /** Explicit k-factor override (highest priority). Used for manual tuning. */
  k_factor?: number;
}

/** Result of lateral pressure calculation */
export interface LateralPressureResult {
  /** Calculated lateral pressure (kN/m²) */
  pressure_kn_m2: number;
  /** Pour height used for calculation (m) */
  pour_height_m: number;
  /** Pour rate coefficient used */
  k: number;
  /** Pour method (legacy field, may not match k when consistency is set) */
  pour_method: PourMethod;
  /** Concrete consistency used (only when explicitly provided) */
  concrete_consistency?: ConcreteConsistency;
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
 * Coefficient k resolution order (highest priority first):
 *   1. options.k_factor       (manual override)
 *   2. options.concrete_consistency (DIN 18218)
 *   3. pour_method            (legacy fallback)
 *
 * @param height_m - Pour height (m). For staged pours, this is per-stage height.
 * @param pour_method - Delivery method (legacy fallback for k coefficient)
 * @param options - Concrete consistency or explicit k override
 * @returns Pressure result with formula trace
 */
export function calculateLateralPressure(
  height_m: number,
  pour_method: PourMethod = 'pump',
  options?: LateralPressureOptions,
): LateralPressureResult {
  if (height_m <= 0) {
    return {
      pressure_kn_m2: 0, pour_height_m: 0, k: 1.0, pour_method,
      concrete_consistency: options?.concrete_consistency,
      formula: 'h=0 → p=0',
    };
  }

  // Resolve k factor: explicit override → consistency → method
  let k: number;
  let kSource: string;
  if (options?.k_factor != null) {
    k = options.k_factor;
    kSource = 'k_override';
  } else if (options?.concrete_consistency) {
    k = getConsistencyKFactor(options.concrete_consistency);
    kSource = `consistency=${options.concrete_consistency}`;
  } else {
    k = getPourRateCoefficient(pour_method);
    kSource = `method=${pour_method}`;
  }

  // p = ρ × g × h × k / 1000  (convert Pa → kN/m²)
  const pressure = (RHO * G * height_m * k) / 1000;
  const rounded = Math.round(pressure * 10) / 10;

  return {
    pressure_kn_m2: rounded,
    pour_height_m: height_m,
    k,
    pour_method,
    concrete_consistency: options?.concrete_consistency,
    formula: `p = ${RHO} × ${G} × ${height_m} × ${k} / 1000 = ${rounded} kN/m² (${kSource})`,
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
/**
 * Compute number of záběry (stages) a system needs to handle pour_height_m
 * given the pressure constraint.
 *
 * - Systems without pressure limit → 1 stage
 * - Systems with limit ≥ pressure → 1 stage (no staging needed for pressure)
 *   but may still be limited by catalog max_pour_height_m
 * - Systems below limit → effectiveMaxH = sys.pressure/pressure × height,
 *   capped at catalog max_pour_height_m
 */
function computeStageCount(
  sys: FormworkSystemSpec,
  required_pressure: number,
  pour_height_m?: number,
): number {
  if (!pour_height_m || pour_height_m <= 0) return 1;

  const catalogMaxH = sys.max_pour_height_m ?? Infinity;

  // No pressure limit on the system
  if (sys.pressure_kn_m2 == null) {
    if (catalogMaxH >= pour_height_m) return 1;
    return Math.max(1, Math.ceil(pour_height_m / catalogMaxH));
  }

  // Pressure-derived max stage height
  const pressureMaxH = (sys.pressure_kn_m2 / Math.max(1e-6, required_pressure)) * pour_height_m;
  const effectiveMaxH = Math.min(pressureMaxH, catalogMaxH);

  if (effectiveMaxH >= pour_height_m) return 1;
  if (effectiveMaxH <= 0) return Infinity;
  return Math.max(1, Math.ceil(pour_height_m / effectiveMaxH));
}

/**
 * Stage count penalty multiplier (BUG-5).
 * Pure cost favors many small záběry; this penalty pushes the algorithm
 * toward systems that need fewer záběry.
 *
 * 1 zabér  = 1.0     (ideal)
 * 2 záběry = 1.0     (still acceptable)
 * 3 záběry = 1.1
 * 4–5      = 1.3
 * 6+       = 1.5
 */
export function getStageCountPenalty(stageCount: number): number {
  if (stageCount <= 2) return 1.0;
  if (stageCount === 3) return 1.1;
  if (stageCount <= 5) return 1.3;
  return 1.5;
}

export function filterFormworkByPressure(
  pressure_kn_m2: number,
  systems: FormworkSystemSpec[],
  orientation: 'vertical' | 'horizontal' = 'vertical',
  pour_height_m?: number,
): FormworkFilterResult {
  const suitable: FormworkSystemSpec[] = [];
  const rejected: FormworkSystemSpec[] = [];

  for (const sys of systems) {
    // Horizontal elements (slab, deck, foundation slab): lateral pressure is irrelevant —
    // concrete sits ON the formwork, doesn't push AGAINST it. All compatible systems pass.
    if (orientation === 'horizontal') {
      suitable.push(sys);
      continue;
    }

    // Skip slab systems for vertical elements (they resist gravity load, not lateral pressure)
    if (sys.formwork_category === 'slab') {
      rejected.push(sys);
      continue;
    }

    // Systems without defined pressure → unlimited (tradiční, special)
    if (sys.pressure_kn_m2 == null) {
      suitable.push(sys);
      continue;
    }

    // Check pressure capacity — with per-záběr staging for tall elements.
    // Formwork handles one záběr at a time, not the full element height.
    if (sys.pressure_kn_m2 < pressure_kn_m2) {
      // Full-height pressure exceeds system. Can staging save it?
      if (pour_height_m && pour_height_m > 0) {
        // Max stage height this system can handle at current pour rate:
        // sys_max_h = sys.pressure / pressure * total_height
        const sysMaxStageH = (sys.pressure_kn_m2 / pressure_kn_m2) * pour_height_m;
        const catalogMaxH = sys.max_pour_height_m ?? Infinity;
        const effectiveMaxH = Math.min(sysMaxStageH, catalogMaxH);

        if (effectiveMaxH >= 1.5) {
          // System works with záběrová betonáž (min 1.5m per stage is practical)
          suitable.push(sys);
          continue;
        }
      }
      rejected.push(sys);
      continue;
    }

    suitable.push(sys);
  }

  // BUG-5: Sort by score = rental × stage_count_penalty.
  // This balances pure cost against practicality (fewer záběry = less work).
  // Systems with 0 rental (tradiční) go last regardless of penalty.
  suitable.sort((a, b) => {
    const aZero = a.rental_czk_m2_month === 0;
    const bZero = b.rental_czk_m2_month === 0;
    if (aZero && !bZero) return 1;
    if (bZero && !aZero) return -1;

    const aStages = computeStageCount(a, pressure_kn_m2, pour_height_m);
    const bStages = computeStageCount(b, pressure_kn_m2, pour_height_m);
    const aScore = a.rental_czk_m2_month * getStageCountPenalty(aStages);
    const bScore = b.rental_czk_m2_month * getStageCountPenalty(bStages);
    if (aScore !== bScore) return aScore - bScore;
    // Tiebreaker: fewer stages wins
    return aStages - bStages;
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
  options?: LateralPressureOptions,
): PourStagesSuggestion {
  const log: string[] = [];
  // Resolve k factor identical to calculateLateralPressure
  let k: number;
  if (options?.k_factor != null) {
    k = options.k_factor;
  } else if (options?.concrete_consistency) {
    k = getConsistencyKFactor(options.concrete_consistency);
  } else {
    k = getPourRateCoefficient(pour_method);
  }

  // BUG 6: Column formwork (SL-1, QUATTRO) — columns h≤8m are traditionally
  // poured in a single lift (small cross-section, fast set, no staging needed).
  const hasColumnFormwork = available_systems.some(s => s.formwork_category === 'column');
  if (hasColumnFormwork && total_height_m <= 8) {
    log.push(`Column formwork present + h=${total_height_m}m ≤ 8m → 1 záběr (column exemption)`);
    const fullPressure = calculateLateralPressure(total_height_m, pour_method, options);
    const maxP = available_systems
      .map(s => s.pressure_kn_m2).filter((p): p is number => p != null && p > 0);
    return {
      needs_staging: false,
      num_stages: 1,
      stage_height_m: total_height_m,
      stage_pressure_kn_m2: fullPressure.pressure_kn_m2,
      max_system_pressure_kn_m2: maxP.length > 0 ? Math.max(...maxP) : 80,
      cure_between_stages_h: 0,
      decision_log: log,
    };
  }

  // Find max pressure capacity among all systems
  const pressures = available_systems
    .map(s => s.pressure_kn_m2)
    .filter((p): p is number => p != null && p > 0);

  const maxSystemPressure = pressures.length > 0 ? Math.max(...pressures) : 80; // fallback 80 kN/m²
  log.push(`Max system pressure: ${maxSystemPressure} kN/m² (from ${pressures.length} systems)`);

  // Full-height pressure
  const fullPressure = calculateLateralPressure(total_height_m, pour_method, options);
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
  // Guard k>0 to avoid div-by-zero
  const safeK = k > 0 ? k : 0.85;
  const hMax = (maxSystemPressure * 1000) / (RHO * G * safeK);
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
