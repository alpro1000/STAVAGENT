# Monolit-Planner Inventory — Part 1: shared/src engines

**Scope:** `Monolit-Planner/shared/src/{calculators,classifiers,parsers,constants-data}/`
**Source:** Gate 1+2 Explore agent B (Monolit)
**File counts:** 33 calculator .ts files (16,745 lines total) + 2 classifiers + 2 parsers + 3 constants-data files. Tests excluded from this part (covered separately if needed).

---

## Inventory table — calculators / classifiers / parsers / constants

| path (rel to repo root) | size (lines) | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `Monolit-Planner/shared/src/calculators/maturity.ts` | 637 | TS engine + tables | maturity, curing_days, exposure_minima | `element-scheduler.ts`, `planner-orchestrator.ts`, `pour-decision.ts` | 2026-04-20 | yes (CORE `B2/csn_en_206.json` + `tkp_18.md`) | keep_in_place | Core maturity / curing model — `EXPOSURE_MIN_CURING_DAYS` table + `CURING_DAYS_TABLE` 3-class × 5-temp × 3-concrete grid, ČSN EN 13670 Table NA.2 |
| `shared/src/calculators/lateral-pressure.ts` | 492 | TS engine | formwork_pressure, DIN_18218 | `formwork.ts`, `element-classifier.ts`, `pour-decision.ts` | 2026-04-19 | partial (CORE `B3/formwork_systems_doka.json` pressure formulas) | keep_in_place | DIN 18218 lateral-pressure calc — `RHO=2400`, `G=9.81`, `k=0.85/1.0/1.5` per consistency |
| `shared/src/calculators/pile-engine.ts` | 581 | TS engine + catalog | pile_engine, productivity, costs | `planner-orchestrator.ts` | 2026-04-19 | no | keep_in_place | `PILE_PRODUCTIVITY_TABLE` Ø600/900/1200/1500 × cohesive/noncohesive/below_gwt/rock × cfa/cased/uncased; rig 25k CZK/shift, crane 8k, CHA 40k, PIT 5k |
| `shared/src/calculators/planner-orchestrator.ts` | 2795 | TS orchestrator | master_engine, routing | `planner-advisor.js`, `r0.js`, `formwork-assistant.js` | 2026-04-20 | no | keep_in_place | Master orchestrator — routes element_type → pile-engine / formwork / pour-decision; 1276-line test |
| `shared/src/calculators/element-scheduler.ts` | 702 | TS engine | scheduling, tact_logic | `planner-orchestrator.ts` | 2026-04-20 | no | keep_in_place | Tact scheduling (sectional chess/linear/single + curing + crane chains) |
| `shared/src/calculators/formwork.ts` | 410 | TS engine | formwork_labor, disassembly | `formwork-assistant.js`, `pour-decision.ts` | 2026-04-19 | partial (CORE `B4/bedneni.json`) | keep_in_place | Assembly h/m² + disassembly_ratio lookup from FORMWORK_SYSTEMS catalog |
| `shared/src/calculators/pour-decision.ts` | 583 | TS engine + classifier | pour_mode, element_types | `planner-orchestrator.ts`, `element-classifier.ts` | 2026-04-19 | no | keep_in_place | Pour mode (monolithic vs sectional); StructuralElementType enum |
| `shared/src/calculators/pump-engine.ts` | 319 | TS engine | pump, concrete_delivery, crew | `pour-task-engine.ts`, `pour-decision.ts` | 2026-04-19 | yes (CORE `B9/pumps.json`, Registry `pump_knowledge.json` + `pumpCalculator.ts`) | keep_in_place | Pump m³/h rates + crew sizes — **TRIPLE-SOURCED** with Registry pump catalog |
| `shared/src/calculators/pour-task-engine.ts` | varies | TS engine | pour_task, multi_shift | `planner-orchestrator.ts` | 2026-04-19 | no | keep_in_place | Per-záběr pour task computation (continuous + sectional) |
| `shared/src/calculators/position-linking.ts` | 352 | TS classifier | otskp_rules, urs_rules, work_type | backend routes via TS imports, `relinkService.js` | 2026-04-20 | yes (CORE `classifiers/work_classifier.py` parallel digit-5 logic) | keep_in_place | Position-linking v1.1 — OTSKP digit-5: 1–3=beton, 6=výztuž, 7=předpětí; URS: 2=beton, 5=bednění, 6=výztuž |
| `shared/src/calculators/bridge-technology.ts` | varies | TS engine | bridge_tech, mss | `planner-orchestrator.ts`, `element-classifier.ts` | 2026-04-19 | no | keep_in_place | Bridge tech selection (pevná/posuvná skruž / MSS / CFT) |
| `shared/src/calculators/prestress.ts` | varies | TS engine | prestress, cables | `planner-orchestrator.ts` | 2026-04-19 | no | keep_in_place | Prestress formula v2: wait + stressing + grouting decomposition |
| `shared/src/calculators/rebar.ts` | varies | TS engine | rebar_lite, h_per_t | `planner-orchestrator.ts` | 2026-04-20 | yes (CORE `B4/construction_productivity_norms.json`) | keep_in_place | calculateRebarLite consumes REBAR_RATES_MATRIX |
| `shared/src/calculators/props.ts` | varies | TS engine | props, vendor_match | `planner-orchestrator.ts` | 2026-04-19 | no | keep_in_place | selectPropSystem with preferred_manufacturer matching |
| `shared/src/calculators/mss.ts` (or similar) | varies | TS engine | mss_integrated, reuse_factor | `planner-orchestrator.ts` | 2026-04-19 | no | keep_in_place | DOKA MSS / VARIOKIT Mobile path |
| `shared/src/calculators/scheduler.ts` | varies | TS engine | gantt, critical_path | `r0.js` | 2026-04-19 | no | keep_in_place | Gantt assembly + critical path (tolerance 0.5 d post-v4.24) |
| `shared/src/classifiers/element-classifier.ts` | 1828 | TS catalog + classifier | element_catalog, rebar_matrix, sanity_ranges, exposure_recs | `planner-orchestrator.ts`, `bridge-technology.ts` | 2026-04-20 | yes (Frontend `positionDefaults.ts` mirror; CORE `classifiers/work_classifier.py` overlap) | keep_in_place | ELEMENT_CATALOG (24 types) + REBAR_RATES_MATRIX (D6–D50 by category) + SANITY_RANGES + RECOMMENDED_EXPOSURE — **frontend mirror creates sync risk** |
| `shared/src/classifiers/element-classifier.test.ts` | 867 | TS test | golden_test | none ext | 2026-04-20 | no | keep_in_place | Golden tests for element catalog (24 types coverage) |
| `shared/src/parsers/tz-text-extractor.ts` | 604 | TS extractor | tz_extraction, regex_rules, smeta_lines | `planner-advisor.js` | 2026-04-20 | no | keep_in_place | Regex extracts concrete_class, exposure_class, dimensions, smeta-lines (OTSKP/URS); confidence 0.7–1.0 |
| `shared/src/parsers/tz-text-extractor.test.ts` | varies | TS test | golden_test | none ext | 2026-04-20 | no | keep_in_place | TZ extraction tests (SO-202 mostovka/prestress/pile excerpts) |
| `shared/src/constants-data/formwork-systems.ts` | 715 | TS catalog | formwork_systems, pour_role_taxonomy | `formwork-assistant.js`, `lateral-pressure.ts`, `element-classifier.ts` | 2026-04-19 | yes (CORE `B3/formwork_systems_doka.json` + Registry `formwork_knowledge.json`) | keep_in_place | 30+ formwork systems with rental + assembly norms — **QUADRUPLE-SOURCED** |
| `shared/src/constants-data/formwork-systems.test.ts` | 132 | TS test | golden_test | none ext | recent | no | keep_in_place | Golden tests for system specs |
| `shared/src/constants-data/construction-sequence.ts` | 166 | TS rules | construction_sequence, tech_pauses | via `constants-data/index.ts` | recent | no | keep_in_place | 7d tech pause after pile drilling, curing holds, prestress waits |
| `shared/src/constants.ts` | 96 | TS constants | misc_defaults | (rare) | 2026-04-19 | no | keep_in_place | Crew defaults, shift hours, safety margins |

