# FINDINGS — SmartExtractor Variant B (Phase 0, partial)

**Date:** 2026-05-10
**Branch:** `claude/smartextractor-phase0-findings`
**Status:** Discovery dump — NOT a polished audit. Session was halted before the formal `AUDIT_SmartExtractor_VariantB.md` was written.
**Source:** Two parallel Explore agents + direct file reads on `claude/smartextractor-variant-b-v2-Ot8BT` working tree.
**Scope of this dump:** Raw facts about what already exists in the repo that the Variant B task will need to extend or integrate with. No design proposals.

---

## 0. Headline facts (read this first)

1. **Variant A extractor lives at `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts`** (604 lines, 629-line test file). Exports `extractFromText`, `extractSmetaLines`, `parseCzechNumber`, types `ExtractedParam` / `SmetaLine` / `ExtractOptions`. Confidence model is already numeric 0–1, source-tagged, with an `alternatives` field for conflict picker — Task 3 of the previous arc (2026-04-20) shipped this.
2. **No formula parser exists.** No `mathjs` / `expr-eval` / `Function(...)` / `eval(` anywhere in `Monolit-Planner/shared/src/`. The smeta-line regex was intentionally written with a lookahead (`(?=[\s,;]|$)`) so a trailing VV formula like `"5,654    94,231*0,06"` is NOT swallowed — formulas are recognised, then ignored. `Monolit-Planner/shared/package.json` has ZERO runtime deps (only `typescript` + `vitest` devDeps). Adding a parser = new dependency decision.
3. **Vision capability already works** in `concrete-agent/packages/core-backend/`. Claude (`app/core/claude_client.py`), GPT-4 (`app/core/gpt4_client.py`), Bedrock, and Vertex Gemini clients all build base64 image content blocks. But `analyze_construction_document` MCP tool (`app/mcp/tools/document.py`) currently uses **pdfplumber text only** — vision is not wired into any MCP tool yet.
4. **9 MCP tools registered**, pattern is trivial: new tool = new file in `app/mcp/tools/*.py` + import + `mcp.tool()(...)` in `app/mcp/server.py` + entry in `TOOL_COSTS` dict (`app/mcp/auth.py:34`). Optional REST wrapper in `app/mcp/routes.py`. Failure mode on insufficient credits = HTTP 402.
5. **Golden tests for SO-202 / SO-203 / SO-207 exist** at `test-data/tz/*.md` (flat — NO `bridges/` subfolder; the master task doc cited the wrong path). They're markdown documentation, not YAML-driven runners. The closest thing to a golden runner is `concrete-agent/packages/core-backend/tests/test_mcp_golden_so202.py` (pytest-style, hits `mcp_server.call_tool("calculate_concrete_works", ...)`, 9 validation rules, 280 lines).
6. **Three of the five golden source documents are NOT in the repo:** SO-250 (Žalmanov), Libuše TZ PDF, SO-220 (biokoridor). The Libuše BOQ xlsx (`unprotect_BS Libuše_Vykaz vymer R01_DMG Stav.xlsx`) IS present in `rozpocet-registry/docs/`, but the TZ technická-zpráva PDF is not. VP4 FORESTINA source = inline test fixture in `tz-text-extractor.test.ts:206-298`, no standalone file.
7. **Classifier has 24 element types**, not 22 as the task doc and CLAUDE.md memory claim. Counted from `Monolit-Planner/shared/src/calculators/pour-decision.ts:45-71` (union) and `Monolit-Planner/shared/src/classifiers/element-classifier.ts:117-521` (`ELEMENT_CATALOG` keys, 24 entries including `other`).
8. **Feature flags = two parallel systems.** Frontend uses `import.meta.env.VITE_*` for deploy-time flags (`VITE_ADMIN_MODE`, `VITE_API_URL`, etc.). Shared package uses a homegrown `FEATURE_FLAGS` boolean dict at `Monolit-Planner/shared/src/constants.ts:21-27` (currently only `FF_AI_DAYS_SUGGEST: true` is on). Backend / MCP server uses raw env vars via `os.getenv()` and `settings.*` (pydantic-settings).

---

## 1. Variant A extractor — verified facts

### 1.1 File + exports

**File:** `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts` (604 lines)
**Test file:** `Monolit-Planner/shared/src/parsers/tz-text-extractor.test.ts` (629 lines, vitest)

