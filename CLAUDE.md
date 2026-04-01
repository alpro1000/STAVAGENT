# CLAUDE.md - STAVAGENT System Context

**Version:** 4.0.9
**Last Updated:** 2026-04-01
**Repository:** STAVAGENT (Monorepo)

---

## ⚙️ Правила ведения этого файла

> **Этот файл — справочник, а не журнал.** Максимум ~300 строк. Каждая сессия ОБЯЗАНА следовать этим правилам при обновлении CLAUDE.md.

### При завершении сессии — обнови CLAUDE.md по чеклисту:

| Действие | Что именно | Пример |
|----------|-----------|--------|
| **ОБНОВИ** число | Endpoints, Tests, LOC в таблице Totals | `119 → 125` |
| **ОБНОВИ** факт | URL, env var, модель LLM, формула, порт | `gemini-2.5-flash → gemini-2.5-pro` |
| **ДОБАВЬ** строку | Новый subsystem / endpoint group / service | `- **New Subsystem** — краткое описание` |
| **ДОБАВЬ** в TODO | Новый незакрытый долг / баг / ручное действие | `- [ ] Описание задачи` |
| **УДАЛИ** из TODO | Задача выполнена в этой сессии | Убери строку целиком |
| **ОБНОВИ** Version | Инкремент patch при каждом изменении файла | `4.0.0 → 4.0.1` |
| **ОБНОВИ** Last Updated | Текущая дата | `2026-03-31` |

### ЗАПРЕЩЕНО добавлять:

- **Логи сессий** — "Completed (дата): список коммитов" → НЕТ
- **Номера PR/коммитов** — `PR #723`, `commit abc123` → НЕТ
- **Имена веток** — `claude/some-branch-XyZ` → НЕТ
- **Пошаговые описания** что было сделано → НЕТ (для этого есть git log)
- **"Architecture decisions"** из конкретной сессии → НЕТ (если решение важно — обнови секцию Conventions)
- **Дублирование** информации из per-service CLAUDE.md → НЕТ (ссылайся, не копируй)

### Формат записей:

```
ПЛОХО:  "Добавили bedrock_client.py v2.0 с полным каталогом моделей Claude 3/3.5+,
         Nova, Llama, DeepSeek, Mistral, с _detect_provider() который auto-strips
         us./eu./ap. cross-region prefixes..."

ХОРОШО: "- **AWS Bedrock** — multi-provider client (Claude/Nova/Llama/DeepSeek/Mistral)"
```

### Принцип: один факт = одна строка

Если описание подсистемы занимает >2 строк — оно слишком подробное. Детали живут в коде и в per-service CLAUDE.md.

### Контроль размера:

- **Лимит:** 300 строк ± 10%. Если после обновления >330 строк — сократи самую длинную секцию.
- **Приоритет сокращения:** TODO (удали закрытые) → Services (вынеси детали в per-service docs) → Quick Debugging (удали устаревшие).

---

## Quick Reference

```
STAVAGENT/
├── concrete-agent/        ← CORE (Python FastAPI, port 8000)
├── stavagent-portal/      ← Portal/Dispatcher (Node.js/Express/React, port 3001)
├── Monolit-Planner/       ← Kiosk: Concrete Calculator (Node.js/React, port 3001/5173)
├── URS_MATCHER_SERVICE/   ← Kiosk: URS Matching (Node.js, port 3001/3000)
├── rozpocet-registry/     ← Kiosk: BOQ Registry (React/Vite + Vercel serverless, port 5173)
├── shared/                ← Cross-kiosk shared code (icon-registry.ts)
├── mineru_service/        ← MinerU PDF parser (Python FastAPI, Cloud Run europe-west1, port 8080)
├── docs/                  ← System-level documentation
└── .github/workflows/     ← CI/CD
```

**Infrastructure:** Cloud Run (europe-west3) + Vercel + Cloud Build. No Render.

| Service | URL | Custom Domain |
|---------|-----|---------------|
| concrete-agent (CORE) | concrete-agent-1086027517695.europe-west3.run.app | — |
| portal backend | stavagent-portal-backend-1086027517695.europe-west3.run.app | — |
| portal frontend | www.stavagent.cz | www.stavagent.cz |
| Monolit backend | monolit-planner-api-1086027517695.europe-west3.run.app | — |
| Monolit frontend | monolit-planner-frontend.vercel.app | **kalkulator.stavagent.cz** |
| URS Matcher | urs-matcher-service-1086027517695.europe-west3.run.app | **klasifikator.stavagent.cz** |
| Registry backend | rozpocet-registry-backend-1086027517695.europe-west3.run.app | — |
| Registry frontend | stavagent-backend-ktwx.vercel.app | **registry.stavagent.cz** |

