# NEXT SESSION — 2026-03-11 (Deck Pour + Skruž Rules)

## Краткое резюме последней сессии

- В `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` внедрены изменения по бизнес-логике непрерывной монолитной заливки без швов.
- Добавлены сверхурочные (+25% после 10ч) в стоимость бетонных работ.
- Для mostovková deska введена минимальная выдержка skruž 21 день от последней бетонной операции.
- Изменения закоммичены (`cc3ef1c`) и оформлены в PR с заголовком:
  `Handle uninterrupted bridge-deck pours with overtime and skruž hold`.

## Что проверить в следующей сессии

1. Пройтись по inline-комментариям к PR и уточнить спорные места реализации.
2. Добавить/обновить unit-тесты на:
   - overtime-расчет (граница 10h и >10h),
   - авто-скейл osádky при длинной заливке,
   - удлинение schedule при skruž hold.
3. При необходимости вынести параметры в конфиг:
   - max crew cap (12),
   - overtime threshold (10h),
   - overtime premium (1.25),
   - skruž hold days (21).

---

# NEXT SESSION — Session 9 Complete

**Date:** 2026-03-11
**Branch:** `claude/price-parser-integration-cCRX3`
**Status:** Session 9 — CORS fix (Amazon Q review), env vars documentation.

---

## What Was Done (2026-03-11, Session 9)

### 1. CORS Cleanup (Amazon Q review fix)
- `stavagent-portal/backend/server.js` — убраны 2 дублирующихся origin
- `Monolit-Planner/backend/server.js` — убраны 3 дублирующихся origin (3x одна и та же vercel.app, 2x одна и та же stavagent.cz)
- Commit: `d91d92b` — FIX: Remove duplicate CORS origins in portal and monolit server.js

### 2. Документация
- Составлен полный список env переменных для всех 5 сервисов
- Инструкция по Google Cloud Run: Console → Cloud Run → Edit & Deploy → Variables & Secrets

---

## What Was Done (2026-03-08, Session 8)

### 1. Betonárny Discovery — GPS-based concrete plant search
- **BetonServer scraper** — correct URL, anti-bot headers, robust HTML parsing
- **Price calculator panel** — real-time cost comparison per supplier (CZK/m³ × volume)
- **AWS Bedrock integration** — Claude via AWS Activate credits (fallback chain: Bedrock → Anthropic → Gemini)

### 2. Objednávka Betonu Page (Unified Ordering)
- **ObjednavkaBetonuPage** — `/objednavka-betonu` route, search + calculate + compare in one flow
- Infinite re-render loop fix (useEffect dependency cycle)
- Mobile-responsive layout

### 3. Performance: Lazy-load all pages
- **Bundle reduction**: 519KB → 407KB initial load (-22%)
- All pages lazy-loaded with `React.lazy()` + `Suspense`
- Vercel SPA routing fix (`vercel.json` rewrites)

### 4. CORE Proxy + Workflow Fixes
- **Portal backend proxy** to concrete-agent (`/api/core/*` → `concrete-agent-3uxelthc4q-ey.a.run.app/*`)
- Fixed all 5 workflows (file upload, Workflow A/B/C, Drawing Analysis)

### 5. Universal Parser Pipeline (4-step)
- Full positions table with quantities, units, prices
- 4-step flow: Upload → Parse → Review → Send to Kiosk
- Kiosk import buttons (Monolit, Registry, URS Matcher)

### 6. Curing Days Fix
- `elementTotalDays` теперь передаётся из PositionsTable → FormworkCalculatorModal
- Rental term correctly includes curing period

