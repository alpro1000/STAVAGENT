/**
 * Pour Task Engine v1.0
 *
 * High-level element-aware pouring calculator.
 * Determines pour duration, pump requirements, effective delivery rate,
 * and time window based on element type and constraints.
 *
 * Integrates:
 * - Element Classifier (pour rate limits, pump flag)
 * - Pour Decision Tree (sectional/monolithic, captures)
 * - Concreting Calculator (low-level pump cost)
 *
 * Key principle: effective rate = MIN(pump_capacity, plant_rate, mixer_delivery, site_constraint, element_limit)
 */
import type { StructuralElementType, SeasonMode } from './pour-decision.js';
export interface PourTaskInput {
    element_type: StructuralElementType;
    /** Volume to pour in this tact (m³) */
    volume_m3: number;
    /** Pump technical capacity (m³/h). Default: element-specific max. */
    pump_capacity_m3_h?: number;
    /** Concrete plant production rate (m³/h). Default: 60 */
    plant_rate_m3_h?: number;
    /** Mixer truck delivery rate (m³/h based on round-trip). Default: 40 */
    mixer_delivery_m3_h?: number;
    /** Site placement constraint (m³/h). Default: no limit */
    site_constraint_m3_h?: number;
    /** Season (affects pour window). Default: 'normal' */
    season?: SeasonMode;
    /** Use PCE retarder? Default: false */
    use_retarder?: boolean;
    /** Setup time (h). Default: 0.5 */
    setup_h?: number;
    /** Washout time (h). Default: 0.5 */
    washout_h?: number;
    /** Pour crew size. Default: 6 */
    crew_size?: number;
    /** Shift hours. Default: 10 */
    shift_h?: number;
}
export interface PourTaskResult {
    /** Effective delivery rate — the actual bottleneck rate (m³/h) */
    effective_rate_m3_h: number;
    /** What limits the rate */
    rate_bottleneck: 'pump' | 'plant' | 'mixer' | 'site' | 'element';
    /** Pure pumping duration (h) */
    pumping_hours: number;
    /** Total pour duration including setup and washout (h) */
    total_pour_hours: number;
    /** Pour duration in work days */
    pour_days: number;
    /** Whether pump is needed */
    pump_needed: boolean;
    /** Number of pumps required (1 or 2 for large pours) */
    pumps_required: number;
    /** Whether backup pump is recommended (volume > 200m³) */
    backup_pump_recommended: boolean;
    /** Available pour window (h) */
    pour_window_h: number;
    /** Whether pour fits in one window */
    fits_in_window: boolean;
    /** If not fits, how many days needed */
    pour_sessions: number;
    warnings: string[];
    assumptions_log: string;
}
/**
 * Calculate pour task parameters for a concrete element.
 *
 * @example
 * // Bridge deck, 120 m³
 * calculatePourTask({
 *   element_type: 'mostovkova_deska',
 *   volume_m3: 120,
 *   season: 'hot',
 * })
 * // → effective_rate: 30 m³/h, total_pour_hours: 5h, pump_needed: true
 */
export declare function calculatePourTask(input: PourTaskInput): PourTaskResult;
/**
 * Quick check: does this element need a pump?
 */
export declare function needsPump(element_type: StructuralElementType, volume_m3: number): boolean;
/**
 * Quick estimate: approximate pour duration for scheduling.
 * Returns hours (not days).
 */
export declare function quickPourEstimate(element_type: StructuralElementType, volume_m3: number): number;
