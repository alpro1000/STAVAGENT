# TASK: Integration Cleanup — Failed Deploys + Incomplete Isolation Fix

## Мантра

Это **integration cleanup task**, не feature development. Цель —
довести до production несколько уже merged PRs которые не deployed
properly из-за silent Cloud Run deploy failures + закрыть gap'ы в
существующих fix'ах.

Сначала ты читаешь весь `alpro1000/STAVAGENT` repo, особенно:
- `concrete-agent/packages/core-backend/` (DCR, migrations, OAuth)
- `rozpocet-registry-backend/` (isolation fix #1185 + routes)
- `Monolit-Planner/backend/` (isolation parallel)
- Все `cloudbuild-*.yaml` в repo root
- `gcloud builds list` и `gcloud run revisions list` output если есть в context

НЕ начинай implementation пока не прошёл PRE-INTERVIEW (4 вопроса в конце).

NAMING RULE: все имена (file paths, env vars, route handlers) — по
существующим конвенциям. Не создавай parallel structures.

## КОНТЕКСТ — production state на 2026-05-20 06:30 UTC

### Найденные проблемы

**Problem 1 — Cloud Run silent deploy failures**

Cloud Build тригерится на merge, builds SUCCESS, image push SUCCESS,
new revision created. Но контейнер не стартует на новом revision
(health check timeout, container failed to listen on PORT). Cloud
Run автоматически rollback'ает traffic на старый working revision.
Outside world не видит проблему. Внутри: production runs **OLD code**
несмотря на successful merge to main.

Конкретно подтверждено:
- `rozpocet-registry-backend-00265-plc` (2026-05-19 13:20, after PR #1185 merge) — не ACTIVE
- `rozpocet-registry-backend-00262-7d7` (2026-05-19 12:26, BEFORE PR #1185 merge) — ACTIVE
- Error в deploy logs: "The user-provided container failed to start
  and listen on the port defined provided by the PORT=3002
  environment variable within the allocated timeout"

Hypothesis: контейнер hardcoded слушает PORT 8080 (или 8000), не reads
PORT env var. Cloud Run sets PORT=3002 для этого сервиса. Mismatch.

Verify: смотри `rozpocet-registry-backend` server startup code — есть
ли `process.env.PORT` или hardcoded port number?

**Problem 2 — PR #1185 isolation hotfix incomplete**

Even if Problem 1 fixed and #1185 properly deployed, fix добавляет
`requireAuth` middleware **только на write endpoints** (per Amazon Q
review summary). GET endpoints (read paths) остаются публичными.

Verify через curl:
```bash
curl -i https://rozpocet-registry-backend-1086027517695.europe-west3.run.app/api/registry/projects
```

Currently returns 200 + полный список 18+ projects с client names
(FORESTINA, D6, etc.) без auth. This is GDPR breach.

PR #1185 add'ит requireAuth на POST/PUT/PATCH/DELETE. Нужно
добавить **also на GET endpoints**:
- `/api/registry/projects` (list)
- `/api/registry/projects/:id` (detail)
- `/api/registry/projects/:id/sheets`
- `/api/registry/sheets/:id/items`
- Любые другие GET endpoints возвращающие user-scoped data

Также верифицировать что queries filter by `req.user.userId` после
auth (owner-scoped queries) — не просто "auth required but returns
all rows".

**Problem 3 — DCR deploy similar issue (если applicable)**

PR #1189 (DCR) merged в 19:54-ish, revision `concrete-agent-00364-tnm`
created в 20:23. **ACTIVE: yes** для этого revision.

Но curl tests показали:
- `/.well-known/oauth-authorization-server | jq .registration_endpoint` → null
- `POST /api/v1/mcp/oauth/register` → 404
- Startup logs: "schema up to date (6 migration(s) checked)" — должно быть 9

Hypothesis: либо 00364 contains DCR код но migrations не в правильном
path (Dockerfile COPY pattern issue), либо 00364 это actually старый
image и more recent build failed silently как с registry. Verify
через image SHA + Cloud Build success log.

### Поведение Cloud Build pipeline

Working triggers (deduced from revision counts):
- `cloudbuild-concrete.yaml` → concrete-agent
- `cloudbuild-registry.yaml` → rozpocet-registry-backend
- `cloudbuild-monolit.yaml` → Monolit-Planner
- `cloudbuild-portal.yaml` → stavagent-portal-backend
- `cloudbuild-mineru.yaml` → MinerU OCR
- `cloudbuild-urs.yaml` → URS Matcher

`paths` фильтры в trigger config'ах. Builds для других сервисов
auto-cancel когда соответствующие paths не trogались (we видели
"No changes in Monolit-Planner/ — cancelling build" earlier).

### Open PRs состояние

Через `gh pr list --state open` найди все open PRs. Особенно:
- **PR #1190 (YAML)** — feat(kb_loader): YAML support. Merged ready, ждёт review (1 approval blocker)
- **PR #1185 already merged**, но incomplete
- Любые draft / WIP PRs которые stale

### Recent merges на main (last 48h)

```
f65e26aa Claude/mcp dynamic client registration (#1189)
3160e249 feat(uep): PR2 — reconciliation + derivation + REST (#1186)
e18fc7f5 Claude/rd jachymov phase 0b foundation (#1187)
e80f8528 fix(security): isolation hotfix — remove owner_id=1 + add requireAuth + E2E tests (#1185)
```

Каждый mergedь — проверь deployed ли actually в production:
- 1185 → rozpocet-registry-backend (failed deploy, см. выше)
- 1186 (UEP) → concrete-agent (статус unknown)
- 1187 → возможно другой сервис, deduce из changes
- 1189 (DCR) → concrete-agent (partial — code may be there, migrations issue)

## БИЗНЕС-ЗАДАЧА — три linked fixes

### Fix A: rozpocet-registry-backend PORT issue

Diagnose: смотри server entrypoint. Скорее всего что-то типа:
```javascript
app.listen(8080, ...)  // hardcoded
```

Должно быть:
```javascript
const PORT = process.env.PORT || 8080;
app.listen(PORT, ...);
```

Или эквивалентно. Apply fix. Verify локально что server respect'ит
PORT env var.

Аналогично проверить **все** Node.js Cloud Run services (registry,
monolit, portal, urs-matcher) — если один сломан, возможно другие
тоже.

### Fix B: Read endpoint auth in rozpocet-registry-backend

PR #1185 закрыл write endpoints. Расширить same `requireAuth`
middleware на ALL endpoints returning user-scoped data (mainly
GETs):

- `GET /api/registry/projects` → require auth + filter by req.user.userId
- `GET /api/registry/projects/:id` → require auth + verify project.owner_id == req.user.userId
- `GET /api/registry/projects/:id/sheets` → same ownership check
- `GET /api/registry/sheets/:id/items` → resolve sheet → project → owner check
- Any other user-scoped GET endpoints

Public endpoints (если есть, типа /health, /metrics) — НЕ trogать.
Verify через explicit allowlist в коде.

### Fix C: DCR migrations / image discrepancy

Diagnose почему revision 00364-tnm shows "6 migrations checked"
вместо 9 на startup.

Possible causes (smerga):
1. Image на 00364 не actually contains DCR code (despite ACTIVE label)
   — verify через `docker pull` + `docker run --rm IMAGE ls /app/migrations/`
2. Migrations files в repo, COPY copies them, но startup_migrations
   не glob's в правильной path. Verify `Path("/app/migrations")` vs
   `Path("/app/app/migrations")` или similar.
3. `_schema_migrations` table уже имеет markers для 009/010/011 от
   failed previous attempt, но actual tables не created. Run psql
   manual check.

Apply fix. Verify через redeploy + curl на /register endpoint.

## ACCEPTANCE CRITERIA

После всех fixes:

1. **Read endpoint test**: `curl -i {REGISTRY_URL}/api/registry/projects`
   без auth → 401 (НЕ 200 с данными)
2. **Read endpoint with auth**: с valid JWT → 200 + projects filtered
   by owner_id == JWT.userId
3. **All currently failing revisions deploy successfully**: latest
   revisions ACTIVE для rozpocet-registry-backend (после fix A)
4. **DCR endpoint works**: `curl -X POST {CONCRETE_URL}/api/v1/mcp/oauth/register
   {payload}` → 201 + dcr-/dcs- credentials
5. **Migrations applied**: production startup logs show
   `[startup-migrations] schema up to date (9 migration(s) checked)`
   not 6
6. **Frontend NOT broken**: `https://registry.stavagent.cz/` continues
   to work for authenticated users
7. **No IAM blocks**: solution doesn't use Cloud Run IAM removal —
   fix at code level

## PRE-IMPLEMENTATION INTERVIEW (4 вопроса)

Задавай по одному, жди ответа.

**Q1.** rozpocet-registry-backend stack — Node.js / Express?
Where is `app.listen()` или equivalent? И где env config reading?
Если в `process.env.PORT` уже — почему PORT=3002 timeout? Show
me the startup file.

**Q2.** PR #1185 changes — какие конкретно routes теперь под
`requireAuth`? Покажи diff `git diff main~5 main -- rozpocet-registry-backend/`
или equivalent. Я хочу убедиться что мы expanding existing pattern,
не дублируя.

**Q3.** concrete-agent image на revision 00364 — actually has DCR
code? Three ways verify:
  (a) `docker pull europe-west3-docker.pkg.dev/.../concrete-agent@sha256:afea...`
      + inspect `/app/` content
  (b) `gcloud builds log {build_id}` для 1314d426 — посмотри что
      реально build'ил
  (c) Compare commit hash в image labels vs current main HEAD

**Q4.** Scope — один PR который fixes A+B+C atomically? Или 2-3
separate PRs (A на registry repo, B на registry repo, C на
concrete-agent repo)? Учитывая что они в разных репо/директориях,
вероятно 2 PRs. Подтверди.

После 4 ответов → начинаешь работу. Gate-based pattern:
- Gate 1: diagnose PORT issue + apply Fix A
- Gate 2: read endpoint auth + apply Fix B
- Gate 3: DCR migrations debug + apply Fix C
- Gate 4: verify all 3 fixes deployed (via gcloud + curl)
- Gate 5: smoke test claude.ai connector

## ЧТО НЕ ВХОДИТ

- Не trogai YAML PR #1190 — отдельная задача после A/B/C
- Не trogai UEP PR2 #1186 — он deploys correctly (concrete-agent has
  11 tools confirmed)
- Не add'ить новые features
- Не делать architecture refactor
- Не trogать Cloud Build trigger config (path filters работают
  correctly per "No changes" cancellation behavior)
- Не использовать `gcloud run services remove-iam-policy-binding`
  — это explicit anti-goal per user

## NAMING RULE

Файлы, routes, middleware names — по существующим конвенциям в
каждом repo. Registry backend в Node.js — следуй его patterns.
concrete-agent в Python — следуй его patterns. Если в registry есть
`requireAuth` middleware (Express) — переиспользуй, не создавай
`authMiddleware` рядом.
