# STAVAGENT

AI-powered construction cost estimation platform for Czech and Slovak markets. Five production services on Google Cloud Run and Vercel, with an MCP Server exposing nine domain-specific tools to Claude and ChatGPT.

**Status:** Production — active development
**Last updated:** 2026-04-19
**Maintainer:** Alexander Prokopov — solo developer, construction estimator by profession

---

## The 10-minute scenario

Upload a 200-page *Technická zpráva* (TZ / technical specification) → get an actionable construction scenario in minutes instead of days:

1. **OCR** extracts structured data from PDF drawings via MinerU
2. **Deterministic classifier** tags 22 element types from OTSKP codes with confidence `1.0`
3. **LLM** only handles ambiguous cases as fallback (confidence `0.7`)
4. **OTSKP / ÚRS lookup** joins 17,904 real Czech construction prices
5. **Calculator** produces pour schedules, formwork systems, rebar masses, and a work breakdown structure

Built as SaaS for *přípraváři* (cost estimators) in Czech and Slovak civil construction, then exposed via MCP so Claude Code users get the same domain intelligence.

![Calculator preview — coming soon](docs/images/calculator.png)
*Screenshot placeholder — see `docs/HACKATHON_FINAL_CHECKLIST.md`*

---

## Live production

| Service | Role | URL |
|---|---|---|
| `concrete-agent` | Core API + MCP Server (Python, FastAPI) | https://concrete-agent-1086027517695.europe-west3.run.app |
| `stavagent-portal` backend | Auth, billing, project management | https://stavagent-portal-backend-1086027517695.europe-west3.run.app |
| `stavagent-portal` frontend | Landing + user dashboard | https://www.stavagent.cz |
| `Monolit-Planner` API | Concrete calculator backend | https://monolit-planner-api-1086027517695.europe-west3.run.app |
| `Monolit-Planner` frontend | Calculator UI (*kalkulátor betonáže*) | https://kalkulator.stavagent.cz |
| `URS_MATCHER_SERVICE` | OTSKP / ÚRS classifier | https://klasifikator.stavagent.cz |
| `rozpocet-registry-backend` | BOQ registry backend | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app |
| `rozpocet-registry` frontend | BOQ registry UI | https://registry.stavagent.cz |
| MCP Server | 9 tools, mounted on `concrete-agent` | `https://concrete-agent-1086027517695.europe-west3.run.app/mcp` |

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
│ │  9 domain tools) │  └──────────────────┘                     │
│ └────▲─────────────┘                                           │
│      │ HTTP                                                    │
│ ┌────┴─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│ │ Monolit-Planner  │  │ URS_MATCHER      │  │ rozpocet-     │  │
│ │ (calculator)     │  │ (classifier)     │  │  registry     │  │
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
| OTSKP / ÚRS database match | `1.0` |
| Human override | `0.99` |
| Perplexity web-search | `0.85` |
| LLM classification | `0.70` |

High-confidence data is never overwritten by lower-confidence results. This is unusual for AI products — most start with LLM and bolt rules on. STAVAGENT is the opposite: a deterministic pipeline with LLM as the escape hatch when regex fails.

Result: reproducible pricing that accountants and site managers can defend.

---

## Built with Claude 4.7

STAVAGENT was designed with long-context and agentic models as first-class citizens, not a retrofit.

### MCP Server — 9 domain tools

Mounted at `/mcp` on the `concrete-agent` Cloud Run service:

| Tool | Purpose |
|---|---|
| `find_otskp_code` | 17,904 entries of the Czech transport infrastructure price catalog |
| `find_urs_code` | ÚRS civil construction catalog lookup |
| `classify_construction_element` | 22 element types (bridges × 11 + buildings × 11) |
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

