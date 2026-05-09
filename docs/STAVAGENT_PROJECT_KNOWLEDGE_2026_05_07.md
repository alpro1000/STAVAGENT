# STAVAGENT — что я знаю о проекте

**Версия снимка:** 1.0
**Дата:** 2026-05-07
**Источник:** CLAUDE.md v4.27.0 (2026-05-03) + чтение кода на ветке `claude/competitive-audit-stavagent-hfgwP`
**Назначение:** внутренний knowledge snapshot — не roadmap, не спецификация. Что у проекта есть прямо сейчас.

---

## 1. Что это вообще

**STAVAGENT** — AI-powered SaaS для оценки стоимости и подготовки строительных рассчётов под чешский и словацкий рынок гражданского строительства. Целевая аудитория — **přípravář / rozpočtář** (preparator / estimator), не инженер-конструктор и не enterprise GC.

**Позиционирование** (из `docs/CALCULATOR_PHILOSOPHY.md`):
- Точность **±10–15 %** для тендерной фазы и предтендерной кальculации
- **Не engineering software** — комплементарно DOKA Software / PERI EngineeringPad, не конкурент
- Vendor-neutral (DOKA + PERI + ULMA + …) vs vendor-locked engineering tools
- Минутный workflow vs дни/недели у engineering teams
- В UI обязателен disclaimer "orientační odhad, finální detail u dodavatele"

**Бизнес-сабстрат**:
- 9 MCP tools, биллинг 0–20 кредитов за вызов
- Регистрация даёт 200 free credits, 1 Kč = 10 credits
- Lemon Squeezy webhook для оплат
- ChatGPT Actions integration через REST wrappers `/api/v1/mcp/tools/*`

---

## 2. Monorepo: 5 сервисов

| Сервис | Stack | Endpoints | Tests | LOC | Роль |
|--------|-------|-----------|-------|-----|------|
| **concrete-agent** (CORE) | Python FastAPI | 120 | 34 files | ~61K | AI, parsing, audit, MCP server, Multi-Role Expert |
| **stavagent-portal** | Node.js/Express + React | ~82 | 1 file | ~26K | Dispatcher, landing, JWT auth, Stripe credits |
| **Monolit-Planner** | Node.js + React | 132 | 921+5 | ~43K | **Сердце:** Concrete Calculator (CZK/m³) |
| **URS_MATCHER_SERVICE** | Node.js + SQLite | ~45 | 159 | ~10K | BOQ→URS code matching, VZ Scraper |
| **rozpocet-registry** | React 19 + Vite + Vercel serverless | 12 | 200 | ~16K | BOQ classification (11 групп), TOV Modal |
| **mineru_service** | Python FastAPI (europe-west1) | — | — | — | PDF parser (отдельный Cloud Run для OCR) |
| **Total** | | **~391** | **1258+** | **~152K** | |

**Инфраструктура:**
- GCP project `project-947a512a-481d-49b5-81c` (ID: 1086027517695), region **europe-west3** (mineru — west1)
- Cloud Run для всех бекендов, Vercel для frontend'ов
- Cloud SQL PostgreSQL 15 с базами `stavagent_portal`, `monolit_planner`, `rozpocet_registry`
- Service account: `1086027517695-compute@developer.gserviceaccount.com`
- Custom domains: `www.stavagent.cz`, `kalkulator.stavagent.cz`, `klasifikator.stavagent.cz`, `registry.stavagent.cz`

**LLM stack** (см. CLAUDE.md "Quick Reference"):
| Provider | Models | Auth | Назначение |
|----------|--------|------|------------|
| Vertex AI Gemini (primary) | `gemini-2.5-flash` (default), `gemini-2.5-pro` (heavy) | ADC | Multi-Role, parsing, all default tasks |
| Perplexity AI | sonar (web-search) | `PPLX_API_KEY` GCP SM | URS web search, normy lookup |
| AWS Bedrock (us-east-1) | Claude 3 Haiku/Sonnet/Opus | GCP SM secrets | Fallback chain |

LLM chain order: **Vertex AI → Bedrock → Gemini API → Claude API → OpenAI**.

`gemini-2.5-flash-lite` возвращает 404 в europe-west3 (несмотря на доку Google) — использовать только `flash`.

---

## 3. Архитектурная схема

```
Portal (Dispatcher) ──┬──→ concrete-agent (CORE: AI, parsing, audit, Multi-Role)
                      ├──→ Monolit-Planner (concrete cost calculator, CZK/m³)
                      ├──→ URS_MATCHER_SERVICE (BOQ→URS code matching)
                      └──→ rozpocet-registry (BOQ classification, Vercel serverless)

Flow: User → Portal upload → CORE parse/audit → Kiosk calculate → Portal results
Linking: portal_project_id (UUID) → core_processing_id + kiosk_result_id
```

**Ключевые API контракты:**
```
Portal → CORE:  POST /workflow/a/import      (multipart/form-data)
Portal → Kiosk: POST /import                 (JSON: projectId, positions[])
Kiosk → CORE:   POST /api/v1/multi-role/ask  (JSON: role, question, context)
```

