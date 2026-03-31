# CLAUDE.md - STAVAGENT System Context

**Version:** 3.9.0
**Last Updated:** 2026-03-30
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

| Service | URL | Custom Domain |
|---------|-----|---------------|
| concrete-agent (CORE) | https://concrete-agent-1086027517695.europe-west3.run.app | — |
| portal backend | https://stavagent-portal-backend-1086027517695.europe-west3.run.app | — |
| portal frontend | https://www.stavagent.cz | www.stavagent.cz |
| Monolit backend | https://monolit-planner-api-1086027517695.europe-west3.run.app | — |
| Monolit frontend | https://monolit-planner-frontend.vercel.app | **kalkulator.stavagent.cz** |
| URS Matcher | https://urs-matcher-service-1086027517695.europe-west3.run.app | **klasifikator.stavagent.cz** (Vercel proxy) |
| Registry backend | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app | — |
| Registry frontend | https://stavagent-backend-ktwx.vercel.app | **registry.stavagent.cz** |

**DB:** Cloud SQL PostgreSQL 15 (`stavagent-db`): databases `stavagent_portal`, `monolit_planner`, `rozpocet_registry`

**GCP Project:** `project-947a512a-481d-49b5-81c` (ID: 1086027517695), SA: `1086027517695-compute@developer.gserviceaccount.com`

**LLM:** Vertex AI Gemini (ADC auth, no API keys on Cloud Run). Models: `gemini-2.5-flash` (default, fast), `gemini-2.5-pro` (heavy). Note: `gemini-2.5-flash-lite` returns 404 in europe-west3 despite docs (2026-03-23).
- Budget: **$1,000 GCP credits** (Vertex AI Gemini)

**Perplexity AI** (sonar model, web-search):
- Budget: **$5,000 Perplexity credits**
- Used in: NKB advisor (verify + supplement), document classification (Tier 3b), URS code search (podminky.urs.cz)
- Secrets in GCP SM: `PPLX_API_KEY`
- Wired in: `cloudbuild-concrete.yaml`, `cloudbuild-urs.yaml`

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
Python FastAPI. Central AI: Multi-Role validation (4 roles: SME, ARCH, ENG, SUP), document parsing (PDF/Excel/XML), Knowledge Base (KROS/RTS/ČSN), Workflows A/B/C, Document Accumulator, Google Drive OAuth2, PDF Price Parser, Vertex AI Search, Betonárny Discovery, Norms Scraper, Agents system. **119 API endpoints**, **28 test files**, **~57K LOC**.

Key endpoints: `/api/v1/multi-role/ask`, `/workflow/a/import`, `/api/v1/workflow/c/execute`, `/api/v1/accumulator/*`, `/api/v1/price-parser/parse`, `/api/v1/vertex/search`, `/api/v1/project/{id}/add-document`, `/api/v1/nkb/*`, `/health`

Structure: `packages/core-backend/app/{api,services,classifiers,knowledge_base,parsers,prompts}`, tests in `packages/core-backend/tests/`

**Subsystems (full list):**
- **Multi-Role Expert System:** 4 roles (SME, ARCH, ENG, SUP), parallel validation, consensus scoring
- **Workflows:** A (import/audit), B (drawings), C (hybrid audit+summary)
- **Document Accumulator:** 20 endpoints — multi-document project accumulation, merge, diff
- **Google Drive OAuth2:** 7 endpoints — file listing, import, folder management
- **PDF Price Parser:** 7 sub-parsers (betony, malty, doprava, čerpadla, příplatky, laboratorní, source)
- **Vertex AI Search:** multi-endpoint search across indexed construction data
- **Betonárny Discovery:** 3 endpoints — concrete supplier search by location
- **Norms Scraper:** 6 endpoints — web scraping ÚRS/OTSKP/ČSN catalogs
- **Agents system:** 3 endpoints — agent lifecycle management
- **Chat system:** message management, project-scoped conversations
- **LLM Status:** `/api/v1/llm/status` — provider availability check
- **LLM providers:** Vertex AI (primary) → Bedrock → Gemini API → Claude API → OpenAI
- **Feature flags:** 8 configurable flags in `config.py`

**NKB (Normative Knowledge Base):** 3-layer system for Czech construction norms.
- Layer 1: Registry — 23 norms (ČSN, VTP, TKP, zákon, vyhláška, Eurocode), JSON/PostgreSQL storage, priority hierarchy (zákon=100 > vyhláška=90 > ČSN=70 > TKP=60 > VTP=50)
- Layer 2: Rules — 23 rules (10 RuleTypes: tolerance, formula, deadline, procedure, requirement, recommendation, limit, classification, pricing, format)
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
Node.js/Express + React. Main entry point: JWT auth, project management, file upload, kiosk routing, chat assistant. **~80+ API endpoints**, **20 pages/routes**, **40+ components**.

**Route groups (full list):**
- **Auth:** 15 endpoints (register, login, verify email, forgot/reset password, phone verify, PATCH /me)
- **Portal Projects:** 10 endpoints (CRUD + send-to-core + file upload)
- **Portal Files:** 9 endpoints (upload 50MB max, parse, analyze)
- **Portal Documents:** 4 endpoints (save/load document analyses as JSONB)
- **Admin panel:** 17 endpoints (users, feature flags, usage tracking, audit logs, anti-fraud, banned domains)
- **Organizations:** 10 endpoints (CRUD + invites + role assignment)
- **Service Connections:** 8 endpoints (AES-256-GCM encrypted API keys)
- **Pump Calculator:** 15 endpoints (suppliers, models, accessories, calculate)
- **OTSKP codes:** 4 endpoints (search, lookup by code)
- **Position Instances:** 8 endpoints (unified position identity across kiosks)
- **Integration:** 3 endpoints (batch sync Monolit ↔ Registry, bulk INSERT/UPDATE)
- **CORE Proxy:** 3 routes (passport, price-parser, urs-match → 300s timeout)
- **Credits:** checkout (Stripe), balance, history, pricing, volume discount tiers
- **Debug:** 4 endpoints (dev only, disabled in prod)

**Auth:** JWT (24h expiry), 5 org roles (admin/manager/estimator/viewer/api_client), email verification mandatory, phone verification optional, IP anti-fraud (max 3 reg/IP/24h), disposable email blocking (50+ domains), user ban system.

**Pay-as-you-go credits:** `creditService.js` (atomic deduction), Stripe Checkout, volume discounts (250+ Kč = +15%, 500+ = +20%, 1000+ = +25%), welcome bonus 200 credits, fail-open billing.

DB tables: `users, organizations, org_members, portal_projects, portal_files, kiosk_links, chat_sessions, chat_messages, position_instances, position_templates, position_audit_log, service_connections, operation_prices, credit_transactions, banned_email_domains`

Key routes: `backend/src/routes/{portal-projects,auth,orgs,cabinet,connections,pump-calculator,otskp,credits,portal-documents,integration,core-proxy}.js`

Design: Digital Concrete / Brutalist Neumorphism, monochrome + orange #FF9F1C, BEM (`.c-btn`, `.c-panel`, `.c-card`)

### 3. Monolit-Planner (Kiosk)
Node.js/Express + React. Concrete cost calculator: CZK/m³ metric, Excel import, OTSKP codes, AI days suggestion, Unified Registry, Relink algorithm. **125 API endpoints**, **402 tests** (342 shared + 60 backend), **~30K LOC**.

