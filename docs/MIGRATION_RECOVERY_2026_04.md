# Migration Recovery Procedure — 2026-04 SQL Splitter Fix

**Status**: required ONE-TIME after this PR (`fix/sql-migration-dollar-quoted-splitter`) deploys.
**Audience**: ops / on-call engineer with Cloud SQL access.
**Estimated time**: 15-30 min.

---

## TL;DR

Production Cloud SQL `stavagent_portal` and `monolith_planner` databases are in **partial schema state** — every DDL statement after the first `DO $$ BEGIN ... END $$;` block in `schema-postgres.sql` silently never ran. This PR fixes the migration runner so future deploys apply the schema correctly, but **does not retroactively backfill** the missing statements in already-deployed databases.

This document walks through identifying gaps and applying them via `psql`.

---

## Background

Before this PR, `migrations.js` used `schema.split(';')` which is unaware of `$$ ... $$` quoted blocks. The `DO $$ BEGIN ... ALTER ... ; ... END $$;` block at `schema-postgres.sql:359-366` contains 2 inner semicolons; the splitter chopped the block into fragments, PostgreSQL parser threw `unterminated dollar-quoted string (code 42601)`, the migration aborted at that point, **all 110+ subsequent statements** silently never reached the DB.

Live evidence (Cloud Run logs, 2026-04-28T10:36:31Z, revision `stavagent-portal-backend-00255-srx`):

```
[PostgreSQL] Error executing statement: DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org_id') ...
[ERROR] ❌ Database initialization failed:
  error: unterminated dollar-quoted string at or near "$$ BEGIN..."
  code: '42601'
```

---

## Step 1 — Verify the PR is deployed

```bash
gcloud run revisions list \
  --service=stavagent-portal-backend \
  --region=europe-west3 \
  --format='table(metadata.name,metadata.creationTimestamp,status.conditions[0].type)' \
  --limit=3
```

Find the **first revision created AFTER this PR's merge timestamp** that has `Ready` status. Confirm in its boot logs that the migration completed without the `42601` error:

```bash
gcloud run services logs read stavagent-portal-backend \
  --region=europe-west3 \
  --limit=200 \
  --log-filter='resource.labels.revision_name="<NEW_REVISION_NAME>"' \
  | grep -E 'PostgreSQL|Database|Error'
```

You want to see `[Database] Schema initialized successfully` — NOT `❌ Database initialization failed`.

---

## Step 2 — Connect to Cloud SQL

```bash
gcloud sql connect stavagent-db --user=postgres --database=stavagent_portal
```

Repeat for `monolith_planner` after Portal recovery is done.

---

## Step 3 — Diagnose what's missing

Inside `psql`, check for the FK that the production failure logs explicitly mentioned:

```sql
SELECT conname, contype
  FROM pg_constraint
 WHERE conname = 'fk_users_org_id';
```

If **0 rows** → constraint missing (expected). All the statements after this constraint also did not run.

Inventory expected vs actual:

```sql
-- Indexes that should exist (from schema-postgres.sql:368+)
SELECT indexname FROM pg_indexes
 WHERE indexname IN (
   'idx_organizations_owner',
   'idx_organizations_slug',
   'idx_org_members_org',
   'idx_org_members_user',
   'idx_org_members_invite_token'
 );

-- Tables that should exist (Migration 003: Position Instance Architecture)
SELECT tablename FROM pg_tables
 WHERE tablename IN (
   'portal_objects',
   'portal_positions',
   'position_templates',
   'position_audit_log'
 );
```

Each row missing from the result is a statement that needs to be applied.

---

## Step 4 — Apply missing statements

Open `stavagent-portal/backend/src/db/schema-postgres.sql` locally. **Everything from line 359 onwards** (the `DO $$ BEGIN ... END $$;` block AND everything after it) is what the broken splitter never executed.

### Option A — Re-run the whole file (RECOMMENDED, idempotent)

The schema uses `IF NOT EXISTS` guards on every `CREATE TABLE`, `CREATE INDEX`, and the `DO $$` block itself does an `IF NOT EXISTS` lookup for the constraint. Re-running the entire file against the live DB is safe — every statement either no-ops (object already exists) or backfills (missing).

```bash
gcloud sql connect stavagent-db --user=postgres --database=stavagent_portal \
  < stavagent-portal/backend/src/db/schema-postgres.sql
```

⚠️ **DO NOT run this if** you've made manual schema edits in production that aren't reflected in the SQL file. Diff first:

```bash
pg_dump --schema-only --no-owner --no-acl \
  -h <CLOUD_SQL_PROXY_HOST> -U postgres stavagent_portal \
  > /tmp/prod-schema.sql

diff <(grep -E '^(CREATE|ALTER)' /tmp/prod-schema.sql | sort) \
     <(grep -E '^(CREATE|ALTER)' stavagent-portal/backend/src/db/schema-postgres.sql | sort)
```

### Option B — Apply only missing statements manually

If diff in Option A shows production has drifted from the file (manual schema edits not in source control), apply only the missing parts identified in Step 3:

```sql
-- Re-apply the FK that started the failure cascade
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org_id'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Re-apply indexes
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_invite_token ON org_members(invite_token_hash);

-- Migration 003: Position Instance Architecture (if missing per Step 3)
-- Copy verbatim from schema-postgres.sql lines 379-450 (CREATE TABLE portal_objects,
-- portal_positions, position_templates, position_audit_log + their indexes).
```

---

## Step 5 — Repeat for Monolit DB

```bash
gcloud sql connect stavagent-db --user=postgres --database=monolith_planner < Monolit-Planner/backend/src/db/schema-postgres.sql
```

Same caveat: diff first if you suspect drift.

---

## Step 6 — Verify recovery

Re-run Step 3 queries — every row should now be present.

Then trigger application traffic and check Cloud Run logs for `[Database]` errors:

```bash
gcloud run services logs read stavagent-portal-backend \
  --region=europe-west3 \
  --limit=50 \
  --log-filter='severity>=ERROR'
```

---

## Future protection

The unit-test suite in `stavagent-portal/backend/tests/splitSqlStatements.test.js` (18 cases) and `Monolit-Planner/backend/tests/services/db/splitSqlStatements.test.js` (9 cases) lock the splitter contract. Any future change to the splitter that drops the `$$ ... $$` awareness will fail CI immediately — no more silent migration corruption.

If a NEW backend service needs the same migration runner, copy `splitSqlStatements.js` from either backend (they're verbatim copies — see `refactor(monolit-backend): use splitSqlStatements in migrations` commit message for the rationale).

---

## Open question — scheduled recovery on next session

If this recovery doc isn't actioned within a few days of the PR merging, schedule an explicit ops slot. Symptoms of leaving it unfixed:

- Random 5xx on routes that touch `portal_objects` / `portal_positions` (Migration 003 tables that may or may not exist depending on when the original migration broke)
- Foreign-key violations in Portal logs that "shouldn't be possible" if FK was actually present
- Comparison drawer / Monolit data fetch returns empty data with no error

These all trace back to schema gaps the splitter never filled.
