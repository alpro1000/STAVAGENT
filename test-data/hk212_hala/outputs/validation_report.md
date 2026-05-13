# Phase 0b — Validation Report

**Project:** hk212_hala  ·  **Date:** 2026-05-12  ·  **Phase:** 0b (independent validation)

Independent re-parse of all 7 DXF + 7 TZ PDFs against pre-baked `inputs/meta/project_header.json`. Pre-baked content is NOT treated as ground truth — every claim was re-verified.

## Summary

- Total claims checked: **15**
- ✅ Confirmed: **7**
- ⚠️ Drift: **7**
- ⏳ Partial: **1**
- ❓ Missing evidence: **0**

## Drifts (action required)

### K-01 — `konstrukce.sloupy_ramove.pocet_dxf`
- **pre-baked:** `30`
- **observed:** `36`
- **note:** pre=30 vs obs=36 (delta +6); 

### K-02 — `konstrukce.sloupy_stitove.pocet_dxf`
- **pre-baked:** `10`
- **observed:** `8`
- **note:** pre=10 vs obs=8 (delta -2); 

### K-03 — `konstrukce.stresne_ztuzidla.pocet_dxf`
- **pre-baked:** `7`
- **observed:** `8`
- **note:** pre=7 vs obs=8 (delta +1); 

### K-04 — `konstrukce.vaznice_krajni_OPEN`
- **pre-baked:** `{'tz_b': 'UPE 160', 'a104_dxf': 'C150×19,3', '_abmv_ref': '#15'}`
- **observed:** `{'upe_mentions': 19, 'C150_mentions': '0 in TZ'}`
- **note:** TZ má 19× UPE160 (S235) a 0× C150×19,3. Pre-baked claim by A104 DXF C150×19,3 není potvrzen TZ — working_assumption pro VYJASNĚNÍ #15 by měl být obrácen na UPE 160.

### G-01 — `heights.strech_sklon_deg`
- **pre-baked:** `5.25`
- **observed:** `5.65`
- **note:** DXF A101 explicitly shows 5.65° (×4 instances); pre-baked says 5.25° — drift.

### E-01 — `tzb.elektro_OPEN.p_vyp_kw`
- **pre-baked:** `60.5`
- **observed:** `{'powers_in_tz': ['30,0 kW', '18,5 kW', '15 kW', '1,2 kW', '9 kW', '61,2 kW', '15,4 kW', '5,0 kW', '18,0 kW', '83,0 kW'], '80kW_present': False, '3x100A_present': True}`
- **note:** TZ uvádí pouze el. výkony do 30 kW (rekuperační jednotka, sahary, panely ECOSUN). 80 kW DRIFT/DEFRAME strojů v TZ NENÍ — potvrzuje VYJASNĚNÍ #1 (TZ energetická bilance nezahrnuje technologii).

### X-01 — `technologie.externi_dokument_OPEN.source_A104`
- **pre-baked:** `A104 DXF external reference`
- **observed:** `{'xrefs_found_any_file': [], '2966_in_xref': False, '2966_or_stroj_in_A104_text': False}`
- **note:** Pre-baked claim 'A104 DXF external reference 2966-1' NOT verified: 0 XREF entities in any of 7 DXFs (flag-based detection on BLOCK records); 0 occurrences of '2966', 'stroj', 'dispoz' in A104 MTEXT. Pravděpodobně byla reference v původním DWG (Lost při konverzi DWG→DXF) nebo v jiném artefaktu (plot config). Manual inspection of A104 PDF doporučena.

## VYJASNĚNÍ #17 — Earth works (NEW)

**DXF-derived baseline: 349.8 m³** (vs TZ B claim 32 m³ — factor **10.9× vyšší**).

