# DCR + YAML Deploy Runbook

**Audience:** Operator deploying both feature branches together in one window.
**Two PRs:**

- **PR-A (YAML loader):** branch `claude/review-kb-yaml-loader-wR7If` — 1 commit, no DB changes, +PyYAML dep.
- **PR-B (DCR + middleware):** branch `claude/mcp-dynamic-client-registration-x7Kb2` — 7 commits, 3 SQL migrations (009/010/011), Redis dependency on `/register`.

**Total wall-clock:** ~25 min on a clean Cloud Run + Cloud SQL.

**Estimated read-once budget:** 10 min before merge, then follow inline.

---

## 0. Pre-deploy checklist (5 min)

Run all of these BEFORE clicking merge. If any fails, STOP and fix.

```bash
# 0.1 — Both PRs approved + green CI
gh pr view alpro1000/STAVAGENT --json reviews,statusCheckRollup --jq '.statusCheckRollup[].conclusion' | sort -u
# Expected: only "SUCCESS"
# If you see "FAILURE": investigate the failing check before merging.

# 0.2 — Confirm Cloud Run service is on the expected baseline revision
gcloud run services describe concrete-agent --region=europe-west3 --format='value(status.latestReadyRevisionName)'
# Note this value — you may need it for rollback in §8.

# 0.3 — Cloud SQL up + reachable via the proxy sidecar
gcloud sql instances describe stavagent-db --format='value(state)'
# Expected: RUNNABLE

# 0.4 — Redis reachable from a one-off pod (DCR rate-limit fail-closes
#       if Redis is unreachable at /register call time).
gcloud run jobs execute redis-smoke-test --region=europe-west3 --wait 2>/dev/null || \
  echo "If no smoke-job exists, skip — first /register call after deploy will surface Redis health."
# Expected exit 0 OR explicit "smoke-job not found" message.

# 0.5 — Secret Manager has the keys the new code expects
gcloud secrets list --filter='name~MCP_' --format='value(name)'
# Expected to include: MCP_DATABASE_URL (existing). MASTER_ENCRYPTION_KEY
# + LEMONSQUEEZY_WEBHOOK_SECRET still pending per CLAUDE.md TODO — NOT
# required for this deploy.
```

### Merge order (MANDATORY)

**YAML first, DCR second.** Reasoning:

- YAML touches one module + adds tests; if it goes wrong the symptom is "KB entries didn't increase" — purely observability, no user-facing breakage.
- DCR adds 3 migrations + middleware changes; if it goes wrong the symptom is "MCP endpoint 5xx" — user-facing.

If we merge DCR first and KB load fails, the same revision carries both fixes and rollback rolls back both at once. Splitting the merge into two revisions gives you a clean rollback boundary.

### Backup revision

After both PRs merge but BEFORE the new Cloud Run revision goes live:

```bash
# 0.6 — Pin the current revision so traffic can be flipped back instantly
gcloud run services update-traffic concrete-agent \
  --region=europe-west3 \
  --to-revisions=$(gcloud run services describe concrete-agent --region=europe-west3 \
                    --format='value(status.latestReadyRevisionName)')=100
# Expected: "Traffic split updated."
```

---

## 1. Merge + first deploy (PR-A: YAML)

```bash
# 1.1 — Squash-merge PR-A
gh pr merge alpro1000/STAVAGENT \
  --squash \
  --subject "feat(kb_loader): add YAML support + skip-pattern (PR-A)" \
  --body  "Defect B closed. See PR description for full changelog."
# If `gh pr merge` errors with "branch is not mergeable": stop, resolve
# conflicts, do NOT --admin merge.

# 1.2 — Cloud Build trigger fires automatically on `main` push.
#       Watch it complete:
gcloud builds list --limit=1 --ongoing --format='value(id,status)'
# Then tail logs:
gcloud builds log $(gcloud builds list --limit=1 --format='value(id)') --stream
# Expected to end with: "Successfully tagged europe-west3-docker.pkg.dev/.../concrete-agent:latest"
```

If Cloud Build fails on the `pip install` step with `Could not find a version that satisfies the requirement PyYAML==6.0.2` — the pin is in PyPI as of 2024-08; check internal mirror availability or fall back to `PyYAML>=6.0,<7`.

### Wait for the new revision to come up

