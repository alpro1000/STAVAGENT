# Audit: Knowledge inventory with GCS bucket — 2026-05-14

**Branch:** `claude/knowledge-audit-2026-05-14`
**Mode:** read-only inventory + integration roadmap (no calculator/classifier changes)
**Scope:** GCS `gs://stavagent-cenik-norms/` + local `knowledge_base/B0–B9` + `docs/normy/` + runtime data files (`2025_03_otskp.xml`, `URS201801.csv`).
**Trigger:** Týden 3-4 CSC demo roadmap — need a single map of "what we have, who reads it, what's the gap" before scoping top-5 integrations.
**Prior audit:** `2026-05-06_b2_and_docs_bridge_ingest_audit.md` covered B2 + docs/normy/ bridge ingest. This audit picks up the GCS half plus a calculator-readers map.

---

## §1 Inventory matrix

### §1.1 GCS bucket `gs://stavagent-cenik-norms/`

| Source | GCS subpath | Local mirror | Size hint | Readers (code) | Status |
|---|---|---|---|---|---|
| **PERI vendor catalogs (×26)** | `B5_tech_cards/peri_*` | `app/knowledge_base/B5_tech_cards/peri_*` (`source_pointer.md` stubs only) | ~26 stubs × {navod,prospekt,plakat}.pdf | `data/peri-pdfs/parse_peri_pdfs.py` (download+pdfplumber → `peri_systems_parsed.json`) | ✅ in bucket, **read by ingest script only**, NOT loaded into engine catalog |
| **BBA-MONOLIT wall TP** | `B5_tech_cards/walls_monolithic_cz_bba_monolit_tp01/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **General concrete handbook** (Příručka pracovníka s betonem) | `B5_tech_cards/general_prirucka_pracovnika_s_betonem/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **3F TP Tábor — RD** | `B5_tech_cards/general_3f_tp_tabor_rd/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **Bednění základů CW15 LAD** | `B5_tech_cards/general_bedneni_zaklady_cw15_lad/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **UPa Pokorný/Suchánek — Betonové mosty II** | `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/source.pdf` | stub + likely `EXTRACT.md` | ≥1 MB | `kb_loader.py` scans B6 metadata; no engine reader | ✅ in bucket, **referenced for bridge KPGuide §16** (per 2026-05-06 audit), but **no engine consumer** |
| **VUT BL001 — Prvky betonových konstrukcí** | `B6_research_papers/vut_brno_bl001_prvky_betonovych_konstrukci/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **Příručka technologa 2005** | `B6_research_papers/prirucka_technologa_2005/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **MZA10 piloty (kurz)** | `B6_research_papers/piloty/mza10_piloty/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan — gap: pile productivity could anchor pile-engine.ts table |
| **Možnosti sanace betonových konstrukcí** | `B6_research_papers/sanace/moznosti_sanace_betonovych_konstrukci/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **Beton journals 2023/01 + 2023/03** | `B6_research_papers/journals/beton_2023_*` | stubs | 2 PDFs | none direct | ⚠️ orphan |
| **Železní mosty a tunely 2008 (conf.)** | `B6_research_papers/conferences/zelezni_mosty_a_tunely_2008/source.pdf` | stub | 1 PDF | none direct | ⚠️ orphan |
| **2 papers** (Vašková, porovnání zk. metod) | `B6_research_papers/papers/*` | stubs | 2 PDFs | none direct | ⚠️ orphan |
| **2 diplomky** (Bělohradská 2020, Nováková 2019 D1) | `B6_research_papers/diplomky/*` | stubs | 2 PDFs | none direct | ⚠️ orphan |
| **Čerpání Plzeň betonárna 2026** | `B3_current_prices/cerpani_plzen_betonarna_2026/source.pdf` | stub | 1 PDF | `kb_loader.py:600` scans B3 | ⚠️ in bucket but **`B3_current_prices/` JSONs are the actual engine input** — PDF not parsed |
| **Berger Bohemia — modernizace trati Plzeň-Chotěšov nabídka** | `B3_current_prices/projekt_berger_bohemia_*` | stub | 1 PDF | same | ⚠️ orphan |
| **Transportbeton Plzeň betonárna 2026** | `B3_current_prices/transportbeton_plzen_betonarna_2026/source.pdf` | stub | 1 PDF | same | ⚠️ orphan |
| **ČSN EN 206 pruvodce** | `B7_regulations/csn_en_206_pruvodce/source.pdf` | stub + `csn_en_206.json` (in B2) | 1 PDF | structured `csn_en_206.json` is loaded; PDF is reference | ✅ JSON consumed |
| `_index/INDEX.json` | bucket root | `scripts/INDEX.json` | ~10 KB | not loaded at runtime | ⚠️ catalog manifest, ingest tool only |

