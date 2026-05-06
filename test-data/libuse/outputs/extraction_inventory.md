# Extraction Inventory — Libuše objekt D pipeline (Π.0 Discovery)

Read-only mapping of all 49 `phase_*.py` scripts in
`concrete-agent/packages/core-backend/scripts/` → which input source
each reads, which output file each writes, what data fields populate.

Goal: identify which scripts genuinely **extract** primary data (DWG /
DXF / XLSX direct I/O) vs which are downstream transforms / generators
/ audit. The former are the absorption candidates for the Π.0
Foundation Extraction Layer.

---

## EXTRACTION TIER — direct source reading (DWG / DXF / XLSX)

> These do `pd.read_excel(...)`, `openpyxl.load_workbook(...)` or
> `ezdxf.readfile(...)` on the original source files. They are the true
> extraction tier and should be absorbed into Π.0.

### `phase_0_7_step1_aggregates.py`
- **Inputs**: 12 DXF files (via `parse_batch()` from `dxf_parser`)
- **Outputs**: `objekt_D_per_podlazi_aggregates.json`
- **Fields**: `rooms[]: {code, objekt, podlazi, byt_or_section,
  mistnost_num, area_m2, perimeter_m, code_position, source_drawing}`,
  `openings_by_podlazi[]`
- **Role**: primary DXF geometry parser (rooms, areas, perimeters per
  floor)

### `phase_0_7_step2_fasada_strecha.py`
- **Inputs**: 5 DXF files (1.NP, 2.NP, 3.NP, střecha, pohledy)
- **Outputs**: `objekt_D_fasada_strecha.json`
- **Fields**: `footprint_per_podlazi{}`, `facade_area_m2{}`,
  `roof_area_m2`, `total_height_m`, `per_orientation_areas{}`
- **Role**: DXF geometry — façade/roof computation (heights from TEXT
  annotations, polygons from `A-ROOF-OTLN`)

### `phase_0_7_step3_classify_openings.py`
- **Inputs**: `objekt_D_per_podlazi_aggregates.json` + 4 DXF files
  (primary floors)
- **Outputs**: extends `objekt_D_per_podlazi_aggregates.json` with
  `openings_classified`
- **Fields**: `openings_classified.per_podlazi_classified[]: {otvor_type,
  position, width_mm, depth_mm, distance_to_perimeter_mm,
  classification: fasadni|vnitrni}`
- **Role**: spatial classification — opening vs building footprint

### `phase_1_step1_load_tabulky.py`
- **Inputs**: 2 XLSX (Tabulka místností 0020 + Tabulka skladeb 0030)
- **Outputs**: `tabulky_loaded.json`
- **Fields**: `mistnosti{code: {nazev, plocha_m2, svetla_vyska_mm,
  skladba_podlahy, povrch_podlahy, povrch_sten, typ_podhledu,
  povrch_podhledu}}`, `skladby{code: {kind, label, vrstvy[],
  celkova_tloustka_mm}}`
- **Role**: primary XLSX parser (rooms + finish schedules + layer
  composition)

### `phase_0_8_extract_master_skladby.py`
- **Inputs**: XLSX Tabulka skladeb + upstream
  `objekt_D_geometric_dataset.json`
- **Outputs**: patches `objekt_D_geometric_dataset.json` with WF entries
- **Fields**: `rooms[].skladby_sten{code, celkova_tloustka_mm, label,
  vrstvy[], kind, specifikum}`
- **Role**: re-extraction of master skladeb after Phase 1.x; lifts 26
  WF wall types with full layer detail (was a hot fix when Phase 1
  missed `specifikum` field)

### `phase_0_9_extract_doors_ownership.py`
- **Inputs**: Tabulka 0041 XLSX (`tab dvere` sheet) + geometry dataset
- **Outputs**: `objekt_D_doors_ownership.json`
- **Fields**: `ownership{room_code: [{cislo, typ, sirka_otvoru_mm,
  vyska_otvoru_mm, is_garage_gate, from_room, to_room}]}`
- **Role**: per-door ownership lookup from explicit Tabulka 0041
  `z_místnoti` / `do_místnoti` columns + garage-gate detection

### `phase_5_step1_parse_stary_vv.py`
- **Inputs**: `Vykaz_vymer_stary.xlsx`
- **Outputs**: `stary_vv_normalized.json`
- **Fields**: `items[]: {code, popis_normalized, MJ, mnozstvi,
  jednotkova_cena, celkova_cena, section_code}`
- **Role**: legacy bill-of-quantities parser (for Phase 5 audit
  comparison)

