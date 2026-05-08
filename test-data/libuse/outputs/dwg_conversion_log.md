# DWG → DXF conversion log — Phase 0.5 batch

**Date:** 2026-05-08 18:39 UTC
**Backend:** LibreDWG `dwg2dxf` (via `scripts/infrastructure/`)
**Source:** `test-data/libuse/sources/<bucket>/dwg/`
**Target:** `test-data/libuse/sources/<bucket>/dxf/`

## Summary

| Bucket | Total | Converted | Skipped | Failed | Wall time (ms) |
|--------|------:|----------:|--------:|-------:|---------------:|
| `A` | 9 | 9 | 0 | 0 | 3013 |
| `B` | 10 | 10 | 0 | 0 | 6282 |
| `C` | 11 | 11 | 0 | 0 | 10978 |
| `D` | 11 | 11 | 0 | 0 | 7812 |
| `shared` | 3 | 3 | 0 | 0 | 3770 |
| **TOTAL** | **44** | **44** | **0** | **0** | **31855** |

## Per-file log

| Bucket | DWG filename | Status | DXF size (bytes) | Duration (ms) |
|--------|------|--------|--------:|--------:|
| A | `185-01_DPS_D_SO01_110_4110_00-OBJEKT A - Půdorys 1. NP.dwg` | converted | 2,356,658 | 1608 |
| A | `185-01_DPS_D_SO01_110_4120_02 - OBJEKT A - Půdorys 2- NP.dwg` | converted | 3,298,866 | 159 |
| A | `185-01_DPS_D_SO01_110_4130_R01 - OBJEKT A - Půdorys 3. NP.dwg` | converted | 3,886,075 | 163 |
| A | `185-01_DPS_D_SO01_110_4140_00-OBJEKT A - Půdorys střechy.dwg` | converted | 1,097,455 | 36 |
| A | `185-01_DPS_D_SO01_110_5100_R01 - OBJEKT A - ŘEZY.dwg` | converted | 6,076,158 | 470 |
| A | `185-01_DPS_D_SO01_110_6100_00_OBJEKT A - POHLEDY.dwg` | converted | 4,858,440 | 356 |
| A | `185-01_DPS_D_SO01_110_7110_00-OBJEKT A - Výkres podhledů 1. NP.dwg` | converted | 1,700,267 | 51 |
| A | `185-01_DPS_D_SO01_110_7120_00-OBJEKT A - Výkres podhledů 2. NP.dwg` | converted | 2,164,455 | 64 |
| A | `185-01_DPS_D_SO01_110_7130_00-OBJEKT A - Výkres podhledů 3. NP.dwg` | converted | 2,074,082 | 98 |
| B | `185-01_DPS_D_SO01_120_4210_00-OBJEKT B - Půdorys 1. NP.dwg` | converted | 3,165,620 | 200 |
| B | `185-01_DPS_D_SO01_120_4220_R01 - OBJEKT B - Půdorys 2. NP.dwg` | converted | 3,599,838 | 109 |
| B | `185-01_DPS_D_SO01_120_4230_R01 - OBJEKT B - Půdorys 3. NP.dwg` | converted | 2,831,329 | 92 |
| B | `185-01_DPS_D_SO01_120_4240_00-OBJEKT B - Půdorys střecha.dwg` | converted | 1,233,578 | 39 |
| B | `185-01_DPS_D_SO01_120_5200_R01 - OBJEKT B - ŘEZY.dwg` | converted | 5,273,876 | 332 |
| B | `185-01_DPS_D_SO01_120_6200_00_OBJEKT B - POHLEDY.dwg` | converted | 4,560,170 | 213 |
| B | `185-01_DPS_D_SO01_120_7210_00-OBJEKT B - Výkres podhledů 1. NP.dwg` | converted | 2,308,427 | 71 |
| B | `185-01_DPS_D_SO01_120_7220_00-OBJEKT B - Výkres podhledů 2. NP.dwg` | converted | 2,207,099 | 66 |
| B | `185-01_DPS_D_SO01_120_7230_00-OBJEKT B - Výkres podhledů 3. NP.dwg` | converted | 1,825,226 | 56 |
| B | `185-01_DPS_D_SO01_120_ARS objekt B_desky.dwg` | converted | 134,531,314 | 5098 |
| C | `185-01_DPS_D_SO01_130_0000_R01_ARS objekt C_desky.dwg` | converted | 134,532,063 | 4905 |
| C | `185-01_DPS_D_SO01_130_4310_02 - OBJEKT C - Půdorys 1- NP.dwg` | converted | 2,553,492 | 81 |
| C | `185-01_DPS_D_SO01_130_4320_R01 - OBJEKT C - Půdorys 2. NP.dwg` | converted | 2,787,054 | 87 |
| C | `185-01_DPS_D_SO01_130_4330_02 - OBJEKT C - Půdorys 3- NP.dwg` | converted | 2,890,783 | 130 |
| C | `185-01_DPS_D_SO01_130_4340_00-OBJEKT C - Půdorys střechy.dwg` | converted | 977,003 | 33 |
| C | `185-01_DPS_D_SO01_130_5300_R01 - OBJEKT C - ŘEZY.dwg` | converted | 5,862,484 | 194 |
| C | `185-01_DPS_D_SO01_130_6300_02 - OBJEKT C - Pohledy.dwg` | converted | 4,302,845 | 273 |
| C | `185-01_DPS_D_SO01_130_7310_00-OBJEKT C - Výkres podhledů 1. NP.dwg` | converted | 1,979,168 | 61 |
| C | `185-01_DPS_D_SO01_130_7320_00-OBJEKT C - Výkres podhledů 2. NP.dwg` | converted | 2,045,435 | 61 |
| C | `185-01_DPS_D_SO01_130_7330_00-OBJEKT C - Výkres podhledů 3. NP.dwg` | converted | 2,050,950 | 62 |
| C | `185-01_DPS_D_SO01_130_ARS objekt C_desky.dwg` | converted | 134,531,374 | 5083 |
| D | `185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg` | converted | 3,101,988 | 203 |
| D | `185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP.dwg` | converted | 3,423,400 | 174 |
| D | `185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP.dwg` | converted | 3,388,529 | 101 |
| D | `185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha.dwg` | converted | 1,163,871 | 37 |
| D | `185-01_DPS_D_SO01_140_5400_R01 - OBJEKT D - ŘEZY.dwg` | converted | 6,476,642 | 314 |
| D | `185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY.dwg` | converted | 4,715,849 | 191 |
| D | `185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP.dwg` | converted | 2,151,625 | 66 |
| D | `185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. NP.dwg` | converted | 2,162,604 | 69 |
| D | `185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. NP.dwg` | converted | 2,366,247 | 73 |
| D | `185-01_DPS_D_SO01_140_ARS objekt D_desky.dwg` | converted | 134,531,302 | 5048 |
| D | `18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` | converted | 47,597,774 | 1530 |
| shared | `185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dwg` | converted | 4,995,863 | 304 |
| shared | `185-01_DPS_D_SO01_100_4040_R00 - odvodneni teras.dwg` | converted | 89,050,420 | 3159 |
| shared | `185-01_DPS_D_SO01_100_5000_R01 - ŘEZY 1-PP.dwg` | converted | 4,942,653 | 306 |

---

_Generated by `phase_0_5_batch_convert.py`._