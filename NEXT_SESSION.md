# NEXT SESSION — 2026-03-16 (Session 14 Complete)

## Краткое резюме Session 14 (2026-03-16)

**Ветка:** `claude/sprint2-connections-ZJ1IU`
**Коммиты:** `f1c23c4` → `4a23614` (5 коммитов)
**Тип:** Production Bug-Fix Sprint + Infrastructure

---

### Что сделано

#### 1. Portal: integration.js — "current transaction is aborted" ✅

**Причина:** `portal_positions` не имела колонок `registry_item_id`, `tov_labor`, `tov_machinery`, `tov_materials`, `last_sync_from`, `last_sync_at`, `monolit_position_id`. Запрос `INSERT INTO portal_positions (...registry_item_id...)` падал с "column does not exist", отравляя всю транзакцию.

**Файлы:**
- `stavagent-portal/backend/src/db/schema-postgres.sql` — добавлена **Migration 005** (7 ALTER TABLE + индекс)
- `stavagent-portal/backend/src/routes/integration.js` — добавлена column detection с ROLLBACK+BEGIN reset, fallback INSERT без расширенных колонок

**Паттерн column detection:**
```javascript
let hasRegistrySyncColumns = true;
try {
  await client.query('SELECT registry_item_id, tov_labor FROM portal_positions LIMIT 0');
} catch (colErr) {
  if (colErr.message && colErr.message.includes('column')) {
    hasRegistrySyncColumns = false;
    await client.query('ROLLBACK');
    await client.query('BEGIN'); // reset poisoned tx
  } else throw colErr;
}
```

#### 2. Monolit: "permission denied for table monolith_projects" ✅

**Причина:** Cloud SQL секреты использовали юзера `postgres`, у которого `cloudsqlsuperuser` (не SUPERUSER) — не может писать в таблицы, созданные другими юзерами.

**Исправление:** Обновлены все 4 секрета в Secret Manager с правильными владельцами:
```
MONOLIT_DATABASE_URL  → monolit_user:BHubk66f49cZTVL86dni
PORTAL_DATABASE_URL   → stavagent_portal:BHubk66f49cZTVL86dni
CONCRETE_DATABASE_URL → stavagent_portal:BHubk66f49cZTVL86dni
REGISTRY_DATABASE_URL → registry_user:BHubk66f49cZTVL86dni
```

Все пароли стандартизированы: `BHubk66f49cZTVL86dni` для всех 4 юзеров.
Все 4 сервиса перезапущены через `gcloud run services update --update-env-vars=REDEPLOY=$(date +%s)`.

#### 3. Registry bulk items: CWE-209 security fix ✅

- `rozpocet-registry-backend/server.js` — убран `error.detail` из ответа (утечка деталей БД клиенту)
- Детали остаются в серверных логах (`console.error`)

#### 4. Force deploy trigger ✅

Добавлены `.deploy-trigger` файлы в `stavagent-portal/`, `URS_MATCHER_SERVICE/`, `Monolit-Planner/` чтобы Cloud Build guard step детектировал изменения при следующем merge в `main`.

---

### Понимание архитектуры portal_positions (ключевое)

`portal_positions` — кросс-кiosk аккумулятор данных:
- `tov_labor/machinery/materials` — TOV декомпозиция из Monolit (профессии, машины, материалы)
- `registry_item_id` — привязка к конкретной строке в rozpocet-registry
- `monolit_position_id` — привязка к конкретной позиции в Monolit

Это позволяет Portal показывать консолидированные данные по позиции из обоих kiosk.

---

## Состояние сервисов (на 2026-03-16, после Session 14)

| Сервис | Cloud Run URL | Статус | Примечание |
|--------|---------------|--------|------------|
| concrete-agent | https://concrete-agent-1086027517695.europe-west3.run.app | ✅ Работает | — |
| stavagent-portal backend | https://stavagent-portal-backend-1086027517695.europe-west3.run.app | ⏳ Ожидает деплоя | Migration 005 ещё не задеплоена — нужно смерджить PR |
| stavagent-portal frontend | https://www.stavagent.cz | ✅ Работает | — |
| Monolit-Planner | https://monolit-planner-api-1086027517695.europe-west3.run.app | ✅ Работает | Секреты исправлены |
| URS_MATCHER_SERVICE | https://urs-matcher-service-1086027517695.europe-west3.run.app | ⏳ Ожидает деплоя | Gemini key fix нужен деплой |
| rozpocet-registry-backend | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app | ⏳ Ожидает деплоя | CWE-209 fix нужен деплой |

---

## С чего начать Session 15

### Шаг 0: Смерджить PR (ОБЯЗАТЕЛЬНО ПЕРВЫМ ДЕЛОМ)

```
Открыть GitHub → Pull Requests → ветка claude/sprint2-connections-ZJ1IU
Смерджить в main
```

После merge Cloud Build автоматически задеплоит все 4 сервиса (trigger файлы обеспечат это).

