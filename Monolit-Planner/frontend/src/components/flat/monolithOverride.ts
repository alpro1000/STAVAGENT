/**
 * Pure patch-builder for the manual monolith ✓/✗ toggle (bug
 * monolit-oznacit-beton-subtype, Alexander verdict 2026-07-18 variant (а)):
 *
 * Promoting a group to monolith ALWAYS makes the representative row the
 * beton row (`subtype='beton'`), regardless of its unit. The old m³-only
 * gate left the group with a green ✓ but no beton row — so «Vypočítat»
 * never appeared and beton works could never be generated (works come ONLY
 * from the calculator engine; there is no second generator).
 *
 * Extracted from FlatPositionsTable so the named non-m³ case is unit-testable.
 */

export interface MonolithOverrideRep {
  id?: string;
  subtype?: string | null;
  metadata?: unknown;
}

export function buildMonolithOverridePatch(
  rep: MonolithOverrideRep | undefined,
  override: boolean | null,
): Record<string, unknown> | null {
  if (!rep?.id) return null;
  let meta: Record<string, unknown> = {};
  if (rep.metadata) {
    try {
      meta = typeof rep.metadata === 'string'
        ? JSON.parse(rep.metadata)
        : (rep.metadata as Record<string, unknown>);
    } catch {
      meta = {};
    }
  }
  if (override === null) {
    delete meta.is_monolith_override;
  } else {
    meta.is_monolith_override = override;
  }
  const patch: Record<string, unknown> = { id: rep.id, metadata: JSON.stringify(meta) };
  // Variant (а): honest subtype on EVERY promote — the unit does not gate it.
  // A t/ks/m² rep row keeps its qty untouched (the user enters the real
  // concrete volume via PartHeader / the calculator afterwards).
  if (override === true && rep.subtype !== 'beton') {
    patch.subtype = 'beton';
  }
  return patch;
}