| Export | Line | Purpose |
|---|---|---|
| `extractFromText(text, options?): ExtractedParam[]` | 325–604 | Top-level entry. Smeta-pass → regex-pass → keyword-pass, sort by confidence DESC. |
| `extractSmetaLines(text): SmetaLine[]` | 179–228 | OTSKP/URS line parser. Two passes: with-code (6/9 digit) + codeless (description + qty + unit). |
| `parseCzechNumber(s): number` | 102–123 | Czech decimal `,` + space thousands + EU/US mixed. Rightmost separator wins as decimal. |
| `ExtractedParam` (type) | 28–57 | `{ name, value, label_cs, confidence, source, matched_text, catalog?, code?, alternatives? }` |
| `SmetaLine` (type) | 60–75 | `{ code, catalog, work_type, description, unit, quantity, raw_line }` |
| `ExtractOptions` (type) | 77–80 | `{ element_type?: string }` |

### 1.2 SMETA_LINE_RE

```
^[\t ]*(\d{6}|\d{9})[\t ]+([^\n]+?)[\t ]+(m3|m2|m²|m³|mb|bm|ks|kg|m|t)(?=[\s,;]|$)[\t ]+([0-9]+(?:[.,][0-9]+)?)
```
Defined at `tz-text-extractor.ts:138-139`. Captures: code, description, unit, quantity. Unicode `m²`/`m³` handled. Quantity is ONE numeric token — the `(?=[\s,;]|$)` lookahead on unit + the `[\t ]+` between unit and quantity together prevent the trailing VV formula from getting swallowed (see `5,654    94,231*0,06` case in test fixture).

A second regex `CODELESS_SMETA_LINE_RE` at line 158-159 handles "description + qty + unit" pasted lines (Czech KROS export order) — rejected if `detectWorkTypeFromName(desc)` returns `'unknown'`.

### 1.3 Confidence model — actual values in code

Numeric 0–1, per-param. Sort by `confidence DESC` at line 602.

| Source | Confidence | Where |
|---|---|---|
| `smeta_line` (regex-matched OTSKP/URS line) | 1.0 | `:299` |
| `regex` single concrete class | 1.0 | `:349` |
| `regex` single exposure class | 1.0 | `:414` |
| `regex` span pattern, width, length, diameter, cables, strands, thickness, rebar ratio | 1.0 | `:432-541` |
| `regex` fallback (volume without code, height) | 0.9 | `:477, :488` |
| `heuristic` multiple concrete classes (collapse to highest) | 0.8 | `:363` |
| `heuristic` multiple exposure classes (collapse to most restrictive) | 0.8 | `:414` |
| `keyword` element_type detection | 0.9 | `:572, :577, :582, :588` |
| `keyword` prestressed, tensioning side, dvoutrám subtype | 1.0 | `:551, :558, :564, :596` |

### 1.4 Provenance fields already present

`ExtractedParam` carries: `source` (enum), `matched_text` (raw substring), `catalog` (otskp/urs/unknown — smeta only), `code` (the OTSKP/URS that produced the value — smeta only), `alternatives` (competing values).

There is NO `source_location` (offset / page / bbox) field. Task spec asked for one. Would be an additive extension to the type.

`source` enum currently: `'regex' | 'keyword' | 'heuristic' | 'smeta_line'`. Task spec proposed `'regex' | 'formula' | 'catalog' | 'vision' | 'llm' | 'manual'`. The two enums overlap but don't match — discussion needed before any code goes in.

### 1.5 Consumer pipeline (frontend)

**Primary consumer:** `Monolit-Planner/frontend/src/components/calculator/TzTextInput.tsx` (645 lines).

Flow:
1. User pastes TZ text into textarea. Debounced 500ms.
2. Calls `extractFromText(combinedText, { element_type: form.element_type })`.
3. Triage into 4 buckets — `locked` (Task 1 parent-context lock) / `incompatible` (calls `explainIncompatibility()` from classifier) / `conflict` (param has `alternatives`) / `already_filled` (Doplnit-mode default).
4. Per-param checkbox UI; conflict picker for `alternatives`.
5. "Aplikovat" button → `writeParamToForm()` switch statement at `:98-131` maps each known param name to a `FormState[K]` update.
6. History panel logs last 5 applies (`{ method, added, kept, conflicts, ignored }`) per position via `tzStorage.ts`.

`writeParamToForm` switch covers 16 form-state fields. Anything not in the switch is "informational only" (rendered as a hint, not written).

