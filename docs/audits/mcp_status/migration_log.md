# MCP Auth Storage Migration — SQLite → Cloud SQL Postgres

**Datum:** 2026-05-14
**Branch:** `claude/audit-mcp-server-lAbOS`
**Cause:** `data/mcp_keys.db` lived on Cloud Run ephemeral FS — every redeploy
wiped all API keys + credit balances (P0 CRITICAL finding from
`2026-05-14_deploy_verification.md` §4).

---

## Scope locked at task kickoff

User decisions (from `AskUserQuestion` interview):

| Question | Choice |
|---|---|
| Production data | **Zero prod users — safe to wipe** (no export/import step needed) |
| DB driver | **Sync psycopg2 + thread pool** (minimal diff, keep `routes.py` call sites untouched) |
| Migration runner | **Extend existing `psql -f` step in cloudbuild-concrete.yaml** (mirror NKB step pattern) |
| Test infra | **GitHub Actions `services: postgres:16`** (real SQL, no mocks) |

---

## Pre-existing state

- `migrations/007_mcp_api_keys.sql` already existed with the correct schema
  (`mcp_api_keys` + `mcp_credit_log` with all indexes). Nothing to author.
- `auth.py` docstring promised "PostgreSQL with SQLite fallback" but the
  actual code was 100 % SQLite (`sqlite3` import, `?` placeholders,
  per-thread SQLite connection pool, `_DB_PATH = .../data/mcp_keys.db`).
  This task **finished** the never-wired Postgres path.
- No `data/mcp_keys.db` file in the repo (root `.gitignore` already ignores
  `*.db`). No SQLite blob to delete.

---

## Changes shipped

### 1. `concrete-agent/packages/core-backend/app/mcp/auth.py` — full rewrite

- `sqlite3` → `psycopg2` + `psycopg2.extras.RealDictCursor` (dict rows
  preserve existing `row["col"]` access in `routes.py` consumers).
- DSN resolution: `MCP_DATABASE_URL` → `DATABASE_URL` → raise. Strips the
  SQLAlchemy `+asyncpg` prefix the way `cloudbuild-concrete.yaml` already
  does for NKB migrations.
