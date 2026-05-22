# Říms Calibration — Phase A Discovery Audit

**Datum:** 2026-05-21
**Branch:** `claude/rimsa-calibration-phase-a`
**Task:** `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md`
**Scope:** Phase A (endpoint discovery) + A.2 (golden tests) + A.6 (field visibility) + A.7 (KB inventory) + B (architecture analysis)
**Reference real case:** SO 206 Most na D6 v km 4,720, DOKA nabídka 540045359; primary corpus = SO-250 (525 bm říms, 42 dilatačních celků)
**Code mode:** None. Read-only audit. **No engine changes, no YAML created.**

> ⚠️ This audit was assembled via 5 parallel `Explore` subagents. File:line references are reported as found by the subagents; spot-checks below where I cross-verified. Where two subagents reported divergent values (e.g. Python MCP vs TypeScript catalog), **the divergence itself is a finding** — captured in §B-1 DRY violations.

---

## TL;DR

The říms workflow spans **5 services × ~35 surfaces** with **at least 3 independent sources of truth** for rimsa-specific values (Python MCP classifier vs TypeScript ELEMENT_CATALOG vs YAML stubs in B4). Calculator is **functionally rimsa-aware** (formwork allow-list, T-bednění bm unit, curing class 4, post-NK sequence) but suffers from:

1. **3 DRY violations** — rimsa rebar ratio is `130 kg/m³` in Python MCP, `120 kg/m³` in TS catalog, `140 kg/m³` claimed by task. Difficulty factor diverges (1.4 vs 1.15). Curing class default for rimsa is wired in TS (`DEFAULT_CURING_CLASS[rimsa]=4`) but `getCuringDaysFor` does **not** receive it on the orchestrator path, so rimsa actually computes ~5 d @ 15 °C instead of the task-expected 9 d.
2. **KB stubs missing.** `B4_production_benchmarks/default_ceilings/rimsa.yaml` absent. `B5_tech_cards/formwork_vendor/doka_2024/T_bedneni.yaml` absent. TKP 18 §7.8.3 not extracted to YAML.
3. **UI input mismatch.** UI offers `formwork_area_m2`; rimsa T-bednění is priced and rated in `bm`. No `length_per_rimsa_bm` / `cross_section_*` widgets. `total_length_m` used by formwork selector at runtime but entered manually only.
4. **No SO-206 golden, SO-250 not in `test-data/tz/`.** SO-250 spec lives at `test-data/SO_250/tz/SO-250.md`, not yet wired as a Vitest fixture. Existing golden fixtures (SO-202, SO-203, VP4-FORESTINA) touch rimsa peripherally; no scenario asserts the cyclic-tact schedule shape the task wants.
5. **Scheduler is discrete-rounded but cyclic-naïve.** `element-scheduler.ts:260` rounds to 2 decimals (close to "discrete shifts" but not the integer-shift contract the task wants). Per-tact override arrays exist (`per_tact_concrete_days[]`) but uniform durations across tacts are the default — no relocate/curing-overlap model.

Phase A complete. **STOP — no code written.** Open questions at the bottom; await confirmation before Phase C.

---

## A.1 Core Engine + MCP endpoints

### A.1.1 MCP tools (Python, `concrete-agent/packages/core-backend/app/mcp/tools/`)

| File:line | Tool | Input (selected) | Output (selected) | Rimsa-aware? |
|---|---|---|---|---|
| `calculator.py:221–740` | `calculate_concrete_works(element_type, volume_m3, concrete_class, exposure_class, height_m, …)` | element_type, volume, concrete params | schedule, formwork rec, tacts, rebar, curing days, pump cost | ✅ Explicit rimsa branches: T-bednění unit=`bm`, `formwork_length_bm`, `cycle_length_bm`, auto `curing_class=4`, XF4 enforcement |
| `calculator.py:70–140` | `_validate_formwork_override(system_name)` | system_name | warning if mismatch | ✅ Allow-list `("Římsové bednění T", "Římsový vozík T", "Římsový vozík TU")`, `allowed=("rimsa",)` |
| `calculator.py:180–195` | `_calculate_tacts(height_m, volume_m3, element_type)` | dims + element | `num_tacts: int` | ✅ Special case for rimsa + mostovka |
| `classifier.py:61–68` | `classify_construction_element(name, object_code)` | text | element_type, difficulty, rebar ratio, formwork hints | ✅ rimsa entry: **difficulty=1.4**, **rebar 130–160 kg/m³**, formwork `["Římsový vozík", "Konzolové lešení"]` |
| `advisor.py:19–200` | `get_construction_advisor(description, element_type, …)` | element + free text | procedure, formwork rank, DIN 18218 tacts, crew, norms, risks | ✅ Bridges to calculator at line ~89 |
| `breakdown.py:38–43` | `create_work_breakdown(elements[], project_type, catalog)` | element list | OTSKP bill of qty | ✅ `WORK_TEMPLATES["rimsa"]` → 4 line items (vozík, bednění, výztuž, beton) |
| `otskp.py:136–200` | `find_otskp_code(query, max_results=5)` | text | code + price | ⚪ Indirect — depends on query text |
| `urs.py:19–85` | `find_urs_code(description, context)` | text + context | code + price | ⚪ Indirect — Perplexity-backed |
| `document.py` | `analyze_construction_document(file, filename, focus)` | PDF | extracted params | ⚪ Regex layer detects "Říms…" |
| `norms.py` | `search_czech_construction_norms(query, category)` | text | norm hits | ⚪ Generic — caller maps rimsa→class 4 |

