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
import type { ConcreteClass, CementType } from './maturity.js';
import type { ElementProfile } from '../classifiers/element-classifier.js';
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';
import type { PropsCalculatorResult } from './props-calculator.js';
import { calculateStrategiesDetailed } from './formwork.js';
import type { LateralPressureResult, PourStagesSuggestion, PourMethod } from './lateral-pressure.js';
export interface PlannerInput {
    /** Czech name/description for auto-classification */
    element_name?: string;
    /** Or explicit type (skips classification) */
    element_type?: StructuralElementType;
    /** Total concrete volume (m³) */
    volume_m3: number;
    /** Formwork area per tact (m²). If not given, estimated from volume, height, and element geometry */
    formwork_area_m2?: number;
    /** Height from ground/floor to underside of element (m). Used for props calculation. */
    height_m?: number;
    /** Exact rebar mass (kg). If not given, estimated from element type. */
    rebar_mass_kg?: number;
    /** Does the element have dilatation joints? */
    has_dilatacni_spary: boolean;
    /** Joint spacing (m) — required if has_spary=true */
    spara_spacing_m?: number;
    /** Total element length (m) */
    total_length_m?: number;
    /** Adjacent sections? */
    adjacent_sections?: boolean;
    season?: SeasonMode;
    use_retarder?: boolean;
    /** Concrete delivery method. If not given, inferred from element profile and height. */
    pour_method?: PourMethod;
    concrete_class?: ConcreteClass;
    cement_type?: CementType;
    /** Average ambient temperature (°C). Default: 15 */
    temperature_c?: number;
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
    /** Explicit formwork system name (overrides auto-recommendation) */
    formwork_system_name?: string;
    /** Override rental price (Kč/m²/month or Kč/bm/month). If set, replaces catalog value. */
    rental_czk_override?: number;
    /** Cross-section shape correction for formwork assembly/disassembly.
     *  1.0 = straight (default), 1.3 = angled, 1.5 = circular, 1.8 = irregular.
     *  Multiplies assembly_h_m2 and disassembly_h_m2 (not rebar/pour). */
    formwork_shape_correction?: number;
    /** Number of identical elements (e.g. 20 pad foundations). Default: 1 */
    num_identical_elements?: number;
    /** Formwork sets available for rotation among identical elements.
     *  Default: num_sets. Only relevant when num_identical_elements > 1. */
    formwork_sets_count?: number;
    /** Direct number of tacts (overrides auto-calculation from spáry).
     *  Use for foundations, piers, etc. where each element = 1 tact.
     *  Example: 8 pier foundations = num_tacts_override: 8 */
    num_tacts_override?: number;
    /** Volume per tact (m³). If not given, total volume / num_tacts. */
    tact_volume_m3_override?: number;
    /** Scheduling mode override: 'linear' or 'chess' */
    scheduling_mode_override?: 'linear' | 'chess';
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
    /** Is the element prestressed (předpjatý beton)? Adds PRESTRESS step to schedule. */
    is_prestressed?: boolean;
    /** Prestressing duration override (days). Auto-calculated from bridge length if not given. */
    prestress_days_override?: number;
    /** Bridge deck cross-section subtype. Affects difficulty factor and warnings. */
    bridge_deck_subtype?: 'deskovy' | 'dvoutram' | 'komora';
    /** Concrete exposure class (e.g. 'XF2', 'XD3', 'XF4'). For validation warnings. */
    exposure_class?: string;
    /** Run Monte Carlo simulation. Default: false */
    enable_monte_carlo?: boolean;
    /** Monte Carlo iterations. Default: 10000 */
    monte_carlo_iterations?: number;
    /** Investor/project deadline in working days. If total_days exceeds this,
     *  the system warns and suggests optimized resource configurations. */
    deadline_days?: number;
}
export interface PlannerOutput {
    element: {
        type: StructuralElementType;
        label_cs: string;
        classification_confidence: number;
        profile: ElementProfile;
    };
    pour_decision: PourDecisionOutput;
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
    obratkovost?: {
        num_identical_elements: number;
        formwork_sets_count: number;
        obratkovost: number;
        rental_per_element_czk: number;
        total_duration_days: number;
        transfer_time_days: number;
    };
    rebar: RebarLiteResult;
    pour: PourTaskResult;
    schedule: ElementScheduleOutput;
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
    lateral_pressure?: LateralPressureResult;
    pour_stages?: PourStagesSuggestion;
    prestress?: {
        days: number;
        crew_size: number;
        skruz_total_days: number;
    };
    props?: PropsCalculatorResult;
    monte_carlo?: MonteCarloResult;
    deadline_check?: DeadlineCheckResult;
    norms_sources: {
        formwork_assembly: string;
        formwork_disassembly: string;
        rebar: string;
        curing: string;
        skruz?: string;
    };
    warnings: string[];
    decision_log: string[];
}
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
export declare function planElement(input: PlannerInput): PlannerOutput;
