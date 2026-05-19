# UEP REST API — PR2 surface

> Implemented in `app/api/routes_uep.py`. All routes under
> `/api/v1`. Auth seam: `X-User-Id` header (PR3 wires JWT
> middleware).

## Job lifecycle

### `POST /api/v1/projects/{project_id}/uep/run`

Start a UEP run.

**Body** (`JobStartRequest`):

```json
{
  "project_type": "residential",
  "force_rerun": false,
  "project_dir": "/abs/path/to/project"
}
```

**201 Created** (`JobStartResponse`):

```json
{
  "job_id": "...",
  "state": "queued",
  "queue_dispatch": "in_process",
  "stream_url": "https://host/api/v1/projects/{pid}/uep/jobs/{jid}/stream",
  "estimated_cost_credits": 15
}
```

**409 Conflict** when project already has an active job:

```json
{
  "error": "project_locked",
  "message": "Project ... has an active job ...",
  "existing_job_id": "...",
  "existing_state": "running"
}
```

**429 Too Many Requests** when tier limit hit (header
`Retry-After: <seconds>`):

```json
{
  "error": "concurrent_limit" | "sliding_window_limit" | "daily_limit",
  "message": "...",
  "tier": "pro",
  "retry_after_seconds": 60,
  "limit": 5,
  "current": 5
}
```

### `GET /api/v1/projects/{project_id}/uep/jobs/active`

List queued / running jobs for the project.

### `GET /api/v1/projects/{project_id}/uep/jobs/{job_id}`

Get a `JobInfo` snapshot. 404 when job_id ≠ project_id or unknown.

### `GET /api/v1/projects/{project_id}/uep/jobs/{job_id}/stream`

SSE stream of `JobEvent` records. First frame is `event: snapshot`
with the current `JobInfo`; subsequent frames are
`event: progress` with `JobEvent`s. Stream closes on the terminal
event (state ∈ {completed, failed, cancelled}). 30-second keep-alive
comments while idle.

### `DELETE /api/v1/projects/{project_id}/uep/jobs/{job_id}`

Cancel a queued / running job. Returns
`{"job_id": "...", "state": "cancelled"}`.

## Results

### `GET /api/v1/projects/{project_id}/uep/coverage-report`

Returns the JSON dump of the most recent completed job's
`coverage_report.json` artefact. 404 when no completed job.

### `GET /api/v1/projects/{project_id}/uep/reconciliation-report`

Same shape for `reconciliation_report.json`.

### `GET /api/v1/projects/{project_id}/uep/derived-quantities`

Returns `{project_id, derived_quantities: []}`. PR2 derivations are
caller-driven and not persisted; PR3 hooks this to a persistent
`derived_quantities` table.

## Derivation (Phase 4)

### `POST /api/v1/projects/{project_id}/uep/derivation`

Apply a derivation rule.

**Body**:

```json
{
  "rule_id": "wall_area_from_perimeter_height",
  "inputs": [
    {"name": "perimeter_m", "value": 40.0, "unit": "m", "confidence": 1.0},
    {"name": "height_m",    "value": 2.7,  "unit": "m", "confidence": 0.95}
  ]
}
```

**200 OK** — full `DerivedQuantity` with formula + inputs + confidence
+ references.

**404** when `rule_id` not in the registry.
**400** when required input missing or unit mismatch.

### `GET /api/v1/projects/{project_id}/uep/derivation/applicable-rules?output_quantity=...&inputs=name1,name2`

Returns `{output_quantity, applicable: [{rule_id, required_inputs_satisfied,
missing_inputs, optional_inputs_satisfied, description}, ...]}` sorted
easiest-to-satisfy first.

## Configuration introspection

| Endpoint                                                  | Purpose |
|-----------------------------------------------------------|---------|
| `GET /api/v1/uep/config/coverage-matrices/{project_type}` | Raw YAML for the project type. |
| `GET /api/v1/uep/config/derivation-rules`                 | `{rule_ids, count}` of registered derivations. |
| `GET /api/v1/uep/config/reconciliation-rules`             | `{project_type, rules:[{id,description,severity}]}`. |
| `GET /api/v1/uep/config/tier-limits`                      | `{tiers: {tier: TierLimits}}` for all 5 tiers. |
| `GET /api/v1/uep/config/supported-formats`                | `{formats: [SourceFormat strings]}`. |

## Status code reference

| Code | Meaning                                                          |
|-----:|------------------------------------------------------------------|
| 200  | Existing job snapshot / config response                          |
| 201  | New job queued                                                   |
| 400  | Bad input (missing required field, unit mismatch on derivation)  |
| 404  | Job / artefact / matrix / derivation rule not found              |
| 409  | Per-project lock collision (POST /uep/run)                       |
| 429  | Tier limit hit (Retry-After header)                              |
| 503  | (PR3) DB / Cloud Tasks unavailable                               |

## Env vars

| Var                                  | Purpose                                                              |
|--------------------------------------|----------------------------------------------------------------------|
| `UEP_DATA_DIR`                       | Base dir for job artefacts (default `data/uep`).                      |
| `UEP_DEFAULT_TIER`                   | Tier for unauthenticated callers (default `pro`).                     |
| `UEP_USE_CLOUD_TASKS`                | `1` to dispatch via Cloud Tasks (PR3 wires the worker).               |
| `UEP_CLOUD_TASKS_QUEUE`              | Full queue resource name (when Cloud Tasks enabled).                  |
| `UEP_CLOUD_TASKS_WORKER_URL`         | Worker URL (e.g. `…/_internal/uep/worker/run`).                       |
| `UEP_CLOUD_TASKS_SERVICE_ACCOUNT`    | Optional SA email for OIDC token attached to Cloud Tasks payloads.    |