Critical formulas: `unit_cost_on_m3 = cost_czk / concrete_m3`, `kros_unit_czk = Math.ceil(x / 50) * 50`

Work types: beton (m³), bednění (m²), výztuž (kg), jiné

**Element Planner** (`/planner`): Universal tool for ALL monolithic concrete works (20 element types: 9 bridge + 11 building). 7-engine pipeline: Element Classifier → Pour Decision → Formwork 3-Phase → Rebar Lite → Pour Task → RCPSP Scheduler (DAG) → PERT Monte Carlo. Visual Gantt chart + XLSX export. Design system: CSS variables in `r0.css` (Slate Minimal palette). **Mobile responsive:** sidebar/results stack vertically (≤768px), grids collapse via `.r0-grid-2/3/4` classes.

**Supporting engines:** Maturity, Props, Calendar, Pump, Tariff Versioning

**Snapshot system:** SHA-256 versioning + delta tracking for scenario comparison (side-by-side).

**R0 Deterministic Core** (Phase 6): Pure deterministic calculation routes, no AI dependency.

**Normsets:** 4 defined — ÚRS 2024, RTS 2023, KROS 2024, Internal. Used for price comparison and validation.

**Resource Optimization:** Grid search across crew/set combinations (up to 4 crews, 6 sets), deadline-aware variants.

Structure: `shared/` (formulas + scheduler, 342 tests), `backend/` (Express, PostgreSQL/SQLite, 60 tests), `frontend/` (React)

Design: Slate Minimal — CSS variables (`--r0-*`), zero hardcoded hex colors in planner components

### 4. URS_MATCHER_SERVICE (Kiosk)
Node.js/Express + SQLite. BOQ→URS/OTSKP code matching via AI. **~45 API endpoints**, **159 tests**, **~10K LOC**, **12 SQLite tables**.

**4-phase matching pipeline:**
1. File Parsing & Text Matching (Excel/ODS/CSV)
2. Document Analysis (PDF/DOCX via concrete-agent)
3. URS Matching: TSKP Classification → Candidate Generation → KB Lookup → LLM Re-ranking
4. Composite Works Detection & Technology Rules

**9 LLM Providers:** Claude, Gemini, OpenAI, Bedrock, DeepSeek, Grok, Qwen, GLM, Brave Search. Per-request AbortController, fallback chains per task type.

**Endpoint groups (full list):**
- **Jobs/Text Match:** `/api/jobs/text-match` — local SQLite (36 seed) + OTSKP fallback (17,904) + LLM rerank
- **Unified Pipeline:** 7 endpoints (`/api/pipeline/*`) — match, match-batch, classify, classify-batch, catalogs, match-by-otskp
- **Batch Processing:** 6 endpoints — create, start, pause, resume, status, export (Excel)
- **Technology Calculations:** 3 endpoints — concrete volume, reinforcement estimation, formwork calculation
- **Pricing:** 3 endpoints — price lookup, price comparison, price sources
- **Project Analysis:** 3 endpoints — Multi-Role BOQ analysis (SME/ARCH/ENG roles)
- **Catalog management:** 7 endpoints — OTSKP/TSKP catalogs, versioning, import, stats
- **Settings:** runtime LLM provider switching, model selection
- **URS Catalog Harvest:** 3 endpoints (harvest, status, cancel)

**Search pipeline (dual-mode):**
- Old: `/api/jobs/text-match` → local SQLite (36 seed items) + OTSKP fallback (17,904 items) + LLM rerank
- New: `/api/pipeline/match` → TSKP classify → OTSKP catalog (17,904) + Perplexity/Brave URS search → score/dedup
- Frontend uses dual search: both endpoints called in parallel, results merged

**DA→URS integration (via Portal):**
- Portal proxies: `/api/core/urs-match/*` → URS Matcher `/api/pipeline/*`
- SoupisTab "Podobrat kódy" button: batch-sends positions for OTSKP code matching
- Results shown inline with confidence % and OTSKP prices

**Rate limiting:** 300 req/15min global, 50 match/hr per IP. express-rate-limit.

**OTSKP catalog:** 17,904 items from `2025_03_otskp.xml` (copied from concrete-agent at Docker build time). Word index + prefix index + fuzzy scoring.

**TSKP classification:** 11,991 items from `xmk_tskp_tridnik.xml`, imported at Docker build time into `tskp_items` table.

**Perplexity URS Harvester:**
- `POST /api/urs-catalog/harvest` — starts background harvest (30 TSKP categories → podminky.urs.cz)
- `GET /api/urs-catalog/harvest/status` — poll progress
- `POST /api/urs-catalog/harvest/cancel` — cancel running harvest
- Runs on Cloud Run where `PPLX_API_KEY` is available via Secret Manager
- Also available as CLI: `PPLX_API_KEY=... node scripts/harvest_urs_perplexity.mjs [--resume] [--category N]`

### 5. rozpocet-registry (Kiosk)
React 19 + TypeScript + Vite + Vercel serverless backend (`api/`). BOQ classification into 11 work groups, Excel import/export, AI classification (Cache→Rules→Memory→Gemini), fuzzy search (Fuse.js), pump calculator, Monolit price comparison. **12 serverless endpoints**, **0 tests**, **~15K LOC**.

**7-step Import Modal:** Excel upload → sheet selection → column mapping → preview → validation → classification → confirm import.

**AI Classification Pipeline (4-tier):**
1. Cache: Exact match from previous classifications (instant)
2. Rules: 50+ classification rules, priority 200→50 (`classificationRules.ts`)
3. Memory: User-corrected mappings, learning system for corrections
4. Gemini: AI fallback via Vertex AI ADC

**TOV Modal:** 3 tabs (Labor/Machinery/Materials), resource breakdown per position, profession mapping (Betonář/Tesař/Železář).

**Formwork Rental Calculator:** 35KB component, ČSN EN 13670 curing by element type, multi-supplier (DOKA/PERI/ULMA/NOE).

**Pump Rental Calculator:** 39KB component, real supplier data, multi-supplier comparison.

**Monolit Integration:** Price comparison with variance thresholds (5%/15%/30%), polling service (30s foreground, 2min background), DOV write-back to Portal.

**Portal Integration:** Deep-linking via query params (`?projectId=...&positionId=...`), auto-sync (debounced 5s).

---

## Knowledge Base & AI Prompts

**Knowledge Base (42 JSON files, ~40MB)** in `concrete-agent/knowledge_base/`:
```
B1_otskp_codes/          — OTSKP classification codes
B1_rts_codes/            — RTS price database
B1_urs_codes/            — URS construction codes (3 files)
B2_csn_standards/        — ČSN/TKP standards (6 files: EN 206, TKP 03/17/18/22/24)
B3_current_prices/       — Market prices (14 files: DOKA, PERI, Berger, Frischbeton)
B4_production_benchmarks/ — Productivity rates (8 files: norms, tariffs, formwork)
B5_tech_cards/           — Technical procedures (~300 cards)
B6_research_papers/      — Academic research
B7_regulations/          — Legal/regulatory docs
B8_company_specific/     — Company rules
B9_Equipment_Specs/      — Equipment specs (3 files: cranes, pumps, excavators)
all_pdf_knowledge.json   — 4.3MB consolidated KB from all parsed PDFs
```

