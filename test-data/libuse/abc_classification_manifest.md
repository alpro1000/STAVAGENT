# A/B/C Classification Manifest — Π.0.0 Part 2

Read-only classification of 71 ABMV-uploaded source files at
`test-data/<file>` (flat, no `_UNSORTED/` subdir per task spec —
uploads landed at `test-data/` root).

**STOP for user review** — no files moved until manifest approved.

---

## Summary

- **Total uploaded files**: 72 (71 source files + 1 task spec markdown skipped)
- **Auto-classified at confidence 1.00**: 71/71
- **Mismatches**: 0 — every filename's `_110_`/`_120_`/`_130_` pattern matches the explicit 'OBJEKT A/B/C' or 'Obj_A/B/C' text
- **ZIP archives**: 0 — all files are flat .dwg or .pdf, no archive extraction needed

**Distribution**:

| Objekt | DWG | PDF | Total |
|--------|----:|----:|------:|
| **A** | 9 | 13 | 22 |
| **B** | 10 | 14 | 24 |
| **C** | 11 | 14 | 25 |
| **TOTAL** | 30 | 41 | 71 |

---

## Mapping verification (filename evidence)

Every file's `_NNN_` pattern was cross-checked against explicit
'OBJEKT X' or 'Obj_X_' text in the filename. **All 71 match**:

| Pattern | OBJEKT label found | Mapping confirmed |
|---------|-------------------|------------------|
| `_110_` | `OBJEKT A` / `Obj_A_` | ✅ 22 files |
| `_120_` | `OBJEKT B` / `Obj_B_` | ✅ 24 files |
| `_130_` | `OBJEKT C` / `Obj_C_` | ✅ 25 files |

Sample evidence:
- `185-01_DPS_D_SO01_**110**_4110_00-**OBJEKT A** - Půdorys 1.NP.dwg`
- `185-01_DPS_D_SO01_**120**_4220_R01 - **OBJEKT B** - Půdorys 2.NP.dwg`
- `185-01_DPS_D_SO01_**130**_5300_R01 - **OBJEKT C** - ŘEZY.dwg`

Mapping `_110_=A`, `_120_=B`, `_130_=C` confirmed from filename text.
Title block DXF inspection skipped (filename evidence is already
conclusive; would just be redundant).

---

## `sources/A/` — 22 files

### `sources/A/dwg/` (9)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| 4110 | `185-01_DPS_D_SO01_110_4110_00-OBJEKT A - Půdorys 1. NP.dwg` |    297,711 | `5ecc99ba` |
| 4120 | `185-01_DPS_D_SO01_110_4120_02 - OBJEKT A - Půdorys 2- NP.dwg` |    408,026 | `7157e90b` |
| 4130 | `185-01_DPS_D_SO01_110_4130_R01 - OBJEKT A - Půdorys 3. NP.dwg` |    475,173 | `2606d6f7` |
| 4140 | `185-01_DPS_D_SO01_110_4140_00-OBJEKT A - Půdorys střechy.dwg` |    150,581 | `3c628e31` |
| 5100 | `185-01_DPS_D_SO01_110_5100_R01 - OBJEKT A - ŘEZY.dwg` |    847,493 | `86a9df5d` |
| 6100 | `185-01_DPS_D_SO01_110_6100_00_OBJEKT A - POHLEDY.dwg` |    721,131 | `1c3c311f` |
| 7110 | `185-01_DPS_D_SO01_110_7110_00-OBJEKT A - Výkres podhledů 1. NP.dwg` |    230,118 | `6494299f` |
| 7120 | `185-01_DPS_D_SO01_110_7120_00-OBJEKT A - Výkres podhledů 2. NP.dwg` |    286,979 | `890acf8e` |
| 7130 | `185-01_DPS_D_SO01_110_7130_00-OBJEKT A - Výkres podhledů 3. NP.dwg` |    277,728 | `1c67237d` |

