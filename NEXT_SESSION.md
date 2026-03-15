# NEXT SESSION — 2026-03-15 (Session 13 Complete)

## Краткое резюме Session 13 (2026-03-15)

**Ветка:** `claude/cabinets-roles-sprint1-BEa5m`
**Тип:** Infrastructure — Render → Google Cloud Run migration

### Что сделано

**Полная миграция на Google Cloud Run (europe-west3):**
- Все 5 бэкендов задеплоены и работают на Cloud Run
- Cloud SQL PostgreSQL 15 подключён (3 базы: portal, monolit, registry)
- SSL отключён для Cloud SQL Unix socket соединений
- Cloud Build CI/CD: 5 триггеров настроены для авто-деплоя при мерже в main

**Статус сервисов (все healthy):**

| Сервис | URL | DB |
|--------|-----|-----|
| concrete-agent | https://concrete-agent-1086027517695.europe-west3.run.app | — |
| stavagent-portal | https://stavagent-portal-backend-1086027517695.europe-west3.run.app | connected |
| monolit-planner | https://monolit-planner-api-1086027517695.europe-west3.run.app | connected |
| urs-matcher | https://urs-matcher-service-1086027517695.europe-west3.run.app | connected |
| rozpocet-registry | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app | connected |

### CI/CD — Авто-деплой при мерже

После мержа PR в `main`, Cloud Build автоматически деплоит **только изменённые сервисы**:

```
Push to main → Cloud Build trigger → Guard (check path filter) → Docker build → Push to AR → Cloud Run deploy
```

| Сервис | Path Filter | Trigger |
|--------|-------------|---------|
| concrete-agent | `concrete-agent/**` | cloudbuild-concrete.yaml |
| Monolit-Planner | `Monolit-Planner/**` | cloudbuild-monolit.yaml |
| stavagent-portal | `stavagent-portal/**` | cloudbuild-portal.yaml |
| URS_MATCHER_SERVICE | `URS_MATCHER_SERVICE/**` | cloudbuild-urs.yaml |
| rozpocet-registry-backend | `rozpocet-registry-backend/**` | cloudbuild-registry.yaml |

**Фронтенды** деплоятся через Vercel (GitHub интеграция, автоматически при push).

**ВАЖНО:** Триггеры нужно импортировать один раз:
```bash
for f in triggers/*.yaml; do gcloud builds triggers import --source=$f; done
```

---

## Следующий шаг: Sprint 1 — Cabinets + Roles

План: `/PLAN_CABINETS_ROLES_BILLING.md`

---

## Команда для начала следующей сессии

```
Прочитай CLAUDE.md и NEXT_SESSION.md.

Контекст: Миграция на Google Cloud Run завершена (Session 13). Все 5 сервисов работают.
CI/CD: Cloud Build авто-деплоит при мерже в main.

Начинаем реализацию Sprint 1 из PLAN_CABINETS_ROLES_BILLING.md: Cabinets + Roles.

Ветка: создай новую ветку claude/cabinets-roles-sprint1-<random5chars>

Порядок работы:
1. Прочитай PLAN_CABINETS_ROLES_BILLING.md полностью (Sprint 1 секция)
2. Прочитай stavagent-portal/backend/src/db/schema-postgres.sql (текущая схема)
3. Прочитай stavagent-portal/backend/src/middleware/adminOnly.js (паттерн для orgRole.js)
4. Прочитай stavagent-portal/backend/src/routes/auth.js (добавим PATCH /api/auth/me)
5. Прочитай stavagent-portal/backend/src/server.js (регистрация маршрутов)
6. Прочитай stavagent-portal/frontend/src/context/AuthContext.tsx (расширим User)
7. Прочитай stavagent-portal/frontend/src/App.tsx (добавим роуты /cabinet, /org/:id)

Затем реализуй Sprint 1 по чеклисту из плана:
Backend: SQL миграции (001_extend_users + 002_organizations), middleware/orgRole.js, routes/cabinet.js, routes/orgs.js, PATCH /api/auth/me
Frontend: CabinetPage, OrgPage, OrgInvitePage, компоненты cabinet/ и org/

После каждого логического блока коммить и пушить.
После завершения — создай PR в main. CI/CD автоматически задеплоит portal при мерже.
```

---

## Статус сервисов (на 2026-03-15)

| Сервис | Статус | Platform | Последнее изменение |
|--------|--------|----------|---------------------|
| concrete-agent | ✅ Healthy | Cloud Run | Session 13 (deployed) |
| stavagent-portal | ✅ Healthy | Cloud Run | Session 13 (deployed) |
| Monolit-Planner | ✅ Healthy | Cloud Run | Session 13 (deployed) |
| URS_MATCHER_SERVICE | ✅ Healthy | Cloud Run | Session 13 (deployed) |
| rozpocet-registry-backend | ✅ Healthy + DB | Cloud Run | Session 13 (SSL fix deployed) |

## Backlog (не в Sprint 1)

- Cloud Build Triggers import (если ещё не сделано): `gcloud builds triggers import --source=triggers/*.yaml`
- MASTER_ENCRYPTION_KEY для Sprint 2 (Service Connections): `openssl rand -hex 32`
- Stripe аккаунт для Sprint 3 (Billing)
- GCS bucket для Sprint 4 (Object Storage)
- Keep-Alive `KEEP_ALIVE_KEY` в GitHub + Cloud Run secrets
- React Error Boundaries
- Node.js 18 → 20 upgrade
