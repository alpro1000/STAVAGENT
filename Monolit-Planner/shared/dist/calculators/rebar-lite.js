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
import { calculateRebar } from './rebar.js';
import { getElementProfile, estimateRebarMass } from '../classifiers/element-classifier.js';
// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULTS = {
    crew_size: 4,
    shift_h: 10,
    k: 0.8,
    wage_czk_h: 398,
};
// ─── Main API ────────────────────────────────────────────────────────────────
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
export function calculateRebarLite(input) {
    const profile = getElementProfile(input.element_type);
    const crew = input.crew_size ?? DEFAULTS.crew_size;
    const shift = input.shift_h ?? DEFAULTS.shift_h;
    const k = input.k ?? DEFAULTS.k;
    const wage = input.wage_czk_h ?? DEFAULTS.wage_czk_h;
    // --- Determine mass ---
    let mass_kg;
    let mass_source;
    let mass_range_kg;
    if (input.mass_kg !== undefined && input.mass_kg > 0) {
        mass_kg = input.mass_kg;
        mass_source = 'user';
    }
    else {
        const est = estimateRebarMass(input.element_type, input.volume_m3);
        mass_kg = est.estimated_kg;
        mass_source = 'estimated';
        mass_range_kg = [est.min_kg, est.max_kg];
    }
    const mass_t = mass_kg / 1000;
    const norm_h_per_t = profile.rebar_norm_h_per_t;
    // --- Base calculation ---
    const base = calculateRebar({
        mass_t,
        norm_h_per_t,
        crew_size: crew,
        shift_h: shift,
        k,
        wage_czk_h: wage,
        source_tag: mass_source === 'user' ? 'USER' : 'ELEMENT_ESTIMATE',
        confidence: mass_source === 'user' ? 0.95 : 0.7,
    });
    // --- 3-point estimate (PERT-like) ---
    // Optimistic: -15% duration (good crew, simple layout)
    // Pessimistic: +30% duration (complex connections, weather delays)
    const optimistic_days = roundTo(base.duration_days * 0.85, 2);
    const most_likely_days = base.duration_days;
    const pessimistic_days = roundTo(base.duration_days * 1.30, 2);
    // --- Crew recommendation ---
    // If duration > 5 days, suggest increasing crew
    const labor_hours = base.labor_hours;
    const recommended_crew = Math.max(2, Math.min(8, Math.ceil(labor_hours / (5 * shift * k))));
    // --- Build result ---
    const assumptions = [
        `element=${input.element_type}`,
        `vol=${input.volume_m3}m³`,
        `mass=${mass_t.toFixed(3)}t (${mass_source})`,
        `norm=${norm_h_per_t}h/t`,
        `crew=${crew}`,
        `shift=${shift}h`,
    ];
    return {
        mass_kg: roundTo(mass_kg, 1),
        mass_t: roundTo(mass_t, 3),
        mass_source,
        mass_range_kg,
        norm_h_per_t,
        labor_hours: base.labor_hours,
        duration_days: base.duration_days,
        cost_labor: base.cost_labor,
        optimistic_days,
        most_likely_days,
        pessimistic_days,
        crew_size: crew,
        recommended_crew,
        element_type: input.element_type,
        confidence: base.confidence,
        assumptions_log: assumptions.join(', '),
    };
}
/**
 * Calculate crew needed to complete rebar work in target_days.
 */
export function crewForTargetDays(element_type, volume_m3, target_days, mass_kg, shift_h = DEFAULTS.shift_h, k = DEFAULTS.k) {
    const profile = getElementProfile(element_type);
    const actual_mass_kg = mass_kg ?? estimateRebarMass(element_type, volume_m3).estimated_kg;
    const mass_t = actual_mass_kg / 1000;
    const labor_hours = mass_t * profile.rebar_norm_h_per_t;
    return Math.max(2, Math.ceil(labor_hours / (target_days * shift_h * k)));
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function roundTo(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
