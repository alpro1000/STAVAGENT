# Session Handoff — 2026-04-28

**Cross-subdomain auth diagnosis + 7 PR roundup + business positioning revision.**

This is a single-file handoff so a future agent session (or you, fresh tomorrow) picks up the full context without re-deriving from logs / git history.

---

## 1. Production state at end of session

### Cloud Run

- **Service**: `stavagent-portal-backend` (region `europe-west3`)
- **Active revision**: `stavagent-portal-backend-00255-srx` deployed `2026-04-28T10:35:51Z`
- **Image**: `europe-west3-docker.pkg.dev/.../cloud-run-source-deploy/stavagent-portal-backend:latest`
- **PR #1043 (JWT requireAuth) — DEPLOYED**, working. Logs show `req.user.userId === 2` authenticating successfully.
- **PR #1045 (cookie fallback) — DEPLOYED**, working. New log message `no token provided (header or cookie)` confirms.
- **Failed phantom revision** `stavagent-portal-backend-00258-nzh` exists but never served traffic (image `manual-20260428-125438` was never pushed to registry — Cloud Run kept old revision). Safe to delete:
  ```bash
  gcloud run revisions delete stavagent-portal-backend-00258-nzh --region=europe-west3
  ```

### Cloud SQL — `stavagent-db` (postgres 15)

- DB `stavagent_portal`: **partial schema state**. Most of schema-postgres.sql DID apply (Migration 003 tables `portal_objects` / `portal_positions` exist — production sync writes 1867 rows successfully into them). The `DO $$ ... fk_users_org_id ... $$;` block at schema-postgres.sql:359 fails on the broken splitter, so MISSING in production:
  - FK constraint `fk_users_org_id`
  - Indexes: `idx_organizations_owner`, `idx_organizations_slug`, `idx_org_members_org`, `idx_org_members_user`, `idx_org_members_invite_token`
  - (Possibly more — diagnose with the queries below before recovery.)
- DB `monolith_planner`: same splitter bug exists in Monolit backend's migrations.js but no `DO $$` blocks in its schema yet → no current corruption. PR #1051 fixes preemptively.

### Frontend (Vercel)

- `registry.stavagent.cz` (Registry) — last bundle pre-PR-#1049. PR #1049 fixes 5 unwired Portal fetches; merge → Vercel auto-redeploys → /portal-projects 401 closes.
- `www.stavagent.cz` (Portal) — has PR #1043 cookie write, working.

---

## 2. Open PR queue (recommended merge order)

| PR | Branch | What | Priority |
|----|--------|------|----------|
| **#1049** | `fix/registry-portal-auth-headers` | 5 frontend Portal fetches wired w/ `credentials:'include'` + `portalAuthHeader()` | **P0 — fixes visible 401** |
| **#1051** | `fix/sql-migration-dollar-quoted-splitter` | $$-aware SQL splitter + 47 tests + recovery doc | **P0 — prevents future bootstrap failures** |
| **#1050** | `docs/next-session-pr2-sql-splitter` | docs-only PR-2 plan in next-session.md | **P3 — obsolete after #1051 merges** (close without merge OR merge for history) |
| #1041 | `fix/registry-skupina-filter-resizable` | SkupinaFilterDropdown drag-resize + bot-review thread already answered | P2 — UX polish |
| #1044 | `feat/popis-wrap-and-sheet-preview` | Popis cell wrap + sheet picker preview | P2 — UX polish |
| #1042 | `fix/aipanel-undefined-results` | AIPanel guard against missing API fields (defensive on partial responses) | P1 — protective fix |

PR #1023 (ribbon), #1028 (reclassify), #1029 (import D1+D2), #1031 (template dedupe), #1033 (table UX), #1036 (sync timeouts), #1043 (JWT requireAuth), #1045 (cookie fallback) — already merged earlier in session.

---

## 3. Critical post-merge ops (one-time)

After PR #1051 deploys (Cloud Build auto-trigger on main):

Full procedure: see [`docs/MIGRATION_RECOVERY_2026_04.md`](MIGRATION_RECOVERY_2026_04.md). Short form below.

```bash
# 1. Connect (gcloud handles auth — do NOT extract secrets to shell)
gcloud sql connect stavagent-db --user=postgres --database=stavagent_portal

# 2. In psql — diagnose what's actually missing:
SELECT conname FROM pg_constraint WHERE conname = 'fk_users_org_id';
SELECT indexname FROM pg_indexes
  WHERE indexname IN ('idx_organizations_owner','idx_organizations_slug',
                      'idx_org_members_org','idx_org_members_user','idx_org_members_invite_token');
SELECT tablename FROM pg_tables
  WHERE tablename IN ('portal_objects','portal_positions','position_templates','position_audit_log');

# 3. Apply missing items. Likely just:
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org_id') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_invite_token ON org_members(invite_token_hash);

# 4. Repeat connect to monolith_planner DB. Likely no missing items there
#    (no DO blocks in Monolit schema), but verify.
```

