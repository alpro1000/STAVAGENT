# STAVAGENT Backlog & Pending Plans

**Last Updated:** 2026-02-25
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

### 1. Переменные окружения для Poradna norem (добавить в Render)

**Status:** ⏳ Code complete, awaiting env vars setup
**Branch:** `claude/formwork-calculator-review-ArdKs`
**Service:** Monolit-Planner backend + concrete-agent

**Добавить в Render:**
```env
# Monolit-Planner backend (Render → monolit-planner-api → Environment):
STAVAGENT_CORE_URL=https://concrete-agent.onrender.com   # уже есть дефолт, но лучше явно

# concrete-agent (Render → concrete-agent → Environment):
PERPLEXITY_API_KEY=pplx-...   # без него — Gemini fallback (работает, но без источников)

# Monolit-Planner backend (для OpenAI GPT-4o mini):
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
# In Render Dashboard → monolit-db → Shell:
psql -U monolit_user -d monolit_planner

# Execute:
# Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql
```

**Verification:**
```bash
curl -s https://monolit-planner-api.onrender.com/api/config | jq '.feature_flags.FF_AI_DAYS_SUGGEST'
# Expected: true
```

**After SQL Executed:**
- [ ] Verify ✨ button visible in "Dny" column
- [ ] Test AI suggestion functionality
- [ ] Verify position_suggestions audit trail

**Reference:** `Monolit-Planner/SESSION_2026-01-21_PORTAL_INTEGRATION.md`

---

### 2. R0 Deterministic Core + Unified Architecture PR

**Status:** ⏳ PR ready for merge
**Branch:** `claude/portal-audit-improvements-8F2Co`
**Service:** Portal + All Kiosks

**User Action Required:**
- [ ] Review PR at: `https://github.com/alpro1000/STAVAGENT/compare/main...claude/portal-audit-improvements-8F2Co`
- [ ] Merge to main

**What's Included:**
- R0 Deterministic Core API, UI, migrations
- Unified Project Architecture (Portal aggregates all kiosks)
- ESM import fixes

---

### 3. Google Drive Setup (Optional)

**Status:** ✅ Code complete, ⏳ Google Cloud setup pending
**Service:** concrete-agent

**User Action Required (15 min):**
1. Create Google Cloud Project
2. Enable Google Drive API
3. Configure OAuth2 credentials
4. Add environment variables to Render

**Reference:** `GOOGLE_DRIVE_SETUP.md`

---

### 4. Keep-Alive System Setup

**Status:** ✅ Code complete, ⏳ Secrets setup pending
**Service:** All services

**User Action Required:**
1. Generate secret key: `openssl rand -base64 32`
2. Add `KEEP_ALIVE_KEY` to GitHub Secrets
3. Add `KEEP_ALIVE_KEY` to Render (all 3 services)
4. Enable workflow in GitHub Actions

**Reference:** `KEEP_ALIVE_SETUP.md`

---

## 🟠 High Priority

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

**Status:** ⏳ Phase 1 Complete (backend), Phase 2 planned
**Branch:** `claude/continue-implementation-NEOkf`
**Service:** Portal + All Kiosks

**Phase 1 (✅ Done):**
- [x] `universalParser.js` — parse Excel with auto-detect, work type classification
- [x] DB migration (parsed_data, parse_status, parsed_at)
- [x] API endpoints: parse, parsed-data, summary, for-kiosk/:type
- [x] Auto-parse on upload + 11 tests

**Phase 2 (⏳ Next):**
- [ ] Portal Frontend: parse preview UI (summary, sheets, work types)
- [ ] Portal Frontend: "Send to Kiosk" buttons from preview
- [ ] Portal Frontend: parse status indicator (parsing → parsed → error)
- [ ] Monolit: "Load from Portal" option (GET /for-kiosk/monolit)
- [ ] Registry: "Load from Portal" option (GET /for-kiosk/registry)
- [ ] URS Matcher: "Load from Portal" option (GET /for-kiosk/urs_matcher)

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
**Next Critical Path:** Poradna env vars → Pump TOVModal → Universal Parser Phase 2 UI