**Cross-kiosk sync** (v4.17): Phase 11 миграция добавила `portal_project_id` + `registry_project_id` колонки на `bridges` + `monolith_projects` с индексами. Backend дедупит через 5-step lookup (exact bridge → portal+registry pair → portal only → registry only → auto-create). Registry push-syncит в Backend через UPSERT POST с debounce 2s + beforeunload keepalive.

---

## 4. Сердце системы — Monolit-Planner Calculator

Это где живёт основная engineering value. Всё остальное — обвязка вокруг калькулятора.

### 4.1 22 типа элементов (расширились до 23 в Gate 2)

**Мостовые (11):** zaklady_piliru, zaklady_oper, driky_piliru, rimsa, operne_zdi, mostovkova_deska, rigel, opery_ulozne_prahy, kridla_opery, mostni_zavirne_zidky, prechodova_deska, podkladni_beton, podlozkovy_blok.

**Здания (11):** zakladova_deska, zakladovy_pas, zakladova_patka, stropni_deska, stena, sloup, pruvlak, schodiste, nadrz, podzemni_stena, pilota.

Плюс `other` как catch-all.

### 4.2 7-engine pipeline

```
element-classifier (тип элемента + OTSKP/keywords + sanity ranges)
  ↓
lateral-pressure (DIN 18218: p = ρ × g × h × k, формула + filterFormworkByPressure)
  ↓
formwork-selector (~30 systems каталог DOKA/PERI/ULMA, pour_role: formwork/falsework/props/mss_integrated)
  ↓
maturity (Saul + ČSN EN 13670 + TKP18 §7.8.3 class table 2/3/4)
  ↓
pour-decision (sectional vs monolithic, dilatation joints, pump count)
  ↓
pour-task-engine (effective_rate = MIN(pump, plant, mixer, site, element); crew composition)
  ↓
element-scheduler (RCPSP greedy list, critical path, PERT Monte Carlo)
  ↓
[props-calculator | rebar-lite | pile-engine | bridge-technology]
  ↓
planner-orchestrator (склеивает всё в PlannerOutput)
```

**Pile pipeline** ответвляется (`runPilePath` в `pile-engine.ts`) — bored pile workflow совершенно другой (drilling → 7d пауза → head adjustment → optional cap), bypass формы / lateral-pressure / props.

### 4.3 Что engine'ы знают конкретно

**element-classifier.ts** (`Monolit-Planner/shared/src/classifiers/`):
- `OTSKP_RULES` (regex matching) с confidence 1.0 — приоритет над keyword scoring (0.7)
- `KEYWORD_RULES` с composite suppression (опера + křídla → opery_ulozne_prahy, не kridla_opery)
- `BRIDGE_ELEMENT_ORDER`: pilota → základy_pilířů → dříky_pilířů → rigel → opery → křídla → mostovka → římsy
- `BUILDING_ELEMENT_ORDER`: pilota → základy → стěna → сloup → průvlak → strop → schodiště
- `REBAR_RATES_MATRIX` 4 категории × ~10 диаметров (slabs_foundations / walls / beams_columns / staircases) — методвин April 2026 + RSMeans
- `SANITY_RANGES` per element type (rimsa 0.5–500 m³, pilota 0.5–600 m³, driky 1–800 m³)
- `checkVolumeGeometry()` — V_user / V_expected ∈ [0.3, 3.0], иначе ⛔ KRITICKÉ

**lateral-pressure.ts:**
- DIN 18218 формула с k-factor по `ConcreteConsistency` ('standard' 0.85 / 'plastic' 1.00 / 'scc' 1.50)
- `filterFormworkByPressure()` — CSP-style: фильтр по `sys.pressure ≥ required` с recovery через per-záběr staging (`effectiveMaxH = sys.pressure / required × pour_height`, min 1.5m)
- `getStageCountPenalty()` (1.0 для ≤2 záběry, 1.5 для 6+) — multi-objective scalarisation
- `suggestPourStages()` с column-formwork exemption (h ≤ 8m → 1 záběr)
- Frami 80 kN/m² (max 3.0m), Framax 100 kN/m² (max 6.75m), 30 систем total

**maturity.ts:**
- `calculateMaturityIndex()`: M = Σ(T_i − T_datum) × Δt_i, T_datum = −10 °C (OPC standard)
- `CURING_DAYS_TABLE`: 5 температурных диапазонов × 3 группы concrete-class × 3 curing classes (TKP18 §7.8.3)
- `EXPOSURE_MIN_CURING_DAYS`: XF1 5d, XF3/XF4 7d, XD3 7d (ČSN floor)
- `getExposureMinCuringDays()` array-aware (bridge deck XF2+XD1+XC4 → 5d по XF2 max)
- `DEFAULT_CURING_CLASS`: mostovka/římsa/rigel = 4, opěry/dříky/základy = 3, остальное = 2
- `curingThreePoint()`: warm (+5°C) / planned / cold (-8°C) для PERT integration
- Cement speed factor: CEM_I 1.0 / CEM_II 0.85 / CEM_III 0.6
- Plowman log-maturity для estimateStrengthPct

