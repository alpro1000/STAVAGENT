# Phase 0.5 PoC — DWG → DXF readiness probe

**Session:** Feasibility (Session 1, Phase 0.0 + 0.5 setup only)
**Date:** 2026-05-03

## Probe results

| Check | Result |
|-------|--------|
| Python `ezdxf` importable | ✅ 1.4.3 |
| Python `shapely` importable | ✅ 2.1.2 |
| `ezdxf.addons.odafc` importable | ✅ |
| ODA File Converter binary on PATH | ❌ not installed |
| `libredwg-tools` (apt) | ❌ package not in repo |
| `LibreCAD` headless | ❌ not installed |
| LibreOffice (DWG) | ⚠️ available but does not handle DWG |
| Sample DWG format | DWG AutoCAD 2013-2017 (per `file`) |

## Sample DWG inspected

`test-data/libuse/inputs/dwg/185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg`

`file` reports: `DWG AutoDesk AutoCAD 2013-2017`. Compatible with ODA File
Converter target version `ACAD2018` and with `ezdxf` 1.x DXF readback.

## DWG → DXF conversion path

`ezdxf.addons.odafc` is the chosen wrapper. It expects the ODA File Converter
binary on Linux at the path stored in `ezdxf.options['odafc-addon'][unix_exec_path]`.
Once ODA is installed, the call is:

```python
from ezdxf.addons import odafc
odafc.convert(dwg_path, dxf_path, version="ACAD2018", audit=True)
```

## Blocker

ODA File Converter must be installed manually (free, but requires Open Design
Alliance account registration; .deb provided for Linux). Cannot be done from
inside this session because:

1. Download URL is gated behind login at https://www.opendesign.com/guestfiles/oda_file_converter
2. `apt-get install` does not provide it in the default repos.
3. No alternative free package (`libredwg-tools`) is available in this env.

## Action for next session

1. User downloads `ODAFileConverter_QT5_lnxX64_8.3dll_25.X.deb` (or the
   AppImage variant) and either installs it system-wide (`dpkg -i`) or
   places the binary into `tools/oda/` (gitignored) at repo root.
2. Set `ezdxf.options['odafc-addon']['unix_exec_path']` to the absolute
   binary path, or export `ODAFC_PATH=/abs/path/to/ODAFileConverter` and
   wire it through `app/services/dwg_to_dxf.py`.
3. Run the actual PoC conversion + DXF parse on one Libuše DWG to sanity-check
   the toolchain end-to-end.

## Skeletons in place

- `concrete-agent/packages/core-backend/app/services/dwg_to_dxf.py` — backend selector + batch wrapper (`NotImplementedError` until ODA present)
- `concrete-agent/packages/core-backend/app/services/dxf_parser.py` — `parse_dxf_drawing()` signature + dataclasses for rooms/openings
