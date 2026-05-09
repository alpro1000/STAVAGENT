# `scripts/infrastructure/` — STAVAGENT cross-project tooling

Utilities used by multiple STAVAGENT services / pipelines. Anything
service-specific lives under that service's own `scripts/` directory;
anything cross-cutting (build deps, format converters, shared tools)
lives here.

---

## DWG → DXF conversion

LibreDWG (`dwg2dxf`) lets STAVAGENT pipelines read AutoCAD DWG files
without depending on the proprietary ODA File Converter. ArchiCAD
output (Libuše, Žihle, future projects) is DWG; our parsing stack
(ezdxf, Phase 0.5+ extractors) reads DXF.

### Files

| Path | Purpose |
|------|---------|
| `build_libredwg.sh`     | Idempotent build of LibreDWG `dwg2dxf` from source into `/usr/local/bin/`. Auto-installs build deps on Debian/Ubuntu. |
| `dwg_to_dxf_batch.py`   | Generic CLI batch converter. Auto-invokes `build_libredwg.sh` if `dwg2dxf` is missing. |
| `LIBREDWG_BUILD.md`     | Snapshot of the LibreDWG version + configure flags + warnings observed during the canonical build. Update when re-building. |
| `README.md`             | This file. |

### Quick start

```bash
# Build (idempotent — fast path if already installed)
bash scripts/infrastructure/build_libredwg.sh

# Convert all D-objekt DWGs in Libuše
python scripts/infrastructure/dwg_to_dxf_batch.py \
    --input-dir test-data/libuse/sources/D/dwg \
    --output-dir test-data/libuse/sources/D/dxf

# Convert across an entire monorepo of objekt DWGs (recursive walk)
python scripts/infrastructure/dwg_to_dxf_batch.py \
    --input-dir test-data/libuse/sources \
    --output-dir test-data/libuse/sources \
    --recursive

# With log file for traceability
python scripts/infrastructure/dwg_to_dxf_batch.py \
    --input-dir test-data/libuse/sources/D/dwg \
    --output-dir test-data/libuse/sources/D/dxf \
    --log test-data/libuse/outputs/dwg_conversion_log.md
```

### Build dependencies

Auto-installed by `build_libredwg.sh` on Debian/Ubuntu via `apt-get`:

- `autoconf`, `automake`, `libtool`, `libtool-bin`
- `make`, `gcc`
- `git`, `pkg-config`
- `libpcre3-dev`

On other distros: install the equivalents and re-run.

### Behavior

- **Idempotent**: re-running `build_libredwg.sh` exits early if a
  compatible `dwg2dxf` is already on PATH (version check).
- **Skip-existing**: `dwg_to_dxf_batch.py` skips DXFs newer than their
  DWG source by default. Use `--force` to override.
- **Mirrored layout**: with `--recursive`, the input directory tree is
  mirrored under the output directory.
- **Cross-platform**: tested on Linux (Ubuntu 24.04 / Debian); should
  work on macOS via `brew install libredwg` (build script not
  exercised there yet).

### Why LibreDWG (not ODA)

| Tool | Pros | Cons |
|------|------|------|
| **LibreDWG** | open source, free, builds in <5 min, trivial subprocess wrapper | newer DWG features sometimes printed as warnings (non-fatal for our use case) |
| ODA File Converter | reference impl, supports newer formats first | EULA prevents redistribution; 200+ MB Qt-bundled binary; manual install per dev machine |

For STAVAGENT pipelines (room polygons + TEXT labels + INSERT blocks
from ArchiCAD output) LibreDWG warnings about MATERIAL / TABLESTYLE /
MLEADERSTYLE are non-fatal — those aren't entities the pipeline reads.

### Generated DXF — gitignored

Every project keeps DXFs under `<project>/inputs/dxf/` (or
`sources/<objekt>/dxf/` for sorted layouts). They're listed in the
root `.gitignore` because they:

- are derivable from the committed DWG sources
- can be ~300 MB for a komplex (some files exceed GitHub's 100 MB cap)
- regenerate in <10 s via `dwg_to_dxf_batch.py`

### Troubleshooting

- **`dwg2dxf: error while loading shared libraries: libredwg.so.0`** —
  run `sudo ldconfig` after `make install`. The build script does this
  automatically; manual builds may need it.
- **`error: PCRE library not found`** — install `libpcre3-dev`
  (Debian/Ubuntu) or `pcre-devel` (RHEL/Fedora) and re-run.
- **`make` fails on `jsmn` submodule** — `autogen.sh` initializes the
  submodule. If the clone was partial, `git -C /tmp/libredwg
  submodule update --init --recursive` and re-run `./configure && make`.
- **DXF output is empty (0 bytes)** — the DWG may be R12 / proprietary;
  open it in QCAD or LibreCAD and "save as DXF" manually.