```bash
gcloud run services describe concrete-agent --region=europe-west3 \
  --format='value(status.latestReadyRevisionName,status.latestCreatedRevisionName)'
# Both columns must match — startup probe passed.
# If `latestCreatedRevisionName` is ahead of `latestReadyRevisionName`:
# the revision is still starting OR failed its probe. Go to §6 logs.
```

---

## 2. Migrations chain (PR-B: DCR)

PR-B's `app/db/startup_migrations.py` runs SQL files at lifespan startup under a session-level advisory lock — no `alembic` step is required at deploy time. But verify the migrations table state BEFORE merging PR-B so you have a clean baseline.

```bash
# 2.1 — psql into Cloud SQL via the proxy
gcloud sql connect stavagent-db --database=concrete_agent_prod --user=postgres
# (enter password when prompted)
```

```sql
-- 2.2 — Confirm baseline: 003/004/005/006/007/008 already applied
SELECT filename FROM _schema_migrations ORDER BY filename;
-- Expected output (6 rows):
--   003_google_drive_tables.sql
--   004_nkb_tables.sql
--   005_norm_audit_tables.sql
--   006_project_items.sql
--   007_mcp_api_keys.sql
--   008_mcp_oauth_codes.sql

-- 2.3 — Confirm critical tables exist on the baseline
\dt mcp_*
-- Expected: mcp_api_keys, mcp_credit_log, mcp_oauth_codes
-- If any missing: STOP. The startup_migrations runner relies on them
-- as FK targets — re-running 007/008 manually fixes this.

\q
```

### Merge PR-B + watch migrations apply

```bash
# 2.4 — Squash-merge PR-B
gh pr merge alpro1000/STAVAGENT \
  --squash \
  --subject "feat(mcp): Dynamic Client Registration (RFC 7591) + middleware (PR-B)"

# 2.5 — Tail Cloud Build → Cloud Run startup logs as the new revision boots
gcloud logging tail "resource.type=cloud_run_revision AND \
  resource.labels.service_name=concrete-agent AND \
  textPayload:\"startup-migrations\"" \
  --format='value(textPayload)'
```

Watch for these lines, IN ORDER:

```
[startup-migrations] Acquired advisory lock 8479316250451287
[startup-migrations] Applying 009_mcp_oauth_clients.sql ... done (XX ms)
[startup-migrations] Applying 010_mcp_oauth_codes_dcr.sql ... done (XX ms)
[startup-migrations] Applying 011_mcp_oauth_tokens.sql ... done (XX ms)
[startup-migrations] Schema drift check OK
[startup-migrations] Released advisory lock
```

**If 010 fails** with `column "oauth_client_id" of relation "mcp_oauth_codes" already exists`: that's idempotent — `ADD COLUMN IF NOT EXISTS` is in the SQL. Inspect the row in `_schema_migrations` — if 010 is recorded there but the column is missing, you've hit a half-applied state. Resolve:

```sql
-- Delete the half-applied marker so the runner re-applies the file
DELETE FROM _schema_migrations WHERE filename = '010_mcp_oauth_codes_dcr.sql';
-- Then restart the Cloud Run revision (forces lifespan to re-run):
-- gcloud run services update concrete-agent --region=europe-west3 --no-traffic
-- gcloud run services update-traffic concrete-agent --to-latest --region=europe-west3
```

### Verify all three tables present + columns correct

```sql
-- 2.6 — Reconnect and check
\dt mcp_oauth_*
-- Expected: mcp_oauth_clients, mcp_oauth_codes, mcp_oauth_registration_log, mcp_oauth_tokens

-- 2.7 — Drift-relevant columns
\d mcp_oauth_clients
-- Expected columns: id, client_id, client_secret_hash, client_secret_salt,
--   client_name, redirect_uris (jsonb), grant_types (jsonb), scope,
--   software_id, software_version, registration_source, registered_ip,
--   registered_user_agent, created_by_user_id, is_active, last_used_at,
--   registered_at

\d mcp_oauth_tokens
-- Expected columns: id, access_token, refresh_token, oauth_client_id,
--   user_api_key, grant_type, scope, issued_at, access_expires_at,
--   refresh_expires_at, revoked_at, rotated_from, last_used_at

\d mcp_oauth_codes
-- Verify oauth_client_id column added by 010 is present (nullable).
```