---

## 2. Classifier + position-linking

### 2.1 Element classifier

**File:** `Monolit-Planner/shared/src/classifiers/element-classifier.ts` (1828 lines).
**Test file:** same dir, `element-classifier.test.ts` (867 lines).
**Public API:** `classifyElement(name: string, context?: ClassificationContext): ElementProfile` at line 813.

`ClassificationContext` = `{ is_bridge?: boolean }` only (single field, line 800-804). Task spec's `object_context` enum (`pozemni_stavba`, `bridge_overpass_biokoridor`, `transport_infrastructure`) does NOT exist — would be a new field on this interface.

Bridge-context handling: `BRIDGE_EQUIVALENT` map at `:790-798` rewrites `sloup→driky_piliru`, `stena→operne_zdi`, `stropni_deska→mostovkova_deska`, `pruvlak→rigel`, foundation variants → `zaklady_piliru` — but ONLY when `context.is_bridge === true`. The classifier itself does NOT detect SO-xxx prefix; the caller must set the flag.

### 2.2 The 24 element types (NOT 22)

From `pour-decision.ts:45-71` union (canonical) + `element-classifier.ts:117-521` `ELEMENT_CATALOG` keys (matches):

**Bridge group (12):** `zaklady_piliru`, `driky_piliru`, `rimsa`, `operne_zdi`, `mostovkova_deska`, `rigel`, `opery_ulozne_prahy`, `kridla_opery`, `mostni_zavirne_zidky`, `prechodova_deska`, `podkladni_beton`, `podlozkovy_blok`.
**Building group (11):** `zakladova_deska`, `zakladovy_pas`, `zakladova_patka`, `stropni_deska`, `stena`, `sloup`, `pruvlak`, `schodiste`, `nadrz`, `podzemni_stena`, `pilota`.
**Catch-all (1):** `other`.

CLAUDE.md and master task both say "22 types". Drift, not in scope to fix here — flagged.

### 2.3 Position linking helper

**File:** `Monolit-Planner/shared/src/calculators/position-linking.ts` (352 lines).

| Function | Line | Behavior |
|---|---|---|
| `detectCatalog(code)` | 108-114 | 6 digits → `'otskp'`, 9 digits → `'urs'`, else `'unknown'`. |
| `getCodePrefix(code)` | 119-124 | First 4 digits of code or null. |
| `detectWorkType(code)` | 131-158 | OTSKP d5: 1/2/3 → beton, 6 → výztuž, 7 → předpětí. URS d5: 2 → beton, 5 → bednění (suffix-disambiguated zřízení/odstranění), 6 → výztuž. |
| `detectWorkTypeFromName(name)` | 324-352 | 7 keyword regexes, "specific first" order: předpětí → bednění_odstranění → bednění_zřízení → podpěry → zrání → výztuž → beton. Returns `'unknown'` if none. |

`WorkType` enum at line 20-30 has 11 members including `'vrtání'` and `'úprava_hlavy'` (pile-specific, added 2026-04-15).

### 2.4 Compatibility helpers

`element-classifier.ts` exports (line numbers approximate — agent did not capture exactly):
- `isParamCompatibleWith(param_name, element_type): boolean`
- `explainIncompatibility(param_name, element_type): string | null`

Returns Czech reason text like `"Parametr mostní nosné konstrukce — nepoužije se pro „Základy pilířů / patky"."` when a span_m is asked of a foundation element. Already consumed by `TzTextInput.tsx` for the "incompatible" bucket.

---

## 3. MCP server — verified facts

### 3.1 Layout

**Server entry:** `concrete-agent/packages/core-backend/app/mcp/server.py:23-94`. `FastMCP("STAVAGENT", instructions=…)` instantiated at line 23-31. Tools registered sequentially via `mcp.tool()(<imported_func>)` — no decorator on the tool function itself, registration is one-liner imports + applies.

**FastAPI mount:** `app/main.py:69-84`. `mcp.http_app()` mounted at `/mcp`. REST wrappers under `/api/v1/mcp/`. Logs `🔌 MCP server mounted at /mcp (9 tools)`.

**Auth:** `app/mcp/auth.py`. SQLite key store with WAL mode (`mcp_keys.db`). bcrypt password hashing. Per-IP rate limiting (10/60s in-memory token bucket). API key format `sk-stavagent-{hex48}`.