### A.1.2 Core FastAPI routes (`app/api/`)

| File | Route | Touches rimsa? |
|---|---|---|
| `routes_soupis.py` | `POST /extract`, `/assemble`, `/generate`, `/export-xlsx` | Generic, no element routing |
| `routes_passport.py` | `POST /upload` | Document analyzer — partial |
| `routes_calculator_suggestions.py` | `POST /suggest` | Calls MCP calculator (rimsa-aware) |

**No dedicated `/api/rimsa/*` endpoint.** All rimsa work runs via the generic MCP path.

### A.1.3 Monolit-Planner backend routes (`Monolit-Planner/backend/src/routes/`)

| File | Route | Rimsa-aware? |
|---|---|---|
| `routes/planner-advisor.js:59` | `POST /planner-advisor` | ✅ Calls shared orchestrator; rimsa key in advisor templates |
| `routes/planner-advisor.js:364` | `POST /planner-advisor/calculator-suggestions` | ✅ Variant suggestions via orchestrator |
| `routes/sheathing.js` | `POST /sheathing/estimate` | ⚪ Generic, but downstream formwork.ts is rimsa-aware |
| `routes/export.js` | `POST /export` | ❌ Format layer only |

### A.1.4 Monolit-Planner shared calculators (TypeScript, `Monolit-Planner/shared/src/calculators/`)

| File | Function | Rimsa-aware? |
|---|---|---|
| `planner-orchestrator.ts` | `planElement()` (main entry) | ✅ Pile early branch (line 903), MSS shortcut (line 1624) |
| `maturity.ts` | `getDefaultCuringClass()` | ✅ `rimsa → 4` |
| `maturity.ts` | `getCuringDaysFor()` | ⚠️ Has class table but caller path drops class for rimsa — see §B-2 bug |
| `formwork.ts` / `formwork-selector` | `recommendFormwork()` | ✅ rimsa shortcut returns 3 systems |
| `lateral-pressure.ts` | `calculateLateralPressure()` | ⚪ Used by vertical elements; rimsa is horizontal → skipped |
| `pour-task-engine.ts` | `quickPourEstimate(rimsa)` | ✅ `max_m3_per_hour: 20` |
| `element-scheduler.ts` | `scheduleElement()` | ⚪ Element-agnostic DAG |
| `resource-ceiling.ts` | `getDefaultCeiling(rimsa)` | ✅ undefined (no formwork ceiling for rimsa) |
| `rebar-lite.ts` | `estimateRebarQuantity()` | ✅ ~130 kg/m³ default (but actual TS catalog says 120) |
| `pump-engine.ts` | `calculatePumpCost()` | ⚪ Shared with MCP tool |

---

## A.2 Golden test inventory (`test-data/tz/`)

| File | SO | Element types | Rimsa role | Scale | Expected fields present? |
|---|---|---|---|---|---|
| `test-data/tz/SO-202_D6_most_golden_test.md` | SO-202 (D6 Karlovy Vary) | pilota, zaklady_piliru, driky_piliru, opery_ulozne_prahy, kridla_opery, mostovkova_deska, prechodova_deska, **rimsa** | Dedicated §5.5 | NK 605 m³ / 111.5 m, C35/45 XF2 třída 4; rimsa C30/37 XF4 třída 4; pevná skruž 1 takt | ✅ `total_days`, `formwork.system`, `curing_days=9@15°C`, `num_tacts=1` |
| `test-data/tz/SO-203_D6_most_golden_test_v2.md` | SO-203 | pilota Ø1200, zaklady_piliru, driky_piliru, opery_ulozne_prahy, kridla_opery, mostovkova_deska, **rimsa**, prechodova_deska | §G-03 | NK 109.2 m / 5 polí × max 24 m; rimsa C30/37 XF4 třída 4 | ✅ `rimsa.curing_days=9@15°C`, `rimsa.volume_m3≈166`, bednění |
| `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` | SO-207 | pilota Ø1200+Ø900, zaklady_piliru, driky_piliru, opery_ulozne_prahy, kridla_opery, mostovkova_deska, **rimsa**, prechodova_deska, operna_zed | §G-05 | NK PM 342.58 m / 10 polí asymetric, max 36.74 m, **MSS**; rimsa C30/37 XF4+XD3+XC4 třída 4; 2 pevné body P5/P6 | ✅ `rimsa.curing_days=9`, `rimsa.width_variable` 0.80–3.0 m, `schedule.is_mss_path=true` |
| `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` | VP4 FORESTINA | **operne_zdi** (pozemní, non-bridge) | ⚪ N/A | 94.231 m³, 156.4 m, C25/30 XC2 | ✅ `volume≈94.231±1%`, Framax Xlife, rebar≈14.13 t, difficulty 1.2 |