**If any expected column is missing:** the schema-drift assertion in `app/db/startup_migrations.py:_assert_critical_schema` would have hard-failed the lifespan with a clear error in Cloud Run logs. Re-check §6.

---

## 3. Environment variables

PR-B introduces ONE required env + ONE optional. Set them BEFORE the first `/register` call lands.

| Variable | Required? | Value | Why |
|---|---|---|---|
| `REDIS_URL` | **YES, already set** | `redis://...:6379/0` (existing) | DCR rate limiter fails closed (503) if unreachable |
| `MCP_RATE_LIMIT_WHITELIST` | optional | `1.2.3.4,5.6.7.8` (CSV, empty default) | Bypass 10/h limit for CI/staging bastions |
| `MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT` | optional | `0` (production) / `1` (CI only) | Allows `http://localhost/cb` in `redirect_uris` |
| `MCP_ORIGIN_ENFORCE` | optional | unset → dry-run / `1` → enforce | Non-allowlist Origin returns 403 vs warn-only |

```bash
# 3.1 — Verify REDIS_URL is set on the service (NOT printed in plaintext)
gcloud run services describe concrete-agent --region=europe-west3 \
  --format='value(spec.template.spec.containers[0].env[].name)' | grep -E 'REDIS_URL|MCP_DATABASE_URL'
# Expected: both names listed.

# 3.2 — Confirm Redis instance is reachable from Cloud Run's VPC
gcloud redis instances describe stavagent-redis --region=europe-west3 \
  --format='value(state,host,port)'
# Expected: state=READY, host=10.X.X.X, port=6379
# If state != READY: do NOT proceed with DCR deploy. Fix Redis first
# OR temporarily set MCP_RATE_LIMIT_WHITELIST=<your_ip> so smoke tests pass.

# 3.3 — Optional: add a CI bastion to the whitelist
gcloud run services update concrete-agent --region=europe-west3 \
  --set-env-vars="MCP_RATE_LIMIT_WHITELIST=203.0.113.10"
# Triggers a new revision — wait for it.
```

---

## 4. Cloud Run deploy command

The squash-merge from §2 fires Cloud Build automatically; no manual `gcloud run deploy` needed in the happy path. The runbook keeps this block for the forced-deploy case (e.g. re-deploying the same image after env-var change):

```bash
# 4.1 — Force a re-deploy of the latest image (env-var changes already
#       update-trigger this, but explicit form is here for the rollback path)
gcloud run deploy concrete-agent \
  --region=europe-west3 \
  --image=$(gcloud run services describe concrete-agent --region=europe-west3 \
            --format='value(spec.template.spec.containers[0].image)') \
  --min-instances=1 \
  --max-instances=10 \
  --set-cloudsql-instances=project-947a512a-481d-49b5-81c:europe-west3:stavagent-db \
  --no-traffic

# 4.2 — Verify the new revision is healthy before flipping traffic
gcloud run revisions describe $(gcloud run services describe concrete-agent \
    --region=europe-west3 --format='value(status.latestCreatedRevisionName)') \
  --region=europe-west3 \
  --format='value(status.conditions[?type==Ready].status)'
# Expected: True. If "Unknown" or "False": tail logs (§6), do NOT flip traffic.

# 4.3 — Flip traffic
gcloud run services update-traffic concrete-agent \
  --region=europe-west3 \
  --to-latest
# Expected: "Traffic split updated."
```

---

## 5. Startup log checks (5 signals, in order)

Tail Cloud Run logs for ~60s after the new revision starts:

```bash
gcloud logging tail "resource.type=cloud_run_revision AND \
  resource.labels.service_name=concrete-agent" \
  --format='value(textPayload)' \
  --limit=200
```

Watch for ALL FIVE of these. Order is fixed by the lifespan code path.

### 5.1 — DB schema up to date

```
[startup-migrations] Schema drift check OK
```

If you see `Schema drift in mcp_oauth_clients: missing columns {...}` instead, see §2 recovery. The lifespan EXCEPTION-bubbled here means the Cloud Run startup probe will fail; the revision will not receive traffic.

### 5.2 — KB loader counts (YAML success signal)

