# CORE Inventory — Part 3: engines (services / classifiers / parsers / pricing)

**Scope:** `concrete-agent/packages/core-backend/app/{services,classifiers,parsers,pricing,validators}/`
**Source:** Gate 1+2 Explore agent A (CORE)
**File counts:** 71 services / 4 classifier files / 13 parsers / 1 pricing engine. Only knowledge-bearing files listed (most-used + ones with hardcoded norms).

---

## Inventory table — engines

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `concrete-agent/.../classifiers/work_classifier.py` | 375 | python | classifier | `api/routes.py`, `services/task_classifier.py` | 2026-04-19 | yes (Monolit `position-linking.ts` digit-5 rules; Registry `classificationRules.ts` 11 BOQ skupiny) | keep_in_place | Deterministic work classifier with YAML rules + scoring; **TRIPLE-SOURCED rule set** |
| `classifiers/rules/default_rules.yaml` | varies | YAML | classifier_rules | `classifiers/work_classifier.py` | 2026-04-19 | yes (parallel to Registry CLASSIFICATION_RULES) | keep_in_place | 40+ work-type rules in YAML — consolidation candidate with Registry frontend+backend rules |
| `classifiers/work_classifier_test_*.py` | varies | python | tests | none ext | 2026-04-19 | no | keep_in_place | Unit tests |
| `parsers/kros_parser.py` | varies | python | parser_kros | `services/workflow_a.py` | 2026-04-19 | yes (URS_MATCHER `import_kros_urs.mjs` legacy) | keep_in_place | KROS UNIXML + Table-XML parser |
| `parsers/excel_parser.py` | varies | python | parser_excel | `services/workflow_a.py` | 2026-04-19 | no | keep_in_place | Excel BOQ multi-format (XC4, RtsRozp, Komplet) |
| `parsers/xc4_parser.py` | varies | python | parser_xc4 | `services/workflow_a.py` | 2026-04-19 | no | keep_in_place | XC4 Czech-number parser |
| `parsers/xlsx_komplet_parser.py` | varies | python | parser_komplet | `services/workflow_a.py` | 2026-04-19 | no | keep_in_place | Komplet xlsx parser |
| `parsers/xlsx_rtsrozp_parser.py` | varies | python | parser_rtsrozp | `services/workflow_a.py` | 2026-04-19 | no | keep_in_place | RtsRozp xlsx parser |
| `parsers/pdf_parser.py` | varies | python | parser_pdf | `api/routes_add_document.py` | 2026-04-19 | no | keep_in_place | pdfplumber + MinerU fallback |
| `services/position_enricher.py` | 351 | python | enrichment | `api/routes_workflow_a.py`, `services/workflow_a.py` | 2026-04-19 | no | keep_in_place | KB matching (exact/partial/no-match scoring) |
| `services/norm_advisor.py` | 343 | python | norm_advisor, ai | `api/routes_nkb.py` | 2026-04-19 | no | keep_in_place | Gemini + Perplexity norm advice |
| `services/norm_matcher.py` | varies | python | norm_matching | `services/position_enricher.py`, `services/norm_advisor.py` | 2026-04-19 | no | keep_in_place | Deterministic norm match (exact/fuzzy) |
| `services/so_merger.py` | varies | python | so_merge, contradiction | `services/workflow_a.py` | 2026-04-19 | no | **extract_constants** | `NUMERIC_TOLERANCE_PCT=2.0` + CRITICAL_FIELDS hardcoded — move to config |
| `services/section_extraction_engine.py` | varies | python | extraction, confidence | `services/extractor_registry.py` | 2026-04-19 | no | **extract_constants** | `AI_CONFIDENCE=0.7`, `REGEX_CONFIDENCE=1.0`, `_MAX_SECTION_CHARS_FOR_AI=24000` |
| `services/document_search_router.py` | varies | python | search_router | `api/routes_document_search.py` | 2026-04-19 | no | **extract_constants** | `VERTEX_CONFIDENCE_THRESHOLD=0.5` |
| `services/audit_service.py` | varies | python | audit, multi_role | `api/routes_workflow_a.py` | 2026-04-19 | no | keep_in_place | Multi-role expert audit |
| `services/enrichment_service.py` | varies | python | enrichment_orchestration | `services/workflow_a.py` | 2026-04-19 | no | keep_in_place | Orchestrates enrichment + KB augmentation |
| `services/resource_calculator.py` | varies | python | resource_calc | `api/routes.py` | 2026-04-19 | yes (Monolit `element-classifier.ts` REBAR_RATES_MATRIX, h/m² norms) | keep_in_place | Labor + equipment from B4 — Monolit has parallel constants |
| `services/calculator_suggestions.py` | varies | python | suggestions | `api/routes_calculator_suggestions.py` | 2026-04-19 | no | keep_in_place | Crane/pump suggestions from B9 |
| `services/scenario_b_generator.py` | 299 | python | scenario_b, tz_to_vykaz | `api/routes_scenario_b.py` | 2026-04-19 | no | keep_in_place | Scénář B (TZ → Výkaz výměr) generator |
| `pricing/otskp_engine.py` | 480 | python | otskp_engine, pricing | `api/routes.py`, `services/workflow_a.py`, MCP `find_otskp_code` | 2026-04-19 | yes (URS_MATCHER `otskpCatalogService.js` parallel logic) | **extract_constants** | OTSKP SQLite wrapper + variant confidence scoring; numeric thresholds inline |
| `validators/validator.py` | varies | python | validator | `api/routes.py` | 2026-04-19 | no | keep_in_place | ČSN/TKP norm conformance validator |

