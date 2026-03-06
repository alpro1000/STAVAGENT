/**
 * Planner Orchestrator v1.0
 *
 * Single entry point that combines ALL calculation engines into one unified cycle:
 *
 *   Input (element description + volumes + constraints)
 *       │
 *       ├─ 1. Element Classifier → element type, profile, recommendations
 *       ├─ 2. Pour Decision Tree → pour mode, tacts, scheduling mode
 *       ├─ 3. Formwork Engine    → assembly/disassembly days, 3-phase costs
 *       ├─ 4. Rebar Lite Engine  → mass estimation, duration, crew
 *       ├─ 5. Pour Task Engine   → pour duration, pump, bottleneck
 *       ├─ 6. Element Scheduler  → DAG, CPM, RCPSP, Gantt
 *       └─ 7. PERT + Monte Carlo → risk percentiles (optional)
 *       │
 *   Output (unified plan with schedule, costs, warnings, traceability)
 *
 * Design principle: orchestrator ONLY wires engines together.
 * No new formulas — all math lives in individual engines.
 */

import type { StructuralElementType, SeasonMode, PourDecisionOutput } from './pour-decision.js';
import type { ElementScheduleOutput } from './element-scheduler.js';
import type { RebarLiteResult } from './rebar-lite.js';
import type { PourTaskResult } from './pour-task-engine.js';
import type { ThreePhaseCostResult } from './formwork.js';
import type { MonteCarloResult } from './pert.js';
import type { ConcreteClass, CementType, ElementType } from './maturity.js';
import type { ElementProfile } from '../classifiers/element-classifier.js';
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';

import { classifyElement, getElementProfile, recommendFormwork, getAdjustedAssemblyNorm } from '../classifiers/element-classifier.js';
import { decidePourMode } from './pour-decision.js';
import { calculateFormwork, calculateThreePhaseFormwork, calculateStrategiesDetailed } from './formwork.js';
import { calculateRebarLite } from './rebar-lite.js';
import { calculatePourTask } from './pour-task-engine.js';
import { scheduleElement } from './element-scheduler.js';
import { findFormworkSystem } from '../constants-data/formwork-systems.js';

// ─── Input ──────────────────────────────────────────────────────────────────

export interface PlannerInput {
  // --- Element identification (one of two) ---
  /** Czech name/description for auto-classification */
  element_name?: string;
  /** Or explicit type (skips classification) */
  element_type?: StructuralElementType;

  // --- Volumes ---
  /** Total concrete volume (m³) */
  volume_m3: number;
  /** Formwork area per tact (m²). If not given, estimated as volume^(2/3) × 6 */
  formwork_area_m2?: number;

  // --- Rebar ---
  /** Exact rebar mass (kg). If not given, estimated from element type. */
  rebar_mass_kg?: number;

  // --- Pour constraints ---
  /** Does the element have dilatation joints? */
  has_dilatacni_spary: boolean;
  /** Joint spacing (m) — required if has_spary=true */
  spara_spacing_m?: number;
  /** Total element length (m) */
  total_length_m?: number;
  /** Adjacent sections? */
  adjacent_sections?: boolean;

  // --- Environment ---
  season?: SeasonMode;
  use_retarder?: boolean;

  // --- Maturity (optional, auto-calculates curing) ---
  concrete_class?: ConcreteClass;
  cement_type?: CementType;
  /** Average ambient temperature (°C). Default: 15 */
  temperature_c?: number;

  // --- Resources ---
  /** Formwork sets available. Default: 2 */
  num_sets?: number;
  /** Formwork crew count. Default: 1 */
  num_formwork_crews?: number;
  /** Rebar crew count. Default: 1 */
  num_rebar_crews?: number;
  /** Crew size (workers per crew). Default: 4 */
  crew_size?: number;
  /** Shift hours. Default: 10 */
  shift_h?: number;
  /** Time utilization factor. Default: 0.8 */
  k?: number;
  /** Wage CZK/h. Default: 398 */
  wage_czk_h?: number;

  // --- Formwork override ---
  /** Explicit formwork system name (overrides auto-recommendation) */
  formwork_system_name?: string;

  // --- Options ---
  /** Run Monte Carlo simulation. Default: false */
  enable_monte_carlo?: boolean;
  /** Monte Carlo iterations. Default: 10000 */
  monte_carlo_iterations?: number;
}

