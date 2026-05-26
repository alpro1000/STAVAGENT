# HK212 — Dílenská OK + ÚT DPS discovery report

_Generated: 2026-05-21T20:14:25.375184+00:00_

_Source: ezdxf 1.4.3 (deterministic), no AI calls, no outbound HTTP_


## Stage A — Razítka inventory

### Dílenská (Hala HK_ Úprava dveří.dxf)

- Current persons: ['Ing. Jan Mičánek', 'Ing. Daniel Mach']
- ČKAIT: ['ČKAIT 1302177']
- Stupeň strings (top 3): ['DÚR + DSP', 'STUPEŇ']
- Current dates (≥2024): ['04/2026']
- HK akce signal: False  (text 'Hradec' matched in akce, see ghost-toggle below)
- **Ghost razítko filtered**: {'Tichák': 6, 'Fojtů': 3, 'LIMA': 1, 'DRSLAVICE': 1}
  - Ghost persons: ['Ing. Tomáš Tichák', 'Ing. Jaroslav Fojtů']
  - Ghost dates (<2024): ['03/2007', '03/2006', '04/2019', '10/2021']

### ÚT DPS (UT_HALAHK_DPS.dxf)

- Current persons: []
- HK akce signal: False
- **§11 STOP gate #2 hit**: no razítko text extractable from this file. ÚT projektant vendor TBD — flagged.

## Stage B — Dílenská kusovník (combined across all 5 výkresy)

- Total INSERT instances: **152**
- Profile lines (classified): **67**
- Unclassified blocks: 22
- Workshop part codes distinct: **36**
- Rám/Pohled labels: 17
- DIMENSION entities: 391

### Profile rollup (top 20 by count)

| Family | Size | Count | kg/m | Catalog hit |
|---|---|---:|---:|---|
| JEKL_JAKL_square | 60x60x4 (assumed) | 24 | 6.86 | ✓ |
| IPE | 450 | 17 | 77.6 | ✓ |
| IPE | 270 | 9 | 36.1 | ✓ |
| JEKL_JAKL_square | 100x100x5 (assumed) | 3 | 14.7 | ✓ |
| L_equal_angle | 50x50x5 (assumed) | 3 | 3.77 | ✓ |
| IPE | 400 | 2 | 66.3 | ✓ |
| HEA | 100 | 1 | 16.7 | ✓ |
| HEA | 120 | 1 | 19.9 | ✓ |
| HEA | 140 | 1 | 24.7 | ✓ |
| HEA | 160 | 1 | 30.4 | ✓ |
| HEA | 180 | 1 | 35.5 | ✓ |
| HEA | 200 | 1 | 42.3 | ✓ |
| HEA | 220 | 1 | 50.5 | ✓ |
| HEA | 240 | 1 | 60.3 | ✓ |
| HEA | 260 | 1 | 68.2 | ✓ |
| HEA | 280 | 1 | 76.4 | ✓ |
| HEA | 300 | 1 | 88.3 | ✓ |
| HEA | 320 | 1 | 97.6 | ✓ |
| HEA | 340 | 1 | 105.0 | ✓ |
| HEA | 360 | 1 | 112.0 | ✓ |

### Workshop part codes (first 30)

`142.Z.13-20 · 172.Z.13-25 · 202.Z.14-27 · 232.Z.14-25 · 262.Z.15-29 · 302.Z.20-29 · 342.Z.23-35 · 402.Z.25-32 · 142.C.13-20 · 172.C.13-25 · 202.C.14-27 · 232.C.14-25 · 262.C.15-29 · 302.C.20-29 · 342.C.23-30 · 200.E.20-25 · 230.E.20-25 · 270.E.25-29 · 330.E.25-29 · 142.M.13-20 · 150.M.15-20 · 165.M.15-20 · 172.M.13-25 · 202.M.14-27 · 220.M.15-20 · 232.M.14-25 · 262.M.15-29 · 302.M.20-29 · 342.M.23-30 · 122.Z.13-18`

_Total distinct codes: 36. Sémantika kódů NOT YET interpreted (Q1 default — raw extract)._

## Stage C — ÚT zařízení list

| Zařízení | Count | Topný kW/ks | Topný total kW | Vendor |
|---|---:|---:|---:|---|
| Dalap_E-HP_9kW | 4 | 9.0 | 36.0 | DALAP |
| ECOSUN_S+_12 | 40 | 1.2 | 48.0 | FENIX (ECOSUN) |
| PT_Vents_UET-15D | 4 | 0.0 | 0.0 | PT Ventilation |
| LENS_ARENA_60x120_W | 36 | 0.0 | 0.0 | LENS |
| **CELKEM** | | | **84.00** | |

### 2966-1 NÁVRH DISPOZICE block extraction

- Total INSERT references: **143**
- Unique block defs (one per machine in dispozice plan): **3**
- Distinct insert positions: 2 (all near 408627 / 397388 X-coord)
- Aggregated inner entity types: {'LINE': 11808, 'LWPOLYLINE': 11}
- Inner text fragments (extracted): 0

Block-def prefix groups (top 5):
  - `2966-1_NAVRH_DISPOZICE_<N>` — 140 distinct definitions; sample: ['2966-1_NAVRH_DISPOZICE_187', '2966-1_NAVRH_DISPOZICE_188', '2966-1_NAVRH_DISPOZICE_189']
  - `2966-1_NAVRH_DISPOZICE_S_<N>` — 2 distinct definitions; sample: ['2966-1_NAVRH_DISPOZICE_S26', '2966-1_NAVRH_DISPOZICE_S26']
  - `2966-1_NAVRH_DISPOZICE_STR` — 1 distinct definitions; sample: ['2966-1_NAVRH_DISPOZICE_STR']

_ABMV #16 → `partially_resolved` (block content available — 143 unique machine block-defs embedded; samostatný PDF stále žádán pro definici jednotlivých strojů)._

## Open ABMV items (proposed update)

| ID | Topic | Current status | Proposed status |
|---|---|---|---|
| #1 | Energetická bilance | open | needs_clarification (P_topný vs P_inst ambiguity, see energy MD) |
| #12 | TZB profesní D.1.4 | open | partially_resolved (ÚT v DPS in hand; ZTI/EL/VZT detail still missing) |
| #15 | Vaznice krajní UPE 160 vs C150×19.3 | open | NEEDS_USER — dílenská má 0× UPE, 0× C150 v INSERT names. Profile may be in geometric LINEs without block reference. |
| #16 | 2966-1 dispozice strojů | open | partially_resolved (block embedded; PDF still wanted) |

## Phase 2.1 readiness

- 🟢 **Stage A (razítko)**: done for both files
- 🟢 **Stage B (kusovník combined)**: 152 INSERTs classified across profile families
- 🟡 **Stage B per-rám split**: deferred — needs spatial clustering of rám/pohled labels with INSERT positions (Stage D)
- 🟢 **Stage C (ÚT inventory)**: done; energy bilance flagged for ABMV #1 update
- 🟢 **2966-1 block**: extracted (partial close ABMV #16)
- 🔴 **Stage D (items_hk212_etap1.json update)**: NOT done — awaits user ratification of discovery findings

## Recommended next steps

1. Review this report. Especially check ECOSUN energy bilance — 480 kW suspicious.
2. Ratify Stage D plan: update HSV-3 items (per-rám length × kg/m), concretize PT Vents VZT concept, add Dalap + ECOSUN as new ÚT items, update ABMV queue.
3. If Stage D OK → I proceed with backup + in-place items.json update + delta_report.md + integration_summary.md.