**AI Prompts (21 files)** in `concrete-agent/prompts/`:
```
claude/assistant/        — construction_expert.txt, stav_expert_v2.txt
claude/analysis/         — quick_preview.txt
claude/audit/            — audit_position.txt
claude/generation/       — generate_from_drawings.txt
claude/parsing/          — parse_kros_table_xml.txt, parse_vykaz_vymer.txt, parse_kros_unixml.txt
claude/vision/           — analyze_construction_drawing.txt
gpt4/vision/             — analyze_technical_drawings.txt
gpt4/ocr/                — scan_construction_drawings.txt
resource_calculation/    — master_framework.txt, concrete_work.txt, masonry_work.txt
```

**SQL Schemas (22 files):**
- concrete-agent: 2 migrations (google_drive_tables, nkb_tables)
- Portal: 4 files (schema-postgres 33KB, position-instance, unified-project, pump-suppliers)
- Monolit: 12 files (schema-postgres 14KB, migrations 004-011, r0 core 21KB)
- URS: 1 file (schema.sql 13KB)
- Registry: 1 file (schema.sql 2.4KB)
- GCP prod init: 3 files (Portal 16KB, Monolit 32KB, Registry 2.6KB)

## Endpoint & Test Totals

| Service | Endpoints | Tests | LOC (approx) |
|---------|-----------|-------|--------------|
| concrete-agent | 119 | 28 files | ~57K Python |
| stavagent-portal | ~80 | 1 file | ~15K JS + ~10K TSX |
| Monolit-Planner | 125 | 402 (342+60) | ~20K TS + ~10K JS |
| URS_MATCHER_SERVICE | ~45 | 159 | ~10K JS |
| rozpocet-registry | 12 (serverless) | 0 | ~15K TSX |
| MinerU | 3 | 0 | ~500 Python |
| **TOTAL** | **~384** | **590+** | **~137K** |

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

**Completed (2026-03-27, session 4 — Project state persistence + NKB frontend):**
- **Project state persistence (DocumentAnalysisPage):**
  - Save button in meta bar → project picker overlay (create new / select existing)
  - Saves full passport + soupis + project analysis as JSONB in `portal_documents` table
  - Auto-versioning on re-save to same project
  - Load saved analyses from upload zone → saved docs panel (sorted by date)
  - Backend: `requireAuthOrServiceKey` middleware (accepts JWT or X-Service-Key)
- **NKB Compliance tab (`ComplianceTab.tsx`):**
  - Auto-runs NKB advisor check when passport data available
  - Builds context from passport (materials, norms, structure type) → `POST /api/core/nkb/advisor`
  - Displays: compliance score ring (%), pass/warn/violation badges, expandable findings
  - AI analysis section (Gemini) with Perplexity supplement, severity coloring
  - Referenced norms pills, warning items
- **Cross-validation panel (`CrossValidationPanel.tsx`):**
  - Shows in project picker when saving to project that has previous documents
  - Loads latest passport from selected project and compares field-by-field
  - Compares: concrete classes, volumes (2% numeric tolerance), reinforcement, tonnage, structure type, norms
  - Color-coded status: match (green), mismatch (red), new (blue), missing (yellow)
  - Two-step save flow: select project → review cross-validation → confirm save
- **New "Normy (NKB)" tab** in DocumentAnalysisPage (6th tab alongside Passport, Soupis, Audit, Shrnutí, Analýza)

- **Image/Photo OCR (`smart_parser.py` + `routes_passport.py`):**
  - `parse_image()`: converts JPG/PNG/TIFF → PDF via Pillow, then uses existing PDF pipeline
  - Flow: Image → Pillow RGB → temp PDF → pdfplumber → MinerU → memory_pdf fallback
  - Both `/generate` and `/process-project` endpoints accept image extensions
  - Frontend: accept .jpg/.jpeg/.png/.tiff uploads, "Obrázek (OCR)" label, format tags
- **Enhanced document save:**
  - Saves norms, identification, referenced_documents, classification alongside passport content
  - Metadata includes has_norms and has_identification flags for quick filtering
- **DXF parsing (`smart_parser.py`):**
  - `parse_dxf()`: extracts TEXT/MTEXT entities, dimensions, block refs, layer names via ezdxf
  - ezdxf>=1.1.0 added to requirements.txt
  - Both `/generate` and `/process-project` endpoints accept .dxf/.dwg
- **NKB seed data expansion (14→23 norms, 14→23 rules):**
  - Norms: Eurocode 2 (EN 1992-1-1), EC1 (EN 1991-1-1), EC7 (EN 1997-1), PBS (ČSN 73 0810), hydroizolace (ČSN 73 0600), thermal (ČSN 73 0540-2), concrete control (ČSN 73 2400), rebar steel (EN 10080), building reqs (vyhláška 268/2009)
  - Rules: min cover depth, max deflection L/250, max crack width 0.3mm, geotechnical survey, fire REI, thermal U-value, B500B 500MPa, concrete slump test
- **MinerU /parse-image endpoint (v1.1.0):**
  - `POST /parse-image`: accepts JPG/PNG/TIFF → Pillow → PDF → MinerU OCR → markdown
  - Direct image OCR without going through concrete-agent

- **MinerU /parse-image client wiring:**
  - `parse_image_with_mineru()` in mineru_client.py: calls `/parse-image` directly with MIME type mapping
  - SmartParser.parse_image() now: Tier 1 MinerU /parse-image → Tier 2 Pillow→PDF fallback
- **NKB PostgreSQL migration:**
  - `migrations/004_nkb_tables.sql`: nkb_norms + nkb_rules tables, GIN indexes, FTS
  - NormStore: PostgreSQL primary, JSON file fallback (auto-detect, auto-seed)
  - `_load_from_pg()`, `_seed_to_pg()`, `_pg_upsert_norm/rule()` methods
- **Cross-validation via CORE:**
  - `sendToCoreAddDocument()`: fire-and-forget POST /api/core/project/{id}/add-document
  - Server-side cross_validation + norm_compliance returned from CORE pipeline
- **E2E test suite (`test_e2e_pipeline.py`):**
  - 8 tests: health, PDF/XLSX/JPG passport, format rejection, norms/identification extraction, NKB advisor+stats
  - Run with `CORE_URL=http://localhost:8000 pytest tests/test_e2e_pipeline.py -v`

- **NKB admin page (`NKBAdminPage.tsx`):**
  - Route: `/portal/nkb`, lazy-loaded in App.tsx
  - Norms tab: search, priority badges, expandable details (scope, tags)
  - Rules tab: type badges, mandatory markers, parameter values, section references
  - Stats tab: total norms/rules, category/rule-type breakdown
  - Add norm form: inline, with category selector, scope, tags
- **Cloud Build NKB migration:**
  - New `nkb-migration` step in `cloudbuild-concrete.yaml` (after deploy)
  - Runs `004_nkb_tables.sql` via psql (CREATE TABLE IF NOT EXISTS — idempotent)
  - Uses `CONCRETE_DATABASE_URL` from Secret Manager
  - Non-blocking: skips gracefully if DB unavailable

- **NKB rule editor (`NKBAdminPage.tsx`):**
  - Add rule form: rule_id, norm_id (datalist autocomplete), rule_type selector
  - Fields: title, description (textarea), parameter, value, min/max, unit
  - Mandatory checkbox, priority, section_reference, tags
  - Calls POST /api/core/nkb/rules/ingest
- **Security fix (Amazon Q review):**
  - `requireAuthOrServiceKey()` middleware: accepts EITHER JWT OR X-Service-Key (CWE-306)
  - portal-documents endpoint restored with proper auth
