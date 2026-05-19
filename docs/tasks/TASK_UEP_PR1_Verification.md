# TASK — UEP PR1 Verification on Real Corpus

> **STAVAGENT verification task.** Run already-merged PR1 UEP pipeline 
> on three real projects from `test-data/`, document findings, identify 
> calibration gaps before PR2. NO production code changes — verification 
> only.

---

## MANTRA

> 1. Read repo first — fully scan `test-data/` directory tree
> 2. Do not modify pipeline code — only run, observe, report
> 3. Findings → input for PR2 calibration

---

## §0. CONTEXT

PR1 merged. Pipeline components ready:
- DXF adapter via ezdxf
- PDF TZ adapter via pdfplumber + regex
- Coverage matrix engine
- `coverage_matrix_residential.yaml` (38 categories)
- e2e CLI: `packages/core-backend/scripts/uep_run_e2e.py`

Earlier Libuše D run reported 18% coverage. The number is correct for 
HVAC-only inputs, but user reports architectural drawings exist for that 
project — they may be in DWG (excluded from PR1) or in a sibling directory 
not scanned. This verification task resolves the discrepancy AND tests 
the pipeline on diverse project types.

---

## §1. SCOPE — three target projects

Per user direction, validate on:

1. **`test-data/RD_Jachymov_dum`** — residential (N=5 pilot baseline)
2. **`test-data/hk212_hala`** — industrial hall
3. **`test-data/SO_250`** — road/bridge supporting wall

Plus **revisit `test-data/Libuse*`** — confirm or correct the "HVAC-only" 
assumption from PR1 report. If architectural DXFs exist in a directory 
not scanned by initial run, document and re-run.

---

## §2. PER-PROJECT WORKFLOW

For each project, execute the following sequence:

### 2.1 Full inventory (recursive)

```bash
find test-data/<project_name> -type f \
  -name "*.dxf" -o -name "*.dwg" -o -name "*.ifc" \
  -o -name "*.pdf" -o -name "*.xlsx" -o -name "*.xml" -o -name "*.csv"
```

Produce per-project `inventory.md`:
- File path (relative to project root)
- Format
- Size (KB/MB)
- Inferred role (architectural / HVAC / structural / TZ / soupis / geology / drawings / other)

Inference hints:
- Filename contains `chl|vzt|topeni|UT` → HVAC/MEP
- Filename contains `pudorys|řez|pohled|architektura|A101|A102` → architectural
- Filename contains `vyztuz|statika|D.1.2` → structural
- Filename contains `TZ|technická` and is PDF → technical report
- Filename contains `soupis|VV|vykaz` → quantities
- Filename contains `geologie|IGP` → geology

### 2.2 Run UEP

```bash
python packages/core-backend/scripts/uep_run_e2e.py \
  --project-root test-data/<project_name> \
  --project-type residential  # or industrial / road — try matching type
```

Capture full stdout + stderr. Save as `<project_name>_run.log`.

If pipeline crashes — capture traceback, do NOT fix, document as finding.

If pipeline runs but coverage 0% — investigate. Likely adapter didn't 
match files (wrong extensions? unexpected nested directory? language 
encoding?). Document root cause.

### 2.3 Coverage analysis

For each project's coverage report:

```
- Categories filled (count and list)
- Categories partial (count and list)
- Categories missing (count and list)
- Missing categories: which source format would have provided them?
  (per coverage_matrix_residential.yaml `expected_in` field)
- Was the source format file present in inventory but not extracted? 
  (parser gap) OR was the file format absent? (input gap)
```

### 2.4 Cross-project comparison

Tabulate:

| Project | Type | Files | Categories filled | Score | Pipeline issues |
|---|---|---|---|---|---|
| RD_Jachymov | residential | N | X | Y% | ... |
| hk212_hala | industrial | N | X | Y% | ... |
| SO_250 | road | N | X | Y% | ... |
| Libuse (full) | residential | N | X | Y% | ... |

For industrial (hk212) and road (SO_250), residential matrix won't fit — 
expect very low coverage. Document which categories from residential 
matrix don't apply, suggesting need for industrial/road-specific matrices 
(scope of PR3).

---

## §3. KNOWN OPEN QUESTIONS TO INVESTIGATE

### 3.1 Libuše D architectural drawings

User confirms architectural drawings exist. Hypotheses to test:

- (a) Architectural DXFs exist in a sibling directory not scanned by 
  initial run (`libuse/sources/A/`, `libuse/sources/B/`, `libuse/sources/C/`, 
  or `libuse/sources/D/architektura/` etc.)
