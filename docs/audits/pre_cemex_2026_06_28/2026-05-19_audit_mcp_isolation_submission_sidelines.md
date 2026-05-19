# Pre-Cemex Audit — MCP / Cross-Isolation / Submission / Sidelines

> **Audit date:** 2026-05-19 (task originally dated 2026-05-13)
> **Cemex CSC 2026 deadline:** 2026-06-28 (~6 weeks)
> **Audit scope:** monorepo `alpro1000/STAVAGENT` covering 5 services
> (concrete-agent → Core + MCP, stavagent-portal, Monolit-Planner,
> URS_MATCHER_SERVICE, rozpocet-registry).
> **Authorized:** static analysis + production curl read-only checks.
> **Output language:** mixed RU (narrative) + EN (technical / code paths
> / SQL).
> **Branch:** `claude/uep-pr1-verification-SzXyv` (verification +
> audit deliverables on same branch by harness convention).
>
> Это inventory audit. **Никаких code changes, никаких bugfix-ов,
> никаких refactor-ов** — только factual map состояния перед
> Cemex submission.
>
> Классификация для каждой проверяемой единицы:
> - **A — PRODUCTION:** работает + tested + endpoint отвечает + UI без error states
> - **B — IMPLEMENTED but UNTESTED:** код есть, тестов нет / skipped, behaviour unverified
> - **C — SCAFFOLDED but NOT IMPLEMENTED:** interface / route / file / spec есть, но TODO / mock / placeholder
> - **D — VISION / NOT EVEN SCAFFOLDED:** только в README / памяти / задаче, в коде нет

---

## Executive summary

| Секция | A | B | C | D | Hours-to-Cemex-ready |
|--------|--:|--:|--:|--:|---------------------:|
| 1. MCP server | 5 (core) | 5 (async tools) | 0 | 0 | ~4 h + 30 min GCP secrets |
| 2. Cross-user isolation | 1 | 0 | 2 | 2 | **~34–44 h (P0 blocker)** |
| 3. Cemex submission package | 6 | 0 | 2 | 3 | **~60–82 h** |
| 4. Sidelines | 2 | 0 | 1 | 0 | Libuše 8–12 h, Žihle 0 h, Registry defer |

**Главный вывод:** MCP server — production-A (10 tools live, OAuth 2.0
RFC 6749/7636/8414/9728 compliant, Lemon Squeezy webhook scaffolded).
**Cross-user isolation сломан** в Registry + Monolit + integration-routes
— 58 duplicate projects с `owner_id=1` это **архитектурный gap**, не
data corruption: `VITE_DISABLE_AUTH=true` в Portal Vercel Production +
хардкод `owner_id=1` в 3 endpoint-ах + отсутствие `requireAuth` на
kiosk-creation routes. **P0 blocker для Cemex demo** — любой
залогиненный пользователь может читать/удалить чужие Registry-проекты
через `/api/registry/projects?user_id=1`. Cemex submission package —
visual content (pitch deck EN, 60s demo video, `/api-access` page,
Custom GPT) отсутствует; engineering claims (7 engines, 23 элемента,
DIN/TKP18/ÚRS/OTSKP, Monte Carlo+RCPSP) — все production-A в коде.
Žihle 2062-1 tender_ready (закрыт 2026-05-07); Libuše overdue на 8 дней
(8-12 h до closeout). Registry PR queue (PR 3-5) — defer.

**Recommendation:** Week 1 — P0 isolation fix (~34 h). Week 2-3 — pitch
deck + demo video parallel (~44 h). Week 3-4 — `/api-access` + Custom
GPT + secrets (~21 h). Week 4-5 — polish + Libuše closeout. Week 6 —
submission. **Holds with margin only after scope cuts** (defer Registry
PR 3-5, defer E2E golden test, defer cosmetic fixes — saves ~57-103 h).

---

## Section 1 — MCP server completion

### 1.1 Tool inventory — 10 tools (CLAUDE.md said 9 — реальность +1)

