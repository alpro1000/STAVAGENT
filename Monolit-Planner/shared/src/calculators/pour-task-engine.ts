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
import { T_WINDOW_HOURS } from './pour-decision.js';
import { getElementProfile } from '../classifiers/element-classifier.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PourTaskInput {
  element_type: StructuralElementType;
  /** Volume to pour in this tact (m³) */
  volume_m3: number;

  // --- Rate constraints (all optional, uses defaults if not given) ---
  /** Pump technical capacity (m³/h). Default: element-specific max. */
  pump_capacity_m3_h?: number;
  /** Concrete plant production rate (m³/h). Default: 60 */
  plant_rate_m3_h?: number;
  /** Mixer truck delivery rate (m³/h based on round-trip). Default: 40 */
  mixer_delivery_m3_h?: number;
  /** Site placement constraint (m³/h). Default: no limit */
  site_constraint_m3_h?: number;

  // --- Time parameters ---
  /** Season (affects pour window). Default: 'normal' */
  season?: SeasonMode;
  /** Use PCE retarder? Default: false */
  use_retarder?: boolean;
  /** Setup time (h). Default: 0.5 */
  setup_h?: number;
  /** Washout time (h). Default: 0.5 */
  washout_h?: number;

  // --- Crew ---
  /** Pour crew size. Default: 6 */
  crew_size?: number;
  /** Shift hours. Default: 10 */
  shift_h?: number;
}

export interface PourTaskResult {
  // --- Core output ---
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

  // --- Pump ---
  /** Whether pump is needed */
  pump_needed: boolean;
  /** Number of pumps required (1 or 2 for large pours) */
  pumps_required: number;
  /** Whether backup pump is recommended (volume > 200m³) */
  backup_pump_recommended: boolean;

  // --- Time window ---
  /** Available pour window (h) */
  pour_window_h: number;
  /** Whether pour fits in one window */
  fits_in_window: boolean;
  /** If not fits, how many days needed */
  pour_sessions: number;

  // --- Warnings ---
  warnings: string[];

  // --- Traceability ---
  assumptions_log: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  plant_rate_m3_h: 60,
  mixer_delivery_m3_h: 40,
  setup_h: 0.5,
  washout_h: 0.5,
  crew_size: 6,
  shift_h: 10,
} as const;

// ─── Main API ────────────────────────────────────────────────────────────────

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
export function calculatePourTask(input: PourTaskInput): PourTaskResult {
  const profile = getElementProfile(input.element_type);
  const season = input.season ?? 'normal';
  const useRetarder = input.use_retarder ?? false;
  const setup = input.setup_h ?? DEFAULTS.setup_h;
  const washout = input.washout_h ?? DEFAULTS.washout_h;
  const shift = input.shift_h ?? DEFAULTS.shift_h;

  // --- Determine effective rate ---
  const rates: Array<{ source: PourTaskResult['rate_bottleneck']; rate: number }> = [
    { source: 'element', rate: profile.max_pour_rate_m3_h },
    { source: 'plant', rate: input.plant_rate_m3_h ?? DEFAULTS.plant_rate_m3_h },
    { source: 'mixer', rate: input.mixer_delivery_m3_h ?? DEFAULTS.mixer_delivery_m3_h },
  ];

  if (input.pump_capacity_m3_h !== undefined) {
    rates.push({ source: 'pump', rate: input.pump_capacity_m3_h });
  }
  if (input.site_constraint_m3_h !== undefined) {
    rates.push({ source: 'site', rate: input.site_constraint_m3_h });
  }

  // Effective rate = MIN of all constraints
  rates.sort((a, b) => a.rate - b.rate);
  const effective = rates[0];
  const effective_rate_m3_h = effective.rate;
  const rate_bottleneck = effective.source;

  // --- Calculate durations ---
  const pumping_hours = input.volume_m3 / effective_rate_m3_h;
  const total_pour_hours = setup + pumping_hours + washout;
  const pour_days = roundTo(total_pour_hours / shift, 2);

  // --- Pump decision ---
  const pump_needed = profile.pump_typical || input.volume_m3 > 5;
  const pumps_required = input.volume_m3 > 300 ? 2 : 1;
  const backup_pump_recommended = input.volume_m3 > 200;

  // --- Time window ---
  const window_config = T_WINDOW_HOURS[season];
  const pour_window_h = useRetarder ? window_config.with_retarder : window_config.no_retarder;
  const fits_in_window = pumping_hours <= pour_window_h;
  const pour_sessions = fits_in_window ? 1 : Math.ceil(pumping_hours / pour_window_h);

  // --- Warnings ---
  const warnings: string[] = [];

  if (!fits_in_window) {
    warnings.push(
      `Doba betonáže ${roundTo(pumping_hours, 1)}h překračuje okno ${pour_window_h}h. ` +
      `Nutný pracovní šev nebo retardér.`
    );
  }
  if (pumps_required > 1) {
    warnings.push(`Objem ${input.volume_m3}m³ vyžaduje ${pumps_required} čerpadla.`);
  }
  if (backup_pump_recommended) {
    warnings.push(`Objem > 200m³ — doporučeno záložní čerpadlo.`);
  }
  if (season === 'hot' && !useRetarder && pumping_hours > 3) {
    warnings.push(`Letní betonáž > 3h bez retardéru — zvažte PCE přísadu.`);
  }
  if (rate_bottleneck === 'mixer') {
    warnings.push(`Omezení rychlosti podáváním mixů (${effective_rate_m3_h} m³/h).`);
  }

  // --- Traceability ---
  const assumptions = [
    `element=${input.element_type}`,
    `vol=${input.volume_m3}m³`,
    `Q_eff=${effective_rate_m3_h}m³/h (${rate_bottleneck})`,
    `window=${pour_window_h}h`,
    `season=${season}`,
    useRetarder ? 'retarder=yes' : 'retarder=no',
  ].join(', ');

  return {
    effective_rate_m3_h: roundTo(effective_rate_m3_h, 1),
    rate_bottleneck,
    pumping_hours: roundTo(pumping_hours, 2),
    total_pour_hours: roundTo(total_pour_hours, 2),
    pour_days,
    pump_needed,
    pumps_required,
    backup_pump_recommended,
    pour_window_h,
    fits_in_window,
    pour_sessions,
    warnings,
    assumptions_log: assumptions,
  };
}

/**
 * Quick check: does this element need a pump?
 */
export function needsPump(element_type: StructuralElementType, volume_m3: number): boolean {
  const profile = getElementProfile(element_type);
  return profile.pump_typical || volume_m3 > 5;
}

/**
 * Quick estimate: approximate pour duration for scheduling.
 * Returns hours (not days).
 */
export function quickPourEstimate(
  element_type: StructuralElementType,
  volume_m3: number
): number {
  const profile = getElementProfile(element_type);
  const pumping = volume_m3 / profile.max_pour_rate_m3_h;
  return roundTo(0.5 + pumping + 0.5, 2); // setup + pour + washout
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
