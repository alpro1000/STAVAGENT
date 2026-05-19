# TASK — UEP PR3 — Multi-format + Project Types + Robustness

> **STAVAGENT PR3.** Builds on merged PR1 + PR2. Adds DWG/IFC/XML 
> adapters, project type detection, bridge/road/industrial coverage 
> matrices, robustness layers (DWG fallback chain, IFC streaming, IFC 
> version tracking), full MCP tool suite.
> 
> **Reference document:** `docs/tasks/TASK_DocumentExtraction_Universal_Pipeline.md` 
> (v3 spec). This task references §§ from there extensively.
> 
> **Prerequisite:** PR2 merged. Reconciliation + derivation work for 
> residential. Coverage matrix calibration from PR1 verification applied.

---

## MANTRA

> Read repo first (incl. PR1 + PR2 code) → derive naming → confirm 
> remaining interview answers → implement.

---

## §0. CONTEXT

PR1 + PR2 deliver fully-working pipeline for residential projects with 
DXF + PDF inputs. PR3 expands to:
- DWG (most CAD real-world has DWG, not DXF)
- IFC (BIM-native workflows)
- XML structured exports (UNIXML soupis, LandXML for roads)
- Bridge / road / industrial project types

---

## §1. SCOPE

Per v3 task §10 PR3 line:

1. DWG support + fallback chain (v3 §15.1) — ODA File Converter primary, 
   LibreDWG fallback, manual escalation
2. IFC support + version tracking (v3 §15.3 basic) — hash-based versions, 
   `ifc_versions` table, simple diff
3. IFC streaming (v3 §15.4) — tiered thresholds <200MB / 200MB-1GB / >1GB
4. UNIXML adapter (v3 §3.1.3)
5. LandXML adapter (v3 §3.1.3)
6. Project type detection (v3 §4.4)
7. Bridge coverage matrix (v3 §5.2)
8. Road coverage matrix (v3 §5.3)
9. Industrial coverage matrix (new — driven by hk212_hala from PR1 
   verification)
10. Full MCP tool suite (v3 §14.3) — additional tools beyond PR2's 
    `uep_run_extraction`

NOT in PR3:
- gbXML (PR4)
- IFC full diff engine with quantity deltas + narrative (PR4)
- MEP D.1.4 detailed matrices (PR4)
- UI visualization (PR4)

---

## §2. PRE-IMPLEMENTATION INTERVIEW

Confirmed from v3 + PR2:
- Q7: ODA + LibreDWG + IfcOpenShell + lxml all in main Docker image
- Q9: keep all IFC versions indefinitely (Free tier exception: keep 3)
- Q10: fixed streaming thresholds (<200MB / 200MB-1GB / 1GB-2GB / >2GB reject)

**New Q13 — Industrial coverage matrix scope:**
hk212_hala (Hradec Králové průmyslová hala) is a 3000m² production hall. 
Coverage matrix needs:
- (A) Single `industrial` matrix covering all industrial types (haly, 
  továrny, sklady)
- (B) Sub-types: `industrial_hall`, `industrial_warehouse`, 
  `industrial_factory`
- (C) Start with single matrix from hk212 corpus, split later if needed

Recommend **C** (start narrow, expand if pattern emerges).

**New Q14 — DWG conversion service location:**
- (A) Synchronous inside main Cloud Run handler (simple, blocks request)
- (B) Async via Cloud Tasks (job-internal sub-task)
- (C) Separate Cloud Run service (heavy, but isolates ODA binary upgrades)

Recommend **B** (DWG conversion is a job-internal step, fits existing 
job lifecycle from PR2).

**New Q15 — Project type detection ambiguity handling:**
If heuristics return multiple matches with similar confidence:
- (A) Auto-pick highest, log warning
- (B) Return list to user, ask
- (C) Use most-specific (bridge > road > industrial > residential — bridge 
  wins if both bridge and road heuristics fire)

Recommend **B** (avoid silent wrong-matrix use).

---

## §3. BUSINESS LOGIC

