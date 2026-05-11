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
import { calculateCuring, PROPS_MIN_DAYS, getDefaultCuringClass } from './maturity.js';
import type { ConcreteClass, CementType, ElementType, Season, ConstructionType, CuringClass } from './maturity.js';
import type { ElementProfile } from '../classifiers/element-classifier.js';
import type { ResourceCeiling, CeilingViolation, EngineeringDemand } from './resource-ceiling.js';
import { applyResourceCeilingDefaults, checkCeilingFeasibility } from './resource-ceiling.js';
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';
import { calculateProps } from './props-calculator.js';
import type { PropsCalculatorResult } from './props-calculator.js';

import { classifyElement, getElementProfile, recommendFormwork, getAdjustedAssemblyNorm, getFilteredFormworkSystems, getSuitableSystemsForElement, checkVolumeGeometry } from '../classifiers/element-classifier.js';
import { decidePourMode } from './pour-decision.js';
import { calculateFormwork, calculateThreePhaseFormwork, calculateStrategiesDetailed } from './formwork.js';
import { calculateRebarLite } from './rebar-lite.js';
import { calculatePourTask } from './pour-task-engine.js';
import { scheduleElement } from './element-scheduler.js';
import { findFormworkSystem, findMssSystem, FORMWORK_SYSTEMS } from '../constants-data/formwork-systems.js';
import { calculateLateralPressure, suggestPourStages, inferPourMethod, filterFormworkByPressure } from './lateral-pressure.js';
import type { LateralPressureResult, PourStagesSuggestion, PourMethod, ConcreteConsistency } from './lateral-pressure.js';
import { recommendBridgeTechnology, calculateMSSCost, calculateMSSSchedule, getMSSTactDays } from './bridge-technology.js';
import type { ConstructionTechnology, TechnologyRecommendation, MSSCostResult, MSSScheduleResult } from './bridge-technology.js';
// 2026-04-15: pile-specific engine. Routed via early branch in planElement
// when element_type === 'pilota'. Bypasses formwork, lateral-pressure and
// props entirely — soil is the form, no boční tlak, no skruž.
import { calculatePileDrilling } from './pile-engine.js';
import type { PileInput, PileResult, PileGeology, PileCasingMethod } from './pile-engine.js';

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
  /** Height from ground/floor to underside of element (m). Used for props calculation.
   *  For mostovkova_deska: this is the prop height (terén → spodek desky), typ. 4–20 m.
   *  For the deck cross-section thickness, use deck_thickness_m (separate field). */
  height_m?: number;
  /**
   * Mostovka A1 (2026-04-16): deck cross-section thickness (m). Optional override.
   * When omitted and span_m × nk_width_m are set, auto-derived as volume_m3 / (span_m × nk_width_m).
   * Used for bridge-deck sanity check and deck-specific warnings only — the engine's
   * formwork/pressure math still reads height_m (prop height) for mostovka.
   */
  deck_thickness_m?: number;
  /**
   * Lost formwork area (m²) — trapezoidal steel sheet (trapézový plech) that
   * stays in the structure permanently. This area does NOT need system formwork
   * (Dokaflex, TRIO, etc.) — only the remaining perimeter/edges do.
   * Props are still needed on the FULL area (TP does not support itself).
   * Only applicable to horizontal elements (stropni_deska, zakladova_deska, mostovkova_deska).
   */
  lost_formwork_area_m2?: number;

  // --- Rebar ---
  /** Exact rebar mass (kg). If not given, estimated from element type. */
  rebar_mass_kg?: number;
  /**
   * Main-bar diameter (mm). Optional. When provided, `calculateRebarLite`
   * looks up h/t norm in `REBAR_RATES_MATRIX[category][diameter]` instead of
   * the legacy per-element default. Typical values: D12 walls, D20 slabs,
   * D25 pilíře, D10 římsy.
   */
  rebar_diameter_mm?: number;

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
  /**
   * Concrete consistency (DIN 18218) — primary driver of lateral pressure k.
   * Default: 'standard' (k=0.85). Use 'scc' ONLY for self-consolidating concrete.
   */
  concrete_consistency?: ConcreteConsistency;
  /**
   * BUG-4: Are pracovní spáry (working joints) allowed when the element has
   * NO dilatační spáry?
   *   - 'no' (default for backward compat): strictly monolithic, 1 záběr
   *   - 'yes': sectioning by pour-window capacity is allowed
   *   - 'unknown': same as 'yes' but emits an "ověřte v RDS" warning
   */
  working_joints_allowed?: 'yes' | 'no' | 'unknown';
  /**
   * BUG-2: Optional target pour window (h) for the alternative pump scenario.
   * If set, a "target window" pump count is computed alongside the actual one.
   */
  target_pour_window_h?: number;

  // --- Maturity (optional, auto-calculates curing) ---
  concrete_class?: ConcreteClass;
  cement_type?: CementType;
  /** Average ambient temperature (°C). Default: 15 */
  temperature_c?: number;
  /** Curing class per TKP18 §7.8.3: 2=standard, 3=substructure, 4=superstructure.
   *  When not set, auto-derived from element_type via getDefaultCuringClass(). */
  curing_class?: CuringClass;

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
  /**
   * Task 4 (2026-04): preferred formwork manufacturer pre-filter. When set,
   * the catalog is filtered to the given vendor BEFORE pressure / category
   * filtering runs. If no system from the chosen vendor passes the
   * downstream filters, the orchestrator falls back to the full catalog
   * and emits a warning so the user is never stuck with zero options.
   * Empty string or undefined = Auto (no pre-filter).
   */
  preferred_manufacturer?: string;
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

  /**
   * Block A (2026-04): hierarchical sections × záběry per section.
   * The new sidebar UI sends these instead of the legacy
   * has_dilatacni_spary + num_tacts_override pair. When set, the
   * orchestrator pre-computes total tacts as
   *   num_dilatation_sections × tacts_per_section
   * and routes through the existing num_tacts_override path (so Block D
   * pump rebuild and Block C working-joints warnings keep working).
   */
  num_dilatation_sections?: number;
  /**
   * Optional manual override for záběry per section. When undefined the
   * orchestrator runs decidePourMode for one section's volume to derive
   * the auto-count from pump capacity (respecting working_joints_allowed).
   */
  tacts_per_section?: number;

  /** Per-záběr volumes (m³) for manual záběry with individual sizes.
   *  Length must equal num_tacts_override. Sum should approximate volume_m3.
   *  When provided, each záběr gets its own pour duration calculation. */
  tact_volumes?: number[];

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
  /** Prestressing duration override (days). Auto-calculated if not given. */
  prestress_days_override?: number;
  /** Number of prestress cables (for stressing + grouting duration calc). */
  prestress_cables_count?: number;
  /** Tensioning method: one-sided (~6/day) or both-sides (~10/day). Default both. */
  prestress_tensioning?: 'one_sided' | 'both_sides';

  // --- Bridge deck subtype ---
  /** Bridge deck cross-section subtype. Affects difficulty factor and warnings. */
  bridge_deck_subtype?: 'deskovy' | 'jednotram' | 'dvoutram' | 'vicetram' | 'jednokomora' | 'dvoukomora' | 'ramovy' | 'sprazeny';

  // --- Bridge geometry (mostovka only) ---
  /** Span length of the longest span (m). For technology recommendation. */
  span_m?: number;
  /** Number of bridge spans. */
  num_spans?: number;
  /** NK width (m). For MSS area calculation. */
  nk_width_m?: number;
  /** Construction technology override. Auto-recommended if not given. */
  construction_technology?: 'fixed_scaffolding' | 'mss' | 'cantilever';
  /** MSS tact duration override (days per span). Auto from deck subtype if not given. */
  mss_tact_days?: number;
  /** MSS mobilization cost override (Kč). */
  mss_mobilization_czk?: number;
  /** MSS monthly rental override (Kč/month). */
  mss_rental_czk_month?: number;

  // --- Exposure classes ---
  /** Concrete exposure class (e.g. 'XF2', 'XD3', 'XF4'). Legacy single-string
   *  API — prefer `exposure_classes`. If only this is set, the engine auto-
   *  wraps it into `[exposure_class]` before running combined-rules logic. */
  exposure_class?: string;
  /** Task 2 (2026-04-20): full selection per ČSN EN 206+A2 — concrete is
   *  typically exposed to multiple simultaneous actions (e.g. XF2 + XD1 +
   *  XC4 for bridge decks). Engine uses max/min rules across the array. */
  exposure_classes?: string[];

  // --- Options ---
  /** Run Monte Carlo simulation. Default: false */
  enable_monte_carlo?: boolean;
  /** Monte Carlo iterations. Default: 10000 */
  monte_carlo_iterations?: number;

  // --- Deadline constraint ---
  /** Investor/project deadline in working days. If total_days exceeds this,
   *  the system warns and suggests optimized resource configurations.
   *
   *  POZN: `resource_ceiling.time.deadline_days` má precedenci pokud je obě
   *  nastavené. Tato top-level pole zůstává jako alias pro backward compat. */
  deadline_days?: number;

  // --- Resource ceiling (Phase 1 — task §5 + audit R1) -----------------------
  /**
   * Strop dostupných zdrojů na element (lidé per profession, soupravy
   * bednění, čerpadla, jeřáby, deadline, ...). Engine NIKDY nepřekročí
   * user-supplied strop (confidence 0.99). Pokud strop chybí, engine
   * auto-fillne defaults z `B4_production_benchmarks/default_ceilings/<el>.yaml`
   * (confidence 0.85) a UI banner ukáže *"Použity typické zdroje pro X.
   * Upravit?"*.
   *
   * Per `Monolit-Planner/shared/src/calculators/resource-ceiling.ts`:
   *   - `applyResourceCeilingDefaults()` resolve při planElement entry
   *   - `checkCeilingFeasibility()` před každým crew/pump rozhodnutím
   *   - INFEASIBLE → ⛔ KRITICKÉ warning + best-effort plán
   *
   * Engine integration: Foundation C commits (pour-decision, pour-task,
   * element-scheduler). Tato pole je v Foundation B jen plumbing — engines
   * ho zatím nečtou.
   */
  resource_ceiling?: ResourceCeiling;

  // --- Pile-specific (2026-04-15) ----------------------------------------
  // These fields are read ONLY when element_type === 'pilota'. They feed
  // the parallel pile engine (pile-engine.ts) which bypasses formwork +
  // lateral-pressure entirely. All optional — sensible defaults applied
  // (Ø600 CFA cohesive geology, length 10m, count derived from volume).
  /** Pile diameter in millimetres (typ. 400, 500, 600, 750, 900, 1200, 1500). */
  pile_diameter_mm?: number;
  /** Pile length in metres. */
  pile_length_m?: number;
  /** Number of piles. If omitted, derived from volume_m3 ÷ volume per pile. */
  pile_count?: number;
  /** Geology that drives the productivity table. */
  pile_geology?: PileGeology;
  /** Drilling/casing method. */
  pile_casing_method?: PileCasingMethod;
  /** Reinforcement index in kg of rebar per m³ of concrete (typ. 30–60, default 40). */
  pile_rebar_index_kg_m3?: number;
  /** Drilling rig day rate in Kč per shift. Default 25 000. */
  pile_rig_czk_per_shift?: number;
  /** Crane day rate in Kč per shift. Default 8 000. */
  pile_crane_czk_per_shift?: number;
  /** Optional pile cap (hlavice) — small ŽB patka above the pile. */
  has_pile_cap?: boolean;
  pile_cap_length_m?: number;
  pile_cap_width_m?: number;
  pile_cap_height_m?: number;
  /**
   * BUG-P2 (2026-04-15): overpouring height in metres (default 0.5 m).
   * The extra 0.3–1.0 m of concrete cast above the design top is chipped
   * away during head adjustment, but the volume had to leave the truck.
   */
  pile_overpouring_m?: number;
  /** BUG-P4: number of CHA (cross-hole analysis) integrity tests. */
  pile_cha_test_count?: number;
  /** BUG-P4: number of PIT (low-strain) integrity tests. */
  pile_pit_test_count?: number;
  /** BUG-P4: CHA price per pile in Kč (default 40 000). */
  pile_cha_test_czk?: number;
  /** BUG-P4: PIT price per pile in Kč (default 5 000). */
  pile_pit_test_czk?: number;
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
  /** Per-záběr volumes when manual záběry with variable sizes are used.
   *  undefined = all záběry have equal volume (pourDecision.tact_volume_m3). */
  tact_volumes?: number[];

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

    // ── MSS path (2026-04-17 Terminology Commit 3) ───────────────────
    /**
     * True when the plan uses MSS (posuvná skruž) — form/skruž/stojky
     * are integrated in one movable rig, per-tact labor collapses to
     * `mss_reuse_factor` of full mount, individual component rentals
     * are 0 (bundled in MSS rental). UI branches on this flag to show
     * the 🌉 MSS card instead of separate Bednění / Skruž / Stojky
     * cards.
     */
    is_mss_path: boolean;
    /** MSS one-off mobilization (tesaři vlastní síly). Already in formwork_labor. */
    mss_mobilization_czk: number;
    /** MSS demobilization (tesaři vlastní síly). Already in formwork_labor. */
    mss_demobilization_czk: number;
    /** MSS monthly rental × months (machine rental, separate from labor). */
    mss_rental_czk: number;
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
    /**
     * BUG-6: Pour crew breakdown for continuous pours.
     * - simultaneous_headcount = workers actively on the front at any moment
     * - rostered_headcount     = total workers in the schedule across all shifts
     * For pours that fit a single shift these two values are equal.
     */
    pour_simultaneous_headcount: number;
    pour_rostered_headcount: number;
    /** True when night-shift premium (§116 ZP) applies */
    pour_has_night_premium: boolean;
    /**
     * MEGA pour Bug 1 (2026-04-16): per-role crew breakdown for the pour
     * front. crew_per_shift is derived from pumps_required via
     *   ukladani  = n_pump × 2  (2 dělníci za každé čerpadlo — vedení hadice + rozprostření)
     *   vibrace   = ceil(n_pump × 1.5)
     *   finiseri  = ceil(n_pump × 1.0)
     *   rizeni    = 3  (stavbyvedoucí + geodet + laborant — fixní)
     *   total     = součet všech čtyř
     * UI can render this as "2 ukládání + 2 vibrace + 1 finiš + 3 řízení
     * = 8 lidí/směna", pour_rostered_headcount = total × pour_shifts.
     */
    pour_crew_breakdown: {
      ukladani: number;
      vibrace: number;
      finiseri: number;
      rizeni: number;
      total: number;
      pumps_used: number;
    };
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

  // --- Resource ceiling (Phase 1 plumbing) ----------------------------------
  /**
   * Effective ceiling po sloučení user input + KB defaults.
   * - source: 'manual' (user supplied, confidence 0.99) | 'kb_default'
   *   (auto-filled from B4, confidence 0.85) | 'auto_derived' (no user + no
   *   KB default, confidence 1.00 — Phase 2-7 elements without defaults yet)
   * - Vždy vyplněné (i prázdné `{}` pro auto_derived case).
   *
   * Foundation B: stačí jen plumbing. Foundation C engine integration ho
   * spotřebuje pro `checkCeilingFeasibility()` a zapíše violations níže.
   */
  resource_ceiling: ResourceCeiling;
  /**
   * Strukturované porušení stropu. Prázdné pole = ceiling feasible nebo
   * engine ještě neimplementoval check pro daný typ. Foundation C engines
   * sem zapisují ⛔ KRITICKÉ / ⚠️ / ℹ️ violations s recovery hints v
   * `warnings[]` (textuální paralelní fronta pro UI banner).
   */
  resource_violations: CeilingViolation[];

  // --- Props (podpěry) — only for horizontal elements with needs_supports ---
  props?: PropsCalculatorResult;

  // --- Bridge technology (only for mostovkova_deska with span_m/num_spans) ---
  bridge_technology?: {
    technology: import('./bridge-technology.js').ConstructionTechnology;
    technology_label_cs: string;
    recommendation: import('./bridge-technology.js').TechnologyRecommendation;
    mss_cost?: import('./bridge-technology.js').MSSCostResult;
    mss_schedule?: import('./bridge-technology.js').MSSScheduleResult;
  };

  // --- Pile-specific output (only when element_type === 'pilota') ---------
  // Populated by the pile branch in planElement (runPilePath). When this
  // field is present, consumers should treat plan.formwork as a no-op
  // sentinel ("Tradiční tesařské", 0 days) and skip the lateral-pressure
  // / props / formwork comparison cards entirely.
  pile?: PileResult;

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
  /**
   * Block E + G2 (2026-04): cost split between labor (constant across
   * variants due to man-hours conservation) and rental (scales with days).
   * UI can show "Práce: 125k =, Pronájem: 42k −18k = 167k −18k" so users
   * see WHY adding crews changes price.
   */
  cost_breakdown: {
    /** formwork + rebar + pour + props labor — constant across variants */
    labor_czk: number;
    /** bednění rental — scales with total_days × num_sets */
    rental_czk: number;
  };
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

