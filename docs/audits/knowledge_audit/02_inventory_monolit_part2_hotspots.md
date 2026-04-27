# Monolit-Planner Inventory — Part 2: backend / frontend + 20 hardcoded-norm hotspots

**Scope:** `Monolit-Planner/{backend,frontend}/src/` + 20 hotspots compiled across the whole module.
**Source:** Gate 1+2 Explore agent B (Monolit)

---

## Inventory table — backend / frontend / migrations / docs

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `Monolit-Planner/backend/src/routes/advisor-prompt.js` | 129 | JS prompt builder | ai_advisor, domain_rules | `planner-advisor.js` | 2026-04-19 | no | keep_in_place | Czech-language advisor prompt — references TKP18, ČSN EN 206/1992/13670; bridge / prestress / pile sections |
| `backend/src/routes/planner-advisor.js` | 420 | JS endpoint | ai_advisor, knowledge_synthesis | app-level | 2026-04-19 | no | keep_in_place | POST `/api/planner-advisor` — assembles prompt + calls Core multi-role; returns JSON pour_mode/tacts/risks |
| `backend/src/routes/r0.js` | 925 | JS service | deterministic_core, workflow | app-level | 2026-04-19 | no | keep_in_place | R0 deterministic core — runs planner-orchestrator without AI |
| `backend/src/routes/formwork-assistant.js` | 740 | JS endpoint | formwork_ui_logic | app-level | 2026-04-19 | partial (consumes Monolit `formwork-systems.ts`) | keep_in_place | Formwork UI helper (system selection, comparison) |
| `backend/src/routes/import-from-registry.js` | 417 | JS endpoint | registry_import | app-level | 2026-04-19 | partial (Registry `api/sync.ts`) | keep_in_place | Registry → Monolit import path |
| `backend/src/services/concreteExtractor.js` | 1220 | JS extractor | concrete_spec, exposure_class | `exporter.js`, `kb-research.js` | 2026-04-19 | yes (CORE `services/section_extraction_engine.py`) | keep_in_place | Concrete class / exposure / consistency extractor — overlaps with Core extraction service |
| `backend/src/services/exporter.js` | 1515 | JS exporter | excel_export, schedule, labor, materials | multiple routes | 2026-04-19 | no | keep_in_place | Excel export (Gantt + labor + materials + cost rollup) |
| `backend/src/services/parser.js` | 666 | JS parser | position_parsing, smeta_extraction | routes | 2026-04-19 | partial (CORE Excel/KROS parsers) | keep_in_place | Position/smeta parser — bridges manual + auto sources |
| `backend/src/services/coreAPI.js` | 605 | JS api_client | concrete_agent_integration | bridges | 2026-04-19 | yes (Core API the obvious owner) | **move_to_central** | Integration layer for concrete-agent KB research — **contains duplicated domain knowledge that should live in Core only** |
| `backend/src/services/relinkService.js` | 402 | JS relinker | position_relink, work_type | routes | 2026-04-19 | no | keep_in_place | Relinks user-submitted codes to positions |
| `backend/migrations/010_create_unified_registry.sql` | ~200 | SQL | registry_unification | `init.js`, `coreAPI.js` | 2026-04-19 | no | keep_in_place | Unified registry schema (positions, OTSKP/URS codes, metadata) |
| `frontend/src/constants/formworkSystems.ts` | 43 | TS constants | formwork_re_export | Calculator components | 2026-04-19 | partial (re-exports `shared/constants-data/formwork-systems.ts`) | keep_in_place | Single-source-of-truth re-export — adds legacy FormworkSystem type |
| `frontend/src/constants/positionDefaults.ts` | ~100 | TS defaults | element_defaults, rebar_defaults | Calculator, useCalculator hook | recent | yes (mirrors `shared/classifiers/element-classifier.ts`) | **refactor_split** | Frontend hardcodes element defaults — **sync risk**; should import from shared instead |
| `Monolit-Planner/CLAUDE.MD` (or `claude.md`) | 3006 | markdown | domain_doc, architecture, known_bugs | team reference | 2026-04-19 | no | keep_in_place | Per-service notes — formwork v3, element-classifier v1, maturity, known bugs Z1–Z4 etc. Long-form session log; recommend split into ARCHITECTURE.md + design-decisions.md eventually |
| `Monolit-Planner/README.md` | 739 | markdown | overview, quickstart | team reference | 2026-04-19 | no | keep_in_place | Service overview |

Backend services not knowledge-bearing (auth, db plumbing, imports) excluded from this table; covered at module-summary level only.

---

## 20 hardcoded-norm hotspots — file:line:value