**pour-decision.ts:**
- Decision tree: `has_dilatacni_spary` единственный параметр, определяющий pour_mode (sectional vs monolithic)
- Sub-modes: `independent` / `adjacent_chess` / `vertical_layers` / `manual_override` / `single_pump` / `multi_pump` / `mega_pour`
- `T_WINDOW_HOURS` table (hot/normal/cold × no_retarder/with_retarder)
- `ELEMENT_DEFAULTS` per type (rimsa → adjacent_chess 20m spáry, kridla_opery → отдельный záběr)
- `working_joints_allowed` ('yes'/'no'/'unknown' → emit "ověřte v RDS" warning)

**element-scheduler.ts:**
- RCPSP greedy list scheduling: 5 узлов на záběr (ASM/REB/CON/CUR/STR), +PRE если prestress
- Edges: FS predecessors, SS-with-lag (REB начинается когда ASM 50% сделана), cross-tact set reuse (tact `t` не стартует ASM пока tact `t − num_sets` не закончил STR)
- Greedy priority: earliest start → STR before ASM (frees sets) → lower tact wins ties
- Critical path через backward pass с `unroundedEnd` (precision fix v4.24)
- Chess mode: odd-position záběry первыми, потом even с 24h cure gap
- PERT integration: `runMonteCarlo()` 10000 iterations, triangular distribution, P50/P80/P90/P95
- Curing distribution для PERT берётся из `curingThreePoint()` (физика, не generic ±X%)

**pour-task-engine.ts:**
- `effective_rate = MIN(pump, plant, mixer, site, element) × pumps_required`
- `pour_hours = volume / effective_rate + setup + washout`
- `computePourCrew()` v4.24: подкладной <20 m³ → 2, 20–80 m³ → 4, 80+ → pump-driven (без +3 řízení per ČSN 73 0212 — stavbyvedoucí monthly-salaried, считается в VRN)
- Multi-shift overflow: continuous pour > shift_h → crew relief, person-hours формула + 10% night premium

**pile-engine.ts:**
- `PILE_PRODUCTIVITY_TABLE`: Ø600/900/1200/1500 × cohesive/noncohesive/below_gwt/rock × cfa/cased/uncased
- `getDefaultRebarIndex(diameter)`: <800 → 40, 800-999 → 90, ≥1000 → 100 kg/m³
- 6 cards в UI: Vrtání / Armokoše / Betonáž / Úprava hlavy / [Hlavice] / Náklady

### 4.4 Frontend (PlannerPage)

После рефакторинга v4.13 — 4620 → 380 строк layout. Логика в `useCalculator` hook (~1300 строк) + 10 components в `components/calculator/` (Sidebar, FormFields, Result, HelpPanel, WizardHints, InlineResourcePanel, applyPlanToPositions, ui, types, helpers, TzTextInput).

**Дизайн:** Slate Minimal (`--r0-*` tokens), stone palette, DM Sans body + JetBrains Mono numbers, KPI с tinted left-border, responsive (mobile 1-col, tablet 300px sidebar, desktop 340px).

**Wizard mode (Průvodce):** inline-sidebar, 5 steps (Element → Volume+Beton → Geometry → Rebar+Resources → Záběry), engine-powered hints per step, `localStorage('planner_wizard_mode')`, keyboard nav (Enter=next, Escape=back).

**Auto-calc** (v4.1): 1.5s debounce, чистый preview без save. `calcStatus` indicator. Variants создаются ТОЛЬКО кликом "Uložit variantu". Ограничение: 10 variants per position.

**Variants (v4.15 A5):** active-variant tracking через `activeVariantId` + `activeVariantDirty` (JSON diff form vs variant.form). Бейджи "● Aktivní" / "● Upraveno", orange left-border. `VariantsComparison` component — desktop horizontal table с ★ best green, mobile cards sorted cheapest-first (через `.vc-desktop` / `.vc-mobile` @media swap). Excel export merges variants в scenarios sheet.

**TzTextInput (v4.18):** collapsible textarea выше AI panel. Debounced 500ms regex extraction (`tz-text-extractor.ts`). Smeta-line parser v4.23 — pull-based, `extractSmetaLines()` + `parseCzechNumber()` + `SmetaLine` type, поддерживает 6-digit OTSKP / 9-digit URS codes + unicode `m²`/`m³`. Числовой парсер handles "94,231" / "547,400" / "1 456,78" / "1.456,78" / "1,456.78". 28 vitest cases.

**MSS path (v4.21):** `findMssSystem(vendor)` shortcut для `construction_technology='mss'` + mostovkova_deska. Bednění card title branches по `pour_role` (🏗️ Skruž / 📦 Bednění+stojky / 🌉 Posuvná skruž MSS). Cost summary labels per pour_role. `mss_mobilization_czk + demobilization_czk` flow в formwork_labor_czk как vlastní síly tesaři.

