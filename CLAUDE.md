# CLAUDE.md - STAVAGENT System Context

**Version:** 4.14.0
**Last Updated:** 2026-04-14
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

**Subsystems:** Multi-Role Expert (4 roles), Workflows A/B/C, Document Accumulator (20 ep), Multi-Format Parser v5.0 (XLSX/XML/PDF/DXF/OCR), Add-Document Pipeline (14 doc types), NKB 3-layer, NormIngestionPipeline (chunked: L1→chunk→per-chunk[L2+L3a]→merge→L3b), NKB Audit (15 sources), Unified Item Layer, Soupis Assembler, Scenario B, Section Extraction Engine v2 (28 extractors, negative-context filter), Calculator Suggestions (fact→param mapping, warnings, conflicts, write-through persistence), Chunked Extraction (document_chunker + parsed_document_adapter + extraction_to_facts_bridge), Drive OAuth2, Agents, Chat, **MCP Server v1.0** (9 tools, FastMCP, mounted at `/mcp`).
- **MCP Server** — `app/mcp/server.py` + `app/mcp/tools/` (9 tools): find_otskp_code, find_urs_code, classify_construction_element, calculate_concrete_works, parse_construction_budget, analyze_construction_document, create_work_breakdown, get_construction_advisor, search_czech_construction_norms. FastMCP 3.x, mounted on FastAPI at `/mcp`.
- **MCP Auth** — `app/mcp/auth.py` + `app/mcp/routes.py`: bcrypt passwords, per-thread SQLite pool, API keys (`sk-stavagent-{hex48}`), 200 free credits, per-tool billing (0-20 credits), atomic `UPDATE WHERE credits >= cost`, rate limiting (10/60s per IP), OAuth 2.0 `client_credentials` for ChatGPT. REST wrappers at `/api/v1/mcp/tools/*` (auto-generate OpenAPI for GPT Actions). Lemon Squeezy webhook at `/api/v1/mcp/billing/webhook`.
- **MCP CI** — `tests/test_mcp_compatibility.py` (17 tests), `.github/workflows/test-mcp-compatibility.yml`. Runs on every push to concrete-agent/.
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
Node.js/Express + React. **132 endpoints**, **687 tests**, **~38K LOC**.
Structure: `shared/` (687 tests, 17 files), `backend/` (0 tests), `frontend/` (0 tests). Design: Slate Minimal (`--r0-*`).
**DB:** 45 tables (incl. `planner_variants`). **Frontend:** PlannerPage (Part B) ~380 lines layout, logic in `useCalculator` hook + 10 files in `components/calculator/` (Sidebar, FormFields, Result, HelpPanel, WizardHints, InlineResourcePanel, applyPlanToPositions, ui, types, helpers, useCalculator).

