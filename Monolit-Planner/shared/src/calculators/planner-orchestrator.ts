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
import { calculateCuring, PROPS_MIN_DAYS } from './maturity.js';
import type { ConcreteClass, CementType, ElementType, Season, ConstructionType } from './maturity.js';
import type { ElementProfile } from '../classifiers/element-classifier.js';
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';
import { calculateProps } from './props-calculator.js';
import type { PropsCalculatorResult } from './props-calculator.js';

import { classifyElement, getElementProfile, recommendFormwork, getAdjustedAssemblyNorm, getFilteredFormworkSystems, getSuitableSystemsForElement } from '../classifiers/element-classifier.js';
import { decidePourMode } from './pour-decision.js';
import { calculateFormwork, calculateThreePhaseFormwork, calculateStrategiesDetailed } from './formwork.js';
import { calculateRebarLite } from './rebar-lite.js';
import { calculatePourTask } from './pour-task-engine.js';
import { scheduleElement } from './element-scheduler.js';
import { findFormworkSystem } from '../constants-data/formwork-systems.js';
import { calculateLateralPressure, suggestPourStages, inferPourMethod } from './lateral-pressure.js';
import type { LateralPressureResult, PourStagesSuggestion, PourMethod } from './lateral-pressure.js';

// ─── Input ──────────────────────────────────────────────────────────────────

export interface PlannerInput {
  // --- Element identification (one of two) ---
  /** Czech name/description for auto-classification */
  element_name?: string;
  /** Or explicit type (skips classification) */
  element_type?: StructuralElementType;

  // --- Volumes & Dimensions ---
  /** Total concrete volume (m³) */
  volume_m3: number;
  /** Formwork area per tact (m²). If not given, estimated from volume, height, and element geometry */
  formwork_area_m2?: number;
  /** Height from ground/floor to underside of element (m). Used for props calculation. */
  height_m?: number;

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

  // --- Pour method (for lateral pressure) ---
  /** Concrete delivery method. If not given, inferred from element profile and height. */
  pour_method?: PourMethod;

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
  /** Crew size — formwork (workers per crew). Default: 4 */
  crew_size?: number;
  /** Crew size — rebar (workers per crew). Default: 4. If not set, falls back to crew_size. */
  crew_size_rebar?: number;
  /** Shift hours. Default: 10 */
  shift_h?: number;
  /** Time utilization factor. Default: 0.8 */
  k?: number;
  /** Wage CZK/h. Default: 398. Used as fallback when trade-specific wages are not set. */
  wage_czk_h?: number;
  /** Formwork workers (tesaři/bednáři) wage CZK/h. Falls back to wage_czk_h. */
  wage_formwork_czk_h?: number;
  /** Rebar workers (železáři) wage CZK/h. Falls back to wage_czk_h. */
  wage_rebar_czk_h?: number;
  /** Concrete workers (betonáři) wage CZK/h. Falls back to wage_czk_h.
   *  Typically higher due to overtime on continuous pours (bridges). */
  wage_pour_czk_h?: number;

  // --- Formwork override ---
  /** Explicit formwork system name (overrides auto-recommendation) */
  formwork_system_name?: string;
  /** Override rental price (Kč/m²/month or Kč/bm/month). If set, replaces catalog value. */
  rental_czk_override?: number;
  /** Cross-section shape correction for formwork assembly/disassembly.
   *  1.0 = straight (default), 1.3 = angled, 1.5 = circular, 1.8 = irregular.
   *  Multiplies assembly_h_m2 and disassembly_h_m2 (not rebar/pour). */
  formwork_shape_correction?: number;

  // --- Repetitive elements (obrátkovost) ---
  /** Number of identical elements (e.g. 20 pad foundations). Default: 1 */
  num_identical_elements?: number;
  /** Formwork sets available for rotation among identical elements.
   *  Default: num_sets. Only relevant when num_identical_elements > 1. */
  formwork_sets_count?: number;

  // --- Tact override ---
  /** Direct number of tacts (overrides auto-calculation from spáry).
   *  Use for foundations, piers, etc. where each element = 1 tact.
   *  Example: 8 pier foundations = num_tacts_override: 8 */
  num_tacts_override?: number;
  /** Volume per tact (m³). If not given, total volume / num_tacts. */
  tact_volume_m3_override?: number;
  /** Scheduling mode override: 'linear' or 'chess' */
  scheduling_mode_override?: 'linear' | 'chess';

  // --- Bridge configuration ---
  /** Is this element part of a bridge (mostní objekt)?
   *  Auto-detected from bridge_id "SO-xxx" if not set explicitly.
   *  Affects classifier: pilíř→driky_piliru, základy→zaklady_piliru, etc. */
  is_bridge?: boolean;
  /**
   * Number of parallel bridges.
   *   1 = single bridge (default)
   *   2 = dual carriageway (levý + pravý most, souběžné mosty)
   *
   * Affects formwork kit recommendations and scheduling advice.
   * Only relevant for mostovkova_deska element type.
   */
  num_bridges?: number;

  // --- Prestressed concrete ---
  /** Is the element prestressed (předpjatý beton)? Adds PRESTRESS step to schedule. */
  is_prestressed?: boolean;
  /** Prestressing duration override (days). Auto-calculated from bridge length if not given. */
  prestress_days_override?: number;

  // --- Bridge deck subtype ---
  /** Bridge deck cross-section subtype. Affects difficulty factor and warnings. */
  bridge_deck_subtype?: 'deskovy' | 'jednotram' | 'dvoutram' | 'vicetram' | 'jednokomora' | 'dvoukomora' | 'ramovy' | 'sprazeny';

  // --- Exposure class ---
  /** Concrete exposure class (e.g. 'XF2', 'XD3', 'XF4'). For validation warnings. */
  exposure_class?: string;

  // --- Options ---
  /** Run Monte Carlo simulation. Default: false */
  enable_monte_carlo?: boolean;
  /** Monte Carlo iterations. Default: 10000 */
  monte_carlo_iterations?: number;

  // --- Deadline constraint ---
  /** Investor/project deadline in working days. If total_days exceeds this,
   *  the system warns and suggests optimized resource configurations. */
  deadline_days?: number;
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
    /** Shape correction applied (1.0 if none) */
    shape_correction: number;
  };

  // --- Obrátkovost (repetitive elements) ---
  obratkovost?: {
    num_identical_elements: number;
    formwork_sets_count: number;
    obratkovost: number;
    rental_per_element_czk: number;
    total_duration_days: number;
    transfer_time_days: number;
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
    /** Night shift premium for continuous pours >12h (§ 116 ZP: +10%) */
    pour_night_premium_czk: number;
    total_labor_czk: number;
    /** Formwork rental (monthly rate × rental_days / 30). Only if system has rental. */
    formwork_rental_czk: number;
    /** Props labor (assembly + disassembly). 0 if no props. */
    props_labor_czk: number;
    /** Props rental. 0 if no props. */
    props_rental_czk: number;
  };

  // --- Resources summary ---
  resources: {
    /** Formwork crews × workers per crew */
    total_formwork_workers: number;
    /** Rebar crews × workers per crew */
    total_rebar_workers: number;
    /** Formwork crew count */
    num_formwork_crews: number;
    /** Rebar crew count */
    num_rebar_crews: number;
    /** Workers per formwork crew */
    crew_size_formwork: number;
    /** Workers per rebar crew */
    crew_size_rebar: number;
    /** Shift hours */
    shift_h: number;
    /** Trade-specific wages (Kč/h) */
    wage_formwork_czk_h: number;
    wage_rebar_czk_h: number;
    wage_pour_czk_h: number;
    /** Number of crew shifts for continuous pours (1 = normal, 2+ = crew relief) */
    pour_shifts: number;
  };

  // --- Lateral pressure & pour stages (záběrová betonáž) ---
  lateral_pressure?: LateralPressureResult;
  pour_stages?: PourStagesSuggestion;

  // --- Prestressing (only when is_prestressed = true) ---
  prestress?: {
    days: number;
    crew_size: number;
    skruz_total_days: number;  // curing + prestress
  };

  // --- Props (podpěry) — only for horizontal elements with needs_supports ---
  props?: PropsCalculatorResult;

  // --- Monte Carlo (optional) ---
  monte_carlo?: MonteCarloResult;

  // --- Deadline check (optional) ---
  deadline_check?: DeadlineCheckResult;

  // --- Norms sources (traceability of work norms) ---
  norms_sources: {
    formwork_assembly: string;
    formwork_disassembly: string;
    rebar: string;
    curing: string;
    skruz?: string;
  };

  // --- Warnings ---
  warnings: string[];

  // --- Traceability ---
  decision_log: string[];
}