### 3.1 DWG fallback chain

Full spec in v3 §15.1. Summary:

```
DWG input → cache check → ODA → success: ezdxf parse
                              ↓ fail
                            LibreDWG → success: ezdxf parse (conf=0.80 lower)
                              ↓ fail  
                            Log to dwg_conversion_attempts table
                            Coverage report flag: "DWG_CONVERSION_FAILED"
                            User notification
```

Implementation:
- Wrapper around `ezdxf.addons.odafc.readfile()` for ODA call
- Subprocess wrapper for `dwg2dxf` (LibreDWG) for fallback
- Cache: `gs://stavagent-dwg-conversion-cache/{file_hash}.dxf`
- Cache invalidation if cached DXF fails to load
- Attempts logged to `dwg_conversion_attempts` table (new Alembic migration)

Confidence: ODA = 0.95, LibreDWG = 0.80, manual = N/A (not extracted)

Unit tests with mock subprocess for both converters covering:
- ODA success → cache hit on rerun
- ODA fail → LibreDWG success
- Both fail → escalation
- Cached DXF corruption → re-conversion

### 3.2 IFC support + version tracking

Full spec in v3 §15.3. Summary:

Adapter via IfcOpenShell:
- `IfcSpace` → místnost
- `IfcSlab` / `IfcWall` / `IfcBeam` / `IfcColumn` / `IfcFooting` → structural
- `IfcDoor` / `IfcWindow` → otvor
- `IfcMaterial` / `IfcMaterialLayerSet` → skladba
- `IfcQuantityArea` / `IfcQuantityVolume` / `IfcQuantityLength` → 
  pre-computed quantity (HIGH confidence 0.95+)
- `IfcPropertySet` → custom properties
- `IfcSpatialStructureElement` → site/building/storey
- `IfcClassificationReference` → external classifications

Version tracking:
- SHA-256 of file content = version identity
- Extract `IfcOwnerHistory` for timestamp/author/app
- Insert `ifc_versions` row linked to project
- Hash dedup: same content → no new version
- Store full archive: `gs://stavagent-ifc-archives/{project_id}/{version_id}/original.ifc`

Basic diff (PR3 scope, full diff PR4):
- Compare two versions by GlobalId
- Output added / removed / modified GlobalId lists
- Summary counts only — no quantity deltas or narrative
- Stored as `ifc_diff_reports` row + JSON in GCS

