# NEXT SESSION — 2026-03-16 (Session 13 Complete)

## Краткое резюме Session 13 (2026-03-16)

**Ветка:** `claude/implement-cabinets-feature-Vd0ma`
**Коммиты:** `3fea990` → `fd8f2f7` (19 коммитов)
**Тип:** Feature (Sprint 1) + Infrastructure Fixes

---

### Что сделано

#### Sprint 1: Cabinets + Roles — ПОЛНОСТЬЮ РЕАЛИЗОВАН ✅

**Backend (`stavagent-portal/backend`):**

| Файл | Что сделано |
|------|-------------|
| `src/db/schema-postgres.sql` | 6 новых ALTER/CREATE: phone/company/avatar_url/org_id в users, organizations, org_members, индексы |
| `src/middleware/orgRole.js` | Middleware проверки роли в org_members для любого org-scope маршрута |
| `src/routes/cabinet.js` | `GET /api/cabinet/stats` — статистика проектов, файлов, членства в орг |
| `src/routes/orgs.js` | 12 endpoints: CRUD орг, invite по email, список членов, смена роли, удаление |
| `src/routes/auth.js` | `PATCH /api/auth/me` — обновление профиля (name, phone, company, timezone, preferences) |
| `backend/server.js` | Регистрация `/api/cabinet` и `/api/orgs` роутеров |

**Frontend (`stavagent-portal/frontend`):**

| Файл | Что сделано |
|------|-------------|
| `src/pages/CabinetPage.tsx` | `/cabinet` — CabinetStats + ProfileForm |
| `src/pages/CabinetOrgsPage.tsx` | `/cabinet/orgs` — список орг + OrgCreate |
| `src/pages/OrgPage.tsx` | `/org/:id` — детали орг + OrgMembersList + OrgInviteForm |
| `src/pages/OrgInvitePage.tsx` | `/org/accept-invite?token=...` — принять приглашение |
| `src/components/cabinet/CabinetLayout.tsx` | Sidebar: Přehled / Organizace / Platby / Zabezpečení |
| `src/components/cabinet/CabinetStats.tsx` | Карточки: проекты / файлы / организации |
| `src/components/cabinet/ProfileForm.tsx` | Форма обновления профиля |
| `src/components/org/OrgCard.tsx` | Карточка организации с ролью |
| `src/components/org/OrgCreate.tsx` | Форма создания организации |
| `src/components/org/OrgMembersList.tsx` | Список членов + смена роли + удаление |
| `src/components/org/OrgInviteForm.tsx` | Форма приглашения по email + выбор роли |
| `src/components/org/OrgRoleBadge.tsx` | Бейдж роли (admin/manager/estimator/viewer/api_client) |
| `src/types/org.ts` | TypeScript типы: Organization, OrgMember, OrgRole |
| `src/App.tsx` | Роуты /cabinet, /cabinet/orgs, /org/:id, /org/accept-invite |

**5 ролей реализованы:**
```
admin      — полный контроль, удаление орг
manager    — управление проектами, приглашения (кроме admin)
estimator  — создание проектов, загрузка файлов, AI
viewer     — только просмотр
api_client — API-доступ с ключами
```

#### Инфраструктурные фиксы (Cloud Run / GCP)

| Коммит | Фикс |
|--------|------|
| `3601fb8` | Sprint 1 SQL: VARCHAR+CHECK вместо ENUM, совместимость с semicolon splitter |
| `48e29fb` | Conditional SSL: off для Cloud SQL unix socket, on для remote PG |
| `4fbd98b` | package-lock.json sync |
| `80904d5` | CLOUD_LOGGING_ONLY в Cloud Build |
| `3fea990` | Sprint 1 Backend |
| `28c6784` | Sprint 1 Frontend |
| `194e1fa` | position_instances / position_templates таблицы добавлены в schema |
| `1cf902c` | SSL полностью отключён для Cloud Run |
| `4418e88` | Cloud Build approval gate отключён |
| `6c2a3c6` | Критические баги DB интерфейса (Monolit + Portal) |
| `663278a` | DISABLE_AUTH=true в Portal Cloud Run |
| `2aa6b48` | positions.test.js под актуальный bulk API |
| `4218edd` | _FORCE_DEPLOY substitution в guard steps |
| `87e6a97` | --remove-env-vars конфликт убран |
| `84b6709` | Vertex AI Gemini + Vertex AI Search → PassportEnricher |
| `6487670` | 3 review issues в Vertex AI |
| `b405ee9` | SmartParser project_id kwarg + ParsePreviewModal byType |
| `56b675d` | Robust DATABASE_URL parsing (ERR_INVALID_URL) |
| `fd8f2f7` | .trim() для DATABASE_URL в portal + monolit |

#### Secret Manager
- `PORTAL_DATABASE_URL` обновлён до **version 4** (format с `?host=/cloudsql/...`)
- Portal Backend задеплоен revision `stavagent-portal-backend-00049-fd7`

---

## Состояние сервисов (на 2026-03-16)

