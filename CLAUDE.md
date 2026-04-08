# CLAUDE.md - STAVAGENT System Context

**Version:** 4.8.0
**Last Updated:** 2026-04-08
**Repository:** STAVAGENT (Monorepo)

---

## Правила ведения этого файла

> Справочник, не журнал. Лимит ~300 строк. Один факт = одна строка.

**При завершении сессии:** обнови числа (Endpoints/Tests/LOC), факты (URL/env/модель), Version+Date. Добавь новые subsystem/TODO. Удали закрытые TODO.

**ЗАПРЕЩЕНО:** логи сессий, номера PR/коммитов/веток, пошаговые описания, дублирование per-service CLAUDE.md.

**Сокращение при >330 строк:** TODO (закрытые) → Services (детали в per-service) → Quick Debugging (устаревшие).

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
└── .github/workflows/     ← CI/CD
```

**Infrastructure:** Cloud Run (europe-west3) + Vercel + Cloud Build. **No Render.**

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

**DB:** Cloud SQL PostgreSQL 15 (`stavagent-db`): `stavagent_portal`, `monolit_planner`, `rozpocet_registry`
**GCP:** Project `project-947a512a-481d-49b5-81c` (ID: 1086027517695), SA: `1086027517695-compute@developer.gserviceaccount.com`

| LLM Provider | Models | Auth | Budget |
|-------------|--------|------|--------|
| Vertex AI Gemini (primary) | `gemini-2.5-flash` (default), `gemini-2.5-pro` (heavy) | ADC | $1,000 GCP |
| Perplexity AI | sonar (web-search) | `PPLX_API_KEY` in GCP SM | $5,000 |
| AWS Bedrock (us-east-1) | Claude 3 Haiku/Sonnet/Opus | GCP SM secrets | $20 + $84 Free Tier |

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
Python FastAPI. **120 endpoints**, **34 test files**, **~61K LOC**.
Structure: `packages/core-backend/app/{api,services,classifiers,knowledge_base,parsers,prompts}`
KB: 42 JSON files (~40MB), 21 prompt files, 23 SQL schemas.

**Subsystems:** Multi-Role Expert (4 roles), Workflows A/B/C, Document Accumulator (20 ep), Multi-Format Parser v5.0 (XLSX/XML/PDF/DXF/OCR), Add-Document Pipeline (14 doc types), NKB 3-layer, NormIngestionPipeline (chunked: L1→chunk→per-chunk[L2+L3a]→merge→L3b), NKB Audit (15 sources), Unified Item Layer, Soupis Assembler, Scenario B, Section Extraction Engine v2 (28 extractors, negative-context filter), Calculator Suggestions (fact→param mapping, warnings, conflicts, write-through persistence), Chunked Extraction (document_chunker + parsed_document_adapter + extraction_to_facts_bridge), Drive OAuth2, Agents, Chat.
- **LLM chain** — Vertex AI → Bedrock → Gemini API → Claude API → OpenAI
- **Confidence** — regex=1.0, OTSKP DB=1.0, drawing_note=0.90, Perplexity=0.85, URS=0.80, AI=0.70

### 2. stavagent-portal (Dispatcher)
Node.js/Express + React. **~80+ endpoints**, **20 pages**, **40+ components**.
JWT auth (24h), 5 org roles, Stripe credits (fail-open), Data Pipeline admin, CORE proxy (300s timeout, headersTimeout=310s).
Design: Brutalist Neumorphism, monochrome + orange #FF9F1C, BEM.
- **Landing page v2.0** (`LandingPage.tsx`, 622 lines): 12 sections (Nav→Hero→Social proof→Pro koho→5 Modulů→Jak to funguje→Blok důvěry→Příklad→Technologie→Ceník→FAQ→Footer). H1: "Stavební rozpočty a dokumentace pod kontrolou". Credit pricing table (15 ops). FAQ accordion (8 Q&A).
- **SEO:** `index.html` has og:title, og:description, canonical, twitter card. Title matches AI-last philosophy.
- **Credit system:** `add-credit-system.sql` seeds 15 operation prices (2–20 credits). 200 free on registration, 1 Kč = 10 credits.

### 3. Monolit-Planner (Kiosk)
Node.js/Express + React. **128 endpoints**, **548 tests**, **~33K LOC**.
Structure: `shared/` (465 tests), `backend/` (83 tests), `frontend/` (0 tests). Design: Slate Minimal (`--r0-*`).
**DB:** 44 tables. **Frontend:** PlannerPage (Part B) = 21 useState, NO AppContext. React Router v7.9.5, Vite 5.0.11.

- **Calculator:** CZK/m³, `unit_cost_on_m3 = cost_czk / concrete_m3`, `kros_unit_czk = Math.ceil(x/50)*50`
- **Element Planner:** 22 types (11 bridge + 11 building), 7-engine pipeline, Gantt + XLSX export, SuggestionBadge + DocWarningsBanner via Core API
- **Element Subtypes:** beton, bednění, odbednění, výztuž, zrání, podpěrná konstr., předpětí, jiné
- **OTSKP Catalog:** 11 regex patterns → element_type (confidence=1.0), metadata extraction (concrete class, prestress, prefab)
- **NK Classification:** 8 bridge deck subtypes (deskový→spřažený), auto-detect from OTSKP name
- **Křídla opěry:** separate element type `kridla_opery`, composite detection (opěra+křídla → dual formwork)
- **Lateral Pressure:** p = ρ×g×h×k (DIN 18218), auto-filter formwork, záběrová betonáž, shape correction (×1.0–1.8)
- **Formwork Selector:** Frami 80 kN/m² (max 3.0m), Framax 100 kN/m² (max 6.75m), support_tower category, max_pour_height_m filter
- **Aplikovat:** auto-creates ALL missing sub-positions (ensurePosition with GET dedup), aggregateScheduleDays() shared function
- **Two modes:** Monolit (ordinal days, auto-classify, TOV mapping) / Portal (calendar, manual)
- **Import:** Registry→portalAutoSync(3s)→Portal→Monolit via `portal_project_id`, paired row scanner
- **TOV sync:** labor-only to Portal DOV, 3 variants (A/B/C) auto-detected, formwork rental for bednění
- **Account Isolation:** `portal_user_id`, Portal JWT via `JWT_SECRET`, 403 on cross-account
- **ErrorBoundary:** PositionsTable + KPIPanel wrapped; prevents white screen on React #310
- **KPI Panel CSS:** `.kpi-card` in `flat-design.css` — `overflow:visible`, `min-width:200px` (was 180px/hidden, clipped "lidí" and "Kč/m³")
- **Dual DB:** `monolith_projects` (listed via `/api/monolith-projects`, auth) + `bridges` (FK compat for `positions.bridge_id`); `bridgesAPI.getAll()` calls monolith-projects

### 4. URS_MATCHER_SERVICE (Kiosk)
Node.js/Express + SQLite. **~45 endpoints**, **159 tests**, **~10K LOC**, **12 tables**.
4-phase matching, dual search (36 seed + 17,904 OTSKP + Perplexity), VZ Scraper, 9 LLM providers.

### 5. rozpocet-registry (Kiosk)
React 19 + Vite + Vercel serverless. **12 endpoints**, **0 tests**, **~16K LOC**.
BOQ classification (11 groups), AI Classification (Cache→Rules→Memory→Gemini), TOV Modal, Formwork/Pump Calculators.
- **Import:** Fuzzy auto-detect (header keywords + normalize), per-sheet dataStartRow detection (code+MJ heuristic), reimport with skupiny preservation
- **Export:** "Vrátit do původního (ceny + skupiny)" — ZIP/XML patch, inline strings, autoFilter + sheetProtection patch. Per-sheet column mapping (each sheet reads own `config.columns.cenaJednotkova`).
- **Virtualization:** @tanstack/react-virtual for 2000+ row tables, overscan=20, `display:flex` on `<tr>` with explicit `width` per `<td>`/`<th>`
- **Undo/Redo:** `undoStore.ts` (in-memory, MAX_UNDO=50) + `useUndoableActions` hook wrapping skupina/role mutations; Ctrl+Z/Ctrl+Shift+Z; toolbar above table
- **UI:** Portal-rendered dropdowns (RowActionsCell, SkupinaAutocomplete) escape `overflow:auto`, resizable GroupManager (min 480px, localStorage persist)

## Totals

| Service | Endpoints | Tests | LOC |
|---------|-----------|-------|-----|
| concrete-agent | 120 | 34 files | ~61K |
| stavagent-portal | ~80 | 1 file | ~25K |
| Monolit-Planner | 128 | 556 | ~34K |
| URS_MATCHER_SERVICE | ~45 | 159 | ~10K |
| rozpocet-registry | 12 | 0 | ~16K |
| **TOTAL** | **~388** | **750+** | **~146K** |

---

## Development Commands

```bash
cd concrete-agent && npm install && npm run dev:backend          # FastAPI :8000
cd stavagent-portal && npm install && npm run dev                # Express + React
cd Monolit-Planner/shared && npm i && npm run build && cd ../backend && npm run dev  # :3001
cd Monolit-Planner/frontend && npm run dev                      # React :5173
cd URS_MATCHER_SERVICE && npm install && npm run dev             # :3001
cd rozpocet-registry && npm install && npm run dev               # Vite :5173
```

---

## Conventions

**Commits:** `FEAT:`, `FIX:`, `REFACTOR:`, `DOCS:`, `STYLE:`, `TEST:`, `WIP:`
**Branches:** `claude/<task-description>-<random5chars>`
**Git Hooks (Husky):** Pre-commit: 34 formula tests (~470ms). Pre-push: branch + tests.

**Key rules:**
- Determinism > AI: if regex can do it, don't use LLM
- Confidence: never overwrite higher with lower
- Icons: `lucide-react` only, no emojis in JSX; `shared/icon-registry.ts`
- Monolit subtypes: beton, bednění, odbednění (Tesař), výztuž, jiné
- Negative context: `_safe_search()` skips stávající/demolition matches
- Element classifier v3: 21 types, bridge context, 5 early-exits, 7 BRIDGE_EQUIVALENT mappings
- Passport = structured tables; Shrnutí = narrative + topics + risks
- Construction sequence: bridge (pilota→římsa), building (pilota→schodiště)
- Scroll restoration: `sessionStorage('monolit-planner-return-part')` + 3s highlight
- Calculator suggestions: write-through `_PROJECT_FACTS` (memory + `calculator_facts` in project cache JSON)
- **Product naming:** App 1 (root `/`) = "Monolit Planner", App 2 (`/planner`) = "Kalkulátor betonáže". Never "Plánovač elementu" or "Kalkulátor monolitních prací"
- **SEO/noindex:** kalkulator.stavagent.cz has `<meta name="robots" content="noindex">` + `X-Robots-Tag` header in `vercel.json` (working app, not public page)

- Registry export ZIP/XML: JSZip + DOMParser, inline strings (`t="inlineStr"`), autoFilter via string replace after serialization
- Portal INSERTs: always explicit `gen_random_uuid()` for `position_instance_id` (Phase 8 NOT NULL constraint)
- Registry import: per-sheet `dataStartRow` via code+MJ heuristic; reimport via `replaceProjectSheets()` preserves manual skupiny by kod

**Stack decisions:** rozpocet-registry=Vercel+Zustand, Monolit=PostgreSQL prod/SQLite dev, URS=SQLite+per-request LLM fallback, CORE=Vertex AI primary+stateless, Portal=central `portal_project_id` linking.

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
JWT_SECRET=<same as Portal>
# URS_MATCHER_SERVICE
STAVAGENT_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app
LLM_TIMEOUT_MS=90000
# stavagent-portal
VITE_DISABLE_AUTH=true  # local dev only
```

