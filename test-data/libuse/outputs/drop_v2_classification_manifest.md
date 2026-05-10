# Drop v2 — classification manifest (PLANNING DOC, drop not yet received)

**Date:** 2026-05-09
**Status:** ⏸ **DROP NOT RECEIVED — manifest is a forward-looking plan**
**Branch:** `claude/phase-pi-1-generators`

---

## What this document is

The user's task message of 2026-05-09 listed 14 new DWG/ZIP files that
were expected to land in `_UNSORTED/`. After Part 1 discovery, **none
of the 14 files exist anywhere on the filesystem** (verified by
filename search across `test-data/libuse/{inputs,sources,_UNSORTED}/`,
`/home`, `/root/Downloads`, `/tmp`, and shallow `/`).

This document is therefore a **planning manifest**, not an execution
record. It pre-decides the target path + handling per file so that
when the drop actually lands, sorting can run mechanically without
revisiting decisions. **No `git mv` / no extraction / no DXF conversion
has been performed.**

---

## Expected drop — the 14 files from task message

| # | Source filename | Source format | Scope (per filename pattern) | Planned target |
|---:|---|---|---|---|
| 1 | `18501_DPS_D_SO01_140_9410_R00_koordinacni vykres D 1NP.zip` | ZIP | objekt D, koordinace, 1.NP | extract main DWG → `sources/D/dwg/`; xrefs → `sources/D/dwg/xref/` |
| 2 | `18501_DPS_D_SO01_140_9420_R00_koordinacni vykres D 2NP.zip` | ZIP | objekt D, koordinace, 2.NP | same pattern |
| 3 | `18501_DPS_D_SO01_140_9430_R00_koordinacni vykres D 3NP.zip` | ZIP | objekt D, koordinace, 3.NP | same pattern |
| 4 | `18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` | DWG | objekt D, byt jádra zoom 2.NP | **NO-OP — file already in `sources/D/dwg/` from earlier session.** Verify SHA matches; if newer, replace. |
| 5 | `18501_DPS_D_SO01_100_9000_R00_koordinacni vykres 1PP.dwg` | DWG | komplex shared, 1.PP koord (single drawing replacing parts A+B PDFs) | `sources/shared/dwg/` |
| 6 | `185-01_DPS_D_SO01_100_8050_00 - ZASADY SPAROREZU.dwg` | DWG | komplex shared, zásady spárořezu | `sources/shared/dwg/` |
| 7 | `1pp_plyn.dwg` | DWG | 1.PP TZB section — **PLYN** (gas) | `sources/shared/dwg/` (komplex 1.PP scope) |
| 8 | `1pp_slb.dwg` | DWG | 1.PP TZB section — **SLABOPROUD** (low-voltage / data) | `sources/shared/dwg/` |
| 9 | `1pp_UT.dwg` | DWG | 1.PP TZB section — **UT** (heating) | `sources/shared/dwg/` |
| 10 | `1PP_vod.dwg` | DWG | 1.PP TZB section — **VODOVOD** (water + drains) | `sources/shared/dwg/` |
| 11 | `1pp_VZT.dwg` | DWG | 1.PP TZB section — **VZT** (HVAC) | `sources/shared/dwg/` |
| 12 | `K1pp.dwg` | DWG | 1.PP TZB section — likely **silnoproud** (kabelové trasy / power) | `sources/shared/dwg/` (verify after DXF parse) |
| 13 | `UDL_1PP.dwg` | DWG | 1.PP — likely lighting / UDL (universal data layer ARS overlay) | `sources/shared/dwg/` (verify after DXF parse) |
| 14 | `185-01-LIB_Rozpisky_ARS.dwg` | DWG | komplex shared, ARS rozpiska / titleblock template | `sources/shared/dwg/` |

### Naming-derived assumptions to verify after drop

- **Files 7–13 (`1pp_*` + `K1pp` + `UDL_1PP`)** — short non-DPS-format
  filenames. Likely came from a sub-contractor (TZB profession) rather
  than the main ABMV DPS bundle. Title-block check after DXF conversion
  will confirm objekt scope; if title-block says "objekt D only" rather
  than "1.PP komplex", target moves to `sources/D/dwg/`.