### 3.2 The 9 tools

| # | Tool | File | Cost | Calls |
|---|---|---|---|---|
| 1 | `find_otskp_code` | `tools/otskp.py:136-222` | 0 | Local OTSKP XML / SQLite (~17k items) |
| 2 | `find_urs_code` | `tools/urs.py:19-187` | 3 | Perplexity HTTP + URS_MATCHER_SERVICE |
| 3 | `classify_construction_element` | `tools/classifier.py:290-344` | 0 | In-process regex (own copy, not the TS classifier) |
| 4 | `calculate_concrete_works` | `tools/calculator.py:1-100+` | 5 | In-process formulas (DIN 18218 etc.) |
| 5 | `parse_construction_budget` | `tools/budget.py:17-110+` | 5 | Existing Excel parsers (Komplet/RTS/OTSKP detection) |
| 6 | `analyze_construction_document` | `tools/document.py:36-206` | 10 | **pdfplumber + 11 regex patterns** — NO vision call here |
| 7 | `create_work_breakdown` | `tools/breakdown.py:47-100+` | 20 | Orchestrates classify + OTSKP match |
| 8 | `get_construction_advisor` | `tools/advisor.py:19-100+` | 3 | classifier + calculator + KB (methvin / DIN) |
| 9 | `search_czech_construction_norms` | `tools/norms.py:69-80+` | 1 | Perplexity (curated Czech sources) |

`TOOL_COSTS` dict at `auth.py:34-44`. Atomic credit deduction at `auth.py:223-229` (`UPDATE … WHERE credits >= cost`, rowcount=0 → 402). Logged to `mcp_credit_log` table at `:263-268`. 200 free credits on registration (`FREE_CREDITS = 200` at `:46`).

### 3.3 REST wrappers + OpenAPI

6 REST routes in `app/mcp/routes.py:190-327`:
- `GET /api/v1/mcp/tools/otskp` (free)
- `GET /api/v1/mcp/tools/classify` (free)
- `POST /api/v1/mcp/tools/calculate` (5 cr)
- `POST /api/v1/mcp/tools/breakdown` (20 cr)
- `GET /api/v1/mcp/tools/norms` (1 cr)
- `POST /api/v1/mcp/tools/advisor` (3 cr)

Three of the nine tools (urs, parse_construction_budget, analyze_construction_document) have NO REST wrapper today. Auth pattern at `:234-237`: `_extract_bearer` → `mcp_auth.check_credits()` → 402 on insufficient.

OpenAPI = auto-generated from FastAPI Pydantic models at `/openapi.json`. No standalone manifest file. No `.well-known/mcp`.

### 3.4 LLM provider chain

**File:** `concrete-agent/packages/core-backend/app/services/provider_router.py:1-150+`. `TaskType` enum + `TASK_PROVIDER_MAP` dict at `:26-90`.

Chain by task:
- CLASSIFY: Vertex Gemini Flash → Bedrock Haiku → Gemini API → Grok → Deepseek
- EXTRACT: Bedrock Sonnet → Claude 4.6 → Vertex Gemini → Gemini API → DeepSeek
- VERIFY_UNKNOWN: Perplexity Sonar first
- HEAVY_ANALYSIS: Vertex Gemini Pro → Bedrock Sonnet → Claude 4.6 → DeepSeek → Grok

Dispatcher at `:93-132`. `detect_available_providers()` at `:135+` checks `K_SERVICE` env (Cloud Run flag) and `GOOGLE_PROJECT_ID` to gate Vertex.

### 3.5 Vision — what exists

| Client | File | Vision support |
|---|---|---|
| Anthropic SDK | `app/core/claude_client.py:1-206` | YES — base64 image content blocks, line 161 + 169-176 + 187-189. Model via `settings.CLAUDE_MODEL` env. |
| OpenAI SDK | `app/core/gpt4_client.py:54-134` | YES — `_encode_image()` at `:54-65`, image MIME mapping `:67-85`, `analyze_drawing_with_ocr()` `:87-134`. Model hardcoded `"gpt-4.1"`. |
| Bedrock | `app/core/bedrock_client.py` | Listed as supporting images by agent; not verified line-by-line. |
| Vertex Gemini | `app/core/vertex_gemini_client.py` | Listed; not verified line-by-line. |