- **Version detection fix:**
  - Frontend sends `source_file_id` (filename) for auto-increment versioning
  - SHA-256 `content_hash` in metadata for deduplication
  - `file_size`, classified `document_type` in save payload
- **Offline test suite (`test_offline_extraction.py`, 26 tests):**
  - TestDocumentClassification: 7 tests (silnoproud, statika, geologie, PBŘS, VZT, výkaz, unknown)
  - TestRegexExtraction: 8 tests (norms, ID, concrete, steel, exposure, quantities, refs, PBŘS)
  - TestDocumentComparison: 7 tests (equipment match, cable mismatch, power, IP, cross-domain, coverage)
  - TestNKBSeedData: 4 tests (counts, eurocode, FK integrity)
  - All run WITHOUT live server, DB, or AI API

---

## ⚠️ РУЧНЫЕ ДЕЙСТВИЯ (требуют отчёта)

> **Статус**: НЕ ВЫПОЛНЕНО. Каждый пункт нужно выполнить вручную и отчитаться.

### 1. AWS Bedrock — увеличить квоту RPM
- **Что**: Запросить увеличение RPM для Claude моделей в AWS Console
- **Где**: AWS Console → Bedrock → Model access → Request quota increase
- **Зачем**: ThrottlingException при текущих лимитах нового IAM user
- **Как проверить**: `aws bedrock-runtime invoke-model --model-id anthropic.claude-3-haiku-20240307-v1:0 ...`
- [ ] **Сделано?**

### 2. E2E тесты — запустить на живом сервере
- **Что**: Выполнить `CORE_URL=https://concrete-agent-1086027517695.europe-west3.run.app pytest tests/test_e2e_pipeline.py -v`
- **Где**: Локально или в Cloud Shell (нужен доступ к CORE)
- **Зачем**: 9 тестов (health, PDF/XLSX/JPG passport, norms, identification, NKB advisor, stats)
- **Как проверить**: Все 9 тестов PASS
- [ ] **Сделано?**

### 3. VPC connector для Cloud SQL
- **Что**: Создать VPC connector и подключить Cloud Run к приватной сети
- **Где**: GCP Console → VPC → Serverless VPC Access
- **Команды**:
  ```bash
  gcloud compute networks vpc-access connectors create stavagent-vpc \
    --region=europe-west3 --range=10.8.0.0/28
  ```
  Затем в каждом Cloud Run сервисе добавить:
  `--vpc-connector=stavagent-vpc --vpc-egress=private-ranges-only`
  И отключить публичный IP на Cloud SQL.
- **Зачем**: Безопасность — БД не должна быть доступна из интернета
- [ ] **Сделано?**

### 4. Merge PR → main → Cloud Build deploy
- **Что**: Создать PR из `claude/batch-insert-update-p4L8D` → `main`, merge, дождаться Cloud Build
- **Где**: GitHub → Pull Requests
- **Зачем**: 13 коммитов (project persistence, NKB, image OCR, DXF, cross-validation, E2E tests, NKB admin)
- **Как проверить**: Cloud Build зелёный, все сервисы /health OK
- [ ] **Сделано?**

### 5. NKB PostgreSQL миграция — проверить после деплоя
- **Что**: После merge в main, Cloud Build запустит `004_nkb_tables.sql`. Проверить что таблицы создались.
- **Как проверить**:
  ```sql
  SELECT COUNT(*) FROM nkb_norms;  -- должно быть >= 23
  SELECT COUNT(*) FROM nkb_rules;  -- должно быть >= 23
  ```
- [ ] **Сделано?**

### 6. MASTER_ENCRYPTION_KEY для Service Connections
- **Что**: Сгенерировать ключ и добавить в Secret Manager
- **Команда**: `openssl rand -hex 32` → GCP Secret Manager → `MASTER_ENCRYPTION_KEY`
- **Зачем**: Sprint 2 Service Connections (AES-256-GCM шифрование API ключей)
- [ ] **Сделано?**

---

**Current branch status:**
- `claude/batch-insert-update-p4L8D` — 16 commits (full session 4 work)
- PR #739 merged to main (PR #733 rebased)
- `claude/internationalize-service-y5Ocd` — PR #745 (10 commits, credit system + landing redesign + anti-fraud)

**Completed (2026-03-28, session 5 — Pay-as-you-go + Landing redesign + Anti-fraud):**
- **Pay-as-you-go credit system (full stack):**
  - `creditService.js`: getBalance, canAfford, deductCredits (atomic WHERE credit_balance >= ?), addCredits, getTransactionHistory
  - `credits.js`: volume discount tiers (250+ Kč = +15%, 500+ = +20%, 1000+ = +25%), minimum topup 125 Kč (5 EUR)
  - Stripe Checkout integration (direct API, no SDK), webhook with HMAC-SHA256 signature verification
  - Raw body parsing exception for Stripe webhook path in server.js
  - `quotaCheck.js` rewritten: feature flag → credit check → legacy quota chain, 402 on insufficient credits
  - Credit deduction wired into: core-proxy.js, portal-documents.js, portal-files.js, portal-projects.js
  - Fail-open: billing failures don't block users; charge after success, not before
  - Welcome bonus: 200 credits on registration
  - Frontend: QuotaDisplay (free amount input, live preview, quick buttons 125-5000 Kč, tiers table)
  - Frontend: CreditHistory (paginated transactions), OperationPrices (pricing catalog)
  - Frontend: CreditManagement admin tab (stats, pricing editor, user topup)
  - Schema: operation_prices (15 operations seeded), credit_transactions, credit_balance on users
  - `creditsAPI` in api.ts: getBalance, getPrices, getHistory, getTiers, calculate, checkout
- **Landing page redesign (Variant C):**
  - Two hero product cards: AI Analýza dokumentů + Kalkulátor monolitních prací
  - Both accessible WITHOUT registration (session-only results in browser)
  - "Další nástroje v platformě" section: 5 smaller cards with lock icon → /login
  - Pricing hint section: "200 kreditů zdarma, AI analýza od 10 kr, dobití od 125 Kč"
  - Hero: "Nahrajte dokument — AI udělá zbytek" (concrete value prop)
  - Nav: anonymous → "Vyzkoušet" button → /portal/analysis; authenticated → "Portál"
  - `/portal/analysis` route made public (removed ProtectedRoute wrapper)
  - DocumentAnalysisPage: anonymous users → sessionOnly=true, no API calls, registration CTA button
  - URS references removed from landing (internal term, not user-facing)
  - "Generování seznamu prací" replaces Klasifikátor URS + Registr Rozpočtů on landing
- **User ban system:**
  - Schema: `banned`, `banned_at`, `banned_reason` columns on users table
  - Login: banned users → 403 with reason message
  - Admin PUT /users/:id accepts `banned` + `banned_reason` fields
  - UserManagement.tsx: ban/unban toggle with reason prompt, red BANNED badge, detail panel
- **Disposable email detection:**
  - `banned_email_domains` table with 50 seeded domains (tempmail, guerrillamail, yopmail, mailinator, etc.)
  - Registration blocks emails from banned domains → 400 "Registrace z dočasných e-mailových služeb není povolena"
  - Admin: GET/POST/DELETE /api/admin/banned-domains endpoints
  - AntifraudPanel.tsx: domain management UI (add/remove, pill list)
  - Null safety for email domain extraction (CWE-476 fix)
  - Graceful fallback: if table missing (dev/SQLite), check skipped
