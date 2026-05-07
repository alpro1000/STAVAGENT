# Sources Manifest — Libuše objekt D (Π.0.0 sorting plan)

Read-only classification of all 58 source files in
`test-data/libuse/inputs/` for the proposed sorted layout under
`test-data/libuse/sources/{A,B,C,D,shared}/{dwg,pdf,xlsx,docx,other}/`.

**STOP for user review** — no files moved until manifest approved.

---

## Summary

- **Total files**: 58
- **Auto-classified (confidence ≥ 0.9)**: 58
- **Flagged for review (confidence < 0.7)**: 0
- **Exact-content duplicates (same SHA-256)**: 0
- **Dual-format pairs (same drawing/table, different ext)**: 20 groups — recommended action: **KEEP BOTH** (DWG = editable parser source; PDF = rendered visual reference; XLSX = data; PDF tables = visual)

**Distribution**:
- shared: 33
- D: 25
- A: 22
- B: 24
- C: 25
- UNKNOWN: 0

**Π.0.0 Part 2 update (2026-05-07)**: A / B / C uploads received from
ABMV (71 files at `test-data/<flat>` → moved to `sources/{A,B,C}/`).
See `abc_classification_manifest.md` for the Part-2 classification log.

---

## Classification rules (auto-applied) — VERIFIED

| Pattern | Target | Confidence | Rationale |
|---------|--------|-----------:|-----------|
| Filename contains `_100_` | `shared/` | 0.97 | Architectural section 100 = komplex-wide. Verified: Tabulka 0020 mistnosti has 935 rows covering A + B + C + D + S.A + S.B + S.C + S.D rooms. |
| Filename contains `_110_` | `A/` | 1.00 | Architectural section 110 = A-specific. **VERIFIED Π.0.0 Part 2**: 22 ABMV-uploaded files all contain `OBJEKT A` / `Obj_A_` text. |
| Filename contains `_120_` | `B/` | 1.00 | Architectural section 120 = B-specific. **VERIFIED Π.0.0 Part 2**: 24 ABMV-uploaded files all contain `OBJEKT B` / `Obj_B_` text. |
| Filename contains `_130_` | `C/` | 1.00 | Architectural section 130 = C-specific. **VERIFIED Π.0.0 Part 2**: 25 ABMV-uploaded files all contain `OBJEKT C` / `Obj_C_` text. |
| Filename contains `_140_` | `D/` | 0.99 | Architectural section 140 = D-specific. All DWG files in this group explicitly named 'OBJEKT D'. |
| `Vykaz_vymer_stary.xlsx` | `shared/` | 0.95 | Komplex bill-of-quantities — 30 sheets covering all trades (architecture, ZTI, HVAC, electrical) for whole komplex. Pipeline filters to D-scope at parse time. |

---

## Per-objekt classification

### `sources/shared/` — komplex-wide files (33)

#### `sources/shared/dwg/` (3)

| File | Size | SHA-256 (8) | Conf |
|------|----:|:-----------|----:|
| `dwg/185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dwg` |    679,636 | `0d179a3e` | 0.97 |
| `dwg/185-01_DPS_D_SO01_100_4040_R00 - odvodneni teras.dwg` |  2,926,873 | `d690593f` | 0.97 |
| `dwg/185-01_DPS_D_SO01_100_5000_R01 - ŘEZY 1-PP.dwg` |    704,940 | `8c294d96` | 0.97 |

#### `sources/shared/pdf/` (19)