What is missing for the Variant B vision tool: (a) no PDF→PNG pipeline anywhere (would need `pdf2image` or call MinerU); (b) no MCP tool wrapping a vision call; (c) `analyze_construction_document` does NOT invoke any LLM — pure pdfplumber text + regex.

### 3.6 MinerU client

**File:** `app/core/mineru_client.py`. Class `MinerUClient` at `:16-57+`. Availability check tries `from mineru.cli import cli` and the `/usr/bin/mineru` binary. Method `parse_pdf_estimate(pdf_path) → dict` returns `{positions, totals, metadata}`. Importable as `from app.core.mineru_client import MinerUClient`, but NOT registered as an MCP tool. Separate Cloud Run service `mineru_service/` (europe-west1, port 8080) exists per CLAUDE.md but the Python client wraps the in-process binary, not the HTTP service.

### 3.7 MCP compatibility test

**File:** `concrete-agent/packages/core-backend/tests/test_mcp_compatibility.py`. 15+ tests. Verifies (a) server imports, (b) all 9 expected tool names registered, no extras, (c) per-tool happy-path call. **Hits real APIs** (no provider mocks) — Perplexity / Bedrock secrets required to run green. Run via `pytest tests/test_mcp_compatibility.py -v`.

---

## 4. Golden tests — verified inventory

### 4.1 Present in `test-data/tz/`

```
test-data/tz/SO-202_D6_most_golden_test.md
test-data/tz/SO-203_D6_most_golden_test_v2.md
test-data/tz/SO-207_D6_estakada_golden_test_v2.md
```

No `bridges/` subfolder. Master task doc cited path `test-data/tz/bridges/SO-202_D6_most_golden_test.md` — wrong.

Format: human-readable markdown tables with element-type mappings, golden numbers (pile counts, concrete classes, exposure classes per construction element). Not YAML, not feedable to any runner directly. SO-202 file is 150+ lines; embeds a VP4 smeta excerpt at the bottom for live-bug reproduction.

### 4.2 Python golden runner

**File:** `concrete-agent/packages/core-backend/tests/test_mcp_golden_so202.py` (280 lines). Pytest-based. Calls `mcp_server.call_tool("calculate_concrete_works", {…})` with hand-coded inputs. Asserts on returned `structured_content` for 9 rules — NK curing ≥ 9d (class 4 @ 15°C), rímsa curing ≥ 9d, substructure ≥ 4d, XF4 floor ≥ 7d, pilota has no formwork card, Ø900 rebar ≥ 80 kg/m³, prestressed adds ≥ 11d, deck suggests fixed scaffolding for span=20m, classifier detects bridge context.

NOT a CLI runner. NOT data-driven. NO equivalent for SO-203, SO-207, or any of the 5 new Variant B goldens.

### 4.3 Vitest fixtures

`tz-text-extractor.test.ts` at line 206-298 embeds VP4 FORESTINA as hardcoded `VP4_SMETA` and `VP4_TEXT` constants. This is the only place VP4 lives in the repo — there is no standalone xlsx or markdown for it.

### 4.4 Source documents for the 5 Variant B goldens

| Golden | TZ source needed | Repo status |
|---|---|---|
| #1 VP4 FORESTINA | smeta only (no full TZ doc) | Present as inline fixture in `tz-text-extractor.test.ts:206-298` |
| #2 SO-202 D6 most | TZ + golden | Golden md present (`test-data/tz/SO-202_D6_most_golden_test.md`). TZ PDF absent. BOQ xlsx present at `rozpocet-registry/docs/TEST__ROZPOČET__D6_202.xlsx`. |
| #3 SO-250 D6 Žalmanov zárubní zeď | TZ + golden | **Absent.** Master task references `250_01_Technická_zpráva.pdf` — not in repo. No golden md. |
| #4 Bytový soubor Libuše | TZ + golden | TZ PDF **absent.** BOQ xlsx present at `rozpocet-registry/docs/unprotect_BS Libuše_Vykaz vymer R01_DMG Stav.xlsx`. No golden md. |
| #5 SO-220 D6 biokoridor | TZ + golden | **Absent.** Master task references `001_Technická_zpráva.pdf` — not in repo. No golden md. |

Other BOQ xlsx files found in `rozpocet-registry/docs/`:
- `011-26_-_I-26_Kyšice_-_Plzeň__Hřbitovní.xlsx`
- `IO01_-_ZTV_Veselí_u_Přelouče__zadání_.xlsx`
- `Sešit2.xlsx`

