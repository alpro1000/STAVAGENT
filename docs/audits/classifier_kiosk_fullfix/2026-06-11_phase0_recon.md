# Phase 0 Recon — Classifier Kiosk Full Fix (Frontend + MCP + Backend)

**Date:** 2026-06-11
**Branch:** `claude/upbeat-dirac-krnyqi`
**Task:** `TASK_Classifier_Kiosk_FullFix_Frontend_MCP_Backend_1.md`
**Status:** Phase 0 (read-only). STOP gate before Phase 1.

> Scope: bring catalog classification (URS_MATCHER / `find_otskp_code` /
> `find_urs_code`) to the canonical Work-First / Catalog-Last chain; fix broken
> recall and the hardcoded-`confidence=1.0` semantics; retire dead subsystems.
> This document is the Phase 0 deliverable: a grounded map of today's wiring +
> the decisions taken in the §2 pre-implementation interview + the refined plan.

---

## 1. Target canonical chain (from task §1.1)

```
Work description (soupis line / fact from S0)
  ↓ UWO classification        rule-based 1.0 → Vertex bounded fallback 0.70 (output = code from fixed dict)
basket: UWO category
  ↓ retrieve candidates IN BASKET   deterministic keyword + Vertex embeddings (recall)
  ↓ deterministic param prefilter   drop candidates mismatching explicit params
  ↓ ranking                         deterministic score (default); reranker = pluggable seam (P6)
  ↓
human confirms final code + name FROM catalog (honest-blank if none)

Code lookup (separate branch): otskp.db exact (1.0) → ÚRS HTTP if ÚRS type (0.80) → honest-blank
```

---

## 2. CONFIRMED findings (§1.2 — verified by live recon, file:line)

### 2.1 Core (`concrete-agent/packages/core-backend`)

- **`find_otskp_code` = flat substring keyword search, `confidence=1.0` hardcoded on
  any DB hit.** `app/mcp/tools/otskp.py`:
  - search impl `_InMemoryOTSKP.search()` lines 105–123 — `score = matched/len(words)`
    pure substring count, no fuzzy/stemming/semantic, no indices.
  - hardcoded `"confidence": 1.0` at line 186 (exact lookup) and line ~210 (fulltext
    search) — set on **every** hit regardless of match quality. This is the core
    semantic bug: 1.0 means "string is in the DB", not "code is correct".
  - OTSKP source: SQLite `{base}/otskp.db` (lines 32–39) → fallback XML
    `app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml` (~17 MB, 17,904 items).
  - OTSKP engine wrapper: `app/pricing/otskp_engine.py` (`OTSKPDatabase`, sync sqlite3).
- **No UWO gate** before code search (`classify_construction_element` output is used
  for work decomposition templates only, never to narrow code candidates):
  `app/mcp/tools/classifier.py` lines 256–322; bridge-context remap lines 279–285.
- **No parametric prefilter** (concrete_class etc.) on any code path. `create_work_breakdown`
  carries `concrete_class` but uses it only for template string formatting (line ~200),
  not to filter candidates.
- **`find_urs_code`** = Perplexity web (0.80, `app/mcp/tools/urs.py` line ~128) + URS
  Matcher HTTP (0.80–0.85, POST `{URS_MATCHER_URL}/api/pipeline/match`, lines 149–186).
  Confidence band is honest here — kept.
- **`create_work_breakdown`** already defaults to `mode='work_first'` (Pattern 15):
  `app/mcp/tools/breakdown.py` line 83 (`mode: str = MODE_WORK_FIRST`), frozen
  code-less list with `otskp_code/unit_price_czk/total_price_czk = None` (lines 250–252).
  **Work-first atomization already lives in Core** — kiosk should not re-implement it.
- **Confidence/provenance is ad-hoc per tool** (inline dicts), not a shared dataclass.
  A formal schema exists but for document extraction only:
  `app/models/uep_schemas.py` `SourceProvenance` + `ExtractedFact` (lines 62–99).
- **Schema example code `113472111`** is in the `find_otskp_code` docstring (otskp.py
  line ~169) labeled "beton základů C25/30". Pattern resembles an ÚRS code; task §1.2
  flags it as not found in otskp.db. **Phase 2: replace with a verified OTSKP code.**

### 2.2 Vertex / vector infra