- **Calculator:** CZK/m³, `unit_cost_on_m3 = cost_czk / concrete_m3`, `kros_unit_czk = Math.ceil(x/50)*50`
- **Element Planner:** 22 types (11 bridge + 11 building), 7-engine pipeline, Gantt + XLSX export, SuggestionBadge + DocWarningsBanner via Core API
- **Element Subtypes:** beton, bednění, odbednění (Tesař), výztuž, zrání, podpěrná konstr., předpětí, jiné
- **OTSKP Catalog:** 11 regex patterns → element_type (confidence=1.0), metadata extraction (concrete class, prestress, prefab)
- **Position Linking:** `position-linking.ts` — links by OTSKP/URS code prefix (first 4 digits), 22 tests. `detectWorkType()` by 5th digit. `findLinkedPositions()` groups beton+výztuž+bednění.
- **NK Classification:** 8 bridge deck subtypes (deskový→spřažený), auto-detect from OTSKP name
- **Bridge Technology:** `bridge-technology.ts` — pevná/posuvná skruž/CFT recommendation, MSS cost+schedule, 20 tests. UI: radio buttons + recommendation card.
- **Křídla opěry:** separate element type `kridla_opery`, composite detection (opěra+křídla → dual formwork)
- **Lateral Pressure:** p = ρ×g×h×k (DIN 18218), per-záběr staging (`max_stage = sys.pressure/full_pressure × h`, min 1.5m), shape correction (×1.0–1.8)
- **Formwork Selector:** Horizontal → skip pressure, select by category+rental. Vertical → per-záběr pressure filter. Frami 80 kN/m² (max 3.0m), Framax 100 kN/m² (max 6.75m), 30 systems total
- **Props:** `selectPropSystem()` with `preferred_manufacturer` vendor match (DOKA formwork → DOKA props). `PropsCalculatorResult.labor_hours` exposed.
- **Ztracené bednění:** `lost_formwork_area_m2` — TP deducted from system formwork, props on full area. UI checkbox for horizontal elements only.
- **Manual záběry:** `use_manual_zabery` toggle + editable table (name+volume+area per záběr). Engine receives `num_tacts_override = count, tact_volume_m3_override = max(volumes)`.
- **Per-záběr scheduling (v4.0):** `tact_volumes: number[]` in PlannerInput → per-záběr `calculatePourTask()`. `per_tact_concrete_days[]`, `per_tact_rebar_days[]`, `per_tact_assembly_days[]` in scheduler. Validation: mismatch length → warning + ignore.
- **Aplikovat → TOV (v4.14):** `applyPlanToPositions.ts` helper. Splits 7 work types (Betonář, Tesař montáž/demontáž, Železář, Ošetřovatel, Specialista předpětí, Tesař podpěry) across positions: URL ID → linked via prefix/name → AUTO-CREATE new sibling Position (POST with metadata) → last-resort merge into beton. Each entry carries `source: 'calculator'` for per-entry [×] delete gate in FlatTOVSection. `NO_FORMWORK` set (pilota, podzemni_stena) skips bednění drafts. Backend POST /api/positions accepts metadata in INSERT.
- **Planner Variants:** `planner_variants` table (position_id FK, input_params JSON, calc_result JSON, is_plan flag). REST: GET/POST/PUT/DELETE `/api/planner-variants`. Max 10/position. `setAsPlan()` clears others. Mode A: DB; Mode B: in-memory. Auto-restore plán on entry. Numbering: `Math.max(existingNums) + 1`.
- **Auto-calc (v4.1):** 1.5s debounce, pure preview (no save). `calcStatus` indicator above KPIs. No save prompt, no autosave checkbox. Variants created ONLY by explicit "Uložit variantu" click. Wizard guard: skip steps 1-4.
- **Průvodce (Wizard):** Inline sidebar mode (`wizardMode` + `wizardStep` 1-5). Same form state. `display:none` on sections. Steps: Element→Volume+Beton→Geometry→Rebar+Resources→Záběry. Engine-powered hints per step (maturity, lateral pressure, rebar PERT). `localStorage('planner_wizard_mode')`. Keyboard: Enter=next, Escape=back.
- **Calculator refactor (v4.13):** PlannerPage 4620→380 lines. State/logic in `useCalculator` hook (1255 lines). Split: `CalculatorSidebar.tsx` (shell+Element+AI), `CalculatorFormFields.tsx` (Objemy+Záběry+Beton+Resources), `CalculatorResult.tsx` (KPI+Gantt+Costs+Variants), `ui.tsx` (Card/KPICard/CollapsibleSection), `types.ts`, `helpers.ts`. State owner = PlannerPage via hook.
- **Calculator design unified (v4.13):** `r0.css` palette slate→stone, font JetBrains Mono→DM Sans body + JetBrains Mono numbers. KPI left-border + tinted bg (matches Part A). Responsive: mobile 1-col+2x2 KPI grid, tablet sidebar 300px, desktop sidebar 340px. Gantt/Souhrn/Norms in `CollapsibleSection` (open on desktop, closed on mobile). Sticky toolbar for mobile with `env(safe-area-inset-bottom)`. Inputs 16px on mobile (no iOS zoom), 44px touch targets.
- **Pilota formwork fix:** `recommendFormwork()` has special case for `pilota` — skip pressure filter, return `Tradiční tesařské` (bored pile uses pažnice/tremie). Special cases: rimsa → Římsové bednění T, mostovka >5m → Staxo 100, pilota → catalog recommendation.
- **Block A — hierarchy (v4.14):** FormState `has_dilatation_joints` + `num_dilatation_sections` + `tacts_per_section_mode/manual` replace legacy `tact_mode`/`has_dilatacni_spary`/`num_tacts_override` pair. Orchestrator pre-computes `totalTacts = numSections × tactsPerSection` before `decidePourMode`; routes through existing override path so Block D pump rebuild + Block C working_joints warnings compose. LS_FORM_KEY bumped `planner-form` → `planner-form-v2` (clean start). UI: one sequence "Členění konstrukce" replaces two tabs. Live preview "X celků × Y záběrů = Z celkem".
- **Block C — working_joints default:** `undefined`/`''` now behaves like `'unknown'` (sectional by capacity + warning "ověřte v RDS"). Explicit `'no'` → 1 záběr + "nepřetržitou betonáž" warning. Only `'no'` reaches the strict monolithic branch.
- **Block D — override rebuild:** `num_tacts_override` active → orchestrator recomputes `pour_hours_per_tact` for smaller per-tact volume, sets `sub_mode='manual_override'`, `pumps_required=1`. Previously stale monolithic pumps stuck.
- **Block E — variant cost parity:** `DeadlineContext.mainLaborBreakdown` passed from main cost path; variants reuse labor verbatim (man-hours conservation) and only recompute rental. `DeadlineOptimizationVariant.cost_breakdown = { labor_czk, rental_czk }`.
- **Block F — crews > tacts warning:** orchestrator emits warning per crew type when `numFWCrews` or `numRBCrews` exceeds `pourDecision.num_tacts`.
- **Block 2 (pump) — dual scenarios:** `PourTaskResult.pumps_for_actual_window` (always, 1 pump) + `pumps_for_target_window` (optional, N pumps for `target_window_h`). No more mixed single/multi number.
- **Block 1 (DIN 18218) — consistency k-factor:** `LateralPressureOptions.concrete_consistency: 'standard'|'plastic'|'scc'` → k = 0.85 / 1.0 / 1.5. Default `'standard'` (was method-based k=1.5). `filterFormworkByPressure` sort now uses `rental × getStageCountPenalty(stageCount)` — Framax wins over short-panel COMAIN on tall piers.
- **Manufacturer pre-filter (v4.14):** `PlannerInput.preferred_manufacturer` + FormState dropdown (DOKA/PERI/ULMA/NOE/Místní). Auto-recommendation path only: `recommendFormwork` → if manufacturer mismatches, rebuild pool from `getSuitableSystemsForElement` filtered to vendor, re-run `filterFormworkByPressure`, pick first. Empty pool → keep auto + warning "Žádný systém {vendor} nevyhovuje technickým požadavkům".
- **Expert-mode hints:** `WizardHintsPanel` renders `MissingFieldsHint + SanityHint + TechnologyHint` in one "💡 Doporučení a kontrola" section when `wizardMode=false`. `ReviewHint` exported and rendered separately by `CalculatorSidebar` right above the "Vypočítat plán" button. Added "Podpěry: nelze spočítat — chybí výška" warning when `profile.needs_supports && height_m <= 0`.
- **Help auto-show:** `showHelp` state initializer reads `localStorage('planner_help_seen')` — first visit opens automatically, both close paths persist the flag. Full nápověda restored from commit `67a2bc8^` as dedicated `HelpPanel.tsx` component (3-column grid: pipeline / math models / settings+norms). Refreshed with Block A, DIN 18218, Block C/D/E/F content.
- **PERT row under KPI:** compact line "PERT: X optimistická — Y střed — Z pesimistická". Source priority: `plan.monte_carlo` if present → derived `total_days × 0.85 / 1.0 / 1.30` (same factors as rebar-lite PERT).
- **Wizard stale closure fix:** `runCalculationRef = useRef(...)` updated inline after runCalculation definition → `wizardNext` calls `runCalculationRef.current()` instead of captured closure. Previously clicking "Vypočítat →" at step 5 ran planElement with a pre-inline-panel form snapshot.
- **Čety terminology:** "Brigády" (slang for side-job) replaced with "Čety" (proper construction team) everywhere. Inline panel re-grouped into "Pracovní čety" subsection + "Parametry výpočtu" subsection — Čety bednění/Tesařů/četa and Čety výztuže/Železářů/četa always paired.
- **Two modes:** Monolit (ordinal days, auto-classify, TOV mapping) / Portal (calendar, manual)
- **Import:** XLSX + Registry — both work without pre-created project (backend auto-creates `bridges` + `monolith_projects`). Empty state shows 3 actions: Vytvořit/Nahrát Excel/Načíst z Rozpočtu. `metadata` column persisted (linked_positions from parser). `bridge_id` prefixed with `stavbaProjectId__` to prevent cross-file collision.
- **Registry Import Modal:** parallel fetch (Portal public endpoint `/api/integration/list-registry-projects` + Registry backend), search, debug info, refresh button, source badges (PORTAL/REGISTRY).
- **TOV sync:** tov_entries to Portal DOV via prefillTOVFromMonolit, formwork rental for bednění
- **Account Isolation:** `portal_user_id TEXT` (not INTEGER), Portal JWT via `JWT_SECRET`, 403 on cross-account
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
| stavagent-portal | ~82 | 1 file | ~26K |
| Monolit-Planner | 132 | 687 | ~38K |
| URS_MATCHER_SERVICE | ~45 | 159 | ~10K |
| rozpocet-registry | 12 | 0 | ~16K |
| **TOTAL** | **~391** | **881+** | **~151K** |

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

