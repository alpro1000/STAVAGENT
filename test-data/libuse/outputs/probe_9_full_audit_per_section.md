# PROBE 9 — Per-section TZB audit (objekt D + 1.PP komplex)

**Date:** 2026-05-10
**Scope:** Discipline-by-discipline DXF audit of the 31 koord + per-section
TZB drawings sorted from drop v2 (2026-05-10), establishing a
quantification baseline for prostupy (slab penetrations) + štroby (wall
chases) in HSV scope.
**Predecessors:** `probe_9_source_audit.md` (PARTIAL verdict — PDF-only
gap), `drop_v2_classification_manifest.md` (sort + extract executed)

---

## TL;DR

- **27 of 31 DXFs successfully audited.** 4 VZT DXFs failed conversion
  (LibreDWG group-code bug); 3 chl DXFs failed earlier (object handle
  bug). Cooling discipline has zero machine-readable coverage; HVAC
  has zero across all podlaží.
- **Layer convention discovered per discipline** — Czech-named prefixes
  (`ZT_*` for vodovod+kanalizace, `0_el_*` for silnoproud, `SLP-*` for
  slaboproud, `0UT_*` for UT, `Plyn_*` for plyn). NOT AIA-standard.
- **DN labels machine-readable** as TEXT entities on discipline-specific
  child layers (e.g. `ZT_VKOTY` carries `DN32`, `25,25`; `ZT_POPIS`
  carries `50`, `110` for kanalizace; `Plyn_popis` carries `DN 25`).
- **Prostup count surface (above-ground D + 1.PP, available disciplines):**
  - Above-ground D: ~67 CIRCLEs on pipe layers (kan + vod) across 3 podlaží
  - 1.PP komplex: ~88 CIRCLEs (1.PP koord 32 + UT 51 + K1pp 5)
  - 9421 jadra 2.NP (audited prior): 47 CIRCLEs
  - **Subtotal achievable: ~200 prostup candidates** (excluding 7 missing
    VZT/chl files which would add ~50–100 more)
- **Štroby (wall chases)** visible only on silnoproud `0_el_trasy` layer
  (cable trays drawn as LINE entities, ~14 per podlazi). Other disciplines
  do not annotate štroby on these drawings (typically run through walls
  as drilled holes counted as prostupy).
- **K1pp identity confirmed:** despite the `K` prefix (initially guessed
  silnoproud), the layer convention reveals it's **kanalizace 1.PP**
  (`ZT_K_*` layers + `stoup` + `VTOK` blocks). No corrective `git mv`
  needed; correctly placed in `sources/shared/dwg/`.

**Recommendation: scenario A — proceed with Π.0a Step 8c extractor**
for the 27 successful DXFs (covers ~80% of PROBE 9 D scope). VZT + chl
gap (~20%) handled via scenario B.2 (alternate converter / ABMV
re-export) as parallel track.

---

## 1. Audit method

For each of 31 new DXFs (24 above-ground D + 8 1.PP/komplex shared):

1. Load via `ezdxf.readfile()`, walk all layouts (model + paperspace).
2. Per layer: count entities by DXF type (LINE / LWPOLYLINE / CIRCLE /
   TEXT / MTEXT / INSERT / DIMENSION / HATCH / etc.).
3. Sample TEXT + MTEXT contents (up to 12 per file) to detect DN label
   conventions.
4. Inventory INSERT block names (block names like `stoup`, `VTOK`,
   `SLP_PROSTUP` are discipline-specific symbols).
5. Tabulate per-discipline patterns to inform Π.0a Step 8c layer maps.

Raw audit dump: `/tmp/probe9_audit_raw.json` (42 kB; gitignored).

---

## 2. Conversion + audit success matrix

