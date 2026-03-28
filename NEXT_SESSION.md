# NEXT SESSION — после 2026-03-28 (Session 8)

## Как начать следующий сеанс

```
Продолжи работу над STAVAGENT. Прочитай CLAUDE.md и NEXT_SESSION.md.
[описание задачи]
```

---

## Что сделано (сессии 1-8, 2026-03-22 — 2026-03-28)

### Сессия 8 (текущая)
- **Удалено ~54 устаревших .md файлов** (PR descriptions, week reports, old session summaries)
- **Глубокий аудит проектной архитектуры** — 5 параллельных агентов проверили все сервисы
- **NEXT_SESSION.md и BACKLOG.md** обновлены до актуального состояния

### Сессия 7 (PR #752 + #753, merged)
- CLAUDE.md v3.5.0 — полный аудит
- Resend email для регистрации
- Registration UX — 3 шага, resend, auto-redirect
- Landing — Kalkulátor rename + /planner
- "← StavAgent" кнопки во всех киосках
- URL миграция на субдомены (kalkulator/klasifikator/rozpocet.stavagent.cz)
- trust proxy fix для URS Matcher

### Сессии 1-6 (подробности в CLAUDE.md → Backlog/Completed)
- Pay-as-you-go credits + Stripe Checkout (code ready, env vars pending)
- Landing redesign (Variant C — 2 hero products without registration)
- Anti-fraud (IP limit, disposable email, user ban, rate limiting)
- DA→URS integration + URS Matcher dual search fix
- Full codebase audit (384 endpoints, 590+ tests, ~137K LOC)
- NKB v1.0, NormIngestionPipeline, E2E tests
- Universal Parser v5.0, Bedrock integration, batch INSERT
- Project state persistence, cross-validation, image OCR, DXF parsing

---

## Архитектура проектов (результат глубокого аудита)

### Где создаются проекты

| Путь | Сервис | Как | Auth |
|------|--------|-----|------|
| **Portal "+ Nový projekt"** | Portal | POST /api/portal-projects | JWT ✅ |
| **Portal "Analýza dokumentů"** | Portal | POST /api/portal-documents/:id (save to project) | JWT ✅ |
| **Kiosk → Portal** | All kiosks | POST /api/portal-projects/create-from-kiosk | ❌ None (owner_id=1) |
| **Monolit "Přidat objekt"** | Monolit | POST /api/monolith-projects + fire-and-forget Portal sync | ❌ None |
| **Registry Import** | Registry | Zustand store + auto-sync POST /api/integration/import-from-registry | ❌ None |
| **URS Matcher job** | URS | POST /api/jobs/upload or /text-match | ❌ None |

### Поток данных между сервисами

```
Portal (Hub)
  ├─→ CORE: POST /workflow/a/import (files) → project_id + audit results
  ├─→ CORE: POST /api/v1/passport/generate (file) → passport JSON
  ├─→ CORE: POST /api/v1/nkb/advisor → compliance check
  │
  ├─←→ Monolit:
  │    OUT: GET /api/portal-files/{id}/parsed-data/for-kiosk/monolit
  │    IN:  POST /api/integration/import-from-monolit (positions + MonolithPayload)
  │    IN:  POST /api/positions/{instanceId}/monolith (live write-back)
  │
  ├─←→ Registry:
  │    OUT: GET /api/integration/for-registry/{portalProjectId}
  │    IN:  POST /api/integration/import-from-registry (sheets + items + TOV)
  │    IN:  POST /api/positions/{instanceId}/dov (DOV write-back)
  │    IN:  POST /api/integration/sync-tov (batch TOV update)
  │
  └─←→ URS Matcher:
       OUT: POST /api/core/urs-match/* (proxy to URS pipeline)
       IN:  Results displayed inline in Portal SoupisTab
```

### Ключевые identity

| ID | Формат | Scope | Источник |
|----|--------|-------|----------|
| portal_project_id | `proj_<uuid>` | Portal DB | Portal |
| position_instance_id | UUID | Cross-kiosk | Portal (returned to kiosks) |
| project_id (Monolit) | user input (SO201) | Monolit DB | User |
| bridge_id | = project_id | Monolit (FK compat) | Legacy |
| passport_id | `ppt_<uuid>` | CORE in-memory | CORE |

### ⚠️ Gaps найденные аудитом

1. **CORE stateless** — проекты в in-memory dict, теряются при рестарте Cloud Run
2. **No auth on integration endpoints** — /api/integration/* публичные
3. **No conflict resolution** — если Monolit + Registry одновременно редактируют позицию → last-write-wins
4. **Portal project ≠ CORE project** — Portal хранит portal_project_id, CORE генерирует свой proj_xxx
5. **URS Matcher не отправляет результаты назад в Portal** — только через SoupisTab proxy

---

## 🟠 Задачи (по приоритету)

### 1. Stripe — настройка платежей
**Приоритет:** ВЫСОКИЙ
**Код готов:** credits.js, creditService.js, quotaCheck.js, QuotaDisplay, CreditManagement
**Нужно:**
- Создать Stripe аккаунт (dashboard.stripe.com)
- Добавить STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET в GCP Secret Manager
- Добавить в cloudbuild-portal.yaml
- Протестировать Checkout flow

### 2. Verify deploy — проверить все субдомены
**Приоритет:** ВЫСОКИЙ
**Проверить:**
- www.stavagent.cz — landing + registration
- kalkulator.stavagent.cz — Monolit Planner
- klasifikator.stavagent.cz — URS Matcher
- rozpocet.stavagent.cz — Registry
- Кнопки "← StavAgent" во всех киосках

### 3. Test registration flow
**Приоритет:** ВЫСОКИЙ
- 3-step form (email → verify → profile)
- Resend email button
- Auto-redirect after verification
- Welcome bonus 200 credits

### 4. Node.js 20.x / 22.x обновление
**Приоритет:** СРЕДНИЙ
- Node.js 18.x EOL

### 5. CORE persistence → PostgreSQL
**Приоритет:** СРЕДНИЙ
- project_store (in-memory dict) → PostgreSQL tables
- Artifacts → GCS or PostgreSQL JSONB

---

## ⏳ Ожидает действий пользователя

| Задача | Что нужно | Статус |
|--------|-----------|--------|
| Stripe аккаунт | dashboard.stripe.com → keys → Secret Manager | Блокирует платежи |
| MASTER_ENCRYPTION_KEY | `openssl rand -hex 32` → Secret Manager | Для Service Connections |
| AWS Bedrock квота | AWS Console → Bedrock → Request RPM increase | ThrottlingException |
| VPC connector | gcloud VPC connector → Cloud SQL private IP | Безопасность |

---

## Контекст

- **5 сервисов** на GCP Cloud Run + Vercel
- **LLM:** Vertex AI Gemini (ADC, $1000 credits) + Bedrock + Perplexity ($5000)
- **CI/CD:** Cloud Build (5 triggers) + GitHub Actions
- **Тесты:** 402 (Monolit) + 159 (URS) + 28 files (CORE) + 26 offline
- **Auth:** JWT + email verification + anti-fraud (6 layers)
- **Credits:** Pay-as-you-go, 200 welcome bonus, volume discounts
- **Design:** Digital Concrete (Portal), Slate Minimal (Planner)