**Karpathy rules (anti-bloat):**
- Pokud lze 200 řádků napsat za 50 — napiš za 50.
- Nesahej na kód, který se zadáním nesouvisí.
- Nepřidávej "flexibilitu" a "konfigurovatelnost", o kterou nikdo nepožádal.
- Když si nejsi jistý — zeptej se, neháděj mlčky.
- Definuj kritéria úspěchu PŘED kódem, pak iteruj k jejich splnění.

**Key rules:**
- Determinism > AI: if regex can do it, don't use LLM
- Confidence: never overwrite higher with lower
- Icons: `lucide-react` only, no emojis in JSX; `shared/icon-registry.ts`
- Monolit subtypes: beton, bednění, odbednění (Tesař), výztuž, jiné
- Negative context: `_safe_search()` skips stávající/demolition matches
- Element classifier v3: 22 types, bridge context, 5 early-exits, 7 BRIDGE_EQUIVALENT mappings
- Passport = structured tables; Shrnutí = narrative + topics + risks
- Construction sequence: bridge (pilota→římsa), building (pilota→schodiště)
- Scroll restoration: `sessionStorage('monolit-planner-return-part')` + 3s highlight
- Calculator suggestions: write-through `_PROJECT_FACTS` (memory + `calculator_facts` in project cache JSON)
- **Formwork orientation rule:** horizontal elements (strop, mostovka, základ) → skip lateral pressure, select by category+rental. Vertical (stěna, sloup, pilíř) → per-záběr pressure (`sys.pressure / full_pressure × height`, min 1.5m stage). Special (rimsa → římsový vozík, pilota → pažnice).
- **Calculator UX v4.1:** auto-calc = preview only (no auto-save). Variants created ONLY by "Uložit variantu" button. No save prompt, no autosave checkbox, no `pendingApplyPlan`.
- **Product naming:** App 1 (root `/`) = "Monolit Planner", App 2 (`/planner`) = "Kalkulátor betonáže". Never "Plánovač elementu" or "Kalkulátor monolitních prací"
- **SEO/noindex:** kalkulator.stavagent.cz has `<meta name="robots" content="noindex">` + `X-Robots-Tag` header in `vercel.json` (working app, not public page)