- **Build fixes:**
  - ShieldX → ShieldClose (lucide-react ^0.263.1 compat)
  - GitCompareArrows → GitCompare (same)
  - r.category → r.requirement_type (SpecialRequirement type)

**Anti-fraud layers (complete):**
1. IP limit: max 3 registrations per IP per 24h (ipAntifraud.js)
2. Email verification: mandatory before login
3. Disposable email: 50+ domains blocked at registration
4. User ban: admin can block accounts with reason
5. Rate limiting: 5 login attempts/15min, 500 req/15min global
6. Credit system: operations cost credits, session-only mode without credits

**NOT done (next session):**
- Stripe env vars not configured (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) — payments disabled until ready
- No CAPTCHA on registration (add when traffic grows)
- PR #745 not merged to main yet (pending review approval)
- Landing page has no screenshot/demo of analysis result
- No session-only mode for Monolit Planner (external Vercel app)

**Completed (2026-03-28, session 6 — DA→URS integration + URS Matcher fixes):**
- **URS Matcher search fix (root cause):**
  - Root cause: frontend called `/api/jobs/text-match` → `matchUrsItems()` → SQLite `urs_items` (36 seed items only)
  - New pipeline at `/api/pipeline/match` with 17,904 OTSKP items existed but was never connected
  - Fix: `ursMatcher.js` now auto-supplements with OTSKP catalog when local DB returns weak results (conf < 0.7)
  - New `matchUrsItemsOTSKP()` function searches OTSKP via word index + fuzzy scoring
- **Dual-mode frontend search (URS Matcher):**
  - `app.js matchText()`: calls BOTH `/api/jobs/text-match` AND `/api/pipeline/match` in parallel
  - Results merged, deduplicated by code, sorted by confidence
  - TSKP classification badge shown above results
  - Table: added Cena (price) and Zdroj (source) columns
- **DA→URS pipeline integration (Portal):**
  - `core-proxy.js`: `/api/core/urs-match/*` proxy routes to URS Matcher pipeline API
  - Credit check (`urs_match` = 8 credits), auth forwarding, 120s timeout
  - `SoupisTab.tsx`: "Podobrat kódy" button batch-sends positions (10/batch) to URS pipeline
  - OTSKP column with matched codes, confidence %, prices shown inline
  - Progress bar during matching
- **URS Matcher rate limiting:**
  - `express-rate-limit` added: 300 req/15min global, 50 match/hr per IP
  - Applied to `/api/jobs`, `/api/batch`, `/api/pipeline`
  - Portal backend CORS origin added
- **CLAUDE.md updated:**
  - Perplexity AI: $5,000 credits, sonar model, used in NKB/classification/URS search
  - Vertex AI Gemini: $1,000 GCP credits
  - URS Matcher section rewritten with dual pipeline, DA→URS integration, OTSKP catalog details


**Completed (2026-03-28 — Full Codebase Audit):**
- **Full audit of all 5 services** — code vs documentation comparison
- **Endpoint inventory**: ~384 total (concrete-agent 119, Portal ~80, Monolit 125, URS ~45, Registry 12)
- **Test inventory**: 590+ total (Monolit 402, URS 159, concrete-agent 28 files, Registry 0)
- **LOC**: ~137K total across all services
- **CLAUDE.md discrepancy fixes**: Multi-Role 6→4 roles, URS 8→9 LLM providers, Service Connections schema→complete, NKB 14→23 norms/rules
- **Missing features documented**: Betonárny Discovery, Norms Scraper, Agents, Pump Calculator, OTSKP, Unified Pipeline, Batch Processing
- **Documentation inventory**: 95 .md files, 42 KB JSON files (~40MB), 21 AI prompts, 22 SQL schemas
- Full report: `docs/SESSION_2026-03-28_FULL_AUDIT.md`

**Completed (2026-03-29, session 9 — Unified Item Layer + NKB Audit + Monolit Refactor):**
- **Cleanup:** Deleted 54 stale .md files (-13,045 LOC). Root .md: 68 → 10 files.
- **NKB Audit System:**
  - `audit_schemas.py` — DocStatus (5 statuses), DocType (9 types), FoundDocument, GapEntry, SourceSummary, AuditResult
  - `norm_source_catalog.py` — 15 external sources (SŽ, PJPK TP/TKP/VL, MMR právo/ČSN, ŘSD data/směrnice/PPK/metodiky, ČAS, ÚNMZ, ČKAIT, PSP, zákony pro lidi) with priorities ★/★★/★★★
  - `norm_audit_service.py` — httpx+BS4 scrapers for pjpk.rsd.cz/rsd.cz, Perplexity API for SŽ/MMR/ČAS/ÚNMZ, gap analysis vs NKB DB
  - `routes_norm_audit.py` — 5 endpoints: start, status, result (with filters), sources, download-missing
  - `005_norm_audit_tables.sql` — nkb_audit_runs, nkb_found_documents, zdroje[] on nkb_norms
  - Admin UI: "Stav NKB" tab in NKBAdminPage with source summary table, document table (4 filters), download missing section
  - AdminDashboard: new "Normy (NKB)" tab with quick links to NKB pages
- **Unified Item Layer (Core Engine):**
  - `item_schemas.py` — ProjectItem with 4 namespace blocks (estimate, monolit, classification, core), CodeSystem enum (OTSKP/ÚRS/RTS), BulkImportRequest/Response, ItemFilterRequest, UpdateBlockRequest
  - `code_detector.py` — 5-step detection: OTSKP DB lookup (1.0) → regex structure (0.95) → letter prefix (0.90) → price_source hint (0.85) → fallback. Lazy-loads 17,904 OTSKP items from XML.
  - `item_store.py` — 3 operations: bulk_import (atomic, idempotent, identity triple matching, version history), read_items (filters: skupina, code_system, has_monolit, keyword, so_id), update_block (namespace-isolated, core=read-only)
  - `routes_items.py` — POST /api/v1/items/import, GET /{project_id}, PATCH /{item_id}/{namespace}, GET /{item_id}/versions, POST /detect-codes, GET /{project_id}/grouped
  - `006_project_items.sql` — project_items + item_versions tables with JSONB namespace blocks, identity triple UNIQUE, GIN indexes, FTS
  - 23 unit tests (items) — ALL PASS
- **Position Grouper:**
  - `position_grouper.py` — deterministic beton+armatura+opalubka linking: concrete detection (m³ + C?/? regex), inclusion markers (vč. výztuže/bednění), forward scan 3-5 positions, keyword matching
  - CoreMetadata extended: group_role, group_leader_id, group_members, armatura_included, opalubka_included
  - Wired into bulk_import → group_positions() runs automatically
  - 15 unit tests (grouper) — ALL PASS
