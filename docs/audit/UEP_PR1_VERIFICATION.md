# UEP PR1 Verification — Real Corpus Findings

> Branch: `claude/uep-pr1-verification-SzXyv`
> Generated: 2026-05-18
> Source: dry-run of `concrete-agent/packages/core-backend/scripts/uep_run_e2e.py`
> against four projects in `test-data/`. PR1 code merged from
> `origin/claude/uep-skeleton-phase1` (4 commits, 53 changed files; not
> yet on `main`).
>
> Artifacts: `docs/audit/uep_pr1_runs/<project>/{manifest.json,
> phase1/per_source/*.json, phase2/coverage_report.json}` + raw stdout
> logs `*_run.log`.

## Executive summary

UEP PR1 imports cleanly, all 35 unit tests + 2 e2e tests pass against the
RD Jáchymov fixture. End-to-end CLI runs to completion on all four target
projects with coverage scores 42.1 % (RD_Jachymov) / 36.8 % (hk212) /
18.4 % (SO_250) / 39.5 % (Libuše). Libuše processed 195 supported files
in ~11 min wall time; 12 PDFs crashed on the same `_extract_quantities`
newline-in-number bug surfaced below.

Three substantive PR1 issues surfaced under real-corpus stress:

1. **PDF TZ exposure-class garbage (>96 % noise rate).** A Python `set`
   returned by `regex_extractor._find_all_exposure_classes` is stringified
   by the UEP normalizer's `str(obj)` fallback, then iterated character-
   by-character in the PDF TZ extractor — producing dozens of
   single-character "exposure class" facts per document.
2. **`$INSUNITS=0` heuristic mis-scales 2 of 17 real DXFs.** PR1 assumes
   "unitless = metres"; situace DXFs from Jáchymov are stored in mm,
   bbox comes back as 4 722 × 1 687 m. Coords are off by 1 000×.
3. **`regex_extractor._extract_quantities` crashes on multi-line
   numbers** (e.g. `"12\n12"` → `ValueError: could not convert string to
   float`). UEP catches it as "Unexpected error" and emits zero facts
   for that PDF — 12 Libuše PDFs hit this. The single regex crash
   throws away every other category for the document.

PR1 architecture is sound. PR1 implementation is not yet ready to run
against arbitrary corpora — calibration listed at end is the blocking
work for PR2.

## Per-project results

### RD_Jachymov_dum (residential, N=5 pilot baseline)

**Inventory** (recursive, supported extensions only):

| Format | Count | Total size | Notes                                          |
|--------|------:|-----------:|------------------------------------------------|
| PDF    | 58    | 53.8 MB    | 4 TZ + 54 drawings (8 architectural, 7 structural, 34 misc) |
| DXF    | 4     | 13.6 MB    | 2 DPZ (drawings) + 2 situace                   |
| XLSX   | 1     | 0.1 MB     | Master soupis — PR1 skips                      |
| DOCX   | 1     | 0.0 KB     | PR1 skips                                       |

PR1 scanned 64 files, picked up 62 (58 PDF + 4 DXF), skipped 2 (DOCX,
XLSX).

**Run results:**
- All 4 DXFs extracted (510 facts).
- 52 of 58 PDFs extracted text (699 facts).
- 6 PDFs failed with `Insufficient extractable text` → flagged
  `ocr_required` (all 6 are `D.2.3.0* - výkres tvaru *` — drawing-heavy
  structural plans, expected).
- 0 unexpected errors.

**Coverage** (`coverage_matrix_residential.yaml`):
- Total: 38 categories | **pokryto = 16** | castecne = 0 | chybi = 22.
- **Score: 42.11 %** | gate_passed: false (9 blocking gaps).
- Blocking gaps: `wall_system`, `foundation_system`, `roof_system`,
  `thermal_insulation`, `facade_finish`, `floor_finishes`,
  `windows_doors_specification`, `fire_safety`, `site_situation`.

**Issues found:**
- `exposure_class` is in `pokryto` but **99.1 % of its 323 facts are
  garbage** (single chars `'s', 'e', 't', '{', '}', '''`). 3 valid
  values (`XC3`, `XC1`, `XC3`). See §3.3 PDF TZ section.
- 2 of 4 DXFs (`situace 02.dxf`, `situace 04.dxf`) have
  `$INSUNITS=0` and bbox 4 722 × 1 687 m → mm-as-metres scaling
  bug. See §3.2 DXF units section.