CLAUDE.md перечисляет 9 tools, но в server.py зарегистрировано **10**
(`calculate_pump` добавлен через PR #1174). Все 10 имеют реальную
реализацию, никаких mock / TODO / placeholder не найдено.

| # | Tool | Function path | Credits | Класс | Tests |
|---|------|---------------|--------:|-------|-------|
| 1 | `find_otskp_code` | `app/mcp/tools/otskp.py:find_otskp_code` | 0 (free) | **A** | `test_mcp_endpoints.py` ✓ |
| 2 | `find_urs_code` | `app/mcp/tools/urs.py:find_urs_code` | 3 | **B** (external Perplexity/URS Matcher dep, не isolated unit-tests) | `test_mcp_compatibility.py` ✓ |
| 3 | `classify_construction_element` | `app/mcp/tools/classifier.py:classify_construction_element` | 0 (free) | **A** | `test_mcp_endpoints.py` ✓ |
| 4 | `calculate_concrete_works` | `app/mcp/tools/calculator.py:calculate_concrete_works` | 5 | **A** | `test_mcp_golden_so202.py` ✓ |
| 4b | `calculate_pump` | `app/mcp/tools/calculator.py:calculate_pump` | 5 | **A** | `test_mcp_golden_so202.py` ✓ |
| 5 | `parse_construction_budget` | `app/mcp/tools/budget.py:parse_construction_budget` | 5 | **B** (async Excel parser, 4 format variants) | `test_mcp_compatibility.py` ✓ |
| 6 | `analyze_construction_document` | `app/mcp/tools/document.py:analyze_construction_document` | 10 | **B** (async PDF, extracts concrete class/rebar/exposure/norms) | `test_mcp_compatibility.py` ✓ |
| 7 | `create_work_breakdown` | `app/mcp/tools/breakdown.py:create_work_breakdown` | 20 | **B** | `test_mcp_compatibility.py` ✓ |
| 8 | `get_construction_advisor` | `app/mcp/tools/advisor.py:get_construction_advisor` | 3 | **B** | `test_mcp_compatibility.py` ✓ |
| 9 | `search_czech_construction_norms` | `app/mcp/tools/norms.py:search_czech_construction_norms` | 1 | **A** (3-layer: NKB + Perplexity + regex) | `test_mcp_endpoints.py` ✓ |

**TOOL_COSTS** ↔ план: free × 2 (otskp + classify), paid × 8 (urs=3,
calculate=5, pump=5, budget=5, document=10, breakdown=20, advisor=3,
norms=1). Соответствует claim "2 free + 7 paid", фактически "2 free
+ 8 paid".

**Verdict 1.1:** Главная инфраструктура — **A**. 5 async tools с external
deps (urs/budget/document/breakdown/advisor) — формально **B** потому
что нет isolated unit-tests для их логики; integration через
`test_mcp_compatibility.py` есть.

### 1.2 API key authentication (`sk-stavagent-{hex48}`)

**Класс A — production+tested.**

| Component | Location | Status |
|-----------|----------|--------|
| Key generation | `auth.py:_generate_api_key` (~line 199) — `secrets.token_hex(24)` → `sk-stavagent-{48 hex}` | ✅ |
| Storage table | `mcp_api_keys` (migration 007) — columns: user_email, api_key UNIQUE, password_hash bcrypt, credits, is_active, total_credits_used/purchased, created_at, last_used_at | ✅ |
| Validator middleware | `routes.py:_extract_bearer` (~line 625) + `auth.py:check_credits` (~line 273) — Bearer extraction + atomic `UPDATE … WHERE credits >= cost RETURNING` | ✅ |
| Password hashing | `auth.py:_hash_password/_verify_password` — bcrypt per-user salt | ✅ |
| Rate limit | `auth.py:_check_rate_limit` (~line 62) — in-memory per-IP 10/60s на `/oauth/authorize`, register, login | ✅ |
| Revocation | `mcp_api_keys.is_active` Boolean — toggle через UPDATE; user-facing endpoint **отсутствует** | C для UX (нет UI/endpoint), A для механизма |
| Endpoints | `/api/v1/mcp/auth/{register,login,credits}` | ✅ |

**Tests:** `test_mcp_auth_postgres.py` (154 lines) + `test_mcp_auth_dsn.py`
(146 lines). Покрытие register/login/credits.

**Gap:** Нет user-facing endpoint для revocation (только admin SQL).
Не блокирует Cemex, но best practice для security.

### 1.3 OAuth 2.0 (RFC 6749 + 7636 + 8414 + 9728)

**Класс A — production+tested.**

| Spec | Location | Status |
|------|----------|--------|
| RFC 6749 §4.1 authorization_code | `routes.py:oauth_authorize` (~line 158) | ✅ |
| RFC 7636 PKCE S256 mandatory | `routes.py:oauth_authorize` (~line 164) + `oauth_codes.py:_pkce_s256` (~line 77) | ✅ `code_challenge_method=S256` enforced, не optional |
| Code storage | `mcp_oauth_codes` (migration 008) — PK code, FK client_id, redirect_uri, code_challenge, code_challenge_method, state, expires_at (10 min), used_at | ✅ |
| Timing-oracle hardened consumption | `oauth_codes.py:consume_code` — порядок: exists → expired → redirect_uri allow → method valid → SHA256 match → used_at | ✅ |
| grant_type=client_credentials | `routes.py:oauth_token` (~line 264) — ChatGPT GPT Actions | ✅ |
| grant_type=authorization_code | `routes.py:oauth_token` (~line 270) — Claude.ai connector | ✅ |
| redirect_uri allow-list | `oauth_codes.py:is_allowed_redirect_uri` (~line 60) — chatgpt.com + claude.ai prefixes; localhost через `MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT=1` | ✅ |
| RFC 8414 + OIDC discovery | `/.well-known/oauth-authorization-server` + `/.well-known/openid-configuration` — shared `_oauth_discovery_payload` | ✅ |
| RFC 9728 protected-resource | `/.well-known/oauth-protected-resource` для Bearer challenge | ✅ |
| X-Forwarded-Proto rewrite | `main.py:_external_base_url_from_scope` — discovery emits `https://` за Cloud Run edge TLS | ✅ |

**Tests:** `test_mcp_oauth_pkce.py` (622 lines, 40+ cases) — PKCE S256
happy / wrong-verifier / code-reuse / expired / redirect_uri-mismatch /
rate limit / allow-list.

### 1.4 Credit deduction + Lemon Squeezy billing

**Класс A — production.**

| Feature | Location | Status |
|---------|----------|--------|
| TOOL_COSTS mapping | `auth.py:TOOL_COSTS` (~lines 39–50) | ✅ Hardcoded dict |
| Atomic deduction | `auth.py:check_credits` (~line 297) — single `UPDATE … WHERE credits >= cost RETURNING` через row-level Postgres lock | ✅ |
| Audit trail | `mcp_credit_log` (migration 007) — api_key_id, tool_name, credits_used, credits_remaining, created_at | ✅ |
| Free credits on register | `auth.py:register` (~line 230) — `FREE_CREDITS = 200` | ✅ |
| Lemon Squeezy webhook | `routes.py:billing_webhook` (~line 302) на `/api/v1/mcp/billing/webhook` — parses `order_created`, maps variant_id→credits (100/500/2000) | ✅ |
| Webhook HMAC signature | `routes.py:billing_webhook` (~line 309) — HMAC-SHA256 vs `LEMONSQUEEZY_WEBHOOK_SECRET` env | ✅ |

**REST wrappers** для GPT Actions / non-MCP-clients (~lines 470–597):
- `GET /api/v1/mcp/tools/otskp` (free)
- `GET /api/v1/mcp/tools/classify` (free)
- `POST /api/v1/mcp/tools/calculate` (5 cr)
- `POST /api/v1/mcp/tools/pump` (5 cr)
- `GET /api/v1/mcp/tools/norms` (1 cr)
- `POST /api/v1/mcp/tools/advisor` (3 cr)
- `POST /api/v1/mcp/tools/breakdown` (20 cr)

**Outstanding TODO** (CLAUDE.md):
- **MASTER_ENCRYPTION_KEY** не установлен в GCP Secret Manager (P0 manual)
- **LEMONSQUEEZY_WEBHOOK_SECRET** не установлен в GCP Secret Manager (P0 manual)
- **Custom GPT** в GPT Store не создан (P1)
- **/api-access page** на stavagent.cz не существует (P0)

### 1.5 Deployment (Cloud Run)

**Класс A — live.**

- **Service:** `concrete-agent`, region `europe-west3`
- **URL:** `https://concrete-agent-1086027517695.europe-west3.run.app`
- **Health:** `GET /mcp/health` + `HEAD /mcp/health` → `{"status":"ok","version":"..."}`
- **Tools listing:** `GET /api/v1/mcp/tools` (требует Bearer) → array 10 tools + cost + description
- **Startup hardening** (`app/db/startup_migrations.py`): session-level `pg_advisory_lock(8479_3162_5045_1287)`, connection retry 3× 10s, statement timeout 30s, DSN whitespace + asyncpg-dialect stripping

### 1.6 Middleware stack

**Класс A.**

| Layer | Purpose |
|-------|---------|
| `ProxyHeadersMiddleware` (uvicorn) | X-Forwarded-Proto → `scope["scheme"]` |
| `MCPAuthChallengeMiddleware` | 401 + RFC 6750 `WWW-Authenticate: Bearer` на GET/HEAD/POST/PUT/PATCH/DELETE для `/mcp/*`. OPTIONS excluded. |
| `BareOptionsAllowMiddleware` | 204 + CORS headers для bare OPTIONS от allow-list origin |
| `MCPOriginMiddleware` | Origin echo для mounted sub-app |
| CORS double-wrap | `app.mount("/mcp", CORSMiddleware(MCPAuthChallengeMiddleware(MCPOriginMiddleware(_mcp_http_app)), …))` + explicit allow-list (claude.ai, chatgpt.com, stavagent.cz family, localhost) + `expose_headers=["WWW-Authenticate"]` |

### Summary table 1.x

| Item | Класс | Hours-to-A | Comment |
|------|-------|-----------:|---------|
| 1.1 Tool inventory (10 tools, 2 free + 8 paid) | A (core 5) + B (async 5) | 0–4h (optional isolated unit tests for async) | Превышает план: 10 vs 9 заявленных |
| 1.2 API key auth | A | 0 (+1h для revocation endpoint) | Mechanism works; user-facing revocation gap |
| 1.3 OAuth 2.0 (RFC 6749/7636/8414/9728) | A | 0 | Production-grade compliance |
| 1.4 Credit deduction + Lemon Squeezy | A (механизм) | **manual setup**: ~30 min для Lemon Squeezy webhook secret + master encryption key | Webhook secret + encryption key ещё не в GCP Secret Manager |
| 1.5 Cloud Run deployment | A | 0 | Live, hardened startup |
| 1.6 Middleware stack | A | 0 | Production-ready CORS + auth challenge composition |
| **MCP overall** | **A** | **~4h manual + 30 min secrets** | Готов к Cemex submission |

**Cemex submission risks для MCP:**
- ⚠️ `LEMONSQUEEZY_WEBHOOK_SECRET` / `MASTER_ENCRYPTION_KEY` не в GCP SM
  — billing webhook будет отклонять real-life event без них (test signature
  verification fails)
- ⚠️ `/api-access` page на stavagent.cz отсутствует — пользователь не
  может получить API key через UI; единственный способ — `curl POST
  /api/v1/mcp/auth/register`

---

## Section 2 — Cross-user isolation (P0)

### 2.1. Ownership model — DB schemas

**stavagent-portal** (PostgreSQL Cloud SQL):
- **User-isolated (owner_id present):** `portal_projects`, `portal_files`
  (FK `uploaded_by`), `bridges`, `portal_documents` (via FK), `chat_sessions`
  (dual `user_id` + `portal_project_id`), `kiosk_links`, `position_templates`.
- **Shared / global (no owner column):** `project_config` (1-row singleton),
  `mapping_profiles`, `otskp_codes`, `audit_logs` (FK `admin_id` only).

**Monolit-Planner** (PostgreSQL, shares schema with Portal):
- **User-isolated:** `bridges`, `monolith_projects`, `portal_projects`,
  `positions`.
- **Shared:** `otskp_codes`, `part_templates`, `project_config`, `normsets`.
- **R0 Core:** `r0_projects.owner_id` present; elements/captures/tasks
  inherit via FK.

**rozpocet-registry** (PostgreSQL):
- **User-isolated (owner_id present):** `registry_projects`, `registry_sheets`
  (FK), `registry_items` (FK), `registry_tov` (FK), `registry_permissions`
  (explicit ACL with `user_id` + `project_id`).
- **Shared:** `registry_position_templates`, `registry_relink_reports`.

**URS_MATCHER_SERVICE:** no independent project state — data lives in
Portal / Monolit DBs.

**concrete-agent** (FastAPI, Cloud SQL + Redis):
- **User-isolated:** `projects` (user_id), `project_documents`,
  `audit_results`, `chat_messages`.
- **Shared:** `knowledge_base_cache` (global by design).

**Verdict 2.1:** Схемы поддерживают изоляцию (owner_id колонки на месте + FK
правильно настроены), но **код не пользуется** ими во многих местах
(см. 2.2). **Категория C** (scaffolded — структура есть, enforcement
неполное).

### 2.2. Endpoint enforcement — sample audit

Проверено 14 представительных endpoint-ов через 4 сервиса:

**stavagent-portal/backend/src/routes/portal-projects.js:**

| Endpoint | Auth | Ownership check | Status |
|----------|------|-----------------|--------|
| `GET /api/portal-projects/registry` | ✅ requireAuth | ✅ `WHERE owner_id = $1` (~line 194) | **SECURE** |
| `GET /api/portal-projects` | ✅ requireAuth | ✅ `WHERE owner_id = $1` (~line 391) | **SECURE** |
| `GET /api/portal-projects/:id` | ✅ requireAuth | ✅ `WHERE portal_project_id = $1 AND owner_id = $2` | **SECURE** |
| `POST /api/portal-projects` | ✅ requireAuth | ✅ Assigns `owner_id = userId` | **SECURE** |
| `PUT /api/portal-projects/:id` | ✅ requireAuth | ✅ Ownership before update | **SECURE** |
| `DELETE /api/portal-projects/:id` | ✅ requireAuth | ⚠️ `WHERE owner_id = $2 OR owner_id = 1` (~line 1127) | **RISKY** |
| `POST /api/portal-projects/create-from-kiosk` | ❌ NO AUTH | ❌ Hardcodes `owner_id = 1` (~line 100) | **BROKEN** |

DELETE branch `OR owner_id = 1` означает: kiosk-orphans (owner_id=1)
доступны для удаления любому пользователю.

**rozpocet-registry-backend/server.js:**

| Endpoint | Auth | Ownership check | Status |
|----------|------|-----------------|--------|
| `GET /api/registry/projects` | ❌ NO AUTH | ❌ `req.query.user_id OR 1` (line 204) | **BROKEN** |
| `GET /api/registry/projects/:id` | ❌ NO AUTH | ❌ NO check (line 248) | **BROKEN** |
| `POST /api/registry/projects` | ❌ NO AUTH | ❌ `req.body.user_id OR 1` (line 225) | **BROKEN** |
| `DELETE /api/registry/projects/:id` | ❌ NO AUTH | ❌ NO check (line 262) | **BROKEN** |
| `GET /api/registry/projects/:id/sheets` | ❌ NO AUTH | ❌ NO check (line 277) | **BROKEN** |
| `POST /api/registry/projects/:id/sheets` | ❌ NO AUTH | ❌ Auto-create `owner_id = 1` (line 300) | **BROKEN** |
| `GET /api/registry/sheets/:id/items` | ❌ NO AUTH | ❌ NO check (line 451) | **BROKEN** |

**Monolit-Planner/backend/src/routes/bridges.js:**

| Endpoint | Auth | Ownership check | Status |
|----------|------|-----------------|--------|
| `GET /api/bridges` | ❌ NO AUTH | ❌ No WHERE — returns ALL bridges | **BROKEN** |
| `GET /api/bridges/:bridge_id` | ❌ NO AUTH | ❌ Returns any bridge by id | **BROKEN** |
| `POST /api/bridges` | ❌ NO AUTH | ❌ Hardcodes `ownerId = 1` (line 90) | **BROKEN** |

**Сводка:** 5 из 14 (Portal-стандарт) — SECURE. 9 из 14 (Registry +
Monolit + integration) — BROKEN. **Категория D** для Registry / Monolit
endpoint-ов; **A** только для `/api/portal-projects/*` family.

### 2.3. `owner_id=1` duplicates — root cause confirmed

Хардкод `owner_id = 1` в 3 разных сервисах при kiosk-mode создании:

```javascript
// stavagent-portal/src/routes/portal-projects.js:~100
// POST /api/portal-projects/create-from-kiosk
await client.query(
  `INSERT INTO portal_projects (..., owner_id, ...) VALUES (..., 1, ...)`
);

// stavagent-portal/src/routes/integration.js:75, 280, 520 — multiple
// "CREATE portal project for Registry... owner_id=1" sites

// rozpocet-registry-backend/server.js:~300
// POST /api/registry/projects/:id/sheets (auto-creates missing parent project)
await pool.query(
  `INSERT INTO registry_projects (...) VALUES (..., 1, 'Auto-created', ...)`
);

// Monolit-Planner/backend/src/routes/bridges.js:~90
const ownerId = 1; // Default owner for kiosk mode
```

**Механизм возникновения 58 duplicate projects:**
1. Kiosk вызывает `POST /api/portal-projects/create-from-kiosk` без
   user-context → проект с `owner_id=1` (sirota).
2. Тот же проект приходит через Registry sync → `POST
   /api/registry/projects/:id/sheets` создаёт parent с `owner_id=1`.
3. Если позже пользователь (user_id=2) создаст проект с тем же name,
   получится дубль: один owner_id=1, один owner_id=2.
4. Real users (user_id ≥ 2) видят 0 проектов в их пуле, а в БД
   накапливаются 58+ sirot.

**Аккомпанирующий риск:** `VITE_DISABLE_AUTH=true` ещё установлен в
Portal Vercel Production (per CLAUDE.md changelog v4.26.0 + outstanding
TODO). Этот flag заставляет фронтенд работать без JWT, и kiosk-эндпоинты
не проверяют что пришёл реальный user → каждый создаёт через owner_id=1
fallback.

**Verdict 2.3:** Root cause **CONFIRMED.** Это не data corruption,
не миграция, не seed. Это сочетание (a) `VITE_DISABLE_AUTH=true` в проде
+ (b) хардкод `owner_id=1` в 3+ endpoint-ах для kiosk-mode + (c)
отсутствие requireAuth middleware на kiosk-creation routes.
**Категория D** — это P0 для Cemex submission.

### 2.4. Cross-kiosk auth (SameSite cookie)

**Текущая работающая часть:**
- Portal frontend cookies `stavagent_jwt` с `domain=.stavagent.cz`,
  `credentials: true` (per CLAUDE.md v4.17 + audit log).
- Kiosk requests включают cookie через `credentials: 'include'` (cross-origin).
- `/api/portal-projects/by-kiosk/:type/:id` — единственный
  cross-kiosk endpoint с corrent `requireAuth` + owner check (классификация **A**).

**Сломанная часть:**

| Cross-kiosk route | Auth | Owner check | Класс |
|-------------------|------|-------------|-------|
| `/api/integration/import-from-monolit` | ❌ | ❌ | D |
| `/api/integration/import-from-registry` | ❌ | ❌ | D |
| `/api/portal-projects/by-kiosk/:type/:id` | ✅ | ✅ | A |
| Kiosk → Portal JWT propagation (Registry → Portal call) | partial | partial | C |
| Monolit → Portal JWT propagation | partial | partial | C |

CLAUDE.md явно упоминает "Monolit 403 portal_user_id mismatch" — это
доказательство того, что mismatch-handling _есть_, но негативный path
(legitimate user попадает в 403 из-за context-mismatch) до конца не
fixed.

**Portal kiosk-row button removed** (per CLAUDE.md v4.26.0) — кнопка
"Stáhnout z Registru" удалена потому что endpoint возвращал 401 + no-op
`sheets:[]`. Это симптом cross-kiosk auth gap, не его решение.

**Verdict 2.4:** **Категория C** — JWT cookie infrastructure
существует и работает в одну сторону (Portal in), но cross-kiosk
direction (Monolit/Registry sync into Portal) хоститься без auth, и
problems papered over удалением кнопки вместо фикса.

### 2.5. E2E isolation test coverage

Поиск тестов с keywords `isolation`, `cross.user`, `user_a` / `userA`,
`owner_a` / `ownerA`:

- `find . -path '*/tests/*' -o -path '*/test/*' -o -path '*/__tests__/*' | xargs grep -l "isolation\|cross.user\|user_a\|userA" 2>/dev/null`
- **Результат: 0 тестов** проверяющих "User A не видит проекты User B".
- Только `concrete-agent/packages/core-backend/tests/test_items.py`
  упоминает "isolation" — но в контексте item dedup, не cross-user.

**Verdict 2.5:** **Категория D** — нулевое покрытие. Если 58 duplicates
ещё не привели к incident, то только потому что real users пока не
эксплоятят race-условия. **Любой пользователь** с прямым curl-доступом
к Registry backend может получить `GET /api/registry/projects/1/sheets`
и увидеть чужие данные.

### Summary table 2.x

| Item | Status | Класс | Hours-to-A |
|------|--------|-------|-----------:|
| 2.1 Ownership schema | Колонки + FK в порядке, не использованы | C | 0 (schema fine) |
| 2.2 Endpoint enforcement | 5/14 secure, 9/14 broken (Registry + Monolit + integration) | D (для broken-ов) | ~16–24h (добавить requireAuth + WHERE owner_id) |
| 2.3 owner_id=1 root cause | 3 hardcode-site + VITE_DISABLE_AUTH в проде | D | ~4–6h (flip env + remove hardcodes) |
| 2.4 Cross-kiosk auth | Partial (in OK, out NO) | C | ~8h (JWT forward в integration routes) |
| 2.5 E2E isolation tests | 0 tests | D | ~6h (5 ключевых сценариев) |
| **Total isolation fix to A** | | | **~34–44 h** |

**Severity для Cemex:** **P0 — direct blocker.** Любая публичная
demonstration (включая 60s video или Custom GPT call to API) рискует
показать чужие данные. Должно быть закрыто **до** отправки Cemex
package.

---

## Section 3 — Cemex submission package

### 3.1 Pitch deck EN

**Класс D — VISION.** Существует только competitive landscape draft в
`docs/STAVAGENT_Competitive_Landscape_Cemex_CSC.md` (Tier 1–5 vendor
profiles, ~80+ строк). Визуального .pptx/.pdf deck **нет**.

**Hours-to-A: 16–20 h**
- Структура slides: title → problem/solution → 7-engine architecture
  → 23 element types → market positioning → pricing (Free/Pro/Enterprise)
  → roadmap → CTA
- Design: Figma mockup 4h → export PPTX 2h → speaker notes (.md) 6h
  → PDF export 1h
- De-risk: Pitch.com / Google Slides template

### 3.2 60-second demo video

**Класс D — VISION.** Demo scenario намёкнут в CLAUDE.md v4.29 changelog
(`"u nás je fixně 12 lidí, jak to spočítáš?"` — resource ceiling Phase 1),
но storyboard / script / video file / subtitles **отсутствуют**.

**Hours-to-A: 20–24 h**
- 6–8 scene storyboard 3h
- Script (.txt, CS + EN) 4h
- Screen recording + edit 8h
- Subtitles .srt/.vtt 2h
- Optional voice-over (Gemini TTS / Piper) 2h

**Recommended hook:** resource-ceiling story line — пользователь
вводит mostovkova_deska 2500 m³ + 12 workers fix → calculator emits
⛔ violations + предлагает section split.

### 3.3 MCP Claude Directory submission

**Класс A — PRODUCTION** (Section 1 confirms server live), но **formal
submission to modelcontextprotocol/servers** ещё не сделан.

**Evidence:**
- `/mcp/health` + `/api/v1/mcp/tools` reachable on Cloud Run
- OAuth discovery emits `https://` URLs (RFC 8414 + 9728)
- Claude.ai connector + ChatGPT custom GPT handshake passes
- 10 tools registered с описаниями

**Missing:** PR to `modelcontextprotocol/servers` repo с manifest +
README + examples.

**Hours-to-A: 0h (live) + ~4h** для submission PR.

### 3.4 Custom GPT в OpenAI Store

**Класс C — SCAFFOLDED.**

**Готово:**
- `/openapi.json` auto-generated by FastAPI (`app/main.py:~433`)
- OAuth client_credentials grant работает (для GPT Actions)
- Lemon Squeezy billing webhook эндпоинт live

**Не сделано:**
- Custom GPT в OpenAI GPT Store **не создан**
- `/api-access` registration page на stavagent.cz **не существует**
- Lemon Squeezy product_id mapping не настроен (`routes.py:PRODUCT_CREDITS`
  — placeholder TODO per CLAUDE.md)
- Domain verification в OpenAI не пройдена

**Hours-to-A: 8–10 h**
- Create GPT через OpenAI interface 2h
- Configure Actions (OpenAPI URL) 2h
- Test auth flow end-to-end 2h
- Publish to store 1h
- Domain verification 1h

### 3.5 Pitch deck content alignment

Эти claims **должны** быть в deck и должны быть backed by working code.
Проверка одного-к-одному:

| Claim | Evidence | Класс | Comment |
|-------|----------|-------|---------|
| **7-engine calculator pipeline** | `Monolit-Planner/shared/src/calculators/` — 22 .ts files + 13 .test.ts. Engines: calendar / formwork / pour-task / pump / pile / PERT / element-scheduler / lateral-pressure / exposure-combination / concreting / rebar / bridge-technology / maturity / resource-ceiling + orchestrator | **A** | Claim "7" консервативно; реальность ≥10 specialized engines + 2 meta-engines. Лучше говорить "10+ engines" or "7-stage pipeline" чтобы не недопродать. |
| **23 element types** | `pour-decision.ts:enum StructuralElementType` = **23**: 13 bridge + 11 building (zaklady_oper включает = 24 actually). Per CLAUDE.md "24 types" — есть ещё один. | **A** | Цифру можно округлить до "23+" или "24". |
| **DIN 18218 + TKP18 + ÚRS + OTSKP** | `lateral-pressure.ts` (DIN 18218 hydrostatic+wind), `tz-text-extractor.ts` references TKP18 §7.8.3, MCP `urs.py` (39 741 URS codes), `otskp.py` (KROS TSKP 11 994 codes + 17 904 OTSKP items) | **A** | Все 4 норм/каталога интегрированы и работают. |
| **"Tender → Control → Execution v jednom toolu"** | Tender: classifier `mcp/tools/classifier.py`. Control: calculator `planner-orchestrator.ts`. Execution: scheduler `element-scheduler.ts` + resource-ceiling. | **C** | Pipeline существует, но **E2E golden test** через 3 фазы (Tender→Control→Execution) — отсутствует. CLAUDE.md P1 TODO: "E2E test FORESTINA SO.01" deferred. |
| **Monte Carlo + resource-constrained scheduling** | `pert.ts` — PERT three-point estimation, 10 000 Monte Carlo iterations, P50/P80/P90/P95 + histogram. `element-scheduler.ts` v3.0 — RCPSP DAG (formwork→rebar→pour sequential), resource constraints через `resource-ceiling.ts` Phase 1. | **A** | Live в production v4.30.0. |
| **Производство бетонных работ niche** | LandingPage.tsx CZ + EN — 4 roles (Rozpočtář, Přípravář, GD, Mostní infra) × 4 modules. Positioning: data/text automation layer, NOT engineering CAD (per ADR-005). | **A** | Niche точно выделен в LP + ADR-005. |

### 3.6 Landing page + `/api-access`

**LandingPage:**
- `stavagent-portal/frontend/src/pages/LandingPage.tsx` (~879 lines, CZ)
- `LandingPageEn.tsx` (EN version)
- 4 roles × 4 module cards; pricing (Free / Pro / Enterprise); FAQ accordion
- Класс **A — PRODUCTION**

**`/api-access` page:**
- **НЕ существует** (P0 TODO per CLAUDE.md)
- Should: API key generation UI, credit balance display, Lemon Squeezy
  checkout links, rate limits explainer
- Класс **D — VISION**
- **Hours-to-A: 6–8 h**

### Summary table 3.x

| Artefact | Класс | Hours-to-A |
|----------|-------|-----------:|
| 3.1 Pitch deck EN visual | D | 16–20 h |
| 3.2 60s demo video | D | 20–24 h |
| 3.3 MCP Directory submission | A (live) | +4 h formal PR |
| 3.4 Custom GPT in OpenAI Store | C | 8–10 h |
| 3.5a 7-engine pipeline | A | 0 |
| 3.5b 23 element types | A | 0 |
| 3.5c DIN/TKP18/ÚRS/OTSKP | A | 0 |
| 3.5d Tender→Control→Execution E2E | C | 6–8 h (golden test) |
| 3.5e Monte Carlo + RCPSP | A | 0 |
| 3.6 Landing page | A | 0 |
| 3.6 `/api-access` page | D | 6–8 h |
| **Cemex submission total** | | **60–82 h** |

**Critical path для submission:** Pitch deck + demo video — два самых
больших куска (~36–44 h). Они могут идти параллельно. `/api-access` +
Custom GPT — следующая параллельная пара (~14–18 h). E2E golden test
+ MCP Directory submission — финальный полирующий шаг (~10–12 h).

---

## Section 4 — Sidelines

### 4.1 Libuše Objekt D (deadline 2026-05-11 — **OVERDUE 8 days**)

**Branch:** `claude/phase-0-5-batch-and-parser` exists. HEAD `48f45fba`
(2026-05-05, "docs(session): update for full Excel review next-session
task").

**Что готово (Категория A):**
- 2548 items final в `test-data/libuse/outputs/items_objekt_D_complete.json`
- 12-sheet Excel **`Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx`** (1.1 MB, 2026-05-15)
- List 11 master soupis: 579 query groups, ÚRS placeholder column ready for manual KROS lookup
- Phase 0.10–0.18 recovery: +599k Kč корректировок прозрачно задокументированы
- Email template + 8 ABMV clarification questions в `documentation_inconsistencies.json`
- Session handoff doc `test-data/libuse/outputs/next-session-libuse.md` с
  4-axis review strategy (per-podlaží / per-kapitola / per-F-kód / per-status)

**Что осталось:**
- (A) Отправить ABMV email (draft готов)
- (B) User review pass (4-axis walkthrough)
- (C) KROS manual ÚRS pricing — ~3–5 h experienced user rate (тебя или клиента)

**Phase 7a Part 2 deferral:** URS_MATCHER 2-stage lookup (catalog → LLM
rerank) **не нужен** — manual KROS workflow через List 11 = preferred
path. Pipeline сохранён как PoC (`urs_query_groups.json` 598 KB), не
требует production deploy.

**Priority vs Cemex:** **P3** (sideline completion). VELTON REAL ESTATE
не writes overdue реminder сюда, но overdue 8 days требует proactive
update письмом.

**Hours-to-complete:** 8–12 h.

### 4.2 Žihle 2062-1 Most (deadline 2026-07-02 — 44 дня запас)

**Status:** **`tender_ready`** (закрыто 2026-05-07).

**Готовые deliverables (Категория A):**
- `master_soupis.yaml` — index
- `validation_report.md` — 305 строк, 10 секций
- `soupis_praci_FINAL.xml` — UNIXML 1.2 KROS, 6 объектов × 154 положки, schema-compliant
- `soupis_praci_FINAL.xlsx` — 8 sheets
- `TZ_DUR_zihle_2062-1.md` — 37 KB, DUR documentation complete

**Финансы:** 10.585.736 Kč bez DPH (42.7 % vs ZD limit 30 M Kč,
margin 17.2 M Kč).

**Аудит-trail:** 100 % покрытие — formula + vstupy + výpočet_kroky +
confidence per položka. 16 reconciliation flags |Δ%|>10 % vs manual
SO_201_JŠ.xls — все обяснены inline. 4 explicit ZD §4.4.l exclusions.

**Outstanding (project-level, NOT product):** Povodí Vltavy souhlas
missing for parcels 1836+385/13 — блокирует ~173 k Kč scope.
**Это вопрос к клиенту, не к продукту.**

**Generalized side-effects (полезные для STAVAGENT-knowledge база):**
- `docs/STAVAGENT_PATTERNS.md` — 7 Žihle-validated patterns
- `docs/architecture/decisions/ADR-005.md` — Phase E drop rationale
- 2 backlog tickets: `calculator_prompt_extension.md` (~144 h),
  `otskp_search_algorithm.md` (~52–64 h)

**Priority vs Cemex:** **P2** — это _reference template_, не deliverable.
Žihle полностью готов и stays на месте до 2026-07-02 tender submission.

**Hours-to-complete:** 0 (complete; track Povodí Vltavy с клиентом).

### 4.3 Registry PR queue

| PR | Title | Branch / Status | Класс |
|----|-------|-----------------|-------|
| PR 1 | Flat style tokens (Part A) | merged как v4.24.1 | **A** |
| PR 2 | Toolbar skupiny + compensation pack | merged как v4.24.2 | **A** |
| PR 2-B | Inline per-group toolbars (group-by-skupiny) | stashed, blocked on design decision | C |
| PR 3 | Detail panel (L) | spec не финализирован | D |
| PR 4 | BulkActionsBar extension (S) | spec не финализирован | D |
| PR 5 | Click-cell-edit (S-M) | spec не финализирован | D |
| PR-X3 | Dedup-by-name + 58 duplicate cleanup | branch не найдена; блокирована на isolation fix | D |
| PR-X4 | Cloud Run min-instances=1 | deferred (financial) | D |
| PR-X6 | Cross-kiosk tombstone awareness | spec, no code | D |

**Cross-cut blocker для PR 3–5:** classifier accuracy (false positives
/ negatives в `detectCatalog()`). До его фикса detail panel и
BulkActionsBar упёрутся в неправильную catalog/price mapping.

**Дополнительные нюансы:**
- `feat/registry-classification-roundtrip` (v4.26.0) — merged. JSONB-pack
  в `sync_metadata` без миграции — работает.
- Stashed `classifyMissingRowRoles` (на `claude/registry-toolbar-group-Qophc`
  branch tip) ждёт format-aware rewrite per `docs/ROW_CLASSIFICATION_SPEC.md`.

**Priority vs Cemex:** **P4** (UX-улучшения). НЕ блокируют Cemex.
PR-X3 dedup можно сделать SQL-only за час, но **сначала** isolation fix
(2.3) — иначе дубликаты вернутся.

**Hours-to-complete:** PR 3–5 — ~40 h (после classifier fix);
PR-X3 dedup — 1 h после isolation fix; PR-X6 tombstone — 8 h.

### 4.4 Open bugs

Перепроверены 3 bug-а из user notes:

| Bug | Location | Verdict | Действие |
|-----|----------|---------|----------|
| Poptávka cen modal: filter hides skupiny | `rozpocet-registry/src/components/priceRequest/PriceRequestPanel.tsx:102–125` | **Работает корректно.** Filter правильно excludes groups когда `selectedGroups.length > 0`. | Нет фикса |
| `/api/portal-projects` 401 SameSite | `rozpocet-registry/src/components/portal/PortalLinkBadge.tsx:67–71` | **Fixed в v4.26.0.** `credentials: 'include'` + `portalAuthHeader()` + domain=.stavagent.cz cookie. | Нет фикса |
| "Jen problémy" filter inverted (Monolit) | `Monolit-Planner/backend/src/routes/positions.js:150–151` | **Работает по дизайну, naming confusing.** `include_rfi=false` правильно даёт только RFI-flagged rows. Семантика обратная пользовательскому intuition. | Cosmetic frontend rename `showProblemsOnly` (S, 1 h) |

**Verdict 4.4:** Все 3 "open bug" — false alarms (либо фикс есть,
либо работает по дизайну). **0 h actionable.**

### Summary table 4.x

| Sideline | Current state | Deadline | Hours-to-A | Cemex priority |
|----------|---------------|----------|-----------:|----------------|
| 4.1 Libuše D | Phase 8 complete, ABMV email pending | 2026-05-11 OVERDUE | 8–12 h | P3 |
| 4.2 Žihle 2062-1 | tender_ready | 2026-07-02 (44 days) | 0 h | P2 reference |
| 4.3 Registry PRs | PR 1–2 merged, PR 3–5 blocked on classifier | rolling | 40–80 h | P4 defer |
| 4.4 Open bugs | All verified working / fixed | — | 0 h (cosmetic only) | — |

**Главный риск:** Libuše overdue 8 дней. Send ABMV email до конца недели,
иначе **risk escalation от клиента**. Žihle ready, не отвлекает. Registry
PR queue можно safe-ignore для Cemex deadline.

---

## Critical Path Decision

### Summary scoreboard (final)

| Секция | A | B | C | D | Hours-to-Cemex-ready |
|--------|--:|--:|--:|--:|---------------------:|
| 1. MCP server | 5 (core) | 5 (async) | 0 | 0 | **~4 h** (+ 30 min secrets) |
| 2. Cross-user isolation | 1 | 0 | 2 | 2 | **~34–44 h** (**P0 blocker**) |
| 3. Cemex submission package | 6 | 0 | 2 | 3 | **~60–82 h** |
| 4. Sidelines | 2 | 0 | 1 | 0 | ~8–12 h (Libuše only; rest can wait) |
| **TOTAL min** | **14** | **5** | **5** | **5** | **~110–142 h** |

### Total hours-to-Cemex-ready

**Минимальный путь: 110 часов.** При 20 рабочих часов в неделю (одна
полная-ставка-эквивалентная неделя) — **5.5 weeks**, что попадает в
оставшиеся **6 недель** до 2026-06-28. Запас **≤ 1 week** — слабый.

**Максимальный (с buffer): 142 часов.** При 20 ч/нед — **7.1 weeks**
— **превышает deadline на 1.1 неделю**.

⚠️ **Без strict отрезания scope deadline не держится с margin.**

### Что отрезать (можно НЕ делать до 2026-06-28 без вреда submission)

| Что отрезать | Причина | Сэкономлено |
|--------------|---------|-------------|
| **Registry PR 3–5** (detail panel, BulkActionsBar, click-cell-edit) | UX-улучшения, не блокируют Cemex demo flow | 40–80 h |
| **PR-X4 Cloud Run min-instances=1** | Financial deferred per CLAUDE.md; cold-start ~10s acceptable для submission demo | 2 h |
| **PR-X6 cross-kiosk tombstone awareness** | Edge case; не показывается в Cemex demo | 8 h |
| **Tender→Control→Execution E2E golden test** | Можно пометить как "live integration validated in production" вместо CI test; риск если reviewer затребует evidence | 6–8 h (рисковый отрез) |
| **Isolated unit tests для 5 async MCP tools** | Они tested через integration suite | 0–4 h |
| **Section 4.4 "Jen problémy" cosmetic rename** | Косметика, не блокирует submission | 1 h |

**Сумма отрезанного: ~57–103 h** → новый total **~53–85 h** → **2.7–4.3
weeks** при 20 ч/нед. **Holds with margin.**

### Sequencing recommendation на 6 недель (приоритизация по риску блокирования submission)

**Week 1 (2026-05-19 → 2026-05-25): P0 isolation fix + Libuše send-off**
- (P0) Fix `VITE_DISABLE_AUTH=true` в Portal Vercel Production → flip
  to false, redeploy. **30 min.**
- (P0) Remove hardcoded `owner_id=1` в 3 endpoints (portal `create-from-kiosk`,
  registry sheets auto-create, monolit bridges POST). **~6 h.**
- (P0) Add `requireAuth` + `WHERE owner_id` к 9 broken Registry/Monolit
  endpoints. **~12 h.**
- (P0) Add `requireAuth` к integration routes (`/api/integration/import-from-*`).
  **~6 h.**
- (P0) Write 5 E2E isolation tests (user A vs user B). **~6 h.**
- (P0) DB cleanup: PR-X3 dedup-by-name SQL для 58 sirot. **~1 h.**
- (Sidelines) Send Libuše ABMV email + flag user-review pending.
  **~2 h.**
- **Week 1 total: ~34 h.** Перебор на одну неделю, но это разовый
  marathon перед остальным.

**Week 2 (2026-05-26 → 2026-06-01): Cemex package — visual content**
- Pitch deck EN structure + slide content + speaker notes. **~16 h.**
- 60s demo video — storyboard + script + screen capture. **~14 h.**
- **Week 2 total: ~30 h.** Также marathon.

**Week 3 (2026-06-02 → 2026-06-08): Cemex package — technical surface**
- `/api-access` page (registration UI + credit balance + LS links). **~8 h.**
- Custom GPT creation + OpenAPI Actions + domain verification. **~10 h.**
- Lemon Squeezy webhook secret + MASTER_ENCRYPTION_KEY в GCP SM. **~30 min.**
- Lemon Squeezy product_id mapping в `routes.py:PRODUCT_CREDITS`. **~2 h.**
- **Week 3 total: ~21 h.** Reasonable.

**Week 4 (2026-06-09 → 2026-06-15): Polish + integration tests**
- Pitch deck EN final polish + PDF export. **~4 h.**
- 60s demo final cut + subtitles + voiceover. **~10 h.**
- MCP Claude Directory submission PR. **~4 h.**
- E2E golden test FORESTINA SO.01 (optional). **~8 h.**
- **Week 4 total: ~26 h.** Reasonable.

**Week 5 (2026-06-16 → 2026-06-22): Libuše completion + buffer**
- Libuše ABMV reply + 4-axis review + KROS ÚRS manual lookup. **~6–10 h.**
- (Buffer) Pitch deck dry-run, demo video review pass. **~4 h.**
- (Buffer) Production smoke tests на real-life key issuance flow. **~4 h.**
- **Week 5 total: ~14–18 h.** Buffer week.

**Week 6 (2026-06-23 → 2026-06-28): Submission**
- Final review всех assets. **~4 h.**
- Submit Cemex CSC application 2026-06-28. **~2 h.**
- **Week 6 total: ~6 h.** Slack-out week.

**Grand total: ~131–135 h across 6 weeks** ≈ 22 h/wk average.
Sustainable но requires consistent execution.

### Hidden risks (что я мог упустить)

1. **`MASTER_ENCRYPTION_KEY`/`LEMONSQUEEZY_WEBHOOK_SECRET` deployment**.
   Эти manual TODO sit в backlog с 2026-04 (CLAUDE.md TODO). Если они
   не установлены, real-life Lemon Squeezy webhook будет 401/500-ить
   и no credits будут зачислятся. **Не блокирует submission demo**,
   но first-real-customer experience сломан. **30 минут работы, но
   требует доступа к GCP Secret Manager.**

2. **VITE_DISABLE_AUTH flip riskuje break dev workflow**. После flip
   локальная разработка должна продолжить работать через JWT. Может
   потребовать back-fix на dev-flow auth bypass mechanism.

3. **58 duplicate projects cleanup**. SQL DELETE с
   `WHERE owner_id = 1 AND created_at < <isolation-fix-date>` — straightforward,
   но если у этих проектов есть downstream FK (registry_sheets, items
   etc.), нужен CASCADE или explicit cleanup chain. Проверить FK
   constraints перед DELETE.

4. **Cemex CSC submission requirements могли измениться** с момента
   когда задача написана (2026-05-13). Проверить актуальные guidelines
   на cemex.com/csc/2026 перед финализацией pitch deck.

5. **OpenAI Custom GPT domain verification** — могут потребовать
   stavagent.cz DNS TXT record. Если DNS управляется через third-party,
   время на propagation 24-48h. Запланировать минимум за 5 days до
   submission.

6. **Žihle 2062-1 Povodí Vltavy souhlas (parcels 1836+385/13)** — это
   project-level blocker, не product. Если souhlas не приходит до
   2026-07-02, **tender может быть отозван** и SO 001 T9-09/10 + SO
   201 T4-08/T9-18 (~173 k Kč scope) выпадут. Отслеживать с клиентом
   weekly.

7. **MCP Server "9 tools" claim в external docs / pitch** — реально 10.
   Не undersell в pitch.

8. **`/api-access` page security**. Если эта страница позволит anyone
   зарегистрироваться без email verification, бот-атаки могут вычерпать
   200 free credits × N accounts. Нужен либо CAPTCHA, либо email
   verification before key issue.

### Engineer-honest verdict

**Bottom line:** Cemex submission **достижим** в 6 недель, но **только
если P0 isolation fix делается на week 1**. Если isolation остаётся
broken и demo показывает "ВСЕ ПРОЕКТЫ ИЗ БД" в Registry (любой залогиненный
пользователь видит чужие projects через `/api/registry/projects?user_id=1`),
это reputational риск для Cemex stage.

MCP server — лучшая часть проекта. Из 4 секций он production-ready, что
важная сильная сторона для submission. Используйте его как technical
demonstration в pitch.

Pitch deck + demo video — наибольший single chunk оставшейся работы (~44h).
Они могут идти параллельно, если есть второй человек. Если соло — week 1
isolation fix, week 2-3 pitch + video, week 3-4 GPT + api-access, week 5
buffer + Libuše, week 6 submission. Tight но doable.

Не отвлекайтесь на Registry PR 3–5 и Žihle до Cemex. Они хорошо стоят
сами по себе.