`data/peri-pdfs/` (the third location user mentioned) contains only the DOKA/PERI formwork catalog markdown (`formwork_catalog_PERI_DOKA_2025.md`), a parse script, and a rímsa spec — no golden TZ material.

Drawing files (PDF řezy, výpisy ocelových prvků) for vision testing: not located. None of `find … -name '*.pdf'` outside `docs/normy/{tkp,navody}/` and the SO-series PDFs is in the repo today.

---

## 5. Math / formula parsing — verified absent

`grep -rn "math.js\|mathjs\|expr-eval\|Function(" Monolit-Planner/shared/src/` returns zero matches.

`Monolit-Planner/shared/package.json` runtime deps: NONE (only `typescript` ^5.3.3 and `vitest` ^4.0.16 as devDeps).
`Monolit-Planner/frontend/package.json` runtime deps: `@stavagent/monolit-shared`, `@tanstack/react-query`, `axios`, `exceljs`, `file-saver`, `lucide-react`, `react`, `react-dom`, `react-router-dom`, `uuid`, `xlsx`. No math library.
`Monolit-Planner/backend/package.json` runtime deps: agent-listed `better-sqlite3`, `pg`, `string-similarity`. No math library.

There is no `eval()` and no `new Function(...)` constructor anywhere in the shared source.

Formula evidence in test fixtures: `tz-text-extractor.test.ts` VP4 line 212 contains `"(0,8*0,3+1,45*0,25)*156,4"` as a trailing token. The current regex deliberately leaves it untouched. Any cross-validation Variant B wants to do (formula vs stated quantity) requires either: (a) a new dep — `mathjs` (~500 KB minified) is the conventional pick, (b) `expr-eval` (~10 KB, safer surface for this use case), or (c) a hand-rolled recursive-descent parser. Decision deferred — flagged for user.

---

## 6. Feature flag infrastructure

Three independent systems coexist:

| Layer | Mechanism | File |
|---|---|---|
| Frontend deploy-time | `import.meta.env.VITE_*` (Vite injects at build) | `Monolit-Planner/frontend/src/pages/PlannerPage.tsx:22` (`VITE_ADMIN_MODE`), `vite-env.d.ts:4`, plus 6 more sites |
| Shared lib runtime | Hardcoded boolean dict | `Monolit-Planner/shared/src/constants.ts:21-27` — `FEATURE_FLAGS = { FF_AI_DAYS_SUGGEST: true, FF_PUMP_MODULE: false, … }` |
| Backend / MCP | `os.getenv()` + pydantic-settings | `concrete-agent/packages/core-backend/app/config.py` (not opened in this pass) |

A new vision-MCP flag would naturally be a backend env var. A new "Variant B extractor on" flag for the frontend would be either a `VITE_*` env (deploy-time, on/off per Vercel preview) or a new `FF_*` key in `FEATURE_FLAGS` (runtime hardcoded, requires redeploy). Either is one-line.

No LaunchDarkly / Unleash / DevCycle / any SaaS flag service.

---

## 7. Naming conventions (from sampling)

| Layer | Convention | Evidence |
|---|---|---|
| TS source files | kebab-case for compounds, lowercase singular for atoms | `tz-text-extractor.ts`, `element-classifier.ts`, `position-linking.ts`, `pile-engine.ts`, vs `constants.ts`, `formulas.ts`, `types.ts` |
| TS exported funcs | camelCase verbs | `extractFromText`, `detectCatalog`, `classifyElement`, `parseCzechNumber` |
| TS exported types | PascalCase | `ExtractedParam`, `SmetaLine`, `StructuralElementType`, `ElementProfile` |
| TS constants | UPPER_SNAKE_CASE | `FEATURE_FLAGS`, `ELEMENT_CATALOG`, `BRIDGE_EQUIVALENT`, `SMETA_LINE_RE` |
| TS test files | `*.test.ts` (vitest) | `tz-text-extractor.test.ts`, `element-classifier.test.ts`, all of `calculators/*.test.ts` |
| Python source | snake_case | `provider_router.py`, `claude_client.py`, `mineru_client.py` |
| Python test files | `test_*.py` (pytest) | `test_mcp_compatibility.py`, `test_mcp_golden_so202.py` |
| MCP tool files | lowercase short noun | `otskp.py`, `urs.py`, `classifier.py`, `calculator.py`, `budget.py`, `document.py`, `breakdown.py`, `advisor.py`, `norms.py` |
| Audit docs | `AUDIT_<Topic>.md` at package root | `rozpocet-registry/AUDIT_Registry_FlatLayout.md` (1670 lines, the only precedent — section style `## 1.`, `### 1.1`, dense `File : line` tables) |
| Task docs | `TASK_<Topic>_<modifier>.md` in `docs/` or package | `docs/TASK_Calculator_UISimplification_StrategicSplit.md`, `docs/TASK_TZ_TO_SOUPIS_PIPELINE_v3.md`, `rozpocet-registry/docs/TASK_ClassifierRewrite.md` |

