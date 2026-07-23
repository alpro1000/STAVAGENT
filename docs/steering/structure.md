# STAVAGENT — Structure Steering

> **Účel dokumentu:** Struktura repa, organizace kódu, kdo volá koho. Naming konvence.
> Před vytvořením nového file/folder — zkontrolovat zde, kam to patří.
>
> **Verze:** 2.0 — 06.06.2026 (§1/§2/§4/§5/§7 přepsány na **skutečný** monorepo layout — viz §8)

---

## 1. Repo layout (alpro1000/STAVAGENT)

> Monorepo je **polyrepo-style**: každý service má vlastní top-level složku (ne `app/`+`apps/`).
> Tento strom je kanonický a musí souhlasit s "Quick Reference" v root `CLAUDE.md`.

```
STAVAGENT/
├── concrete-agent/               # CORE Engine (Python FastAPI, Cloud Run europe-west3)
│   └── packages/core-backend/app/
│       ├── api/                  # FastAPI routes
│       ├── parsers/              # Excel/XML/PDF/DXF parsers (xlsx_komplet, xlsx_rtsrozp, pdf, universal)
│       ├── classifiers/          # element classifier + element_rules/element_types.yaml (single-source)
│       ├── services/             # project cache, document services, multi-role
│       ├── prompts/              # AI prompts
│       ├── models/               # Pydantic schemas
│       ├── db/                   # migrations + startup_migrations
│       ├── mcp/                  # MCP server (server.py + tools/) mounted at /mcp
│       ├── pricing/              # otskp_engine
│       ├── core/                 # LLM clients (vertex/bedrock/perplexity), kb_loader
│       └── knowledge_base/       # B0–B13 buckets (viz domain.md §3)
│
├── stavagent-portal/             # Portal/Dispatcher (Node/Express + React) → www.stavagent.cz
├── Monolit-Planner/              # Kalkulátor betonáže → kalkulator.stavagent.cz
│   ├── shared/src/               # 7-engine pipeline (calculators/, classifiers/, parsers/) + 1366 testů (07-2026)
│   │   └── kb-generated/         # GENEROVÁNO z kb/*.yaml přes scripts/gen-knowledge.mjs — needit ručně
│   ├── backend/                  # Node/Express (SQLite dev / Postgres prod)
│   └── frontend/                 # React + Vite (Vercel)
├── Zeleznice-Planner/            # Kiosk: železniční svršek+spodek (v4.43.0; deploy pending → zeleznice.stavagent.cz)
│   ├── shared/src/               # planRailSection engine + kb-generated/ (z kb/zeleznicni_*.yaml, outAbs codegen)
│   ├── backend/                  # Node/Express thin wrapper (:3004, service-key fail-closed)
│   └── frontend/                 # React + Vite (in-browser engine)
├── URS_MATCHER_SERVICE/          # Klasifikátor (Node + SQLite) → klasifikator.stavagent.cz
├── rozpocet-registry/            # Registr frontend (React/Vite + Vercel serverless) → registry.stavagent.cz
├── rozpocet-registry-backend/    # Registry backend (Node + Cloud SQL Postgres)
├── mineru_service/               # MinerU PDF/OCR parser (Python, Cloud Run europe-west1)
│
├── kb/                           # KB single-source YAML (codegen vstup):
│   └── {tkp18_maturity, doka_frami_catalog, lateral_pressure, ucebnice_mostu_pour, urs_otskp_routing}.yaml
│
├── docs/                         # All documentation
│   ├── steering/                 # Permanent project context (this folder)
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── structure.md          # ← tento dokument
│   │   ├── domain.md
│   │   └── conventions.md
│   ├── specs/{feature-name}/     # SDD specs (requirements.md / design.md / tasks.md)
│   ├── bugs/{bug-id}/            # Bug specs (report/analyze/fix/verify)
│   ├── audits/{topic}/           # Audit reports ({YYYY-MM-DD}_{name}.md)
│   ├── handoff/{YYYY-MM-DD}.md   # Session handoff snapshots
│   ├── templates/                # _TEMPLATE_steering.md + _TEMPLATE_spec/ + _TEMPLATE_bug/
│   ├── normy/{tkp,navody}/       # Norm PDFs (TKP) + vendor manuals (doménová data — viz §5)
│   ├── reference/                # Catalogs/examples (např. formwork_catalog_2025.md)
│   ├── architecture/             # ADR + pipeline reference docs
│   ├── archive/                  # Legacy docs (completed-sessions, legacy, future-planning, …)
│   └── soul.md                   # Living memory (Claude session continuity)
│
├── scripts/                      # gen-knowledge.mjs (KB codegen) + ops scripty (dangerous/ subdir)
├── test-data/                    # Real-world corpora + golden tests (READ-denied pro AI, viz .claude/settings.json)
│   ├── tz/                       # Golden test markdowny (SO-202/203/207, VP4 FORESTINA, …)
│   ├── RD_Jachymov_dum/  SO_250/  hk212_hala/  libuse/  most-2062-1-zihle/  most-litovel/
│   ├── kros_catalog.db           # KROS catalog SQLite (working copy)
│   └── STAVAGENT_Drawings_to_VV_Rozpocet_Playbook.md
│
├── triggers/                     # Cloud Build trigger configs (per-service)
├── cloudbuild-{concrete,monolit,portal,urs,registry,mineru}.yaml
├── .claude/                      # settings.json (permissions) + skills/ + agents/ (viz tech.md §13)
├── .github/                      # workflows + PR/issue templates + dependabot
├── .husky/                       # git hooks (pre-commit = Monolit shared formula testy; pre-push = branch-name)
├── CLAUDE.md                     # Root master instructions (mandatory reading block)
└── README.md
```

