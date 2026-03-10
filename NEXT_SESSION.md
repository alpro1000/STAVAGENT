# NEXT SESSION — Session 8 Complete

**Date:** 2026-03-08
**Branch:** `claude/price-parser-integration-jeClp`
**Status:** Session 8 complete — Betonárny discovery, AWS Bedrock, Objednávka betonu, Universal Parser pipeline, curing days fix.

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
- **Portal backend proxy** to concrete-agent (`/api/core/*` → `concrete-agent-1086027517695.europe-west3.run.app/*`)
- Fixed all 5 workflows (file upload, Workflow A/B/C, Drawing Analysis)
- Drawing Analysis UI with GPT-4 Vision integration

### 5. Universal Parser Pipeline (4-step)
- Full positions table with quantities, units, prices
- 4-step flow: Upload → Parse → Review → Send to Kiosk
- Kiosk import buttons (Monolit, Registry, URS Matcher) with bidirectional push

### 6. CorePanel Rewrite
- Replaced all Tailwind classes with inline styles (portal uses Digital Concrete CSS, not Tailwind)

### 7. Curing Days Fix (Formwork Calculator)
- **BUG FOUND**: `elementTotalDays` was NOT passed to `FormworkCalculatorModal` from `PositionsTable`
- Calculator always received `0`, falling back to formwork-only duration for rental calculation
- **FIX**: Now passes `elementTotalDays` + `currentPartName` from PositionsTable → FormworkCalculatorModal
- Rental term now correctly includes curing period

### Previous Sessions Summary
| Session | Date | Key Work |
|---------|------|----------|
| 7 | 2026-03-07 | Price Parser UI, batch comparison, service registration |
| 6 | 2026-03-07 | Calculator audit: 3 bugs fixed, 332 tests |
| 5 | 2026-03-07 | TariffPage + Pump engine unification |
| 4 | 2026-03-07 | PDF Price Parser backend (17 files, 7 parsers, 21 tests) |
| 3 | 2026-03-07 | PumpCalculatorPage, PlannerPage, Calendar dates |
| 1-2 | 2026-03-06 | Formwork refactor, PERT/Maturity, MaturityConfigPanel |

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

## Implementation Priority (Next Sessions)

### Priority 1: End-to-End Testing & Deploy
- [ ] **Deploy concrete-agent** to Render (price-parser + proxy endpoints)
- [ ] **Deploy Portal** to Vercel (all new pages + CORE proxy)
- [ ] **Deploy Monolit** to Vercel (planner + tariffs + vercel.json SPA fix)
- [ ] **Test with real PDFs** — run price parser on actual supplier price lists
- [ ] **Test Betonárny discovery** — verify GPS search + scraping in production

### Priority 2: Formwork Calculator Audit
- [x] Curing days flow: table → calculator → scheduler (FIXED)
- [ ] Verify rental cost includes full curing period in production
- [ ] Test MaturityConfigPanel → curing_days transfer end-to-end

### Priority 3: Cross-System Integration
- [ ] Template application workflow testing
- [ ] Kiosk import buttons end-to-end (Monolit, Registry, URS)
- [ ] End-to-end production testing with Portal DB

### Priority 4: Phase 2 Engines — R0 Core Gaps (Audit 2026-03-08)

**Аудит проведён:** 8/10 пунктов реализованы, 2 частично. Спрашивай в начале каждой сессии: «Будем реализовывать один из gaps?»

| # | Gap | Описание | Сложность |
|---|-----|----------|-----------|
| G1 | `move` / `inspection` узлы DAG | Сейчас move_clean_hours — плоское число, не узел графа. Добавить как отдельные Activity в DAG → влияет на critical path | Medium |
| G2 | Кран / насос как resource constraints | Сейчас только crews + sets. Добавить crane (shared, 1 unit) и pump (shared, blockout window) как ресурсы в forward pass | Hard |
| G3 | Calendar-aware forward pass | Сейчас DAG считает в work-days, calendar-engine — post-hoc маппинг. Интегрировать праздники/выходные прямо в forward pass | Medium |
| G4 | Weather stochastic | Расширить PERT: вероятность дождя (сезон → P(rain)) как множитель на outdoor activities | Easy |
| G5 | Supply chain delays | Добавить lead-time для бетона (заказ → доставка) и арматуры как predecessor edge в DAG | Medium |
| G6 | Resource leveling (post-CPM) | После CPM: выровнять пики crew utilization, сдвигая non-critical activities в пределах float | Hard |
| G7 | Scenario comparison UI | Frontend: vary sets/crews, compare total_days + cost side-by-side (таблица + chart) | Medium |
| G8 | Optimization mode | Minimize cost vs minimize time (Pareto front): перебор sets×crews→ dominance filtering | Hard |

