# Handoff 2026-07-07 (konec relace) — zadání pro příští relaci

**Base:** `origin/main` @ `daba05f` (PR #1426 merged). Vše z 2026-07-07 je
v main: audit Sprint B+C+D (#1423), SO-202 Žalmanov E2E fixy + tz-passport
half A + composite-UI fixy (#1426).
**Vývojová větev příští relace:** `claude/lucid-newton-0xuxf6` (restartovat
z main — `git fetch origin main && git checkout -B claude/lucid-newton-0xuxf6 origin/main`).

---

## Stav (co je HOTOVO 2026-07-07)

- **Audit Sprint B/C/D** (#1423): soft-degradation NEPOČÍTÁNO class, CORE
  passporty na disk, warnings_structured Phase 2 + AC3 gate, Resource Ceiling
  UI, Portal /register, dead-code sweep, docs-truth (v4.38.0).
- **SO-202 Žalmanov E2E fixy 1-5** (#1426): MCP `rebar_mass_kg` /
  `prestress_strand_mass_kg` / `num_tacts_override`; W3 `podkladni_beton`
  (rebar 0); římsa bm→per-tact area; bridge-technology feasibility guard.
- **tz-passport-json half A gate 1** (#1426): Pydantic SSOT
  `app/models/bridge_passport.py` + CI-golden + mapper
  `Monolit-Planner/shared/src/parsers/bridge-passport.ts` (`planPassport`).
- **Composite-UI fixy** (#1426): `kridla_opery`+`zaklady_oper` do ELEMENT_TYPES;
  humanized methvin-norms renderer (konec surového JSON).
- Testy: shared 1376, CORE python battery 106, tsc+vite clean.

---

## PRIORITA 1 — Sprint A (SECURITY) — na Alexandrův pokyn už DÁN

**Blokátor před jakýmkoli public/demo.** Původní cross-user symptom vyřešen
31.05; TOHLE je jiná třída — **routy úplně bez auth / fail-open**. Plán =
audit-report 2026-07-01 §6 Sprint A. Zdroj file:line ověřen agentem této
relace (viz níže — všechny STILL OPEN k 2026-07-07 mimo Registry cleanup-empty,
který dostal requireAuth ale ne owner-scope).

### A1 — Portal neautentizované write/cost routy
- `stavagent-portal/backend/src/routes/pump.js` — mount `server.js:271`
  (`app.use('/api/pump', pumpRoutes)`), ZERO auth middleware → kdokoli mutuje
  společný katalog čerpadel. **Fix:** přidat `requireAuth` (nebo
  `requireAuthOrServiceKey` pro kiosk-volání) na mount.
- `stavagent-portal/backend/src/routes/parse-preview.js:182` handler bez auth
  + hardcoded `owner_id ... VALUES ($1,$2,'parsed_import',1,...)` na `:210-213`;
  mount `server.js:254` má jen `uploadLimiter`. **Fix:** auth + owner_id z JWT,
  ne literál 1.
- `stavagent-portal/backend/src/routes/kb-research.js:23` `router.post('/')`
  bez auth → anonym → Core LLM (жжёт kredity); mount `server.js:250-251`.
  **Fix:** auth gate.

### A2 — Monolit ownership
- `Monolit-Planner/backend/src/routes/positions.js` + `planner-variants.js` —
  žádný auth import, 0 kontrol `portal_user_id`, mutace přes syrové id; mount
  `Monolit-Planner/backend/server.js:176` + `:197`. **Fix:** ownership přes
  `bridges.portal_user_id` JOIN (vzor = izolační model
  `docs/security/isolation_model.md`).

### A3 — URS bez auth jako třída
- `URS_MATCHER_SERVICE/backend/src/app.js` — žádný auth middleware (jen
  rate-limit); `POST /api/settings/model` (`src/api/routes/settings.js:70` +
  reset `:108`) → anonym přepíná globální LLM model VŠEM. **Fix:** min. API-key
  gate na settings/model + job/batch/pipeline; rozhodnout API-key vs Portal-JWT
  (otázka na Alexandra).

### A4 — Registry backend
- `rozpocet-registry-backend/server.js:145` `cleanup-empty` — requireAuth UŽ
  přidán, ALE hardcoded secret `'cleanup2026'` `:148` + delete BEZ owner filtru
  (`:153-164`, `:184-186`) → smaže prázdné projekty VŠECH ownerů. **Fix:**
  owner-scope + secret z env/Secret Manager.
- `POST /api/formwork-rental/calculate` (`:745`) + `/api/registry/export/
  excel-with-pump` (`:785`) — bez requireAuth (CPU-abuse). **Fix:** auth gate.

### A5 — fail-open vzory (Portal)
- `middleware/serviceAuth.js:24-27` requireServiceKey propouští když
  `!SERVICE_API_KEY`; `:85-88` requireAuthOrServiceKey dtto.
- `middleware/serviceAuth.js:16` + `middleware/auth.js:10` —
  `JWT_SECRET || 'dev-secret-key-change-in-production'` (podvržení tokenů
  veřejnou stringou).
- `routes/core-proxy.js:162` billing gate jen `if (operationKey && userId &&
  POST)` + deduction fire-and-forget `:211` `.catch(()=>{})`.
- `services/creditService.js:101-102` canAfford catch → `allowed: true`
  (fail-open); `routes/portal-files.js:440` fire-and-forget deduction.
- **Fix (rozhodnutí na Alexandra):** fail-CLOSED — `SERVICE_API_KEY` +
  `JWT_SECRET` povinné při startu (fail-fast, žádný dev-fallback v prod);
  billing vyžadovat userId na credited POST; canAfford fail-open→closed.

### A6 — hygiena (rychlé)
- `git rm --cached rozpocet-registry/.env stavagent-portal/frontend/.env.production`
  (2 trackované .env, bez secretů ale proti politice) + `.gitignore`.
- Ruční TODO (mimo kód, Secret Manager): rotace hesla `stavagent_portal`,
  `MASTER_ENCRYPTION_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`; ověřit/odstranit
  `VITE_DISABLE_AUTH` z Vercel Prod + build-time guard.

**Doporučený postup:** A1+A5 (Portal) první — nejvíc povrchu; pak A2 (Monolit),
A3 (URS), A4 (Registry). KAŽDÁ změna owned-table routy → spustit
`cross-user-isolation-reviewer` agenta PŘED pushem (per root CLAUDE.md).
Testy: Portal `isolation.e2e.test.js` rozšířit; přidat negativní testy
(anonym → 401/403). Vlastní PR (nemíchat s feature prací).

---

## PRIORITA 2 — tz-passport-json (feature, Alexander drží)

- **B-interview** (otázky 2+3 v `docs/specs/tz-passport-json/requirements.md`):
  kde běží extrakce (CORE UEP / MCP tool / offline), LLM vs regex split per
  sekce. NEROZHODOVAT bez Alexandra.
- **Gate 2 (consumer wiring)** — vybrat kanál: MCP tool `calculate_from_passport`
  (POZOR counter-soubory: `_REGISTERED_TOOL_NAMES` server.py, TOOL_ORDER +
  TOOL_DESCRIPTIONS routes.py, TOOL_COSTS auth.py, ToolManifest, YAML allow-list,
  `EXPECTED_TOOLS` test_mcp_compatibility.py) / Monolit backend route /
  UI import. Mapper `planPassport()` je hotový — jen napojit.

---

## PRIORITA 3 — zbytky (nízká priorita)

- warnings Phase 2 items 5-7: MSS-9 test, MSS-10 context-XF extraction, golden
  runner (root CLAUDE.md P2).
- Resource Ceiling UI: per-profession breakdown (6 professí) + vibrators/MSS/
  no_weekends inputs + auto-fill banner.
- URS SQLite→PostgreSQL (BACKLOG `urs-sqlite-to-postgres`, infra-heavy).
- api-access page (blokováno Lemon Squeezy manual TODOs).
- LIVE re-verifikace všech 2026-07-07 fixů na kalkulator.stavagent.cz po deployi.

---

## Discipline reminders
- Mantra: číst repo první (steering → soul.md §9). Effort high/max.
- Handoff = tento adresář `docs/handoff/` (root next-session.md = jen pointer).
- soul.md §9 entry po relaci. Branch `claude/` prefix (Vercel).
- Merge-commit, ne squash (Pattern 12). Po merge ověřit přes git worktree
  off origin/main (ne lokální ref) — lekce #1285→#1295.
- MCP nový tool = VŠECHNY counter-soubory v jedné změně (viz Gate 2 výše).
