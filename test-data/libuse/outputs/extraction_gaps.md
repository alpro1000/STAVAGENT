# Extraction Gaps — Libuše objekt D (Π.0 Discovery synthesis)

Cross-cutting synthesis of `extraction_inventory.md` (script→output
map), `dxf_full_inventory.md` (DXF source coverage), and
`pdf_tables_inventory.md` (XLSX column coverage).

Each gap has: **what's missing**, **where it lives**, **downstream
impact**, **estimated effort**, **priority HIGH / MEDIUM / LOW**.

Bottom line: ~30 distinct gap categories. **6 HIGH** are responsible
for the bulk of recent reactive hotfix work and the PROBE 7 class of
bug. **9 MEDIUM** would tighten the pipeline meaningfully. **15 LOW**
are out-of-scope or marginal.

---

## Tier 1 — HIGH PRIORITY (6 gaps)

### G1. Tabulka 0041 cols 5–28 (doors metadata) — 22 columns dropped
- **What's missing**: Otvírání direction, Počet křídel, Celková světlá
  šířka + výška, Popis křídla + zárubně, RAL barvy, **Požární odolnost
  fire rating**, **Rw / R'w acoustic**, **Bezpečn. odolnost RC class**,
  **Tepelné U-value**, **Typ kování / samozavírače / zámku**, **EPS /
  ACS / VZT**, Doplňky, Poznámka.
- **Source**: `185-01_…_0041 TABULKA DVERI.xlsx`, `tab dvere` sheet,
  cols 5–28.
- **Downstream impact**: PROBE 7 root cause — D10/D11 underspec'd
  ~60–105k Kč because RC3+EMZ+ACS+SN2 spec lives in cols 19–26 and is
  dropped. Affects ~50 D-objekt doors (and ~290 komplex doors when
  scaled to A/B/C).
- **Effort**: HIGH (~4 h) — extend `phase_0_9_extract_doors_ownership.py`
  to absorb full row, restructure `objekt_D_doors_ownership.json`
  schema.
- **Priority**: 🔴 **HIGH** — biggest single-point-of-failure for
  finishing-spec accuracy.

### G2. Tabulka 0042 OKEN — 0 % extracted (entire table)
- **What's missing**: Code (W##), window type, dimensions, opening
  type, glazing (Ug), Uw, g-value, Rw, RC, RAL, accessories,
  parapets, supplements — **all 20 columns**.
- **Source**: `185-01_…_0042 TABULKA OKEN.xlsx`. **No phase script
  reads this file.**
- **Downstream impact**: window items currently come from DXF block
  extraction only (W01–W05 + W×H). All thermal / acoustic / glazing /
  hardware / color spec is missing. Energy calculation is broken.
- **Effort**: HIGH (~3 h) — write `phase_pi_0_extract_okna.py`-style
  extractor (none exists today).
- **Priority**: 🔴 **HIGH** — opens up the entire windows specification
  layer.

### G3. DXF block-name attributes for openings (frame type + install context)
- **What's missing**: `Solid` / `FrameButt` / `wCasing` frame-type
  marker; `In_BJ` / `In_FAS` / `In_OBJ` / `Ex_Glass` install context;
  sub-type marker (`Vstup` / `SKLOPNE` / `Unik`); ArchiCAD library ID.
- **Source**: `block_name` attribute on `INSERT` entities in
  `A-DOOR-____-OTLN`, `A-GLAZ-____-OTLN`, `A-GLAZ-CURT-OTLN` layers
  across 11 D-drawings.
- **Downstream impact**: PROBE 7 verification surfaced that
  `In_FAS_1600x2350_…-D` (D10) was distinguishable from interior D10
  in A/B by `In_FAS` vs `In_BJ` prefix — the parser silently dropped
  it. This information is what tells us "fasádní entry door" vs
  "interior pivot door" without consulting Tabulka 0041.
- **Effort**: LOW (~1 h) — add regex parsing in `dxf_parser.py`
  alongside the existing `DIMENSIONS_RE`.
- **Priority**: 🔴 **HIGH** — cheap fix, big leverage for PROBE 7
  class of bug.

