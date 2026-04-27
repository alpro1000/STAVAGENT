# INVENTORY — Before Unified Project Works Pipeline

**Gate 1 mandatory inventory per `TASK_Unified_Project_Works_Pipeline.md`.**
**Generated:** 2026-04-24
**Scope:** 20 components that might be reused / extended / replaced before writing any code for the works-list pipeline.

Status legend: **works** = production-grade, wired, reusable as-is · **partial** = code exists but has a hole or fallback · **spec-only** = doc/Pydantic model without live DB/endpoint · **not-found** = referenced in CLAUDE.md but no file located.

---

## Inventory Table

| # | Component | Files (paths + line numbers) | Status | Will be reused |
|---|-----------|------------------------------|--------|----------------|
| 1 | **URS_MATCHER_SERVICE** | `URS_MATCHER_SERVICE/backend/src/app.js`; `URS_MATCHER_SERVICE/backend/src/api/routes/pipeline.js:1-72` | works | **Yes — Gate 6 calls `POST /api/pipeline/match` with `{text, quantity, unit, catalog, topN, minConfidence}`. No parallel URS matcher.** |
| 2 | **OTSKP catalog (17 904 records)** | `concrete-agent/packages/core-backend/app/pricing/otskp_engine.py:72-124`; `app/mcp/tools/otskp.py:23-48`; `app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml` (17 MB) | partial | **Yes — via `_get_catalog()` helper.** `.db` file NOT bundled in repo; `_InMemoryOTSKP` auto-falls back to XML regex parse. Works but slower. Gate 6 reuses the same helper. |
| 3 | **MCP `analyze_construction_document`** | `concrete-agent/packages/core-backend/app/mcp/tools/document.py:36-128` | works | **Partial reuse — Gate 3/4 can call it internally** for extra facts (11 regex patterns with conf 1.0: concrete class, rebar, prestress, exposure, dimensions, Ø, norms, white tank, SCC, OTSKP). Not the primary extraction path (that is `add-document` + `NormIngestionPipeline`). |
| 4 | **MCP `create_work_breakdown`** | `concrete-agent/packages/core-backend/app/mcp/tools/breakdown.py:47-207` | works | **Reference implementation for Gate 4.** Has `WORK_TEMPLATES` dict for 8 element types + calls `classify_construction_element()` + OTSKP match. Output shape: `{items: [{work_description, quantity, unit, hsv_section, otskp_code, unit_price_czk, total_price_czk}], sections, total_price_czk}`. **Note:** today's templates are Czech-hard-coded and flat (no language-agnostic IDs, no Slayers 1-3 split). Gate 0 extracts the knowledge, Gate 4 replaces the flat templates with the layered KB. |
| 5 | **MCP `classify_construction_element`** | `concrete-agent/packages/core-backend/app/mcp/tools/classifier.py:20-344` (ELEMENT_TYPES, KEYWORD_RULES, handler) | works | **Reused in Gate 3 (per-element classification).** 22 types, deterministic keyword regex, bridge-context from `SO-xxx` pattern, confidence 0.85/0.3. Mirrors TS logic in Monolit Planner (#7) — do **not** write a third one. |
| 6 | **MCP `find_otskp_code` + `find_urs_code`** | `app/mcp/tools/otskp.py:136-221`; `app/mcp/tools/urs.py:19-186` | works | **Yes — Gate 6 calls these directly**, not re-implements. `find_urs_code` does Perplexity web search on urs.cz + POST to URS_MATCHER_SERVICE (`/api/pipeline/match`), deduplicates, confidence 0.80–0.85. |
| 7 | **`element-classifier.ts` (Monolit Planner shared)** | `Monolit-Planner/shared/src/classifiers/element-classifier.ts:813` (`classifyElement`); ELEMENT_CATALOG at line 116 | works | **Reference only** (TypeScript; Core Engine pipeline is Python). Keep Python `classify_construction_element` as single source of truth for the pipeline. Keep TS classifier for Monolit calculator — do **not** port or merge. |
| 8 | **Phase 4 tables: `documents`, `facts`, `fact_conflicts`** | `concrete-agent/packages/core-backend/app/db/models/document.py:1-34` (`ProjectDocument` only); `alembic/versions/868b39220cfa_initial_schema.py:84-113` | partial | **`project_documents` is LIVE (migration 868b39220cfa). `facts` + `fact_conflicts` were NEVER migrated.** This is the biggest delta from CLAUDE.md assumptions. → Decision needed: migrate `facts` now (blocker for fact-provenance), or keep facts in `project.json` JSONB (works today, less queryable). |
| 9 | **POST `/project/{id}/add-document`** | `concrete-agent/packages/core-backend/app/api/routes_project_documents.py:769-905`; `app/models/document_schemas.py:1-200`; `app/services/document_summarizer.py` | works | **Yes — Gate 2/3 orchestrator calls this endpoint as-is.** Full pipeline: upload → detect type (14 DocTypes) → parse → Gemini enrich → cross-validate → update `project.json`. Already returns `AddDocumentResponse{DocumentSummary, flags, ai_enrichment}`. |
| 10 | **`RegexNormExtractor`** | `concrete-agent/packages/core-backend/app/services/regex_norm_extractor.py:23-80+` | works | **Yes — called by `NormIngestionPipeline` (#11). No Gate touches it directly.** 50+ patterns: ČSN EN, zákon, vyhláška, tolerance, span, cables, concrete class, exposure. |
| 11 | **`NormIngestionPipeline`** | `concrete-agent/packages/core-backend/app/services/norm_ingestion_pipeline.py:1-220+` | works | **Yes — indirect, via `add-document` endpoint (#9).** Full 4-layer chain confirmed: L1 pdfplumber → MinerU fallback; L2 regex; L3a Gemini; L3b Perplexity on merged. Chunked via `document_chunker.chunk_pdf_text()`. |
| 12 | **Phase 5: `work_items`, `classification_matches`, `catalog_matches` + `/decompose` endpoint** | `app/services/document_summarizer.py` + `app/services/tz_work_extractor.py` (Pydantic `WorkItem` only) | spec-only | **DECISION POINT.** Not migrated, no endpoint. Either: (a) this task adds the tables + endpoint (larger scope, proper provenance), or (b) we store `works_list` as a file at `data/works_lists/{project_id}__{works_list_id}.json` mirroring the `project.json` pattern (faster, less queryable). Recommend (b) for MVP, promote to tables once works_list UI editor (follow-up task) is on deck. |
| 13 | **Scénář B Portal (TZ → Výkaz výměr)** | `stavagent-portal/frontend/src/pages/ScenarioBPage.tsx`; `stavagent-portal/backend/src/routes/core-proxy.js:56`; `concrete-agent/packages/core-backend/app/api/routes_scenario_b.py:16-91` (`POST /generate` + `POST /upload`); `app/services/scenario_b_generator.py:299` | works | **CORRECTION after Gate 1 verification:** Core handler IS present at `/api/v1/scenario-b/{generate,upload}`, backed by 299-LOC `ScenarioBGenerator`, wired in `app/api/__init__.py:34+66`. Initial Agent D report was incorrect. End-to-end flow (frontend → Portal proxy → Core) is live. **Gate 8 decision:** build new `/portal/works-list` page; leave Scénář B alone, mark it as deprecated in `next-session.md` after new pipeline ships. |
| 14 | **`detect_construction_type()`** | `concrete-agent/packages/core-backend/app/services/document_classifier.py:710`; markers dict at `:46-89` | works | **Yes — Gate 3 uses it to set `object_type` per object.** 12+ types: dopravní, mostní, pozemní_bytová, pozemní_občanská, průmyslová, rekonstrukce, inženýrské_sítě, vegetační, pozemní_TZB (D.1.4), etc. Exceeds CLAUDE.md-claimed 12. |
| 15 | **Parsers (xlsx_komplet, xlsx_rtsrozp, pdf_parser razítko, MinerU)** | `app/parsers/xlsx_komplet_parser.py:36`; `app/parsers/xlsx_rtsrozp_parser.py`; `app/parsers/pdf_parser.py:129` (`_is_razitko_table`); `app/parsers/mineru_client.py:50`; `mineru_service/main.py:49 /parse-pdf` (Cloud Run europe-west1, ID-token auth) | works | **Yes — Gate 9 reuses `xlsx_komplet_parser.parse_xlsx_komplet()` for external-výkaz audit.** Rest reused indirectly through `add-document`. |
| 16 | **TZ text extractor (Monolit shared TS)** | `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts:325` (`extractFromText`), `:179` (`extractSmetaLines`), `:102` (`parseCzechNumber`) | works | **Reference only (TypeScript).** `ExtractedParam` shape — `{name, value, label_cs, confidence, source: 'regex'\|'keyword'\|'heuristic'\|'smeta_line', matched_text, catalog?, code?, alternatives?}` — is the right mental model for our Python fact records. Do not port; fact records already exist in `add-document` output. |
| 17 | **VZ Scraper** | `docs/TASK_VZ_SCRAPER_WORKPACKAGES_v3.md:1-30` (spec); `URS_MATCHER_SERVICE/backend/src/services/hlidacSmlouvyClient.js` (Hlídač API client scaffold) | spec-only (+ partial scaffold) | **Not a blocker for MVP.** Layer 4 (empirical statistics) is optional per task spec. Leave VZ Scraper in its current state; new follow-up task `TASK_VZ_Scraper_Complete_Czech.md` tracks it. |
| 18 | **`object-types-taxonomy`** | `docs/architecture/object-types-taxonomy.md` + `.json` — **NOT FOUND.** `docs/architecture/` directory doesn't exist. | not-found | **Gate 0 sub-step: create it.** Small (~1 h): `kb/taxonomy/object_types.yaml` with bridge / building / tunnel / linear / retaining hierarchy + mapping from `detect_construction_type` output → taxonomy node. |
| 19 | **Existing element_specs (raw domain knowledge)** | `data/peri-pdfs/rimsa_element_spec_v2_DOKA_PERI.md` (found, detailed — C35/45 XF4, 120–180 kg/m³ rebar); `STAVAGENT_Complete_Element_Catalog.md` NOT FOUND; `BRIEFING_NextChat_ElementTechSheets.md` NOT FOUND | partial | **Gate 0 starts with 1 spec (římsa).** The other 2 specs are missing — either never written, or archived elsewhere. Recommend: ask user if he has them on his machine / email. If not, Gate 0 scope expands: write 5 MVP element specs from scratch based on existing Monolit `ELEMENT_CATALOG` + domain knowledge. ~4–6 hours of expert time. |
| 20 | **`project.json` schema** | `concrete-agent/packages/core-backend/app/services/project_cache.py:28-113`; `PROJECT_DIR` in `app/core/config.py` | works | **Yes — `works_list` will be stored next to it as `data/projects/{project_id}.json` companion.** Top-level: `project_id, created_at, updated_at, positions[], audit_results{}, documents{}, status, progress`. Adds key `works_lists: [{id, generated_at, ...}]`. |

---

## Summary counts

- **works (14):** 1, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 15, 16, 20
- **partial (3):** 2, 8, 19
- **spec-only (2):** 12, 17
- **not-found (1):** 18

---

## Critical findings

1. **MCP tools are NOT stubs.** `analyze_construction_document`, `create_work_breakdown`, `classify_construction_element`, `find_otskp_code`, `find_urs_code` are all production-grade (#3–#6). CLAUDE.md TODO implied otherwise; reality is better.
2. **`add-document` endpoint + `NormIngestionPipeline` + all parsers + MinerU Cloud Run are live.** The extraction half of the pipeline is ~90 % already built (#9, #10, #11, #15). Gate 2–3 orchestrator only needs to **call** these, not reimplement.
3. **URS_MATCHER_SERVICE is fully operational** (#1, 243 tests, `/api/pipeline/match`). No parallel URS matcher will be written — Gate 6 is a 50-LOC HTTP call.
4. **Phase 4 is 1 table short.** `project_documents` is live; `facts` + `fact_conflicts` never migrated (#8). For MVP we can keep facts in `project.json` (JSON, no SQL) — this is what already happens via `add-document`. Tables are a follow-up.
5. **Phase 5 is spec-only.** `work_items` DB tables + `/decompose` endpoint don't exist (#12). MVP stores `works_list` as a file; table migration is a follow-up after UI editor is designed.
6. **Scénář B works end-to-end** (#13 — corrected after Gate 1 verification: Core handler exists at `routes_scenario_b.py`, 299-LOC generator, wired). The new works-pipeline UI will still be a **new Portal page** (`/portal/works-list`) to avoid breaking Scénář B; old page marked deprecated after the new pipeline ships.
7. **VZ Scraper is spec + scaffold, no deployment** (#17). Layer 4 (empirical statistics) is optional per the task spec. Not a blocker for MVP.
8. **`object-types-taxonomy` doesn't exist as a file** (#18) — CLAUDE.md referenced it as if it did. Gate 0 creates it (~1 h YAML).
9. **Only 1 of 3 existing element_specs located** (#19). Rímsa spec is detailed and high-quality. The two missing ones (Complete_Element_Catalog, ElementTechSheets) need clarification from user before Gate 0 — either he has them locally, or Gate 0 writes the other 4 MVP specs from scratch.
10. **CLAUDE.md count drift:** CLAUDE.md says "22 element types, 23 SQL schemas, 120 endpoints"; actual is 24 types in `pour-decision.ts`, 10 tables in Alembic, ~90 endpoints. Not blocking but noted.

---

## Proposed plan (to be confirmed by user)

Based on inventory, the task scope shifts toward **orchestration + KB + minimal new DB**, not greenfield pipelines. Proposed gate-by-gate:

- **Gate 0 (Core KB setup):** convert rímsa spec to YAML; write 4 new YAML specs (bathroom_wc, balcony, bridge_deck_prestressed, roof_sloped — residential_room + kitchen optional); write `kb/composition_rules/common.yaml`; write `kb/regional/CZ.yaml`; write `kb/taxonomy/object_types.yaml` (= fills gap #18); JSON-schema + unit tests. **~2 days expert + 0.5 day code.**
- **Gate 2 (orchestrator):** single new FastAPI endpoint `POST /api/v1/project/{id}/generate-works-list`, async job, single new JSON file `data/works_lists/{project_id}__{id}.json` (mirroring `project.json` pattern — no SQL migration). **~4 hours.**
- **Gate 3 (project identity + inventory):** reuse `detect_construction_type` (#14) + `classify_construction_element` (#5) + facts from `project.json`. Per-object inventory derived from facts in `project.json`. **~1 day.**
- **Gate 4 (work decomposition):** new Python module `app/services/works_decomposer.py` with Layer 1→2→3→4→5 chain. Layer 4 skipped in MVP (no VZ stats). Layer 5 (AI fallback) via existing Gemini wrapper. Replaces flat `WORK_TEMPLATES` from MCP `create_work_breakdown` (#4) — old MCP tool stays for backwards-compat but marked deprecated. **~2 days.**
- **Gate 5 (quantities resolution):** pulls from `project.json.positions` + fact records. Null-safe. **~4 hours.**
- **Gate 6 (catalog matching):** single HTTP call per work_family to `find_otskp_code` + `find_urs_code` MCP tools (or their underlying services directly). **~3 hours.**
- **Gate 7 (export):** new `app/services/works_list_exporter.py` — xlsx (5 sheets) + docx narrative. Reuses openpyxl + docx libs that are already in project. **~1 day.**
- **Gate 8 (Portal UI):** new page `stavagent-portal/frontend/src/pages/WorksListPage.tsx` — upload PD zip / select existing project / checkbox "audit of external výkaz" → run button → result viewer (read-only). **~1.5 days.**
- **Gate 9–10 (audit):** reuses `xlsx_komplet_parser.py` for external výkaz parse; gap analysis is a new ~150-LOC module. **~1 day.**
- **Gate 11 (dezagregace):** ~100-LOC utility, optional trigger. **~4 hours.**

**Total:** ~8 working days for code + 2 days expert time on Gate 0 KB.

**Blockers to resolve before coding:**
- B1: Are missing `STAVAGENT_Complete_Element_Catalog.md` + `BRIEFING_NextChat_ElementTechSheets.md` available on user's machine?
- B2: Is Scénář B Core endpoint broken or just in a different file? (5-min fix by user confirming.)
- B3: Decide `works_list` storage — file (MVP, fast) vs new Alembic migration (proper, slower)?
- B4: Decide `facts` table — keep in `project.json` JSON (MVP) vs migrate (P1 follow-up)?
- B5: Confirm the 5 MVP element types (residential_room, bathroom_wc, balcony, bridge_deck_prestressed, roof_sloped) are the right starting set for this user's projects?
- B6: Which regional override first — CZ.yaml only, or CZ + SK simultaneously (they're ~95 % identical)?
- B7: Is the proposed gate order OK, or do you want Gate 0 KB done before any pipeline code (parallel workstreams)?

These 7 map 1:1 to the task's "Pre-implementation Interview" questions — collected into the AskUserQuestion batch that follows this document.

---

## Locked decisions (user answers, 2026-04-24)

| # | Blocker | Decision |
|---|---------|----------|
| B1 | Missing element_specs | **User will paste `STAVAGENT_Complete_Element_Catalog.md` + `BRIEFING_NextChat_ElementTechSheets.md` into the repo.** Gate 0 waits for them. Starts from 3 existing MD docs (rimsa + 2 incoming) + writes 2 new YAMLs for the remaining MVP types. |
| B2 | Phase 4 facts storage | **Keep in `project.json`.** No Alembic migration for `facts` / `fact_conflicts`. Follow-up task once fact-querying UI is on deck. |
| B3 | works_list storage | **File at `data/works_lists/{project_id}__{works_list_id}.json`.** Mirrors `project.json` disk pattern. No Phase 5 tables, no `/decompose` new endpoint beyond `/generate-works-list`. |
| B4 | Scénář B handling | **Verified:** Core handler `POST /api/v1/scenario-b/{generate,upload}` at `routes_scenario_b.py:16`, backed by 299-LOC `ScenarioBGenerator`. Works end-to-end today. **→ Gate 8 ships new page `/portal/works-list`**, leaves Scénář B alone, marks it deprecated in `next-session.md` for a future cleanup task. |
| B5 | Regional MVP | **CZ only.** `kb/regional/CZ.yaml` with ČSN EN + OTSKP primary + URS secondary + ČSN 74 3305 zábradlí etc. SK / DE / PL are follow-up tasks. |
| B6 | Gate 0 timing | **Strict order: Gate 0 finishes before Gate 2 starts.** Pipeline consumes a stable, schema-validated KB. ~2 expert-days + 0.5 d code for Gate 0, then pipeline code. |
| B7 | Layer 4 (VZ Scraper) | **Defer to follow-up task `TASK_VZ_Scraper_Complete_Czech.md`.** MVP ships Layers 1–3 + Layer 5 (AI fallback). Existing Hlídač scaffold in `URS_MATCHER_SERVICE` not touched. |

---

## Execution plan — locked

**Phase A — blocked on user (paste 2 missing MD files).** Once those land:
1. **Gate 0 — Core KB setup** (~2 expert-days + 0.5 d code)
   - Convert 3 existing MDs → `kb/element_types/{rimsa,<from_complete_catalog>,<from_techsheets>}.yaml`
   - Write 2 new element YAMLs to reach 5 MVP types (proposed: `residential_room`, `bathroom_wc`, `balcony`, `bridge_deck_prestressed`, `roof_sloped` — subject to what the missing MDs cover)
   - `kb/composition_rules/common.yaml` (≥5 rules)
   - `kb/regional/CZ.yaml` (norms, catalogs, regional preferences)
   - `kb/taxonomy/object_types.yaml` (bridge / building / tunnel / linear / retaining — fills #18)
   - JSON schema + vitest/pytest validation

**Phase B — unblocks once Gate 0 passes:**
2. **Gate 2** — `POST /api/v1/project/{id}/generate-works-list` async endpoint + file-based storage (~4 h)
3. **Gate 3** — project identity + per-object inventory via existing `detect_construction_type` + facts from `project.json` (~1 d)
4. **Gate 4** — `app/services/works_decomposer.py` implementing Layers 1→2→3→5 (~2 d)
5. **Gate 5** — quantities resolution from facts, null-safe (~4 h)
6. **Gate 6** — catalog matching via existing MCP tools `find_otskp_code` + `find_urs_code` (~3 h)
7. **Gate 7** — xlsx (5 sheets) + docx exporters (~1 d)
8. **Gate 8** — new Portal page `WorksListPage.tsx` (read-only viewer, ~1.5 d)
9. **Gate 9–10** — external výkaz parse + gap analysis (~1 d)
10. **Gate 11** — optional dezagregace utility (~4 h)

**Total budget:** ~2 expert-days (Gate 0 KB) + ~8 dev-days (Gates 2–11).

**Reuse-not-rewrite contracts (from this inventory):**
- Gate 2–3 calls `POST /project/{id}/add-document` for each uploaded PD file. Never calls parsers/pipelines directly.
- Gate 3 calls `classify_construction_element` (Python, MCP tool) — not a parallel classifier.
- Gate 5 reads `project.json.positions[]` only — facts live there per decision B2.
- Gate 6 calls MCP `find_otskp_code` + `find_urs_code` — does NOT reimplement OTSKP lookup or URS matching.
- Gate 9 calls `xlsx_komplet_parser.parse_xlsx_komplet()` for external výkaz parse.
- Old MCP `create_work_breakdown` stays for backward compat, marked deprecated; new `works_decomposer` is the primary path.
- `element-classifier.ts` (Monolit TS) is NOT merged or ported — stays as Monolit Planner internal.

**Out of scope explicitly confirmed:**
- No `facts` / `fact_conflicts` migration (B2).
- No Phase 5 tables (B3).
- No Scénář B rewrite (B4).
- No SK / DE / PL regional files (B5).
- No parallel-workstream KB (B6).
- No Layer 4 VZ Scraper (B7).

