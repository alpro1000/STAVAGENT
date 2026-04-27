# Gate 3 — Duplicates & value conflicts

**Goal:** identify groups of files that encode the same domain knowledge in multiple places, and where the encoded values diverge, flag the conflict.

Two categories:
- **A. Topic duplication** — same domain concept appears in multiple files, regardless of value identity.
- **B. Value conflict** — same domain concept appears with **different numbers / definitions** in multiple files.

Cross-referenced into a numbered list so `12_top_recommendations.md` can prioritise.

---

## A. Topic duplication (with multiplicity counter)

### A1. OTSKP catalog — **3 places**
- CORE `concrete-agent/.../knowledge_base/B1_otkskp_codes/2025_03_otskp.xml` (4.2 MB, March 2025) — authoritative
- URS_MATCHER `backend/data/TSKP_KROS_full.csv` (2.6 MB, 2018) — legacy snapshot
- URS_MATCHER local SQLite mirror (built by `import_otskp_to_sqlite.mjs`) — performance cache

**Verdict:** 1 source-of-truth + 1 cache + 1 stale snapshot. Stale snapshot can move to archive after confirming no live importer.

### A2. URS catalog — **2 places**
- CORE `B1_urs_codes/` (kros_sample.json + metadata; full catalog loaded via concreteAgentKB)
- URS_MATCHER `backend/data/URS201801.csv` (1.9 MB, 2018) — legacy snapshot

**Verdict:** stale snapshot supersedeable.

### A3. Concrete classes / exposure rules — **4 places**
- CORE `B2_csn_standards/csn_en_206.json` (463 lines)
- Monolit `shared/src/calculators/maturity.ts` (`EXPOSURE_MIN_CURING_DAYS` + `RECOMMENDED_EXPOSURE`)
- Monolit `backend/src/services/concreteExtractor.js` (extraction regex + class lookups)
- URS_MATCHER `backend/src/services/norms/knowledgeBase.js` (CSN/CSN-EN concrete + exposure)

**Verdict:** 4 implementations of essentially one rulebook. Highest-impact consolidation target.

### A4. Curing days — **2 places**
- CORE `B2/tkp/tkp_18.md` + `tkp_18_betonove_mosty.json`
- Monolit `maturity.ts` `CURING_DAYS_TABLE` (3 classes × 5 temp ranges × 3 concrete groups, lines 168–175+)

**Verdict:** Monolit's table is the live computation source. CORE is reference / source documentation.

### A5. Formwork systems pricing — **4 places**
- CORE `B3_current_prices/formwork_systems_doka.json` (447 lines) + `formwork_systems_peri.json` (455 lines) + `doka_cennik_2025-01-01.json` (370 lines)
- Monolit `shared/src/constants-data/formwork-systems.ts` (715 lines, 30+ systems)
- Registry `src/data/formwork_knowledge.json` (503 lines, DOKA Frami h=0.9/1.5/1.8/2.4)
- `data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md` (extracted vendor catalog)

**Verdict:** four-way duplication; see B1 for value conflict.

### A6. Pump specs / pricing — **3 places**
- CORE `B9_Equipment_Specs/pumps.json` (101 lines, generic specs)
- Monolit `shared/src/calculators/pump-engine.ts` (m³/h + crew sizes)
- Registry `src/data/pump_knowledge.json` + `pump_suppliers.json` + `services/pumpCalculator.ts` (Beton Union 10 models)

**Verdict:** different vendors / scopes — but all encode the same logical entity (concrete pump catalog).

### A7. 11 BOQ skupiny / classification rules — **3 places**
- CORE `classifiers/work_classifier.py` + `classifiers/rules/default_rules.yaml`
- Registry frontend `src/services/classification/classificationRules.ts`
- Registry backend `api/agent/rules.ts` ← **identical to frontend file, see B2**

**Verdict:** triple-sourced; one is a critical dual-write (B2).

### A8. Profession taxonomy / labor rates — **3 places**
- URS_MATCHER `backend/data/tridnik.xml` (3.2 MB, taxonomy only)
- CORE `B4/berger_tarif_delnici_2026.json` (469 lines, rates)
- Registry-backend `services/tovProfessionMapper.js` (~10 hardcoded pairs)

**Verdict:** taxonomy + rates split across files — natural division of concerns, not a true duplication. Leave alone, document the split.

### A9. Productivity rates — **3 places**
- CORE `B4_production_benchmarks/construction_productivity_norms.json` (960 lines)
- CORE `B4/productivity_rates.json` (244 lines)
- Monolit `element-classifier.ts` `REBAR_RATES_MATRIX` (D6–D50 by category)
- URS_MATCHER `services/norms/knowledgeBase.js`

**Verdict:** 4 sources for productivity. Monolit's matrix is most granular per element category; CORE B4 is broader.

### A10. Confidence-threshold constants — **5 places** (all in CORE)
- `services/so_merger.py:77`, `:62–67`
- `services/section_extraction_engine.py:30`, `:31`, `:34`
- `services/document_search_router.py:26`
- `classifiers/work_classifier.py:90–100`
- `pricing/otskp_engine.py:56`

**Verdict:** scattered across 5 modules; all should consolidate to `app/core/config.py`.

### A11. STAVAGENT_CONTRACT.md — **2 paths**
- `docs/STAVAGENT_CONTRACT.md` (18 KB)
- `stavagent-portal/docs/STAVAGENT_CONTRACT.md` (18 KB)

**Verdict:** verify byte-equality. If identical → delete the portal copy. If divergent → reconcile and pick one.

### A12. UNIFIED_DATA_MODEL.ts ↔ POSITION_INSTANCE_ARCHITECTURE.ts
- `docs/UNIFIED_DATA_MODEL.ts` (496 lines, summary)
- `docs/POSITION_INSTANCE_ARCHITECTURE.ts` (868 lines, detailed)

**Verdict:** overlapping schemas. Recommend keep POSITION_INSTANCE detailed + reduce UNIFIED_DATA_MODEL to summary that imports POSITION_INSTANCE.

### A13. master_framework.txt — **2 places** (CORE-internal)
- `prompts/master_framework.txt`
- `prompts/resource_calculation/master_framework.txt`

### A14. construction expert prompt — **2 versions** (CORE-internal)
- `prompts/claude/assistant/construction_expert.txt` (193 lines, v1)
- `prompts/claude/assistant/stav_expert_v2.txt` (380 lines, v2)

### A15. Future-planning duplicates (archive vs active)
- `docs/TASK_TZ_TO_SOUPIS_PIPELINE_v3.md` ↔ `docs/archive/future-planning/TASK_TZ_to_Soupis_Pipeline_v3.md`
- `docs/TASK_VZ_SCRAPER_WORKPACKAGES_v3.md` ↔ `docs/archive/future-planning/TASK_VZ_Scraper_WorkPackages_v3.md`

---

End of part A. Continued in `06_duplicates_conflicts_part2_value_conflicts.md` (B-section).
