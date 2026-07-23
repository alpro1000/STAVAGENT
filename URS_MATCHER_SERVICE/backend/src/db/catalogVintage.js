/**
 * Quarantine of the 2018-vintage ÚRS catalog data (ratified 2026-07-23).
 *
 * The local urs_items rows imported from URS201801.csv (KROS 2018 export,
 * source='kros') are EIGHT YEARS stale: 35 of 41 corpus codes do not exist in
 * them, and code 59054296 means a DIFFERENT work in 2018 vs 2026 (renumbering
 * collision — the silent-wrong-answer class). Dead data must not participate
 * in code proposals AT ALL — this is exclusion from the output, not a weight
 * reduction (docs/bugs/urs-local-door-2018-vintage/).
 *
 * Scope: every door that PROPOSES codes for a work description appends
 * vintageQuarantineSql() to its urs_items WHERE clause. Admin/browse/stats
 * routes deliberately keep showing the rows — hiding them there would make
 * the catalog views lie about DB contents.
 *
 * source='kros' currently ≡ the URS201801 (2018) import. A future
 * current-vintage KROS import MUST use a different source tag, or it will
 * inherit this quarantine.
 *
 * Rollback valve: URS_ALLOW_2018_CATALOG=1 re-admits the rows (measurement /
 * archaeology only — never production).
 */

export function allow2018Catalog() {
  const v = process.env.URS_ALLOW_2018_CATALOG;
  return v === '1' || v === 'true';
}

/**
 * SQL fragment (leading AND) for urs_items WHERE clauses of code-proposing
 * doors. Callers must parenthesize their own OR-lists before appending.
 */
export function vintageQuarantineSql() {
  return allow2018Catalog() ? '' : " AND (source IS NULL OR source != 'kros')";
}