**Bucket totals (from `scripts/INDEX.json` + source_pointer scan):** 46 logical documents, ~63 PDF files across 4 KB buckets (B3/B5/B6/B7). 28 are PERI catalog entries (60 %). 0 entries from DOKA, ACI, fib. Vertex AI Data Store name in source_pointer metadata: `urs-otskp-csn-norms-cenik` (region `europe-west3`).

### §1.2 Local knowledge base (`concrete-agent/.../knowledge_base/`)

| Bucket | Entries | Purpose | Engine readers | Status |
|---|---|---|---|---|
| `B1_otkskp_codes/` | `2025_03_otskp.xml` (17 MB, 17 904 codes) + `xmk_tskp_tridnik.xml` + structure/metadata | OTSKP catalog | `pricing/otskp_engine.py:72-188` loads XML at startup; `services/code_detector.py:37-170` regex+lookup pipeline | ✅ **loaded + used** |
| `B1_rts_codes/` | `metadata.json` only (no data) | RTS placeholder | — | ❌ **empty** — placeholder, not wired |
| `B1_urs_codes/` | `kros_sample.json` + metadata | KROS/URS sample | `kb_loader.py:495` iterates B1_urs entries | ⚠️ sample only; real ÚRS source = `URS_MATCHER_SERVICE/backend/data/URS201801.csv` (1.96 MB), not in B1 |
| `B2_csn_standards/` | 7 TKP JSONs (`tkp_03/17/18/22/24…`) + `tkp_18.md` (15 KB) + `csn_en_206.json` + `metadata.json` + new 2026-05-06 PDFs (7 files, ~22 MB total per prior audit) | TKP excerpts + ČSN EN 206 | `kb_loader.py:621,685` scans B2 metadata; no engine reader pulls TKP18 §7.8.3 maturity values | ✅ partial — JSONs loaded as metadata, **structured tables NOT extracted** |
| `B3_current_prices/` | `bedneni.json`, `berger_*.json` (×4), `productivity_rates.json`, `construction_productivity_norms.json`, `metadata.json`, `default_ceilings/`, `projects/` | Vendor prices, productivity norms, project-specific defaults | `kb_loader.py:600` reads B3 dict at startup; `B4` (next row) houses the actual default_ceilings YAML now used by orchestrator | ✅ loaded |
| `B4_production_benchmarks/` | `bedneni.json` + 4 berger_*.json + `productivity_rates.json` + `default_ceilings/{operne_zdi.yaml, mostovkova_deska.yaml}` + projects/ | Productivity benchmarks + Resource Ceiling source-of-truth (v4.29.0) | `kb_loader.py:662` + `planner-orchestrator.ts` §8b reads `default_ceilings/*.yaml` for ceiling defaults | ✅ **NEW (v4.29.0 Phase 1)** — 2 of 24 element types covered |
| `B5_tech_cards/` | 34 entries (28 PERI + general + technological_postupy + ZS_templates + real_world_examples) | Vendor + technological postupy | `kb_loader.py:92-98` scans metadata; **no engine consumer reads B5 at runtime** (per Agent-3 audit, write-heavy via Perplexity, read-empty) | ⚠️ **loaded but unused** — primary gap |
| `B6_research_papers/` | 12 entries from GCS + UPa locally extracted (Pokorný-Suchánek, zatižitelnost, prechody, výkresy mostů) | Bridge research, textbooks, diplomky | metadata scan only | ⚠️ **loaded but unused** |
| `B7_regulations/` | `csn_73_6222_zatizitelnost_mostu/`, `csn_73_6244_prechody_mostu/`, `csn_en_206_pruvodce/`, `en_1992_2_concrete_bridges/`, `tkp_04_zemni_prace/`, `vl_4_mosty/` | Normy stubs + extracted INDEX.yaml | metadata scan; **TKP04 + VL 4 INDEX.yaml NOT cross-linked to engine** | ✅ structured, but no engine consumer beyond passport_enricher prompt context |
| `B8_company_specific/` | `metadata.json` only | placeholder | — | ❌ **empty** |
| `B9_Equipment_Specs/` | `cranes.json`, `excavators.json`, `pumps.json` | Equipment specs | `kb_loader.py:35-45` scans | ✅ loaded; `pour-decision.ts` uses pump capacity tables indirectly |
| `B9_validation/` | `lifecycle_durability/` | Lifecycle data | not in `kb_loader.BUCKETS` list (kb_loader has `B9_Equipment_Specs` only) | ⚠️ **dead** — directory exists but loader doesn't see it |
| `all_pdf_knowledge.json` | root of KB | legacy dump | not loaded by kb_loader | ⚠️ deprecated artifact |

