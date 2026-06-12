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
  **CORRECTION 3 (model verification before migration) — VERIFIED 2026-06-11:**
  `textembedding-gecko@003` was **RETIRED 2025-05-24** (cloud.google.com), not just
  legacy → existing `vertex_embeddings.py` would 404; it must be **rewritten**, not
  reused as-is. Verified current options: `gemini-embedding-001` (GA, 100+ langs,
  MTEB-multilingual leader; default 3072-dim, truncatable to 768/1536/3072 via
  `output_dimensionality` MRL; 768 = 0.26% quality loss; max 2048 input tokens;
  manual L2-norm needed below 3072) · `text-multilingual-embedding-002` (native
  768-dim, stable) · `text-embedding-005` (EN/code, gecko successor).
  **DECISION:** `gemini-embedding-001` @ `output_dimensionality=768`, pgvector
  **cosine** distance (cosine operator absorbs the normalization caveat). Dimension =
  a single config constant `EMBEDDING_DIM` (no magic 768 literal) so the column is
  swappable. 768 chosen deliberately (quality≈3072, 4× smaller/faster HNSW than 3072).
  `text-multilingual-embedding-002` is the documented fallback. Migration is written
  to this verified dimension.
- Deterministic param prefilter (concrete_class, soil_class, šířka, hloubka,
  ruční/strojní, pažení, vzdálenost odvozu) **after** retrieve, **before** ranking.
- Ranking = **named pluggable step** `(query, candidates[]) → candidates[]`, default =
  deterministic score. Candidates keep full `popis` after prefilter (reranker reads
  prose). Ranking call written to audit; replay reads recorded order. Ranking never
  overrides 1.0 (code) / 0.99 (human). Vertex candidate = AI-band (~0.70–0.80), never 1.0.
- Honest confidence + provenance (no hardcoded 1.0 on bare DB hit).
- **CORRECTION 1 (learned-mappings — migrate to Core, close confidence-laundering):**
  the kiosk learned-mappings KB (`concreteAgentKB.js`) content migrates to a Core
  table (learned/confirmed mappings) — it is the future reranker training corpus +
  accumulated human confirmations. **Only the kiosk copy is deleted.** The current
  kiosk auto-learn at conf ≥ 0.85 is **confidence-laundering** (the system writes its
  own KB from Perplexity matches, which later resurface as "learned" with high
  confidence) → **does NOT migrate.** Core rule: learned-mappings accept **only
  human-confirmed codes (0.99)**. (New acceptance #11.)
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
  otskpCatalogService / perplexityClient). **Data is migrated, not dropped** — see
  CORRECTION 1 (learned-mappings) and CORRECTION 2 (ÚRS SQLite) below.
- **CORRECTION 2 (local ÚRS SQLite ~39K — conscious fate, no silent loss):** today
  the kiosk has an offline ÚRS fallback (local SQLite ~39K) that Core lacks (Core ÚRS
  = web-on-demand: Perplexity + URS Matcher HTTP). Killing the kiosk engine must NOT
  silently drop it. **Preferred:** migrate the 39K ÚRS SQLite into Core as a
  local-fallback layer on the ÚRS branch (also the future ÚRS embeddings-index
  candidate). **Alternative:** an explicit "accept web-only ÚRS" decision recorded in
  the Phase 3 audit. One of the two — never silent.
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
| 11 | **learned-mappings accept records ONLY with human-confirm 0.99** (no auto-learn from AI-confidence; kiosk auto-learn ≥0.85 does not migrate) | 1 (Core rule) / 3 (kiosk copy removed) |
| 12 | Local ÚRS ~39K fate is explicit: migrated to Core fallback OR "web-only" recorded in audit — never silently dropped | 3 |

---

## 7. Out of scope (§7)

Reranker model (cross-encoder, P6 — seam only here) · Vertex RAG / "Zeptat se
dokumentace" · multi-catalog DACH adapters · calculator element-type classifier
(22–23 types — do not touch) · cross-user data isolation (separate P0) · pricing /
rates / TOV / AI writing quantities.

---

## 8. Phase 1b — infra (model revision, Data Store, OTSKP 2026, runbook)

### 8.1 Embedding model — revised by SDK constraint (verified 2026-06-11)
`requirements.txt` has only `google-generativeai==0.8.3` (old SDK) + `vertexai`
(via `google-cloud-aiplatform==1.154.0`, **frozen for Cemex**, `vertexai` REMOVED
2026-06-24, migrating to `google-genai` after). Building new embedding code on a
SDK removed in 13 days is wrong. So:
- **Interim model = `text-multilingual-embedding-002`** (native 768, multilingual,
  drop-in on the current `vertexai.language_models.TextEmbeddingModel` API that
  `gemini_client.py` already uses; no new dep, no normalization caveat).
- **`gemini-embedding-001` @ output_dimensionality=768** = the post-google-genai
  upgrade. **Both 768** → the pgvector column never re-dimensions on the swap.
- `EMBEDDING_MODEL` / `EMBEDDING_DIM` are settings (config.py) — swap = config + re-embed.