### 4.5 Aplikovat → TOV (v4.14)

`applyPlanToPositions.ts` — splits 7 work types (Betonář, Tesař montáž, Tesař demontáž, Železář, Ošetřovatel, Specialista předpětí, Tesař podpěry) across positions:
1. URL ID → linked via prefix/name
2. Auto-create new sibling Position (POST с metadata)
3. Last-resort merge into beton

Каждая entry carries `source: 'calculator'` для per-entry [×] delete gate в FlatTOVSection. `NO_FORMWORK` set (pilota, podzemni_stena) skips bednění drafts. Backend POST `/api/positions` accepts metadata в INSERT.

---

## 5. concrete-agent (CORE) — мозг

Python FastAPI, monorepo `packages/{core-backend,core-frontend,core-shared}`.

**Подсистемы** (CLAUDE.md "Services → 1. concrete-agent"):
- **Multi-Role Expert** (4 роли: SME, ARCH, ENG, SUP — consensus → GREEN/AMBER/RED классификация)
- **Workflows A/B/C** (Import & Audit / Generate from Drawings / TZ-driven)
- **Document Accumulator** (20 endpoints, мульти-документная сборка проекта)
- **Multi-Format Parser v5.0** (XLSX / XML / PDF / DXF / OCR через mineru_service)
- **Add-Document Pipeline** (14 типов документов)
- **NKB 3-layer** (knowledge base loader, 42 JSON ~40MB)
- **NormIngestionPipeline** (chunked: L1 → chunk → per-chunk[L2+L3a] → merge → L3b)
- **NKB Audit** (15 sources)
- **Unified Item Layer** + **Soupis Assembler** + **Scenario B**
- **Section Extraction Engine v2** (28 extractors, negative-context filter)
- **Calculator Suggestions** (fact→param mapping, write-through `_PROJECT_FACTS` в memory + project cache JSON)
- **Chunked Extraction** (document_chunker + parsed_document_adapter + extraction_to_facts_bridge)
- **Drive OAuth2** + **Agents** + **Chat**
- **MCP Server v1.0** ← главный distribution channel

**LLM details:**
- Confidence ladder (см. CLAUDE.md "Conventions"): regex 1.0 / OTSKP DB 1.0 / drawing_note 0.90 / Perplexity 0.85 / URS 0.80 / AI 0.70
- Higher confidence НИКОГДА не overwriteит lower
- `_safe_search()` skips stávající/odstraněno (negative context для izolant_tl_mm и подобных)
- Vertex AI 429 → exponential backoff 3 attempts в `gemini_client.py`

---

## 6. MCP Server v1.0 — distribution moat

**Mounted at:** `/mcp` on `concrete-agent` Cloud Run.
**Stack:** FastMCP 3.x + FastAPI mount.
**Code:** `concrete-agent/packages/core-backend/app/mcp/{server,auth,routes}.py` + `tools/*.py`.

### 9 tools

| Tool | Назначение |
|------|------------|
| `find_otskp_code` | Lookup в 17 904 verified OTSKP catalog items |
| `find_urs_code` | Search via Perplexity + URS Matcher (39 000+ items) |
| `classify_construction_element` | 22 element types, internal classifier |
| `calculate_concrete_works` | 7-engine pipeline через Monolit API или fallback simplified |
| `parse_construction_budget` | XLSX (Komplet/RTSrozp), XML, Excel |
| `analyze_construction_document` | PDF через pdfplumber |
| `create_work_breakdown` | Internal otskp.py + classifier.py |
| `get_construction_advisor` | Internal classifier.py + calculator.py |
| `search_czech_construction_norms` | Perplexity + kb_loader |

### Auth + billing

- bcrypt password hashing
- API keys format: `sk-stavagent-{hex48}`
- Per-thread SQLite pool
- 200 free credits на регистрацию
- Per-tool billing: 0–20 credits per call (атомарный `UPDATE WHERE credits >= cost`)
- Rate limiting: 10 req / 60s per IP
- OAuth 2.0 `client_credentials` для ChatGPT
- REST wrappers: `/api/v1/mcp/tools/*` auto-generate OpenAPI для GPT Actions
- Billing webhook: `/api/v1/mcp/billing/webhook` (Lemon Squeezy)

### CI

`tests/test_mcp_compatibility.py` — 17 тестов, runs on every push к concrete-agent/. Workflow: `.github/workflows/test-mcp-compatibility.yml`.

**MCP compatibility rule** (CLAUDE.md "MCP Compatibility Check"): после ЛЮБОГО изменения модулей wrapped MCP tools — verify wrapper still works. Mapping table доступна в CLAUDE.md.

---

## 7. Stavagent Portal

Node.js/Express + React. ~80+ endpoints, 20 pages, 40+ components.

**Auth:** JWT 24h, 5 org roles, Stripe credits (fail-open).
**Data Pipeline admin** + CORE proxy (300s timeout, headersTimeout=310s).
**Design:** Brutalist Neumorphism, monochrome + orange `#FF9F1C`, BEM.