---

## 2. Core ↔ Kiosks call pattern

**Princip:** Core Engine (`concrete-agent`) **neví** o existenci kiosks. Každý kiosk volá Core API nezávisle.

### 2.1 Příklad — Klasifikátor flow

```
User → Klasifikátor UI (klasifikator.stavagent.cz)
       │
       │ POST /api/v1/classify
       ▼
Core Engine (concrete-agent, FastAPI, Cloud Run)
       │
       ├─ Parser dispatch
       ├─ AI tier routing (Vertex → Bedrock → Perplexity)
       ├─ Confidence scoring
       │
       │ POST /api/sync?action=import-positions
       ▼
Registr DB (Cloud SQL)
```

### 2.2 Co se **NESMÍ**

- ❌ Kiosk přímo volá Vertex AI / Bedrock (vždy přes Core)
- ❌ Kiosk přímo čte z `concrete-agent/packages/core-backend/app/knowledge_base/` (vždy přes Core API)
- ❌ Core API volá frontend (jednosměrný tok)
- ❌ Kiosk A volá Kiosk B přímo (vždy přes Core nebo společnou DB)
- ❌ Hardcoded norma v kiosk kódu (přesunout do KB — viz §4 + `domain.md` §3 + `kb/` codegen)

---

## 3. Naming conventions (viz §12.2 v `tech.md`)

### 3.1 Files & folders

- Python: `snake_case.py`
- TypeScript/React: `PascalCase.tsx` pro komponenty, `camelCase.ts` pro utils
- Markdown docs: `snake_case.md` nebo `kebab-case.md` (drž jeden styl per folder)
- Spec folders: `kebab-case` (např. `cross-user-isolation/`)
- Bug folders: `kebab-case-with-id` (např. `so202-001/`, `aplikovat-timeout/`)

### 3.2 Tabulky DB

- snake_case (např. `project_documents`, ne `projectDocuments` a ne `portal_documents`)
- Singular nebo plural — držet podle většiny v repu
- Vždy `id UUID` + `created_at` + `updated_at`

### 3.3 API endpoints

- REST style: `/api/v1/{resource}`, `/api/v1/{resource}/{id}/{action}`
- Verbs in URL minimum (POST/GET/PUT/DELETE)
- Snake_case v JSON body, ne camelCase (kvůli Pythonu)

---

## 4. Where to put new code

| Co přidáváš | Kam |
|---|---|
| Nový parser pro nový file format | `concrete-agent/packages/core-backend/app/parsers/{format}/` |
| Nový AI prompt | `concrete-agent/packages/core-backend/app/prompts/{prompt_name}.py` |
| Nový kalkulační engine (betonáž) | `Monolit-Planner/shared/src/calculators/{engine_name}.ts` |
| Nová Pydantic schéma (Core) | `concrete-agent/packages/core-backend/app/models/{domain}.py` |
| Nový API route (Core) | `concrete-agent/packages/core-backend/app/api/{resource}.py` |
| Nový MCP tool | `concrete-agent/packages/core-backend/app/mcp/tools/` (+ sync čítačů — viz root `CLAUDE.md`) |
| Nový React component (kiosk) | `{stavagent-portal\|Monolit-Planner/frontend\|rozpocet-registry}/src/components/{ComponentName}.tsx` |
| Nový knowledge zdroj (PDF, norma) | `concrete-agent/packages/core-backend/app/knowledge_base/{B?_bucket}/{source_slug}/` — viz `domain.md` §3 |
| Nové KB single-source data (engine tabulky) | `kb/{name}.yaml` → regenerovat `Monolit-Planner/shared/src/kb-generated/` přes `scripts/gen-knowledge.mjs` |
| Spec pro novou feature | `docs/specs/{feature-name}/` (3 files: req/design/tasks) |
| Bug specifikace | `docs/bugs/{bug-id}/` (4 files: report/analyze/fix/verify) |
| Golden test (TZ case) | `test-data/tz/{case_name}_golden_test.md` |
| Project test data (PDFs, DXF, XLSX) | `test-data/{project_slug}/` |
| Audit report | `docs/audits/{topic}/{YYYY-MM-DD}_{name}.md` |
| Operational script | `scripts/{script_name}.{py,sh,mjs}` |

