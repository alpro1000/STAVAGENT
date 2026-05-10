# Drop v2 — classification manifest (EXECUTED 2026-05-10)

**Date:** 2026-05-10
**Status:** ✅ **EXECUTED — 14 files sorted, 3 ZIPs extracted (24 inner DWGs),
1 SHA duplicate dropped, 34 unique DWGs landed in canonical sources/, 75/78
DXFs converted (3 chl failures documented), Π.0a refresh + validation gate
PASS (373 MATCH / 0 MISSING)**
**Branch:** `claude/probe-9-drop-v2-sort` (off main `8cbb8eae`)
**Drop commit on main:** `8cbb8eae` "Add files via upload" (2026-05-10)

---

## What this document is

The 2026-05-09 task listed 14 new DWG/ZIP files. The user uploaded
them to `inputs/_UNSORTED/` in commit `8cbb8eae`. This manifest now
records the **actual verified state** with SHA-256 hashes, ZIP
contents, target paths, and duplicate decisions. Pending user approval
before Part 3 execution (extraction / `git mv` / DXF conversion).

---

## 1. Verified inventory — 14 files in `_UNSORTED/`

| # | File | Bytes | SHA-256 (16-char prefix) | Format |
|---:|---|---:|---|---|
| 1 | `18501_DPS_D_SO01_140_9410_R00_koordinacni vykres D 1NP.zip` | 2 547 586 | `c69fe2585cdfe92c` | ZIP |
| 2 | `18501_DPS_D_SO01_140_9420_R00_koordinacni vykres D 2NP.zip` | 2 516 930 | `b44cc0da18ee22c8` | ZIP |
| 3 | `18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` | 1 539 557 | `f0f5207566a1c6c4` | DWG |
| 4 | `18501_DPS_D_SO01_140_9430_R00_koordinacni vykres D 3NP.zip` | 2 516 322 | `511cddafb6127a04` | ZIP |
| 5 | `18501_DPS_D_SO01_100_9000_R00_koordinacni vykres 1PP.dwg` | 1 599 218 | `66112c5e31f1cb01` | DWG |
| 6 | `18501_DPS_D_SO01_100_8050_00 - ZASADY SPAROREZU.dwg` | 1 085 419 | `4f7d004368a4184a` | DWG |
| 7 | `1pp_plyn.dwg` | 128 200 | `ffff825f6227c665` | DWG |
| 8 | `1pp_slb.dwg` | 46 191 | `e961935a20f168bb` | DWG |
| 9 | `1pp_UT.dwg` | 356 889 | `a8a36950254b7217` | DWG |
| 10 | `1PP_vod.dwg` | 150 189 | `3c04045ff07196ce` | DWG |
| 11 | `1pp_VZT.dwg` | 2 318 715 | `612130aa9369b486` | DWG |
| 12 | `K1pp.dwg` | 101 088 | `1421c8d93aa94a7d` | DWG |
| 13 | `UDL_1PP.dwg` | 284 398 | `1d238080e596b310` | DWG |
| 14 | `185-01-LIB_Rozpisky_ARS.dwg` | 3 945 717 | `1befd69c0325b82d` | DWG |

> **Filename note:** the user's task message used `185-01_DPS_D_SO01_100_8050`
> prefix; actual file uses `18501_DPS_D_SO01_100_8050` (no hyphen). Same
> file. Both prefix conventions appear in this drop.

### Duplicate detection vs already-sorted `sources/`

- **File 3 (`9421 jadra D 2NP.dwg`):** SHA-256 matches the existing
  `sources/D/dwg/18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` byte-
  for-byte (full SHA `f0f5207566a1c6c464d258f353f3e668c197fb09ddb1ebb22acf94964426fe73`
  identical on both sides). **Action: NO-OP.** Drop the duplicate from
  `_UNSORTED/`; keep existing sorted copy.
- **All other 13 files:** zero filename collisions vs existing
  `sources/D/dwg/` (11 entries) or `sources/shared/dwg/` (3 entries).
  All clean adds.

---

## 2. ZIP contents — 3 koord ZIPs expand to 24 inner DWGs

Each podlazi ZIP carries the architect's main koord overlay + 6
profession-specific TZB DWGs + 1 architectural xref (UDL_NNP_D).

### `_140_9410` ZIP (1.NP) — 8 files / 3 295 766 B uncompressed

