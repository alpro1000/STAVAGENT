# urs-learn-gate-source-relabel — Report

> **Bug ID:** `urs-learn-gate-source-relabel`
> **Datum reportu:** 2026-07-20
> **Reporter:** code-review of the Stage-0 eval harness (finding surfaced by the harness review; the hole itself is PROD, not eval)
> **Severity:** P1 (high) — silent, permanent KB poisoning in production
> **Status:** reported
>
> **Affected:** URS_MATCHER_SERVICE (Klasifikátor) — auto-learn layer, all doors that call `matchUrsItems` (`/api/jobs/text-match`, `file-upload`, `block-match`)
> **Version:** present since the #1526 anti-poisoning gate landed (the gate never covered this path)

---

## 1. What's broken

The #1526 anti-poisoning learn gate (`ursMatcher.js` — `top.source !== 'otskp' && !top.is_cross_catalog`) is bypassed for OTSKP rows that arrive **through the SQLite `urs_items` table**: `matchUrsItemsLocal` relabels every DB row `source: 'local'` (`ursMatcher.js:215` — the explicit property overrides the row's stored `source` column), so an OTSKP-originated row scores 0.9 ≥ 0.85 and passes the gate — the OTSKP road code is then **permanently auto-learned as an ÚRS mapping** in `learned_mappings.json`.

## 2. Expected behavior

The gate exists so a cross-catalog OTSKP code can never be learned as an ÚRS answer. Provenance must survive the SQLite round-trip: a row imported from OTSKP must still be recognizable as OTSKP at learn-time (e.g. propagate the DB `source` column instead of overwriting it, or gate on the stored column / `is_cross_catalog` derived from it).

## 3. Actual behavior

Any process that puts OTSKP rows into `urs_items` (the committed Dockerfile build step `import_otskp_to_sqlite.mjs` writes `source='otskp'` rows into the SAME shared table the ÚRS local door reads) + any window where the frontoffice door returns nothing (offline, kill-switch, upstream change) ⇒ ÚRS queries are answered by OTSKP rows labeled `'local'`, conf 0.9 ⇒ auto-learned ⇒ `lookupLearnedMapping` returns them **first, unconditionally**, on every future run. Poisoning is persistent (survives restarts; `learned_mappings.json` is gitignored so invisible in `git status`) and self-reinforcing (repeat hits bump stored confidence +0.05).

Related pre-existing aggravator: `import_otskp_to_sqlite.mjs --truncate` executes a bare `DELETE FROM urs_items` (unlike `import_kros_urs.mjs`, which deletes only `WHERE is_imported = 1`), so the build step can leave the shared table OTSKP-only — maximizing the window above.

## 4. Evidence / anchors

- Relabel: `URS_MATCHER_SERVICE/backend/src/services/ursMatcher.js:215` (`source: 'local'` in `matchUrsItemsLocal`'s result mapping, overriding the spread DB column).
- Gate: `ursMatcher.js` learn condition (`source !== 'otskp'` — checks the relabeled value).
- Lookup-first: `ursMatcher.js:34-38` — learned mapping returns before frontoffice/local/OTSKP.
- Shared table: `scripts/import_otskp_to_sqlite.mjs` (writes `urs_items`, bare truncate) vs `matchUrsItemsLocal` (`SELECT` with no source filter).
- Immediate persistent write: `concreteAgentKB.js:275/318` (`saveLearnedMappings` → `writeFileSync`).

## 5. Scope note

The Stage-0 eval harness is NOT exposed to this (it runs with `URS_LEARNING=0`, the kill-switch added 2026-07-20, and on isolated per-version DB files). This ticket is the **production** hole. Fix belongs in the pipeline (provenance-preserving `source` handling), shipped as its own measured change per the catalog-matching task discipline — after the corpus baseline exists, so the fix's effect on matching is measured, not assumed.

## 6. Interim mitigations (no code change)

- Never run `import_otskp_to_sqlite.mjs` without `--db <separate-file>` against a DB whose `urs_items` also serves the ÚRS door (the eval protocol now always uses per-version files).
- Audit `backend/src/data/learned_mappings.json` in prod for 6-digit OTSKP-shaped codes learned with `source: 'auto'`.