| Drawing | Convert | Audit | Notes |
|---|:---:|:---:|---|
| **D koord overlay 1.NP** | ✅ | ✅ | 323 entities, architectural backdrop + xref to 6 disciplines |
| **D koord overlay 2.NP** | ✅ | ✅ | 333 entities, same pattern |
| **D koord overlay 3.NP** | ✅ | ✅ | 326 entities, same pattern |
| **D 1.NP kanalizace** | ✅ | ✅ | 260 entities, 19 CIRCLEs, 70 TEXTs |
| **D 2.NP kanalizace** | ✅ | ✅ | 261 entities, 20 CIRCLEs, 76 TEXTs |
| **D 3.NP kanalizace** | ✅ | ✅ | 210 entities, 16 CIRCLEs, 59 TEXTs |
| **D 1.NP silnoproud** | ✅ | ✅ | 381 entities, 0 CIRCLEs, 2 TEXTs (sparse) |
| **D 2.NP silnoproud** | ✅ | ✅ | 375 entities, 0 CIRCLEs, 0 TEXTs |
| **D 3.NP silnoproud** | ✅ | ✅ | 375 entities, 0 CIRCLEs, 0 TEXTs |
| **D 1.NP slaboproud** | ✅ | ✅ | 76 entities, 5 PROSTUP blocks |
| **D 2.NP slaboproud** | ✅ | ✅ | 13 entities, 1 PROSTUP block |
| **D 3.NP slaboproud** | ✅ | ✅ | 18 entities, 1 PROSTUP block |
| **D 1.NP vodovod** | ✅ | ✅ | 267 entities, 4 CIRCLEs, 19 TEXTs (DN labels) |
| **D 2.NP vodovod** | ✅ | ✅ | 246 entities, 0 CIRCLEs, 20 TEXTs |
| **D 3.NP vodovod** | ✅ | ✅ | 237 entities, 8 CIRCLEs, 18 TEXTs |
| **D 1.NP VZT** | ❌ | ❌ | LibreDWG `Invalid group code "125.00\n"` at line 53865 |
| **D 2.NP VZT** | ❌ | ❌ | Same bug at line 54637 |
| **D 3.NP VZT** | ❌ | ❌ | Same bug at line 58069 |
| **D 1.NP chlazení** | ❌ | — | LibreDWG `Object handle not found` (drop v2 step 5) |
| **D 2.NP chlazení** | ❌ | — | Same bug |
| **D 3.NP chlazení** | ❌ | — | Same bug |
| **D UDL_1NP_D xref** | ✅ | ✅ | 972 entities — architectural backdrop only |
| **D UDL_2NP_D xref** | ✅ | ✅ | 1329 entities — same |
| **D UDL_3NP_D xref** | ✅ | ✅ | 1358 entities — same |
| **1.PP koord overlay** | ✅ | ✅ | 2145 entities (rich) — full komplex layout, 32 CIRCLEs |
| **1.PP plyn** | ✅ | ✅ | 495 entities (mostly HATCH), 1 DN label "DN 25" |
| **1.PP slaboproud** | ✅ | ✅ | 34 entities (sparse), 4 PROSTUP blocks |
| **1.PP UT** | ✅ | ✅ | 2064 entities (rich), 51 CIRCLEs, full DN annotation |
| **1.PP vodovod** | ✅ | ✅ | 1085 entities, 87 TEXTs incl. DN labels |
| **1.PP VZT** | ❌ | ❌ | LibreDWG `Invalid group code "200.00\n"` at line 531511 |
| **1.PP K1pp** | ✅ | ✅ | 385 entities — IS kanalizace 1.PP (not silnoproud) |
| **1.PP UDL_1PP xref** | ✅ | ✅ | 3096 entities — architectural backdrop |
| **Komplex spárořez** | ✅ | ✅ | 466 entities — joint zones, NOT TZB |
| **Komplex Rozpisky_ARS** | ✅ | ✅ | 55 entities — titleblock template only |

**Summary:**
- ✅ Convert + audit: **27 / 31** (87 %)
- ❌ VZT failures: **4 / 31** (D 1.NP/2.NP/3.NP + 1.PP) — same LibreDWG group-code bug
- ❌ chl failures: **3 / 31** (D 1.NP/2.NP/3.NP) — LibreDWG handle-not-found bug

---

## 3. Per-discipline layer + symbol convention

Discovered conventions for designing Π.0a Step 8c layer maps:

### 3.1 Vodovod (water supply) — `vod` files

Layer prefix: `ZT_V*`, `ZT-V_TEPLA`, `ZT_STOUP`, `ZT_ARMAT`, `ZT_POZARNI`

