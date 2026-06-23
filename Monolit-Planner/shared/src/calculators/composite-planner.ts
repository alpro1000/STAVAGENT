/**
 * composite-planner — Fáze 5 #7 (composite-element-parts), Gate 2.
 *
 * A composite structural element (e.g. a bridge abutment / opěra) is ONE smeta
 * position physically made of several parts (dřík + úložný práh + závěrná zídka
 * + křídla), each with its own formwork / tacts / geometry. This module is the
 * ADDITIVE shared layer that turns a parent + parts[] into a computed, aggregated
 * result, REUSING the unchanged one-element engine via `planProject`.
 *
 * Ratified design (docs/specs/composite-element-parts, Gate 0/1 2026-06-23):
 *  - Parent = pure CONTAINER: it carries identity + the TOTAL volume only; its
 *    work lives on the leaf PARTS. The aggregate is Σ parts (planProject), so the
 *    parent contributes 0 — double-count is impossible by construction.
 *  - Missing part dimensions → volume split by typical ratios (DATA, ODHAD);
 *    exact parts win over ratios; the remaining volume closes to 100 % of the
 *    parent total (no m³ lost — the last estimate absorbs the rounding residual);
 *    every estimated part is flagged with its source.
 *  - No parts at all → honest "nedetailizováno": the parent is computed as ONE
 *    element exactly like today (fallback variant (a)); we never invent parts.
 *  - Backward-compat (AC 3.10): this module is PURELY ADDITIVE. `planElement`,
 *    `planProject` and `PlannerInput` are untouched → all existing goldens stay
 *    byte-identical. `planComposite({ parent, parts: [] })` ≡ `planProject([parent])`.
 *
 * ⚠️ PLACEHOLDER_PART_VOLUME_RATIOS below are NOT calibrated. Real shares must be
 * calibrated from VP4 / SO-250 / Žihle and moved to the element_rules
 * single-source (deferred data step — does NOT block this mechanism).
 */

import { planProject } from './project-planner.js';
import type { ProjectAggregate, ProjectElementResult } from './project-planner.js';
import type { PlannerInput } from './planner-orchestrator.js';

export type PartVolumeSource = 'exact' | 'odhad_family_ratio';

/**
 * A part of a composite element — a full one-element input, except the volume is
 * OPTIONAL: when omitted it is derived from the parent total by typical share.
 */
export type CompositePartInput = Omit<PlannerInput, 'volume_m3'> & {
  /** Exact concrete volume of this part (m³). Omit → derived from parent total
   *  via typical share (→ ODHAD). */
  volume_m3?: number;
  /** Optional human label for the part row (e.g. "dřík", "křídla"). */
  part_label?: string;
  /** Optional explicit share weight (relative) used when volume_m3 is omitted;
   *  overrides the placeholder lookup. */
  volume_ratio?: number;
};

export interface CompositeInput {
  /**
   * The whole element as one position: identity + element_type + the TOTAL
   * concrete volume (used to close the split). When `parts` is empty this is
   * computed as a single element (fallback (a) "nedetailizováno").
   */
  parent: PlannerInput;
  /** Structural parts. Empty/omitted → no decomposition (honest fallback). */
  parts?: CompositePartInput[];
  /** Optional label for the parent container row. */
  parent_label?: string;
}

export interface CompositePartResult extends ProjectElementResult {
  /** Resolved concrete volume actually used for this part (m³). */
  volume_m3: number;
  /** Where the volume came from. */
  volume_source: PartVolumeSource;
}

export interface CompositeOutput {
  parent_label?: string;
  /** Total concrete volume of the parent (m³). */
  total_volume_m3: number;
  /** Per-part results (the leaves). The parent contributes nothing. */
  parts: CompositePartResult[];
  /** Σ of the leaf parts = the parent roll-up (parent itself contributes 0). */
  aggregate: ProjectAggregate;
  /** True when ≥1 part was given; false = honest "nedetailizováno". */
  is_detailed: boolean;
  /** True when Σ part volumes equals the parent total within tolerance. */
  volume_closed: boolean;
  warnings: string[];
}

/**
 * ⚠️ PLACEHOLDER, NOT CALIBRATED. Relative volume shares per part element_type,
 * used ONLY to split the parent total across parts that have no explicit volume.
 * Replace with calibrated data (VP4 / SO-250 / Žihle) and move to the
 * element_rules single-source — deferred data step, does not block the mechanism.
 * Values are RELATIVE weights (normalised over the estimate-parts actually
 * present), so they need not sum to 1.
 */
export const PLACEHOLDER_PART_VOLUME_RATIOS: Record<string, number> = {
  driky_piliru: 0.45,          // dřík (stem) — PLACEHOLDER
  opery_ulozne_prahy: 0.10,    // úložný práh (bearing seat) — PLACEHOLDER
  mostni_zavirne_zidky: 0.10,  // závěrná zídka — PLACEHOLDER
  kridla_opery: 0.35,          // křídla (wings) — PLACEHOLDER
};

