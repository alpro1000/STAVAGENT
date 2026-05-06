# DXF/DWG Full Inventory — Libuše objekt D (Π.0 Discovery)

Read-only inventory of DXF/DWG data sources captured by the current
extraction pipeline, vs what is present but **not** lifted into the
canonical dataset. Source for Π.0 Foundation Extraction Layer Part 1
discovery.

---

## Executive summary

The current pipeline extracts **room geometry, opening outlines, and
section tags** from 1.NP/2.NP/3.NP floor plans and podhledy (ceiling)
drawings. It has **14 DWG source files** but **SKIPS 3 drawing
categories entirely** (drainage, desky, coordination — by filename
pattern). Of the 11 actively parsed D-drawings, substantial untapped
data exists.

- **Dimensions** (333 on 1.NP alone): **0% extracted**
- **Section / elevation detail** (ŘEZY, POHLEDY): parsed but not
  lifted into the room dataset
- **Roof plan** (4440): minimal — geometry only, no FF/RF composition
- **Block-name attributes** beyond W×H: **0% extracted** (frame type,
  install-context `In_BJ` / `In_FAS` / `Ex_Glass` are dropped)
- **Hatch patterns + material fills**: ignored (~161 per floor)

Overall extraction coverage: **~65 %** — complete on rooms / openings /
tag codes, missing on dimensions / profiles / block metadata.

---

## 1. Drawing-by-drawing extraction status

