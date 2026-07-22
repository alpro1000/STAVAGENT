# urs-local-door-2018-vintage — Report

> **Bug ID:** `urs-local-door-2018-vintage`
> **Datum reportu:** 2026-07-20
> **Reporter:** first Stage-0 corpus baseline (Vidímova ground truth, 47 lines)
> **Severity:** P1 — the offline ÚRS door structurally cannot match current estimates
> **Status:** reported
>
> **Affected:** URS_MATCHER_SERVICE local ÚRS layer (`matchUrsItemsLocal` ← `urs_items` built by `import_kros_urs.mjs` from `data/URS201801.csv`) — i.e. every door that falls back to the local layer when frontoffice is off/unreachable
> **Version:** since the KROS CSV import exists (data vintage 2018)

---

## 1. What's broken

The local ÚRS door serves the **2018** catalog (`URS201801.csv`) while delivered estimates use **CS ÚRS 2026**. Measured on the Vidímova ground-truth corpus (47 lines, codes confirmed by a delivered tender):

- **35 of 41** expected 2026 codes are **absent** from the 2018-built `urs_items` → candidate recall is structurally capped at ~15 % before any matching quality is even measured (measured recall on the run: **0.0**).
- **Code-reuse collision:** at least one code means a *different item* across vintages — `59054296` = "profil ukončovací s okapničkou" (2026 estimate) vs "Dlážděné kryty pozemních komunikací" (2018 DB). A code-level "match" through this door can silently price the wrong work.
- **Degenerate descriptions:** the CSV carries abbreviated keyword strings ("cm geontx m/b polystrvch sire vlakn hq m"), not real item names — lexical matching runs against keyword mush, so even the 6 codes that DO exist in the DB were never recalled (0/6).
- **No honest-refusal floor (companion finding):** on 6 `nonexistent` lines (delivered with working codes because no ÚRS position exists) the door fabricated a code for **5** (fabrication_rate 0.83, confidences 0.22–0.68); montáž queries were answered with material codes.

Run artifact: offline baseline `--mode urs`, frontoffice disabled, `urs_kros.db` 39 397 rows, URS_LEARNING=0 (numbers in soul.md §9 2026-07-20 (b/c)).

## 2. Expected behavior

The local layer either serves the same catalog release the business delivers against, or its results are labeled with their vintage and out-of-vintage codes cannot be emitted as confident matches. Honest empty result when nothing above a floor matches.

## 3. Why it matters beyond eval

Whenever frontoffice is off/unreachable (kill-switch, egress, upstream change), production falls back to this layer — emitting 2018-numbered or collided codes at conf up to ~0.9 for current tenders. Combined with `urs-learn-gate-source-relabel`, such hits are also auto-learnable.

## 4. Candidate directions (decide, don't drift)

1. Frontoffice-first routing fix (already approved, flag-gated, own PR) — the live CS ÚRS 2026 catalog is the only current-vintage source; measure its delta against this baseline.
2. Refresh/replace the local dataset with a current-vintage source, or stamp `catalog_version: "URS 2018"` on every local candidate and gate confidence accordingly (version-in-record, SPEC §16).
3. Honest-refusal floor (minimum confidence for returning candidates at all) — kills the 83 % fabrication.

Each is a behaviour-changing matching change → per discipline: corpus before/after, own PR, Alexander's go.
