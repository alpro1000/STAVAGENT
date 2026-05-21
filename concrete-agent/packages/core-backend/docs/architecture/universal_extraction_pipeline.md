# Universal Extraction Pipeline (UEP)

> Status after PR2 (Phase 3 + Phase 4 + REST + concurrency landed).
> Updated 2026-05-19.

## TL;DR

```
project files → [Phase 1: extractors]
              → [Phase 2: coverage matrix]
              → [Phase 3: reconciliation engine]
              → [Phase 4: derivation registry (caller-driven)]
              → artefacts (coverage_report.json, reconciliation_report.json, …)
```

Five surface layers:

| Layer       | Path                                                | Status (PR2) |
|-------------|-----------------------------------------------------|--------------|
| CLI         | `scripts/uep_run_e2e.py`                            | PR1 |
| REST        | `app/api/routes_uep.py`                             | PR2 ✅ |
| SSE stream  | `GET /api/v1/projects/{pid}/uep/jobs/{jid}/stream`  | PR2 ✅ |
| MCP tool    | `uep_run_extraction` (15 credits)                   | PR2 ✅ |
| Cloud Tasks | gated by `UEP_USE_CLOUD_TASKS=1`                    | PR2 stub; live in PR3 |

## Phase 1 — extractors

Per-source adapters emit `PerSourceExtraction(facts, raw_data, decode_warnings)`.

| Source format    | Extractor                                                       | Status |
|------------------|-----------------------------------------------------------------|--------|
| DXF              | `app/services/uep/dxf_extractor.py`                             | PR1 + PR2 `$INSUNITS=0` heuristic |
| PDF TZ           | `app/services/uep/pdf_tz_extractor.py`                          | PR1 |
| passport_schema  | `app/services/uep/passport_adapter.py` (MergedSO duck-typed)    | PR2 (read-only, conf=0.95) |
| DWG / IFC / XML  | placeholder formats in `SourceFormat`; extractors land in PR3   | PR3 |
| XLSX soupis      | placeholder; PR3 wraps existing parsers                          | PR3 |

DXF $INSUNITS=0 heuristic: samples up to 200 coord magnitudes from the
modelspace, filters near-zero values, median > 1000 → `mm`, 1 < median
≤ 1000 → `m`, else `m_low_signal`. Surfaces the choice via
`decode_warnings[].code = "inferred_units_from_magnitude"` and inside
the `dxf_meta` facts evidence.

## Phase 2 — coverage matrix

`app/services/uep/coverage_engine.py` + YAML in
`app/knowledge_base/B10_coverage_matrices/`.

Residential matrix shipped in PR1. Bridge / road / industrial in PR3.

## Phase 3 — reconciliation engine (PR2)

`app/services/uep/reconciliation_engine.py` + YAML in
`app/knowledge_base/B11_reconciliation_rules/`.

Compares facts across sources via tolerance bands. Each rule declares
`(left_source, right_source, join_on, compare_field, tolerance,
on_match, on_mismatch, severity)`. Critical conflicts block the Phase 3
gate (`ReconciliationReport.gate_passed() == False`).

Residential rule set has 10 rules calibrated from the pre-Cemex audit
+ Žihle patterns + PR1 verification:

1. geometry_room_area_agreement (DXF vs XLSX, ±2 %, critical)
2. concrete_class_tz_vs_drawing (exact, critical)
3. exposure_class_tz_vs_drawing (exact, critical)
4. reinforcement_steel_grade (exact, critical)
5. total_volume_tz_vs_soupis (±2 %, important)
6. total_area_tz_vs_soupis (±2 %, important)
7. passport_concrete_grade_check (passport wins, important)
8. passport_reinforcement_check (passport wins, important)
9. tz_referenced_documents_in_upload (informational soft-flag)
10. geology_xa_vs_concrete_exposure (critical, gated on PR3 pdf_geology)

## Phase 4 — derivation registry (PR2)

`app/services/uep/derivation_registry.py` + YAML in
`app/knowledge_base/B12_derivation_rules/`.

15 universal rules with restricted Python expression formulas. The
registry refuses any unknown rule_id (`UnknownDerivationRule`
exception, 404 in REST, error in MCP). Restricted eval scope: only
`pi`, `ceil`, `floor`, `min`, `max`, `sqrt`, `abs`, `round`, `sin`,
`cos`, `tan`, `radians`, `degrees`. No `__builtins__`, no imports.