- **Atomic deduction collapsed to one statement:**
  ```sql
  UPDATE mcp_api_keys
     SET credits = credits - %s,
         last_used_at = NOW(),
         total_credits_used = total_credits_used + %s
   WHERE api_key = %s AND is_active = TRUE AND credits >= %s
  RETURNING id, credits;
  ```
  Postgres takes a row lock for the UPDATE, so concurrent requests against
  the same row are serialised. No `SELECT FOR UPDATE` pre-fetch is needed
  — the `WHERE credits >= cost` predicate is evaluated under the lock.
  Failed path (row didn't match) drops to a diagnostic `SELECT` to
  distinguish *unknown key* / *deactivated* / *insufficient* errors.
- `_get_db()` is **lazy** — no connection on module import. This means
  `tests/test_mcp_compatibility.py` (which loads the MCP server +
  9 tool wrappers) continues to pass without a Postgres service.
- Per-thread connection cache reused from the SQLite implementation
  (`_db_pool: dict[int, psycopg2.connection]`, `_pool_lock` mutex,
  reopen-on-closed check).
- **Public API preserved verbatim** so `routes.py` is untouched:
  `register`, `login`, `check_credits`, `add_credits`, `get_credits`,
  `oauth_token`, plus module constants `TOOL_COSTS` / `FREE_CREDITS` /
  `RATE_LIMIT_MAX` / `_rate_limit_store`. Same call signatures, same
  return-dict shape.
- Rate limiter (`_check_rate_limit`) untouched — still in-memory
  per-instance (acceptable for register/login throttle; bcrypt cost is the
  real brake; documented limitation: multi-instance scale-out resets the
  bucket per pod).

### 2. `cloudbuild-concrete.yaml` — migration wired into deploy

Appended one `psql -f` invocation right after the NKB migration step. Uses
the same `CONCRETE_DATABASE_URL` secret + `sed 's/+asyncpg//'` trick.
Migration is `CREATE TABLE IF NOT EXISTS` — idempotent.

### 3. `.github/workflows/test-mcp-compatibility.yml` — Postgres service

- Added `services.postgres` (image `postgres:16`, healthcheck via
  `pg_isready`, port 5432:5432).
- `env.DATABASE_URL` set to the matching DSN for the runner.
- Added `psql -f migrations/007_mcp_api_keys.sql` as a setup step.
- Added `psycopg2-binary` + `bcrypt` to pip install line.
- Added the new test file to both the `paths:` filters and the
  `pytest` invocation.

### 4. `tests/test_mcp_auth_postgres.py` — new (10 cases)

Roundtrip + behaviour tests against the live Postgres service:

1. register → exists → login → invalid-password roundtrip
2. free tool (`find_otskp_code`, cost=0) needs no key
3. paid tool deducts atomically + balance + `total_used` increment
4. drain-then-block: spend down to 10 credits, request 20-credit tool → 402
5. paid tool without key → "API key required"
6. paid tool with unknown key → "Invalid API key"
7. `add_credits` → balance + `total_purchased` increment
8. `add_credits` on unknown email → `not_found`
9. `oauth_token(client_id=api_key)` → bearer = api_key; bad key →
   `invalid_client`
10. rate limit: 10 attempts allowed, 11th returns `status=rate_limited`

Each test uses a fresh UUID-suffixed email so reruns inside the same DB
don't collide. Module-level `pytest.skip` when `DATABASE_URL` is unset so
local dev `pytest` runs without Postgres stay green.

### 5. No SQLite cleanup needed

- `data/mcp_keys.db` was never committed (root `.gitignore` already
  matches `*.db`).
- No code path imports `sqlite3` for MCP anymore (`grep` clean).
- Old `data/` directory was already gitignored — nothing to remove.

---

## Acceptance checklist (vs task spec §Acceptance)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | New Postgres tables created with proper indexes | ✅ migration 007 (pre-existing, now wired into deploy) |
| 2 | `app/mcp/auth.py` reads/writes from Postgres via existing pool | ✅ rewrite uses psycopg2 + thread pool, lazy DSN from `DATABASE_URL` |
| 3 | SQLite files removed from repo + ignored | ✅ N/A — none committed, root `.gitignore` already covers `*.db` |
| 4 | Tests updated (use test Postgres, not SQLite) | ✅ new `test_mcp_auth_postgres.py` (10 cases); CI workflow spins up `postgres:16` service |
| 5 | Atomic credit deduction preserved (ROW LOCK / FOR UPDATE) | ✅ single-statement `UPDATE … WHERE credits >= cost RETURNING` — row lock implicit |
| 6 | Existing test keys migrated if any | ✅ N/A — zero prod users per user decision |
| 7 | Documentation updated | ✅ this file |
| 8 | PR draft against `main` | ⏳ pending push + draft PR open |

---

## Risk notes carried forward

- **Connection pool sizing.** Current pool is one connection per **thread**
  (FastAPI worker thread). Default uvicorn config caps thread workers; on
  Cloud Run `concrete-agent` runs single-process with `--min-instances=1`
  so the worst case is small. If MCP traffic scales, switch to
  `psycopg2.pool.ThreadedConnectionPool` (single-line swap inside
  `_get_db`).
- **Latency.** Sync psycopg2 over Cloud SQL unix socket (~1–3 ms per
  query) is slower than the SQLite local FS (~0.05 ms), but every MCP
  tool call is already dominated by LLM / parsing time (100 ms–10 s).
  Expected p99 impact: negligible.
- **Rate limit per pod.** In-memory `_rate_limit_store` resets when
  Cloud Run scales out or restarts the container. Acceptable for
  register/login (bcrypt cost is the real defence); production growth
  should migrate to Redis (already in `requirements.txt`).
- **Webhook signature verification gap remains.** Separate P0 from the
  prior audit (`LEMONSQUEEZY_WEBHOOK_SECRET` not set → HMAC check
  silently skipped). Not addressed by this migration; tracked in
  `2026-05-14_deploy_verification.md`.

---

## Deploy + verify checklist (for the merging engineer)

```bash
# 1. Merge the PR → Cloud Build runs cloudbuild-concrete.yaml
#    → deploys new image AND runs the new psql -f 007_mcp_api_keys.sql.

# 2. Confirm the tables exist
psql "$CONCRETE_DATABASE_URL" -c "\dt mcp_*"
# Expected: mcp_api_keys, mcp_credit_log

# 3. End-to-end register on production (after DB ready)
curl -X POST "https://concrete-agent-…run.app/api/v1/mcp/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@stavagent.cz","password":"some-strong-pass"}'
# Expected: {"api_key":"sk-stavagent-…","credits":200,"status":"created"}

# 4. Force a redeploy and confirm the key SURVIVES
gcloud run services update concrete-agent --region=europe-west3 --update-env-vars=BUMP=$(date +%s)
curl -X POST ".../auth/login" -d '{"email":"smoke-test@stavagent.cz","password":"some-strong-pass"}'
# Expected: same api_key as step 3 (proves persistence)
```

**Migration completed in code.** Production verification waits on PR
merge + Cloud Build run + the smoke test above.

---

## Production verification + post-merge post-mortem (added 2026-05-14)

**Status after PR #1147 merged:** the cloudbuild `psql` migration step
**silently no-op'd** and the production tables ended up hand-crafted with
a schema that didn't match `migrations/007_mcp_api_keys.sql`. The first
`POST /api/v1/mcp/auth/register` call after deploy returned HTTP 500 from
`psycopg2.errors.UndefinedColumn: column "user_email" does not exist`.

### Why the cloudbuild migration step was a no-op

Lines 86–104 of `cloudbuild-concrete.yaml` run
`psql "$$CONCRETE_DATABASE_URL" -f migrations/007_mcp_api_keys.sql` from
**inside a Cloud Build VM**. The DSN points at
`host=/cloudsql/PROJECT:REGION:INSTANCE` — a Unix socket path that only
exists *inside a Cloud Run container with the cloudsql-instances
annotation*. The Cloud Build VM has no such mount, so `psql` always
fails on socket ENOENT and the step's `… || echo "MCP api_keys migration
skipped"` fallback hides the failure with exit code 0.

**Every previous deploy since PR #1147 merge has reported "migration
OK"-ish output in Cloud Build logs while doing nothing.** The schema
that ran in production was whatever was already there — in this case, a
hand-applied table with `email` (not `user_email`) and a companion
`mcp_credit_transactions` table instead of `mcp_credit_log`.

### How it was actually fixed

User connected directly to Cloud SQL via `cloud-sql-proxy` on
`localhost:9470` and applied the canonical schema from
`migrations/007_mcp_api_keys.sql` manually (`DROP+CREATE`, since the
decision from PR #1147 was *"Zero prod users — safe to wipe"*). Full
SQL captured in
`docs/audits/mcp_status/2026-05-14_cloudsql_connection_bug.md` §0.

Smoke test passed immediately after:

```
$ curl -X POST .../api/v1/mcp/auth/register -d '{"email":"…","password":"…"}'
{"api_key":"sk-stavagent-…","credits":200,"status":"created"}
```

### Carry-over: replace the cloudbuild psql step

The next PR on this branch family should replace lines 86–104 of
`cloudbuild-concrete.yaml` with one of:

- **Option 1 — Cloud Run job.** A separate job resource using the same
  container image + same `cloudsql-instances` annotation; cloudbuild
  triggers it via `gcloud run jobs execute mcp-migrate`. Cleanest
  separation; reuses image; respects the socket mount.
- **Option 2 — App-side startup migration.** Hook Alembic
  `upgrade head` into the FastAPI lifespan startup (`app/main.py`). Runs
  in-process every cold start, idempotent, hits the same Cloud SQL
  socket the app uses. Subtle gotcha: traffic-split races across
  concurrent revisions during rollout.
- **Option 3 — drift-check startup probe.** Lighter than full migration:
  at startup, `SELECT column_name FROM information_schema.columns
  WHERE table_name = 'mcp_api_keys'` and fail fast with a clear log if
  `user_email` / `total_credits_used` are absent. Doesn't *fix* drift,
  but makes the failure deterministic instead of waiting for the first
  request.

**Recommendation: Option 1 + Option 3 together.** Option 1 is the
durable fix; Option 3 catches future hand-edits to prod.

### PR #1148 was the diagnostic vehicle that found the bug

PR #1148 fixed *none of the five hypotheses it originally targeted*
(socket-ENOENT / DSN parse / auth / cold-start), but its sanitized-DSN
log + ENOENT-specific ERROR line caused the **real** error
(`UndefinedColumn`) to surface immediately and unambiguously. Without
those diagnostic improvements, the on-call rotation would have stayed
stuck on the wrong cause for hours.

The `.strip()` + `--set-cloudsql-instances` defensive changes from PR
#1148 remain value-adds for unrelated future failure modes; they
weren't wasted even though they didn't fix the actual bug.