- All 9 blocking gaps are categories whose source-of-truth lives in
  fields/concepts that the PDF TZ regex doesn't recognise as facts
  (e.g. there is no `wall_system` regex pattern, no `floor_finishes`
  regex pattern). The TZ PDFs do contain this information in prose
  form — PR1 just doesn't lift it into structured facts.

### hk212_hala (industrial hall)

**Inventory:**

| Format | Count | Total size | Notes                                       |
|--------|------:|-----------:|---------------------------------------------|
| PDF    | 22    | 17.4 MB    | 1 TZ + 15 architectural drawings + 6 misc   |
| DXF    | 7     | 52.9 MB    | All architectural (pohledy, půdorysy, …)     |
| DWG    | 9     | 9.7 MB     | Mirror of DXFs + 5 extras — **PR1 skips**   |
| XLSX   | 10    | 4.3 MB     | 2 soupisy + 7 tabulky                       |
| XLS    | 2     | 0.2 MB     | PR1 skips                                    |
| XML    | 1     | 2.9 MB     | KROS UNIXML soupis — **PR1 skips**          |

PR1 scanned 51 files, picked up 29 (22 PDF + 7 DXF), skipped 22 (mostly
DWG + XLSX + XML).

**Run results:**
- 7 DXFs extracted (781 facts).
- 22 of 22 PDFs extracted (449 facts), 0 OCR-required.

**Coverage:**
- Total: 38 | **pokryto = 14** | chybi = 24.
- **Score: 36.84 %** | gate_passed: false (10 blocking gaps).
- Blocking gaps add `closed_polygons` over Jáchymov — the industrial
  hall DXFs have plenty of `LWPOLYLINE` entities but none `closed` (the
  walls are open polylines, the roof slope diagram is open polylines,
  pohledy are open polylines).

**Issues found:**
- Same exposure_class garbage pattern (96.9 % garbage; 6 valid
  values: `XC4`, `XF4`, `XA2`, `XF4`, `XA2`, …).
- 0 mm-as-metres bug here — all 7 DXFs are clean `$INSUNITS=4`.
- `referenced_documents` resolves to "pokryto" with 7 facts but they
  are sometimes phrase fragments rather than drawing numbers — soft
  miss but not blocking.
- 13 of the 38 categories are residential-specific D.1.4 (heating, ZTI,
  ventilation, slaboproud, …) — industrial halls don't have most of
  these. The matrix has them all marked `optional: true` so they don't
  block, but they bloat the denominator (38) so the percentage looks
  worse than it is for non-residential projects.

### SO_250 (road / bridge supporting wall)

**Inventory:**

| Format | Count | Total size | Notes                                       |
|--------|------:|-----------:|---------------------------------------------|
| PDF    | 10    | 6.3 MB     | 1 TZ + 1 statický výpočet + 1 výztuž + 7 výkresy |
| XML    | 1     | 6.3 MB     | UNIXML soupis prací — **PR1 skips**         |
| DXF    | 0     | —          | **None present.**                            |
| DWG    | 0     | —          | None present.                                |

PR1 scanned 11 files, picked up 10 (PDFs), skipped 1 (XML).

**Run results:**
- 10 of 10 PDFs extracted (150 facts).
- 0 DXFs.
- 0 OCR-required.

**Coverage:**
- Total: 38 | **pokryto = 7** | chybi = 31.
- **Score: 18.42 %** | gate_passed: false (16 blocking gaps).
- All 6 DXF-driven categories blocked because no DXF was present.
  Diagnostics correctly fired: `Expected source formats not present in
  upload: dxf, dwg, ifc`.

**Issues found:**
- Residential coverage matrix isn't applicable to a road/bridge
  supporting wall. SO_250 is a `most-objekt` (vyhláška 499/2006 D.2),
  not D.1.1 architectural. The matrix should be `coverage_matrix_road`
  / `coverage_matrix_bridge` (scope of PR3). Running the road project
  against the residential matrix is informative as a stress-test, not
  a quality metric.
- Same exposure_class garbage (97.8 %; 2 valid: `XF3`, `XF4`).
- TZ is text-bearing and gives 7 categories of pokryto — the project
  does have ČSN citations, concrete class, exposure class, reinforcement,
  quantities, identification, and referenced documents.

### Libuse (revisit — full recursive)

