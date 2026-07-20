# Catalog-matching routing audit — doors × deterministic layers

**Date:** 2026-07-20
**Method:** read-only code trace, two independent tracers, file:line grounded. No files changed.
**Status:** findings. One cell (matcher reachability) needs a prod probe — see Caveat.

## Why this exists

Three bypasses of working deterministic layers were found separately, each by accident when
something didn't work: (1) local OTSKP index bypassed, (2) OTSKP catalog-version drift,
(3) the #1527 frontoffice channel not on the MCP `find_urs_code` path. The open question was
**"are there three or eight?"** — if bypasses are found only by accident, the undiscovered ones
surface at a client. This is the systematic answer.

No prior routing/readiness audit or door×layer matrix existed (see §Prior audit). This is the first.

## Deterministic layers (columns)

- **L1 local-OTSKP** — in-memory `otskpCatalogService` (`URS_MATCHER_SERVICE/backend/src/services/otskpCatalogService.js`) + SQLite `urs_items` from `import_otskp_to_sqlite.mjs`.
- **L2 frontoffice** — the real, licensed ÚRS catalog via `frontofficeClient.searchCatalog` (`frontofficeClient.js:201`, #1527). The only source that returns conf 1.0 on an exact ÚRS code.
- **L3 catalog_version in the result record** — a `catalog_version` actually present on returned candidates.
- **L4 learned/confirmed mappings** — `concreteAgentKB.lookupLearnedMapping`/`learnMapping` (`concreteAgentKB.js:399/354`).
- **L5 web / SQLite-ÚRS fallback** — Perplexity/Brave + `urs_items` SQLite.

## Matrix

| Door | L1 | L2 frontoffice | L3 version | L4 learned | L5 |
|---|---|---|---|---|---|
| MCP `find_urs_code` | ✗ | ✗ **bypass** | ✗ | ✗ **bypass** | ✓ web |
| MCP `create_work_breakdown` (ÚRS/private) | ✗ | ✗ **bypass** | ✗ | ✗ **bypass** | ✓ via find_urs |
| MCP `find_otskp_code` | ✓* own copy | n/a | ✓ | n/a | n/a |
| MCP `create_work_breakdown` (OTSKP) | ✓* own copy | n/a | ✓ | n/a | n/a |
| `/api/pipeline/match` (+ match-batch) | ~ only if catalog=otskp | ✗ **bypass** | ✗ | ✗ **bypass** | ✓ web |
| `/api/batch` (batchProcessor) | ✓ always | ✗ **bypass** | ✗ | ✗ **bypass** | ✓ web |
| `/api/jobs/block-match-fast` | ✗ | ✗ **bypass** | ✗ | own separate cache | ✓ SQLite+web |
| `/api/jobs/text-match` · file-upload · block-match | ✓ supplement | ✓ | ~ partial | ✓ | ✓ |
| Portal `/portal/analysis` (passport) | — no catalog matching — | — | — | — | — |
| Portal `/api/core/urs-match/*` proxy | ~ | ✗ **bypass** | ✗ | ✗ | ✓ web |

`✓*` = a *different* OTSKP copy (concrete-agent `otskp_engine`/`2026_otskp.xml` via `catalog_matching.py`), not the URS-service L1 instance. `~` conditional. `n/a` door is OTSKP-only or does no matching.

## The one correct door

`matchUrsItems` (`ursMatcher.js:24`) is the **only** path that fans out L4 → L2 → L5 → L1 then selects
(`:34` learned → `:45/251` frontoffice → `:48-51` web/local → `:56-57/299` OTSKP supplement → `:83` learn).
It is reached by exactly three endpoints: `/api/jobs/text-match` (`jobs.js:414`), `file-upload` (`:291`),
`block-match` (`:736`). Every other door reimplements a partial subset.

## The bypass list ("full list, not three tickets")

- **L2 frontoffice bypassed by 6+ doors:** `find_urs_code`, `create_work_breakdown`(ÚRS, inherits find_urs_code via `catalog_binding_adapter.py:117`), `/api/pipeline/match`, `/api/pipeline/match-batch`, `/api/batch`, `/api/jobs/block-match-fast`, and the Portal `urs-match` proxy (routes to `/api/pipeline/*` = Perplexity/Brave, `core-proxy.js:239-288`). Confirmed by both tracers: `searchCatalog` production callers are only `ursMatcher.js:251` and the `batch.js:442` diagnostics probe; concrete-agent has zero callers.
- **L4 learned mappings bypassed by the same set** — only `matchUrsItems` calls `lookupLearnedMapping`. Worse: `block-match-fast` keeps its **own** `kb_mappings` cache (`ursLocalMatcher.js:99`) → two divergent memories; learning on one path is invisible to the other.
- **L1 local-OTSKP:** `block-match-fast` bypasses it entirely (low-confidence rows go straight to Perplexity); `/api/pipeline/match(+batch)` reach it only if the caller sets `catalog∈{otskp,both}` — and `find_urs_code` calls with no catalog, so it is L1-blind in practice. `/api/batch` is the one non-`matchUrsItems` door that reaches L1 on every path (`candidateRetriever.js:44-48`).
- **Two OTSKP copies on different versions:** `find_otskp_code` matches concrete-agent's own `2026_otskp.xml` (on 2026 since #1530); the URS-service L1 `otskpCatalogService` defaults to 2025 (the behaviour-neutral facade). Same query, two OTSKP doors, two versions.
- **L3 catalog_version is systemically null** on every OTSKP candidate except `find_otskp_code`/breakdown-OTSKP and the frontoffice subset of `matchUrsItems`. (`unifiedMatchingPipeline.searchOTSKP`, `candidateRetriever.searchOTSKPCatalog`, `matchUrsItemsOTSKP` all drop it.)

## Portal document-analysis

`/portal/analysis` → `DocumentAnalysisPage.tsx:388/461` → Portal `/api/core/passport/*` → concrete-agent
`routes_passport.py:47/744` (`generate`/`process-project`). Those handlers parse → classify → enrich → merge → passport
(`universal_parser.parse_any`, `DocumentProcessor.process`, `so_merger`). **They do no catalog matching** — the
returned `soupis_praci` carries the source file's own codes verbatim (grep: zero hits for `find_urs_code`/`find_otskp_code`/
`create_work_breakdown`/`soupis_assembler` in `routes_passport.py`/`passport_enricher.py`/`document_processor.py`).
So Portal's document→soupis path is a separate pipeline; the only catalog-matching Portal surface is the `urs-match`
proxy, which itself bypasses frontoffice (row above).

