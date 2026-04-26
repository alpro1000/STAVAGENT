# Other Inventory — Part 1: `URS_MATCHER_SERVICE/` + `mineru_service/`

**Scope:** `URS_MATCHER_SERVICE/` (Node.js + SQLite, 4-phase URS matching pipeline) and `mineru_service/` (Python FastAPI MinerU PDF parser).
**Source:** Gate 1+2 Explore agent C (other backends).
**File counts:** ~140 URS files (~25K LOC + 32.5 MB data) + 1 MinerU file (185 LOC).

This is the largest standalone service in terms of catalog data — six legacy CSVs + two MS Access DBs in `backend/data/` totalling ~36 MB.

---

## URS_MATCHER_SERVICE inventory table

### Code (services + scripts + prompts)

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `URS_MATCHER_SERVICE/backend/src/prompts/ursMatcher.prompt.js` | 829 lines | JS prompts | urs_prompts, llm | `ursMatcher.js`, `llmClient.js` | 2026-04-19 | no | keep_in_place | LLM system prompts for 4-phase URS matching |
| `URS_MATCHER_SERVICE/backend/src/services/ursMatcher.js` | 400+ lines | JS service | urs_classifier_rules, 4_phase | `unifiedMatchingPipeline.js` | 2026-04-19 | no | keep_in_place | Phase 1–4: candidate selection → similarity → AI refinement |
| `backend/src/services/universalMatcher.js` | 506 lines | JS service | urs_classifier_rules | `llmClient.js`, pipeline | 2026-04-19 | no | keep_in_place | Text → URS matching with fallback |
| `backend/src/services/otskpCatalogService.js` | 400+ lines | JS service | otskp_catalog_db | `universalMatcher.js`, routes | 2026-04-19 | partial (mirrors CORE `B1_otkskp_codes/2025_03_otskp.xml`) | keep_in_place | OTSKP XML parser + index (17,904 items) |
| `backend/src/services/concreteAgentKB.js` | 200+ lines | JS service | urs_catalog_db, kb_bridge | `tskpParserService.js` | 2026-04-19 | yes (CORE B1_urs_codes / B2_csn_standards / B1_otkskp_codes) | **merge_with** | References CORE knowledge_base from URS_MATCHER — should consolidate via Core HTTP API or shared package |
| `backend/src/services/knowledgeBase.js` | 563 lines | JS service | urs_catalog_db | `universalMatcher.js` | 2026-04-19 | partial | keep_in_place | Local URS matching knowledge (production rules + fallback lists) |
| `backend/src/services/llmClient.js` | 1005 lines | JS service | llm_orchestration | pipeline routes, ursMatcher | 2026-04-19 | no | keep_in_place | Multi-provider LLM client (Claude / Gemini / local) with caching |
| `backend/src/services/cacheService.js` | 695 lines | JS service | cache_layer | `llmClient.js`, `ursMatcher.js` | 2026-04-19 | no | keep_in_place | Redis / memory caching |
| `backend/src/services/catalogImportService.js` | 587 lines | JS service | catalog_management | `scripts/import_*.mjs` | 2026-04-19 | no | keep_in_place | Catalog seeding from CSV/XLSX/XML |
| `backend/src/services/workPackageBuilder.js` | 597 lines | JS service | work_packages | `unifiedMatchingPipeline.js` | 2026-04-19 | no | keep_in_place | Builds work-package hierarchy from matched items |
| `backend/src/services/norms/knowledgeBase.js` | 554 lines | JS service | csn_standards, exposure | batch processing | 2026-04-19 | yes (CORE `B2/csn_en_206.json`, Monolit `maturity.ts`) | **merge_with** | ČSN/ČSN EN concrete classes + exposure + productivity — duplicates CORE B2 |
| `backend/src/services/prices/priceService.js` | 610 lines | JS service | pricing_dynamic | `routes/pricing` | 2026-04-19 | no | keep_in_place | Dynamic labor / material / equipment pricing |
| `backend/src/services/prices/priceDatabase.js` | 522 lines | JS service | price_db | `priceService.js` | 2026-04-19 | no | keep_in_place | SQLite price catalog (suppliers / vendors / rates) |
| `backend/src/services/unifiedMatchingPipeline.js` | 400+ lines | JS service | pipeline_orchestration | `routes/pipeline.js` | 2026-04-19 | no | keep_in_place | 4-phase orchestrator (extraction → candidate → refinement → hierarchy) |
| `backend/scripts/import_urs_catalog.mjs` | 200+ lines | JS script | catalog_import | cron | 2026-04-19 | no | keep_in_place | URS CSV → SQLite |
| `backend/scripts/import_otskp_to_sqlite.mjs` | 180+ lines | JS script | catalog_import | cron | 2026-04-19 | partial (loads from CORE XML) | keep_in_place | OTSKP XML → SQLite (17,904 items) |
| `backend/scripts/import_tskp_to_sqlite.mjs` | 150+ lines | JS script | catalog_import | cron | 2026-04-19 | no | keep_in_place | TSKP CSV → SQLite |
| `backend/scripts/import_kros_urs.mjs` | 200+ lines | JS script | catalog_import, legacy_mdb | cron (likely orphan) | 2026-04-19 | partial (KROS.MDB is legacy) | mark_legacy | KROS.MDB → SQLite (legacy importer) |
| `URS_MATCHER_SERVICE/ARCHITECTURE.md` | 20 KB | markdown | architecture_doc | `README.md` | 2026-04-19 | no | keep_in_place | 4-phase pipeline + LLM integration + cache layers |
| `URS_MATCHER_SERVICE/BATCH_ARCHITECTURE.md` | 30 KB | markdown | batch_processing_doc | `README.md` | 2026-04-19 | no | keep_in_place | Batch job orchestration + state machine |
| `URS_MATCHER_SERVICE/HOW_IMPORT_SYSTEM_WORKS.md` | 25 KB | markdown | catalog_import_doc | `README.md` | 2026-04-19 | no | keep_in_place | Catalog import flows + seed scripts |
| `URS_MATCHER_SERVICE/MULTI_ROLE_OPTIMIZATION.md` | 18 KB | markdown | role_doc | `README.md` | 2026-04-19 | no | keep_in_place | Multi-role matching (site manager / engineer / architect) |