- (b) Architectural files are DWG, deliberately excluded from PR1
- (c) Architectural files are PDF drawings (raster), not parsed by 
  current PDF TZ adapter (vision adapter is PR3 scope)
- (d) Architectural files are in IFC format (PR3 scope)
- (e) Files are present but with non-standard extensions or naming 
  preventing adapter recognition

Run full recursive inventory of `test-data/Libuse*` (whatever the 
actual directory name is — verify first). Document which hypothesis 
applies.

### 3.2 DXF `$INSUNITS=0` heuristic

Earlier finding: RD_Jachymov DXFs have coords in mm but header object 
unitless. Test on all DXF files across three projects:

- For each DXF, read header `$INSUNITS`
- If value is 0 (unitless): check coordinate magnitude — if abs(coords) 
  routinely > 1000, infer mm
- Document distribution: how many DXFs have explicit units, how many 
  unitless, how many would need heuristic

Output: `dxf_units_distribution.md` table.

### 3.3 PDF TZ extraction success rate

For each PDF in inventory marked as TZ:
- Was it text-based or scanned? (test with pdfplumber — empty text = scanned)
- If text-based, how many regex tokens were extracted? Spot-check a few 
  for accuracy
- Document scanned vs text ratio across corpus — drives need for vision 
  fallback in PR2/PR3

### 3.4 Coverage matrix calibration

Residential matrix has 38 categories. Based on running on RD_Jachymov 
(real residential N=5 pilot):

- Which categories were over-engineered (never appear in real residential 
  projects)?
- Which categories are missing (real residential needs but matrix doesn't 
  list)?
- Suggest add/remove for matrix v2 (do NOT modify YAML in this task — 
  just document recommendations)

---

## §4. DELIVERABLES

Single output document: `docs/audit/UEP_PR1_VERIFICATION.md`

Structure:
```
# UEP PR1 Verification — Real Corpus Findings

## Executive summary
[3-5 sentences]

## Per-project results
### RD_Jachymov_dum
- Inventory
- Run results
- Coverage analysis
- Issues found

### hk212_hala
[same structure]

### SO_250
[same structure]

### Libuse (revisit)
[same structure]

## Cross-project comparison table

## Findings

### DXF units distribution
[table]

### PDF TZ extraction rate
[table + spot-check examples]

### Coverage matrix calibration
- Categories to remove (over-engineered): [list]
- Categories to add (real-world gaps): [list with rationale]
- Categories that need wording adjustment: [list]

### Adapter gaps
- Files in inventory that no adapter recognized: [list with format/role]
- Adapter improvements needed for PR2: [list]

### Architecture findings
- DWG presence across projects: [stats]
- IFC presence: [stats]
- XML presence: [stats]
- Vision-needed PDFs: [stats]

## Recommendations for PR2

### Must fix before PR2
[ordered list]

### Nice-to-have refinements
[ordered list]

### Defer to PR3+
[list with justification]
```

---

## §5. ACCEPTANCE CRITERIA

1. All four projects (RD_Jachymov_dum, hk212_hala, SO_250, Libuse) have 
   recursive inventory documented
2. UEP CLI ran successfully or has documented failure traceback for each
3. Coverage report analyzed for each project
4. Hypotheses (a)-(e) about Libuše architectural drawings resolved with 
   evidence
5. DXF units distribution documented across all DXFs in corpus
6. PDF TZ scan-vs-text ratio documented
7. Coverage matrix calibration recommendations produced (do NOT edit 
   YAML — document only)
8. Cross-project comparison table complete
9. Single deliverable `UEP_PR1_VERIFICATION.md` committed to 
   `docs/audit/`
10. NO production code changes in this task

---

## §6. STOP CONDITIONS

1. UEP CLI crashes on first project → STOP, ask user if to debug 
   (this might block PR2 if fundamental) or skip and document
2. Project directory structure unexpectedly different from assumed 
   `test-data/<name>/...` layout → STOP, ask user
3. Discovery indicates PR1 pipeline has fundamental flaw (not just 
   adapter coverage gaps) → STOP, alert user before continuing
4. Verification taking longer than ~2 hours wall time → STOP, report 
   partial findings, ask user prioritization

---

## §7. NAMING & PR

Branch: `claude/uep-pr1-verification`  
PR: do NOT open. Push commits, present `UEP_PR1_VERIFICATION.md` content 
in final report.

Naming convention for new files (if any): per existing `docs/audit/` 
patterns.

---

**End of task.**

> Reminder: this is verification, NOT new development. Read repo, run 
> pipeline, observe, report. Findings drive PR2 calibration.