### §1.3 `docs/normy/`

| Path | Files | Engine readers | Status |
|---|---|---|---|
| `docs/normy/tkp/` | 37 PDFs (TKP01..TKP33, all official Czech road TKP catalog; TKP04 has both 2008 and 2026 versions; TKP18 = `TKP18_2022_05.pdf` 866 KB) | none direct — PDFs are canonical norma archive, extracted JSONs live in `B2/tkp/` and `B7_regulations/` | ✅ archive, accessed manually for ingest |
| `docs/normy/navody/` | 6 vendor manuals (domino, quattro, rundflex, sky-kotva, skydeck, srs) + `CALCULATOR_PHILOSOPHY.md` + 2 SKRUZ canonicals | none direct | ✅ canonical reference, hand-checked by maintainers |

### §1.4 Runtime data files

| File | Path | Size | Readers | Status |
|---|---|---|---|---|
| `2025_03_otskp.xml` | `concrete-agent/.../B1_otkskp_codes/` | 17.3 MB | `otskp_engine.py` (Python), `mcp/tools/otskp.py`, `URS_MATCHER_SERVICE/.../otskpCatalogService.js`, `Monolit-Planner/.../otskpAutoImport.js`, `stavagent-portal/.../otskp.js` | ✅ **multi-service consumer** |
| `URS201801.csv` | `URS_MATCHER_SERVICE/backend/data/` | 1.96 MB | URS_MATCHER service only | ✅ used; **not mirrored in B1_urs_codes** |
| `CENEKON201801.csv` | `URS_MATCHER_SERVICE/backend/data/` | 5.8 MB | URS_MATCHER service | ✅ used (price-index overlay on URS) |
| `TSKP_KROS_full.csv` | `URS_MATCHER_SERVICE/backend/data/` | 2.6 MB | URS_MATCHER service | ✅ TSKP↔KROS mapping |
| `TSP201801.csv` | `URS_MATCHER_SERVICE/backend/data/` | 5.6 MB | URS_MATCHER service | ✅ pricing structure 2018-01 frozen |
| `KROS.MDB` | `URS_MATCHER_SERVICE/backend/data/` | 13 MB | not readable in repo env (MS Access) | ⚠️ legacy migration reference, dead at runtime |
| `tridnik.xml` | `URS_MATCHER_SERVICE/backend/data/` | 3.2 MB | URS_MATCHER thesaurus loader | ✅ |
| `xmk_tskp_tridnik.xml` | `concrete-agent/.../B1_otkskp_codes/` | (small) | OTSKP engine loader | ✅ |
| `peri_systems_parsed.json` | `data/peri-pdfs/` (gitignored?) | varies | output of `parse_peri_pdfs.py`; **not loaded by engine** | ⚠️ output exists, downstream consumer missing |
| `doka_cennik_2025-01-01.json` | `concrete-agent/.../B3_current_prices/` | 21 KB | `kb_loader.py` scans B3 dict; **not read by `formwork-systems.ts`** | ⚠️ **structured DOKA pricelist in repo, engine ignores it** |
| `formwork_systems_doka.json` | `concrete-agent/.../B3_current_prices/` | ~20 KB | same | ⚠️ **structured DOKA spec table in repo, engine ignores it** |
| `formwork_systems_peri.json` | `concrete-agent/.../B3_current_prices/` | ~20 KB | same | ⚠️ **structured PERI spec table in repo, engine ignores it** |
| `all_pdf_knowledge.json` | `concrete-agent/.../knowledge_base/` (root) | — | aggregated PDF metadata index | ⚠️ not loaded by `kb_loader` (orphan artifact) |

