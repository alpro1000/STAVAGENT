# NEXT SESSION — Calculator Logic Audit + Bug Fixes Complete

**Date:** 2026-03-07
**Branch:** `claude/review-session-notes-bODxv`
**Status:** Session 6 complete — 3 logic bugs fixed in shared calculators. 332 tests pass.

---

## What Was Done (2026-03-07, Session 6)

### Calculator Audit + Bug Fixes (`Monolit-Planner/shared`)

Full logic review of all 7 calculation engines. Found and fixed 3 real bugs:

**Bug 1 — СЕРЬЁЗНЫЙ: `calculateEstimatedWeeks` (formulas.ts)**
- В режиме `days_per_month=22` делилось на 7 (calendar days/week) вместо 5 (working days/week)
- Ошибка ~40%: показывало 13.4 недели вместо правильных 18.7 рабочих недель
- Fix: `days_per_week = days_per_month === 22 ? 5 : 7`
- Тест обновлён

**Bug 2 — СРЕДНИЙ: мёртвая переменная `effectiveRebarDays` (formwork.ts)**
- Переменная вычислялась, но никогда не использовалась в `calculateFullCycleRentalDays`
- Формула `prepDays` дублировала логику через другое выражение
- Fix: удалена мёртвая переменная, формула упрощена с правильным комментарием

**Bug 3 — СРЕДНИЙ: нет защиты от `available_pumping_h ≤ 0` (pour-decision.ts)**
- Если `t_window ≤ setup + washout`, деление давало `Infinity`/`NaN` — тихое NaN-распространение
- Fix: ранний `throw` с описательным сообщением

### Что проверено и признано корректным:
- `element-scheduler.ts` — DAG, Kahn topo sort, CPM, chess mode ✓
- `maturity.ts` — Nurse-Saul, таблица ČSN EN 13670, cement factors ✓
- `pert.ts` — triangular distribution, Monte Carlo, seeded RNG ✓
- `formwork.ts` — strategy A/B/C, cadence, 3-phase cost ✓
- `concreting.ts` — pump time, cost, `calculateRequiredPumpCapacity` ✓
- `rebar-lite.ts` — mass estimation, crew recommendation ✓
- `pour-decision.ts` — decision tree, T-window lookup, multi-pump ✓

### Previous Sessions (2026-03-07)

**Session 5** — TariffPage + Pump engine unification:
1. **TariffPage** (`Monolit-Planner/frontend/src/pages/TariffPage.tsx`) — CRUD UI at `/tariffs`
2. **Pump engine unification** (`rozpocet-registry`) — mirror shared `pump-engine.ts` API, accurate Easter algorithm

**Session 4** — PDF Price Parser (`concrete-agent`):
- 17 files, 7 section parsers, 21 tests
- `POST /api/v1/price-parser/parse`

**Session 3** — UI Integration:
- PumpCalculatorPage, PlannerPage, Calendar dates, PortalBreadcrumb

**Sessions 1-2** — Formwork refactor, Core engines, Maturity/PERT

---

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

### Priority 1: Price Parser Integration
- [ ] **Test with real PDFs** — run parser on actual supplier price lists
- [ ] **Frontend upload UI** — Price Parser page in Portal or standalone
- [ ] **Batch processing** — parse multiple PDFs, compare suppliers

### Priority 2: Cross-System
- [ ] Template application workflow testing
- [ ] Two-way sync Portal ↔ Registry
- [ ] Monolit Position Write-back → Portal `position_instance_id`

### Priority 3: Phase 2 Engines
- [ ] Resource leveling (crew/crane/kit constraints)
- [ ] Scenario comparison (vary sets/crews, compare total days + cost)
- [ ] Optimization modes (minimize cost vs minimize time)

### Priority 4: Quality
- [ ] Vitest migration for Monolit frontend
- [ ] React Error Boundaries
- [ ] Node.js 18.x → 20.x upgrade

---

## User Action Required (Deploy)

1. **Deploy concrete-agent** to Render (new `/api/v1/price-parser/parse` endpoint)
2. **Deploy Portal Frontend** to Vercel (new /pump route)
3. **Deploy Monolit Frontend** to Vercel (new /planner, /tariffs routes + breadcrumbs)
4. **Environment Variables** on Render:
   - `PERPLEXITY_API_KEY` for concrete-agent
   - `OPENAI_API_KEY` for concrete-agent
   - Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Monolit DB

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
# Run all shared tests (332)
cd Monolit-Planner/shared && npx vitest run

# Start Monolit dev
cd Monolit-Planner/backend && npm run dev   # :3001
cd Monolit-Planner/frontend && npm run dev  # :5173

# Test price parser
cd concrete-agent/packages/core-backend
PYTHONPATH=. python -m pytest tests/test_price_parser.py -v

# Parse a PDF (API)
curl -X POST http://localhost:8000/api/v1/price-parser/parse \
  -F "file=@cenik_beton.pdf"
```

---

**Version:** 2.6.0
**Last Updated:** 2026-03-07