// ─── Deadline Check ─────────────────────────────────────────────────────────

export interface DeadlineOptimizationVariant {
  /** Label for display, e.g. "2 čety bednění, 2 čety výztuže, 3 sady" */
  label: string;
  num_formwork_crews: number;
  num_rebar_crews: number;
  num_sets: number;
  total_days: number;
  total_cost_czk: number;
  /** Extra cost vs. current configuration */
  extra_cost_czk: number;
  fits_deadline: boolean;
}

export interface DeadlineCheckResult {
  /** Investor/project deadline (working days), undefined if not set */
  deadline_days?: number;
  /** Calculated total duration (working days) */
  calculated_days: number;
  /** Overrun in working days (0 if within deadline or no deadline) */
  overrun_days: number;
  /** true if no deadline set, or calculated_days <= deadline_days */
  fits: boolean;
  /** ALL optimization variants that are faster, sorted by cost (cheapest first) */
  suggestions: DeadlineOptimizationVariant[];
  /** Cheapest variant that is faster than current */
  cheapest_faster?: DeadlineOptimizationVariant;
  /** Fastest variant overall */
  fastest?: DeadlineOptimizationVariant;
  /** Best for deadline: cheapest variant that fits deadline (only when deadline set) */
  best_for_deadline?: DeadlineOptimizationVariant;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULTS = {
  num_sets: 2,
  num_formwork_crews: 1,
  num_rebar_crews: 1,
  crew_size: 4,
  crew_size_rebar: 4,
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
  let crew = input.crew_size ?? DEFAULTS.crew_size;
  let crewRebar = input.crew_size_rebar ?? input.crew_size ?? DEFAULTS.crew_size_rebar;
  const shift = input.shift_h ?? DEFAULTS.shift_h;
  const k = input.k ?? DEFAULTS.k;
  const wage = input.wage_czk_h ?? DEFAULTS.wage_czk_h;
  const wageFormwork = input.wage_formwork_czk_h ?? wage;
  const wageRebar = input.wage_rebar_czk_h ?? wage;
  const wagePour = input.wage_pour_czk_h ?? wage;
  const rawNumSets = input.num_sets ?? DEFAULTS.num_sets;
  const numFWCrews = input.num_formwork_crews ?? DEFAULTS.num_formwork_crews;
  const numRBCrews = input.num_rebar_crews ?? DEFAULTS.num_rebar_crews;
  const temperature = input.temperature_c ?? DEFAULTS.temperature_c;

  // ─── 1. Element Classification ──────────────────────────────────────────

  let profile: ElementProfile;
  if (input.element_type) {
    profile = getElementProfile(input.element_type);
    log.push(`Element: ${input.element_type} (explicit)`);
  } else if (input.element_name) {
    const bridgeCtx = input.is_bridge ? { is_bridge: true } : undefined;
    profile = classifyElement(input.element_name, bridgeCtx);
    log.push(`Element: "${input.element_name}" → ${profile.element_type} (confidence ${profile.confidence})`);
    if (profile.confidence < 0.6) {
      warnings.push(`Nízká jistota klasifikace: ${profile.element_type} (${(profile.confidence * 100).toFixed(0)}%). Zvažte ruční zadání.`);
    }
  } else {
    throw new Error('Either element_name or element_type must be provided');
  }

  const elementType = profile.element_type;
  const isPrestressed = input.is_prestressed === true;

  // Rimsa crew sizing: 6 formwork+concrete (tesaři+betonáři) + 3 rebar (železáři) = 9 per side
  if (elementType === 'rimsa' && !input.crew_size) {
    crew = 6;
    if (!input.crew_size_rebar) crewRebar = 3;
  }

  // ─── 2. Lateral Pressure & Formwork System Selection ─────────────────

  // 2a. Calculate lateral pressure if height is known and element is vertical
  let lateralPressure: LateralPressureResult | undefined;
  let pourStages: PourStagesSuggestion | undefined;
  const heightForPressure = input.height_m;
  const isVertical = profile.orientation === 'vertical';

  if (heightForPressure && heightForPressure > 0 && isVertical) {
    const pourMethod = input.pour_method ?? inferPourMethod(profile.pump_typical, heightForPressure);
    lateralPressure = calculateLateralPressure(heightForPressure, pourMethod);
    log.push(`Lateral pressure: ${lateralPressure.pressure_kn_m2} kN/m² (h=${heightForPressure}m, k=${lateralPressure.k}, method=${pourMethod})`);

    // Check if pressure-based filtering changes recommendation
    const filterResult = getFilteredFormworkSystems(elementType, heightForPressure, pourMethod);
    if (filterResult.rejected.length > 0) {
      const rejectedNames = filterResult.rejected.map(s => s.name).join(', ');
      log.push(`Pressure filter: rejected ${filterResult.rejected.length} systems (${rejectedNames})`);
    }
  }

  // 2c. Select formwork system (pressure-aware when height given)
  let fwSystem: FormworkSystemSpec;
  if (input.formwork_system_name) {
    const found = findFormworkSystem(input.formwork_system_name);
    if (!found) {
      warnings.push(`Systém bednění "${input.formwork_system_name}" nenalezen — použit doporučený.`);
      fwSystem = recommendFormwork(elementType, heightForPressure, input.pour_method, input.total_length_m);
    } else {
      fwSystem = found;
      // Warn if manually selected system can't handle the pressure
      if (lateralPressure && fwSystem.pressure_kn_m2 != null &&
          fwSystem.pressure_kn_m2 < lateralPressure.pressure_kn_m2) {
        warnings.push(
          `⚠️ Vybraný systém "${fwSystem.name}" má max. tlak ${fwSystem.pressure_kn_m2} kN/m², ` +
          `ale boční tlak betonu je ${lateralPressure.pressure_kn_m2} kN/m² (h=${heightForPressure}m). ` +
          `Zvažte záběrovou betonáž nebo jiný systém.`
        );
      }
    }
  } else {
    fwSystem = recommendFormwork(elementType, heightForPressure, input.pour_method, input.total_length_m);
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

  // Apply user overrides for tacts (foundations, piers, etc.)
  if (input.num_tacts_override && input.num_tacts_override > 0) {
    pourDecision.num_tacts = input.num_tacts_override;
    pourDecision.tact_volume_m3 = input.tact_volume_m3_override
      ?? Math.round((input.volume_m3 / input.num_tacts_override) * 100) / 100;
    pourDecision.num_sections = input.num_tacts_override;
    pourDecision.section_volume_m3 = pourDecision.tact_volume_m3;
    log.push(`Tacts: MANUAL override → ${pourDecision.num_tacts} tacts × ${pourDecision.tact_volume_m3}m³`);
  }
  if (input.scheduling_mode_override) {
    pourDecision.scheduling_mode = input.scheduling_mode_override;
    log.push(`Scheduling mode: MANUAL → ${input.scheduling_mode_override}`);
  }

  // 3b. Apply height-based záběry (pour stages) for vertical elements
  if (heightForPressure && heightForPressure > 0 && isVertical && !input.num_tacts_override) {
    const { all: allCompatible } = getSuitableSystemsForElement(elementType);
    const pourMethod = input.pour_method ?? inferPourMethod(profile.pump_typical, heightForPressure);
    pourStages = suggestPourStages(heightForPressure, pourMethod, allCompatible);

    if (pourStages.needs_staging && pourStages.num_stages > pourDecision.num_tacts) {
      // Height-based staging produces more tacts than spára-based → use staging
      const prevTacts = pourDecision.num_tacts;
      pourDecision.num_tacts = pourStages.num_stages;
      pourDecision.tact_volume_m3 = Math.round((input.volume_m3 / pourStages.num_stages) * 100) / 100;
      pourDecision.num_sections = pourStages.num_stages;
      pourDecision.section_volume_m3 = pourDecision.tact_volume_m3;
      pourDecision.pour_mode = 'sectional';
      pourDecision.sub_mode = 'vertical_layers';
      pourDecision.scheduling_mode = 'linear';
      pourDecision.cure_between_neighbors_h = pourStages.cure_between_stages_h;

      log.push(
        `Záběrová betonáž: ${pourStages.num_stages} záběrů po ${pourStages.stage_height_m}m ` +
        `(boční tlak ${pourStages.stage_pressure_kn_m2} kN/m² ≤ ${pourStages.max_system_pressure_kn_m2} kN/m²)`
      );
      warnings.push(
        `Záběrová betonáž: výška ${heightForPressure}m vyžaduje ${pourStages.num_stages} záběrů po ~${pourStages.stage_height_m}m ` +
        `(plný tlak ${lateralPressure?.pressure_kn_m2} kN/m² překračuje ${pourStages.max_system_pressure_kn_m2} kN/m²). ` +
        `Pauza mezi záběry: ${pourStages.cure_between_stages_h}h. ` +
        `Bednění se přesouvá nahoru (${pourStages.num_stages}× obrátka).`
      );

      if (prevTacts > 1) {
        log.push(`Note: height-based staging (${pourStages.num_stages}) overrides spára-based tacts (${prevTacts})`);
      }
    } else if (pourStages.needs_staging) {
      // Spára-based already has enough tacts
      log.push(`Height staging suggested ${pourStages.num_stages} stages, but spára-based already has ${pourDecision.num_tacts} tacts — keeping spára-based`);
    }
    log.push(...pourStages.decision_log.map(l => `  [staging] ${l}`));
  }

  log.push(`Pour: ${pourDecision.pour_mode}/${pourDecision.sub_mode}, ${pourDecision.num_tacts} tacts × ${pourDecision.tact_volume_m3}m³`);
  warnings.push(...pourDecision.warnings);

  // ─── 3a. Rimsa-specific warnings ───────────────────────────────────────
  if (elementType === 'rimsa') {
    // Info: záběry summary
    const spacing = input.spara_spacing_m ?? 20;
    warnings.push(
      `Římsa: záběr ${spacing} m, celkem ${pourDecision.num_tacts} záběrů, ` +
      `objem/záběr ${pourDecision.tact_volume_m3} m³`
    );

    // Info: construction sequence — rimsa comes AFTER bridge deck + prestressing
    warnings.push(
      `Římsa se betonuje PO dokončení mostovky a PO vnesení předpětí (pokud NK předpjatá).`
    );

    // Warning: formwork system for long bridges
    if (!input.total_length_m) {
      warnings.push(
        `⚠️ Římsa: délka mostu nezadána — použito konzolové bednění T. ` +
        `Zadejte délku mostu (>150 m → římsový vozík TU/T) pro správný výběr systému.`
      );
    }
  }

  // ─── 3a2. Mostovka-specific warnings ──────────────────────────────────
  if (elementType === 'mostovkova_deska') {
    // Construction sequence
    warnings.push(
      `Nosná konstrukce se betonuje PO dokončení spodní stavby (opěry, pilíře, úložné prahy). ` +
      `Ověřte že spodní stavba je hotová.`
    );

    // Bridge deck subtype: difficulty + warnings
    const deckSubtype = input.bridge_deck_subtype;
    const DECK_DIFFICULTY: Record<string, number> = {
      deskovy: 1.0, jednotram: 1.15, dvoutram: 1.2, vicetram: 1.2,
      jednokomora: 1.5, dvoukomora: 1.6, ramovy: 1.1, sprazeny: 0.8,
    };
    if (deckSubtype && DECK_DIFFICULTY[deckSubtype] !== undefined) {
      profile.difficulty_factor = DECK_DIFFICULTY[deckSubtype];
      log.push(`Deck subtype ${deckSubtype}: difficulty_factor → ${profile.difficulty_factor}`);
    }
    if (deckSubtype === 'jednotram' || deckSubtype === 'dvoutram' || deckSubtype === 'vicetram') {
      warnings.push(
        `Trámový nosník: 2 fáze betonáže — nejdřív trámy, pak deska (pracovní spára).`
      );
    } else if (deckSubtype === 'jednokomora' || deckSubtype === 'dvoukomora') {
      warnings.push(
        `Komorový nosník: vnitřní bednění dutin — speciální prvek, ověřte s dodavatelem bednění. ` +
        `3 fáze betonáže: dno → stěny → horní deska.`
      );
    } else if (deckSubtype === 'ramovy') {
      warnings.push(
        `Rámový most: stojky vetknuty do NK — ověřte postup betonáže s projektem.`
      );
    } else if (deckSubtype === 'sprazeny') {
      warnings.push(
        `Spřažená konstrukce: kalkulátor počítá pouze monolitickou spřahující desku (ne prefabrikáty).`
      );
    }
    // Auto-set is_prestressed for komorový and long trámový
    if (!input.is_prestressed && (deckSubtype === 'jednokomora' || deckSubtype === 'dvoukomora')) {
      (input as any).is_prestressed = true;
      warnings.push(`Komorový nosník: automaticky nastaveno předpětí (is_prestressed=true).`);
    }
  }

  // ─── 3a3. Exposure class validation ─────────────────────────────────────
  if (input.exposure_class) {
    const RECOMMENDED_EXPOSURE: Partial<Record<StructuralElementType, string[]>> = {
      mostovkova_deska: ['XF2', 'XD1', 'XD3', 'XC4'],
      rimsa: ['XF4', 'XD3'],
      driky_piliru: ['XC4', 'XD3', 'XF4'],
      zaklady_piliru: ['XC2', 'XA1', 'XA2'],
      opery_ulozne_prahy: ['XC4', 'XD1', 'XF2'],
      operne_zdi: ['XC4', 'XD1'],
      prechodova_deska: ['XC4', 'XD1'],
    };
    const recommended = RECOMMENDED_EXPOSURE[elementType];
    if (recommended && !recommended.includes(input.exposure_class)) {
      warnings.push(
        `⚠️ Třída prostředí ${input.exposure_class} je neobvyklá pro ${profile.label_cs}. ` +
        `Doporučeno: ${recommended.join(', ')}. Ověřte s projektem.`
      );
    }
  }

  // Concrete class validation
  if (input.concrete_class && elementType === 'mostovkova_deska') {
    const concreteNum = parseInt(input.concrete_class.replace(/C(\d+)\/.*/, '$1'));
    const isPrestressed = input.is_prestressed === true;
    if (isPrestressed && concreteNum < 30) {
      warnings.push(`⚠️ Předpjatá mostovka: třída ${input.concrete_class} je pod minimem C30/37 pro předpjatý beton.`);
    } else if (!isPrestressed && concreteNum < 25) {
      warnings.push(`⚠️ Mostovka: třída ${input.concrete_class} je pod minimem C25/30 pro železobeton.`);
    } else if (concreteNum > 40) {
      warnings.push(
        `Třída ${input.concrete_class} je neobvyklá pro mostní NK. ` +
        `Typicky C35/45 (předpjaté) nebo C30/37 (ŽB). Ověřte s projektem.`
      );
    }
  }

  // ─── 3b. Bridge-specific advice (mostovkova_deska) ──────────────────────

  const numBridges = input.num_bridges ?? 1;
  const isBridgeMonolith = elementType === 'mostovkova_deska' && !input.has_dilatacni_spary;
  // No-joint bridge deck uses one full formwork kit per whole bridge. You cannot split
  // one bridge into extra parallel kits, so cap practical kit count by bridge count.
  const numSets = isBridgeMonolith ? Math.min(rawNumSets, numBridges) : rawNumSets;
  if (isBridgeMonolith && rawNumSets > numBridges) {
    warnings.push(
      `Mostovková deska bez spár: použito max. ${numBridges} kompletní souprava/y (1 souprava na 1 most). ` +
      `Zadaných ${rawNumSets} souprav bylo omezeno.`
    );
    log.push(`Formwork kits capped for monolithic bridge deck: ${rawNumSets} → ${numSets}`);
  }
  if (elementType === 'mostovkova_deska' && numBridges >= 2) {
    if (!input.has_dilatacni_spary) {
      // Each bridge is a full monolithic pour — 2 full formwork kits needed for parallel work
      warnings.push(
        `2 mosty bez dilatačních spár: každý most = nepřerušitelná monolitická zálivka. ` +
        `Pro souběžný postup: 2 kompletní soupravy bednění (1 na most) + zdvojit čerpadla a osádku. ` +
        `S 1 soupravou: nejdříve dokončit levý most → přemístit soupravu → pravý most (harmonogram ×2).`
      );
      log.push(`Mosty: 2 (L+P) bez spár → min. 2 kompletní soupravy pro souběh | jinak 2× délka harmonogramu`);
    } else {
      // Sectional — kits can be shared or multiplied for chess/both-ends approach
      const hasChess = pourDecision.sub_mode === 'adjacent_chess' || pourDecision.scheduling_mode === 'chess';
      if (hasChess) {
        warnings.push(
          `2 mosty se spárami, šachovnicový postup: souprava bednění může obskakovat záběry napříč oběma mosty. ` +
          `1 souprava = sekvenční (L most → P most). ` +
          `2 soupravy = paralelní práce na obou mostech současně.`
        );
      } else {
        warnings.push(
          `2 mosty se spárami: doporučen šachovnicový pořadí (zaškrtněte "Sousední sekce"). ` +
          `1 souprava = sekvenční průchod (L → P). 2 soupravy = souběžná práce.`
        );
      }
      warnings.push(
        `Varianta "z obou konců": zahájit záběr 1 a záběr ${pourDecision.num_tacts} na každém mostě současně — ` +
        `zkrátí harmonogram ~50 %, vyžaduje ${numBridges * 2} soupravu/y bednění a ${numBridges * 2} pracovní čety.`
      );
      log.push(`Mosty: 2 (L+P) se spárami → šachovnicový/oboustranný postup | opt. 2-4 soupravy`);
    }
  }

  // ─── 4. Formwork Calculation ────────────────────────────────────────────

  // Estimate formwork area if not given
  const fwArea = input.formwork_area_m2 ?? estimateFormworkArea(
    input.volume_m3, pourDecision.num_tacts, input.height_m, profile.orientation, input.total_length_m,
  );
  log.push(`Formwork area: ${fwArea} m² per tact${input.formwork_area_m2 ? '' : ' (estimated)'}`);

  // Warn about estimated formwork area for complex elements where estimation is unreliable
  const COMPLEX_ELEMENT_TYPES = ['opery_ulozne_prahy', 'operne_zdi', 'rimsa', 'schodiste'];
  if (!input.formwork_area_m2 && COMPLEX_ELEMENT_TYPES.includes(elementType)) {
    warnings.push(
      `⚠️ ${profile.label_cs}: plocha bednění je odhadnuta (${fwArea} m²). ` +
      `Tento typ má složitou geometrii (dřík + křídla + stěna) — zadejte skutečnou plochu pro přesný výpočet.`
    );
  }

  // Maturity-based curing or default
  const maturityParams = input.concrete_class ? {
    concrete_class: input.concrete_class,
    temperature_c: temperature,
    cement_type: input.cement_type,
    element_type: mapElementType(profile),
  } : undefined;

  // Map SeasonMode ('hot'|'normal'|'cold') → Season ('leto'|'podzim_jaro'|'zima') for PROPS_MIN_DAYS
  const seasonForCuring: Season =
    input.season === 'hot' ? 'leto' :
    input.season === 'cold' ? 'zima' : 'podzim_jaro';
  if (!input.season) {
    log.push(`Season not specified — defaulting to "podzim_jaro" (21d skruž hold). Pass season: 'hot'|'normal'|'cold' for accurate results.`);
  }

  // Calculate strip wait hours from maturity model (fixes curingDays = 0 bug)
  let stripWaitHours = 24; // default: 1 calendar day
  if (maturityParams) {
    const maturityForStrip = calculateCuring({
      concrete_class: maturityParams.concrete_class,
      temperature_c: maturityParams.temperature_c,
      cement_type: maturityParams.cement_type,
      element_type: mapElementType(profile) as ElementType,
      strip_strength_pct: profile.strip_strength_pct,
    });
    stripWaitHours = maturityForStrip.min_curing_hours;
    log.push(`Maturity strip: ${(stripWaitHours / 24).toFixed(1)}d (${maturityForStrip.strip_strength_pct}% f_ck, ` +
      `${maturityParams.temperature_c}°C, ${maturityParams.cement_type ?? 'CEM_I'})`);
  }

  // Skruž / props minimum hold for ALL horizontal elements (ČSN EN 13670 + ČSN 73 6244)
  // Map structural element type → maturity ConstructionType for PROPS_MIN_DAYS lookup
  const skruzConstructionType: ConstructionType | null =
    elementType === 'mostovkova_deska' ? 'mostovka' :
    elementType === 'rimsa' ? 'rimsy' :
    elementType === 'stropni_deska' || elementType === 'zakladova_deska' ? 'stropni_deska' :
    elementType === 'pruvlak' || elementType === 'rigel' ? 'pruvlak' :
    elementType === 'schodiste' ? 'schodiste' :
    null;

  const skruzTableLookup = skruzConstructionType ? PROPS_MIN_DAYS[skruzConstructionType]?.[seasonForCuring] : undefined;
  if (profile.needs_supports && skruzConstructionType && skruzTableLookup === undefined) {
    const fallbackDays = elementType === 'mostovkova_deska' ? 21 : 14;
    log.push(`WARN: PROPS_MIN_DAYS['${skruzConstructionType}']['${seasonForCuring}'] not found — using fallback ${fallbackDays}d.`);
    warnings.push(`Skruž: sezónní tabulka PROPS_MIN_DAYS neobsahuje hodnotu pro "${seasonForCuring}" — použito ${fallbackDays} dní.`);
  }
  const skruzMinDays = profile.needs_supports && skruzConstructionType
    ? (skruzTableLookup ?? (elementType === 'mostovkova_deska' ? 21 : 14))
    : 0;
  if (skruzMinDays > 0) {
    const skruzMinHours = skruzMinDays * 24;
    if (stripWaitHours < skruzMinHours) {
      log.push(`Skruž min (${skruzMinDays}d, sezóna "${seasonForCuring}", ČSN 73 6244) > maturity ` +
        `(${(stripWaitHours / 24).toFixed(1)}d) → using skruž minimum`);
      stripWaitHours = skruzMinHours;
    }
  }

  // Apply shape correction to formwork norms (geometry-based multiplier)
  const shapeCorrection = input.formwork_shape_correction ?? 1.0;
  const shapedAssemblyNorm = roundTo(adjustedNorms.assembly_h_m2 * shapeCorrection, 3);
  const shapedDisassemblyNorm = roundTo(adjustedNorms.disassembly_h_m2 * shapeCorrection, 3);
  if (shapeCorrection !== 1.0) {
    log.push(`Shape correction: ×${shapeCorrection} → assembly ${shapedAssemblyNorm} h/m², strike ${shapedDisassemblyNorm} h/m²`);
  }

  // Use formwork calculator for base durations
  const fwBase = calculateFormwork({
    area_m2: fwArea,
    norm_assembly_h_m2: shapedAssemblyNorm,
    norm_disassembly_h_m2: shapedDisassemblyNorm,
    crew_size: crew,
    shift_h: shift,
    k,
    wage_czk_h: wageFormwork,
    strip_wait_hours: stripWaitHours, // correctly includes maturity + skruž minimum
    move_clean_hours: 2,
  });

  const assemblyDays = fwBase.assembly_days;
  const disassemblyDays = fwBase.disassembly_days;
  const curingDays = fwBase.wait_days; // now correct: max(maturity, skruž_min)

  // 3-phase cost model (with shape correction applied)
  const threePhase = calculateThreePhaseFormwork(
    fwArea,
    shapedAssemblyNorm,
    shapedDisassemblyNorm,
    crew, shift, k, wageFormwork,
    pourDecision.num_tacts,
  );

  // ─── 5. Rebar Calculation ──────────────────────────────────────────────

  // For prestressed elements: B500B rebar ratio is lower (100 kg/m³ instead of 150)
  // because part of the structural capacity comes from prestressing tendons
  const rebarMassOverride = input.rebar_mass_kg
    ? input.rebar_mass_kg / pourDecision.num_tacts
    : (isPrestressed && elementType === 'mostovkova_deska' && !input.rebar_mass_kg)
      ? (pourDecision.tact_volume_m3 * 100) // B500B: 100 kg/m³ for prestressed NK
      : undefined;

  const rebarResult = calculateRebarLite({
    element_type: elementType,
    volume_m3: pourDecision.tact_volume_m3,
    mass_kg: rebarMassOverride,
    crew_size: crewRebar,
    shift_h: shift,
    k,
    wage_czk_h: wageRebar,
  });

  // Prestressing tendons Y1860 — separate calculation (not included in rebarResult)
  let prestressRebarInfo: { mass_kg_per_tact: number; mass_t_total: number; cost_czk_per_kg: number } | undefined;
  if (isPrestressed) {
    const y1860_kg_m3 = 30; // typical Y1860S7 ratio
    const y1860_per_tact = pourDecision.tact_volume_m3 * y1860_kg_m3;
    const y1860_total_t = roundTo((y1860_per_tact * pourDecision.num_tacts) / 1000, 2);
    prestressRebarInfo = {
      mass_kg_per_tact: roundTo(y1860_per_tact, 1),
      mass_t_total: y1860_total_t,
      cost_czk_per_kg: 100, // ~80–120 Kč/kg for Y1860S7
    };
    log.push(`Prestress rebar Y1860: ${y1860_per_tact.toFixed(0)}kg/tact, ${y1860_total_t}t total (30 kg/m³ × ${input.volume_m3}m³)`);
    warnings.push(
      `Výztuž rozdělit: B500B (${rebarResult.mass_source === 'user' ? 'zadáno' : '~100 kg/m³'}) + ` +
      `předpínací Y1860S7 (~30 kg/m³, ${y1860_total_t} t, ~100 Kč/kg). ` +
      `Různí dodavatelé: armovna (B500B) + specializovaná firma (Y1860).`
    );
  }

  log.push(`Rebar: ${rebarResult.mass_kg}kg/tact, ${rebarResult.duration_days}d/tact (${rebarResult.mass_source}, ${numRBCrews} čet×${crewRebar} prac.=${numRBCrews * crewRebar} železářů, RCPSP parallel=${numRBCrews})`);

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

  // Continuous pour detection: monolithic elements must be poured in one uninterrupted
  // operation (no work joints allowed). Scale crew + pump instead of extending days.
  const isContinuousPour = pourDecision.pour_mode === 'monolithic';

  // Calculate actual concrete_days from pour hours:
  // - Continuous pour: ALWAYS 1 day (extended shift), scale crew/pump instead
  // - Sectional pour: pour_hours / shift_h (fractional, rounded)
  let concreteDays: number;
  let effectivePourCrew = crew;
  let effectiveShift = shift;

  // Night shift premium (§ 116 ZP: min. +10%)
  const NIGHT_PREMIUM = 0.10;
  let pourNightPremiumCZK = 0;
  let numPourShifts = 1;

  if (isContinuousPour && pourResult.total_pour_hours > shift) {
    // Continuous pour exceeds normal shift — can't stop, no work joints allowed.
    concreteDays = 1;

    // Czech labor law (§ 83 Zákoník práce): max shift = 12 hours.
    // For pours > 12h: crew relief (střídání čet) — fresh crew replaces tired one.
    const MAX_LEGAL_SHIFT = 12;

    if (pourResult.total_pour_hours <= MAX_LEGAL_SHIFT) {
      // Fits in one extended shift (up to 12h legal max)
      effectiveShift = pourResult.total_pour_hours;
      const maxCrew = 15;
      effectivePourCrew = Math.min(maxCrew, Math.max(crew, Math.ceil((crew * pourResult.total_pour_hours) / shift)));

      warnings.push(
        `[Záběr ${pourDecision.tact_volume_m3} m³] Monolitická zálivka: nutno zalít v jednom záběru bez přerušení. ` +
        `Doporučeno navýšit osádku na ${effectivePourCrew} pracovníků, ` +
        `směna ${roundTo(effectiveShift, 1)}h. ` +
        (effectiveShift > 10 ? `Příplatek za přesčas (25%) od 10. hodiny.` : '')
      );
    } else {
      // Pour > 12h: multi-shift operation (střídání čet)
      // Each shift max 12h, crews rotate.
      numPourShifts = Math.ceil(pourResult.total_pour_hours / MAX_LEGAL_SHIFT);
      effectiveShift = MAX_LEGAL_SHIFT;
      const maxCrew = 15;
      effectivePourCrew = Math.min(maxCrew, Math.max(crew, Math.ceil((crew * MAX_LEGAL_SHIFT) / shift)));
      const nightHours = Math.max(0, pourResult.total_pour_hours - MAX_LEGAL_SHIFT);
      pourNightPremiumCZK = roundTo(nightHours * effectivePourCrew * wagePour * NIGHT_PREMIUM, 2);

      warnings.push(
        `[Záběr ${pourDecision.tact_volume_m3} m³, ${roundTo(pourResult.total_pour_hours, 1)}h] ` +
        `Monolitická zálivka: nutno zalít bez přerušení. Zákoník práce max. 12h/směna — ` +
        `nutné střídání čet (${numPourShifts} směny × ${effectivePourCrew} pracovníků). ` +
        `Noční směna: +${nightHours.toFixed(1)}h s příplatkem +10% (§ 116 ZP).`
      );
    }

    log.push(`Continuous pour: ${pourResult.total_pour_hours}h → 1 day, ` +
      `${numPourShifts} shift(s), crew ${crew}→${effectivePourCrew}, ` +
      `shift ${shift}→${roundTo(effectiveShift, 1)}h`);
  } else {
    // Normal pour: calculate days from hours
    concreteDays = Math.max(1, roundTo(pourResult.total_pour_hours / shift, 2));
    // For very small pours (< half shift), still count as 1 day minimum
    if (concreteDays < 1) concreteDays = 1;
  }

  // Strategy comparison (now with actual rebar + concrete days)
  const strategiesWithRebar = calculateStrategiesDetailed({
    assembly_days: assemblyDays,
    rebar_days: rebarResult.duration_days,
    concrete_days: concreteDays,
    curing_days: curingDays,
    disassembly_days: disassemblyDays,
    num_captures: pourDecision.num_tacts,
  });

  // ─── 6b. Prestressing (předpětí) — only for prestressed elements ──────
  let prestressDays = 0;
  if (isPrestressed) {
    const bridgeLength = input.total_length_m ?? 0;
    prestressDays = input.prestress_days_override ??
      (bridgeLength > 200 ? 7 : bridgeLength > 50 ? 5 : 3);
    log.push(`Prestress: ${prestressDays}d (bridge ${bridgeLength}m, is_prestressed=true)`);
  }

  // ─── 7. Element Scheduler (DAG + CPM + RCPSP) ──────────────────────────

  // Multi-bridge monolithic deck: each bridge = 1 tact (T1 = LM, T2 = PM)
  // Override only if pour-decision didn't already produce enough tacts.
  if (isBridgeMonolith && numBridges >= 2 && pourDecision.num_tacts < numBridges) {
    const prevTacts = pourDecision.num_tacts;
    pourDecision.num_tacts = numBridges;
    pourDecision.tact_volume_m3 = roundTo(input.volume_m3 / numBridges, 2);
    pourDecision.num_sections = numBridges;
    pourDecision.section_volume_m3 = pourDecision.tact_volume_m3;
    log.push(`Multi-bridge override: ${prevTacts} → ${numBridges} tacts (1 tact = 1 celý most, ${pourDecision.tact_volume_m3} m³/most)`);
  }

  const scheduleResult = scheduleElement({
    num_tacts: pourDecision.num_tacts,
    num_sets: numSets,
    assembly_days: assemblyDays,
    rebar_days: rebarResult.duration_days,
    concrete_days: concreteDays,
    curing_days: curingDays,
    stripping_days: disassemblyDays,
    prestress_days: prestressDays,
    num_formwork_crews: numFWCrews,
    num_rebar_crews: numRBCrews, // parallel rebar crews across tacts (RCPSP)
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

  // ─── 7a. Prestressing warnings ──────────────────────────────────────────
  const skruzTotalDays = isPrestressed ? curingDays + prestressDays : curingDays;
  if (isPrestressed) {
    warnings.push(
      `Předpjatá NK: předpětí a injektáž kanálků PŘED odbedněním skruže. ` +
      `Min. ${prestressDays} dní. Skruž stojí celkem ${skruzTotalDays} dní (zrání ${curingDays}d + předpětí ${prestressDays}d).`
    );
  }

  // ─── 7b. Skruž (podpěrná konstrukce / stojky) for horizontal elements ────
  // Applies to ALL elements with needs_supports: mostovka, stropní deska, průvlak, schodiště, rigel
  // skruzMinDays and curingDays already computed above (includes seasonal + maturity).
  // curingDays is enforced per-tact by the scheduler.
  // Here we check if the last tact's hold extends beyond the schedule end.
  if (profile.needs_supports && skruzMinDays > 0) {
    const lastConcreteFinish = Math.max(...scheduleResult.tact_details.map(t => t.concrete[1]), 0);
    const effectiveHoldDays = curingDays;
    const withSkruzHold = Math.max(scheduleResult.total_days, lastConcreteFinish + effectiveHoldDays);

    if (withSkruzHold > scheduleResult.total_days) {
      const delta = roundTo(withSkruzHold - scheduleResult.total_days, 2);
      scheduleResult.total_days = roundTo(withSkruzHold, 2);
      scheduleResult.savings_days = roundTo(scheduleResult.sequential_days - scheduleResult.total_days, 2);
      scheduleResult.savings_pct = scheduleResult.sequential_days > 0
        ? roundTo((scheduleResult.savings_days / scheduleResult.sequential_days) * 100, 1)
        : 0;
      const normLabel = elementType === 'mostovkova_deska' ? 'ČSN 73 6244' : 'ČSN EN 13670';
      warnings.push(
        `Podpěrná konstrukce (skruž/stojky): minimální doba ponechání ${effectiveHoldDays} dní od poslední betonáže ` +
        `(sezóna "${seasonForCuring}": ${normLabel} min. ${skruzMinDays}d). Harmonogram prodloužen o ${delta} dní.`
      );
      log.push(`Props hold: ${effectiveHoldDays}d (min=${skruzMinDays}d, sezóna="${seasonForCuring}", ${normLabel}), ` +
        `last CON ${roundTo(lastConcreteFinish, 2)}d => total ${roundTo(withSkruzHold, 2)}d (+${delta}d)`);
    }

    // For monolithic pours of horizontal elements: full area support is mandatory
    if (pourDecision.pour_mode === 'monolithic') {
      warnings.push(
        `${profile.label_cs} bez spár: celá plocha = jeden záběr. ` +
        `Podpěrná konstrukce musí pokrýt celou plochu (${fwArea} m²). ` +
        `Nelze postupně přestavovat — podpěry zůstávají po dobu min. ${effectiveHoldDays} dní.`
      );
      log.push(`Monolithic horizontal element: full-area support required (${fwArea} m²), hold ${effectiveHoldDays}d`);
    }
  }

  // Bridge-deck advice: with one kit/crew, bridges can still be prepared in staged manner,
  // but monolithic pours must run as separate uninterrupted operations.
  if (isBridgeMonolith && numBridges >= 2 && (numSets < numBridges || numFWCrews < numBridges)) {
    warnings.push(
      `Souběžná betonáž 2 mostů není reálná (soupravy: ${numSets}/${numBridges}, čety: ${numFWCrews}/${numBridges}). ` +
      `Prakticky: betonáž po mostech (L → P), při možnosti paralelně připravovat bednění.`
    );
    log.push(`Bridge pour sequencing required by resources: sets=${numSets}/${numBridges}, crews=${numFWCrews}/${numBridges}`);
  }

  // ─── 7c. Props (podpěry / stojky / skruž) ─────────────────────────────
  let propsResult: PropsCalculatorResult | undefined;
  if (profile.needs_supports && input.height_m && input.height_m > 0) {
    propsResult = calculateProps({
      element_type: elementType,
      height_m: input.height_m,
      formwork_area_m2: fwArea,
      hold_days: skruzMinDays > 0 ? skruzMinDays : curingDays,
      crew_size: crew,
      shift_h: shift,
      k,
      wage_czk_h: wageFormwork,
      num_tacts: pourDecision.num_tacts,
    });
    warnings.push(...propsResult.warnings);
    log.push(`Props: ${propsResult.system.name}, ${propsResult.num_props_per_tact} ks/tact, ` +
      `rental ${propsResult.rental_days}d, total ${propsResult.total_cost_czk} Kč`);
    log.push(...propsResult.log.map(l => `  props: ${l}`));
  } else if (profile.needs_supports && !input.height_m) {
    warnings.push(
      `${profile.label_cs} vyžaduje podpěrnou konstrukci (stojky/skruž), ` +
      `ale není zadána výška. Zadejte výšku pro výpočet podpěr, počtu stojek a nákladů na pronájem.`
    );
    log.push(`Props: skipped — height_m not provided for element with needs_supports=true`);
  }

  // ─── 8. Cost Summary ──────────────────────────────────────────────────

  const formworkLaborCZK = threePhase.total_cost_labor;
  const rebarLaborCZK = rebarResult.cost_labor * pourDecision.num_tacts;
  // Pour labor: crew × hours × wage per tact × num_tacts
  // Overtime premium 25% applies after standard shift (§ 114 ZP)
  // Night premium 10% applies for hours in night shifts (§ 116 ZP)
  const overtimeThreshold = shift; // use configured shift, not hardcoded 10
  const actualPourHours = isContinuousPour ? effectiveShift : pourResult.total_pour_hours;
  const regularHours = Math.min(overtimeThreshold, actualPourHours);
  const overtimeHours = Math.max(0, actualPourHours - overtimeThreshold);
  const laborPerWorkerPerTact = (regularHours * wagePour) + (overtimeHours * wagePour * 1.25);
  // For multi-shift pours: each shift pays full crew, plus night premium
  const pourLaborCZK = roundTo(
    laborPerWorkerPerTact * effectivePourCrew * numPourShifts * pourDecision.num_tacts +
    pourNightPremiumCZK * pourDecision.num_tacts,
    2,
  );

  // Rental cost (monthly → daily). User override takes precedence over catalog.
  const rentalDaysPerSet = scheduleResult.total_days + 2; // +2 for transport
  const rentalRate = input.rental_czk_override ?? fwSystem.rental_czk_m2_month;
  const formworkRentalCZK = rentalRate > 0
    ? roundTo(fwArea * rentalRate * (rentalDaysPerSet / 30) * numSets, 2)
    : 0;
  if (input.rental_czk_override !== undefined) {
    log.push(`Rental: user override ${rentalRate} Kč/${fwSystem.unit}/měs (catalog: ${fwSystem.rental_czk_m2_month})`);
  }

  // Props costs
  const propsLaborCZK = propsResult?.labor_cost_czk ?? 0;
  const propsRentalCZK = propsResult?.rental_cost_czk ?? 0;

  const totalLaborCZK = roundTo(formworkLaborCZK + rebarLaborCZK + pourLaborCZK + propsLaborCZK, 2);

  // ─── 8b. Obrátkovost (repetitive elements) ────────────────────────────

  const numIdentical = input.num_identical_elements ?? 1;
  const fwSetsCount = input.formwork_sets_count ?? numSets;
  const TRANSFER_TIME_DAYS = 0.5; // demontáž + přesun + montáž na novém místě

  let obratkovostResult: PlannerOutput['obratkovost'] = undefined;

  if (numIdentical > 1) {
    const obratkovost = Math.ceil(numIdentical / fwSetsCount);
    const totalDuration = obratkovost * (scheduleResult.total_days + TRANSFER_TIME_DAYS);
    const rentalPerElement = formworkRentalCZK > 0
      ? roundTo(formworkRentalCZK / numIdentical, 2)
      : 0;

    obratkovostResult = {
      num_identical_elements: numIdentical,
      formwork_sets_count: fwSetsCount,
      obratkovost,
      rental_per_element_czk: rentalPerElement,
      total_duration_days: roundTo(totalDuration, 1),
      transfer_time_days: TRANSFER_TIME_DAYS,
    };

    log.push(
      `Obrátkovost: ${numIdentical} identických × ${fwSetsCount} sad → ${obratkovost}× obrátka, ` +
      `doba ${totalDuration.toFixed(1)} dní (vč. přesunu ${TRANSFER_TIME_DAYS}d)`
    );
    warnings.push(
      `Obrátkovost: ${numIdentical} identických elementů, ${fwSetsCount} sad bednění → ` +
      `${obratkovost}× obrátka. Pronájem na element: ${rentalPerElement.toLocaleString('cs')} Kč. ` +
      `Celková doba: ${totalDuration.toFixed(1)} dní.`
    );
  }

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
      shape_correction: shapeCorrection,
    },
    obratkovost: obratkovostResult,
    rebar: rebarResult,
    pour: pourResult,
    schedule: scheduleResult,
    resources: {
      total_formwork_workers: numFWCrews * crew,
      total_rebar_workers: numRBCrews * crewRebar,
      num_formwork_crews: numFWCrews,
      num_rebar_crews: numRBCrews,
      crew_size_formwork: crew,
      crew_size_rebar: crewRebar,
      shift_h: shift,
      wage_formwork_czk_h: wageFormwork,
      wage_rebar_czk_h: wageRebar,
      wage_pour_czk_h: wagePour,
      pour_shifts: numPourShifts,
    },
    lateral_pressure: lateralPressure,
    pour_stages: pourStages,
    ...(isPrestressed ? {
      prestress: {
        days: prestressDays,
        crew_size: 5,
        skruz_total_days: skruzTotalDays,
      },
    } : {}),
    props: propsResult,
    costs: {
      formwork_labor_czk: formworkLaborCZK,
      rebar_labor_czk: rebarLaborCZK,
      pour_labor_czk: pourLaborCZK,
      pour_night_premium_czk: pourNightPremiumCZK * pourDecision.num_tacts,
      total_labor_czk: totalLaborCZK,
      formwork_rental_czk: formworkRentalCZK,
      props_labor_czk: propsLaborCZK,
      props_rental_czk: propsRentalCZK,
    },
    norms_sources: {
      formwork_assembly: `${fwSystem.name}: ${adjustedNorms.assembly_h_m2} h/m² ` +
        `(základ ${fwSystem.assembly_h_m2} h/m² × faktor obtížnosti ${adjustedNorms.difficulty_factor}). ` +
        `Zdroj: FORMWORK_SYSTEMS (element-classifier.ts, data z katalogů Doka/PERI/NOE)`,
      formwork_disassembly: `${fwSystem.name}: ${adjustedNorms.disassembly_h_m2} h/m² ` +
        `(základ ${fwSystem.disassembly_h_m2} h/m² × ${adjustedNorms.difficulty_factor}). Zdroj: katalog výrobce`,
      rebar: `${rebarResult.norm_h_per_t} h/t (typ: ${rebarResult.mass_source}). ` +
        `Zdroj: REBAR_NORMS (element-classifier.ts, ČSN 73 0210, oborové průměry)`,
      curing: maturityParams
        ? `ČSN EN 13670 Tab. NA.2: ${curingDays} dní při ${temperature}°C, ` +
          `${maturityParams.concrete_class}, ${maturityParams.cement_type || 'CEM_I'}`
        : `Výchozí: ${curingDays} dní (24h strip_wait). Pro přesnější odhad zadejte třídu betonu a teplotu`,
      ...(elementType === 'mostovkova_deska' ? {
        skruz: `ČSN 73 6244: min. 21 dní od poslední betonáže. ` +
          `Porovnáno se zráním dle ČSN EN 13670 — použita delší hodnota.`,
      } : {}),
    },
    monte_carlo: scheduleResult.monte_carlo,
    deadline_check: checkDeadline(input, scheduleResult.total_days, totalLaborCZK + formworkRentalCZK, {
      pourDecision, assemblyDays, rebarResult, concreteDays, curingDays, disassemblyDays,
      numFWCrews, numRBCrews, numSets, maturityParams, fwArea, fwSystem,
      wageFormwork, wageRebar, wagePour, crew, crewRebar, shift, k,
    }),
    warnings,
    decision_log: [...log, ...pourDecision.decision_log],
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Estimate formwork area when not given.
 *
 * When height is available (foundations, walls, piers):
 *   footprint = volume / height
 *   Assume aspect ratio ~3:1 for vertical elements (validated on real pier data)
 *   W = sqrt(footprint / 3), L = 3W
 *   perimeter = 2(L + W)
 *   formwork = perimeter × height  (only side faces — top is open for pour)
 *
 * When height is NOT available (slabs, other horizontal):
 *   Cube-root fallback: 4 × (volume_per_tact)^(2/3)
 *
 * @param totalVolume_m3 - Total concrete volume
 * @param numTacts - Number of pour tacts
 * @param height_m - Element height (optional)
 * @param orientation - 'vertical' or 'horizontal'
 */
function estimateFormworkArea(
  totalVolume_m3: number,
  numTacts: number,
  height_m?: number,
  orientation?: string,
  totalLength_m?: number,
): number {
  const volumePerTact = totalVolume_m3 / numTacts;

  // For vertical elements with known height: perimeter × height
  if (height_m && height_m > 0 && orientation !== 'horizontal') {
    const footprint = volumePerTact / height_m;
    // Aspect ratio ~3:1 (typical for pier foundations, validated on real data:
    //   pilíř 12.6×4.2m → ratio 3.0, pilíř 11.8×4.2m → ratio 2.81)
    const aspectRatio = 3;
    const W = Math.sqrt(footprint / aspectRatio);
    const L = aspectRatio * W;
    const perimeter = 2 * (L + W);
    const estimated = roundTo(perimeter * height_m, 1);
    return Math.max(estimated, 5);
  }

  // For horizontal elements: plan area = volume / thickness
  // Bridge decks: total plan area = length × width; width = volume / (length × thickness)
  // Thickness estimated as volume / plan_area, or if length known: width = volume / (length × ~0.6m)
  if (orientation === 'horizontal') {
    if (totalLength_m && totalLength_m > 0) {
      // Known length: plan area ≈ volume / avg_thickness (typical 0.5-1.0m for bridge decks)
      // Better: width = volume / (length × thickness_est). For mostovka: 0.55-0.8m avg
      const avgThickness = 0.6; // conservative default for bridge decks
      const planArea = totalVolume_m3 / avgThickness;
      return Math.max(roundTo(planArea / numTacts, 1), 5);
    }
    // No length: estimate plan area = volume / typical_thickness
    const avgThickness = 0.5; // conservative for slabs (150-300mm) and decks (500-1000mm)
    const planArea = volumePerTact / avgThickness;
    return Math.max(roundTo(planArea, 1), 5);
  }

  // Fallback: cube-root heuristic (4 vertical faces)
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

// ─── Deadline Check & Optimization ──────────────────────────────────────────

interface DeadlineContext {
  pourDecision: PourDecisionOutput;
  assemblyDays: number;
  rebarResult: RebarLiteResult;
  concreteDays: number;
  curingDays: number;
  disassemblyDays: number;
  numFWCrews: number;
  numRBCrews: number;
  numSets: number;
  maturityParams: any;
  fwArea: number;
  fwSystem: FormworkSystemSpec;
  wageFormwork: number;
  wageRebar: number;
  wagePour: number;
  crew: number;
  crewRebar: number;
  shift: number;
  k: number;
}

/**
 * Always compute resource optimization variants (faster/cheaper alternatives).
 * If deadline_days is set, additionally check overrun and mark fitting variants.
 *
 * Optimization space (grid search, bounded to prevent explosion):
 *   - num_formwork_crews: current .. min(current+3, num_tacts)
 *   - num_rebar_crews:    current .. min(current+3, num_tacts)
 *   - num_sets:           current .. min(current+3, num_tacts)
 */
function checkDeadline(
  input: PlannerInput,
  calculatedDays: number,
  currentTotalCost: number,
  ctx: DeadlineContext,
): DeadlineCheckResult {
  const deadline = (input.deadline_days && input.deadline_days > 0) ? input.deadline_days : undefined;
  const overrun = deadline ? Math.max(0, roundTo(calculatedDays - deadline, 1)) : 0;
  const fits = deadline ? calculatedDays <= deadline : true;

  // ─── Try optimization variants ──────────────────────────────
  const numTacts = ctx.pourDecision.num_tacts;
  const maxCrews = Math.min(numTacts, 4);   // practical ceiling
  const maxSets = Math.min(numTacts, 6);

  const variants: DeadlineOptimizationVariant[] = [];

  for (let fwC = ctx.numFWCrews; fwC <= maxCrews; fwC++) {
    for (let rbC = ctx.numRBCrews; rbC <= maxCrews; rbC++) {
      for (let sets = ctx.numSets; sets <= maxSets; sets++) {
        // Skip the current configuration (already computed)
        if (fwC === ctx.numFWCrews && rbC === ctx.numRBCrews && sets === ctx.numSets) continue;

        try {
          const sched = scheduleElement({
            num_tacts: numTacts,
            num_sets: sets,
            assembly_days: ctx.assemblyDays,
            rebar_days: ctx.rebarResult.duration_days,
            concrete_days: ctx.concreteDays,
            curing_days: ctx.curingDays,
            stripping_days: ctx.disassemblyDays,
            num_formwork_crews: fwC,
            num_rebar_crews: rbC,
            rebar_lag_pct: 50,
            scheduling_mode: ctx.pourDecision.scheduling_mode,
            cure_between_neighbors_days: ctx.pourDecision.cure_between_neighbors_h / 24,
            maturity_params: ctx.maturityParams,
          });

          const days = sched.total_days;
          // Only keep variants that are actually faster
          if (days >= calculatedDays) continue;

          // Estimate cost for this variant
          const rentalDays = days + 2;
          const rentalRate = ctx.fwSystem.rental_czk_m2_month;
          const rentalCZK = rentalRate > 0
            ? roundTo(ctx.fwArea * rentalRate * (rentalDays / 30) * sets, 2)
            : 0;
          const fwLabor = ctx.fwSystem.assembly_h_m2 * ctx.fwArea * ctx.wageFormwork +
                          ctx.fwSystem.disassembly_h_m2 * ctx.fwArea * ctx.wageFormwork;
          const rbLabor = ctx.rebarResult.cost_labor * numTacts;
          const totalCost = roundTo(fwLabor + rbLabor + rentalCZK, 0);

          const fitsDeadline = deadline ? days <= deadline : true;
          const label = `${fwC} čet bednění, ${rbC} čet výztuže, ${sets} sad`;

          variants.push({
            label,
            num_formwork_crews: fwC,
            num_rebar_crews: rbC,
            num_sets: sets,
            total_days: days,
            total_cost_czk: totalCost,
            extra_cost_czk: roundTo(totalCost - currentTotalCost, 0),
            fits_deadline: fitsDeadline,
          });
        } catch {
          // Skip invalid combinations
        }
      }
    }
  }

  // Sort all faster variants by cost (cheapest first)
  variants.sort((a, b) => a.total_cost_czk - b.total_cost_czk);

  const cheapestFaster = variants[0];
  const fastest = variants.length > 0
    ? variants.reduce((a, b) => a.total_days < b.total_days ? a : b)
    : undefined;
  const bestForDeadline = deadline
    ? variants.filter(v => v.fits_deadline).sort((a, b) => a.total_cost_czk - b.total_cost_czk)[0]
    : undefined;

  return {
    deadline_days: deadline,
    calculated_days: calculatedDays,
    overrun_days: overrun,
    fits,
    suggestions: variants.slice(0, 5),
    cheapest_faster: cheapestFaster,
    fastest,
    best_for_deadline: bestForDeadline,
  };
}