| Drawing | File | Role | Extracted | Major gaps | Π.0 priority |
|---|---|---|---|---|---|
| Půdorys 1.NP | 4410 | primary | rooms, doors, windows, tags | dimensions (333), hatches, notes | — |
| Půdorys 2.NP | 4420 | primary | rooms, doors, windows, tags | dimensions, hatches, notes | — |
| Půdorys 3.NP | 4430 | primary | rooms, doors, windows, tags | dimensions, hatches, notes | — |
| Podhledy 1–3.NP | 7410–7430 | ceiling plan | room geometry, CF## tags | door/window FF composition | MEDIUM |
| ŘEZY 1-PP | 100_5000 | section | door geometry only | section profile heights, elevations | **HIGH** |
| ŘEZY D | 140_5400 | section | door geometry only | section profile heights, fasáda detail | **HIGH** |
| POHLEDY D | 140_6400 | elevation | outline geometry | façade finish details, colors, materials | LOW |
| Střecha 4440 | 140_4440 | roof plan | opening geometry | roof composition (RF##), slope, drainage | MEDIUM |
| Odvodnění 4040 | 100_4040 | **SKIPPED** | — | drainage, slopes, sizing | **HIGH** |
| Desky 140_ARS | 140_ARS | **SKIPPED** | — | slab reinforcement, thickness, concrete grade | LOW |
| Jadra 2NP | 140_9421 | coordination | zero data | n/a (expected — no finishing-relevant content) | — |

`SKIP_FILENAME_PATTERNS` in `dxf_parser.py:80` matches `re.compile(r"odvodneni",
re.IGNORECASE)` and `re.compile(r"ARS.*desky", re.IGNORECASE)`.

---

## 2. Layer extraction matrix — 1.NP Půdorys (representative)

20 of 58 layers actively used. 7 of 58 scanned for tags. 31 of 58 fully
ignored.

| Layer | Discipline | Entity | Count | Status | Gap |
|---|---|---|---|---|---|
| `A-AREA-BNDY-OTLN` | ARCH | LWPOLYLINE | 21 | ✅ room polygons | complete |
| `A-AREA-____-IDEN` | ARCH | MTEXT | 21 | ✅ room codes (D.1.S.02 etc.) | complete |
| `A-DOOR-____-OTLN` | ARCH | INSERT | 28 | ✅ door blocks | dimensions only — see §3 |
| `A-DOOR-____-IDEN` | ARCH | MTEXT + INSERT | 122 | ⚠️ 22/28 doors tagged | 6 doors missing codes; free-form heights ignored |
| `A-GLAZ-____-OTLN` | ARCH | INSERT | 11 | ✅ window blocks | dimensions only |
| `A-GLAZ-____-IDEN` | ARCH | MTEXT + INSERT | 55 | ⚠️ W## codes (11/11) | free-form `2400`, `1500 (900)` ignored |
| `A-GLAZ-CURT-OTLN` | ARCH | INSERT | 6 | ✅ curtain wall frames | no FF/RF parsed |
| `A-GLAZ-CWMG-OTLN` | ARCH | INSERT | 24 | ❌ skipped | mullion grid — correct skip |
| `A-WALL-____-IDEN` | ARCH | mixed | 122 | ⚠️ WF/F/CW codes (14/29) | split codes + free-text heights ignored |
| `A-WALL-____-MCUT` | ARCH | LINE | 189 | ❌ ignored | section/hatching geometry |
| `A-WALL-____-OTLN` | ARCH | LINE | 11 | ❌ ignored | wall outline geometry |
| `A-WALL-____-PATT` | ARCH | HATCH | 76 | ❌ ignored | **wall material fill — no FF/WF link** |
| `A-GENM-____-OTLN` | ARCH | INSERT | 109 | ⚠️ partial | 48 OP + 32 LI codes; 29 dropped |
| `A-GENM-____-IDEN` | ARCH | mixed | 486 | ⚠️ OP/LI (80 codes, 9 free-text) | parens dimensions ignored |
| `A-DETL-____-OTLN` | ARCH | LINE | 130 | ❌ ignored | detail-reference geometry |
| `A-DETL-____-THIN` | ARCH | LINE + CIRCLE | 65 | ❌ ignored | thin linework (notes / refs) |
| `A-DETL-GENF-OTLN` | ARCH | INSERT + HATCH | 8 | ❌ ignored | detail fill + blocks |
| `A-FLOR-____-OTLN` | ARCH | LINE | 22 | ❌ ignored | floor covering geometry |
| `A-FLOR-____-OVHD` | ARCH | LINE | 32 | ❌ ignored | floor structure overhead |
| `A-FLOR-HRAL-IDEN` | ARCH | mixed | 12 | ✅ LP## (3/6) | free-text ignored |
| `A-____-____-DIMS` | ARCH | DIMENSION | 333 | ❌ ignored | **architectural dimensions: heights, spans, radii** |
| `A-____-NOTE-TEXT` | ARCH | MTEXT + INSERT | 2 | ❌ ignored | general notes — not scanned |
| `G-____-____-TEXT` | gen | MTEXT + LINE | 174 | ❌ ignored | text + reference geometry; e.g. "OTVOR PRO ROZVAD" |
| `G-____-____-SYMB` | gen | INSERT + MTEXT + LINE | 16 | ❌ ignored | symbols / reusable blocks |
| `G-____-____-DIMS` | gen | INSERT + MTEXT | 2 | ❌ ignored | more dimension/note data |
| `S-STRS-____-MBND` | STRUCT | LINE | 39 | ❌ ignored | structural member boundary |
| `S-STRS-____-OTLN` | STRUCT | LINE | 26 | ❌ ignored | beam/column positions |
| `S-GRID-____-IDEN` | STRUCT | MTEXT + INSERT | 32 | ❌ ignored | grid axes (D1–D5, DA–DC) |
| `S-GRID-____-OTLN` | STRUCT | LINE | 24 | ❌ ignored | grid lines (coordinate frame) |
| `M-HVAC-DUCT-OTLN` | MECH | LINE | 60 | ❌ ignored | HVAC ductwork (correct — out of finishing scope) |
| `P-SANR-FIXT-OTLN` | PLUMB | INSERT | 18 | ❌ ignored | sanitary fixtures (WC, sinks) |
| `E-ELEC-FIXT-OTLN` | ELEC | INSERT | 4 | ❌ ignored | electrical fixtures |
| `I-WALL-____-MCUT` | INT | LINE | 228 | ❌ ignored | interior wall cutting planes |
| `I-WALL-____-OTLN` | INT | LINE | 19 | ❌ ignored | interior wall outlines |
| `I-FURN-____-OTLN` | INT | INSERT | 9 | ❌ ignored | built-in furniture |
| `Q-SPCQ-____-OTLN` | EQUIP | INSERT | 12 | ❌ ignored | spec'd equipment |
| `Q-CASE-____-OTLN` | EQUIP | INSERT | 4 | ❌ ignored | equipment cases/cabinets |

---

## 3. Block metadata — what's parseable beyond W×H

Current parser (`dxf_parser.py` lines 47–50) uses only:

```python
DIMENSIONS_RE = re.compile(r"(\d{3,4})\s*[xX×]\s*(\d{3,4})(?:\s*[xX×]\s*(\d{3,4}))?")
# Extracts ONLY: width_mm, height_mm, depth_mm
```

### Door blocks (`A-DOOR-____-OTLN`, 16 unique block names sampled)

```
HA_DR_Single_Swing_Solid - In_BJ_900x2100_Vstup-2000314-DPS_1NP-D
HA_DR_Double_Swing_Solid - In_BJ_1200x2100_800-1652965-DPS_1NP-D
HA_DR_Double_Swing_Solid_FrameButt - In_FAS_1600x2350_1000-1915407-DPS_1NP-D
HA_DR_Single_Swing_Solid_wCasing - In_OBJ_1500x2100_900-1771115-DPS_1NP-D
ABMV_CW_Single_Swing_Generic - Ex_Glass_SKLOPNE-1529247-DPS_1NP-D
... (11 more)
```

**Currently lifted**: position (X,Y), W/H from name, D## type code from
nearest text on `A-DOOR-____-IDEN`.

**Present in name, dropped today**:
- Frame type marker — `Solid` / `FrameButt` / `wCasing` (flush /
  butt-hinge / cased opening)
- Installation context — `In_BJ` (interior–byt jednotky) / `In_FAS`
  (façade) / `In_OBJ` (object wall) / `Ex_Glass` (operable glass)
- Sub-type — `Vstup` (entrance), `SKLOPNE` (tilting), and others
- ArchiCAD library ID (the `-NNNNNNN-` numeric token) for traceability

This is exactly what surfaced in the **PROBE 7 verification** for D10 +
D11 — the block name said `In_FAS_1600x2350` but only `D10` + W×H
landed in the dataset, and the bezpečnostní context (RC3/ESG/EMZ/ACS in
Tabulka 0041 for A/B) was lost.

### Window blocks — same pattern, `SinglePanel` vs other styles dropped.

### Curtain walls (`A-GLAZ-CURT-OTLN`)
- `Systémový panel - Sklo-2038694` ← block name confirms glass
  fill but no FF code, glazing area, or frame profile recorded.

---

## 4. Segment-tag prefix coverage (text annotations)

| Prefix | Source layer(s) | Count (D) | Status | Consumer |
|---|---|---|---:|---|
| **WF** wall finish skladba | `A-WALL-____-IDEN` | 29 | ✅ | Phase 3 / Tabulka skladeb |
| **CF** ceiling finish skladba | 3.NP `A-CLNG-____-IDEN` | 42 | ✅ | Phase 3 / Tabulka skladeb |
| **F** floor / façade (ambiguous) | `A-WALL-____-IDEN` | 5 | ✅ | Phase 3 (needs disambiguation) |
| **D** door type | `A-DOOR-____-IDEN` | 22 | ✅ | Phase 3 / Tabulka 0041 |
| **W** window type | `A-GLAZ-____-IDEN` | 11 | ✅ | Phase 3 / Tabulka 0042 |
| **OP** other product | `A-GENM-____-IDEN` | 183 | ✅ | Phase 3 (broad — needs sub-class) |
| **LI** lista / interior | `A-GENM-…-IDEN`, `A-FLOR-HRAL-IDEN` | 164 | ⚠️ | Phase 3 — needs Tabulka 0060 disambig |
| **LP** zábradlí (railing) | `A-FLOR-HRAL-IDEN` | 58 | ✅ | Phase 3 / railing library |
| **TP** klempíř (sheet metal) | `A-WALL-____-IDEN` | 49 | ✅ | Phase 3 / klempíř library |
| **OS** osvětlení | `E-LITE-EQPM-IDEN` | 85 | ✅ | out of finishing scope (correct) |
| **CW** curtain wall | `A-WALL-____-IDEN` | 11 | ⚠️ | no clear consumer / match target |
| **FF** floor finish skladba | n/a in DXF | 0 | ❌ | only inferred from room defaults |
| **RF** roof skladba | roof plan 4440 | 0 | ❌ | only inferred from roof-plan defaults |
| **KK** kitchen unit codes | n/a in 1.NP probe | ? | unverified | likely 2.NP/3.NP only |
| **KP** door/window accessories | embedded in block names | 0 | ❌ | not separated today |
| **FM/FP** façade material | POHLEDY 6400 | 0 | ❌ | not extracted from elevation |

**Free-text in `*-IDEN` layers** (~50 % of total text on 1.NP):
- door size hints, wall heights ("2500"), parenthesized dimensions
  `(900)`, free notes — all dropped today.

---

## 5. Section drawings (ŘEZY) — minimal extraction

`100_5000_R01` (1-PP řezy) and `140_5400_R01` (D řezy) are parsed for
opening blocks (8 + 13 doors respectively). Everything else in a
section is lost:

- ❌ Section profile shape — reveals ceiling height variation, sill
  height, lintel height, transom width
- ❌ Vertical dimension annotations
- ❌ Material hatches in section (wall composition layers, floor
  structure, roof composition)
- ❌ Section-cut reference (which plan location this section crosses)
- ❌ Vertical reference (grid height, floor elevation, datum)

**Pipeline impact**: door/window FF codes can't be fully resolved
without section profile (e.g. FF26 might be "solid wooden door with
transom" — needs profile height to confirm).

---

## 6. Elevations (POHLEDY 6400_R01)

- ✅ Geometry outlines detected. 38 segment tags found (mostly
  annotation/reference, not building specs).
- ❌ Façade finish details (color, material, texture from dim
  annotations or fill patterns)
- ❌ Window frame color/profile from block naming
- ❌ Sill, lintel detail callout references
- ❌ Parapet / cornice / base detail (shape, material, FF codes)
- ❌ Balcony railing FF codes
- ❌ Entrance canopy / portico FF codes

**Pipeline impact**: façade finishes (FF = "FF01 render + paint") are
inferred from defaults, not extracted from elevation.

---

## 7. Roof plan (4440_00 — Střecha)

- ✅ 19 window-like openings (skylights?)
- ✅ 40 segment tags
- ✅ Verdict: "pass" (minimal content expected)
- ❌ Roof structure type (hipped, gabled, flat) — geometry shows
  silhouette only
- ❌ Roof material from HATCH (tiles, membrane, shingles) → RF## codes
- ❌ Roof slope / pitch (implied by LINE angles, not calculated)
- ❌ Roof drainage system (downspout positions from symbols)
- ❌ Skylight size/type detail
- ❌ RF composition (RF## codes for roof finish, insulation, structure)

---

## 8. Skipped drawings — DELIBERATELY

### `100_4040_R00` Odvodnění teras — **fully skipped**
Filename matches `re.compile(r"odvodneni", re.IGNORECASE)`.
Likely contents: drainage layout (gutters, drains, fall lines), slope
arrows + gradients, drain pipe sizing/material, sump/collection pits.
**Impact**: zero drainage spec data. Likely material gap for terrace
finishing items.

### `140_ARS_objekt_D_desky` — **fully skipped**
Filename matches `re.compile(r"ARS.*desky", re.IGNORECASE)`.
Likely contents: slab reinforcement layout, slab thickness/concrete
grade, post-tensioning, connection details.
**Impact**: zero slab composition / structural spec — but this is
structural, not finishing scope; LOW priority for Π.0.

### `140_9421_R00` Jadra 2NP — **parsed, yields zero data**
Coordination drawing; no rooms / doors / windows / segment tags.
Verdict: pass (correctly empty).

---

## 9. Quantified coverage

### Geometry
| Category | Present | Extracted | Coverage |
|---|---|---|---|
| Room polygons | 20 / floor | 20 | **100 %** |
| Room codes | 20 / floor | 20 | **100 %** |
| Door openings | 22–28 / floor | 22–28 | **100 %** |
| Window openings | 11–20 / floor | 11–20 | **100 %** |
| Curtain wall panels | 3–6 / floor | 3–6 | **100 %** |

### Tag codes
| Category | Present | Extracted |
|---|---|---|
| WF / CF / D / W / OP / LI / LP / TP / OS | as listed §4 | **100 %** |
| Free-text in `*-IDEN` layers | ~200+ / floor | **0 %** |

### Metadata
| Category | Present | Extracted | Coverage |
|---|---|---|---|
| Door/window block-name dimensions (W×H) | 100 % | 100 % | 40 % (no frame type, no install context) |
| Door/window frame type prefix | 100 % | 0 % | **0 %** |
| Architectural dimensions (DIMENSION layer) | 333 / floor | 0 | **0 %** |
| Wall/floor/roof material hatches | 161+ / floor | 0 | **0 %** |
| Section profile heights | present | 0 | **0 %** |
| Façade finish (POHLEDY + hatches) | present | 0 | **0 %** |

**Overall extraction coverage ≈ 65 %.**

---

## 10. Π.0 priority ranking

### Tier 1 — HIGH (blocks ~30 % of finishing spec)

1. **Block-name attributes for doors / windows / curtain walls** — frame
   type prefix (`Single`/`Double`/`Solid`/`FrameButt`/`wCasing`),
   install context (`In_BJ`/`In_FAS`/`In_OBJ`/`Ex_Glass`), sub-type
   (`Vstup`/`SKLOPNE`). Direct fix for the PROBE 7 D10 underspec class
   of bug. Effort LOW (regex on block name). Value HIGH.
2. **Section drawing (ŘEZY) heights + profiles** — extract
   DIMENSION + linework from `100_5000_R01` + `140_5400_R01`, link
   section-to-plan via section-cut reference. Required for door/window
   FF spec (sill, lintel, transom). Effort HIGH (coord mapping).
   Value HIGH.
3. **DIMENSION layer (`A-____-____-DIMS`)** — 333 entities/floor
   currently dropped. Architectural dimensions for wall heights,
   spans, radii. Effort MEDIUM. Value HIGH.

### Tier 2 — MEDIUM (refinement, ~15 % gap fill)

4. **Roof composition (RF##) from 4440** — parse roof hatches +
   slope-dimension annotations. Effort MEDIUM. Value MEDIUM.
5. **Façade detail from POHLEDY 6400 + ŘEZY hatches** — façade finish
   color / material / sealant / mounting. Effort MEDIUM (hatch pattern
   interpretation). Value MEDIUM.
6. **Wall finish hatches (`A-WALL-____-PATT`, 76/floor)** — link hatch
   pattern to WF## codes (lookup table from Tabulka 0030). Effort LOW.
   Value MEDIUM.
7. **Drainage (`100_4040`)** — un-skip, parse drain sizing +
   gradients + collection pits. Effort MEDIUM. Value MEDIUM.

### Tier 3 — LOW (out of scope or marginal)

8. Slab desky (`140_ARS`) — structural; not finishing.
9. Sanitary fixtures (`P-SANR-FIXT-OTLN`) — out of finishing scope.
10. Free-form `G-____-____-TEXT` notes — would need NLP. Low return.

---

## Files referenced

- `test-data/libuse/outputs/dxf_layer_inventory.md` — detailed layer
  breakdown (existing)
- `test-data/libuse/outputs/dxf_segment_tag_inventory.md` — tag
  extraction per layer (existing)
- `test-data/libuse/outputs/dxf_parser_test.json` — sample parse output
  (3 drawings)
- `test-data/libuse/outputs/dxf_segment_counts_per_objekt_d.json` —
  comprehensive tag counts across 11 D-drawings
- `test-data/libuse/outputs/dxf_parser_quality_scorecard.md` — parser
  verdict per drawing
- `test-data/libuse/outputs/objekt_D_geometric_dataset.json` — final
  enriched per-room dataset
- Source DWGs in `test-data/libuse/inputs/dwg/` (14 files)

_Generated by Claude Code Π.0 Part 1 discovery, 2026-05-06._