- **File 12 `K1pp`** — `K` prefix is unusual; could be **K**abeláž
  (cabling) or **K**ompletní 1.PP koordinace. Layer inventory after
  conversion settles which.
- **File 13 `UDL_1PP`** — `UDL` matches the existing AutoCAD external-
  reference naming convention seen in `_140_9421` (`UDL_2NP_D$0$...`
  layers). Likely the ARS desky equivalent for 1.PP. Verify after DXF.

---

## Handling plan (when drop arrives)

### Step 1 — Drop reception verification

Before any moves, after files arrive in `_UNSORTED/`:

1. Confirm all 14 filenames present.
2. SHA-256 each new file; record in this manifest.
3. For file 4 (`9421_R00_jadra D 2NP.dwg`): compare SHA against the
   already-sorted copy in `sources/D/dwg/`. If SHA differs → newer
   revision; archive old to `sources/D/_archives/` and replace.
   If SHA matches → drop the duplicate from `_UNSORTED/`, log no-op.
4. Cross-check against existing PDFs in `sources/D/pdf/` (9410, 9420,
   9430 PDFs) — these become **redundant** once DWG is available; keep
   PDFs as visual reference but mark "DWG primary" in INVENTORY.

### Step 2 — ZIP extraction (files 1, 2, 3)

For each koordinační ZIP (9410, 9420, 9430):

```
unzip -l <file>.zip            # inspect (read-only) before extract
unzip -d <tmp>/D_<podlazi> <file>.zip
```

Decision per ZIP content:
- **Main DWG** (typically `<basename>.dwg` matching the ZIP name): move
  to `sources/D/dwg/` with original filename.
- **Xrefs** (smaller `.dwg` files referenced by the main): keep in
  `sources/D/dwg/xref/` subdir. The DWG→DXF converter may or may not
  resolve xrefs; if xref content is critical, may need
  `dwg2dxf --resolve-xrefs` flag (verify converter supports it).
- **Image files** (PNG / JPG embedded raster): keep in `sources/D/_archives/`.
- **Original ZIP**: archive to `sources/D/_archives/` for provenance.

### Step 3 — Flat DWG moves (files 4–14)

`git mv` per the table above. Match the existing flat-directory
convention (`sources/{objekt}/dwg/`) — NO new sub-directories like
`koordinace/` or `tzb/` unless necessary. Reason: existing pattern is
flat; introducing subdirs only for the new drop creates inconsistency.

### Step 4 — Symlink updates

For every new DWG that lands in `sources/`, create the corresponding
symlink in `inputs/dwg/` pointing back. Match the existing convention
(`ln -sf ../../sources/{objekt}/dwg/<file> inputs/dwg/<file>`).

### Step 5 — DWG → DXF batch conversion

```
python scripts/infrastructure/dwg_to_dxf_batch.py \
    --input-dir test-data/libuse/sources \
    --output-dir test-data/libuse/sources \
    --recursive
```

Expected new DXFs (~14 entries, one per new DWG except duplicates):
- `_140_9410.dxf`, `_140_9420.dxf`, `_140_9430.dxf` (D koord)
- `_100_9000.dxf` (komplex 1.PP koord)
- `_100_8050.dxf` (zásady spárořezu)
- `1pp_plyn.dxf`, `1pp_slb.dxf`, `1pp_UT.dxf`, `1PP_vod.dxf`,
  `1pp_VZT.dxf` (TZB sections)
- `K1pp.dxf`, `UDL_1PP.dxf` (verify scope post-conversion)
- `Rozpisky_ARS.dxf`

Append to `outputs/dwg_conversion_log.md` per the existing pattern.

### Step 6 — `pi_0/extract.py --all` re-run

After new DXFs land in `sources/{D,shared}/dxf/`, Π.0a auto-picks
them up (cache-mtime-keyed). Expected behaviour:

- `master_extract_D.json` regenerates with new openings from 9410 / 9420
  / 9430. Dedup should suppress double-counts (existing 9421 jádra
  zoom + new full-floor coord drawings overlap on the same physical
  prostupy).