```
📂 Processing category: B4_production_benchmarks
✅ Loaded: B4_production_benchmarks
... (similar for B5, B6, B7) ...
✨ Knowledge Base loaded in X.XXs
📊 KB summary: B1_otkskp=N, ..., B4=≥12, B5=≥56, B6=≥37, B7=≥21, ...
```

**Specific expected entry counts** (per task §"Acceptance Финальная проверка"):

| Category | Before YAML | After YAML |
|---|---|---|
| B4_production_benchmarks | 10 | **≥ 12** (+mostovkova_deska + operne_zdi) |
| B5_tech_cards | 54 | **≥ 56** (+Žihle master_soupis + vendor_pricing) |
| B6_research_papers | 31 | **≥ 37** (+Pokorný-Suchánek 5 chapters + 2 INDEXes) |
| B7_regulations | 16 | **≥ 21** (+5 regulation INDEXes) |

**If a count is at the "before" value:** YAML loader is not parsing the files. Grep logs for the specific filename — if a `⚠️ Unsupported format` line appears for a `.yaml` file, the dispatcher branch is missing. Roll back (§8).

### 5.3 — Zero YAML "Unsupported format" warnings

```bash
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=concrete-agent AND \
  textPayload:\"Unsupported format\" AND \
  (textPayload:\".yaml\" OR textPayload:\".yml\")" \
  --limit=10 \
  --format='value(textPayload)'
# Expected: empty output (zero matching lines).
# If matches appear: PR-A didn't take effect — check the revision is on
# the new image (§4.1).
```

### 5.4 — Archive-skip aggregated counter

```
📦 Skipped 1 archive/temp file(s) in B6_research_papers
```

(B6 has a small handful of `.zip` distribution archives; expect 1-3 depending on the cohort.) If you see per-file `⚠️ Unsupported format` warnings for `.zip` files instead, the skip-pattern isn't loaded — same recovery as 5.3.

### 5.5 — MCP server mount

```
🔌 MCP server mounted at /mcp (10 tools, CORS + RFC 9728 challenge)
🔑 MCP auth + REST API mounted at /api/v1/mcp/
```

If you see `⚠️  MCP routes not mounted: ...` instead: a startup error in `app/mcp/routes.py` import — most likely a missing dep or a syntax issue. Lifespan has likely failed; revision won't receive traffic. Roll back (§8).

---

## 6. Curl smoke tests (8 commands, run in order)

All eight target the production URL. Save the output of #3 (the `client_id` + `client_secret`) for #4.

```bash
SVC="https://concrete-agent-1086027517695.europe-west3.run.app"
```

### 6.1 — Service health

```bash
curl -s "$SVC/health"
# Expected: {"status":"healthy"}
# If 404 or non-JSON: revision didn't bind port. Tail logs (§5).
```

### 6.2 — well-known manifest contains `registration_endpoint`

```bash
curl -s "$SVC/.well-known/oauth-authorization-server" | jq '.registration_endpoint'
# Expected: "https://concrete-agent-.../api/v1/mcp/oauth/register"
# If "null": main.py didn't pick up the manifest update. Force re-deploy (§4.1).
```

### 6.3 — DCR `/register` returns 201

```bash
curl -s -X POST "$SVC/api/v1/mcp/oauth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
    "client_name": "Smoke test from deploy runbook",
    "grant_types": ["authorization_code", "client_credentials"]
  }' | jq '{client_id, client_secret, client_id_issued_at}'
# Expected:
#   {"client_id":"dcr-XXXX...","client_secret":"dcs-XXXX...","client_id_issued_at":1XXXXXXXXX}
# Save BOTH values — used in #6.7.
# If 503 service_unavailable: Redis isn't reachable. Fix per §3.2.
# If 429 rate_limit_exceeded: previous runbook attempt left the bucket
#   full. Wait 1h OR add your test IP to MCP_RATE_LIMIT_WHITELIST (§3.3).
```

### 6.4 — CORS preflight from claude.ai

```bash
curl -s -i -X OPTIONS "$SVC/mcp/" \
  -H "Origin: https://claude.ai" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  | grep -i "^access-control-"
# Expected, all three lines present:
#   Access-Control-Allow-Origin: https://claude.ai
#   Access-Control-Allow-Methods: GET, POST, OPTIONS
#   Access-Control-Allow-Credentials: true
#   Access-Control-Max-Age: 86400
# If no ACAO line: CORSMiddleware on the /mcp mount didn't bind.
# Restart the service: `gcloud run services update --no-traffic` then
# `--to-latest`.
```

