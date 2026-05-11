# `sources/A/` — INVENTORY

**Files**: 22 (9 DWG + 13 PDF)

Filename pattern: `_110_` (architectural section 110 = A-specific) + `OBJEKT A` / `Obj_A_` in filenames.

Source: ABMV upload at `test-data/<flat>` → moved here on Π.0.0 Part 2.

## File listing

### `dwg/` (9)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| `4110` | `185-01_DPS_D_SO01_110_4110_00-OBJEKT A - Půdorys 1. NP.dwg` |    297,711 | `5ecc99ba` |
| `4120` | `185-01_DPS_D_SO01_110_4120_02 - OBJEKT A - Půdorys 2- NP.dwg` |    408,026 | `7157e90b` |
| `4130` | `185-01_DPS_D_SO01_110_4130_R01 - OBJEKT A - Půdorys 3. NP.dwg` |    475,173 | `2606d6f7` |
| `4140` | `185-01_DPS_D_SO01_110_4140_00-OBJEKT A - Půdorys střechy.dwg` |    150,581 | `3c628e31` |
| `5100` | `185-01_DPS_D_SO01_110_5100_R01 - OBJEKT A - ŘEZY.dwg` |    847,493 | `86a9df5d` |
| `6100` | `185-01_DPS_D_SO01_110_6100_00_OBJEKT A - POHLEDY.dwg` |    721,131 | `1c3c311f` |
| `7110` | `185-01_DPS_D_SO01_110_7110_00-OBJEKT A - Výkres podhledů 1. NP.dwg` |    230,118 | `6494299f` |
| `7120` | `185-01_DPS_D_SO01_110_7120_00-OBJEKT A - Výkres podhledů 2. NP.dwg` |    286,979 | `890acf8e` |
| `7130` | `185-01_DPS_D_SO01_110_7130_00-OBJEKT A - Výkres podhledů 3. NP.dwg` |    277,728 | `1c67237d` |

### `pdf/` (13)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| `4110` | `185-01_DPS_D_SO01_110_4110_00_Obj_A_Pudorys_1_NP.pdf` |    158,716 | `7b86bad4` |
| `4120` | `185-01_DPS_D_SO01_110_4120_02_Obj_A_Pudorsy_2_NP.pdf` |    223,248 | `c07bfc94` |
| `4130` | `185-01_DPS_D_SO01_110_4130_01_Obj_A_Půdorys_3_NP.pdf` |    302,309 | `971c9cf5` |
| `4140` | `185-01_DPS_D_SO01_110_4140_00_Obj_A_Pudorys_strechy.pdf` |     87,138 | `dec50a7a` |
| `5100` | `185-01_DPS_D_SO01_110_5100_01_Obj_A_Rezy.pdf` |    754,619 | `d5bb3b90` |
| `6100` | `185-01_DPS_D_SO01_110_6100_00_Obj_A_Pohledy.pdf` |    308,814 | `0c0af105` |
| `7110` | `185-01_DPS_D_SO01_110_7110_00_Obj_A_Vykres_podhledu_1_NP.pdf` |    159,406 | `076f30ae` |
| `7120` | `185-01_DPS_D_SO01_110_7120_00_Obj_A_Vykres_podhledu_2_NP.pdf` |    181,520 | `430a7b8d` |
| `7130` | `185-01_DPS_D_SO01_110_7130_00_Obj_A_Vykres_podhledu_3_NP.pdf` |    147,468 | `eac5bb3e` |
| `9110` | `185-01_DPS_D_SO01_110_9110_00_Obj_A_Koor_vykres_1_NP.pdf` |    367,279 | `57756bec` |
| `9120` | `185-01_DPS_D_SO01_110_9120_00_Obj_A_Koor_vykres_2_NP.pdf` |    382,980 | `dd760e83` |
| `9121` | `185-01_DPS_D_SO01_110_9121_00_Obj_A_Koor_vyk_byt_jader_2_NP.pdf` |    682,185 | `53dcd8c5` |
| `9130` | `185-01_DPS_D_SO01_110_9130_00_Obj_A_Koor_vykres_3_NP.pdf` |    411,423 | `534d9b57` |

## Coverage check

A-specific drawings expected (`_110_` prefix):

| Code | Description | DWG | PDF |
|------|------------|:---:|:---:|
| `4110` | A — Půdorys 1.NP | ✅ | ✅ |
| `4120` | A — Půdorys 2.NP | ✅ | ✅ |
| `4130` | A — Půdorys 3.NP | ✅ | ✅ |
| `4140` | A — Půdorys střechy | ✅ | ✅ |
| `5100` | A — Řezy | ✅ | ✅ |
| `6100` | A — Pohledy | ✅ | ✅ |
| `7110` | A — Podhledy 1.NP | ✅ | ✅ |
| `7120` | A — Podhledy 2.NP | ✅ | ✅ |
| `7130` | A — Podhledy 3.NP | ✅ | ✅ |
| `9110` | A — Koor. výkres 1.NP | ❌ | ✅ |
| `9120` | A — Koor. výkres 2.NP | ❌ | ✅ |
| `9121` | A — Koor. byt jader 2.NP | ❌ | ✅ |
| `9130` | A — Koor. výkres 3.NP | ❌ | ✅ |
| `0000` | A — ARS desky | ❌ | ❌ |

### ⚠️ Gap: ARS desky (0000) missing

B + C + D all have `0000` ARS desky DWG + PDF; A has neither.
Logged as **ABMV email item #9** in `documentation_inconsistencies.json`.

## Notes

- **Koordinace 9110/9120/9121/9130 výkresy**: PDF-only (no editable DWG). Same as D — consistent across objekty.
- **Master XLSX tables (mistnosti / skladby / dveře / okna / etc.)**: komplex-wide → `sources/shared/xlsx/`. Pipeline filters to `A` scope at parse time using `is_objekt_X(room_kod)` switch (currently hardcoded to D, will be parametrized in Π.0a).
- **No 1.PP drawings** for A — expected; komplex 1.PP is a single shared drawing under D (`sources/shared/dwg/`).

## Drop-in upload target

```
sources/A/dwg/  # *.dwg here
sources/A/pdf/  # *.pdf here
sources/A/xlsx/ # *.xlsx (rare, only if A-specific)
```