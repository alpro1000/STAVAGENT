# Next Session - Quick Start

**Last Updated:** 2026-02-10
**Current Branch:** `claude/monolit-registry-integration`
**Last Session:** Monolit ↔ Registry Integration (Phase 1 Complete)

---

## Quick Start Commands

```bash
cd /home/user/STAVAGENT

# 1. Read system context
cat CLAUDE.md

# 2. Read integration documentation
cat docs/MONOLIT_REGISTRY_INTEGRATION.md

# 3. Check branch and recent commits
git checkout claude/monolit-registry-integration
git log --oneline -10

# 4. Run database migration
cd stavagent-portal/backend
psql $DATABASE_URL < src/db/migrations/add-unified-project-structure.sql

# 5. Test integration
# - Open Monolit: https://monolit-planner-frontend.onrender.com
# - Click "→ Registry" button
# - Verify: Registry opens with project data
```

---

## Сессия 2026-02-10: Резюме

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| Portal API | Integration routes (import, for-registry, sync-tov) | ✅ |
| Portal DB | Unified project structure (objects + positions) | ✅ |
| Monolit Export | "→ Registry" button with TOV mapping | ✅ |
| Registry Import | Load from Portal via URL param | ✅ |
| Documentation | MONOLIT_REGISTRY_INTEGRATION.md | ✅ |

### Ключевые достижения:

**1. Portal API (3 endpoints):**
```
POST /api/integration/import-from-monolit  - Import from Monolit with TOV
GET  /api/integration/for-registry/:id     - Get project for Registry
POST /api/integration/sync-tov             - Sync TOV changes back
```

**2. Database Schema:**
```sql
portal_objects    - SO 202, SO 203, etc.
portal_positions  - Unified positions with TOV data (JSON)
```

**3. TOV Mapping (Monolit → Registry):**
```
Betonování → Labor (Betonář)
Bednění    → Labor (Tesař / Bednář)
Výztuž     → Labor (Železář)
Beton      → Materials (editable price)
```

**4. Data Flow:**
```
Monolit → [Export] → Portal → [Load] → Registry
                       ↑
                       └─ [Sync TOV] ← Registry
```

### Коммиты (2026-02-10):
```
[pending]
FEAT: Add Monolit-Registry integration via Portal API

Phase 1 Complete:
- Portal API: 3 integration endpoints
- Database: portal_objects + portal_positions tables
- Monolit: Updated export button with TOV mapping
- Registry: Load from Portal via URL param
- Documentation: MONOLIT_REGISTRY_INTEGRATION.md

Files:
- stavagent-portal/backend/src/routes/integration.js (NEW)
- stavagent-portal/backend/src/db/migrations/add-unified-project-structure.sql (NEW)
- Monolit-Planner/frontend/src/components/Header.tsx (UPDATED)
- rozpocet-registry/src/App.tsx (UPDATED)
- rozpocet-registry/src/services/portalSync.ts (NEW)
- docs/MONOLIT_REGISTRY_INTEGRATION.md (NEW)
```

---

## ⏳ AWAITING USER ACTION (High Priority)

### 1. Run Database Migration
Выполнить миграцию в Portal PostgreSQL:
```bash
cd stavagent-portal/backend
psql $DATABASE_URL < src/db/migrations/add-unified-project-structure.sql
```

### 2. Test Integration Flow
1. Open Monolit: https://monolit-planner-frontend.onrender.com
2. Select project with positions
3. Click "→ Registry" button
4. Verify: Registry opens with project data
5. Verify: TOV data is populated (Labor, Materials)

### 3. Configure Environment Variables (Optional)

**Monolit Frontend (.env):**
```env
VITE_PORTAL_API_URL=https://stavagent-portal-backend.onrender.com
VITE_REGISTRY_URL=https://rozpocet-registry.vercel.app
```

**Registry (.env):**
```env
VITE_PORTAL_API_URL=https://stavagent-portal-backend.onrender.com
```

---

## 📊 URS Matcher - LLM Providers (7 моделей)

| Provider | Task | Cost | Status |
|----------|------|------|--------|
| **Perplexity** | RETRIEVE (search) | $20/мес | ❌ Нужен API key |
| **Gemini** | RERANK, General | FREE | ✅ Configured |
| **Claude** | High accuracy | $$$ | ⚠️ Out of money |
| **DeepSeek** | Cost-effective | $ | ✅ Configured |
| **Grok** | Alternative | $$ | ✅ Configured |
| **Qwen** | Chinese docs | $ | ✅ Configured |
| **GLM** | Alternative | $ | ✅ Configured |
| **OpenAI** | Fallback | $$ | ✅ Configured |

**Fallback chain:**
```
deepseek → glm → qwen → gemini → grok → openai → claude
```

---

## 🔍 Batch Processing Pipeline (4 Steps)

