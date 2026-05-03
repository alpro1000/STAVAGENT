# Phase 0.5 PoC — DWG → DXF readiness

**Status:** ✅ **PASSED** (Session 3, 2026-05-03 — libredwg from source)
**Backend:** LibreDWG `dwg2dxf` 0.13.4 (commit `e3774bd`)
**Updated:** 2026-05-03

## Build provenance

| Item | Value |
|------|-------|
| Source repo | https://github.com/LibreDWG/libredwg |
| Tag / commit | `0.13.4` / `e3774bd4020fcfebb68150361db74b8b34d170fe` |
| Configure flags | `--enable-trace --disable-bindings` |
| Build host | Ubuntu 24.04.4 LTS noble, gcc 13.3.0, 4 cores |
| Install prefix | `/usr/local` (binary at `/usr/local/bin/dwg2dxf`) |
| Build deps installed via apt | `build-essential autoconf automake libtool swig perl pkg-config texinfo gettext python3-dev autoconf-archive` |
| Submodule pulled by `autogen.sh` | `jsmn` (zserge/jsmn @ `85695f3d`) |
| Build time | ~4 min on 4-core VM |

## Conversion test

| Input | `test-data/libuse/inputs/dwg/185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg` |
| Source format | DWG AutoDesk AutoCAD 2013-2017 (per `file`) |
| Output | `/tmp/dxf_test/test.dxf` |
| Output DXF version | `AC1027` (AutoCAD 2013) |
| Exit code | 0 |
| Duration (CLI) | <1s wall clock |
| Duration (Python wrapper) | 78 ms |
| Output size | 3,083,191 bytes (3.0 MB), 407,216 lines |
| Stderr noise | non-fatal `Warning: Object handle not found …`, `Unstable Class object MATERIAL/MLEADERSTYLE`, `Unhandled Object TABLESTYLE` — typical libredwg output for AutoCAD 2018+ files; does not block DXF output |

## ezdxf cross-check

```
DXF version: AC1027
Layers count: 58
Layers (first 20): ['0', 'A-WALL-____-OTLN', 'I-WALL-____-OTLN',
  'A-DOOR-____-OTLN', 'A-GLAZ-____-OTLN', 'S-STRS-____-OTLN',
  'A-FLOR-HRAL-OTLN', 'P-SANR-FIXT-OTLN', 'E-ELEC-FIXT-OTLN',
  'Q-SPCQ-____-OTLN', 'I-FURN-____-OTLN', 'Q-CASE-____-OTLN',
  'A-FLOR-____-OTLN', 'A-GENM-____-OTLN', 'A-GLAZ-CURT-OTLN',
  'A-GLAZ-CWMG-OTLN', 'M-HVAC-DUCT-OTLN', 'A-DETL-____-OTLN',
  'A-AREA-____-OTLN', 'A-DETL-GENF-OTLN']
TEXT entities: 560
INSERT entities: 399
POLYLINE entities: 21
```

Layer naming follows AIA CAD layer guidelines (`<DISCIPLINE>-<MAJOR>-<MINOR>-<MODIFIER>`).
Discipline prefixes detected:
- `A-` Architectural (WALL, DOOR, GLAZ, FLOR, GENM, DETL, AREA)
- `I-` Interior (WALL, FURN)
- `S-` Structural (STRS)
- `P-` Plumbing (SANR)
- `M-` Mechanical (HVAC)
- `E-` Electrical (ELEC)
- `Q-` Equipment (SPCQ, CASE)

Means Phase 1 layer-based classification can lean on the prefix without an
explicit user-defined naming convention from the projektant.

## Room-code regex match

Spec regex `[A-D]\.\d\.\d\.\d{2}` matched **18 codes** in this single půdorys:

```
D.1.1.01, D.1.1.02, D.1.1.03, D.1.1.04,
D.1.2.01, D.1.2.02, D.1.2.03, D.1.2.04,
D.1.3.01,                 ← spec edge case (validated against D.2.3.01 analogie)
D.1.3.02, D.1.3.03, D.1.3.04,
D.1.4.01, D.1.4.02, D.1.4.03, D.1.4.05, D.1.4.06, D.1.4.07
```

`D.1.3.01` (objekt D, 1.NP, byt 3, místnost 01) is the spec's known
edge-case reference — confirmed present in the DXF, ready for
triangulation against tabulka místností + PDF půdorys (Phase 1).

## Skeletons

- `concrete-agent/packages/core-backend/app/services/dwg_to_dxf.py` — **implemented** with libredwg subprocess backend + ODA fallback. `detect_backend()` returns `LIBREDWG` when `dwg2dxf` is on PATH.
- `concrete-agent/packages/core-backend/app/services/dxf_parser.py` — still skeleton (Session 4 work: `parse_dxf_drawing`, `find_enclosing_polyline`, `detect_units`).

## Smoke test (Python wrapper)

```
$ PYTHONPATH=concrete-agent/packages/core-backend python3 -c "
from pathlib import Path
from app.services.dwg_to_dxf import detect_backend, convert_one
print('Backend:', detect_backend().value)
res = convert_one(
    Path('test-data/libuse/inputs/dwg/185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg'),
    Path('/tmp/dxf_test_smoke'),
)
print(res.status, res.duration_ms, 'ms')
"

Backend detected: libredwg
Status: ok Backend: libredwg Duration: 78 ms
```

## Acceptance criteria — Phase 0.5 PoC

- [x] DWG → DXF conversion works on a real Libuše půdorys
- [x] DXF readable by ezdxf 1.4.3
- [x] Layers detected (58, AIA-style discipline naming preserved)
- [x] TEXT/INSERT/POLYLINE entities present (560 / 399 / 21)
- [x] Room codes parseable with the spec regex (18 hits including known edge case D.1.3.01)
- [x] Conversion latency manageable (78 ms wrapped, 14 files × ~80 ms ≈ 1.1 s for batch)
- [x] Python wrapper integrates with existing `app/services/dwg_to_dxf.py` skeleton signatures

**Conclusion:** libredwg backend is production-viable for the Libuše dataset.
Ready to proceed to Phase 0.5 batch conversion (14 DWG → 14 DXF) +
Phase 0.7 cross-object validation in the next session, on user confirmation.