- Registry export ZIP/XML: JSZip + DOMParser, inline strings (`t="inlineStr"`), autoFilter via string replace after serialization
- Portal INSERTs: always explicit `gen_random_uuid()` for `position_instance_id` (Phase 8 NOT NULL constraint)
- Registry import: per-sheet `dataStartRow` via code+MJ heuristic; reimport via `replaceProjectSheets()` preserves manual skupiny by kod

**Stack decisions:** rozpocet-registry=Vercel+Zustand, Monolit=PostgreSQL prod/SQLite dev, URS=SQLite+per-request LLM fallback, CORE=Vertex AI primary+stateless, Portal=central `portal_project_id` linking.

### MCP Compatibility Check

After **EVERY** change to modules wrapped by MCP tools, verify the wrapper still works.

**MCP tool → module mapping:**
| MCP Tool | Module file(s) |
|----------|---------------|
| find_otskp_code | `pricing/otskp_engine.py`, KB XML |
| find_urs_code | `core/perplexity_client.py`, URS Matcher HTTP |
| classify_construction_element | MCP has own classifier (no external dep) |
| calculate_concrete_works | Monolit-Planner `/api/calculate` HTTP |
| parse_construction_budget | `parsers/xlsx_komplet_parser.py`, `xlsx_rtsrozp_parser.py`, `excel_parser.py` |
| analyze_construction_document | `parsers/pdf_parser.py`, pdfplumber |
| create_work_breakdown | MCP `otskp.py` + `classifier.py` (internal) |
| get_construction_advisor | MCP `classifier.py` + `calculator.py` (internal) |
| search_czech_construction_norms | `core/perplexity_client.py`, `core/kb_loader.py` |

