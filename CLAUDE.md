# CLAUDE.md - STAVAGENT System Context

**Version:** 3.3.1
**Last Updated:** 2026-03-27
**Repository:** STAVAGENT (Monorepo)

---

## Quick Reference

```
STAVAGENT/
├── concrete-agent/        ← CORE (Python FastAPI, port 8000)
├── stavagent-portal/      ← Portal/Dispatcher (Node.js/Express/React, port 3001)
├── Monolit-Planner/       ← Kiosk: Concrete Calculator (Node.js/React, port 3001/5173)
├── URS_MATCHER_SERVICE/   ← Kiosk: URS Matching (Node.js, port 3001/3000)
├── rozpocet-registry/     ← Kiosk: BOQ Registry (React/Vite + Vercel serverless backend, port 5173)
├── docs/                  ← System-level documentation
└── .github/workflows/     ← CI/CD (keep-alive, monolit CI, test coverage, URS tests)
```

**Infrastructure:** Backends on **Google Cloud Run** (europe-west3), frontends on **Vercel**, CI/CD via **Cloud Build**. No Render — всё на GC + Vercel.

| Service | URL |
|---------|-----|
| concrete-agent (CORE) | https://concrete-agent-1086027517695.europe-west3.run.app |
| portal backend | https://stavagent-portal-backend-1086027517695.europe-west3.run.app |
| portal frontend | https://www.stavagent.cz |
| Monolit backend | https://monolit-planner-api-1086027517695.europe-west3.run.app |
| Monolit frontend | https://monolit-planner-frontend.vercel.app |
| URS Matcher | https://urs-matcher-service-1086027517695.europe-west3.run.app |
| Registry backend | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app |
| Registry frontend | https://stavagent-backend-ktwx.vercel.app |

**DB:** Cloud SQL PostgreSQL 15 (`stavagent-db`): databases `stavagent_portal`, `monolit_planner`, `rozpocet_registry`

**GCP Project:** `project-947a512a-481d-49b5-81c` (ID: 1086027517695), SA: `1086027517695-compute@developer.gserviceaccount.com`

**LLM:** Vertex AI Gemini (ADC auth, no API keys on Cloud Run). Models: `gemini-2.5-flash` (default, fast), `gemini-2.5-pro` (heavy). Note: `gemini-2.5-flash-lite` returns 404 in europe-west3 despite docs (2026-03-23).

**AWS Bedrock** (us-east-1, IAM user `stavagent-bedrock`, account 302222526850):
- Confirmed models: `anthropic.claude-3-haiku-20240307-v1:0` ($0.25/1M), `claude-3-sonnet` ($3/1M), `claude-3-opus` ($15/1M)
- Claude 3.5+ models need `us.` prefix for cross-region inference
- Budget: $20 Bedrock bonus (exp 2027-02-09) + $84.28 Free Tier
- Secrets in GCP SM: `aws-access-key-id`, `aws-secret-access-key`
- Wired in: `cloudbuild-concrete.yaml`, `cloudbuild-urs.yaml`

---

## Architecture

```
Portal (Dispatcher) ──┬──→ concrete-agent (CORE: AI, parsing, audit, Multi-Role)
                      ├──→ Monolit-Planner (concrete cost calculator, CZK/m³)
                      ├──→ URS_MATCHER_SERVICE (BOQ→URS code matching)
                      └──→ rozpocet-registry (BOQ classification, browser + Vercel serverless backend)

Flow: User → Portal upload → CORE parse/audit → Kiosk calculate → Portal results
Linking: portal_project_id (UUID) → core_processing_id + kiosk_result_id
```

**Key API contracts:**
```
Portal → CORE:  POST /workflow/a/import (multipart/form-data)
Portal → Kiosk: POST /import (JSON: projectId, positions[])
Kiosk → CORE:   POST /api/v1/multi-role/ask (JSON: role, question, context)
```

---

## Key Features

**TOV Profession Mapping:**
- Betonování → Betonář
- Bednění → Tesař/Bednář
- Výztuž → Železář

**Sync metadata tracking:** Bi-directional sync between Portal ↔ Kiosks (Monolit, Registry) via `position_instance_id` and `portal_project_id`.

**Integration imports:** Default `owner_id=1` for positions imported via integration routes (Portal→Kiosk).

---

## Services

### 1. concrete-agent (CORE)
Python FastAPI. Central AI: Multi-Role validation (6 roles), document parsing (PDF/Excel/XML), Knowledge Base (KROS/RTS/ČSN), Workflows A/B/C, Document Accumulator, Google Drive OAuth2, PDF Price Parser, Vertex AI Search.

Key endpoints: `/api/v1/multi-role/ask`, `/workflow/a/import`, `/api/v1/workflow/c/execute`, `/api/v1/accumulator/*`, `/api/v1/price-parser/parse`, `/api/v1/vertex/search`, `/api/v1/project/{id}/add-document`, `/api/v1/nkb/*`, `/health`

Structure: `packages/core-backend/app/{api,services,classifiers,knowledge_base,parsers,prompts}`, tests in `packages/core-backend/tests/`