---

## §2 Gap analysis — what's in the bucket but unused

### §2.1 By bucket

- **B5 PERI catalogs (28 entries):** `parse_peri_pdfs.py` produces `peri_systems_parsed.json` (assembly rates, max pressure, max heights) but the **engine `formwork-systems.ts` catalog stays hardcoded** (`Monolit-Planner/shared/src/constants-data/formwork-systems.ts:155-699`). 25 systems hardcoded with rental_czk_m2_month + pressure_kn_m2 sourced from "DOKA price lists 2024, PERI catalog 2024/2025" inline comments. **Drift risk:** when PERI updates a TI sheet, the bucket gets the new PDF but the TS catalog does not.
- **B6 research (12 entries):** Loaded by `kb_loader` as metadata-only. **Zero downstream readers.** Pokorný-Suchánek bridge textbook contains pour-sequence rules for `mostovkova_deska` (two-phase pour, technological pauza 6 h) that match what `pour-decision.ts` hardcodes — the textbook would let us cite the source instead of hardcoding.
- **B3 price PDFs (3 entries):** The structured `B3_current_prices/*.json` files (Berger, transportbeton) are what `kb_loader.py:600` reads. The PDFs in bucket are reference-only — not parsed. **OK for now**, but updating prices requires manual hand-keying of JSON.
- **B7 csn_73_6222 + csn_73_6244 + en_1992_2 + tkp_04 + vl_4:** All have `INDEX.yaml` extracted (per 2026-05-06 audit Plan §4), but **no engine consumer queries them**. `passport_enricher.py` includes B7 in the prompt context for LLM, but the calculators (pour-decision, formwork-selector, maturity, lateral-pressure) read 0 bytes from B7.

### §2.2 By engine consumer