**NO check needed if:**
- Bugfix inside a function (same signature, same return format)
- New enum value added (e.g., new element type with default behavior)
- New optional parameter with default value
- Text/description changes in response

**CHECK NEEDED if:**
- Function/module renamed or moved (import path breaks)
- Required parameter added, removed, or renamed
- Response structure changed (field removed, renamed, or type changed)
- New module added that should have its own MCP tool

**How to check:** `cd concrete-agent/packages/core-backend && python -m pytest tests/test_mcp_compatibility.py -v`

**If broken:** update MCP wrapper in `app/mcp/tools/`, not the backend module.

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
| Formwork Frami for tall element | Per-záběr pressure: `filterFormworkByPressure()` stages automatically (min 1.5m). Frami 80kN/3m, Framax 100kN/6.75m |
| Sub-position missing after Aplikovat | ensurePosition checks GET before POST; check browser console for fetch errors |
| OTSKP not matching | OTSKP_RULES in element-classifier.ts; runs before KEYWORD_RULES; check normalize() |
| Křídla classified as opěra | Composite suppression: if both "opěr" + "křídl" → opery_ulozne_prahy, not kridla_opery |
| Registry modal empty | Debug banner shows Portal/Registry status. Portal 401 → use `/api/integration/list-registry-projects` (public). Registry 0 → startup push-sync in App.tsx |
| Aplikovat 500 error | Check curing_days Math.round (INTEGER column). Error logging in PUT handler shows exact field/type |
| Portal sync 0 items | Log misleading — `items_imported = newItems = total - updated`. On re-sync all items are UPDATES, so 0 new. Data IS synced. |
| XLSX overwrites old project | bridge_id prefixed with `stavbaProjectId__sheetBridgeId`. Each upload creates unique project via hash suffix. |
| Props missing normohodiny | `PropsCalculatorResult.labor_hours` field; check `fwSystem.manufacturer` passed to `calculateProps()` |
| NKB 429 console spam | fetchAuditStatus returns `'_rate_limited'` sentinel → polling triples delay (max 120s) |
| OTSKP search empty | Check `/api/otskp/stats/summary` for total_codes; response has `reason: 'db_empty'|'no_match'` |
| Wizard not showing hints | `wizardHint1-4` are `useMemo` — check deps array matches form fields; hint3 only for vertical elements |
| Wizard auto-calc fires early | Guard `wizardMode && wizardStep < 5` in auto-calc useEffect; check `skipNextAutoCalcRef` |
| firstRun shows wrong result | `firstRun` useMemo depends on `[initialForm]` — verify positionContext parsed correctly |
| Aplikovat plán applies wrong data | v4.1: `applyFnRef` + `pendingApplyPlan` removed. Aplikovat now applies current result directly |
| Variant V1 V1 duplicate | `existingNums.length === 0 ? 1 : Math.max(...existingNums) + 1` — check label parsing regex |

