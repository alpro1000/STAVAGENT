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