> Run complete: 195 supported files probed, 39.47 % coverage (vs the
> earlier "18 % HVAC-only" headline). The HVAC-only number was correct
> for the subset the earlier scan walked into (`sources/D/dxf/`); the
> full recursive walk picks up all the PDF rasters in
> `inputs/_UNSORTED/` + `sources/{A,B,C,D}/pdf/`, the 2 text-bearing
> TZ-flavoured PDFs in `sources/shared/`, and the 6 HVAC DXFs — so the
> improvement is real and measurable.

**Inventory** (recursive, supported extensions only):

| Format | Count    | Notes                                            |
|--------|---------:|--------------------------------------------------|
| PDF    | 115      | 113 architectural rasters + 2 TZ-flavoured       |
| DWG    | 114–192† | All architectural — **PR1 skips**                |
| DXF    | 6        | All HVAC (3× `*_chl.dxf`, 3× `*_vzt.dxf`)        |
| XLSX   | 35–45†   | Tabulky (místnosti, dveře, okna, …) + soupis     |
| DOCX   | 1        | `185-01_DPS_D_SO01_100_0010_R01-TZ.docx` — TZ in DOCX, **PR1 skips** |

† Higher count includes the `_UNSORTED` symlink tree which mirrors
`sources/{A,B,C,D}/`. Deduplicating by real path yields the smaller
count.

**Architecture findings (resolving §3.1 hypotheses):**

The pre-existing PR1 audit reported "18 % coverage" on Libuše and
flagged architectural drawings as missing. With the recursive scan I
ran, the picture is now clear:

- (a) **Architectural files exist in `sources/{A,B,C,D}/`** — yes,
  confirmed. Each Objekt directory has `dxf/`, `dwg/`, `pdf/`. The
  earlier 18 % run only scanned the HVAC DXF subset under
  `sources/D/dxf/`. Hypothesis (a) is partly correct: directory existed,
  initial run didn't recurse into it.
- (b) **Files are in DWG, deliberately excluded from PR1.** ✅ This is
  the dominant case. 114+ DWG files, all architectural půdorysy / řezy
  / pohledy / podhledy / koor_výkresy for Objekty A/B/C/D, vs only
  6 DXFs (all D.1.4 HVAC).
- (c) **PDF drawings are raster, not parsed by PDF TZ adapter.** ✅
  ~113 of the 115 PDFs are raster page exports of the DWGs. PR1's
  pdfplumber routes them through the TZ regex extractor, which finds
  zero concrete/steel/exposure/quantity matches (they only render
  geometry + sparse text labels). The PR1 OCR gate flags any PDF with
  `< 50 chars/page` as `ocr_required`; most raster pdfs in Libuše have
  20–500 chars of legend text, so they pass the gate but extract
  nothing useful. The PDF TZ extractor still emits `referenced_documents`
  / `project_identification` facts for some of them, inflating the
  numerator without surfacing genuine D.1.1 data.
- (d) **No IFC.** No `.ifc` found anywhere.
- (e) **No non-standard naming** preventing detection — extension
  routing was the gating factor.

**Run results:**
- Phase 1 processed 195 source files: 6 DXFs + 189 PDFs (counts from
  manifest; deduplicated to 74 unique files in `phase1/per_source/`
  because the SHA8-prefixed filenames collide for the symlink mirror
  in `inputs/_UNSORTED/` → same content, same hash, same output file
  overwritten — see note below).
- 177 of 189 PDFs extracted successfully (3 679 facts).
- **12 PDFs crashed with `ValueError: could not convert string to float`** — same regex bug as the Libuše-specific finding §3.3 below. Example offending values: `'12\n12'`, `'8\n0'`, `'50\n3'`, `'04\n0'`. 12 lost PDFs.
- All 6 HVAC DXFs (D_{1,2,3}NP_{chl,vzt}.dxf) extracted cleanly with
  `$INSUNITS=4` and reasonable bbox (42–80 m × 63–85 m).
