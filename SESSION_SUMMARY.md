# Session Summary — 2026-03-12 (Session 10: Cloud Build CI/CD + Bug Fixes)

**Date:** 2026-03-12
**Branch:** `claude/cleanup-cors-duplicates-WOQfk`
**Status:** ✅ Completed (PRs #591–#597 merged)

---

## Что сделано

### 1. CORS / Backend URL fixes
- `FIX: Point registry PortalAutoSync to new Cloud Run backend` (PR #591)
- `FIX: Parse OTSKP codes with variant suffix letters (R42194B)` (PR #592-like)
- `FIX: Repair import-from-registry — duplicates, 500, and 429 errors` (PR #593)
- `FIX: Kiosk unlink 404, positions 429/column errors, rate limit increase` (PR #594)
- `FIX: OTSKP variant suffix regex in universalParser and rowClassificationService` (PR #595)

### 2. Cloud Build CI/CD (Google Cloud Run)
- **FEAT:** 4 отдельных `cloudbuild-*.yaml` для каждого сервиса с шагами build+push+deploy
  - `cloudbuild-portal.yaml`, `cloudbuild-monolit.yaml`, `cloudbuild-concrete.yaml`, `cloudbuild-urs.yaml`
- **FEAT:** Guard steps — пропускают сборку если нет изменений в нужном сервисе (`exit 1` при отсутствии diff)
- **FEAT:** Trigger YAML файлы в `triggers/` для ручного создания триггеров через gcloud CLI
- **FIX:** Убрана race condition в guard steps (cancel → exit 1) (PR #596)
- **FIX:** Add missing `getFileExtension` and `ALLOWED_FILE_EXTENSIONS` in DocumentSummary (PR #597)

---

## Проблема при деплое (текущий блокер)

```
denied: gcr.io repo does not exist. Creating on push requires the
artifactregistry.repositories.createOnPush permission
```

**Причина:** Сервисный аккаунт Cloud Build не имеет права создавать репозитории в Artifact Registry (GCR).

**Решение (нужно сделать вручную в GCP):**
```bash
# Вариант 1: Включить Container Registry API (старый gcr.io)
gcloud services enable containerregistry.googleapis.com --project=YOUR_PROJECT_ID

# Вариант 2: Переключиться на Artifact Registry (рекомендуется)
# Создать репозиторий вручную:
gcloud artifacts repositories create stavagent \
  --repository-format=docker \
  --location=europe-west3 \
  --project=YOUR_PROJECT_ID

# Затем поменять образ в cloudbuild файлах:
# gcr.io/$PROJECT_ID/... → europe-west3-docker.pkg.dev/$PROJECT_ID/stavagent/...
```

---

## Commits этой сессии

| Commit | Описание |
|--------|----------|
| `33905f2` | FIX: Add missing getFileExtension and ALLOWED_FILE_EXTENSIONS |
| `c803c19` | FIX: Remove cancel race condition in guard steps |
| `7de1796` | FIX: Add guard steps to cloudbuild files |
| `e5360c1` | FEAT: Add trigger YAML files for per-service triggers |
| `6a04be4` | FEAT: Complete individual cloudbuild yamls |
| `2d171a1` | FIX: OTSKP variant suffix regex |
| `f9daea3` | FIX: Kiosk unlink 404, 429, column errors |
| `13b718c` | FIX: import-from-registry duplicates/500/429 |
| `75e0d7c` | FIX: Point registry PortalAutoSync to Cloud Run |
| `29b136a` | FIX: Parse OTSKP codes with variant suffix |

---

## Структура Cloud Build файлов

```
STAVAGENT/
├── cloudbuild.yaml              ← Общий (monorepo, старый)
├── cloudbuild-portal.yaml       ← Portal backend (guard + build + push + deploy)
├── cloudbuild-monolit.yaml      ← Monolit backend (guard + build + push + deploy)
├── cloudbuild-concrete.yaml     ← concrete-agent (guard + build + push + deploy)
├── cloudbuild-urs.yaml          ← URS Matcher (guard + build + push + deploy)
└── triggers/
    ├── portal.yaml              ← Cloud Build trigger definition
    ├── monolit.yaml
    ├── concrete-agent.yaml
    └── urs.yaml
```

**Шаблон trigg-ера (gcloud):**
```bash
gcloud builds triggers create github \
  --repo-owner=alpro1000 \
  --repo-name=STAVAGENT \
  --branch-pattern=^main$ \
  --build-config=cloudbuild-portal.yaml \
  --name=stavagent-portal-trigger
```
