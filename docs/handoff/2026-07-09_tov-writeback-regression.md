# Handoff — 2026-07-09 — TOV write-back regression + session state

**Branch:** `claude/passport-mcp-worklist-bla05q` (restart from `origin/main` each fresh session).
**Author:** Claude Code session (Alexander).

---

## 1. What shipped this session (all MERGED to main)

| PR | What | Deploy target |
|----|------|---------------|
| #1461 | TOV modal окно (B–F): editable-field vs header styling, unsaved-changes prompt (C), visible «✓ Uloženo» (D), «Doprava betonu» без стоимости бетона + чекбокс (E1), «Odebrat» у pump/crane/delivery (E2) | Registry (Vercel) |
| #1462 | Registry import reads existing **«Skupina»** column (export→import round-trip keeps groups) | Registry (Vercel) |
| #1463 | Monolit `import-from-registry`: **timeout bump** (PORTAL_IMPORT_TIMEOUT_MS 45s / REGISTRY 30s, frontend axios 180s) + **chunked bulk-INSERT** (`buildPositionInsertChunks`, ≤500 rows) — big projects (9523 pos) no longer 404 | Monolit (Cloud Run + Vercel) |
| #1464 | CORE `VertexGeminiClient.call()`: **per-call timeout** (`VERTEX_CALL_TIMEOUT_S`=90s via ThreadPoolExecutor) — fixes passport/generate **502** caused by a ~598s Vertex hang during a 429 storm | CORE (Cloud Run) |

Earlier same-thread (already merged before this handoff): #1449/#1450/#1451 (TOV bridge `actor` column + non-fatal audit), #1452 (TOV fullscreen + inline apply confirm), #1453/#1454/#1455 (Monolit import review: 2 bugs + decouple monolith/beton + features), #1456/#1458/#1459/#1460 (infra: PG_POOL_MAX=8, bulk-INSERT Registry→Portal sync, JWT forward on 401), #1457 (TOV money 2 decimals).

Infra facts confirmed this session: Cloud SQL `stavagent-db` = **db-f1-micro, 0.6 GB, max_connections raised 25→50**; both backends deployed with `PG_POOL_MAX=8`; gcloud CLI now on `info@stavagent.cz` (daily ops) / gmail stays Org Admin. **Do NOT** set max_connections=100 (OOM on 0.6 GB) and **never** destructively touch billing / remove gmail from IAM.

---

## 2. ✅ RESOLVED — TOV write-back regression (fixed 2026-07-09, next session)

> **Fix shipped:** Portal-side "never downgrade rich→thin" guard —
> `stavagent-portal/backend/src/db/monolithPayloadMerge.js`
> (`isRichMonolithPayload` + `monolithPayloadMergeSql`), wired into BOTH writers
> (`integration.js` import-from-monolit UPDATE + `position-instances.js`
> POST `/:instanceId/monolith`). Atomic SQL `CASE` keeps the stored payload when
> it is rich (costs+resources OR non-empty `tov_entries.labor`) and the incoming
> one is thin. `hasExtendedCosts` untouched. `template_apply` UPDATE left as-is
> (separate intentional feature). 15 hermetic tests in
> `tests/monolithPayloadMerge.test.js`. **Live verify on 272324 still pending
> post-deploy.** Root-cause analysis below retained for the record.

## 2. ⭐ OPEN BUG #1 — TOV write-back regression (CONFIRMED by user)

**Symptom:** In Registry, an item (e.g. **272324 ZÁKLADY ZE ŽELEZOBETONU DO C25/30**) shows the green HardHat (monolith link present) but the TOV modal shows **no «Předvyplnit TOV» banner** and empty TOV — even though the user DID run «Vypočítat plán» + «Aplikovat» in the calculator.

**Diagnostic evidence:**
- Green helmet tooltip = `Monolit: <part_name> | 4L` → `crew_size = 4` (the label is `${crew_size}L`), **no cost, no days**. `crew_size=4` is exactly `DEFAULTS.crew_size` set by the **import** (`Monolit-Planner/backend/src/routes/import-from-registry.js`).
- Registry console: `[MonolithFetch] Fetched 45 monolith payloads` → the pipe works; payloads ARE attached to items.
- The banner is gated by `hasExtendedCosts(mp)` in `rozpocet-registry/src/services/tovPrefill.ts:21`:
  ```ts
  return !!(mp?.costs && mp?.resources) || !!(mp?.tov_entries?.labor?.length);
  ```
  The attached payload has **none** of `costs` / `resources` / `tov_entries` → banner never shows.

