/**
 * Pile Engine — bored pile (vrtaná pilota) productivity, schedule and cost
 *
 * Piles are fundamentally different from every other monolithic element:
 *   - No formwork — soil IS the form
 *   - No lateral pressure — there's nothing to push against
 *   - No tacts — 1 pilota = 1 záběr always
 *   - No supports — pile is in the ground
 *   - Concrete is placed via tremie pipe (under water) or direct discharge
 *     into a dry bore — never with a pump, no vibration (S4/SCC)
 *   - Reinforcement is a pre-fabricated cage (armokoš) lifted by crane,
 *     not in-situ rebar
 *   - Schedule bottleneck is the drilling rig, not crews
 *
 * This module provides:
 *   - PILE_PRODUCTIVITY_TABLE: piles per shift by diameter × geology × method
 *   - calculatePileDrilling(): main entry that builds drilling/concreting
 *     phases, optional pile cap (hlavice), labor/material costs and a
 *     simple traceability log
 *
 * The orchestrator (planner-orchestrator.ts) routes through this module
 * via an early branch when element_type === 'pilota'. The result is then
 * mapped into a standard PlannerOutput so consumers (PlanResult cards,
 * applyPlanToPositions, scheduler-shaped fields) keep working without
 * a parallel type system.
 *
 * Productivity ranges are taken from the task spec (TZ + ČSN 73 1002):
 *
 *   Ø600  CFA (soudržná)        5–8  pilot/směna
 *   Ø600  s pažnicí (soudržná)  3–5  pilot/směna
 *   Ø600  s pažnicí (pod HPV)   2–4  pilot/směna
 *   Ø600  skalní podloží        1–3  pilot/směna
 *   ... (full table below)
 *
 * For diameters between catalog rows we linearly interpolate the mid value
 * by the diameter ratio so an arbitrary Ø500 / Ø750 input does not crash.
 */
/** Geological condition that drives drilling speed. */
export type PileGeology = 'cohesive' | 'noncohesive' | 'below_gwt' | 'rock';
/** Drilling / casing method. */
export type PileCasingMethod = 'cfa' | 'cased' | 'uncased';
/** Optional pile cap (hlavice) — small concrete patka above the pile. */
export interface PileCapInput {
    /** Length × width × height in metres. Volume derived if not given. */
    length_m: number;
    width_m: number;
    height_m: number;
}
/** All pile-specific input fields. Most are optional and have defaults. */
export interface PileInput {
    /** Pile diameter in millimetres. Default 600. */
    diameter_mm?: number;
    /** Pile length in metres. Default 10. */
    length_m?: number;
    /** Number of piles. If omitted, derived from total volume_m3 ÷ volume per pile. */
    count?: number;
    /** Total concrete volume across all piles. Required (drives back-calculation when count is missing). */
    volume_m3: number;
    /** Geology — drives productivity table column. Default 'cohesive'. */
    geology?: PileGeology;
    /** Casing method. Default 'cfa' (continuous flight auger). */
    casing_method?: PileCasingMethod;
    /** Reinforcement index in kg per m³ of concrete. Default 40. */
    rebar_index_kg_m3?: number;
    /**
     * BUG-P1 (2026-04-15): concrete class affects consistency requirements
     * (S4 minimum under water), cost, and technological pause length.
     * When not given, uses C25/30 defaults.
     */
    concrete_class?: string;
    /**
     * BUG-P2 (2026-04-15): overpouring height in metres. Real piles are
     * cast 0.3–1.0 m above the design top so the poor-quality laitance
     * concrete in the head can be chipped away. Default 0.5 m.
     */
    overpouring_m?: number;
    /**
     * BUG-P4 (2026-04-15): integrity tests. CHA (cross-hole analysis) is
     * the slow/expensive test, PIT (low-strain pulse) is the cheap one.
     * TZ SO-202 §6.3.3: 16× CHA + rest PIT. Both counts default to 0
     * (opt-in from the UI).
     */
    cha_test_count?: number;
    /** Number of PIT (low-strain integrity) tests. Default 0. */
    pit_test_count?: number;
    /** CHA test cost per pile in Kč. Default 40 000. */
    cha_test_czk?: number;
    /** PIT test cost per pile in Kč. Default 5 000. */
    pit_test_czk?: number;
    /** Optional pile cap (hlavice). When present, cap days are added to the schedule. */
    pile_cap?: PileCapInput;
    /** Crew sizing & wages — fall back to PlannerInput defaults if omitted. */
    crew_size?: number;
    shift_h?: number;
    wage_czk_h?: number;
    /** Drilling rig day rate in Kč per shift. Default 25 000. */
    rig_czk_per_shift?: number;
    /** Crane day rate in Kč per shift (rebar cage placement + casing handling). Default 8 000. */
    crane_czk_per_shift?: number;
}
/** Output of the pile-specific calculation. Lives under PlannerOutput.pile. */
export interface PileResult {
    /** Echo of normalised inputs (with defaults applied). */
    diameter_mm: number;
    length_m: number;
    count: number;
    geology: PileGeology;
    casing_method: PileCasingMethod;
    rebar_index_kg_m3: number;
    /** BUG-P1: concrete class actually used by the schedule. */
    concrete_class: string;
    /** Volume of one pile in m³ (π × r² × L). */
    volume_per_pile_m3: number;
    /**
     * Total concrete volume across all piles in m³ INCLUDING overpouring loss.
     * For a Ø900 × 12m × 16 pile with overpouring_m=0.5 this is
     *   16 × π × 0.45² × 12.5 ≈ 127.2 m³ (vs. 122.1 m³ design).
     */
    total_volume_m3: number;
    /** BUG-P2: overpouring loss — extra concrete cast above design top (m³). */
    overpouring_loss_m3: number;
    /** BUG-P2: overpouring height applied per pile (m). */
    overpouring_m: number;
    /** Productivity in piles per shift (mid-range from PILE_PRODUCTIVITY_TABLE). */
    productivity_pile_per_shift: number;
    /** Schedule phases in working days. */
    drilling_days: number;
    /** Technological pause between drilling completion and head adjustment (typically 7d). */
    technological_pause_days: number;
    /** Head-adjustment days (odbourání nekvalitního betonu, diameter-dependent). */
    head_adjustment_days: number;
    /** BUG-P3: heads_per_shift actually used (diameter-dependent). */
    heads_per_shift_used: number;
    /** Optional pile cap days (bednění + výztuž + betonáž + zrání + odbednění). */
    pile_cap_days?: number;
    /** Total schedule days across all phases. */
    total_days: number;
    /** Total reinforcement mass (armokoše) in kilograms. */
    rebar_total_kg: number;
    /** BUG-P4: integrity tests — summary of CHA/PIT counts and cost. */
    integrity_tests?: {
        cha_count: number;
        pit_count: number;
        cha_czk: number;
        pit_czk: number;
        total_czk: number;
    };
    /** Cost breakdown in CZK (labor only — material is external like the rest of the planner). */
    costs: {
        drilling_rig_czk: number;
        crane_czk: number;
        crew_labor_czk: number;
        head_adjustment_labor_czk: number;
        pile_cap_labor_czk: number;
        /** BUG-P4: integrity tests (CHA + PIT). 0 when not requested. */
        integrity_tests_czk: number;
        total_labor_czk: number;
    };
    /** Czech-language traceability log (one line per phase). */
    log: string[];
}
/**
 * Productivity lookup with linear interpolation by diameter for off-catalog sizes.
 * Diameters below the catalog minimum clamp to the smallest row;
 * diameters above the maximum clamp to the largest row.
 *
 * Productivity falls roughly with the cross-section area (∝ diameter²),
 * so we interpolate in 1/diameter² space which empirically tracks the
 * tabular ranges better than linear-in-diameter.
 */
