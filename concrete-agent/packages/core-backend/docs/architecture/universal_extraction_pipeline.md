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