**Полностью реализовано (8/10):**
- ✅ DAG + RCPSP + CPM (element-scheduler.ts, 631 lines)
- ✅ PERT + Monte Carlo (pert.ts, 256 lines, seeded PRNG)
- ✅ Concrete maturity ČSN EN 13670 (maturity.ts, 477 lines)
- ✅ Formwork 3-phase cost (formwork.ts, 411 lines)
- ✅ Pour decision tree (pour-decision.ts, 390 lines)
- ✅ Element classifier (8 types, 400+ lines)
- ✅ Pump engine (3 billing models, surcharges, supplier comparison)
- ✅ Planner orchestrator (459 lines, wires all engines)
- ✅ Calendar engine (holidays, work days, Easter)
- ✅ 332 tests passing

### Competitive Intelligence: Brickanta (YC F25)

**Спрашивай в начале сессии: «Хочешь работать над конкурентным преимуществом vs Brickanta?»**

**Brickanta** — «Cursor для строительных смет», Стокгольм, YC Fall 2025, 8 человек.
- **Модуль 1:** AI Document Analysis — ищет пропущенные позиции, несоответствия нормам, риски перерасходов
- **Модуль 2:** Repackaging — автоматическое создание RFP пакетов (3-4ч → 15мин)
- **Модуль 3:** Knowledge Capture — AI-поиск по всем документам проекта

**Их фокус:** Eurocodes (Швеция), MS SharePoint/Outlook/Teams, крупный бизнес, top-down.

| Слабость Brickanta | Сила StavAgent |
|---|---|
| Нет OTSKP/DSS локализации | OTSKP подключена, URS Matcher |
| Eurocodes ≠ чешский DSS/ČSN | ČSN EN 13670, чешские нормы в KB |
| Корпоративный Microsoft-стек | Веб-сервис для малого/среднего бизнеса |
| Нет калькуляторов (бетон, опалубка, арматура) | R0 Core: 9 калькуляторов, 332 теста |
| Нет планирования (DAG/CPM/PERT) | Element Scheduler + Monte Carlo |
| Команда далеко от чешского рынка | Berger Bohemia — потребитель своего продукта |

**Стратегия:** Они идут сверху (корпорации), мы — снизу (сметчики). Разные рынки, но если придут в Чехию раньше выхода StavAgent — занять позицию будет сложнее.

### Priority 5: Quality
- [ ] Vitest migration for Monolit frontend
- [ ] React Error Boundaries
- [ ] Node.js 18.x → 20.x upgrade

---

## User Action Required (Deploy)

1. **Deploy concrete-agent** to Render (new endpoints: price-parser, proxy)
2. **Deploy Portal Frontend** to Vercel (6 new pages + CORE proxy backend)
3. **Deploy Monolit Frontend** to Vercel (vercel.json SPA routing + new routes)
4. **Environment Variables** on Render:
   - `PERPLEXITY_API_KEY` for concrete-agent
   - `OPENAI_API_KEY` for concrete-agent
   - `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (optional, for Bedrock)
   - Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Monolit DB

---

## Key Files Changed (Session 8)

| File | Lines | Change |
|------|-------|--------|
| `stavagent-portal/frontend/src/pages/ObjednavkaBetonuPage.tsx` | ~400 | NEW — Unified ordering page |
| `stavagent-portal/frontend/src/services/betonServerScraper.ts` | ~180 | NEW — BetonServer plant scraper |
| `stavagent-portal/frontend/src/components/portal/PriceCalculatorPanel.tsx` | ~200 | NEW — Price comparison calculator |
| `stavagent-portal/frontend/src/services/bedrockClient.ts` | ~120 | NEW — AWS Bedrock integration |
| `stavagent-portal/frontend/src/components/portal/CorePanel.tsx` | ~300 | REWRITE — Tailwind → inline styles |
| `stavagent-portal/frontend/src/App.tsx` | +20 | Lazy-load all pages + new routes |
| `stavagent-portal/backend/src/routes/core-proxy.js` | ~50 | NEW — CORE proxy route |
| `Monolit-Planner/frontend/src/components/PositionsTable.tsx` | +5 | FIX — Pass elementTotalDays to FormworkCalc |
| `Monolit-Planner/vercel.json` | NEW | SPA routing rewrites |

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
| Portal frontend | — | Build OK |
| **Grand Total** | **512+** | **Pass** |

---

## Quick Start Commands

```bash
# === START OF SESSION COMMAND ===
# Run this at the beginning of the next session:

cd /home/user/STAVAGENT && \
git checkout claude/price-parser-integration-jeClp && \
git pull origin claude/price-parser-integration-jeClp && \
echo "=== Branch ready ===" && \
echo "=== Recent commits ===" && \
git log --oneline -10 && \
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
```

---

**Version:** 2.8.0
**Last Updated:** 2026-03-08