Existing audit precedent uses Russian-mixed Czech narration. New audit text should pick a single language per user preference — not decided.

---

## 8. Bug / inconsistency observations (not for fixing here)

- CLAUDE.md and master task both say "22 element types" — actual count is 24 including `other`. Drift accumulated since the 22-type version.
- `test-data/tz/bridges/` referenced in master task does not exist — flat layout in `test-data/tz/`.
- VP4 FORESTINA is only inline in a test file. Promoting it to a `test-data/tz/VP4_FORESTINA_*.md` would mirror the SO-series and let Gate 1 reference a stable fixture.
- `analyze_construction_document` MCP tool (cost 10 cr — the second most expensive) is currently pdfplumber-only. Marketing/positioning that says "AI analysis" while running deterministic regex is a separate issue.
- Three of nine MCP tools have no REST wrapper. GPT Actions custom GPT can therefore only use 6/9. Probably intentional, but worth confirming.
- `mineru_client.py` references `/usr/bin/mineru` binary but the separate `mineru_service/` Cloud Run is HTTP. The in-process client and the HTTP service are NOT the same code path.

---

## 9. Open questions that came up during discovery (no answers given)

1. Math library policy: `mathjs` vs `expr-eval` vs hand-rolled, or stay regex-only and skip formula cross-validation in Variant B?
2. `source` enum on `ExtractedParam`: extend in place (`'regex' | 'keyword' | 'heuristic' | 'smeta_line' | 'formula' | 'catalog' | 'vision' | 'llm' | 'manual'`) or introduce a parallel structured field? Existing TZ apply UI in `TzTextInput.tsx` reads `source` directly in switch-on-string branches.
3. `ClassificationContext` is `{ is_bridge?: boolean }`. The Variant B 5-golden plan needs `pozemni_stavba`, `bridge_overpass_biokoridor`, `transport_infrastructure`. Replace with a string enum? Or add additive flags?
4. Vision MCP tool — placement: extend `analyze_construction_document` to optionally call Claude vision when a flag is set, or a brand-new tool (`extract_drawing_dimensions` as named in task spec)? The former preserves cost = 10 cr; the latter needs a new TOOL_COSTS entry.
5. Golden runner: build a YAML-driven CLI now (Task spec Phase 2 backlog calls for `tools/golden_runner.py`) or keep adding pytest-style per-object files like `test_mcp_golden_so202.py`?
6. Source PDFs for SO-250 / Libuše TZ / SO-220 — user needs to supply. Until they're in the repo, Gates 3 / 5 / 6 cannot run on real text.
7. Drawing PDFs for vision testing — also not in the repo today.
8. Branch policy: master task says feature branch from `claude/calc-ux-fixes-HfW2W`; current `claude/smartextractor-variant-b-v2-Ot8BT` was created on top of main. This findings dump goes to a separate `claude/smartextractor-phase0-findings`. Three branches alive at once — needs reconciliation before any code lands.

---

## 10. What was NOT covered in this discovery pass

- Concrete-agent backend other than MCP server (services / classifiers / parsers / KB layout).
- Stavagent-portal end (any flag plumbing, any extractor consumer there).
- URS_MATCHER_SERVICE internals.
- Vercel/Cloud-Build CI gates for any of the new touch points.
- The actual MinerU HTTP service shape (`mineru_service/` was not opened).
- Whether `provider_router.py` exposes a vision-aware path at all (chain definitions checked; vision-content routing not confirmed).
- Sub-agent transcripts hold more detail than is reproduced above; this file is the distilled view, not the full evidence.

---

**End of dump.** Next session can either turn this into the formal `AUDIT_SmartExtractor_VariantB.md` (using the `AUDIT_Registry_FlatLayout.md` layout as the template) or skip the audit and start work directly from these findings.