**NKB (Normative Knowledge Base):** 3-layer system for Czech construction norms.
- Layer 1: Registry — 14 norms (ČSN, VTP, TKP, zákon, vyhláška), JSON storage, priority hierarchy (zákon=100 > vyhláška=90 > ČSN=70 > TKP=60 > VTP=50)
- Layer 2: Rules — 14 seed rules (10 RuleTypes: tolerance, formula, deadline, procedure, requirement, recommendation, limit, classification, pricing, format)
- Layer 3: Advisor — AI engine (Gemini + Perplexity), deterministic rule matching → LLM analysis → web-search supplement
- Files: `models/norm_schemas.py`, `services/{norm_storage.py, norm_matcher.py, norm_advisor.py}`, `api/routes_nkb.py`
- Endpoints: `GET /norms/search`, `POST /norms/ingest`, `POST /norms/ingest-pdf`, `POST /norms/rules`, `POST /project/{id}/check-compliance`, `POST /advisor`, `GET /stats`

**NormIngestionPipeline:** Full 4-layer PDF extraction pipeline.
- L1: PDF→Text (pdfplumber + MinerU fallback)
- L2: Regex extraction (50+ patterns, confidence=1.0) — 16 NORM, 9 TOLERANCE, 5 DEADLINE, 10 MATERIAL, 5 META, 2 FORMULA patterns
- L3a: Gemini Flash enrichment with "already_extracted" dedup in prompt (confidence=0.7)
- L3b: Perplexity verify (Call 1: norm currency) + supplement (Call 2: missing data) (confidence=0.85)
- Compile: auto-generate NormativeRules from all layers
- Files: `models/extraction_schemas.py`, `services/{regex_norm_extractor.py, norm_ingestion_pipeline.py}`
- Principle: each layer ADDS, never overwrites data with higher confidence

**Add-Document Pipeline:** Multi-format document processing.
- `POST /api/v1/project/{id}/add-document` (multipart/form-data)
- Auto-detects 14 doc types (tz_beton, tz_bedneni, tz_vyztuze, tz_hydro, tz_zemni, tz_komunikace, tz_most, tz_elektro, tz_zti, tz_vzt, tz_ut, soupis_praci, vysledky_zkousek, ostatni)
- For TZ docs with AI: uses full NormIngestionPipeline (L1→L2→L3a→L3b)
- Versioning (auto-diff on re-upload), cross-validation TZ↔Soupis, NKB compliance check
- Files: `api/routes_project_documents.py`, `models/document_schemas.py`

**Multi-Format Parser (v5.0):** `parse_any()` entry point.
- Formats: XLSX Komplet, XLSX RTSROZP, XML OTSKP/TSKP, PDF, IFC (stub), DXF (stub)
- Model: ParsedDocument → ParsedSO → ParsedChapter → ParsedPosition
- Files: `parsers/{universal_parser.py, format_detector.py, xlsx_komplet_parser.py, xlsx_rtsrozp_parser.py}`

### 2. stavagent-portal (Dispatcher)
Node.js/Express + React. Main entry point: JWT auth, project management, file upload, kiosk routing, chat assistant.

**Sprint 1 Cabinets+Roles (complete):** Organizations + org_members tables, 5 roles (admin/manager/estimator/viewer/api_client), orgRole.js middleware, cabinet.js + orgs.js (12 endpoints), PATCH /api/auth/me. Frontend: CabinetPage, CabinetOrgsPage, OrgPage, OrgInvitePage + cabinet/ and org/ components.

**Auth + SaaS (complete):** JWT auth enabled on all routes, seed admin, login/cabinet UI. SaaS admin panel: usage tracking, feature flags, quotas, anti-fraud. ParsePreviewPage for Excel import preview.

**Sprint 2 Service Connections (schema only):** `service_connections` table exists (AES-256-GCM encrypted credentials), needs API endpoints + frontend UI + MASTER_ENCRYPTION_KEY.

DB tables: `users, organizations, org_members, portal_projects, portal_files, kiosk_links, chat_sessions, chat_messages, position_instances, position_templates, position_audit_log, service_connections`

Key routes: `backend/src/routes/{portal-projects,auth,orgs,cabinet}.js`, `backend/src/middleware/orgRole.js`

Design: Digital Concrete / Brutalist Neumorphism, monochrome + orange #FF9F1C, BEM (`.c-btn`, `.c-panel`, `.c-card`)

### 3. Monolit-Planner (Kiosk)
Node.js/Express + React. Concrete cost calculator: CZK/m³ metric, Excel import, OTSKP codes, AI days suggestion, Unified Registry, Relink algorithm, **336 shared tests**.

Critical formulas: `unit_cost_on_m3 = cost_czk / concrete_m3`, `kros_unit_czk = Math.ceil(x / 50) * 50`

Work types: beton (m³), bednění (m²), výztuž (kg), jiné

**Element Planner** (`/planner`): Universal tool for ALL monolithic concrete works (20 element types: 9 bridge + 11 building). 7-engine pipeline: Element Classifier → Pour Decision → Formwork 3-Phase → Rebar Lite → Pour Task → RCPSP Scheduler (DAG) → PERT Monte Carlo. Visual Gantt chart + XLSX export. Design system: CSS variables in `r0.css` (Slate Minimal palette). **Mobile responsive:** sidebar/results stack vertically (≤768px), grids collapse via `.r0-grid-2/3/4` classes.

Structure: `shared/` (formulas + scheduler, 336 tests), `backend/` (Express, PostgreSQL/SQLite), `frontend/` (React)

