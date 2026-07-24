# STAVAGENT

AI-powered construction cost estimation platform for Czech and Slovak markets. Five production services on Google Cloud Run and Vercel, with an MCP Server exposing 24 tools (19 work + 5 introspection) to Claude and ChatGPT.

**Status:** Production — active development
**Last updated:** 2026-04-19
**Maintainer:** Alexander Prokopov — solo developer, construction estimator by profession

---

## The 10-minute scenario

Upload a 200-page *Technická zpráva* (TZ / technical specification) → get an actionable construction scenario in minutes instead of days:

1. **OCR** extracts structured data from PDF drawings via MinerU
2. **Deterministic classifier** tags 24 element types from OTSKP codes with confidence `1.0`
3. **LLM** only handles ambiguous cases as fallback (confidence `0.7`)
4. **Professional pricing catalog lookup** joins 17,940 OTSKP entries with commercial civil-construction catalogs
5. **Calculator** produces pour schedules, formwork systems, rebar masses, and a work breakdown structure

Built as SaaS for *přípraváři* (cost estimators) in Czech and Slovak civil construction, then exposed via MCP so Claude Code users get the same domain intelligence.

![Calculator preview — coming soon](docs/images/calculator.png)

---

## Live production

| Service | Role | URL |
|---|---|---|
| `concrete-agent` | Core API + MCP Server (Python, FastAPI) | https://concrete-agent-3uxelthc4q-ey.a.run.app |
| `stavagent-portal` backend | Auth, billing, project management | https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app |
| `stavagent-portal` frontend | Landing + user dashboard | https://www.stavagent.cz |
| `Monolit-Planner` API | Kalkulátor betonáže backend | https://monolit-planner-api-3uxelthc4q-ey.a.run.app |
| `Monolit-Planner` frontend | Kalkulátor betonáže — UI (Detail prvku + Plán objektu) | https://kalkulator.stavagent.cz |
| `URS_MATCHER_SERVICE` | Klasifikátor stavebních prací (AI classifier kiosk) | https://klasifikator.stavagent.cz |
| `rozpocet-registry-backend` | Registr — backend (BOQ + TOV storage) | https://rozpocet-registry-backend-3uxelthc4q-ey.a.run.app |
| `rozpocet-registry` frontend | Registr — UI (skupiny + TOV + multi-supplier kalkulátory) | https://registry.stavagent.cz |
| MCP Server | 24 tools (19 work + 5 ops), mounted on `concrete-agent` | `https://concrete-agent-3uxelthc4q-ey.a.run.app/mcp` |