**Landing page v2.0** (`LandingPage.tsx`, 622 lines): 12 секций (Nav → Hero → Social proof → Pro koho → 5 Modulů → Jak to funguje → Blok důvěry → Příklad → Technologie → Ceník → FAQ → Footer). H1: "Stavební rozpočty a dokumentace pod kontrolou". Credit pricing table (15 ops). FAQ accordion (8 Q&A).

**SEO:** `index.html` имеет og:title, og:description, canonical, twitter card. Title matches AI-last философию.

**Credit system:** `add-credit-system.sql` seeds 15 operation prices (2–20 credits). 200 free на регистрации, 1 Kč = 10 credits.

---

## 8. Rozpocet-Registry — BOQ classification

React 19 + Vite + Vercel serverless. 12 endpoints, **200 vitest tests** (с v4.25 — 87 для row classifier rewrite + integration), ~17K LOC.

**11 групп** для BOQ classification, AI Classification chain: Cache → Rules → Memory → Gemini.

**TOV Modal**, **Formwork/Pump Calculators**, **Import** с fuzzy auto-detect (header keywords + normalize), per-sheet dataStartRow detection (code+MJ heuristic), reimport с skupiny preservation.

**Export:** "Vrátit do původního (ceny + skupiny)" — ZIP/XML patch, inline strings (`t="inlineStr"`), autoFilter + sheetProtection patch. Per-sheet column mapping.

**Virtualization:** @tanstack/react-virtual для 2000+ row tables, overscan=20, `display:flex` на `<tr>` с explicit `width` per `<td>`/`<th>`.

**Undo/Redo:** `undoStore.ts` (in-memory, MAX_UNDO=50) + `useUndoableActions` hook wrapping skupina/role mutations; Ctrl+Z / Ctrl+Shift+Z; toolbar above table.

**Row classifier v1.1** (v4.25.0, PR #1006 + #1008/#1009): Universal column auto-detection + Typ-column fast-path + content-heuristic fallback заменили 3-format-gated legacy classifier. Spec в `docs/ROW_CLASSIFICATION_ALGORITHM.md` v1.1. Public API `classifySheet(rows, opts)` в `services/classification/rowClassifierV2.ts`. 87 vitest tests, integration на 3 real fixtures (D6_202 EstiCon + Kyšice Komplet OTSKP + Veselí Komplet ÚRS): **482 mains + 2097 subs + 70 sections + 0 orphans across 2649 real items**. Legacy `classifyRows()` оставлен как safety net до 2-3 weeks post-merge.

**Classification round-trip** (v4.26.0): `services/classificationCodec.ts` packs 16 классифай-полей (rowRole, parentItemId, sectionId, popisDetail, `_rawCells`, originalTyp, classification confidence/source, source_format/row_index, por, cenovaSoustava, varianta, …) в versioned blob (`v: 1`) и хранит в `registry_items.sync_metadata TEXT`. **No DB migration required.**

**Flat style tokens (v4.24.1):** Part A layer добавлен в `tokens.css` рядом с Digital Concrete. `--stone-50..900`, `--orange-{100,200,500,600}`, `--accent-orange #FF9F1C → #F97316`. `--font-body` Inter → DM Sans. Lucide cross-browser fix — каждый `<IconFromLucide size={N}>` обязан pair `size` prop с Tailwind `w-[Npx] h-[Npx]` (lucide-react emits `<svg width="11">` как HTML attributes, не CSS).

**PR 2 toolbar skupiny** (v4.24.2): `<SkupinaToolbar>` поверх `ItemsTable` когда column-Skupina filter pinned to exactly one group. Surface management-only (collapse-all chevron, info badges, inline rename, two-step delete). `Sparkles` (applyToSimilar) и `Globe` (applyToAllSheets) остались на row-level (revert). `effectiveParentMap` proximity fallback в `ItemsTable.tsx:252` для orphan parentItemId.

---

## 9. URS Matcher Service

Node.js/Express + SQLite. ~45 endpoints, **159 tests**, ~10K LOC, 12 tables.

**4-phase matching**, **dual search** (36 seed + 17 904 OTSKP + Perplexity), **VZ Scraper**, **9 LLM providers** с per-request fallback.

`klasifikator.stavagent.cz` = custom domain. Vercel Edge Middleware в `frontend/middleware.js` proxies by hostname.

**Common debugging:** URS empty results → LLM timeout 90s, AbortController per-provider в `LLM_TIMEOUT_MS=90000`.

---

## 10. Конвенции и философия

### 10.1 Karpathy rules (anti-bloat) — из CLAUDE.md

- Если 200 строк можно написать за 50 — пиши за 50
- Не трогай код, не связанный с задачей
- Не добавляй "гибкость" и "конфигурируемость", о которой никто не просил
- Если не уверен — спроси, не угадывай молча
- Определи критерии успеха ДО кода, потом итерируй к их выполнению

### 10.2 Session Setup Mantra

В начале каждой сессии:
1. Проверить effort level (high/max)
2. Adaptive thinking ОТКЛЮЧЁН (`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`)
3. **Сначала читать весь репо. Потом определять naming. Потом писать.**
4. Не выдумывать имена файлов / SHA / API / пакеты — проверять через Grep/Glob/Read
5. Для STAVAGENT (1500+ commits, 22 element types, 7 engines) поверхностный анализ = баги в проде

### 10.3 Determinism > AI

Ключевое правило: **если regex может это сделать, не используй LLM.**

Confidence не overwriteится lower confidence. AI = fallback, не первый источник.

### 10.4 Stack decisions

- rozpocet-registry = Vercel + Zustand (state)
- Monolit = PostgreSQL prod / SQLite dev
- URS = SQLite + per-request LLM fallback
- CORE = Vertex AI primary + stateless
- Portal = central `portal_project_id` linking

### 10.5 Commits и branches

- Commits: `FEAT:`, `FIX:`, `REFACTOR:`, `DOCS:`, `STYLE:`, `TEST:`, `WIP:`
- Branches: `claude/<task-description>-<random5chars>`
- Husky pre-commit: 34 formula tests (~470ms)
- Husky pre-push: branch + tests

### 10.6 Domain-specific правила

- Icons: `lucide-react` only, no emojis в JSX (per-service imports, no shared registry)
- Monolit subtypes: beton, bednění, odbednění (Tesař), výztuž, jiné
- Element classifier v3: 22 types, bridge context, 5 early-exits, 7 BRIDGE_EQUIVALENT mappings
- Passport = structured tables; Shrnutí = narrative + topics + risks
- Construction sequence: bridge (pilota → římsa), building (pilota → schodiště)
- **Formwork orientation rule:** horizontal elements (strop, mostovka, základ) → skip lateral pressure, select by category+rental. Vertical (stěna, sloup, pilíř) → per-záběr pressure (`sys.pressure / full_pressure × height`, min 1.5m stage). Special (rimsa → římsový vozík, pilota → pažnice).
- **Calculator UX v4.1:** auto-calc = preview only, никаких auto-save. Variants создаются ТОЛЬКО кликом "Uložit variantu".
- **Product naming:** App 1 (root `/`) = "Monolit Planner", App 2 (`/planner`) = "Kalkulátor betonáže". НИКОГДА "Plánovač elementu" или "Kalkulátor monolitních prací".
- **SEO/noindex:** `kalkulator.stavagent.cz` имеет `<meta name="robots" content="noindex">` + `X-Robots-Tag` header в `vercel.json` (working app, не public page).

### 10.7 Git operations

- Push: `git push -u origin <branch>`, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) on network errors
- Fetch specific branches: `git fetch origin <branch>`
- НЕ создавать PR без явного запроса пользователя