/** Unknown part type → equal weight. */
const DEFAULT_PART_RATIO = 1;
/** m³ tolerance for "exact" closure — micro-m³, i.e. no real volume lost. */
const VOLUME_CLOSE_TOL_M3 = 1e-6;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ratioFor(part: CompositePartInput): number {
  if (typeof part.volume_ratio === 'number' && part.volume_ratio > 0) return part.volume_ratio;
  const t = part.element_type;
  if (t && PLACEHOLDER_PART_VOLUME_RATIOS[t] != null) return PLACEHOLDER_PART_VOLUME_RATIOS[t];
  return DEFAULT_PART_RATIO;
}

/**
 * Plan a composite element from a parent + parts. Reuses the one-element engine
 * via `planProject`; the parent is a pure container (contributes 0).
 */
export function planComposite(input: CompositeInput): CompositeOutput {
  const warnings: string[] = [];
  const parent = input.parent;
  const total = parent.volume_m3 || 0;
  const parts = input.parts ?? [];

  // ── Fallback (a): no parts → compute the parent as ONE element. Never invent
  //    parts. Aggregate is byte-identical to planProject([parent]). ──────────────
  if (parts.length === 0) {
    const proj = planProject([parent]);
    const el = proj.elements[0];
    warnings.push(
      'ℹ️ Složení nedetailizováno — počítáno jako jeden prvek. Pro rozpad na části (dřík/práh/zídka/křídla) zadej části.',
    );
    return {
      parent_label: input.parent_label,
      total_volume_m3: round2(total),
      parts: [{ ...el, volume_m3: total, volume_source: 'exact' }],
      aggregate: proj.aggregate,
      is_detailed: false,
      volume_closed: true,
      warnings,
    };
  }

  // ── Split: exact parts keep their volume; estimate parts share the remainder.
  const exactSum = parts.reduce((s, p) => s + (typeof p.volume_m3 === 'number' ? p.volume_m3 : 0), 0);
  const estimateIdx = parts
    .map((p, i) => (typeof p.volume_m3 === 'number' ? -1 : i))
    .filter((i) => i >= 0);
  const remainder = total - exactSum;

  if (remainder < -VOLUME_CLOSE_TOL_M3) {
    warnings.push(
      `⚠️ Součet zadaných objemů částí (${round2(exactSum)} m³) překračuje celkový objem (${round2(total)} m³) — zkontroluj zadání.`,
    );
  }
  if (estimateIdx.length === 0 && Math.abs(remainder) > VOLUME_CLOSE_TOL_M3) {
    warnings.push(
      `⚠️ Součet částí (${round2(exactSum)} m³) ≠ celkový objem (${round2(total)} m³) o ${round2(remainder)} m³, a žádná část není odhadovaná — nelze dorovnat. Zkontroluj zadání.`,
    );
  }

  const resolvedVolumes: number[] = new Array(parts.length);
  const sources: PartVolumeSource[] = new Array(parts.length);

  parts.forEach((p, i) => {
    if (typeof p.volume_m3 === 'number') {
      resolvedVolumes[i] = p.volume_m3;
      sources[i] = 'exact';
    }
  });

  // Estimate parts: distribute the non-negative remainder by normalised weight.
  // The LAST estimate absorbs the rounding residual (unrounded) so that
  // Σ parts == parent total EXACTLY (no m³ lost — AC 3.7).
  if (estimateIdx.length > 0) {
    const shareBase = Math.max(remainder, 0);
    const weights = estimateIdx.map((i) => ratioFor(parts[i]));
    const wsum = weights.reduce((s, w) => s + w, 0) || 1;
    let assigned = 0;
    estimateIdx.forEach((idx, k) => {
      sources[idx] = 'odhad_family_ratio';
      if (k < estimateIdx.length - 1) {
        const v = round2(shareBase * (weights[k] / wsum));
        resolvedVolumes[idx] = v;
        assigned += v;
      } else {
        resolvedVolumes[idx] = shareBase - assigned; // residual → exact closure
      }
    });
  }

  // Build full one-element inputs and run the UNCHANGED engine via planProject.
  const elementInputs: PlannerInput[] = parts.map((p, i) => {
    const e = { ...p, volume_m3: resolvedVolumes[i] } as Record<string, unknown>;
    delete e.part_label;
    delete e.volume_ratio;
    return e as unknown as PlannerInput;
  });
  const proj = planProject(elementInputs);

  const partResults: CompositePartResult[] = proj.elements.map((el, i) => ({
    ...el,
    label: parts[i].part_label || el.label,
    volume_m3: resolvedVolumes[i],
    volume_source: sources[i],
  }));

  const partsSum = resolvedVolumes.reduce((s, v) => s + v, 0);
  const volume_closed = Math.abs(partsSum - total) <= VOLUME_CLOSE_TOL_M3;

  return {
    parent_label: input.parent_label,
    total_volume_m3: round2(total),
    parts: partResults,
    aggregate: proj.aggregate,
    is_detailed: true,
    volume_closed,
    warnings,
  };
}
