# TASK — Security Isolation Hotfix (pre-Cemex P0)

> **STAVAGENT security hotfix.** Closes cross-user isolation gaps 
> identified in pre-Cemex audit. Standalone — does NOT touch UEP code, 
> can run in parallel with UEP PR2 session on separate branch.
> 
> **Reference (odloženo — audit zatím nevznikl):** plánovaný audit
> `docs/audits/pre_cemex_2026_06_28/2026-05-19_audit_mcp_isolation_submission_sidelines.md`
> je nedodaný výstup tasku
> [`TASK_AUDIT_MCP_Isolation_Cemex_Sidelines.md`](TASK_AUDIT_MCP_Isolation_Cemex_Sidelines.md);
> soubor zatím neexistuje. Isolation gaps zde popsané byly identifikovány
> přímo v kódu, ne v tomto auditu.
> 
> **Estimated effort:** ~25-30 hours total, doable in 1-2 Claude Code sessions.

---

## MANTRA

> 1. Read repo first — fully understand existing auth pattern 
> (`requireAuth`, JWT handling, user_id propagation from request)
> 2. Derive naming from existing conventions — don't introduce new auth 
> primitives, reuse what's there
> 3. Each fix = separate atomic commit (auditable)

---

## §0. CONTEXT — CONFIRMED STATE

**Already OK (verified by user 2026-05-19):**
- ✅ `VITE_DISABLE_AUTH=false` in Vercel Production for Portal — auth IS enabled
- ✅ Portal authentication flow works
- ✅ JWT validation in Core Engine works

**Issues identified by audit, NOT yet fixed:**
- ❌ Hardcoded `owner_id=1` in 3 backend endpoints — every new project 
  gets attributed to user_id=1 regardless of actual authenticated user
- ❌ ~9 endpoints in Registry/Monolit-Planner missing `requireAuth` 
  middleware/decorator — accessible without authentication
- ❌ Integration routes (cross-kiosk) missing `requireAuth`
- ❌ 58 "sirot" records in database have `owner_id=1` from before 
  multi-tenant — need cleanup decision
- ❌ Zero E2E tests verifying isolation (user A cannot access user B data)

**Why this matters:** Even with auth enabled, hardcoded `owner_id=1` 
means everyone's data ends up under the same database owner. Auth 
prevents unauthenticated access; isolation prevents authenticated 
user A from seeing user B's projects. Both layers needed.

---

## §1. SCOPE

