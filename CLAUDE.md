# CLAUDE.md - STAVAGENT System Context

**Version:** 4.19.0
**Last Updated:** 2026-04-16
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
Node.js/Express + React. **132 endpoints**, **735 tests**, **~40K LOC**.
Structure: `shared/` (735 tests, 18 files), `backend/` (0 tests), `frontend/` (0 tests). Design: Slate Minimal (`--r0-*`).
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
- **Pile pipeline (v4.16):** `shared/src/calculators/pile-engine.ts` — `PILE_PRODUCTIVITY_TABLE` (Ø600/900/1200/1500 × cohesive/noncohesive/below_gwt/rock × cfa/cased/uncased), `calculatePileDrilling()` mid-range piles/shift, drilling → 7d pause → head adjustment → optional cap, costs (rig + crane + crew + head_adj). Off-catalog Ø interpolated 1/d². 48 tests. Orchestrator early-branches via `runPilePath()` when `element_type==='pilota'`: bypasses formwork/lateral-pressure/props, populates `plan.pile`, keeps `formwork.system='Tradiční tesařské'` sentinel + 0 days so `element-audit` test suite still passes for pilota. Frontend FormState gets `pile_diameter_mm/length_m/count/geology/casing_method/rebar_index/has_pile_cap+3 cap dims`. CalculatorFormFields renders pile geometry block in step 3 only when type=pilota; CalculatorResult hides Bednění card + adds 6 PileCards (Vrtání/Armokoše/Betonáž/Úprava hlavy/[Hlavice]/Náklady); CalculatorSidebar gates "Porovnat bednění". applyPlanToPositions routes to `buildPileWorkDrafts` (vrtání + armokoše + beton kontraktor + úprava_hlavy + optional hlavice). `WorkType` union extended with 'vrtání' + 'úprava_hlavy'.
- **Calculator UX A1-A7 (v4.15):** A1 default `num_sets` 2→1 (1 sada is standard for most prvků; obrátkovost path stays for `num_identical_elements>1`). A2 Směna/Mzda labels shortened so 1fr/1fr grid renders side-by-side in 300px sidebar. A3 per-profession wages behind `use_per_profession_wages` toggle (default OFF, pre-fills with base on enable, clears on disable; LS migration sets ON for returning users with non-empty wages). A4 "Uložit variantu" button mirrored in PlannerPage header next to "?"/"Průvodce". A5 active-variant tracking: `activeVariantId` state on save/load/delete, `activeVariantDirty` derived via JSON diff of form vs variant.form, "● Aktivní"/"● Upraveno" badges + orange left-border, "Porovnat" toggle reveals VariantsComparison (desktop horizontal table with ★ best green / mobile cards sorted cheapest first via `.vc-desktop`/`.vc-mobile` @media swap), Excel export merges variants into scenarios sheet. A6 SANITY_RANGES widened: rimsa 2-200→0.5-500, pilota 1-200→0.5-600, driky_piliru 5-400→1-800, mostni_zavirne_zidky 1-20→0.3-40; soft warning copy "Neobvykle velká/malá hodnota… ověřte zadání". A7 `getSuitableSystemsForElement('rimsa')` short-circuits to recommended `['Římsové bednění T','Římsový vozík TU','Římsový vozík T']` (was returning slab/universal systems because generic loop skips `unit==='bm'`); manufacturer dropdown filter added to ComparisonTable in PlannerPage with <2-system fallback banner.
- **Calculator UX audit fixes (v4.17):** C1 zaklady_piliru orientation vertical→horizontal + estimateFormworkArea foundation-block special case. C2 maturity.ts CuringParams.exposure_class + EXPOSURE_MIN_CURING_DAYS (XF1=5d,XF3/XF4=7d,XD3=7d). C3 RECOMMENDED_EXPOSURE widened for zaklady/opery/operne/prechodova. C4 pile-engine.concrete_class echo+warning. C5 pile overpouring_m default 0.5. C6 getHeadsPerShift diameter-dependent table Ø600=5,Ø900=3,Ø1200=2,Ø1500=1.5. E2 L×W×H block for horizontal foundations (zaklady/patka/pas/opery). D1 price_mode full/schedule_only toggle. D2 Pokročilé panel default open.
- **Curing class 2/3/4 (v4.18):** `CURING_DAYS_TABLE` expanded to 3 classes × 5 temp ranges × 3 concrete groups per TKP18 §7.8.3. Class 3+ abs min 5d. `DEFAULT_CURING_CLASS`: mostovka/rimsa/rigel→4, opery/driky/zaklady/kridla/zidky/podlozkovy/operne_zdi→3, rest→2. `PlannerInput.curing_class` auto-resolved via `getDefaultCuringClass(elementType)`. FormState+UI selects (exposure_class XC1-XA2, curing_class 2/3/4/auto) in Expertní panel. `wizardHint2` passes exposure+curing — was hardcoded class 2.
- **RECOMMENDED_EXPOSURE + rebar defaults (v4.18):** opery_ulozne_prahy +XF4, driky_piliru +XF2, zaklady_piliru +XA2, mostni_zavirne_zidky new [XF4,XF3,XD1,XC4], podlozkovy_blok [XF2,XF4,XC4]. Rebar: zaklady_piliru 100→120, opery_ulozne_prahy 100→140 kg/m³. Pile `getDefaultRebarIndex(diameter)`: Ø<800→40, 800-999→90, Ø≥1000→100 kg/m³. Framax Xlife pressure 100→120 kN/m². Column formwork (SL-1, QUATTRO) h≤8m → 1 záběr exemption in `suggestPourStages`. kridla_opery recommended_formwork duplicate removed. `driky_piliru` added to geomTypes L/W/H block.
- **Catalog gap fill (v4.18):** `podkladni_beton` (rebar=0, `needs_formwork=false`, horizontal) + `podlozkovy_blok` (rebar 180, horizontal, small precision block). ELEMENT_CATALOG+ELEMENT_DEFAULTS+SANITY_RANGES+REQUIRED_FIELDS+BRIDGE_ELEMENT_ORDER+BUILDING_ELEMENT_ORDER+ELEMENT_DIMENSION_HINTS all updated. Classifier OTSKP early-exit (line 734) was force-returning 'other' for `podkladn|podkl|vyplnov` → now routes to podkladni_beton with reinforced-concrete suppression (`zelezobet|vyztuz|armovan` → 'other').
- **UI 3-layer split (v4.18):** `getSmartDefaults(element_type)` in helpers.ts maps all 24 types to typical exposure+curing+concrete. useCalculator auto-fills empty FormState fields on element_type change (preserves user overrides). CalculatorFormFields: Quick layer (type+volume+concrete in always-visible), Standard (height/geom/season), Expert (exposure/curing/cement + crews + formwork + simulation) inside renamed "Expertní parametry" collapsible. Auto-badge shows "Prostředí: XF4 (auto) · Ošetřování: třída 3 (auto) · změnit ▸" with deeplink to Expert panel.
- **Cyrillic cleanup (v4.18):** Dropdown `Příčník (ригель)` → `Příčník / hlavice pilíře`. Pour-decision comment updated. Classifier internal keyword arrays retain Cyrillic (Russian input matching — not user-facing).
- **Prestress formula v2 (v4.18):** old `prestressDays = max(5, span/10)` → `waitForStrength + stressingDays + groutingDays`. Wait = max(7, curing_days). Stressing = ceil(num_cables / {6 jednostranné, 10 oboustranné}), default 2d. Grouting = ceil(num_cables / 8), default 2d. SO-202 (12 cables, jednostranné) → 7+2+2 = 11d. New PlannerInput fields: `prestress_cables_count`, `prestress_tensioning`.
- **TZ text extractor (v4.18):** `shared/src/parsers/tz-text-extractor.ts` — regex patterns for concrete_class, exposure_class, span pattern "15+4×20+15", width/length via normalized text, volume, height, Ø diameter, cables, strands, thickness, keywords (předpjatý, jednostranné, mostovka/pilota/římsa, dvoutrám). `ExtractedParam.confidence` 1.0 regex / 0.8 heuristic (multi-match) / 0.9 fuzzy. 18 tests in `tz-text-extractor.test.ts` (SO-202 mostovka/prestress/pile excerpts + edge cases). Exported via shared/index.ts.
- **TzTextInput component (v4.18):** `components/calculator/TzTextInput.tsx` collapsible textarea above AI panel. Debounced 500ms extraction. Checkboxes per extracted param with "(jiný typ)" dim label when `ELEMENT_SPECIFIC_PARAMS` map says current element_type doesn't match (is_prestressed/span_m/num_cables → mostovka+rigel only; pile_diameter_mm → pilota). Universal params (concrete/exposure/volume/height) always applicable. `tzText` persisted in `localStorage('planner-tz-text')` — project-level state survives position navigation.
- **AI advisor prompt v2 (v4.18):** `backend/src/routes/advisor-prompt.js` extracted (pure, no express dep, testable). Structured template with conditional sections: MOSTNÍ NK (when mostovkova_deska+span/spans), PŘEDPĚTÍ (when is_prestressed), PILOTA (when pilota), GEOMETRIE (h/fwArea), JIŽ SPOČÍTÁNO ENGINE (computed_results — prevents AI from overwriting curing_days/prestress_days), KONTEXT Z TZ (tz_excerpt truncated 2000ch + cite instruction), EXTRAHOVANÉ PARAMETRY. Response JSON extended: key_points[], risks[], norms_referenced[]. 5 Jest tests in backend/tests/routes/planner-advisor.test.js (mostovka/pilota/základ/backward compat/truncation). POST handler destructures 20+ enriched fields; KB research + multi-role context enriched with exposure/curing.
- **AI advisor frontend fixes (v4.18):** Raw prompt echo detection (keywords `ODPOVĚZ POUZE VALIDNÍM JSON`, `KONTEXT POZICE:`) → friendly error instead of template display. JSON parse with schema validation (must have pour_mode or klicove_body or reasoning). KB productivity norms `[object Object]` → nested objects via JSON.stringify instead of String(). AI button disabled when volume_m3=0 or type/concrete empty + hint text. `fetchAdvisor` payload includes `calculator_context` (20+ fields), `tz_excerpt`, `computed_results` (total_days/curing_days/prestress_days/num_tacts when result exists).
- **Cross-kiosk sync fix (v4.17):** Phase 11 migration adds portal_project_id+registry_project_id columns on bridges+monolith_projects with indexes. positions.js POST handler 5-step dedup lookup (exact bridge→portal+registry pair→portal only→registry only→auto-create). applyPlanToPositions forwards portal/registry ids in POST body. useCalculator reads portal_project/registry_project from URL params. Registry backendSync pushProjectToBackend simplified to POST UPSERT (no GET-first 404 noise), debounce 5→2s, beforeunload keepalive flush. Registry ImportModal duplicate-name dialog (Aktualizovat/Nový) on import. BackendSyncBadge component shows idle/pending/syncing/synced/offline/error next to "Projekty" title. Portal integration.js catch unwrapped: PG error codes → 409/400/500 with structured response body. Registry portalAutoSync parses structured error.
- **SO202 Calculator Audit (v4.17):** 24 bugs identified across mostovka+opěry+pilíře+piloty. Golden test data in `test-data/tz/SO-202_D6_most_golden_test.md`. Key finding: curing_class 2/3/4 not implemented (maturity.ts only has ~třída 2 values) → NK třída 4 @15°C returns 5d vs TZ 9d. XF4 missing from opery_ulozne_prahy RECOMMENDED_EXPOSURE, XF2 missing from driky_piliru. Pile rebar default 40 kg/m³ is 50% below real for bridge Ø900 (80-100).
- **Mostovka audit fix pack (v4.19):** 13 fixes across 6 categories from live SO-202 test on kalkulator.stavagent.cz. A1 split `height_m` (prop height 4–20 m) from new `deck_thickness_m` (cross-section 0.3–2.5 m) — `SanityRanges` + `PlannerInput` + `FormState` + UI field added; deck_thickness auto-derived from `volume/(span×num_spans×nk_width)` when omitted. B1 moved `calculateProps` to new section 7a0 BEFORE `scheduleElement`; `schedAssemblyDays = formwork_asm + props_asm` and `schedStrippingDays = formwork_str + props_str` (tesaři do both trades so the critical path reflects one crew, not two parallel tracks). B2 "Doporučeno ~X tesařů pro Y m² / 2 dny" derived hint in crew sidebar mirrors the rebar hint; 0.6 Nh/m² catalog avg. B3 "Betonáři / záběr: X doporučeno" Row in Betonáž card (rule of thumb `ceil(tact_vol/20)` floored 3 capped 10) + rostered/simultaneous split from `plan.resources.pour_*_headcount` when crew-relief active. C1 per-tact continuous-pour warning fires for mostovka even in sectional mode (záběr mostovky nesmí přerušit → crew relief + §116 ZP noční). C2 `pour_window_h` surfaced as Row in Betonáž card with "(nevejde se — více úseků)" suffix. D1 orchestrator warning for missing height on mostovka prefixed "🚨 KRITICKÉ:" + souhrn renders disabled "Podpěry — zadejte výšku" placeholder rows in amber. E2 trámový/dvoutrámový/vícetrámový subtype adds 6h technological pauza to concreteDays (2-fáze pour); warning quotes the delta. E3 prestress trace spells out wait(max{7,curing})+stressing(cables/method)+grouting decomposition. F1 "Parametry mostu" grid gets `alignItems:'end'` baseline. F2 "↳ Tesařské práce (bednění + podpěry)" subtotal row in souhrn groups the same-crew work. 10 new vitest cases cover A1 (5), B1 (3), E2 (2). 797 → 807 shared tests; frontend tsc clean. G (MSS whitelist + per-takt Nhod + rental=0) deferred to follow-up task.
- **AI classifier checkbox removed (v4.16):** the "Klasifikace podle názvu (AI)" checkbox in CalculatorSidebar was misleading — `classifyElement()` is regex+OTSKP keyword matching (not LLM) and runs unconditionally on position-context load. Checkbox + `element_name` text input + `use_name_classification`/`element_name` FormState fields all removed; ~30 `form.use_name_classification ? 'other' : form.element_type` ternaries collapsed across CalculatorSidebar/CalculatorFormFields/useCalculator. Position-context auto-classification path (`useCalculator.initialForm` → `classifyElement(part_name)`) untouched; OTSKP/keywords badge below the dropdown still surfaces source + confidence. PlannerPage `AI_CLASSIFIER_AUDIT` (DEV-only console.log) marked RESOLVED. AI_ADVISOR_AUDIT (B2) confirms `/api/planner-advisor` IS real LLM via Core `/api/v1/multi-role/ask` (concrete_specialist) + `/api/v1/kb/research` + methvin productivity norms; sees only form fields, no document context, no integration tests.
- **Planner Variants:** `planner_variants` table (position_id FK, input_params JSON, calc_result JSON, is_plan flag). REST: GET/POST/PUT/DELETE `/api/planner-variants`. Max 10/position. `setAsPlan()` clears others. Mode A: DB; Mode B: in-memory. Auto-restore plán on entry. Numbering: `Math.max(existingNums) + 1`.
- **Auto-calc (v4.1):** 1.5s debounce, pure preview (no save). `calcStatus` indicator above KPIs. No save prompt, no autosave checkbox. Variants created ONLY by explicit "Uložit variantu" click. Wizard guard: skip steps 1-4.
- **Průvodce (Wizard):** Inline sidebar mode (`wizardMode` + `wizardStep` 1-5). Same form state. `display:none` on sections. Steps: Element→Volume+Beton→Geometry→Rebar+Resources→Záběry. Engine-powered hints per step (maturity, lateral pressure, rebar PERT). `localStorage('planner_wizard_mode')`. Keyboard: Enter=next, Escape=back.
- **Calculator refactor (v4.13):** PlannerPage 4620→380 lines. State/logic in `useCalculator` hook (~1300 lines). Split: `CalculatorSidebar.tsx`, `CalculatorFormFields.tsx`, `CalculatorResult.tsx`, `ui.tsx`, `types.ts`, `helpers.ts`, `TzTextInput.tsx`. Design unified: stone palette, DM Sans body + JetBrains Mono numbers, KPI left-border tinted bg, responsive (mobile 1-col, tablet sidebar 300px, desktop 340px), inputs 16px on mobile.
- **Pilota formwork fix:** `recommendFormwork()` has special case for `pilota` — skip pressure filter, return `Tradiční tesařské` (bored pile uses pažnice/tremie). Special cases: rimsa → Římsové bednění T, mostovka >5m → Staxo 100, pilota → catalog recommendation.
- **Block A — hierarchy (v4.14):** FormState `has_dilatation_joints` + `num_dilatation_sections` + `tacts_per_section_mode/manual` replace legacy `tact_mode`/`has_dilatacni_spary`/`num_tacts_override` pair. Orchestrator pre-computes `totalTacts = numSections × tactsPerSection` before `decidePourMode`; routes through existing override path so Block D pump rebuild + Block C working_joints warnings compose. LS_FORM_KEY bumped `planner-form` → `planner-form-v2` (clean start). UI: one sequence "Členění konstrukce" replaces two tabs. Live preview "X celků × Y záběrů = Z celkem".
- **Pour mode (Block A-F, v4.14):** `has_dilatation_joints`+`num_dilatation_sections`+`tacts_per_section_mode` replace legacy tact_mode. Block C: `working_joints_allowed` default=unknown→sectional+warning; 'no'→monolithic. Block D: override recomputes pour_hours_per_tact. Block E: variants reuse labor verbatim, recompute rental only. Block F: crew>tacts warnings. Dual pump scenarios (actual + target). DIN 18218 `concrete_consistency` k-factor: standard=0.85, plastic=1.0, scc=1.5. Framax wins over short-panel on tall piers.
- **Manufacturer pre-filter (v4.14):** `preferred_manufacturer` dropdown (DOKA/PERI/ULMA/NOE/Místní). Auto path filters pool by vendor before pressure check; empty pool → fallback + warning.
- **Expert hints:** `WizardHintsPanel` with MissingFields+Sanity+Technology. `ReviewHint` above "Vypočítat plán" button. "Podpěry nelze spočítat" warning when supports needed but height_m≤0. PERT row under KPI. `HelpPanel.tsx` 3-column (pipeline/math/norms) auto-shown on first visit. Čety terminology (ne Brigády).
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
- **Backend sync (v4.17):** `backendSync.ts` pushes IndexedDB projects to `rozpocet-registry-backend` PostgreSQL via UPSERT POST (no GET-first 404 noise). Debounce 2s + beforeunload keepalive flush for project header. `BackendSyncBadge.tsx` renders idle/pending/syncing/synced/offline/error pill next to "Projekty" title via module-level pub/sub (subscribeBackendSync). `portalAutoSync.ts` parses structured Portal error bodies (409/400/500 with error_type+constraint+column).
- **Import dedupe (v4.17):** `ImportModal.tsx` resolveDuplicate() checks existing projects by projectName (case-insensitive). Dialog "AKTUALIZOVAT existující / VYTVOŘIT NOVÝ" before addProject(). Prevents N× duplicate imports of same Excel.

