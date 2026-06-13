/**
 * project-planner — Phase 5 Step 1: the PROJECT layer over the one-element engine.
 *
 * Recon #1352 established the root cause of "can't describe a whole project":
 * `planElement(input: PlannerInput)` is one element per call; `PlannerInput`
 * has no element array. This module is the **additive wrapper** (Path A,
 * Alexander's pre-implementation interview 2026-06-13): a project = a list of
 * elements; the engine runs each element through the UNCHANGED `planElement`,
 * and the project level aggregates.
 *
 * Decisions (interview):
 *  - Path A: wrapper over the one-element core; the core is untouched.
 *  - Schedule = independent per element + SUM (sequential rollup, mirroring the
 *    existing `summarizeScheduleProjections` behaviour). NO cross-element
 *    overlap — that is scheduler work, excluded from Phase 5.
 *  - One-element back-compat by design: `planElement` / `/api/calculate` stay
 *    byte-identical; `planProject([x])` element[0].plan ≡ `planElement(x)`.
 *
 * Honest aggregation: an element whose `planElement` throws (e.g. invalid
 * input) is recorded as uncalculated with its error — the project returns a
 * PARTIAL sum + an `elements_uncalculated` count (the "Nevypočtených N" badge
 * the seam-fix already uses for Času), never a fabricated total.
 */

import { planElement } from './planner-orchestrator.js';
import type { PlannerInput, PlannerOutput } from './planner-orchestrator.js';
import { buildLaborProjection } from './labor-projection.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Total money for one element = direct labor + every rental that is not
 * already folded into labor. `total_labor_czk` covers all labor (incl. MSS
 * mobilization/demobilization, per the costs comment); the rentals below are
 * the only money kept outside labor. Pile plans carry 0 rentals.
 */
function elementCostCZK(plan: PlannerOutput): number {
  const c = plan.costs;
  return (c.total_labor_czk || 0)
    + (c.formwork_rental_czk || 0)
    + (c.props_rental_czk || 0)
    + (c.mss_rental_czk || 0);
}

export interface ProjectElementResult {
  /** 0-based index in the input list (stable identity for the UI). */
  index: number;
  /** Display label — element_name or element_type, for the summary row. */
  label: string;
  /** True when `planElement` succeeded. */
  ok: boolean;
  /** Engine output — present only when ok. */
  plan?: PlannerOutput;
  /** Error message — present only when !ok (honest-blank, not a guessed 0). */
  error?: string;
}

export interface ProjectAggregate {
  /** Σ concrete volume of calculated elements (m³). */
  total_concrete_m3: number;
  /** Σ canonical normohodiny of calculated elements. */
  total_norm_hours: number;
  /** Σ presence (paid) hours of calculated elements. */
  total_presence_hours: number;
  /** Σ money (labor + rentals) of calculated elements (CZK). */
  total_cost_czk: number;
  /**
   * Σ schedule.total_days of calculated elements (sequential rollup — the
   * decided aggregation, NOT cross-element overlap). `null` when nothing was
   * calculated, so the UI shows an honest NEPOČÍTÁNO instead of 0.
   */
  schedule_total_days: number | null;
  elements_total: number;
  elements_calculated: number;
  /** Count of elements that failed → "Nevypočtených N" badge. */
  elements_uncalculated: number;
}

export interface ProjectOutput {
  elements: ProjectElementResult[];
  aggregate: ProjectAggregate;
}

/**
 * Run a whole project through the one-element engine and aggregate.
 * Each element is computed independently; per-element failures are isolated
 * (recorded, not thrown) so one bad element never voids the whole project.
 */
export function planProject(elements: PlannerInput[]): ProjectOutput {
  const results: ProjectElementResult[] = [];

  for (let i = 0; i < elements.length; i++) {
    const input = elements[i];
    const label = input.element_name || input.element_type || `prvek ${i + 1}`;
    try {
      const plan = planElement(input);
      results.push({ index: i, label, ok: true, plan });
    } catch (err) {
      results.push({
        index: i,
        label,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let totalVol = 0;
  let totalNorm = 0;
  let totalPresence = 0;
  let totalCost = 0;
  let totalDays = 0;
  let calculated = 0;

  for (const r of results) {
    if (!r.ok || !r.plan) continue;
    calculated++;
    totalVol += elements[r.index].volume_m3 || 0;
    const labor = buildLaborProjection(r.plan);
    totalNorm += labor.total_norm_hours;
    totalPresence += labor.total_presence_hours;
    totalCost += elementCostCZK(r.plan);
    totalDays += r.plan.schedule.total_days || 0;
  }

  return {
    elements: results,
    aggregate: {
      total_concrete_m3: round2(totalVol),
      total_norm_hours: round2(totalNorm),
      total_presence_hours: round2(totalPresence),
      total_cost_czk: Math.round(totalCost),
      schedule_total_days: calculated > 0 ? round2(totalDays) : null,
      elements_total: results.length,
      elements_calculated: calculated,
      elements_uncalculated: results.length - calculated,
    },
  };
}