---

## Hardcoded-norms hotspots — 8 specific file:line references

These are Python constants embedded in service code that should migrate to a YAML config (see `08_variant_centralized.md`–`10_variant_hybrid.md` for target structure).

| # | File | Line | Constant | Value | Domain meaning |
|---|------|------|----------|-------|---------------|
| 1 | `services/so_merger.py` | 77 | `NUMERIC_TOLERANCE_PCT` | `2.0` | Numeric fields within ±2 % between two SO files are NOT flagged as contradictions |
| 2 | `services/so_merger.py` | 62–67 | `CRITICAL_FIELDS` (set) | bridge_length_m, bridge_width_m, free_width_m, span_m, structural_height_m, pile_diameter_mm, pile_length_m, load_class, concrete_grades | Fields whose mismatch triggers `severity="critical"` on the audit report |
| 3 | `services/section_extraction_engine.py` | 30 | `AI_CONFIDENCE` | `0.7` | Gemini-extraction confidence used in scoring merged results |
| 4 | `services/section_extraction_engine.py` | 31 | `REGEX_CONFIDENCE` | `1.0` | Regex extraction is "perfect" — wins over AI when both match |
| 5 | `services/section_extraction_engine.py` | 34 | `_MAX_SECTION_CHARS_FOR_AI` | `24000` | ~6000 tokens; sections longer than this skip AI extraction for performance |
| 6 | `services/document_search_router.py` | 26 | `VERTEX_CONFIDENCE_THRESHOLD` | `0.5` | Minimum Vertex Search confidence before falling back to Perplexity |
| 7 | `classifiers/work_classifier.py` | 90–100 | scoring weights (in code) | inline | Keyword-match scoring with weighted include/exclude — not extracted to YAML |
| 8 | `pricing/otskp_engine.py` | 56 | `PricedPolozka` confidence scoring | `0.0`–`1.0` | OTSKP variant confidence based on parameter matching |

**Recommendation across all 8:** centralise into `concrete-agent/packages/core-backend/app/core/config.py` (already exists for runtime config) — see `12_top_recommendations.md` item #7.

---

## Cross-references

- Comparable hardcoded constants live in Monolit-Planner — see `02_inventory_monolit_part2_hotspots.md` (20 hotspots there, vs. 8 here).
- Confidence-scoring philosophy is documented in root `CLAUDE.md` ("Determinism prevails over AI: regex=1.0, OTSKP DB=1.0, drawing_note=0.90, Perplexity=0.85, URS=0.80, AI=0.70"). The 8 numeric constants above are the implementation of that doctrine.

---

End of part 3. Continued in `01_inventory_core_part4_models_db.md` (Pydantic schemas, db/, dangling files, notes).
