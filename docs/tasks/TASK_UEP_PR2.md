# TASK — UEP PR2 — Reconciliation + Derivation + REST + Concurrency

> **STAVAGENT PR2.** Builds on merged PR1. Adds Phase 3 (reconciliation), 
> Phase 4 (derivation), REST API surface, job orchestration, tier-based 
> concurrency control, DXF unit heuristic, passport_schema bridge.
> 
> **Reference document:** `docs/TASK_DocumentExtraction_Universal_Pipeline.md` 
> (the v3 spec). This task references §§ from there. Do NOT re-derive 
> architecture — follow v3.
> 
> **Prerequisite:** `docs/audit/UEP_PR1_VERIFICATION.md` review complete. 
> Calibration recommendations from verification applied to coverage 
> matrix (separate small PR).

---

## MANTRA

> Read repo first (incl. merged PR1 code) → derive naming from existing 
> conventions → ASK Pre-Implementation Interview → implement.

---

## §0. CONTEXT

PR1 delivered:
- Extractor adapter pattern (DXF + PDF TZ)
- Coverage matrix engine
- 35 unit tests passing

PR2 adds the "thinking" layers on top: reconciliation between sources, 
rule-based derivation, plus the user-facing surface (REST + jobs + limits).

---

## §1. SCOPE

Per v3 task §10 PR2 line:

1. Reconciliation engine + rules (v3 §3.3 + §4.3)
2. Derivation registry + 15 universal rules (v3 §3.4 + §6)
3. REST API surface (v3 §14.2)
4. Job lifecycle pattern + Cloud Tasks integration (v3 §14.5)
5. Tier-based concurrent job limits (v3 §15.2)
6. First MCP tool: `uep_run_extraction` (v3 §14.3)
7. DXF `$INSUNITS=0` heuristic (PR1 open question #4)
8. `passport_schema.MergedSO` → UEP facts bridge (PR1 open question #7)

NOT in PR2:
- DWG / IFC / XML adapters (PR3)
- Project type detection (PR3)
- Bridge / road / industrial coverage matrices (PR3)
- Full MCP tool suite (PR3 finishes)
- IFC versioning / streaming (PR3)
- UI changes (PR4)

---

## §2. PRE-IMPLEMENTATION INTERVIEW

Most interview answers already given in PR1 session. Confirmed defaults:

**Q3 — Derivation strictness:** configurable per project type (v3 Q3 = C).
- residential: A (return derived + needs_human_review, pipeline continues)
- bridge / road / industrial / mep: A (same default for now; bridge may 
  tighten later)
- Configurable via `default_derivation_strictness` field in coverage matrix YAML

**Q4 — Reconciliation tolerance:**
- Geometry (m, m², m³): ±2% strict default
- Material classifications: exact match
- Counts: exact match
- Configurable per project type via `reconciliation_rules_<type>.yaml`

**Q8 — Tier model + concurrency:**
- Storage: Cloud SQL table (`tier_limits` + `user_tier_overrides`)
- Per-project lock: strict (≤1 active job per project unless force_rerun)
- Rate limiting: sliding window 15 min
- Tier values:

| Tier | Concurrent | Daily | Per-project | Burst (15min) |
|---|---|---|---|---|
| Free | 1 | 5 | 1 | 2 |
| Starter (100cr) | 2 | 25 | 1 | 5 |
| Pro (500cr) | 5 | 100 | 1 | 15 |
| Business (2000cr) | 10 | ∞ | 1 | 30 |
| Enterprise | configurable | ∞ | configurable | configurable |

**New Q11 — Cloud Tasks vs in-process asyncio:** strongly Cloud Tasks 
(v3 §14.5 rationale — survives instance eviction, retry, dedup). If 
deployment constraints force in-process for PR2 — STOP, ask user.

**New Q12 — passport bridge direction:**
- (A) UEP reads passport facts as authoritative `source_type='passport_schema'` 
  confidence 0.95, reconciliation rules can compare against extractor facts
- (B) UEP writes its facts back into passport_schema as another source
- (C) Bidirectional

Recommend **A** for PR2 (read-only consume). B/C is future scope.

Ask only if unclear from repo state.

---

## §3. BUSINESS LOGIC

### 3.1 Reconciliation engine

Reference v3 §3.3.

Inputs:
- Phase 1 outputs (per-source facts from PR1 extractor registry)
- `reconciliation_rules_<project_type>.yaml` (loaded from same B-prefix 
  location as coverage matrices)

Rule structure (per v3 §3.3):
```yaml
rules:
  - id: <string>
    description: <string>
    left_source: <source type or pattern>
    right_source: <source type or pattern>
    join_on: <field>
    compare_field: <field>
    tolerance: { type: percentage|absolute|exact, value: <number> }
    on_match: confirm | confirm_and_boost_confidence
    on_mismatch: flag_conflict | drawing_wins | tz_wins | regex_wins
    severity: critical | important | informational
```

Implement 10 universal rules from v3 §3.3:
1. Geometric agreement (DXF room area vs table room area, ±2%)
2. Schedule completeness (every F-/S-/OP-kód referenced is defined)
3. Cross-reference resolution (every "viz výkres X" target loaded)
4. Material spec consistency (třída betonu TZ vs výkres výztuže)
5. Quantity vs geometry (soupis position × unit price total vs calculator total)
6. Domain crossing (geologie XA exposure → statika beton class min)
7-10: documented in `reconciliation_rules.yaml` based on v3 §3.3 examples

Per rule output:
```yaml
matches:
  - left_evidence: <ref to Phase 1 fact>
    right_evidence: <ref to Phase 1 fact>
    join_value: <shared identifier>
    status: confirmed | conflict | left_only | right_only
    delta: <numeric difference if applicable>
    resolution: <if conflict: which side won + why>
```

Output: `reconciliation_report.json` per project.

Phase 3 gate:
- Report exists
- Critical conflicts → auto-generate VYJASNĚNÍ entry
- Informational conflicts → log, do not block

### 3.2 Derivation registry

Reference v3 §3.4 + §6.

Registry structure: `derivation_rules.yaml` (B-prefix location).

15 universal starter rules (per v3 §6):
1. `wall_area_from_perimeter_height`
2. `tile_partial_height_area` (requires explicit `tile_height_m` from TZ)
3. `ceiling_area_from_floor` (only if flat ceiling)
4. `concrete_volume_rectangular`
5. `concrete_volume_cylindrical`
6. `rebar_kg_from_volume_norm` (uses B-KB rebar matrix)
7. `formwork_area_rectangular`
8. `roof_area_from_footprint_pitch`
9. `opening_area_subtraction`
10. `linear_count_from_polyline_length`
11. `staircase_step_count_from_height_riser`
12. `plinth_area_from_perimeter_height`
13. `parapet_volume_from_length_section`
14. `excavation_volume_from_footprint_depth`
15. `external_perimeter_total_from_polygon`

Each rule:
- output_quantity name + unit
- formula expression with named placeholders
- required_inputs (list with units)
- optional_inputs with adjustment semantics
- confidence_formula (e.g. `min(input_confidences) * 0.95`)
- validity_conditions (free-text guard)
- references (ČSN norms)

Engine API:
- `apply_derivation(rule_id, inputs)` — validates inputs against rule, 
  computes, returns derived fact with full audit trail
- `list_applicable_derivations(quantity_name, available_inputs)` — 
  returns rules that could compute given the inputs

Server-side enforcement: `apply_derivation` PHYSICALLY refuses to compute 
without registered rule_id. There is no "compute arbitrary formula" tool.

### 3.3 REST API surface

Reference v3 §14.2 for full list.

PR2 implements:

```
POST   /api/v1/projects/{project_id}/uep/run
GET    /api/v1/projects/{project_id}/uep/jobs/{job_id}
GET    /api/v1/projects/{project_id}/uep/jobs/{job_id}/stream  (SSE)
DELETE /api/v1/projects/{project_id}/uep/jobs/{job_id}
GET    /api/v1/projects/{project_id}/uep/jobs/active

GET    /api/v1/projects/{project_id}/uep/coverage-report
GET    /api/v1/projects/{project_id}/uep/reconciliation-report
GET    /api/v1/projects/{project_id}/uep/derived-quantities
GET    /api/v1/projects/{project_id}/uep/items
GET    /api/v1/projects/{project_id}/uep/facts
GET    /api/v1/projects/{project_id}/uep/audit-log

POST   /api/v1/projects/{project_id}/uep/derivation
GET    /api/v1/projects/{project_id}/uep/derivation/applicable-rules

GET    /api/v1/uep/config/coverage-matrices/{project_type}
GET    /api/v1/uep/config/derivation-rules
GET    /api/v1/uep/config/reconciliation-rules
GET    /api/v1/uep/config/tier-limits
```

Status codes per v3 §14.2.

Naming and routing convention: derive from existing FastAPI routes in 
`packages/core-backend/app/api/` (or wherever PR1 lives — Claude Code 
verifies).

### 3.4 Job lifecycle + Cloud Tasks

Reference v3 §14.5.

Tables to create (Cloud SQL):
- `uep_jobs` — lifecycle, phases, progress, cost
- `tier_limits` — Q8 storage
- `user_tier_overrides` — enterprise overrides
- `sliding_window_starts` — rate limit tracking

Alembic migration committed.

Cloud Tasks queue: `uep-extraction-queue`. Max concurrent 10 initial.

Job states: queued → running → completed | failed | cancelled. Plus 
throttled (waiting on concurrent slot) if queue mode enabled.

Pre-run validation in `SERIALIZABLE` transaction (per v3 §15.2.3):
1. Per-project lock check → 409 if conflict
2. Concurrent limit check → 429 if exceeded
3. Sliding window check → 429 with Retry-After
4. Daily limit check → 429 with reset time

Force_rerun=true cancels existing project job + bypasses lock check 
(other checks still apply).

### 3.5 First MCP tool integration

Add `uep_run_extraction` to existing MCP server (the one running on 
Cloud Run at `concrete-agent-3uxelthc4q-ey.a.run.app/mcp` with 9 existing 
tools).

Tool definition per v3 §14.3:
- Paid (15-25 credits depending on project size — estimate by file count 
  pre-run)
- Returns `job_id` immediately
- Async — user polls or uses `uep_wait_for_completion`

Test that ChatGPT custom GPT can call it via existing OAuth flow.

### 3.6 DXF `$INSUNITS=0` heuristic

Modify existing DXF adapter from PR1.

Algorithm:
```python
header_units = doc.header.get('$INSUNITS', 0)
if header_units == 0:
    # Heuristic: sample coordinate magnitudes
    sample = get_first_n_coord_magnitudes(doc, n=100)
    median_magnitude = statistics.median(sample)
    if median_magnitude > 1000:
        inferred_unit = 'mm'
        warning = 'dxf_units_inferred: mm (heuristic from coord magnitude)'
    elif median_magnitude > 1:
        inferred_unit = 'm'
        warning = 'dxf_units_inferred: m (heuristic from coord magnitude)'
    else:
        raise DxfUnitsAmbiguous(...)
```

All extracted dimensions normalized to meters in output schema. Inferred-unit 
warning surfaces in coverage report metadata.

Add 3 unit tests:
- DXF with explicit `$INSUNITS=4` (mm) — no heuristic triggered
- DXF with `$INSUNITS=0` and large coords — mm inferred + warning
- DXF with `$INSUNITS=0` and small coords — m inferred + warning

### 3.7 passport_schema.MergedSO bridge

Existing system has `passport_schema.MergedSO` — authoritative project 
structure built from prior workflows. UEP reconciliation engine consumes 
it as another source.

Integration:
- Add adapter `passport_schema_adapter.py` that reads MergedSO instances 
  and emits unified Phase 1 facts with `source_type='passport_schema'`, 
  `confidence=0.95`
- Reconciliation engine treats passport facts as authoritative when 
  comparing with extractor facts
- No two-way write — UEP reads only

Source location: from existing `extraction_to_facts_bridge.py` (2561 LOC, 
already in repo). Wrap, don't rewrite.

---

## §4. ACCEPTANCE CRITERIA

### Functional
1. Reconciliation engine runs after Phase 1, produces `reconciliation_report.json`
2. Derivation registry loads 15 universal rules, all unit-tested
3. End-to-end on RD_Jachymov: PR1 phases still pass + new Phase 3 + 
   Phase 4 add derived values + reconciliation findings to `items.json`
4. REST API endpoints respond per spec (201 / 200 / 4xx as documented)
5. Job lifecycle works: queued → running → completed, Cloud Tasks 
   dispatches correctly
6. Concurrent limit enforced: tier-limited user gets 429 on 6th concurrent 
   run (Pro tier = 5)
7. Per-project lock enforced: second run on same project returns 409 
   (unless force_rerun=true)
8. Sliding window enforced: 16th start in 15min from Pro user returns 
   429 with Retry-After
9. MCP tool `uep_run_extraction` callable from Claude Desktop with API key
10. DXF unit heuristic: RD_Jachymов DXF with $INSUNITS=0 correctly 
    parses dimensions in meters with warning
11. passport_schema adapter reads MergedSO, produces unified facts, 
    reconciliation compares against extractor facts

### Architecture
12. Reconciliation rules in YAML, not hard-coded
13. Derivation rules in YAML, not hard-coded
14. `apply_derivation` server-side refuses unregistered rule_id (Pydantic 
    enum or DB lookup, not string compare)
15. Cloud SQL tables created via Alembic migration
16. REST routes follow existing FastAPI router patterns (no parallel 
    structure)

### Testing
17. Unit tests for reconciliation engine (10 universal rules × 3 test 
    cases each)
18. Unit tests for derivation registry (15 rules × 3 test cases each, 
    including failure paths)
19. Integration test: full pipeline on RD_Jachymов test corpus, asserts 
    items.json deltas vs PR1 baseline
20. Concurrency tests: 7 simulated concurrent POSTs, exactly 5 succeed 
    for Pro tier user (SERIALIZABLE transaction isolation verified)
21. All tests pass: existing 35 + new ones (target ~80-100 total)

### Documentation
22. `docs/architecture/universal_extraction_pipeline.md` updated with 
    Phase 3 + Phase 4 + API surface
23. New `docs/api/uep_rest_api.md` documenting endpoints, status codes, 
    examples

### Cost
24. Total PR2 added cost per typical residential e2e: ≤ $1.50 (reconciliation 
    runs deterministically, derivation deterministically, AI fallback only 
    if Phase 1 missed regex tokens — already covered by PR1 budget)

---

## §5. STOP CONDITIONS

1. Cloud Tasks setup blocked by Cloud Run config issue → STOP, ask user 
   (might need in-process fallback temporarily)
2. Alembic migration breaks existing prod schema → ROLLBACK, STOP, ask
3. Existing `extraction_to_facts_bridge.py` doesn't have clean MergedSO 
   access pattern → STOP, ask if wrapper layer needed
4. RD_Jachymов PR1 baseline items.json broken by reconciliation merge → 
   STOP, do not modify items.json silently, ask user
5. Tier limit configuration table can't be created (permissions) → STOP

---

## §6. NAMING & PR

Branch: `claude/uep-pr2-reconciliation-derivation-rest`  
PR: open at end of session, request review (do not merge).  
Title: `feat(uep): PR2 — reconciliation + derivation + REST + concurrency`

Naming convention: derive from PR1 conventions (`packages/core-backend/app/services/uep/`, 
`packages/core-backend/app/knowledge_base/B*/`). Extend, don't parallel.

---

## §7. RECOMMENDED COMMIT GROUPING

Atomic commits (mirroring PR1 style):
1. `feat(uep): reconciliation engine schemas + base classes`
2. `feat(uep): reconciliation engine + 10 universal rules YAML`
3. `feat(uep): derivation registry + 15 universal rules YAML`
4. `feat(uep): DXF $INSUNITS heuristic + tests`
5. `feat(uep): passport_schema MergedSO adapter`
6. `feat(uep): job lifecycle schemas + Cloud SQL Alembic migration`
7. `feat(uep): tier limits + concurrency validator`
8. `feat(uep): REST API surface — job + result endpoints`
9. `feat(uep): Cloud Tasks integration`
10. `feat(uep): MCP tool uep_run_extraction`
11. `test(uep): reconciliation + derivation + concurrency suites`
12. `docs(uep): PR2 architecture + REST API`

---

**End of PR2 task.**

> Reminder: PR1 patterns are the canonical foundation. Reuse extractor 
> registry, schemas, coverage engine. Build on top, don't restructure.