Rule list:

```
wall_area_from_perimeter_height          → wall_area_m2
tile_partial_height_area                 → tile_area_m2
ceiling_area_from_floor                  → ceiling_area_m2  (flat only)
concrete_volume_rectangular              → concrete_volume_m3
concrete_volume_cylindrical              → concrete_volume_m3
rebar_kg_from_volume_norm                → reinforcement_mass_kg
formwork_area_rectangular                → formwork_area_m2
roof_area_from_footprint_pitch           → roof_area_m2
opening_area_subtraction                 → wall_net_area_m2
linear_count_from_polyline_length        → linear_count_ks
staircase_step_count_from_height_riser   → step_count_ks
plinth_area_from_perimeter_height        → plinth_area_m2
parapet_volume_from_length_section       → parapet_volume_m3
excavation_volume_from_footprint_depth   → excavation_volume_m3
external_perimeter_total_from_polygon    → perimeter_m
```

## Job lifecycle + concurrency (PR2)

`app/services/uep/job_runner.py` + `concurrency_validator.py`. States:

```
queued → running → completed
              ↘ failed
              ↘ cancelled
       ↘ throttled (PR3 queue mode opt-in)
```

Pre-run validation order:

1. Per-project lock → 409 (unless `force_rerun=true`)
2. Concurrent jobs   → 429 `concurrent_limit`
3. Sliding 15-min    → 429 `sliding_window_limit`
4. Daily total       → 429 `daily_limit`

Tier table (`app/knowledge_base/B13_tier_limits/tier_limits.yaml`):

| Tier        | Concurrent | Daily | Per-project | Burst 15 min |
|-------------|-----------:|------:|------------:|-------------:|
| free        |          1 |     5 |           1 |            2 |
| starter     |          2 |    25 |           1 |            5 |
| pro         |          5 |   100 |           1 |           15 |
| business    |         10 |     0 |           1 |           30 |
| enterprise  |         50 |     0 |           5 |          100 |

`daily_jobs=0` means unlimited (Business + Enterprise).

## Alembic migration (PR2 — NOT auto-applied)

`alembic/versions/2026_05_19_uep_job_lifecycle.py` creates:

- `uep_jobs` (UUID PK; partial unique index on `(project_id)` where
  `state IN (queued, running)` enforces per-project lock at the DB
  layer)
- `tier_limits` (singleton-per-tier; seeded from YAML at app startup)
- `user_tier_overrides` (Enterprise per-user upgrades)
- `sliding_window_starts` (append-only job start log; pruned by cron
  to keep the last 24 h)

Apply manually post-merge: `alembic upgrade head`.

## REST surface

See [docs/api/uep_rest_api.md](../api/uep_rest_api.md).

## MCP tool

`uep_run_extraction(project_id, project_dir, project_type, force_rerun,
user_id)` — 15 credits. Returns `{job_id, state, stream_url,
estimated_cost_credits}` or `{error, ...}` on validation failure.

## Tests

| Suite                                      | Count |
|--------------------------------------------|------:|
| schemas (PR1)                              |     9 |
| extractor_base (PR1)                       |     6 |
| dxf_extractor (PR1 + PR2 $INSUNITS=0)      |     7 |
| pdf_tz_extractor (PR1)                     |  4 (+2 skipped) |
| coverage_engine (PR1)                      |    10 |
| e2e_residential (PR1)                      |     2 |
| reconciliation_engine (PR2)                |    10 |
| derivation_registry (PR2)                  |    15 |
| passport_adapter (PR2)                     |     6 |
| concurrency_validator (PR2)                |    12 |
| rest_api (PR2)                             |    15 |
| mcp_tool (PR2)                             |     7 |
| **TOTAL**                                  | **101 + 2 skip** |

## Known PR2 follow-ups (carry to PR3)

- DWG / IFC / XML extractors (per task §3, PR3).
- Live Cloud Tasks dispatcher (`UEP_USE_CLOUD_TASKS=1` + queue setup).
- Cloud SQL `SnapshotFetcher` running inside SERIALIZABLE transaction.
- Bridge / road / industrial coverage matrices + reconciliation rules.
- Auto-derive in the job runner (PR2 leaves derivation caller-driven
  via POST /api/v1/projects/{pid}/uep/derivation).
