# LibreDWG canonical build snapshot

Latest verified-working build of LibreDWG `dwg2dxf` for STAVAGENT
pipelines. Update this file every time `build_libredwg.sh` is run on
a fresh sandbox / new tag.

---

## Build environment (last verified)

| Field | Value |
|-------|-------|
| Date | 2026-05-08 |
| Trigger | Π.0a Step 2.5 (rebuild after sandbox reset) |
| Host | Ubuntu 24.04 (sandbox; root uid=0) |
| LibreDWG version | **0.13.4.8174** (= release 0.13.4 + 8 174 commits) |
| LibreDWG ref | upstream HEAD `615cd95` (`ci: oda updated to ODAFileConverter_QT6_lnxX64_8.3dll_27.1.deb`) |
| Source URL | https://github.com/LibreDWG/libredwg.git (depth=1 clone) |
| Configure flags | `--enable-release --prefix=/usr/local` |
| `make -j` | 4 |
| Total wall time | ~10 min (autogen 2s, configure 30s, make 9 min, install 5s) |
| Installed binary | `/usr/local/bin/dwg2dxf` |
| Binary type | `bash wrapper` → `.libs/dwg2dxf` ELF 64-bit, dynamically linked |
| Stripped | no (debug_info present) |
| `dwg2dxf --version` | `dwg2dxf 0.13.4.8174` |

Verify with:

```bash
which dwg2dxf
dwg2dxf --version
ldd "$(which dwg2dxf | xargs realpath)" | head
```

---

## Build dependencies installed

Auto-installed by `build_libredwg.sh` via `apt-get install -y --no-install-recommends`:

- `autoconf 2.71`
- `automake 1.16.5`
- `libtool 2.4.7`, `libtool-bin`
- `make` (GNU Make 4.3)
- `gcc 13.x`
- `git 2.43.x`
- `pkg-config 1.8.1`
- `libpcre3-dev 2:8.39-15build1`

---

## Known build-time issues (non-fatal for our use case)

1. **`make` exits non-zero in `doc/` stage** when `texinfo` /
   `makeinfo` is not installed (we don't install it — docs aren't
   needed). The `programs/dwg2dxf` ELF is built fine before `doc/`
   blocks the top-level target. Mitigation in
   `build_libredwg.sh`: install via per-subdir
   `make -C src install && make -C programs install` instead of
   relying on top-level `make install`.

2. **Compiler warnings** (none observed in this build, count = 0
   in build log). Older releases were noisier; current `0.13.4.8174`
   is clean.

---

## Runtime warnings observed when converting Libuše ArchiCAD DWGs

These are emitted by `dwg2dxf` on stderr while converting; they are
**non-fatal** and don't affect downstream parsing of the entities
STAVAGENT uses (rooms / doors / windows / segment tags / DIMENSION
entities). DXF still passes `ezdxf.readfile()`.

```
Warning: Unstable Class object 501 MATERIAL (0x481) ...
Warning: Unhandled Object TABLESTYLE in out_dxf ...
Warning: Unstable Class object 505 MLEADERSTYLE (0xfff) ...
Warning: Unstable Class object 504 TABLESTYLE (0xfff) ...
Warning: Skip HATCH common handles due to short handle stream
Warning: Object handle not found NNNN/0xNNNN in N objects ...
Warning: Unknown object, skipping eed/reactors/xdic
```

These all originate from AutoCAD 2018+ object-class metadata that
LibreDWG hasn't fully integrated yet. STAVAGENT pipelines read
`LWPOLYLINE`, `MTEXT`, `INSERT`, `LINE`, `DIMENSION`, `HATCH` entities
— none of which are skipped.

---

## Conversion output sanity

Smoke test (1× Libuše D DWG → DXF):

| Field | Value |
|-------|-------|
| Source | `sources/D/dwg/...140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg` (372 KB) |
| Target | `.../140_4410_00-OBJEKT D - Půdorys 1 .NP.dxf` (3 102 KB) |
| DXF version | `AC1027` (AutoCAD 2013 format — inherits source DWG version) |
| Modelspace entities | 2 577 |
| Top entity types | `LINE 1019`, `MTEXT 560`, `INSERT 399`, `DIMENSION 333`, `HATCH 161`, `CIRCLE 84`, `LWPOLYLINE 21` |
| Layers | 58 |
| `ezdxf.readfile()` | ✓ no errors |

Whole-D batch (11 DWGs, `dwg_to_dxf_batch.py`):

| Field | Value |
|-------|-------|
| Files | 11 (4× půdorys NP + střecha + řezy + pohledy + 3× podhledy + ARS desky + jadra) |
| Converted | 11 / 11 |
| Failed | 0 |
| Total wall time | 9 249 ms |

---

## Reproduction

```bash
# Idempotent — fast path if already installed
bash scripts/infrastructure/build_libredwg.sh

# Or with a custom prefix (e.g. ~/.local for non-root)
LIBREDWG_PREFIX=$HOME/.local bash scripts/infrastructure/build_libredwg.sh

# Or to a custom clone dir
LIBREDWG_CLONE_DIR=/srv/libredwg bash scripts/infrastructure/build_libredwg.sh
```

After `build_libredwg.sh` succeeds:

```bash
python scripts/infrastructure/dwg_to_dxf_batch.py \
    --input-dir test-data/libuse/sources/D/dwg \
    --output-dir test-data/libuse/sources/D/dxf
```

Or call the Libuše-specific wrapper directly:

```bash
python concrete-agent/packages/core-backend/scripts/phase_0_5_batch_convert.py
```