Design: Slate Minimal — CSS variables (`--r0-*`), zero hardcoded hex colors in planner components

### 4. URS_MATCHER_SERVICE (Kiosk)
Node.js/Express + SQLite. BOQ→URS code matching via AI. 4-phase: Norms Search → Multi-model LLM Routing → Knowledge Base → Learning System. Document extraction pipeline (PDF/DOCX). LLM fallback chain with per-request AbortController. 8 LLM providers configured (Gemini primary via Vertex AI). 159 tests.

### 5. rozpocet-registry (Kiosk)
React 19 + TypeScript + Vite + Vercel serverless backend (`api/`). BOQ classification into 11 work groups, Excel import/export, AI classification (Cache→Rules→Memory→Gemini), fuzzy search (Fuse.js), pump calculator, Monolit price comparison.

---

## Development Commands

```bash
# concrete-agent
cd concrete-agent && npm install && npm run dev:backend  # FastAPI :8000

# stavagent-portal
cd stavagent-portal && npm install && npm run dev  # Express + React

# Monolit-Planner
cd Monolit-Planner/shared && npm install && npm run build
cd ../backend && npm run dev    # Express :3001
cd ../frontend && npm run dev   # React :5173

# URS_MATCHER_SERVICE
cd URS_MATCHER_SERVICE && npm install && npm run dev  # :3001

# rozpocet-registry
cd rozpocet-registry && npm install && npm run dev  # Vite :5173
```

---

## Conventions

**Commits:** `FEAT:`, `FIX:`, `REFACTOR:`, `DOCS:`, `STYLE:`, `TEST:`, `WIP:`

**Branches:** `claude/<task-description>-<random5chars>`

**Git Hooks (Husky):** Pre-commit runs 34 formula tests (~470ms), pre-push validates branch + tests.

**Key decisions:**
- rozpocet-registry: browser + Vercel serverless backend (`api/`), Zustand + localStorage
- Monolit: PostgreSQL prod, SQLite dev
- URS Matcher: per-request LLM fallback
- concrete-agent: Vertex AI Gemini primary (GCP credits, no API keys on Cloud Run)
- Portal: central registry linking all kiosks via `portal_project_id`

---

## Environment Variables

```env
# concrete-agent
DATABASE_URL=postgresql+asyncpg://...
MULTI_ROLE_LLM=gemini
GEMINI_MODEL=gemini-2.5-flash
# On Cloud Run: uses ADC (no GOOGLE_API_KEY needed)
# Local dev: GOOGLE_API_KEY=... or ANTHROPIC_API_KEY=...

# Monolit-Planner
VITE_API_URL=https://monolit-planner-api-1086027517695.europe-west3.run.app
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app

# URS_MATCHER_SERVICE
STAVAGENT_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app
LLM_TIMEOUT_MS=90000

# stavagent-portal
VITE_DISABLE_AUTH=true
```

---

## Quick Debugging

| Problem | Check |
|---------|-------|
| URS empty results | LLM timeout (90s), AbortController per-provider, Multi-Role URL |
| Monolit wrong calc | `concrete_m3` value, `unit_cost_on_m3`, KROS rounding `Math.ceil(x/50)*50` |
| Registry classification | `constants.ts` 11 groups, `classificationRules.ts`, diacritics normalization |
| CORE unavailable | Cloud Run status, `/health`, Secret Manager |
| DB connection | Cloud SQL instance status, `--add-cloudsql-instances` in cloudbuild |
| LLM 401 errors | Vertex AI: check SA role `aiplatform.user`, ADC auth |
| LLM 404 errors | Model not in region: `gemini-2.5-flash-lite` returns 404 in europe-west3 despite docs (2026-03-23). Use `gemini-2.5-flash` |
| send-to-core 500 | CORE returns `project_id` not `workflow_id`; check `transactionStarted` guard in portal-projects.js |

---

## CI/CD

**Cloud Build** (per-service, push to main): `cloudbuild-{concrete,monolit,portal,urs,registry}.yaml` + `triggers/*.yaml`
- Guard step (git diff), Docker build → Artifact Registry, Cloud Run deploy with secrets
- `cloudbuild.yaml` — deploy-all (manual trigger, approval required)
- All triggers: `location: europe-west3`, explicit `serviceAccount`
- Setup: `./gcp/setup-gcp.sh` (APIs, AR repo, secrets, IAM)
- Trigger import: `gcloud builds triggers import --source=triggers/<name>.yaml --region=europe-west3`

**GitHub Actions:** keep-alive (14min pings), monolit-planner-ci, test-coverage, test-urs-matcher

---

## Backlog

**Awaiting user action:**
- MASTER_ENCRYPTION_KEY: `openssl rand -hex 32` → Secret Manager (for Sprint 2 Service Connections)
- Set real API key values in Secret Manager (GOOGLE_API_KEY, ANTHROPIC_API_KEY, etc.)