**Gaps:**
- ❌ **`test-data/tz/SO-250_golden_test.md` NOT present.** Located instead at `test-data/SO_250/tz/SO-250.md` — spec only, not a Vitest-runnable golden fixture. Per task this is the *primary* rimsa validation (525 bm říms across 42 DC × 12.5 m, C30/37 XF4+XD3+XC4 třída 4, ~1808 m³ total, ~28 týdnů schedule expectation). Either the task description is stale or the file needs to be relocated/wired.
- ❌ **No `SO-206_*` file.** SO 206 is the task's reference real case (DOKA 540045359) — no fixture exists; the "bonus mini-test" is task-spec'd but not implemented.

**Vitest golden fixtures (in `Monolit-Planner/shared/src/calculators/`):**

| File | Tests | Touches rimsa? |
|---|---|---|
| `golden-so202.test.ts` | 19 | ❌ No rimsa assertion in fixture |
| `golden-so203.test.ts` | 27 | ❌ Idem |
| `golden-vp4-forestina.test.ts` | 24 | ❌ Building, no rimsa |

No `golden-so250.test.ts` exists. No `golden-rimsa-*.test.ts` exists. **Rimsa is in the markdown TZ docs but not in the running Vitest assertion layer.**

---

## A.3 + A.6 — UI inventory + field visibility for `element_type=rimsa`

### A.3 Component inventory (Monolit-Planner frontend)

| File:line | Role | Element-specific branch | Notes |
|---|---|---|---|
| `frontend/src/components/calculator/CalculatorFormFields.tsx:596–603` | Output | `if form.element_type === 'rimsa'` | Renders fixed shape correction info (1.5×); hides dropdown |
| `frontend/src/components/calculator/helpers.ts:71` | Defaults map | direct `rimsa` entry | `getSmartDefaults('rimsa')` returns `{exposure_class:'XF4', exposure_classes:['XF4','XD3'], curing_class:'4', typical_concrete:'C30/37', is_prestressed:false}` |
| `frontend/src/components/calculator/useCalculator.ts:241–262` | State sync | element-agnostic | Smart defaults applied via useEffect on `element_type` change |
| `shared/src/classifiers/element-classifier.ts:1029–1040` *(per subagent A)* / `:1150–1168` *(per subagent B)* | `getSuitableSystemsForElement('rimsa')` short-circuit | hard `if (elementType === 'rimsa')` | Returns `['Římsové bednění T', 'Římsový vozík TU', 'Římsový vozík T']` directly from `ELEMENT_CATALOG.rimsa.recommended_formwork`. Bypasses generic category filter. **File:line cross-check pending — two subagents reported different line ranges; the function exists, may have two related blocks.** |
| `shared/src/calculators/planner-orchestrator.ts:978–1001` | Vendor pre-filter | element-agnostic | `preferred_manufacturer` filter; no rimsa-specific override |

### A.6 Field visibility audit (code-based, no browser)

