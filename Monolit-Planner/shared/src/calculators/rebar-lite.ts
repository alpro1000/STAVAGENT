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
import type { RebarCalculatorResult } from './types.js';
import { calculateRebar } from './rebar.js';
import {
  getElementProfile,
  estimateRebarMass,
  getRebarNormForDiameter,
  type RebarCategory,
} from '../classifiers/element-classifier.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RebarLiteInput {
  element_type: StructuralElementType;
  /** Concrete volume (m³) — used to estimate rebar mass if mass_kg not given */
  volume_m3: number;
  /** Exact rebar mass (kg) — if known, overrides estimation */
  mass_kg?: number;
  /**
   * Main-bar diameter (mm). When provided, engine looks up the labor norm
   * in `REBAR_RATES_MATRIX[category][diameter]` (v4.24). When omitted, the
   * element's `rebar_default_diameter_mm` is used (D12 walls, D20 slabs, …).
   */
  rebar_diameter_mm?: number;
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
  // --- Mass ---
  mass_kg: number;
  mass_t: number;
  mass_source: 'user' | 'estimated';
  /** Only present when estimated */
  mass_range_kg?: [number, number];

  // --- Labor ---
  norm_h_per_t: number;
  /** Source of the h/t norm used: 'matrix' (diameter×category) or 'legacy' (per-element fallback) */
  norm_source: 'matrix' | 'legacy';
  /** Category used for matrix lookup (undefined on legacy) */
  norm_category?: RebarCategory;
  /** Diameter used for matrix lookup (user-provided OR element default) */
  norm_diameter_mm?: number;
  labor_hours: number;
  duration_days: number;
  cost_labor: number;

  // --- 3-point estimate ---
  optimistic_days: number;
  most_likely_days: number;
  pessimistic_days: number;

  // --- Crew ---
  crew_size: number;
  recommended_crew: number;
  /** If target_days were given, what crew is needed */
  crew_for_target?: number;

  // --- Traceability ---
  element_type: StructuralElementType;
  confidence: number;
  assumptions_log: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  crew_size: 4,
  shift_h: 10,
  k: 0.8,
  wage_czk_h: 398,
} as const;

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
export function calculateRebarLite(input: RebarLiteInput): RebarLiteResult {
  const profile = getElementProfile(input.element_type);
  const crew = input.crew_size ?? DEFAULTS.crew_size;
  const shift = input.shift_h ?? DEFAULTS.shift_h;
  const k = input.k ?? DEFAULTS.k;
  const wage = input.wage_czk_h ?? DEFAULTS.wage_czk_h;

  // --- Determine mass ---
  let mass_kg: number;
  let mass_source: 'user' | 'estimated';
  let mass_range_kg: [number, number] | undefined;

  if (input.mass_kg !== undefined && input.mass_kg > 0) {
    mass_kg = input.mass_kg;
    mass_source = 'user';
  } else {
    const est = estimateRebarMass(input.element_type, input.volume_m3);
    mass_kg = est.estimated_kg;
    mass_source = 'estimated';
    mass_range_kg = [est.min_kg, est.max_kg];
  }

  const mass_t = mass_kg / 1000;
  // Diameter-aware norm lookup (v4.24 BUG A): matrix[category][diameter]
  // with fallback to legacy per-element `profile.rebar_norm_h_per_t`.
  const normLookup = getRebarNormForDiameter(input.element_type, input.rebar_diameter_mm);
  const norm_h_per_t = normLookup.norm_h_per_t;

  // --- Base calculation ---
  const base: RebarCalculatorResult = calculateRebar({
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
  const normTag =
    normLookup.source === 'matrix'
      ? `${norm_h_per_t}h/t (${normLookup.category} D${normLookup.used_diameter_mm})`
      : `${norm_h_per_t}h/t (legacy ${input.element_type})`;
  const assumptions: string[] = [
    `element=${input.element_type}`,
    `vol=${input.volume_m3}m³`,
    `mass=${mass_t.toFixed(3)}t (${mass_source})`,
    `norm=${normTag}`,
    `crew=${crew}`,
    `shift=${shift}h`,
  ];

  return {
    mass_kg: roundTo(mass_kg, 1),
    mass_t: roundTo(mass_t, 3),
    mass_source,
    mass_range_kg,
    norm_h_per_t,
    norm_source: normLookup.source,
    norm_category: normLookup.category,
    norm_diameter_mm: normLookup.used_diameter_mm,
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
export function crewForTargetDays(
  element_type: StructuralElementType,
  volume_m3: number,
  target_days: number,
  mass_kg?: number,
  shift_h: number = DEFAULTS.shift_h,
  k: number = DEFAULTS.k,
  rebar_diameter_mm?: number,
): number {
  const actual_mass_kg = mass_kg ?? estimateRebarMass(element_type, volume_m3).estimated_kg;
  const mass_t = actual_mass_kg / 1000;
  const norm = getRebarNormForDiameter(element_type, rebar_diameter_mm).norm_h_per_t;
  const labor_hours = mass_t * norm;
  return Math.max(2, Math.ceil(labor_hours / (target_days * shift_h * k)));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