- `segment_counts` may grow if new layers carry IDEN-tag suffix codes
  (verify; TZB layer convention `_VZT`/`_vodovod`/etc. doesn't follow
  the AIA `*-IDEN` pattern Π.0a Step 5 looks for, so segment_counts
  may NOT change).
- TZB-section DXF content (1pp_plyn, K1pp, etc.) sits in DXF cache but
  is **not yet absorbed** into master_extract — Π.0a Step 8c is the
  pending extractor for that.

### Step 7 — Validation gate re-run

```
cd concrete-agent/packages/core-backend/scripts
python -m pi_0.validation.diff_vs_legacy --objekt=D
```

Must still report **0 MISSING / 0 CHANGED**. New entries in `NEW`
bucket are expected (additional openings detected by 9410/9420/9430)
and audit-classified per the Step 7b precedent. If MISSING > 0 →
investigate before commit.

### Step 8 — Inventory + commit

- Update `sources/MASTER_INVENTORY.md` and `sources/D/INVENTORY.md` /
  `sources/shared/INVENTORY.md` with new files.
- Logical commit split:
  - **Commit 1** — `git mv` + ZIP extraction artifacts + symlink updates
    + INVENTORY edits + this manifest's "PLANNING" → "EXECUTED" status flip
  - **Commit 2** — DXF cache file additions (verify
    `concrete-agent/packages/core-backend/scripts/.pi_0_cache/` is in
    `.gitignore` per existing convention; do NOT commit cache)
  - **Commit 3** — `master_extract_{A,B,C,D}.json` regenerated outputs
    + validation report refresh
- Push.

---

## Existing `_UNSORTED/` backlog (orthogonal to this drop)

For reference: `inputs/_UNSORTED/` already contains the May-7 A/B/C
drop that was sorted into `sources/{A,B,C}/` during Π.0.0 (#1088). The
files in `_UNSORTED/` appear to be retained as backups — symlinks in
`inputs/dwg/` point to `sources/A|B|C/dwg/`, not to `_UNSORTED/`.

A/B/C koord ZIPs (`_110_91N0`, `_120_92N0`, `_130_93N0`, 9 ZIPs total)
sit in `_UNSORTED/` un-extracted. They are **out of scope for the
current PROBE 9 D-only audit** but should be addressed by Π.1 trigger
day per `TASK_PHASE_PI_1_SPEC.md`.

This drop v2 manifest does not touch the existing `_UNSORTED/` content.

---

## Decision tree for user

When ready to drop:

1. **Drop the 14 files into `test-data/libuse/inputs/_UNSORTED/`**
   (any other path is fine; the planning here assumes that path).
2. Send a short message confirming the drop and any deviations from
   the listed names (e.g. version suffixes, additional files).
3. Claude re-runs Part 1 discovery against the actual files, fills in
   the SHA-256 column above, and confirms / corrects target paths.
4. After your re-approval, Steps 2–8 execute sequentially.

If any of the 14 files won't be available (e.g. `Rozpisky_ARS.dwg` is
optional), say so — they get marked DEFERRED in this manifest and
omitted from sorting + DXF conversion.

If additional files appear that aren't in the list of 14, they get
added to the manifest with a TBD target until classification is
confirmed.

---

## What's blocked until drop arrives

- **PROBE 9 full audit** (`probe_9_full_audit_per_section.md`) — needs
  TZB-section DXFs to exist. Current `probe_9_source_audit.md` is
  complete based on what's available (1 DXF + 6 PDFs).
- **Π.0a Step 8c extractor** — design depends on actual layer
  conventions in the new DXFs. May or may not match the
  `_VZT`/`_vodovod`/`_kanalizace`/`_UT` Czech-named convention seen in
  9421; per-discipline drawings often use different layer schemes
  (`S-PIPE-*`, `M-HVAC-*`, `E-CABL-*` AIA standard, or vendor-specific).
- **Master_extract enrichment** — new koord drawings may bring
  additional rooms / openings / segment_tags depending on layer setup.

---

_Generated by Claude Code, drop v2 planning manifest, 2026-05-09._
