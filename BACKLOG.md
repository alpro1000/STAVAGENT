# STAVAGENT Backlog

Tickets logged here are tracked separately from CLAUDE.md TODOs — these are
items deferred from in-flight PRs that need their own focused work.

---

## ✅ CLOSED (2026-05-31): cross-user-data-isolation

**Severity:** was P0 — security + GDPR
**Affects:** Monolit-Planner (Kalkulátor betonáže), Registr
**Reporter:** Founder, observed 2026-05-12 post Landing v3 merge

**Resolution (2026-05-31):** The reported symptom — a fresh user seeing ALL
projects without per-user filtering — was fixed and shipped in 5 incremental
commits (see `docs/soul.md` §9 entry 2026-05-31). Owner scoping
(`portal_user_id` / `owner_id` WHERE-predicates) now covers the project-list
and mutation endpoints in Portal, Monolit and Registry; cross-account access
returns 403. Canonical model + route inventory:
`docs/security/isolation_model.md`. Regression guard: isolation e2e tests +
the `cross-user-isolation-reviewer` agent runs on every PR touching owned
tables.

**Remaining related work (tracked separately, NOT this ticket):** the
2026-07-01 full-repo audit found *unauthenticated* routes (a different class:
no login required at all, vs. logged-in user seeing foreign data): Portal
`/api/pump/*` + `/api/parse-preview/import` + `/api/kb/research`, Monolit
`positions.js`/`planner-variants.js`, URS (no auth as a class), Registry
`cleanup-empty` owner-scope + 2 unauthed endpoints. These are scoped as
**Sprint A** in the audit report and remain the blocker before any public
demo. Do not reopen this ticket for them.

## urs-sqlite-to-postgres

**Severity:** P1 — data loss on every Cloud Run restart
**Affects:** URS_MATCHER_SERVICE (Klasifikátor)
**Source:** 2026-07-01 audit, Sprint B item 6; assessed 2026-07-07

**Symptom:**
`backend/src/db/init.js` opens SQLite on the container filesystem
(`file:./data/urs_matcher.db`). Cloud Run's filesystem is ephemeral —
batch_jobs, work packages and caches vanish on every restart/deploy.
Catalog data (17 940 OTSKP codes) survives because it re-seeds at boot.

**Why not fixed inline (2026-07-07):** 18 backend files touch the DB
(sqlite3 driver API), 12 tables in init.js, ~232 tests assume SQLite,
and the fix needs infra provisioning that cannot be done from the repo:
a new `urs_matcher` database on the `stavagent-db` Cloud SQL instance +
DSN secret in Secret Manager + cloudbuild env wiring. A blind partial
rewrite risks breaking a working service for zero durability gain.

**Dedicated PR scope:**
1. Provision `urs_matcher` DB on stavagent-db (manual, gcloud) + secret
2. Introduce a thin query adapter (sqlite3 vs pg) OR migrate to `pg`
   directly; port 12 CREATE TABLEs (AUTOINCREMENT→SERIAL, datetime fns)
3. Keep SQLite as the local-dev default via DATABASE_URL switch
4. Migrate/accept loss of current ephemeral data (it dies on restart
   anyway — nothing durable to migrate)
5. Green: full URS test suite + one live batch job surviving a restart

**Estimated effort:** 2-3 days including test port.

## register-route-redirect

**Severity:** P2 — minor UX, workaround in place

**Symptom:**
Direct navigation to /register redirects unauthenticated users to /.

**Current workaround (applied):**
LandingPage.tsx goCta() routes unauthenticated users to /login.
Login page has working "Nemáte účet? Zaregistrujte se" link to
functional registration form.

**Future fix scope:**
1. Investigate why /register redirects (likely auth guard logic 
   inversion or missing route in App.tsx)
2. Fix the route directly
3. Optionally restore goCta to /register for cleaner UX

**Trigger:** Optional. Current /login flow is functional.
