# NEXT SESSION — 2026-03-13 (Sessions 10a+10b Complete)

## Краткое резюме последних сессий

### Session 10b (2026-03-13) — Code Audit
**Ветка:** `claude/run-shared-tests-0HJWR`
**Тип:** Только чтение, изменений нет

Проверен commit `d5836e6` (FIX: Registry→Portal infinite loop):
1. **`portalAutoSync.ts`** — `syncInProgress` Set предотвращает параллельные таймеры; `!project.portalLink` в таймере проверяет актуальный объект → `onAutoLink` не вызывается повторно ✅
2. **`integration.js`** — `ROLLBACK` перед `BEGIN` чистит зависшую транзакцию пула; UPSERT с `ON CONFLICT` для `portal_projects` — stale localStorage ID больше не ломает FK ✅
3. **`kiosk_links` UNIQUE constraint** — `UNIQUE(portal_project_id, kiosk_type)` в `schema-postgres.sql:207` существует → `ON CONFLICT DO UPDATE` работает корректно ✅

**Итог:** зацикливание создания проектов полностью устранено.

---

### Session 10a (2026-03-12) — Cloud Build CI/CD
**Ветка:** `claude/cleanup-cors-duplicates-WOQfk` (PRs #591–#597 смержены)
**Status:** Cloud Build настроен, но упал с ошибкой GCR permissions

#### Bug Fixes
- FIX: Point registry PortalAutoSync to Cloud Run backend URL
- FIX: Parse OTSKP codes с variant suffix letters (`R42194B`)
- FIX: import-from-registry — duplicates, 500, 429 errors
- FIX: Kiosk unlink 404, positions 429/column errors
- FIX: missing `getFileExtension` / `ALLOWED_FILE_EXTENSIONS` in DocumentSummary

#### Cloud Build CI/CD
- 4 `cloudbuild-*.yaml` (portal, monolit, concrete, urs) с guard steps
- Trigger YAML в `triggers/` для создания через gcloud CLI

---

## 🔴 БЛОКЕР: gcr.io permission denied

**Ошибка при первом пуше через Cloud Build:**
```
denied: gcr.io repo does not exist. Creating on push requires the
artifactregistry.repositories.createOnPush permission
```

**Решение (одна из опций):**

### Опция A — Включить Container Registry API (быстро)
```bash
gcloud services enable containerregistry.googleapis.com --project=YOUR_PROJECT_ID
```

### Опция B — Создать Artifact Registry репозиторий (рекомендуется)
```bash
gcloud artifacts repositories create stavagent \
  --repository-format=docker \
  --location=europe-west3 \
  --project=YOUR_PROJECT_ID

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```
Затем заменить в `cloudbuild-*.yaml`:
```
gcr.io/$PROJECT_ID/... → europe-west3-docker.pkg.dev/$PROJECT_ID/stavagent/...
```

---

## Приоритеты следующей сессии

### P0 — Исправить GCR (без этого CI/CD не работает)
- [ ] Включить Container Registry или создать AR repo
- [ ] Дать Cloud Build SA права на запись
- [ ] Либо переключить `cloudbuild-*.yaml` на AR URL
- [ ] Тест: ручной триггер через `gcloud builds submit`

### P1 — Создать Cloud Build Triggers в GCP
```bash
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
- [ ] Set env vars в Cloud Run
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
├── cloudbuild-portal.yaml
├── cloudbuild-monolit.yaml
├── cloudbuild-concrete.yaml
├── cloudbuild-urs.yaml
└── triggers/
    ├── portal.yaml
    ├── monolit.yaml
    ├── concrete-agent.yaml
    └── urs.yaml
```

---

## Previous Sessions Summary

| Session | Date | Key Work |
|---------|------|----------|
| 10b | 2026-03-13 | Audit: Registry→Portal loop fix verified (portalAutoSync + integration.js + kiosk_links UNIQUE) |
| 10a | 2026-03-12 | Cloud Build CI/CD (4 cloudbuild-*.yaml + guard steps), bug fixes, PRs #591–#597 |
| 9 | 2026-03-11 | CORS cleanup, env vars docs, bridge-deck overtime+skruž |
| 8 | 2026-03-08 | Betonárny, Bedrock, Objednávka betonu, Universal Parser, curing fix |
| 7 | 2026-03-07 | Price Parser UI, batch comparison |
| 6 | 2026-03-07 | Calculator audit: 3 bugs fixed, 332 tests |
| 5 | 2026-03-07 | TariffPage + Pump engine unification |
| 4 | 2026-03-07 | PDF Price Parser backend (17 files, 7 parsers, 21 tests) |
| 1-3 | 2026-03-06 | Formwork refactor, PERT/Maturity, MaturityConfigPanel |

---

## Architecture: Portal Frontend Pages

```
/                    → LandingPage
/portal              → PortalPage (services hub + projects)
/pump                → PumpCalculatorPage
/price-parser        → PriceParserPage
/objednavka-betonu   → ObjednavkaBetonuPage
/dashboard           → DashboardPage (auth required)
/admin               → AdminDashboard (auth required)
```

## Architecture: Monolit Frontend Pages

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

## Full Environment Variables Reference

### concrete-agent (GCR)
```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
MULTI_ROLE_LLM=gemini
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=eu-central-1
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
PERPLEXITY_API_KEY=pplx-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://concrete-agent-3uxelthc4q-ey.a.run.app/api/v1/google/callback
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=...
```

### stavagent-portal backend (GCR)
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

### Monolit-Planner backend (GCR)
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

### URS_MATCHER_SERVICE (GCR)
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

### rozpocet-registry backend (GCR)
```env
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://...
```

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

# Ручной тест пуша Docker:
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

**Version:** 3.1.0
**Last Updated:** 2026-03-13
