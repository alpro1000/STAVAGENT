# NEXT SESSION — Tariff UI + Pump Unification Complete

**Date:** 2026-03-07
**Branch:** `claude/review-session-notes-bODxv`
**Status:** Tariff CRUD UI + Pump engine unification complete. 332 shared tests pass.

---

## What Was Done (2026-03-07, Session 4)

2 features implemented:

1. **TariffPage** (`Monolit-Planner/frontend/src/pages/TariffPage.tsx`)
   - New page at `/tariffs` — CRUD UI for supplier tariff management
   - View tariffs grouped by service type (pump/beton/bednění/doprava/jeřáb)
   - Add new tariff entry with multiple rates (key/value/unit/note)
   - Auto-closes overlapping active entries (`addTariff` logic from shared)
   - Price change indicators (▲/▼ %) current vs previous version
   - Tariff history per supplier (collapsible)
   - localStorage persistence (`monolit-tariff-registry`)
   - Navigation: "💰 Tarify" button added to Sidebar Nástroje section

2. **Pump Engine Unification** (`rozpocet-registry/src/services/pumpCalculator.ts`)
   - Rewritten to mirror shared `pump-engine.ts` API exactly
   - Same function signatures: `calculatePumpCost`, `compareSuppliers`, `calculateArrival`, `calculateOperation`, `calculateSurcharges`, `getDayType`
   - Accurate Easter algorithm (Gauss) replaces hardcoded `MM-DD` holidays
   - Adapter: converts flat JSON surcharge format (`saturday_pct`, `sunday_per_h`, flat) to structured `{model, value}`
   - Backward compat: `getSuppliers()` preserved for `PumpRentalSection.tsx`
   - TypeScript: both projects compile clean (tsc --noEmit)

### Previous Sessions (2026-03-07)
- Session 3: PlannerPage, PumpCalculatorPage (Portal), PortalBreadcrumb, Calendar date mapping
- Session 2 (2026-03-06): Planner Core Engines (4 modules, 129 tests)
- Session 1 (2026-03-06): Formwork refactor, Deep links, Write-backs

---

## Architecture: Monolit Frontend Pages

```
/                    → MainApp (positions table, KPI, import)
/planner             → PlannerPage (planElement() orchestrator UI)
/tariffs             → TariffPage (supplier tariff CRUD)  ← NEW
/registry/:projectId → RegistryView (unified position browse)
/r0/*                → R0App (deterministic core, elements/captures/schedule)
```

## Architecture: Portal Pages

```
/                    → PortalPage (services hub + project management)
/pump                → PumpCalculatorPage (standalone pump calculator)
```

---

## Implementation Priority (Next Sessions)

### Priority 1: Remaining UI
- [x] ~~Orchestrator UI~~ ✅ PlannerPage
- [x] ~~Calendar display~~ ✅ Calendar dates in PlannerPage
- [x] ~~Pump comparison~~ ✅ Standalone PumpCalculatorPage
- [x] ~~Tariff management~~ ✅ TariffPage with CRUD
- [x] ~~Pump engine in Registry~~ ✅ Unified API, accurate Easter

### Priority 2: Cross-System
- [x] ~~Breadcrumbs~~ ✅ PortalBreadcrumb component
- [ ] Template application workflow testing
- [ ] Two-way sync Portal ↔ Registry
- [ ] Monolit Position Write-back → Portal position_instance_id

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

1. **Deploy Portal Backend** to Render (migrations auto-apply)
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
| Concrete Maturity | 21 | Pass |
| PERT estimation | 20 | Pass |
| Pour Task Engine | 14 | Pass |
| Rebar Lite | 10 | Pass |
| Formwork 3-Phase | 8 | Pass |
| **Monolit shared total** | **332** | **Pass** |
| Monolit frontend TS | - | Compiles clean |
| Portal frontend TS | - | Compiles clean |
| Registry TS | - | Compiles clean |
| URS Matcher | 159 | Pass |
| **Grand Total** | **491+** | **Pass** |

---

## Commits This Session (2026-03-07, Session 4)

| # | Message | Files |
|---|---------|-------|
| 1 | FEAT: Add TariffPage — CRUD UI for supplier tariff management | TariffPage.tsx (NEW), App.tsx, Sidebar.tsx |
| 2 | REFACTOR: Unify pump engine in registry — mirror shared pump-engine API | pumpCalculator.ts |

---

**Version:** 2.4.0
**Last Updated:** 2026-03-07