**DB:** Cloud SQL PostgreSQL 15 (`stavagent-db`): databases `stavagent_portal`, `monolit_planner`, `rozpocet_registry`

**GCP:** Project `project-947a512a-481d-49b5-81c` (ID: 1086027517695), SA: `1086027517695-compute@developer.gserviceaccount.com`

**LLM Providers:**
| Provider | Models | Auth | Budget |
|----------|--------|------|--------|
| Vertex AI Gemini (primary) | `gemini-2.5-flash` (default), `gemini-2.5-pro` (heavy) | ADC (no API keys on Cloud Run) | $1,000 GCP credits |
| Perplexity AI | sonar (web-search) | `PPLX_API_KEY` in GCP SM | $5,000 credits |
| AWS Bedrock (us-east-1) | Claude 3 Haiku/Sonnet/Opus | `aws-access-key-id` / `aws-secret-access-key` in GCP SM | $20 bonus + $84 Free Tier |

**Note:** `gemini-2.5-flash-lite` returns 404 in europe-west3. Use `gemini-2.5-flash`.

---

## Architecture

```
Portal (Dispatcher) ──┬──→ concrete-agent (CORE: AI, parsing, audit, Multi-Role)
                      ├──→ Monolit-Planner (concrete cost calculator, CZK/m³)
                      ├──→ URS_MATCHER_SERVICE (BOQ→URS code matching)
                      └──→ rozpocet-registry (BOQ classification, Vercel serverless)

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

## Services

### 1. concrete-agent (CORE)
Python FastAPI. **119 endpoints**, **31 test files (81 engine tests)**, **~58K LOC**.
Structure: `packages/core-backend/app/{api,services,classifiers,knowledge_base,parsers,prompts}`

**Subsystems:**
- **Multi-Role Expert** — 4 roles (SME, ARCH, ENG, SUP), parallel validation, consensus
- **Workflows** — A (import/audit), B (drawings), C (hybrid audit+summary)
- **Document Accumulator** — 20 endpoints, multi-document project accumulation
- **Multi-Format Parser v5.0** — `parse_any()`: XLSX Komplet/RTSROZP, XML OTSKP/TSKP, PDF, DXF, images (OCR)
- **Add-Document Pipeline** — 14 auto-detected doc types, versioning, cross-validation, NKB compliance
- **NKB (Normative Knowledge Base)** — 3-layer: Registry (23 norms) → Rules (23 rules) → Advisor (Gemini+Perplexity)
- **NormIngestionPipeline** — L1 PDF→Text → L2 Regex (50+ patterns, conf=1.0) → L3a Gemini (conf=0.7) → L3b Perplexity (conf=0.85)
- **NKB Audit** — 15 external sources (SŽ, PJPK, MMR, ŘSD, ČAS, ÚNMZ), scraping + gap analysis
- **Unified Item Layer** — ProjectItem with 4 namespace blocks (estimate/monolit/classification/core), code detection, position grouping
- **Soupis Assembler** — TZ→work requirements extraction, WP lookup, KROS-compatible XLSX export, drawing notes as input source
- **Scenario B** — TZ upload → element extraction → position generation → CSV export
- **Section Extraction Engine v2** — universal map-reduce: 28 extractors in registry (including výkresy wrapper), AI enrichment per section (Gemini Flash, conf=0.7 < regex conf=1.0), AI merge metrics, negative-context filter (`_safe_search` skips demolition/existing-state matches)
- **Other** — Google Drive OAuth2, PDF Price Parser, Vertex AI Search, Betonárny Discovery, Norms Scraper, Agents, Chat
- **LLM chain** — Vertex AI → Bedrock → Gemini API → Claude API → OpenAI

### 2. stavagent-portal (Dispatcher)
Node.js/Express + React. **~80+ endpoints**, **20 pages**, **40+ components**.

**Route groups:** Auth (15), Portal Projects (10), Portal Files (9), Portal Documents (4), Admin (17), Organizations (10), Service Connections (8), Pump Calculator (15), OTSKP (4), Position Instances (8), Integration (3), CORE Proxy (4), Credits (6), Data Pipeline admin (7), Debug (4)

**Key features:**
- JWT auth (24h), 5 org roles, email verification, IP anti-fraud, disposable email blocking, user bans
- Pay-as-you-go credits: Stripe Checkout, volume discounts, welcome bonus 200 credits, fail-open billing
- Data Pipeline admin tab: Smlouvy → CPV enrichment → Work Packages → Methvin norms scraper
- EngineExtractionsPanel: AI metrics bar, field-level `_source`/`_confidence`, CSV export, empty-domain filter
- CORE proxy: 300s timeout with `headersTimeout=310s`, `requestTimeout=305s`, `keepAliveTimeout=65s`
- Design: Brutalist Neumorphism, monochrome + orange #FF9F1C, BEM

### 3. Monolit-Planner (Kiosk)
Node.js/Express + React. **125 endpoints**, **402 tests**, **~30K LOC**.

Concrete cost calculator: CZK/m³, Excel import, OTSKP codes, AI days suggestion.

**Key formulas:** `unit_cost_on_m3 = cost_czk / concrete_m3`, `kros_unit_czk = Math.ceil(x / 50) * 50`

**Element Planner** (`/planner`): 20 element types (9 bridge + 11 building). 7-engine pipeline: Classifier → Pour Decision → Formwork 3-Phase → Rebar Lite → Pour Task → RCPSP Scheduler → PERT Monte Carlo. Gantt + XLSX export. Back-nav preserves bridge context via `?bridge=` URL param.

**Lateral Pressure** — `lateral-pressure.ts`: p = ρ×g×h×k (ČSN EN 12812), auto-filter formwork by pressure, záběrová betonáž (pour stages by height), shape correction (×1.0–1.8), obrátkovost for repetitive elements.

**Planner UX** — Two modes: Monolit (ordinal days, auto-classify from part_name, TOV mapping to beton+bednění+odbednění+výztuž) / Portal (calendar dates, manual input). Bridge context classifier (pilíř vs sloup). Plan variants save/compare. New part auto-creates 4 positions.

**Other:** Snapshot system (SHA-256), Resource Optimization (grid search), Maturity/Props/Calendar/Pump engines, Normsets (ÚRS/RTS/KROS/Internal), mini-calculators (crane, delivery), TOV prefill from planner.
- **Account Isolation** — `portal_user_id` on projects, optionalAuth middleware (Portal JWT), 403 on cross-account access

Structure: `shared/` (384 tests), `backend/` (60 tests), `frontend/`. Design: Slate Minimal (`--r0-*` CSS vars).

### 4. URS_MATCHER_SERVICE (Kiosk)
Node.js/Express + SQLite. **~45 endpoints**, **159 tests**, **~10K LOC**, **12 SQLite tables**.

**4-phase matching:** File Parsing → Document Analysis → URS Matching (TSKP→OTSKP→LLM) → Composite Works Detection.

**Dual search:** Old (`/api/jobs/text-match`, 36 seed + OTSKP fallback) + New (`/api/pipeline/match`, 17,904 OTSKP + Perplexity).

**Other:** VZ Scraper (Hlídač státu), 9 LLM providers, URS Catalog Harvest (Perplexity), rate limiting.

### 5. rozpocet-registry (Kiosk)
React 19 + Vite + Vercel serverless (`api/`). **12 endpoints**, **0 tests**, **~15K LOC**.

BOQ classification (11 groups), 7-step Import Modal, AI Classification (Cache→Rules→Memory→Gemini), TOV Modal, Formwork/Pump Rental Calculators, Monolit price comparison, Portal deep-linking.

---

## Knowledge Base & AI Prompts

**Knowledge Base:** 42 JSON files (~40MB) in `concrete-agent/knowledge_base/` (B1-B9: codes, standards, prices, benchmarks, tech cards)
**AI Prompts:** 21 files in `concrete-agent/prompts/`. **SQL Schemas:** 23 files across all services.

## Totals

| Service | Endpoints | Tests | LOC |
|---------|-----------|-------|-----|
| concrete-agent | 119 | 31 files | ~58K |
| stavagent-portal | ~80 | 1 file | ~25K |
| Monolit-Planner | 125 | 444 | ~31K |
| URS_MATCHER_SERVICE | ~45 | 159 | ~10K |
| rozpocet-registry | 12 | 0 | ~15K |
| **TOTAL** | **~384** | **635+** | **~138K** |

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
**Git Hooks (Husky):** Pre-commit: 34 formula tests (~470ms). Pre-push: branch + tests validation.

**Key decisions:**
- rozpocet-registry: Vercel serverless backend, Zustand + localStorage
- Monolit: PostgreSQL prod, SQLite dev
- URS Matcher: per-request LLM fallback, SQLite
- concrete-agent: Vertex AI Gemini primary, stateless (projects in Portal DB)
- Portal: central registry linking all kiosks via `portal_project_id`
- Confidence scoring: regex=1.0, OTSKP DB=1.0, drawing_note=0.90, URS matcher=0.80, AI=0.70
- Determinism > AI: if regex can do it, don't use LLM
- Drawing notes = input source into TZ→Soupis pipeline (not standalone feature)
- Lateral pressure: p = ρ×g×h×k (ČSN EN 12812), formwork auto-filter by pressure_kn_m2
- Shape correction: přímý=1.0, zalomený=1.3, kruhový=1.5, nepravidelný=1.8 (independent from difficulty_factor)
- Planner two modes: Monolit (position_id in URL → ordinal days, auto-classify) / Portal (no context → calendar)
- Icons: `lucide-react` only, no emojis in JSX; registry in `shared/icon-registry.ts` (13 categories, ~130 icons)
- Monolit account isolation: Portal JWT shared via `JWT_SECRET` env var, `portal_user_id` column
- Monolit subtypes: beton, bednění, odbednění (Tesař), výztuž, jiné — oboustranné removed
- Passport tab = structured tables only; Shrnutí tab = narrative + topics + risks with mitigation
- Negative context filter: `_safe_search()` in extractor_registry.py, skips stávající/demolition matches

---

## Environment Variables

```env
# concrete-agent
DATABASE_URL=postgresql+asyncpg://...
MULTI_ROLE_LLM=gemini
GEMINI_MODEL=gemini-2.5-flash

