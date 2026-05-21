# STAVAGENT — Soul (Living Memory)

> **Účel dokumentu:** Continuity memory mezi sessions. Tento soubor je **dopis od minulých sessions budoucím sessions**.
>
> **Read at start of every Claude session.** Online (claude.ai) přes Project Knowledge. Doma (Claude Code) přes Git pull.
>
> **Update na konci každé významné session** — viz `docs/steering/conventions.md` §11.3.
>
> **Verze:** Initialized 19.05.2026

---

## 1. Founder context

**Alexander Prokopov.** Solo founder STAVAGENT.

- **Day job:** přípravář/rozpočtář v Berger Bohemia (Bridge & Railway Division, Plzeň)
- **Evenings/weekends:** STAVAGENT
- **Languages:** Russian (native, communication), Czech (domain expertise, codebase terminology), English (code, technical writing)
- **Personality:** Decisive, action-oriented, override scope reductions, ALL CAPS = frustration signal

---

## 2. Current state snapshot (19.05.2026)

### 2.1 Production

- **v4.24** в продакшне (PR #983 deployed)
- **Gate 1** PR #1058 merged (29.04.2026)
- **Gate 2** PR #1064 merged (15 commits, branch `gate-2-element-classification`). Tests 1002 → 1036. Element types 22 → 23 (zaklady_oper added).
- **MCP v1.0** live с биллингом
- **3,693+** commits, 500+ deployments
- **$5,000** Perplexity credit aktivní

### 2.2 Active critical work

- **P0 BLOCKER před Cemex demo:** Cross-user data isolation. Nový users vidí všechny projekty v Monolit-Planner a Registru. Potential GDPR exposure. Musí se vyřešit před jakýmkoliv public marketing nebo Cemex demo.
- **Cemex CSC 2026 submission deadline:** 28.06.2026 — primary competition target
- **Realistic pitch day target:** Helsinki 16-19.11.2026

### 2.3 Active freelance

- **Libuše objekt D** (VELTON, akce 185-01) — branch `claude/libuse-delivery-continue-GEBr5`, 11 commits ahead. Phase 7a Part 2 + Phase 8 pending. Deadline 11.05 (passed) — uzavřít. Test data: `test-data/libuse/`.
- **hk212_hala** (Hradec Králové, SOLAR DISPOREC) — Phase 1 Etapa 1 complete, 141 items, 29.8% URS match (catalog vintage gap). Phase 2.1 audit trail extraction. Test data: `test-data/hk212_hala/`.
- **Žihle 2062-1** — pilot COMPLETE, 154 položek, 10.59M Kč. Phase E dropped (ADR-005). 7 product patterns documented. Test data: `test-data/most-2062-1-zihle/`.
- **RD Jáchymov dům** — N=5 corpus case COMPLETE (18.05.2026). Hybrid DSP/DPS (DPS-grade DXF в DSP-contracted). 189 items. Test data: `test-data/RD_Jachymov_dum/` (PR #1177 Phase 0b foundation). Path C: 89% → 100% DXF coverage. Dual catalog discovered: URS201801 (39741) + TSKP (11994). Subdod v1.2. **9 corpus patterns** dokumentovány (viz §5.1).
- **SO-250 D6 Žalmanov** — SmartExtractor probe case. Test data: `test-data/SO_250/`.

### 2.4 Knowledge corpus sources (NE freelance, study material pro KB)

- **Litovel bridge** — vlastní diplomová práce, používaná jako study material pro bridge KB build-out v2 (TKP 4 + ČSN 73 6244 + VL 4 + Litovel case study). Test data: `test-data/most-litovel/`. Material se integruje do `app/knowledge_base/B7_regulations/` (TKP, ČSN, VL) a `B6_research_papers/` (case study). NE klient, NE deadline — open-ended KB enrichment.

**Shared assets v `test-data/`:**
- `kros_catalog.db` — KROS catalog SQLite (working copy, parallel to OTSKP DB)
- `STAVAGENT_Drawings_to_VV_Rozpocet_Playbook.md` — dataset-bound playbook (drawings → výkaz výměr → rozpočet)

---

## 3. Key architectural decisions (and why)

### 3.1 Vertex AI primary (ne Bedrock)

**Decision date:** ~03.2026
**Why:**
- EU data residency v `europe-west3`
- Google Cloud for Startups credits applied
- Gemini Flash extremely cheap pro classification volume
- Bedrock = fallback, ne primary

### 3.2 Render NEPOUŽÍVÁ

**Decision date:** ~01.2026
**Why:**
- Migrace na Cloud Run + Vercel completed
- Lepší integrace s GCS, Cloud SQL, Vertex
- Konsistentní stack

### 3.3 Stripe odstraněn

**Decision date:** Gate 2 (28.04.2026)
**Why:**
- Dead code, nikdy commercially activated
- Lemon Squeezy je production billing
- Mít Stripe v repu = confusing pro nového developera

### 3.4 Confidence scoring framework

**Why:**
- OTSKP lookup je deterministic (db.match) → 1.00
- Regex extraction je interpretable → 0.85-0.95
- AI návrh je probabilistic → 0.70
- Human override je intentional → 0.99
- Pravidlo "high doesn't get overwritten by low" — chrání kvalitu dat

### 3.5 Core ↔ Kiosks pattern

**Why:**
- Každý kiosk může být rebuilt nezávisle
- Core API je business logic, kiosky jsou rendering
- DACH/Spain expansion = nový kiosk + nová language layer, NE rewrite Core

### 3.6 Triple access (UI + MCP + API)

**Why это competitive moat:**
- AI agents need engineering ground truth
- Konkurenti (Aitenders, Togal) jsou single-mode (jen UI nebo jen API)
- STAVAGENT je agent-ready by design
- MCP server je live, Lemon Squeezy billing live

### 3.7 Deterministic-first principle

**Why:**
- LLMs halucinate engineering calc
- Regex + lookup tables + formula engines jsou auditovatelné
- AI fallback only kde deterministic je beмocný (free text → categories)
- Aligns s GDPR / EU AI Act (limited risk, transparent)

### 3.8 URS → "Unified Retrieval Service"

**Decision date:** Gate 2
**Why:**
- ÚRS Praha legal exposure
- Backend acronym `URS_MATCHER_SERVICE` is defensible as "Unified Retrieval Service"
- Public UI labels neutralized
- OTSKP (státní, free) is publicly OK

---

## 4. Construction domain insights (accumulated)

### 4.1 "Co je beton — to je harmonogram"

При тендерировании монолитных мостных конструкций výpočet betonu = критическая cesta. Vše ostatní paralelní/následuje. Tento insight definuje **proč** kalkulátor je strategický, ne nice-to-have.

### 4.2 Skruž vs stojky (often confused)

- Bridge element → vždy **skruž** (50-100+ ton, heavy shoring towers)
- Building → **stojky** (<50 kN, light props)
- Height >5m → skruž
- Load >50 kN → skruž

### 4.3 Spáry — dilatační vs pracovní

- **Dilatační** — permanent structural joint
- **Pracovní** — temporary construction joint
- **NEKONFUZIT**

### 4.4 OTSKP routing vs ÚRS

- **Veřejná zakázka (ZZVZ)** → OTSKP primary
- **Privátní (hk212, Libuše)** → ÚRS primary, OTSKP irrelevant
- **D&B (Žihle)** → ÚRS + OTSKP columns

### 4.5 Rebar h/t — opravená matice (v4.24)

| Element | Default | h/t (D12) |
|---|---|---|
| Walls | D12 | 17.3 |
| Slabs | D12 | 16.3 |
| Beams/Cols | D12 | 22.4 |
| Stairs | D12 | 20.4 |
| Stirrups D6-12 | — | 30 |

### 4.6 Pour crew formula v4.24 — co bylo opraveno

- Management (+3 řízení) **REMOVED** — patří do ZS/VRN 3-5% per ČSN 73 0212
- Volume-scaled crew sizing
- Night shift §116 ZP +10%
- MEGA formula: `n_pump×2 + ceil(n×1.5) + ceil(n×1.0)`

---

## 5. Корпусные находки (N=5 corpus patterns)

### 5.1 N=5 RD JÁCHYMOV (18.05.2026)

Hybrid DSP/DPS (DPS-grade DXF v DSP-contracted). 189 items, **9 corpus patterns:**

1. `file_swap` — vendor podstrčil jiný soubor než avizoval
2. `tz_validator_iter` — iterativní validace TZ
3. `multi_view_items` — totéž v různých výkresech
4. `_gate ≠ kapitola` — gates v workflow != kapitoly v TZ
5. `exhaustive_dxf_5tier` — DXF parsing 5-tier strategy
6. `embedded_table_mtext` — `^I` encoding v MTEXT
7. `honest_fallback` — superseded by #8
8. `completeness_audit_mandatory` — Phase 0a v CLAUDE.md
9. `iterative_layer_probe_gaps` — **ANTI-PATTERN** (neopakovat)

Path C: 89% → 100% DXF coverage. Dual catalog discovered: URS201801 (39741) + TSKP (11994). Subdod v1.2.

### 5.2 N=5 corpus aggregate

5 cases:
1. VP4 FORESTINA (operná zeď)
2. SO-202 D6 (most)
3. SO-250 D6 Žalmanov
4. Bytový soubor Libuše
5. SO-220 biokoridor (+ RD Jáchymov hybrid)

Confirms: BOQ structure identical across CZ/DE/AT/ES/FR — only catalog codes + norms + doc formats differ. **4-layer KB viable** (Core universal → Regional CZ/SK/DE.yaml → Empirical → AI fallback).

### 5.3 Libuše cross-objekt detection

Check 'z místnosti č.' a 'do místnosti č.' columns ve všech Tabulkách s multi-objekt scope. Prefix mapping: S.A.\* → A, S.B.\* → B, S.C.\* → C, S.D.\* → D. Regen chain order: phase_7a → phase_6 → phase_8 → phase_0_20.

### 5.4 PROBE findings (Libuše)

- **PROBE 14f** — 8 PSV-768 vrata items deprecated (belong to objekt C, ~130-230k Kč mis-attributed)
- **PROBE 14g** — List 11 regenerated (3,128 → 4,845 rows, 579 → 754 groups)

### 5.5 hk212 critical discovery

**VYJASNĚNÍ #17:** TZ claims 32 m³ výkopů vs DXF-calculated **~341.8 m³** (~130k Kč impact). Cross-document validation rule needed.

---

## 6. Key learnings (process / meta)

### 6.1 Claude Code task writing rule (CRITICAL)

> **Nikdy nespecifikuj jména proměnných, souborů, tříd nebo tabulek.**
>
> Popisuj CO se má stát v termínech business logiky + architektury.
> Claude Code odvodí naming z existujících repo konvencí.

Violation = parallel structure = naming spaghetti. Viz `docs/steering/conventions.md` §9.

### 6.2 Data corpus is the bottleneck, not math

Priority **collect 5-10 real projects** before applying advanced statistical methods:
- Bayesian updating (~50h) — skip until corpus
- Sensitivity analysis PERT (~25h) — skip until corpus
- PySR symbolic regression (~40h) — skip until corpus
- Neural nets, RL, quantum — **not worth it** at current data volume

### 6.3 Branch protection workflow

- Branch protection **stays enabled** на main
- GitHub Action `prerender.yml` blocked by `protect-main` ruleset
- **Correct workflow:**
  1. Lokálně `npm run build`
  2. Zkopírovat 4 HTML soubory z `dist/` do `public/prerendered/`
  3. Include in same PR as source changes

### 6.4 Když Claude Code timeout na large file

Split na sub-tasks <170 řádků nebo by gate (Gate 0 scan-only → Gate 1 format findings). Output findings as plain chat text as fallback.

### 6.5 Scope expansion pattern

Александр consistently overrides scope reduction recommendations. Claude names pattern explicitly each time before complying.

### 6.6 Session structure (proven)

1. Drop task .md file into repo
2. Start Claude Code agent session with direct "read and execute" instruction
3. Audit task naming: `TASK_[DOMAIN]_[Scope].md`, nested under `docs/audit/` (now `docs/specs/`)

### 6.7 Decision style

- Quick decisions when options presented as numbered choices
- Sequential PRs preferred over parallel
- Russian primary, Czech terminology throughout codebase
- Voice-to-text artifacts common
- ALL CAPS = emphasis/frustration

---

## 7. External relationships (active)

### 7.1 Cemex CSC 2026

- **Deadline:** 28.06.2026 application
- **Pitch days:** APAC 02.09.2026 (Singapore), Top 30 announce 01.10.2026, Las Vegas 09-11.11, Helsinki 16-19.11
- **Target:** Helsinki (realistic, European pitch day)
- **Partners to watch:** Ferrovial, VINCI Leonard, Hilti (DACH formwork), Trimble (BIM)

### 7.2 Alice Technologies

- **Status:** Outreach к René Morkos drafted, ne sent yet
- **Strategy:** Complementary, ne competitive. STAVAGENT generates engineering inputs, Alice optimizes schedules across them.
- **Outcome regardless:** Strategic partnership v conversation slide v pitch deck

### 7.3 Google for Startups Cloud

- **Status:** Application submitted via postmaster@stavagent.cz (2026-05-13)
- **Waiting:** 3-5 business days response
- **Credits target:** Billing Account `01587B-BEBC6E-418C29`
- **Active constraint during review:** Don't touch production stavagent.cz, don't modify LinkedIn, check postmaster@ daily

### 7.4 VELTON (Libuše freelance)

- Confidentiality strict — VELTON name never mentioned externally
- Libuše geometry used as engine calibration only
- 4,090 items, 13 sheets, akce 185-01

### 7.5 Berger Bohemia (current employer)

- Personal-time disclaimer obligatorní na /team a v LinkedIn About
- Berger not mentioned by name on landing
- If asked: "tool for my own daily problem, personal time, no company resources"

---

## 8. Strategic context (ne lehkomyslně měnit)

### 8.1 International brand

- `stavagent.cz` = Czech/SK wedge brand
- International brand needed for DACH/EU expansion (separate registration)
- Candidates: PourPlan / TaktCast / MonoPlan / TBD
- **Insight:** DIN 18218 already canonical → DACH expansion = catalog + language, NOT engine rewrite

### 8.2 Pitch reframe (W3 deliverable)

**Old pitch:** "AI co-pilot for Czech construction estimators"
**New pitch:** "Engineering calculation layer for construction with triple access (UI / MCP / Agent API). DIN 18218, Saul, RCPSP. Konkurenti dělají document parsing (Aitenders), takeoff (Togal), scheduling optimization (Alice) — žádný nedělá engineering calculations."

### 8.3 EU AI Act compliance

- Risk classification: **Limited risk** (transparency only)
- NOT v Annex III high-risk categories
- STAVAGENT = **deployer of GPAI** (Vertex/Bedrock/Perplexity), NE provider
- TODO до konce května: transparency banner v UI, privacy policy update, AI literacy doc, human-in-the-loop, DPAs

---

## 9. Session log

> Each session adds a section here. Format:
> `## YYYY-MM-DD — Session: {topic}` + Rozhodnuto / Odmítnuto / Otevřené otázky / Co dál

---

### 2026-05-21 — Session: Bootstrap Claude Code Skills + Discipline Infrastructure

**Topic:** Phase 1 audit + Phase 2 bootstrap of `.claude/skills/` directory per task `docs/tasks/2026-05-20-rimsa-mcp-agent/stavagent-session-discipline-SKILL.md`. Foundation for upcoming říms calibration task (TASK_Rimsa_Calibration_FullStack_v1.md).

**Rozhodnuto:**
- **Skills location:** Project-local `.claude/skills/` (versioned in git, synced into Project Knowledge weekly per skill §7).
- **Root vs docs/:** Keep existing files in `docs/` (no duplication). `docs/STAVAGENT_ClaudeCode_Session_Mantra.md`, `docs/STAVAGENT_PATTERNS.md`, `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` stay canonical at their existing paths. Skills reference these `docs/` paths, not phantom root duplicates.
- **process.md:** Not created. `docs/steering/conventions.md` is canonical for process/workflow content (already covers task structure §9, workflow §11, gates §7, communication §8). Sync list in `stavagent-session-discipline` §7 reflects this.
- **Skill scope:** Two skills bootstrapped — `stavagent-session-discipline` (verbatim from upload, 8 rules) + `stavagent-claude-code-tasks` (codified from `conventions.md` §9-§10). `stavagent-schema-designer` skipped (not in task scope).
- **CLAUDE.md update:** Added single section under Mandatory reading block referencing `.claude/skills/`. No rewrite of existing content.

**Odmítnuto:**
- Creating root-level mantra/patterns/knowledge_placement files. Task spec suggested it but existing canonical paths win — no parallel structures rule.
- Creating new `docs/steering/process.md`. Content already in `conventions.md`.
- Backfilling historical session logs into §9 (start from this entry).
- Migrating `stavagent-schema-designer` from Project Knowledge — out of scope, needs separate session.

**Otevřené otázky:** —

**Co dál:**
- Sync `.claude/skills/` to Project Knowledge on claude.ai (manual, weekly cadence per skill §7).
- Begin říms calibration task with the new skill infrastructure active.
- Optionally migrate `stavagent-schema-designer` in a follow-up session if Alexandra confirms scope.

**Files changed:**
- `.claude/skills/stavagent-session-discipline/SKILL.md` (new, ~210 lines, verbatim from upload with corrected paths to `docs/`)
- `.claude/skills/stavagent-claude-code-tasks/SKILL.md` (new, ~240 lines, codified from conventions.md §9)
- `.claude/skills/README.md` (new, ~85 lines, directory index)
- `CLAUDE.md` (+8 lines, skill reference under Mandatory reading block)
- `docs/soul.md` §9 (this entry)
- `next-session.md` (overwrite — handoff for říms calibration)

**Branch:** `claude/bootstrap-code-skills-ecPCE`

---

### 2026-05-20 — Session: MCP Dynamic Client Registration (RFC 7591) + YAML loader

**Topic:** Two-PR work session closing TASK_DCR_KBYamlLoader.md (DCR endpoint missing + YAML loader skip), three subsequent CI-fix commits triggered by post-merge Amazon Q review, and post-deploy verification (V1-V4). Spanned 9 gates of gate-based implementation plus 1 deploy runbook gate. Ended with post-deploy V1 503 caused by `gcloud --set-env-vars` wiping VPC connector + REDIS_URL on force rebuilds; fixed via explicit `--update-env-vars` re-apply.

**Rozhodnuto:**
- **PR #1189 (DCR)** — branch `claude/mcp-dynamic-client-registration-x7Kb2`, 12 commits, ~5K LOC, 177 tests (3.49s). Architecture per Q1-Q6 interview: separate `mcp_oauth_clients` table (Variant B, not extending `mcp_api_keys`) + `mcp_oauth_codes` extended via migration 010 with NULLABLE `oauth_client_id` column + new `mcp_oauth_tokens` table (sat-{hex48} access + srt-{hex48} refresh, 1h/90d TTLs per OAuth canon). FK target asymmetry intentional: `mcp_oauth_tokens.user_api_key → mcp_api_keys(api_key)` for hot-path no-JOIN bearer lookup; `mcp_oauth_clients.created_by_user_id → mcp_api_keys(id)` for cold-path /token resolution.
- **Token formats** (Q3): `dcr-{hex24}` 96-bit client_id + `dcs-{hex48}` 192-bit client_secret + `sat-{hex48}` access + `srt-{hex48}` refresh — distinct prefixes for middleware dual-prefix routing. SHA-256+salt for client_secret (not bcrypt — 192-bit entropy on secret itself, verified every /token call).
- **Hybrid DCR auth** (Q2 sub-q a): public DCR (no Authorization on /register) → `created_by_user_id=NULL` → client_credentials issues `user_api_key=NULL` token → paid tools return 402 `user_consent_required`. Authenticated DCR (Bearer sk-stavagent-* on /register) → binds, credits attribute. authorization_code flow always full-user-bound via consent form.
- **/authorize inline HTML consent form** (Gate 4.5) — minimal styled page, no JS, no external assets, XSS-escaped via `html.escape()` on every interpolated string. User pastes sk-stavagent-{hex48} api_key → POST → 303 redirect with code bound to (user_api_key, oauth_client_id). MVP shortcut; replace with Portal SSO cookie + auto-consent before Claude Directory submission.
- **Refresh-token rotation** per OAuth 2.0 BCP §4.14: rotate revokes old + mints new with `rotated_from=old.id`. Replay of revoked refresh → WITH RECURSIVE chain revoke of all descendants.
- **Redis-backed rate limit** (Gate 6) — atomic Lua INCR-with-conditional-EXPIRE, 10/IP/h, X-Forwarded-For leftmost IP, `MCP_RATE_LIMIT_WHITELIST` env bypass, fail-closed 503 on Redis outage (NOT in-memory fallback — explicit DoS-gate failure mode rejection). Audit row `status='rate_limited'` written on 429 path.
- **Dual-prefix Bearer routing in middleware** (Gate 5) — `sat-*` → `mcp_oauth_tokens` lookup with revoked + expiry checks; `sk-stavagent-*` → legacy `mcp_api_keys`; anything else → 401. AuthContext attached to `scope["state"]["mcp_auth"]` for downstream tool wrappers. Module extracted to `app/mcp/middleware.py` so tests don't need full FastAPI app graph.
- **CORS tightening on /mcp mount** — explicit `allow_methods=["GET","POST","OPTIONS"]` + `allow_headers=["Authorization","Content-Type","Mcp-Session-Id"]` + `max_age=86400`, NOT wildcard (incompatible with `allow_credentials=True`). Parent app CORS untouched (Portal/Kiosk APIs use wider allow-list).
- **PR #1190 (YAML loader)** — branch `claude/review-kb-yaml-loader-wR7If`, 1 commit, +500 LOC, 18 tests. `_load_yaml()` via `yaml.safe_load` (NEVER `yaml.load` — security). Dispatcher extended with `.yaml/.yml` between `.json` and `.csv`. `_SKIP_FILES = {".gitkeep", ".DS_Store", "Thumbs.db"}` + `_SKIP_SUFFIXES = {".zip", ".tmp", ".bak"}` silent skip with one aggregated `📦 Skipped N archive/temp file(s)` log line per category. `metadata.yaml` symmetric with `metadata.json` (YAML wins conflict with WARNING-level log signal, not INFO).
- **Three post-merge CI fixes** triggered by Amazon Q + manual CI failures:
  - **Gate A — migrations CI glob** (`.github/workflows/test-mcp-compatibility.yml`): replaced hardcoded `psql -f 007.sql; psql -f 008.sql` with `for migration in $(ls migrations/*.sql | sort)` to mirror runtime `startup_migrations.py`. Added Redis 7-alpine service container + REDIS_URL env. Added 5 new DCR test files to pytest run.
  - **Gate B — restored CORS headers on bare OPTIONS** in `app/mcp/middleware.py`: Gate 5 extraction had trimmed `BareOptionsAllowMiddleware` 204 response from 6 headers down to 3, breaking `test_bare_options_includes_credentials_methods_headers_max_age`. Restored full set: ACAO + ACA-Credentials + ACA-Methods + ACA-Headers + Max-Age + Vary.
  - **SQL injection bind refactor** in `mint_token_pair`: `NOW() + INTERVAL '%s seconds'` → `NOW() + (%s * INTERVAL '1 second')`. The single-quoted `%s` in INTERVAL literal is string interpolation (not bind); the `(%s * INTERVAL '1 second')` form routes the integer through proper psycopg2 parameter binding. Practical risk today is zero (call sites are module-level int constants), defensive against future user-input TTL.
- **9-step deploy runbook** at `docs/deployment/dcr_yaml_deploy_runbook.md` (773 lines) — pre-deploy checklist, mandatory merge order (YAML first, DCR second), migration chain verification, env var setup, two-step deploy with traffic flip, 5 startup log signals, 10 curl smoke tests, end-to-end claude.ai manual test, rollback procedure with DDL revert + Redis bucket clear, operational notes with TTL table + monitoring metrics, 6 post-deploy TODOs (CSRF, async last_used_at, Portal SSO, separate auth bucket, token cleanup job, Directory advertise-gating).
- **Post-deploy verification V1-V4** (TASK_PostDeploy_Verify.md). V2 ✅ (isolation leak closed — `Portal JWT required`), V3 ✅ (YAML loaded with valid dict values in B4 + B5 + B6 + B7 per local main checkout). V1 initially ❌ 503 because `gcloud builds submit` reads `cloudbuild-concrete.yaml` which lacks `--vpc-connector` + REDIS_URL → each force rebuild wipes them. Fixed via `gcloud run services update --vpc-connector=stavagent-vpc-connector --vpc-egress=private-ranges-only --update-env-vars=REDIS_URL=redis://10.229.246.227:6379` (revision 00372-bxh). V1 retest ✅ 201 + `dcr-4a3e8e117a5e67164098c830`. V4 ✅ retroactively via production logs at 09:11–09:19: three successful `POST /mcp/ 200` with `Processing request of type CallToolRequest` — real claude.ai-side tool calls already exercised the full chain before V4 was even run.

**Odmítnuto:**
- **Token storage as JWT** (Gate 4 alt T2) — stateless but no revocation list without separate DB; defeats refresh-rotation forensics.
- **Composite Bearer format `sat-...sk-stavagent-...` dot-separated** (Gate 4 alt T3) — hack avoiding new table; less RFC-compliant, harder middleware code.
- **Extending `mcp_api_keys` with nullable DCR-metadata columns** (Q1 Variant A) — concept-mixed (user vs OAuth client are different abstractions); declined for clean separation.
- **Async `update_token_last_used`** for the middleware hot path — psycopg2 is sync, needs asyncio.create_task + bounded thread-pool wrapper; deferred as MVP TODO (Gate 5). Current sync path is ~5-10ms on Cloud SQL primary-key UPDATE, acceptable because dominated by FastMCP tool execution.
- **Login + session-cookie consent UI for /authorize** (Q in Gate 4.5) — inline HTML form is MVP shortcut; proper Portal SSO + auto-consent is post-Directory-submission work.
- **Bcrypt on client_secret** — 192-bit entropy makes slow hashing wasted CPU; SHA-256+128-bit-salt with constant-time compare is the right primitive.
- **Permanent fix for cloudbuild-concrete.yaml** (add `--vpc-connector` + `REDIS_URL` to deploy step) — task §"ЧТО НЕ ВХОДИТ" explicitly excluded touching cloudbuild yaml. Deferred to separate PR. Without it, every force rebuild reintroduces the 503 regression until the manual `gcloud run services update` is re-applied.
- **Refactoring `_print_summary` counter quirk in kb_loader** — cosmetic, per task explicit exclusion.

**Otevřené otázky:**
- **B5 / B6 / B7 entry counts in production startup log are 5–18× lower than local main checkout** (production: B5=3, B6=7, B7=5; local V3: B5=54, B6=30, B7=16). Suggests `.dockerignore` / `.gcloudignore` excludes most KB files from Cloud Build context. B4 matches local count (10 / 2 YAML). Tools user actually exercises (find_otskp_code, calculate_concrete_works) don't need the missing entries, so not a blocker. Track in separate task — diff `.dockerignore` vs KB tree, confirm which nested paths are excluded, decide if they should be shipped.
- Should `cloudbuild-concrete.yaml` get explicit `--vpc-connector` + `REDIS_URL` flags so force rebuilds preserve them? Yes — but separate task; current session's task explicitly excluded cloudbuild changes.
- CSRF token on /authorize POST consent form — api_key acts as combined auth+CSRF today (192-bit secret unguessable by attacker); proper CSRF token + session cookie pair tracked alongside Portal SSO migration.
- Will `MCP_RATE_LIMIT_WHITELIST` env get wiped on next force rebuild same way REDIS_URL was? Currently empty default, so no observable failure mode — but same `--set-env-vars` overwrite mechanism applies. Track separately.

**Co dál:**
- **Permanent fix PR for cloudbuild-concrete.yaml** — add `--vpc-connector=stavagent-vpc-connector`, `--vpc-egress=private-ranges-only`, and `--update-env-vars=REDIS_URL=...` to the deploy step so force rebuilds preserve VPC + Redis automatically. ~10 min work, single yaml edit.
- **Diagnose B5/B6/B7 KB shipping mismatch** — `git ls-files` count vs production startup log count divergence. Likely `.gcloudignore` or `.dockerignore` rule excluding most of the tree.
- **Celery beat job for `mcp_oauth_tokens` cleanup** (runbook §10.5) — rows accumulate forever. Schedule daily 03:00 UTC, delete where `refresh_expires_at < NOW() - 30 days AND revoked_at < NOW() - 30 days`.
- **Portal SSO migration** for /authorize auto-consent (runbook §10.3) — replaces inline HTML form with one-click "Authorize" after Portal cookie established. Unblocks Claude Directory submission alongside CSRF token (§10.1).
- **Separate authenticated-DCR rate-limit bucket** (runbook §10.4) — current per-IP bucket lumps anonymous + authenticated requests from same NAT.
- **Sync this `soul.md` entry to claude.ai Project Knowledge** per workflow item #5 — was not synced this session.

### 2026-05-19 — Session: Landing CTA + CZ/EN terminology + prerender hash drift

**Topic:** Tři navazující landing-page PRs uzavřené v jedné session: #1136 (CTA route fix + manual prerender), #1138/#1183 (CZ/EN terminology audit + prerender hash drift fix). Začalo CTA "Vyzkoušet zdarma" → /register redirectem na /, skončilo production "buttons don't work" emergency po merge — root cause hash drift mezi committed snapshotem a vite-buildem.

**Rozhodnuto:**
- CTA "Vyzkoušet zdarma" routes unauthenticated users na `/login` (ne `/register`). `/register` redirectuje na `/` (separátní bug, P2, workaround logován v `BACKLOG.md` jako `register-route-redirect`). Login page má funkční odkaz "Nemáte účet? Zaregistrujte se" na registrační formulář.
- CZ terminologie cleanup v `LandingPage.tsx` + meta description: `smeta/smety/smetu/smety` → `rozpočet/rozpočtu/Rozpočet/Rozpočty` (Russian/Slovak loan); `bětonpumpa/bětonpumpy` → `čerpadlo betonu/čerpadla betonu`; `kran/kranu` → `jeřáb/jeřábu` (Germanism); `mechanizmy` → `stroje`. Aplikováno taky na strukturované `tov:` karty (unicode-escaped bloky).
- EN landing cleanup (`LandingPageEn.tsx`): odstraněny CZ glossary parentézy `(takty)` + `(betonáž)` v popiscích; module title `Klasifikátor stavebních prací` → `Klasifikátor — construction works classifier`; `Kalkulátor betonáže` → `Kalkulátor — concrete works calculator` (4 výskyty: module title + HowItWorks step 3 + FAQ entry + footer products list); bullety `Detail prvku` / `Plán objektu` → `Single-element detail` / `Whole-object plan`.
- **Prerender hash drift fix v `scripts/prerender.mjs`** — `applySnapshotIfPresent()` přepsáno: před copy snapshot → dist čte fresh `dist/index.html` vyrobený vite, extrahuje `/assets/*.{js,css}` list, a graft-replacuje stale references v snapshot HTML na fresh hashe match-by-name-prefix (`index-OLD.js` → `index-NEW.js`, `chunk-AAA-OLD.js` → `chunk-AAA-NEW.js`). No-op pokud hashe už shodné (happy local case). Verified injekce fake hashů + simulovaný build emituje rewrite log lines.
- Manual prerender regenerace (4 HTML soubory v `public/prerendered/`) zaházena do stejné PR jako source edits — workaround pro `prerender.yml` GitHub Action blokovaný `protect-main` branch protection (user preferuje nechat protection enabled).

**Odmítnuto:**
- Investigation root cause `/register` redirectu na `/` — separátní bug, workaround postačuje. Pravděpodobně auth-guard inverze v `App.tsx`, ale out of scope této session.
- Update `og:description` + `twitter:description` meta tagů ve `index.html` — pořád obsahují "přípraváře monolitů". Copy decision, ne technical, vyžaduje strategický kontext.
- Disable `SKIP_PRERENDER=1` na Vercelu pro forced full Puppeteer prerender — Vercel build container chybí GUI libs (libnss3, libxss1, libasound2) které Chromium dynamicky linkuje.
- Odstranění prerender snapshot systému úplně — ztratil by SEO prerender benefit (Google by viděl prázdný `<div id="root">`).
- Deterministic / stable filename mode v `vite.config.ts` (no content hash) — defeats cache busting.
- Rebuild brigády → čety přejmenování v `LandingPage.tsx:236` ("Brigada: 4 lidé + 2 čerpadla" v structured card) per CLAUDE.md "Čety, ne Brigády" rule — out of session scope.

**Otevřené otázky:**
- Měly by `og:description` + `twitter:description` být aktualizovány aby matchovaly nový "stavby" subtitle? Copy decision pro brand-konzistenci.
- Měl by `kalkulator.stavagent.cz` brand title (a footer list) napříč všemi 3 moduly přejít na `Kalkulátor` bez `betonáže` qualifier? Footer list už používá zjednodušený název post-cleanup, ale konzistence v jiných místech rozdrobená.
- Bude prerender hash drift fix ovlivněn pokud Vercel přidá `<link rel="preload" as="font">` nebo jiné non-asset references v budoucnu? Aktuální regex `\/assets\/([^"'\s>)]+\.(?:js|css))` je narrowly scoped na js/css — bezpečné.
- "Smeta" jako Russian loan acceptable v Czech construction context (běžně se používá)? Některé tooltips/comment by mohli zůstat s "smeta" pokud je to colloquial-OK. Konzervativně jsem nahradil všude.

**Co dál:**
- Sledovat next deploy main na Vercel — pokud hash drift opravdu nastává, build log by měl ukázat `[prerender] index.html: index-X.js → index-Y.js` lines.
- User verification v incognito: 6 kroků (hard refresh → subtitle "stavby" → klik "Vyzkoušet zdarma" → /login → "Zaregistrujte se" link → registrace). Po úspěchu → Google Cloud for Startups re-aplikace.
- Investigovat `/register` redirect root cause a optionally restore goCta na `/register` pro cleaner UX (separátní task).
- Rozhodnout o `Brigada` → `Četa` cleanup v landing structured cards.
- Audit pre-existing meta tagů (og/twitter description, twitter alt) pro coherentní subtitle messaging.

---

### 2026-05-19 — Session: CLAUDE.md SDD integration

**Topic:** Integrate `docs/steering/` + `docs/soul.md` workflow do root `CLAUDE.md` (handoff `docs/handoff/2026-05-19-claude-md-sdd.md`).

**Rozhodnuto:**
- Hlavička: `Version: 4.31.0 → 4.32.0`, `Last Updated: 2026-05-18 → 2026-05-19`.
- Přidána nová sekce `## 🚨 Mandatory reading at session start` mezi `**Repository:**` a `English TL;DR` blok — explicit pořadí 6 souborů (conventions → product → tech → structure → domain → soul) + povinný session-log template.
- Sekce `## 📐 Calculator Philosophy (POVINNÉ ČTENÍ)` — active reference přepnut z `docs/CALCULATOR_PHILOSOPHY.md` na `docs/steering/domain.md §1`. Starý path zůstává pouze v deprecation note s datem.
- Přidána nová sekce `## 📋 Workflow discipline (Spec-Driven Development)` mezi adaptive-thinking poznámku a `Key rules:` blok — hybridní model online/Code, životní cykly feature/bug, mapa "co update v jakém steering souboru", task-writing pravidla.
- Nový changelog entry v4.32.0 vložen na začátek seznamu (před v4.31.0). Všechny v4.24-v4.31 entries zachovány beze změny (Krit. 6 verified).
- 5 commits, jeden Gate = jeden commit, žádný rewrite, vše přes `Edit` str_replace.

**Odmítnuto:**
- Rewrite CLAUDE.md from scratch (per task §7).
- Cleanup historických changelog entries (per task §7).
- Trim CLAUDE.md k 300-line limitu (separátní follow-up taska).
- Update per-service CLAUDE.md souborů (`concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`).

**Otevřené otázky:**
- Žádné — všechny edits byly mechanické per task §3.

**Co dál:**
- Patch `docs/steering/conventions.md` s pravidlem "Před `git mv` vždy zkontroluj SHA-256 zda target neexistuje" (Alexandr explicitně přislíbil v G.1 odpovědi).
- Separátní taska: trim CLAUDE.md na 300 řádků (currently 700+, mimo vlastní limit).
- Per-service CLAUDE.md soubory (concrete-agent, Monolit-Planner) — případně i tam přidat SDD mandatory-reading block, ale separate scope.

---

### 2026-05-19 — Session: Orphaned files & data/ cleanup

**Topic:** Cleanup 13 orphaned souborů v root repa + `data/peri-pdfs/` reorganizace (handoff in-conversation).

**Rozhodnuto:**
- 9 RD Jáchymov PDF + 4 hk212 DXF v root = **byte-identické duplikáty** existujících souborů v `test-data/{project}/inputs/{dokladova_cast,vykresy_dxf}/` (SHA-256 verified). Smazány `git rm` místo `git mv` — task §6.1/§6.2 navrhoval move do nového subfolderu, ale kanonická destinace už existovala (move by vytvořil třetí kopii).
- 3 soubory z `data/peri-pdfs/` přesunuty `git mv` (historie zachována):
  - `formwork_catalog_PERI_DOKA_2025.md` → `docs/reference/formwork_catalog_2025.md` (sjednocení se steering cheat-sheet)
  - `parse_peri_pdfs.py` → `scripts/parse_peri_pdfs.py`
  - `rimsa_element_spec_v2_DOKA_PERI.md` → `docs/specs/element/rimsa-v2-doka-peri.md` (single file, ne split — polished doménová reference, ne implementační spec)
- `data/` složka odstraněna (`rmdir`).
- `docs/steering/structure.md` §5 doplněn o zákaz orphaned root souborů + ad-hoc `data/` (verze bump 1.0 → 1.1).
- Classification report: `docs/handoff/2026-05-19-orphaned-files-classification.md`.

**Odmítnuto:**
- Vytváření `test-data/RD_Jachymov_dum/stavebni_povoleni/` a `test-data/hk212_hala/dxf/` (per task §6.1/§6.2 návrh) — kanonická lokace `inputs/dokladova_cast/` a `inputs/vykresy_dxf/` už existuje.
- Split `rimsa_element_spec_v2_DOKA_PERI.md` do req/design/tasks (per task §6.3.1 fallback — split až při aktivním rozpracování).
- Update stale `data/peri-pdfs/` odkazů v 10 audit/inventory dokumentech (per task §8 out-of-scope — audit docs = snapshot in time).
- Gate 5 (`test-data/_orphaned/`) — žádné neidentifikovatelné soubory.

**Otevřené otázky:**
- Konfirmace deviace `git rm` vs `git mv` pro Gate 2/3 (G.1 z classification reportu).
- Stale markdown references na `data/peri-pdfs/` v audit dokumentech — ponechat snapshot, nebo follow-up `chore/docs-fix-stale-peri-paths`?

**Co dál:**
- TASK: `docs/normy/` → `app/knowledge_base/B7_regulations/` (66 MB doménová data, per docs-audit findings §D.6)
- TASK: `docs/bugs/aplikovat-timeout/` real content fill z Project Knowledge (per task §8 mimo scope)
- TASK: `docs/{architecture,audits,competitive}/` → `docs/reference/` (per docs-audit findings §D.7 migration map)
- TASK: vyřízení 5 open questions z předchozí audit session (docs-audit-findings §F)

---

### 2026-05-19 — Session: Docs structure audit

**Topic:** Inventory aktuální struktury `docs/` proti steering plánu (handoff `docs/docs/handoff/2026-05-19-docs-audit.md`).

**Rozhodnuto:**
- 5 chybějících šablon dovytvořeno: `_TEMPLATE_spec/{design,tasks}.md` (autorské, mirror requirements.md stylu) + `_TEMPLATE_bug/{analyze,fix,verify}.md` (kopie z `bugs/aplikovat-timeout/` které slouží jako kanonická šablona).
- 4 prázdné `1` placeholdery od GitHub web UI smazány (`docs/templates/1`, `docs/templates/_TEMPLATE_bug/1`, `docs/templates/_TEMPLATE_spec/1`, `docs/bugs/aplikovat-timeout/1`).
- Findings report uložen na `docs/handoff/2026-05-19-docs-audit-findings.md` (sekce A–F per task §6).
- Migration map pre-existing folders (architecture/, audits/, competitive/, normy/) navržena, ale **nic se nemigrovalo** — separátní taska.

**Odmítnuto:**
- Migrace `docs/architecture/`, `docs/audits/`, `docs/competitive/`, `docs/normy/` — out of scope (per task §4 a §8). Pouze inventory + doporučení do reportu §D.
- Audit obsahu `docs/bugs/aplikovat-timeout/` souborů (per task §3.6 — řeší samostatná taska).
- Otevírat PR (per task §8 no-PR-unless-asked policy).

**Otevřené otázky:**
- Misnested `docs/docs/handoff/2026-05-19-docs-audit.md` — přesunout do `docs/handoff/`?
- Duplikát `CALCULATOR_PHILOSOPHY.md` (root vs `normy/navody/`) — která je kanonická?
- Branch name mismatch: task říká `chore/docs-structure-audit`, session-level pinuje `claude/docs-audit-2026-05-19-0G3lF` — použit druhý.
- Kdy spustit migraci pre-existing folders (architecture/, audits/, normy/, competitive/) do nové struktury?
- Cleanup deadline 2026-07-29 (Gate 2 leftover) — vztah k novému workflow?

**Co dál:**
- Reakce Alexandra na otevřené otázky F.1–F.5 z findings reportu.
- Samostatná taska `chore/docs-migrate-pre-existing-folders` (per §D.7 mapy).
- Pilot specs (`cross-user-isolation/`, `mcp-policy-engine/`) teď mají kompletní šablony k použití.

---

### 2026-05-19 — Session: SDD workflow setup

**Topic:** Spec-Driven Development + persistent memory workflow для STAVAGENT, with constraint that work is online claude.ai (no terminal access at work, firewall blocks).

**Rozhodnuto:**
- Adopt SDD pattern: `docs/steering/` + `docs/specs/{name}/{req,design,tasks}.md` + `docs/bugs/{id}/{report,analyze,fix,verify}.md`
- Soul.md jako Project Knowledge artifact (ne MCP server) — fungue v claude.ai online
- Hybrid workflow: claude.ai = planning/specs/specs creation, Claude Code (doma) = implementation, Git = bridge
- 4 steering docs: product / tech / structure / domain (+ conventions as 5th)
- Templates pro spec (3 souboru) + bug (4 souboru)
- Audit existujících TASK_*.md → re-classify do `docs/specs/`, `docs/bugs/`, `docs/reference/`, `docs/handoff/`

**Odmítnuto:**
- Local MCP memory servers (mem0, Qdrant, Ollama) — nefungují přes firewall na práci
- Pimzino claude-code-spec-workflow npm package — vyžaduje terminal
- MemCP / claude-memory-mcp — local-only, ne použitelné na práci

**Otevřené otázky:**
- Kdy spustit migraci TASK_*.md → docs/specs/? (návrh: postupně, po PR)
- Soul.md velký vs malý — limit length nebo nech růst? (návrh: split po měsících, archive starší sekce do `docs/handoff/`)
- Cleanup deadline 2026-07-29 (Gate 2 leftover) — jak se to vztahuje k novému workflow?

**Co dál:**
1. User zacommit těchto 4 steering + soul + templates + audit do `docs/` přes GitHub web UI
2. První pilotní spec: `docs/specs/cross-user-isolation/` (P0, před Cemex)
3. Druhý pilotní spec: `docs/specs/mcp-policy-engine/` (Cemex)
4. Až bude pilot fungovat → batch migrace ostatních TASK_*.md

---

### 2026-05-20 — Session: UEP PR4a — MEP D.1.4 matrices + gbXML adapter

**Topic:** UEP PR4a per `docs/tasks/TASK_UEP_PR4.md` §3.1 + §3.2
(Q16 = C hierarchical). Adds detailed coverage matrices for D.1.4
silnoproud / slaboproud / ZTI / VZT / ÚT / plyn / MaR (7 disciplines),
a hierarchical `mep_base` parent shared across all subtypes, the gbXML
extractor (energy / HVAC exchange format), and multi-subtype detection
in `project_type_detector`. Scope-locked to PR4a; PR4b (full IFC diff),
PR4c (UI), PR4d (perf) remain queued.

**Rozhodnuto:**
- **Q16 = C hierarchical** confirmed: each subtype YAML declares
  `extends: mep_base` and inherits all 15 base rows; `load_matrix()`
  resolves the parent transparently, dedupes by category, and
  subtype rows REPLACE base rows on conflict.
- `load_matrices_for_subtypes(["mep_d14_silnoproud", "mep_d14_zti",
  "mep_d14_vzt"])` returns the unioned category list for projects
  bundling multiple D.1.4 disciplines (canonical Czech residential
  D&B pattern).
- `ProjectTypeDetection.mep_subtypes: list[str]` populated whenever
  ANY D.1.4 signal fires — independent of umbrella `top_choice` so a
  residential project with an embedded D.1.4 silnoproud TZ surfaces
  both `top_choice="residential"` AND
  `mep_subtypes=["mep_d14_silnoproud"]`.
- gbXML extractor mirrors LandXML iterparse pattern (≤200 MB memory
  bound per v3 §15.4). Emits `space_inventory` + `surface_inventory`
  + `hvac_zone` + reuses `norm_references` for Construction/Material
  layers — these feed `mep_d14_vzt` / `mep_d14_ut` matrices.
- `_ALLOWED_PROJECT_TYPES` in `routes_uep.py` extended 4 → 12 (the
  path-traversal allow-list from Amazon Q PR #1186 hotfix).

**Odmítnuto:**
- Real gbXML corpus calibration — STOP-condition #2 mentioned the
  option but corpus has none; synthetic Revit-shaped fixture in
  `test_uep_gbxml_extractor.py` is sufficient for PR4a scope (basic
  spaces/surfaces/HVAC zones). Real-export calibration left for PR4b
  when a corpus sample lands.
- Separate top-level `subtype_matrix_dir` config — `load_matrix()`
  resolves `extends:` from the same directory as the subtype YAML
  (or `base_dir=` override for tests). Adding a config key would be
  overengineering for one matrix folder.
- Changing `CoverageRequirement` model shape — hierarchical merge
  happens at YAML-load layer; the runtime model is unchanged, so
  all PR1-3 evaluation paths work without code change.
- IFC diff engine (PR4b), UI viewers (PR4c), perf optimization
  (PR4d), AI narrative (PR5), MCP tool additions for MEP subtypes —
  scope-locked out of PR4a per task split decision in §6.

**Otevřené otázky:**
- Reconciliation rules for MEP subtypes — `/uep/config/reconciliation-rules?project_type=mep_d14_*`
  will 404 until PR4 §3.x adds the rule YAMLs. Not blocking PR4a
  (the config endpoint surfaces 404 cleanly).
- `job_runner.py` currently calls `matrix_path_for(info.project_type)`
  with a single string — when `JobInfo.project_type == "mep_only"`
  the coverage gate cannot yet apply multiple subtype matrices. The
  hook for this is `load_matrices_for_subtypes` but `job_runner`
  isn't yet wired to consume `mep_subtypes` from the detection pass.
  Followup ticket: extend `JobInfo` schema or thread the subtypes
  through `start_job()` body.
- gbXML reference samples — no real Revit / OpenStudio export in
  `test-data/`. PR4b calibration should request a sample upload from
  Alexander before extending the adapter (currently sufficient for
  unit tests + smoke checks; production usage will need calibration
  pass against ≥1 real export).
- D.1.4 reconciliation rules + derivation rules YAMLs (CKZ, drift
  thresholds per discipline) — out of PR4a, queued for PR4b/c.

**Co dál:**
1. Push branch `claude/uep-pr4a-matrices-adapter-1OEjF` + open PR
   with title "feat(uep): PR4a — MEP D.1.4 hierarchical matrices +
   gbXML adapter".
2. Wire `mep_subtypes` from `detect_project_type` into `JobInfo` /
   `start_job()` so `job_runner` can call `load_matrices_for_subtypes`
   when subtypes detected (small follow-up commit on the same PR or
   separate PR4a-jobrunner ticket).
3. PR4b — full IFC diff engine (quantity deltas, material changes,
   severity), per task §3.3 + Q19 = B.
4. PR4b also: collect a real gbXML sample for calibration pass + add
   a discipline-aware filename test fixture (multi-discipline pack
   currently relies on user-friendly naming; production uploads from
   Allplan / Revit often strip the D.1.4.x prefix).
5. Reconciliation + derivation rules YAMLs per MEP subtype (deferred
   from PR4a to PR4b/c).

**Test count delta (PR4a):**
- gbXML extractor: 8 new (`test_uep_gbxml_extractor.py`)
- Hierarchical coverage: 12 new (`test_uep_coverage_hierarchical.py`)
- MEP matrices smoke: 11 new (`test_uep_coverage_matrices_pr4a.py`)
- Multi-subtype detection: 11 new (`test_uep_project_type_detector_multi_subtype.py`)
- **Total: 42 new tests**, 81 tests pass in the relevant UEP module
  set. Zero PR3 regressions.

**Acceptance criteria status (per TASK_UEP_PR4.md §4):**
- AC 1 (7 subtype matrices) ✅
- AC 2 (mep_base shared base) ✅
- AC 3 (≥15 categories per subtype) ✅ (28-32 per subtype after merge)
- AC 4 (multi-subtype aggregation) ✅
- AC 5 (project type detection updated) ✅
- AC 6 (gbXML parses spaces/surfaces/HVAC zones) ✅
- AC 7 (integration with VZT/ÚT matrices) ✅ via shared
  `hvac_zone` + `space_inventory` + `surface_inventory` categories
- AC 26 (MEP matrix tests per subtype) ✅
- AC 27 (gbXML adapter tests) ✅
- AC 8-25, 28-33 (IFC diff full, UI, performance, docs) → PR4b/c/d

---

## 10. Document metadata

| Field | Value |
|---|---|
| Initialized | 19.05.2026 |
| Version | 1.0 (initial) |
| Maintained by | Alexander Prokopov + Claude sessions |
| Update frequency | After each significant session |
| Read at start of | Every Claude session (online + Claude Code) |
| Storage | Both: `docs/soul.md` in repo + Project Knowledge (synced manually) |

---

**End of soul.md.**
