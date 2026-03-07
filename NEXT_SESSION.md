# NEXT SESSION — Tariff UI + Pump Unification Complete

**Date:** 2026-03-07
**Branch:** `claude/review-session-notes-bODxv`
**Status:** Session 5 complete — Tariff CRUD UI + Pump engine unification. 332 shared tests + 21 price parser tests pass.

---

## What Was Done (2026-03-07, Session 5)

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
   - Maршрут `/tariffs` добавлен в `App.tsx`

2. **Pump Engine Unification** (`rozpocet-registry/src/services/pumpCalculator.ts`)
   - Rewritten to mirror shared `pump-engine.ts` API exactly
   - Same function signatures: `calculatePumpCost`, `compareSuppliers`, `calculateArrival`, `calculateOperation`, `calculateSurcharges`, `getDayType`
   - Accurate Easter algorithm (Gauss) replaces hardcoded `MM-DD` holidays
   - Adapter: converts flat JSON surcharge format (`saturday_pct`, `sunday_per_h`, flat) to structured `{model, value}`
   - Backward compat: `getSuppliers()` preserved for `PumpRentalSection.tsx`
   - TypeScript: both projects compile clean

### Session 4 (2026-03-07) — PDF Price Parser (`concrete-agent`)
Complete module for parsing concrete supplier PDF price lists into structured JSON.

**Pipeline:** `PDF → pdfplumber extract → LLM classify blocks → parse 7 sections → Pydantic validate → JSON`

**Files created (17):**
```
concrete-agent/packages/core-backend/app/services/price_parser/
├── __init__.py          — public API (parse_price_list, parse_price_list_from_bytes)
├── models.py            — Pydantic v2 schemas (Source, BetonItem, Doprava, Cerpadla, Priplatky, etc.)
├── extractor.py         — pdfplumber text extraction + pytesseract OCR fallback
├── llm_client.py        — Gemini (default, cheap) → Claude Haiku fallback, JSON retry (2 attempts)
├── classifier.py        — LLM block classification into 7 sections (Czech prompts)
├── main.py              — async pipeline with asyncio.gather parallel section parsing
└── parsers/
    ├── betony.py         — regex-first (C XX/YY pattern) + LLM fallback if < 3 matches
    ├── doprava.py        — delivery zones, waiting fees, min volume
    ├── cerpadla.py       — pump types, hourly rates, km rates
    ├── priplatky.py      — 3 categories: časové/zimní/technologické
    ├── laborator.py      — lab services, sample costs
    ├── malty.py           — mortars/screeds
    └── source.py          — company metadata, validity dates, VAT

concrete-agent/packages/core-backend/app/api/routes_price_parser.py  — POST /api/v1/price-parser/parse
concrete-agent/packages/core-backend/app/api/__init__.py             — router registered
concrete-agent/packages/core-backend/tests/test_price_parser.py      — 21 tests
```

**API Endpoint:** `POST /api/v1/price-parser/parse` (upload PDF → get structured JSON)

**Key Design Decisions:**
- Gemini as default LLM (cheap), Claude Haiku as fallback
- Regex for concrete items (fast), LLM only if regex finds < 3 items
- Parallel parsing of all 7 sections via `asyncio.gather`
- JSON retry with clarifying prompt on parse failure
- OCR fallback via pytesseract if pdfplumber yields < 60% valid chars

### Previous Sessions (2026-03-07)
- Session 3: UI Integration — PumpCalculatorPage, PlannerPage, Calendar dates, PortalBreadcrumb
- Session 2: Planner Core Engines (4 modules, 129 tests)
- Session 1: Formwork refactor, Deep links, Write-backs, Product Vision

---

## Architecture: Monolit Frontend Pages

```
/                    → MainApp (positions table, KPI, import)
/planner             → PlannerPage (planElement() orchestrator UI)
/tariffs             → TariffPage (supplier tariff CRUD)  ← NEW (session 5)
/registry/:projectId → RegistryView (unified position browse)
/r0/*                → R0App (deterministic core, elements/captures/schedule)
```

## Architecture: Portal Pages

```
/                    → PortalPage (services hub + project management)
/pump                → PumpCalculatorPage (standalone pump calculator)
```

## Architecture: Price Parser in CORE

