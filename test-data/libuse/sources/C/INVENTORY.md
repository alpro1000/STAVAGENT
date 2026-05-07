# `sources/C/` — INVENTORY

**Files**: 25 (11 DWG + 14 PDF)

Filename pattern: `_130_` (architectural section 130 = C-specific) + `OBJEKT C` / `Obj_C_` in filenames.

Source: ABMV upload at `test-data/<flat>` → moved here on Π.0.0 Part 2.

## File listing

### `dwg/` (11)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| `0000` | `185-01_DPS_D_SO01_130_0000_R01_ARS objekt C_desky.dwg` |  4,367,701 | `46405976` |
| `4310` | `185-01_DPS_D_SO01_130_4310_02 - OBJEKT C - Půdorys 1- NP.dwg` |    321,568 | `09f98f49` |
| `4320` | `185-01_DPS_D_SO01_130_4320_R01 - OBJEKT C - Půdorys 2. NP.dwg` |    350,066 | `d4611107` |
| `4330` | `185-01_DPS_D_SO01_130_4330_02 - OBJEKT C - Půdorys 3- NP.dwg` |    367,569 | `37b30d51` |
| `4340` | `185-01_DPS_D_SO01_130_4340_00-OBJEKT C - Půdorys střechy.dwg` |    137,833 | `cb300c93` |
| `5300` | `185-01_DPS_D_SO01_130_5300_R01 - OBJEKT C - ŘEZY.dwg` |    822,499 | `17b6fd92` |
| `6300` | `185-01_DPS_D_SO01_130_6300_02 - OBJEKT C - Pohledy.dwg` |    645,210 | `54ba24bf` |
| `7310` | `185-01_DPS_D_SO01_130_7310_00-OBJEKT C - Výkres podhledů 1. NP.dwg` |    271,711 | `96ef9266` |
| `7320` | `185-01_DPS_D_SO01_130_7320_00-OBJEKT C - Výkres podhledů 2. NP.dwg` |    278,462 | `13d4bb87` |
| `7330` | `185-01_DPS_D_SO01_130_7330_00-OBJEKT C - Výkres podhledů 3. NP.dwg` |    288,774 | `861b57fa` |
| `—` | `185-01_DPS_D_SO01_130_ARS objekt C_desky.dwg` |  4,301,362 | `543427cf` |

### `pdf/` (14)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| `0000` | `185-01_DPS_D_SO01_130_0000_00_ARS obj_C_desky.pdf` |    672,994 | `bb9e96ed` |
| `4310` | `185-01_DPS_D_SO01_130_4310_02_Obj_C_Pudorys_1_NP.pdf` |    165,867 | `458ddee6` |
| `4320` | `185-01_DPS_D_SO01_130_4320_01_Obj_C_Pudorys_2_NP.pdf` |    183,428 | `7f8bef5a` |
| `4330` | `185-01_DPS_D_SO01_130_4330_02_Obj_C_Pudorys_3_NP.pdf` |    226,122 | `076982ce` |
| `4340` | `185-01_DPS_D_SO01_130_4340_00_Obj_C_Pudorys_strechy.pdf` |     87,209 | `5d5d187f` |
| `5300` | `185-01_DPS_D_SO01_130_5300_01_Obj_C_Rezy.pdf` |    687,659 | `93ace3c8` |
| `6300` | `185-01_DPS_D_SO01_130_6300_02_Obj_C_Pohledy.pdf` |    286,947 | `8c49215f` |
| `7310` | `185-01_DPS_D_SO01_130_7310_00_Obj_C_Vykres_podhledu_1_NP.pdf` |    179,797 | `aba46ae5` |
| `7320` | `185-01_DPS_D_SO01_130_7320_00_Obj_C_Vykres_podhledu_2_NP.pdf` |    154,808 | `d2c3dddd` |
| `7330` | `185-01_DPS_D_SO01_130_7330_00_Obj_C_Vykres_podhledu_3_NP.pdf` |    138,452 | `08921de4` |
| `9310` | `185-01_DPS_D_SO01_130_9310_00_Obj_C_Koor_vykres_1_NP.pdf` |    342,992 | `a6c81a9a` |
| `9320` | `185-01_DPS_D_SO01_130_9320_00_Obj_C_Koor_vykres_2_NP.pdf` |    367,307 | `709e4693` |
| `9321` | `185-01_DPS_D_SO01_130_9321_00_Obj_C_Koor_vyk_byt_jader_2_NP.pdf` |    444,986 | `90ba363d` |
| `9330` | `185-01_DPS_D_SO01_130_9330_00_Obj_C_Koor_vykres_3_NP.pdf` |    401,600 | `46d5f881` |

## Coverage check

C-specific drawings expected (`_130_` prefix):

| Code | Description | DWG | PDF |
|------|------------|:---:|:---:|
| `4310` | C — Půdorys 1.NP | ✅ | ✅ |
| `4320` | C — Půdorys 2.NP | ✅ | ✅ |
| `4330` | C — Půdorys 3.NP | ✅ | ✅ |
| `4340` | C — Půdorys střechy | ✅ | ✅ |
| `5300` | C — Řezy | ✅ | ✅ |
| `6300` | C — Pohledy | ✅ | ✅ |
| `7310` | C — Podhledy 1.NP | ✅ | ✅ |
| `7320` | C — Podhledy 2.NP | ✅ | ✅ |
| `7330` | C — Podhledy 3.NP | ✅ | ✅ |
| `9310` | C — Koor. výkres 1.NP | ❌ | ✅ |
| `9320` | C — Koor. výkres 2.NP | ❌ | ✅ |
| `9321` | C — Koor. byt jader 2.NP | ❌ | ✅ |
| `9330` | C — Koor. výkres 3.NP | ❌ | ✅ |
| `0000` | C — ARS desky | ✅ | ✅ |

## Notes

- **Koordinace 9310/9320/9321/9330 výkresy**: PDF-only (no editable DWG). Same as D — consistent across objekty.
- **Master XLSX tables (mistnosti / skladby / dveře / okna / etc.)**: komplex-wide → `sources/shared/xlsx/`. Pipeline filters to `C` scope at parse time using `is_objekt_X(room_kod)` switch (currently hardcoded to D, will be parametrized in Π.0a).
- **No 1.PP drawings** for C — expected; komplex 1.PP is a single shared drawing under D (`sources/shared/dwg/`).

## Drop-in upload target

```
sources/C/dwg/  # *.dwg here
sources/C/pdf/  # *.pdf here
sources/C/xlsx/ # *.xlsx (rare, only if C-specific)
```