---

## Hotspots & dup signals from this part

- **`element-classifier.ts:1589` REBAR_RATES_MATRIX** is the single source for D6–D50 rebar h/t (slabs/walls/beams/staircases buckets). Frontend `positionDefaults.ts` mirrors a subset → **sync risk**.
- **`maturity.ts:91–97` EXPOSURE_MIN_CURING_DAYS** (XF1=5, XF3=7, XF4=7, XD2=5, XD3=7) is the live source. CORE `B2/csn_en_206.json` covers exposure classes but agent A could not confirm matching values — **value-conflict candidate** (verified in `06_duplicates_conflicts.md`).
- **`formwork-systems.ts:126–185+` formwork catalog** has 30+ systems with rental prices (Frami Xlife `rental_czk_m2_month=507.20`). Registry has different rates (531.52–730.60). CORE `doka_cennik_2025-01-01.json` is yet another. **Triangulation in `06_duplicates_conflicts.md`**.
- **`pile-engine.ts:300–306` pile cost defaults** (rig 25k, crane 8k, CHA 40k, PIT 5k) — extracted from "TZ SO-202 budget" comment; no upstream catalog yet.

---

## Cross-references

- 20 hardcoded-norms hotspots (combined across calculators + parsers + backend) summarised in `02_inventory_monolit_part2_hotspots.md`.
- Cross-zone duplicates with CORE / Registry triangulated in `06_duplicates_conflicts.md`.
- Frontend `positionDefaults.ts` sync risk discussed in part 2.

---

End of part 1. Continued in `02_inventory_monolit_part2_hotspots.md`.