| Сервис | Cloud Run URL | Статус |
|--------|---------------|--------|
| concrete-agent | https://concrete-agent-1086027517695.europe-west3.run.app | ✅ Работает |
| stavagent-portal backend | https://stavagent-portal-backend-1086027517695.europe-west3.run.app | ✅ Задеплоен (revision 00049) |
| stavagent-portal frontend | https://www.stavagent.cz | ✅ Работает |
| Monolit-Planner | https://monolit-planner-api-1086027517695.europe-west3.run.app | ✅ Работает |
| URS_MATCHER_SERVICE | https://urs-matcher-service-1086027517695.europe-west3.run.app | ✅ Работает |
| rozpocet-registry | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app | ✅ Работает |

---

## С чего начать Session 14

### Приоритет 1: Проверить что Portal работает корректно

```bash
# Проверить health
curl https://stavagent-portal-backend-1086027517695.europe-west3.run.app/health

# Проверить cabinet stats (потребует JWT токен)
curl -H "Authorization: Bearer <token>" \
  https://stavagent-portal-backend-1086027517695.europe-west3.run.app/api/cabinet/stats

# Проверить список орг
curl -H "Authorization: Bearer <token>" \
  https://stavagent-portal-backend-1086027517695.europe-west3.run.app/api/orgs
```

Если получаем ошибки БД → проверить Cloud SQL logs в GCP Console.

### Приоритет 2: Sprint 2 — Service Connections + AI Models

**Ветка:** создай `claude/sprint2-connections-<random5chars>`

**Что нужно реализовать:**

```
backend/src/services/encryptionService.js   ← AES-256-GCM (MASTER_ENCRYPTION_KEY)
backend/src/routes/connections.js           ← 8 endpoints
backend/src/db/schema-postgres.sql          ← service_connections таблица (migration 003)
frontend/src/pages/ConnectionsPage.tsx
frontend/src/components/connections/ConnectionCard.tsx
frontend/src/components/connections/ConnectionForm.tsx
frontend/src/components/connections/ConnectionTestButton.tsx
frontend/src/components/connections/ModelConfigPanel.tsx
frontend/src/components/connections/KioskTogglePanel.tsx
frontend/src/types/connection.ts
```

**Порядок работы:**
1. Прочитай `PLAN_CABINETS_ROLES_BILLING.md` раздел "Sprint 2" и "Migration 003"
2. Прочитай `stavagent-portal/backend/src/db/schema-postgres.sql` — текущий вид схемы
3. Добавь migration 003 (service_connections) в schema-postgres.sql
4. Реализуй `encryptionService.js` (AES-256-GCM, AAD = connection.id)
5. Реализуй `connections.js` router (8 endpoints из плана)
6. Реализуй frontend компоненты
7. Зарегистрируй маршруты в `backend/server.js` + роуты в `frontend/src/App.tsx`

**Нужна env переменная перед деплоем:**
```bash
# Сгенерировать и добавить в GCP Secret Manager:
openssl rand -hex 32
# → gcloud secrets create MASTER_ENCRYPTION_KEY --data-file=-
```

### Приоритет 3 (если Sprint 2 завершён): Sprint 3 — Billing

**Ветка:** `claude/sprint3-billing-<random5chars>`

Подождать пока пользователь создаст Stripe аккаунт и продукты.
Подробности — в `PLAN_CABINETS_ROLES_BILLING.md` раздел "Sprint 3".

---

## Команда для быстрого старта

```
Прочитай CLAUDE.md и NEXT_SESSION.md. Сегодня реализуем Sprint 2 из плана PLAN_CABINETS_ROLES_BILLING.md.

Sprint 1 (Cabinets + Roles) уже полностью готов и задеплоен.

Ветка: создай claude/sprint2-connections-<random5chars>

Начни с:
1. PLAN_CABINETS_ROLES_BILLING.md — раздел Sprint 2 и Migration 003
2. stavagent-portal/backend/src/db/schema-postgres.sql — посмотри текущее состояние
3. stavagent-portal/backend/src/routes/orgs.js — паттерн для нового роутера
4. stavagent-portal/backend/src/middleware/orgRole.js — уже есть, использовать как есть

Порядок реализации:
Backend: schema migration 003 → encryptionService.js → connections.js router → регистрация в server.js
Frontend: connection.ts типы → ConnectionForm → ConnectionCard → ConnectionTestButton → ModelConfigPanel → KioskTogglePanel → ConnectionsPage → App.tsx роут /cabinet/connections
```

---

## Pending Actions (ожидают действий пользователя)

| Действие | Срочность | Описание |
|----------|-----------|----------|
| Добавить MASTER_ENCRYPTION_KEY в Secret Manager | 🔴 Нужно для Sprint 2 | `openssl rand -hex 32` → Secret Manager |
| Создать Stripe аккаунт + продукты | 🟡 Нужно для Sprint 3 | 4 плана (Free/Starter/Professional/Enterprise) |
| Создать GCS bucket | 🟡 Нужно для Sprint 4 | `gs://stavagent-prod-files` в europe-west3 |
| SQL: Включить FF_AI_DAYS_SUGGEST | 🟢 Удобная фича | `Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql` в Cloud SQL |
| Добавить PERPLEXITY_API_KEY | 🟢 Опционально | Улучшает Poradna norem в Monolit |