A typical *Technická zpráva* runs 100 – 300 pages with cross-references between drawings, calculation tables, and ČSN norms. Claude 4.7's 1M-token context lets STAVAGENT load an entire TZ + relevant ČSN sections + the full OTSKP catalog in one prompt — no RAG plumbing, no chunk-merge bugs.

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
│       ├── core-backend/     # 120 endpoints, 46 tests, 9 MCP tools
│       ├── core-frontend/    # React admin UI
│       └── core-shared/      # TypeScript types
├── stavagent-portal/       # Auth + billing (Node.js + React)
├── Monolit-Planner/        # Concrete calculator (132 endpoints, 893+ tests)
│   ├── shared/               # Calculation formulas (vitest)
│   ├── backend/              # Express API
│   └── frontend/             # React calculator UI
├── URS_MATCHER_SERVICE/    # OTSKP / ÚRS classifier (Node.js)
├── rozpocet-registry/      # BOQ registry frontend (React/Vite)
├── rozpocet-registry-backend/  # BOQ registry backend (Node.js)
├── mineru_service/         # PDF OCR (Cloud Run europe-west1)
├── docs/                   # ARCHITECTURE.md, DEPLOYMENT.md, 40+ guides
│   ├── normy/              # Czech ČSN / TKP standards (PDFs)
│   ├── archive/            # Historical sessions, audits, backlog
│   └── HACKATHON_*         # Hackathon prep checklists
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
| `concrete-agent` | 120 | 46 (pytest) | 87 core + MCP-compat suite |
| `Monolit-Planner/shared` | — | 18 (vitest) | **893** formula tests |
| `Monolit-Planner/backend` | 132 | — | Integration tests pending |
| `URS_MATCHER_SERVICE` | 45 | 12 (jest) | 159 |
| `stavagent-portal` | 80+ | 1 | — |
| `rozpocet-registry` | 12 | 0 | — |
| **Total** | **~390** | **83 files** | **1030+ cases** |

The business-critical surface (pour formulas, formwork selection, rebar calculation) runs on every commit via Husky pre-commit hooks — the full 893-case formula suite takes ~470 ms.

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
cd shared && npm test          # 893 formula tests
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
| **OTSKP** | Czech transport-infrastructure price catalog (17,904 items) |
| **ÚRS** | Czech civil-construction price catalog |
| **mostovka** | Bridge deck |
| **pilíř / opěra** | Bridge pier / abutment |
| **bednění / skruž** | Formwork / falsework |

---

## Status

- **Production live** — 5 backends on Cloud Run, 4 frontends on Vercel, MCP server operational
- **CI/CD green** across all services (per-service Cloud Build triggers + GitHub Actions)
- **1030+ tests** passing on every commit to `main`
- **Pre-hackathon hardening** — April 2026: cleanup, Cloud SQL secured, `min-instances=1` on `concrete-agent` for demo stability, Dependabot configured with grouped minor/patch + major-bump ignore
- **Early pilots** with Czech construction estimators — small cohort, feedback loop open

Built by Alexander Prokopov as a solo project, approximately 1,700 commits over 6 months of active development. The maintainer is a working construction estimator, so the primary user is also the author — feedback loop is immediate.

---

## Built with Opus 4.7 Hackathon (April 2026)

STAVAGENT is participating in the Built with Opus 4.7 hackathon hosted by Cerebral Valley × Anthropic. The pitch: *a domain-specific MCP server that makes general-purpose models useful for a specialized industry (Czech civil construction)*.

### During hackathon week

- Publish MCP server to the Anthropic MCP Directory
- Publish MCP server to the OpenAI GPT Store (Actions via `/api/v1/mcp/tools/*`)
- Add vision support for technical drawing ingestion
- Live demo: 200-page TZ → actionable construction scenario in 10 minutes

### Post-hackathon roadmap

- PostgreSQL persistence for `project_store` (currently in-memory; `min-instances=1` mitigates risk)
- VPC connector for Cloud SQL private IP
- Integration endpoint authentication (`X-Service-Key`)
- ~10 Dependabot minor/patch grouped PRs awaiting merge (April 22+)

---

## License

Proprietary. Contact [alexander@stavagent.cz](mailto:alexander@stavagent.cz) for licensing discussions.

---

## Links

- **GitHub:** https://github.com/alpro1000/STAVAGENT
- **Calculator demo:** https://kalkulator.stavagent.cz
- **Portal:** https://www.stavagent.cz
- **Issues:** https://github.com/alpro1000/STAVAGENT/issues
- **Operational reference (internal):** [`CLAUDE.md`](CLAUDE.md)
- **Session guide for contributors:** [`docs/STAVAGENT_ClaudeCode_Session_Mantra.md`](docs/STAVAGENT_ClaudeCode_Session_Mantra.md)
