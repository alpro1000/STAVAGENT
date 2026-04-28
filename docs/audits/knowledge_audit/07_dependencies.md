# Gate 4 — Dependency graph + dangling files

**Goal:** sketch which engine consumes which knowledge, identify cycles, and consolidate the master list of dangling (zero-importer) files.

---

## Dependency graph (textual)

Vertical groupings = service. Arrows = "imports / loads / fetches at runtime".

```
                                       ┌──────────────────────────────┐
                                       │  raw norms (PDFs)            │
                                       │  docs/normy/tkp/*.pdf  (33)  │
                                       │  docs/normy/navody/*.pdf (6) │
                                       │  data/peri-pdfs/*.md (extr)  │
                                       └──────────────┬───────────────┘
                                                      │ extract_all_pdfs.py +
                                                      │ MinerU (Cloud Run)
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │  CORE                        │
                                       │  app/knowledge_base/         │
                                       │  ├── B1 OTSKP / RTS / URS    │
                                       │  ├── B2 ČSN + TKP            │
                                       │  ├── B3 prices               │
                                       │  ├── B4 productivity         │
                                       │  ├── B9 equipment            │
                                       │  └── all_pdf_knowledge.json  │
                                       └──┬───────────┬───────────┬───┘
                                          │           │           │
                ┌─────────────────────────┘           │           └─────────────────────────┐
                │                                     │                                     │
                ▼                                     ▼                                     ▼
   ┌──────────────────────┐         ┌──────────────────────────────┐         ┌──────────────────────┐
   │  CORE services       │         │  CORE prompts/roles/         │         │  CORE classifiers    │
   │  position_enricher   │         │  structural_engineer.md      │         │  work_classifier.py  │
   │  norm_advisor        │         │  standards_checker.md        │         │  + rules.yaml        │
   │  resource_calculator │         │  concrete_specialist.md      │         └──────────┬───────────┘
   │  audit_service       │         │  ...                         │                    │
   │  pricing/otskp_engine│         └──────────────────────────────┘                    │
   └──────────┬───────────┘                                                              │
              │                                                                          │
              │  HTTP via MCP / REST                                                     │
              ▼                                                                          ▼
   ┌──────────────────────┐         ┌──────────────────────────────┐         ┌──────────────────────┐
   │  Portal              │         │  Monolit-Planner             │         │  Registry frontend   │
   │  (orchestrator)      │         │  shared/src/calculators/     │         │  (BOQ classification)│
   │  ├── concreteAgent   │◄───────►│  ├── maturity.ts             │         │  ├── classification/ │
   │  │   Client.js       │         │  ├── lateral-pressure.ts     │         │  │   rowClassifier   │
   │  ├── creditService   │         │  ├── element-classifier.ts   │         │  │   V2 + V1 legacy  │
   │  └── universal       │         │  │   (1828 lines, catalog)   │         │  ├── data/           │
   │     Parser           │         │  ├── pile-engine            │         │  │   formwork_kb.json│
   └──────────────────────┘         │  ├── pour-decision           │         │  │   pump_kb.json   │
                                    │  ├── formwork                │         │  │   pump_suppliers │
                                    │  └── ...                     │         │  └── api/agent/     │
                                    │  shared/src/constants-data/  │         │      rules.ts ◄──── DUAL-WRITE
                                    │  └── formwork-systems.ts     │         └──────────────────────┘
                                    └──────────┬───────────────────┘                    │
                                               │                                         │
                                               │  HTTP via Core API                      │ Vercel serverless
                                               ▼                                         ▼
                                    ┌──────────────────────────────┐         ┌──────────────────────┐
                                    │  Core API client modules     │         │  rozpocet-registry-  │
                                    │  Monolit:  coreAPI.js        │         │  backend             │
                                    │            concreteExtractor │         │  (PostgreSQL + sync) │
                                    │  (duplicate functionality)   │         │  schema.sql          │
                                    └──────────────────────────────┘         │  tovProfessionMapper │
                                                                             └──────────────────────┘

   ┌──────────────────────┐
   │  URS_MATCHER         │ ── HTTP ◄── CORE B1_otkskp / B1_urs / B2 (read)
   │  (4-phase pipeline)  │ ── reads ◄── backend/data/*.csv (2018, stale) ── flag move_to_central
   │  ursMatcher.js       │              backend/data/*.MDB (legacy) ── mark_legacy
   │  + cache + LLM       │ ── HTTP ◄── Monolit / Registry callers
   └──────────────────────┘

   ┌──────────────────────┐
   │  MinerU service      │ ── called by CORE pdf_parser.py as fallback
   │  (PDF→text gateway)  │
   └──────────────────────┘
```