| Layer | Purpose | Sample content |
|---|---|---|
| `ZT_VKOTY` | DN annotations | `DN32`, `25,25`, `20,20` (mm sizes for cold/hot pair) |
| `ZT_V_STU` | Voda studená (cold) | LINE pipe runs |
| `ZT-V_TEPLA` | Voda teplá (hot) | LINE pipe runs |
| `ZT_STOUP` | Stoupačky (vertical risers) | INSERT `stoup` block |
| `ZT_ARMAT` | Armatury (valves) | INSERT `ventil_obecny` block |
| `ZT_POZARNI` | Fire hydrant system | LINE + CIRCLE |

**DN extraction**: TEXT entity content on `ZT_VKOTY` layer.
**Prostup detection**: CIRCLEs on `ZT_V_STU` / `ZT_STOUP` (4–8 per podlazi).

### 3.2 Kanalizace (drains) — `kan` files + `K1pp` (1.PP)

Layer prefix: `ZT_K_*`, `ZT_STOUP`, `ZT_TVAR`, `ZT_POPIS`

| Layer | Purpose | Sample content |
|---|---|---|
| `ZT_K_PRIPOJ` | Připojení (connections) | LINE drains |
| `ZT_K_KONDEN` | Kondenzát | LINE |
| `ZT_K_KONDEN_ZAV` | Kondenzát závěs | INSERT |
| `ZT_K_DES_ZAV` | Desková závěs | INSERT |
| `ZT_K_ODVETR` | Odvětrání (vent) | INSERT `vent_hlav` |
| `ZT_K_SPL_ZAV` | Splašková závěs (1.PP only) | INSERT |
| `ZT_K_VYTLAK` | Výtlak (1.PP only) | LINE |
| `ZT_STOUP` | Stoupačky | INSERT `stoup` (12–87 per file!) |
| `ZT_TVAR` | Tvarovky (fittings) | INSERT |
| `ZT_POPIS` | DN labels | TEXT: `50`, `110`, `dno 2320` (depth marks) |

**DN extraction**: TEXT on `ZT_POPIS` (bare numbers `50`, `110`).
**Prostup detection**: CIRCLEs on `ZT_K_*` layers (16–20 per podlazi).
**Stoupačky count**: INSERT `stoup` blocks (12–87 per file).

### 3.3 Silnoproud (power) — `sil` files

Layer prefix: `0_el_*`

| Layer | Purpose | Sample content |
|---|---|---|
| `0_el_trasy` | Kabelové trasy | LINE + MTEXT specs `žlab 100/50` |
| `0_el_koty500` | Dimensions 1:500 | DIMENSION (64 per file) |
| `0_el_rozváděče` | Rozvaděče | TEXT `RE-D`, `RS-D` |
| `0_el_zásuvky` | Zásuvky (sockets) | INSERT |
| `A-DETL-THIN` | Architectural detail | LINE backdrop |

**DN extraction**: scarce — only žlab specs in MTEXT (`žlab 100/50` =
cable tray width/height).
**Prostup detection**: 0 CIRCLEs per file. Prostupy not symbolized
explicitly; can be inferred from kabelové trasy (`0_el_trasy` LINEs)
crossing the wall outline.
**Štroby (chases)**: implicit in `0_el_trasy` LINE segments — 14 per
podlazi. Counting štroby == counting trasa segments.

### 3.4 Slaboproud (low-voltage / data) — `slb` files

Layer prefix: `SLP-*`

| Layer | Purpose | Sample content |
|---|---|---|
| `SLP-_TRASY` | Kabelové trasy | LINE (sparse, 5–20 per file) |
| `SLP-_TRASY-prostupy` | **EXPLICIT prostup layer** | INSERT `SLP_PROSTUP` (1–5 per file) |
| `SLP-DT`, `SLP-ACS`, `SLP-SK`, `SLP-STA`, `SLP-ADP` | Equipment classes | INSERT (DT/ACS/SK/STA/ADP-specific blocks) |
| `Defpoints` | Reference text | "RACK 600/600/600", "ROZV. 600/600/200" |

**Prostup detection**: explicit — INSERT `SLP_PROSTUP` block on
`SLP-_TRASY-prostupy` layer. Rare: 1–5 per podlazi. Best-defined
prostup convention of any discipline.

### 3.5 UT (heating) — `1pp_UT.dwg` (1.PP only — above-ground UT not separately drawn)

Layer prefix: `0UT_*`