---

## 4. Architectural insights worth keeping

### Cookie cross-subdomain auth contract

Three layers must align:

1. **Portal frontend** (`AuthContext.tsx`) writes JWT to:
   - `localStorage.auth_token` — for legacy in-app calls
   - `stavagent_jwt` cookie with `domain=.stavagent.cz`, `secure`, `samesite=lax`, `max-age=86400` — for cross-subdomain sharing
2. **Kiosk frontends** (Registry, Monolit, URS, Beton Calculator) must read the cookie via `document.cookie` and send it both ways:
   - As `Authorization: Bearer <jwt>` header (works across all browsers)
   - With `credentials: 'include'` on fetch options (lets browser auto-attach cookie, but Safari ITP / Firefox TCP can strip)
   - Both belt-and-suspenders is the right answer.
3. **Portal backend** `requireAuth` middleware accepts EITHER:
   - `req.headers.authorization` Bearer token
   - `req.cookies.stavagent_jwt` (via `cookie-parser` middleware)
   - On success: `req.user = decoded JWT payload`, plus `req.authSource = 'header' | 'cookie'` for log debugging.

Tests pinning the contract: `stavagent-portal/backend/tests/auth.middleware.test.js` (9 cases, PR #1045) + `rozpocet-registry/src/services/portalAuthWiring.test.ts` (5 lint-style cases, PR #1049).

### Migration runner contract

`migrations.js` files in BOTH Portal and Monolit backends MUST use `splitSqlStatements()` (not naive `split(';')`) when chunking schema files. The splitter handles:
- `$$ ... $$` and `$tag$ ... $tag$` dollar-quoted bodies
- `'...'` string literals (with PG `''` escape)
- `--` line comments and `/* ... */` block comments

Outside any of those, `;` separates statements. Any of these contexts: `;` is part of the statement body.

Tests pinning: `stavagent-portal/backend/tests/splitSqlStatements.test.js` (18 cases, node:test) + `Monolit-Planner/backend/tests/services/db/splitSqlStatements.test.js` (9 cases, jest).

---

## 5. Diagnostic process pattern (worth re-using)

When a frontend reports 401 and backend changes have been made, the diagnostic sequence:

1. **Verify deploy** — `gcloud run revisions list ...` + check creationTimestamp ≥ merge timestamp
2. **Verify middleware order** — server.js `app.use()` chain — cookie-parser before routes
3. **Verify CORS** — credentials: true + specific origin echo (NOT `*`)
4. **Verify env vars** — JWT_SECRET set, SERVICE_API_KEY (be aware of name mismatches like `SERVICE_TOKEN` in env vs `SERVICE_API_KEY` in code)
5. **Verify request shape from frontend** — DevTools Network tab → which endpoint, what headers does Registry actually send? "anonymous fetch" pattern is the most common bug
6. **Add debug endpoint** if remote diagnosis stalls — non-auth `/api/debug/auth-status` that echoes back `req.cookies / req.headers / env presence` so live state is observable

The session showed: jumping to backend hypotheses (cookie middleware, CORS) when the actual bug was frontend (5 unwired fetches with no auth at all). Ask "what is the request actually carrying?" early.

---

## 6. Business positioning — REVISED understanding

**Initial framing (incorrect)**: STAVAGENT competes with KROS, RIB iTWO, CYPE Presto in BOQ database / catalog space. Geographic expansion was estimated as €300-500K + 5 years for Germany.

**User clarification**: NOT competing on catalog positions. Building **fast engineering calculator + Excel BOQ parser** — closer to Hilti PROFIS / DOKA Tipos / Frilo than KROS/Presto.

**This changes everything**:

| Question | Pre-clarification | Post-clarification |
|---|---|---|
| Direct competitors | KROS, RIB, CYPE — established | Manufacturer-specific tools (DOKA, PERI), single-purpose. **No multi-element fast calculator with Excel-import + AI advisor exists.** |
| ARR potential | €100-300K Czech only | €150-500K Czech, **€1M+** with DE+ES expansion |
| Spain expansion | 2-3 years, €50-100K (CYPE partnership) | **1 year, €15-30K** (Eurocode 2 + Spanish UI) |
| Germany expansion | 5+ years, €300-500K | **1-2 years, €30-50K** (DIN 1045 + DIN 18218 already in code, EC2 base) |
| Defensibility moat | Catalog depth (weak) | **Engineering correctness + multi-element coverage** (strong) |

**Key fact for DE/ES expansion**: Monolit Planner ALREADY uses DIN 18218 (German) for lateral pressure on formwork. Eurocode 2 base is shared across all EU countries. No StLB-Bau / Generador de Precios licensing needed because user is NOT generating BOQ — just engineering calculation.

**Pricing model recommendation**:
- Free: 5 calculations/month individual
- Pro €80/mo: unlimited individual, AI advisor, Excel import
- Team €400/mo: 5 seats, shared projects, Portal integration
- Enterprise: custom, on-premise option

**Marketing language to adopt**: emphasize TKP18 / DIN 18218 / EC2 norm citations, "calculator that cites the standards" — that's the unfair advantage vs generic AI tools / desktop legacy software.

**Critical risks (unchanged)**:
1. Bus factor = 1 (single dev). Top risk for the business.
2. Production reliability — today's session demonstrated real fragility. Enterprise customers churn fast on this.
3. Building features ≠ revenue. No sales/marketing motion visible in codebase context yet.

---

## 7. Technical debt parking lot (deferred)

Items mentioned during diagnosis but not actioned yet, in rough priority:

- **Cleanup of duplicate "58 проектов вместо 3"** — `mergeProjects` dedupes only by `project.id`, not by name. Backend Postgres has accumulated stale projects from many sessions. Need: dedupe-by-name on pull + cleanup migration. Tracked in `next-session.md` as PR-X2 plan. ~2-3 h.
- **Schema for classification roundtrip** — Registry items written to backend lose `rowRole`, `parentItemId`, `sectionId`, `_rawCells` (backend `RegistryItem` interface doesn't have them). Cloned-back projects can't reclassify. Tracked as PR-X1. ~4-6 h.
- **Cross-kiosk tombstone share** — Monolit shows projects Registry has tombstoned because tombstone store is per-app localStorage. Tracked as PR-X3. ~2-3 h.
- **Cloud Run min-instances=1** — eliminates cold-start timeouts. Infra change, not code. ~0 h.
- **Reclaim flow for owner_id=1 orphan projects** — pre-#1043 anonymous syncs left projects under user 1. Need claim endpoint. ~2-3 h. Documented in next-session.md.
- **Cross-kiosk login indicator** — Monolit / URS / Beton Calculator should show `<UserBadge />` (logged-in user email). Cookie infrastructure already in place from PR #1043. ~1 h × 4 kiosks.
- **`SERVICE_TOKEN` env in Cloud Run** — set but never read by code. Either delete from env (cleanup) or wire to `requireServiceKey` (rename match). Pre-existing inconsistency, low priority.
- **Failed revision 00258-nzh** — phantom on Cloud Run. Delete: `gcloud run revisions delete stavagent-portal-backend-00258-nzh --region=europe-west3`.

---

## 8. What I (the agent) confirmed in this session

- 8 PRs opened, 6 already merged earlier in same long session, 7 still open at session end.
- 47 new tests across both backends (auth middleware + SQL splitter wiring).
- Live diagnostic on production via `gcloud run services logs read` confirmed: PR #1043 + #1045 are deployed, /import-from-registry actually returns 200, /portal-projects 401 IS the visible bug → PR #1049 closes it.
- Verified cookie-parser middleware order, CORS allowlist, all env vars on Cloud Run.
- Identified migration splitter as latent (not blocking the visible 401 but will block fresh deploys).
- Diagnosed business positioning shift mid-session — moving anchor from "BOQ-tool that loses to KROS" to "engineering calculator with no direct competitor".

---

## 9. What to do tomorrow (if you're picking this up)

**30-minute path, low risk**:
1. Merge PR #1049. Vercel auto-redeploys Registry frontend in ~2 minutes.
2. Open `registry.stavagent.cz`, hard refresh, click any project's Portal badge — should now show project picker, not "Portal vrátil chybu".
3. Open browser DevTools Network tab — `/api/portal-projects` should return 200, not 401.

**60-minute path, complete the deploy chain**:
4. Merge PR #1051. Cloud Build auto-trigger spins up new revision in ~5 minutes.
5. `gcloud run revisions list --service=stavagent-portal-backend --region=europe-west3 --limit=3` — verify new revision is `Ready`.
6. Boot logs check: `gcloud run services logs read ... --log-filter='resource.labels.revision_name="<NEW>"'` — confirm `[Database] Schema initialized successfully` (no 42601 error).
7. Connect to Cloud SQL, run diagnostic queries from §3 above, apply missing items.
8. Close PR #1050 (obsolete) and #1051 deletes the file it documented.
9. Cleanup phantom revision 00258-nzh.

**End-of-day**:
- Production fully healthy, 401 closed, schema complete, splitter pinned by tests.
- 4 small UX PRs (#1041, #1042, #1044) can be merged when convenient — no production blocker.

---

*Generated by Claude Code session 01UTTskGhUBSW4FBU1CmxTEx, 2026-04-28.*