### 8.2 Data Store question (catalogs/ exclusion) — ANSWER
`gs://stavagent-cenik-norms` is synced **whole-bucket via the Vertex console**
(`vertex_search.py` datastore `urs-otskp-csn-norms-cenik`; `scripts/gcs_sort.sh`
+ `scripts/INDEX.json` only organise B3–B7). **No prefix filter, no IaC.** A
`catalogs/` prefix in that bucket WOULD be ingested into the norms RAG corpus.
**Recommendation (implemented in config): a SEPARATE bucket
`gs://stavagent-catalogs`** for catalog XML (`settings.CATALOG_GCS_BUCKET`) — clean
isolation, no fragile console-only include filter. Catalog XML is ingestion data,
never RAG knowledge. (Fallback if a separate bucket is refused: restrict the
datastore import `gcsSource` to `B[3567]/` — console-only, fragile.)

### 8.3 OTSKP 2026 ingestion
SFDI open-format XML (`2026_OTSKP_sfdi_otevreny_format.xml`) is the primary;
AspeEsticon export is cross-check only. Structure = same `XC4 …> Polozka`
(`znacka/nazev/MJ/jedn_cena/technicka_specifikace`) as 2025_03 + the URS_MATCHER
importer. XML is NOT committed — repo stores `scripts/ingest_otskp_catalog.py`,
data lives in GCS. Provenance label = `settings.OTSKP_CATALOG_VERSION` ("OTSKP 2026").
Indexing runs directly on the 2026 base (no double re-index). Tool docstring's
"17,904" softened to a version-stamped, count-agnostic description.

### 8.4 Deploy runbook (1b — not runnable in CI; ops steps)
1. Create `gs://stavagent-catalogs`; upload SFDI XML to `catalogs/`. Confirm the
   norms Data Store sync does NOT include it (separate bucket → automatic).
2. `alembic upgrade head` → installs `vector` ext + `otskp_embeddings(vector(768))`.
3. `python scripts/ingest_otskp_catalog.py --gcs gs://stavagent-catalogs/otskp/2026_OTSKP_sfdi_otevreny_format.xml --db-out app/otskp.db --index`
   (builds otskp.db + embeds + upserts into pgvector). Note the real item count;
   update any remaining hardcoded counts.
4. At startup, after the catalog is indexed, call
   `catalog_embeddings.register_embeddings_provider()` to wire the seam.
5. Confirm MCP compat suite green on CI (fastmcp unavailable locally).

### 8.5 What 1b delivers vs defers
**Delivered (code + hermetic tests, 27 green):** model/dim config · embeddings
client rewrite (retired-gecko → multilingual-002) · pgvector Alembic migration ·
pgvector provider + chain wiring · GCS→otskp.db ingestion script (pure parser
tested) · Data Store recommendation · honest docstring.
**Deferred (ops/Phase 3):** live GCS upload + indexing run (deploy) · learned-mappings
Core table + human-confirm-0.99 (acceptance #11; lands with the kiosk migration,
Phase 3) · local ÚRS-2018 fallback at conf 0.60–0.65 + "ověřit proti aktuálnímu
katalogu" UI flag (acceptance #12; ÚRS branch / Phase 3) · Phase 2 docstring
example-code fix.

## 9. STOP

Phase 1 (1a + 1b) code on branch `claude/upbeat-dirac-krnyqi`. Hermetic suite 27
green locally; **CI HEAD db7b2c4 GREEN — verbatim: `487 passed, 3 skipped, 25
warnings in 71.74s`** (run 399, MCP Tools Compatibility). STOP before merge
(Alexander merges). No live data mutated (GCS/DB indexing is a deploy step).

## 10. Post-merge verification + caveats (Alexander notes, 2026-06-11)

1. **CI gate honoured:** merge only the CI-green HEAD (db7b2c4) — confirmed above.
2. **Model-swap is NOT free (record in the August SDK-migration task):** moving
   `text-multilingual-embedding-002` → `gemini-embedding-001` keeps the pgvector
   column dim (both 768) BUT vectors live in different spaces → all 17,904+ items
   must be **re-embedded** (one batch run, cheap, but a re-embed — not a config
   swap). Trigger it together with the vertexai→google-genai migration (≤2026-06-24).
3. **Goldens "not affected" is an assertion, not a test:** `find_otskp_code`
   changed behaviour (different results + confidence) under a preserved contract,
   and the Cemex demo path runs through Core. Cheap insurance: after merge+deploy,
   run ONE SO250 breakdown end-to-end by hand **before 21.06** so the demo path is
   verified on the new code, not on faith.
4. **Acceptance #4 (recall) is proven only LIVE.** Order after merge:
   - (a) separate catalog bucket — `gsutil mb -l europe-west3 gs://stavagent-catalogs`
     then `gsutil mv "gs://stavagent-cenik-norms/catalogs/*" gs://stavagent-catalogs/otskp/`
     (also removes `catalogs/` from the norms-synced bucket → Data Store clean).
   - (b) deploy Core + run ingestion runbook §8.4 (alembic pgvector → otskp.db from
     SFDI-2026 → `--index`). Footgun: a force rebuild WIPES the VPC connector +
     `REDIS_URL` — restore by hand.
   - (c) live MCP probe `beton mostních pilířů C35/45`: correct pier-concrete code
     in top-N with honest confidence, `obklad`/`přechod desky` filtered out =
     Phase 1 proven end-to-end (the before/after artefact).