```
POST /api/v1/price-parser/parse (PDF upload)
    │
    ▼
extractor.py → pdfplumber (text + tables) or OCR fallback
    │
    ▼
classifier.py → LLM splits text into 7 blocks
    │
    ▼
parsers/*.py → each block parsed (regex + LLM)
    │
    ▼
models.py → Pydantic validation → PriceListResult JSON
```

**Output JSON schema:**
```json
{
  "source": { "company", "provozovna", "valid_from", "valid_to", "currency", "vat_rate" },
  "betony": [{ "name", "exposure_class", "price_per_m3", "price_per_m3_vat", "notes" }],
  "malty_potere": [{ "name", "type", "price_per_m3", "price_per_m3_vat" }],
  "doprava": { "min_objem_m3", "volny_cas_min", "cekani_per_15min", "zony[]", "pristaveni_ks" },
  "cerpadla": [{ "type", "pristaveni", "hodinova_sazba", "cena_per_m3", "km_sazba" }],
  "priplatky": { "casove[]", "zimni[]", "technologicke[]" },
  "laborator": [{ "nazev", "jednotka", "cena" }]
}
```

---

## Implementation Priority (Next Sessions)

### Priority 1: Price Parser Integration
- [ ] **Test with real PDFs** — run parser on actual supplier price lists
- [ ] **Frontend upload UI** — Price Parser page in Portal or standalone
- [ ] **Batch processing** — parse multiple PDFs, compare suppliers
- [ ] **Price comparison table** — side-by-side supplier comparison

### Priority 2: Remaining UI
- [x] ~~Tariff management~~ ✅ TariffPage with CRUD (session 5)
- [x] ~~Pump engine in Registry~~ ✅ Unified API, accurate Easter (session 5)

### Priority 3: Cross-System
- [ ] Template application workflow testing
- [ ] Two-way sync Portal ↔ Registry
- [ ] Monolit Position Write-back → Portal position_instance_id

### Priority 4: Phase 2 Engines
- [ ] Resource leveling (crew/crane/kit constraints)
- [ ] Scenario comparison (vary sets/crews, compare total days + cost)
- [ ] Optimization modes (minimize cost vs minimize time)

### Priority 5: Quality
- [ ] Vitest migration for Monolit frontend
- [ ] React Error Boundaries
- [ ] Node.js 18.x → 20.x upgrade

---

## User Action Required (Deploy)

1. **Deploy concrete-agent** to Render (new `/api/v1/price-parser/parse` endpoint)
2. **Deploy Portal Backend** to Render (migrations auto-apply)
3. **Deploy Portal Frontend** to Vercel (new /pump route)
4. **Deploy Monolit Frontend** to Vercel (new /planner, /tariffs routes + breadcrumbs)
5. **Environment Variables** on Render:
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
| Monolit frontend TS | - | Compiles clean |
| Portal frontend TS | - | Compiles clean |
| Registry TS | - | Compiles clean |
| URS Matcher | 159 | Pass |
| **Grand Total** | **512+** | **Pass** |

---

## Commits This Session (2026-03-07, Session 5)

| # | Message | Files |
|---|---------|-------|
| 1 | FEAT: Add TariffPage — CRUD UI for supplier tariff management | TariffPage.tsx (NEW), App.tsx, Sidebar.tsx |
| 2 | REFACTOR: Unify pump engine in registry — mirror shared pump-engine API | pumpCalculator.ts |

## Commits Session 4 (2026-03-07)

| # | Message | Files |
|---|---------|-------|
| 1 | FEAT: Add PDF price list parser for concrete suppliers | 17 files (price_parser module + API + tests) |

---

## Quick Start Commands

```bash
# Start concrete-agent (CORE) — includes price parser
cd concrete-agent && npm run dev:backend

# Test price parser
cd concrete-agent/packages/core-backend
PYTHONPATH=. python -m pytest tests/test_price_parser.py -v

# Parse a PDF (API)
curl -X POST http://localhost:8000/api/v1/price-parser/parse \
  -F "file=@cenik_beton.pdf"

# Run Monolit shared tests (332 tests)
cd Monolit-Planner && npx vitest run
```

---

**Version:** 2.5.0
**Last Updated:** 2026-03-07