- **Monolit Planner Refactor:**
  - PlannerPage.tsx: useSearchParams for position context (item_id, bridge_id, part_name, volume_m3, concrete_class), "Aplikovat do pozice" button with save status
  - PartHeader.tsx: "Kalkulátor bednění" → "Rассчитать" (orange #FF9F1C)
  - PositionsTable.tsx: FormworkCalculatorModal removed, button navigates to /planner?bridge_id=X&part_name=Y&position_id=Z&volume_m3=V
  - Gantt date-free when in position context (startDate='' → days only)

**Unified Item Layer Architecture:**
```
POST /api/v1/items/import → bulk import with dedup + code detection + grouping
GET  /api/v1/items/{project} → read with 6 filters (skupina, code_system, has_monolit, keyword, so_id, has_classification)
PATCH /api/v1/items/{id}/{namespace} → namespace-isolated block update (estimate|monolit|classification|core=readonly)
GET  /api/v1/items/{project}/grouped → construction cards (beton + armatura[] + opalubka[])
```

**Namespace blocks:** estimate (Registry), monolit (Monolit), classification (shared), core (read-only, auto-managed)
**Identity triple:** code_system + kod + mj (dedup on reimport)
**Code detection:** OTSKP DB → regex → prefix → price_source → fallback

**Current branch:** `claude/registration-landing-updates-ClXq0` — 9 commits (session 9)

**Next session plan (P3-P7):**
- P3: TOV предзаполнение из калькулятора (PlannerOutput.costs → TOV sections)
- P4: Общий Гантт проекта (all positions with planner data → project timeline)
- P5: Мини-калькуляторы (бетононасос refactor, кран new, доставка new)
- P6: Публичный калькулятор в Portal (/portal/calculator, no auth, dates, download)
- P7: Сценарий Б (ТЗ → состав конструкций → объёмы с чертежей → výkaz výměr)

**Feature roadmap (lower priority):**
- D.1.4 frontend renderers (SilnoproudCard, SlaboproudCard, etc.)
- IFC/BIM support (needs binaries)
- Vitest migration
- Bedrock quota increase + model upgrade to Claude 3.5+
- Landing: add analysis result screenshot/demo
- Landing: add reCAPTCHA when traffic grows
- Stripe: configure env vars when ready to accept payments
- Full URS catalog import: OTSKP done (17,904), Perplexity harvest ready

**Completed (2026-03-28, session 7 — Custom subdomains + Registration UX + Kiosk navigation):**
- **Custom subdomains (DNS + Vercel):**
  - `kalkulator.stavagent.cz` → Monolit Kalkulátor (Vercel, separate project)
  - `registry.stavagent.cz` → Rozpočet Registry (Vercel, separate project)
  - `klasifikator.stavagent.cz` → URS Matcher (Vercel proxy rewrite → Cloud Run, bypasses europe-west3 domain mapping limitation)
  - DNS CNAME records at czechia.com/Zoner, SSL via Vercel Let's Encrypt
  - URL migration: 20+ code files updated from Cloud Run/Vercel URLs to custom subdomains
  - CORS: both old and new origins kept for transition period
- **Registration UX flow (complete rewrite):**
  - Post-registration: full instructional screen (3 numbered steps, email shown, spam hint)
  - "Resend email" button + backend endpoint `POST /api/auth/resend-verification` (deletes old tokens, generates new, prevents email enumeration)
  - Post-verification: auto-redirect to login with 5s countdown, "what awaits you" benefits card
  - `register()` no longer sets auth state — user must verify email first
  - Login page: brand "Monolit Planner" → "StavAgent", dark gradient background
  - Registration note: "200 kreditů zdarma" + back-to-landing link
- **Kiosk navigation — "← StavAgent" back buttons:**
  - Monolit: `PortalBreadcrumb` always visible (was conditional on portal_project context)
  - URS Matcher: back link in header controls (vanilla HTML)
  - Registry: dark back-bar above header (React)
- **Naming cleanup:**
  - "Monolit Planner" → "Kalkulátor rozpočtu" (Header.tsx)
  - "Plánovač elementu" → "Kalkulátor betonáže" (PlannerPage.tsx)
  - Landing: Kalkulátor links to `/planner` directly (not root)
  - Portal: service cards renamed accordingly
- **Resend email service:**
  - `RESEND_API_KEY` in GCP Secret Manager, wired in `cloudbuild-portal.yaml`
  - FROM: `StavAgent <onboarding@resend.dev>` (free tier), FRONTEND_URL: `https://www.stavagent.cz`
  - DNS records for stavagent.cz domain verification (DKIM, SPF, DMARC) — set up in Resend dashboard
  - After domain verified: update to `noreply@stavagent.cz`
- **URS Matcher trust proxy fix:**
  - `app.set('trust proxy', 1)` — fixes `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` and `ERR_ERL_FORWARDED_HEADER`
  - Portal and Monolit already had this setting
- **Vercel project naming:** user renamed `stavagent-backend` → `stavagent-portal`, `stavagent-backend-ktwx` → `stavagent-registry`
- **CLAUDE.md v3.5.0 → v3.6.0:** URL table with custom domains, session 7 notes

**PR #752:** `claude/credit-system-landing-vvnxV` → main (9 commits, 34 files, +769/-535 lines) — ready to merge

**Completed (2026-03-29, session 10 — P3-P7 + SO Cards + Fixes):**
- **P3: TOV предзаполнение из калькулятора:**
  - PlannerOutput.costs → TOV sections (labor/machinery/materials)
  - PlannerPage: "Aplikovat do pozice" button writes planner metadata to position
  - Position context via useSearchParams (item_id, bridge_id, part_name, volume_m3, concrete_class)
- **P4: Общий Гантт проекта (ProjectGantt.tsx):**
  - All positions with planner data → unified project timeline
  - Gantt date-free when in position context (days only)
  - Fix: `bridgeInfo?.name` → `bridgeInfo?.object_name` (TS2339)
- **P5: Мини-калькуляторы (кран + доставка):**
  - `CraneCalcData` + `DeliveryCalcData` interfaces in unified.ts
  - CraneRentalSection + DeliveryCalcSection wired into MachineryTab with real data
  - Auto-persist pattern (same as pump/formwork): `isAutoSaving.current = true; onSave(updatedData)`
  - TOVModal: total cost includes all 5 sources (labor + machinery + materials + formwork + pump + crane + delivery)
  - TOVSummary: shows crane (amber) + delivery (green) cost rows
  - dovWriteBack: crane_rental + delivery_calc in DOV payload
- **P6: Публичный калькулятор в Portal:**
  - `/portal/calculator` route (ProtectedRoute)
  - Service card on PortalPage + LandingPage
- **P7: Сценарий Б (ТЗ → элементы → объёмы):**
  - `routes_scenario_b.py` backend: upload → parse → extract elements → generate positions
  - `ScenarioBPage.tsx` frontend: drag-and-drop upload, AI progress, summary cards, elements table, positions table, CSV export
  - Portal core-proxy: `'scenario-b' → '/api/v1/scenario-b'`
  - Service card "Generátor výkazu výměr" on PortalPage + LandingPage
- **9 SO Card Renderers (D.1.4 + Railway + IGP):**
  - `passport.ts`: 9 TypeScript interfaces (SilnoproudParams, SlaboproudParams, VZTParams, ZTIParams, UTParams, MaRParams, ZelSvrsekParams, ZelSpodekParams, IGPParams)
  - `MergedSO` extended with 9 optional typed params fields
  - `SOCard.tsx`: 9 rendering sections with Czech labels + specialized sub-renderers:
    - Silnoproud: switchboard badges, cable specs
    - Slaboproud: subsystem tags (SCS, PZTS, SKV, CCTV, EPS, AVT) + detail blocks
    - VZT: device grid cards (airflow, heating/cooling kW)
    - ZTI: sewage/rainwater/water sub-blocks + fixtures badges
    - UT: heat source + heating system detail blocks
    - MaR: flat field grid
    - Zel svršek: GPK params + track frame blocks
    - Zel spodek: KPP zones list
    - IGP: probes grid + geology + conclusion
- **Bug fixes:**
  - TS2339 `formwork_area_m2` not on `RebarLiteResult` → use form input only
  - CWE-22 Path Traversal in `routes_scenario_b.py` → extract ext from `safe_name`
  - lucide-react icon imports (CraneIcon/TruckIcon → Truck)

**Branch:** `claude/stavagent-tov-gantt-updates-UL8mV` — 6 commits:
- `01f1c4d` — P3-P7 implementation (15 files, +1790 lines)
- `a401c09` — Fix: Bridge.object_name TS error
- `f3ae823` — Mini-calculator persistence + Scenario B frontend (12 files, +621 lines)
- `2415bd0` — 9 SO card renderers (+616 lines)
- `2851edf` — Fix: TS2339 formwork_area_m2
- `ec0afbe` — Fix: CWE-22 path traversal

**PR #758:** `claude/stavagent-tov-gantt-updates-UL8mV` → main — reviewed by Amazon Q, security fix applied

---

**Completed (2026-03-30, session 11 — VZ Scraper + TZ→Soupis full pipeline):**
- **Hlídač státu Smlouvy API client** (`hlidacSmlouvyClient.js`):
  - HTTP client, rate limiting (1req/10s), retries with backoff, pagination
  - `HLIDAC_API_TOKEN` in GCP Secret Manager, wired in `cloudbuild-urs.yaml`
- **PlainTextContent parser** (`smlouvyParser.js`):
  - 3 parse strategies: tab-separated, space-separated, code-only
  - 30+ work type classifiers (BETON, VYZTUŽ, BEDNĚNÍ, ZATEPLENÍ, OMÍTKY...)
  - 4 code system detectors (URS 9-digit, OTSKP 6-digit, RTS 7-digit, R-codes)
  - Format detection (KRYCÍ LIST, CS ÚRS, Export Komplet, RTSROZP)
- **Smlouvy Collector** (`smlouvyCollector.js`):
  - Search → parse → store pipeline, SQLite tables: rozpocet_source, rozpocet_polozky, collection_runs
  - Batch insert (200/batch), dedup by hlidac_id, progress tracking
  - xlsx download fallback: when PlainTextContent yields <5 positions, downloads xlsx přílohy
- **Příloha Downloader** (`prilohaDownloader.js`):
  - Downloads xlsx/ods/csv from Hlídač státu přílohy URLs
  - Reuses existing `fileParser.js` (no new xlsx parser)
  - Filename-based rozpočet detection (positive/negative keyword filters)
- **Local xlsx import**: `POST /api/smlouvy/import-xlsx` (multer, 50MB max)
- **VVZ API client** (`vvzClient.js`):
  - REST client for api.vvz.nipez.cz (Věstník veřejných zakázek)
  - No auth, 14 CPV subcategories for construction (45*)
  - Search with pagination, item normalization, CPV extraction
- **VZ Enrichment** (`vzEnrichment.js`):
  - Schema migration: CPV/VZ fields on rozpocet_source + vz_metadata table
  - VZ→Smlouva JOIN: by zadavatel IČO or fuzzy name match
  - CPV tagging: enriches collected smlouvy with CPV codes
- **Co-occurrence matrix** (`cooccurrenceBuilder.js`):
  - 4 granularity levels: dil_3, dil_6, full code, work_type
  - Counts pairs per source, calculates frequency
- **Work Package builder** (`workPackageBuilder.js`):
  - Greedy clustering from co-occurrence → Work Packages
  - Item roles: anchor/companion/conditional (Task 17)
  - Alternative variant detection: 3+ detailed URS → souhrnná R-položka (Task 19)
  - AI naming via Gemini Flash (Task 20), graceful fallback
  - CPV correlation from VZ-enriched sources
  - Transaction-safe DB writes (BEGIN/COMMIT/ROLLBACK)
  - Input validation for IN() queries
- **TZ → WorkRequirements extractor** (`tz_work_extractor.py`):
  - L1 regex (conf=1.0): concrete classes, steel, thickness, norms, DN, power, volumes, areas
  - L2 AI (conf=0.70): Gemini Flash paragraph decomposition
  - 28 work type classifiers, paragraph splitter
- **Soupis Assembler** (`soupis_assembler.py`):
  - WP DB lookup → URS code lookup → manual fallback
  - Companion packages: přesuny (all), lešení (facade), odvoz (demolition)
  - HSV/PSV classification, section sorting
- **KROS-compatible xlsx export** (`soupis_exporter.py`):
  - VV formula generation from extracted params
  - 2 sheets: Soupis prací + Rekapitulace
  - 10 columns: P.č.|Typ|Kód|Popis|MJ|Množství|VV vzorec|Cen.soustava|Zdroj|Důvěra
- **API routes**:
  - URS Matcher: 7 smlouvy endpoints + 4 VZ endpoints + 5 WP endpoints = 16 new
  - CORE: 4 soupis endpoints (extract, assemble, generate, export-xlsx)
  - Portal: 7 admin pipeline proxy routes + soupis core-proxy route
- **Data Pipeline admin tab** (`DataPipeline.tsx`):
  - 3-step UI: Collect Smlouvy → CPV Enrichment → Build Work Packages
  - Real-time polling, stats panel, fun Czech waiting messages
  - Admin-only access
- **Bug fixes**:
  - Admin stats 500: `monolith_projects` → `portal_projects`
  - Audit logs 500: try/catch + PostgreSQL datetime syntax
  - NKBAdminPage 429: useRef guard, single fetch on mount
  - ComplianceTab 429: useRef guard, 429 status handling
  - Hardcoded API token removed from docs + .env.example (CWE-798)
  - Amazon Q review: transactions, input validation, error logging, safeJSON
  - Mantra: repo name `alpro1000/concrete-agent` → `alpro1000/STAVAGENT`
- **Tests**: 46 (smlouvyParser) + 13 (workPackages) + 14 (vzEnrichment) + 53 (tz_extraction) = **126 new tests**
- **Docs**: `STAVAGENT_ClaudeCode_Session_Mantra.md`, `SUPPLEMENT_VZ_Sources_vvz_nipez.md`

**Branch:** `claude/urs-import-search-optimization-YFZFF` — 15 commits, PR open

**VZ Scraper task status (38 items):** 35/38 done, 3 deferred:
- ⬜ Export WP → PostgreSQL (сейчас SQLite, миграция после deploy)
- ⬜ Výkresy → textové poznámky (Task 26 — нужен улучшенный PDF extraction)
- ⬜ Строгая MJ валидация (Task 30)

**Completed (2026-03-30, session 12 — Drawing extraction + Universal registry + Output limits fix):**
- **Drawing (výkres) extraction — Layer 2 regex:**
  - ConcreteByElement: per-element specs from drawing legends (ZÁKLADY: C30/37 – XF2, XC2 – CI 0,4 – Dmax 22)
  - Cover extraction (krytí min/jmen), penetration (průsak), SCC, ETICS/KZS
  - Drawing notes PZ/01–PZ/10 with work type classification (7 types)
  - Title block (razítko): stavba, objekt, stupeň PD, měřítko, formát, datum, revize, projektant
  - Norm validation: ČSN EN 206 (min class, max w/c per exposure) + ČSN EN 1992-1-1 (min cover)
  - NK abbreviation → NOSNÁ KONSTRUKCE (+ 7 more aliases: ŽB, OP, PD, ZD, ÚD, MK, KČ)
  - 53 tests — ALL PASS
- **DRAWING_REGISTRY refactor** — data-driven framework:
  - 5 extraction modes: element_value, header_text, field_patterns, collect_all, boolean
  - Adding new extraction type = adding a dict to registry, no new code
- **Portal fixes:**
  - klasifikator.stavagent.cz Vercel proxy: fixed Cloud Run URL (-3uxelthc4q-ey → -1086027517695.europe-west3)
  - LandingPage MORE_TOOLS: logged-in users → /portal (not /login)
  - "Kalkulátor rozpočtu" → "Monolit Planner" (3 files)
- **SLABOPROUD_REGISTRY** — 7 subsystems, 80+ patterns:
  - SCS (10): cable category, frequency, type, rack, fiber, ports
  - PZTS (14): brand+model, keypads, concentrators, PIR, battery, backup, monitoring
  - SKV (7): reader tech, count, doors, EPS integration, locks
  - CCTV (9): cameras, resolution, type, features, VMS, storage, NVR
  - EPS (13): brand+model, bus, 5 detector types, signaling, cable, integrity
  - INT (3): count, type, power
  - AVT (2): scope, preparation type
- **SILNOPROUD_REGISTRY** — 8 subsystems, 35+ patterns:
  - napajeni, rozvadece, ochrana, kabelaz, osvetleni, zasuvky, hromosvod, fve
- **Output limits removed:**
  - AI extraction input: 30K → 200K (Gemini) / 150K (Claude) / 80K (fallback)
  - AI output tokens: 2048/4096 → 16384 (Gemini), 8192 (Claude)
  - PDF pages: first 5 → all pages
  - Regex text: 30K → full text
  - Quantities, warnings, specification — no truncation
- **Section-based map-reduce extraction:**
  - Any document >15K chars → split into sections → separate AI call per section → deep merge
  - Section detection: numbered headers, subsystem labels, CAPS headers, D.x.x sections
  - Fallback: fixed-size chunks (20K + 500 overlap) at paragraph boundaries
  - Deep merge: lists deduplicate, dicts recurse, scalars first-wins
- **Cloud Build fixes:**
  - XAI_API_KEY + DEEPSEEK_API_KEY: removed → restored after secrets added to SM
  - URS: DEEP_SEEK → DEEPSEEK_API_KEY (match SM name)

**Branch:** `claude/urs-import-search-optimization-v2MCi` — 10 commits, 96 tests (53 drawing + 43 slaboproud)

## ЗАДАНИЕ НА СЛЕДУЮЩУЮ СЕССИЮ

### ‼️ ПРИОРИТЕТ 0 — Универсальный extraction engine (НЕ ЗАВЕРШЁН)

**КРИТИЧЕСКАЯ ЗАДАЧА. Начать с этого. Не писать ни строки другого кода пока не готово.**

Создать два файла:

**1. `app/services/extraction_registry.py`** — один словарь ВСЕ типов extraction:
```python
EXTRACTION_REGISTRY = {
    "concrete": {"category": "konstrukce", "patterns": {...}},
    "reinforcement": {"category": "konstrukce", "patterns": {...}},
    "masonry": {"category": "konstrukce", "patterns": {...}},
    "roofing": {"category": "konstrukce", "patterns": {...}},
    "flooring": {"category": "konstrukce", "patterns": {...}},
    "etics": {"category": "izolace", "patterns": {...}},
    "windows_doors": {"category": "konstrukce", "patterns": {...}},
    "sdk": {"category": "konstrukce", "patterns": {...}},
    "waterproofing": {"category": "izolace", "patterns": {...}},
    "zti_kanalizace": {"category": "zti", "patterns": {...}},
    "zti_vodovod": {"category": "zti", "patterns": {...}},
    "vzt": {"category": "vzt", "patterns": {...}},
    "ut": {"category": "ut", "patterns": {...}},
    "silnoproud_*": {"category": "elektro", "patterns": {...}},
    "slaboproud_*": {"category": "elektro", "patterns": {...}},
    "mar": {"category": "mar", "patterns": {...}},
    "gas": {"category": "plyn", "patterns": {...}},
    "fire_safety": {"category": "pbrs", "patterns": {...}},
    "roads": {"category": "doprava", "patterns": {...}},
    "bridges": {"category": "mosty", "patterns": {...}},
    # ... десятки типов
}
```
Consolidate из: SLABOPROUD_REGISTRY, SILNOPROUD_REGISTRY, VZT_PATTERNS, ZTI_PATTERNS,
UT_PATTERNS, ELEKTRO_D14_PATTERNS, PBRS_PATTERNS, BRIDGE_PATTERNS, GTP_PATTERNS,
regex_extractor.py PATTERNS, DRAWING_REGISTRY. Добавить: zdivo, střecha, podlahy,
okna/dveře, SDK, hydroizolace, plynovod, dopravní stavby.

**2. `app/services/extraction_engine.py`** — document-agnostic map-reduce:
```python
class ExtractionEngine:
    def extract(self, text: str) -> Dict:
        sections = self.split_sections(text)  # universal splitter
        for section in sections:
            for extractor_id, config in REGISTRY.items():
                matches = self.run_patterns(section, config["patterns"])
                # merge into results
        return results
```

**Требования к движку:**
- НЕ знает тип документа
- Итерирует ВСЕ extractors на КАЖДУЮ секцию
- Если extractor не matchнул — null, это OK
- Секции: любая нумерация (1., 1.1, a), A., I., II.), CAPS, "короткая строка без точки = заголовок"
- Fallback: чанки 4000-6000 символов с overlap 500
- Merge: confidence tracking, conflict detection, lists concatenate
- Engine ИМПОРТИРУЕТ registry, не наоборот
- Добавление нового типа = запись в registry, engine НЕ МЕНЯЕТСЯ