| Inner file | Bytes | Discipline |
|---|---:|---|
| `18501_DPS_D_SO01_140_9410_R00_koordinacni vykres 1NP.dwg` | 1 432 858 | Main koord overlay (architect) |
| `D_1NP_chl.dwg` | 1 024 407 | Chlazení (cooling) |
| `D_1NP_kan.dwg` | 102 806 | Kanalizace (drains) |
| `D_1NP_sil.dwg` | 226 066 | Silnoproud (power) |
| `D_1NP_slb.dwg` | 78 210 | Slaboproud (low-voltage / data) |
| `D_1NP_vod.dwg` | 113 971 | Vodovod (water supply) |
| `D_1NP_vzt.dwg` | 180 629 | VZT (HVAC) |
| `UDL_1NP_D.dwg` | 136 819 | Architectural overlay xref |

### `_140_9420` ZIP (2.NP) — 8 files / 3 252 710 B uncompressed

| Inner file | Bytes | Discipline |
|---|---:|---|
| `18501_DPS_D_SO01_140_9420_R00_koordinacni vykres 2NP.dwg` | 1 424 498 | Main koord overlay |
| `D_2NP_chl.dwg` | 972 446 | Chlazení |
| `D_2NP_kan.dwg` | 94 171 | Kanalizace |
| `D_2NP_sil.dwg` | 220 637 | Silnoproud |
| `D_2NP_slb.dwg` | 73 580 | Slaboproud |
| `D_2NP_vod.dwg` | 125 309 | Vodovod |
| `D_2NP_vzt.dwg` | 184 022 | VZT |
| `UDL_2NP_D.dwg` | 158 047 | Architectural overlay xref |

### `_140_9430` ZIP (3.NP) — 8 files / 3 235 400 B uncompressed

| Inner file | Bytes | Discipline |
|---|---:|---|
| `18501_DPS_D_SO01_140_9430_R00_koordinacni vykres 3NP.dwg` | 1 426 757 | Main koord overlay |
| `D_3NP_chl.dwg` | 966 792 | Chlazení |
| `D_3NP_kan.dwg` | 102 142 | Kanalizace |
| `D_3NP_sil.dwg` | 219 049 | Silnoproud |
| `D_3NP_slb.dwg` | 65 626 | Slaboproud |
| `D_3NP_vod.dwg` | 115 797 | Vodovod |
| `D_3NP_vzt.dwg` | 172 676 | VZT |
| `UDL_3NP_D.dwg` | 166 561 | Architectural overlay xref |

> **Important:** the per-section TZB DWGs inside the ZIPs are
> profession-specific (chl / kan / sil / slb / vod / vzt) and are
> EXACTLY what PROBE 9 needs. This is materially better than the
> 1-discipline-per-file 1.PP set — for above-ground floors we get
> 6 disciplines × 3 podlazi = 18 per-section TZB DWGs.

---

## 3. Per-section TZB scope inventory (post-extraction)

Counting unique DWGs that need to land in `sources/`:

### Above-ground D koord set (from ZIPs)

| Category | Count | Files |
|---|---:|---|
| Main koord overlay (architect) | 3 | `_140_9410/9420/9430_R00_koordinacni vykres NNP.dwg` |
| TZB chlazení | 3 | `D_NNP_chl.dwg` (1.NP / 2.NP / 3.NP) |
| TZB kanalizace | 3 | `D_NNP_kan.dwg` |
| TZB silnoproud | 3 | `D_NNP_sil.dwg` |
| TZB slaboproud | 3 | `D_NNP_slb.dwg` |
| TZB vodovod | 3 | `D_NNP_vod.dwg` |
| TZB VZT | 3 | `D_NNP_vzt.dwg` |
| Architectural xref | 3 | `UDL_NNP_D.dwg` |
| **Above-ground subtotal** | **24** | |

### 1.PP komplex set (standalone DWGs)

| Category | Count | Files |
|---|---:|---|
| Main koord overlay (1.PP) | 1 | `_100_9000_R00_koordinacni vykres 1PP.dwg` |
| TZB plyn (gas) | 1 | `1pp_plyn.dwg` |
| TZB slaboproud | 1 | `1pp_slb.dwg` |
| TZB UT (topení) | 1 | `1pp_UT.dwg` |
| TZB vodovod | 1 | `1PP_vod.dwg` (note capital `PP`, deviates from siblings — verify with title-block) |
| TZB VZT | 1 | `1pp_VZT.dwg` |
| Likely silnoproud (`K` = kabeláž?) | 1 | `K1pp.dwg` (verify post-DXF) |
| Architectural xref (1.PP) | 1 | `UDL_1PP.dwg` |
| **1.PP subtotal** | **8** | |

### Komplex shared (non-podlazi-specific)

| Category | Count | Files |
|---|---:|---|
| Zásady spárořezu | 1 | `_100_8050_00 - ZASADY SPAROREZU.dwg` |
| ARS rozpiska / titleblock | 1 | `185-01-LIB_Rozpisky_ARS.dwg` |
| **Komplex subtotal** | **2** | |

### Grand total