export declare function getPileProductivity(diameter_mm: number, geology: PileGeology, casing_method: PileCasingMethod): number;
/** Volume of one cylindrical pile in m³: π × (Ø/2)² × L. */
export declare function calculatePileVolume(diameter_mm: number, length_m: number): number;
/**
 * Derive pile count from total volume when the user only gave volume_m3.
 * Returns at least 1.
 */
export declare function derivePileCount(total_volume_m3: number, diameter_mm: number, length_m: number): number;
export declare function getHeadsPerShift(diameter_mm: number): number;
/**
 * BUG 3/3b: Default rebar index depends on pile diameter.
 *
 * Pozemní piloty (Ø<800) use 30-50 kg/m³ (light cages).
 * Mostní Ø900 use ~90 kg/m³ (B500B podélná + spirála + CHA roury).
 * Mostní Ø1200+ use ~100 kg/m³ (heavier cage + more spirála/m).
 *
 * Table (SO-202 Ø900, SO-203 Ø1200, SO-207 mix):
 *   Ø < 800  → 40 kg/m³  (pozemní)
 *   800-999  → 90 kg/m³  (mostní Ø900)
 *   ≥ 1000   → 100 kg/m³ (mostní Ø1200+)
 */
export declare function getDefaultRebarIndex(diameter_mm: number): number;
/**
 * calculatePileDrilling — main entry point used by the orchestrator's pile branch.
 *
 * Steps:
 *   1. Resolve defaults for missing pile-specific inputs
 *   2. Compute volume_per_pile (or back-derive count from total volume)
 *   3. Look up productivity from the table
 *   4. Build schedule phases: drilling → 7d pause → head adjustment → optional cap
 *   5. Build cost breakdown (rig × shifts + crane × shifts + crew × shifts × wage + cap labor)
 *   6. Emit a Czech traceability log
 *
 * Material costs (concrete, steel) are NOT included — same convention as the
 * rest of the planner, where material is treated as external and only labor
 * + equipment rental flow through the engines.
 */
export declare function calculatePileDrilling(input: PileInput): PileResult;