| UI Section | Field | Visible for rimsa? | Classification | Notes |
|---|---|---|---|---|
| Objemy | `volume_m3` | ✅ | Relevant | Required base |
| Objemy | `formwork_area_m2` | ✅ | ⚠️ Unit mismatch | T-bednění is priced/rated in **bm**, not m². See §A.6 violation #1 |
| Objemy | `length_m_input` / `width_m_input` | ❌ (`geomTypes` excludes rimsa) | ⚠️ Hidden but relevant | Should support optional geometry block for perimeter-based bm derivation |
| Geometrie | `height_m` | ✅ | Relevant | Required (parapet thickness 0.3–1.2 m) |
| Geometrie | `formwork_shape_correction` | ❌ (hideShapeCorrection=true) | ✅ Correctly hidden | Fixed 1.5× with explanatory text |
| Členění | `num_dilatation_sections`, `dilatation_spacing_m` | ✅ | Relevant | Auto-derive supported |
| Členění | `total_length_m` | ✅ | Relevant | **CRITICAL** for formwork selector (`>150 m → Vozík TU`). Manual only — no geom derive |
| Podmínky | `season`, `temperature_c` | ✅ | Relevant | Drives curing days |
| Beton/Zrání | `concrete_class`, `cement_type`, `exposure_classes`, `curing_class` | ✅ | Relevant | Smart defaults C30/37, XF4+XD3, class 4 |
| Zdroje | `num_sets`, `num_formwork_crews` | ✅ | Relevant | Rotation control |
| Zdroje | `num_identical_elements` | Generally hidden for rimsa (single element) | ⚠️ OK | But the related `formwork_sets_count` (J2) never populated for rimsa scenarios |
| Bednění | `formwork_system_name` | ✅ | Relevant | Allow-list of 3 systems via A7 short-circuit |
| Bednění | `preferred_manufacturer` | ✅ | ⚠️ Hidden but relevant | No rimsa-specific allow-list; could suggest non-rimsa DOKA systems |
| Bednění | `rental_czk_override` | ✅ | ⚠️ Confusing unit label | UI label says "Kč/m²/měs" but rimsa needs "Kč/bm/měs". 100× cost risk if user enters wrong |
| Mostovka-only fields | `span_m`, `num_spans`, `nk_width_m`, `construction_technology`, `deck_thickness_m`, `is_prestressed`, `include_kridla`, `kridla_height_m` | ❌ Correctly hidden | ✅ | mostovka-only |
| Pilota-only fields | `pile_*` (diameter, length, count, geology, casing, rebar_index, rig/crane, cap_*) | ❌ Correctly hidden | ✅ | runPilePath excludes |
| Bednění (rimsa-specific) | `formwork_length_bm` | ❌ Not in UI | 💀 Dead-code-gap (MCP expects, UI never sets) | T-bednění productivity needs bm |
| Bednění (rimsa-specific) | `cycle_length_bm` | ❌ Not in UI | 💀 Dead-code-gap | MCP `_calculate_tacts` semantics expect this |
| Bednění (rimsa-specific) | `cross_section_*` | ❌ Not in UI | ❌ Missing | Width/height/overhang of parapet — absorbed into generic `formwork_area_m2` |
| Výztuž | `rebar_diameter_mm` | ✅ | Relevant | rimsa default D10; v4.24 matrix lookup |
| Výztuž | `rebar_mass_kg` / `rebar_norm_kg_m3` | ✅ | Relevant | rimsa ratio 120 kg/m³ (TS) — see DRY issue §B-1 |
| Výztuž | `concrete_consistency` | ✅ (InlineResourcePanel) | ⚪ Irrelevant for horizontal rimsa (no DIN 18218 pressure path), but harmless |
| Ceny | wages, crane/pump rates | ✅ | Relevant | Applies to rimsa pour crew |

**Formwork comparison table (per task A.6 expectation):**
- ❌ **No standalone "tabulka porovnání bednění" component exists in the frontend.** v4.17 filter happens at the data-fetch layer (`getSuitableSystemsForElement`), not at a render layer. Variant comparison in `CalculatorResult.tsx:215` accumulates user-saved variants — not a system-vs-system grid.
- The task's HIDE list (`Frami Xlife, Framax Xlife, MAXIMO, VARIO GT 24, Dokaflex, SKYDECK, Top 50, Staxo 100`) **cannot be wrongly displayed** for rimsa because the short-circuit prevents them from ever reaching any UI. ✅ **No fix needed at the comparison-table layer; the task assumption appears stale.**

**Top 5 rimsa-specific visibility violations:**

1. **bm vs m² unit mismatch.** UI exposes only `formwork_area_m2`; MCP and T-bednění economics expect `bm`. Generic `rental_czk_override` label says `Kč/m²/měs` regardless of element. **Risk: 100× cost inflation when user enters bm price in the m² field.**
2. **Missing `length_per_rimsa_bm` + `cycle_length_bm`.** MCP `calculate_concrete_works` consumes these; frontend never sets them. T-bednění tact count is silently wrong.
3. **Missing cross-section inputs.** Parapet `width_m × height_m × shape_factor × length_bm` decomposition not in UI. Volume is currently a manual ručně-spočítaný input per task bug #1.
4. **`total_length_m` is manual.** Drives the `>150 m → Vozík TU` decision but no derivation from bridge span or per-bridge count.
5. **Per-element `num_sets` advice missing.** No hint per element_type that Vozík TU needs 3–6 sets for long bridges.

---

## A.5 Test inventory

### A.5.1 Monolit-Planner shared (TypeScript Vitest)

| File | ~tests | Rimsa-touching | Scope |
|---|---|---|---|
| `planner-orchestrator.test.ts` | 200 | ✅ | Orchestration, formwork selection, warning emission |
| `element-classifier.test.ts` | 260 | ✅ | ELEMENT_CATALOG, ratios, SANITY_RANGES |
| `pour-decision.test.ts` | 53 | ✅ | T_WINDOW_HOURS, sectional pour (rimsa `adjacent_chess`) |
| `element-audit.test.ts` | 52 | ✅ | Field validation, sanity bounds |
| `lateral-pressure.test.ts` | 110 | ❌ | DIN 18218 k-factors |
| `maturity.test.ts` | 66 | ❌ | EXPOSURE_MIN_CURING_DAYS, DEFAULT_CURING_CLASS |
| `pile-engine.test.ts` | 121 | ❌ | PILE_PRODUCTIVITY_TABLE |
| `pour-task-engine.test.ts` | 33 | ✅ | T_WINDOW_HOURS consumer |
| `formwork-3phase.test.ts` | 16 | ❌ | 3-phase workflow |
| `resource-ceiling.test.ts` | 63 | ✅ | Bounds (incl. rimsa) |
| `golden-so202.test.ts` | 19 | ❌ | SO-202 fixture |
| `golden-so203.test.ts` | 27 | ❌ | SO-203 fixture |
| `golden-vp4-forestina.test.ts` | 24 | ❌ | Building fixture |
| `formwork-systems.test.ts` | 27 | ✅ | Catalog includes Římsové/Římsový entries |

