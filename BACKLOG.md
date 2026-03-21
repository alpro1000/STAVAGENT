# STAVAGENT Backlog & Pending Plans

**Last Updated:** 2026-03-21
**Maintained By:** Development Team

---

## Quick Navigation

- [Immediate / Pending User Action](#-immediate--pending-user-action)
- [High Priority](#-high-priority)
- [Medium Priority](#-medium-priority)
- [Low Priority / Future](#-low-priority--future)
- [Completed Work Reference](#-completed-work-reference)

---

## 🔴 Immediate / Pending User Action

### 0. MASTER_ENCRYPTION_KEY — нужен для Sprint 2

**Status:** ⏳ Ожидает действий пользователя
**Service:** stavagent-portal

**Действие (1 команда в терминале):**
```bash
openssl rand -hex 32
```
→ Добавить результат в GCP Secret Manager:
```bash
echo -n "<64-char-hex>" | gcloud secrets create MASTER_ENCRYPTION_KEY \
  --data-file=- --project=project-947a512a-481d-49b5-81c
```
→ Добавить в Cloud Run: `gcloud run services update stavagent-portal-backend --region=europe-west3 --update-secrets=MASTER_ENCRYPTION_KEY=MASTER_ENCRYPTION_KEY:latest`

**Зачем:** Sprint 2 (service_connections) шифрует API ключи через AES-256-GCM с этим мастер-ключом.

---

### 1. Переменные окружения для Poradna norem (добавить в GCP Secret Manager)

**Status:** ⏳ Code complete, awaiting env vars setup
**Branch:** `claude/formwork-calculator-review-ArdKs`
**Service:** Monolit-Planner backend + concrete-agent

**Добавить в GCP Secret Manager + Cloud Run:**
```env
# Monolit-Planner (Cloud Run → monolit-planner-api):
STAVAGENT_CORE_URL=https://concrete-agent-1086027517695.europe-west3.run.app   # уже есть дефолт, но лучше явно

# concrete-agent (Cloud Run → concrete-agent):
PERPLEXITY_API_KEY=pplx-...   # без него — Gemini fallback (работает, но без источников)

# Monolit-Planner (Cloud Run → monolit-planner-api):
OPENAI_API_KEY=sk-...          # без него — Multi-Role fallback (работает)
```

**Проверка:**
```
FormworkAIModal → вкладка [Poradna norem] → ввести вопрос → Enter
Ожидаемый результат: ответ + бейдж [perplexity/sonar-pro] или [Z KB cache]
```

---

### 2. AI Suggestion Button Enablement (Monolit Planner)

**Status:** ⏳ Code complete, awaiting user SQL execution
**Branch:** `claude/create-onboarding-guide-E4wrx` (merged)
**Service:** Monolit-Planner

**User Action Required:**
```bash
# In Cloud SQL Console → stavagent-db:
psql -U monolit_user -d monolit_planner

# Execute:
# Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql
```

**Verification:**
```bash
curl -s https://monolit-planner-api-1086027517695.europe-west3.run.app/api/config | jq '.feature_flags.FF_AI_DAYS_SUGGEST'
# Expected: true
```

**After SQL Executed:**
- [ ] Verify ✨ button visible in "Dny" column
- [ ] Test AI suggestion functionality
- [ ] Verify position_suggestions audit trail

**Reference:** `Monolit-Planner/SESSION_2026-01-21_PORTAL_INTEGRATION.md`

---

### 2. ~~R0 Deterministic Core~~ → УДАЛЁН (Session 2026-03-21)

**Status:** ✅ R0 frontend удалён, заменён Element Planner
**Branch:** `claude/check-vertex-ai-prod-kb07G`

R0 модуль был пустой и не использовался — Element Planner и Pump Calculator сделаны отдельно.
Удалено: 5 компонентов (R0App, ScheduleView, CapturesPanel, ElementsTable, ProjectsList), маршрут /r0.
Оставлено: backend routes + DB tables (безопасно, не мешают).

### 2b. Element Planner — User Documentation (NEW)

**Status:** ⏳ Не начато
**Service:** Monolit-Planner frontend

**Задача:** Создать встроенную документацию/help panel для пользователей Element Planner.
Описать: методологию (RCPSP граф, Monte Carlo), что вводить, как интерпретировать результаты,
что означает "экономия времени", почему это оценка продолжительности а не точный расчёт опалубки.

---

### 3. Google Drive Setup (Optional)

**Status:** ✅ Code complete, ⏳ Google Cloud setup pending
**Service:** concrete-agent

**User Action Required (15 min):**
1. Create Google Cloud Project
2. Enable Google Drive API
3. Configure OAuth2 credentials
4. Add environment variables to Cloud Run (Secret Manager)

**Reference:** `GOOGLE_DRIVE_SETUP.md`

---

### 4. Keep-Alive System Setup

**Status:** ✅ Code complete, ⏳ Secrets setup pending
**Service:** All services

**User Action Required:**
1. Generate secret key: `openssl rand -base64 32`
2. Add `KEEP_ALIVE_KEY` to GitHub Secrets
3. Add `KEEP_ALIVE_KEY` to Cloud Run (all services via Secret Manager)
4. Enable workflow in GitHub Actions

**Reference:** `KEEP_ALIVE_SETUP.md`

---

## 🟠 High Priority

### NEW: Sprint 2 — Service Connections + AI Models

**Status:** ⏳ Готов к реализации
**Service:** stavagent-portal
**Зависит от:** MASTER_ENCRYPTION_KEY в Secret Manager

**Что нужно сделать:**
- `backend/src/db/schema-postgres.sql` — migration 003 (service_connections таблица)
- `backend/src/services/encryptionService.js` — AES-256-GCM wrapper
- `backend/src/routes/connections.js` — 8 endpoints (CRUD + test + model-config + kiosk-toggles)
- `frontend/src/types/connection.ts` — TypeScript типы
- `frontend/src/components/connections/` — ConnectionCard, ConnectionForm, ConnectionTestButton, ModelConfigPanel, KioskTogglePanel
- `frontend/src/pages/ConnectionsPage.tsx` — `/cabinet/connections`

**API (из PLAN_CABINETS_ROLES_BILLING.md):**
```
GET    /api/connections
POST   /api/connections
PUT    /api/connections/:id
DELETE /api/connections/:id
POST   /api/connections/:id/test      ← rate limited: 5/min
GET    /api/connections/model-config
GET    /api/connections/kiosk-toggles
PATCH  /api/connections/kiosk-toggles
```

**Rate limiting** (добавить в rateLimiter.js):
- `connectionTestLimiter`: windowMs 1min, max 5

---

### NEW: Sprint 3 — Billing + Subscriptions

**Status:** ⏳ Ожидает Stripe аккаунт
**Service:** stavagent-portal
**Зависит от:** Stripe аккаунт + MASTER_ENCRYPTION_KEY

**Нужные действия пользователя:**
1. Создать https://dashboard.stripe.com аккаунт
2. Создать 4 продукта (Free/Starter/Professional/Enterprise)
3. Получить price_id для каждого
4. Добавить STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, 4x STRIPE_PRICE_* в Secret Manager

---

### 5. Pump Calculator — незакрытые задачи (TOVModal)

**Status:** ⏳ Partial — PumpRentalSection UI done, TOVModal integration pending
**Branch:** `claude/formwork-calculator-review-ArdKs`
**Service:** rozpocet-registry

**Tasks:**
- [ ] `handlePumpRentalChange` в TOVModal (паттерн как `handleFormworkRentalChange`)
- [ ] `pumpCost` в footer breakdown TOVModal
- [ ] auto-save для PumpRentalSection (isAutoSaving ref, как у formwork)

---

### 6. Poradna norem — расширение

**Status:** ⏳ MVP complete, refinements planned
**Branch:** `claude/formwork-calculator-review-ArdKs`
**Service:** FormworkAIModal + concrete-agent

**Tasks:**
- [ ] Добавить Poradna как отдельную страницу/виджет в stavagent-portal
- [ ] Создать seed KB — 5–10 часто задаваемых вопросов заранее сохранённых
- [ ] Добавить ещё 10–15 suggested questions (чипы)
- [ ] Проверить авто-определение категорий (B2 для ČSN, B3 для цен, B5 для postupov)

---

### 7. Universal Parser Phase 2 — Portal Frontend + Kiosk Integration

**Status:** ✅ Phase 2 Complete
**Branch:** `claude/universal-parser-phase-2-0Fu4g`
**Service:** Portal + All Kiosks

**Phase 1 (✅ Done):**
- [x] `universalParser.js` — parse Excel with auto-detect, work type classification
- [x] DB migration (parsed_data, parse_status, parsed_at)
- [x] API endpoints: parse, parsed-data, summary, for-kiosk/:type
- [x] Auto-parse on upload + 11 tests

**Phase 2 (✅ Done):**
- [x] Portal Frontend: ParsePreviewPage.tsx — full-page preview (summary, sheets, work types, positions table)
- [x] Portal Frontend: "Open in Kiosk" buttons from preview (Monolit, Registry, URS Matcher)
- [x] Portal Frontend: parse status indicator (parsing → parsed → error) — in CorePanel
- [x] CorePanel: "Pozice" button linking to ParsePreviewPage
- [x] Monolit: "Load from Portal" — auto-detect ?portal_file_id=, confirmation modal, import positions
- [x] Registry: "Load from Portal" — auto-detect ?portal_file_id=, create project in Zustand store
- [x] URS Matcher: "Load from Portal" — auto-detect ?portal_file_id=, pre-fill batch textarea

**Phase 3 (planned):**
- [ ] Bi-directional sync: kiosks save results back to Portal
- [ ] Portal aggregates all kiosk results

**Reference:** `stavagent-portal/backend/src/services/universalParser.js`

---

### 8. Node.js Version Update

**Status:** ⏳ Not started
**Service:** All services
**Reason:** Node.js 18.x reached end-of-life

**Tasks:**
- [ ] Update `.nvmrc` to Node.js 20.x or 22.x
- [ ] Test locally
- [ ] Deploy and verify

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

### 9. npm Security Vulnerabilities

**Status:** ⏳ Not started
**Service:** All services
**Impact:** 4 vulnerabilities (2 moderate, 2 high)

**Tasks:**
```bash
cd Monolit-Planner/backend && npm audit fix
cd ../frontend && npm audit fix
cd ../shared && npm audit fix
```

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

## 🟡 Medium Priority

### 10. URS Matcher - Phase 2: Document Parsing

**Status:** 🔄 In Progress (partially complete)
**Service:** URS_MATCHER_SERVICE

**Completed:**
- [x] SmartParser integration via stavagentClient.js
- [x] PDF/Excel support
- [x] Document Q&A Flow integration
- [x] RFI detection

**Pending:**
- [ ] Document Validator integration (completeness check)
- [ ] Frontend: Multi-file upload + preview
- [ ] Caching (Redis/file)

**Reference:** `URS_MATCHER_SERVICE/ROADMAP.md`

---

### 11. URS Matcher - Phase 3: Multi-Role System

**Status:** 🔄 In Progress (MVP complete)
**Service:** URS_MATCHER_SERVICE

**Completed:**
- [x] multiRoleClient.js
- [x] validateBoqBlock(), verifyUrsCode(), resolveUrsConflict()
- [x] Completeness score (0-100%)

**Pending:**
- [ ] Advanced roles (Structural Engineer, Concrete Specialist, Standards Checker)
- [ ] Full Orchestrator integration
- [ ] Advanced conflict resolution
- [ ] tech_rules integration

**Reference:** `URS_MATCHER_SERVICE/ROADMAP.md`

---

### 12. CI/CD Improvements

**Status:** ⏳ Not started
**Service:** All services

**Tasks:**
- [ ] Add npm caching back (20 min)
- [ ] Add Dependency Review Action (15 min)

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

## 🟢 Low Priority / Future

### 13. URS Matcher - Phase 4: Optimization

**Status:** ⏳ Planned
**Service:** URS_MATCHER_SERVICE

**Tasks:**
- [ ] Perplexity caching (Redis)
- [ ] Performance tuning
- [ ] Cost optimization
- [ ] Monitoring & Analytics

**Target:** Block analysis < 2 min, 70% cost savings

**Reference:** `URS_MATCHER_SERVICE/ROADMAP.md`

---

### 14. Integration Tests - Vitest Migration

**Status:** ⏳ Planned
**Service:** Monolit-Planner

**Tasks:**
- [ ] Migrate from Jest to Vitest
- [ ] Better ESM support
- [ ] Fix ES module mocking

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

### 15. Document Accumulator - Production Fixes

**Status:** ⏳ Identified but not started
**Service:** concrete-agent

**Issues Found (SESSION_2026-01-14_TIMEOUT_FIX.md):**
- In-memory storage (lost on restart)
- No file size limits
- No cleanup for temp files

**Tasks:**
- [ ] Add persistent storage
- [ ] Add file size validation
- [ ] Add temp file cleanup

---

### 16. Security Audit Follow-up

**Status:** ⏳ Some items fixed, some pending
**Service:** All services

**Pending from COMPLETE_SYSTEM_AUDIT_REPORT.md:**
- [ ] Review remaining vulnerabilities
- [ ] Add Error Boundaries (React)
- [ ] Fill empty onError callbacks

**Reference:** `docs/archive/analyses/COMPLETE_SYSTEM_AUDIT_REPORT.md`

---

## ✅ Completed Work Reference

For historical reference, completed work is archived in:

```
docs/archive/
├── completed-sessions/     # Session summaries (Google Drive, Multi-Role, etc.)
├── completed-fixes/        # Migration and schema fixes
├── completed-projects/     # Project completion summaries
├── analyses/               # Audit reports and analyses
└── future-planning/        # Speculative planning docs
```

---

## Priority Summary

| Priority | Items | Impact |
|----------|-------|--------|
| 🔴 Immediate | 5 | User action needed (+ Poradna env vars) |
| 🟠 High | 5 | Pump Calculator + Poradna + Universal Parser Phase 2 + Security |
| 🟡 Medium | 3 | Features |
| 🟢 Low | 4 | Optimization |

---

**Total Pending Items:** 17
**Next Critical Path:** Deploy all services → Test with real PDFs → Formwork rental audit → Kiosk import E2E

### Recently Completed (Session 14, 2026-03-21)
- ✅ **Element Planner расширен до 20 типов элементов** (9 мостовых + 11 зданий: стены, плиты, колонны, фундаменты, лестницы, резервуары, сваи и др.)
- ✅ **Динамический concrete_days** — вместо хардкода 1 день, рассчитывается из фактических часов заливки
- ✅ **Непрерывная заливка** — для монолитных элементов автомасштабирование бригады до 15 чел., смены до 16ч, +25% за сверхурочные
- ✅ **Скруж (подпёрная конструкция)** — обобщена для ВСЕХ горизонтальных элементов (не только mostovkova_deska)
- ✅ **Визуальный Gantt** — цветные горизонтальные бары по фазам (PlannerGantt.tsx)
- ✅ **Excel export** — 4-листовая XLSX книга (Souhrn, Harmonogram, Gantt, Log) через SheetJS
- ✅ **AI prompt выровнен** — детерминированные правила встроены в промпт, AI не противоречит расчётам
- ✅ **R0 модуль удалён** — пустой/неиспользуемый, 1052 строки удалены, backend оставлен
- ✅ **Дизайн-система консолидирована** — r0.css очищен (838→190 строк), 25+ CSS-переменных, 0 хардкодированных hex-цветов
- ✅ **JSON вывод исправлен** — AI advisor показывает человекочитаемый формат вместо сырого JSON
- ✅ 336 тестов проходят

### Recently Completed (Session 13, 2026-03-16)
- ✅ Sprint 1 Backend: organizations, org_members в DB, 5 ролей, 12 org endpoints, cabinet stats, PATCH /api/auth/me
- ✅ Sprint 1 Frontend: CabinetPage, CabinetOrgsPage, OrgPage, OrgInvitePage, все компоненты cabinet/ и org/
- ✅ orgRole.js middleware для role-based access control
- ✅ PORTAL_DATABASE_URL secret v4 + .trim() fix + SSL off для Cloud SQL unix socket
- ✅ Cloud Run revision 00049-fd7 задеплоен и работает
- ✅ Vertex AI Gemini + Vertex AI Search → PassportEnricher (concrete-agent)
- ✅ position_instances / position_templates в portal schema
- ✅ Cloud Build _FORCE_DEPLOY + approval gate off

### Recently Completed (Session 8, 2026-03-08)
- ✅ Betonárny Discovery — GPS-based concrete plant search + scraping
- ✅ AWS Bedrock integration — Claude via AWS Activate credits
- ✅ Objednávka betonu — unified ordering page (search+calculate+compare)
- ✅ Lazy-load all pages — bundle 519KB→407KB (-22%)
- ✅ CORE proxy — Portal backend → concrete-agent proxy
- ✅ All 5 workflows fixed (upload, A, B, C, Drawing Analysis)
- ✅ Universal Parser 4-step pipeline + kiosk import buttons
- ✅ CorePanel rewrite (Tailwind → inline styles)
- ✅ Curing days fix — elementTotalDays now flows to FormworkCalculatorModal