## Worst offender

`find_urs_code` — the canonical ÚRS entrypoint (called by MCP clients **and** by `create_work_breakdown`) is wired to
the web-only `unifiedMatchingPipeline.matchSingle` (`urs.py:219` → `pipeline.js:48` → `unifiedMatchingPipeline.js:113 searchURS` = Perplexity/Brave).
It structurally **cannot** reach the real ÚRS catalog (L2) or accumulated knowledge (L4). Its results are `is_web_suggestion:true` guesses.

## Prior audit / evidence of a run

None. Closest artifacts: `docs/audits/pipeline_state_recon/2026-06-08_pipeline_recon.md` (a code-read recon that
explicitly did **not** run end-to-end, and has no door×layer matrix); the `2026-07-19` handoff (uses "door" framing,
plans a P0 orchestrator that does not yet exist); and the `URS_MATCHER_SERVICE/backend/eval/` corpus harness
(scaffolded, never run — `eval/results/` holds only `.gitkeep`).

## Caveat — matcher reachability is unresolved

`_urs_matcher_search` swallows all exceptions and returns `[]` at debug level (`urs.py:257-259`). So `matcher: 0`
cannot distinguish "endpoint returned empty" from "endpoint unreachable and error swallowed." If the URS Matcher is
unreachable from the CORE Cloud Run service, `find_urs_code` has been **Perplexity-only** and nothing surfaces it.
Needs a prod probe (`POST /api/pipeline/match` from prod, or CORE logs for `[MCP/URS] Matcher service unavailable`).
The swallow itself is a defect (hides unreachability).

## Verdict

Not three tickets — **one structural cause**: there is exactly one correct door (`matchUrsItems`) and every other
door reimplements a partial subset, so each drops ≥1 deterministic layer. Point-fixing `find_urs_code`
(route it through `matchUrsItems`, behind an env flag, its own PR) is the biggest cheap win, but the matrix shows
5+ more doors with the same disease, two divergent learned memories, and two OTSKP copies. The cure is the SPEC's
**one decision core, two adapters** (§2) that all doors call — so no door *can* bypass a layer. The orchestrator,
not point-fixes, is the real fix; the point-fix is a stopgap on the worst offender.