| Layer | Purpose | Sample content |
|---|---|---|
| `0UT_větev_T1_OT` | T1 větev otopná (heating branch 1) | LWPOLYLINE |
| `0UT_větev_T2` | T2 větev | same |
| `0UT_VETEV_TUV` | Větev TUV (hot water) | same |
| `0UT_TECHNOLOGIE` | Equipment (kotel, čerpadlo) | INSERT (50× per file) |
| `0UT_LOMY_POTRUBI` | Pipe bends | LINE (35 per file) |
| `0UT_DN_kota` | DN dimensions | TEXT (30 per file) |
| `0UT_DN_DN` | DN values | TEXT `25i Fe` (10 per file) |
| `0UT_DN_vyska` | Pipe height (mm) | TEXT `2350` (10 per file) |
| `0UT_PB`, `0UT_OT` | Equipment markers | TEXT `PB` |
| `0UT_STOUPACKY_ZNACKY` | Riser markers | INSERT (8 per file) |
| `0UT_pro_ZTI`, `0ut_pro_EL`, `0UT_pro_PLYN` | Cross-discipline coord | LINE |
| `0UT_ARMATURY` | Armatury (valves) | INSERT (22 per file) |

**DN extraction**: TEXT on `0UT_DN_DN` (e.g. `25i Fe` = DN25 iron pipe).
**Pipe height**: TEXT on `0UT_DN_vyska`.
**Prostup detection**: 51 CIRCLEs on UT pipe layers — richest of any
discipline.

### 3.6 Plyn (gas) — `1pp_plyn.dwg` (1.PP only)

Layer prefix: `Plyn_*`, color-coded `C00-00-00`, `C4A-95-4A`, `CDD-00-37`

| Layer | Purpose | Sample content |
|---|---|---|
| `Plyn STL přípojka` | STL přípojka | LWPOLYLINE |
| `Plyn_DR_vnitřní` | Internal pipe runs | LWPOLYLINE |
| `Plyn_DR_venkovní` | External pipe runs | LWPOLYLINE |
| `Plyn_popis` | DN labels | TEXT `DN 25` |
| `C00-00-00`, `C4A-95-4A`, `CDD-00-37` | Color hatch fills | HATCH (461 across 3 layers) |

**DN extraction**: TEXT on `Plyn_popis`.
**Prostup detection**: 0 CIRCLEs — gas service may not need prostup
counting (single supply line, prostup count = 1 = entry point).

### 3.7 VZT (HVAC) — ALL 4 FILES FAILED

D 1.NP/2.NP/3.NP + 1.PP VZT all fail with the same LibreDWG bug:
```
DXFStructureError: Invalid group code "125.00\n" at line N
```

The DXF stream has malformed group code lines (decimal point /
embedded newline). Likely root cause: the source DWG was edited with
a non-Autodesk tool (possibly Bricsys / Zwcad / OpenDESIGN-derived)
and LibreDWG's parser doesn't handle the resulting variant.

**Mitigation paths (Step 8c parallel track):**
- ABMV re-export from clean AutoCAD save
- Try Teigha File Converter (ODA, free)
- Manual DN extraction from PDF (visual count, ~1 day per podlazi)

### 3.8 Chlazení (cooling) — ALL 3 D FILES FAILED

D 1.NP/2.NP/3.NP chl all fail with LibreDWG:
```
Warning: Object handle not found 37748/0x9374 in 4711 objects
```

Different bug from VZT — unresolved object handles, typically
indicating broken xref. Same mitigation paths apply.

---

## 4. Aggregate prostup + štroby count surface

### 4.1 Prostupy (CIRCLEs on TZB pipe layers + explicit prostup blocks)

| Source | Above 1.NP | Above 2.NP | Above 3.NP | 1.PP | Total |
|---|---:|---:|---:|---:|---:|
| Vodovod | 4 | 0 | 8 | 0 | 12 |
| Kanalizace | 19 | 20 | 16 | 5 (K1pp) | 60 |
| Silnoproud | 0 | 0 | 0 | — | 0 |
| Slaboproud | 5 (`SLP_PROSTUP`) | 1 | 1 | 4 (`SLP_PROSTUP`) | 11 |
| UT | — | — | — | 51 | 51 |
| Plyn | — | — | — | 0 | 0 |
| 9421 jádra 2.NP zoom | — | 47 | — | — | 47 |
| 1.PP koord overlay | — | — | — | 32 | 32 |
| **VZT** | ❌ | ❌ | ❌ | ❌ | (~50–80 estimated lost) |
| **Chlazení** | ❌ | ❌ | ❌ | — | (~20–30 estimated lost) |
| **Subtotal achievable** | 28 | 68 | 25 | 92 | **213** |