### `sources/A/pdf/` (13)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| 4110 | `185-01_DPS_D_SO01_110_4110_00_Obj_A_Pudorys_1_NP.pdf` |    158,716 | `7b86bad4` |
| 4120 | `185-01_DPS_D_SO01_110_4120_02_Obj_A_Pudorsy_2_NP.pdf` |    223,248 | `c07bfc94` |
| 4130 | `185-01_DPS_D_SO01_110_4130_01_Obj_A_Půdorys_3_NP.pdf` |    302,309 | `971c9cf5` |
| 4140 | `185-01_DPS_D_SO01_110_4140_00_Obj_A_Pudorys_strechy.pdf` |     87,138 | `dec50a7a` |
| 5100 | `185-01_DPS_D_SO01_110_5100_01_Obj_A_Rezy.pdf` |    754,619 | `d5bb3b90` |
| 6100 | `185-01_DPS_D_SO01_110_6100_00_Obj_A_Pohledy.pdf` |    308,814 | `0c0af105` |
| 7110 | `185-01_DPS_D_SO01_110_7110_00_Obj_A_Vykres_podhledu_1_NP.pdf` |    159,406 | `076f30ae` |
| 7120 | `185-01_DPS_D_SO01_110_7120_00_Obj_A_Vykres_podhledu_2_NP.pdf` |    181,520 | `430a7b8d` |
| 7130 | `185-01_DPS_D_SO01_110_7130_00_Obj_A_Vykres_podhledu_3_NP.pdf` |    147,468 | `eac5bb3e` |
| 9110 | `185-01_DPS_D_SO01_110_9110_00_Obj_A_Koor_vykres_1_NP.pdf` |    367,279 | `57756bec` |
| 9120 | `185-01_DPS_D_SO01_110_9120_00_Obj_A_Koor_vykres_2_NP.pdf` |    382,980 | `dd760e83` |
| 9121 | `185-01_DPS_D_SO01_110_9121_00_Obj_A_Koor_vyk_byt_jader_2_NP.pdf` |    682,185 | `53dcd8c5` |
| 9130 | `185-01_DPS_D_SO01_110_9130_00_Obj_A_Koor_vykres_3_NP.pdf` |    411,423 | `534d9b57` |


## `sources/B/` — 24 files

### `sources/B/dwg/` (10)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| 4210 | `185-01_DPS_D_SO01_120_4210_00-OBJEKT B - Půdorys 1. NP.dwg` |    378,153 | `206d792e` |
| 4220 | `185-01_DPS_D_SO01_120_4220_R01 - OBJEKT B - Půdorys 2. NP.dwg` |    433,045 | `d3ddd433` |
| 4230 | `185-01_DPS_D_SO01_120_4230_R01 - OBJEKT B - Půdorys 3. NP.dwg` |    350,221 | `8eb4cc91` |
| 4240 | `185-01_DPS_D_SO01_120_4240_00-OBJEKT B - Půdorys střecha.dwg` |    160,536 | `9ac746e8` |
| 5200 | `185-01_DPS_D_SO01_120_5200_R01 - OBJEKT B - ŘEZY.dwg` |    750,784 | `df0b1821` |
| 6200 | `185-01_DPS_D_SO01_120_6200_00_OBJEKT B - POHLEDY.dwg` |    679,123 | `87b4c9cf` |
| 7210 | `185-01_DPS_D_SO01_120_7210_00-OBJEKT B - Výkres podhledů 1. NP.dwg` |    302,214 | `c1e8d4b5` |
| 7220 | `185-01_DPS_D_SO01_120_7220_00-OBJEKT B - Výkres podhledů 2. NP.dwg` |    292,519 | `b6fb67ee` |
| 7230 | `185-01_DPS_D_SO01_120_7230_00-OBJEKT B - Výkres podhledů 3. NP.dwg` |    247,435 | `51781c37` |
| — | `185-01_DPS_D_SO01_120_ARS objekt B_desky.dwg` |  4,301,330 | `0209731f` |