| File | Size | SHA-256 (8) | Conf |
|------|----:|:-----------|----:|
| `pdf/185-01_DPS_D_SO01_100_0000_01_Titulka.pdf` |    672,726 | `1dfd742c` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0010_01_Technicka_zprava.pdf` |    944,059 | `e240cf05` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0011_00_Radonovy posudek.pdf` |  1,287,278 | `71f564c3` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0020_01_Tabulka_mistnosti.pdf` |    621,137 | `bb222b48` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0030_01_Tabulka_specifikace_skladeb_a_povrchu.pdf` |    687,572 | `3201299f` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0040_00_Tabulka_vyplneni_otvoru.pdf` |  1,777,792 | `fa1fad00` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0050_01_Tabulka_zamecnickych_prvku.pdf` |  1,004,757 | `e2c24a60` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0060_01_Tabulka_klempirskych_prvku.pdf` |  1,186,365 | `66c84f95` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0070_01_Tabulka_prekladu.pdf` |    790,555 | `0ff17d25` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_0080_02_Tabulka_ostatnich prvku.pdf` |    677,714 | `da746ed9` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_4010_00_Pudorys_vykopu.pdf` |  1,563,431 | `8b46439a` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_4020_00_Podkladni_betony.pdf` |  1,449,466 | `225b8a15` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_4030_01_Pudorys_1_PP.pdf` |    696,461 | `5d00dbee` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_4040_01_Odvodneni teras.pdf` |  1,446,168 | `800f7504` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_5000_01_Rezy_1_PP.pdf` |    409,015 | `188e217e` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_8030_01_Kniha_detailu.pdf` | 23,420,917 | `f41c58a5` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_8050_00_Zasady_sparorezu.pdf` |    621,219 | `37938727` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_9000_00_Pudorys_1_PP_koor_vykres_cast_A.pdf` |    835,385 | `b98a3b17` | 0.97 |
| `pdf/185-01_DPS_D_SO01_100_9001_00_Pudorys_1_PP_koor_vykres_cast_B.pdf` |    599,345 | `5f5b744f` | 0.97 |

#### `sources/shared/xlsx/` (10)

| File | Size | SHA-256 (8) | Conf |
|------|----:|:-----------|----:|
| `185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx` |    104,118 | `58b82906` | 0.97 |
| `185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx` |     89,673 | `b162b152` | 0.97 |
| `185-01_DPS_D_SO01_100_0041_TABULKA DVERI.xlsx` |    122,033 | `7a5531a9` | 0.97 |
| `185-01_DPS_D_SO01_100_0042_TABULKA OKEN.xlsx` |    272,175 | `56212176` | 0.97 |
| `185-01_DPS_D_SO01_100_0043_TABULKA PROSKLENYCH PRICEK.xlsx` |    221,479 | `b254dde2` | 0.97 |
| `185-01_DPS_D_SO01_100_0050_R01_TABULKA ZAMECNICKYCH VYROBKU.xlsx` |    222,597 | `de9cec7d` | 0.97 |
| `185-01_DPS_D_SO01_100_0060_R01_TABULKA KLEMPIRSKYCH PRVKU.xlsx` |    218,525 | `0c7b05f9` | 0.97 |
| `185-01_DPS_D_SO01_100_0070_R01_TABULKA PREKLADU.xlsx` |     47,539 | `e1102c93` | 0.97 |
| `185-01_DPS_D_SO01_100_0080_R02 - TABULKA OSTATNICH PRVKU.xlsx` |    237,899 | `c3e8b713` | 0.97 |
| `Vykaz_vymer_stary.xlsx` |    984,980 | `debf028a` | 0.95 |

#### `sources/shared/docx/` (1)

| File | Size | SHA-256 (8) | Conf |
|------|----:|:-----------|----:|
| `185-01_DPS_D_SO01_100_0010_R01-TZ.docx` |     94,265 | `13f767f9` | 0.97 |

### `sources/D/` — D-specific files (25)

#### `sources/D/dwg/` (11)

| File | Size | SHA-256 (8) | Conf |
|------|----:|:-----------|----:|
| `dwg/185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg` |    371,815 | `b6d47c5b` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP.dwg` |    403,996 | `c6a40a22` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP.dwg` |    415,067 | `535ee852` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha.dwg` |    154,008 | `5877ce7f` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_5400_R01 - OBJEKT D - ŘEZY.dwg` |    900,297 | `347c6d06` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY.dwg` |    707,450 | `74210088` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP.dwg` |    287,269 | `c7d2bc07` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. NP.dwg` |    274,399 | `38a4210b` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. NP.dwg` |    301,935 | `87fbc042` | 0.99 |
| `dwg/185-01_DPS_D_SO01_140_ARS objekt D_desky.dwg` |  4,301,330 | `2df5ec0a` | 0.99 |
| `dwg/18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` |  1,539,557 | `f0f52075` | 0.99 |

#### `sources/D/pdf/` (14)

| File | Size | SHA-256 (8) | Conf |
|------|----:|:-----------|----:|
| `pdf/185-01_DPS_D_SO01_140_0000_01_ARS_objekt_D_desky.pdf` |    672,994 | `7c38217f` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_4410_00_Obj_D_Pudorys_1_NP.pdf` |    186,428 | `271d7fe4` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_4420_01_Obj_D_Pudorys_2_NP.pdf` |    233,611 | `3c957960` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_4430_01_Obj_D_Pudorys_3_NP.pdf` |    266,055 | `afbd667d` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_4440_00_Obj_D_Pudorys_strecha.pdf` |     91,499 | `eee5c9ab` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_5400_01_Obj_D_Rezy.pdf` |    788,014 | `4f02a6a5` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_6400_01_Obj_D_Pohledy.pdf` |    307,411 | `b929a035` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_7410_00_Obj_D_Vykres_podhledu_1_NP.pdf` |    196,426 | `9c213c2e` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_7420_00_Obj_D_Vykres_podhledu_2_NP.pdf` |    148,370 | `f9b2262e` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_7430_00_Obj_D_Vykres_podhledu_3_NP.pdf` |    144,040 | `8ce26104` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_9410_00_Obj_D_Koor_vykres_1_NP.pdf` |    399,631 | `79ec8eba` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_9420_00_Obj_D_Koor_vykres_2_NP.pdf` |    415,409 | `daf6b32a` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_9421_00_Obj_D_Koor_vyk_byt_jader_2_NP.pdf` |    639,598 | `b9203b3e` | 0.99 |
| `pdf/185-01_DPS_D_SO01_140_9430_00_Obj_D_Koor_vykres_3_NP.pdf` |    425,948 | `9bd3efc4` | 0.99 |

### `sources/A/`, `sources/B/`, `sources/C/` — all empty

No files match. ABMV must supply per objekt:
- DWG: `_140_4410..4440` (1.NP / 2.NP / 3.NP / střecha půdorys)
- DWG: `_140_5400` (řezy)
- DWG: `_140_6400` (pohledy)
- DWG: `_140_7410..7430` (podhledy 1.NP / 2.NP / 3.NP)
- DWG: `_140_9410..9430` (koordinace)
- PDF equivalents of all DWG drawings
- (Tabulky 0020/0030/0041/0042/0043 etc. are komplex-wide — already in `sources/shared/`)

---

## Dual-format pairs (20 groups) — recommended action: KEEP BOTH

These pairs share the same drawing or table number but in different
formats. **Not duplicates** — DWG is the editable parser source, PDF is
the rendered visual reference; XLSX is parseable data, PDF tables are
visual cross-check. Default: keep both within the same objekt folder,
separated by ext-subdir.

| Code | Description | Formats | Action |
|------|------------|---------|--------|
| 0010 | TZ — Technická zpráva | .docx + .pdf | keep both — editable + rendered |
| 0020 | Tabulka místností (rooms) | .xlsx + .pdf | keep both — data + visual |
| 0030 | Tabulka skladeb a povrchu | .xlsx + .pdf | keep both |
| 0050 | Tabulka zámečnických výrobků | .xlsx + .pdf | keep both |
| 0060 | Tabulka klempířských prvků | .xlsx + .pdf | keep both |
| 0070 | Tabulka překladů | .xlsx + .pdf | keep both |
| 0080 | Tabulka ostatních prvků | .xlsx + .pdf | keep both |
| 4030 | Půdorys 1.PP | .dwg + .pdf | keep both — DWG for parser |
| 4040 | Odvodnění teras | .dwg + .pdf | keep both — currently DWG skipped by parser |
| 4410 | OBJEKT D — Půdorys 1.NP | .dwg + .pdf | keep both |
| 4420 | OBJEKT D — Půdorys 2.NP | .dwg + .pdf | keep both |
| 4430 | OBJEKT D — Půdorys 3.NP | .dwg + .pdf | keep both |
| 4440 | OBJEKT D — Půdorys střecha | .dwg + .pdf | keep both |
| 5000 | Řezy 1.PP | .dwg + .pdf | keep both |
| 5400 | OBJEKT D — Řezy | .dwg + .pdf | keep both |
| 6400 | OBJEKT D — Pohledy | .dwg + .pdf | keep both |
| 7410 | OBJEKT D — Podhledy 1.NP | .dwg + .pdf | keep both |
| 7420 | OBJEKT D — Podhledy 2.NP | .dwg + .pdf | keep both |
| 7430 | OBJEKT D — Podhledy 3.NP | .dwg + .pdf | keep both |
| 9421 | OBJEKT D — Koor. byt jader 2.NP | .dwg + .pdf | keep both |

---

## PDF-only sources (no DWG counterpart)

Files where only PDF exists (no editable DWG). OCR / manual-
transcribe path only:

| Code | File | Size | Target | Notes |
|------|------|----:|--------|-------|
| 0000 | `pdf/185-01_DPS_D_SO01_100_0000_01_Titulka.pdf` |    672,726 | shared | Titulka / ARS desky cover sheets — info-only, no parser need |
| 0000 | `pdf/185-01_DPS_D_SO01_140_0000_01_ARS_objekt_D_desky.pdf` |    672,994 | D | Titulka / ARS desky cover sheets — info-only, no parser need |
| 0011 | `pdf/185-01_DPS_D_SO01_100_0011_00_Radonovy posudek.pdf` |  1,287,278 | shared | Radonový posudek — single document, PDF-only |
| 0040 | `pdf/185-01_DPS_D_SO01_100_0040_00_Tabulka_vyplneni_otvoru.pdf` |  1,777,792 | shared | Tabulka výplňování otvorů — PDF-only (vs separate XLSX 0041 doors / 0042 windows / 0043 glass partitions) |
| 4010 | `pdf/185-01_DPS_D_SO01_100_4010_00_Pudorys_vykopu.pdf` |  1,563,431 | shared | Půdorys výkopu — earthworks, no editable source |
| 4020 | `pdf/185-01_DPS_D_SO01_100_4020_00_Podkladni_betony.pdf` |  1,449,466 | shared | Podkladní betony — foundations, no editable source |
| 8030 | `pdf/185-01_DPS_D_SO01_100_8030_01_Kniha_detailu.pdf` | 23,420,917 | shared | Kniha detailů — detail catalog, PDF-only |
| 8050 | `pdf/185-01_DPS_D_SO01_100_8050_00_Zasady_sparorezu.pdf` |    621,219 | shared | Zásady spárořezu — joint-cutting principles, PDF-only |
| 9000 | `pdf/185-01_DPS_D_SO01_100_9000_00_Pudorys_1_PP_koor_vykres_cast_A.pdf` |    835,385 | shared | 1.PP koor. výkres část A — komplex coordination, PDF-only |
| 9001 | `pdf/185-01_DPS_D_SO01_100_9001_00_Pudorys_1_PP_koor_vykres_cast_B.pdf` |    599,345 | shared | 1.PP koor. výkres část B — komplex coordination, PDF-only |
| 9410 | `pdf/185-01_DPS_D_SO01_140_9410_00_Obj_D_Koor_vykres_1_NP.pdf` |    399,631 | D | OBJEKT D — Koor. výkres 1.NP — PDF-only |
| 9420 | `pdf/185-01_DPS_D_SO01_140_9420_00_Obj_D_Koor_vykres_2_NP.pdf` |    415,409 | D | OBJEKT D — Koor. výkres 2.NP — PDF-only |
| 9430 | `pdf/185-01_DPS_D_SO01_140_9430_00_Obj_D_Koor_vykres_3_NP.pdf` |    425,948 | D | OBJEKT D — Koor. výkres 3.NP — PDF-only |

---

## Proposed move plan (Part 3 — pending user approval)

```
test-data/libuse/
├── inputs/                    ← will be emptied
│   ├── (top-level .xlsx + .docx → sources/shared/{xlsx,docx}/)
│   ├── dwg/                   ← contents move out, dir kept w/ .gitkeep
│   ├── pdf/                   ← contents move out, dir kept w/ .gitkeep
│   └── dxf/.gitkeep           ← stays
│
├── sources/                   ← NEW canonical layout
│   ├── A/{dwg,pdf,xlsx,docx}/ ← empty placeholders + .gitkeep
│   ├── B/{dwg,pdf,xlsx,docx}/ ← empty placeholders + .gitkeep
│   ├── C/{dwg,pdf,xlsx,docx}/ ← empty placeholders + .gitkeep
│   ├── D/                     ← 25 files
│   │   ├── dwg/  (10 DWG)
│   │   └── pdf/  (15 PDF)
│   ├── shared/                ← 33 files
│   │   ├── dwg/  (4 DWG: 1.PP půdorys + řezy + drainage + …)
│   │   ├── pdf/  (17 PDF: titulka / TZ / radon / tabulky / koor)
│   │   ├── xlsx/ (10 XLSX: 9 tabulky + Vykaz_vymer_stary)
│   │   └── docx/ (1 DOCX: TZ)
│   └── MASTER_INVENTORY.md
│
└── outputs/                   ← unchanged (pipeline products)
```

**Move execution rules** (Part 3):

- Use `git mv` for tracked files to preserve history.
- Use `cp` + `git rm` for files not under git (verify with `git ls-files`).
- Keep `inputs/{dwg,pdf,dxf}/.gitkeep` so existing pipeline scripts that
  hardcode `test-data/libuse/inputs/...` paths fail loud (instead of
  silently reading from new location). Π.0a will rewrite paths to
  `sources/{objekt}/...`.
- Generate per-objekt `INVENTORY.md` after move.
- Single commit `Phase Π.0.0: source files sorted to objekt folders (58
  files, 58/58 high-confidence auto-classified)`.

---

## Pipeline coupling — what breaks on move

Phase scripts in `concrete-agent/packages/core-backend/scripts/` hardcode
paths like `test-data/libuse/inputs/dwg/...` and
`test-data/libuse/inputs/185-01_DPS_D_SO01_100_0020_*.xlsx`. **Moving
files breaks those scripts immediately.**

This is **intentional** for Π.0.0 — it forces all extraction to flow
through the upcoming Π.0a unified extractor, which reads the new layout.
**Do not move until Π.0a + downstream rewires are ready, or be prepared
to keep pipeline broken until they are.**

Recommended ordering options:

1. **Move now, accept short pipeline outage**: re-runs of Phase 0.x will
   fail until path constants update. Acceptable if PR #1066 deliverable
   is locked and no D-side re-runs are planned.
2. **Symlink mode**: keep current `inputs/` structure as symlinks pointing
   into `sources/`. Both sets of scripts work simultaneously. Slightly
   messy but lowest-risk.
3. **Defer move to Π.0a deployment**: keep `inputs/` as-is until Π.0a is
   built + tested + cuts over. Low risk, high coupling stays.

---

## Decisions needed before Part 3 (move execution)

1. **Approve auto-classification?** All 58 files at confidence ≥ 0.95 —
   no NEEDS_REVIEW items. Sanity-check the 33 `shared` + 25 `D` split.
2. **Dual-format pairs — confirm 'keep both'?** All 20 groups recommended
   keep-both. Alternative: drop PDF-rendered tables (0020/0030/0050/0060/
   0070/0080) since XLSX is canonical (~5 MB saved).
3. **Pipeline coupling** — pick ordering option 1 / 2 / 3 above.
4. **Empty A / B / C placeholder dirs?** Create now (with `.gitkeep`) so
   ABMV upload-target paths exist, or wait until ABMV supplies?
5. **PDF-only files** — split between `D/` and `shared/` per `_100_` /
   `_140_` rule, or co-locate all into `sources/shared/pdf/reference/`?

---

_Generated by Claude Code Π.0.0 Part 1 sources classification, 2026-05-06._