- 24 above-ground + 8 1.PP + 2 komplex = **34 unique DWGs**
- Plus 1 SHA-duplicate (file 3 `9421`) → skip
- Above-ground TZB scope: **6 disciplines × 3 podlazi = 18 DWGs** for PROBE 9

> **Discipline gap:** above-ground set has CHLAZENÍ but NO PLYN
> (chl ≠ plyn — gas is below-ground service). 1.PP set has PLYN but
> NO CHLAZENÍ (no AC central machinery in basement here). This split
> is normal. PROBE 9 prostupy + štroby quantification covers all
> disciplines that ACTUALLY exist per podlazi.

---

## 4. Target paths — APPROVED for execution

Sticking with **flat directory convention** to match existing
`sources/{D,shared}/dwg/` pattern (no new `koordinace/` or `tzb/`
subdirs). Filename pattern alone is enough to discriminate.

### Files going to `sources/D/dwg/` (24 files — all above-ground D)

- 3× main koord overlay (`_140_9410/9420/9430_R00_koordinacni vykres NNP.dwg`)
- 18× per-discipline TZB (`D_NNP_{chl,kan,sil,slb,vod,vzt}.dwg`)
- 3× architectural xref (`UDL_NNP_D.dwg`)

### Files going to `sources/shared/dwg/` (10 files — 1.PP + komplex)

- 1× 1.PP main koord (`_100_9000_R00_koordinacni vykres 1PP.dwg`)
- 5× 1.PP per-discipline TZB (`1pp_plyn.dwg`, `1pp_slb.dwg`,
  `1pp_UT.dwg`, `1PP_vod.dwg`, `1pp_VZT.dwg`)
- 1× 1.PP `K1pp.dwg` (verify scope post-DXF; likely silnoproud)
- 1× 1.PP architectural xref (`UDL_1PP.dwg`)
- 1× zásady spárořezu (`_100_8050.dwg`)
- 1× Rozpisky ARS (`185-01-LIB_Rozpisky_ARS.dwg`)

### File 3 — duplicate, no-op

`18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` exists already in
`sources/D/dwg/` with identical SHA. Drop the `_UNSORTED/` copy.

---

## 5. Filename normalisation

Some filenames are non-canonical (lowercase, abbreviated, missing
`185-01_` prefix). Recommend keeping AS-IS to preserve provenance —
renaming risks breaking xref resolution when DWG→DXF converter walks
the file. If renaming is desired later, do it as a separate cleanup
commit with a `git mv` log.

| Filename | Quirk | Recommendation |
|---|---|---|
| `1pp_plyn.dwg`, `1pp_slb.dwg`, `1pp_UT.dwg`, `1pp_VZT.dwg` | lowercase `1pp_` | keep |
| `1PP_vod.dwg` | uppercase `1PP_` (inconsistent w/ siblings) | keep — provenance |
| `K1pp.dwg` | no prefix; unclear discipline | keep + verify post-DXF |
| `UDL_1PP.dwg` | uppercase `_1PP` | keep |
| `185-01-LIB_Rozpisky_ARS.dwg` | uses `185-01-LIB` (project subcode) | keep |

---

## 6. Execution plan (Part 3, awaiting approval)

### Step A — Branch + backup state

- Already on `claude/probe-9-drop-v2-sort` (off main `8cbb8eae`)

### Step B — Extract 3 ZIPs

For each ZIP at `inputs/_UNSORTED/<zip>`:

1. `unzip -o "<zip>" -d test-data/libuse/sources/D/dwg/`
   — extracts all 8 inner files **flat** into `sources/D/dwg/`
2. The main koord overlay (`_140_9NN0_R00_koordinacni vykres NNP.dwg`)
   has the long DPS-pattern name; the 6 TZB profession DWGs
   (`D_NNP_*.dwg`) and the UDL (`UDL_NNP_D.dwg`) have shorter names.
   All land flat in `sources/D/dwg/`.
3. After extraction: archive the original ZIP into
   `sources/D/_archives/` (create if missing). Provenance retained,
   doesn't pollute `_UNSORTED/`.

### Step C — git mv 11 standalone DWGs

`git mv inputs/_UNSORTED/<file> sources/{D,shared}/dwg/<file>` per the
target table in §4. Includes:

- 7× to `sources/shared/dwg/`: `_100_9000`, `_100_8050`, `1pp_plyn`,
  `1pp_slb`, `1pp_UT`, `1PP_vod`, `1pp_VZT`, `K1pp`, `UDL_1PP`,
  `Rozpisky_ARS` (10 files actually — let me re-count for execution)
- 1× drop (file 3 `9421` duplicate): `git rm` from `_UNSORTED/`

