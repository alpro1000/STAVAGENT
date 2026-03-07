# NEXT SESSION — Price Parser Integration Complete

**Date:** 2026-03-07
**Branch:** `claude/price-parser-integration-jeClp`
**Status:** Session 7 complete — Price Parser UI + batch comparison + service registration.

---

## What Was Done (2026-03-07, Session 7)

### Price Parser Integration (Portal)

1. **PriceParserPage.tsx** — Full standalone page at `/price-parser`
   - Drag-and-drop PDF upload (single or multiple)
   - Real-time parsing via `POST /api/v1/price-parser/parse` (concrete-agent)
   - Active job progress indicators
   - Error handling with per-file status

2. **Batch Supplier Comparison** — Upload multiple PDF price lists
   - Side-by-side concrete price comparison table (C20/25, C25/30, C30/37...)
   - Lowest price highlighted in green, price difference % shown
   - Delivery zone comparison across suppliers
   - Pump pricing comparison (per supplier)
   - Surcharges comparison (časové, zimní, technologické)
   - Malty/potěry and laboratory services sections
   - Supplier metadata display (company, provozovna, platnost)

3. **API Integration** (`api.ts`)
   - `priceParserAPI.parse(file)` — sends PDF to CORE, returns structured PriceListResult
   - Full TypeScript types for all 7 sections (BetonItem, Doprava, Cerpadla, etc.)

4. **Service Registration**
   - Added "Ceníky dodavatelů" to Portal SERVICES array (active status)
   - Route `/price-parser` registered in App.tsx (public, no auth)
   - Build verified: `tsc && vite build` passes clean

### Previous Sessions (2026-03-07)

**Session 6** — Calculator Logic Audit: 3 bugs fixed, 332 tests pass
**Session 5** — TariffPage + Pump engine unification
**Session 4** — PDF Price Parser backend (17 files, 7 parsers, 21 tests)
**Session 3** — PumpCalculatorPage, PlannerPage, Calendar dates, PortalBreadcrumb
**Sessions 1-2** — Formwork refactor, Core engines, Maturity/PERT

---

## Architecture: Portal Frontend Pages

```
/                    → LandingPage
/portal              → PortalPage (services hub + projects)
/pump                → PumpCalculatorPage (mobile-first pump calculator)
/price-parser        → PriceParserPage (PDF price list upload + comparison)
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

### Priority 1: Price Parser — End-to-End Testing
- [x] **Frontend upload UI** — PriceParserPage at `/price-parser`
- [x] **Batch processing** — multi-PDF upload + comparison table
- [ ] **Test with real PDFs** — run parser on actual supplier price lists (requires deploy)
- [ ] **Save parsed results** — store in Portal DB for historical comparison

### Priority 2: Cross-System (Already Implemented)
- [x] Monolit Position Write-back → Portal `position_instance_id` (portalWriteBack.js)
- [x] Two-way sync Portal ↔ Registry (integration.js + backendSync.ts)
- [ ] Template application workflow testing
- [ ] End-to-end production testing with Portal DB

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
2. **Deploy Portal Frontend** to Vercel (new `/price-parser` route + service card)
3. **Deploy Monolit Frontend** to Vercel (new /planner, /tariffs routes + breadcrumbs)
4. **Environment Variables** on Render:
   - `PERPLEXITY_API_KEY` for concrete-agent
   - `OPENAI_API_KEY` for concrete-agent
   - Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Monolit DB

---

## Key Files Changed (Session 7)

| File | Lines | Change |
|------|-------|--------|
| `stavagent-portal/frontend/src/pages/PriceParserPage.tsx` | ~620 | NEW — Full price parser UI with batch comparison |
| `stavagent-portal/frontend/src/services/api.ts` | +95 | Price parser API types + `priceParserAPI.parse()` |
| `stavagent-portal/frontend/src/App.tsx` | +3 | Route `/price-parser` |
| `stavagent-portal/frontend/src/pages/PortalPage.tsx` | +9 | Service card "Ceníky dodavatelů" |

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
# Run all shared tests (332)
cd Monolit-Planner/shared && npx vitest run

# Build Portal frontend
cd stavagent-portal/frontend && npm run build

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

**Version:** 2.7.0
**Last Updated:** 2026-03-07