| Engine module | Hardcoded data block | Should source from |
|---|---|---|
| `Monolit-Planner/shared/src/calculators/maturity.ts:168-203` | `CURING_DAYS_TABLE` (3 curing classes × 5 temp ranges × 3 concrete groups) | TKP18 §7.8.3 — already present as `B2_csn_standards/tkp/tkp_18.md` (15 KB) but the §7.8.3 table is **NOT** in that MD (it's a stub of the TOC/front-matter). PDF `docs/normy/tkp/TKP18_2022_05.pdf` (866 KB) is canonical — extraction needed. |
| `Monolit-Planner/shared/src/calculators/pour-decision.ts:146-150,161-313` | `T_WINDOW_HOURS` (hot/normal/cold pour-time window) + 13-element `ELEMENT_DEFAULTS` (pour sequence, dilation rules) | Pokorný-Suchánek `B6/upa_pokorny_suchanek_betonove_mosty_ii/` + VL 4 `B7/vl_4_mosty/` + TKP18 §7.4 pour rules |
| `Monolit-Planner/shared/src/constants-data/formwork-systems.ts:155-699` | 25 systems × {pressure_kn_m2, rental_czk_m2_month, assembly_h_m2, max_pour_height_m} | `peri_systems_parsed.json` (already exists, not consumed) + DOKA equivalent (gap — no DOKA catalog in bucket) |
| `Monolit-Planner/shared/src/calculators/lateral-pressure.ts:41-59` | k-factor map (standard=0.85, plastic=1.0, scc=1.5) + ρ + g | DIN 18218 / ČSN EN 12812 cited in comment, **no B7 entry exists** for these |
| `concrete-agent/.../app/pricing/otskp_engine.py` + `code_detector.py` | Implicit project_type → ÚRS/OTSKP routing (inferred from code prefix), 5-step detection pipeline | No KB asset; gap = explicit `B1_project_type_routing.json` doesn't exist |
| `concrete-agent/.../app/services/kb_enrichment_service.py:46-150` | Perplexity-result classifier maps result → B# bucket and **saves** to KB | Write-heavy: feeds B5_tech_cards, B6_research_papers. **No reverse path:** B5/B6 contents never re-enter LLM prompt context (other than via passport_enricher generic dump). |

### §2.3 Missing categories (expected but absent)

Bucket scan + local KB scan together still miss:

- **DOKA vendor PDFs in GCS bucket** — missing. But: structured DOKA pricelist + spec JSON already in `B3_current_prices/` (mirror of TI sheets via prior manual ingest). PDFs would just close the audit-trail loop; not a blocker for engine integration #3.
- **fib bulletins** — no entries. CSC reviewers will expect at least Bulletin 80 (Quantification of Properties) or Bulletin 70 (Code Implementation).
- **ACI standards** — no entries. Less critical for CZ market but expected for "international" appearance.
- **DIN 18218 official text** — referenced in `lateral-pressure.ts` comment, no PDF in repo.
- **Učebnice mostů (kompletní)** — only Pokorný-Suchánek II in bucket. ZSV/SŽDC bridge manuals, TÚ bridge lectures absent.

---

## §3 Top-5 integrations recommended for CSC demo

Sorted by **effort × demo impact**. All five doable inside Week 3-4 with no architecture change — each touches **1 engine file + 1 KB extraction script + 1 JSON/YAML asset**.

### Integration #1 — TKP18 §7.8.3 maturity table → `maturity.ts`

**Goal:** replace hardcoded `CURING_DAYS_TABLE` with a YAML asset traceable to TKP18.

**Steps:**
1. Extract §7.8.3 table from `docs/normy/tkp/TKP18_2022_05.pdf` (pdfplumber, ~5 pages around §7.8) → write to `B2_csn_standards/tkp/tkp_18_section_7_8_curing.yaml` with columns `{curing_class, temp_range_c, concrete_group, min_days}`.
2. Generate `Monolit-Planner/shared/src/constants-data/curing-table-generated.ts` from the YAML at build time (small Node script in `shared/scripts/`).
3. `maturity.ts` imports the generated table instead of inline literal; comment updated to cite YAML path + TKP18 page number.

**Effort:** 0.5–0.8 day (PDF extract + YAML schema + codegen + 1 unit test that runs both old and new table side-by-side).
**Demo angle:** "Maturity rules come straight from the SŽ TKP, not a developer's notebook."

### Integration #2 — Pokorný-Suchánek pour sequences → `pour-decision.ts`

**Goal:** annotate `ELEMENT_DEFAULTS` with traceable sources for 5 bridge element types (mostovkova_deska, opery_ulozne_prahy, driky_piliru, rimsa, prechodova_deska).

**Steps:**
1. Extract pour-sequence + technological pauza rules from `B6/upa_pokorny_suchanek_betonove_mosty_ii/` (~15 pages) → `B6/.../pour_sequences.yaml` with `{element_type, sequence_steps, pause_h, citation}`.
2. New helper `getPourSequenceRule(element_type)` in `shared/src/calculators/pour-rules.ts` reading the YAML.
3. `pour-decision.ts` reads `getPourSequenceRule()` for those 5 types; default branch unchanged.
4. UI: pour-decision card displays "(zdroj: Pokorný-Suchánek 2018, str. X)" badge.

**Effort:** 0.7–1 day.
**Demo angle:** "Bridge pour rules cite the standard CTU textbook — not hardcoded heuristics."

### Integration #3 — Wire existing B3 DOKA/PERI JSON → `formwork-systems.ts`

**Goal:** the structured DOKA + PERI tables **already exist in repo** (`B3_current_prices/doka_cennik_2025-01-01.json`, `formwork_systems_doka.json`, `formwork_systems_peri.json`). Engine just doesn't read them. Replace the hardcoded `FORMWORK_SYSTEMS` array with a generated block sourced from those JSONs.

**Steps:**
1. Audit the three JSONs to confirm schema coverage vs. what `formwork-systems.ts` needs: `pressure_kn_m2`, `rental_czk_m2_month`, `assembly_h_m2`, `max_pour_height_m`, `manufacturer`. (Pre-flight check, ~1 h.)
2. Map JSON fields → `FormworkSystemSpec` interface; bridge any gaps with `null` (preserves behavior for missing fields).
3. Add `shared/scripts/gen-formwork-catalog-from-b3.ts` → emits `shared/src/constants-data/formwork-systems-generated.ts`. Keep current `formwork-systems.ts` thin: re-export from `-generated`.
4. Test: golden compare — old hardcoded array vs. generated array, assert ≤2 % numerical drift on existing 25 entries.
5. Stretch: if PERI/DOKA add a new system in 2027, dropping a fresh JSON in B3 + running codegen ships the update with **no TS code change**.

**Effort:** 0.7 day (smaller than originally scoped because source acquisition is **not needed** — the data was already ingested for KPGuide §16 work).
**Demo angle:** "Formwork catalog regenerates from the priced source JSON — when DOKA publishes a 2026 price update, we drop the new JSON and ship in an hour."

### Integration #4 — DIN 18218 lateral pressure factors → `lateral-pressure.ts`

**Goal:** turn the inline k-factor map into a B7 entry with citation.

**Steps:**
1. Source the DIN 18218 (2009) §6 k-factor table — paid standard, but the formula + k values are widely published in academic references. Use ČSN EN 12812 (free) as the primary source where it covers the same ground, fall back to a Wittfoth/Kotrla paper for explicit k values.
2. Create `B7_regulations/din_18218_lateral_pressure/` with `INDEX.yaml` (k-factor table by `concrete_consistency`), `METADATA.md`, `source_pointer.md`.
3. `lateral-pressure.ts` imports the table via a generated TS file (same pattern as #1).
4. Comment in `lateral-pressure.ts` updated to cite `B7_regulations/din_18218_lateral_pressure/INDEX.yaml#L<n>`.

**Effort:** 0.5 day (small table, easy extraction; main risk = source acquisition since DIN 18218 is paywalled).
**Demo angle:** "Lateral pressure formula traceable to DIN 18218 — auditor can click through to the source."

### Integration #5 — explicit ÚRS/OTSKP routing per `project_type`

**Goal:** replace implicit `code_detector.py` inference with an explicit dispatch table.

**Steps:**
1. New KB asset `B1_urs_codes/project_type_routing.json` with schema:
   ```json
   {
     "project_type_to_catalog": {
       "rail_bridge_railway":         {"primary": "OTSKP", "fallback": "URS"},
       "rail_bridge_road":            {"primary": "OTSKP", "fallback": "URS"},
       "road_construction":           {"primary": "OTSKP", "fallback": "URS"},
       "building_residential":        {"primary": "URS",   "fallback": "OTSKP"},
       "building_commercial":         {"primary": "URS",   "fallback": "OTSKP"},
       "industrial":                  {"primary": "URS",   "fallback": "OTSKP"},
       "water_infrastructure":        {"primary": "OTSKP", "fallback": "URS"}
     }
   }
   ```
2. `code_detector.py:143-170` reads the JSON and prioritises the primary catalog before falling back. Existing 5-step pipeline becomes step 0 = routing table, step 1-5 unchanged.
3. New `/api/v1/routing` REST endpoint exposes the table (useful for Monolit-Planner sidebar to display "Tento projekt používá OTSKP").
4. Test: feed a railway-bridge position with both ÚRS and OTSKP variants → assert OTSKP wins via the routing table.

**Effort:** 0.5 day (table is small, code change ≤30 LOC, single test).
**Demo angle:** "Project-type-aware catalog routing — no more 'why did it pick ÚRS for a SŽDC bridge?'"

---

## §4 Effort + dependencies summary

| # | Integration | Effort | Hard dependencies | Soft dependencies | Risk |
|---|---|---|---|---|---|
| 1 | TKP18 maturity | 0.5–0.8 day | TKP18 PDF (already in repo) | pdfplumber, build-time codegen pattern | Low |
| 2 | Pour sequences | 0.7–1.0 day | Pokorný-Suchánek PDF (in bucket) | Generated TS pattern from #1 | Low |
| 3 | B3 DOKA/PERI JSON → catalog | 0.7 day | none (JSONs already in `B3_current_prices/`) | Same generated pattern as #1/#2 | Low |
| 4 | DIN 18218 | 0.5 day | DIN 18218 access (paywalled — use ČSN EN 12812 + academic refs as proxy) | Same generated pattern | Medium — source legitimacy |
| 5 | ÚRS/OTSKP routing | 0.5 day | none | none | Low |
| **Total** | | **2.9–3.5 days** | | | |

Sequencing recommendation: do #1, #2, #5 first (independent, low-risk, all use same codegen pattern) → unblocks the "KB-driven engine" demo narrative regardless of what happens with #3/#4 source acquisition.

---

## §5 Risk assessment

### §5.1 Engine drift after merge
- All five integrations use **build-time codegen** (`shared/scripts/gen-from-kb.ts` or similar): YAML/JSON in `app/knowledge_base/` is the source of truth; TS constants in `shared/src/constants-data/` are regenerated on `npm run build`. **Risk:** if the codegen script is forgotten, KB updates won't reach the engine. **Mitigation:** add codegen step to husky pre-commit hook and to GitHub Actions `monolit-planner-ci.yml`.

### §5.2 Cloud Run cold-start latency
- `kb_loader.py` already preloads B1-B9 on startup (`concrete-agent` has `--min-instances=1` per v4.26.0). Adding 4 small YAMLs (~5-20 KB each) adds <50 ms. **Risk: negligible.**

### §5.3 Source acquisition (#4 only)
- ~~DOKA TI PDFs~~ → **resolved**: `B3_current_prices/{doka_cennik_2025-01-01.json, formwork_systems_doka.json, formwork_systems_peri.json}` already in repo. No external acquisition needed for #3.
- DIN 18218 is paywalled (~€100). **Fallback:** ČSN EN 12812 §6 (free, covers same scope for vertical formwork) + 1 academic reference for k values. Reviewers care about the citation chain, not the specific standard ID.

### §5.4 KB → engine bridge is currently broken
- `kb_enrichment_service.py` writes to B5/B6 via Perplexity but **nothing reads back** (per Agent-3 audit). The top-5 integrations bypass this by going `KB asset → codegen → engine`. **Risk:** if we later want runtime LLM lookup (e.g., for novel element types), we need a separate piece of work to wire B5/B6 into `audit_service.py` or `passport_enricher.py` prompt context. **Out of CSC demo scope.**

### §5.5 GCS bucket consistency vs. local stubs
- All 46 GCS docs have `source_pointer.md` stubs in git ✅
- `scripts/INDEX.json` (local) and `gs://_index/INDEX.json` (per source_pointer notes) must stay in sync. **No CI check for this today.** Out of scope, but worth a P3 ticket.

### §5.6 Vertex AI Data Store
- `urs-otskp-csn-norms-cenik` (europe-west3) ingests from this bucket. None of the top-5 integrations modify what Vertex AI sees — they only add structured derivatives (YAML/JSON) consumed by the calculator engine. Vertex AI continues to power the multi-role LLM audit path. **No conflict.**

---

## §6 Dependencies + ordering

```
Week 3:
  Day 1   #1 TKP18 maturity            (extract → YAML → codegen → test)
  Day 1.5 #5 ÚRS/OTSKP routing         (parallel with #1, no shared files)
  Day 2   #2 Pour sequences            (reuses codegen pattern from #1)
  Day 3   #4 DIN 18218                 (independent, codegen pattern)
Week 4:
  Day 1-2 #3 DOKA params               (if DOKA PDFs obtained — Week 3 task to acquire)
  Day 3   Glue: codegen → husky → CI   (single PR, retroactive for all five)
  Day 4-5 Demo polish + CSC dry-run
```

Critical-path blocker (Week 3 Day 1): no agreed `gen-from-kb.ts` codegen pattern. **Decision needed:** generate at build time (recommended — TS imports stay zero-dependency) or load YAML at runtime (simpler but adds `js-yaml` dep)? Recommend codegen.

---

## §7 Acceptance criteria for this audit

| AC | Status |
|---|---|
| 1. GCS bucket inventoried (46 docs across B3/B5/B6/B7) | ✅ §1.1 |
| 2. Local KB inventoried (B0-B9 + docs/normy/ + runtime data files) | ✅ §1.2–§1.4 |
| 3. Per-source reader mapped | ✅ §1.x "Readers" column + §2.2 engine→source matrix |
| 4. Gap analysis (in bucket but unused) | ✅ §2 |
| 5. Top-5 integrations specified | ✅ §3 |
| 6. Effort estimates <1 day each | ✅ §4 (range 0.5–1.0 day per integration) |
| 7. Risk + dependencies documented | ✅ §5 + §6 |
| 8. No code changes | ✅ doc-only |

---

*Audit completed 2026-05-14. Roadmap implementation candidates: pick up #1, #2, #5 first.*