### `sources/B/pdf/` (14)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| 0000 | `185-01_DPS_D_SO01_120_0000_00_ARS objekt B_desky.pdf` |    672,994 | `bc3df2da` |
| 4210 | `185-01_DPS_D_SO01_120_4210_00_Obj_B_Pudorys_1_NP.pdf` |    177,996 | `4c12a98f` |
| 4220 | `185-01_DPS_D_SO01_120_4220_01_Obj_B_Půdorys_2_NP.pdf` |    226,359 | `a3f8f51b` |
| 4230 | `185-01_DPS_D_SO01_120_4230_01_Obj_B_Půdorys_3_NP.pdf` |    232,099 | `8423f89b` |
| 4240 | `185-01_DPS_D_SO01_120_4240_00_Obj_B_Pudorys_strecha.pdf` |     88,877 | `b5144c0d` |
| 5200 | `185-01_DPS_D_SO01_120_5200_01_Obj_B_Rezy.pdf` |    694,292 | `539a689b` |
| 6200 | `185-01_DPS_D_SO01_120_6200_00_Obj_B_Pohledy.pdf` |    302,118 | `7b6ff48e` |
| 7210 | `185-01_DPS_D_SO01_120_7210_00_Obj_B_Vykres_podhledu_1_NP.pdf` |    184,602 | `c255935e` |
| 7220 | `185-01_DPS_D_SO01_120_7220_00_Obj_B_Vykres_podhledu_2_NP.pdf` |    138,867 | `82427b4c` |
| 7230 | `185-01_DPS_D_SO01_120_7230_00_Obj_B_Vykres_podhledu_3_NP.pdf` |    150,423 | `6c03691b` |
| 9210 | `185-01_DPS_D_SO01_120_9210_00_Obj_B_Koor_vykres_1_NP.pdf` |    413,155 | `522301c0` |
| 9220 | `185-01_DPS_D_SO01_120_9220_00_Obj_B_Koor_vykres_2_NP.pdf` |    427,443 | `2cd2b494` |
| 9221 | `185-01_DPS_D_SO01_120_9221_00_Obj_B_Koor_vyk_byt_jader_2_NP.pdf` |    896,951 | `592a4035` |
| 9230 | `185-01_DPS_D_SO01_120_9230_00_Obj_B_Koor_vykres_3_NP.pdf` |    401,658 | `ebd66f77` |


## `sources/C/` — 25 files

### `sources/C/dwg/` (11)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| 0000 | `185-01_DPS_D_SO01_130_0000_R01_ARS objekt C_desky.dwg` |  4,367,701 | `46405976` |
| 4310 | `185-01_DPS_D_SO01_130_4310_02 - OBJEKT C - Půdorys 1- NP.dwg` |    321,568 | `09f98f49` |
| 4320 | `185-01_DPS_D_SO01_130_4320_R01 - OBJEKT C - Půdorys 2. NP.dwg` |    350,066 | `d4611107` |
| 4330 | `185-01_DPS_D_SO01_130_4330_02 - OBJEKT C - Půdorys 3- NP.dwg` |    367,569 | `37b30d51` |
| 4340 | `185-01_DPS_D_SO01_130_4340_00-OBJEKT C - Půdorys střechy.dwg` |    137,833 | `cb300c93` |
| 5300 | `185-01_DPS_D_SO01_130_5300_R01 - OBJEKT C - ŘEZY.dwg` |    822,499 | `17b6fd92` |
| 6300 | `185-01_DPS_D_SO01_130_6300_02 - OBJEKT C - Pohledy.dwg` |    645,210 | `54ba24bf` |
| 7310 | `185-01_DPS_D_SO01_130_7310_00-OBJEKT C - Výkres podhledů 1. NP.dwg` |    271,711 | `96ef9266` |
| 7320 | `185-01_DPS_D_SO01_130_7320_00-OBJEKT C - Výkres podhledů 2. NP.dwg` |    278,462 | `13d4bb87` |
| 7330 | `185-01_DPS_D_SO01_130_7330_00-OBJEKT C - Výkres podhledů 3. NP.dwg` |    288,774 | `861b57fa` |
| — | `185-01_DPS_D_SO01_130_ARS objekt C_desky.dwg` |  4,301,362 | `543427cf` |

### `sources/C/pdf/` (14)