- **`app/integrations/vertex_embeddings.py` EXISTS but is UNUSED scaffolding**
  (`textembedding-gecko@003`, 768-dim, singleton, `embed_texts()` / `embed_query()`).
  No imports anywhere → Phase 1 wires it, does not build new.
  - ⚠️ `textembedding-gecko@003` is a legacy embedding model — verify current
    availability / migration target before Phase 1 (per CLAUDE.md dependency
    discipline: confirm model lifecycle from the primary source, not memory).
- **No pgvector today.** Cloud SQL PG15 + Alembic (13 migrations) + Czech FTS
  (`tsvector` / GIN). Adding pgvector = one `CREATE EXTENSION vector` Alembic revision
  + an embedding column + `pgvector` Python driver.
- OTSKP = XML/SQLite (17,904). ÚRS = web-on-demand (no local index in Core).

### 2.3 Routing (task §1.2 — canon, OK)

OTSKP→most/silnice (transport), ÚRS→budova (building). Wired at tool level. Unchanged.

---

## 3. NEW finding (not in §1.2) — the kiosk is NOT a thin UI

`URS_MATCHER_SERVICE` (Node/Express + SQLite + vanilla-JS SPA) has its **own full
matching stack** that duplicates what the task wants centralized in Core:

- **Single-name search** (subsystem a): `POST /api/jobs/text-match` →
  `backend/src/services/ursMatcher.js` `matchUrsItems()` (line 23). Fallback chain:
  learned mappings (KB seed) → local SQLite (~39K ÚRS) → Perplexity → OTSKP supplement
  when conf < 0.7; auto-learns at conf ≥ 0.85.
- **List/batch search** (subsystem b): `/api/batch/*` →
  `backend/src/services/batch/batchProcessor.js` 4-phase pipeline
  (`textNormalizer` → `workSplitter` (LLM) → `candidateRetriever` (Perplexity) →
  `candidateReranker` (LLM)).
- **Multi-language matcher:** `backend/src/services/universalMatcher.js`.
- **OTSKP service:** `backend/src/services/otskpCatalogService.js`.
- **Perplexity client:** `backend/src/services/perplexityClient.js`.
- **Learned-mappings KB (≈36-item seed):** `backend/src/services/concreteAgentKB.js`.
- **Subsystem 3 (TZ → atomic list):** NOT dead local logic — it already **proxies to
  Core**: `backend/src/services/documentExtractionService.js` uploads to
  concrete-agent `/api/upload` and fetches `/api/projects/{id}/positions`.
- **Subsystem 4 (role debate):** fully built — **6 roles** (konstruktér / betonář /
  rozpočtář / normokontrolér / technolog / koordinátor), **not** the 3 the task names
  (сметчик/архитектор/прораб). `backend/src/services/projectAnalysis/roles.js` +
  `roleIntegration/orchestrator.js` + `conflictResolver.js`; triggered by
  "Rozšířený režim" → `POST /api/jobs/block-match` (vs `block-match-fast`).
- **DebugCollector:** does NOT exist in this kiosk (only `logger.js`). Task §3 lists it
  as required → it is a **new** addition for Phase 3, not a re-wire.

**Implication:** "kiosk = thin projection over Core" is the target, not the present
state. Making it thin means migrating the above stack to Core/MCP — materially larger
than the task's §1.4 framing. This was raised in the interview (see §4).

---

## 4. Pre-implementation interview decisions (§2)