### `phase_6_1_step1a_tabulky_analysis.py`
- **Inputs**: XLSX Tabulka 0020 + 0030
- **Outputs**: `tabulky_structure_analysis.md`,
  `tabulky_perobjekt_counts.json`
- **Fields**: sheet structure validation, row counts, code coverage
  per tabulka
- **Role**: structural validation of source XLSX

### `phase_6_1_step1b_dxf_counts.py`
- **Inputs**: 12 DXF files (via `parse_batch()`)
- **Outputs**: `dxf_segment_counts_per_objekt_d.json`
- **Fields**: `{prefix: {objekt_D: {code: count}, spol_1pp: {…}}}` for
  OP / LI / LP / TP / W / D / RF / WF / CF / FF
- **Role**: comprehensive DXF segment-tag census (cross-checks geometry
  parser; this is what produced the authoritative FAKT counts in
  PROBE 7)

### `phase_6_5_spalety_measurement.py`
### `phase_6_5_v2_spalety.py`
- **Inputs**: DXF files + `objekt_D_geometric_dataset.json` +
  `objekt_D_doors_ownership.json` (v2 only)
- **Outputs**: patches items with re-measured špalety m²
- **Fields**: per-room špalety_m² (vnitřní + fasádní) using
  obvod × tloušťka × faktor
- **Role**: L2.5 actual measurement (replaces 30/70 heuristika).
  Mixed extraction + transform — re-reads DXF for opening obvod;
  cross-references Tabulka 0030 for tloušťka

---

## TRANSFORM TIER — JSON-to-JSON enrichment (no source I/O)

### `phase_1_step2_enrich_rooms.py`
- **Inputs**: `objekt_D_per_podlazi_aggregates.json` +
  `tabulky_loaded.json` + DXF parse batch (proximity join)
- **Outputs**: `objekt_D_geometric_dataset.json`
- **Fields**: `rooms[]: {code, nazev, objekt, podlazi, plocha_m2,
  svetla_vyska_mm, skladba_podlahy, povrch_podlahy, povrch_sten,
  typ_podhledu, povrch_podhledu, code_position, segment_tags[],
  openings[], enrichment_warnings[]}`
- **Role**: spatial join (DXF geometry + XLSX specs + segment tag
  proximity)

### `phase_1_step3_skladby_decomp.py`
- **Inputs**: `tabulky_loaded.json` + `objekt_D_geometric_dataset.json`
- **Outputs**: patches geometric dataset with `skladby_decomposed`
- **Fields**: decomposes finish codes (F01, WF20, CF30) → layers with
  material specs + thickness + product refs
- **Role**: composition-layer explosion (code → detailed layer BOM)

### `phase_1_step4_aggregates.py`
- **Inputs**: `objekt_D_geometric_dataset.json`
- **Outputs**: per-room aggregated metrics
- **Fields**: total wall area / floor area per finish code per room
- **Role**: geometric aggregation (quantities per room per finish)

### `phase_3c_partD_refinements.py`
- **Inputs**: items 3a + 3b + 3c (A/B/C)
- **Outputs**: refinements applied in-place
- **Fields**: quantity/note adjustments based on spatial logic
- **Role**: post-generation cleanup before merge

### `phase_3c_combine.py`
- **Inputs**: 7 item JSONs (3a, 3b, 3c A/B/C/D, 3d, 3e)
- **Outputs**: `items_objekt_D_complete.json`
- **Fields**: merged `items[]` + metadata (`items_per_source`,
  `items_per_kapitola`, `carry_forward_findings`)
- **Role**: consolidation merge

### `phase_6_1_step2_apply_counts.py`
- **Inputs**: `dxf_segment_counts_per_objekt_d.json` + items
- **Outputs**: items patched with DXF-verified counts
- **Fields**: adds `dxf_verified_count` to segment-based items
- **Role**: count cross-check — items vs DXF spatial counts

### `phase_6_2_reclassify_osazeni.py`
- **Inputs**: items dataset
- **Outputs**: reclassified items (osazení = equipment/fitting)
- **Fields**: reclassifies PSV items by mounting location (podlaha /
  stěna / strop)
- **Role**: classification refinement

### `phase_6_4_fixes.py`
- **Inputs**: audit report + items
- **Outputs**: fixed items dataset
- **Fields**: applies automated fixes (missing fields, qty corrections)
- **Role**: automated remediation

### `phase_7a_v2_part1_groups.py`
### `phase_7a_v2_part2_lookup.py`
- **Inputs**: items dataset
- **Outputs**: `urs_query_groups.json`, `urs_lookup_cache.json` (P1/P2)
- **Fields**: items grouped by trade prefix; ÚRS candidate lookup
- **Role**: pre-pricing grouping for ÚRS lookup batch