## Totals

| Service | Endpoints | Tests | LOC |
|---------|-----------|-------|-----|
| concrete-agent | 120 | 34 files | ~61K |
| stavagent-portal | ~82 | 1 file | ~26K |
| Monolit-Planner | 132 | 807+5 | ~43K |
| URS_MATCHER_SERVICE | ~45 | 159 | ~10K |
| rozpocet-registry | 12 | 0 | ~16K |
| **TOTAL** | **~391** | **944+** | **~152K** |

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

## Session Setup — Effort & Thinking

**ОБЯЗАТЕЛЬНО в начале каждой сессии:**

1. Проверь effort level: должен быть `high` или `max`. Если `medium` / `low` → `/effort high`.
2. Adaptive thinking должен быть ОТКЛЮЧЁН (`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` в `~/.claude/settings.json` env).
3. Перед любым изменением кода — ПРОЧИТАЙ контекст. Мантра: «Сначала читаешь весь репо. Потом определяешь naming. Потом пишешь.»
4. Если не уверен в имени файла, SHA, API или пакете — ПРОВЕРЬ через Grep / Glob / Read. Никогда не фабрикуй пути, коммиты, имена.
5. Для STAVAGENT (1500+ commits, 22 element types, 7 engines) поверхностный анализ = баги в проде. Думай глубоко.

