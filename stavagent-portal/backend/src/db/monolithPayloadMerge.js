/**
 * monolith_payload merge guard — never downgrade a rich payload to a thin one.
 *
 * Two writers touch portal_positions.monolith_payload:
 *   1. integration.js  «import-from-monolit» (bulk «Exportovat do Registru») writes a
 *      THIN payload: flat crew_size/days/cost fields only, no costs/resources/tov_entries.
 *   2. position-instances.js  POST /:instanceId/monolith (Monolit «Aplikovat» write-back
 *      via portalWriteBack.js) writes a RICH payload: costs + resources + tov_entries.
 *
 * A bulk re-export used to clobber a rich «Aplikovat» payload with the thin one —
 * the old `COALESCE($n, monolith_payload)` only guards against a NULL incoming
 * value, not against a thin non-null one. Registry then fetched the thin payload,
 * `hasExtendedCosts()` went false, and the «Předvyplnit TOV» banner disappeared
 * even though the calculator plan had been applied.
 *
 * The fix keeps the write ATOMIC (a single UPDATE, no read-modify-write race)
 * while refusing any write that would replace rich cost data with thin data.
 *
 * "Rich" mirrors rozpocet-registry `tovPrefill.hasExtendedCosts` EXACTLY:
 *   (costs AND resources present) OR a non-empty tov_entries.labor array.
 */

/**
 * Canonical pure-JS contract for "does this payload carry extended TOV cost data".
 * Single source of truth for what "rich" means; the SQL below mirrors it. Kept in
 * sync with rozpocet-registry/src/services/tovPrefill.ts::hasExtendedCosts.
 *
 * @param {any} payload - a MonolithPayload object (or null/undefined).
 * @returns {boolean}
 */
export function isRichMonolithPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const hasCosts =
    !!payload.costs && typeof payload.costs === 'object' &&
    !!payload.resources && typeof payload.resources === 'object';
  const hasCalcEntries =
    Array.isArray(payload.tov_entries?.labor) && payload.tov_entries.labor.length > 0;
  return Boolean(hasCosts || hasCalcEntries);
}

/**
 * SQL boolean expression mirroring {@link isRichMonolithPayload}.
 * `jsonbExpr` must be a JSONB SQL expression — a column name (`monolith_payload`)
 * or a cast parameter (`($1)::jsonb`).
 *
 * The array length is read only behind a `jsonb_typeof = 'array'` guard so a
 * malformed tov_entries.labor (object/scalar/null) can never raise
 * "cannot get array length of a non-array". jsonb_typeof of SQL NULL is NULL,
 * so a NULL/missing key evaluates falsy.
 *
 * @param {string} jsonbExpr
 * @returns {string} a parenthesised SQL boolean expression.
 */
export function richPayloadSql(jsonbExpr) {
  const labor = `(${jsonbExpr}) -> 'tov_entries' -> 'labor'`;
  // COALESCE(..., false) is load-bearing: for a THIN payload the 'costs'/'resources'
  // keys are absent, so `jsonb_typeof(x -> 'costs') = 'object'` is NULL (not false).
  // Without the COALESCE the predicate returns NULL for thin payloads, and the
  // merge guard `existing_rich AND NOT incoming_rich` becomes `true AND NOT NULL`
  // = NULL → the CASE treats it as "not matched" → the rich payload gets
  // downgraded anyway. (This is why #1466's guard silently never worked.)
  return `COALESCE((
    (jsonb_typeof((${jsonbExpr}) -> 'costs') = 'object'
      AND jsonb_typeof((${jsonbExpr}) -> 'resources') = 'object')
    OR jsonb_array_length(
      CASE WHEN jsonb_typeof(${labor}) = 'array' THEN ${labor} ELSE '[]'::jsonb END
    ) > 0
  ), false)`;
}

/**
 * Build the `monolith_payload = <expr>` right-hand side for an UPDATE that never
 * downgrades a rich stored payload to a thin incoming one. Rich→rich and
 * thin→(thin/empty) writes pass through unchanged; only rich→thin is refused.
 *
 * @param {string} placeholder - parameter placeholder holding the incoming payload
 *        as JSON text or NULL (e.g. '$1', '$11').
 * @param {string} [column='monolith_payload'] - the stored JSONB column.
 * @returns {string} a SQL CASE expression to place after `monolith_payload =`.
 */
export function monolithPayloadMergeSql(placeholder, column = 'monolith_payload') {
  const incoming = `(${placeholder})::jsonb`;
  // EVERY occurrence of the parameter must carry the ::jsonb cast — including
  // the NULL check. A bare `$1 IS NULL` leaves the parameter's type unknown
  // (IS NULL accepts any type), and if it is the only uncast use Postgres
  // raises `42P08: could not determine data type of parameter $1` and the
  // whole UPDATE 500s. The 2026-07-10 write-back outage was exactly this:
  // every POST /:instanceId/monolith failed, so TOV pre-fill never lit up.
  return `CASE
    WHEN ${incoming} IS NULL THEN ${column}
    WHEN ${richPayloadSql(column)} AND NOT ${richPayloadSql(incoming)} THEN ${column}
    ELSE ${incoming}
  END`;
}