### Previous Sessions Summary
| Session | Date | Key Work |
|---------|------|----------|
| 9 | 2026-03-11 | CORS cleanup, env vars docs |
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
/pump                → PumpCalculatorPage (mobile-first pump calculator)
/price-parser        → PriceParserPage (PDF price list upload + comparison)
/objednavka-betonu   → ObjednavkaBetonuPage (search + calculate + compare)
/dashboard           → DashboardPage (auth required)
/admin               → AdminDashboard (auth required)
```

## Architecture: Monolit Frontend Pages

```
/                    → MainApp (positions table, KPI, import)
/planner             → PlannerPage (planElement() orchestrator UI)
/tariffs             → TariffPage (supplier tariff CRUD)
/registry/:projectId → RegistryView (unified position browse)
/r0/*                → R0App (deterministic core, elements/captures/schedule)
```

---

## Full Environment Variables Reference

### concrete-agent (GCR)
```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
MULTI_ROLE_LLM=gemini
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...           # optional, Bedrock
AWS_SECRET_ACCESS_KEY=...       # optional, Bedrock
AWS_DEFAULT_REGION=eu-central-1
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...           # optional
PERPLEXITY_API_KEY=pplx-...
GOOGLE_CLIENT_ID=...            # optional, Drive
GOOGLE_CLIENT_SECRET=...        # optional, Drive
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

## Google Cloud Run — Как вносить переменные

```
console.cloud.google.com
→ Cloud Run
→ Выбрать сервис (например, concrete-agent)
→ кнопка "Edit & Deploy New Revision"
→ вкладка "Variables & Secrets"
→ "+ Add Variable"
→ Вводить по одной или загрузить .env через gcloud CLI:
```

```bash
# Через gcloud CLI (рекомендуется для bulk):
gcloud run services update concrete-agent \
  --region=europe-west4 \
  --set-env-vars ANTHROPIC_API_KEY=sk-ant-...,GOOGLE_API_KEY=...,GEMINI_MODEL=gemini-2.5-flash-lite
```

---

## Implementation Priority (Next Sessions)

### Priority 1: End-to-End Testing & Deploy
- [ ] **Deploy concrete-agent** to GCR (price-parser + proxy endpoints)
- [ ] **Deploy Portal** to Vercel (all new pages + CORE proxy)
- [ ] **Deploy Monolit** to Vercel (planner + tariffs + vercel.json SPA fix)
- [ ] **Set env vars** in GCR for all services
- [ ] **Test with real PDFs** — run price parser on actual supplier price lists
- [ ] **Test Betonárny discovery** — verify GPS search + scraping in production

### Priority 2: Formwork Calculator Audit
- [x] Curing days flow: table → calculator → scheduler (FIXED)
- [ ] Verify rental cost includes full curing period in production

### Priority 3: Cross-System Integration
- [ ] Kiosk import buttons end-to-end (Monolit, Registry, URS)
- [ ] End-to-end production testing with Portal DB

### Priority 4: Phase 2 Engines — R0 Core Gaps

| # | Gap | Описание | Сложность |
|---|-----|----------|-----------|
| G1 | `move`/`inspection` узлы DAG | move_clean_hours → полноценный Activity в DAG | Medium |
| G2 | Кран/насос resource constraints | crane + pump как shared resources в forward pass | Hard |
| G3 | Calendar-aware forward pass | Праздники/выходные прямо в DAG, не post-hoc | Medium |
| G4 | Weather stochastic | P(rain) сезон → PERT множитель | Easy |
| G5 | Supply chain delays | Lead-time бетона/арматуры как predecessor edge | Medium |
| G6 | Resource leveling | Выравнивание пиков crew, сдвиг non-critical | Hard |
| G7 | Scenario comparison UI | vary sets/crews → side-by-side таблица + chart | Medium |
| G8 | Optimization mode | Minimize cost vs time — Pareto front | Hard |

### Priority 5: Quality
- [ ] Vitest migration for Monolit frontend
- [ ] React Error Boundaries
- [ ] Node.js 18.x → 20.x upgrade

---

## User Action Required (Deploy)

1. **Set env vars** в GCR для каждого сервиса (см. полный список выше)
2. **Deploy concrete-agent** (new endpoints: price-parser, proxy)
3. **Deploy Portal Frontend** to Vercel (6 new pages + CORE proxy backend)
4. **Deploy Monolit Frontend** to Vercel (vercel.json SPA routing + new routes)
5. **Execute** `БЫСТРОЕ_РЕШЕНИЕ.sql` in Monolit DB (FF_AI_DAYS_SUGGEST)

---

## Testing Status

| Component | Tests | Status |
|-----------|-------|--------|
| Monolit formulas | 55 | Pass |
| Planner Orchestrator | 40 | Pass |
| Calendar Engine | 35 | Pass |
| Shared Pump Engine | 30 | Pass |
| Element Scheduler | 27 | Pass |
| Element Classifier | 26 | Pass |
| Tariff Versioning | 24 | Pass |
| Pour Decision | 22 | Pass |
| Price Parser (CORE) | 21 | Pass |
| Concrete Maturity | 21 | Pass |
| PERT estimation | 20 | Pass |
| Pour Task Engine | 14 | Pass |
| Rebar Lite | 10 | Pass |
| Formwork 3-Phase | 8 | Pass |
| **Monolit shared total** | **332** | **Pass** |
| URS Matcher | 159 | Pass |
| **Grand Total** | **512+** | **Pass** |

---

## Quick Start Commands

```bash
# === КОМАНДА ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ ===
cd /home/user/STAVAGENT && \
git checkout claude/price-parser-integration-cCRX3 && \
git pull origin claude/price-parser-integration-cCRX3 && \
echo "=== Branch ready ===" && \
git log --oneline -5 && \
echo "=== Running shared tests ===" && \
cd Monolit-Planner/shared && npx vitest run 2>&1 | tail -5 && \
echo "=== Portal build check ===" && \
cd ../../stavagent-portal/frontend && npx tsc --noEmit 2>&1 | tail -3 && \
echo "=== All checks done ==="
```

```bash
# Run all shared tests (332)
cd Monolit-Planner/shared && npx vitest run

# Build Portal frontend
cd stavagent-portal/frontend && npm run build

# Start Monolit dev
cd Monolit-Planner/backend && npm run dev   # :3001
cd Monolit-Planner/frontend && npm run dev  # :5173

# Start Portal dev
cd stavagent-portal && npm run dev

# Test price parser
cd concrete-agent/packages/core-backend
PYTHONPATH=. python -m pytest tests/test_price_parser.py -v

# Parse a PDF (API)
curl -X POST http://localhost:8000/api/v1/price-parser/parse \
  -F "file=@cenik_beton.pdf"

# Set env vars in GCR via CLI (пример)
gcloud run services update concrete-agent \
  --region=europe-west4 \
  --set-env-vars ANTHROPIC_API_KEY=sk-ant-...
```

---

**Version:** 2.9.0
**Last Updated:** 2026-03-11
