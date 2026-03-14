# NEXT SESSION — 2026-03-14 (Session 12 Complete)

## Краткое резюме Session 12 (2026-03-14)

**Ветка:** `claude/deploy-agent-portal-pHm5K`
**Коммит:** `434dcb8`
**Тип:** Планирование (только документация, код не изменялся)

### Что сделано

Создан файл `/PLAN_CABINETS_ROLES_BILLING.md` — полный план 4-спринтовой трансформации
Portal из single-tenant кальkulяtора в multi-tenant SaaS-платформу.

**Содержание плана:**

| Спринт | Что | Объём |
|--------|-----|-------|
| Sprint 1 | Organizations + 5 ролей + /cabinet | ~15 файлов |
| Sprint 2 | Service Connections (зашифрованные AI ключи) + model routing | ~8 файлов |
| Sprint 3 | Stripe Billing (4 тарифа) + usage metering + webhooks | ~10 файлов |
| Sprint 4 | GCS/S3 presigned URLs + async task queue + BYOS | ~15 файлов |

**6 SQL-миграций:**
- `001_extend_users.sql` — phone, company, avatar_url, org_id
- `002_organizations.sql` — organizations + org_members (5 ролей)
- `003_service_connections.sql` — зашифрованные API ключи AES-256-GCM
- `004_billing.sql` — subscriptions + usage_events + usage_monthly
- `005_task_queue.sql` — async task queue
- `006_storage_uris.sql` — storage_uri, content_hash в portal_files

---

## Что нужно сделать ВРУЧНУЮ перед началом Sprint 1

### 1. Render PostgreSQL — генерация MASTER_ENCRYPTION_KEY

На локальной машине или в терминале:
```bash
openssl rand -hex 32
# Пример: a3f8c2d1e4b5...64chars
```
→ Добавить в Render Dashboard → Portal Backend → Environment:
```
MASTER_ENCRYPTION_KEY=<64-char hex>
```

### 2. Stripe — создать аккаунт и продукты

1. Зайти на https://dashboard.stripe.com
2. Создать 4 продукта: Starter, Professional (+ годовые варианты)
3. Получить price_id для каждого → добавить в Render:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...         ← получить ПОСЛЕ деплоя webhook
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_...
```

### 3. Google Cloud Storage — создать bucket (Sprint 4)

```bash
# Через gcloud CLI или Google Cloud Console
gcloud storage buckets create gs://stavagent-prod-files \
  --location=europe-west3 \
  --uniform-bucket-level-access

# Создать Service Account
gcloud iam service-accounts create stavagent-portal-storage \
  --display-name="StavAgent Portal Storage"

# Выдать права
gcloud storage buckets add-iam-policy-binding gs://stavagent-prod-files \
  --member="serviceAccount:stavagent-portal-storage@PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Скачать JSON ключ → загрузить в Render как Secret File
```

→ В Render env добавить:
```
GCS_BUCKET=stavagent-prod-files
GCS_PROJECT_ID=<gcp-project-id>
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcs-key.json
```

### 4. Stripe Webhook URL — после деплоя Sprint 3

В Stripe Dashboard → Developers → Webhooks → Add endpoint:
```
URL: https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app/api/webhooks/stripe
Events:
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_failed
  - invoice.payment_succeeded
```
→ Скопировать `whsec_...` → добавить в Render как `STRIPE_WEBHOOK_SECRET`

---

## Команда для начала новой сессии

```
Прочитай CLAUDE.md и NEXT_SESSION.md. Начинаем реализацию PLAN_CABINETS_ROLES_BILLING.md.

Старт с Sprint 1: Cabinets + Roles.

Ветка: создай новую ветку claude/cabinets-roles-<random5chars>

Порядок работы:
1. Прочитай PLAN_CABINETS_ROLES_BILLING.md полностью
2. Прочитай stavagent-portal/backend/src/db/schema-postgres.sql (текущая схема)
3. Прочитай stavagent-portal/backend/src/middleware/adminOnly.js (паттерн для orgRole.js)
4. Прочитай stavagent-portal/backend/src/routes/auth.js (добавим PATCH /api/auth/me)
5. Прочитай stavagent-portal/backend/src/server.js (регистрация маршрутов)
6. Прочитай stavagent-portal/frontend/src/context/AuthContext.tsx (расширим User)
7. Прочитай stavagent-portal/frontend/src/App.tsx (добавим роуты /cabinet, /org/:id)

Затем реализуй Sprint 1 по чеклисту из плана:
Backend: middleware/orgRole.js, routes/cabinet.js, routes/orgs.js, PATCH /api/auth/me
Frontend: CabinetPage, OrgPage, OrgInvitePage, компоненты cabinet/ и org/

После каждого логического блока коммить и пушить.
```

---

## Статус сервисов (на 2026-03-14)

| Сервис | Статус | Последнее изменение |
|--------|--------|---------------------|
| concrete-agent | ✅ Работает | Session 11 (2026-03-13) |
| stavagent-portal | ✅ Работает | Session 12 — только план |
| Monolit-Planner | ✅ Работает | Session 11 |
| URS_MATCHER_SERVICE | ✅ Работает | Session 10a |
| rozpocet-registry | ✅ Работает | Session 10a |

## Backlog (не в этом плане)

- GCR permissions для Cloud Build (нужен AR repo: `gcloud artifacts repositories create`)
- Keep-Alive `KEEP_ALIVE_KEY` в GitHub + Render secrets
- React Error Boundaries
- Node.js 18 → 20 upgrade