### 6.5 — `/mcp/` without Bearer → 401 + WWW-Authenticate

```bash
curl -s -i "$SVC/mcp/" | head -20
# Expected status line:
#   HTTP/2 401
# Expected header:
#   WWW-Authenticate: Bearer realm="STAVAGENT MCP",
#                     resource_metadata="https://.../.well-known/oauth-protected-resource",
#                     error="invalid_token"
# Expected body: {"error":"invalid_token","error_description":"MCP endpoint requires..."}
# If 200 or 406 (FastMCP Accept-header complaint): middleware gate didn't
# wrap the inner app. Verify §5.5 logged the "mounted" line.
```

### 6.6 — `/mcp/` with invalid `sat-*` → 401 expired-style

```bash
curl -s -i "$SVC/mcp/" \
  -H "Authorization: Bearer sat-deadbeef$(printf '0%.0s' $(seq 1 40))" | head -10
# Expected: HTTP/2 401
# Expected error_description contains: "not found"
# If 5xx: middleware resolver crashed. Tail logs immediately (§6.10).
```

### 6.7 — Rate limit: requests 1-10 succeed, 11 → 429

```bash
# Use a throwaway IP via X-Forwarded-For to keep the prod bucket clean.
# (NOTE: Cloud Run only honours XFF when the request actually traversed
# its proxy; for a local curl this header is illustrative only — the
# real source IP is what gets bucketed. Run this from a single VM if
# you need the test to be hermetic.)
for i in $(seq 1 11); do
  printf "Attempt %2d: HTTP " "$i"
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SVC/api/v1/mcp/oauth/register" \
    -H "Content-Type: application/json" \
    -d "{\"redirect_uris\":[\"https://example.com/cb\"],\"client_name\":\"rl-test-$i\"}"
done
# Expected:
#   Attempt 1-10: HTTP 201
#   Attempt 11: HTTP 429
# Last call should also return Retry-After header:
curl -s -i -X POST "$SVC/api/v1/mcp/oauth/register" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris":["https://example.com/cb"],"client_name":"rl-overflow"}' \
  | grep -i "^retry-after"
# Expected: Retry-After: 3600
```

### 6.8 — Legacy `sk-stavagent-*` flow regression

```bash
# 6.8a — Token grant (legacy client_credentials with api_key as both fields)
LEGACY_KEY="sk-stavagent-$(openssl rand -hex 24)"   # Replace with a REAL active api_key
                                                     # from mcp_api_keys for a true test.
curl -s -X POST "$SVC/api/v1/mcp/oauth/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=$LEGACY_KEY" \
  -d "client_secret=$LEGACY_KEY" \
  | jq '.access_token == "'"$LEGACY_KEY"'"'
# Expected: true   (legacy returns the api_key verbatim — NO new sat- mint)
# If false: legacy backward-compat broke. CRITICAL — roll back §8.

# 6.8b — Bearer the same api_key on /mcp/ still works
curl -s -i "$SVC/mcp/" \
  -H "Authorization: Bearer $LEGACY_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | head -3
# Expected: HTTP/2 200 (or whatever FastMCP would return for that body)
# If 401: middleware's sk-stavagent-* path broke. CRITICAL — roll back §8.

# 6.8c — DB confirms NO mcp_oauth_tokens row for legacy access
gcloud sql connect stavagent-db --database=concrete_agent_prod --user=postgres -c \
  "SELECT COUNT(*) FROM mcp_oauth_tokens WHERE access_token = '$LEGACY_KEY';"
# Expected: 0
```

### 6.9 — Audit log forensics

```bash
# Verify the smoke-test 429 from §6.7 wrote a 'rate_limited' audit row
gcloud sql connect stavagent-db --database=concrete_agent_prod --user=postgres -c \
  "SELECT status, COUNT(*) FROM mcp_oauth_registration_log \
   WHERE created_at > NOW() - INTERVAL '10 minutes' GROUP BY status ORDER BY status;"
# Expected (rough — depends on smoke-test order):
#   rate_limited      | 1
#   success           | 10
```