- Full MCP tool suite — PR3 finishes
  (`uep_wait_for_completion`, `uep_get_coverage_report`,
  `uep_get_reconciliation_report`, `uep_get_items`, `uep_query_facts`,
  `uep_apply_derivation`, `uep_list_applicable_derivations`,
  `uep_list_supported_formats`, `uep_get_coverage_matrix`,
  `uep_get_derivation_rule`, `uep_get_dwg_conversion_status`,
  `uep_list_ifc_versions`, `uep_get_ifc_diff`, `uep_check_user_quota`).

---

## §15.3 — IFC diff engine (PR4b-1 foundation, PR4b-2 advanced)

PR4b-1 ships the foundation: per-entity snapshot capture inside the
IFC extractor + Alembic tables (`ifc_versions`, `ifc_diff_reports`)
+ basic deterministic diff engine + 3 REST endpoints + 31 tests.
PR4b-2 layers quantity deltas, material composition diff, property
set diff, severity classification rules, and the
`uep_get_ifc_diff` MCP tool on top — all of those slot into
`IfcDiffReport.report_payload` (open JSONB dict) + the flat
`severity` column without further migration.

### Schemas (`app/models/ifc_diff_schemas.py`)

| Type | Role |
|------|------|
| `IfcEntitySnapshot` | One per IfcRoot instance: global_id + ifc_type + name + object_type + storey + quantities + material_layers + property_sets + sha-256 `payload_hash`. |
| `IfcVersionMetadata` | One per upload — file/schema/strategy + entity_counts + entity_snapshots list. Backed by the `ifc_versions` table. |
| `IfcDiffReport` | Top-level diff record (one per (old, new) pair). Carries `add/remove/modify` lists, `IfcCategoryCount[]`, flat counts + severity, open `report_payload` dict. |
| `IfcCategoryCount` | One row per IfcType observed in either side, with old/new/delta. Row kept even when one bucket is 0 (surfaces "everything of type X removed"). |
| `IfcEntityChange` | Per-entity audit-trail row: change_kind, ifc_type, global_id, old_snapshot, new_snapshot. |
| `IfcChangeSeverity` | Enum: `unscored` (PR4b-1 default) / `cosmetic` / `minor` / `moderate` / `major` / `scope_change` (PR4b-2). |

### Diff algorithm (`app/services/uep/ifc_diff_engine.py`)

Pure-function module, one public entry point:

```python
compute_basic_ifc_diff(
    *, project_id, old_version_id, new_version_id,
    old_snapshots, new_snapshots
) -> IfcDiffReport
```

Keyword-only parameters so callers can't swap old/new by accident.

Identity model — **GlobalId only** (per IFC4 §5.1.3.1.7, the only
stable carrier across Revit / Allplan / ArchiCAD round-trips).
Name / ObjectPlacement / IsDefinedBy order are all volatile.

Modified detection — `payload_hash` (SHA-256 over canonical-JSON of
`{ifc_type, name, object_type, storey, quantities, material_layers,
property_sets}`) is recomputed on every extraction. Drift in any of
those flips the hash → "modified" bucket. `global_id` +
`payload_hash` itself are EXCLUDED from the hash (identity is keyed
by GlobalId; chicken-and-egg for the hash field).

Three buckets:
- `added`   — GlobalId ∈ new \ old
- `removed` — GlobalId ∈ old \ new
- `modified` — GlobalId ∈ old ∩ new with `payload_hash` drift
- Same GlobalId + same hash → unchanged, **skipped** from the report
  (otherwise the dashboard would drown in noise).
- GlobalId change is NOT "modified" — it's an add + remove pair (the
  entity has lost identity).

Guard rails — `ValueError` on:
- `old_version_id == new_version_id` (no-op comparison; UI bug
  protection)