**Root-cause hypothesis (two write-back paths, one clobbers the other):**
1. **Rich (correct) path** — `Aplikovat`: `Monolit-Planner/frontend/src/components/calculator/applyPlanToPositions.ts:504-509` builds a `monolith_payload` WITH `costs`, `resources`, `tov_entries`. This is what `hasExtendedCosts` expects.
2. **Thin path** — `export-to-registry.js:153` (bulk «Exportovat do Registru») builds a `monolith_payload` with **flat fields only** (`crew_size`, `days`, `cost_czk`, kros…) and a **sibling** `tov: {...}` — **no** `costs`/`resources`/`tov_entries`. Also the re-import creates positions with `crew_size=4` default.

The user just re-imported the big project (to test #1463). A thin write (export-to-registry OR a sync after re-import) most likely **overwrote** the rich Aplikovat payload in Portal → Registry now fetches the thin one → no banner.

**Exact next steps for a fresh session:**
1. Determine Portal's monolith-payload storage semantics: does `stavagent-portal/backend/src/routes/*` (`import-from-monolit` and/or `position-instances.js POST /:instanceId/monolith`) **overwrite** the whole `monolith_payload` JSON or **merge**? If overwrite → any thin write clobbers a rich one. (grep Portal for `monolith_payload`, `import-from-monolit`, `position_instances` UPDATE.)
2. Align the two Monolit write paths: `export-to-registry.js:153` must include `costs`/`resources`/`tov_entries` (or at least NOT overwrite a richer existing payload). Prefer: Portal side **merges** and never downgrades a payload that already has `costs` with one that doesn't; OR the thin path stops writing `monolith_payload` entirely and only Aplikovat writes it.
3. Verify on 272324 after the fix: re-run Aplikovat → Registry `[MonolithFetch]` → open TOV → banner appears → «Předvyplnit TOV» fills labor/machinery/materials.
4. Regression test: `rozpocet-registry/src/services/tovPrefill.calcEntries.test.ts` already covers prefill; add a Portal/Monolit test that a thin export does not erase `costs`.

**Note:** `hasExtendedCosts` itself is correct — do NOT loosen it to accept thin payloads (that would show an empty banner). Fix the write, not the gate.

---

## 3. OPEN BUG #2 — phantom «Auto-created» projects + sync race (409)

Registry console: `POST /api/integration/import-from-registry 409 (Conflict) [sync_in_progress]` + `[PortalAutoSync] Synced project "Auto-created" → Portal … (0 items)`. Two syncs race; an empty «Auto-created» project appears. Investigate `rozpocet-registry/src/services/portalAutoSync.ts` (advisory-lock / in-progress guard) + Portal `integration.js` auto-create-on-import. Likely need: skip auto-create when 0 items, and dedupe/serialize concurrent syncs of the same project.

---

## 4. OPEN BUG #3 — MCP-OAuth `connection already closed`

CORE traceback: `psycopg2.InterfaceError: connection already closed` in `concrete-agent/.../app/mcp/auth.py::validate_oauth_client_credentials` → `_execute` (line ~200) → `conn.rollback()` on an already-closed connection, on `/oauth/token`. `_execute`'s reconnect/retry must guard `conn.rollback()` (wrap in try, or check conn.closed) before retrying. Separate from passport 502. ChatGPT/Claude connector auth path.

---

## 5. Minor / noise

- `GET /api/otskp/<R-code>` 404 spam (Monolit `FlatPositionsTable.tsx:539`) — HARMLESS (already `.catch(()=>{})`); the imported project has Registry `R…` codes, not OTSKP. Optional: skip the lookup when the code isn't a 6-digit OTSKP to silence the global axios logger (`api.ts:132`).

---

## 6. Backlog not touched (from root CLAUDE.md TODO)

Resource Ceiling Ph.2 (Group A, P0), MEGA pour Bug 5 «NEÚPLNÉ», per-záběr engine refactor, Smart extractor Variant B, price_crane/price_pump → TOV, RD Jáchymov URS matching, api-access page (blocked on Lemon Squeezy IDs). See root `CLAUDE.md` §TODO.

---

## 7. Working agreements (this founder)

- PR-per-change; **user merges** (this session auto-merged on green CI per standing pace — confirm preference).
- After each merge: restart branch from `origin/main` (`git checkout -B <branch> origin/main`), force-with-lease when re-pushing already-merged history.
- Commit trailers: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: <url>`. Do NOT put model id in commits/PRs/artifacts.
- Stop-hook «Unverified commit» warnings on GitHub squash-merge commits (committer `noreply@github.com`) are FALSE positives — never amend merged public history.
- Karpathy anti-bloat; determinism > AI; don't touch unrelated code; when unsure, ask.