- 0 OCR-required (none of the Libuše PDFs in this run tripped the
  `< 50 chars/page` gate — many are sparse-text drawing renders that
  still pass the gate but don't yield TZ-style facts).

**Coverage:**
- Total: 38 | **pokryto = 15** | chybi = 23.
- **Score: 39.47 %** | gate_passed: false (10 blocking gaps).
- Blocking gaps: same 9 as RD_Jachymov_dum plus `reinforcement` (no
  steel grade detected — the TZ DOCX, which would carry B500B/B500C
  references, isn't readable by PR1).

**Output dir overwrite wart:** `phase1/per_source/<sha8>_<name>.json`
collides when two physical paths point to identical bytes (symlink
mirror in `inputs/_UNSORTED/` vs `sources/A/`). Manifest still lists
all 195 logical phase1 entries, so the JSON record-keeping is correct,
but the on-disk per-source artifact for the duplicate is missing. Cure
for PR2: prefix with both sha8(content) + sha8(path) or just use full
relative path as the filename slug.

**Net conclusion for Libuše:** the earlier 18 % score was an honest
answer to the subset that earlier scan walked. Full recursive scan
yields 39.47 %. Adding DWG support (PR3 §15.1 ODA File Converter
fallback chain) plus a real architectural-drawing vision adapter (PR3
scope) is what raises Libuše coverage further. The TZ DOCX adapter
would recover the reinforcement + wall/foundation/roof system facts
that are presumably in `185-01_DPS_D_SO01_100_0010_R01-TZ.docx`.

## Cross-project comparison

| Project          | Type         | Files (sup./tot.) | Categories pokryto | Score   | Pipeline issues                                  |
|------------------|--------------|-------------------|-------------------:|---------|--------------------------------------------------|
| RD_Jachymov_dum  | residential  | 62 / 64           | 16 / 38            | 42.11 % | 2 mm-as-metres DXFs; 6 OCR-required PDFs; exposure-class garbage |
| hk212_hala       | industrial   | 29 / 51           | 14 / 38            | 36.84 % | 9 DWG + 10 XLSX + 1 XML skipped; exposure-class garbage |
| SO_250           | road/bridge  | 10 / 11           | 7 / 38             | 18.42 % | wrong matrix (residential ≠ road); 1 XML skipped; exposure-class garbage |
| Libuse           | residential  | 195 / ~434‡       | 15 / 38            | 39.47 % | 114+ DWG + 1 DOCX TZ + ~45 XLSX skipped; **12 PDFs ValueError-crashed**; sha8-name collisions in phase1/ |

‡ Includes the `_UNSORTED` symlink mirror. The 195 = unique resolved
files routed through extractors. 434 = total file paths (incl. symlink
duplicates + DWG + XLSX + DOCX + ZIP + JSON metadata). PR1 extracted
74 unique-content phase1 artifacts (overwrite collision from symlink
duplicates).

## Findings

### §3.2 DXF $INSUNITS distribution

Probed 17 DXFs across all 4 projects.

| `$INSUNITS` | Count | Meaning                            | Outcome                                  |
|-------------|------:|------------------------------------|------------------------------------------|
| 4 (mm)      | 15    | Explicit millimetres → `scale=0.001` | Correct bbox in metres                 |
| 0 (unitless)| 2     | Defaulted to metres → `scale=1.0`  | **Wrong** — bbox blows up to thousands of metres |

Distribution: 15 mm + 2 unitless = 12 % of corpus DXFs hit the
mm-as-metres bug. All 6 Libuše HVAC DXFs are clean `$INSUNITS=4`.

Per-DXF detail:

| Project        | File                                    | `$INSUNITS` | bbox (W × H, m)     | Layers | Entities | Verdict                  |
|----------------|-----------------------------------------|------------:|---------------------|-------:|---------:|--------------------------|
| RD_Jachymov_dum| RD Jachymov dum _ DPZ _ 10.dxf          | 4           | 460 × 647           | 53     | 7 476    | OK                       |
| RD_Jachymov_dum| RD Ja_chymov vjezd _ situace 04.dxf     | 0           | 4 722 × 1 687       | 35     | 4 394    | ⛔ mm-as-metres bug      |
| RD_Jachymov_dum| RD Ja_chymov vjezd _ DPZ _ 02.dxf       | 4           | 391 × 368           | 39     | 1 176    | OK                       |
| RD_Jachymov_dum| RD Jachymov dum _ situace 02.dxf        | 0           | 4 722 × 1 687       | 43     | 4 380    | ⛔ mm-as-metres bug      |
| hk212_hala     | A105_zaklady.dxf                        | 4           | 417 × 235           | 40     | 785      | OK                       |
| hk212_hala     | A201_vykopy.dxf                         | 4           | 923 × 178           | 42     | 1 550    | OK                       |
| hk212_hala     | A104_pohledy.dxf                        | 4           | 504 × 15            | 238    | 1 276    | OK (tall layer count)    |
| hk212_hala     | A101_pudorys_1np.dxf                    | 4           | 411 × 159           | 53     | 640      | OK                       |
| hk212_hala     | A107_stroje_kotvici_body.dxf            | 4           | 205 × 159           | 56     | 675      | OK                       |
| hk212_hala     | A102_pudorys_strechy.dxf                | 4           | 409 × 159           | 27     | 213      | OK                       |
| hk212_hala     | A106_stroje.dxf                         | 4           | 205 × 159           | 70     | 1 311    | OK                       |
| libuse         | D_1NP_chl.dxf                           | 4           | 42 × 63             | 13     | (HVAC)   | OK                       |
| libuse         | D_1NP_vzt.dxf                           | 4           | 69 × 69             | 15     | (HVAC)   | OK                       |
| libuse         | D_2NP_chl.dxf                           | 4           | 46 × 63             | 13     | (HVAC)   | OK                       |
| libuse         | D_2NP_vzt.dxf                           | 4           | 68 × 69             | 16     | (HVAC)   | OK                       |
| libuse         | D_3NP_chl.dxf                           | 4           | 80 × 85             | 13     | (HVAC)   | OK                       |
| libuse         | D_3NP_vzt.dxf                           | 4           | 70 × 69             | 14     | (HVAC)   | OK                       |

**Cure recommendation (PR2):** when `$INSUNITS=0`, run a coordinate
magnitude heuristic — if absolute coords routinely exceed 1 000, infer
mm; if they cluster under 100, infer metres. Emit
`decode_warnings[].code = "inferred_units_from_magnitude"` so the
operator sees the inference. The current `_INSUNITS_SCALE.get(0, …)`
default-to-1.0 is silently wrong in 18 % of real residential DXFs.

### §3.3 PDF TZ extraction rate

Across the 279 PDFs probed in all 4 projects:

| Project          | PDFs | Text-extracted | Scanned (OCR-req) | ValueError crashes | Avg facts (text) |
|------------------|-----:|---------------:|------------------:|-------------------:|-----------------:|
| RD_Jachymov_dum  | 58   | 52             | 6                 | 0                  | 13.4             |
| hk212_hala       | 22   | 22             | 0                 | 0                  | 20.4             |
| SO_250           | 10   | 10             | 0                 | 0                  | 15.0             |
| Libuse           | 189  | 177            | 0                 | **12**             | 20.8             |
| **Total**        | **279**| **261** (94 %)| **6** (2 %)     | **12** (4 %)       | **18.6**         |

12 Libuše PDFs and 0 other-project PDFs hit `ValueError: could not
convert string to float: '<N>\n<M>'` — the `_extract_quantities` regex
captures a multi-line number; `.replace(',', '.').replace(' ', '')`
doesn't strip newlines; the `float()` call raises and the whole
document returns zero facts because the exception escapes the
sub-extractor. Examples from the log: `'12\n12'`, `'8\n0'`, `'50\n3'`,
`'04\n0'`. Cure: `.replace('\n', '')` before float, or
`re.sub(r'\s+', '', g)`. Better cure: wrap each sub-extractor in
try/except → `decode_warnings`.

**Exposure-class extraction is a major bug.** Sample reproduction:

```text
exposure_class.class fact values from 81ec6d5f_D_2_1_TZ_statika_dum_TeAnau.pdf:
  XC1   ← valid
  XC3   ← valid
  {     ← garbage
  '     ← garbage
  X     ← garbage
  F     ← garbage
  1     ← garbage
  '     ← garbage
  ,     ← garbage
  …
```

Root cause: `regex_extractor.extract_all()` writes
`results['exposure_classes_found'] = self._find_all_exposure_classes(text)`
which returns a Python `set`. The UEP normalizer
`pdf_tz_extractor._normalise_to_plain()` has no branch for `set`, so it
falls through to `str(obj)` which yields the repr string
`"{'XF1', 'XC1', 'XA1', 'XC2', 'XC3'}"`. The PDF TZ extractor then
runs `for xclass in regex_result.get("exposure_classes_found", []) or []:`
which iterates the string character by character.

Garbage rates per project: **99.1 %** (Jáchymov), **96.9 %** (hk212),
**97.8 %** (SO_250). The exposure_class category technically counts as
"pokryto" because at least one fact exists, but downstream consumers
will choke.

Cure (one line): add `if isinstance(obj, set): return [_normalise_to_plain(v) for v in obj]` early in `_normalise_to_plain`. Or fix `regex_extractor` to return a list. Test fixture: add a `set`-shaped subkey to the normalizer test suite.

### §3.4 Coverage matrix calibration

The 38-category residential matrix was assembled from Žihle + Libuše +
RD Jáchymov pilots + ČSN 73 0540 / 73 0810 + vyhláška 499/2006. Real
extraction surfaces these gaps:

**Categories that always count as `pokryto` because the extractor
emits at least one matching fact (signal/noise check needed):**

- `exposure_class` — emits dozens of garbage facts per TZ (see §3.3).
  Status `pokryto` is misleading; the data is not usable for downstream
  XF/XC routing.
- `dimensions` — `regex_extractor._extract_dimensions` returns
  `floors_underground`, `floors_above_ground`, `height_m`,
  `built_up_area_m2`, `gross_floor_area_m2`. RD Jáchymov returns 2
  values (`floors_underground=1, floors_above_ground=2`) which is
  correct, but for hk212 (single-storey industrial hall) and SO_250
  (no floors at all) the field doesn't translate. The dimension shape
  needs to be project-type aware.

**Categories that are listed in residential matrix but probably belong
to a different matrix (industrial / road / bridge):**

For SO_250 specifically, applying the residential matrix flags 16
blocking gaps that simply don't apply to a most-objekt:
`closed_polygons` (no rooms), `wall_system` (no walls — it's a
retaining wall), `roof_system`, `floor_finishes`,
`windows_doors_specification`, `site_situation` (route stationing,
not vyhláška D.2 koordinační situace), etc. The matrix-per-project-
type split is the v2 task §3.2 plan and the right cure.

**Categories that did appear in the corpus but were not extracted as
facts (PR1 regex gap):**

These all rendered as `chybi → BLOCKING` despite the source PDF
containing the information in narrative form:

| Category                       | Present in TZ but missed because…                                                |
|--------------------------------|----------------------------------------------------------------------------------|
| `wall_system`                  | No regex pattern looks for "stěny / cihly / monolit / kombinovaný".              |
| `foundation_system`            | No regex for "základové pasy / desky / piloty". OTSKP-style elements get extracted but not mapped to this category. |
| `roof_system`                  | No regex for "plochá / sedlová / vegetační" + krytina types.                     |
| `thermal_insulation`           | No regex for "ETICS / minerální izolace / EPS / XPS".                            |
| `facade_finish`                | No regex for "omítka / obklad / dřevěný obklad / klempířina fasády".             |
| `floor_finishes`               | No regex for skladby podlah (PU / dlažba / vinyl / parkety / linoleum).          |
| `windows_doors_specification`  | No regex for okenní + dveřní rozměry / U-value / materiál.                       |
| `fire_safety`                  | No regex for PBŘ headings (D.1.3) + požární úsek references.                     |
| `site_situation`               | `referenced_documents` finds the drawing C.03 by name but no facts for
                                   the actual situace content (the coordination drawing is the source-of-truth, currently parsed as just-another-PDF). |

**Categories to recommend (do NOT add yet — document only):**

- `staircase_geometry` — distinct from `stair_system`; how many flights,
  how many steps. RD Jáchymov + Libuše drawings both have schodišťové
  legendy.
- `room_program` — list of místností + plochy. Tabulka místnosti
  XLSX is the natural source. PR3 XLSX adapter blocked.
- `mep_riser_count` — count of stoupacích potrubí (sanitar + heating).
  Distinct from on/off `water_supply` / `sewer_system`. Libuše
  vykresy_pdf had koor_byt_jader showing risers.

**Categories to recommend dropping (do NOT delete yet — document only):**

- `block_attribs` is marked `optional: true` and rarely appears
  (RD Jáchymov has 2 block_attribs facts across 4 DXFs; hk212 has 0;
  most ArchiCAD exports drop ATTRIBs).
- `dimensions_drawn` is already `optional: true` and present in only
  RD Jáchymov. Keep but consider de-prioritising.
- `block_inventory` is in "pokryto" for every project that has a DXF
  but on industrial halls (hk212) it returns 406 facts for I-beam
  connectors, anchor bolts and machine kotvící body that aren't
  "dveře / okna / sanitar / kuchyně" as the matrix label suggests.
  Same key, very different meaning per project type.

### Adapter gaps

Files in inventory that no PR1 adapter recognised:

| Format | RD_Jachymov | hk212_hala | SO_250 | Libuše* | Action                                 |
|--------|------------:|-----------:|-------:|--------:|----------------------------------------|
| DWG    | 0           | 9          | 0      | ~114    | PR3 §15.1 ODA fallback (mandatory for Libuše/hk212) |
| XLSX   | 1           | 10         | 0      | ~35     | PR3 soupis + tabulky adapters          |
| XLS    | 0           | 2          | 0      | 0       | XLS adapter (xlrd) or skip — minimal impact |
| XML    | 0           | 1          | 1      | 0       | PR3 UNIXML adapter (KROS soupis)        |
| DOCX   | 1           | 0          | 0      | 1       | TZ extractor needs DOCX path (Libuše TZ is DOCX) |
| IFC    | 0           | 0          | 0      | 0       | PR3 IFC adapter — not required for these projects |

*Libuše counts are pre-dedup; exact is in progress.

**Adapter improvements needed for PR2:**

1. **PDF TZ — fix exposure_class set-as-string iteration bug.**
   See §3.3, one-line cure.
2. **PDF TZ — handle multi-line numbers in `_extract_quantities`.**
   Strip `\n` before float conversion. Affects ≥5 Libuše PDFs.
3. **PDF TZ — register `_normalise_to_plain` test fixture for `set`
   and `frozenset` types** to prevent regression.
4. **DXF — coordinate-magnitude heuristic for `$INSUNITS=0`.** Cure
   the mm-as-metres scaling. Emit `decode_warnings`.
5. **DXF — propagate `inferred_units` field into `dxf_meta` so the
   coverage report shows whether scale was deterministic or inferred.**
6. **PDF TZ — when `_extract_quantities` raises, don't lose every
   other category.** Currently a single regex crash in one of 6
   sub-extractors zeros out the whole document. Wrap each subextractor
   in a try/except → `decode_warnings`.

### Architecture findings (corpus statistics)

| Stat                                                        | Value |
|-------------------------------------------------------------|------:|
| Projects scanned                                            | 4     |
| Supported files probed (PDF + DXF, all 4 projects)          | 296   |
| Successful extractions                                      | 278   |
| `Insufficient extractable text` (OCR-needed) PDFs           | 6     |
| `ValueError` regex crashes (PDF TZ)                         | 12    |
| DXFs with `$INSUNITS=0` (silent mm-as-metres bug)           | 2 of 17 (12 %) |
| DWG files present, all skipped                              | ~123  |
| XLSX files present, all skipped                             | ~46   |
| XML soupis files present, all skipped                       | 2     |
| DOCX TZ files present, all skipped                          | 2     |
| IFC files present                                           | 0     |
| PDF-vision-needed drawings (raster, no useful TZ regex hit) | ~113 (Libuše PDFs) |
| Phase1 artifact-overwrite collisions (Libuše)               | ~115 unique-content but symlinked twice — only 74 unique phase1 JSONs written |

## Recommendations for PR2

### Must fix before PR2

1. **PDF TZ `exposure_class` set-as-string iteration bug.** Critical:
   exposure class extraction is the most-relied-on signal for
   durability calculation downstream. 96–99 % garbage rate today.
2. **PDF TZ `_extract_quantities` newline-aware float parse.**
   Critical: at least 5 Libuše PDFs return zero facts because of this
   crash. Could be more in other projects we haven't run yet.
3. **DXF `$INSUNITS=0` coordinate-magnitude inference.** High: 2 of
   11 real DXFs hit this silently. Once a coverage-matrix consumer
   takes a 4 722-m × 1 687-m bbox as truth and tries to allocate
   areas to layers, downstream becomes nonsensical.
4. **Per-subextractor try/except in PDF TZ.** A single failing regex
   should not zero out an entire document's facts.
5. **DOCX adapter for TZ.** Libuše's TZ is DOCX, not PDF. The current
   PR1 architecture trivially supports this — a `DocxTzExtractor`
   class reusing `regex_extractor.extract_all(text)` after `python-docx`
   text extraction. One day of work; large coverage payoff for Libuše
   (currently `project_identification` for Libuše is found from
   raster PDF metadata only).

### Nice-to-have refinements

6. **Split coverage matrix per project type.** Residential coverage
   matrix counts non-applicable categories in the denominator for
   industrial and road projects. Add `coverage_matrix_industrial.yaml`,
   `coverage_matrix_road.yaml`, `coverage_matrix_bridge.yaml`. Note:
   the matrix loader already supports `project_types` filtering — only
   the YAML files are missing.
7. **Coverage report should surface "pokryto with low signal-to-noise"
   warning.** Categories like exposure_class get marked `pokryto` even
   when 99 % of the facts are garbage. Add a `confidence_score` per
   category that downweights when `n_distinct_values >> n_unique_in_format`.
8. **Block-inventory schema awareness.** RD residential blocks (doors,
   windows, sanitary) vs industrial hall blocks (machines, anchors)
   need different downstream routing. Track block_name pattern → role
   mapping in matrix.
9. **`referenced_documents` cross-check vs upload manifest.** Today
   the matrix marks this `optional: true` and accepts any string. PR2
   should diff `referenced_documents` facts against `phase1` source
   files actually uploaded — surface "TZ cites C.03 situace but no
   such drawing in upload" as a real missing-source signal.
10. **OCR routing actually wired.** PR1 flags PDFs as `ocr_required`
    but doesn't call MinerU. PR2 should pick those up and route to
    MinerU Cloud Run.

### Defer to PR3+

11. **DWG adapter via ODA File Converter / LibreDWG fallback chain.**
    PR3 §15.1 scope. Mandatory for Libuše + hk212; large engineering
    effort.
12. **XLSX soupis adapter.** PR3 scope. Libuše alone has ~35 XLSX
    drivers; RD_Jachymov and hk212 also blocked here.
13. **XML UNIXML soupis adapter (KROS).** PR3 scope. SO_250 has its
    soupis in XML; hk212 also has one.
14. **PDF vision adapter for raster drawings.** PR3 §15.4 scope.
    Libuše's 113 raster PDFs are the test case.
15. **IFC adapter.** No IFC in current corpus — defer until a real
    BIM-only project appears.
16. **Coverage `derivation rules registry`.** PR2 §4 — once data
    appears via more adapters, derivation across sources becomes
    interesting (e.g. `room_count` from DXF closed_polygons cross-
    referenced with XLSX tabulka místnosti).

## Acceptance criteria status

| # | Criterion                                                                       | Status      |
|---|---------------------------------------------------------------------------------|-------------|
| 1 | Recursive inventory for all 4 projects                                          | ✅ §Per-project |
| 2 | UEP CLI ran successfully or has documented failure traceback                    | ✅ 4 of 4 done; 18 PDFs have documented per-file failures (6 OCR-required + 12 regex crashes) |
| 3 | Coverage report analysed per project                                            | ✅ §Per-project |
| 4 | Hypotheses (a)–(e) about Libuše architectural drawings resolved with evidence   | ✅ §Libuse — (b) is dominant; (a) partly correct |
| 5 | DXF units distribution documented                                               | ✅ §3.2 — 9 mm + 2 unitless, both unitless are mm-as-metres bug |
| 6 | PDF TZ scan-vs-text ratio documented                                            | ✅ §3.3 — 93 % text-bearing, 7 % OCR-required |
| 7 | Coverage matrix calibration recommendations produced (no YAML edits)            | ✅ §3.4 |
| 8 | Cross-project comparison table complete                                         | ✅ §Cross-project |
| 9 | Single deliverable `UEP_PR1_VERIFICATION.md` committed                          | ✅ This file |
| 10| No production code changes                                                      | ✅ Only PR1 merged from `claude/uep-skeleton-phase1`; no further edits |

## Artifacts

All artifacts retained under `docs/audit/uep_pr1_runs/`:

```
docs/audit/uep_pr1_runs/
├── rd_jachymov_dum_run.log
├── rd_jachymov_dum/
│   ├── manifest.json
│   ├── phase1/per_source/<sha8>_<filename>.json   (62 files)
│   └── phase2/coverage_report.json
├── hk212_hala_run.log
├── hk212_hala/                                     (29 files in phase1/)
├── SO_250_run.log
├── SO_250/                                          (10 files in phase1/)
├── libuse_run.log
├── libuse/                                          (74 unique phase1 JSONs — see overwrite note)
├── dxf_units_distribution.md                        (standalone §3.2 table)
└── inventories/
    ├── RD_Jachymov_dum_inventory.md
    ├── hk212_hala_inventory.md
    ├── SO_250_inventory.md
    └── libuse_inventory.md
```
