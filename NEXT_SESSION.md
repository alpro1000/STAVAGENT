# NEXT SESSION - Phase 1 Planner Core Complete

**Date:** 2026-03-06
**Branch:** `claude/review-next-session-Zjn4C`
**Status:** Phase 1 Planner engines complete (332 tests), deploy pending

---

## What Was Done (2026-03-06)

### Session 2: Planner Core Engines (this session)
4 new modules, 129 new tests:

1. **Planner Orchestrator** (40 tests) — single entry point combining ALL engines:
   Element Classifier → Pour Decision → Formwork → Rebar Lite → Pour Task → Scheduler → PERT
2. **Calendar Engine** (35 tests) — Czech holidays (13/year), working days, Easter algorithm
3. **Shared Pump Engine** (30 tests) — unified for Registry + Planner, 3 billing models, surcharges
4. **Tariff Versioning** (24 tests) — historical pricing, inflation adjustment, price comparison

### Session 1: Formwork + Deep Links + Vision
1. Formwork refactor: consolidate 3 duplications into shared/, ceil() fix, curing transfer
2. Deep links: PositionsPanel, KioskLinksPanel routing, ProjectCard URLs, TOVModal
3. Write-backs: Monolit → Portal + Registry → Portal
4. `docs/PRODUCT_VISION_AND_ROADMAP.md` — complete product vision

---

## Architecture: Calculation Engines (all in `Monolit-Planner/shared/src/`)

```
calculators/
├── planner-orchestrator.ts    ← NEW: Top-level entry point (wires all below)
├── element-scheduler.ts       ← DAG + CPM + RCPSP + Gantt (27 tests)
├── pert.ts                    ← PERT + Monte Carlo simulation (20 tests)
├── maturity.ts                ← Concrete curing ČSN EN 13670 (21 tests)
├── pour-decision.ts           ← Pour mode tree (22 tests)
├── pour-task-engine.ts        ← Pour duration + pump (14 tests)
├── formwork.ts                ← 3-phase cost + strategies (8 tests)
├── rebar-lite.ts              ← Element-aware rebar (10 tests)
├── rebar.ts                   ← Base rebar calculator
├── concreting.ts              ← Pump cost calculator
├── calendar-engine.ts         ← NEW: Czech holidays + working days (35 tests)
├── pump-engine.ts             ← NEW: Shared pump cost engine (30 tests)
├── tariff-versioning.ts       ← NEW: Supplier price history (24 tests)
├── types.ts                   ← Shared TypeScript interfaces
└── index.ts                   ← Re-exports everything

classifiers/
├── element-classifier.ts      ← Element type profiles (26 tests)
└── element-classifier.test.ts

constants-data/
├── formwork-systems.ts        ← 8 formwork system specs
└── index.ts
```

---

## Implementation Priority (Next Sessions)

### Priority 1: UI Integration (use new engines in frontend)
- [ ] **Orchestrator UI** — form for `planElement()` input, display full plan result
- [ ] **Calendar display** — convert schedule work-days to calendar dates in Gantt
- [ ] **Pump comparison table** — use shared pump engine in Registry
- [ ] **Tariff management** — simple CRUD UI for tariff entries

### Priority 2: Cross-System
- [ ] Breadcrumbs (Portal ← Kiosk back-navigation)
- [ ] Template application workflow testing
- [ ] Two-way sync Portal ↔ Registry

### Priority 3: Phase 2 Engines
- [ ] Resource leveling (crew/crane/kit constraints)
- [ ] Scenario comparison (vary sets/crews, compare total days + cost)
- [ ] Optimization modes (minimize cost vs minimize time)

---

## User Action Required (Deploy)

1. **Deploy Portal Backend** to Render (migrations auto-apply)
2. **Environment Variables** on Render:
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
| URS Matcher | 159 | Pass |
| rozpocet-registry TS | - | Compiles clean |
| **Grand Total** | **491+** | **Pass** |

---

**Version:** 2.2.0
**Last Updated:** 2026-03-06