**Проверить деплой:**
```bash
# Проверить что Portal отвечает с новой Migration 005
curl https://stavagent-portal-backend-1086027517695.europe-west3.run.app/health

# Проверить что import-from-registry работает (раньше давал 500)
# Открыть Monolit → KioskLinksPanel → "Import to Registry" кнопка
```

### Шаг 1: Sprint 2 — Service Connections

**Что нужно реализовать:**

```
stavagent-portal/backend/src/services/encryptionService.js   ← AES-256-GCM
stavagent-portal/backend/src/routes/connections.js           ← 8 endpoints
stavagent-portal/backend/src/db/schema-postgres.sql          ← Migration 006: service_connections
stavagent-portal/frontend/src/pages/ConnectionsPage.tsx
stavagent-portal/frontend/src/components/connections/ConnectionCard.tsx
stavagent-portal/frontend/src/components/connections/ConnectionForm.tsx
stavagent-portal/frontend/src/components/connections/ConnectionTestButton.tsx
stavagent-portal/frontend/src/components/connections/ModelConfigPanel.tsx
stavagent-portal/frontend/src/components/connections/KioskTogglePanel.tsx
stavagent-portal/frontend/src/types/connection.ts
```

**Порядок работы:**
1. Прочитай `PLAN_CABINETS_ROLES_BILLING.md` раздел "Sprint 2" и "Migration 003"
2. Прочитай `stavagent-portal/backend/src/db/schema-postgres.sql` — увидишь Migration 005 (новейшая)
3. Добавь Migration 006 (service_connections) — нумерация следует за 005
4. Реализуй `encryptionService.js` (AES-256-GCM, AAD = connection.id)
5. Реализуй `connections.js` router (8 endpoints из плана)
6. Реализуй frontend компоненты
7. Зарегистрируй маршруты в `backend/server.js` + роуты в `frontend/src/App.tsx`

**Нужна env переменная:**
```bash
# Если ещё не создан — добавить в GCP Secret Manager:
openssl rand -hex 32
# → gcloud secrets create MASTER_ENCRYPTION_KEY --data-file=-
# → В cloudbuild-portal.yaml добавить: --update-secrets=...MASTER_ENCRYPTION_KEY=MASTER_ENCRYPTION_KEY:latest
```

### Шаг 2 (если Sprint 2 завершён): Sprint 3 — Billing

Подождать пока пользователь создаст Stripe аккаунт + продукты.
Подробности — в `PLAN_CABINETS_ROLES_BILLING.md` раздел "Sprint 3".

---

## Cloud SQL — Правильные юзеры (ВАЖНО!)

```
База данных        │ Юзер               │ Пароль
───────────────────┼────────────────────┼────────────────────────
stavagent_portal   │ stavagent_portal   │ BHubk66f49cZTVL86dni
monolit_planner    │ monolit_user       │ BHubk66f49cZTVL86dni
rozpocet_registry  │ registry_user      │ BHubk66f49cZTVL86dni
```

Никогда не используй `postgres` юзера для приложений — у него нет прав на таблицы других владельцев!

---

## Pending Actions (ожидают действий пользователя)

| Действие | Срочность | Описание |
|----------|-----------|----------|
| **Смерджить PR** `claude/sprint2-connections-ZJ1IU` | 🔴 СРОЧНО | Задеплоит все исправления Session 14 |
| Добавить MASTER_ENCRYPTION_KEY в Secret Manager | 🔴 Нужно для Sprint 2 | `openssl rand -hex 32` → Secret Manager |
| Создать Stripe аккаунт + продукты | 🟡 Нужно для Sprint 3 | 4 плана (Free/Starter/Professional/Enterprise) |
| Создать GCS bucket | 🟡 Нужно для Sprint 4 | `gs://stavagent-prod-files` в europe-west3 |
| SQL: Включить FF_AI_DAYS_SUGGEST | 🟢 Удобная фича | `Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql` в Cloud SQL |
| Добавить PERPLEXITY_API_KEY | 🟢 Опционально | Улучшает Poradna norem в Monolit |

---

## Команда для быстрого старта Session 15

```
Прочитай CLAUDE.md и NEXT_SESSION.md.

СНАЧАЛА убедись что PR из ветки claude/sprint2-connections-ZJ1IU смерджен.

Сегодня реализуем Sprint 2 из плана PLAN_CABINETS_ROLES_BILLING.md.
Sprint 1 (Cabinets + Roles) готов и задеплоен.
Session 14 исправила production баги (portal tx abort, monolit permission denied, registry security).

Ветка: создай claude/sprint2-connections-<random5chars>

Начни с:
1. PLAN_CABINETS_ROLES_BILLING.md — раздел Sprint 2 и Migration 003
2. stavagent-portal/backend/src/db/schema-postgres.sql — посмотри Migration 005 (новейшая)
3. stavagent-portal/backend/src/routes/orgs.js — паттерн для нового роутера

Порядок реализации:
Backend: Migration 006 (service_connections) → encryptionService.js → connections.js → server.js
Frontend: connection.ts → ConnectionForm → ConnectionCard → ConnectionTestButton → ModelConfigPanel → KioskTogglePanel → ConnectionsPage → App.tsx /cabinet/connections
```