| Code | File | Size | SHA-256 (8) |
|------|------|----:|:-----------|
| 0000 | `185-01_DPS_D_SO01_130_0000_00_ARS obj_C_desky.pdf` |    672,994 | `bb9e96ed` |
| 4310 | `185-01_DPS_D_SO01_130_4310_02_Obj_C_Pudorys_1_NP.pdf` |    165,867 | `458ddee6` |
| 4320 | `185-01_DPS_D_SO01_130_4320_01_Obj_C_Pudorys_2_NP.pdf` |    183,428 | `7f8bef5a` |
| 4330 | `185-01_DPS_D_SO01_130_4330_02_Obj_C_Pudorys_3_NP.pdf` |    226,122 | `076982ce` |
| 4340 | `185-01_DPS_D_SO01_130_4340_00_Obj_C_Pudorys_strechy.pdf` |     87,209 | `5d5d187f` |
| 5300 | `185-01_DPS_D_SO01_130_5300_01_Obj_C_Rezy.pdf` |    687,659 | `93ace3c8` |
| 6300 | `185-01_DPS_D_SO01_130_6300_02_Obj_C_Pohledy.pdf` |    286,947 | `8c49215f` |
| 7310 | `185-01_DPS_D_SO01_130_7310_00_Obj_C_Vykres_podhledu_1_NP.pdf` |    179,797 | `aba46ae5` |
| 7320 | `185-01_DPS_D_SO01_130_7320_00_Obj_C_Vykres_podhledu_2_NP.pdf` |    154,808 | `d2c3dddd` |
| 7330 | `185-01_DPS_D_SO01_130_7330_00_Obj_C_Vykres_podhledu_3_NP.pdf` |    138,452 | `08921de4` |
| 9310 | `185-01_DPS_D_SO01_130_9310_00_Obj_C_Koor_vykres_1_NP.pdf` |    342,992 | `a6c81a9a` |
| 9320 | `185-01_DPS_D_SO01_130_9320_00_Obj_C_Koor_vykres_2_NP.pdf` |    367,307 | `709e4693` |
| 9321 | `185-01_DPS_D_SO01_130_9321_00_Obj_C_Koor_vyk_byt_jader_2_NP.pdf` |    444,986 | `90ba363d` |
| 9330 | `185-01_DPS_D_SO01_130_9330_00_Obj_C_Koor_vykres_3_NP.pdf` |    401,600 | `46d5f881` |


## Coverage check vs D-objekt baseline

D had 25 files: 11 DWG + 14 PDF + several extras. Codes used for D:
`4410/4420/4430/4440` (NP + střecha) + `5400` (řezy) + `6400` (pohledy)
+ `7410/7420/7430` (podhledy) + `9410/9420/9421/9430` (koordinace) +
`0000` (ARS desky) + `9421` (koor. byt jader 2.NP).

A/B/C should follow the same code structure with the second digit
shifted (`4X10..4X40` instead of `4410..4440`):

| Drawing | A code | A DWG | A PDF | B code | B DWG | B PDF | C code | C DWG | C PDF | D code | D status |
|---------|--------|:-----:|:-----:|--------|:-----:|:-----:|--------|:-----:|:-----:|--------|----------|
| Půdorys 1.NP | `4110` | ✅ | ✅ | `4210` | ✅ | ✅ | `4310` | ✅ | ✅ | `4410` | baseline |
| Půdorys 2.NP | `4120` | ✅ | ✅ | `4220` | ✅ | ✅ | `4320` | ✅ | ✅ | `4420` | baseline |
| Půdorys 3.NP | `4130` | ✅ | ✅ | `4230` | ✅ | ✅ | `4330` | ✅ | ✅ | `4430` | baseline |
| Půdorys střechy | `4140` | ✅ | ✅ | `4240` | ✅ | ✅ | `4340` | ✅ | ✅ | `4440` | baseline |
| Řezy | `5100` | ✅ | ✅ | `5200` | ✅ | ✅ | `5300` | ✅ | ✅ | `5400` | baseline |
| Pohledy | `6100` | ✅ | ✅ | `6200` | ✅ | ✅ | `6300` | ✅ | ✅ | `6400` | baseline |
| Podhledy 1.NP | `7110` | ✅ | ✅ | `7210` | ✅ | ✅ | `7310` | ✅ | ✅ | `7410` | baseline |
| Podhledy 2.NP | `7120` | ✅ | ✅ | `7220` | ✅ | ✅ | `7320` | ✅ | ✅ | `7420` | baseline |
| Podhledy 3.NP | `7130` | ✅ | ✅ | `7230` | ✅ | ✅ | `7330` | ✅ | ✅ | `7430` | baseline |
| Koor. výkres 1.NP | `9110` | ❌ | ✅ | `9210` | ❌ | ✅ | `9310` | ❌ | ✅ | `9410` | baseline |
| Koor. výkres 2.NP | `9120` | ❌ | ✅ | `9220` | ❌ | ✅ | `9320` | ❌ | ✅ | `9420` | baseline |
| Koor. byt jader 2.NP | `9121` | ❌ | ✅ | `9221` | ❌ | ✅ | `9321` | ❌ | ✅ | `9421` | baseline |
| Koor. výkres 3.NP | `9130` | ❌ | ✅ | `9230` | ❌ | ✅ | `9330` | ❌ | ✅ | `9430` | baseline |
| ARS desky | `—` | — | — | `0000` | ❌ | ✅ | `0000` | ✅ | ✅ | `—` | — ARS desky present |

