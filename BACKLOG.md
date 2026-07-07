# STAVAGENT Backlog

Tickets logged here are tracked separately from CLAUDE.md TODOs — these are
items deferred from in-flight PRs that need their own focused work.

---

## mcp-e2e-zalmanov-findings (2026-07-07) — 5 tickets, all ✅ FIXED same day

**Source:** live MCP E2E test on SO 202 (D6 Olšová Vrata–Žalmanov, most přes
Lomnický potok): drawing 202/17 «Tvar NK» (vision) + soupis E_Soupis_skupiny_
MOSTY_PHS.xlsx (99 items) → classify → calculate → Nh. Full run in chat log
2026-07-07; canonical passport example saved to
`docs/specs/tz-passport-json/example_SO202_zalmanov.json`.

1. ✅ **MCP calculate lacked `rebar_mass_kg`** — soupis tonnages (469 t NK!)
   untranslatable; engine ratio estimates ran −15…−25 % vs VV. FIXED:
   passthrough param (+ `prestress_strand_mass_kg` for the 35 Nh/t norm) in
   `app/mcp/tools/calculator.py`.
2. ✅ **MCP calculate lacked `num_tacts_override`** — TZ's «ve 3 taktech na
   skruži» could only FLAG (validation rule), never compute. FIXED: explicit
   passthrough; wins over cycle_length_bm-derived count.
3. ✅ **W3 classifier: «PODKLADNÍ A VÝPLŇOVÉ VRSTVY…» → `jine`** (rebar
   100 kg/m³ fabricated for prostý beton). FIXED across the SSOT chain:
   `element_types.yaml` w3_name jine→podkladni_beton + w3_family entry,
   W3 `ELEMENT_TYPES["podkladni_beton"]` (rebar 0), kb-generated TS artifact
   regenerated (drift check green).
4. ✅ **Římsa bm→m² translation fed TOTAL length as PER-TACT area** (243 bm →
   243 m²/tact → formwork labor/rental ~9× inflated; engine's own sanity net
   flagged 16.4 m²/m³). FIXED: per-tact quantity = length ÷ tacts; replay
   fixture 13 re-captured via local engine.
5. ✅ **bridge-technology recommended an option its own feasibility map
   rejected** (span 44.5 m > 40 → MSS while 3 pole < 4 → infeasible). FIXED:
   feasibility guard — never recommend infeasible while a feasible option
   exists; reason + ⚠️ warning explain the fallback (Žalmanov now → pevná
   skruž se zesíleným projektem podpěr).

**Remaining from the same test (NOT fixed here):** MCP tool description still
says «22 types» in a few doc spots (now 23 with podkladni_beton) — cosmetic;
live re-verification of fixes after deploy.

## tz-passport-json — extraction pipeline «dokumentace → JSON → kalkulátor»

**Severity:** P1 — product feature (Alexander's ask 2026-07-07)
**Spec seed:** `docs/specs/tz-passport-json/` (requirements draft + canonical
example `example_SO202_zalmanov.json` — hand-built by Alexander from the SO 202
TZ, validated against soupis + drawing in the 2026-07-07 E2E session).

**Idea:** teach the system to extract a STRUCTURED BRIDGE PASSPORT (JSON) from
project documentation (TZ + drawings + soupis) so the calculator consumes it
directly. Two halves:
1. **Consuming side (small, deterministic):** mapper passport-JSON →
   `PlannerInput[]` (per-element: volumes from soupis/VV, concrete classes per
   use from `materials_and_standards.concretes` — incl. full exposure strings
   «C30/37-XF4+XD3+XC4», spans/width/subtype from `geometry` +
   `structural_system`, tz_facts from `construction_process`, strand mass from
   `post_tensioning`). Extends the existing `tz_facts` seam.
2. **Extraction side (big, staged):** TZ text → passport via extend
   `extract_tz_fields` (stage 1 text) + stage 2 drawings (UEP/vision) + stage 3
   soupis quantities join. Provenance per field (Pattern 29), honest-blank for
   missing (Pattern 26).

**Interview needed before design:** schema governance (who owns the JSON
shape), where extraction runs (CORE UEP vs MCP tool vs offline), LLM vs
regex split per section, and how conflicts TZ↔soupis surface (E2E found two:
pier C35/45 per TZ vs soupis band «DO C40/50» — Pattern 53; deck C35/45 vs
band C40/50).

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

## ✅ CLOSED (2026-07-07): register-route-redirect

**Severity:** was P2 — but it silently killed the org-invite flow for new
users (OrgInvitePage sent them to /register → catch-all → /).

**Root cause:** `/register` was simply never declared in App.tsx routes —
the `*` catch-all swallowed it. Additionally LoginPage ignored the
`?redirect=` param, so even the /login half of the invite flow dropped the
invite token after authentication.

**Fix (2026-07-07, audit Sprint C):** `/register` route renders LoginPage
with `initialMode="register"`; LoginPage honors `?redirect=` on successful
login and on the already-authenticated early return (internal paths only —
leading `/`, not `//` — no open redirect). Invite flow now round-trips:
invite link → register/login → back to `/org/accept-invite?token=…`.