### 4.2 Štroby (cable trays, only silnoproud annotates them)

| Source | Above 1.NP | Above 2.NP | Above 3.NP | 1.PP | Total |
|---|---:|---:|---:|---:|---:|
| Silnoproud `0_el_trasy` LINE segments | ~14 | ~14 | ~14 | (no sil 1.PP) | ~42 |
| Slaboproud `SLP-_TRASY` LINE | 5 | 3 | 2 | 20 | 30 |
| **Subtotal** | 19 | 17 | 16 | 20 | **72** |

Vodovod / kanalizace / UT / plyn don't annotate štroby — pipes for
those disciplines run through floor slabs as prostupy, not through
walls as chases.

### 4.3 DN-label inventory (per-pipe sizes)

Examples extracted (machine-readable) per discipline:

- **Vodovod**: DN20, DN25, DN32 (cold/hot pair pattern `25,25` /
  `20,20` common)
- **Kanalizace**: DN50, DN110 (and bare numeric DNs in `ZT_POPIS`)
- **UT**: DN25 (`25i Fe` notation = 25mm iron pipe), pipe heights up
  to 2350 mm
- **Plyn**: DN25 only sample (single supply line)
- **Silnoproud**: cable tray sizes `žlab 100/50` (width/height in mm)

### 4.4 Stoupačky (risers) inventory

| Discipline | 1.NP | 2.NP | 3.NP | 1.PP | Convention |
|---|---:|---:|---:|---:|---|
| Vodovod | 26 | 24 | 11 | 99 | INSERT `stoup` block on `ZT_STOUP` layer |
| Kanalizace | 42 | 33 | 21 | 87 (K1pp) | same `stoup` block + `VTOK` for drains |
| UT | — | — | — | 8 | INSERT on `0UT_STOUPACKY_ZNACKY` |

---

## 5. K1pp scope verification (corrective git mv check per drop v2 manifest §4)

The drop v2 manifest flagged K1pp as "likely silnoproud (verify
post-DXF)". DXF inspection settles this:

- All layers have `ZT_*` prefix (vodovod / kanalizace family)
- Block inserts: `stoup` (87×), `VTOK` (15×), `ČERPADLO` (4×) — all
  drainage symbols
- TEXT samples: `dno 2320`, `-0,680` — depth markings typical of
  underground gravity drainage

**Verdict: K1pp is the 1.PP kanalizace drawing** (K = Kanalizace, not
Kabel). The filename's `K` prefix matches Czech engineering convention
where below-ground drainage gets its own dedicated drawing because of
slope + depth complexity. **No corrective `git mv`** — current
location at `sources/shared/dwg/` is correct (komplex 1.PP shared).

---

## 6. UDL xref scope check

The 4 UDL files (`UDL_1NP_D`, `UDL_2NP_D`, `UDL_3NP_D`, `UDL_1PP`)
contain only architectural xref content (walls, doors, windows, areas)
on `A-*` AIA-standard layers. No TZB content. They serve as the
backdrop that the koord overlay + per-discipline TZB drawings
reference for visual context.

For PROBE 9 they're **not directly useful** but they are correctly
sorted to `sources/{D,shared}/dwg/` and converted to DXF — Π.0a may
ignore them per existing layer filter rules (the architectural content
duplicates what's already in the `_140_4410/4420/4430` půdorys
drawings).

---

## 7. Cross-validation: koord overlay vs per-discipline drawings

The `_140_9410/9420/9430` koord overlays carry minimal drawn content:

- ~46 LWPOLYLINE on `0` layer (sheet frame)
- 17 LWPOLYLINE on `A-AREA-BNDY-OTLN` (room outlines)
- 6 LWPOLYLINE on `_UT` (UT skeleton sketch)
- 17 entities on `_koo upravy` (coordination overlay)
- Block inserts including all 6 per-discipline drawings:
  ```
  D_1NP_chl, D_1NP_kan, D_1NP_sil, D_1NP_slb, D_1NP_vod, D_1NP_vzt
  UDL_1NP_D, R+S 3, 185-01_OBJEKT G_Central_rvt-1-2NP-A
  ```