---

## Quick Debugging

| Problem | Check |
|---------|-------|
| URS empty results | LLM timeout (90s), AbortController per-provider |
| Monolit wrong calc | `concrete_m3`, `unit_cost_on_m3`, KROS rounding `Math.ceil(x/50)*50` |
| CORE unavailable | Cloud Run status, `/health`, Secret Manager |
| LLM 401/404 | SA `aiplatform.user`; use `gemini-2.5-flash` (not -lite) |
| CORE Cloud Run crash | `monolit_adapter.py` singletons — lazy-init with required args |
| Monolit 403 | `portal_user_id` mismatch; JWT_SECRET matches Portal; migration 012 |
| Portal "Failed to fetch" | headersTimeout=310s in server.js |
| Wrong izolant_tl_mm | `_safe_search()` skips stávající/odstraněno |
| Vertex AI empty | `response.text` raises ValueError when blocked; wrap in try/except |
| Vertex AI 429 | Exponential backoff 3 attempts in `gemini_client.py` |
| position_instance_id NULL | All portal_positions INSERTs must use `gen_random_uuid()` explicitly |
| Registry auto-detect 0% | Keywords in `structureDetector.ts` FIELD_PATTERNS; normalize removes [CZK] |
| klasifikator.stavagent.cz → Portal | Vercel Edge Middleware in `frontend/middleware.js` proxies by hostname |
| Monolit white screen #310 | ErrorBoundary deployed on PositionsTable+KPIPanel; check `componentStack` in console |
| FK/constraint "already exists" | Portal schema+migrations use `DO $ IF NOT EXISTS $` guards; never bare ALTER TABLE |
| Monolit /healthcheck 404 | Returns 200 without KEEP_ALIVE_KEY; only 404 on wrong key |
| "Jen problémy" shows wrong data | BUG: `include_rfi=false` filters OUT rfi rows; should filter IN (inverted logic in positions.js:150) |
| Monolit click no reaction | KPIPanel shows "Načítání KPI..." (not "Vyberte objekt") when bridge selected but API pending/failed |
| Registry columns misaligned | `display:flex` on `<tr>`, `width: cell.column.getSize()` + `flexShrink:0` on each `<td>` |
| Registry dropdown clipped | Must use `createPortal(…, document.body)` with `position:fixed`; scroll listener closes on scroll |
| Registry export wrong column | Was: `firstSheet.config` used for all sheets. Now: per-sheet `sheet.config.columns.cenaJednotkova` |
| KPI text clipped ("lidí") | `.kpi-card` overflow:hidden→visible, min-width 180→200px, no max-height |
| Aplikovat DNY wrong | Check shared/dist rebuilt (tsc), aggregateScheduleDays in formulas.ts |
| Formwork Frami for tall element | Frami max 3.0m (max_pour_height_m), Framax max 6.75m; pressure 80/100 kN/m² |
| Sub-position missing after Aplikovat | ensurePosition checks GET before POST; check browser console for fetch errors |
| OTSKP not matching | OTSKP_RULES in element-classifier.ts; runs before KEYWORD_RULES; check normalize() |
| Křídla classified as opěra | Composite suppression: if both "opěr" + "křídl" → opery_ulozne_prahy, not kridla_opery |

