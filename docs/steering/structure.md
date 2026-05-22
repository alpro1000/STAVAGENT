# STAVAGENT — Structure Steering

> **Účel dokumentu:** Struktura repa, organizace kódu, kdo volá koho. Naming konvence.
> Před vytvořením nového file/folder — zkontrolovat zde, kam to patří.
>
> **Verze:** 1.0 — 19.05.2026

---

## 1. Repo layout (alpro1000/STAVAGENT)

```
STAVAGENT/
├── app/                          # Core Engine (Python FastAPI)
│   ├── api/                      # FastAPI routes
│   ├── parsers/                  # Excel, XML, PDF parsers
│   │   ├── xlsx_komplet/
│   │   ├── xlsx_rtsrozp/
│   │   ├── pdf_razitko/
│   │   └── universal/
│   ├── ai/                       # AI abstraction layer
│   │   ├── ai_reasoner.py        # Main LLM prompts logic
│   │   ├── vertex_client.py
│   │   ├── bedrock_client.py
│   │   └── perplexity_connector.py
│   ├── engines/                  # 7 engines (Formwork, Rebar, Pour, Maturity, Scheduler, PERT, Pump)
│   ├── knowledge_base/           # B0-B9 (viz domain.md)
│   ├── services/                 # Project cache, document services
│   ├── models/                   # Pydantic schemas
│   ├── utils/                    # Helpers, report generator
│   └── main.py                   # FastAPI entry
│
├── apps/                         # Kiosky (Node+React)
│   ├── portal/                   # stavagent.cz
│   ├── registry/                 # registry.stavagent.cz
│   ├── monolit-planner/          # kalkulator.stavagent.cz
│   └── klasifikator/             # klasifikator.stavagent.cz
│
├── catalogs/                     # Local cache pro catalogs
│   └── urs_local_cache.jsonl     # P0 roadmap
│
├── docs/                         # All documentation
│   ├── steering/                 # Permanent project context (this folder)
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── structure.md          # ← tento dokument
│   │   ├── domain.md
│   │   └── conventions.md
│   ├── specs/                    # Feature specs (req/design/tasks)
│   │   └── {feature-name}/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       └── tasks.md
│   ├── bugs/                     # Bug specs (report/analyze/fix/verify)
│   │   └── {bug-id}/
│   │       ├── report.md
│   │       ├── analyze.md
│   │       ├── fix.md
│   │       └── verify.md
│   ├── reference/                # Catalogs, examples, golden tests
│   │   ├── golden_tests/
│   │   ├── architecture/
│   │   ├── audits/
│   │   ├── findings/
│   │   ├── playbooks/
│   │   └── marketing/
│   ├── handoff/                  # Session handoff snapshots
│   │   └── {YYYY-MM-DD}.md
│   ├── templates/                # Templates pro nové specs/bugs
│   │   ├── _TEMPLATE_steering.md
│   │   ├── _TEMPLATE_spec/
│   │   └── _TEMPLATE_bug/
│   └── soul.md                   # Living memory (Claude session continuity)
│
├── scripts/                      # Operational scripts
│   ├── setup_*.sh
│   ├── diagnose_*.py
│   └── migrations/
│
├── tests/                        # Tests (code-level, mocks)
│   ├── unit/
│   └── integration/
│
├── test-data/                    # Real-world test corpora + project data
│   ├── tz/                       # Golden test markdowns per TZ case
│   │   ├── SO-202_D6_most_golden_test.md
│   │   ├── SO-203_D6_most_golden_test_v2.md
│   │   ├── SO-207_D6_estakada_golden_test_v2.md
│   │   ├── VP4_FORESTINA_operna_zed_golden_test.md
│   │   └── ...
│   ├── RD_Jachymov_dum/          # N=5 corpus case (Phase 0b foundation)
│   ├── SO_250/                   # SO-250 D6 Žalmanov data
│   ├── hk212_hala/               # hk212 Hradec Králové data
│   │   ├── inputs/               # TZ PDFs + DXFs + PBŘ + situace + dokumentace (IGP, etc.)
│   │   ├── outputs/
│   │   │   ├── phase_1_etap1/    # items_*.json, ABMV queue, kapitola audit, project_header
│   │   │   ├── dsp_dxf_ut_integration/   # Stage A/B/C — UT discovery, kusovník, energy bilance
│   │   │   ├── dsp_geometry_extraction/  # Task 2 + Step 3
│   │   │   │   ├── layer_dictionary_*.json
│   │   │   │   ├── extraction_raw.json + extraction_aggregated.json
│   │   │   │   └── step3_areas/          # polygonization, 9 area metrics
│   │   │   ├── soupis_praci/             # Final tender deliverable (KROS-matched soupis)
│   │   │   │   ├── preflight_inventory.md
│   │   │   │   ├── kros_match_results.json + kros_match_report.md
│   │   │   │   ├── hk212_soupis_praci.{json,xlsx}
│   │   │   │   └── HANDOFF_TENDER_READY.md
│   │   │   └── audit_2026_05_23_fresh_eyes.md   # Fresh-eyes read-only audit
│   │   ├── handoff/              # session_handoff_*.md
│   │   └── scripts/
│   │       ├── dsp_geometry_extraction/  # step1/1b/1c/2/3 (auto-detect → polygonize)
│   │       ├── phase_1_etap1/    # stage_d_apply_updates, stage_e_add_opl, phase_1_igp_integration, fix_f1, rework_patky_vykop_deska
│   │       └── soupis_praci/     # phase_a_preflight, phase_b_kros_match, phase_c_generate_outputs
│   ├── libuse/                   # Libuše VELTON data
│   ├── most-2062-1-zihle/        # Žihle 2062-1 bridge data
│   ├── most-litovel/             # Diploma thesis — KB study material (TKP 4 + ČSN 73 6244 + VL 4)
│   ├── kros_catalog.db           # KROS catalog SQLite (working copy)
│   └── STAVAGENT_Drawings_to_VV_Rozpocet_Playbook.md
│
├── .claude/                      # Claude Code settings (optional, viz tech.md §13)
├── CLAUDE.md                     # Per-repo Claude Code instructions
├── README.md
├── cloudbuild-portal.yaml
└── package.json (root for monorepo tooling)
```

