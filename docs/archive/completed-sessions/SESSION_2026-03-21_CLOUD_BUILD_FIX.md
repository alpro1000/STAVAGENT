# SESSION 2026-03-21 — Cloud Build FAILED_PRECONDITION Fix

**Date:** 2026-03-21
**Branch:** `claude/setup-cloud-build-Sx7sj`
**Scope:** Infrastructure (Cloud Build, GCP setup)

---

## Цель сессии

Исправить ошибку Cloud Build `FAILED_PRECONDITION` (status code 9) при `CreateBuild`.
Audit log показал, что Cloud Build SA (`1086027517695@cloudbuild.gserviceaccount.com`) имеет разрешение `cloudbuild.builds.create`, но сборка не запускается.

---

## Коммиты сессии

| Хэш | Сообщение |
|-----|-----------|
| `6866e83` | FIX: resolve Cloud Build FAILED_PRECONDITION errors |

---

## Выявленные проблемы и исправления

### 1. Отсутствующий `cloudbuild.yaml` (deploy-all)
- `gcp/setup-gcp.sh` ссылался на `cloudbuild.yaml` для триггера deploy-all, но файл не существовал
- **Создан** `cloudbuild.yaml` — полная конфигурация для сборки и деплоя всех 5 сервисов

### 2. Несоответствие имён секретов
- `cloudbuild-concrete.yaml` ссылался на `PERPLEXITY_API_KEY` в Secret Manager
- `setup-gcp.sh` создавал только `PPLX_API_KEY`
- **Исправлено:** `PERPLEXITY_API_KEY=PPLX_API_KEY:latest` в cloudbuild-concrete.yaml

### 3. Отсутствие `location` в триггерах
- Все 5 триггеров (`triggers/*.yaml`) не указывали `location: europe-west3`
- Без location Cloud Build пытается использовать глобальный регион, который не совпадает с Artifact Registry
- **Исправлено:** добавлен `location: europe-west3` во все триггеры

### 4. Отсутствие `serviceAccount` в триггерах
- Триггеры не указывали явно SA, что вызывает проблемы с permissions
- **Исправлено:** добавлен `serviceAccount` во все триггеры

### 5. Недостающие API в `setup-gcp.sh`
- `logging.googleapis.com` — необходим для `CLOUD_LOGGING_ONLY` в options
- `aiplatform.googleapis.com` — необходим для Vertex AI
- `iam.googleapis.com` — необходим для IAM bindings
- **Исправлено:** добавлены в список API

### 6. Недостающие секреты в `setup-gcp.sh`
- `CONCRETE_DATABASE_URL` — asyncpg формат для Python concrete-agent
- `SERVICE_TOKEN` — для межсервисной аутентификации
- `PERPLEXITY_API_KEY` — алиас для concrete-agent
- **Исправлено:** добавлено создание секретов

### 7. Недостающие IAM bindings
- `roles/logging.logWriter` для Cloud Build SA
- `roles/aiplatform.user` для Compute SA (Cloud Run)
- **Исправлено:** добавлены IAM bindings

---

## Изменённые файлы

| Файл | Тип изменения |
|------|---------------|
| `cloudbuild.yaml` | **Создан** — deploy-all конфигурация |
| `cloudbuild-concrete.yaml` | Исправлен маппинг секрета PERPLEXITY_API_KEY |
| `gcp/setup-gcp.sh` | Добавлены API, секреты, IAM bindings |
| `triggers/concrete-agent.yaml` | Добавлены location + serviceAccount |
| `triggers/portal.yaml` | Добавлены location + serviceAccount |
| `triggers/monolit.yaml` | Добавлены location + serviceAccount |
| `triggers/urs.yaml` | Добавлены location + serviceAccount |
| `triggers/registry.yaml` | Добавлены location + serviceAccount |
| `triggers/deploy-all.yaml` | **Создан** — триггер для deploy-all (manual, approval required) |

---

## Действия после мержа

Деплой выполнен пользователем (setup-gcp.sh + импорт триггеров). Cloud Build триггеры активны.

---

## Статус

- [x] Диагностика FAILED_PRECONDITION
- [x] Исправление конфигурации
- [x] Коммит и push
- [x] Деплой выполнен (setup-gcp.sh + импорт триггеров)