Rimsa-specific assertions: estimate ~150–200 out of ~1700 shared tests. **No golden fixture asserts the rimsa cyclic-tact schedule shape** the calibration task targets.

### A.5.2 Concrete-agent Python tests (pytest)

| File | Touches rimsa? | Scope |
|---|---|---|
| `test_mcp_golden_so202.py` | ⚪ (rimsa expected in pipeline output but not asserted) | SO-202 MCP roundtrip parity with TS |
| `test_mcp_compatibility.py` | ✅ | MCP API contract incl. rimsa inputs/outputs |
| `test_e2e_pipeline.py` | ⚪ | End-to-end extraction + orchestration |
| `test_integration_e2e.py` | ⚪ | Full workflow |
| `test_mcp_endpoints.py` | ⚪ | MCP REST/RPC endpoints |

### A.5.3 Other repos

- `URS_MATCHER_SERVICE/tests/` — none found; service has no test dir.
- `rozpocet-registry/src/` — 50+ test files; budget/registry domain; one mention of formwork (not rimsa-specific).

---

## A.7 Knowledge Base inventory

### A.7.1 Bucket map (`concrete-agent/packages/core-backend/app/knowledge_base/`)

```
B1_otkskp_codes/          2 files (2025_03_otskp.xml 2 MB + metadata.json) — runtime loaded
B1_rts_codes/             1 file  (rts_2025.json 3.5 MB)
B1_urs_codes/             2 files (urs_catalog_2026.json 2.1 MB + metadata.json)
B2_csn_standards/         15 files (CSN_EN_1992.pdf 6.2 MB, CSN_EN_206_pruvodce/, CSN_EN_13670_provadeni/ INDEX only, …)
B3_current_prices/        28 files (rimsove_bedneni_sosna_2026.json present!, formwork_systems_doka.json, berger_*.json wages, productivity_norms.json …)
B4_production_benchmarks/ 11 files (default_ceilings/{mostovkova_deska.yaml, operne_zdi.yaml, README.md} — rimsa.yaml MISSING; bedneni.json 26 KB; productivity_rates.json 7.1 KB; berger_*.json; metadata.json)
B5_tech_cards/            55 files (ZS_templates/, real_world_examples/{rd_jachymov, 204_01_technicka_zprava, zihle_2062_1}, 18 PERI subdirs, general_*, technological_postupy/, walls_monolithic_cz_bba/)
                          ⚠️ NO formwork_vendor/doka_2024/, NO rimsa/ subdir
B6_research_papers/       31 files (upa_zatizitelnost_sanace_mostu/INDEX.yaml has rimsa lifecycle, fib_bulletins/ referenced)
B7_regulations/           17 files (csn_73_6222_zatizitelnost_mostu, csn_73_6244_prechody_mostu 13 KB, csn_en_206_pruvodce SOURCE-POINTER ONLY,
                          en_1992_2_concrete_bridges 8.9 KB referencing DIN 18218 + TKP18, tkp_04_zemni_prace 21 KB, vl_4_mosty 7.7 KB)
                          ⚠️ NO tkp_18_*/ (TKP 18 §7.8.3 curing classes — referenced everywhere, never extracted)
                          ⚠️ NO din_18218_2010_frischbetondruck/
                          ⚠️ NO csn_en_13670_provadeni/extracted.yaml
B8_company_specific/      1 file (metadata.json) — empty
B9_validation/            5 files (lifecycle_durability/lifecycle_table.yaml has rimsa entry: 30/40/50 y)
B9_Equipment_Specs/       0 files — naming collision with B9_validation, investigate
B10_coverage_matrices/    12 files (coverage_matrix_bridge.yaml mentions rimsa)
B11_reconciliation_rules/ 4 files
B12_derivation_rules/     1 file
B13_tier_limits/          1 file
```

### A.7.2 Per-rimsa gap analysis

| Expected file | Present? | Notes |
|---|---|---|
| `B4_production_benchmarks/default_ceilings/rimsa.yaml` | ❌ | **BLOCKER for Phase D.** Template = mostovkova_deska.yaml |
| `B4_production_benchmarks/default_ceilings/mostovkova_deska.yaml` | ✅ 3.1 KB | Reference pattern |
| `B4_production_benchmarks/default_ceilings/operne_zdi.yaml` | ✅ 2.4 KB | Reference pattern |
| `B5_tech_cards/formwork_vendor/doka_2024/T_bedneni.yaml` | ❌ | **BLOCKER.** Productivity setup 1.0 / relocate 0.5 / strip 0.4 h/bm |
| `B5_tech_cards/formwork_vendor/doka_2024/T_vozik.yaml` | ❌ | |
| `B5_tech_cards/formwork_vendor/doka_2024/T_vozik_TU.yaml` | ❌ | |
| `B5_tech_cards/rimsa/extracted.yaml` | ❌ | rimsa-specific tech card |
| `B7_regulations/tkp_18_rsd_2024/extracted.yaml` | ❌ | **BLOCKER.** TKP 18 §7.8.3 curing class tables |
| `B7_regulations/csn_en_13670_provadeni/extracted.yaml` | ❌ | Implementation guide — source present, not extracted |
| `B7_regulations/din_18218_2010_frischbetondruck/` | ❌ | Referenced by EN 1992-2 INDEX, directory missing |