// ─── Output ─────────────────────────────────────────────────────────────────

export interface PlannerOutput {
  // --- Element ---
  element: {
    type: StructuralElementType;
    label_cs: string;
    classification_confidence: number;
    profile: ElementProfile;
  };

  // --- Pour decision ---
  pour_decision: PourDecisionOutput;

  // --- Formwork ---
  formwork: {
    system: FormworkSystemSpec;
    assembly_days: number;
    disassembly_days: number;
    curing_days: number;
    three_phase: ThreePhaseCostResult;
    strategies: ReturnType<typeof calculateStrategiesDetailed>;
  };

  // --- Rebar ---
  rebar: RebarLiteResult;

  // --- Pour ---
  pour: PourTaskResult;

  // --- Schedule ---
  schedule: ElementScheduleOutput;

  // --- Costs ---
  costs: {
    formwork_labor_czk: number;
    rebar_labor_czk: number;
    pour_labor_czk: number;
    total_labor_czk: number;
    /** Formwork rental (monthly rate × rental_days / 30). Only if system has rental. */
    formwork_rental_czk: number;
  };

  // --- Monte Carlo (optional) ---
  monte_carlo?: MonteCarloResult;

  // --- Warnings ---
  warnings: string[];

  // --- Traceability ---
  decision_log: string[];
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULTS = {
  num_sets: 2,
  num_formwork_crews: 1,
  num_rebar_crews: 1,
  crew_size: 4,
  shift_h: 10,
  k: 0.8,
  wage_czk_h: 398,
  temperature_c: 15,
  concrete_days: 1,
  monte_carlo_iterations: 10000,
} as const;

// ─── Main Orchestrator ──────────────────────────────────────────────────────

/**
 * Run the full planning cycle for a monolithic concrete element.
 *
 * @example
 * const plan = planElement({
 *   element_name: 'Opěrné zdi',
 *   volume_m3: 120,
 *   has_dilatacni_spary: true,
 *   spara_spacing_m: 10,
 *   total_length_m: 50,
 *   adjacent_sections: true,
 *   concrete_class: 'C30/37',
 *   temperature_c: 20,
 * });
 *
 * console.log(plan.schedule.total_days);      // 28
 * console.log(plan.schedule.gantt);           // ASCII Gantt chart
 * console.log(plan.costs.total_labor_czk);    // 385,000
 * console.log(plan.pour_decision.num_tacts);  // 5
 */
export function planElement(input: PlannerInput): PlannerOutput {
  const log: string[] = [];
  const warnings: string[] = [];

  // Unpack defaults
  const crew = input.crew_size ?? DEFAULTS.crew_size;
  const shift = input.shift_h ?? DEFAULTS.shift_h;
  const k = input.k ?? DEFAULTS.k;
  const wage = input.wage_czk_h ?? DEFAULTS.wage_czk_h;
  const numSets = input.num_sets ?? DEFAULTS.num_sets;
  const numFWCrews = input.num_formwork_crews ?? DEFAULTS.num_formwork_crews;
  const numRBCrews = input.num_rebar_crews ?? DEFAULTS.num_rebar_crews;
  const temperature = input.temperature_c ?? DEFAULTS.temperature_c;

  // ─── 1. Element Classification ──────────────────────────────────────────

  let profile: ElementProfile;
  if (input.element_type) {
    profile = getElementProfile(input.element_type);
    log.push(`Element: ${input.element_type} (explicit)`);
  } else if (input.element_name) {
    profile = classifyElement(input.element_name);
    log.push(`Element: "${input.element_name}" → ${profile.element_type} (confidence ${profile.confidence})`);
    if (profile.confidence < 0.6) {
      warnings.push(`Nízká jistota klasifikace: ${profile.element_type} (${(profile.confidence * 100).toFixed(0)}%). Zvažte ruční zadání.`);
    }
  } else {
    throw new Error('Either element_name or element_type must be provided');
  }

  const elementType = profile.element_type;

  // ─── 2. Formwork System Selection ───────────────────────────────────────

  let fwSystem: FormworkSystemSpec;
  if (input.formwork_system_name) {
    const found = findFormworkSystem(input.formwork_system_name);
    if (!found) {
      warnings.push(`Systém bednění "${input.formwork_system_name}" nenalezen — použit doporučený.`);
      fwSystem = recommendFormwork(elementType);
    } else {
      fwSystem = found;
    }
  } else {
    fwSystem = recommendFormwork(elementType);
  }

  const adjustedNorms = getAdjustedAssemblyNorm(elementType, fwSystem);
  log.push(`Formwork: ${fwSystem.name} (${adjustedNorms.assembly_h_m2} h/m², df=${adjustedNorms.difficulty_factor})`);

  // ─── 3. Pour Decision ──────────────────────────────────────────────────

  const pourDecision = decidePourMode({
    element_type: elementType,
    volume_m3: input.volume_m3,
    has_dilatacni_spary: input.has_dilatacni_spary,
    spara_spacing_m: input.spara_spacing_m,
    total_length_m: input.total_length_m,
    adjacent_sections: input.adjacent_sections,
    season: input.season,
    use_retarder: input.use_retarder,
  });

  log.push(`Pour: ${pourDecision.pour_mode}/${pourDecision.sub_mode}, ${pourDecision.num_tacts} tacts × ${pourDecision.tact_volume_m3}m³`);
  warnings.push(...pourDecision.warnings);

  // ─── 4. Formwork Calculation ────────────────────────────────────────────

  // Estimate formwork area if not given
  const fwArea = input.formwork_area_m2 ?? estimateFormworkArea(input.volume_m3, pourDecision.num_tacts);
  log.push(`Formwork area: ${fwArea} m² per tact${input.formwork_area_m2 ? '' : ' (estimated)'}`);

  // Maturity-based curing or default
  const maturityParams = input.concrete_class ? {
    concrete_class: input.concrete_class,
    temperature_c: temperature,
    cement_type: input.cement_type,
    element_type: mapElementType(profile),
  } : undefined;

  // Use formwork calculator for base durations
  const fwBase = calculateFormwork({
    area_m2: fwArea,
    norm_assembly_h_m2: adjustedNorms.assembly_h_m2,
    norm_disassembly_h_m2: adjustedNorms.disassembly_h_m2,
    crew_size: crew,
    shift_h: shift,
    k,
    wage_czk_h: wage,
    strip_wait_hours: maturityParams ? 0 : 24, // Will be overridden by scheduler if maturity given
    move_clean_hours: 2,
  });

  const assemblyDays = fwBase.assembly_days;
  const disassemblyDays = fwBase.disassembly_days;
  const curingDays = fwBase.wait_days;

  // 3-phase cost model
  const threePhase = calculateThreePhaseFormwork(
    fwArea,
    adjustedNorms.assembly_h_m2,
    adjustedNorms.disassembly_h_m2,
    crew, shift, k, wage,
    pourDecision.num_tacts,
  );

  // Strategy comparison
  const strategies = calculateStrategiesDetailed({
    assembly_days: assemblyDays,
    rebar_days: 0, // Will be filled after rebar calc
    concrete_days: DEFAULTS.concrete_days,
    curing_days: curingDays,
    disassembly_days: disassemblyDays,
    num_captures: pourDecision.num_tacts,
  });

  // ─── 5. Rebar Calculation ──────────────────────────────────────────────

  const rebarResult = calculateRebarLite({
    element_type: elementType,
    volume_m3: pourDecision.tact_volume_m3,
    mass_kg: input.rebar_mass_kg
      ? input.rebar_mass_kg / pourDecision.num_tacts // Distribute across tacts
      : undefined,
    crew_size: crew,
    shift_h: shift,
    k,
    wage_czk_h: wage,
  });

  log.push(`Rebar: ${rebarResult.mass_kg}kg/tact, ${rebarResult.duration_days}d/tact (${rebarResult.mass_source})`);

  // Recalculate strategies with actual rebar days
  const strategiesWithRebar = calculateStrategiesDetailed({
    assembly_days: assemblyDays,
    rebar_days: rebarResult.duration_days,
    concrete_days: DEFAULTS.concrete_days,
    curing_days: curingDays,
    disassembly_days: disassemblyDays,
    num_captures: pourDecision.num_tacts,
  });

  // ─── 6. Pour Task ──────────────────────────────────────────────────────

  const pourResult = calculatePourTask({
    element_type: elementType,
    volume_m3: pourDecision.tact_volume_m3,
    season: input.season,
    use_retarder: input.use_retarder,
    crew_size: crew,
    shift_h: shift,
  });

  log.push(`Pour: ${pourResult.effective_rate_m3_h}m³/h, ${pourResult.total_pour_hours}h/tact (bottleneck: ${pourResult.rate_bottleneck})`);
  warnings.push(...pourResult.warnings);

  // ─── 7. Element Scheduler (DAG + CPM + RCPSP) ──────────────────────────

  const scheduleResult = scheduleElement({
    num_tacts: pourDecision.num_tacts,
    num_sets: numSets,
    assembly_days: assemblyDays,
    rebar_days: rebarResult.duration_days,
    concrete_days: DEFAULTS.concrete_days,
    curing_days: curingDays,
    stripping_days: disassemblyDays,
    num_formwork_crews: numFWCrews,
    num_rebar_crews: numRBCrews,
    rebar_lag_pct: 50,
    scheduling_mode: pourDecision.scheduling_mode,
    cure_between_neighbors_days: pourDecision.cure_between_neighbors_h / 24,
    pert_params: input.enable_monte_carlo ? {
      monte_carlo_iterations: input.monte_carlo_iterations ?? DEFAULTS.monte_carlo_iterations,
      seed: 42, // Reproducible
    } : undefined,
    maturity_params: maturityParams,
  });

  log.push(`Schedule: ${scheduleResult.total_days}d (sequential ${scheduleResult.sequential_days}d, savings ${scheduleResult.savings_pct}%)`);

  if (scheduleResult.bottleneck) {
    warnings.push(scheduleResult.bottleneck);
  }

  // ─── 8. Cost Summary ──────────────────────────────────────────────────

  const formworkLaborCZK = threePhase.total_cost_labor;
  const rebarLaborCZK = rebarResult.cost_labor * pourDecision.num_tacts;
  // Pour labor: crew × hours × wage per tact × num_tacts
  const pourLaborCZK = roundTo(pourResult.total_pour_hours * crew * wage * pourDecision.num_tacts, 2);

  // Rental cost (monthly → daily)
  const rentalDaysPerSet = scheduleResult.total_days + 2; // +2 for transport
  const formworkRentalCZK = fwSystem.rental_czk_m2_month > 0
    ? roundTo(fwArea * fwSystem.rental_czk_m2_month * (rentalDaysPerSet / 30) * numSets, 2)
    : 0;

  const totalLaborCZK = roundTo(formworkLaborCZK + rebarLaborCZK + pourLaborCZK, 2);

  // ─── 9. Assemble Output ───────────────────────────────────────────────

  return {
    element: {
      type: elementType,
      label_cs: profile.label_cs,
      classification_confidence: profile.confidence,
      profile,
    },
    pour_decision: pourDecision,
    formwork: {
      system: fwSystem,
      assembly_days: assemblyDays,
      disassembly_days: disassemblyDays,
      curing_days: curingDays,
      three_phase: threePhase,
      strategies: strategiesWithRebar,
    },
    rebar: rebarResult,
    pour: pourResult,
    schedule: scheduleResult,
    costs: {
      formwork_labor_czk: formworkLaborCZK,
      rebar_labor_czk: rebarLaborCZK,
      pour_labor_czk: pourLaborCZK,
      total_labor_czk: totalLaborCZK,
      formwork_rental_czk: formworkRentalCZK,
    },
    monte_carlo: scheduleResult.monte_carlo,
    warnings,
    decision_log: [...log, ...pourDecision.decision_log],
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Estimate formwork area when not given.
 * Rough heuristic: cube root of volume × 6 faces ÷ num_tacts.
 * This is a very rough estimate — user should provide actual area.
 */
function estimateFormworkArea(totalVolume_m3: number, numTacts: number): number {
  const volumePerTact = totalVolume_m3 / numTacts;
  // Assume roughly cubic shape: side = vol^(1/3)
  // Formwork covers 4 sides (vertical) + maybe bottom = ~4 × side²
  const side = Math.pow(volumePerTact, 1 / 3);
  const estimated = roundTo(4 * side * side, 1);
  return Math.max(estimated, 5); // Minimum 5 m²
}

/**
 * Map element-classifier orientation to maturity ElementType
 */
function mapElementType(profile: ElementProfile): ElementType {
  if (profile.orientation === 'horizontal') {
    return profile.needs_supports ? 'slab' : 'beam';
  }
  return profile.needs_supports ? 'column' : 'wall';
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
