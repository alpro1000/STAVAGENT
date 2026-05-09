# PROBE 9 — Source audit for prostupy + štroby quantification (objekt D)

**Date:** 2026-05-09
**Scope:** Read-only audit of available koordinační výkresy for objekt D
to determine whether existing sources are sufficient for machine-extractable
quantification of prostupy (slab penetrations) + štroby (wall chases) in
HSV scope (architect / общестрой responsibility), or whether additional
TZB profession-specific drawings (silnoproud / slaboproud / ZTI / UT /
VZT) are required.
**Verdict (TL;DR):** **PARTIAL — scenario B applies.** The jádra zoom
(`_140_9421`) is the only source with machine-extractable TZB data. The
other 5 koordinační drawings (1.NP / 2.NP overview / 3.NP / 1.PP komplex
části A+B) are PDF-only and yielded zero extractable DN labels. The
shortest path to PROBE 9 quantification is to obtain DWG sources for
those 5 drawings OR the TZB section drawings they overlay; manual
colleague-counting (scenario C) is the fallback.

---

## 1. Inventory of available koordinační sources

| Drawing | Floor | Format | Path | Size |
|---|---|---|---|---:|
| `_140_9410` | 1.NP | **PDF only** | `sources/D/pdf/` | 400 kB |
| `_140_9420` | 2.NP overview | **PDF only** | `sources/D/pdf/` | 415 kB |
| `_140_9421` | 2.NP byt jádra zoom | **PDF + DWG/DXF** | `sources/D/{pdf,dwg,dxf}/` | 640 kB / 1.5 MB / 47 MB |
| `_140_9430` | 3.NP | **PDF only** | `sources/D/pdf/` | 426 kB |
| `_100_9000` | 1.PP koord část A | **PDF only** | `sources/shared/pdf/` | (komplex-shared) |
| `_100_9001` | 1.PP koord část B | **PDF only** | `sources/shared/pdf/` | (komplex-shared) |

A/B/C komplex equivalents exist in `inputs/_UNSORTED/` as ZIP archives
(`_110_91N0`, `_120_92N0`, `_130_93N0`) plus jádra DWGs (`9121`, `9221`,
`9321`); not in scope for this PROBE 9 D-only audit.

---

## 2. DXF analysis — `_140_9421` (jádra D 2.NP)

The single available DXF in PROBE 9 source set is the apartment-cores
zoom for 2.NP. File size: 47 MB (post-conversion from DWG via LibreDWG).

### Layouts

| Layout | Entities | Purpose |
|---|---:|---|
| Model | 216 | base modelspace geometry |
| `D_9421_rozpiska` | 35 | titleblock |
| `D_2.1.02` | 17 | byt zoom 2.1.02 (viewport-driven) |
| `D_2.2.04` | 17 | byt zoom 2.2.04 |
| `D_2.2.02` | 17 | byt zoom 2.2.02 |
| `D_2.3.02` | 17 | byt zoom 2.3.02 |
| `D_2.3.04` | 17 | byt zoom 2.3.04 |
| `D_2.4.02` | 17 | byt zoom 2.4.02 |
| **TOTAL** | **353** | (25 are VIEWPORT references back to Model) |

Six bytů get individual zoomed sheets — coverage of the typical
apartment cores at 2.NP is good.

### Layer convention — split

The drawing defines 102 layers, only 10 in actual use across all
layouts. The convention is split between AIA-standard and Czech-named:

- **AIA-style layers DEFINED but EMPTY** in modelspace:
  `M-HVAC-DUCT-OTLN`, `P-SANR-FIXT-OTLN`, `E-ELEC-FIXT-OTLN` — these
  are the layer names the user's PROBE 9 SPEC asked us to look for.
  They exist as definitions but carry zero entities. ArchiCAD-derived
  template defaults; not used by the actual TZB content.

- **Czech-named layers WITH actual TZB content:**

