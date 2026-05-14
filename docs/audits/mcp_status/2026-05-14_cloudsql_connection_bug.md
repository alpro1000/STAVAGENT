# MCP Cloud SQL connection bug — investigation + fix

**Date:** 2026-05-14
**Branch:** `claude/mcp-cloudsql-conn-fix-7Qx9z`
**Status:** P1 bug — `/api/v1/mcp/auth/register` returns 500 in prod.
**Tracked separately from CSC; not a CSC blocker.**

---

## 1. Symptom

`POST /api/v1/mcp/auth/register` (and any other endpoint that calls into
`mcp_auth`) returns HTTP 500. Cloud Run logs:

```
psycopg2.OperationalError: connection to server on socket
"/cloudsql/project-947a512a-481d-49b5-81c:europe-west3:stavagent-db/.s.PGSQL.5432"
failed: No such file or directory
        Is the server running locally and accepting connections on that socket?
```

`GET /mcp/health` returns 200 — proves the container boots; the failure is
only on code paths that hit `_get_db()`.

---

## 2. Hypotheses → what each addresses → outcome

| # | Hypothesis | Mechanism it would explain | What this PR does |
|---|-----------|---------------------------|-------------------|
| 1 | `+asyncpg` prefix breaks psycopg2 | URL parse error → libpq fails before connect → wrong error type | **Already handled** — `_resolve_dsn()` strips the prefix (line 92 since PR #1147). Adds tests pinning the behaviour. |
| 2 | Empty password (`user:@/db`) — psycopg2 strict, asyncpg lenient | Auth handshake fails | **Doesn't match the symptom.** ENOENT happens at the socket-presence level, *before* the auth handshake. Option A from the task spec is preserved as a configurable escape hatch (`MCP_DATABASE_URL` env var, already supported by `_resolve_dsn()`); user can create the secret in GCP if password becomes an issue *after* the socket issue is resolved. |
| 3 | Cloud SQL Auth Proxy sidecar not starting | Socket directory mounts but `.s.PGSQL.5432` never appears | **Most likely**, given the exact error string. Addressed indirectly via `--set-cloudsql-instances` cloudbuild hygiene (see §3) and an actionable error message (§3.3). Real fix is at the GCP infra level — see §5 action items. |
| 4 | Trailing-newline in Secret Manager value | Secret pasted with newline → libpq sees `host=/cloudsql/...\n` → ENOENT on a non-existent path with trailing newline | The error string in production doesn't show a trailing newline, so this likely isn't *the* cause — but it would produce *exactly this kind of failure* in future. Defensively patched with `.strip()` in `_resolve_dsn()`. |
| 5 | Cold-start race (proxy not ready) | First request after deploy fails; retries succeed | Not addressed — would warrant retry-with-backoff in `_get_db()`. Skipped as scope creep until §5 diagnostics rule out infra cause. |

**Headline:** The symptom is **socket-level ENOENT**, which is *infra*-level
(Cloud Run + Cloud SQL Auth Proxy), not *code*-level. This PR ships
**defensive hardening + diagnostic improvements** so the next failure
trace is unambiguous about the cause, and a cloudbuild hygiene change
(`--set-` vs `--add-cloudsql-instances`) that closes off the most plausible
infra-side cause. **The PR alone may not be sufficient**; manual GCP steps
in §5 are required.

---

## 3. Changes shipped in this PR

### 3.1 `app/mcp/auth.py:_resolve_dsn` — defensive parse

- `.strip()` on the resolved URL — guards against the Secret Manager
  trailing-newline hazard (portal's `pg` adapter already trims;
  `postgres.js:27`).
- Docstring spells out the `MCP_DATABASE_URL → DATABASE_URL` priority
  contract that Option A from the task spec relies on (the code already
  supported it; the docs now make the operational path obvious).

### 3.2 `app/mcp/auth.py:_get_db` — actionable error + diagnostic log

- On every successful connect, logs the sanitized DSN (password
  redacted, socket host preserved). Operators can now see in Cloud Run
  logs exactly which DSN the running revision is using.
- On `psycopg2.OperationalError` whose message contains
  `"No such file or directory"` + `"/cloudsql/"`, an `ERROR`-level log
  line states the most likely cause (missing/stale
  `--set-cloudsql-instances` annotation or sidecar failure) before the
  exception propagates. This is the line the next on-call rotation will
  see if the bug recurs.
- Sanitizer helper `_sanitize_dsn_for_log` redacts `user:password@` →
  `user:***@`. Tested against the empty-password / no-userinfo edge
  cases so logging code can't itself crash the request.

### 3.3 `cloudbuild-concrete.yaml` — `--set-cloudsql-instances`

The deploy step used `--add-cloudsql-instances` which **appends** to the
existing list. If a previous manual `gcloud run services update` or a
broken earlier deploy left a stale or wrong-region entry in the list,
the Cloud SQL Auth Proxy on the next revision would attempt to mount
both — and if either fails, the relevant socket may not appear.
`--set-cloudsql-instances` replaces the entire list so each deploy lands
on a clean, single-entry state.

Behaviour is unchanged on services with no stale state; the change is
defensive idempotency.

### 3.4 Tests — `tests/test_mcp_auth_dsn.py` (13 cases)

Pure-function tests for `_resolve_dsn` + `_sanitize_dsn_for_log` — no
Postgres / Cloud SQL required, run anywhere:

- `MCP_DATABASE_URL` → `DATABASE_URL` priority
- `+asyncpg` prefix stripped (only first occurrence — query-string echo
  preserved)
- Trailing newline + leading/trailing whitespace stripped
- Empty / whitespace-only / unset → `RuntimeError`
- Sanitizer redacts password, preserves Cloud SQL socket host
- Sanitizer no-ops on empty password / no userinfo

13/13 pass via direct smoke-test (sandbox doesn't have psycopg2 + bcrypt
installed; the CI workflow `test-mcp-compatibility.yml` will run them
against the full stack with the Postgres service).

---

## 4. What this PR does NOT fix

- If the production cause is hypothesis #3 (sidecar fails to start) the
  `--set-cloudsql-instances` change *should* fix it, but only on the
  next deploy AND only if no other revision-level config is the actual
  problem. Verify via §5.
- If the cause is hypothesis #5 (cold-start race), a retry loop in
  `_get_db()` would be needed — not added because (a) it's a rare edge
  case in Cloud Run, (b) the diagnostic log added here will surface it
  clearly if it happens.
- If the cause turns out to be hypothesis #2 (auth method mismatch), the
  next failure mode would be `FATAL: password authentication failed` —
  *different* error message. At that point Option A (create
  `MCP_DATABASE_URL` secret with explicit password) is the right
  follow-up; the code path is already wired.

---

## 5. Action items the user must run (manual, not in PR)

After this PR merges:

1. **Trigger a Cloud Build** for `concrete-agent/` so the
   `--set-cloudsql-instances` change takes effect on a fresh revision.
2. **Verify** `gcloud run services describe concrete-agent --region=europe-west3 --format='value(spec.template.metadata.annotations."run.googleapis.com/cloudsql-instances")'`
   returns exactly `project-947a512a-481d-49b5-81c:europe-west3:stavagent-db`
   (no extras, no missing).
3. **Curl** `https://<run-url>/api/v1/mcp/auth/register` with a test
   email/password. Check Cloud Run logs for the new sanitized DSN line
   (`[MCP/Auth] Postgres connection for thread ... DSN sanitized: ...`).
4. **If the bug persists** — the new diagnostic ERROR line will name
   the cause. Likely next steps then:
   - If "Cloud SQL socket missing" still fires → check the Cloud Run
     revision's `spec.template.spec.containers[0]` for the proxy
     sidecar (Cloud Run injects it from the annotation), then check the
     Cloud SQL Admin API → verify the SA has `roles/cloudsql.client`
     bound at *project* level (already verified per task description,
     but a fresh check costs nothing).
   - If the new failure is `FATAL: password authentication failed`
     instead → create `MCP_DATABASE_URL` secret in GCP with explicit
     password:
     ```
     postgresql://stavagent_portal:<PASSWORD>@/stavagent_portal?host=/cloudsql/project-947a512a-481d-49b5-81c:europe-west3:stavagent-db
     ```
     and add `MCP_DATABASE_URL=MCP_DATABASE_URL:latest` to the
     `--update-secrets` line in `cloudbuild-concrete.yaml`. The code
     already prefers `MCP_DATABASE_URL` over `DATABASE_URL`.

---

## 6. Files touched

| File | Lines | Purpose |
|------|------:|---------|
| `concrete-agent/packages/core-backend/app/mcp/auth.py` | +60 / −3 | `.strip()`, sanitizer helper, ENOENT diagnostic |
| `cloudbuild-concrete.yaml` | +11 / −1 | `--set-cloudsql-instances` + inline comment linking to this audit |
| `concrete-agent/packages/core-backend/tests/test_mcp_auth_dsn.py` | +137 (new) | 13 DSN parse + sanitize cases |
| `docs/audits/mcp_status/2026-05-14_cloudsql_connection_bug.md` | +180 (new, this file) | Investigation log + action items |

No call-site changes elsewhere — `_resolve_dsn` and `_get_db` keep their
signatures, public auth API (`register` / `login` / `check_credits` /
`oauth_token` / etc.) is unchanged.
