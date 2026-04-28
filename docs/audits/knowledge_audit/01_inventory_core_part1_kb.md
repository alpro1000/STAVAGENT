# CORE Inventory — Part 1: `knowledge_base/` (B0–B9)

**Scope:** `concrete-agent/packages/core-backend/app/knowledge_base/`
**Source:** Gate 1+2 Explore agent A (CORE)
**File counts:** 62 JSON / 2 markdown / 0 YAML in this subtree (KB only — prompts in part 2, engines in part 3)

---

## Counts (KB subtree only)

| Subfolder | Files | Notes |
|-----------|-------|-------|
| `B1_otkskp_codes/` | 4 | OTSKP catalog (XML + structure JSON + metadata) |
| `B1_rts_codes/` | 1 | metadata-only stub |
| `B1_urs_codes/` | 2 | URS metadata + KROS sample |
| `B2_csn_standards/` | 8 | ČSN EN 206, VL 4 (Mosty), TKP 17/18/22/24 + index |
| `B3_current_prices/` | 17 | Concrete + formwork prices, project offers, extracted PDFs |
| `B4_production_benchmarks/` | 7 | Productivity, labor rates, mechanization |
| `B5_tech_cards/` | 1 | metadata-only stub |
| `B6_research_papers/` | 1 | metadata-only stub |
| `B7_regulations/` | 1 | metadata-only stub |
| `B8_company_specific/` | 1 | metadata-only stub |
| `B9_Equipment_Specs/` | 3 | cranes, excavators, pumps |
| Root | 1 | `all_pdf_knowledge.json` (12.8K-line aggregate) |

---