---

## Cycles

No true import cycles found at module level. Cross-service couplings exist but are HTTP-mediated (loose coupling):

- Monolit `coreAPI.js` ↔ CORE — HTTP, not import. ✅
- Portal `concreteAgentClient.js` ↔ CORE — HTTP. ✅
- URS_MATCHER `concreteAgentKB.js` ↔ CORE — file-system read of CORE's KB by URS service ⚠ **(this is a path-coupling — if CORE moves, URS breaks silently).**
- Registry frontend ↔ Registry backend — HTTP (sync.ts). ✅ but **rule arrays are dual-written** (B2 finding).

---

## Master dangling-files list (zero importers found)

Consolidated across all 5 inventory files:

### CORE
- `knowledge_base/B5_tech_cards/metadata.json` (9 lines, no content)
- `knowledge_base/B6_research_papers/metadata.json` (9 lines)
- `knowledge_base/B7_regulations/metadata.json` (9 lines)
- `knowledge_base/B8_company_specific/metadata.json` (9 lines)
- `prompts/claude/analysis/quick_preview.txt` (32 lines)
- `prompts/claude/audit/audit_position.txt` (214 lines, superseded by `roles/standards_checker.md`)
- `prompts/claude/generation/generate_from_drawings.txt` (123 lines, Workflow B status unknown)
- `prompts/gpt4/ocr/scan_construction_drawings.txt` (121 lines)
- `prompts/gpt4/vision/analyze_technical_drawings.txt` (205 lines)

### URS_MATCHER (legacy data)
- `backend/data/KROS.MDB` (13 MB)
- `backend/data/ImportDB.mdb` (900 KB)
- `backend/scripts/import_kros_urs.mjs` (200 lines, no scheduled call)

### Registry
- `src/data/concrete_prices.json` (no importers found in grep)

### Repo root + docs
- `docs/archive/legacy/stavagent_architecture_spec.json` (38 KB, pre-v4)
- `docs/archive/legacy/UNIFIED_ARCHITECTURE.md` (19 KB)
- `docs/archive/legacy/UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md` (20 KB)
- `docs/archive/future-planning/PLAN_CABINETS_ROLES_BILLING.md` (24 KB, superseded)
- `docs/archive/future-planning/TASK_TZ_to_Soupis_Pipeline_v3.md` (17 KB, duplicate)
- `docs/archive/future-planning/TASK_VZ_Scraper_WorkPackages_v3.md` (23 KB, duplicate)

### Total

**21 dangling files** across 4 services. ~16 MB cumulative size (dominated by KROS.MDB + ImportDB.mdb in URS).

---

## Dangling but not deletable

Some files are dangling for grep but legitimate — flagged here so they don't end up on a delete list:

- `data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md` — input to **Gate 0** of works-list pipeline (referenced from `INVENTORY_BEFORE_WORKS_PIPELINE.md`)
- `data/peri-pdfs/rimsa_element_spec_v2_DOKA_PERI.md` — input to **Gate 0**
- `test-data/tz/SO-*.md` — golden test inputs, referenced by next-code-touch
- 33 TKP PDFs + 6 vendor PDFs — raw norm sources; only `extract_all_pdfs.py` reads them

---

End of Gate 4. Continued in `08_variant_centralized.md` (Gate 5: architecture variants).
