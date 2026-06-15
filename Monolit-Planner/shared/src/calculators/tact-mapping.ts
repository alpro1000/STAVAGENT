/**
 * Tact mapping — translate a recommended TOTAL number of záběry (pours)
 * into the live hierarchical model's "tacts per section" value.
 *
 * Background: when the user applies a recommended formwork system, the
 * recommendation comes with a suggested TOTAL number of záběry (N). The
 * live calculator model expresses záběry as `num_dilatation_sections ×
 * tacts_per_section`. This helper spreads N across the configured sections
 * so the resulting total stays as close to N as possible (and never below
 * it) — i.e. ceil(N / sections). With a single section it is just N.
 *
 * Replaces the legacy `num_tacts_override` write, which `buildInput`
 * ignored, silently losing the recommended tact count (Phase 5 Step 3).
 */
export function tactsPerSectionForRecommendedTotal(
  recommendedTotalTacts: number,
  numSections: number,
): number {
  const sections = Math.max(1, Math.floor(numSections || 1));
  const total = Math.max(1, Math.floor(recommendedTotalTacts || 1));
  return sections > 1 ? Math.ceil(total / sections) : total;
}