### G4. Section drawings (ŘEZY 5400 + 5000) — heights / profiles
- **What's missing**: section profile shapes, vertical dimensions
  (sill height, lintel height, transom width, parapet, balustrade),
  material hatches in section (wall composition, floor structure,
  roof composition), section-cut reference (which plan location), grid
  height datum.
- **Source**: `100_5000_R01.dwg` (1.PP řezy) + `140_5400_R01.dwg`
  (D řezy). Currently parsed for opening geometry only (8 + 13 doors).
- **Downstream impact**: door / window FF codes can't be fully
  resolved without section profile (e.g. FF26 = "solid wooden door
  with transom" — needs profile height to confirm). Façade composition
  hatches in sections drive RF + FF spec.
- **Effort**: HIGH (~6–8 h) — section-to-plan coordinate mapping is
  non-trivial; needs DIMENSION layer parsing + linework analysis.
- **Priority**: 🔴 **HIGH** for completeness, but **MEDIUM if we accept
  PDF-only spec for vertical dims**.

### G5. DXF DIMENSION layer (`A-____-____-DIMS`) — 333 entities/floor
- **What's missing**: architectural dimensions for wall heights,
  spans, radii, opening widths/heights, room diagonals, detail
  dimensions, level marks.
- **Source**: `DIMENSION` entity type on `A-____-____-DIMS` layer
  across all 1.NP / 2.NP / 3.NP půdorys + řezy. Currently 0 % extracted.
- **Downstream impact**: today's pipeline derives wall heights from
  `svetla_vyska_mm` in Tabulka 0020 (a single number per room, no
  variation). Real heights vary along ŘEZY (sloped ceilings in 3.NP).
  Špalety / podhledy m² calculations under- or over-estimate when
  ceilings vary.
- **Effort**: MEDIUM (~3 h) — `ezdxf` exposes DIMENSION entities
  natively; just need to associate to nearest room polygon.
- **Priority**: 🔴 **HIGH** — would replace several heuristic
  fall-backs with literal source values.

### G6. Tabulka 0030 sheets `střechy` + `podhledy` — partial extraction of skladby
- **What's missing**: `phase_0_8_extract_master_skladby.py` only
  re-extracts the `stěny` sheet (26 WF entries). The `střechy` (RF##)
  and `podhledy` (CF##) sheets are loaded by Phase 1 but lose their
  layer-detail richness — `kind` + `specifikum` are not assigned.
- **Source**: `…_0030 TABULKA SKLADEB.xlsx` sheets `střechy` (RF11,
  RF13, RF20) and `podhledy` (CF20, CF21).
- **Downstream impact**: roof + ceiling skladby sometimes resolved to
  wrong vrstva (PROBE 5 FF01 mismap was the floor analogue of this
  bug for FF sheet). Less critical now because Phase 0.15 fixed CF
  manually, but the systemic gap remains.
- **Effort**: LOW (~1 h) — extend `phase_0_8_extract_master_skladby.py`
  to handle 4 more sheets.
- **Priority**: 🔴 **HIGH** for systemic coverage; LOW if PR #1066 is
  the final D-deliverable.

---

## Tier 2 — MEDIUM PRIORITY (9 gaps)

### G7. Tabulka 0043 PROSKLENÝCH PŘÍČEK cols 9–20 — 12 columns dropped
Thermal Uw / acoustic Rw / safety RC / parapets / supplements / notes
on 20 partition types affecting ~150 m² partition area.
**Effort: ~2 h.**

### G8. Tabulka 0080 OSTATNÍCH PRVKŮ cols 6–8 — units / quantity / notes
63 items (fire extinguishers, expansion joints) without quantities →
BOM incomplete. **Effort: <1 h.**

### G9. DXF wall hatches (`A-WALL-____-PATT`) — 76 hatches/floor
Hatch pattern reveals interior wall material finish (plaster grade,
paint, tile) but no FF/WF link today. Lookup table from Tabulka 0030
hatch IDs would resolve.
**Effort: ~3 h.**

### G10. Roof plan `4440_00 STŘECHA` — minimal extraction
- Roof material from HATCH → RF## codes
- Roof slope / pitch from DIMENSION + LINE angle
- Roof drainage symbols (downspout positions)
- Skylight size/type detail
**Effort: ~3 h.**

### G11. POHLEDY 6400_R01 — façade detail extraction
- Façade finish color / material / texture from DIMENSION + HATCH
- Window frame color/profile from block naming
- Sill / lintel detail callout references
- Parapet / cornice / base detail (FF codes)
- Balcony railing FF codes
**Effort: ~4 h.**

### G12. DXF free-form text in `*-IDEN` layers — 200+ entries/floor
Wall heights ("2500"), parenthesized dimensions `(900)`, free notes —
all dropped. Currently regex extracts only WF/CF/F/D/W/OP/LI/LP/TP
prefixes; everything else is discarded.
**Effort: ~2 h** (extend regex coverage).

### G13. Drainage drawing `100_4040_R00 ODVODNĚNÍ TERAS` — fully skipped
Filename matches `re.compile(r"odvodneni", re.IGNORECASE)` skip
pattern. Likely contains drain layout + slopes + sizing.
**Effort: ~2 h** (un-skip + extract drain blocks).

### G14. Phase 0.x hot-fix sprawl — 10 hygiene scripts re-extract source
Phase 0.8 / 0.9 / 0.11 re-extract from XLSX because Phase 1 missed
fields. Π.0 should absorb so A/B/C don't get re-implemented hot-fixes.
**Effort: ~4 h** (consolidation work; not new extraction).

### G15. `phase_0_7_step4_validation.py` — diff never landed in JSON
Cross-checks vs `Vykaz_vymer_stary.xlsx` produce only an MD report.
Π.0 should formalize the validation step → structured `validation_d.json`
for downstream consumption.
**Effort: ~1 h.**

---

## Tier 3 — LOW PRIORITY (15 gaps)

### G16–G20. Out-of-scope DXF layers
- `A-WALL-____-MCUT` (189/floor) — section cutting planes
- `A-DETL-____-OTLN` (130/floor) — detail reference geometry
- `A-DETL-____-THIN` (65/floor) — thin linework / notes
- `A-FLOR-____-OTLN` + `-OVHD` (54/floor) — floor structure overhead
- `S-STRS-…-MBND` + `S-GRID-…-IDEN` (85/floor) — structural grid

These are typically out of finishing scope.

### G21. `A-DETL-GENF-OTLN` (8/floor) — detail fill + blocks
Possible spec info inside detail callouts; skip unless customer
requests detail-level pricing.

### G22. `P-SANR-FIXT-OTLN` — sanitary fixtures (18/floor)
WC / lavatory positions — out of finishing scope.

### G23. `M-HVAC-DUCT-OTLN` (60/floor) — HVAC ductwork
Correctly out of finishing scope.

### G24. `E-ELEC-FIXT-OTLN` (4/floor) — electrical fixtures
Out of scope.

### G25. `I-WALL-____-MCUT` + `-OTLN` (247/floor) — interior wall cutting planes
Section visualization only; no spec data.

### G26. `I-FURN-____-OTLN` (9/floor) — built-in furniture
Closets / kitchen cabinets — separate trade typically.

### G27. `Q-SPCQ-…-OTLN` + `Q-CASE-…-OTLN` (16/floor) — equipment
Out of finishing scope.

### G28. Slab desky `140_ARS_objekt_D_desky.dwg` — fully skipped
Structural reinforcement; not finishing.

### G29. Coordination drawing `140_9421_R00 jadra D 2NP.dwg`
Parsed but yields zero data. Correctly empty.

### G30. Tabulka 0050 col 8 ref product
Brand reference. Single column. Trivial gap.

---

## Cross-cutting structural gaps

### S1. No single canonical extraction output
Currently 10 extraction scripts produce ~10 JSON files
(`objekt_D_per_podlazi_aggregates.json`, `objekt_D_geometric_dataset.json`,
`tabulky_loaded.json`, `tabulky_perobjekt_counts.json`,
`objekt_D_fasada_strecha.json`, `objekt_D_doors_ownership.json`,
`stary_vv_normalized.json`, `dxf_segment_counts_per_objekt_d.json`,
`coverage_audit.json`, `triangulation_audit.json`) re-read 30+ times
downstream. **Π.0 target**: single `master_extract_D.json` with
sections, optional per-source secondary outputs for traceability.

### S2. No source-of-truth + confidence per field
Today's outputs mix literal extraction, derived values (e.g.
`is_garage_gate` derived from cislo + width threshold), and
heuristics (e.g. opening fasádní/vnitřní classification by
distance-to-perimeter) without flagging which is which. Downstream
consumers can't tell PROBE-fixable bugs (raw extraction missing
a field) from spec gaps (source XLSX itself is silent on a column).

### S3. No idempotency contract
Re-running extraction scripts on unchanged input does not always
produce byte-identical output (timestamps, dict-key ordering,
floating-point rounding). Π.0 spec must enforce idempotency for
diff-based validation.

### S4. No A/B/C scope filter
All extraction scripts hardcode `objekt == "D"` filter. Path to
A/B/C requires `is_objekt_X(room_kod)` switch in 10+ places. Π.0 should
parametrize once.

### S5. No DXF-to-Tabulka cross-validation step
PROBE 7 surfaced that DXF (FAKT) and Tabulka 0041 (TABL) disagree on
D10/D11 counts for objekt D. There is no automated step that flags
such mismatches; was caught by user manually counting.

---

## Π.0 implementation priority order

If we absorb gaps in this order, each step has a clear validation
target (compare Π.0 output vs current outputs) before moving on:

1. **G3** DXF block-name attributes (1 h, fast win, addresses PROBE 7)
2. **G1** Tabulka 0041 full row absorption (4 h, addresses PROBE 7)
3. **G6** Tabulka 0030 RF + CF skladby completion (1 h)
4. **S4** A/B/C scope parametrization (2 h, prerequisite for komplex)
5. **S1** Canonical `master_extract_D.json` consolidation (4 h)
6. **G5** DXF DIMENSION layer absorption (3 h)
7. **G2** Tabulka 0042 OKEN full extraction (3 h)
8. **S2** Source + confidence per field schema (2 h, refactors S1)
9. **G7** Tabulka 0043 cols 9–20 (2 h)
10. **G8** Tabulka 0080 cols 6–8 (1 h)
11. **G9** DXF wall hatches (3 h)
12. **G14** Hot-fix sprawl consolidation (4 h)
13. **G15** Validation JSON output (1 h)
14. **S3** Idempotency contract (1 h, refactors all)
15. **S5** DXF↔Tabulka cross-validation (2 h)

**Total Π.0 implementation effort: ~34 h** (HIGH + MEDIUM + structural
gaps).

If we accept "good enough for A/B/C" cutoff: **steps 1–5 only = ~12 h**.
Steps 6–15 can be deferred or done after first A/B/C pricing pass.

---

## Risk register

- **R1 — Idempotency drift**: re-extraction yields different output
  → diff-validation impossible. Mitigation: enforce sorted JSON,
  rounded floats, deterministic dict ordering.
- **R2 — Hidden hot-fixes**: Phase 0.10–0.20 carry domain knowledge
  not visible in Phase 1 (e.g. WF22 reclassification, F20 typo
  detection). Mitigation: audit each hot-fix; document its rule;
  encode in Π.0 + or as a Π.1 transform layer above Π.0.
- **R3 — DXF block-name format drift A→D**: A/B/C drawings may use
  different naming conventions than D (different ArchiCAD library
  version). Mitigation: validate against ABMV-supplied block library.
- **R4 — Tabulka column-order drift A→D**: ABMV may have re-saved
  XLSX with re-ordered columns. Mitigation: locate by header text not
  index.
- **R5 — `phase_5_step1_parse_stary_vv.py`** parses komplex VV (not
  D-only). For per-objekt A/B/C audit, need either re-filter logic or
  per-objekt VV. Decision: file is currently sliced by objekt prefix
  in section_code; re-validate after A/B/C scope parametrization.

---

## Files referenced

- `extraction_inventory.md` (Part 1.1 — script→output map)
- `dxf_full_inventory.md` (Part 1.2 — DXF source coverage)
- `pdf_tables_inventory.md` (Part 1.3 — XLSX column coverage)
- 14 DWG files in `test-data/libuse/inputs/dwg/`
- 9 XLSX files in `test-data/libuse/inputs/`
- 49 phase scripts in `concrete-agent/packages/core-backend/scripts/`

_Generated by Claude Code Π.0 Part 1 discovery synthesis, 2026-05-06._