---

## CI/CD

**Cloud Build:** `cloudbuild-{concrete,monolit,portal,urs,registry,mineru}.yaml` + `triggers/*.yaml`
Guard step (git diff), Docker → Artifact Registry, Cloud Run deploy. Region: `europe-west3`. MinerU: `europe-west1`.
**GitHub Actions:** keep-alive, monolit-planner-ci, test-coverage, test-urs-matcher.

---

## TODO / Backlog

### Manual Actions
- [ ] **MASTER_ENCRYPTION_KEY**: `openssl rand -hex 32` → GCP Secret Manager
- [ ] **Stripe env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Secret Manager
- [ ] **Change DB password** — `StavagentPortal2026!` leaked in git history; `gcloud sql users set-password`

### TODO
- [ ] **P1: Merge branch** — `claude/fix-duplicate-constraints-DijC5` → main (15 commits, 456 tests)
- [ ] **P1: Fix "Jen problémy" filter** — `positions.js:150` inverted: `!p.has_rfi` should be `p.has_rfi`
- [ ] **P1: Debug Monolit React #310** — ErrorBoundary deployed, need `componentStack` from prod console
- [ ] **P1: Fix portal_user_id type mismatch** — INTEGER in `bridges`, TEXT in `monolith_projects`
- [ ] **P1: Migrate orphan projects** — `UPDATE monolith_projects SET portal_user_id='<admin_id>' WHERE portal_user_id IS NULL`
- [ ] **P1: E2E test D6 SO202** — dvoutrámový, C35/45, is_prestressed=true, 2 mosty, Aplikovat → verify all subtypes in table
- [ ] **P2: Výztuž B500B + Y1860** — split rebar for prestressed (dual RebarLiteResult), two rows in table
- [ ] **P2: Landing page — visual QA + /register route + SEO subpages**
- [ ] **P2: Test reimport** — import multi-sheet, edit mapping, reimport → skupiny preserved
- [ ] **P2: Calculator suggestions E2E** — upload TZ→Core extraction→Planner→suggestions appear for correct SO
- [ ] **P2: TOV sync E2E** — 3 composition variants (A/B/C) with real bridge project
- [ ] **P2: Registry export QA** — test multi-sheet file with different column mappings
- [ ] **P3: Planner E2E** — lateral pressure + záběry on SO-203, Aplikovat → TOV
- [ ] **P3: Gantt calendar** — date axis in Portal mode

### Product Backlog
- [ ] Export Work Packages → PostgreSQL (currently SQLite in URS)
- [ ] IFC/BIM support (needs binaries)

---

**Per-service docs:** `concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`, `docs/STAVAGENT_CONTRACT.md`
