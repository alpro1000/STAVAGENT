# P3 — Live end-to-end runbook (document → quantified-elements)

**Type:** manual / staged operating procedure (NOT a CI gate)
**Test:** `concrete-agent/packages/core-backend/tests/test_p3_live_e2e_orchestrate.py`
**Design:** `docs/specs/doc_to_quantified_elements/design.md` §8.3 + §12

This is the one **live** seal for the whole phased plan. The offline goldens (P1
join, P2 recipe wiring) deliberately mock the engine and the document tools; this
runbook exercises the **real stack** end-to-end through `/orchestrate`:

> real Postgres session store · Portal-JWT principal · real `extract_tz_fields` +
> `parse_construction_budget` · P1 join · live Monolit calculator · `export_soupis`.

The test is **opt-in and skipped by default** (`STAGEGATING_LIVE_E2E` unset →
SKIPPED). CI collects it only to keep it import-clean; it never gates a merge.

---

## What it proves

With `options['documents']` (the real SO-202 KROS XML soupis + TZ text) and **no
caller-supplied `elements`**, the live run asserts:

1. `DOCUMENT_ANALYSIS` invoked **`extract_tz_fields` + `parse_construction_budget`**
   — the P2 wiring fired against the real parsers;
2. `WORK_ATOMIZATION` produced **verified work items** from the *extracted +
   joined* quantities (not a caller value);
3. resume → `status: completed`, `workflow_state: EXPORTED`, `COMMITTED` invoked
   **`export_soupis`** — the rendered deliverable;
4. *(opportunistic, if the response surfaces committed outputs)* the ingest
   `quantification_warnings` carry `origin: "ingest:soupis_vs_geometry"` (pin A).

"GREEN" = the single test passes (not skipped).

---

## Prerequisites

| Need | How |
|---|---|
| **Postgres** | a reachable PostgreSQL; `DATABASE_URL=postgresql://user:pass@host:5432/db` |
| **MCP schema** | apply `concrete-agent/packages/core-backend/migrations/*.sql` in sorted order (the orchestrator session/audit tables) |
| **Monolit engine** | `MONOLIT_API_URL` — defaults to the live Cloud Run engine (`…/api/calculate`); override to point at a local/staging Monolit |
| **JWT secret** | `JWT_SECRET` — the same Portal secret the server validates against; used to mint the test principal |
| **Real inputs** | the SO-202 XML soupis (`E_Soupis praci_XC4_DI-009.xml`) + the TZ text extracted from `202_01_TechnickaZprava.pdf` — both in `test-data/SO_202_D6_OV_Z/` |
| **Deps** | `httpx`, `pyjwt` (already in the backend env) |

---

## Steps

### 1. Stand up Postgres + schema
```bash
export DATABASE_URL='postgresql://user:pass@localhost:5432/concrete_e2e'
cd concrete-agent/packages/core-backend
for f in $(ls migrations/*.sql | sort); do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

### 2. Run the server (real DB + JWT + engine)
```bash
export JWT_SECRET='<same secret the Portal/server validates>'
# optional — defaults to the live Cloud Run engine:
# export MONOLIT_API_URL='http://localhost:3001'
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Mint a Portal JWT (claims must match `require_principal`)
```bash
export STAGEGATING_E2E_JWT=$(python - <<'PY'
import os, uuid, jwt
print(jwt.encode(
    {"userId": str(uuid.uuid4()), "email": "e2e@test.local", "role": "user"},
    os.environ["JWT_SECRET"], algorithm="HS256"))
PY
)
```

### 4. Point at the running endpoint + the real inputs
```bash
export STAGEGATING_LIVE_E2E=1
export STAGEGATING_E2E_ORCHESTRATE_URL='http://localhost:8000/api/v1/orchestrate'
# XML works since Gap A (PR #1324): the tool content-sniffs the format and routes
# KROS XML to the KROS parser. The env-var name (_XLSX) is historical — it takes
# any soupis path; the test only reads bytes + filename.
# absolute paths — pytest runs from core-backend, so don't rely on cwd-relative
REPO="$(git rev-parse --show-toplevel)"
export STAGEGATING_E2E_SOUPIS_XLSX="$REPO/test-data/SO_202_D6_OV_Z/E_Soupis praci_XC4_DI-009.xml"
export STAGEGATING_E2E_TZ_TXT='/tmp/so202_tz_pagemarked.txt'
```
> Extract the page-marked TZ text with the canonical extractor (one-liner, run
> from `concrete-agent/packages/core-backend`):
>
> ```bash
> PYTHONPATH=. python -c "from pathlib import Path; from app.mcp.tools.document import _extract_pdf_text; Path('/tmp/so202_tz_pagemarked.txt').write_text(_extract_pdf_text(Path('../../../test-data/SO_202_D6_OV_Z/202_01_TechnickaZprava.pdf')), encoding='utf-8')"
> ```
>
> The TZ `.txt` should be the page-marked extracted text (as `extract_tz_fields`
> consumes); if you only have a PDF, extract it first or pass it via a
> `tz_file_base64` variant (the recipe accepts either).

### 5. Run the single test
```bash
cd concrete-agent/packages/core-backend
pytest tests/test_p3_live_e2e_orchestrate.py -v -s
```

---

## Variant — hit a deployed instance instead of local
Skip steps 1–2; set `STAGEGATING_E2E_ORCHESTRATE_URL` to the deployed
`…/api/v1/orchestrate` and mint the JWT with **that** environment's `JWT_SECRET`.
The deployed Postgres + Monolit are already wired; you only supply the JWT + inputs.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401` on submit | JWT minted with the wrong `JWT_SECRET`, or wrong claim names (must be `userId`/`email`/`role`) |
| test SKIPPED | an env var is unset (`STAGEGATING_LIVE_E2E`, URL, JWT, or the two file paths) — the skip reason names which |
| `parse_construction_budget` not in `tools_invoked` | the soupis file did not decode/parse — must be a KROS XML or an XLSX workbook (an unrecognized format is an honest error since PR #1324, not a silent 0) |
| `work_items_verified == 0` | the TZ text yielded no elements, or the join matched none — verify the TZ `.txt` carries the named elements + concrete classes |
| connect/timeout to Monolit | `MONOLIT_API_URL` unreachable; calc honest-blanks but the pipeline still completes — steps 1–3 assertions still hold |

---

## CI note
The MCP-compat workflow includes this file in its run-list so CI **collects** it
and prints `… SKIPPED` (proof it imports cleanly + the gate works). It is never a
merge gate — the live seal is this manual procedure.