**Reference settings.json (user owns this file, не Claude Code):**
```json
{
  "effortLevel": "high",
  "env": {
    "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "400000"
  }
}
```
> ⚠️ Эти ключи не верифицированы против актуальной Claude Code docs — если харнес их игнорирует, проверь `/help` или попроси Claude настроить SessionStart hook вместо этого.

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
- [ ] **P0: AI advisor prompt v2 live validation** — after deploy, verify SO-202 mostovka returns TKP18 §7.8.3 + curing class 4 + prestress 11d citations. Gemini `response_mime_type: application/json` not yet enabled in Core `/api/v1/multi-role/ask` — if JSON parse fails repeatedly, add force-JSON on provider side.
- [ ] **P1: Lemon Squeezy webhook IDs** — set actual product_id mapping in `routes.py:PRODUCT_CREDITS`
- [ ] **P1: Custom GPT in GPT Store** — create GPT with Actions from `/openapi.json`, verify domain
- [ ] **P1: Fix "Jen problémy" filter** — `positions.js:150` inverted: `!p.has_rfi` should be `p.has_rfi`
- [ ] **P1: Per-záběr engine refactor** — element-scheduler uses max(tact_volumes) as bottleneck, should schedule per-záběr independently
- [ ] **P1: Migrate orphan projects** — `UPDATE monolith_projects SET portal_user_id='<admin_id>' WHERE portal_user_id IS NULL`
- [ ] **P1: E2E test FORESTINA SO.01** — stropní deska 125.559 m³, ztracené bednění 1325 m², manual záběry 4x, Aplikovat → verify TOV
- [ ] **P1: Prestress formula v2 refinement** — wait+stressing+grouting implemented for SO-202 (11d). Validate SO-203 (16 cables oboustranné) and SO-207 (spojkování per-takt MSS).
- [ ] **P1: Bridge formwork whitelist** — AI still recommends Dokaflex for mostovka in some cases. Add backend filter `BRIDGE_FORMWORK_WHITELIST` (Framax/Top 50/Staxo) applied when element_type∈{mostovkova_deska, rimsa}.
- [ ] **P1: Mostovka MSS category G (deferred from v4.19)** — when `construction_technology='mss'`, (1) override the regular formwork recommendation to a "Součást MSS" sentinel so the Dokaflex/Framax auto-pick is not shown as separate cost, (2) zero out `formworkRentalCZK` and `propsRentalCZK` (bundled in MSS mobilization + monthly rental), (3) replace per-takt assembly/stripping time with MSS přemontáž Nhod (~35 % of full mount). Currently `calculateMSSCost` runs in parallel but the regular formwork/props cost stacks on top → double-counted for MSS projects.
- [ ] **P1: Cross-kiosk sync Phase 3 remaining** — Portal 500 root cause (integration.js structured errors done, DB constraint unknown).
- [ ] **P2: SmartInput PDF pipeline** — text extractor + TzTextInput component done (v4.18). Next: MinerU OCR integration for uploaded PDFs, chunked extraction for long docs, cross-document fusion.
- [ ] **P2: MCP listings** — PR to modelcontextprotocol/servers, register on mcp.so
- [ ] **P2: Výztuž B500B + Y1860** — split rebar for prestressed (dual RebarLiteResult)
- [ ] **P2: Landing page — visual QA + /register route + SEO subpages**
- [ ] **P2: Element field visibility map** — full ELEMENT_FIELD_VISIBILITY config for 24 element types
- [ ] **P3: Gantt calendar** — date axis in Portal mode
- [ ] **P3: SAFE cenový katalog** — add SAFE as 3rd vendor alongside DOKA/PERI

### Product Backlog
- [ ] Export Work Packages → PostgreSQL (currently SQLite in URS)
- [ ] IFC/BIM support (needs binaries)

---

**Per-service docs:** `concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`, `docs/STAVAGENT_CONTRACT.md`