### `phase_5_step2_fuzzy_match.py`
- **Inputs**: `stary_vv_normalized.json` + items
- **Outputs**: `match_candidates.json`
- **Fields**: `{old_item: {popis_normalized, candidates: [{new_item_id,
  match_score, evidence}]}}`
- **Role**: fuzzy text matching legacy ↔ new

### `phase_5_step3_apply_diff.py`
- **Inputs**: `match_candidates.json` + items
- **Outputs**: `phase_5_diff.json`
- **Fields**: applied matches, unmatched legacy items, qty deltas
- **Role**: diff application — legacy vs new estimate

---

## GENERATION TIER — items creation (code → positions)

### `phase_3a_generate_items.py`
- **Inputs**: `objekt_D_geometric_dataset.json` +
  `objekt_D_per_podlazi_aggregates.json`
- **Outputs**: `items_phase_3a_vnitrni.json`
- **Fields**: `items[]: {item_id, kapitola (HSV-611/612, HSV-631,
  PSV-771/776/781/784), popis, MJ, mnozstvi, misto, skladba_ref,
  urs_code: null, confidence, status: to_audit}`
- **Role**: interior finishes (plasterboard, tile, paint; door /
  window / hardware)

### `phase_3b_generate_items.py`
- **Inputs**: `objekt_D_geometric_dataset.json` +
  `objekt_D_fasada_strecha.json`
- **Outputs**: `items_phase_3b_vnejsi_a_suteren.json`
- **Fields**: items with `kapitola` HSV-641 fasáda / HSV-651 střecha /
  HSV-612 sokl
- **Role**: exterior + basement (façade, roof, basement finishes)

### `phase_3c_partA_sdk.py`
- **Outputs**: `items_phase_3c_sdk.json`
- **Role**: drywall ceilings (SDK composition into positions)

### `phase_3c_partB_truhl_zamec.py`
- **Outputs**: `items_phase_3c_truhl_zamec.json`
- **Role**: joinery + locks (enumerated by room × opening type)

### `phase_3c_partC_detaily.py`
- **Outputs**: `items_phase_3c_detaily.json`
- **Role**: finishing details (transitions, trim, corner beads)

### `phase_3d_generate_items.py`
- **Outputs**: `items_phase_3d_leseni_pomocne.json`
- **Role**: scaffolding + temporary structures

### `phase_3e_generate_items.py`
- **Outputs**: `items_phase_3e_osazeni_specialni_uklid_vrn.json`
- **Role**: equipment + special services + cleanup + VRN

### `phase_6_generate_excel.py`
- **Inputs**: `items_objekt_D_complete.json` + all enrichment JSONs
- **Outputs**: `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx`
- **Role**: Excel export (deliverable format)

### `phase_8_list11_sumarizace.py`
- **Outputs**: List 11 master rows in Excel + `list11_summary.json`
  metadata
- **Role**: summary statistics (List 11 sumarizace dle ÚRS kódu)

---

## HOTFIX / HYGIENE TIER — targeted patches discovered post-Phase 6

### `phase_0_10_documentation_audit.py`
- **Outputs**: `documentation_inconsistencies.json`
- **Role**: audit of XLSX inconsistencies (D1–D6 issues; 6 ABMV email
  items, now 8 post-PROBE 7)

### `phase_0_11_add_missing_kojí.py`
- **Role**: manual inject S.D.16 + S.D.42 (DXF parser gap fix)

### `phase_0_12_add_f15_tepelna_izolace.py`
- **Role**: F15 izolace stropů 1PP — PROBE 4 fix (+134k Kč)

### `phase_0_13_complete_1PP_catalog.py`
- **Role**: F11 + F14 inject + FF01 deprecate (PROBE 5)

### `phase_0_14_full_coverage_audit.py`
- **Outputs**: `coverage_audit.json`
- **Role**: per-room gap matrix audit

### `phase_0_14b_triangulation_audit.py`
- **Outputs**: `triangulation_audit.json`
- **Role**: 3-way Tabulka × Starý VV × Pipeline cross-check

### `phase_0_15_sdk_podhled.py`
- **Role**: CF20/CF21 SDK podhled (+227k Kč)

### `phase_0_16_krocejova_izolace.py`
- **Role**: FF20/21/30/31 kročejová izolace 25mm (+88k Kč)

### `phase_0_17_keramicky_obklad_gap.py`
- **Role**: F06 keramický obklad gap fill (+9k Kč)

### `phase_0_18_psb_beton.py`
- **Role**: PSB beton 40mm m³ konverze (+141k Kč)

### `phase_0_19_d05_cleanup.py`
- **Role**: D05 PROBE 6 cleanup — rolovací brána, scope C → qty=0