| Layer | LWPOLYLINE | CIRCLE | DIMENSION | TEXT | Notes |
|---|---:|---:|---:|---:|---|
| `_VZT` | 25 | 13 | 0 | 0 | VZT ducts + risers |
| `_kanalizace` | 25 | 7 | 0 | 0 | sewer/drain pipes + risers |
| `_vodovod` | 36 | 24 | 0 | 0 | water supply pipes + risers |
| `_UT` | 0 | 0 | 0 | 0 | (defined, empty in 2.NP — UT in different layers) |
| `_koo upravy` | 3 | 3 | 0 | 4 | architect's coord overlay + legend text |
| `0UT_LOMY_POTRUBI` | 0 | 0 | 0 | 0 | (empty in modelspace) |
| `0UT_POTRUBI` | 0 | 0 | 0 | 0 | (empty in modelspace) |
| `0UT_STOUPACKY_ZNACKY` | 0 | 0 | 0 | 0 | (empty in modelspace) |
| `ABMV_det-koty 10` | 0 | 0 | 57 | 0 | dimension annotations |
| **Total TZB-relevant** | **89** | **47** | — | **4** | |

### Geometric content interpretation

- **47 CIRCLEs on TZB layers = prostupy** (slab penetrations
  represented as small circles at pipe locations). Breakdown:
  - 24 vodovod (water risers)
  - 13 VZT (HVAC duct penetrations)
  - 7 kanalizace (drain risers)
  - 3 koo upravy (other coordinated penetrations)
- **89 LWPOLYLINEs on TZB layers = pipe + duct runs** through bytu cores.
- **4 TEXT entities on TZB layers** are the legend only: `"VZT"`,
  `"vodovod"`, `"kanalizace"`, `"VZT - pod stropem"`. **Zero per-pipe
  DN labels in the DXF text stream.**

### DN labels — text-only in PDF, NOT in DXF

The DXF carries ZERO machine-readable DN labels on TZB geometry. The
DN sizes appear only in the PDF version of `_140_9421` as raw numeric
text overlay. After running `pdftotext -layout` and a heuristic that
matches bare 2-3 digit numbers in the DN range against the canonical
DN value set:

| File | Bare-DN labels | Distinct sizes | Top values |
|---|---:|---:|---|
| `_140_9421` PDF | **56** | **12** | DN80×11, DN120×10, DN150×9, DN240×6, DN170×5, DN200×4, DN250×4, DN140×2 |

The labels `DN80`/`DN120`/`DN150` are typical for kanalizace+vodovod
risers; `DN240`/`DN250` are typical for VZT odtahy. The label
distribution is consistent with the 47 CIRCLE prostupy in the DXF —
each prostup is annotated in the PDF with its DN size. Joining the two
representations (CIRCLE positions in DXF + DN labels in PDF) is feasible
but requires either:
- **OCR + spatial join** (expensive, unreliable), OR
- **Direct DWG source** for 9410/9420/9430/9000/9001 (would mirror 9421
  layer convention and let us read DN labels as DXF TEXT entities).

---

## 3. PDF analysis — 5 koordinační drawings (no DWG available)

Used `pdftotext -layout` (poppler-utils 24.02) on each PDF, then ran
the same regex set used on 9421:

| File | DN labels | Ø labels | Material codes (KG/HT/PE/...) | Prostup keywords | Bare DN heuristic |
|---|---:|---:|---:|---:|---:|
| `_100_9000` 1.PP koord A | 0 | 0 | 0 | 0 | 2 |
| `_100_9001` 1.PP koord B | 0 | 0 | 0 | 0 | 2 |
| `_140_9410` 1.NP | 0 | 0 | 0 | 0 | 0 |
| `_140_9420` 2.NP | 0 | 0 | 0 | 0 | 0 |
| `_140_9430` 3.NP | 0 | 0 | 0 | 0 | 0 |

What IS extractable from these 5 PDFs:
- TZB legend keywords (`vodovod`, `kanalizace`, `silnoproud`,
  `slaboproudy`) — single-occurrence each, just the legend block.
- Architectural room codes (`S.D.NN`, `D.N.N.NN`) — many (87+44 in 1.PP,
  18+40+19 in 1.NP/2.NP/3.NP) — these are the floor-plan room labels
  rendered as text, not TZB-specific.
- Title-block text (drawing number, scale, signatures) — irrelevant
  for PROBE 9.

### Why pdftotext yields nothing actionable for these 5 PDFs