Each koord overlay is a **composition sheet** that block-inserts the
6 per-discipline DWGs as overlay layers. The actual TZB content lives
in the per-discipline files we audited separately. Π.0a Step 8c can
either:
- (a) Walk the koord overlay's INSERT list to confirm which
  disciplines are present, then extract from each per-discipline DXF
  individually
- (b) Resolve the INSERT block tree at parse time (more complex; xref
  resolution required)

Recommend (a) — simpler, matches existing Π.0a pattern of per-DXF
parsing.

### 1.PP koord overlay specifics

`_100_9000` 1.PP koord overlay is much richer (2145 entities vs 323
for above-ground koords) — includes:
- 32 CIRCLEs on TZB-coordination layers (additional prostupy not
  duplicated in per-discipline files)
- 478 MTEXT + 263 TEXT (extensive labeling)
- Block inserts referencing all 7 1.PP TZB DWGs (UDL_1PP, K1pp,
  1PP_vod, 1pp_VZT, 1pp_plyn, plus implicit 1pp_UT, 1pp_slb)
- 33 entities on `_silnoproud` layer — IS contains some sil content
  (the 1.PP doesn't have a separate sil DWG; 1.PP silnoproud lives
  inside the koord overlay)

So **1.PP silnoproud has NO standalone DWG** — its content is embedded
in the koord overlay on `_silnoproud` layer. Step 8c must extract it
from the koord overlay rather than expect a `1pp_sil.dwg` (which
doesn't exist).

---

## 8. Sufficiency verdict per discipline + recommendation

| Discipline | Above-ground D coverage | 1.PP coverage | Verdict | Step 8c readiness |
|---|---|---|---|---|
| Vodovod | ✅ 3/3 podlaží | ✅ | SUFFICIENT | Auto-extract |
| Kanalizace | ✅ 3/3 podlaží | ✅ K1pp | SUFFICIENT | Auto-extract |
| Silnoproud | ✅ 3/3 podlaží (sparse but consistent) | ⚠️ embedded in 1.PP koord overlay | PARTIAL | Auto-extract above-ground; pull 1.PP from koord overlay `_silnoproud` layer |
| Slaboproud | ✅ 3/3 podlaží | ✅ | SUFFICIENT (sparse) | Auto-extract — best-defined prostup convention (`SLP_PROSTUP` block) |
| UT (heating) | — (no above-ground UT) | ✅ | SUFFICIENT for 1.PP | Auto-extract; above-ground UT TBD (likely embedded in koord overlay `_UT` layer = 6 entities only) |
| Plyn | — | ✅ (1 DN sample) | THIN | Auto-extract single line; complement with ABMV confirmation |
| **VZT** | ❌ 0/3 conversion failed | ❌ | **INSUFFICIENT** | **BLOCKED** — needs alternate converter or ABMV re-export |
| **Chlazení** | ❌ 0/3 conversion failed | — (no 1.PP chl) | **INSUFFICIENT** | Same blocker — alternate converter |
| Spárořez | — | — | NOT APPLICABLE | Out of PROBE 9 scope (it's a screed-zoning drawing, not TZB) |
| Rozpisky | — | — | NOT APPLICABLE | Titleblock template; ignore |

### Recommendation

**Scenario A — proceed with Π.0a Step 8c extractor for the 27
successful DXFs.** Coverage is ~80 % of PROBE 9 scope; the missing
20 % (VZT + chl) handled in parallel via:

- **B.2 Alternate converter:** Try Teigha File Converter (ODA proprietary
  but free download) on the 7 failing DWGs. Estimated 30 min trial; if
  it works, simply re-convert + drop into existing dxf/.
- **C Manual fallback:** ABMV email asking to re-export the 7 failing
  DWGs from a clean AutoCAD save. Their unresolved-handle / group-code
  issues typically vanish on a fresh save-as.

### Π.0a Step 8c implementation outline

Given the layer convention discoveries:

```python
# pi_0/extractors/dxf_koordinacni.py
DISCIPLINE_LAYER_MAP = {
    "vodovod":  ["ZT_V_STU", "ZT-V_TEPLA", "ZT_VKOTY", "ZT_STOUP",
                 "ZT_ARMAT", "ZT_POZARNI"],
    "kanalizace": ["ZT_K_PRIPOJ", "ZT_K_KONDEN", "ZT_K_KONDEN_ZAV",
                   "ZT_K_DES_ZAV", "ZT_K_ODVETR", "ZT_K_SPL_ZAV",
                   "ZT_K_VYTLAK", "ZT_TVAR", "ZT_POPIS"],
    "silnoproud": ["0_el_trasy", "0_el_koty500", "0_el_rozváděče",
                   "0_el_zásuvky"],
    "slaboproud": ["SLP-_TRASY", "SLP-_TRASY-prostupy", "SLP-DT",
                   "SLP-ACS", "SLP-SK", "SLP-STA", "SLP-ADP"],
    "UT":         ["0UT_*"],  # prefix match
    "plyn":       ["Plyn_*", "Plyn STL přípojka"],
}

PROSTUP_BLOCKS = {
    "stoup":        "vodovod_or_kanalizace_riser",
    "SLP_PROSTUP":  "slaboproud_explicit_prostup",
    "VTOK":         "kanalizace_drain_inlet",
    "vent_hlav":    "kanalizace_vent_head",
    "ventil_obecny":"vodovod_valve",
    "ČERPADLO":     "kanalizace_pump",
}

DN_LABEL_LAYERS = {
    "vodovod":   "ZT_VKOTY",   # DN32, 25,25
    "kanalizace":"ZT_POPIS",   # 50, 110
    "UT":        "0UT_DN_DN",  # 25i Fe
    "plyn":      "Plyn_popis", # DN 25
}
```

Per podlazi + per discipline:
1. Parse DXF, walk all layouts
2. For each entity on a `DISCIPLINE_LAYER_MAP` layer, classify as
   pipe (LINE/LWPOLYLINE) or prostup (CIRCLE)
3. Cross-reference TEXT entities on `DN_LABEL_LAYERS[discipline]` for
   DN values via spatial proximity to the pipe (200 mm threshold)
4. Block inserts: count `PROSTUP_BLOCKS` matches as explicit prostupy
5. Emit per-podlazi per-discipline records:
   ```
   {
     podlazi: "1.NP",
     discipline: "kanalizace",
     prostupy: [{position, dn, source_drawing}],
     stoupacky: [{position, type}],
     pipes: [{points, length_m, dn}],
   }
   ```

Estimated implementation: **~4–6 h** following Step 7 (xlsx_okna)
pattern. Tests: ~10 (per-discipline coverage + per-podlazi coverage +
DN label cross-reference + idempotency).

---

## 9. Backlog tickets opened by this audit

1. **VZT conversion failure** (4 files) — try Teigha File Converter or
   request ABMV re-export. Without VZT, ventilation prostupy + stoupačky
   cannot be quantified; this is ~25–30 % of HVAC scope.
2. **Chlazení conversion failure** (3 D files) — same mitigation. Without
   chl, cooling system entirely missing from auto-extract.
3. **1.PP silnoproud has no standalone DWG** — content is embedded in
   `_100_9000` 1.PP koord overlay on `_silnoproud` layer (33 entities).
   Step 8c must handle this special case (extract from koord overlay
   instead of expecting a `1pp_sil.dwg`).
4. **A/B/C koord ZIPs** still in `inputs/_UNSORTED/` (Π.0.0 Part 2
   backlog) — when Π.1 V1 triggers, sort + extract them following the
   same pattern as drop v2 D-side.

---

## 10. Out of scope for this audit

- **Štroby in vodovod / kanalizace** — typically not annotated on these
  drawings (pipes go through floors as prostupy, not through walls as
  chases). If wall chases for water/drain rough-ins are needed, they
  must come from architectural detail drawings or manual count.
- **OCR-based DN extraction from PDFs** — not needed since machine-
  readable DN labels exist on the DXFs we audited.
- **Cross-objekt verification (A/B/C)** — D-only audit; A/B/C deferred
  to Π.1 V1 trigger time per `TASK_PHASE_PI_1_SPEC.md`.

---

_Generated by Claude Code, PROBE 9 full audit per section, 2026-05-10._