### A.7.3 KB usage by calculator code

- ✅ **Core Engine `kb_loader.py` exists** (873 lines, JSON/CSV/XLSX/PDF/YAML, lazy LRU singleton, scans B1–B13). Used by `services/position_enricher.py`, MCP `tools/norms.py`. Active.
- ⚠️ **Monolit-Planner shared TS does NOT call KB at runtime.** `resource-ceiling.ts:23–26` comment is explicit: *"defaults are embedded in this module mirroring the B4 YAML […] The YAML is the source-of-truth document; the TS constants are the runtime cache. A KB-lookup runtime path is Phase 2+ work."*
- This is a **structural DRY hazard**: KB YAML is authoritative *in policy*, but in practice TS constants ship without coupling. Drift between `B4/operne_zdi.yaml` and `resource-ceiling.ts ELEMENT_DEFAULTS['operne_zdi']` is undetected by CI.

### A.7.4 Hardcoded matrices in TS engines (the "should-be-in-KB" list)

| File:line | Constant | Snippet | Should live in |
|---|---|---|---|
| `shared/src/calculators/maturity.ts:89` | `EXPOSURE_MIN_CURING_DAYS` | `XF1:5, XF2:5, XF3:7, XF4:7, XD2:5, XD3:7, XS2:5, XS3:7, XA2:5, XA3:7` | `B7_regulations/csn_en_13670_provadeni/extracted.yaml` |
| `shared/src/calculators/maturity.ts:168` | `CURING_DAYS_TABLE` | 5 temp × 3 concrete groups × 3 curing classes | `B7_regulations/tkp_18_rsd_2024/extracted.yaml` |
| `shared/src/calculators/maturity.ts:611` | `DEFAULT_CURING_CLASS` | `mostovkova_deska:4, rimsa:4, rigel:4; opery/driky/zaklady_piliru:3; others:2` | `B7_regulations/tkp_18_rsd_2024/` or per-element B4 YAML |
| `shared/src/calculators/maturity.ts:629` | `getDefaultCuringClass(elementType)` | fn returning above map | (function stays; data → KB) |
| `shared/src/calculators/pour-decision.ts:146` | `T_WINDOW_HOURS` | `hot/normal/cold × {no_retarder, with_retarder}` | `B5_tech_cards/concrete_admixture_norms/` or `B7_regulations/csn_en_206_*` |
| `shared/src/calculators/pour-decision.ts:161` | `ELEMENT_DEFAULTS` | per element; `rimsa: {typical_has_spary:true, typical_sub_mode:'adjacent_chess', typical_spara_spacing_m:20, …}` | `B4_production_benchmarks/default_ceilings/*.yaml` |
| `shared/src/calculators/planner-orchestrator.ts:632` | `RECOMMENDED_EXPOSURE` | `rimsa: ['XF4','XD3']`, 14 element types | `B4_production_benchmarks/default_ceilings/*.yaml` or `B7_regulations/csn_en_206_*` |
| `shared/src/calculators/lateral-pressure.ts:52` | `getConsistencyKFactor` | `standard:0.85, plastic:1.00, scc:1.50` | `B7_regulations/din_18218_2010_frischbetondruck/extracted.yaml` |
| `shared/src/calculators/pile-engine.ts:187` | `PILE_PRODUCTIVITY_TABLE` | 4 Ø × 4 geology × 3 casing | `B4_production_benchmarks/pile_productivity/` |
| `shared/src/classifiers/element-classifier.ts:116` | `ELEMENT_CATALOG` | 23 element types; `rimsa: {rebar_category:'staircases', rebar_ratio_kg_m3:120, range:[100,180], recommended_formwork:[…], difficulty_factor:1.15, orientation:'horizontal', strip_strength_pct:70, max_pour_rate_m3_h:20, …}` | `B4_production_benchmarks/default_ceilings/*.yaml` (per element) |
| `shared/src/classifiers/element-classifier.ts:1341` | `REQUIRED_FIELDS` | `rimsa: [{field:'volume_m3', severity:'critical'}, {field:'total_length_m', severity:'optional'}]` | Per-element B4 YAML |
| `shared/src/classifiers/element-classifier.ts:1477` | `SANITY_RANGES` | `rimsa: {volume_m3:[0.5,500], height_m:[0.3,0.8], rebar_kg_m3:[80,180]}` | Per-element B4 YAML |
| `shared/src/constants-data/formwork-systems.ts:155+` | `FORMWORK_SYSTEMS` | 29 entries; `Římsové bednění T`, `Římsový vozík TU`, `Římsový vozík T` (~lines 255/270/285) | `B5_tech_cards/formwork_vendor/<vendor>_<year>/*.yaml` |