```
┌─────────────────────────────────────────────────────────────┐
│              URS Matcher Batch Processing                   │
│                                                             │
│  Step 1: NORMALIZE TEXT                                     │
│    └─> LLM: DeepSeek, Gemini                               │
│                                                             │
│  Step 2: SPLIT (SINGLE/COMPOSITE)                           │
│    └─> LLM: Gemini, Claude                                 │
│                                                             │
│  Step 3a: RETRIEVE CANDIDATES ← ❌ REQUIRES PPLX_API_KEY    │
│    └─> Perplexity API (searches online ÚRS catalog)        │
│                                                             │
│  Step 3b: RERANK CANDIDATES                                 │
│    └─> LLM: Claude, Gemini, OpenAI                         │
│                                                             │
│  Step 4: FORMAT RESULT                                      │
│    └─> Return best URS code + confidence                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps (Priority Order)

### 🔴 Critical (блокирующие)
1. [ ] Добавить `DISABLE_AUTH=true` в stavagent-portal-backend
2. [ ] Добавить `PPLX_API_KEY` в URS_MATCHER_SERVICE (или решить использовать local DB)
3. [ ] Redeploy оба сервиса

### 🟡 High Priority
4. [ ] Протестировать Project Passport на production после env vars
5. [ ] Протестировать URS Matcher batch processing после Perplexity configuration
6. [ ] Merge ветки `claude/phase-6-technology-review-SVfgv` в main

### 🟢 Medium Priority
7. [ ] Рассмотреть разработку локальной базы ÚRS кодов (если Perplexity дорого)
8. [ ] Добавить мониторинг API costs для всех LLM providers
9. [ ] Написать тесты для DocumentSummary.tsx

### ⚪ Low Priority
10. [ ] Update CLAUDE.md с новой информацией о Project Passport
11. [ ] Создать документацию по локальной базе ÚRS кодов
12. [ ] Оптимизировать timeout для разных размеров PDF

---

## 📁 Измененные файлы

### Portal (stavagent-portal)
```
frontend/src/components/portal/DocumentSummary.tsx
  - Timeout: 120s → 300s
  - API endpoint: /api/portal/projects → /api/portal-projects
  - Added credentials: 'include'
  - Response format handling (array vs object)
  - File input modal refactor (ref + button)

backend/server.js
  - CORS: added www.stavagent.cz, stavagent.cz
```

### Analyzed (не изменено)
```
URS_MATCHER_SERVICE/backend/src/
  config/llmConfig.js                    # 7 providers, task routing
  services/batch/batchProcessor.js       # 4-step pipeline
  services/batch/candidateRetriever.js   # Perplexity integration
```

---

## 🌐 Production Status

| Service | URL | Status | Action Needed |
|---------|-----|--------|---------------|
| Portal Frontend | https://www.stavagent.cz | ✅ Live | None |
| Portal Backend | https://stavagent-portal-backend.onrender.com | ⚠️ | Add DISABLE_AUTH |
| URS Matcher | https://urs-matcher-service.onrender.com | ⚠️ | Add PPLX_API_KEY |
| concrete-agent | https://concrete-agent.onrender.com | ✅ Live | None |
| Monolit API | https://monolit-planner-api.onrender.com | ✅ Live | None |

---

## Environment Variables - Complete Reference

### concrete-agent
```env
GOOGLE_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant...
OPENAI_API_KEY=sk-...
GEMINI_MODEL=gemini-2.0-flash-exp
MULTI_ROLE_LLM=gemini
```

### stavagent-portal-backend
```env
DISABLE_AUTH=true                        # ← НУЖНО ДОБАВИТЬ
CORS_ORIGIN=https://www.stavagent.cz    # ← НУЖНО ДОБАВИТЬ
NODE_ENV=production
PORT=3001
```

### URS_MATCHER_SERVICE
```env
# Perplexity (для batch processing)
PPLX_API_KEY=pplx-...                   # ← НУЖНО ДОБАВИТЬ
PPLX_MODEL=sonar
URS_CATALOG_MODE=online

# LLM Providers (fallback)
GOOGLE_AI_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
GROK_API_KEY=...

# concrete-agent integration
STAVAGENT_API_URL=https://concrete-agent.onrender.com
```

---

## 📖 Related Documentation

| File | Description |
|------|-------------|
| `CLAUDE.md` | System overview (v2.0.3) |
| `docs/archive/completed-sessions/SESSION_2026-02-10_PASSPORT_PRODUCTION_FIX.md` | This session details |
| `stavagent-portal/frontend/src/types/passport.ts` | Project Passport TypeScript types |
| `URS_MATCHER_SERVICE/backend/src/config/llmConfig.js` | LLM configuration (1044 lines) |

---

## 🐛 Known Issues

1. **Portal:** DISABLE_AUTH нужен в backend (не frontend VITE_DISABLE_AUTH)
2. **URS Matcher:** Batch processing не работает без Perplexity API
3. **Timeout:** 300s может быть недостаточно для PDF >100 страниц (monitor logs)

---

## 💡 Lessons Learned

1. **Multi-API workflows:** Системы могут использовать несколько AI провайдеров для разных этапов (search vs ranking)
2. **CORS production:** Всегда добавлять варианты с `www.` и без
3. **React file inputs:** Использовать `ref` вместо invisible overlay
4. **API response formats:** Всегда обрабатывать разные форматы (array vs object)
5. **Environment variables:** Backend vs Frontend (DISABLE_AUTH vs VITE_DISABLE_AUTH)

---

**При старте следующей сессии:**
```bash
1. Прочитай CLAUDE.md
2. Прочитай docs/archive/completed-sessions/SESSION_2026-02-10_PASSPORT_PRODUCTION_FIX.md
3. Проверь NEXT_SESSION.md — текущая фаза
4. Verify environment variables were added
5. Test production services
```

*Ready for next session!*