---

## CI/CD

**Cloud Build:** `cloudbuild-{concrete,monolit,portal,urs,registry,mineru}.yaml` + `triggers/*.yaml`
Guard step (git diff), Docker → Artifact Registry, Cloud Run deploy. Region: `europe-west3`. MinerU: `europe-west1`.
**GitHub Actions:** keep-alive, monolit-planner-ci, test-coverage, test-urs-matcher, **test-mcp-compatibility** (17 tests, triggers on concrete-agent/ changes).

---

## TODO / Backlog

### Manual Actions
- [ ] **MASTER_ENCRYPTION_KEY**: `openssl rand -hex 32` → GCP Secret Manager
- [ ] **LEMONSQUEEZY_WEBHOOK_SECRET**: set in GCP Secret Manager (Lemon Squeezy → Settings → Webhooks → Signing secret)
- [ ] **Change DB password** — `StavagentPortal2026!` leaked in git history; `gcloud sql users set-password`

### TODO
- [ ] **P0: Deploy MCP** — after merge, verify `/mcp` endpoint on Cloud Run, test with curl
- [ ] **P0: stavagent.cz/api-access page** — registration UI, API key display, credit balance, Lemon Squeezy checkout links
- [ ] **P1: Lemon Squeezy webhook IDs** — set actual product_id mapping in `routes.py:PRODUCT_CREDITS` after creating products (done: CZK 11/55/220)
- [ ] **P1: Custom GPT in GPT Store** — create GPT with Actions from `/openapi.json`, verify domain
- [ ] **P1: Fix "Jen problémy" filter** — `positions.js:150` inverted: `!p.has_rfi` should be `p.has_rfi`
- [ ] **P1: Wizard STEP3_FIELDS config** — data-driven field map for 22 element types
- [ ] **P1: Per-záběr engine refactor** — element-scheduler uses max(tact_volumes) as bottleneck, should schedule per-záběr independently
- [ ] **P1: Migrate orphan projects** — `UPDATE monolith_projects SET portal_user_id='<admin_id>' WHERE portal_user_id IS NULL`
- [ ] **P1: E2E test FORESTINA SO.01** — stropní deska 125.559 m³, ztracené bednění 1325 m², manual záběry 4x, Aplikovat → verify TOV
- [ ] **P2: MCP listings** — PR to modelcontextprotocol/servers, register on mcp.so
- [ ] **P2: Výztuž B500B + Y1860** — split rebar for prestressed (dual RebarLiteResult)
- [ ] **P2: Landing page — visual QA + /register route + SEO subpages**
- [ ] **P2: Element field visibility map** — full ELEMENT_FIELD_VISIBILITY config for all 22 element types
- [ ] **P3: Gantt calendar** — date axis in Portal mode
- [ ] **P3: SAFE cenový katalog** — add SAFE as 3rd vendor alongside DOKA/PERI

### Product Backlog
- [ ] Export Work Packages → PostgreSQL (currently SQLite in URS)
- [ ] IFC/BIM support (needs binaries)

---

**Per-service docs:** `concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`, `docs/STAVAGENT_CONTRACT.md`
