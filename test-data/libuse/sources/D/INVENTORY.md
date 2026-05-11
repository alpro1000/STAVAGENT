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

---

## Drop v2 addendum (2026-05-10) — PROBE 9 koordinační + per-discipline TZB

24 new DWGs landed in `dwg/` from the 2026-05-10 user drop (commit
`8cbb8eae` on main). Sources:
- 3 koord overlay DWGs extracted from ZIPs (`_140_9410/9420/9430`)
- 18 per-discipline TZB DWGs extracted from same ZIPs (chl/kan/sil/slb/vod/vzt × 1.NP/2.NP/3.NP)
- 3 architectural xref DWGs extracted from same ZIPs (`UDL_NNP_D`)

3 original ZIPs archived to `_archives/` (provenance retained).

### `dwg/` additions (24 files, sorted by code/discipline)

| File | Size | SHA-256 (8) |
|------|----:|:-----------|
| `18501_DPS_D_SO01_140_9410_R00_koordinacni vykres 1NP.dwg` |  1,432,858 | `33aabecc` |
| `18501_DPS_D_SO01_140_9420_R00_koordinacni vykres 2NP.dwg` |  1,424,498 | `6c0fb16f` |
| `18501_DPS_D_SO01_140_9430_R00_koordinacni vykres 3NP.dwg` |  1,426,757 | `c851812b` |
| `D_1NP_chl.dwg` |  1,024,407 | `5241c7a7` |
| `D_1NP_kan.dwg` |    102,806 | `335f7a9d` |
| `D_1NP_sil.dwg` |    226,066 | `455c716b` |
| `D_1NP_slb.dwg` |     78,210 | `4587bfc4` |
| `D_1NP_vod.dwg` |    113,971 | `8a6db917` |
| `D_1NP_vzt.dwg` |    180,629 | `4549f891` |
| `D_2NP_chl.dwg` |    972,446 | `84478866` |
| `D_2NP_kan.dwg` |     94,171 | `44e79a48` |
| `D_2NP_sil.dwg` |    220,637 | `0e5a35df` |
| `D_2NP_slb.dwg` |     73,580 | `b36df44c` |
| `D_2NP_vod.dwg` |    125,309 | `df4556e9` |
| `D_2NP_vzt.dwg` |    184,022 | `1830f2fd` |
| `D_3NP_chl.dwg` |    966,792 | `689f9e9b` |
| `D_3NP_kan.dwg` |    102,142 | `ae17f0bb` |
| `D_3NP_sil.dwg` |    219,049 | `90fd409e` |
| `D_3NP_slb.dwg` |     65,626 | `232bcb08` |
| `D_3NP_vod.dwg` |    115,797 | `958e90c9` |
| `D_3NP_vzt.dwg` |    172,676 | `fb83a833` |
| `UDL_1NP_D.dwg` |    136,819 | `23b159b0` |
| `UDL_2NP_D.dwg` |    158,047 | `17ae214c` |
| `UDL_3NP_D.dwg` |    166,561 | `34c4b9cf` |

### `_archives/` additions (3 files — original ZIPs)

| File | Size |
|------|----:|
| `18501_DPS_D_SO01_140_9410_R00_koordinacni vykres D 1NP.zip` |  2,547,586 |
| `18501_DPS_D_SO01_140_9420_R00_koordinacni vykres D 2NP.zip` |  2,516,930 |
| `18501_DPS_D_SO01_140_9430_R00_koordinacni vykres D 3NP.zip` |  2,516,322 |

### DXF conversion outcome

- 21 of 24 new DWGs converted cleanly to DXF (LibreDWG dwg2dxf)
- **3 chlazení DWGs failed** (`D_1NP_chl.dwg`, `D_2NP_chl.dwg`,
  `D_3NP_chl.dwg`) — LibreDWG produced truncated DXFs with unresolved
  object handles; ezdxf rejected with DXFStructureError.
- Corrupt chl DXFs removed from `dxf/` to prevent Π.0a crashes.
  Cooling discipline NOT covered by this drop's PROBE 9 baseline; see
  `test-data/libuse/outputs/dwg_conversion_log.md` for full failure
  log + mitigation paths (Teigha File Converter / ABMV re-export).

### Coverage matrix update — D koord drawings

| Code | Description | D DWG (was) | D DWG (now) | D PDF |
|------|------------|:-----------:|:-----------:|:-----:|
| 9410 | OBJEKT D — Koor. výkres 1.NP | ❌ (PDF only) | **✅** | ✅ |
| 9420 | OBJEKT D — Koor. výkres 2.NP | ❌ (PDF only) | **✅** | ✅ |
| 9430 | OBJEKT D — Koor. výkres 3.NP | ❌ (PDF only) | **✅** | ✅ |

PROBE 9 prostupy + štroby quantification gap closed — see
`probe_9_source_audit.md` and forthcoming
`probe_9_full_audit_per_section.md`.
