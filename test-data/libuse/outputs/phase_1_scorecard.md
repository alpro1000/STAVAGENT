# Phase 1 Quality Scorecard

**Generated:** Phase 1 step 5 (final)  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Mode:** Single-object D (DWG dataset covers only objekt D + společný 1.PP)  
**Dataset:** `test-data/libuse/outputs/objekt_D_geometric_dataset.json`  

## Critical findings (persistent across phases)

### CRITICAL — 0.7 step 4 PROBE 1

**Summary:** starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's complaint that the VV is incomplete.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit

## Headline coverage metrics

| Metric | Result | % |
|--------|-------:|--:|
| Total D rooms | 109 | — |
| With FF skladba | 109 / 109 | 100 % |
| With F povrch_podlahy | 109 / 109 | 100 % |
| With F povrch_sten | 109 / 109 | 100 % |
| With CF typ_podhledu | 34 / 109 | 31 % |
| With F povrch_podhledu | 102 / 109 | 94 % |
| Tabulka cross-check ±2 % | 109 / 109 | 100 % |

## Skladby coverage

- Unique skladba codes referenced: **31**
- With full vrstva spec from Tabulka skladeb: **29 / 31** (94 %)
- Missing in Tabulka skladeb: **2** (F20, F30)

## Aggregated quantities (D-only)

### Floor skladby (Σ podlahová plocha m² per FF code)

| FF code | Floor area m² |
|---------|--------------:|
| `F20` | 1.51 |
| `F30` | 7.11 |
| `FF01` | 240.15 |
| `FF03` | 84.48 |
| `FF20` | 69.66 |
| `FF21` | 163.76 |
| `FF30` | 170.71 |
| `FF31` | 326.25 |
| `RF20` | 49.14 |

### Wall finish (Σ stěna plocha brutto m² per F code)

| F code | Wall brutto m² |
|--------|--------------:|
| `F04` | 515.73 |
| `F05` | 1841.38 |
| `F06` | 325.77 |
| `F13` | 214.01 |
| `F19` | 1204.36 |
| `F20` | 409.42 |

### Ceiling skladby (Σ podhled plocha m² per CF code)

| CF code | Ceiling area m² |
|---------|--------------:|
| `CF20` | 184.39 |
| `CF21` | 68.19 |

### Door + window type counts (from DXF spatial-joined IDEN tags)

Doors:

```
  D04: 39
  D34: 22
  D31: 16
  D21: 11
  D02: 10
  D33: 5
  D03: 4
  D01: 3
  D35: 3
  D05: 1
  D10: 1
  D20: 1
  D11: 1
  D42: 1
```

Windows:

```
  W03: 17
  W05: 9
  W04: 4
  W01: 3
  W83: 2
```

### Obvod místností pro sokly

- Σ obvod (raw): **1474.91 m**
- Σ obvod − door widths: **1355.51 m** (use for sokl 80 mm length)
- Σ door widths: **119.40 m**

## Verdict

- FF coverage ≥ 95 %: **100.0 %** ✅
- F povrch_sten coverage ≥ 95 %: **100.0 %** ✅
- Tabulka cross-check ≥ 95 % ±2 %: **100.0 %** ✅
- Skladby vrstva spec ≥ 85 %: **93.5 %** ✅

### ✅ READY FOR PHASE 3 (item generation)

All coverage thresholds met. The geometric dataset `objekt_D_geometric_dataset.json` carries:
- **109 D rooms** with code, plocha podlahy, obvod, světlá výška, all 5 skladba/povrch fields per Tabulka místností, plus DXF segment-tag neighbours and rough wall area brutto.
- **31 unique skladba codes** (29 with full vrstva specification from Tabulka skladeb).
- **Aggregates** by FF/F/CF code, door + window type counts, obvod totals (full + minus-doors), per-orientation facade openings.
- **Carry-forward** critical finding: starý VV missing ~2000 m² of cement screed, persists from Phase 0.7.

## Known limitations / Phase 3 enhancements

- **CF coverage is 31 %** — 75 D rooms have no `typ_podhledu` in Tabulka místností. Expected for technical 1.PP rooms (parking, sklepy) and a handful of utility spaces. Phase 3 item generator should treat missing CF as 'no podhled item required for this room', not as an error.
- **Per-room opening ownership** is not yet computed. Step 2 stops at the podlaží level (openings classified fasadní/vnitřní); Phase 3 needs to assign each opening to a specific room polygon via shapely.contains() so per-room wall netto = brutto − Σ openings_in_room.
- **F20 / F30** referenced by Tabulka místností but absent from Tabulka skladeb. Phase 3 should either fetch from a different document (revize?) or flag for manual lookup.
- **Coverage gap for objekty A/B/C** persists from Session 1 inventory. DWG dataset covers only D + společný 1.PP. Phase 3 komplex output for the final výkaz will need either additional DWG or a hybrid PDF-measurement path.