/**
 * Exposure-class allow-list per element type (2026-04-17). Extracted
 * from the previous inline RECOMMENDED_EXPOSURE map so both the normal
 * orchestrator path AND the pile early branch (runPilePath) can share
 * the same list when emitting the "⚠️ XF… je neobvyklá" warning.
 */
const RECOMMENDED_EXPOSURE: Partial<Record<StructuralElementType, string[]>> = {
  mostovkova_deska: ['XF2', 'XF4', 'XD1', 'XD3', 'XC4'],
  rimsa: ['XF4', 'XD3'],
  driky_piliru: ['XC4', 'XD3', 'XF2', 'XF4'],
  zaklady_piliru: ['XC2', 'XC4', 'XA1', 'XA2', 'XF1', 'XF3'],
  opery_ulozne_prahy: ['XC4', 'XD1', 'XF1', 'XF2', 'XF3', 'XF4'],
  mostni_zavirne_zidky: ['XF4', 'XF3', 'XD1', 'XC4'],
  operne_zdi: ['XC4', 'XD1', 'XF1'],
  prechodova_deska: ['XC4', 'XD1', 'XF1', 'XF2'],
  podlozkovy_blok: ['XF2', 'XF4', 'XC4'],
  pilota: ['XA1', 'XA2', 'XA3', 'XC2'],
  stropni_deska: ['XC1', 'XC3'],
  stena: ['XC1', 'XC3', 'XF1'],
  zakladova_deska: ['XC2', 'XC4', 'XA1', 'XA2'],
  zakladovy_pas: ['XC2', 'XC4', 'XA1', 'XA2'],
  zakladova_patka: ['XC2', 'XC4', 'XA1', 'XA2'],
};

/** Emits the "⚠️ Třída prostředí …" warning when ANY of the user-provided
 *  exposure classes is outside the typical set for the element type.
 *  Shared by both the main orchestrator path and the pilota early
 *  branch so piloty (XA1/XA2 typical) correctly flag XF4 etc.
 *
 *  Task 2 (2026-04-20): accepts an array of classes. Single-string callers
 *  can pass a 1-element array. When every selected class is OK, no
 *  warning is emitted. When some are OK and some not, each rogue one is
 *  flagged individually so the user knows which to revisit. */
function pushExposureWarning(
  elementType: StructuralElementType,
  exposure_classes: readonly string[] | undefined,
  labelCs: string,
  warnings: string[],
): void {
  if (!exposure_classes || exposure_classes.length === 0) return;
  const recommended = RECOMMENDED_EXPOSURE[elementType];
  if (!recommended) return;
  const rogue = exposure_classes.filter(c => !recommended.includes(c));
  if (rogue.length === 0) return;
  // Phrasing kept compatible with earlier assertions ("Vyberte jednu z: …")
  // while the array-aware path simply lists each rogue class up front.
  warnings.push(
    `⚠️ Třída prostředí ${rogue.join(', ')} ${rogue.length > 1 ? 'jsou neobvyklé' : 'je neobvyklá'} pro ${labelCs}. ` +
    `Vyberte jednu z: ${recommended.join(', ')}. Ověřte s projektem.`
  );
}

/**
 * Pour-front crew size (direct labor only).
 *
 * INCLUDED: úkladka (placers), vibrace (vibrator operators), finiš (finishers).
 * EXCLUDED: stavbyvedoucí, mistr, technický dozor.
 *           → These belong to "Zařízení staveniště" (VRN) category, typically
 *             3–5 % of direct costs per ČSN 73 0212. They are salaried across
 *             the whole project duration, not per pour — including them in a
 *             per-pour headcount double-counts vs. the ZS line item.
 *
 * DESIGN DECISION v4.24 (2026-04-20):
 *   Reconsidered v4.20 formula that added a flat "+3 řízení" per pour.
 *   Issue: double-counting with monthly-salaried site management.
 *   Fix: pour crew = workers only. Management in separate overhead category.
 *
 * VOLUME-SCALED LOGIC:
 *   - podkladní beton (plain concrete base, no structural vibration):
 *       <20 m³ → 2 lidi (rozhrnout + zarovnat)
 *       <50 m³ → 3 lidi (přidat zhutnění)
 *       ≥50 m³ → max(3, 2 × pumps)
 *   - Malé objemy (<20 m³) pro ostatní elementy: 3 lidi (2 úkladka + 1 vibrace)
 *   - Střední (20–80 m³): max(4, pumps × 2 + 2)
 *   - Velké (80+ m³): full pump-based formula:
 *       úkladka  = pumps × 2  (hadice + rozprostření)
 *       vibrace  = ceil(pumps × 1.5)  (překrývající zóny)
 *       finišeři = ceil(pumps × 1.0)  (uhlazování za frontou)
 *       total    = úkladka + vibrace + finišeři  (řízení výše NENÍ zahrnuto)
 *
 * Checked points:
 *   VP4 opěrná zeď, 94 m³, 1 pump → Level 3 path → 2+2+1 = 5 ✓
 *   200 m³, 2 pumps  → 4+3+2 = 9 ✓
 *   400 m³, 3 pumps  → 6+5+3 = 14 ✓
 *   1000 m³, 5 pumps → 10+8+5 = 23 ✓
 *   Podkladní beton 10 m³ → 2 ✓
 *   Malá patka 15 m³ → 3 ✓
 */
export interface PourCrewBreakdown {
  ukladani: number;
  vibrace: number;
  finiseri: number;
  /**
   * Always 0 in v4.24+. Retained in the shape so downstream UI code that
   * dereferences `breakdown.rizeni` doesn't crash. New callers should read
   * via the dedicated ZS (Zařízení staveniště) overhead line, not this field.
   */
  rizeni: number;
  total: number;
  pumps_used: number;
}

export function computePourCrew(
  volume_m3: number,
  n_pump: number,
  element_type: StructuralElementType,
): PourCrewBreakdown {
  const pumps = Math.max(1, Math.floor(n_pump));
  const isPodkladni = element_type === 'podkladni_beton';

  // Level 0 — podkladní beton: no structural vibration, just rozhrnout + zarovnat
  if (isPodkladni) {
    let ukladani: number;
    if (volume_m3 < 20) ukladani = 2;
    else if (volume_m3 < 50) ukladani = 3;
    else ukladani = Math.max(3, pumps * 2);
    return {
      ukladani, vibrace: 0, finiseri: 0, rizeni: 0,
      total: ukladani, pumps_used: pumps,
    };
  }

  // Level 1 — malé objemy (<20 m³): minimální osádka
  if (volume_m3 < 20) {
    return {
      ukladani: 2, vibrace: 1, finiseri: 0, rizeni: 0,
      total: 3, pumps_used: pumps,
    };
  }

  // Level 2 — střední objemy (20–80 m³): přidat finišera
  if (volume_m3 < 80) {
    const ukladani = Math.max(2, pumps * 2);
    const vibrace = 1;
    const finiseri = 1;
    const total = Math.max(4, ukladani + vibrace + finiseri);
    return { ukladani, vibrace, finiseri, rizeni: 0, total, pumps_used: pumps };
  }

  // Level 3 — velké objemy (80+ m³): full pump-based formula (řízení NENÍ
  // zahrnuto — patří do "Zařízení staveniště" per ČSN 73 0212).
  const ukladani = pumps * 2;
  const vibrace = Math.ceil(pumps * 1.5);
  const finiseri = Math.ceil(pumps * 1.0);
  return {
    ukladani, vibrace, finiseri, rizeni: 0,
    total: ukladani + vibrace + finiseri,
    pumps_used: pumps,
  };
}

/**
 * @deprecated Use {@link computePourCrew} — this wrapper exists only so
 *   external callers importing the v4.20 name keep compiling. It forwards
 *   to the v4.24 volume+element-aware formula with a large-pour default
 *   (volume=100, element_type='other') that matches the old "+řízení-free"
 *   numbers for pump counts ≥2. For new code, pass volume + element_type.
 */