**Completed (2026-03-22):**
- Cloud Build setup (`setup-gcp.sh`) — done
- Cloud Build triggers imported — active
- CI fix: `test-shared.yml` cache-dependency-path corrected
- Portal: Auth enabled (JWT login, seed admin, cabinet UI, all routes behind auth)
- Portal: SaaS admin panel (usage tracking, feature flags, quotas, anti-fraud)
- Portal: ParsePreviewPage + PortalImportModal → Monolit
- Portal: serviceAuth.js — service-level auth middleware for kiosk↔portal (X-Service-Key)
- Portal: serviceAuth.js — timing attack fix (CWE-208): replaced custom timingSafeEqual with crypto.timingSafeEqual
- Planner: formwork comparison table, scenario snapshots (side-by-side), localStorage persistence
- Planner: bug fixes (negative values, season→temp, total rebar, římsa classification, dilatační spáry)
- Planner: mobile responsive (sidebar+results stack, grids collapse)
- Planner: PERI formwork catalog — 25 systems total (DOKA, PERI, ULMA, NOE, Místní)
- Planner: PERI pricing from offer DO-25-0056409 → KB JSON (B3) + benchmarks (B4)
- Planner: element-classifier updated with PERI system recommendations
- Planner: Monolit CLAUDE.MD refactored (2900→935 lines, sessions archived)
- CORE: formwork_systems_peri.json — 17 variants (DOMINO/TRIO/VARIO) with rental/purchase prices
- Data: parse_peri_pdfs.py — GCS PDF extraction script for PERI brochures

**Completed (2026-03-23):**
- CORE: gemini-2.5-flash-lite 404 fix — switched default to gemini-2.5-flash across all services (17 files)
- CORE: VertexGeminiClient probe call — validates model with real API call before use, class-level cache
- CORE: model fallback chain (GEMINI_MODEL env → flash → flash-lite → pro)

**Completed (2026-03-25):**
- **8 cross-service cleanups:**
  - CORS: removed `onrender.com` from concrete-agent allow_origin_regex
  - Models: gemini-1.5-* → gemini-2.5-flash/pro (passport_enricher, gemini_client)
  - Models: gpt-5-mini → gpt-4o-mini (URS llmConfig.js, .env.example, 9 occurrences)
  - Cleanup: removed Render.com references from portal .env.example files
  - Registry: centralized hardcoded URLs → `src/utils/config.ts` (7 files updated)
  - Portal: extracted `resolveOrgId()` from connections.js → shared middleware in orgRole.js
  - CLAUDE.md: registry = "browser + Vercel serverless backend", 11 groups (was 10)
- **Planner: Resource Optimization engine (always-on):**
  - New `deadline_days` optional input (investor/project deadline)
  - Grid search: tries all crew/set combinations (up to 4 crews, 6 sets) after every calculation
  - Shows up to 5 faster variants sorted by cost: cheapest_faster, fastest, best_for_deadline
  - When deadline set + exceeded: red overrun banner, "Pro splnění termínu" recommendation
  - When no faster variant exists: "aktuální nastavení je optimální"
  - Types: `DeadlineCheckResult`, `DeadlineOptimizationVariant` exported from shared
  - XLSX export includes optimization section
- **Planner: Mobile scroll fix:**
  - Root cause: `#root { height: 100vh; overflow: hidden }` + `.main-layout { overflow: hidden }` blocked mobile scrolling
  - Fix: `#root { min-height: 100vh }` (no overflow), `.main-layout` overflow:hidden only on desktop (≥769px)
  - `.r0-planner-sidebar/.r0-planner-main`: overflow-y: visible on mobile
  - Results panel now scrolls properly on mobile after calculation
- **Build fix:** added `deadline_check` type to local `PlannerOutput` in `exportPlanXLSX.ts`

**Completed (2026-03-26):**
- **Universal Parser v3.0**: Multi-document merge system
  - SO file grouping by filename regex, 3-layer extraction pipeline
  - Priority-based merge with contradiction detection (2% numeric tolerance)
  - BridgeSOParams, GTPExtraction, TenderExtraction, TechnicalExtraction
  - Frontend: ProjectAnalysis tabs, SOCard, CoverageMatrix, ContradictionsList, TenderDashboard
  - `technical` field added to MergedSO for non-bridge/non-GTP universal data
- **Universal Parser v3.1**: Non-bridge SO type expansion (7 new types)
  - New schemas: RoadSOParams, TrafficDIOParams, WaterSOParams, VegetationSOParams, ElectroSOParams, PipelineSOParams, SignageSOParams
  - `so_type_schemas.py` — SO Type Registry with auto-detection by SO number (0xx-8xx ranges + overrides for 180/190)
  - `so_type_regex.py` — Regex patterns for road, DIO, water, vegetation, electro, pipeline extraction
  - `document_processor.py` — 6 new AI prompts (ROAD_TZ, DIO, WATER_TZ, VEGETATION_TZ, ELECTRO_TZ, PIPELINE_TZ)
  - `so_merger.py` — Universal merger: auto-detects SO type, collects type-specific params by priority
  - `MergedSO` expanded: `so_category`, `so_category_label`, 7 new Optional params fields
  - Frontend: 8 new Czech label maps, specialized renderers (pavement layers, phases, closures, detours, species table)
  - Content-based SO type fallback when filename detection fails