| # | File | Line(s) | Constant | Value | Domain meaning |
|---|------|---------|----------|-------|---------------|
| 1 | `shared/src/calculators/lateral-pressure.ts` | 29 | `RHO` | `2400` kg/m³ | Concrete density (ČSN EN 12812) |
| 2 | `lateral-pressure.ts` | 31 | `G` | `9.81` m/s² | Gravity |
| 3 | `lateral-pressure.ts` | 54 | k-factor (standard concrete) | `0.85` | DIN 18218 consistency factor |
| 4 | `lateral-pressure.ts` | 55 | k-factor (plastic) | `1.00` | DIN 18218 |
| 5 | `lateral-pressure.ts` | 56 | k-factor (SCC) | `1.50` | DIN 18218 |
| 6 | `shared/src/calculators/maturity.ts` | 91–97 | `EXPOSURE_MIN_CURING_DAYS` | XF1=5, XF2=5, XF3=7, XF4=7, XD2=5, XD3=7 days | TKP18 §7.8.3 freeze-thaw minima |
| 7 | `maturity.ts` | 168–175+ | `CURING_DAYS_TABLE` | 3 classes × 5 temp ranges × 3 concrete groups | ČSN EN 13670 |
| 8 | `shared/src/classifiers/element-classifier.ts` | 1589 | `REBAR_RATES_MATRIX[slabs_foundations]` | D6=38.4, D12=16.3, D20=8.6, D25=6.7 h/t | methvin.co Apr 2026 |
| 9 | `element-classifier.ts` | 1593 | `REBAR_RATES_MATRIX[walls]` | D12=17.3, D20=9.2 h/t | walls 3× faster than beams |
| 10 | `element-classifier.ts` | 1597 | `REBAR_RATES_MATRIX[beams_columns]` | D12=22.4, D25=9.2 h/t | most demanding category |
| 11 | `shared/src/calculators/pile-engine.ts` | 29–32 | productivity table comment | Ø600 CFA 5–8 / shift, s pažnicí 3–5, pod HPV 2–4, rock 1–3 | ČSN 73 1002 |
| 12 | `pile-engine.ts` | 300–306 | pile cost defaults | rig=25 000, crane=8 000, CHA=40 000, PIT=5 000 CZK / shift or test | TZ SO-202 budget |
| 13 | `pile-engine.ts` | 79–80 | overpouring height default | 0.3–1.0 m, default `0.5` m | TZ §6.3.3 laitance removal |
| 14 | `shared/src/constants-data/formwork-systems.ts` | 126–128 | Frami Xlife | `assembly_h_m2=0.72`, `disassembly_ratio=0.35`, `rental_czk_m2_month=507.20` | DOKA 2024 catalog |
| 15 | `formwork-systems.ts` | 145–185+ | 30+ systems | DOMINO 0.55 h/m², 520 CZK/m²/mo; Tradiční tesařské 0.60, 380; Multiflex 0.45, etc. | DOKA + PERI catalogs |
| 16 | `element-classifier.ts` | 118–200+ | `ELEMENT_CATALOG` | 25+ types: slabs 60–80, walls 80–120, columns 120–180 kg/m³ rebar; strip_strength 50–70 % | composite norms |
| 17 | `shared/src/calculators/position-linking.ts` | 8–9 | OTSKP/URS digit-5 rules | OTSKP d5 1–3=beton, 6=výztuž, 7=předpětí; URS d5 2=beton, 5=bednění, 6=výztuž | catalog structure |
| 18 | `shared/src/parsers/tz-text-extractor.ts` | 36 | confidence scoring | `1.0` regex / `0.7–0.9` heuristic / `0.5+` alt | detector accuracy model |
| 19 | `backend/src/routes/advisor-prompt.js` | 120–124 | pour mode rules | sectional if dilatační_spáry; monolithic if none; Roman stripes ≥24 h between neighbours; overtime +25 % from 10 h | domain rules |
| 20 | `backend/src/routes/advisor-prompt.js` | 54 | prestress schedule | wait min 7 d (33 MPa) → tensioning → grouting | TZ SO-202 implicit |

**Recommendation:** all 20 should migrate to YAML / JSON catalogs in a centralised KB (`shared/data/*.yaml` or higher). See `08`–`10` for variant trade-offs and `11_migration_plans.md` for per-variant effort.

---

## Cross-zone duplicates from Monolit perspective

1. `maturity.ts EXPOSURE_MIN_CURING_DAYS` ↔ CORE `B2/csn_en_206.json` exposure rules
2. `element-classifier.ts ELEMENT_CATALOG` ↔ CORE `classifiers/work_classifier.py` taxonomy + Frontend `positionDefaults.ts` mirror
3. `concreteExtractor.js` ↔ CORE `section_extraction_engine.py` extraction logic
4. `formwork-systems.ts` ↔ CORE `B3/formwork_systems_doka.json` + Registry `formwork_knowledge.json` + CORE `B3/doka_cennik_2025-01-01.json`
5. `position-linking.ts` digit-5 rules ↔ CORE `work_classifier.py` work-type detection
6. `pump-engine.ts` ↔ CORE `B9/pumps.json` + Registry `pump_knowledge.json` / `pumpCalculator.ts`

Full triangulation in `06_duplicates_conflicts.md`.

---

## Counts (Monolit total)

| Bucket | Count |
|--------|-------|
| Files inventoried with full attributes | ~30 (parts 1+2 combined) |
| Calculator engines | 33 |
| Classifiers | 2 (one + test) |
| Parsers | 2 (one + test) |
| Backend routes | 20 (5 highlighted) |
| Backend services | 17 (6 highlighted) |
| Frontend constants | 2 (one mirror flagged) |
| Migrations | 9 SQL |
| Hardcoded-norm hotspots (file:line) | 20 |
| Files marked `extract_constants` (effectively all 20 hotspots) | (consolidation plan in `11_migration_plans.md`) |
| Files marked `move_to_central` | 1 (`coreAPI.js`) |
| Files marked `refactor_split` | 1 (`positionDefaults.ts`) |
| Cross-zone dup hints | 6 |

---

End of Monolit inventory. Continued in `03_inventory_portal.md`.