Re-extraction strategy: PR3 always full re-extract on new version (no 
incremental). If diff >50% changes → STOP condition triggers (per v3 §9 #11).

### 3.3 IFC streaming

Full spec in v3 §15.4. Tiered:

| Size | Strategy | Memory |
|---|---|---|
| <200 MB | Standard full-load | <500MB |
| 200MB-1GB | Partial streaming (geometry iterator + selective full-load) | <1.5GB |
| 1-2 GB | Strict streaming (multi-pass per entity category) | <1.5GB |
| >2 GB | Reject upfront | n/a |

Background RSS monitor every 5 sec. Graceful abort at 95% allocated 
memory rather than OOM crash. Progress reporting per sub-phase via SSE.

Streaming-vs-fullload correctness test: medium IFC (~500MB fixture) 
processed in both modes must produce identical unified schema output.

### 3.4 UNIXML adapter

UNIXML is the ÚRS soupis prací XML format. Parse:
- Root: `polozky` / `cenova_soustava` / `stavba`
- Položky with kódy (OTSKP/URS/RTS), množství, MJ, jednotková cena
- Map to UEP facts with `source_type='unixml'`, `confidence=0.95-1.00`

This is reuse — Žihle project has working UNIXML output. Find existing 
UNIXML parsing code (likely in `app/services/` somewhere), wrap as 
UEP adapter.

### 3.5 LandXML adapter

LandXML for civil engineering (road projects). Parse:
- Root: `LandXML` in namespace `http://www.landxml.org/schema/LandXML-1.2`
- Alignments (osa silnice s staničením)
- Surfaces (DTM — Digital Terrain Model)
- Parcels
- Cross-sections
- Road definitions

Map to UEP facts. Critical for SO_250 road project type.

### 3.6 Project type detection

Per v3 §4.4. Heuristic decision tree:

```
1. Filename or TZ contains "most|mostní|opěra|pilíř mostní"? → bridge
2. Filename or TZ contains "silnice|vozovka|kryt|ŘSD|TKP PK"? → road
3. Filename or TZ contains "průmyslová hala|skladová hala|technologie linka"? 
   → industrial
4. Filename or TZ contains "rodinný dům|bytový dům|obytný|rezidenční"? 
   → residential
5. Only D.1.4 files (no construction drawings)? → mep_only
6. Else → ambiguous, request_user_input per Q15=B
```

Multi-type packages → split into sub-projects, run pipeline per sub-project.

Implementation: heuristic returns confidence per type + list. If top 
two within 0.15 confidence → ambiguous.

### 3.7 New coverage matrices

Create three new YAML files in `B10_coverage_matrices/`:

**`coverage_matrix_bridge.yaml`** — ~40-60 categories per v3 §5.2:
- bridge_element_decomposition
- concrete_grade_per_element
- rebar_specification
- span_length
- bridge_class (ČSN EN 1991-2)
- bearings_specification
- bridge_joints
- temporary_works_concept
- foundation_type (cross-link to geology)
- ...

Calibration source: Žihle 2062-1 + SO_250 D6 + SO-202 D6 corpus.

**`coverage_matrix_road.yaml`** — ~25-40 categories per v3 §5.3:
- staničení_range
- vozovka_skladba (TKP PK chapter 4)
- kryt_typ (ACO/ACL/CB/EAH)
- třída_dopravního_zatížení (TDZ I-VI)
- ...

Calibration source: SO_250 + similar TKP PK projects.

**`coverage_matrix_industrial.yaml`** — ~30-50 categories (new):
- hall_dimensions (length × width × height)
- structural_frame_type (steel / RC / mixed)
- crane_specifications (if applicable)
- floor_loading_capacity (kN/m²)
- foundation_type
- envelope_construction (sandwich panel / brickwork)
- roof_type (membrane / sheet metal / sandwich)
- technology_provisions (compressed air, process media)
- fire_safety_classification (heightened due to scale)
- ...

Calibration source: hk212_hala + analogous projects from corpus.

### 3.8 Full MCP tool suite

Add remaining tools per v3 §14.3 + §14.3 v3 additions:

```
uep_wait_for_completion
uep_get_coverage_report
uep_get_reconciliation_report
uep_get_items
uep_query_facts
uep_apply_derivation
uep_list_applicable_derivations
uep_list_supported_formats
uep_get_coverage_matrix
uep_get_derivation_rule

# v3 additions
uep_get_dwg_conversion_status
uep_list_ifc_versions
uep_get_ifc_diff (basic version — PR4 full)
uep_check_user_quota
```

All registered in existing MCP server. Test that Claude Desktop with 
STAVAGENT MCP can call them.

---

## §4. ACCEPTANCE CRITERIA

### Functional — DWG
1. DWG file uploads, ODA converts successfully, parses as DXF
2. Mock ODA failure → LibreDWG fallback runs, parses with confidence 0.80
3. Both fail → escalation queue entry, coverage report flag, no silent drop
4. Cache hit on re-upload of identical DWG (hash match)
5. Cached DXF corruption auto-invalidates and re-converts

### Functional — IFC
6. IFC file uploads, parses with IfcOpenShell, all 8 entity categories 
   extracted
7. Second upload of same IFC content → no new version (hash dedup)
8. Modified IFC upload → new version row + diff report (basic)
9. Version chain links correctly (v3 → v2 → v1)
10. Streaming thresholds detect correctly (<200MB / 200MB-1GB / 1-2GB / >2GB)
11. 500MB fixture processed in standard and partial streaming modes produce 
    identical output
12. RSS monitor aborts gracefully at 95% memory rather than OOM

### Functional — XML
13. UNIXML soupis parses položky with kódy + množství + MJ + cena
14. LandXML alignment with staničení range extracts correctly
15. Unknown XML namespace → user prompt for identification, no silent skip

### Functional — Project types
16. Project type detection works on RD_Jachymов (→ residential), 
    Žihle (→ bridge), SO_250 (→ road), hk212 (→ industrial)
17. Ambiguous project (mixed signals) returns list to user
18. End-to-end runs on Žihle + SO_250 + hk212 produce coverage reports 
    using their respective matrices

### Functional — Coverage matrices
19. `coverage_matrix_bridge.yaml` ≥40 categories, calibrated from Žihle 
    + SO-250 + SO-202 + SO-250 corpus
20. `coverage_matrix_road.yaml` ≥25 categories
21. `coverage_matrix_industrial.yaml` ≥30 categories, calibrated from hk212

### Functional — MCP
22. All 13 new MCP tools callable from Claude Desktop with API key
23. Free tools (5) accessible without API key, paid tools (8) require it

### Architecture
24. DWG conversion runs as Cloud Tasks sub-task within job (Q14=B)
25. IFC streaming peak memory verified ≤1.5GB on 1GB+ fixture
26. New tables (ifc_versions, ifc_diff_reports, dwg_conversion_attempts) 
    created via Alembic
27. New GCS buckets created (dwg-conversion-cache, ifc-archives, ifc-diffs)

### Testing
28. Unit tests per adapter (DWG, IFC, UNIXML, LandXML)
29. Integration tests per project type (bridge, road, industrial, residential)
30. Streaming-vs-fullload IFC equivalence test
31. DWG fallback chain test scenarios (4)
32. IFC versioning test scenarios (3)
33. All previous tests still pass (PR1 35 + PR2 ~50 + PR3 new = target ~120)

### Documentation
34. `docs/architecture/format_support_matrix.md` listing all supported 
    formats + version compatibility (per v3 acceptance #28)
35. `docs/architecture/universal_extraction_pipeline.md` updated with 
    PR3 features

### Cost
36. Per-project full UEP run costs (v3 §7.10):
    - Residential: ≤$5
    - Bridge: ≤$15
    - Road: ≤$10
    - Industrial: ≤$10
37. DWG conversion not billed (offline binary)
38. IFC parsing not billed (offline lib)

---

## §5. STOP CONDITIONS

(beyond v3 §9 universal conditions)

1. ODA File Converter EULA acceptance issue in Docker build → STOP, 
   ask user (might need manual one-time accept in image)
2. IfcOpenShell binary native libs fail to load on Cloud Run → STOP, 
   check apt deps (libgl1 libglu1-mesa per v3 §14.9)
3. Žihle / SO_250 / hk212 corpus reveals coverage matrix categories 
   not yet considered → STOP, log, ask user before adding to matrix
4. IFC streaming 500MB fixture exceeds memory budget in tests → STOP, 
   investigate, do not raise memory limit silently
5. UNIXML existing parser cannot be wrapped cleanly (incompatible API) 
   → STOP, ask if rewrite acceptable

---

## §6. NAMING & PR

Branch: `claude/uep-pr3-multiformat-projecttypes`  
PR: open at end of session, request review.  
Title: `feat(uep): PR3 — DWG/IFC/XML + bridge/road/industrial + robustness`

Multiple commits per logical area (mirroring PR1/PR2 atomic style). 
Suggested 15-20 commits total.

---

## §7. ROLLOUT NOTE

PR3 doubles supported formats and project types. Risk of regressions 
on residential is non-zero. Required:
- Run RD_Jachymов regression test before opening PR
- Diff items.json output vs PR2 baseline for residential — should be 
  identical (no behavior change for residential paths)

---

**End of PR3 task.**

> Reminder: Every new format = new adapter following PR1 pattern. Every 
> new project type = new YAML matrix in B10_coverage_matrices/. No core 
> pipeline changes.