---

## 11. Технические шорт-каты (Quick Debugging)

Из CLAUDE.md "Quick Debugging" — самые частые проблемы:

| Problem | Check |
|---------|-------|
| URS empty results | LLM timeout (90s), AbortController per-provider |
| Monolit wrong calc | `concrete_m3`, `unit_cost_on_m3`, KROS rounding `Math.ceil(x/50)*50` |
| CORE unavailable | Cloud Run status, `/health`, Secret Manager |
| LLM 401/404 | SA `aiplatform.user`; use `gemini-2.5-flash` (not -lite) |
| CORE Cloud Run crash | `monolit_adapter.py` singletons — lazy-init с required args |
| Monolit 403 | `portal_user_id` mismatch; JWT_SECRET matches Portal; migration 012 |
| Portal "Failed to fetch" | headersTimeout=310s в server.js |
| Vertex AI empty | `response.text` raises ValueError when blocked; wrap in try/except |
| Vertex AI 429 | Exponential backoff 3 attempts в `gemini_client.py` |
| position_instance_id NULL | All portal_positions INSERTs must use `gen_random_uuid()` explicitly |
| Registry auto-detect 0% | Keywords в `structureDetector.ts` FIELD_PATTERNS; normalize removes [CZK] |
| klasifikator.stavagent.cz → Portal | Vercel Edge Middleware в `frontend/middleware.js` proxies by hostname |
| Monolit white screen #310 | ErrorBoundary deployed на PositionsTable+KPIPanel; check `componentStack` в console |
| FK/constraint "already exists" | Portal schema+migrations используют `DO $ IF NOT EXISTS $` guards |
| Aplikovat DNY wrong | Check shared/dist rebuilt (tsc), aggregateScheduleDays в formulas.ts |
| Formwork Frami for tall element | Per-záběr pressure: `filterFormworkByPressure()` stages automatically (min 1.5m) |
| OTSKP not matching | OTSKP_RULES в element-classifier.ts; runs ПЕРЕД KEYWORD_RULES; check normalize() |
| Křídla classified as opěra | Composite suppression: если both "opěr" + "křídl" → opery_ulozne_prahy |
| Aplikovat 500 error | curing_days Math.round (INTEGER column). Error logging в PUT handler shows exact field/type |
| XLSX overwrites old project | bridge_id prefixed `stavbaProjectId__sheetBridgeId`. Hash suffix per upload |
| Wizard auto-calc fires early | Guard `wizardMode && wizardStep < 5` в auto-calc useEffect |
| Variant V1 V1 duplicate | `existingNums.length === 0 ? 1 : Math.max(...existingNums) + 1` |