### 6.10 — Tail recent ERROR logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=concrete-agent AND \
  severity>=ERROR AND \
  timestamp>\"$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)\"" \
  --format='value(textPayload)' \
  --limit=20
# Expected: empty (or only known-noise lines).
# Any genuinely new ERROR — investigate before declaring deploy done.
```

---

## 7. End-to-end claude.ai manual test

This proves the brokered flow works through a real Anthropic Connectors-Directory–style probe. Do this LAST, after §6 smoke is fully green.

1. Open claude.ai in a browser. Go to **Settings → Connectors**.
2. If a previous STAVAGENT connector exists: click **Remove**. Confirm.
3. Click **Add Connector** → paste URL:
   ```
   https://concrete-agent-1086027517695.europe-west3.run.app/mcp
   ```
4. **Do NOT click "Advanced settings"** — the whole point of DCR is that
   claude.ai broker registers itself; you should not be asked for a
   client_id/client_secret on the claude.ai side.
5. Toggle the connector **ON** in any conversation.
6. claude.ai redirects to STAVAGENT consent form (`POST /authorize`'s rendered HTML).
   - Paste a valid `sk-stavagent-{hex48}` user api_key into the form.
   - Click **Authorize**.
7. Browser returns to claude.ai. In the same conversation:
   ```
   проверь tools
   ```
   Expected: claude.ai responds with a list of all 10 STAVAGENT tools:
   `find_otskp_code`, `find_urs_code`, `classify_construction_element`,
   `calculate_concrete_works`, `parse_construction_budget`,
   `analyze_construction_document`, `create_work_breakdown`,
   `get_construction_advisor`, `search_czech_construction_norms`,
   `calculate_pump`.
8. Try a paid tool:
   ```
   найди URS код для бетона C30/37
   ```
   Expected: tool runs, credits debited from your api_key
   (verify via `GET /api/v1/mcp/auth/credits` with your Bearer).

### If step 6 doesn't redirect

claude.ai got "Couldn't reach the MCP server" instead. Most likely:

- `registration_endpoint` not in well-known → §6.2
- 503 on `/register` → Redis unreachable, §3.2
- 401 with no WWW-Authenticate on initial `GET /mcp/` probe → middleware
  not mounted, §5.5

### If step 8 returns 402 user_consent_required

The api_key you pasted in step 6 wasn't valid OR the binding didn't take.
Verify:

```sql
SELECT t.access_token, t.user_api_key, t.oauth_client_id
FROM mcp_oauth_tokens t
ORDER BY t.issued_at DESC LIMIT 1;
-- Expected: user_api_key NOT NULL; matches the api_key you pasted.
```

---

## 8. Rollback procedure

Use this if any of §5 / §6 / §7 fails irrecoverably.

### 8.1 — Flip Cloud Run traffic back

```bash
# Replace <previous-revision> with the value from §0.2
gcloud run services update-traffic concrete-agent \
  --region=europe-west3 \
  --to-revisions=<previous-revision>=100
# Expected: "Traffic split updated."
# This takes effect within ~5s — no in-flight requests interrupted.
```

### 8.2 — Roll back migrations 009/010/011

**Only do this if migrations actually applied AND you need to fully revert.** Most of the time, leaving the new tables empty is fine — they're additive and don't break the previous revision.

```sql
-- Reconnect via gcloud sql connect, then:
BEGIN;
  -- Order matters: child tables first (FK to mcp_oauth_clients)
  DROP TABLE IF EXISTS mcp_oauth_tokens;
  DROP TABLE IF EXISTS mcp_oauth_registration_log;
  ALTER TABLE mcp_oauth_codes
    DROP CONSTRAINT IF EXISTS mcp_oauth_codes_oauth_client_id_fkey;
  ALTER TABLE mcp_oauth_codes
    DROP COLUMN IF EXISTS oauth_client_id;
  DROP TABLE IF EXISTS mcp_oauth_clients;
  -- Remove the migration markers so a future re-deploy re-applies cleanly
  DELETE FROM _schema_migrations
    WHERE filename IN (
      '009_mcp_oauth_clients.sql',
      '010_mcp_oauth_codes_dcr.sql',
      '011_mcp_oauth_tokens.sql'
    );
