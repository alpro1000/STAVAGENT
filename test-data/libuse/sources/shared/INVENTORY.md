# `sources/shared/` — INVENTORY

**Files**: 33 (10 XLSX + 19 PDF + 3 DWG + 1 DOCX)

Komplex-wide content (filename `_100_` prefix, architectural section 100).
Verified scope: Tabulka 0020 has 935 rows covering A + B + C + D + S.A + S.B + S.C + S.D rooms.

## File listing

### `xlsx/`

| File | Size | SHA-256 (8) |
|------|----:|:-----------|
| `185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx` |    104,118 | `58b82906` |
| `185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx` |     89,673 | `b162b152` |
| `185-01_DPS_D_SO01_100_0041_TABULKA DVERI.xlsx` |    122,033 | `7a5531a9` |
| `185-01_DPS_D_SO01_100_0042_TABULKA OKEN.xlsx` |    272,175 | `56212176` |
| `185-01_DPS_D_SO01_100_0043_TABULKA PROSKLENYCH PRICEK.xlsx` |    221,479 | `b254dde2` |
| `185-01_DPS_D_SO01_100_0050_R01_TABULKA ZAMECNICKYCH VYROBKU.xlsx` |    222,597 | `de9cec7d` |
| `185-01_DPS_D_SO01_100_0060_R01_TABULKA KLEMPIRSKYCH PRVKU.xlsx` |    218,525 | `0c7b05f9` |
| `185-01_DPS_D_SO01_100_0070_R01_TABULKA PREKLADU.xlsx` |     47,539 | `e1102c93` |
| `185-01_DPS_D_SO01_100_0080_R02 - TABULKA OSTATNICH PRVKU.xlsx` |    237,899 | `c3e8b713` |
| `Vykaz_vymer_stary.xlsx` |    984,980 | `debf028a` |

### `docx/`

| File | Size | SHA-256 (8) |
|------|----:|:-----------|
| `185-01_DPS_D_SO01_100_0010_R01-TZ.docx` |     94,265 | `13f767f9` |

### `dwg/`

| File | Size | SHA-256 (8) |
|------|----:|:-----------|
| `185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dwg` |    679,636 | `0d179a3e` |
| `185-01_DPS_D_SO01_100_4040_R00 - odvodneni teras.dwg` |  2,926,873 | `d690593f` |
| `185-01_DPS_D_SO01_100_5000_R01 - ŘEZY 1-PP.dwg` |    704,940 | `8c294d96` |

### `pdf/`

| File | Size | SHA-256 (8) |
|------|----:|:-----------|
| `185-01_DPS_D_SO01_100_0000_01_Titulka.pdf` |    672,726 | `1dfd742c` |
| `185-01_DPS_D_SO01_100_0010_01_Technicka_zprava.pdf` |    944,059 | `e240cf05` |
| `185-01_DPS_D_SO01_100_0011_00_Radonovy posudek.pdf` |  1,287,278 | `71f564c3` |
| `185-01_DPS_D_SO01_100_0020_01_Tabulka_mistnosti.pdf` |    621,137 | `bb222b48` |
| `185-01_DPS_D_SO01_100_0030_01_Tabulka_specifikace_skladeb_a_povrchu.pdf` |    687,572 | `3201299f` |
| `185-01_DPS_D_SO01_100_0040_00_Tabulka_vyplneni_otvoru.pdf` |  1,777,792 | `fa1fad00` |
| `185-01_DPS_D_SO01_100_0050_01_Tabulka_zamecnickych_prvku.pdf` |  1,004,757 | `e2c24a60` |
| `185-01_DPS_D_SO01_100_0060_01_Tabulka_klempirskych_prvku.pdf` |  1,186,365 | `66c84f95` |
| `185-01_DPS_D_SO01_100_0070_01_Tabulka_prekladu.pdf` |    790,555 | `0ff17d25` |
| `185-01_DPS_D_SO01_100_0080_02_Tabulka_ostatnich prvku.pdf` |    677,714 | `da746ed9` |
| `185-01_DPS_D_SO01_100_4010_00_Pudorys_vykopu.pdf` |  1,563,431 | `8b46439a` |
| `185-01_DPS_D_SO01_100_4020_00_Podkladni_betony.pdf` |  1,449,466 | `225b8a15` |
| `185-01_DPS_D_SO01_100_4030_01_Pudorys_1_PP.pdf` |    696,461 | `5d00dbee` |
| `185-01_DPS_D_SO01_100_4040_01_Odvodneni teras.pdf` |  1,446,168 | `800f7504` |
| `185-01_DPS_D_SO01_100_5000_01_Rezy_1_PP.pdf` |    409,015 | `188e217e` |
| `185-01_DPS_D_SO01_100_8030_01_Kniha_detailu.pdf` | 23,420,917 | `f41c58a5` |
| `185-01_DPS_D_SO01_100_8050_00_Zasady_sparorezu.pdf` |    621,219 | `37938727` |
| `185-01_DPS_D_SO01_100_9000_00_Pudorys_1_PP_koor_vykres_cast_A.pdf` |    835,385 | `b98a3b17` |
| `185-01_DPS_D_SO01_100_9001_00_Pudorys_1_PP_koor_vykres_cast_B.pdf` |    599,345 | `5f5b744f` |