### Notable observations

- **Koordinační výkresy (9110/9120/9121/9130 series)**: PDF-only across A/B/C — same as D (no DWG for these). Consistent.
- **A — ARS desky**: not present (no `_110_0000_*` files). B + C both have ARS desky DWG + PDF; D has DWG + PDF. **Gap for A — flag to ABMV**.
- **Architectural půdorysy (NP + střecha) + řezy + pohledy + podhledy**: full DWG + PDF for A, B, C — clean.
- **No 1.PP drawings** for A/B/C — expected (komplex 1.PP only under D, per `sources/shared/`).
- **No XLSX uploads** — all komplex tables are already in `sources/shared/xlsx/`. Pipeline filters per objekt at parse time.

---

## Proposed move plan (Part 3 — pending user approval)

```
test-data/                                ← 72 files at root (uploads location)
├── (71 source files)                     ← move all to sources/{A,B,C}/{dwg,pdf}/
├── TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md  ← keep at root or move to docs (user decides)
│
└── libuse/
    ├── inputs/                           ← add new symlinks for 71 A/B/C files
    │   ├── (existing 58 D + shared symlinks unchanged)
    │   └── (71 NEW symlinks pointing into sources/{A,B,C}/...)
    │
    └── sources/
        ├── A/                            ← 22 files
        │   ├── dwg/   (9 DWG)
        │   └── pdf/   (13 PDF)
        ├── B/                            ← 24 files
        │   ├── dwg/   (10 DWG)
        │   └── pdf/   (14 PDF)
        ├── C/                            ← 25 files
        │   ├── dwg/   (11 DWG)
        │   └── pdf/   (14 PDF)
        └── (D + shared unchanged)
```

**Move execution**:
- `git mv test-data/<file> test-data/libuse/sources/{A,B,C}/{dwg,pdf}/<file>` × 71
- Then create symlinks `test-data/libuse/inputs/<file>` → `../sources/{A,B,C}/{type}/<file>`
- Update `sources/A/INVENTORY.md`, `sources/B/INVENTORY.md`, `sources/C/INVENTORY.md` with full listings
- Update `sources/MASTER_INVENTORY.md` cross-objekt counts (A: 22, B: 24, C: 25 instead of 0)
- Update `sources_manifest.md` — mark `_110_/_120_/_130_` rules as VERIFIED

---

## Decisions needed before Part 3

1. **Approve auto-classification?** All 71 files at confidence 1.00, 0 mismatches.
2. **`TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md`** — move to `test-data/libuse/docs/` or leave at `test-data/` root or delete after this task is complete? (Currently it's the spec for this very Phase Π.0.0 work.)
3. **A — ARS desky gap** — note in `sources/A/INVENTORY.md` and add to ABMV email queue, or skip (if `_110_0000_*` simply doesn't exist for objekt A)?
4. **Inputs symlinks** — same approach as D (relative `../sources/...` symlinks at `test-data/libuse/inputs/`)?

---

_Generated by Claude Code Π.0.0 Part 2 sources classification, 2026-05-06._