COMMIT;
```

### 8.3 — Clear the Redis rate-limit bucket

If the deploy attempt left the rate-limit bucket full and you want to retest cleanly:

```bash
# From a VM with redis-cli access (e.g. Cloud Shell with port-forward)
redis-cli -h <REDIS_HOST> -p 6379 KEYS "concrete:rate:dcr_register:*"
# Expected: list of bucket keys.
redis-cli -h <REDIS_HOST> -p 6379 DEL $(redis-cli -h <REDIS_HOST> -p 6379 KEYS "concrete:rate:dcr_register:*")
# Expected: <integer reply> (number of keys deleted)
```

### 8.4 — Notify reviewers

Open a comment on both PRs with:
- which step failed
- the failing log line / curl response
- the previous-revision name from §0.2 (proves rollback applied)

Do NOT close the PRs — they stay open until the regression is fixed.

---

## 9. Operational notes

### TTLs

| What | TTL | Where set | Why |
|---|---|---|---|
| Authorization code | 10 min | `app/mcp/oauth_codes.py:DEFAULT_CODE_TTL_SECONDS` | One-shot exchange, RFC 6749 recommendation |
| Access token (`sat-*`) | 1 h | `app/mcp/auth.py:ACCESS_TOKEN_TTL_SECONDS` | OAuth canon — fits inside session, few refreshes |
| Refresh token (`srt-*`) | 90 d | `app/mcp/auth.py:REFRESH_TOKEN_TTL_SECONDS` | Monthly use without re-consent; quarterly cap |
| Rate-limit bucket | 1 h | `app/mcp/rate_limit.py:REGISTER_RATE_LIMIT_WINDOW_SECONDS` | EXPIRE set only on first INCR (no sliding window) |
| Legacy `sk-stavagent-*` | infinite | `mcp_api_keys` table | Pre-DCR — no TTL infrastructure |

### Rate limit details

- **Limit:** 10 `/register` per IP per hour.
- **Identification:** leftmost `X-Forwarded-For` entry (Cloud Run prepends real client IP), fallback `request.client.host`.
- **Whitelist:** `MCP_RATE_LIMIT_WHITELIST=ip1,ip2` env (CSV, empty by default).
- **Failure mode:** Redis unreachable → 503 (NOT 200 fallback — explicit fail-closed).
- **Bucket cleanup:** automatic via Redis EXPIRE; no manual cleanup needed.

### Monitoring signals

Add these to your dashboards / alerts:

| Metric | Source | Alert threshold |
|---|---|---|
| `/register` 429 rate | Cloud Logging filter `severity=WARNING textPayload:"rate_limit_exceeded"` | > 50/h sustained → real attack, consider tightening allowlist |
| `/register` 503 rate | `severity=ERROR textPayload:"Rate limiter unavailable"` | > 1/h → Redis health issue |
| `/mcp/` 401 rate | `path:/mcp/ AND httpRequest.status=401` | spike → broker auth misconfig OR token expiry storm |
| `mcp_oauth_tokens` row count | direct SQL query | > 50K → cleanup job overdue (see §10) |
| Replay-revoke chain count | log filter `"Refresh-token replay detected"` | > 0/day → security incident, investigate per-token |

### Drift check

`app/db/startup_migrations.py:_assert_critical_schema` hard-fails the lifespan if any column from `_CRITICAL_SCHEMA` is missing. The Cloud Run startup probe then fails, the new revision doesn't receive traffic, and the previous revision keeps serving. **You will know within 240s if a migration didn't apply cleanly.**

---

## 10. Open issues post-deploy (TODOs)

These are NOT blockers for the deploy itself — they're carry-forward
items for follow-up PRs.

### 10.1 — CSRF token on `/authorize` POST consent form

**Carry-over from Gate 4.5.** The consent form (`POST /api/v1/mcp/oauth/authorize`)
accepts the user's api_key in a password input and uses the api_key
itself as combined auth + CSRF. Acceptable for MVP because the api_key
is a 192-bit secret a CSRF attacker can't guess, but a proper CSRF token
+ session cookie pair is required before Claude Directory submission.

**Tracked alongside:** Portal SSO migration (see §10.3) — both unblock
together because the natural CSRF storage is a Portal-issued session
cookie.

### 10.2 — Async `update_token_last_used`

**Carry-over from Gate 5.** The middleware bumps `last_used_at` via a
synchronous psycopg2 UPDATE on the request thread (~5-10ms on the
primary-key index). Spec was true fire-and-forget. Acceptable for MVP
because the wall-clock cost is dominated by FastMCP tool execution.

**Refactor blockers:** psycopg2 is sync. Needs either an asyncpg
codepath or a thread-pool executor wrapper. Background task pool
should be bounded so a stats-update queue can't grow unboundedly
under high load.

### 10.3 — Portal SSO auto-consent

**Carry-over from Gate 4.5.** Current consent form is an inline HTML
template with a `<password>` field. Once the Portal frontend supports
SSO to the MCP backend (cookie or JWT-bearing redirect), `/authorize`
GET should:

- check for a logged-in user via the cookie
- auto-consent with a single "Authorize" button (no key paste)
- redirect new users to Portal's `/login` with `?return_to=/authorize?...`

### 10.4 — Separate rate-limit bucket for authenticated DCR

Current `MCP_RATE_LIMIT_WHITELIST` is CSV of IPs. A user with a valid
sk-stavagent api_key making authenticated /register calls (`Authorization:
Bearer ...`) shares the same per-IP bucket as anonymous requests from
that IP. Future refactor: split into `rate:dcr_register:anonymous:{ip}`
and `rate:dcr_register:authenticated:{user_id}` so a legitimate
multi-DCR-client user from a shared NAT doesn't get rate-limited by
neighbours' traffic.

### 10.5 — Background cleanup job for expired tokens

`mcp_oauth_tokens` rows accumulate forever. Need a Celery beat job:

```python
# app/tasks/maintenance.py — new task
@shared_task
def cleanup_expired_oauth_tokens():
    """Delete tokens where refresh_expires_at < NOW() - 30 days
    AND revoked_at < NOW() - 30 days."""
    ...
