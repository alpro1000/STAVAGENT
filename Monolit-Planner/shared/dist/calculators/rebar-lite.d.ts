/**
 * Rebar Lite Engine v1.0
 *
 * Element-aware reinforcement estimator.
 * When exact mass is unknown, estimates from element type + volume.
 * When mass is known, uses it directly with element-specific labor norms.
 *
 * Extends base rebar calculator with:
 * - Element-type-based rebar ratio estimation
 * - Element-specific labor norms (h/t)
 * - 3-point estimation (optimistic / most likely / pessimistic)
 * - Crew recommendation based on duration target
 */
import type { StructuralElementType } from './pour-decision.js';
export interface RebarLiteInput {
    element_type: StructuralElementType;
    /** Concrete volume (m³) — used to estimate rebar mass if mass_kg not given */
    volume_m3: number;
    /** Exact rebar mass (kg) — if known, overrides estimation */
    mass_kg?: number;
    /** Crew size (default: 4) */
    crew_size?: number;
    /** Shift hours (default: 10) */
    shift_h?: number;
    /** Time utilization factor (default: 0.8) */
    k?: number;
    /** Wage CZK/h (default: 398) */
    wage_czk_h?: number;
}
export interface RebarLiteResult {
    mass_kg: number;
    mass_t: number;
    mass_source: 'user' | 'estimated';
    /** Only present when estimated */
    mass_range_kg?: [number, number];
    norm_h_per_t: number;
    labor_hours: number;
    duration_days: number;
    cost_labor: number;
    optimistic_days: number;
    most_likely_days: number;
    pessimistic_days: number;
    crew_size: number;
    recommended_crew: number;
    /** If target_days were given, what crew is needed */
    crew_for_target?: number;
    element_type: StructuralElementType;
    confidence: number;
    assumptions_log: string;
}
/**
 * Calculate rebar work with element-type awareness.
 *
 * @example
 * // With known mass
 * calculateRebarLite({ element_type: 'mostovkova_deska', volume_m3: 120, mass_kg: 18000 })
 *
 * // Without mass — auto-estimate from element type
 * calculateRebarLite({ element_type: 'zaklady_piliru', volume_m3: 50 })
 */
export declare function calculateRebarLite(input: RebarLiteInput): RebarLiteResult;
/**
 * Calculate crew needed to complete rebar work in target_days.
 */
export declare function crewForTargetDays(element_type: StructuralElementType, volume_m3: number, target_days: number, mass_kg?: number, shift_h?: number, k?: number): number;