export function computePourCrewByPumps(n_pump: number): PourCrewBreakdown {
  return computePourCrew(100, n_pump, 'other');
}

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

  // Resource Ceiling Phase 1 (audit R1) — resolve effective ceiling at entry.
  // User input (confidence 0.99) WINS over B4 KB defaults (0.85). For elements
  // without KB defaults yet (Phase 2-7), `applyResourceCeilingDefaults` returns
  // { source: 'auto_derived' } and engines behave unconstrained (current
  // behaviour preserved). Foundation B: plumbing only — engines integration
  // ships in Foundation C commits.
  const effectiveResourceCeiling = applyResourceCeilingDefaults(
    // Element type is not classified yet at this point; pass 'other' as a safe
    // fallback so the merge logic doesn't crash for unknown types. The actual
    // classify-time relevance check happens once we know the type.
    (input.element_type ?? 'other'),
    input.resource_ceiling,
  );
  const resourceViolations: CeilingViolation[] = [];

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

  // ─── 1a. Volume vs geometry sanity (2026-04-17) ──────────────────────
  // Catches the "V=605 m³ for a 310 m × 13 m estakáda" class of input
  // mistakes that slipped past SANITY_RANGES alone (605 m³ is inside
  // 20–2000 m³ mostovka range — but physically 1/7 of real total).
  // Compares input.volume_m3 against span×num_spans×width×subtype_eq
  // for mostovka, or π(Ø/2)²×L×count for pilota. Critical mismatches
  // land at the TOP of warnings[] so the UI surfaces them first.
  const volumeIssue = checkVolumeGeometry(elementType, input.volume_m3, {
    span_m: input.span_m,
    num_spans: input.num_spans,
    nk_width_m: input.nk_width_m,
    bridge_deck_subtype: input.bridge_deck_subtype,
    pile_diameter_mm: input.pile_diameter_mm,
    pile_length_m: input.pile_length_m,
    pile_count: input.pile_count,
  });
  if (volumeIssue) {
    warnings.unshift(volumeIssue.message_cs);
    log.push(
      `Volume-vs-geometry: actual=${volumeIssue.actual_m3} m³, ` +
      `expected=${volumeIssue.expected_m3} m³, ratio=${volumeIssue.ratio}, ` +
      `severity=${volumeIssue.severity}`,
    );
  }

  // ─── 1b. PILOTA early branch (2026-04-15) ─────────────────────────────
  // Bored piles bypass formwork, lateral pressure and props entirely. The
  // soil is the form, there is no boční tlak, no skruž, and 1 pilota = 1
  // záběr. Drilling is the schedule bottleneck (one expensive rig on site),
  // the rebar cage is pre-fabricated, and concrete is placed via tremie or
  // direct discharge — never with a pump. Routing through runPilePath()
  // keeps all that special handling in one place; everything below this
  // branch remains untouched for the other 21 element types.
  if (elementType === 'pilota') {
    return runPilePath(input, profile, log, warnings, {
      crew, crewRebar, shift, k, wage, wageFormwork, wageRebar, wagePour,
      temperature,
    });
  }

  // ─── 2. Lateral Pressure & Formwork System Selection ─────────────────

  // 2a. Calculate lateral pressure if height is known and element is vertical
  let lateralPressure: LateralPressureResult | undefined;
  let pourStages: PourStagesSuggestion | undefined;
  const heightForPressure = input.height_m;
  const isVertical = profile.orientation === 'vertical';

  // BUG-1: default concrete consistency is 'standard' (k=0.85), not 'pump' (k=1.5)
  const consistency: ConcreteConsistency = input.concrete_consistency ?? 'standard';
  const lpOptions = { concrete_consistency: consistency };

  if (heightForPressure && heightForPressure > 0 && isVertical) {
    const pourMethod = input.pour_method ?? inferPourMethod(profile.pump_typical, heightForPressure);
    lateralPressure = calculateLateralPressure(heightForPressure, pourMethod, lpOptions);
    log.push(`Lateral pressure: ${lateralPressure.pressure_kn_m2} kN/m² (h=${heightForPressure}m, k=${lateralPressure.k}, consistency=${consistency})`);

    // Check if pressure-based filtering changes recommendation
    const filterResult = getFilteredFormworkSystems(elementType, heightForPressure, pourMethod, consistency);
    if (filterResult.rejected.length > 0) {
      const rejectedNames = filterResult.rejected.map(s => s.name).join(', ');
      log.push(`Pressure filter: rejected ${filterResult.rejected.length} systems (${rejectedNames})`);
    }
  }

  // 2c. Select formwork system (pressure-aware when height given)
  let fwSystem: FormworkSystemSpec;

  // Terminology Commit 2 (2026-04-17): MSS shortcut. When the user
  // explicitly chose construction_technology='mss' for a bridge deck,
  // return the mss_integrated catalog sentinel (DOKA MSS or VARIOKIT
  // Mobile per preferred_manufacturer). calculateProps below is
  // skipped — MSS carries its own falsework + props. Downstream cost
  // math zeroes formwork + props rentals (they are bundled in the
  // bridge-technology.ts calculateMSSCost mobilization + rental).
  if (input.construction_technology === 'mss' && elementType === 'mostovkova_deska') {
    fwSystem = findMssSystem(input.preferred_manufacturer)
      ?? findFormworkSystem('DOKA MSS')
      ?? FORMWORK_SYSTEMS[0];
    log.push(`Formwork: MSS shortcut → ${fwSystem.name} (pour_role=mss_integrated)`);
  } else if (input.formwork_system_name) {
    const found = findFormworkSystem(input.formwork_system_name);
    if (!found) {
      warnings.push(`Systém bednění "${input.formwork_system_name}" nenalezen — použit doporučený.`);
      fwSystem = recommendFormwork(elementType, heightForPressure, input.pour_method, input.total_length_m, consistency);
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
    fwSystem = recommendFormwork(elementType, heightForPressure, input.pour_method, input.total_length_m, consistency);

    // Task 4 (2026-04): preferred manufacturer pre-filter. Only applies to
    // the auto-recommendation path — when the user picked an explicit
    // formwork_system_name above, we honour it as-is.
    const preferredVendor = input.preferred_manufacturer && input.preferred_manufacturer.trim() !== ''
      ? input.preferred_manufacturer.trim()
      : '';
    if (preferredVendor && fwSystem.manufacturer !== preferredVendor) {
      // Try to find a vendor-matching alternative from the same suitable pool.
      // For vertical elements with height, also respect the lateral-pressure filter.
      const { all: allCandidates } = getSuitableSystemsForElement(elementType);
      let vendorPool = allCandidates.filter(s => s.manufacturer === preferredVendor);
      if (vendorPool.length > 0 && lateralPressure && isVertical && heightForPressure) {
        const filtered = filterFormworkByPressure(
          lateralPressure.pressure_kn_m2,
          vendorPool,
          'vertical',
          heightForPressure,
        );
        if (filtered.suitable.length > 0) vendorPool = filtered.suitable;
        else vendorPool = []; // pool exists but none pass pressure
      }
      if (vendorPool.length > 0) {
        fwSystem = vendorPool[0]; // already sorted by rental × stage_count_penalty
        log.push(`Vendor pre-filter: pinned to ${preferredVendor} → ${fwSystem.name}`);
      } else {
        warnings.push(
          `Žádný systém ${preferredVendor} nevyhovuje technickým požadavkům ` +
          `(orientace, plocha, boční tlak). Ponechán automatický výběr ` +
          `(${fwSystem.manufacturer} ${fwSystem.name}). Zvažte jiného výrobce.`,
        );
        log.push(`Vendor pre-filter: ${preferredVendor} has no feasible system → fallback to auto`);
      }
    }
  }

  const adjustedNorms = getAdjustedAssemblyNorm(elementType, fwSystem);
  log.push(`Formwork: ${fwSystem.name} (${adjustedNorms.assembly_h_m2} h/m², df=${adjustedNorms.difficulty_factor})`);

  // ─── 2d. Formwork-specific warnings ─────────────────────────────────────
  if (fwSystem.needs_crane) {
    // Terminology Commit 6 (2026-04-17): prefix varies per pour_role so
    // "Skruž Top 50 vyžaduje jeřáb (nosník …)" instead of the generic
    // "Top 50 vyžaduje jeřáb (panel …)" — a nosníková skruž doesn't
    // ship as panels, and the UI label already says "Skruž".
    const prefix =
      fwSystem.pour_role === 'falsework'       ? `Skruž ${fwSystem.name}` :
      fwSystem.pour_role === 'mss_integrated'  ? `${fwSystem.name} (MSS)` :
                                                 fwSystem.name;
    const itemNoun = fwSystem.pour_role === 'falsework' ? 'nosník' : 'panel';
    warnings.push(
      `${prefix} vyžaduje jeřáb (${itemNoun} ${fwSystem.max_panel_weight_kg || '150+'} kg) — ` +
      `zajistěte jeřáb na stavbě pro celou dobu montáže.`
    );
  }
  if (heightForPressure && heightForPressure > 1.2 && isVertical) {
    warnings.push(
      `Bednění výška ${heightForPressure}m > 1.2m → nutné stabilizační vzpěry IB (započítány v sestavě).`
    );
  }
  if (lateralPressure && fwSystem.name === 'Frami Xlife' && lateralPressure.pressure_kn_m2 > 60) {
    warnings.push(
      `Boční tlak ${lateralPressure.pressure_kn_m2} kN/m² — Frami Xlife na hranici kapacity. ` +
      `Zvažte Framax Xlife (100 kN/m²) pro vyšší bezpečnost.`
    );
  }

  // ─── 3. Pour Decision ──────────────────────────────────────────────────

  const pourDecision = decidePourMode({
    element_type: elementType,
    volume_m3: input.volume_m3,
    has_dilatacni_spary: input.has_dilatacni_spary,
    spara_spacing_m: input.spara_spacing_m,
    total_length_m: input.total_length_m,
    adjacent_sections: input.adjacent_sections,
    working_joints_allowed: input.working_joints_allowed,
    season: input.season,
    use_retarder: input.use_retarder,
  });

  // Block A — pre-compute total tacts from hierarchical sections × záběry
  // when the new sidebar fields are set. Result feeds the existing
  // num_tacts_override path, which Block D rebuilds (pumps/sub_mode) and
  // which honours working_joints_allowed already (because the auto branch
  // delegates back to decidePourMode for one section's volume).
  let effectiveNumTactsOverride = input.num_tacts_override;
  let effectiveTactVolumeOverride = input.tact_volume_m3_override;
  if (input.num_dilatation_sections !== undefined && input.num_dilatation_sections > 0) {
    const numSections = Math.max(1, Math.floor(input.num_dilatation_sections));
    const sectionVolume = input.volume_m3 / numSections;
    let tactsPerSection: number;
    if (input.tacts_per_section !== undefined && input.tacts_per_section > 0) {
      tactsPerSection = Math.max(1, Math.floor(input.tacts_per_section));
    } else {
      // Auto compute by running decidePourMode for ONE section's volume.
      // working_joints_allowed flows through unchanged so 'no'/'unknown'
      // produce the right záběry-per-section count.
      const subDecision = decidePourMode({
        element_type: elementType,
        volume_m3: sectionVolume,
        has_dilatacni_spary: false,
        working_joints_allowed: input.working_joints_allowed,
        season: input.season,
        use_retarder: input.use_retarder,
      });
      tactsPerSection = subDecision.num_tacts;
    }
    const totalTacts = numSections * tactsPerSection;
    effectiveNumTactsOverride = totalTacts;
    effectiveTactVolumeOverride = input.volume_m3 / totalTacts;
    log.push(`Block A: ${numSections} sekcí × ${tactsPerSection} záběrů/sekce = ${totalTacts} celkem`);
  }

  // Apply user overrides for tacts (foundations, piers, etc.)
  if (effectiveNumTactsOverride && effectiveNumTactsOverride > 0) {
    const overrideN = effectiveNumTactsOverride;
    const overrideTactVol = effectiveTactVolumeOverride
      ?? Math.round((input.volume_m3 / overrideN) * 100) / 100;
    pourDecision.num_tacts = overrideN;
    pourDecision.tact_volume_m3 = overrideTactVol;
    pourDecision.num_sections = overrideN;
    pourDecision.section_volume_m3 = overrideTactVol;
    log.push(`Tacts: MANUAL override → ${pourDecision.num_tacts} tacts × ${pourDecision.tact_volume_m3}m³`);

    // Block D: rebuild derived pump/window fields for the smaller tact volume.
    // Previously we kept the original decidePourMode output (which was computed
    // for the full volume in the monolithic branch), leaving sub_mode='monolit',
    // pumps_required and t_window_hours stale. With override active we treat
    // every tact as an independent sectional pour and recalculate:
    //   - pour_hours_per_tact from the SMALLER volume
    //   - pumps_required = 1 (sectional mode — one pump per tact)
    //   - sub_mode = 'manual_override' to signal the state change
    //   - t_window_hours stays as the raw window (retarder/season unchanged)
    const q_eff = 30;       // matches pour-decision default
    const setup_h = 0.5;
    const washout_h = 0.5;
    const pour_h_per_tact = setup_h + (overrideTactVol / q_eff) + washout_h;
    pourDecision.pour_hours_per_tact = Math.round(pour_h_per_tact * 100) / 100;
    pourDecision.total_pour_hours = Math.round(pour_h_per_tact * overrideN * 100) / 100;
    pourDecision.pour_mode = 'sectional';
    pourDecision.sub_mode = 'manual_override';
    pourDecision.pumps_required = 1;
    pourDecision.backup_pump = false;
    pourDecision.max_sections_per_tact = 1;
    log.push(`Override rebuild: pour/tact=${pourDecision.pour_hours_per_tact}h, pumps=1, sub_mode=manual_override`);
  }
  if (input.scheduling_mode_override) {
    pourDecision.scheduling_mode = input.scheduling_mode_override;
    log.push(`Scheduling mode: MANUAL → ${input.scheduling_mode_override}`);
  }

  // 3b. Apply height-based záběry (pour stages) for vertical elements.
  //
  // E3 (2026-04-15): lateral pressure záběry are now a MINIMUM floor,
  // not an "override-only" branch. Previously this ran only when
  // `!effectiveNumTactsOverride`, which meant a user with any manual
  // override (including the default 1) saw Gantt=1 tact even though the
  // DIN 18218 hint said "3 záběry po 2.7m". The fix:
  //
  //   num_tacts = MAX(volume/spára tacts, pressure-staging tacts)
  //
  // always runs for vertical elements with a height, even when an
  // override is present. The per-záběr pressure from DIN 18218 is a
  // physical constraint: 8m stěna C40/50 literally cannot be poured in
  // one lift because the formwork would burst. The user cannot override
  // physics by clicking "1 záběr".
  if (heightForPressure && heightForPressure > 0 && isVertical) {
    const { all: allCompatible } = getSuitableSystemsForElement(elementType);
    const pourMethod = input.pour_method ?? inferPourMethod(profile.pump_typical, heightForPressure);
    pourStages = suggestPourStages(heightForPressure, pourMethod, allCompatible, lpOptions);

    if (pourStages.needs_staging && pourStages.num_stages > pourDecision.num_tacts) {
      // Height-based staging produces more tacts than the current
      // (volume / spára / override) count → enforce MAX.
      const prevTacts = pourDecision.num_tacts;
      const prevSource = effectiveNumTactsOverride ? 'override' : 'objemová';
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
        `Záběrová betonáž (DIN 18218, E3): výška ${heightForPressure}m vyžaduje ` +
        `${pourStages.num_stages} záběrů po ~${pourStages.stage_height_m}m ` +
        `(plný tlak ${lateralPressure?.pressure_kn_m2} kN/m² překračuje ` +
        `${pourStages.max_system_pressure_kn_m2} kN/m²). ` +
        `Pauza mezi záběry: ${pourStages.cure_between_stages_h}h. ` +
        `Bednění se přesouvá nahoru (${pourStages.num_stages}× obrátka).`
      );
      // Pressure-based staging replaces a manual num_tacts_override too,
      // because it's a physical minimum. Log the override-shadow so the
      // user can see why "1 zaber" became "3 záběry".
      if (prevTacts > 1) {
        log.push(
          `Note: height-based staging (${pourStages.num_stages}) ` +
          `překračuje ${prevSource} tacts (${prevTacts}) — enforced as MIN`,
        );
      }
      // Clear the override flag so downstream audits see an automatic
      // tact count (not a manual override that stops rebuild loops).
      effectiveNumTactsOverride = undefined;
      effectiveTactVolumeOverride = undefined;
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
    // BUG A1 (2026-04-16): resolve the deck cross-section thickness separately
    // from the prop height. Preference order:
    //   1. explicit deck_thickness_m (user override)
    //   2. derived from volume / (span × width) when all three are set
    //   3. undefined — deck_thickness sanity check is skipped
    let effectiveDeckThickness = input.deck_thickness_m;
    if (effectiveDeckThickness === undefined && input.volume_m3 && input.span_m && input.num_spans && input.nk_width_m) {
      const totalDeckArea = input.span_m * input.num_spans * input.nk_width_m;
      if (totalDeckArea > 0) {
        effectiveDeckThickness = Math.round((input.volume_m3 / totalDeckArea) * 100) / 100;
        log.push(`Deck thickness auto-derived: ${input.volume_m3} / (${input.span_m}×${input.num_spans}×${input.nk_width_m}) = ${effectiveDeckThickness} m`);
      }
    }
    if (effectiveDeckThickness !== undefined && (effectiveDeckThickness < 0.3 || effectiveDeckThickness > 2.5)) {
      warnings.push(
        `⚠️ Tloušťka desky ${effectiveDeckThickness} m je mimo typický rozsah 0.3–2.5 m. Ověřte zadání.`
      );
    }

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

  // ─── 3a2b. Bridge construction technology (mostovka only, when geometry given) ──
  let bridgeTechResult: PlannerOutput['bridge_technology'] | undefined;
  if (elementType === 'mostovkova_deska' && input.span_m && input.num_spans) {
    // BUG E1 (2026-04-16): height_m used to silently default to 10 m when
    // missing, which produced bogus "Výška 10m — věže Staxo 100" warnings
    // even if the user never entered a height. Now we warn explicitly so
    // the UI can redirect the user to the výška field.
    const clearanceH = input.height_m ?? 10;
    if (input.height_m === undefined) {
      warnings.push(
        `⚠️ Výška nad terénem (height_m) nezadána — technologie počítána s odhadem 10 m. ` +
        `Zadejte výšku pro přesný výběr skruže (Staxo 40 pod 8 m / Staxo 100 pro 8–20 m).`
      );
    }
    const techRec = recommendBridgeTechnology({
      span_m: input.span_m,
      clearance_height_m: clearanceH,
      num_spans: input.num_spans,
      deck_subtype: input.bridge_deck_subtype,
      is_prestressed: input.is_prestressed,
      nk_width_m: input.nk_width_m,
    });

    const selectedTech = input.construction_technology ?? techRec.recommended;
    const techLabels: Record<ConstructionTechnology, string> = {
      fixed_scaffolding: 'Pevná skruž',
      mss: 'Posuvná skruž (MSS)',
      cantilever: 'Letmá betonáž (CFT)',
    };

    log.push(`Bridge technology: ${selectedTech} (recommended: ${techRec.recommended})`);
    warnings.push(...techRec.warnings);

    // Warn if user overrides to a non-recommended or infeasible technology
    if (input.construction_technology && input.construction_technology !== techRec.recommended) {
      const option = techRec.options.find(o => o.technology === input.construction_technology);
      if (option && !option.feasible) {
        warnings.push(`POZOR: ${techLabels[input.construction_technology]} — ${option.infeasible_reason}`);
      } else if (selectedTech === 'fixed_scaffolding' && input.span_m > 40) {
        warnings.push(
          `Rozpětí ${input.span_m}m — pevná skruž není standardní řešení pro rozpětí > 40m. ` +
          `Zvažte posuvnou skruž (MSS).`
        );
      }
    }

    let mssCost: MSSCostResult | undefined;
    let mssSchedule: MSSScheduleResult | undefined;

    if (selectedTech === 'mss') {
      const nkWidth = input.nk_width_m ?? 12;
      const tactDays = input.mss_tact_days ?? getMSSTactDays(input.bridge_deck_subtype);

      mssSchedule = calculateMSSSchedule(
        input.num_spans, input.bridge_deck_subtype, input.is_prestressed, input.mss_tact_days,
      );
      mssCost = calculateMSSCost({
        span_m: input.span_m,
        num_spans: input.num_spans,
        nk_width_m: nkWidth,
        tact_days: tactDays,
        mobilization_czk_override: input.mss_mobilization_czk,
        rental_czk_month_override: input.mss_rental_czk_month,
      });

      log.push(`MSS schedule: setup ${mssSchedule.setup_days}d + ${mssSchedule.num_tacts}×${mssSchedule.tact_days}d + teardown ${mssSchedule.teardown_days}d = ${mssSchedule.total_days}d`);
      log.push(`MSS cost: mob ${(mssCost.mobilization_czk / 1e6).toFixed(1)}M + rental ${(mssCost.rental_total_czk / 1e6).toFixed(1)}M + demob ${(mssCost.demobilization_czk / 1e6).toFixed(1)}M = ${(mssCost.total_czk / 1e6).toFixed(1)}M Kč (${mssCost.unit_cost_czk_m2} Kč/m²)`);

      // MSS-6 hard lock (2026-04-17): posuvná skruž pracuje pole za
      // polem → num_tacts = num_spans is a physical constraint. If
      // the user still pushed through a manual override via
      // num_dilatation_sections × tacts_per_section (or the legacy
      // num_tacts_override), flag the mismatch loudly. The form-
      // field lock added in the same commit prevents this path in
      // the UI, but engine must stay self-defending for scripted /
      // API callers.
      const manualSections = input.num_dilatation_sections ?? 1;
      const manualTactsPerSection = input.tacts_per_section ?? 1;
      const userTotalTacts = manualSections * manualTactsPerSection;
      const userOverrideTotal = input.num_tacts_override;
      const mssTacts = mssSchedule.num_tacts;
      const overrideValue = userOverrideTotal ?? userTotalTacts;
      if (overrideValue > 1 && overrideValue !== mssTacts) {
        warnings.push(
          `⛔ KRITICKÉ: MSS má ${mssTacts} taktů (= ${input.num_spans} polí). ` +
          `Nelze mít ${overrideValue} záběrů — posuvná skruž pracuje pole za polem. ` +
          `Ručně zadaný počet záběrů ignorován, plán používá ${mssTacts}.`
        );
        log.push(`MSS-6: user override ${overrideValue} tacts ≠ mss_schedule ${mssTacts} → CRITICAL + ignored`);
      }
    }

    if (selectedTech === 'cantilever') {
      warnings.push(
        `Letmá betonáž (CFT): kalkulátor nepočítá detailní náklady. ` +
        `Orientační cena: 25 000–40 000 Kč/m² NK. Kontaktujte dodavatele (DOKA CFT / VSL / Freyssinet).`
      );
    }

    bridgeTechResult = {
      technology: selectedTech,
      technology_label_cs: techLabels[selectedTech],
      recommendation: techRec,
      mss_cost: mssCost,
      mss_schedule: mssSchedule,
    };
  }

  // ─── 3a3. Exposure class validation ─────────────────────────────────────
  // 2026-04-17: RECOMMENDED_EXPOSURE + pushExposureWarning extracted to
  // module level so the pilota early branch (runPilePath) shares the
  // same allow-list. Warning text uses the "⚠️" prefix convention.
  // Task 2 (2026-04-20): array-aware — legacy string wrapped in [x].
  const effectiveExposureClasses = input.exposure_classes
    ?? (input.exposure_class ? [input.exposure_class] : []);
  pushExposureWarning(elementType, effectiveExposureClasses, profile.label_cs, warnings);

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

  // Estimate formwork area if not given.
  // BUG-Z1 follow-up: zaklady_piliru is now horizontal, but a pier footing
  // is a rectangular BLOCK with perimeter-only formwork (top is open for
  // pour, bottom sits on blinding). Pass the element type so the
  // estimator can special-case foundation blocks.
  const fwAreaTotal = input.formwork_area_m2 ?? estimateFormworkArea(
    input.volume_m3, pourDecision.num_tacts, input.height_m, profile.orientation,
    input.total_length_m, elementType,
  );

  // Ztracené bednění (trapézový plech / lost formwork):
  // If user provided lost_formwork_area_m2, subtract it from the area that needs
  // SYSTEM formwork (Dokaflex, TRIO, etc.). Only applies to horizontal elements.
  // Props/shoring still need the FULL area (TP does not support itself).
  const isHorizontal = profile.orientation === 'horizontal';
  const lostFwArea = (isHorizontal && input.lost_formwork_area_m2 && input.lost_formwork_area_m2 > 0)
    ? Math.min(input.lost_formwork_area_m2, fwAreaTotal)  // cap at total
    : 0;
  const fwArea = Math.max(fwAreaTotal - lostFwArea, 0);  // system formwork = total − lost

  log.push(`Formwork area: ${fwArea} m² per tact${input.formwork_area_m2 ? '' : ' (estimated)'}`
    + (lostFwArea > 0 ? ` (total ${fwAreaTotal} m² − ztracené ${lostFwArea} m²)` : ''));

  if (lostFwArea > 0) {
    const lostPct = (lostFwArea / fwAreaTotal) * 100;
    if (lostPct > 80) {
      warnings.push(
        `ℹ️ Převážně ztracené bednění (${lostPct.toFixed(0)}% z ${fwAreaTotal.toFixed(1)} m²) — ` +
        `systémové bednění pouze pro okraje, čela a prostupy (${fwArea.toFixed(1)} m²).`
      );
    } else {
      warnings.push(
        `ℹ️ Ztracené bednění ${lostFwArea.toFixed(1)} m² (trapézový plech) — ` +
        `systémové bednění jen na ${fwArea.toFixed(1)} m² (okraje + zbývající plocha). ` +
        `Podpěry jsou počítány na plnou plochu ${fwAreaTotal.toFixed(1)} m².`
      );
    }
  }

  // Warn about estimated formwork area for complex elements where estimation is unreliable.
  // Element-specific hint about geometry — the previous generic "dřík + křídla + stěna"
  // text was correct only for opěry, not for římsy/operne_zdi/schodiště.
  const GEOMETRY_HINTS: Partial<Record<string, string>> = {
    opery_ulozne_prahy: 'dřík + křídla + stěna',
    operne_zdi: 'stěna + konzoly',
    rimsa: 'obrys + dno + čela',
    schodiste: 'stupně + podesty',
  };
  if (!input.formwork_area_m2 && GEOMETRY_HINTS[elementType]) {
    warnings.push(
      `⚠️ ${profile.label_cs}: plocha bednění je odhadnuta (${fwArea} m²). ` +
      `Tento typ má složitou geometrii (${GEOMETRY_HINTS[elementType]}) — zadejte skutečnou plochu pro přesný výpočet.`
    );
  }

  // Resolve curing class: explicit input → element_type default → 2
  const effectiveCuringClass: CuringClass = input.curing_class ?? getDefaultCuringClass(elementType);

  // Maturity-based curing or default
  const maturityParams = input.concrete_class ? {
    concrete_class: input.concrete_class,
    temperature_c: temperature,
    cement_type: input.cement_type,
    element_type: mapElementType(profile),
    curing_class: effectiveCuringClass,
    // BUG-Z2 (2026-04-15): propagate exposure class so TKP18 §7.8.3 minimum
    // (XF1→5d, XF3/XF4→7d) overrides maturity when the envelope is harsh.
    // Task 2 (2026-04-20): forward full array so combined bridge decks
    // (XF2+XD1+XC4) correctly enforce XF2's 5-day floor.
    exposure_class: input.exposure_class,
    exposure_classes: input.exposure_classes,
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
      curing_class: effectiveCuringClass,
      // BUG-Z2: TKP18 §7.8.3 minimum (XF1/XF3/XF4) floors the strip wait.
      // Task 2 (2026-04-20): forward array so combined exposures work.
      exposure_class: input.exposure_class,
      exposure_classes: input.exposure_classes,
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
  let shapedAssemblyNorm = roundTo(adjustedNorms.assembly_h_m2 * shapeCorrection, 3);
  let shapedDisassemblyNorm = roundTo(adjustedNorms.disassembly_h_m2 * shapeCorrection, 3);
  if (shapeCorrection !== 1.0) {
    log.push(`Shape correction: ×${shapeCorrection} → assembly ${shapedAssemblyNorm} h/m², strike ${shapedDisassemblyNorm} h/m²`);
  }

  // Terminology Commit 3 (2026-04-17): MSS per-tact reuse. DOKA MSS +
  // PERI VARIOKIT Mobile carry a prebuilt form/skruž/props rig that
  // only gets MOVED + re-tensioned between záběry. Full mount Nhod
  // (catalog 1.20 h/m²) is already paid for inside MSS mobilization
  // (see calculateMSSCost below); per-tact assembly runs at ~35 % of
  // that. Factor applied here propagates through fwBase, threePhase,
  // scheduler, costs — without duplicate bookkeeping.
  const isMssPath = fwSystem.pour_role === 'mss_integrated';
  const mssReuseFactor = isMssPath ? (fwSystem.mss_reuse_factor ?? 0.35) : 1;
  if (isMssPath && mssReuseFactor !== 1) {
    const oldAsm = shapedAssemblyNorm;
    const oldDis = shapedDisassemblyNorm;
    shapedAssemblyNorm = roundTo(shapedAssemblyNorm * mssReuseFactor, 3);
    shapedDisassemblyNorm = roundTo(shapedDisassemblyNorm * mssReuseFactor, 3);
    log.push(
      `MSS reuse factor ×${mssReuseFactor} → per-tact Nhod ${oldAsm}→${shapedAssemblyNorm} asm, ` +
      `${oldDis}→${shapedDisassemblyNorm} strike (full mount already in MSS mobilization)`,
    );
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
    rebar_diameter_mm: input.rebar_diameter_mm,
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

  // v4.0: Per-záběr volume support — calculate pour for each tact individually
  // v4.0: Per-záběr volume support — calculate pour for each tact individually
  const hasTactVolumes = input.tact_volumes && input.tact_volumes.length === pourDecision.num_tacts;
  if (input.tact_volumes && input.tact_volumes.length !== pourDecision.num_tacts) {
    warnings.push(`⚠️ tact_volumes délka (${input.tact_volumes.length}) neodpovídá počtu záběrů (${pourDecision.num_tacts}) — ignorováno.`);
  }
  const perTactConcreteDays: number[] | undefined = hasTactVolumes ? [] : undefined;

  const pourResult = calculatePourTask({
    element_type: elementType,
    volume_m3: pourDecision.tact_volume_m3,
    season: input.season,
    use_retarder: input.use_retarder,
    crew_size: crew,
    shift_h: shift,
    target_window_h: input.target_pour_window_h,
    // Pump-consistency fix (2026-04-16): forward the authoritative pump
    // count from decidePourMode() so pour-task doesn't silently compute
    // "1 čerpadlo, 20h" while pour-decision already said "4 čerpadel, 5h".
    num_pumps_available: pourDecision.pumps_required,
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
  let effectiveShift = shift;

  // MEGA pour Bug 1 (2026-04-16): crew is now a function of pumps, applied
  // UNIVERSALLY (1-pump small pour still gets 2+2+1+3 = 8 people). The
  // previous crew = form.crew_size baseline couldn't run a moving-front
  // pour behind 2+ pumps. User configured crew_size now drives only the
  // tesaři/železáři branches — pour crew is derived from pumps_required.
  //
  // v4.24 BUG C: formula reworked — management (stavbyvedoucí + mistr)
  // dropped from per-pour headcount, moved to "Zařízení staveniště" (VRN,
  // ČSN 73 0212) overhead. Formula now volume- + element-scaled: small
  // pours (<20 m³) get 3-person crew, podkladní beton gets 2, 80+ m³ uses
  // the original pump-based formula (without the old "+3 řízení" line).
  const pourCrewBreakdown = computePourCrew(
    pourDecision.tact_volume_m3,
    pourDecision.pumps_required,
    elementType,
  );
  let effectivePourCrew = pourCrewBreakdown.total;

  // Night shift premium (§ 116 ZP: min. +10%)
  const NIGHT_PREMIUM = 0.10;
  let pourNightPremiumCZK = 0;
  let numPourShifts = 1;

  if (isContinuousPour && pourResult.total_pour_hours > shift) {
    // MEGA pour Bug 2 (2026-04-16): continuous pour exceeds the normal
    // shift → immediately split into multiple shifts with crew relief.
    // Previous code had an "extended shift" branch up to 12 h legal max
    // that stretched one crew's workday and only multi-shift'd above
    // 12 h. Reality on site (§116 ZP + safety): once pour exceeds the
    // shift, a FRESH crew of the same size takes over. Each worker's
    // day stays normal; labor accounting is person-hours across all
    // shifts with +10% night premium on post-shift hours (22:00–06:00
    // approximated as "everything past first-shift length").
    concreteDays = 1;
    numPourShifts = Math.max(1, Math.ceil(pourResult.total_pour_hours / shift));
    effectiveShift = shift; // no stretching — each crew works one normal shift
    const nightHours = Math.max(0, pourResult.total_pour_hours - shift);
    pourNightPremiumCZK = roundTo(nightHours * effectivePourCrew * wagePour * NIGHT_PREMIUM, 2);

    const breakdownLabel = `${pourCrewBreakdown.ukladani} uklád. + ${pourCrewBreakdown.vibrace} vibrace + ${pourCrewBreakdown.finiseri} finiš + ${pourCrewBreakdown.rizeni} řízení`;
    if (numPourShifts === 1) {
      // Edge case: pour_hours exactly equals shift — 1 shift, no night premium.
      warnings.push(
        `[Záběr ${pourDecision.tact_volume_m3} m³] Monolitická zálivka: ${effectivePourCrew} lidí/směna (${breakdownLabel}).`
      );
    } else {
      warnings.push(
        `[Záběr ${pourDecision.tact_volume_m3} m³, ${roundTo(pourResult.total_pour_hours, 1)}h] ` +
        `Monolitická zálivka nutno zalít bez přerušení. ` +
        `${numPourShifts} směny × ${effectivePourCrew} lidí = ${effectivePourCrew * numPourShifts} lidí celkem (${breakdownLabel}). ` +
        `Noční hodiny po ${shift}h směně: ${nightHours.toFixed(1)}h s příplatkem +10% (§116 ZP).`
      );
    }

    log.push(`Continuous pour: ${roundTo(pourResult.total_pour_hours, 1)}h → 1 day, ` +
      `${numPourShifts} shift(s) × ${effectivePourCrew} lidí ` +
      `(${pourCrewBreakdown.ukladani}+${pourCrewBreakdown.vibrace}+${pourCrewBreakdown.finiseri}+${pourCrewBreakdown.rizeni}, ` +
      `${pourCrewBreakdown.pumps_used} čerpadel), night ${nightHours.toFixed(1)}h`);
  } else {
    // Normal pour: calculate days from hours
    concreteDays = Math.max(1, roundTo(pourResult.total_pour_hours / shift, 2));
    // For very small pours (< half shift), still count as 1 day minimum
    if (concreteDays < 1) concreteDays = 1;
    log.push(`Pour crew: ${effectivePourCrew} lidí ` +
      `(${pourCrewBreakdown.ukladani}+${pourCrewBreakdown.vibrace}+${pourCrewBreakdown.finiseri}+${pourCrewBreakdown.rizeni}, ` +
      `${pourCrewBreakdown.pumps_used} čerpadel) for ${roundTo(pourResult.total_pour_hours, 1)}h pour`);
  }

  // BUG C1 (2026-04-16): per-záběr continuous-pour gate for mostovka.
  // Bridge decks can't have a pracovní spára inside a single záběr
  // (static/crack risk), so even in sectional mode each záběr must pour
  // without interruption. If the záběr duration exceeds the shift, the
  // team needs to plan crew relief (2 směny) + noční příplatek §116 ZP.
  // The isContinuousPour branch above only fires for pour_mode=monolithic,
  // which misses the typical multi-tact mostovka case.
  if (elementType === 'mostovkova_deska' && !isContinuousPour && pourResult.total_pour_hours > shift) {
    const pourHoursRounded = roundTo(pourResult.total_pour_hours, 1);
    const shiftsNeeded = Math.ceil(pourResult.total_pour_hours / 12);
    warnings.push(
      `⚠️ Záběr mostovky (${pourDecision.tact_volume_m3} m³) trvá ${pourHoursRounded}h — přesahuje směnu ${shift}h. ` +
      `Pracovní spára uprostřed záběru NENÍ přípustná (statika). ` +
      `Plán: ${shiftsNeeded} směny × betonáři (výměna čet), noční příplatek §116 ZP (+10%). ` +
      `Zvažte zmenšení záběru, rychlejší čerpadlo nebo retardér.`
    );
    log.push(`Mostovka per-tact continuous pour: ${pourHoursRounded}h > ${shift}h shift → ${shiftsNeeded} shifts recommended`);
  }

  // BUG E2 (2026-04-16): 2-fázová betonáž pro trámové + vícetrámové mostovky.
  // Trámový nosník se betonuje ve dvou fázích (trámy pak deska) s povinnou
  // technologickou pauzou 4–12 h pro mírné tuhnutí trámů. Engine dosud
  // počítal betonáž jako jeden kontinuální odlev, takže záběr byl kratší
  // než na reálné stavbě. Pauza ≈ 6 h = 0.6 směny se přičítá k concreteDays
  // (víc realistický plán). Komorový (jednokomora/dvoukomora) má 3 fáze
  // (dno → stěny → horní deska), kde se pauza řeší skrz separate záběry,
  // takže tam úpravu neděláme.
  const twoPhaseSubtype = input.bridge_deck_subtype === 'jednotram'
    || input.bridge_deck_subtype === 'dvoutram'
    || input.bridge_deck_subtype === 'vicetram';
  if (elementType === 'mostovkova_deska' && twoPhaseSubtype) {
    const pauseHours = 6;
    const pauseDays = roundTo(pauseHours / shift, 2);
    const oldConcreteDays = concreteDays;
    concreteDays = roundTo(concreteDays + pauseDays, 2);
    warnings.push(
      `Trámový nosník — betonáž ve 2 fázích (nejdřív trámy, pauza ${pauseHours} h pro mírné tuhnutí, ` +
      `pak deska). Doba záběru navýšena o ${pauseDays} dne (${oldConcreteDays}d → ${concreteDays}d).`
    );
    log.push(`Two-phase mostovka pour: +${pauseHours}h pauza = +${pauseDays}d (${oldConcreteDays}d → ${concreteDays}d)`);
  }

  // v4.0: Per-záběr pour duration calculation
  if (hasTactVolumes && perTactConcreteDays && input.tact_volumes) {
    for (let i = 0; i < input.tact_volumes.length; i++) {
      const vol = input.tact_volumes[i];
      const tactPour = calculatePourTask({
        element_type: elementType,
        volume_m3: vol,
        season: input.season,
        use_retarder: input.use_retarder,
        crew_size: crew,
        shift_h: shift,
        target_window_h: input.target_pour_window_h,
      });
      const days = isContinuousPour
        ? 1
        : Math.max(1, roundTo(tactPour.total_pour_hours / shift, 2));
      perTactConcreteDays.push(days);
    }
    log.push(`Per-záběr concrete_days: [${perTactConcreteDays.map(d => d.toFixed(2)).join(', ')}]`);
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
    if (input.prestress_days_override != null) {
      prestressDays = input.prestress_days_override;
    } else {
      // BUG 4: Realistic prestress formula per TKP18 §6.5.
      // Phase 1: Wait for concrete to reach min. 33 MPa (≈70% of C35/45 f_ck)
      //   For class 4 curing at 15°C this is ~7 days (from CURING_DAYS_TABLE).
      //   Simplified: use curingDays (already computed above, includes class+exposure).
      const waitForStrength = Math.max(7, curingDays);
      // Phase 2: Stressing — cables_per_day depends on tensioning method
      //   Jednostranné (one-sided): ~6 cables/day
      //   Oboustranné (both-sides): ~10 cables/day
      const numCables = input.prestress_cables_count ?? 0;
      const cablesPerDay = input.prestress_tensioning === 'one_sided' ? 6 : 10;
      const stressingDays = numCables > 0 ? Math.ceil(numCables / cablesPerDay) : 2;
      // Phase 3: Grouting (injektáž kanálků) — ~8 cables/day
      const groutingDays = numCables > 0 ? Math.ceil(numCables / 8) : 2;

      prestressDays = waitForStrength + stressingDays + groutingDays;
    }
    // BUG E3 (2026-04-16): make the prestress decomposition explicit so
    // users can cross-reference the "Min. X dní" warning below. The
    // previous trace hid stressing + grouting behind "+ stressing +
    // grouting" so it was easy to mis-read 11d vs 25d (skruž total).
    const cablesForLog = input.prestress_cables_count ?? 0;
    const stressForLog = cablesForLog > 0
      ? Math.ceil(cablesForLog / (input.prestress_tensioning === 'one_sided' ? 6 : 10))
      : 2;
    const groutForLog = cablesForLog > 0 ? Math.ceil(cablesForLog / 8) : 2;
    log.push(
      `Prestress: ${prestressDays}d = wait ${Math.max(7, curingDays)}d (max{7, curing=${curingDays}}) + ` +
      `stressing ${stressForLog}d (${cablesForLog || 'default 2'} cables, ` +
      `${input.prestress_tensioning === 'one_sided' ? 'jednostranné' : 'oboustranné'}) + ` +
      `grouting ${groutForLog}d. Skruž stojí ještě zrání ${curingDays}d navíc — celková doba skruže = ${curingDays + prestressDays}d.`,
    );
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

  // ─── 7a0. Props (skruž) pre-pass — needed BEFORE scheduler so that
  //          tesaři work on podpěry is reflected in the critical path. ───
  // BUG B1 (2026-04-16): until this point the scheduler only saw formwork
  // ASM/STR days. Props (podpěrná konstrukce) were calculated later and
  // only surfaced as cost — but the same tesaři crew actually builds the
  // skruž BEFORE the formwork and dismantles it AFTER stripping. Pouring
  // props into a parallel track made the schedule pretend tesaři could be
  // in two places at once. We now roll props assembly into ASM duration
  // and props disassembly into STR duration for the schedule only; cost
  // math below still uses the separate propsResult so pronájem stays
  // visible as its own line item.
  let propsResult: PropsCalculatorResult | undefined;
  // Terminology Commit 3 (2026-04-17): MSS carries its own props
  // (Staxo-like towers + nosníky are all integrated in the MSS frame).
  // Running calculateProps on an MSS plan would double-count — the
  // MSS rental from calculateMSSCost already pays for every layer.
  if (isMssPath) {
    log.push(`Props: skipped — MSS integrated layer (stojky + skruž + bednění v jednom, kryto MSS rental)`);
  } else if (profile.needs_supports && input.height_m && input.height_m > 0) {
    propsResult = calculateProps({
      element_type: elementType,
      height_m: input.height_m,
      formwork_area_m2: fwAreaTotal,
      hold_days: skruzMinDays > 0 ? skruzMinDays : curingDays,
      crew_size: crew,
      shift_h: shift,
      k,
      wage_czk_h: wageFormwork,
      num_tacts: pourDecision.num_tacts,
      formwork_manufacturer: fwSystem.manufacturer,
    });
    warnings.push(...propsResult.warnings);
    log.push(`Props: ${propsResult.system.name}, ${propsResult.num_props_per_tact} ks/tact, ` +
      `rental ${propsResult.rental_days}d, total ${propsResult.total_cost_czk} Kč`);
    log.push(...propsResult.log.map(l => `  props: ${l}`));
  } else if (profile.needs_supports && !input.height_m) {
    // D1 (2026-04-16) + Terminology Commit 6 (2026-04-17): mostovka bez
    // výšky = nereálný plán. Mostovka se správně opírá o nosníkovou
    // skruž (Top 50 / VARIOKIT HD 200) + stojky (Staxo / UP Rosett),
    // takže warning to říká explicitně; pro ostatní prvky s
    // needs_supports necháváme obecnější formulaci (tam může chybět
    // výška při předběžné kalkulaci).
    const isBridgeDeck = elementType === 'mostovkova_deska';
    // 2026-04-17: unified emoji prefix convention — ⛔ for CRITICAL,
    // ⚠️ for WARNING, ℹ️ for INFO. Earlier v4.19 D1 fix used 🚨 —
    // migrating to the convention so the Phase 2 UI severity renderer
    // has a single prefix set to parse.
    const prefix = isBridgeDeck ? '⛔ KRITICKÉ: ' : '';
    const what = isBridgeDeck
      ? 'Mostovka vyžaduje skruž (nosníky) + stojky'
      : `${profile.label_cs} vyžaduje podpěrnou konstrukci (stojky/skruž)`;
    const detailSuffix = isBridgeDeck
      ? `Bez výšky chybí v souhrnu Skruž + Stojky (typicky 15–25 % z celkových nákladů mostovky).`
      : `Bez ní chybí v souhrnu položka Stojky (typicky 15–25 % z celkových nákladů).`;
    warnings.push(
      `${prefix}${what}, ale není zadána výška. ` +
      `Zadejte výšku nad terénem pro výpočet skruže, stojek a nákladů na pronájem. ${detailSuffix}`
    );
    log.push(`Props: skipped — height_m not provided for element with needs_supports=true (${elementType})`);
  }

  const schedAssemblyDays = roundTo(assemblyDays + (propsResult?.assembly_days ?? 0), 2);
  const schedStrippingDays = roundTo(disassemblyDays + (propsResult?.disassembly_days ?? 0), 2);
  if (propsResult) {
    log.push(
      `Tesaři sequence per tact: podpěry ${propsResult.assembly_days}d → bednění ${assemblyDays}d ` +
      `(ASM=${schedAssemblyDays}d) | STR: bednění ${disassemblyDays}d → podpěry ${propsResult.disassembly_days}d ` +
      `(STR=${schedStrippingDays}d). Tatáž četa, jedna stopa.`,
    );
  }

  const scheduleResult = scheduleElement({
    num_tacts: pourDecision.num_tacts,
    num_sets: numSets,
    assembly_days: schedAssemblyDays,
    rebar_days: rebarResult.duration_days,
    concrete_days: concreteDays,
    curing_days: curingDays,
    stripping_days: schedStrippingDays,
    prestress_days: prestressDays,
    num_formwork_crews: numFWCrews,
    num_rebar_crews: numRBCrews, // parallel rebar crews across tacts (RCPSP)
    rebar_lag_pct: 50,
    scheduling_mode: pourDecision.scheduling_mode,
    cure_between_neighbors_days: pourDecision.cure_between_neighbors_h / 24,
    // v4.0: Per-záběr durations (variable záběr volumes)
    per_tact_concrete_days: perTactConcreteDays,
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

  // Block F: warn when the user asked for more crews than there are záběry
  // to run in parallel. The scheduler simply never assigns the extra crews,
  // so they sit idle — we surface that as a visible warning + log entry.
  const finalNumTacts = pourDecision.num_tacts;
  if (numFWCrews > finalNumTacts) {
    warnings.push(
      `Více čet bednění (${numFWCrews}) než záběrů (${finalNumTacts}) — ` +
      `extra čety nebudou využity. Snižte počet čet nebo zvyšte počet záběrů.`,
    );
    log.push(`Block F: numFWCrews=${numFWCrews} > num_tacts=${finalNumTacts} → idle crews`);
  }
  if (numRBCrews > finalNumTacts) {
    warnings.push(
      `Více čet výztuže (${numRBCrews}) než záběrů (${finalNumTacts}) — ` +
      `extra čety nebudou využity. Snižte počet čet nebo zvyšte počet záběrů.`,
    );
    log.push(`Block F: numRBCrews=${numRBCrews} > num_tacts=${finalNumTacts} → idle crews`);
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
      // BUG-3: text now references the maturity-based value AND its conditions
      const concreteClassLabel = input.concrete_class ?? '?';
      const tempLabel = `${temperature}°C`;
      const normLabel = elementType === 'mostovkova_deska' ? 'ČSN 73 6244' : 'ČSN EN 13670';
      warnings.push(
        `${profile.label_cs} bez spár: celá plocha = jeden záběr. ` +
        `Podpěrná konstrukce musí pokrýt celou plochu (${fwArea} m²). ` +
        `Podpěry musí zůstat min. ${effectiveHoldDays} dní (${normLabel}, ${concreteClassLabel}, ${tempLabel}). ` +
        `Při nižší teplotě se doba prodlužuje. ` +
        `Pro přestavbu (reshoring) je nutné statické posouzení.`
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
  // Props were calculated up front in section 7a0 (before the scheduler)
  // so tesaři podpěry+bednění time appears in one crew trace on the
  // critical path. The propsResult variable carries cost + warnings into
  // section 8 below.

  // ─── 8. Cost Summary ──────────────────────────────────────────────────

  // Terminology Commit 3 (2026-04-17): when the plan is on the MSS
  // path, bridge-technology.ts already computed mobilization +
  // demobilization costs as "vlastní síly" (tesaři). Fold them into
  // the tesařské-práce bucket here so the cost summary + KPIs see the
  // full labor picture on a single line, and expose the split on
  // PlannerOutput.costs so the UI can show "X lidí × Y dní = Z Kč".
  const mssMobilizationCZK = isMssPath ? (bridgeTechResult?.mss_cost?.mobilization_czk ?? 0) : 0;
  const mssDemobilizationCZK = isMssPath ? (bridgeTechResult?.mss_cost?.demobilization_czk ?? 0) : 0;
  const mssRentalCZK = isMssPath ? (bridgeTechResult?.mss_cost?.rental_total_czk ?? 0) : 0;

  const formworkLaborCZK = threePhase.total_cost_labor + mssMobilizationCZK + mssDemobilizationCZK;
  if (isMssPath) {
    log.push(
      `MSS costs: mobilization ${(mssMobilizationCZK / 1e6).toFixed(2)} M + demobilization ` +
      `${(mssDemobilizationCZK / 1e6).toFixed(2)} M Kč → flowing into formwork_labor (vlastní síly tesaři). ` +
      `Rental ${(mssRentalCZK / 1e6).toFixed(2)} M Kč bundled separately (pronájem MSS stroje).`,
    );
    // Terminology Commit 6 (2026-04-17): surface the "vlastní síly"
    // framing in the warning pane so users understand the labor cost
    // is calculated as if their own tesaři crew mounted the rig (for
    // comparison with a DOKA/PERI subcontract offer). Crew size for MSS
    // montáž is typically 10–15 lidí per shift — we quote a lower-bound
    // derived from existing formwork crew × number of crews, floored
    // at 10 to match task's "10-15 lidí" rule of thumb.
    const setupDays = bridgeTechResult?.mss_schedule?.setup_days ?? 30;
    const teardownDays = bridgeTechResult?.mss_schedule?.teardown_days ?? 15;
    const tesariPerShift = Math.max(10, numFWCrews * crew);
    warnings.push(
      `MSS montáž: ~${tesariPerShift} lidí (tesaři) × ${setupDays} dní = ` +
      `${(mssMobilizationCZK / 1e6).toFixed(2)} M Kč (vlastní síly). ` +
      `Per-takt úprava: tesaři, Nhod × ${fwSystem.mss_reuse_factor ?? 0.35} (přesun + re-tensioning). ` +
      `MSS demontáž: ~${teardownDays} dní = ${(mssDemobilizationCZK / 1e6).toFixed(2)} M Kč.`,
    );
  }
  const rebarLaborCZK = rebarResult.cost_labor * pourDecision.num_tacts;
  // MEGA pour Bug 2 (2026-04-16): pour labor now computed as person-hours
  // to support the crew-relief model correctly. Each worker works at
  // most one shift; multi-shift pours simply add fresh crews. Night
  // premium (§116 ZP) is a +10% stamp on post-first-shift hours.
  //
  //   totalPersonHoursPerTact = crew_per_shift × pour_hours
  //     (sum of hours-worked by every worker who shows up, whether in
  //      shift 1 or shift 2+ — fits both isContinuousPour paths)
  //   nightPersonHoursPerTact = crew_per_shift × max(0, pour_hours − shift)
  //   base    = totalPersonHours × wagePour
  //   premium = nightPersonHours × wagePour × 0.10
  //
  // For sectional pours (pour_hours ≤ shift, crew_per_shift from pumps
  // formula) the formula collapses to a clean "crew × actual hours ×
  // wage", with §114 ZP overtime (+25%) for hours beyond shift_h in a
  // single-shift setting. numPourShifts stays 1 there so no double-pay.
  let pourLaborCZK: number;
  if (isContinuousPour && pourResult.total_pour_hours > shift) {
    // Continuous multi-shift path: person-hours model
    const totalPersonHours = effectivePourCrew * pourResult.total_pour_hours;
    const pourBaseCZK = totalPersonHours * wagePour;
    // pourNightPremiumCZK already computed above using nightHours × crew × wage × 0.10
    pourLaborCZK = roundTo(
      (pourBaseCZK + pourNightPremiumCZK) * pourDecision.num_tacts,
      2,
    );
  } else {
    // Sectional / single-shift path: per-worker daily pay with §114 ZP overtime
    const overtimeThreshold = shift;
    const actualPourHours = pourResult.total_pour_hours;
    const regularHours = Math.min(overtimeThreshold, actualPourHours);
    const overtimeHours = Math.max(0, actualPourHours - overtimeThreshold);
    const laborPerWorkerPerTact = (regularHours * wagePour) + (overtimeHours * wagePour * 1.25);
    pourLaborCZK = roundTo(
      laborPerWorkerPerTact * effectivePourCrew * numPourShifts * pourDecision.num_tacts,
      2,
    );
  }

  // Rental cost (monthly → daily). User override takes precedence over catalog.
  const rentalDaysPerSet = scheduleResult.total_days + 2; // +2 for transport
  const rentalRate = input.rental_czk_override ?? fwSystem.rental_czk_m2_month;
  // Terminology Commit 3: on the MSS path, bednění/skruž/stojky rental is
  // all bundled in calculateMSSCost.rental_total_czk (tracked separately
  // below as a new line item). Catalog entry for "DOKA MSS" +
  // "VARIOKIT Mobile" uses rental_czk_m2_month=0 to enforce this even
  // against user overrides — which makes formworkRentalCZK already land
  // on 0 for MSS, but we gate the branch explicitly so the intent is
  // unambiguous in the source.
  const formworkRentalCZK = isMssPath
    ? 0
    : (rentalRate > 0
        ? roundTo(fwArea * rentalRate * (rentalDaysPerSet / 30) * numSets, 2)
        : 0);
  if (input.rental_czk_override !== undefined && !isMssPath) {
    log.push(`Rental: user override ${rentalRate} Kč/${fwSystem.unit}/měs (catalog: ${fwSystem.rental_czk_m2_month})`);
  }

  // Props costs (zeroed on MSS path — skipped calculateProps runs upstream)
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

  // ─── 8b. Resource Ceiling Feasibility Check (Phase 1 Foundation C) ────
  //
  // Build EngineeringDemand from computed engine outputs and check whether
  // it fits within the effectiveResourceCeiling. Per Q3 interview decision:
  // engine returns "warning + best-effort plan" — violations are flagged
  // via ⛔ KRITICKÉ but the plan still ships with engine's optimum numbers.
  //
  // Per-profession peak (MAX-of-phases) used for num_workers_total demand
  // because formwork (ASM/STR), rebar (REB) and pour (CON) are SEQUENTIAL
  // phases on the RCPSP DAG — they don't all consume workers simultaneously.
  //
  // Sum-based total check fires only when caller doesn't pass an explicit
  // num_workers_total in demand (legacy compat). With explicit peak set,
  // the check compares peak ≤ ceiling.num_workers_total directly.
  {
    const formworkPhasePeak = numFWCrews * crew;
    const rebarPhasePeak = numRBCrews * crewRebar;
    const pourPhasePeak = pourCrewBreakdown.total;
    const overallPeak = Math.max(formworkPhasePeak, rebarPhasePeak, pourPhasePeak);

    const engineeringDemand: EngineeringDemand = {
      workforce: {
        // Peak simultaneous (MAX of phases) — not SUM, since phases are sequential.
        num_workers_total: overallPeak,
        num_carpenters: formworkPhasePeak,
        num_rebar_workers: rebarPhasePeak,
        num_concrete_workers: pourCrewBreakdown.ukladani,
        num_vibrators: pourCrewBreakdown.vibrace,
        num_finishers: pourCrewBreakdown.finiseri,
        num_supervisors: pourCrewBreakdown.rizeni,
      },
      formwork: {
        num_formwork_sets: fwSetsCount,
      },
      equipment: {
        num_pumps: pourDecision.pumps_required,
        num_cranes: profile.needs_crane ? 1 : 0,
      },
      total_days: scheduleResult.total_days,
    };

    const feasibility = checkCeilingFeasibility(
      effectiveResourceCeiling,
      engineeringDemand,
      elementType,
    );
    resourceViolations.push(...feasibility.violations);
    // Push violation messages to warnings[] for legacy UI banner (textual).
    // Structured form already in resource_violations[] for new UI severity rendering.
    for (const v of feasibility.violations) {
      warnings.push(v.message);
    }
    for (const hint of feasibility.recovery_hints) {
      warnings.push(`ℹ️ Doporučení: ${hint}`);
    }
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
    tact_volumes: hasTactVolumes ? input.tact_volumes : undefined,
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
      // BUG-6: simultaneous = workers on the front; rostered = total in schedule
      pour_simultaneous_headcount: effectivePourCrew,
      pour_rostered_headcount: effectivePourCrew * numPourShifts,
      pour_has_night_premium: pourNightPremiumCZK > 0,
      pour_crew_breakdown: pourCrewBreakdown,
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
    bridge_technology: bridgeTechResult,
    costs: {
      formwork_labor_czk: formworkLaborCZK,
      rebar_labor_czk: rebarLaborCZK,
      pour_labor_czk: pourLaborCZK,
      pour_night_premium_czk: pourNightPremiumCZK * pourDecision.num_tacts,
      total_labor_czk: totalLaborCZK,
      formwork_rental_czk: formworkRentalCZK,
      props_labor_czk: propsLaborCZK,
      props_rental_czk: propsRentalCZK,
      is_mss_path: isMssPath,
      mss_mobilization_czk: mssMobilizationCZK,
      mss_demobilization_czk: mssDemobilizationCZK,
      mss_rental_czk: mssRentalCZK,
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
        skruz: `ČSN 73 6244 + ČSN EN 13670: min. ${skruzMinDays || curingDays} dní od poslední betonáže ` +
          `(sezóna "${seasonForCuring}", ${input.concrete_class || 'C30/37'}, ${temperature}°C). ` +
          `Porovnáno se zráním dle maturity modelu — použita delší hodnota.`,
      } : {}),
    },
    monte_carlo: scheduleResult.monte_carlo,
    deadline_check: checkDeadline(input, scheduleResult.total_days, totalLaborCZK + formworkRentalCZK, {
      pourDecision, assemblyDays, rebarResult, concreteDays, curingDays, disassemblyDays,
      numFWCrews, numRBCrews, numSets, maturityParams, fwArea, fwSystem,
      wageFormwork, wageRebar, wagePour, crew, crewRebar, shift, k,
      // Block E: pass labor breakdown so variants reuse it instead of
      // recomputing a simplified (and inconsistent) version.
      mainLaborBreakdown: {
        formwork_labor_czk: formworkLaborCZK,
        rebar_labor_czk: rebarLaborCZK,
        pour_labor_czk: pourLaborCZK,
        props_labor_czk: propsLaborCZK,
        total_labor_czk: totalLaborCZK,
      },
      rentalRate,
    }),
    warnings,
    decision_log: [...log, ...pourDecision.decision_log],
    // Resource Ceiling Phase 1 plumbing (Foundation B).
    // Engine integration (populating resource_violations from
    // checkCeilingFeasibility against pour-decision / pour-task / scheduler
    // demand) ships in Foundation C.
    resource_ceiling: effectiveResourceCeiling,
    resource_violations: resourceViolations,
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
  elementType?: StructuralElementType,
): number {
  const volumePerTact = totalVolume_m3 / numTacts;

  // BUG-Z1 follow-up (2026-04-15): horizontal foundation BLOCKS
  // (zaklady_piliru, zakladovy_pas, zakladova_patka) still need
  // perimeter-only formwork — they are not thin slabs. Aspect ratio
  // is closer to square for patkas (~1.5:1) than piers (~3:1).
  const isFoundationBlock =
    elementType === 'zaklady_piliru' ||
    elementType === 'zakladova_patka' ||
    elementType === 'zakladovy_pas';
  if (height_m && height_m > 0 && isFoundationBlock) {
    const footprint = volumePerTact / height_m;
    const aspectRatio = elementType === 'zakladovy_pas' ? 10 : 1.5; // strip is long + narrow
    const W = Math.sqrt(footprint / aspectRatio);
    const L = aspectRatio * W;
    const perimeter = 2 * (L + W);
    const estimated = roundTo(perimeter * height_m, 1);
    return Math.max(estimated, 5);
  }

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

// ─── Pilota path (2026-04-15) ───────────────────────────────────────────────
//
// Bored piles bypass the standard formwork/pressure/props pipeline and
// instead route through the small pile-engine module. The full
// PlannerOutput contract is preserved so existing consumers (UI cards,
// applyPlanToPositions, element-audit tests) keep working — fields that
// don't apply (lateral_pressure, props, prestress, bridge_technology) are
// simply omitted, and `formwork` is filled with the no-op "Tradiční
// tesařské" sentinel + zero days to signal "no formwork work".
//
// All pile-specific data lives under `plan.pile` so the result cards can
// gate on `plan.element.type === 'pilota'`.

interface PilePathDefaults {
  crew: number;
  crewRebar: number;
  shift: number;
  k: number;
  wage: number;
  wageFormwork: number;
  wageRebar: number;
  wagePour: number;
  temperature: number;
}

function runPilePath(
  input: PlannerInput,
  profile: ElementProfile,
  log: string[],
  warnings: string[],
  defaults: PilePathDefaults,
): PlannerOutput {
  const elementType = profile.element_type;
  const { crew, crewRebar, shift, k, wage, wageFormwork, wageRebar, wagePour, temperature } = defaults;

  // 2026-04-17: exposure allow-list check shared with the main orchestrator
  // path. Piles sit deep in ground and should use XA1/XA2/XA3/XC2 — an
  // XF4 entry (mráz, typical for bridge decks) is a user confusion with
  // the dřík or deck exposure.
  // Task 2 (2026-04-20): array-aware — legacy string wrapped in [x].
  const pileExposureClasses = input.exposure_classes
    ?? (input.exposure_class ? [input.exposure_class] : []);
  pushExposureWarning(elementType, pileExposureClasses, profile.label_cs, warnings);

  // ── 1. Pile drilling (productivity table → schedule + costs) ──────────
  const pile = calculatePileDrilling({
    diameter_mm: input.pile_diameter_mm,
    length_m: input.pile_length_m,
    count: input.pile_count,
    volume_m3: input.volume_m3,
    geology: input.pile_geology,
    casing_method: input.pile_casing_method,
    rebar_index_kg_m3: input.pile_rebar_index_kg_m3,
    // BUG-P1 (2026-04-15): propagate concrete class so the engine can
    // warn on incompatible combos (e.g. C20/25 pod HPV) and echo it.
    concrete_class: input.concrete_class,
    // BUG-P2: overpouring height (default 0.5 m inside the engine).
    overpouring_m: input.pile_overpouring_m,
    // BUG-P4: optional integrity tests (opt-in from the UI).
    cha_test_count: input.pile_cha_test_count,
    pit_test_count: input.pile_pit_test_count,
    cha_test_czk: input.pile_cha_test_czk,
    pit_test_czk: input.pile_pit_test_czk,
    crew_size: input.crew_size,
    shift_h: input.shift_h ?? 8, // pile shifts are typically 8h
    wage_czk_h: input.wage_czk_h,
    rig_czk_per_shift: input.pile_rig_czk_per_shift,
    crane_czk_per_shift: input.pile_crane_czk_per_shift,
    pile_cap: input.has_pile_cap && input.pile_cap_length_m && input.pile_cap_width_m && input.pile_cap_height_m
      ? {
          length_m: input.pile_cap_length_m,
          width_m: input.pile_cap_width_m,
          height_m: input.pile_cap_height_m,
        }
      : undefined,
  });
  log.push(...pile.log);

  // ── 2. Pour decision — 1 záběr always for piles ───────────────────────
  // Run decidePourMode anyway so consumers see the standard shape; the
  // pour-decision profile for pilota already says "1 záběr" so this is a
  // no-op for our purposes.
  const pourDecision = decidePourMode({
    element_type: elementType,
    volume_m3: input.volume_m3,
    has_dilatacni_spary: false, // piles never have dilatation joints
    season: input.season,
    use_retarder: input.use_retarder,
    working_joints_allowed: 'no',
  });
  // Override num_tacts to 1 explicitly — 1 pile = 1 záběr regardless of count.
  // The pile schedule is built around piles/shift, not tacts.
  pourDecision.num_tacts = 1;
  pourDecision.tact_volume_m3 = pile.volume_per_pile_m3;

  // ── 3. Rebar (armokoš = pre-fabricated cage) ──────────────────────────
  // Pass mass_kg explicitly so calculateRebarLite uses the user-supplied
  // index instead of estimating from element profile.
  const rebarResult = calculateRebarLite({
    element_type: elementType,
    volume_m3: pile.total_volume_m3,
    mass_kg: pile.rebar_total_kg,
    crew_size: crewRebar,
    shift_h: shift,
    k,
    wage_czk_h: wageRebar,
  });

  // ── 4. Pour task — keep calculatePourTask for API symmetry, but the
  //      pile UI cards don't surface its pump info. The audit test only
  //      asserts pumps_for_actual_window.count >= 1, which the engine
  //      always satisfies. ────────────────────────────────────────────────
  const pourResult = calculatePourTask({
    element_type: elementType,
    volume_m3: pile.volume_per_pile_m3,
    season: input.season,
    use_retarder: input.use_retarder,
    crew_size: crew,
    shift_h: shift,
  });

  // ── 5. Synthesize ElementScheduleOutput ───────────────────────────────
  // Layout:
  //   [0 .. drilling_days]                    drilling + concreting
  //   [drilling .. drilling+pause]            7-day technological pause
  //   [pause .. pause+head_adj]               head adjustment
  //   [head .. head+cap]                      optional pile cap
  // Sequential equivalent for the savings calc is the same total — there
  // is nothing to overlap on a pile job, so savings_pct = 0.
  const t0 = 0;
  const t1 = pile.drilling_days;
  const t2 = t1 + pile.technological_pause_days;
  const t3 = t2 + pile.head_adjustment_days;
  const t4 = t3 + (pile.pile_cap_days ?? 0);
  const tactDetail = {
    tact: 1,
    set: 1,
    // We map drilling → assembly slot, head adjustment → stripping slot,
    // and the technological pause → curing slot so the existing Gantt
    // renderer in the frontend keeps working without per-pilot changes.
    assembly: [t0, t1] as [number, number],
    rebar: [t0, t1] as [number, number], // armokoše are placed during drilling
    concrete: [t0, t1] as [number, number],
    curing: [t1, t2] as [number, number],
    stripping: [t2, t3] as [number, number],
  };
  const scheduleResult: ElementScheduleOutput = {
    total_days: t4,
    sequential_days: t4,
    savings_days: 0,
    savings_pct: 0,
    tact_details: [tactDetail],
    critical_path: ['drilling', 'pause', 'head_adjustment', ...(pile.pile_cap_days ? ['pile_cap'] : [])],
    gantt: '',
    utilization: {
      formwork_crews: 0,
      rebar_crews: 1,
      sets: [1],
    },
    bottleneck: 'drilling_rig',
  };

  // ── 6. No-op formwork sentinel ────────────────────────────────────────
  // recommendFormwork('pilota') already returns 'Tradiční tesařské' — we
  // keep it so plan.formwork.system stays defined (audit test asserts so).
  const fwSystem = recommendFormwork(elementType, undefined, undefined, undefined, 'standard');
  const zeroThreePhase = {
    initial_cost_labor: 0,
    middle_cost_labor: 0,
    final_cost_labor: 0,
    total_cost_labor: 0,
    initial_days: 0,
    middle_days: 0,
    final_days: 0,
    middle_tact_count: 0,
  };
  const zeroStrategies = calculateStrategiesDetailed({
    assembly_days: 0,
    rebar_days: 0,
    concrete_days: 0,
    curing_days: 0,
    disassembly_days: 0,
    num_captures: 1,
  });

  // ── 7. Costs ──────────────────────────────────────────────────────────
  // For piles, costs.total_labor_czk = pile.costs.total_labor_czk +
  // rebarResult.cost_labor (armokoš binding). Drilling rig and crane
  // appear under formwork_rental_czk would be wrong — they're not
  // formwork. Use a flat split that the result card knows how to render.
  const totalLaborCZK = pile.costs.total_labor_czk + rebarResult.cost_labor;

  // ── 8. Final return ───────────────────────────────────────────────────
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
      assembly_days: 0,
      disassembly_days: 0,
      curing_days: pile.technological_pause_days,
      three_phase: zeroThreePhase,
      strategies: zeroStrategies,
      shape_correction: 1.0,
    },
    rebar: rebarResult,
    pour: pourResult,
    schedule: scheduleResult,
    resources: {
      total_formwork_workers: 0,
      total_rebar_workers: crewRebar,
      num_formwork_crews: 0,
      num_rebar_crews: 1,
      crew_size_formwork: 0,
      crew_size_rebar: crewRebar,
      shift_h: shift,
      wage_formwork_czk_h: wageFormwork,
      wage_rebar_czk_h: wageRebar,
      wage_pour_czk_h: wagePour,
      pour_shifts: 1,
      pour_simultaneous_headcount: crew,
      pour_rostered_headcount: crew,
      pour_has_night_premium: false,
      // Piles don't use the moving-front pour crew (drilling rig + armokoš
      // crew dominate), but the field is required by the schema. Fill
      // with a 0-pump breakdown so consumers can still render the block.
      pour_crew_breakdown: {
        ukladani: 0, vibrace: 0, finiseri: 0, rizeni: 0,
        total: crew, pumps_used: 0,
      },
    },
    costs: {
      formwork_labor_czk: 0,
      rebar_labor_czk: rebarResult.cost_labor,
      pour_labor_czk: 0, // captured under pile.costs.crew_labor_czk
      pour_night_premium_czk: 0,
      total_labor_czk: totalLaborCZK,
      formwork_rental_czk: 0,
      props_labor_czk: 0,
      props_rental_czk: 0,
      // Pile path never goes through MSS — flags kept zero for schema parity.
      is_mss_path: false,
      mss_mobilization_czk: 0,
      mss_demobilization_czk: 0,
      mss_rental_czk: 0,
    },
    pile,
    norms_sources: {
      formwork_assembly: 'Pilota: bez systémového bednění (pažnice / CFA / tremie)',
      formwork_disassembly: 'Pilota: bez demontáže — odpažování za betonáže',
      rebar: `${rebarResult.norm_h_per_t} h/t (armokoš pre-fabrikovaný, osazení jeřábem). ` +
        `Zdroj: REBAR_NORMS, ČSN 73 1002`,
      curing: `Technologická přestávka ${pile.technological_pause_days} dní mezi betonáží a úpravou hlavy ` +
        `(ČSN 73 1002, ${input.concrete_class || 'C25/30'}, ${temperature}°C)`,
    },
    warnings,
    decision_log: log,
    // Resource Ceiling Phase 1 plumbing (Foundation B) — pile path mirror.
    // Pile relevance has num_carpenters=false, num_vibrators=false,
    // num_formwork_sets=false, num_pumps=false (tremie). User strop most
    // commonly hits num_cranes (armokoš transport) — Foundation C check.
    resource_ceiling: applyResourceCeilingDefaults('pilota', input.resource_ceiling),
    resource_violations: [],
  };
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
  /**
   * Block E (2026-04): labor breakdown from the main cost path. Variants
   * reuse these numbers because changing num_crews / num_sets does not
   * affect labor hours (man-hours conservation) — only total_days and
   * therefore rental. Passing the pre-computed values avoids duplicating
   * the 3-phase formwork / pour-task / props cost pipelines.
   */
  mainLaborBreakdown: {
    formwork_labor_czk: number;   // 3-phase total (initial+middle+final with multipliers)
    rebar_labor_czk: number;
    pour_labor_czk: number;       // includes overtime + night premium
    props_labor_czk: number;
    total_labor_czk: number;
  };
  rentalRate: number;              // effective rental rate (catalog or override)
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

          // Block E — variant cost parity.
          // Labor is invariant across variants (man-hours conservation: more
          // crews = shorter schedule but same total hours). Reuse the main
          // path's labor breakdown including 3-phase multipliers, pour
          // overtime + night premium, and props labor. Only rental scales
          // with total_days × num_sets.
          const rentalDays = days + 2;
          const variantRentalCZK = ctx.rentalRate > 0
            ? roundTo(ctx.fwArea * ctx.rentalRate * (rentalDays / 30) * sets, 2)
            : 0;
          const variantLaborCZK = ctx.mainLaborBreakdown.total_labor_czk;
          const totalCost = roundTo(variantLaborCZK + variantRentalCZK, 0);

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
            // Block G2: expose labor-vs-rental split so the UI can show
            // the user WHY cost changes (labor const, rental variable).
            cost_breakdown: {
              labor_czk: variantLaborCZK,
              rental_czk: variantRentalCZK,
            },
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