---

## 12. Состояние проекта на 2026-05-03 (v4.27.0)

### Только что закрыто — Gate 2 (PR #<TBD>)

**Element classification correctness** во всех 22 → 23 element types через **Option W architectural principle** (canonical `recommended_formwork[0]` over algorithmic optimization).

**Phase 1 — golden test framework:** `Monolit-Planner/shared/src/calculators/golden-so202.test.ts` + `golden-vp4-forestina.test.ts` Vitest fixtures (11 tests baseline pre-Gap-8).

**Phase 2 — Gap #8 RESOLVED:** Top 50 + VARIOKIT HD 200 reclassified per canonical §9.1 / §9.2:
- Top 50 → `pour_role: 'formwork'` + `formwork_subtype: 'nosnikove'` (Vrstva 1 — kontaktní povrch)
- VARIOKIT HD 200 → `pour_role: 'formwork_beam'` (NEW enum, Vrstva 2 — horizontální nosníky)
- `PourRole` union expanded; `FormworkSubtype` type alias added (`'ramove' | 'nosnikove' | 'stropni' | 'beam'`)

**Phase 3 — Mostní (10 typů):** added `zaklady_oper` element type (Option α literal parallel pattern); applied **Option W principle** (canonical `recommended_formwork[0]` over algorithmic optimization) to horizontal selector + vertical selector с DIN 18218 pressure-filter safety preserved; 6-test verification regression net.

**Phase 4 — Pozemní (13 typů):** single regression net commit (12 tests) — pre-emption pattern proven: все elements auto-fixed by Option W extension, без дополнительных code changes.

**Phase 5 — closeout:** 5 commits (audit corrections + migration plan + CLAUDE.md entry + `next-session.md` + PR creation).

**Итого Gate 2:** 11 commits на `gate-2-element-classification` branch. **1036 tests passing** (was 1002 baseline pre-Gate-2, +34 new across phases). 4 golden test fixtures automated.

**Архитектурный takeaway:** **16 stop-and-ask instances** during Gate 1 + Gate 2 implementation — pattern principle: **investigative thinking before code = vastly fewer broken commits.**

