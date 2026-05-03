# DWG → DXF conversion log — Phase 0.5 batch

**Date:** 2026-05-03  
**Session:** 4 (Phase 0.5 batch convert)  
**Backend:** `libredwg` (LibreDWG `dwg2dxf` 0.13.4)  
**Source:** `test-data/libuse/inputs/dwg/`  
**Target:** `test-data/libuse/inputs/dxf/`  

## Summary

- Total DWG: **14**
- Converted OK: **14**
- Failed: **0**
- Skipped: **0**
- Total wall time: **7471 ms** (7.47 s)

## Per-file log

| # | DWG filename | Status | DXF size (bytes) | Duration (ms) | Stderr tail |
|---|------|------|------|-----:|------|
| 1 | `185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dwg` | ok | 4,967,381 | 183 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 2 | `185-01_DPS_D_SO01_100_4040_R00 - odvodneni teras.dwg` | ok | 89,042,449 | 2113 | Warning: Unstable Class object 776 ACDB_ALDIMOBJECTCONTEXTDATA_CLASS (0x481) 15272/B6C18<br>Warning: Unstable Class object 776 ACDB_ALDIMOBJECTCONTEXTDATA_CLASS (0x481) 15287/B6C27… |
| 3 | `185-01_DPS_D_SO01_100_5000_R01 - ŘEZY 1-PP.dwg` | ok | 4,915,939 | 124 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 4 | `185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg` | ok | 3,083,191 | 85 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 5 | `185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP.dwg` | ok | 3,404,252 | 83 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 6 | `185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP.dwg` | ok | 3,370,356 | 78 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 7 | `185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha.dwg` | ok | 1,159,322 | 27 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 8 | `185-01_DPS_D_SO01_140_5400_R01 - OBJEKT D - ŘEZY.dwg` | ok | 6,441,699 | 168 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 9 | `185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY.dwg` | ok | 4,686,600 | 110 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 10 | `185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP.dwg` | ok | 2,138,652 | 56 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 11 | `185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. NP.dwg` | ok | 2,150,047 | 52 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 12 | `185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. NP.dwg` | ok | 2,353,898 | 56 | Warning: Unstable Class object 501 MATERIAL (0x481) 14/11<br>Warning: Unstable Class object 501 MATERIAL (0x481) 22/19<br>Warning: Unstable Class object 501 MATERIAL (0x481) 30/21<… |
| 13 | `185-01_DPS_D_SO01_140_ARS objekt D_desky.dwg` | ok | 134,530,564 | 3220 | Warning: Unstable Class object 790 ACDBASSOCVERTEXACTIONPARAM (0x401) 812/14CD7<br>Warning: Unstable Class object 790 ACDBASSOCVERTEXACTIONPARAM (0x401) 813/14CD8<br>Warning: Unsta… |
| 14 | `18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` | ok | 47,587,157 | 1116 | Warning: Unknown object, skipping eed/reactors/xdic<br>Warning: Unknown object, skipping eed/reactors/xdic<br>Warning: Unknown object, skipping eed/reactors/xdic<br>Warning: Unknow… |

## Notes

- libredwg prints non-fatal `Warning:` lines to stderr even on success (`Object handle not found`, `Unstable Class object MATERIAL/MLEADERSTYLE`, `Unhandled Object TABLESTYLE`). These are typical for AC2018+ DWG content and do not indicate data loss for our use case (room polygons + TEXT + INSERT).
- DXF files inherit the DWG version (`AC1027` / AutoCAD 2013) since libredwg preserves the source spec. ezdxf 1.4.3 reads them natively.