This task:
1. Remove all hardcoded `owner_id=1` from production code paths
2. Add `requireAuth` (or equivalent existing pattern) to ~9 Registry/Monolit endpoints
3. Add `requireAuth` to cross-kiosk integration routes
4. Provide DB cleanup migration for 58 sirot records (with user confirmation)
5. Add 5 E2E isolation tests (user A cannot read/write/delete user B's data)

**NOT in this task:**
- UEP code (continues in parallel UEP PR2 session)
- New auth provider integration
- OAuth flow changes
- User registration / signup flow changes
- Role-based access control (RBAC) — only basic isolation
- Admin override patterns

---

## §2. PRE-IMPLEMENTATION INTERVIEW

Minimal — most decisions clear from audit. Ask only:

**Q1 — 58 sirot records handling:**
- (A) Reassign all to a specific user_id (user provides)
- (B) Delete (data is test/junk)
- (C) Move to `archived_projects` table with note "pre-multi-tenant"
- (D) Manual case-by-case review (user looks at list first)

Default: ask user to look at list first, then pick action.

**Q2 — `requireAuth` failure mode for previously-unauthenticated endpoints:**
- (A) Return 401 Unauthorized (breaks any existing clients)
- (B) Return 401 + log incident for monitoring
- (C) Soft mode for 7 days: log but still allow, then enforce

Default: **B** (strict from day 1, but logged for diagnostics). If 
known clients depend on these endpoints unauthenticated — STOP, ask user.

**Q3 — E2E test infrastructure:**
- (A) Use existing integration test framework in repo
- (B) Use Playwright/Cypress for browser-driven E2E
- (C) HTTP-level tests (faster, sufficient for isolation verification)

Default: **C** (HTTP-level — fastest, covers the actual security boundary, 
no UI flakiness).

---

## §3. BUSINESS LOGIC

### 3.1 Hardcoded owner_id=1 removal

Find all occurrences:
```bash
grep -rn "owner_id\s*=\s*1" --include="*.py" --include="*.ts" --include="*.tsx"
grep -rn '"owner_id":\s*1' --include="*.py" --include="*.ts"
grep -rn "owner_id: 1" --include="*.py" --include="*.ts"
```

Per audit, expected ~3 occurrences in backend endpoints.

For each occurrence:
1. Trace the endpoint handler
2. Identify how `requireAuth` (or existing auth middleware) exposes 
   authenticated user (likely `request.user.id` or similar — derive 
   from existing conventions)
3. Replace `owner_id=1` with `owner_id=<authenticated_user_id>`
4. Verify endpoint signature includes auth requirement

If `owner_id=1` is used in a SYSTEM context (e.g. seed scripts, default 
admin user, migration scripts) — leave it but document as system use 
in code comment. STOP and ask if unsure.

### 3.2 requireAuth additions

Per audit list of 9 broken endpoints (exact names in audit document). 
For each:
1. Locate the route handler
2. Add the existing auth middleware/decorator (match existing pattern 
   used by working endpoints in same router)
3. Verify endpoint now returns 401 without valid token

Integration routes (cross-kiosk): same treatment. Audit lists specific 
routes.

### 3.3 DB cleanup for sirot records

```sql
-- Step 1: List sirot records for user review
SELECT project_id, name, created_at, last_updated 
FROM projects 
WHERE owner_id = 1
ORDER BY last_updated DESC;
```

Present to user (Александр). Based on Q1 answer, execute one of:
- Reassign: `UPDATE projects SET owner_id = <user_id> WHERE owner_id = 1 AND project_id IN (...);`
- Delete: `DELETE FROM projects WHERE owner_id = 1 AND project_id IN (...);`
- Archive: `INSERT INTO archived_projects SELECT * FROM projects WHERE ...; DELETE FROM ...;`

Wrap in Alembic migration. NEVER execute without explicit user 
confirmation per record list.

### 3.4 E2E isolation tests

Minimum 5 tests, each user A vs user B:

1. **Project list isolation:** user A creates project, user B's 
   `/projects` list does NOT include it
2. **Project read isolation:** user A creates project, user B's 
   `GET /projects/<A_project_id>` returns 403/404
3. **Project update isolation:** user B's `PATCH /projects/<A_project_id>` 
   returns 403/404
4. **Project delete isolation:** user B's `DELETE /projects/<A_project_id>` 
   returns 403/404
5. **Cross-kiosk isolation:** Registry user A's data not exposed via 
   Monolit-Planner endpoint for user B

Tests should:
- Create two real test users (user A + user B) in test DB
- Authenticate as each via existing test auth flow
- Make requests, assert expected 403/404 or filtered responses
- Clean up created records in teardown

---

## §4. ACCEPTANCE CRITERIA

### Code
1. Zero hardcoded `owner_id=1` in production code paths 
   (`grep -rn "owner_id\s*=\s*1"` returns only comments / system code)
2. All ~9 audit-identified Registry/Monolit endpoints have 
   `requireAuth` (or equivalent existing decorator)
3. All audit-identified integration routes have `requireAuth`
4. No regression: previously-working authenticated requests still work
5. Unauthenticated requests to newly-protected endpoints return 401

### Database
6. Alembic migration ready (NOT auto-executed) for 58 sirot records 
   per user decision from Q1
7. After migration: `SELECT COUNT(*) FROM projects WHERE owner_id = 1` 
   returns 0 (or only legitimate system records)

### Tests
8. 5 E2E isolation tests written and passing
9. Tests run in CI alongside existing tests
10. All existing tests still pass (no regression)

### Documentation
11. Brief `docs/security/isolation_model.md` documenting:
    - How `owner_id` is set on new records
    - Which endpoints require auth
    - How E2E isolation tests verify the model

---

## §5. STOP CONDITIONS

1. `owner_id=1` is used as legitimate system identity (admin, seed user) 
   in some code paths → STOP, ask user how to distinguish
2. Existing auth middleware pattern unclear or inconsistent across 
   routes → STOP, ask user which pattern is canonical
3. 58 sirot records review reveals legitimate production data that 
   shouldn't be touched → STOP, ask user
4. Adding `requireAuth` to integration route breaks known cross-kiosk 
   flow → STOP, ask if exception needed (likely auth token forwarding 
   issue)
5. E2E test setup requires DB schema not yet in test environment → 
   STOP, request migration before tests

---

## §6. NAMING & PR

Branch: `claude/security-isolation-hotfix`  
PR: open at end of session, label `security`, request review.  
Title: `fix(security): isolation hotfix — remove owner_id=1 + add requireAuth + E2E tests`

Commits (atomic, suggested order):
1. `fix(security): remove hardcoded owner_id=1 from <endpoint1>`
2. `fix(security): remove hardcoded owner_id=1 from <endpoint2>`
3. `fix(security): remove hardcoded owner_id=1 from <endpoint3>`
4. `fix(security): add requireAuth to Registry endpoints (batch 1/2)`
5. `fix(security): add requireAuth to Monolit endpoints (batch 2/2)`
6. `fix(security): add requireAuth to integration routes`
7. `chore(security): Alembic migration for 58 sirot records`
8. `test(security): E2E isolation tests user A vs user B`
9. `docs(security): isolation model documentation`

---

## §7. PARALLEL WORK NOTE

This security task is **branch-isolated** — does NOT touch:
- `packages/core-backend/app/services/uep/*` (UEP services)
- `packages/core-backend/app/knowledge_base/B10_coverage_matrices/*` 
  (coverage matrices)
- `packages/core-backend/app/models/uep_schemas.py` (UEP schemas)

UEP PR2 session can run on `claude/uep-pr2-reconciliation-derivation-rest` 
branch simultaneously. Merge order: security hotfix first (smaller, 
faster review), then PR2.

---

## §8. SUCCESS DEFINITION

Done when:
- Александр (or any user) creates a new project → `owner_id` = his actual 
  user_id, not 1
- User A and User B test accounts confirmed isolated via E2E tests
- Audit's P0 security findings closed
- Ready for Cemex demo with "we have multi-tenant isolation tested in 
  CI" as a defensible claim

---

**End of security hotfix task.**

> Reminder: This is hotfix, not refactor. Minimum changes for max 
> isolation. RBAC, admin overrides, audit logs of access — all out of 
> scope. Just close the cross-user gap.