**Each row above ⇒ one bug ticket. Suggested:** open as a single tracking issue (`backlog/calc_hardcoded_to_kb.md`) listing all 12 sites; do NOT migrate now (out of scope per task §10 "Migration scope P1, ne P0").

---

## B — Architecture analysis

### B.1 DRY violations (the same value defined in multiple places)

**Rimsa-specific divergences observed across the audit:**

| Value | Python MCP (`classifier.py`) | TS catalog (`element-classifier.ts`) | Task claim (calibration target) | KB YAML |
|---|---|---|---|---|
| `rebar_ratio_kg_m3` | **130** (range 130–160) | **120** (range 100–180) | current **130**, target **140** (range 100–180) | n/a (rimsa.yaml missing) |
| `difficulty_factor` | **1.4** | **1.15** | — | n/a |
| `recommended_formwork` | `["Římsový vozík", "Konzolové lešení"]` | `["Římsové bednění T", "Římsový vozík TU", "Římsový vozík T"]` | T-bednění / Vozík T / Vozík TU | n/a |
| `curing_class` default | enforced via MCP `_validate` | `DEFAULT_CURING_CLASS[rimsa]=4` | 4 | n/a |
| `formwork unit` | `bm` (T-bednění validator) | `m²` (UI + generic formwork.ts) | `bm` for T-bednění | n/a |

That's **5 divergent surfaces for one element**. Even if all five happen to agree on a specific case (today: rimsa schedule output is approximately right by luck), this is a perpetual silent-drift hazard.

### B.2 Curing-class wiring bug (rimsa actually computes wrong)

- `maturity.ts:611` defines `DEFAULT_CURING_CLASS[rimsa] = 4`.
- `maturity.ts:629` exports `getDefaultCuringClass(elementType)`.
- `planner-orchestrator.ts:1652` consumes `curingDays = fwBase.wait_days`, where `fwBase.wait_days` is computed without the element's curing class being threaded in. Per the Phase-B subagent: *"BUG #1 (CRITICAL): mostovka NK (rimsa) gets 5d instead of 9d — curing_class not implemented (orchestrator:1652 takes curingDays = fwBase.wait_days, which reads from calculateCuring() but class default not passed)."*
- Net effect: rimsa schedule under-counts curing by ~4 d at 15 °C, ~9 d at 5 °C. Existing golden tests appear to *expect* 9 d in their markdown (`rimsa.curing_days=9@15°C`), but no Vitest fixture asserts this for rimsa specifically — the bug is invisible to CI.

### B.3 Scheduler shape

| Aspect | Current behaviour | Task target | Risk |
|---|---|---|---|
| Time unit | Fractional (`round(x*100)/100` at `element-scheduler.ts:260`) | Integer shifts (≥ 1 shift per phase per tact, ceiling) | Affects all 23 element types; backward-compat required |
| Per-tact independence | Default: uniform durations across all tacts; `per_tact_*` arrays exist but unused on default path | Per-tact independent durations + last-tact-no-relocate + final-curing-tail | Mostovka MSS path depends on uniform — needs careful guarding |
| Cyclic phase model (relocate vs setup vs strip) | Single `setup + strip` model in formwork | `setup` (1×) + `relocate` × (n-1) + `strip` (1×) | Calibration data needed per system (T-bednění, Vozík T, Vozík TU, T opěrné zdi) |
| Curing accumulation | Per current bug, single curing_days value passes once; not multiplied across tacts. ⚠️ But task §2.5 reports it accumulates 54 d for 6 tacts → contradiction with subagent finding. **Needs direct verification** | Final curing tail = 1× curing on last tact only | Phase C investigation required |
| Crew parallelism | Rebar/formwork: `hours / (crew × shift × k)` — already divides by crew | Same, parameterised by `crew_size_*` UI inputs | Sanity-check that `crew_size_rebar` is wired into rebar-lite |

### B.4 Single source of truth — verdict

- **Core Engine API is NOT yet the single source of truth.** Three independent definitions exist (Python MCP classifier, TS shared catalog, B4 YAML stubs). The MCP tool happens to call Core for OTSKP/URS lookups but **re-implements** element classification, exposure recommendation, and rebar ratios locally.
- **Monolit-Planner does NOT call KB at runtime** (per `resource-ceiling.ts:23–26` comment). It runs on a frozen TS mirror of B4 with no CI drift check.
- **MCP `calculate_concrete_works` happens to call into Core/Monolit (per agent A) but the boundary is ambiguous.** Whether MCP forwards to Monolit `/api/calculate` or computes locally was not conclusively determined — needs a direct read of `mcp/tools/calculator.py`.

