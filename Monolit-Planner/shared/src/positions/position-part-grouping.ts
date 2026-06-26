/**
 * position-part-grouping — Fáze 5 #7 Phase 2 (Gate 4) foundation.
 *
 * A composite opěra is ONE `part_name` (e.g. "OPĚRY OP1") whose work rows are
 * tagged with their structural part (dřík / úložný práh / závěrná zídka / křídla)
 * via `Position.metadata.structural_part` — an additive key in the existing
 * flexible-metadata JSON, so NO backend migration is needed (Gate 0: "M1 jen
 * pokud perzistence neunese" → it does).
 *
 * This pure helper splits the rows of one `part_name` into structural-part
 * subgroups and computes each subgroup's roll-up. The parent (opěra) total stays
 * the flat sum of ALL its rows (existing KPI/export behaviour) — the parent is a
 * pure container, so subgroups never double-count (ratified Gate 0/1). Rows with
 * NO `structural_part` tag fall into a single null group → legacy data renders
 * flat exactly as today (back-compat).
 */

import type { Position } from '../types.js';

/** One structural-part subgroup within a `part_name` (opěra). */
export interface PartSubgroup {
  /** Structural part label (dřík / křídla / …), or null for untagged rows (legacy/flat). */
  part_label: string | null;
  /** The work rows (beton / bednění / …) belonging to this part. */
  rows: Position[];
  /** Σ concrete of this part's beton rows (m³) — mirrors the KPI concrete rule. */
  concrete_m3: number;
  /** Σ kros_total_czk of this part's rows. */
  kros_total_czk: number;
}

export interface PartGrouping {
  /** Subgroups in stable first-seen order; the untagged (null) group, if any, is last. */
  subgroups: PartSubgroup[];
  /** True when at least one row carries a `structural_part` tag (→ render the part level). */
  has_parts: boolean;
}

/** Safely read `structural_part` from a Position's flexible metadata JSON. */
export function readStructuralPart(metadata?: string): string | null {
  if (!metadata) return null;
  try {
    const obj = JSON.parse(metadata) as Record<string, unknown>;
    const v = obj?.structural_part;
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  } catch {
    return null; // malformed metadata → untagged, never throws
  }
}

/**
 * Group the rows of ONE `part_name` (opěra) by their structural part.
 * Pure — does not mutate the input. Untagged rows collapse into a single null
 * group so legacy/non-composite parts render flat.
 */
export function groupByStructuralPart(rows: Position[]): PartGrouping {
  const order: (string | null)[] = [];
  const buckets = new Map<string | null, Position[]>();

  for (const row of rows) {
    const label = readStructuralPart(row.metadata);
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(row);
  }

  // Tagged groups first (first-seen order), the untagged null group last.
  order.sort((a, b) => (a === null ? 1 : 0) - (b === null ? 1 : 0));

  const subgroups: PartSubgroup[] = order.map((label) => {
    const groupRows = buckets.get(label)!;
    const concrete_m3 = groupRows
      .filter((r) => r.subtype === 'beton')
      .reduce((s, r) => s + (r.concrete_m3 ?? r.qty ?? 0), 0);
    const kros_total_czk = groupRows.reduce((s, r) => s + (r.kros_total_czk ?? 0), 0);
    return { part_label: label, rows: groupRows, concrete_m3, kros_total_czk };
  });

  return { subgroups, has_parts: order.some((l) => l !== null) };
}