The DN labels, prostup symbols, and pipe DN annotations on these
drawings are present **visually** (per user description: "loaded
koordinační výkresy") but not **as searchable text** in the PDF
content stream. They are likely either:

- Vector-stroked text (drawn as path geometry, not as ToUnicode-mapped
  glyphs), or
- Embedded as raster overlay in the original DWG export, or
- Stored in non-extractable form by the original CAD-to-PDF export.

This is a known issue with CAD-exported PDFs and matches the pattern of
the architectural drawings in this project — PDFs serve as visual
reference only; machine extraction needs DWG source.

---

## 4. Per-drawing sufficiency verdict

| Drawing | Verdict | Evidence | Estimated PROBE 9 contribution if used |
|---|---|---|---|
| `_140_9410` 1.NP | ❌ **PARTIAL** (visual-only) | 0 DN labels, no DWG | None automatable; needs DWG OR manual count |
| `_140_9420` 2.NP overview | ❌ **PARTIAL** (visual-only) | 0 DN labels, no DWG | None automatable |
| `_140_9421` 2.NP jádra zoom | ✅ **SUFFICIENT** (jádra scope only) | 47 CIRCLE prostupy + 89 pipe runs in DXF + 56 DN labels in PDF | ~47 prostup items in 6 bytů cores at 2.NP |
| `_140_9430` 3.NP | ❌ **PARTIAL** (visual-only) | 0 DN labels, no DWG | None automatable |
| `_100_9000` 1.PP koord A | ❌ **PARTIAL** (visual-only) | 0 DN labels, no DWG | None automatable |
| `_100_9001` 1.PP koord B | ❌ **PARTIAL** (visual-only) | 0 DN labels, no DWG | None automatable |

### Coverage gap analysis

For full PROBE 9 D-objekt quantification (prostupy + štroby across all
4 podlazí + suterén), we need machine-readable data for:

- 1.PP suterén — **NOT covered** (PDF-only)
- 1.NP — **NOT covered** (PDF-only)
- 2.NP overview (corridors, common areas) — **NOT covered** (PDF-only)
- 2.NP byt jádra — **COVERED** (9421 DXF + PDF)
- 3.NP — **NOT covered** (PDF-only)
- Štroby (wall chases) — **NOT covered** by koordinační drawings on
  any podlazi; štroby are typically annotated on TZB section drawings
  (silnoproud má vlastní výkres štrob), not on coordinational drawings.

Coverage achieved: **~16 %** (2.NP byt jádra only of full HSV scope).

---

## 5. Recommendation — scenario B applies

Per the task's decision tree:

- **(A) Sufficient — proceed Π.0a Step 8c extractor** — **NO.** Only 1
  of 6 drawings is machine-readable. Implementing an extractor against
  9421-only would deliver ≤ 16% of the PROBE 9 scope, which is too
  narrow to call complete.

- **(B) Partial — request additional sources** — **YES, recommended.**
  The shortest path to a quantifiable PROBE 9 D-objekt is to obtain
  DWG/DXF source for either:

  1. **The 5 koordinační drawings currently PDF-only** (9410, 9420,
     9430, 9000, 9001) — same layer convention as 9421 means same
     extractor pattern can apply. Best path if ABMV can produce them.

  2. **OR the TZB profession-specific section drawings** that the
     koordinační drawings overlay:
     - **ZTI section** (Zdravotechnické instalace = water + drain):
       drawings typically named `ZTI-D-1NP`, `ZTI-D-2NP`, `ZTI-D-3NP`,
       `ZTI-D-1PP` — would carry DN labels per pipe run + per prostup
       in DWG layers like `S-PIPE-WSTE`/`S-PIPE-SUPP`.
     - **UT / topení section** (Heating): typically `UT-D-NP*` —
       carries radiator + stoupačka layouts, štroby for topení rozvody.
     - **VZT section** (Vzduchotechnika = HVAC): typically `VZT-D-NP*`
       — carries duct sizes, prostupy through obvodové stěny, štroby.
     - **Silnoproud** (high-voltage electro): typically `E-D-NP*` —
       carries kabelové trasy, drážky pro zásuvky/svítidla, prostupy
       v deskách.
     - **Slaboproud** (low-voltage electro): typically `S-D-NP*` — TLF /
       sat / ICT / EZS / EPS — carries trase, drážky, prostupy.

     If these 5 profession-specific drawing sets exist in DWG, they're
     a richer source than the architect's coord overlay (more detailed
     DN/cross-section labels, štroby explicitly drawn, cable tray
     widths annotated).

