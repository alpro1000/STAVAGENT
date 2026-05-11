# `sources/B/` — INVENTORY

**Files**: 24 (10 DWG + 14 PDF)

Filename pattern: `_120_` (architectural section 120 = B-specific) + `OBJEKT B` / `Obj_B_` in filenames.

Source: ABMV upload at `test-data/<flat>` → moved here on Π.0.0 Part 2.

## File listing

### `dwg/` (10)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| `4210` | `185-01_DPS_D_SO01_120_4210_00-OBJEKT B - Půdorys 1. NP.dwg` |    378,153 | `206d792e` |
| `4220` | `185-01_DPS_D_SO01_120_4220_R01 - OBJEKT B - Půdorys 2. NP.dwg` |    433,045 | `d3ddd433` |
| `4230` | `185-01_DPS_D_SO01_120_4230_R01 - OBJEKT B - Půdorys 3. NP.dwg` |    350,221 | `8eb4cc91` |
| `4240` | `185-01_DPS_D_SO01_120_4240_00-OBJEKT B - Půdorys střecha.dwg` |    160,536 | `9ac746e8` |
| `5200` | `185-01_DPS_D_SO01_120_5200_R01 - OBJEKT B - ŘEZY.dwg` |    750,784 | `df0b1821` |
| `6200` | `185-01_DPS_D_SO01_120_6200_00_OBJEKT B - POHLEDY.dwg` |    679,123 | `87b4c9cf` |
| `7210` | `185-01_DPS_D_SO01_120_7210_00-OBJEKT B - Výkres podhledů 1. NP.dwg` |    302,214 | `c1e8d4b5` |
| `7220` | `185-01_DPS_D_SO01_120_7220_00-OBJEKT B - Výkres podhledů 2. NP.dwg` |    292,519 | `b6fb67ee` |
| `7230` | `185-01_DPS_D_SO01_120_7230_00-OBJEKT B - Výkres podhledů 3. NP.dwg` |    247,435 | `51781c37` |
| `—` | `185-01_DPS_D_SO01_120_ARS objekt B_desky.dwg` |  4,301,330 | `0209731f` |

### `pdf/` (14)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| `0000` | `185-01_DPS_D_SO01_120_0000_00_ARS objekt B_desky.pdf` |    672,994 | `bc3df2da` |
| `4210` | `185-01_DPS_D_SO01_120_4210_00_Obj_B_Pudorys_1_NP.pdf` |    177,996 | `4c12a98f` |
| `4220` | `185-01_DPS_D_SO01_120_4220_01_Obj_B_Půdorys_2_NP.pdf` |    226,359 | `a3f8f51b` |
| `4230` | `185-01_DPS_D_SO01_120_4230_01_Obj_B_Půdorys_3_NP.pdf` |    232,099 | `8423f89b` |
| `4240` | `185-01_DPS_D_SO01_120_4240_00_Obj_B_Pudorys_strecha.pdf` |     88,877 | `b5144c0d` |
| `5200` | `185-01_DPS_D_SO01_120_5200_01_Obj_B_Rezy.pdf` |    694,292 | `539a689b` |
| `6200` | `185-01_DPS_D_SO01_120_6200_00_Obj_B_Pohledy.pdf` |    302,118 | `7b6ff48e` |
| `7210` | `185-01_DPS_D_SO01_120_7210_00_Obj_B_Vykres_podhledu_1_NP.pdf` |    184,602 | `c255935e` |
| `7220` | `185-01_DPS_D_SO01_120_7220_00_Obj_B_Vykres_podhledu_2_NP.pdf` |    138,867 | `82427b4c` |
| `7230` | `185-01_DPS_D_SO01_120_7230_00_Obj_B_Vykres_podhledu_3_NP.pdf` |    150,423 | `6c03691b` |
| `9210` | `185-01_DPS_D_SO01_120_9210_00_Obj_B_Koor_vykres_1_NP.pdf` |    413,155 | `522301c0` |
| `9220` | `185-01_DPS_D_SO01_120_9220_00_Obj_B_Koor_vykres_2_NP.pdf` |    427,443 | `2cd2b494` |
| `9221` | `185-01_DPS_D_SO01_120_9221_00_Obj_B_Koor_vyk_byt_jader_2_NP.pdf` |    896,951 | `592a4035` |
| `9230` | `185-01_DPS_D_SO01_120_9230_00_Obj_B_Koor_vykres_3_NP.pdf` |    401,658 | `ebd66f77` |

## Coverage check

B-specific drawings expected (`_120_` prefix):

| Code | Description | DWG | PDF |
|------|------------|:---:|:---:|
| `4210` | B — Půdorys 1.NP | ✅ | ✅ |
| `4220` | B — Půdorys 2.NP | ✅ | ✅ |
| `4230` | B — Půdorys 3.NP | ✅ | ✅ |
| `4240` | B — Půdorys střechy | ✅ | ✅ |
| `5200` | B — Řezy | ✅ | ✅ |
| `6200` | B — Pohledy | ✅ | ✅ |
| `7210` | B — Podhledy 1.NP | ✅ | ✅ |
| `7220` | B — Podhledy 2.NP | ✅ | ✅ |
| `7230` | B — Podhledy 3.NP | ✅ | ✅ |
| `9210` | B — Koor. výkres 1.NP | ❌ | ✅ |
| `9220` | B — Koor. výkres 2.NP | ❌ | ✅ |
| `9221` | B — Koor. byt jader 2.NP | ❌ | ✅ |
| `9230` | B — Koor. výkres 3.NP | ❌ | ✅ |
| `0000` | B — ARS desky | ❌ | ✅ |

## Notes

- **Koordinace 9210/9220/9221/9230 výkresy**: PDF-only (no editable DWG). Same as D — consistent across objekty.
- **Master XLSX tables (mistnosti / skladby / dveře / okna / etc.)**: komplex-wide → `sources/shared/xlsx/`. Pipeline filters to `B` scope at parse time using `is_objekt_X(room_kod)` switch (currently hardcoded to D, will be parametrized in Π.0a).
- **No 1.PP drawings** for B — expected; komplex 1.PP is a single shared drawing under D (`sources/shared/dwg/`).

## Drop-in upload target

```
sources/B/dwg/  # *.dwg here
sources/B/pdf/  # *.pdf here
sources/B/xlsx/ # *.xlsx (rare, only if B-specific)
```