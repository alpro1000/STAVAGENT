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
  /**
   * Pour crew size.
   *
   * R4 (Phase 1 — 2026-05-07): INFORMATIONAL ONLY. Field is accepted on
   * input for backward compat but NOT consumed by `calculatePourTask`.
   * Authoritative pour-crew composition comes from `computePourCrew(volume,
   * n_pump, element_type)` in `planner-orchestrator.ts:728`. Default-6
   * fallback removed; engine relies on caller-provided count from the
   * orchestrator's PourCrewBreakdown.
   */
  crew_size?: number;
  /** Shift hours. Default: 10 */
  shift_h?: number;

  /**
   * BUG-2: Optional target pour window (h). When set, an alternative
   * "target window" pump count is computed alongside the actual scenario.
   */
  target_window_h?: number;

  /**
   * Pump-consistency fix (2026-04-16): accept the authoritative pump count
   * from decidePourMode() instead of hardcoding 1. When decidePourMode
   * ran a multi-pump branch (monolithic > 1-pump window), it already
   * computed how many pumps the site needs; if this field is forwarded
   * the rate calculation below scales with it instead of silently
   * reverting to 1-pump duration. Default: 1 (single-pump baseline).
   */
  num_pumps_available?: number;
}

/** BUG-2: Pump scenario describing one possible pump configuration */
export interface PumpScenario {
  /** Number of pumps in this scenario */
  count: number;
  /** Combined m³/h capacity of all pumps */
  total_rate_m3_h: number;
  /** Resulting pour duration (h) including setup/washout */
  pour_duration_h: number;
  /** Czech label describing the scenario */
  scenario: string;
  /** Target window (h) — only set for the target scenario */
  target_window_h?: number;
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

  /**
   * BUG-2: Active scenario reflecting the actual pour duration with the
   * single-pump setup. Always present.
   */
  pumps_for_actual_window: PumpScenario;
  /**
   * BUG-2: Alternative scenario for a target pour window. Only present when
   * input.target_window_h is provided.
   */
  pumps_for_target_window?: PumpScenario;

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

// R4 fix (Phase 1 — 2026-05-07): removed `crew_size: 6`. Field was DEAD —
// `input.crew_size` is no longer read inside calculatePourTask() since the
// v4.24 refactor moved pour-crew composition into `computePourCrew()` in
// planner-orchestrator.ts. The `crew_size` field on PourTaskInput is now
// informational (orchestrator forwards it for backward compat but engine
// ignores it). One source of truth = `computePourCrew(volume, n_pump, element)`.
// See: docs/audits/calculator_resource_ceiling/2026-05-07_phase0_audit.md §6.1 R4
const DEFAULTS = {
  plant_rate_m3_h: 60,
  mixer_delivery_m3_h: 40,
  setup_h: 0.5,
  washout_h: 0.5,
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

  // --- Pump decision (before rate calc — affects effective rate) ---
  const pump_needed = profile.pump_typical || input.volume_m3 > 5;
  // Pump-consistency fix (2026-04-16): read the authoritative count from
  // the caller (orchestrator passes pourDecision.pumps_required). Before
  // this, the value was hardcoded 1, which caused the decision log to
  // report "4 čerpadel" (pour-decision) and "1 pump" (pour-task) in the
  // same plan. Now both engines agree.
  const pumps_required = Math.max(1, Math.floor(input.num_pumps_available ?? 1));
  const backup_pump_recommended = input.volume_m3 > 200;

  // Effective rate = MIN of all constraints, multiplied by number of pumps
  rates.sort((a, b) => a.rate - b.rate);
  const effective = rates[0];
  const single_pump_rate = effective.rate;
  const effective_rate_m3_h = single_pump_rate * pumps_required;
  const rate_bottleneck = effective.source;

  // --- Calculate durations ---
  const pumping_hours = input.volume_m3 / effective_rate_m3_h;
  const total_pour_hours = setup + pumping_hours + washout;
  const pour_days = roundTo(total_pour_hours / shift, 2);

  // --- BUG-2: Pump scenarios -------------------------------------------------
  // Actual scenario = single pump (or whatever was configured), reflects the
  // duration the user will actually face. Target scenario is only emitted if
  // the user gave a desired pour window.
  const actualScenario: PumpScenario = {
    count: pumps_required,
    total_rate_m3_h: roundTo(single_pump_rate * pumps_required, 1),
    pour_duration_h: roundTo(total_pour_hours, 2),
    scenario: `Skutečná doba betonáže (${pumps_required} ${pumps_required === 1 ? 'čerpadlo' : pumps_required < 5 ? 'čerpadla' : 'čerpadel'})`,
  };

  let targetScenario: PumpScenario | undefined;
  if (input.target_window_h && input.target_window_h > 0) {
    const targetWindow = input.target_window_h;
    const availForPump = Math.max(0.1, targetWindow - setup - washout);
    const requiredRate = input.volume_m3 / availForPump;
    const targetCount = Math.max(1, Math.ceil(requiredRate / single_pump_rate));
    const targetRate = single_pump_rate * targetCount;
    const targetDuration = setup + (input.volume_m3 / targetRate) + washout;
    targetScenario = {
      count: targetCount,
      total_rate_m3_h: roundTo(targetRate, 1),
      pour_duration_h: roundTo(targetDuration, 2),
      scenario: `Cílové okno ${targetWindow}h`,
      target_window_h: targetWindow,
    };
  }

  // --- Time window ---
  const window_config = T_WINDOW_HOURS[season];
  const pour_window_h = useRetarder ? window_config.with_retarder : window_config.no_retarder;
  const fits_in_window = pumping_hours <= pour_window_h;
  const pour_sessions = fits_in_window ? 1 : Math.ceil(pumping_hours / pour_window_h);

  // --- Warnings ---
  const warnings: string[] = [];

  const ctx = `[Záběr ${input.volume_m3} m³]`;
  if (!fits_in_window) {
    warnings.push(
      `${ctx} Doba betonáže ${roundTo(pumping_hours, 1)}h překračuje okno ${pour_window_h}h. ` +
      `Nutný pracovní šev, retardér, nebo více čerpadel (viz alternativní scénář).`
    );
  }
  // BUG-2: removed the "{N} čerpadla potřeba" warning that conflicted with the
  // single-pump scenario emitted above. Use pumps_for_target_window instead.
  if (backup_pump_recommended) {
    warnings.push(`${ctx} Objem > 200m³ — doporučeno záložní čerpadlo.`);
  }
  if (season === 'hot' && !useRetarder && pumping_hours > 3) {
    warnings.push(`${ctx} Letní betonáž > 3h bez retardéru — zvažte PCE přísadu.`);
  }
  if (rate_bottleneck === 'mixer') {
    warnings.push(`${ctx} Omezení rychlosti podáváním mixů (${effective_rate_m3_h} m³/h).`);
  }

  // --- Traceability ---
  const assumptions = [
    `element=${input.element_type}`,
    `vol=${input.volume_m3}m³`,
    `Q_eff=${effective_rate_m3_h}m³/h (${rate_bottleneck}${pumps_required > 1 ? ` ×${pumps_required} čerpadel` : ''})`,
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
    pumps_for_actual_window: actualScenario,
    pumps_for_target_window: targetScenario,
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