- **Universal Parser v3.1.1**: Multi-provider pipeline & flexible detection
  - `document_classifier.py` v1.2.0 — SECTION_ID_PATTERNS (SO, D.x.x, A-F.x, PS, IO), CONSTRUCTION_TYPE_MARKERS (9 categories)
  - New functions: `extract_section_ids()`, `detect_construction_type()`, `is_non_construction_document()`, `classify_document_enhanced()`
  - `provider_router.py` — Task-based LLM routing (TASK_PROVIDER_MAP: classify→Flash, extract→Sonnet, verify→Perplexity)
  - `perplexity_classifier.py` — Tier 3 web-search classification for unknown docs + non-construction summarization
  - `GenericSummary` model for non-construction documents (legal, invoices, correspondence)
  - `MergedSO` expanded: `construction_type`, `section_ids`, `is_non_construction`, `generic_summary`
  - Frontend: GenericSummary interface, CONSTRUCTION_TYPE_LABELS, NONCONSTRUCTION_TYPE_LABELS, renderGenericSummary()
  - SOCard: construction type badge, section IDs display, non-construction summary section
  - **STATUS: Fully wired into pipeline (commit 2).** Integration complete:
    - `document_processor.py`: uses `classify_document_enhanced()`, stores `_last_enhanced_metadata`
    - `passport_enricher.py`: `call_llm_for_task(prompt, task_type)` method routes via provider_router
    - `document_classifier.py`: `classify_document_async()` has Perplexity Tier 3b for unknown docs
    - `so_merger.py`: populates `construction_type`, `section_ids`, `is_non_construction` from file results
    - `routes_passport.py`: passes enhanced metadata (`section_ids`, `construction_type`, `is_non_construction`) through to merger
    - `learned_patterns.py` — Self-learning pattern system:
      - `LearnedPattern` model + `PatternStore` (JSON file-based, atomic writes)
      - `match_learned_pattern()` — Tier 0 lookup (fastest, zero-cost)
      - `learn_from_classification()` — creates patterns from Perplexity + optional LLM supplement
      - `supplement_partial_result()` — fills gaps when Perplexity returns partial info
      - `EnrichmentGap` tracking: knows which fields are missing, who resolved them
      - `needs_review` flag for human verification of low-confidence patterns
      - 4-step cycle: Perplexity (partial) → LLM (supplement) → Human (review) → Rule (Tier 0)
      - Wired into `classify_document_enhanced()` as Tier 0 + into `classify_document_async()` learning hook

**Completed (2026-03-26, session 2 — FULL DAY):**
- **Universal Parser v3.2**: D.1.4 profession support (pozemní stavby)
  - 6 profession schemas: SilnoproudParams, SlaboproudParams, VZTParams, ZTIParams, UTParams, MaRParams
  - `d14_profession_detector.py` — detection by filename + content (NOT by D.1.4.xx number!)
  - 20 elektro regex + VZT/ZTI/UT patterns, 6 AI prompts
- **Universal Parser v4.1**: ZTI/VZT/UT expanded with real-document anchoring (RD Valcha)
  - ZTI: 8 sub-models (Sewerage, Rainwater+Tank, ColdWater, HotWater, PlumbingFixture, UtilityConnection)
  - VZT: 7 sub-models (NaturalVent, ForcedVent, AC, KitchenHood, BathroomFan, GarageVent)
  - UT: 7 sub-models (HeatSource, HeatingSystem, Underfloor, Radiator, Chimney, GarageHeating)
  - 67 regex patterns (26 ZTI + 17 VZT + 24 UT)
- **Universal Parser v4.2**: VZT multi-device (žst. Cheb PDPS anchor)
  - 15 sub-models: DesignParams, DuctSpec, FilterSpec, HumidifierParams, VAVRegulator, FireDamperSpec, InterprofRequirements, AHUDevice, ExhaustFanDevice, SplitCoolingDevice, VZTDeviceUnion
  - 33 regex patterns, D.2.x.x section support, PDPS pd_level
- **Universal Parser v4.3**: Railway svršek + spodek + IGP (SK113-11 Klatovy anchor)
  - ZelSvrsekParams: GPK, TrackFrame, ContinuousWelded, TrackCircuit, TrackSign — 7 sub-models
  - ZelSpodekParams: KPPZone+Layer, Subgrade, FormationLevel, WallZone, SlopeStability — 9 sub-models
  - IGPParams: IGPProbe+Layer, SZZResult, GeologyParams, HydrogeologyParams, LabResult — 9 sub-models
  - 46 regex patterns, 3 AI prompts
- **Universal Multi-Format Parser v5.0**:
  - `parse_any()` entry point in `app/parsers/universal_parser.py`
  - `format_detector.py` — auto-detects: XLSX Komplet, XLSX RTSROZP, XML OTSKP/TSKP, PDF, IFC, DXF
  - `xlsx_komplet_parser.py` — Export Komplet (D/K/PP/VV row types)
  - `xlsx_rtsrozp_parser.py` — #RTSROZP# (POL1_1/SPI/VV row types)
  - `models.py` — ParsedDocument → ParsedSO → ParsedChapter → ParsedPosition
  - **Connected to existing DocumentSummary flow**: both `/generate` and `/process-project` now return `soupis_praci` field alongside passport
- **OTSKP Price Engine**:
  - `app/pricing/otskp_engine.py` — OTSKPDatabase, OTSKPSelector (kolej 49E1 variant selection), RailwayPriceEngine
  - Composite detection: 528xxx = rails+sleepers+fastening in one price
  - TSKP↔OTSKP bridge mapping