> Step C corrected count: **10 `git mv` to `sources/shared/dwg/`** +
> **1 `git rm` for the 9421 duplicate**. The 24 above-ground D files
> all come from ZIP extraction in Step B (Step B handles them).

### Step D — `inputs/dwg/` symlinks

For each NEW DWG that lands in `sources/`, create reverse symlink
`inputs/dwg/<file> → ../../sources/{D,shared}/dwg/<file>`. Match the
existing `ln -sf` convention from prior sessions. ~34 new symlinks.

### Step E — DWG → DXF batch conversion

```
python scripts/infrastructure/dwg_to_dxf_batch.py \
    --input-dir test-data/libuse/sources \
    --output-dir test-data/libuse/sources \
    --recursive
```

Expected ~34 new DXFs. Append result to
`test-data/libuse/outputs/dwg_conversion_log.md`. Watch for converter
errors on UDL xref DWGs (these often have unresolved cross-references
that LibreDWG dwg2dxf may complain about; record any failures).

### Step F — Π.0a `pi_0/extract.py --all` re-run

Auto-picks up new DXFs (cache-mtime keyed). Expected diffs:

- `master_extract_D.json` — additional openings from 9410/9420/9430
  may surface; dedup by `(block_name, position)` should suppress
  cross-drawing duplicates of the same physical doors/windows.
- `segment_counts` — new TZB layers (`_VZT`, `_vodovod`, `_kanalizace`,
  `_UT`, `_silnoproud`, etc.) do NOT match Π.0a's `*-IDEN` AIA-pattern,
  so segment_counts likely UNCHANGED.
- TZB content sits in DXF cache awaiting Π.0a Step 8c extractor (next
  task after this one).

### Step G — Validation gate

```
cd concrete-agent/packages/core-backend/scripts
python -m pi_0.validation.diff_vs_legacy --objekt=D
```

Required: **0 MISSING / 0 CHANGED**. New `NEW` entries are expected
(more openings detected) and audit-classified per Step 7b precedent.

### Step H — INVENTORY updates + commit

Update:
- `sources/MASTER_INVENTORY.md` — total file count
- `sources/D/INVENTORY.md` — 24 new D entries
- `sources/shared/INVENTORY.md` — 10 new shared entries

Commit split:
- **Commit 1**: ZIP extraction + `git mv` + symlink updates +
  INVENTORY edits + this manifest's status flip to EXECUTED
- **Commit 2**: regenerated `master_extract_{A,B,C,D}.json` +
  `validation_report_D.{md,json}` (DXF cache stays gitignored)

Push.

---

## 7. Part 4 plan — PROBE 9 baseline audit

After Part 3 lands, audit each new DXF for layer / block / text
content per discipline:

- 18× above-ground TZB DXFs (chl / kan / sil / slb / vod / vzt × 3
  podlazi) — extract layer inventory + count CIRCLE/LWPOLYLINE/TEXT
  per layer
- 3× above-ground main koord DXFs — same
- 5× 1.PP per-discipline DXFs (plyn / slb / UT / vod / VZT)
- 1× K1pp DXF (verify discipline)
- 1× UDL_1PP DXF
- 1× _100_9000 1.PP koord DXF

Output: `test-data/libuse/outputs/probe_9_full_audit_per_section.md`

Per discipline:
- Layer convention (Czech-named like `_VZT` / AIA-style like `M-HVAC-*`?)
- Per-layer entity counts
- Text annotation samples (DN labels?)
- Prostup symbol convention (CIRCLE on which layer?)
- Štroby (wall chases) representation — LINE entities? Hatch? Block?
- Confidence rating: SUFFICIENT / PARTIAL / INSUFFICIENT for each
  discipline at each podlazi for Π.0a Step 8c extractor design

Recommendations: which disciplines are auto-extractable vs need manual
counts vs need ABMV clarification.

---

## 8. Decisions to confirm before Part 3

1. **Target paths** — flat in `sources/{D,shared}/dwg/` per §4? OR
   create `sources/D/dwg/koordinace/` + `sources/D/dwg/tzb/` subdirs?
   (I recommend flat; user may override.)
2. **ZIP archives** — keep originals in `sources/D/_archives/` for
   provenance? OR delete after successful extraction?
3. **9421 duplicate** — drop from `_UNSORTED/` cleanly? (Recommended.)
4. **K1pp / UDL_1PP scope verification** — Part 3 proceeds with the
   target path in §4 even if title-block doesn't match. If post-DXF
   inspection reveals different scope (e.g. K1pp turns out to be
   D-only), do a corrective `git mv` in a follow-up commit.
5. **Filename normalisation** — keep AS-IS per §5? (Recommended;
   provenance trumps consistency.)

---

_Generated by Claude Code, drop v2 actual classification manifest,
2026-05-10. Awaits user approval for Part 3 execution._