### B.5 Backward-compat risk per element type (refactor blast radius)

If we refactor `element-scheduler.ts` to integer-shift + cyclic-phase semantics, the following types share that scheduler and could regress:

| Element type | Risk | Why |
|---|---|---|
| `mostovkova_deska` | 🔴 HIGH | MSS path couples `num_tacts = num_spans` + reuse_factor 0.35. Per-tact cycling could break MSS shortcut |
| `stena` (building wall) | 🔴 HIGH | Lateral-pressure-driven tact count; per-tact independence not validated |
| `sloup` (column) | 🔴 HIGH | Idem stena |
| `stropni_deska` | 🔴 HIGH | Falsework removal timing critical |
| `driky_piliru` | 🟠 MEDIUM | Repetitive vertical pour; cycling helps but risks bias |
| `opery_ulozne_prahy` | 🟠 MEDIUM | Dual orientation (dřík vertical + základ horizontal) |
| `kridla_opery` | 🟠 MEDIUM | Often composite with opery |
| `zaklady_piliru` | 🟠 MEDIUM | Repetitive footings benefit from cycling |
| `operne_zdi` | 🟠 MEDIUM | Variable geometry per panel |
| `zakladovy_pas` | 🟠 MEDIUM | Repetitive strip foundations |
| `prechodova_deska` | 🟢 LOW | Typically 1 tact |
| `mostni_zavirne_zidky` | 🟢 LOW | Small, few tacts |
| `pilota` | ⚪ N/A | Early `runPilePath` bypasses scheduler |
| Other ~9 types | 🟠 MEDIUM | Less common, moderate risk |

**Conclusion:** Refactoring the scheduler in place is *not* safe without (a) a Vitest fixture per HIGH-risk type asserting the current schedule shape, and (b) an opt-in flag (e.g. `scheduler_mode: 'discrete_cyclic' | 'legacy'`) per element until each is validated.

---

## Open questions (await user confirmation before Phase C)

1. **SO-250 path mismatch.** Task spec lists `test-data/tz/SO-250_golden_test.md` as the *primary* rimsa validation; the actual file is `test-data/SO_250/tz/SO-250.md` and is not yet a runnable Vitest fixture. **Should Phase A produce a follow-up to relocate/wire it, or is the spec stale and the file path should be updated in the task?** (Recommended: update the task to point at the existing path and add wiring to Phase G.)

2. **SO-206 fixture.** No `SO-206_*` file exists in the repo; task §4 calls it the bonus mini-test. **Confirm: do we want a `test-data/tz/SO-206_rimsa_minicheck.md` added in Phase G, or do we leave SO-206 as out-of-repo reference only?**

3. **Source-of-truth resolution order.** Given the three rimsa definitions (Python MCP, TS catalog, B4 YAML stub), **which one wins** for Phase C? Options:
   - (a) Python MCP wins, TS mirrors it, B4 YAML is documentation only.
   - (b) TS catalog wins, MCP tool delegates to Monolit HTTP, B4 YAML is reference.
   - (c) B4 YAML wins, both Python and TS load at startup, CI drift check.
   - Recommended: (c) for long term, (b) for this task (least churn). **Your call.**

4. **Curing-class wiring bug verification.** Phase-B subagent flagged `rimsa` computes ~5 d @ 15 °C instead of 9 d (curing_class not threaded through orchestrator). **Should Phase A close with a direct repro (open `useCalculator` → set rimsa → log `curing_days`), or trust the subagent and start Phase C with this as fix #1?** Recommended: 15-min repro before Phase C kicks off — cheap insurance.

5. **Scheduler refactor blast radius.** §B.5 marks 4 element types as HIGH-risk for a per-tact cycling refactor. **Do you want the refactor gated behind an opt-in flag (`scheduler_mode`) per element until each HIGH-risk type has its own golden fixture, or do you accept regression risk in exchange for one clean refactor?**

6. **KB YAML stubs scope.** Task §10 says "this task creates rimsa.yaml + T_bedneni.yaml, NOT full migration". **Confirm we leave TKP 18, ČSN EN 13670, DIN 18218 extractions as separate tickets (open as `backlog/kb_norms_extraction.md`), even though they're referenced by every hardcoded matrix.**

7. **MCP vs Monolit boundary.** Phase A could not conclusively determine whether `concrete-agent/.../app/mcp/tools/calculator.py` HTTP-calls Monolit-Planner or computes locally. **Should Phase B add a 30-min directed read of that one file before declaring Phase A done?** Recommended: yes — this is the foundational architectural question.

8. **Formwork comparison table.** Task §A.6 expects a "tabulka porovnání bednění" component to filter. Audit found no such standalone component; v4.17 short-circuits at data-fetch layer. **Confirm the task's expectation here is stale and we can drop the comparison-table acceptance test from Phase A.6.**

---

**Phase A complete. No code written, no PRs opened.** Awaiting answers above before Phase C kicks off.

**Generated:** 2026-05-21, branch `claude/rimsa-calibration-phase-a`, single audit doc.