| # | Question | Decision |
|---|----------|----------|
| 1 | Merge timing of phase PRs | **Merge each phase as CI passes** (not held to post-Cemex). NB: honor the freeze window — phases must land before ~21.06 or go staging-only after. |
| 2 | Where vector index lives | **pgvector in Cloud SQL** (concrete-agent DB). One `CREATE EXTENSION` Alembic migration + embedding column; reuse `vertex_embeddings.py`. |
| 3 | Kiosk parallel matching engine | **Migrate now to Core/MCP.** Phase 3 makes the kiosk truly thin: replace local matching with Core calls; remove the engine duplication. |
| 4 | Dead subsystems 3 & 4 | **Keep subsystem 3** (already a Core proxy — it's the seam the migration leans on). **Remove only subsystem 4** (role debate / 6-role orchestrator + conflictResolver). |
| 5 | Routing (veřejná→OTSKP, privátní→ÚRS, D&B→oba) | Unchanged (kept as assumption; not asked). |

Decisions 3 & 4 are consistent: subsystem 3 stays as the Core-proxy seam the
migration uses; subsystem 4 goes.

---

## 5. Refined phase plan (one PR per phase, STOP between, merge by Alexander)

### Phase 1 — Backend (Core): chain + recall fix
- Code-lookup branch: otskp.db exact (1.0) → ÚRS HTTP if ÚRS (0.80) → honest-blank.
- UWO gate by work type **before** code search (output = code from a fixed dict;
  rule-based 1.0 → Vertex bounded fallback ~0.70).
- Retrieve in basket: deterministic keyword **+ Vertex embeddings** (recall fix).
  Index OTSKP into **pgvector** (new Alembic migration); reuse `vertex_embeddings.py`.
- Deterministic param prefilter (concrete_class, soil_class, šířka, hloubka,
  ruční/strojní, pažení, vzdálenost odvozu) **after** retrieve, **before** ranking.
- Ranking = **named pluggable step** `(query, candidates[]) → candidates[]`, default =
  deterministic score. Candidates keep full `popis` after prefilter (reranker reads
  prose). Ranking call written to audit; replay reads recorded order. Ranking never
  overrides 1.0 (code) / 0.99 (human). Vertex candidate = AI-band (~0.70–0.80), never 1.0.
- Honest confidence + provenance (no hardcoded 1.0 on bare DB hit).
- **STOP + report.**

### Phase 2 — MCP
- Expose operations as atomic Core-tools returning a **carrier**
  (candidates + confidence + provenance), not a table.
- Confidence ladder + honest-blank respected.
- Fix the docstring example code in `find_otskp_code` to a **verified** OTSKP code.
- **STOP + report.**

### Phase 3 — Frontend (kiosk → thin) + engine migration
- Migrate kiosk matching (single-name, list/batch) to Core/MCP calls; remove the
  local matching engine duplication (ursMatcher / universalMatcher / batch pipeline /
  otskpCatalogService / perplexityClient / learned-mappings as the source of truth).
- **Keep subsystem 3** (Core proxy). **Remove subsystem 4** (role debate: roles.js +
  orchestrator.js + conflictResolver.js + `/api/project-analysis/*` + "Rozšířený režim"
  UI + `block-match` route).
- "Разбивка / decomposition" = render Core carrier (kiosk computes nothing).
- DebugCollector wired (new).
- Provenance + confidence visible at each candidate; confirmation screen present.
- **STOP + report.**

> UI placement of the "разбивка" view (separate kiosk tab vs Registry/Portal zone —
> task §2 Q4) was not forced in the interview; resolve in the Phase 3 design proposal.

---

## 6. Acceptance criteria mapping (§6) → phase

| # | Criterion | Phase |
|---|-----------|-------|
| 1 | Honest confidence (no hardcoded 1.0 on DB hit; `beton pilířů` vs `obklad pilířů`) | 1 |
| 2 | UWO gate (`beton mostních pilířů` ≠ obklad / přechod desky opěr) | 1 |
| 3 | Param prefilter (C35/45 query drops C12/15…C25/30) | 1 |
| 4 | Recall (correct code in shortlist BEFORE ranking; embeddings retrieve works) | 1 |
| 5 | Code-lookup 1.0 without AI; unknown → honest-blank; schema example fixed | 1 (lookup) / 2 (example) |
| 6 | Vertex bounds (embeddings candidate = AI-band, never picks final code / writes quantity) | 1 |
| 7 | Reranker seam (pluggable, deterministic default, full popis, audited, replayable) | 1 |
| 8 | MCP tool returns carrier, not table | 2 |
| 9 | Frontend no own matching logic; subsystem 4 removed; confirmation screen; provenance/confidence visible | 3 |
| 10 | Existing goldens green; new tests green; verbatim CI log on final HEAD; idempotent; backup before write | all |

---

## 7. Out of scope (§7)

Reranker model (cross-encoder, P6 — seam only here) · Vertex RAG / "Zeptat se
dokumentace" · multi-catalog DACH adapters · calculator element-type classifier
(22–23 types — do not touch) · cross-user data isolation (separate P0) · pricing /
rates / TOV / AI writing quantities.

---

## 8. STOP

Phase 0 read-only recon complete. Awaiting go-ahead (Alexander) for Phase 1.
No code written. No data mutated.
