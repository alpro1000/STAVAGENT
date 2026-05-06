# PDF/XLSX Tables Full Inventory — Libuše objekt D (Π.0 Discovery)

Read-only column-level inventory of all 9 input XLSX tables vs what
the current pipeline actually extracts. Identifies which columns are
✅ extracted, ⚠️ partial, ❌ ignored.

---

## Coverage summary

| File | Table | Cols | Extracted | Coverage | Status |
|------|-------|----:|---------:|---------:|--------|
| **0020** | TABULKA MISTNOSTI (rooms) | 10 | 10 | **100 %** | ✅ FULL |
| **0030** | TABULKA SKLADEB A POVRCHU (compositions) | 6 | 6 | **100 %** | ✅ FULL |
| **0041** | TABULKA DVEŘÍ (doors) | 28 | 6 | **21 %** | 🔴 MINIMAL |
| **0042** | TABULKA OKEN (windows) | 20 | 0 | **0 %** | 🔴 NONE |
| **0043** | TABULKA PROSKLENÝCH PŘÍČEK (glass partitions) | 20 | 8 | **40 %** | ⚠️ PARTIAL |
| **0050** | TABULKA ZÁMEČNICKÝCH VÝROBKŮ (locksmith) | 9 | 8 | **89 %** | ✅ GOOD |
| **0060** | TABULKA KLEMPÍŘSKÝCH PRVKŮ (sheet metal) | 9 | 9 | **100 %** | ✅ FULL |
| **0070** | TABULKA PŘEKLADŮ (lintels) | 8 | 8 | **100 %** | ✅ FULL |
| **0080** | TABULKA OSTATNÍCH PRVKŮ (other) | 8 | 5 | **62 %** | ⚠️ PARTIAL |
| **TOTAL** | | **118** | **60** | **51 %** | |

---

## 1. Tabulka 0020 MISTNOSTI (rooms) — ✅ 100 %

Sheet `mistnosti`. Loaded by `phase_1_step1_load_tabulky.py`.