---

## 5. Co **nepatří** do repa

- ❌ Raw TZ PDFs (jdou do GCS bucket)
- ❌ Velké datasety > 50 MB (GCS)
- ❌ Secrets, API keys, tokens (Secret Manager nebo `.env` v `.gitignore`)
- ❌ `node_modules`, `__pycache__`, `.pyc`, `dist/`, `build/`
- ❌ Cloudbuild artefakty
- ❌ User uploads (jdou do GCS)
- ❌ `*.py` souborů obsahujících business logic v `docs/` (kód patří do příslušného service)
- ❌ Orphaned PDF / DXF / XLSX v root repa (project data jde do `test-data/{project_slug}/`)
- ❌ Ad-hoc `data/` složka v root (vendor reference → `docs/reference/`; operational scripty → `scripts/`; vendor PDFs → `concrete-agent/packages/core-backend/app/knowledge_base/B5_tech_cards/{vendor_product}/`; element specs → `docs/specs/element/{name}.md`)
- ❌ Hardcoded norma v kiosk/engine kódu — patří do `kb/*.yaml` (codegen) nebo `app/knowledge_base/`

---

## 6. Git workflow

### 6.1 Branches

- `main` — produkce, **branch protection enabled, bez výjimky**
- `claude/{task-description}-{random5chars}` — Claude Code branches (povinný `claude/` prefix — Vercel overage prevention, viz session-discipline skill #6)

### 6.2 PR rules

- 1 spec = 1 PR (s `docs/specs/{name}/` všemi 3 soubory)
- Bug fix PR obsahuje `analyze.md` + `fix.md` + kód + tests
- `verify.md` může být v separátním follow-up PR po deployi
- Žádné multi-feature PRs

### 6.3 Branch-per-task workflow

- Commits pushed to origin
- PR neотevírá se dokud user explicitně neřekne
- "No-PR-unless-asked" policy active

---

## 7. Where things live (cheat sheet)

| Něco | Kde to najdu |
|---|---|
| Co stavíme a proč | `docs/steering/product.md` |
| Jaký stack používáme | `docs/steering/tech.md` |
| Kam dát nový file | `docs/steering/structure.md` (← tento dokument) |
| Doménové pravidlo (ČSN, OTSKP) | `docs/steering/domain.md` |
| Jak Claude Code session probíhá | `docs/steering/conventions.md` |
| Co jsme dělali minule | `docs/soul.md` |
| Specifikace aktivní feature | `docs/specs/{feature-name}/` |
| Pending bugs | `docs/bugs/{bug-id}/` |
| Golden test data | `test-data/tz/{case}_golden_test.md` |
| Project test data | `test-data/{project_slug}/` |
| Audit reports | `docs/audits/{topic}/` |
| Architecture deep dive / ADR | `docs/architecture/` |
| Vendor catalog (PERI, DOKA) | `concrete-agent/packages/core-backend/app/knowledge_base/B5_tech_cards/` + `docs/reference/formwork_catalog_2025.md` |
| KB single-source (engine tabulky) | `kb/*.yaml` → `Monolit-Planner/shared/src/kb-generated/` |

---

## 8. Document versioning

| Date | Version | Notes |
|---|---|---|
| 19.05.2026 | 1.0 | Initial structure steering. |
| 19.05.2026 | 1.1 | §5 doplněn: zákaz orphaned project files v root + zákaz ad-hoc `data/`. |
| 06.06.2026 | 2.0 | **C1 fix** (knowledge-architecture audit): §1 repo layout přepsán z aspiračního `app/`+`apps/`+`catalogs/`+`tests/` na **skutečný** monorepo layout (`concrete-agent/packages/core-backend/app/…` + per-service složky + `kb/` codegen). §2/§4/§5/§7 paths sjednoceny se skutečností a s root `CLAUDE.md` Quick Reference. Engines opraveny: 7-engine pipeline je v `Monolit-Planner/shared/src/`, ne v Core. |
| 23.07.2026 | 2.1 | §1 +`Zeleznice-Planner/` (šestý kiosk — železniční svršek+spodek, v4.43.0); `gen-knowledge.mjs` umí per-integration `outAbs` (kb/zeleznicni_*.yaml → Zeleznice shared kb-generated, vlastní index per output-dir). |