- **(C) Insufficient — fall back to manual** — **VIABLE BUT SLOWER.**
  If neither (B.1) nor (B.2) yields DWG sources within an acceptable
  window, fall back to colleagues counting prostupy + štroby per
  kapitola from the PDFs visually and pasting counts into chat. Π.0a
  Step 8c stays in backlog as a future-project enhancement.

### Concrete action — request to ABMV (proposed text)

> "K dokončení PROBE 9 (prostupy + štroby v HSV scope objektu D)
> potřebujeme buďto (a) DWG sources k 5 koordinačním výkresům, jež
> aktuálně máme jen v PDF (9410 1.NP, 9420 2.NP, 9430 3.NP, 9000 +
> 9001 1.PP část A+B), nebo (b) TZB section výkresy v DWG (ZTI / UT /
> VZT / silnoproud / slaboproud) za objekt D — ty často mají bohatší
> anotace DN + drážek. PDFy obsahují vizuální informaci, ale ne
> strojově čitelná textová DN označení (pdftotext extrakce vrátila 0
> DN štítků z těchto 5 výkresů; jen 9421 jádra 2.NP s 56 DN štítky
> a souběžným DXF, který strojově čteme, je dostatečný pro 16 %
> rozsahu PROBE 9). Pokud by bylo potřeba urychlit, můžeme i bez DWG
> projít PDFy ručně po kapitolách a doplnit počty manuálně."

---

## 6. If ABMV provides DWGs — Π.0a Step 8c implementation outline

(Speculative; only valuable if scenario B unblocks DWG sources.)

Assuming the 5 missing DWGs follow the same layer convention as 9421:

- New extractor `pi_0/extractors/dxf_koordinacni.py`:
  - Per drawing: walk Model + all layouts, filter to TZB-relevant
    layers (`_VZT`, `_vodovod`, `_kanalizace`, `_UT`, `_koo upravy`,
    `0UT_*`).
  - Emit prostupy: each CIRCLE on a TZB layer → one prostup record
    `{position, layer, radius, podlazi, source_drawing}`.
  - Emit pipe runs: each LWPOLYLINE on a TZB layer → one rozvod
    record `{points, length_m, layer, podlazi, source_drawing}`.
  - Cross-reference TEXT entities on the same/nearby layer for DN
    labels (spatial proximity threshold ~500 mm following the existing
    Π.0a IDEN-tag pattern).

- New `master_extract_{objekt}.json` sections:
  - `koordinacni_prostupy[]` — per podlazi, per layer
  - `koordinacni_rozvody[]` — per podlazi, per layer
  - `koordinacni_strob[]` — if the section drawings include štroby on
    dedicated layers (TBD until DWGs received)

- New tests: `test_xlsx_koordinacni.py` mirroring `test_xlsx_dvere.py`
  (count regression + sample-row schema + per-podlazi distribution).

- Estimated effort: **4–6 h** for prostupy + rozvody (mirrors Step 7
  pattern for OKEN). Štroby is contingent on whether section drawings
  encode them as discrete entities or as wall-mounted hatch — adds
  2–4 h if hatch-detection is needed.

If section drawings (option B.2) come instead, layer convention may
differ (S-PIPE-* / M-PIPE-* / E-CABL-* AIA standard), and the extractor
needs profession-specific layer maps. Same 4–6 h budget per profession.

---

## 7. Out of scope for this audit

- **A/B/C koordinační drawings** — exist as ZIPs in `inputs/_UNSORTED/`
  but the user's PROBE 9 question is D-specific. A/B/C verification
  remains deferred to Π.1 trigger time per `TASK_PHASE_PI_1_SPEC.md`.
- **OCR-based DN extraction from PDFs** — technically possible but
  unreliable on CAD-exported PDFs (text often vector-stroked, not
  glyph-coded); not recommended as primary path.
- **Šachty (utility shafts) catalogue** — partially in scope if
  section drawings arrive but distinct from prostup counting; treat as
  Step 8d follow-up.

---

_Generated by Claude Code, PROBE 9 source audit, 2026-05-09._
