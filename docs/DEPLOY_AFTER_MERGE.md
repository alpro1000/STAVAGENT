# Инструкция: Деплой после мерджа в main

## Автоматический деплой (если триггеры настроены)

После мерджа PR в `main` Cloud Build автоматически:
1. Определяет какие файлы изменились
2. Запускает только нужный cloudbuild-*.yaml
3. Собирает Docker образ → Artifact Registry
4. Деплоит на Cloud Run

**Ничего делать не нужно** — просто подожди 3-5 минут.

---

## Проверка после мерджа

### 1. Проверить что билд запустился

```bash
# Посмотреть последние билды
gcloud builds list --limit=5 --region=europe-west3

# Или в консоли:
# https://console.cloud.google.com/cloud-build/builds?region=europe-west3
```

### 2. Проверить статус сервисов

```bash
# Health checks
curl -s https://concrete-agent-3uxelthc4q-ey.a.run.app/health
curl -s https://monolit-planner-api-3uxelthc4q-ey.a.run.app/health
curl -s https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app/health
curl -s https://urs-matcher-service-3uxelthc4q-ey.a.run.app/health
curl -s https://rozpocet-registry-backend-3uxelthc4q-ey.a.run.app/health
```

### 3. Проверить что деплой применился

```bash
# Посмотреть текущую ревизию сервиса
gcloud run services describe concrete-agent --region europe-west3 \
  --format="value(status.latestReadyRevisionName)"
```

---

## Если триггеры НЕ работают

### Шаг 1: Проверить существуют ли триггеры

```bash
gcloud builds triggers list --region=europe-west3
```

Если пусто — триггеры не импортированы. Перейди к Шагу 2.

### Шаг 2: Импортировать триггеры

```bash
# Импортировать все 5 триггеров из репозитория
gcloud builds triggers import --source=triggers/concrete-agent.yaml --region=europe-west3
gcloud builds triggers import --source=triggers/monolit.yaml --region=europe-west3
gcloud builds triggers import --source=triggers/portal.yaml --region=europe-west3
gcloud builds triggers import --source=triggers/urs.yaml --region=europe-west3
gcloud builds triggers import --source=triggers/registry.yaml --region=europe-west3
```

> **Примечание:** Если `gcloud builds triggers import` не работает,
> создай триггеры вручную через консоль (см. Шаг 2b ниже).

### Шаг 2b: Создать триггеры вручную (через GCP Console)

1. Открой https://console.cloud.google.com/cloud-build/triggers
2. Нажми **"Create Trigger"**
3. Заполни для каждого сервиса:

| Поле | concrete-agent | monolit | portal | urs | registry |
|------|---------------|---------|--------|-----|----------|
| Name | concrete-agent-deploy | monolit-deploy | portal-deploy | urs-deploy | registry-backend-deploy |
| Event | Push to branch | Push to branch | Push to branch | Push to branch | Push to branch |
| Branch | ^main$ | ^main$ | ^main$ | ^main$ | ^main$ |
| Included files | concrete-agent/** | Monolit-Planner/** | stavagent-portal/** | URS_MATCHER_SERVICE/** | rozpocet-registry-backend/** |
| Config file | cloudbuild-concrete.yaml | cloudbuild-monolit.yaml | cloudbuild-portal.yaml | cloudbuild-urs.yaml | cloudbuild-registry.yaml |
| Substitution | _REGION=europe-west3 | _REGION=europe-west3 | _REGION=europe-west3 | _REGION=europe-west3 | _REGION=europe-west3 |

### Шаг 3: Ручной деплой (если триггеры всё ещё не работают)

```bash
# Деплой конкретного сервиса вручную
gcloud builds submit --config=cloudbuild-concrete.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-monolit.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-portal.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-urs.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-registry.yaml --region=europe-west3
```

> Это запустит полный цикл: Docker build → push → Cloud Run deploy.
> Занимает 3-8 минут на сервис.

---

## Частые проблемы и решения

### Ошибка: "Artifact Registry repository does not exist"

```bash
# Создать репозиторий Artifact Registry
gcloud artifacts repositories create stavagent \
  --repository-format=docker \
  --location=europe-west3 \
  --description="STAVAGENT Docker images"
```

### Ошибка: "Permission denied" при деплое

```bash
# Дать Cloud Build права на деплой в Cloud Run
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Ошибка: "Secret not found"

```bash
# Проверить что секреты существуют
gcloud secrets list

# Создать недостающий секрет
echo -n "value" | gcloud secrets create SECRET_NAME --data-file=-

# Дать Cloud Build доступ к секретам
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Ошибка: "Cloud SQL connection failed"

```bash
# Проверить что Cloud SQL instance запущен
gcloud sql instances describe stavagent-db --format="value(state)"
# Ожидаемый результат: RUNNABLE

# Проверить что Cloud SQL Admin API включён
gcloud services enable sqladmin.googleapis.com
```

### Билд прошёл, но сервис не обновился

```bash
# Проверить логи Cloud Run
gcloud run services logs read SERVICE_NAME --region europe-west3 --limit 20

# Принудительно обновить сервис
gcloud run services update SERVICE_NAME --region europe-west3 \
  --image europe-west3-docker.pkg.dev/PROJECT_ID/stavagent/SERVICE_NAME:latest
```

---

## Какой сервис деплоить?

| Что изменил | Какой cloudbuild | Cloud Run сервис |
|-------------|-----------------|------------------|
| concrete-agent/** | cloudbuild-concrete.yaml | concrete-agent |
| Monolit-Planner/** | cloudbuild-monolit.yaml | monolit-planner-api |
| stavagent-portal/** | cloudbuild-portal.yaml | stavagent-portal-backend |
| URS_MATCHER_SERVICE/** | cloudbuild-urs.yaml | urs-matcher-service |
| rozpocet-registry-backend/** | cloudbuild-registry.yaml | rozpocet-registry-backend |
| rozpocet-registry/** (frontend) | Vercel (автоматически) | — |
| Monolit-Planner/frontend/** | Vercel (автоматически) | — |
| stavagent-portal/frontend/** | Vercel (автоматически) | — |
| CLAUDE.md, docs/, README.md | Ничего (только документация) | — |

---

**Last Updated:** 2026-03-14
