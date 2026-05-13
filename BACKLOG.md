# STAVAGENT Backlog

Tickets logged here are tracked separately from CLAUDE.md TODOs — these are
items deferred from in-flight PRs that need their own focused work.

---

## CRITICAL: cross-user-data-isolation

**Severity:** P0 — security + GDPR
**Affects:** Monolit-Planner (Kalkulátor betonáže), Registr
**Reporter:** Founder, observed 2026-05-12 post Landing v3 merge

**Symptom:**
After registering a fresh user account, that user has access to
ALL projects in Monolit-Planner and Registr without per-user
filtering. No tenant boundary visible.

**Suspected causes (to investigate):**
1. Backend routes not filtering by user_id / org_id / owner
2. Frontend not passing auth context to project list queries
3. DB queries missing WHERE owner_id = $current_user
4. Migration legacy data assigned to default owner_id=1, leaks

**Not fixed in current PR (landing-quickfix-subtitle-cta) because:**
- Requires careful authentication review
- Needs authorization checks added per route
- DB query audit required across all project endpoints
- Test coverage essential before shipping

**Dedicated PR scope when addressed:**
1. Audit all GET endpoints returning project lists
2. Verify WHERE clauses include current user filter
3. Add integration tests: User A registers, creates project, User B
   registers, User B sees zero projects
4. Verify across all three kiosks: Portal, Kalkulátor, Registr
5. Migration plan for any existing leaked data (assign to original
   owner or quarantine)

**Trigger:** Before any public marketing / Cemex CSC submission
goes live referencing the SaaS product.

**Estimated effort:** 8-16 hours including testing.

**Risk if not fixed:** GDPR fine + trust collapse if any real user
data is exposed cross-tenant.
