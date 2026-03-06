# NEXT SESSION - Product Vision Documented + Deep Links Complete

**Date:** 2026-03-06
**Branch:** `claude/review-next-session-Zjn4C`
**Status:** All code tasks done, product vision documented, deploy pending

---

## Key Document

**`docs/PRODUCT_VISION_AND_ROADMAP.md`** — full product architecture, math model layers, MVP roadmap, commercial packaging. Read this first.

---

## What Was Done (2026-03-06)

### Code (8 commits)
1. Formwork refactor: consolidate 3 duplications into shared/, ceil() fix, curing transfer
2. Deep links: PositionsPanel, KioskLinksPanel routing, ProjectCard URLs, TOVModal + ItemsTable position_instance_id
3. Write-backs confirmed: Monolit -> Portal (portalWriteBack.js) + Registry -> Portal (dovWriteBack.ts)

### Documentation
- `docs/PRODUCT_VISION_AND_ROADMAP.md` — complete product vision from architecture discussion

---

## Implementation Priority (Next Sessions)

### Priority 1: Planner Core Engines (Phase 1 remainder)
Existing foundation: Graph Builder + CPM + RCPSP + PERT + Maturity (145 tests)

Still needed:
- [ ] **Element Classifier** — identify structure type (zaklad/stena/sloup/opora/mostovka)
- [ ] **Formwork Engine** — 3-phase calculation (assembly/relocation/stripping), 3 capture modes
- [ ] **Rebar Lite Engine** — mass, duration, crew estimate, specific ratios by element
- [ ] **Pour Task Engine** — duration, window, pump flag, delivery rate
- [ ] **Planner Orchestrator** — combine all engines into single monolithic cycle

### Priority 2: Pump Calculator Enhancement
Existing: multi-supplier calculator (3 billing models, 25-40 m3/h practical data)

Still needed:
- [ ] Lite mode UI (quick estimate for estimator)
- [ ] Detailed mode UI (full breakdown for site manager)
- [ ] Calendar logic (holidays, weekends, overtime surcharges)
- [ ] Supplier registry with tariff versioning
- [ ] TOV integration (shared Pump Engine)

### Priority 3: Cross-System
- [ ] Breadcrumbs (Portal <- Kiosk back-navigation)
- [ ] Template application workflow testing
- [ ] Two-way sync Portal <-> Registry

### Priority 4: Phase 2 (after Phase 1 complete)
- [ ] Calendar Engine (work windows, non-working days)
- [ ] Resource leveling (crew/crane/kit constraints)
- [ ] Pump Lite mode integration into Planner

### Priority 5: Phase 3
- [ ] Monte Carlo simulation
- [ ] Scenario comparison
- [ ] Optimization modes

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
| PERT estimation | 20 | Pass |
| Concrete maturity | 21 | Pass |
| Pour decision | 22 | Pass |
| RCPSP scheduler | 27 | Pass |
| URS Matcher | 159 | Pass |
| rozpocet-registry TS | - | Compiles clean |
| **Total** | **304+** | **Pass** |

---

**Version:** 2.1.0
**Last Updated:** 2026-03-06
