# CLAUDE.md - STAVAGENT System Context

**Version:** 3.1.0
**Last Updated:** 2026-03-21
**Repository:** STAVAGENT (Monorepo)

---

## Quick Reference

```
STAVAGENT/
├── concrete-agent/        ← CORE (Python FastAPI, port 8000)
├── stavagent-portal/      ← Portal/Dispatcher (Node.js/Express/React, port 3001)
├── Monolit-Planner/       ← Kiosk: Concrete Calculator (Node.js/React, port 3001/5173)
├── URS_MATCHER_SERVICE/   ← Kiosk: URS Matching (Node.js, port 3001/3000)
├── rozpocet-registry/     ← Kiosk: BOQ Registry (React/Vite browser-only, port 5173)
├── docs/                  ← System-level documentation
└── .github/workflows/     ← CI/CD (keep-alive, monolit CI, test coverage, URS tests)
```

**Infrastructure:** Backends on **Google Cloud Run** (europe-west3), frontends on **Vercel**, CI/CD via **Cloud Build**. No Render — всё на GC + Vercel.

| Service | URL |
|---------|-----|
| concrete-agent (CORE) | https://concrete-agent-1086027517695.europe-west3.run.app |
| portal backend | https://stavagent-portal-backend-1086027517695.europe-west3.run.app |
| portal frontend | https://www.stavagent.cz |
| Monolit backend | https://monolit-planner-api-1086027517695.europe-west3.run.app |
| Monolit frontend | https://monolit-planner-frontend.vercel.app |
| URS Matcher | https://urs-matcher-service-1086027517695.europe-west3.run.app |
| Registry backend | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app |
| Registry frontend | https://stavagent-backend-ktwx.vercel.app |

**DB:** Cloud SQL PostgreSQL 15 (`stavagent-db`): databases `stavagent_portal`, `monolit_planner`, `rozpocet_registry`

**GCP Project:** `project-947a512a-481d-49b5-81c` (ID: 1086027517695), SA: `1086027517695-compute@developer.gserviceaccount.com`

**LLM:** Vertex AI Gemini (ADC auth, no API keys on Cloud Run). Models: `gemini-2.5-flash` (default, fast), `gemini-2.5-pro` (heavy). Note: `gemini-2.5-flash-lite` returns 404 in europe-west3 despite docs (2026-03-23).

---

## Architecture

```
Portal (Dispatcher) ──┬──→ concrete-agent (CORE: AI, parsing, audit, Multi-Role)
                      ├──→ Monolit-Planner (concrete cost calculator, CZK/m³)
                      ├──→ URS_MATCHER_SERVICE (BOQ→URS code matching)
                      └──→ rozpocet-registry (BOQ classification, browser-only)

Flow: User → Portal upload → CORE parse/audit → Kiosk calculate → Portal results
Linking: portal_project_id (UUID) → core_processing_id + kiosk_result_id
```

**Key API contracts:**
```
Portal → CORE:  POST /workflow/a/import (multipart/form-data)
Portal → Kiosk: POST /import (JSON: projectId, positions[])
Kiosk → CORE:   POST /api/v1/multi-role/ask (JSON: role, question, context)
```

---

## Key Features

**TOV Profession Mapping:**
- Betonování → Betonář
- Bednění → Tesař/Bednář
- Výztuž → Železář

**Sync metadata tracking:** Bi-directional sync between Portal ↔ Kiosks (Monolit, Registry) via `position_instance_id` and `portal_project_id`.

**Integration imports:** Default `owner_id=1` for positions imported via integration routes (Portal→Kiosk).

---

## Services

### 1. concrete-agent (CORE)
Python FastAPI. Central AI: Multi-Role validation (6 roles), document parsing (PDF/Excel/XML), Knowledge Base (KROS/RTS/ČSN), Workflows A/B/C, Document Accumulator, Google Drive OAuth2, PDF Price Parser, Vertex AI Search.

Key endpoints: `/api/v1/multi-role/ask`, `/workflow/a/import`, `/api/v1/workflow/c/execute`, `/api/v1/accumulator/*`, `/api/v1/price-parser/parse`, `/api/v1/vertex/search`, `/health`

Structure: `packages/core-backend/app/{api,services,classifiers,knowledge_base,parsers,prompts}`, tests in `packages/core-backend/tests/`

### 2. stavagent-portal (Dispatcher)
Node.js/Express + React. Main entry point: JWT auth, project management, file upload, kiosk routing, chat assistant.

**Sprint 1 Cabinets+Roles (complete):** Organizations + org_members tables, 5 roles (admin/manager/estimator/viewer/api_client), orgRole.js middleware, cabinet.js + orgs.js (12 endpoints), PATCH /api/auth/me. Frontend: CabinetPage, CabinetOrgsPage, OrgPage, OrgInvitePage + cabinet/ and org/ components.

