# Cross-User Isolation Model

> **Status:** active model after the security-isolation-hotfix PR
> (commits `a4049020`..`1879fc2f`, branch
> `claude/security-isolation-hotfix`). Supersedes the pre-multi-tenant
> "kiosk mode" assumptions documented inline in some routes.
>
> **Audit reference:** `docs/audits/pre_cemex_2026_06_28/2026-05-19_audit_mcp_isolation_submission_sidelines.md` § Section 2.

## TL;DR

Every project-scoped row is owned by exactly one user, identified by an
`owner_id` (Portal `portal_projects` + `bridges`, Registry
`registry_projects`) or `portal_user_id` (Monolit `monolith_projects`).

Three invariants hold:

1. **The owner is decided at INSERT time from the verified JWT.**
   Routes that create owned rows (`POST /create-from-kiosk`,
   `POST /api/portal-projects`, `POST /api/registry/projects`,
   `POST /api/bridges`, `POST /api/integration/import-from-{monolit,registry}`)
   require a valid Portal JWT (Bearer header or `stavagent_jwt` cookie)
   and stamp `owner_id = req.user.userId`. No more hardcoded `1`.
2. **Reads and mutations are scoped by `owner_id` in the SQL itself,
   not at the application layer.** Every `SELECT/UPDATE/DELETE` that
   touches an owned table includes `WHERE owner_id = $userId` (or a
   JOIN through to the parent project's `owner_id`). Cross-tenant
   access returns 404 — same shape as "not found", avoids leaking the
   existence of another user's resource.
3. **No `OR owner_id = 1` shortcuts.** The historical kiosk-orphan
   convenience branch in `DELETE /api/portal-projects/:id/kiosks/:linkId`
   has been removed. Pre-multi-tenant orphans are a one-off cleanup,
   not a code path.

## How `owner_id` is set on new records

| Service | Route | Source of `owner_id` |
|---------|-------|----------------------|
| Portal | `POST /api/portal-projects` | `req.user.userId` (requireAuth) |
| Portal | `POST /api/portal-projects/create-from-kiosk` | `req.user.userId` (requireAuth) — kiosks must forward JWT |
| Portal | `POST /api/integration/import-from-monolit` | `req.user.userId` (requireAuth) |
| Portal | `POST /api/integration/import-from-registry` | `req.user.userId` (requireAuth) — already fixed pre-hotfix |
| Monolit | `POST /api/bridges` | `req.user.userId` via `optionalAuth`; anonymous → 401 |
| Monolit | `POST /api/documents/upload` | `req.user.userId` via `optionalAuth`; anonymous → 401 |
| Registry | `POST /api/registry/projects` | `req.user.userId` (requireAuth) — `req.body.user_id` ignored |
| Registry | `POST /api/registry/projects/:id/sheets` auto-create | `req.user.userId` (was hardcoded 1) |
| Registry | `POST /api/registry/import/monolit` | `req.user.userId` (requireAuth) — `req.body.user_id` ignored |

## Which endpoints require auth

After the security-isolation-hotfix PR:

- **Portal `/api/portal-projects/*`** — all routes via
  `router.use(requireAuth)` (including the previously-anonymous
  `/create-from-kiosk`).
- **Portal `/api/integration/*`** — `requireAuth` on every router
  declaration. The misleading "Integration API is PUBLIC" comment has
  been replaced with a pointer to `/import-from-registry` as the
  canonical pattern.
- **Monolit `/api/bridges`** — `optionalAuth` on the router; the POST
  handler enforces a non-null `req.user.userId`.
- **Monolit `/api/documents/*`** — `optionalAuth` on the router;
  helper `requireUserId(req, res)` rejects anonymous calls on every
  handler with a 401 + `logger.warn`.
- **Monolit `/api/import-from-registry/projects`** — `optionalAuth`;
  anonymous → empty list + warn log (no `req.query.user_id || 1`
  spoofing).
- **Registry-backend `/api/registry/*`** — `requireAuth` on all 15
  routes. New middleware at `rozpocet-registry-backend/middleware/auth.js`
  (uses the same `JWT_SECRET` as Portal + Monolit).

Unauthenticated requests to protected endpoints return:

```http
401 Unauthorized
{
  "success": false,
  "error": "Unauthorized",
  "message": "Portal JWT required. Forward Authorization: Bearer <token>."
}
```

Each rejection emits a `logger.warn` line so anonymous attempts surface
in Cloud Logging. Per security-hotfix Q2 = B ("401 + log").

## How E2E isolation tests verify the model

`stavagent-portal/backend/tests/isolation.e2e.test.js` runs against the
real Express routers with a query-spying pool double. 11 cases across
5 scenarios cover:

- Anonymous → 401 on every newly-protected endpoint (5 cases).
- User B's JWT → cross-tenant reads return 404 (no data leak).
- User B's JWT → cross-tenant writes return 404 (no data corruption).
- DELETE no longer contains the `OR owner_id = 1` clause (regression
  guard).
- `/api/integration/list-registry-projects` filters `WHERE owner_id =
  $userId` — was previously returning every user's projects.

Run locally:

```bash
cd stavagent-portal/backend
npm test
# 49/49 passing (11 isolation + 38 pre-existing)
```

The tests use a test-only seam `__setPoolForTesting(p)` exported from
`src/db/postgres.js`. Production callers never invoke it.

## Migration: cleaning up the 58 sirot records

Existing pre-hotfix data may contain `owner_id = 1` orphans. Cleanup is
**manual** per security-hotfix Q1 = D:

1. Run the inspection queries in
   `stavagent-portal/backend/src/db/migrations/2026-05-19_sirot_cleanup_DRYRUN.sql`
   (Section A — read-only).
2. Review row-by-row.
3. Uncomment the chosen action block (B1 REASSIGN, B2 DELETE, B3
   ARCHIVE), fill the project_id list, run inside a transaction.
4. Re-run Section A to verify count drops to 0.

The migration file is intentionally NOT auto-applied by any runner.

## Failure modes & how they surface

| Failure | Symptom | Where it shows up |
|---------|---------|-------------------|
| Kiosk forgot to forward JWT | 401 from the kiosk's HTTP client | Cloud Logging `[Auth] 401 — anonymous …` line per failed call |
| Expired token | 401 + `Token vypršel` | Frontend should refresh; logged as `[Auth] 401 — expired JWT` |
| Cross-tenant attempt | 404 (same shape as "not found") | Application-level `success: false, error: 'Project not found'` |
| Pool unreachable | 503 | `[PortalProjects] Database not available` |

## What's intentionally NOT in this model

- **RBAC / per-resource roles.** Out of scope. Only basic owner
  isolation. Admin overrides, share-with-user, organization tenancy —
  separate future work.
- **Audit log of access.** Out of scope. We log rejections (401), not
  successful reads. Separate future feature.
- **Cross-organization access.** No "org" concept exists yet — every
  user_id is its own tenant boundary.

## Files in the security-isolation-hotfix PR

```
stavagent-portal/backend/src/routes/portal-projects.js  (requireAuth on /create-from-kiosk, drop OR owner_id=1)
stavagent-portal/backend/src/routes/integration.js      (requireAuth on 5 routes, owner-scoped SQL)
stavagent-portal/backend/src/db/postgres.js             (+__setPoolForTesting seam, 9 LOC)
stavagent-portal/backend/src/db/migrations/2026-05-19_sirot_cleanup_DRYRUN.sql  (playbook)
stavagent-portal/backend/tests/isolation.e2e.test.js    (11 test cases)
Monolit-Planner/backend/src/routes/bridges.js           (optionalAuth, drop ownerId=1)
Monolit-Planner/backend/src/routes/documents.js         (optionalAuth + requireUserId helper, 6 sites)
Monolit-Planner/backend/src/routes/import-from-registry.js  (optionalAuth, drop || 1 fallback)
rozpocet-registry-backend/middleware/auth.js            (new — JWT middleware mirroring Monolit)
rozpocet-registry-backend/server.js                     (requireAuth on 15 routes, owner-scoped SQL)
rozpocet-registry-backend/package.json                  (+jsonwebtoken dep)
docs/security/isolation_model.md                        (this file)
```