| Component | m³ | Source |
|---|---:|---|
| figura_pod_deskou | 250.4 | A102 axes envelope (28.19×19.74) + TZ desky 0.20 + lože 0.25 |
| patky_ramove_dohloubky | 31.5 | A105 ZÁKLADY DIM 1500 mm × 15 + hloubky -1.300/-1.900 mtext |
| patky_stitove_dohloubky | 1.6 | A105 DIM 800 mm × 8 + hloubky -0.700 mtext |
| pasy_mezi_patkami | 7.2 | A105 layout (estimate from axes geometry) |
| rucni_vykop_u_siti_DN300 | 30.0 | A201 layer Stávající_kan + TZ B m.10.g |
| sloped_safety_margin_10pct | 29.1 | A201 '1:1' annotations |

Variant: pilota Ø800/L=8 m vrt = 4.02 m³ (závisí na IGP, viz VYJASNĚNÍ #11).

## All claims (full)

| ID | Field | Pre-baked | Observed | Status | Conf |
|---|---|---|---|---|---:|
| K-01 | `konstrukce.sloupy_ramove.pocet_dxf` | `30` | `36` | ⚠️ drift | 0.95 |
| K-02 | `konstrukce.sloupy_stitove.pocet_dxf` | `10` | `8` | ⚠️ drift | 0.95 |
| K-03 | `konstrukce.stresne_ztuzidla.pocet_dxf` | `7` | `8` | ⚠️ drift | 0.95 |
| K-04 | `konstrukce.vaznice_krajni_OPEN` | `{"tz_b": "UPE 160", "a104_dxf": "C150×19,3", "_abmv_ref": "#` | `{"upe_mentions": 19, "C150_mentions": "0 in TZ"}` | ⚠️ drift | 0.85 |
| O-01 | `otvory.vrata_OPEN.pocet` | `4` | `4` | ✅ confirmed | 1.0 |
| O-02 | `otvory.vnejsi_dvere.pocet` | `2` | `2` | ✅ confirmed | 1.0 |
| O-03 | `otvory.okna.pocet` | `21` | `{"unique_v_tags": [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 1` | ✅ confirmed | 0.95 |
| G-01 | `heights.strech_sklon_deg` | `5.25` | `5.65` | ⚠️ drift | 1.0 |
| G-02 | `areas.podlahova_plocha_m2` | `495` | `495` | ✅ confirmed | 1.0 |
| G-03 | `geometry.axes` | `[3170, 4000, 5000, 4000, 3170, 6100, 6100, 3000, 6100, 6100]` | `[2770, 2770, 2997, 4000, 4000, 5000, 6097, 6098, 6098, 6100,` | ⏳ partial | 0.9 |
| B-01 | `zaklady.deska.beton_PLATI` | `"C25/30 XC4 (statika přebíjí ARS)"` | `{"concrete": ["C16/20", "C25/30", "C30/37"], "exposure": ["X` | ✅ confirmed | 1.0 |
| B-02 | `zaklady.patky_ramove.beton` | `"C16/20 XC0 prostý"` | `{"C16/20": true, "XC0": true}` | ✅ confirmed | 1.0 |
| E-01 | `tzb.elektro_OPEN.p_vyp_kw` | `60.5` | `{"powers_in_tz": ["30,0 kW", "18,5 kW", "15 kW", "1,2 kW", "` | ⚠️ drift | 0.95 |
| Z-01 | `zaklady.atypicky_zaklad_alternativa` | `{"pilota_prumer_mm": 800, "pilota_delka_m": 8.0, "beton": "C` | `{"PILOT_mention": true, "800mm_mention": true, "IGP_mention"` | ✅ confirmed | 1.0 |
| X-01 | `technologie.externi_dokument_OPEN.source_A104` | `"A104 DXF external reference"` | `{"xrefs_found_any_file": [], "2966_in_xref": false, "2966_or` | ⚠️ drift | 0.95 |

## Recommendation

❌ **STOP** — 7 silent drifts exceeded threshold of 5. Resolve drifts with projektant before Phase 1 generator.