**Auth + SaaS (complete):** JWT auth enabled on all routes, seed admin, login/cabinet UI. SaaS admin panel: usage tracking, feature flags, quotas, anti-fraud. ParsePreviewPage for Excel import preview.

**Sprint 2 Service Connections (schema only):** `service_connections` table exists (AES-256-GCM encrypted credentials), needs API endpoints + frontend UI + MASTER_ENCRYPTION_KEY.

DB tables: `users, organizations, org_members, portal_projects, portal_files, kiosk_links, chat_sessions, chat_messages, position_instances, position_templates, position_audit_log, service_connections`

Key routes: `backend/src/routes/{portal-projects,auth,orgs,cabinet}.js`, `backend/src/middleware/orgRole.js`

Design: Digital Concrete / Brutalist Neumorphism, monochrome + orange #FF9F1C, BEM (`.c-btn`, `.c-panel`, `.c-card`)

### 3. Monolit-Planner (Kiosk)
Node.js/Express + React. Concrete cost calculator: CZK/m³ metric, Excel import, OTSKP codes, AI days suggestion, Unified Registry, Relink algorithm, **336 shared tests**.

Critical formulas: `unit_cost_on_m3 = cost_czk / concrete_m3`, `kros_unit_czk = Math.ceil(x / 50) * 50`

Work types: beton (m³), bednění (m²), výztuž (kg), jiné

**Element Planner** (`/planner`): Universal tool for ALL monolithic concrete works (20 element types: 9 bridge + 11 building). 7-engine pipeline: Element Classifier → Pour Decision → Formwork 3-Phase → Rebar Lite → Pour Task → RCPSP Scheduler (DAG) → PERT Monte Carlo. Visual Gantt chart + XLSX export. Design system: CSS variables in `r0.css` (Slate Minimal palette). **Mobile responsive:** sidebar/results stack vertically (≤768px), grids collapse via `.r0-grid-2/3/4` classes.

Structure: `shared/` (formulas + scheduler, 336 tests), `backend/` (Express, PostgreSQL/SQLite), `frontend/` (React)

Design: Slate Minimal — CSS variables (`--r0-*`), zero hardcoded hex colors in planner components

### 4. URS_MATCHER_SERVICE (Kiosk)
Node.js/Express + SQLite. BOQ→URS code matching via AI. 4-phase: Norms Search → Multi-model LLM Routing → Knowledge Base → Learning System. Document extraction pipeline (PDF/DOCX). LLM fallback chain with per-request AbortController. 8 LLM providers configured (Gemini primary via Vertex AI). 159 tests.

### 5. rozpocet-registry (Kiosk)
React 19 + TypeScript + Vite (browser-only, Zustand + localStorage). BOQ classification into 10 work groups, Excel import/export, AI classification (Cache→Rules→Memory→Gemini), fuzzy search (Fuse.js), pump calculator, Monolit price comparison.

---

## Development Commands

```bash
# concrete-agent
cd concrete-agent && npm install && npm run dev:backend  # FastAPI :8000

# stavagent-portal
cd stavagent-portal && npm install && npm run dev  # Express + React

# Monolit-Planner
cd Monolit-Planner/shared && npm install && npm run build
cd ../backend && npm run dev    # Express :3001
cd ../frontend && npm run dev   # React :5173

# URS_MATCHER_SERVICE
cd URS_MATCHER_SERVICE && npm install && npm run dev  # :3001

# rozpocet-registry
cd rozpocet-registry && npm install && npm run dev  # Vite :5173
```

---

## Conventions

**Commits:** `FEAT:`, `FIX:`, `REFACTOR:`, `DOCS:`, `STYLE:`, `TEST:`, `WIP:`

**Branches:** `claude/<task-description>-<random5chars>`

**Git Hooks (Husky):** Pre-commit runs 34 formula tests (~470ms), pre-push validates branch + tests.

**Key decisions:**
- rozpocet-registry: browser-only, Zustand + localStorage
- Monolit: PostgreSQL prod, SQLite dev
- URS Matcher: per-request LLM fallback
- concrete-agent: Vertex AI Gemini primary (GCP credits, no API keys on Cloud Run)
- Portal: central registry linking all kiosks via `portal_project_id`

---

## Environment Variables

```env
# concrete-agent
DATABASE_URL=postgresql+asyncpg://...
MULTI_ROLE_LLM=gemini
GEMINI_MODEL=gemini-2.5-flash
# On Cloud Run: uses ADC (no GOOGLE_API_KEY needed)
# Local dev: GOOGLE_API_KEY=... or ANTHROPIC_API_KEY=...

# Monolit-Planner
VITE_API_URL=https://monolit-planner-api-1086027517695.europe-west3.run.app
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app

# URS_MATCHER_SERVICE
STAVAGENT_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app
LLM_TIMEOUT_MS=90000

# stavagent-portal
VITE_DISABLE_AUTH=true
```

