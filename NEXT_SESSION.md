# NEXT SESSION — 2026-03-12 (Session 10 Complete)

**Date:** 2026-03-12
**Branch completed:** `claude/cleanup-cors-duplicates-WOQfk` (PRs #591–#597 merged)
**Status:** Cloud Build CI/CD настроен, но упал с ошибкой GCR permissions

---

## БЛОКЕР: gcr.io permission denied

**Ошибка при первом пуше через Cloud Build:**
```
denied: gcr.io repo does not exist. Creating on push requires the
artifactregistry.repositories.createOnPush permission
```

**Что нужно сделать в GCP (вручную, одна из опций):**

### Опция A — Включить Container Registry API (быстро)
```bash
gcloud services enable containerregistry.googleapis.com --project=YOUR_PROJECT_ID
```

### Опция B — Создать Artifact Registry репозиторий (рекомендуется)
```bash
# Создать repo
gcloud artifacts repositories create stavagent \
  --repository-format=docker \
  --location=europe-west3 \
  --project=YOUR_PROJECT_ID

# Дать права сервисному аккаунту Cloud Build
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```
Затем заменить в `cloudbuild-*.yaml`:
```
gcr.io/$PROJECT_ID/... → europe-west3-docker.pkg.dev/$PROJECT_ID/stavagent/...
```

---

## Что было сделано в сессии 10 (2026-03-12)

### Bug Fixes (Portal + Monolit)
- FIX: Point registry PortalAutoSync to Cloud Run backend URL
- FIX: Parse OTSKP codes с variant suffix letters (`R42194B`)
- FIX: import-from-registry — duplicates, 500, 429 errors
- FIX: Kiosk unlink 404, positions 429/column errors, rate limit increase
- FIX: OTSKP variant suffix regex in universalParser + rowClassificationService
- FIX: missing `getFileExtension` / `ALLOWED_FILE_EXTENSIONS` in DocumentSummary

### Cloud Build CI/CD
- 4 отдельных `cloudbuild-*.yaml` (portal, monolit, concrete, urs)
- Guard steps: сборка запускается только при изменениях в нужном сервисе
- Trigger YAML в `triggers/` для создания через gcloud CLI
- Все PRs #591–#597 смержены в main

---

## Приоритеты следующей сессии

### P0 — Исправить GCR (без этого CI/CD не работает)
- [ ] Включить Container Registry или создать AR repo
- [ ] Дать Cloud Build SA права на запись
- [ ] Либо переключить cloudbuild-*.yaml на AR URL
- [ ] Тест: ручной триггер через gcloud builds submit

### P1 — Создать Cloud Build Triggers в GCP
```bash
# После исправления GCR:
gcloud builds triggers create github \
  --repo-owner=alpro1000 \
  --repo-name=STAVAGENT \
  --branch-pattern=^main$ \
  --build-config=cloudbuild-portal.yaml \
  --name=stavagent-portal-trigger

# Аналогично для monolit, concrete-agent, urs
```

### P2 — Деплой и тестирование
- [ ] Deploy concrete-agent (price-parser + proxy endpoints)
- [ ] Deploy Portal (6 new pages + CORE proxy)
- [ ] Deploy Monolit (vercel.json SPA routing + new routes)
- [ ] Set env vars в Cloud Run (см. список ниже)
- [ ] Test Betonárny discovery в production
- [ ] Test price parser с реальными PDF

### P3 — R0 Core Gaps

| # | Gap | Описание | Сложность |
|---|-----|----------|-----------|
| G1 | `move`/`inspection` узлы DAG | move_clean_hours → Activity в DAG | Medium |
| G2 | Кран/насос resource constraints | shared resources в forward pass | Hard |
| G3 | Calendar-aware forward pass | Праздники/выходные прямо в DAG | Medium |
| G4 | Weather stochastic | P(rain) → PERT множитель | Easy |

---

## Cloud Build файлы

```
STAVAGENT/
├── cloudbuild-portal.yaml       ← Portal backend
├── cloudbuild-monolit.yaml      ← Monolit backend
├── cloudbuild-concrete.yaml     ← concrete-agent
├── cloudbuild-urs.yaml          ← URS Matcher
└── triggers/
    ├── portal.yaml
    ├── monolit.yaml
    ├── concrete-agent.yaml
    └── urs.yaml
```

---

## Полные env переменные

### concrete-agent (Cloud Run)
```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
MULTI_ROLE_LLM=gemini
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...           # optional, Bedrock
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=eu-central-1
DATABASE_URL=postgresql+asyncpg://...
PERPLEXITY_API_KEY=pplx-...
```

### stavagent-portal backend (Cloud Run)
```env
NODE_ENV=production
PORT=8080
JWT_SECRET=...
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://www.stavagent.cz
CONCRETE_AGENT_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app
```

### stavagent-portal frontend (Vercel)
```env
VITE_DISABLE_AUTH=true
VITE_API_URL=https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app
VITE_CONCRETE_AGENT_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app
```

### Monolit-Planner backend (Cloud Run)
```env
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app
STAVAGENT_API_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app
FF_AI_DAYS_SUGGEST=true
```

### Monolit-Planner frontend (Vercel)
```env
VITE_API_URL=https://monolit-planner-api-3uxelthc4q-ey.a.run.app
```

### URS_MATCHER_SERVICE (Cloud Run)
```env
NODE_ENV=production
PORT=8080
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_KEY=...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
LLM_TIMEOUT_MS=90000
STAVAGENT_API_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app
```

---

## Architecture: Frontend Pages

### Portal
```
/                    → LandingPage
/portal              → PortalPage (services hub + projects)
/pump                → PumpCalculatorPage
/price-parser        → PriceParserPage
/objednavka-betonu   → ObjednavkaBetonuPage
```

### Monolit
```
/                    → MainApp
/planner             → PlannerPage
/tariffs             → TariffPage
/registry/:projectId → RegistryView
/r0/*                → R0App
```

---

## Тесты

| Component | Tests | Status |
|-----------|-------|--------|
| Monolit shared total | 332 | Pass |
| URS Matcher | 159 | Pass |
| Price Parser (CORE) | 21 | Pass |
| **Grand Total** | **512+** | **Pass** |

---

## Quick Start — следующая сессия

```bash
# === КОМАНДА ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ ===
cd /home/user/STAVAGENT && \
git checkout main && \
git pull origin main && \
echo "=== Branch ready ===" && \
git log --oneline -5 && \
echo "=== Running shared tests ===" && \
cd Monolit-Planner/shared && npx vitest run 2>&1 | tail -5
```

```bash
# Проверить состояние Cloud Build
gcloud builds list --project=YOUR_PROJECT_ID --limit=5

# Ручной тест пуша Docker (вместо Cloud Build):
cd stavagent-portal
gcloud builds submit --config=../cloudbuild-portal.yaml .

# Создать AR репозиторий (если ещё нет):
gcloud artifacts repositories create stavagent \
  --repository-format=docker \
  --location=europe-west3

# Run all shared tests (332)
cd Monolit-Planner/shared && npx vitest run
```

---

**Version:** 3.0.0
**Last Updated:** 2026-03-12