All backends run on Google Cloud Run (`europe-west3`) with independent per-service CI/CD via Cloud Build. Cloud SQL PostgreSQL 15 is the single shared database host (three logical databases). Frontends deploy to Vercel.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Frontends (Vercel)                                             │
│   www.stavagent.cz  kalkulator.stavagent.cz                    │
│   klasifikator.stavagent.cz  registry.stavagent.cz             │
└───────────────────────────┬────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼────────────────────────────────────┐
│ Cloud Run backends (europe-west3)                              │
│ ┌──────────────────┐  ┌──────────────────┐                     │
│ │ concrete-agent   │  │ stavagent-portal │                     │
│ │ (core API,       │◀─│ (auth, billing,  │                     │
│ │  MCP server,     │  │  dispatcher)     │                     │
│ │  24 MCP tools)   │  └──────────────────┘                     │
│ └────▲─────────────┘                                           │
│      │ HTTP                                                    │
│ ┌────┴─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│ │ Kalkulátor       │  │ Klasifikátor     │  │ Registr       │  │
│ │ betonáže         │  │ (URS_MATCHER     │  │ (rozpocet-    │  │
│ │ (Monolit-Planner │  │  repo)           │  │  registry     │  │
│ │  repo)           │  │                  │  │  repo)        │  │
│ └──────────────────┘  └──────────────────┘  └───────────────┘  │
│ ┌──────────────────┐                                           │
│ │ mineru_service   │  (PDF OCR, europe-west1)                  │
│ └──────────────────┘                                           │
└───────────────────────────┬────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────┐
│ Cloud SQL PostgreSQL 15   │   Vertex AI Gemini 2.5 Flash       │
│ (stavagent-db, 3 DBs)     │   AWS Bedrock Claude               │
│                           │   Perplexity (web-search norms)    │
└────────────────────────────────────────────────────────────────┘
```

**Dependency direction:** kiosks → `concrete-agent` via HTTPS only. No cross-service code imports. `concrete-agent` does not know about UI.

---

## Why deterministic-first

STAVAGENT treats AI as a **fallback**, not the default. Construction estimates must be auditable and reproducible — a calculator that returns a different answer each run is useless for a *stavbyvedoucí* (site manager) or a financial auditor.

| Source | Confidence |
|---|---|
| Regex or catalog lookup | `1.0` |
| OTSKP catalog or professional pricing database match | `1.0` |
| Human override | `0.99` |
| Perplexity web-search | `0.85` |
| LLM classification | `0.70` |

High-confidence data is never overwritten by lower-confidence results. This is unusual for AI products — most start with LLM and bolt rules on. STAVAGENT is the opposite: a deterministic pipeline with LLM as the escape hatch when regex fails.

Result: reproducible pricing that accountants and site managers can defend.

---

## Built with Claude

STAVAGENT was designed with long-context and agentic models as first-class citizens, not a retrofit.

### MCP Server — 24 tools (19 work + 5 ops)

Mounted at `/mcp` on the `concrete-agent` Cloud Run service:

| Tool | Purpose |
|---|---|
| `find_otskp_code` | 17,940 entries of the Czech transport infrastructure price catalog |
| `find_urs_code` | Professional civil-construction pricing catalog lookup |
| `classify_construction_element` | 24 element types (13 bridge + 11 building) |
| `calculate_concrete_works` | 7-engine calculator: pour, formwork, props, rebar, curing, schedule, cost |
| `parse_construction_budget` | Excel/XML parser for Czech budget formats (KROS, rozpočet) |
| `analyze_construction_document` | PDF-to-structured-data with MinerU + Gemini |
| `create_work_breakdown` | WBS generator from uploaded TZ |
| `get_construction_advisor` | Czech ČSN / TKP expert (via `gemini-2.5-flash` + Perplexity norms) |
| `search_czech_construction_norms` | ČSN / TKP lookup across 33 standards documents |

**Auth:** OAuth 2.0 `client_credentials` for ChatGPT Actions. Direct API keys in the format `sk-stavagent-{hex48}` for programmatic clients. Per-tool credit billing, 200 free credits on sign-up, Lemon Squeezy checkout for top-ups.

**REST wrapper:** each tool also has a REST endpoint at `/api/v1/mcp/tools/*` with auto-generated OpenAPI spec for GPT Actions.

### Vision for drawing ingestion

Technical drawings carry critical metadata (element codes, reinforcement specs, cross-section dimensions) that pure text OCR misses. STAVAGENT routes drawings through MCP to Claude with vision — the user's Claude subscription covers compute, the MCP returns structured data.

### Long context for TZ documents

A typical *Technická zpráva* runs 100 – 300 pages with cross-references between drawings, calculation tables, and ČSN norms. Claude's long-context models let STAVAGENT load an entire TZ + relevant ČSN sections + large OTSKP slices in one prompt — no RAG plumbing, no chunk-merge bugs.

### Multi-provider AI with cost/accuracy routing

- **Vertex AI Gemini 2.5 Flash** — default; fast, cheap, Czech-capable
- **Gemini 2.5 Pro** — heavy analysis only
- **AWS Bedrock Claude 3 Haiku / Sonnet / Opus** — accuracy-critical audits
- **Perplexity** — live ČSN / TKP norm research with web citations

Provider selected per task based on cost and accuracy tradeoff. Same code path for all; fallback chain defined in `concrete-agent/packages/core-backend/app/core/provider_router.py`.

---

## Tech stack

- **Languages:** Python (FastAPI, Pydantic v2, SQLAlchemy async), TypeScript (Node.js, React 19, Vite), SQL (PostgreSQL 15)
- **Infrastructure:** Google Cloud Run, Vercel, Cloud SQL PostgreSQL, Google Cloud Storage, Google Secret Manager
- **AI providers:** Vertex AI (Gemini), AWS Bedrock (Claude), Perplexity, MinerU (OCR)
- **MCP:** FastMCP 3.x mounted on FastAPI
- **CI/CD:** Cloud Build per-service triggers, GitHub Actions (6 workflows), Husky pre-commit for critical formula tests
- **Frontend:** React 19, Zustand, TanStack Virtual / Query, SheetJS (xlsx), JSZip, Lucide React

---

## Project structure

```
STAVAGENT/
├── concrete-agent/         # Core API + MCP server (Python FastAPI)
│   └── packages/
│       ├── core-backend/     # ~187 endpoints, 112 test files, 24 MCP tools (19 work + 5 ops)
│       ├── core-frontend/    # React admin UI
│       └── core-shared/      # TypeScript types
├── stavagent-portal/       # Auth + billing (Node.js + React)
├── Monolit-Planner/        # Concrete calculator (132 endpoints, ~1,300 shared tests)
│   ├── shared/               # Calculation formulas (vitest)
│   ├── backend/              # Express API
│   └── frontend/             # React calculator UI
├── URS_MATCHER_SERVICE/    # Construction code classifier (Node.js)
├── rozpocet-registry/      # BOQ registry frontend (React/Vite)
├── rozpocet-registry-backend/  # BOQ registry backend (Node.js)
├── mineru_service/         # PDF OCR (Cloud Run europe-west1)
├── docs/                   # ARCHITECTURE.md, DEPLOYMENT.md, 40+ guides
│   ├── normy/              # Czech ČSN / TKP standards (PDFs)
│   └── archive/            # Historical sessions, audits, backlog
├── scripts/                # Helper scripts (dangerous/ subdir for destructive ops)
├── .github/workflows/      # GitHub Actions
├── .github/dependabot.yml  # Grouped minor+patch weekly
├── cloudbuild-*.yaml       # Per-service Cloud Build configs
├── triggers/               # Cloud Build triggers (path-filtered)
└── CLAUDE.md               # Operational reference for Claude Code sessions
```

---

## Test coverage

| Service | Endpoints | Test files | Test cases (approx.) |
|---|---|---|---|
| `concrete-agent` | ~187 | 112 (pytest) | incl. ~93-test MCP-compat suite |
| `Monolit-Planner/shared` | — | 37 (vitest) | **~1,294** shared tests |
| `Monolit-Planner/backend` | 132 | 9 (jest) | ~60+ |
| `URS_MATCHER_SERVICE` | ~124 | 10 (jest) | ~232 |
| `stavagent-portal` | ~156 | 4 | incl. isolation e2e |
| `rozpocet-registry` | ~24 | 14 (vitest) | ~200 |
| **Total** | **~620** | **~186 files** | **~1,900 cases** |

The business-critical surface (pour formulas, formwork selection, rebar calculation) runs on every commit via Husky pre-commit hooks — a fast 61-case formula suite takes ~470 ms; the full ~1,294-test shared suite runs in CI on every push.

---

## Getting started (local development)

### Prerequisites

- Node.js 20+ (`.nvmrc` files per service)
- Python 3.11+
- Postgres 15 (local or Cloud SQL Proxy)
- Docker (for MinerU OCR service)

### Monolit-Planner (primary kiosk)

```bash
cd Monolit-Planner

# Install (run once)
cd shared && npm install && npm run build && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Run
cd backend && npm run dev      # API on :3001
cd frontend && npm run dev     # UI on :5173

# Test
cd shared && npm test          # ~1,294 shared tests
cd backend && npm run test:all # Integration
```

### `concrete-agent` (Core API + MCP)

```bash
cd concrete-agent/packages/core-backend

pip install -r requirements.txt
cp .env.example .env           # fill in API keys — see .env.example comments
uvicorn app.main:app --reload  # API on :8000, MCP on :8000/mcp

pytest -v                      # full test suite
pytest tests/test_mcp_compatibility.py -v  # 17 MCP compat tests
```

### Other services

- `stavagent-portal` — `npm run dev` in `backend/` and `frontend/` (ports 3000, 5173)
- `URS_MATCHER_SERVICE/backend` — `npm run dev` (port 3001)
- `rozpocet-registry` — `npm run dev` (Vite, port 5173)

Full per-service documentation: see each service's `README.md` and the top-level [`CLAUDE.md`](CLAUDE.md).

---

## Czech construction terms

The domain is Czech/Slovak civil construction. Key terms kept untranslated (English in parentheses):

| Term | Meaning |
|---|---|
| **TZ** *Technická zpráva* | Technical specification (typically 100–300 pages) |
| **rozpočet** | Construction cost estimate |
| **výkaz výměr** (VV) | Bill of quantities |
| **soupis prací** | Works list |
| **přípravář** | Cost estimator (primary user) |
| **stavbyvedoucí** | Site manager |
| **ČSN** | Czech national standards |
| **TKP** | Technical specifications for infrastructure (33 published documents) |
| **OTSKP** | Public transport-infrastructure price catalog (17,940 items, maintained by ŘSD) |
| **Civil-construction pricing catalogs** | Commercial catalogs covering building and civil works, parallel to OTSKP |
| **mostovka** | Bridge deck |
| **pilíř / opěra** | Bridge pier / abutment |
| **bednění / skruž** | Formwork / falsework |

---

## Status

- **Production live** — 5 backends on Cloud Run, 4 frontends on Vercel, MCP server operational
- **CI/CD green** across all services (per-service Cloud Build triggers + GitHub Actions)
- **1030+ tests** passing on every commit to `main`
- **Recent hardening** — April 2026: root-level cleanup, Cloud SQL authorized networks cleared, `min-instances=1` on `concrete-agent` for in-memory state survival, Dependabot configured with grouped minor/patch and major-bump ignore
- **Early pilots** with Czech construction estimators — small cohort, feedback loop open

Built by Alexander Prokopov as a solo project, approximately 1,700 commits over 6 months of active development. The maintainer is a working construction estimator, so the primary user is also the author — feedback loop is immediate.

---

## License

Proprietary. Contact [info@stavagent.cz](mailto:info@stavagent.cz) for licensing discussions.

---

## Links

- **GitHub:** https://github.com/alpro1000/STAVAGENT
- **Calculator demo:** https://kalkulator.stavagent.cz
- **Portal:** https://www.stavagent.cz
- **Issues:** https://github.com/alpro1000/STAVAGENT/issues
- **Operational reference (internal):** [`CLAUDE.md`](CLAUDE.md)
- **Session guide for contributors:** [`docs/STAVAGENT_ClaudeCode_Session_Mantra.md`](docs/STAVAGENT_ClaudeCode_Session_Mantra.md)