---

## 2. Core ↔ Kiosks call pattern

**Princip:** Core Engine **neví** o existenci kiosks. Každý kiosk volá Core API nezávisle.

### 2.1 Příklad — Klasifikátor flow

```
User → Klasifikátor UI (klasifikator.stavagent.cz)
       │
       │ POST /api/v1/classify
       ▼
Core Engine (FastAPI, Cloud Run)
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
- ❌ Kiosk přímo čte z `app/knowledge_base/` (vždy přes Core API)
- ❌ Core API volá frontend (jednosměrný tok)
- ❌ Kiosk A volá Kiosk B přímo (vždy přes Core nebo společnou DB)
- ❌ Hardcoded norma v kiosk kódu (přesunout do `app/knowledge_base/`)

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
| Nový parser pro nový file format | `app/parsers/{format}/` |
| Nový AI prompt | `app/ai/prompts/{prompt_name}.py` (extract z `ai_reasoner.py`) |
| Nový engine | `app/engines/{engine_name}_engine.py` |
| Nová Pydantic schéma | `app/models/{domain}.py` |
| Nový API route | `app/api/{resource}.py` (registrovat v `main.py`) |
| Nový React component | `apps/{kiosk}/src/components/{ComponentName}.tsx` |
| Nový knowledge zdroj (PDF, norma) | `app/knowledge_base/{B?_bucket}/{source_slug}/` — viz `domain.md` §3 |
| Spec pro novou feature | `docs/specs/{feature-name}/` (3 files: req/design/tasks) |
| Bug specifikace | `docs/bugs/{bug-id}/` (4 files: report/analyze/fix/verify) |
| Golden test (TZ case) | `test-data/tz/{case_name}_golden_test.md` |
| Project test data (PDFs, DXF, XLSX) | `test-data/{project_slug}/` |
| Dataset-bound playbook | `test-data/{playbook_name}.md` |
| Project-agnostic playbook | `docs/reference/playbooks/{name}.md` |
| Catalog working DB | `test-data/{catalog}.db` |
| Operational script | `scripts/{script_name}.{py,sh}` |

---

## 5. Co **nepatří** do repa

- ❌ Raw TZ PDFs (jdou do GCS bucket)
- ❌ Velké datasety > 50 MB (GCS)
- ❌ Secrets, API keys, tokens (Secret Manager nebo `.env` v `.gitignore`)
- ❌ `node_modules`, `__pycache__`, `.pyc`, `dist/`, `build/` (kromě `apps/*/public/prerendered/`)
- ❌ Cloudbuild artefakty
- ❌ User uploads (jdou do GCS)
- ❌ `*.py` souborů obsahujících business logic v `docs/` (kód patří do `app/`)
- ❌ Orphaned PDF / DXF / XLSX v root repa (project data jde do `test-data/{project_slug}/inputs/{dokladova_cast,vykresy_dxf,vykresy_pdf,tz,situace}/`)
- ❌ Ad-hoc `data/` složka v root (vendor reference → `docs/reference/`; operational scripty → `scripts/`; vendor PDFs → `app/knowledge_base/B5_tech_cards/{vendor_product}/`; element specs → `docs/specs/element/{name}.md`)

---

## 6. Git workflow

### 6.1 Branches

- `main` — produkce, **branch protection enabled, bez výjimky**
- `feature/{spec-name}` — pro novou feature, mapuje na `docs/specs/{spec-name}/`
- `bug/{bug-id}` — pro bug fix, mapuje na `docs/bugs/{bug-id}/`
- `spec/{spec-name}` — pouze pro spec PR (před implementací)

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
| Architecture deep dive | `docs/reference/architecture/` |
| Vendor catalog (PERI, DOKA) | `app/knowledge_base/B5_tech_cards/formwork_vendor/` + `docs/reference/formwork_catalog_2025.md` |

---

## 8. Document versioning

| Date | Version | Notes |
|---|---|---|
| 19.05.2026 | 1.0 | Initial structure steering. Bude rozšiřováno při přidávání nových modulů. |
| 19.05.2026 | 1.1 | §5 doplněn: zákaz orphaned project files v root + zákaz ad-hoc `data/` (per orphaned-files cleanup handoff). |