---

## Quick Debugging

| Problem | Check |
|---------|-------|
| URS empty results | LLM timeout (90s), AbortController per-provider, Multi-Role URL |
| Monolit wrong calc | `concrete_m3` value, `unit_cost_on_m3`, KROS rounding `Math.ceil(x/50)*50` |
| Registry classification | `constants.ts` 10 groups, `classificationRules.ts`, diacritics normalization |
| CORE unavailable | Cloud Run status, `/health`, Secret Manager |
| DB connection | Cloud SQL instance status, `--add-cloudsql-instances` in cloudbuild |
| LLM 401 errors | Vertex AI: check SA role `aiplatform.user`, ADC auth |

---

## CI/CD

**Cloud Build** (per-service, push to main): `cloudbuild-{concrete,monolit,portal,urs,registry}.yaml` + `triggers/*.yaml`
- Guard step (git diff), Docker build → Artifact Registry, Cloud Run deploy with secrets
- `cloudbuild.yaml` — deploy-all (manual trigger, approval required)
- All triggers: `location: europe-west3`, explicit `serviceAccount`
- Setup: `./gcp/setup-gcp.sh` (APIs, AR repo, secrets, IAM)
- Trigger import: `gcloud builds triggers import --source=triggers/<name>.yaml --region=europe-west3`

**GitHub Actions:** keep-alive (14min pings), monolit-planner-ci, test-coverage, test-urs-matcher

---

## Backlog

**Awaiting user action:**
- MASTER_ENCRYPTION_KEY: `openssl rand -hex 32` → Secret Manager (for Sprint 2 Service Connections)
- Set real API key values in Secret Manager (GOOGLE_API_KEY, ANTHROPIC_API_KEY, etc.)

**Completed (2026-03-22):**
- Cloud Build setup (`setup-gcp.sh`) — done
- Cloud Build triggers imported — active
- CI fix: `test-shared.yml` cache-dependency-path corrected
- Portal: Auth enabled (JWT login, seed admin, cabinet UI, all routes behind auth)
- Portal: SaaS admin panel (usage tracking, feature flags, quotas, anti-fraud)
- Portal: ParsePreviewPage + PortalImportModal → Monolit
- Portal: serviceAuth.js — service-level auth middleware for kiosk↔portal (X-Service-Key)
- Portal: serviceAuth.js — timing attack fix (CWE-208): replaced custom timingSafeEqual with crypto.timingSafeEqual
- Planner: formwork comparison table, scenario snapshots (side-by-side), localStorage persistence
- Planner: bug fixes (negative values, season→temp, total rebar, římsa classification, dilatační spáry)
- Planner: mobile responsive (sidebar+results stack, grids collapse)
- Planner: PERI formwork catalog — 25 systems total (DOKA, PERI, ULMA, NOE, Místní)
- Planner: PERI pricing from offer DO-25-0056409 → KB JSON (B3) + benchmarks (B4)
- Planner: element-classifier updated with PERI system recommendations
- Planner: Monolit CLAUDE.MD refactored (2900→935 lines, sessions archived)
- CORE: formwork_systems_peri.json — 17 variants (DOMINO/TRIO/VARIO) with rental/purchase prices
- Data: parse_peri_pdfs.py — GCS PDF extraction script for PERI brochures

**Sprint 2 remaining:** Service Connections API endpoints + frontend UI + encryption service

**Technical debt:** React Error Boundaries, Document Accumulator (in-memory storage)

**Next session tasks:**
1. User downloads PERI PDFs from GCS bucket `stavagent-cenik-norms` → `data/peri-pdfs/`, run `parse_peri_pdfs.py` to extract specs
2. Enrich formwork-systems.ts with parsed PDF data (panel weights, concrete pressures, exact dimensions)
3. Merge PR `claude/auth-saas-planner-features-jIqEd` → main (conflict resolved, security fix applied)
4. Sprint 2: Service Connections API + frontend UI + MASTER_ENCRYPTION_KEY setup
5. Position write-back: Monolit+Registry→Portal sync

**Feature roadmap:** Planner user documentation (help panel), Position write-back (Monolit+Registry→Portal), Deep Links, Universal Parser Phase 2, Vitest migration

---

## Documentation

Each service has its own `CLAUDE.md`/`CLAUDE.MD` with detailed docs. See also:
- `PLAN_CABINETS_ROLES_BILLING.md` — 4-sprint SaaS transformation plan
- `docs/POSITION_INSTANCE_ARCHITECTURE.ts` — Position identity model
- `docs/STAVAGENT_CONTRACT.md` — API contracts
- `Monolit-Planner/CLAUDE.MD` — Monolit detailed docs (v4.3.8)
- `concrete-agent/CLAUDE.md` — CORE detailed docs (v2.4.1)