## Coverage check

Komplex-wide content expected (`_100_` prefix + Vykaz_vymer_stary):

| Code | Description | XLSX/DOCX | DWG | PDF |
|------|------------|-----|-----|-----|
| `0010` | TZ — Technická zpráva | ✅ | — | ✅ |
| `0011` | Radonový posudek | — | — | ✅ |
| `0020` | Tabulka místností | ✅ | — | ✅ |
| `0030` | Tabulka skladeb a povrchu | ✅ | — | ✅ |
| `0040` | Tabulka výplňování otvorů (PDF) | — | — | ✅ |
| `0041` | Tabulka dveří | ✅ | — | — |
| `0042` | Tabulka oken | ✅ | — | — |
| `0043` | Tabulka prosklených příček | ✅ | — | — |
| `0050` | Tabulka zámečnických výrobků | ✅ | — | ✅ |
| `0060` | Tabulka klempířských prvků | ✅ | — | ✅ |
| `0070` | Tabulka překladů | ✅ | — | ✅ |
| `0080` | Tabulka ostatních prvků | ✅ | — | ✅ |
| `4010` | Půdorys výkopu | — | — | ✅ |
| `4020` | Podkladní betony | — | — | ✅ |
| `4030` | 1.PP půdorys | — | ✅ | ✅ |
| `4040` | Odvodnění teras | — | ✅ | ✅ |
| `5000` | Řezy 1.PP | — | ✅ | ✅ |
| `8030` | Kniha detailů | — | — | ✅ |
| `8050` | Zásady spárořezu | — | — | ✅ |
| `9000` | 1.PP koor. výkres část A | — | — | ✅ |
| `9001` | 1.PP koor. výkres část B | — | — | ✅ |
| `0000` | Titulka | — | — | ✅ |

### Vykaz_vymer_stary.xlsx — present ✅ (komplex BOQ, 30 sheets)

## Notes

- **Tabulky 0040 (výplně otvorů)**: PDF-only. The XLSX-equivalent is split into 0041 (dveře) + 0042 (okna) + 0043 (prosklené příčky).
- **Tabulky 0042 + 0043 PDF**: not in source. PDF for these tables likely was never produced (or merged into 0040 PDF). Pipeline reads XLSX directly.
- **Vykaz_vymer_stary.xlsx**: komplex bill-of-quantities — pipeline filters to D-scope at parse time (Phase 5).
- **0010 TZ**: present as both DOCX (editable, `shared/docx/`) and PDF (rendered, `shared/pdf/`).
- **Drainage 4040**: DWG present but `dxf_parser.py` skips by `re.compile(r"odvodneni", re.IGNORECASE)` filename pattern.
