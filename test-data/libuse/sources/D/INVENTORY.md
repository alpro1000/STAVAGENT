# `sources/D/` — INVENTORY

**Files**: 25 (11 DWG + 14 PDF)

Filename pattern: `_140_` (architectural section 140 = D-specific) + `OBJEKT D` in DWG names.

## File listing

### `dwg/`

| File | Size | SHA-256 (8) |
|------|----:|:-----------|
| `185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg` |    371,815 | `b6d47c5b` |
| `185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP.dwg` |    403,996 | `c6a40a22` |
| `185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP.dwg` |    415,067 | `535ee852` |
| `185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha.dwg` |    154,008 | `5877ce7f` |
| `185-01_DPS_D_SO01_140_5400_R01 - OBJEKT D - ŘEZY.dwg` |    900,297 | `347c6d06` |
| `185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY.dwg` |    707,450 | `74210088` |
| `185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP.dwg` |    287,269 | `c7d2bc07` |
| `185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. NP.dwg` |    274,399 | `38a4210b` |
| `185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. NP.dwg` |    301,935 | `87fbc042` |
| `185-01_DPS_D_SO01_140_ARS objekt D_desky.dwg` |  4,301,330 | `2df5ec0a` |
| `18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` |  1,539,557 | `f0f52075` |

### `pdf/`

| File | Size | SHA-256 (8) |
|------|----:|:-----------|
| `185-01_DPS_D_SO01_140_0000_01_ARS_objekt_D_desky.pdf` |    672,994 | `7c38217f` |
| `185-01_DPS_D_SO01_140_4410_00_Obj_D_Pudorys_1_NP.pdf` |    186,428 | `271d7fe4` |
| `185-01_DPS_D_SO01_140_4420_01_Obj_D_Pudorys_2_NP.pdf` |    233,611 | `3c957960` |
| `185-01_DPS_D_SO01_140_4430_01_Obj_D_Pudorys_3_NP.pdf` |    266,055 | `afbd667d` |
| `185-01_DPS_D_SO01_140_4440_00_Obj_D_Pudorys_strecha.pdf` |     91,499 | `eee5c9ab` |
| `185-01_DPS_D_SO01_140_5400_01_Obj_D_Rezy.pdf` |    788,014 | `4f02a6a5` |
| `185-01_DPS_D_SO01_140_6400_01_Obj_D_Pohledy.pdf` |    307,411 | `b929a035` |
| `185-01_DPS_D_SO01_140_7410_00_Obj_D_Vykres_podhledu_1_NP.pdf` |    196,426 | `9c213c2e` |
| `185-01_DPS_D_SO01_140_7420_00_Obj_D_Vykres_podhledu_2_NP.pdf` |    148,370 | `f9b2262e` |
| `185-01_DPS_D_SO01_140_7430_00_Obj_D_Vykres_podhledu_3_NP.pdf` |    144,040 | `8ce26104` |
| `185-01_DPS_D_SO01_140_9410_00_Obj_D_Koor_vykres_1_NP.pdf` |    399,631 | `79ec8eba` |
| `185-01_DPS_D_SO01_140_9420_00_Obj_D_Koor_vykres_2_NP.pdf` |    415,409 | `daf6b32a` |
| `185-01_DPS_D_SO01_140_9421_00_Obj_D_Koor_vyk_byt_jader_2_NP.pdf` |    639,598 | `b9203b3e` |
| `185-01_DPS_D_SO01_140_9430_00_Obj_D_Koor_vykres_3_NP.pdf` |    425,948 | `9bd3efc4` |

## Coverage check

D-specific drawings expected (`_140_` prefix):

| Code | Description | DWG | PDF |
|------|------------|-----|-----|
| `4410` | 1.NP půdorys | ✅ | ✅ |
| `4420` | 2.NP půdorys | ✅ | ✅ |
| `4430` | 3.NP půdorys | ✅ | ✅ |
| `4440` | střecha půdorys | ✅ | ✅ |
| `5400` | řezy | ✅ | ✅ |
| `6400` | pohledy | ✅ | ✅ |
| `7410` | 1.NP podhledy | ✅ | ✅ |
| `7420` | 2.NP podhledy | ✅ | ✅ |
| `7430` | 3.NP podhledy | ✅ | ✅ |
| `9421` | koor. byt jader 2.NP | ✅ | ✅ |
| `ARS` | ARS desky | ✅ | ✅ |

## Notes

- **9410 / 9420 / 9430 koordinace výkres** — PDF-only (no editable DWG); see `sources/D/pdf/`.
- **9421 koor. byt jader 2.NP** — has both DWG (with non-standard `18501_` prefix) + PDF.
- **`140_ARS_objekt_D_desky.dwg`** — slab reinforcement; currently skipped by `dxf_parser.py` (filename pattern `ARS.*desky` in skip list). Out of finishing scope.
- **Master XLSX tables** are komplex-wide → see `sources/shared/xlsx/`.