### Catalog data (`backend/data/`)

| path (rel to repo root) | size | content_type | theme | importers | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `URS_MATCHER_SERVICE/backend/data/URS201801.csv` | 1.9 MB / 39,742 rows | CSV catalog | urs_catalog_db, legacy_2018 | `scripts/import_urs_catalog.mjs` | 2026-04-19 | yes (CORE B1_urs_codes) | **move_to_central** | URS catalog 2018-01 snapshot — superseded by CORE B1_urs_codes |
| `backend/data/TSKP_KROS_full.csv` | 2.6 MB / 11,995 rows | CSV catalog | otskp_catalog_db, legacy | `scripts/import_tskp_to_sqlite.mjs` | 2026-04-19 | yes (CORE B1_otkskp 2025 XML supersedes) | **move_to_central** | TSKP/KROS pricing 2018 — newer data lives in CORE |
| `backend/data/TSP201801.csv` | 5.6 MB / 95,977 rows | CSV catalog | price_catalog_db, labor_2018 | price import | 2026-04-19 | yes (CORE B4 has 2026 Berger rates) | **move_to_central** | TSP labor rates 2018 — 7+ years stale |
| `backend/data/CENEKON201801.csv` | 5.8 MB / 105,763 rows | CSV catalog | price_catalog_db, materials_2018 | price import | 2026-04-19 | yes (potentially CORE pricing) | **move_to_central** | CENEKON material/equipment 2018 — 7+ years stale |
| `backend/data/KROS.MDB` | 13 MB | MS Access DB | catalog_db_legacy | `verify-db.js` (rare) | 2026-04-19 | yes | **mark_legacy** | Legacy KROS catalog — replaced by otskpCatalogService XML |
| `backend/data/ImportDB.mdb` | 900 KB | MS Access DB | catalog_db_import_legacy | `import_kros_urs.mjs` | 2026-04-19 | yes | **mark_legacy** | Import staging — obsolete post-SQLite migration |
| `backend/data/tridnik.xml` | 3.2 MB | XML catalog | tov_grouping, profession | `tridnikParser.js` | 2026-04-19 | yes (Registry-backend `tovProfessionMapper.js`, CORE B4) | keep_in_place | Czech Třídník profession/skill taxonomy — canonical for taxonomy |

---

## MinerU service inventory

| path (rel to repo root) | size | content_type | theme | importers | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `mineru_service/main.py` | 185 lines | Python FastAPI | mineru_pdf_parser, cloud_run | Cloud Run entrypoint | 2026-04-19 | no | keep_in_place | Thin HTTP wrapper around `mineru` / `magic-pdf` CLI; called by CORE `pdf_parser.py` as fallback |

MinerU has no domain knowledge of its own — it's a PDF-to-text gateway. Listed here for completeness only.

---

## Hotspots and dangling items (URS_MATCHER)

### Stale 2018 catalogs — `move_to_central` decision

The four CSVs (URS201801, TSKP_KROS_full, TSP201801, CENEKON201801) total **15.9 MB / 253,477 rows** of 2018-01 data. Market prices in TSP and CENEKON are 7+ years old. Productivity norms in URS are mostly stable but URS catalogs have been re-released (CORE has the 2025 OTSKP XML).

**Two clean resolutions:**
- (a) Move all 4 to `concrete-agent/.../knowledge_base/B1_*` as legacy archives + add a 2026 refresh task to backlog
- (b) Delete from URS_MATCHER if confirmed unused, after grep verifies the import scripts no longer run on schedule

### Legacy MS Access DBs

`KROS.MDB` (13 MB) + `ImportDB.mdb` (900 KB) are functionally orphan. Only `verify-db.js` (rarely-run inspection script) and `import_kros_urs.mjs` (ditto) reference them. Recommend `mark_legacy` until next-quarter cleanup.

### `concreteAgentKB.js` and `norms/knowledgeBase.js` overlap with CORE

Both reference / re-implement domain knowledge already in CORE. Since URS_MATCHER is a separate service, full elimination requires either an HTTP path to CORE or a shared npm package. Prioritise discussion in `08`–`10` variants.

---

## Counts (URS_MATCHER + MinerU)

| Bucket | Count |
|--------|-------|
| URS files inventoried with full attributes | 22 (code) + 7 (catalogs) + 4 (docs) = 33 |
| URS LOC (code) | ~25K |
| URS data (catalogs) | ~36 MB |
| MinerU files | 1 |
| Files marked `move_to_central` | 4 (stale CSVs) |
| Files marked `mark_legacy` | 3 (KROS.MDB, ImportDB.mdb, import_kros_urs.mjs) |
| Files marked `merge_with` | 2 (`concreteAgentKB.js`, `norms/knowledgeBase.js`) |
| Cross-zone dup hints | 6+ (OTSKP, URS, ČSN, profession, productivity, pricing) |

---

End of part 1. Continued in `05_inventory_other_part2_repo_root.md`.