| Col | Header | Extracted | Field |
|---|---|---|---|
| 1 | code (D.1.1.01 etc.) | ✅ | `mistnosti{code}` |
| 2 | nazev (CHODBA / KOUPELNA / …) | ✅ | `nazev` |
| 3 | plocha m² | ✅ | `plocha_m2` |
| 4 | světlá výška mm | ✅ | `svetla_vyska_mm` |
| 5 | skladba podlahy (FF##) | ✅ | `skladba_podlahy` |
| 6 | F povrch podlahy (F##) | ✅ | `povrch_podlahy` |
| 7 | F povrch stěn (F##) | ✅ | `povrch_sten` |
| 8 | typ podhledu (CF##) | ✅ | `typ_podhledu` |
| 9 | F povrch podhledu (F##) | ✅ | `povrch_podhledu` |
| 10 | poznámka | ✅ | `poznamka` |

This is the **gold-standard table** for the pipeline. Every column is
lifted into `tabulky_loaded.json` and used downstream by Phase 1 + 3
generators.

---

## 2. Tabulka 0030 SKLADEB A POVRCHU — ✅ 100 %

5 sheets: `povrchy`, `podlahy`, `stěny`, `střechy`, `podhledy`. Loaded
by `phase_1_step1_load_tabulky.py` + re-extracted by
`phase_0_8_extract_master_skladby.py` (the latter added `kind` +
`specifikum` after Phase 1 missed them — see PROBE 6.5 v2 cross-check
WF22 reclassification).

| Col | Header | Extracted | Field |
|---|---|---|---|
| 1 | code (FF01, WF20, CF30, F19, RF11) | ✅ | `skladby{code}` |
| 2 | layer order | ✅ | `vrstvy[].order` |
| 3 | thickness mm | ✅ | `vrstvy[].tloustka_mm` |
| 4 | total thickness mm | ✅ | `celkova_tloustka_mm` |
| 5 | technical specification | ✅ | `vrstvy[].label` |
| 6 | reference product | ✅ | `vrstvy[].produkt_ref` |

Covers 70 items across 5 sheets. Phase 0.8 added `kind` (obvodová /
vnitřní_nosná / vnitřní_příčka / SDK_předstěna) and `specifikum`
(podezdívka_van / nadezdívka / atika).

---

## 3. Tabulka 0041 DVEŘÍ (doors) — 🔴 21 % (CRITICAL GAP)

Sheet `tab dvere`. 297 rows total komplex; ~50 D-objekt doors.
Currently parsed by `phase_0_9_extract_doors_ownership.py` for
ownership lookup only.

| Col | Header (Czech / English) | Extracted | Used as |
|---|---|---|---|
| 1 | Číslo / No. | ✅ | `cislo` |
| 2 | Ozn. Typu / Type Mark | ✅ | `typ` (D02, D04, D21, …) |
| 3 | z místnosti č. | ✅ | `from_room` |
| 4 | do místnosti č. | ✅ | `to_room` |
| 5 | Otvírání / Opening direction | ❌ | — |
| 6 | Počet křídel / No. of leaves | ❌ | — (1 vs 2 — items would change) |
| 7 | Celková světlá šířka | ❌ | — (clear width) |
| 8 | Šířka aktivního křídla | ❌ | — |
| 9 | Světlá výška | ❌ | — (clear height) |
| 10 | Popis křídla | ❌ | — (leaf description, e.g. "41") |
| 11 | RAL křídla | ❌ | — (leaf color, e.g. RAL 7016) |
| 12 | Šířka stavebního otvoru | ✅ | `sirka_otvoru_mm` |
| 13 | Výška stavebního otvoru | ✅ | `vyska_otvoru_mm` |
| 14 | Popis zárubně | ❌ | — (frame, e.g. Z20, Z21) |
| 15 | RAL zárubně | ❌ | — (frame color) |
| 16 | Požární odolnost | ❌ | — **fire rating** |
| 17 | Laboratorní neprůzvučnost | ❌ | — **Rw acoustic lab** |
| 18 | Stavební neprůzvučnost | ❌ | — **R'w acoustic on-site** |
| 19 | Bezpečn. odolnost | ❌ | — **RC class (RC2/RC3/RC4)** ⚡ PROBE 7 |
| 20 | Tepelné vlastnosti | ❌ | — **U-value W/m²·K** |
| 21 | Typ kování | ❌ | — **hardware (KP1/MM)** ⚡ PROBE 7 |
| 22 | Typ samozavírače | ❌ | — **door closer (SN1/SN2)** ⚡ PROBE 7 |
| 23 | Zámek | ❌ | — **lock (EMZ elektromechanic)** ⚡ PROBE 7 |
| 24 | Doplňky | ❌ | — supplements |
| 25 | EPS / FAS | ❌ | — fire alarm panel |
| 26 | ACS / Access control | ❌ | — **access control** ⚡ PROBE 7 |
| 27 | VZT / Ventilation | ❌ | — |
| 28 | Poznámka | ❌ | — |
| (derived) | is_garage_gate | ✅ | `is_garage_gate` (rule: D05 OR width > 3000) |

**Plus is_garage_gate = derived field** → 6/28 columns + 1 derived = 21 %.

**Why this matters (PROBE 7)**: D10 in Tabulka 0041 for A/B has
`bezpečn. odolnost = RC3, ESG`, `kování = KP1, MM`, `samozavírač = SN2`,
`zámek = EMZ`, `ACS = ●`. None of these are extracted — so the D-objekt
D10 items default to STD interior treatment, missing ~60–105k Kč of
bezpečnostní hardware spec that **was in the source XLSX all along**.

22 of 28 columns dropped × ~50 D-doors = ~1100 data points lost.

---

## 4. Tabulka 0042 OKEN (windows) — 🔴 0 % (CRITICAL GAP)

Sheet `tab okna`. **Currently NOT extracted by any phase script.**
18 window types defined.

| Col | Header (typical) | Extracted | Notes |
|---|---|---|---|
| 1 | code (W##) | ❌ | type marker (W01–W05 sampled in DXF only) |
| 2 | window type | ❌ | (single panel, double-hung, …) |
| 3–4 | rough opening width × height mm | ❌ | |
| 5 | sill height / parapet | ❌ | |
| 6 | opening type | ❌ | (otvíravé / sklopné / fix) |
| 7 | glazing | ❌ | (Ug, type, lamination) |
| 8 | hardware | ❌ | |
| 9 | sealant | ❌ | |
| 10 | parapets | ❌ | |
| 11 | Uw window U-value | ❌ | **thermal — energy calc broken** |
| 12 | g-value solar gain | ❌ | |
| 13 | Rw acoustic | ❌ | |
| 14 | RC mechanical resistance | ❌ | |
| 15 | RAL frame color | ❌ | |
| 16 | RAL leaf color | ❌ | |
| 17 | accessories | ❌ | |
| 18–20 | supplements / notes / VZT | ❌ | |

**Pipeline impact**: window items (rows 1900-something in current
Excel List 1) are derived from DXF block extraction only (W01–W05
codes + W×H from block name). All thermal / acoustic / glazing /
color spec is dropped.

---

## 5. Tabulka 0043 PROSKLENÝCH PŘÍČEK (glass partitions) — ⚠️ 40 %

Sheet `tab prosklene pricky`. 20 partition types defined. Current
extraction (likely Phase 0.x for CW codes) covers basic geometry +
glazing.

| Cat | Extracted | Ignored |
|---|---|---|
| Code, type, dimensions, opening type, glazing, hardware, sealant | ✅ (8 cols) | — |
| Uw thermal | | ❌ |
| Rw / R'w acoustic | | ❌ |
| RC safety | | ❌ |
| Parapets, supplements, notes | | ❌ |

12 of 20 columns dropped × 20 partitions = ~240 data points lost.
Affects ~150 m² partition area thermal/acoustic specifications.

---

## 6. Tabulka 0050 ZÁMEČNICKÉ (locksmith) — ✅ 89 %

24 items (railings, structural metal, miscellaneous metalwork).

| Col | Header | Extracted |
|---|---|---|
| 1 | code | ✅ |
| 2 | name | ✅ |
| 3 | location | ✅ |
| 4 | technical spec | ✅ |
| 5 | surface (povrch) | ✅ |
| 6 | units (MJ) | ✅ |
| 7 | quantity | ✅ |
| 8 | reference product | ❌ — only column missed |
| 9 | notes | ✅ |

Single missing col: reference product brand. Low impact.

---

## 7. Tabulka 0060 KLEMPÍŘSKÉ (sheet metal) — ✅ 100 %

24 items (gutters, flashings, copings — TP01–TP29 codes).

All 9 columns extracted: code, name, location, tech spec, surface,
sheet width mm, units, quantity, notes.

---

## 8. Tabulka 0070 PŘEKLADŮ (lintels) — ✅ 100 %

17 items (Porotherm + ŽB lintels).

All 8 columns extracted: code, name, location, tech spec, units,
surface, quantity, notes.

---

## 9. Tabulka 0080 OSTATNÍ (other) — ⚠️ 62 %

63 items (fire extinguishers, expansion joints, miscellaneous).

| Col | Extracted |
|---|---|
| 1 code | ✅ |
| 2 name | ✅ |
| 3 location | ✅ |
| 4 technical spec | ✅ |
| 5 surface | ✅ |
| 6 units | ❌ |
| 7 quantity | ❌ |
| 8 notes | ❌ |

3 of 8 dropped × 63 items = 189 data points. Missing units +
quantities means BOM is incomplete for these items.

---

## Critical-gap impact table

| Process | Status | Root cause |
|---------|--------|-----------|
| Energy calculation | 🔴 BROKEN | 0042 windows not extracted; 0041 doors U missing; 0043 partitions Uw missing |
| Acoustic analysis | 🔴 BROKEN | 0041/0042/0043 Rw/R'w missing entirely |
| Fire safety | 🔴 BROKEN | 0041/0042 fire ratings not extracted |
| Security spec (RC) | 🔴 BROKEN | 0041 col 19 dropped → PROBE 7 D10 underspec class of bug |
| Hardware/lock spec | 🔴 BROKEN | 0041 cols 21–26 dropped → bezpečnostní pack lost |
| Quantity / BOM | 🟡 PARTIAL | 0042 instances unknown; 0080 quantities missing |
| Geometry mapping | ✅ OK for D-rooms | 0041 from_room / to_room extracted |

---

## Recommended Π.0 absorption priority

| Rank | Table | Effort | Impact | Notes |
|------|-------|--------|--------|-------|
| 1 | **0041 DVEŘÍ** (cols 5–28) | HIGH (~4 h) | CRITICAL | Direct PROBE 7 root cause; ~22 cols × ~50 D-doors |
| 2 | **0042 OKNA** (full table) | HIGH (~3 h) | CRITICAL | New extractor needed; 18 types × 20 cols |
| 3 | **0043 PROSKLENÉ** (cols 9–20) | MEDIUM (~2 h) | HIGH | Thermal / acoustic / safety completion |
| 4 | **0080 OSTATNÍ** (cols 6–8) | LOW (<1 h) | MEDIUM | Quantity recovery |
| 5 | **0050 ZÁMEČN.** (col 8 ref product) | TRIVIAL | LOW | Single column |

**Total Π.0 absorption work to reach 100 % column coverage: ~10 h.**

---

## Source documents (reference)

All XLSX files in `test-data/libuse/inputs/`:

- `185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx`
- `185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx`
- `185-01_DPS_D_SO01_100_0041_TABULKA DVERI.xlsx` (header row 6, data
  starts row 7, 297 rows × 28 cols)
- `185-01_DPS_D_SO01_100_0042_TABULKA OKEN.xlsx`
- `185-01_DPS_D_SO01_100_0043_TABULKA PROSKLENYCH PRICEK.xlsx`
- `185-01_DPS_D_SO01_100_0050_R01_TABULKA ZAMECNICKYCH VYROBKU.xlsx`
- `185-01_DPS_D_SO01_100_0060_R01_TABULKA KLEMPIRSKYCH PRVKU.xlsx`
- `185-01_DPS_D_SO01_100_0070_R01_TABULKA PREKLADU.xlsx`
- `185-01_DPS_D_SO01_100_0080_R02 - TABULKA OSTATNICH PRVKU.xlsx`

_Generated by Claude Code Π.0 Part 1 discovery, 2026-05-06._