- **URS Matcher integration**:
  - `POST /api/pipeline/match-by-otskp` endpoint with composite detection
  - `otskpToUrsSearch.prompt.js` — OTSKP→URS conversion prompt
- **MinerU Microservice** (standalone Cloud Run):
  - `mineru_service/main.py` + `Dockerfile` + `cloudbuild-mineru.yaml`
  - Extracted from concrete-agent requirements → build time 30min→5min
  - `app/parsers/mineru_client.py` — HTTP client with Google Cloud ID token auth
  - Wired into SmartParser fallback chain: pdfplumber → MinerU HTTP → memory_pdf
  - **Deployed**: mineru-service-1086027517695.europe-west1.run.app
  - **IAM configured**: concrete-agent SA has roles/run.invoker
  - **ENV set**: MINERU_SERVICE_URL in concrete-agent Cloud Run
- **Portal frontend**:
  - `SoupisPanel.tsx` — file upload → ParsedDocument table (in Portal, NOT Monolit)
  - `DocumentSummary.tsx` — added Soupis prací section (5th view alongside passport)
  - `PortalPage.tsx` — new service card "Soupis prací"
  - `core-proxy.js` — added 'parse' route mapping
- **Monolit-Planner** — cleanup:
  - Removed SoupisTab from MainApp (moved to Portal)
  - Soupis backend routes + DB migration created but may not be needed
- **Infra fixes**:
  - Cloud Build timeout 1800→3600s + Docker layer caching
  - `openai==1.54.3` → `openai>=1.54.3,<3` (mineru compat)
  - datetime import fix in routes_passport.py (Portal HTTP 500)

**Architecture decisions (session 2):**
- **Path B**: new universal_parser lives alongside old SmartParser — no production breakage
- **Soupis in Portal**: NOT in Monolit (concrete calculator ≠ soupis prací)
- **MinerU as microservice**: separate Cloud Run, scale-to-zero, 4GB RAM
- **concrete-agent stateless**: projects live in Portal DB, not concrete-agent

**PR #723**: `claude/cross-service-cleanup-integration-7kY7b` → main (17 commits, 39 files, +6208 lines)

**Sprint 2 status:** Service Connections API + frontend + encryption — ALREADY COMPLETE (found in previous sessions)
**Position write-back status:** ALREADY COMPLETE (portalWriteBack.js, dovWriteBack.ts exist)