# Monolit-Planner
VITE_API_URL=https://monolit-planner-api-1086027517695.europe-west3.run.app
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app
JWT_SECRET=<same as Portal, for account isolation>

# URS_MATCHER_SERVICE
STAVAGENT_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app
LLM_TIMEOUT_MS=90000

# stavagent-portal
VITE_DISABLE_AUTH=true  # local dev only; prod = false
```

---

## Quick Debugging

| Problem | Check |
|---------|-------|
| URS empty results | LLM timeout (90s), AbortController per-provider |
| Monolit wrong calc | `concrete_m3`, `unit_cost_on_m3`, KROS rounding `Math.ceil(x/50)*50` |
| CORE unavailable | Cloud Run status, `/health`, Secret Manager |
| LLM 401/404 | SA role `aiplatform.user`; use `gemini-2.5-flash` (not -lite) |
| send-to-core 500 | CORE returns `project_id` not `workflow_id`; `transactionStarted` guard |
| CORE Cloud Run crash | `monolit_adapter.py` singletons — lazy-init services with required args |
| Monolit 403 on projects | `portal_user_id` mismatch; check JWT_SECRET matches Portal; migration 012 |
| Monolit PUT 500 | Missing `metadata`/`position_number` columns; migration 013 adds them |
| Portal "Failed to fetch" | `ERR_CONNECTION_CLOSED` = Node.js headersTimeout (60s default); server.js sets 310s |
| Wrong izolant_tl_mm | Negative context: `_safe_search()` skips stávající/odstraněno; check extractor_registry.py |

---

## CI/CD

**Cloud Build** (per-service): `cloudbuild-{concrete,monolit,portal,urs,registry,mineru}.yaml` + `triggers/*.yaml`
- Guard step (git diff), Docker build → Artifact Registry, Cloud Run deploy with secrets
- `cloudbuild-mineru.yaml` — MinerU PDF parser, `includedFiles: mineru_service/**` (europe-west1)
- `cloudbuild.yaml` — deploy-all (manual, approval required)
- Region: `europe-west3`, setup: `./gcp/setup-gcp.sh`

**GitHub Actions:** keep-alive (14min pings), monolit-planner-ci, test-coverage, test-urs-matcher

---

## TODO / Backlog

### Manual Actions
- [ ] **MASTER_ENCRYPTION_KEY**: `openssl rand -hex 32` → GCP Secret Manager
- [ ] **Stripe env vars**: configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Secret Manager

### TODO
- [ ] **P1: Deploy** Monolit (migration 013), Portal (timeout), CORE (negative context filter)
- [ ] **P1: Verify prod** — PUT /api/positions → 200, passport no timeout, izolant_tl_mm=180
- [ ] **P2: prechodova_deska** — 21st element type + PODKLADNÍ/STŘÍKANÝ/PŘEDPJATÝ rules
- [ ] **P2: NKB polling backoff** — exponential backoff in NKBAdminPage (3s→6s→12s→30s)
- [ ] **P2: TariffPage → TOV/Portal** — migrate tariff management into Rozpis zdrojů + Portal
- [ ] **P3: Planner E2E** — lateral pressure + záběry on SO-203, Aplikovat → TOV
- [ ] **P3: Gantt calendar** — date axis in Portal mode

### Product Backlog
- [ ] Export Work Packages → PostgreSQL (currently SQLite in URS)
- [ ] IFC/BIM support (needs binaries)

---

## Documentation

Per-service docs: `concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`, `docs/STAVAGENT_CONTRACT.md`