**3.** Wire engine в `document_processor.py`:
- Layer 2: `engine.extract(text)` вместо хардкод extract_all()
- Результат → в passport + type-specific fields
- Existing 96 tests MUST pass

**Прочитай перед началом:**
- `STAVAGENT_ClaudeCode_Session_Mantra.md` — обязательно
- `app/services/so_type_regex.py` — все существующие паттерны (не дублировать)
- `app/services/regex_extractor.py` — DRAWING_REGISTRY + PATTERNS
- `app/services/document_processor.py` — как wired сейчас

### Приоритет 1 — Merge и deploy
1. Merge `claude/urs-import-search-optimization-v2MCi` → main
2. Cloud Build deploy — проверить /health всех сервисов
3. Проверить slaboproud TZ → загрузить реальный PDF → убедиться что 7 подсистем извлечены

### Приоритет 2 — Инфраструктура
4. Stripe: env vars в Secret Manager
5. VPC connector для Cloud SQL
6. Landing page — скриншот/демо AI-анализа

### Приоритет 3 — Продукт
7. Export WP → PostgreSQL (миграция из SQLite)
8. Deep Links между кисками

---

## Documentation

Each service has its own `CLAUDE.md`/`CLAUDE.MD` with detailed docs. See also:
- `PLAN_CABINETS_ROLES_BILLING.md` — 4-sprint SaaS transformation plan
- `docs/POSITION_INSTANCE_ARCHITECTURE.ts` — Position identity model
- `docs/STAVAGENT_CONTRACT.md` — API contracts
- `Monolit-Planner/CLAUDE.MD` — Monolit detailed docs (v4.3.8)
- `concrete-agent/CLAUDE.md` — CORE detailed docs (v2.4.1)
- `docs/SESSION_2026-03-28_FULL_AUDIT.md` — Full codebase audit (all services, endpoints, discrepancies)