**Completed (2026-03-27):**
- **Add-Document Pipeline (PR #726):**
  - `POST /api/v1/project/{id}/add-document` — multi-format upload (PDF/Excel/XML)
  - 14 auto-detected doc types, versioning with auto-diff, cross-validation TZ↔Soupis
  - Gemini AI enrichment for TZ docs (materials, volumes, risks, standards, key_requirements)
  - Portal frontend: ProjectDocuments.tsx with upload zone, AI toggle, results display, cross-validation panel
  - core-proxy.js: `'project' → '/api/v1/project'` route mapping
- **Security fixes (Amazon Q review):**
  - Filename injection (CWE-22): `Path(self.filename).name`
  - Temp file leak: `tmp_path = None` guard + exists() check
  - Division by zero: `old_val != 0`
  - UnboundLocalError: tmp_path guard
  - Missing directory: `mkdir(parents=True, exist_ok=True)`
- **Thread-safe MinerU client:** `threading.Lock()` with double-checked locking for `_cached_token`
- **NKB v1.0 (Normative Knowledge Base):**
  - 3-layer system: Registry (14 norms) → Rules (14 rules) → Advisor (Gemini+Perplexity)
  - `norm_schemas.py` — NormCategory(13), RuleType(10), NormScope, NormativeDocument, NormativeRule, ComplianceReport
  - `norm_storage.py` — JSON storage + seed data (ČSN 73 6244, ČSN EN 206, zákon 183/2006, VTP ZP/09/24, etc.)
  - `norm_matcher.py` — deterministic rule matching by construction_type + phase + materials + keyword search
  - `norm_advisor.py` — Gemini analysis + Perplexity supplement, structured AdvisorResponse
  - `routes_nkb.py` — 10 endpoints (search, ingest, ingest-pdf, rules, compliance, advisor, stats)
  - Wired into add-document pipeline: auto norm_compliance section in project.json
- **NormIngestionPipeline v1.0:**
  - `extraction_schemas.py` — ExtractionSource, ExtractedValue (per-value confidence), ExtractionResult
  - `regex_norm_extractor.py` — 50+ patterns: 16 NORM, 9 TOLERANCE, 5 DEADLINE, 10 MATERIAL, 5 META, 2 FORMULA
  - `norm_ingestion_pipeline.py` — L1→L2→L3a→L3b orchestrator with confidence tracking
  - Gemini prompt includes "already_extracted" JSON to prevent duplication
  - Perplexity: separate verify (Call 1) + supplement (Call 2)
  - `POST /norms/ingest-pdf` — multipart endpoint with auto_save option
  - `_parse_pdf_async` uses full pipeline for TZ docs when AI enabled
- **Type annotation fix:** `_call_gemini_advisor` return type corrected to `Tuple[Optional[Dict], Optional[str]]`

**Completed (2026-03-27, session 2 — AWS Bedrock + Portal cleanup + Bug fixes):**
- **AWS Bedrock multi-provider integration (concrete-agent + URS Matcher):**
  - `bedrock_client.py` v2.0: full model catalog (Claude 3/3.5+, Nova, Llama, DeepSeek, Mistral)
  - `_detect_provider()` auto-strips `us./eu./ap.` cross-region prefixes
  - `_build_request_body()` / `_parse_response()` for each provider format
  - `BedrockClient` class with `.call()` + `.acall()` (async)
  - `config.py`: `us-east-1` region, `BEDROCK_FAST_MODEL`, `BEDROCK_HEAVY_MODEL`
  - `provider_router.py` v2.0: Bedrock in all `TASK_PROVIDER_MAP` chains
  - `detect_available_providers()` checks AWS credentials
  - URS `llmConfig.js`: Bedrock = 9th provider, fallback chains updated, 5 Bedrock model pricings
  - URS `llmClient.js`: `callBedrockAPIWithClient()` via `@aws-sdk/client-bedrock-runtime`
  - Secrets in GCP Secret Manager: `aws-access-key-id`, `aws-secret-access-key`
  - Wired in `cloudbuild-concrete.yaml` + `cloudbuild-urs.yaml`
- **Portal cleanup — 5 duplicate service cards removed:**
  - Removed: Audit projektu, Akumulace dokumentů, Shrnutí dokumentu, Náhled výkazu, Soupis prací
  - Added: single "Analýza dokumentů" card (opens unified DocumentAnalysis modal)
  - 15 cards → 12 cards (clean, grouped: Analýza / Kalkulace / Klasifikace / Připravujeme)
  - Removed unused imports/state: ProjectDocuments, ParsePreviewModal, showDocumentsModal
- **Critical bug fix — 40+ cascading 500 errors eliminated:**
  - Root cause: `SELECT column FROM table LIMIT 0` aborts PostgreSQL transactions when column missing
  - ROLLBACK/BEGIN cycles discarded all prior INSERTs → cascading failures
  - Fix: replaced with `information_schema.columns` queries (never abort transactions)
  - Fixed: `/api/integration/import-from-registry` (40+ errors) + `/api/integration/import-from-monolit` (5+)
- **CORE proxy timeout increased 120s → 300s:**
  - Fixes 504 timeouts on `/api/core/passport/process-project` and `/api/core/price-parser/parse`
- **Security: DISABLE_AUTH=true → false in production:**
  - `cloudbuild-portal.yaml`: auth was bypassed, all API ran as mock admin
  - Added `SERVICE_TOKEN` secret to portal cloudbuild
- **Added `/api/health` endpoint** (alias for `/health`)
- **`.env` files created** for local dev (concrete-agent + URS Matcher) with AWS credentials

**Technical debt / TODO (next session):**
1. **FRONTEND REWRITE**: DocumentSummary.tsx 1700+ lines → unified "Analýza dokumentů" module with NKB tab
2. **NKB Frontend**: norm compliance findings, advisor recommendations, ingestion pipeline results
3. **Batch INSERT refactor**: integration imports use per-row INSERT (1000 items = 1000 queries), need bulk inserts
4. **Dead files cleanup**: SoupisTab.tsx, UrsClassifierDrawer.tsx, ProjectDocuments.tsx (now unused)
5. **AWS Bedrock Service Quota**: request RPM increase for Claude models (ThrottlingException on new IAM user)
6. **Private DB connection**: Cloud SQL uses public IP, need VPC connector for security
7. **E2E testing**: upload real XLSX + PDF through Portal → verify full pipeline
8. **MinerU CLI fix**: `_detect_cli()` needs merge + redeploy
9. **NKB seed data expansion**: add more ČSN norms, TKP rules
10. **PostgreSQL migration for NKB**: JSON storage → PostgreSQL tables

**Completed (2026-03-27, session 3 — send-to-core 500 fix):**
- **FIX: send-to-core HTTP 500 (portal-projects.js + portal-files.js):**
  - Root cause 1: CORE Workflow C returns `project_id`, portal read `coreResult.workflow_id` (undefined → NULL in DB)
  - Fix: `coreResult.project_id || coreResult.workflow_id || id` fallback chain
  - Root cause 2: `ROLLBACK` called without `BEGIN` when CORE HTTP call failed before transaction start
  - Fix: `transactionStarted` boolean guard, safe ROLLBACK with try-catch
  - Affected: `POST /:id/send-to-core` (portal-projects.js) + `POST /:fileId/analyze` (portal-files.js)

**Current branch status:**
- `claude/fix-send-to-core-500-mQ7Sf` — 1 commit (send-to-core 500 fix)
- `claude/thread-safe-mineru-client-AnXHZ` — 8 commits (Bedrock + portal cleanup + bug fixes)
- `claude/universal-parser-railway-iYmQk` — merged (7 commits, add-document + NKB + ingestion pipeline)
- `claude/cross-service-cleanup-integration-7kY7b` — PR #723 merged

**Completed (2026-03-27, session 3 — PR #733):**
- **Batch INSERT/UPDATE** in `integration.js`:
  - import-from-monolit: 1 batch SELECT + batch INSERT (N/200 queries instead of 2N)
  - import-from-registry: 1 batch SELECT + batch INSERT (N/200 queries instead of 2N)
  - sync-tov: batch UPDATE via FROM VALUES (N/200 queries instead of N)
  - UPSERT logic preserved: existing positions updated individually for position_instance_id stability
- **Vertex AI ADC for all services** — all 4 Cloud Run services now use GCP $1000 bonus:
  - Monolit-Planner: formwork-assistant.js switched to Vertex AI ADC (was API key → AI Studio)
  - rozpocet-registry: gemini.ts + ai-agent.ts switched to Vertex AI ADC (was gated by USE_VERTEX)
  - Auto-resolve project_id from Cloud Run metadata when env var not set
- **Frontend cleanup** — removed 5718 lines of dead code:
  - DocumentSummary.tsx (1690 LOC), ParsePreviewModal.tsx (860 LOC), ProjectDocuments.tsx (1453 LOC) — all replaced by DocumentAnalysis module
  - DocumentAnalysis.tsx modal (625 LOC) — replaced by DocumentAnalysisPage (/portal/analysis)
  - AI_MODELS/AI_MODEL_OPTIONS (83 LOC) — model auto-selected by backend
- **URS Matcher package-lock.json** regenerated (npm ci was failing after @aws-sdk/client-bedrock-runtime addition)
- **Redundant ternary fix** in DocumentAnalysisPage (analysis_mode always 'adaptive_extraction')
- **Universal extraction pipeline v3.3** — extend existing services (NOT new pipeline/ module):
  - `regex_extractor.py`: +87 LOC — _extract_norms() (9 regex: ČSN/zákon/vyhláška/TKP/Eurocode), _extract_identification() (stavba/investor/místo/projektant/datum), extract_referenced_documents() (6 regex: "viz příloha"/"dle posudku"), extract_pbrs() (10 regex: SPB/REI/CHÚC/EPS/SHZ/ZOKT/fire distance)
  - `document_classifier.py`: +5 LOC — FVE/silnoproud/střídač/hromosvod added to pozemní_TZB markers
  - `smart_parser.py`: +69 LOC — parse_docx() (python-docx → text+tables), parse_csv() (auto-detect separator)
  - `document_processor.py`: +12 LOC — DOCX/CSV text fed to Layer 2 regex, PBRS extraction wired
  - `passport_schema.py`: +5 LOC — norms, identification, referenced_documents fields in response
- **Frontend results display** — DocumentAnalysisPage.tsx:
  - Classification badge (doc type + confidence% + method) in orange
  - Identification card (white background for readability: stavba, investor, místo, projektant)
  - Norms pill list (compact, max 20 shown)
  - Referenced documents section (orange warning: potentially missing docs)
  - "0 pozic" no longer shown for TZ documents (only when > 0)
- **Architecture decision**: deleted app/pipeline/ (1759 LOC unused duplication) — all functionality extends existing app/services/

**Technical debt / TODO (next session):**
1. **Project state persistence**: Wire `portal_documents` table (already exists in Portal DB) for saving passport results. Add save button to DocumentAnalysisPage. Currently passports are in-memory only (lost on restart).
2. **Cross-validation wiring**: When uploading to existing project (project_id), compare new document against previously saved documents. so_merger.py already exists (496 LOC), needs per-document invocation via portal_documents lookup.
3. **NKB Frontend**: Display norm compliance findings, advisor recommendations in Portal
4. **Image/Photo OCR**: Wire MinerU client for .jpg/.png/.tiff uploads (client exists, routing missing)
5. **DXF support**: Add ezdxf extraction to smart_parser.py (ezdxf not in requirements yet)
6. **Testing**: Upload real XLSX + PDF through Portal → verify norms, identification, PBRS in response
7. **NKB seed data expansion**: add more ČSN norms (EN 1992 Eurocode 2, ČSN 73 0210, ČSN 73 2400)
8. **PostgreSQL migration for NKB**: current JSON storage → PostgreSQL tables for production scale
9. **Bedrock testing**: AWS Bedrock integration written but not tested (ThrottlingException — need quota increase)

**Current branch status:**
- `claude/merge-mineru-client-pr-Ot0ri` — PR #733, 8 commits (batch INSERT + Vertex AI + frontend cleanup + extraction pipeline v3.3)
- PR #731 merged to main (thread-safe MinerU + Bedrock + portal cleanup)

**Feature roadmap:**
- Project state in Portal DB (project.json concept via portal_documents table)
- Cross-validation between uploaded documents (fact matching + contradiction detection)
- NKB compliance visualization in Portal
- OTSKP price visualization in soupis
- D.1.4 frontend renderers (SilnoproudCard, SlaboproudCard, etc.)
- DWG/IFC/BIM support (P3 — needs binaries)
- NKB PostgreSQL migration + admin UI for norm/rule management
- Deep Links
- Vitest migration
- Bedrock quota increase + model upgrade to Claude 3.5+

---

## Documentation

Each service has its own `CLAUDE.md`/`CLAUDE.MD` with detailed docs. See also:
- `PLAN_CABINETS_ROLES_BILLING.md` — 4-sprint SaaS transformation plan
- `docs/POSITION_INSTANCE_ARCHITECTURE.ts` — Position identity model
- `docs/STAVAGENT_CONTRACT.md` — API contracts
- `Monolit-Planner/CLAUDE.MD` — Monolit detailed docs (v4.3.8)
- `concrete-agent/CLAUDE.md` — CORE detailed docs (v2.4.1)