### `phase_0_20_filter_view_table.py`
- **Role**: Excel List 12 Filter_view (Excel Table `VykazFilter`)

---

## AUDIT / SCORECARD TIER — read-only reports

- `phase_0_7_step4_validation.py` — validation vs Vykaz_vymer_stary
- `phase_1_step5_scorecard.py` — Phase 1 scorecard
- `phase_3a_scorecard.py` … `phase_3e_scorecard.py` — per-Phase 3 reports
- `phase_3c_scorecard.py` — Phase 3c combined scorecard
- `phase_5_step67_audit_report.py` — Phase 5 reconciliation report
- `phase_6_3_audit.py` — pre-ÚRS QA (`audit.json`)

---

## Π.0 absorption candidates (top 10)

These 10 scripts perform **direct I/O on external sources** and form
the true extraction tier. Π.0 should consolidate them under one
orchestrator + per-source-type modular extractors.

| # | Script | Source kind | What it lifts |
|--:|--------|-------------|---------------|
| 1 | `phase_0_7_step1_aggregates.py` | DXF (12 files) | rooms — polygon, area, perimeter |
| 2 | `phase_0_7_step2_fasada_strecha.py` | DXF (5 files) | façade + roof areas, height levels |
| 3 | `phase_0_7_step3_classify_openings.py` | DXF (4 files) | opening positions + fasádní/vnitřní classification |
| 4 | `phase_1_step1_load_tabulky.py` | XLSX (0020 + 0030) | rooms + finish schedules + skladby |
| 5 | `phase_0_8_extract_master_skladby.py` | XLSX (0030) | 26 WF wall types + specifikum |
| 6 | `phase_0_9_extract_doors_ownership.py` | XLSX (0041) | doors per room + garage-gate flag |
| 7 | `phase_5_step1_parse_stary_vv.py` | XLSX (Vykaz_vymer_stary) | legacy items |
| 8 | `phase_6_1_step1a_tabulky_analysis.py` | XLSX (0020+0030) | structural validation |
| 9 | `phase_6_1_step1b_dxf_counts.py` | DXF (12 files) | segment-tag census per objekt |
| 10 | `phase_6_5_v2_spalety.py` | DXF + XLSX (0030+0041) | špalety re-measurement (mixed extract+transform) |

**Why these 10**: each performs `pd.read_excel`, `openpyxl.load_workbook`,
or `ezdxf.readfile` (or transitive `parse_batch()`) and extracts
fundamental geometric/tabular data. All other scripts (`phase_1_step2+`,
`phase_3+`, `phase_5_step2+`, `phase_6_1_step2+`, `phase_6_2+`) are
downstream — they rely entirely on these JSON outputs.

**Current artefact count**: these 10 scripts produce **~10 distinct
JSONs** (`objekt_D_per_podlazi_aggregates.json`,
`objekt_D_fasada_strecha.json`, `tabulky_loaded.json`,
`objekt_D_geometric_dataset.json` after enrichment,
`objekt_D_doors_ownership.json`, `stary_vv_normalized.json`,
`tabulky_perobjekt_counts.json`, `dxf_segment_counts_per_objekt_d.json`,
plus 2 transient parse outputs) re-read 30+ times downstream.

**Π.0 consolidation target**: single canonical `master_extract_D.json`
with sections (rooms, walls, openings, skladby, doors, windows, OPs,
LIs, LPs, TPs, façade, roof, segment_counts, stary_vv_normalized) +
optional per-source secondary outputs for traceability.

---

## Notable observations

1. **Phase 0.x hotfix sprawl**: 10 hotfix/hygiene scripts (0.10–0.20)
   were created reactively after Phase 6. Several of them (0.8, 0.9,
   0.11) re-extract from XLSX because Phase 1 missed fields. Π.0 should
   absorb so these don't get re-implemented for A/B/C.

2. **`phase_0_7_step4_validation.py`** ran cross-checks against
   `Vykaz_vymer_stary.xlsx` but produced only an MD report — the diff
   never landed in a JSON. Π.0 could formalize this validation step.

3. **`phase_6_5_v2_spalety.py`** is mixed extract+transform — it
   re-reads DXF for opening obvod despite the geometry dataset being
   ostensibly complete. This is a sign the geometry dataset
   under-extracts (no per-opening obvod or shape).

4. **`phase_5_step1_parse_stary_vv.py`** is a one-time legacy parser;
   for A/B/C komplex, this needs to either re-parse the full komplex VV
   (from same `Vykaz_vymer_stary.xlsx`) or be skipped if not relevant.

_Generated by Claude Code Π.0 Part 1 discovery, 2026-05-06._