References:
- `Monolit-Planner/docs/AUDIT_Podpera_Terminologie.md` (Gap #8 RESOLVED, Section 0 + A.3 + C.3)
- `Monolit-Planner/docs/MIGRATION_PLAN_GATE2_TO_GATE4.md` (Phase 1-4 DONE markers + Section 5b + Section 5d carry-forward)
- `docs/CALCULATOR_PHILOSOPHY.md` (unchanged)
- canonical doc `Section 9` (unchanged, cleanup deferred to Gate 7)

### Cost-optimization sweep (v4.26)

Cut projected GCP burn ~$70–90/mo:
- Cloud SQL `availabilityType` REGIONAL → ZONAL
- `concrete-agent` min-instances 1 → 0 (in-memory KB cache lost on cold start, accepted)
- Cloud Run old-revision cleanup across 6 services
- Artifact Registry cleanup policy `keep-last-5 + delete >30d` (~663 GB → expected 30–80 GB)
- Cloud Logging `_Default` retention 30 → 7 d

---

## 13. Открытые TODO / Backlog (selected, не полный)

### Manual actions

- [ ] `MASTER_ENCRYPTION_KEY`: `openssl rand -hex 32` → GCP Secret Manager
- [ ] `LEMONSQUEEZY_WEBHOOK_SECRET`: set в GCP Secret Manager
- [x] DB password rotated (Apr 2026) — historical string в git, но больше не валидна

### P0

- [ ] **Deploy MCP** — после merge, verify `/mcp` endpoint на Cloud Run, test с curl
- [ ] **stavagent.cz/api-access page** — registration UI, API key display, credit balance, Lemon Squeezy checkout links
- [ ] **AI advisor prompt v2 live validation** — после deploy verify SO-202 mostovka returns TKP18 §7.8.3 + curing class 4 + prestress 11d citations

### P1

- [ ] Lemon Squeezy webhook IDs — set актуальный product_id mapping в `routes.py:PRODUCT_CREDITS`
- [ ] Custom GPT в GPT Store — create GPT с Actions из `/openapi.json`
- [ ] Fix "Jen problémy" filter — `positions.js:150` inverted
- [ ] Per-záběr engine refactor — element-scheduler uses max(tact_volumes), should schedule per-záběr independently
- [ ] Migrate orphan projects — `UPDATE monolith_projects SET portal_user_id='<admin_id>' WHERE portal_user_id IS NULL`
- [ ] E2E test FORESTINA SO.01 — стропní deska 125.559 m³, ztracené bednění 1325 m², manual záběry 4x, Aplikovat → verify TOV
- [ ] Bridge formwork whitelist — AI still recommends Dokaflex для mostovka в some cases. Add backend filter `BRIDGE_FORMWORK_WHITELIST` (Framax/Top 50/Staxo)
- [ ] **Validation + warnings Phase 2** (deferred from v4.22) — parallel `warnings_structured` field, severity rendering, "Pokračovat přesto" gate, MSS-9 unification, MSS-10 context-aware XF extraction, golden test runner
- [ ] **MEGA pour Bug 5** — NEÚPLNÉ total label: structured `incomplete_reasons` field
- [ ] Cross-kiosk sync Phase 3 remaining — Portal 500 root cause
- [ ] **Smart extractor Variant B** (follow-up to v4.23) — formula parser `(0,8*0,3+1,45*0,25)*156,4 = 94.231`, cross-validation formula vs smeta quantity, UI catalog badges

### P2

- [ ] SmartInput PDF pipeline — text extractor + TzTextInput component done; next: MinerU OCR integration для uploaded PDFs, chunked extraction для long docs
- [ ] MCP listings — PR to modelcontextprotocol/servers, register on mcp.so
- [ ] Výztuž B500B + Y1860 — split rebar для prestressed (dual RebarLiteResult)
- [ ] Landing page — visual QA + /register route + SEO subpages
- [ ] Element field visibility map — full ELEMENT_FIELD_VISIBILITY config для 24 element types

### P3

- [ ] Gantt calendar — date axis в Portal mode (см. recommendation 6.2 в audit document)
- [ ] SAFE cenový katalog — add SAFE как 3rd vendor наряду с DOKA/PERI

### Product backlog (long-term)

- [ ] Export Work Packages → PostgreSQL (currently SQLite в URS)
- [ ] IFC/BIM support (needs binaries)

---

## 14. Что я НЕ знаю про проект

Честный список пробелов в моём контексте на этот момент:

- **Финансовые цифры:** конкретный MRR, runway, конверсия, churn — не в репо.
- **Конкретные клиенты:** CLAUDE.md упоминает test-data fixtures (SO-202, SO-203, SO-207, FORESTINA, VP4) — это test projects, не публичные клиенты. Не знаю кто платит сейчас.
- **Pitch deck:** есть `STAVAGENT_Master_Brief.md` reference в audit task, но в репо его нет.
- **Status MCP в production:** P0 TODO "Deploy MCP" висит — не уверен задеплоен или нет.
- **Команда:** "primary maintainer" единственное упоминание. Solo? Команда?
- **CSC 2026:** упомянут в audit task с deadline 28.06.2026 — детали не знаю.
- **Pricing model:** 1 Kč = 10 credits задокументировано, но не знаю актуальные тарифы.
- **Performance metrics:** Cloud Run cold starts, p50/p95/p99 latency — не в репо.
- **Конкретные normy текст:** TKP18 §7.8.3, ČSN EN 13670, DIN 18218 — знаю как использованы в коде, но нет полного текста норм.
- **Backend/frontend tests of Monolit:** "shared" имеет 921 тест, "backend" и "frontend" — 0. Не знаю почему.

---

## 15. Где смотреть дальше

Если нужны детали:

- **Код калькулятора:** `Monolit-Planner/shared/src/calculators/`
- **Element types & rebar matrix:** `Monolit-Planner/shared/src/classifiers/element-classifier.ts`
- **MCP server:** `concrete-agent/packages/core-backend/app/mcp/`
- **Канонические нормы (terminologie):** `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA.md` + `_Section9.md`
- **Audit terminologie (Gate 2):** `Monolit-Planner/docs/AUDIT_Podpera_Terminologie.md`
- **Migration plan Gate 2-7:** `Monolit-Planner/docs/MIGRATION_PLAN_GATE2_TO_GATE4.md`
- **Golden tests:** `Monolit-Planner/shared/src/calculators/golden-so202.test.ts`, `golden-vp4-forestina.test.ts`
- **Test data:** `test-data/tz/SO-202_D6_most_golden_test.md`
- **Per-service docs:** `concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`
- **Architecture overview:** `docs/ARCHITECTURE.md`
- **Calculator philosophy (mandatory read):** `docs/CALCULATOR_PHILOSOPHY.md`
- **Recent competitive audit:** `docs/competitive/STAVAGENT_vs_Alice_Audit_2026_05.md` (v1.0 от 2026-05-07)
- **Recent session handoffs:** `docs/SESSION_HANDOFF_2026_04_29.md`, `SYNC_AUDIT_2026_04_29.md`

---

**Конец snapshot.** Это выжимка из CLAUDE.md v4.27.0 + чтения кода 7 ключевых engines. Не подменяет CLAUDE.md как single source of truth — но даёт быстрый ориентир для нового сессии или для шаринга с со-маинтейнером.