## Inventory table

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `concrete-agent/.../knowledge_base/B1_otkskp_codes/2025_03_otskp.xml` | 4.2 MB | XML catalog | otskp_codes | `pricing/otskp_engine.py`, MCP `find_otskp_code` | 2026-04-19 | partial | keep_in_place | Authoritative OTSKP source (March 2025); also mirrored as SQLite in URS_MATCHER |
| `B1_otkskp_codes/xmk_tskp_tridnik.xml` | ~? | XML catalog | otskp_codes,tridnik | `pricing/otskp_engine.py` | 2026-04-19 | partial | keep_in_place | OTSKP třídník hierarchy (parallel to main XML) |
| `B1_otkskp_codes/structure.json` | 238 lines | JSON | otskp_codes | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | OTSKP hierarchical code structure |
| `B1_otkskp_codes/metadata.json` | 12 lines | JSON | otskp_codes | `services/norm_storage.py`, `services/norm_matcher.py` | 2026-04-19 | no | keep_in_place | OTSKP code registry metadata |
| `B1_rts_codes/metadata.json` | 9 lines | JSON | rts_codes | `services/norm_source_catalog.py` | 2026-04-19 | no | keep_in_place | RTS metadata only — empty catalog |
| `B1_urs_codes/metadata.json` | 9 lines | JSON | urs_codes | `services/norm_matcher.py`, MCP `find_urs_code` | 2026-04-19 | no | keep_in_place | URS catalog metadata |
| `B1_urs_codes/kros_sample.json` | 176 lines | JSON | urs_codes | `tests/test_kros_parsing.py` | 2026-04-19 | no | keep_in_place | KROS UNIXML sample for parser tests |
| `B2_csn_standards/metadata.json` | 9 lines | JSON | csn_standards | `services/norm_matcher.py`, `services/norm_advisor.py` | 2026-04-19 | no | keep_in_place | ČSN catalog metadata |
| `B2_csn_standards/csn_en_206.json` | 463 lines | JSON | csn_standards, exposure | `services/position_enricher.py`, `models/norm_schemas.py` | 2026-04-19 | yes (Monolit `maturity.ts`) | keep_in_place | XC/XD/XS/XF/XA exposure classes + cover; **single authoritative source — Monolit duplicates portion** |
| `B2_csn_standards/VL_4_2021_Mosty_markdown.md` | 8677 lines | markdown | csn_standards, bridges, tkp_18 | `prompts/roles/structural_engineer.md` | 2026-04-19 | no | keep_in_place | Bridge design standard (VL 4/2021) — concrete grades, loadings, safety |
| `B2_csn_standards/tkp/tkp_17_beton.json` | 248 lines | JSON | tkp_17, concrete_production | `services/enrichment_service.py` | 2026-04-19 | no | keep_in_place | Concrete production catalog (TKP 17) |
| `B2_csn_standards/tkp/tkp_18.md` | 147 lines | markdown | tkp_18, bridges | `prompts/roles/structural_engineer.md` | 2026-04-19 | yes (Monolit `maturity.ts` curing) | keep_in_place | TKP18 bridge concrete (vibrator params, cover, curing) |
| `B2_csn_standards/tkp/tkp_18_betonove_mosty.json` | 204 lines | JSON | tkp_18, bridges | `services/enrichment_service.py` | 2026-04-19 | partial (`tkp_18.md` is narrative twin) | keep_in_place | Structured TKP18 (tolerances, removal-strength thresholds) |
| `B2_csn_standards/tkp/tkp_22_izolace.json` | 126 lines | JSON | tkp_22, waterproofing | `services/position_enricher.py` | 2026-04-19 | no | keep_in_place | Isolation & waterproofing |
| `B2_csn_standards/tkp/tkp_24_zvlastni_zakladani.json` | 142 lines | JSON | tkp_24, foundations | `services/position_enricher.py` | 2026-04-19 | no | keep_in_place | Special foundations (piles, anchors) |
| `B2_csn_standards/tkp/tkp_index.json` | 509 lines | JSON | tkp_index | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | TKP catalog index (52 standards) — only TKP17/18/22/24 fleshed out |
| `B3_current_prices/00_pump_calculator_schema.json` | 214 lines | JSON | pump, formulas | `pricing/otskp_engine.py`, `services/calculator_suggestions.py` | 2026-04-19 | yes (Registry `pump_knowledge.json`, Monolit `pump-engine.ts`) | keep_in_place | Concrete-pump pricing schema; TRIPLE-SOURCED — see 06_duplicates |
| `B3_current_prices/01_berger_beton_sadov.json` | 275 lines | JSON | concrete_supplier | `services/position_enricher.py` | 2026-04-19 | no | keep_in_place | Berger Beton Sádov mix designs + prices |
| `B3_current_prices/02_frischbeton_kv.json` | 344 lines | JSON | concrete_supplier | `services/position_enricher.py` | 2026-04-19 | no | keep_in_place | Frischbeton KV catalog |
| `B3_current_prices/03_tbg_otovice_2026.json` | 262 lines | JSON | concrete_supplier | `services/position_enricher.py` | 2026-04-19 | no | keep_in_place | TBG Otovice 2026 |
| `B3_current_prices/04_tbg_offer_d6_2026.json` | 106 lines | JSON | project_offer, d6 | `services/project_cache.py` | 2026-04-19 | no | keep_in_place | Project-specific offer (D6 SO 202–241) |
| `B3_current_prices/05_berger_offer_d6_2026.json` | 161 lines | JSON | project_offer, d6 | `services/project_cache.py` | 2026-04-19 | no | keep_in_place | Berger competitor offer for same project |
| `B3_current_prices/26-027C…SO_202_extracted.json` | ~? | JSON | project_extract | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | Extracted project SO-202 facts (D6 most KM 0,900) |
| `B3_current_prices/26-028C…SO_203_extracted.json` | ~? | JSON | project_extract | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | SO-203 (D6 most KM 2,450) |
| `B3_current_prices/26-029C…SO_207_extracted.json` | ~? | JSON | project_extract | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | SO-207 (Estakáda KM 4,450–4,650) |
| `B3_current_prices/26-030C…SO_212_extracted.json` | ~? | JSON | project_extract | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | SO-212 (Nadjezd D6 KM 7,574) |
| `B3_current_prices/26-031C…SO_241_extracted.json` | ~? | JSON | project_extract | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | SO-241 (most na Vratském potoce KM 2,950) |
| `B3_current_prices/540-044877_NAB_DOKA_Q101_extracted.json` | ~? | JSON | doka_offer | `KnowledgeBaseLoader` | 2026-04-19 | no | keep_in_place | DOKA Q101 commercial offer (extracted) |
| `B3_current_prices/extracted_data/*.txt` | ~6 files | raw text | project_extract_raw | none directly | 2026-04-19 | no | keep_in_place | Raw text dumps from PDF extraction (sibling to *_extracted.json) |
| `B3_current_prices/formwork_systems_doka.json` | 447 lines | JSON | formwork_doka, pricing | `services/calculator_suggestions.py`, `services/position_enricher.py` | 2026-04-19 | yes (Monolit + Registry) | keep_in_place | Doka formwork specs + pressure formulas — **QUADRUPLE-SOURCED** |
| `B3_current_prices/formwork_systems_peri.json` | 455 lines | JSON | formwork_peri, pricing | `services/calculator_suggestions.py` | 2026-04-19 | yes (Monolit + Registry) | keep_in_place | PERI formwork specs + load capacities |
| `B3_current_prices/doka_cennik_2025-01-01.json` | 370 lines | JSON | doka_pricing | `services/position_enricher.py` | 2026-04-19 | yes (Monolit `formwork-systems.ts` rental rates) | keep_in_place | Doka 2025 rental rates — Monolit has parallel rental table |
| `B3_current_prices/market_prices.json` | 81 lines | JSON | market_aggregate | `services/price_parser/main.py` | 2026-04-19 | no | keep_in_place | Aggregated market prices |
| `B3_current_prices/rimsove_bedneni_sosna_2026.json` | 249 lines | JSON | timber_formwork | `services/position_enricher.py` | 2026-04-19 | no | keep_in_place | Pine rim-formwork 2026 prices |
| `B3_current_prices/all_pdf_extractions.json` | 1238 lines | JSON | extraction_aggregate | `KnowledgeBaseLoader`, `services/project_cache.py` | 2026-04-19 | yes (`all_pdf_knowledge.json` superset) | merge_with | Subset of root-level `all_pdf_knowledge.json` — consolidate |
| `B3_current_prices/metadata.json` | ~? | JSON | b3_metadata | none direct | 2026-04-19 | no | keep_in_place | B3 catalog metadata |
| `B4_production_benchmarks/metadata.json` | 9 lines | JSON | b4_metadata | `services/resource_calculator.py` | 2026-04-19 | no | keep_in_place | B4 metadata |
| `B4_production_benchmarks/bedneni.json` | 495 lines | JSON | productivity, formwork_labor | `services/resource_calculator.py` | 2026-04-19 | yes (Monolit `formwork.ts` h/m² norms) | keep_in_place | Formwork productivity (m²/hr per system) — Monolit has parallel constants |
| `B4_production_benchmarks/berger_cenik_mechanizace_pracovnici_2026.json` | ~? | JSON | mechanization, labor | `services/resource_calculator.py` | 2026-04-19 | no | keep_in_place | Berger mechanization+labor 2026 |
| `B4_production_benchmarks/berger_mala_mechanizace_cenik_2026.json` | ~? | JSON | small_mechanization | `services/resource_calculator.py` | 2026-04-19 | no | keep_in_place | Berger small mechanization 2026 |
| `B4_production_benchmarks/berger_sazba_mechanizmu_2026.json` | 338 lines | JSON | equipment_rental | `services/resource_calculator.py` | 2026-04-19 | no | keep_in_place | Berger equipment hourly rates 2026 |
| `B4_production_benchmarks/berger_tarif_delnici_2026.json` | 469 lines | JSON | labor_wages | `services/resource_calculator.py` | 2026-04-19 | yes (Registry `tovProfessionMapper.js` Betonář→398 Kč/h) | keep_in_place | Czech labor rates 2026 by profession — Registry hardcodes one row |
| `B4_production_benchmarks/construction_productivity_norms.json` | 960 lines | JSON | productivity_norms | `services/resource_calculator.py` | 2026-04-19 | yes (Monolit `element-classifier.ts` REBAR_RATES_MATRIX) | keep_in_place | Czech productivity norms — Monolit has parallel rebar h/t matrix |
| `B4_production_benchmarks/productivity_rates.json` | 244 lines | JSON | productivity, generic | `services/resource_calculator.py` | 2026-04-19 | no | keep_in_place | Generic productivity rates |
| `B4_production_benchmarks/projects/*` | empty dir | — | — | — | 2026-04-19 | no | keep_in_place | Project-specific benchmarks placeholder |
| `B5_tech_cards/metadata.json` | 9 lines | JSON | b5_metadata_only | none | 2026-04-19 | no | **delete** | Empty stub — no actual tech-card files; metadata defined but never populated |
| `B6_research_papers/metadata.json` | 9 lines | JSON | b6_metadata_only | none | 2026-04-19 | no | **delete** | Empty stub |
| `B7_regulations/metadata.json` | 9 lines | JSON | b7_metadata_only | none | 2026-04-19 | no | **delete** | Empty stub |
| `B8_company_specific/metadata.json` | 9 lines | JSON | b8_metadata_only | none | 2026-04-19 | no | **delete** | Empty stub |
| `B9_Equipment_Specs/cranes.json` | 195 lines | JSON | cranes, capacity | `services/calculator_suggestions.py` | 2026-04-19 | no | keep_in_place | Crane specs (capacity/radius/setup) |
| `B9_Equipment_Specs/excavators.json` | 273 lines | JSON | excavators | `services/calculator_suggestions.py` | 2026-04-19 | no | keep_in_place | Excavator specs (bucket/m³ per hr) |
| `B9_Equipment_Specs/pumps.json` | 101 lines | JSON | concrete_pumps | `services/calculator_suggestions.py` | 2026-04-19 | yes (Registry pump_knowledge.json — different pump models) | keep_in_place | Concrete-pump specs — but Registry has Beton-Union catalog with 10 different models |
| `knowledge_base/all_pdf_knowledge.json` | 12837 lines | JSON | aggregated_extract | `KnowledgeBaseLoader` | 2026-04-19 | yes (subsumes B3 `all_pdf_extractions.json` and TKP PDFs) | keep_in_place | Master extraction dump (auto-generated by `extract_all_pdfs.py` + MinerU) |

---

## Sub-table: empty stubs (B5–B8)

All four are 9-line metadata files with zero content files alongside them. Decision points captured in `13_open_questions.md`:

- Were B5–B8 ever populated locally and lost? Or always placeholders?
- Should the four be deleted, or do they reserve namespace for planned content?

---

## Cross-references for downstream files

- **TKP PDFs** (the raw source for tkp_*.json/.md) live in `docs/normy/tkp/` — see `05_inventory_other.md` for the 33 raw PDFs and which have extracted YAML/JSON counterparts here.
- **Vendor formwork PDFs** (Doka/PERI/SRS source for formwork_systems_*.json) live in `docs/normy/navody/` — same downstream file.
- **Cross-zone duplicates** for OTSKP, URS, formwork, pumps, productivity, rebar — full triangulation in `06_duplicates_conflicts.md`.

---

End of part 1. Continued in `01_inventory_core_part2_prompts.md`.