- empty GlobalId on either side (extractor contract violation —
  silent drop would inflate the OTHER side's add/remove bucket)
- duplicate GlobalId in one extraction (IFC contract violation)

### Extractor extension (`app/services/uep/ifc_extractor.py`)

`_emit_entity_snapshots(model)` traverses 12 IfcRoot subtypes
(`IfcSite`, `IfcBuilding`, `IfcBuildingStorey`, `IfcSpace`,
`IfcWall`, `IfcWallStandardCase`, `IfcSlab`, `IfcBeam`, `IfcColumn`,
`IfcFooting`, `IfcDoor`, `IfcWindow`) and for each builds an
`IfcEntitySnapshot`-shaped dict. Stored in
`PerSourceExtraction.data["entity_snapshots"]`.

Defensive — `ifcopenshell.util.element` is preferred (handles schema
variants for us), but every helper has a manual `IsDefinedBy` /
`HasAssociations` / `ContainedInStructure` fallback for older
ifcopenshell wheels or schema gaps. Allplan / Revit / ArchiCAD all
emit slightly different `IfcRel*` wiring; we record what we find
and skip the rest without raising.

### REST endpoints (`app/api/routes_uep.py`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/uep/ifc/versions` | Persist one IFC extraction as a `ifc_versions` row. Body: project_id + file/schema/strategy + entity_counts + entity_snapshots. Returns 201 + `{version_id, project_id, upload_timestamp}`. |
| `GET` | `/api/v1/uep/ifc/versions?project_id=<UUID>` | List project's versions, recent-first. Lean view (no snapshots) — UI picker. |
| `GET` | `/api/v1/uep/ifc/diff/{old}/{new}` | Cached diff if exists, computed + cached if not. Cross-project diff rejected with 400. |

Auth — same X-User-Id dev seam as `/uep/run` (PR3 wires real JWT).
Path traversal — all path parameters UUID-validated before reaching
filesystem builders.

### Storage (filesystem in PR4b-1, Postgres in PR4b-2)

PR4b-1 persists rows to JSON files under
`UEP_DATA_DIR/ifc_versions/{project_id}/{version_id}.json` and
`UEP_DATA_DIR/ifc_diff_reports/{project_id}/{old}_{new}.json`. The
filesystem backend mirrors the Alembic CHECK constraints (schema +
strategy enums) so the swap is behaviour-preserving — only the
storage layer changes. PR4b-2 introduces the SQLAlchemy + asyncpg
session pattern (paired with the MCP tool wrapper that also needs
DB access).

### Example diff payload

```json
{
  "diff_id": "8f3a7c12-...",
  "project_id": "...",
  "old_version_id": "...",
  "new_version_id": "...",
  "generated_at": "2026-05-20T10:00:00Z",
  "severity": "unscored",
  "total_added": 1,
  "total_removed": 1,
  "total_modified": 1,
  "category_counts": [
    {"ifc_type": "IfcSlab", "old_count": 1, "new_count": 0, "delta": -1},
    {"ifc_type": "IfcWall", "old_count": 2, "new_count": 3, "delta":  1}
  ],
  "entity_changes": [
    {"change_kind": "added",    "ifc_type": "IfcWall", "global_id": "W3", "old_snapshot": null, "new_snapshot": {...}},
    {"change_kind": "removed",  "ifc_type": "IfcSlab", "global_id": "S1", "old_snapshot": {...}, "new_snapshot": null},
    {"change_kind": "modified", "ifc_type": "IfcWall", "global_id": "W2", "old_snapshot": {...}, "new_snapshot": {...}}
  ],
  "report_payload": {},
  "diff_engine_version": "1.0"
}
```

### PR4b-2 hooks

PR4b-2 fills `report_payload` with:
- `quantity_deltas_by_type` — `{IfcWall: {total_area_m2: {from, to, delta, pct}}, ...}`
- `material_composition_changes` — per-entity `IfcMaterialLayerSet` layer-level diff
- `property_set_changes` — per-entity `IfcPropertySet` value-level diff
- `severity_rules_fired` — list of rule IDs that produced the flat `severity` flip

Flat `severity` column flips from `unscored` to one of
{cosmetic, minor, moderate, major, scope_change} per the rule table
in task §3.3.

`uep_get_ifc_diff` MCP tool wrapper lands alongside — thin shim over
the REST endpoint above.

### PR4b-1 commit chain

| Commit | Subject |
|---|---|
| `77e195a` | feat(uep): PR4b-1 — IFC diff schemas + ifc_versions/ifc_diff_reports tables |
| `12774a4` | feat(uep): capture per-entity snapshots in IFC extractor for PR4b diff |
| `6bf76b9` | feat(uep): add basic IFC diff engine — add/remove/modify by GlobalId + per-type counts |
| `45a76fb` | test(uep): PR4b-1 IFC diff foundation — 31 tests covering hash + coercion + diff math + counts + guard rails |
| `bff8adc` | feat(uep): IFC version + diff REST endpoints + mount routes_uep router |
| (this commit) | docs: PR4b-1 §15.3 cross-ref in UEP arch doc + soul.md §9 entry |

Reference: `docs/tasks/TASK_UEP_PR4.md` §3.3 + AC 8, 13.