```

Schedule: daily at off-peak (e.g. 03:00 UTC). Keep revoked tokens
for 30 days post-revoke so replay-detection forensics survive
incident review.

### 10.6 — DCR endpoint advertise gating

Until §10.1 (CSRF) lands, DO NOT publish the connector URL to the
Claude Directory or list it in any external marketing surface. The
endpoint works for direct claude.ai user adds (which require explicit
user action to paste the URL) but is not Directory-ready.

---

## Appendix A: Quick command reference

```bash
# Live tail all Cloud Run logs
gcloud logging tail "resource.type=cloud_run_revision AND \
  resource.labels.service_name=concrete-agent"

# Count audit rows by status (last hour)
gcloud sql connect stavagent-db --database=concrete_agent_prod --user=postgres -c \
  "SELECT status, COUNT(*) FROM mcp_oauth_registration_log \
   WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY status;"

# Inspect the most recent registration audit row
gcloud sql connect stavagent-db --database=concrete_agent_prod --user=postgres -c \
  "SELECT * FROM mcp_oauth_registration_log ORDER BY created_at DESC LIMIT 1;"

# Force a revision restart (re-runs lifespan, useful if env var stuck)
gcloud run services update concrete-agent --region=europe-west3 \
  --update-env-vars=__RESTART_TOKEN=$(date +%s)

# Check current rate-limit bucket for an IP
redis-cli -h <REDIS_HOST> -p 6379 GET "concrete:rate:dcr_register:203.0.113.1"
# Returns the counter value (1-10 = allowed, 11+ = rejected) or nil.

# Drift-check the critical schema by hand
gcloud sql connect stavagent-db --database=concrete_agent_prod --user=postgres -c \
  "SELECT table_name, column_name FROM information_schema.columns \
   WHERE table_name IN ('mcp_oauth_clients','mcp_oauth_tokens','mcp_oauth_registration_log') \
   ORDER BY table_name, ordinal_position;"
```

## Appendix B: PR links + branch names

- **PR-A (YAML):** branch `claude/review-kb-yaml-loader-wR7If`. Commits: 1.
- **PR-B (DCR):** branch `claude/mcp-dynamic-client-registration-x7Kb2`. Commits: 8 (Gates 1, 2, 3, 4, 4.5, 5, 6, 7).

---

**Last updated:** 2026-05-19 (Gate 9 of TASK_DCR_KBYamlLoader.md).
