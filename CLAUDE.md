# CLAUDE.md - STAVAGENT System Context

**Version:** 4.29.0
**Last Updated:** 2026-05-11
**Repository:** STAVAGENT (Monorepo)

---

> **English TL;DR for external readers**
>
> This is the operational reference for Claude Code sessions working on STAVAGENT. It contains architecture decisions, coding conventions, and business-logic invariants. The document below is written in Russian and Czech for the primary maintainer — if you opened this repo from GitHub, start with [README.md](README.md) instead.
>
> **What STAVAGENT is:** an AI-powered construction cost estimation SaaS for Czech and Slovak civil-construction markets, with an MCP Server exposing nine domain-specific tools. Five production backends on Google Cloud Run plus four frontends on Vercel. Architecture is deterministic-first: regex and catalog lookups run before LLM fallback, and higher-confidence results never get overwritten by lower-confidence ones.
>
> **Changelog — v4.29.0 (2026-05-11 — Calculator Resource Ceiling Phase 1):** New subsystem answers the demo question *"u nás je fixně 12 lidí, jak to spočítáš?"* — calculator now respects user-supplied resource constraints (workers per profession, formwork sets, pumps, cranes, deadline) per task §5.5 confidence ladder (manual 0.99 > KB default 0.85 > auto-derived lower bound 1.00 — physics wins over user; user wins over defaults). Shared model `Monolit-Planner/shared/src/calculators/resource-ceiling.ts` (~711 LOC): `ResourceCeiling` union schema with 4 sub-objects (workforce / formwork / equipment / time), 22-of-24 element-type relevance maps (`pilota` skips formwork_sets+vibrators per pažnice/tremie, `podkladni_beton` skips rebar_workers per prostý beton, `rimsa` skips formwork_sets per římsové konzoly fixed na NK, `mostovkova_deska` includes finishers+falsework_sets+mss+night_shift, `podzemni_stena` skips carpenters per bentonit suspenze), `applyResourceCeilingDefaults()` merge logic (user wins per field, total-only scaling of default profession breakdown), `checkCeilingFeasibility()` returns structured `CeilingViolation[]` with ⛔ KRITICKÉ severity prefix + recovery hints (e.g. *"Rozdělit do N záběrů s pracovní spárou v ose pole"*). B4 source-of-truth YAML at `concrete-agent/.../B4_production_benchmarks/default_ceilings/` for 2 Phase-1 reference elements: `operne_zdi.yaml` (12 lidí / 4t / 4ž / 3b / 2v, 2 soupravy, 1 čerpadlo, 1 jeřáb; B4 standard_s_jeravem baseline) + `mostovkova_deska.yaml` (21 lidí / 4t / 4ž / 6b / 3v / 2f / 2 dozor, pevná skruž 1 sada, 2 pumps + 1 backup, multi-shift + night per §116 ZP). 22 remaining typů jsou Phase 2-7 follow-up per task §6 Group A-F. Engine integration v `planner-orchestrator.ts` §8b — builds `EngineeringDemand` z `numFWCrews × crew + numRBCrews × crewRebar + pourCrewBreakdown (ukladani/vibrace/finiseri)` s MAX-of-phases pro `num_workers_total` (formwork/rebar/pour jsou sequential RCPSP DAG phases, ne simultaneous) + `pourDecision.pumps_required` + `profile.needs_crane` + `scheduleResult.total_days` → `checkCeilingFeasibility` → populates `PlannerOutput.resource_violations[]` + pushes ⛔/ℹ️ messages do `warnings[]` (legacy UI banner compat). R3 smoke test verifies v4.20 pump-count invariant (`pour-task.pumps_required === pour-decision.pumps_required`); R4 fix removed dead `DEFAULTS.crew_size: 6` z pour-task-engine (field marked informational only — authoritative pour-crew source = `computePourCrew(volume, n_pump, element)` v orchestrator). 6 new golden test scenarios in `golden-vp4-forestina.test.ts` (default + 5p+1s+1p INFEASIBLE + 12p+2s+1p feasible) and new `golden-so203.test.ts` (default + 21p+4p+1backup feasible + 12p+1s+1p INFEASIBLE-with-split-hint). **1088 tests passing** (1036 Gate 2 baseline + 52 from this PR including 31 resource-ceiling unit + 6 golden + 15 from main's merged-in monolith-classifier suite). Phase 0 audit doc at `docs/audits/calculator_resource_ceiling/2026-05-07_phase0_audit.md` (493 řádků, 4 inventory tables + R1-R12 recommendation block + verdict). Pre-flight pre-merge fix: 4 `zaklady_oper` Record gaps closed in parallel by a sister PR landing in main → standard 3-way merge cleanly absorbed identical fixes. Branch `claude/calculator-resource-ceiling-phase0` shipped as PR #1110, 17/17 CI checks green (Shared Formula Tests / Lint+Type Check / Test Backend / Test Shared Package / Build Frontend / MCP Tools Compatibility / Security Audit / Coverage / CI Summary all success), zero regressions, no force-push, no rebase, linear commit history preserved (Phase 0 audit + 4 Foundation commits + merge). Phase 2-7 carry-forward TODO: UI form in `CalculatorFormFields.tsx` Expert panel (Q6 interview answer was "Extend Expert panel"), B4 YAML for remaining 22 types per Group A pozemní vodorovné / B pozemní svislé / C pozemní speciální / D mostní spodní stavba / E mostní NK / F mostní svršek, Foundation C2 auto-recovery split (engine re-runs with capped pumps + working_joints_allowed='yes' to derive forced section split instead of just emitting ⛔ violation), cosmetic fix of inherited zaklady_oper description_cs (main's verbatim-from-pilíře template says "Základy pilířů" inside the zaklady_oper entry — minor labeling inconsistency, separate cleanup task).
>
> **Changelog — v4.28.0 (2026-05-07 — Žihle 2062-1 D&B pilot complete):** First end-to-end production-shaped pilot finished `tender_ready` for Most ev.č. 2062-1 u obce Žihle (D&B SÚSPK, deadline 2026-07-02 10:00, ZD limit 30 M Kč). Master soupis: 154 položek across 6 SO (SO 001 demolice + SO 180 provizorium + SO 201 most 5 částí + SO 290 silnice + SO 801 ZS detailní + VRN), 10 585 736 Kč bez DPH (12 808 741 Kč s DPH 21 %, 42.7 % vs ZD limit, margin 17.2 M Kč). 100 % audit-trail coverage (formula+vstupy+vypocet_kroky+confidence per položka). 16 reconciliation flags |Δ%|>10 % vs user manual SO_201_JŠ.xls (Kfely template) all explained inline. 4 explicit ZD §4.4.l exclusions (428xxx ložiska, 93152 závěr, 93315 2-pole zkouška, 84914 odpadní potrubí — integrální rám). 4 final aggregation deliverables auto-generated by `build_master_soupis.py`: master_soupis.yaml index + validation_report.md (305 řád. 10 sekcí) + soupis_praci_FINAL.xml (UNIXML 1.2 KROS, 6 objektů × 154 polozka, schema-compliant) + soupis_praci_FINAL.xlsx (8 sheets). Phase E experiment (`build_situace_svg.py` → C.2.1_situace_M1_500.svg + cairosvg PNG) successful as proof-of-concept but **explicitly dropped from product scope per ADR-005** — engineering drawings stay with autorizovaný projektant (ČKAIT signature, zákon 360/1992 Sb.); STAVAGENT moat is text/data layer, geometry extraction kept only as validation tool. **2 new docs at root:** `docs/STAVAGENT_PATTERNS.md` (7 Žihle-validated patterns: per-SO chunking proti API stream timeouts, audit trail mandatory, triangulation no-winner, anchor pattern, TSKP 0-9 hierarchy, no-work-duplication 5 strategií, vendor pricing median 4 vendorů); `docs/architecture/decisions/` ADR structure initiated with ADR-005 Phase E dropped. **2 backlog tickets** opened from reconciliation gaps (G1-G4): `backlog/calculator_prompt_extension.md` ~144 h (extend calculator z 11 betonářských elementů na ~25 — TSKP 0/1/5/7/8/9 layers); `backlog/otskp_search_algorithm.md` ~52-64 h (4-stage TSKP-based fuzzy search 17904 codes, 80 % top-1 / 95 % top-3 acceptance). **CI fix mid-pilot:** `zaklady_oper` element type added to 4 missing `Record<StructuralElementType>` exhaustive maps (`pour-decision.ts:161` ELEMENT_DEFAULTS, `props-calculator.ts:136` ELEMENT_DIMENSION_HINTS, `construction-sequence.ts:18+61` BRIDGE/BUILDING_ELEMENT_ORDER) — mirroring zaklady_piliru sister entry, tsc clean (commit `a9d56ed1`). **Outstanding P0 blocker pre DUR (project-level, NOT product):** Povodí Vltavy souhlas missing for parcels 1836+385/13 (Mladotický potok) — blocks SO 001 T9-09/10 + SO 201 T4-08/T9-18 (cca 173 365 Kč scope). All Žihle artefakty under `test-data/most-2062-1-zihle/` retained as reference template for future pilots. Pilot atomic commits: `cc9dd1e2`..`fb8b1f83` (~20 commits incl. per-SO/per-třída granular workflow). Pivotal product positioning shift: STAVAGENT = automation of text/data layer of D&B nabídky (TZ + soupis + audit trail + reconciliation), NOT engineering CAD. Engineering = projektant. Liability = projektant. Narrower scope, stronger product. New canonical reference for next pilot project: copy `test-data/most-2062-1-zihle/` skeleton + 7 patterns + ADR-005.
>
> **Changelog — v4.27.0 (2026-05-03 — Gate 2 closed, PR #<TBD>):** Element classification correctness across all 24 element types via Option W architectural principle. Phase 1 golden test framework (`Monolit-Planner/shared/src/calculators/golden-so202.test.ts` + `golden-vp4-forestina.test.ts` Vitest fixtures, 11 tests baseline pre-Gap-8). Phase 2 Gap #8 RESOLVED — Top 50 + VARIOKIT HD 200 reclassified per canonical §9.1 / §9.2: Top 50 → `pour_role: 'formwork'` + `formwork_subtype: 'nosnikove'` (Vrstva 1 — kontaktní povrch); VARIOKIT HD 200 → `pour_role: 'formwork_beam'` (NEW enum, Vrstva 2 — horizontální nosníky). `PourRole` union expanded; `FormworkSubtype` type alias added (`'ramove' | 'nosnikove' | 'stropni' | 'beam'`). 4 atomic commits (`6d2784f` types + `b60d24d` Top 50 + `b2fc701` VARIOKIT HD + `0ccc371` Re-Snapshot docs). Phase 3 Mostní (10 typů) — added `zaklady_oper` element type (Option α literal parallel pattern, `78d5dd9`); applied **Option W principle** (canonical `recommended_formwork[0]` over algorithmic optimization) to horizontal selector (`06f744a`) + vertical selector with DIN 18218 pressure-filter safety preserved (`18f36da`); 6-test verification regression net (`6849c45`). Phase 4 Pozemní (13 typů) — single regression net commit (`86b9a4e`, 12 tests) — pre-emption pattern proven: all elements auto-fixed by Option W extension, no further code changes. Phase 5 closeout (audit corrections + migration plan + this entry + `next-session.md` + PR creation, 5 commits). 11 commits on `gate-2-element-classification` branch. **1036 tests passing** (was 1002 baseline pre-Gate-2, +34 new across phases). 4 golden test fixtures automated. **16 stop-and-ask instances** during Gate 1 + Gate 2 implementation — pattern principle: investigative thinking before code = vastly fewer broken commits. References: `Monolit-Planner/docs/AUDIT_Podpera_Terminologie.md` (Gap #8 RESOLVED, Section 0 + A.3 + C.3), `Monolit-Planner/docs/MIGRATION_PLAN_GATE2_TO_GATE4.md` (Phase 1-4 DONE markers + Section 5b architectural insights + Section 5d carry-forward to Gate 3 / Gate 4 / Gate 7), `docs/CALCULATOR_PHILOSOPHY.md` (unchanged), canonical doc `Section 9` (unchanged, cleanup deferred to Gate 7).
>
> **Changelog — v4.26.0 (2026-04-29):** Cost-optimization sweep cut projected GCP burn ~$70–90/mo: Cloud SQL `availabilityType` REGIONAL→ZONAL, `concrete-agent` min-instances 1→0 (in-memory KB cache lost on cold start, accepted), Cloud Run old-revision cleanup across 6 services, Artifact Registry cleanup policy `keep-last-5 + delete >30d` applied (~663 GB → expected 30–80 GB), Cloud Logging `_Default` retention 30→7 d. Registry classification round-trip via `services/classificationCodec.ts` repurposes the previously-idle `registry_items.sync_metadata TEXT` column to ship 16 classifier fields (rowRole, parentItemId, sectionId, popisDetail, `_rawCells`, originalTyp, classification confidence/source, source_format/row_index, por, cenovaSoustava, varianta, …) without a DB migration; pull side `applyClassificationBlob` re-hydrates `ParsedItem`. `App.tsx loadFromPortal` dedupe also matches by `portalLink.portalProjectId` (fixes duplicate import on Portal-linked projects). Ribbon feature flag retired — `ribbonFeatureFlag.ts` + `RibbonFlagToggle.tsx` deleted, `App.tsx` shrunk 1517→871 lines, `RibbonLayout` always mounted. Portal "Stáhnout z Registru" kiosk-row button removed (was 401 + no-op `sheets:[]` push to a PUSH endpoint); monolit's analogous button got missing `authHeader()` for free. Cloud Build pipeline confirmed healthy (false-alarm "trigger broken" from prior session resolved). Outstanding: `VITE_DISABLE_AUTH=true` still set in Portal Vercel Production — must flip + redeploy. Spec + follow-ups in `docs/SESSION_HANDOFF_2026_04_29.md` + `docs/SYNC_AUDIT_2026_04_29.md`.
>
> **Changelog — v4.25.0 (2026-04-23):** Registry row classifier v1.1 rewrite shipped in two merges (PR #1006 core module + PR #1008/#1009 integration, twin-merge auto-dedup). Universal column auto-detection replaces 3-format gate; Typ-column fast-path + content-heuristic fallback. 87 vitest tests added (first tests in rozpocet-registry) covering all 13 edge cases from `docs/ROW_CLASSIFICATION_ALGORITHM.md` v1.1. Integration verified on 3 real fixtures: 482 mains + 2097 subs + 70 sections + 0 orphans across 2649 classified items. New "Překlasifikovat" button in ItemsTable toolbar reconstructs from per-item `_rawCells` preserved at import. Spec + follow-ups in `rozpocet-registry/docs/ROW_CLASSIFICATION_ALGORITHM.md` + `TASK_ClassifierRewrite.md` + `next-session.md` §14-17.
>
> **Changelog — v4.24.0 (2026-04-19):** root cleanup (PR #911) moved archives and domain-knowledge PDFs into `docs/`. Infrastructure hardening (PR #914, #967): `concrete-agent` runs with `--min-instances=1` to preserve in-memory state; Cloud SQL authorized networks cleared; Dependabot configured with grouped minor/patch and major-bump ignore. README rewritten in English (PR #973). Extended operational checklist lives at [`docs/STAVAGENT_ClaudeCode_Session_Mantra.md`](docs/STAVAGENT_ClaudeCode_Session_Mantra.md).

---

## Правила ведения этого файла

> Справочник, не журнал. Лимит ~300 строк. Один факт = одна строка.

**При завершении сессии:** обнови числа (Endpoints/Tests/LOC), факты (URL/env/модель), Version+Date. Добавь новые subsystem/TODO. Удали закрытые TODO.

**ЗАПРЕЩЕНО:** логи сессий, номера PR/коммитов/веток, пошаговые описания, дублирование per-service CLAUDE.md.

**Сокращение при >330 строк:** TODO (закрытые) → Services (детали в per-service) → Quick Debugging (устаревшие).

---

## 📐 Calculator Philosophy (POVINNÉ ČTENÍ)

**Před úpravou kalkulátoru, golden tests, acceptance criteria, nebo UI textů** — přečti:

```
docs/CALCULATOR_PHILOSOPHY.md
```

**TL;DR pozicování:**

- Kalkulátor je nástroj pro **přípraváře a rozpočtáře**, ne engineering software
- Cíl: **±10–15% přesnost** pro tendrovou kalkulaci, technologicky správný stack
- Detailní statický návrh + přesná specifikace = **odpovědnost dodavatele** (DOKA/PERI/ULMA)
- Spotřební materiály se počítají **procentem** (různé per element type), ne přesně
- UI musí obsahovat **disclaimer** o orientačním odhadu
- Acceptance criteria neváží na absolutní přesnost — váží na technologickou správnost + rule-of-thumb percentile

**Důsledek pro Claude Code práci:**

- ❌ Neimplementuj acceptance criteria typu „kalkulátor musí vrátit přesně X Kč"
- ✅ Implementuj acceptance criteria typu „kalkulátor musí vrátit X v rozmezí ±15%"
- ❌ Neabsolutuj v UI textech („NIKDY", „NUTNO", „NEPOUŽITELNÉ")
- ✅ Používej recommendation language („doporučený", „v běžné praxi", „obvykle")
- ❌ Nepřidávej do UI seznamu detailních komponentů (šrouby, anchory, custom adaptéry)
- ✅ Přidávej hlavní systémy + procenta spotřebních materiálů per element type
- ❌ Negarantuj exact pricing — kalkulátor je estimate
- ✅ Vždy zobrazuj disclaimer „Detail u dodavatele"

**Související dokumenty:**

- `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA.md` — kanonická terminologie skruž / stojky / podpěrná konstrukce
- `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md` — rozšíření o 3-vrstvý stack a sub-taxonomii bednění
- `Monolit-Planner/docs/AUDIT_Podpera_Terminologie.md` — Gate 1 audit terminologie
- `test-data/tz/` — golden test reference projekty (SO-202, SO-203, SO-207)

---

## Quick Reference

```
STAVAGENT/
├── concrete-agent/        ← CORE (Python FastAPI, port 8000)
├── stavagent-portal/      ← Portal/Dispatcher (Node.js/Express/React, port 3001)
├── Monolit-Planner/       ← Kiosk: Kalkulátor betonáže (Node.js/React, port 3001/5173)
├── URS_MATCHER_SERVICE/   ← Kiosk: Klasifikátor stavebních prací (Node.js, port 3001/3000)
├── rozpocet-registry/     ← Kiosk: Registr (React/Vite + Vercel serverless, port 5173)
├── scripts/               ← Helper scripts (dangerous/ subdir for destructive ops)
├── docs/                  ← ARCHITECTURE.md, normy/, archive/
├── mineru_service/        ← MinerU PDF parser (Python FastAPI, Cloud Run europe-west1, port 8080)
└── .github/workflows/     ← CI/CD
```

**Infrastructure:** Cloud Run (europe-west3) + Vercel + Cloud Build. **No Render.**

| Service | URL | Custom Domain |
|---------|-----|---------------|
| concrete-agent (CORE) | concrete-agent-1086027517695.europe-west3.run.app | — |
| portal backend | stavagent-portal-backend-1086027517695.europe-west3.run.app | — |
| portal frontend | www.stavagent.cz | www.stavagent.cz |
| Kalkulátor betonáže — backend (Monolit-Planner repo) | monolit-planner-api-1086027517695.europe-west3.run.app | — |
| Kalkulátor betonáže — frontend (Monolit-Planner repo) | monolit-planner-frontend.vercel.app | **kalkulator.stavagent.cz** |
| Klasifikátor (URS_MATCHER_SERVICE repo) | urs-matcher-service-1086027517695.europe-west3.run.app | **klasifikator.stavagent.cz** |
| Registry backend | rozpocet-registry-backend-1086027517695.europe-west3.run.app | — |
| Registry frontend | stavagent-backend-ktwx.vercel.app | **registry.stavagent.cz** |

**DB:** Cloud SQL PostgreSQL 15 (`stavagent-db`): `stavagent_portal`, `monolit_planner`, `rozpocet_registry`
**GCP:** Project `project-947a512a-481d-49b5-81c` (ID: 1086027517695), SA: `1086027517695-compute@developer.gserviceaccount.com`

| LLM Provider | Models | Auth | Budget |
|-------------|--------|------|--------|
| Vertex AI Gemini (primary) | `gemini-2.5-flash` (default), `gemini-2.5-pro` (heavy) | ADC | $1,000 GCP |
| Perplexity AI | sonar (web-search) | `PPLX_API_KEY` in GCP SM | $5,000 |
| AWS Bedrock (us-east-1) | Claude 3 Haiku/Sonnet/Opus | GCP SM secrets | $20 + $84 Free Tier |

**Note:** `gemini-2.5-flash-lite` returns 404 in europe-west3. Use `gemini-2.5-flash`.

---

## Architecture

```
Portal (Dispatcher) ──┬──→ concrete-agent (CORE: AI, parsing, audit, Multi-Role)
                      ├──→ Monolit-Planner (concrete cost calculator, CZK/m³)
                      ├──→ URS_MATCHER_SERVICE (BOQ→URS code matching)
                      └──→ rozpocet-registry (BOQ classification, Vercel serverless)

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

## Services

### 1. concrete-agent (CORE)
Python FastAPI. **120 endpoints**, **34 test files**, **~61K LOC**.
Structure: `packages/core-backend/app/{api,services,classifiers,knowledge_base,parsers,prompts}`
KB: 42 JSON files (~40MB), 21 prompt files, 23 SQL schemas.

**Subsystems:** Multi-Role Expert (4 roles), Workflows A/B/C, Document Accumulator (20 ep), Multi-Format Parser v5.0 (XLSX/XML/PDF/DXF/OCR), Add-Document Pipeline (14 doc types), NKB 3-layer, NormIngestionPipeline (chunked: L1→chunk→per-chunk[L2+L3a]→merge→L3b), NKB Audit (15 sources), Unified Item Layer, Soupis Assembler, Scenario B, Section Extraction Engine v2 (28 extractors, negative-context filter), Calculator Suggestions (fact→param mapping, warnings, conflicts, write-through persistence), Chunked Extraction (document_chunker + parsed_document_adapter + extraction_to_facts_bridge), Drive OAuth2, Agents, Chat, **MCP Server v1.0** (9 tools, FastMCP, mounted at `/mcp`).
- **MCP Server** — `app/mcp/server.py` + `app/mcp/tools/` (9 tools): find_otskp_code, find_urs_code, classify_construction_element, calculate_concrete_works, parse_construction_budget, analyze_construction_document, create_work_breakdown, get_construction_advisor, search_czech_construction_norms. FastMCP 3.x, mounted on FastAPI at `/mcp`.
- **MCP Auth** — `app/mcp/auth.py` + `app/mcp/routes.py`: bcrypt passwords, per-thread SQLite pool, API keys (`sk-stavagent-{hex48}`), 200 free credits, per-tool billing (0-20 credits), atomic `UPDATE WHERE credits >= cost`, rate limiting (10/60s per IP), OAuth 2.0 `client_credentials` for ChatGPT. REST wrappers at `/api/v1/mcp/tools/*` (auto-generate OpenAPI for GPT Actions). Lemon Squeezy webhook at `/api/v1/mcp/billing/webhook`.
- **MCP CI** — `tests/test_mcp_compatibility.py` (17 tests), `.github/workflows/test-mcp-compatibility.yml`. Runs on every push to concrete-agent/.
- **LLM chain** — Vertex AI → Bedrock → Gemini API → Claude API → OpenAI
- **Confidence** — regex=1.0, OTSKP DB=1.0, drawing_note=0.90, Perplexity=0.85, URS=0.80, AI=0.70

### 2. stavagent-portal (Dispatcher)
Node.js/Express + React. **~80+ endpoints**, **20 pages**, **40+ components**.
JWT auth (24h), 5 org roles, Stripe credits (fail-open), Data Pipeline admin, CORE proxy (300s timeout, headersTimeout=310s).
Design: Brutalist Neumorphism, monochrome + orange #FF9F1C, BEM.
- **Landing page v2.0** (`LandingPage.tsx`, 622 lines): 12 sections (Nav→Hero→Social proof→Pro koho→5 Modulů→Jak to funguje→Blok důvěry→Příklad→Technologie→Ceník→FAQ→Footer). H1: "Stavební rozpočty a dokumentace pod kontrolou". Credit pricing table (15 ops). FAQ accordion (8 Q&A).
- **SEO:** `index.html` has og:title, og:description, canonical, twitter card. Title matches AI-last philosophy.
- **Credit system:** `add-credit-system.sql` seeds 15 operation prices (2–20 credits). 200 free on registration, 1 Kč = 10 credits.

### 3. Kalkulátor betonáže (Monolit-Planner repo, Kiosk)
Node.js/Express + React. **132 endpoints**, **1088 shared tests**, **~43K LOC**.
Structure: `shared/` (1088 tests, ~28 files post-Phase-1), `backend/` (Jest tests — env-isolated, not run via vitest workspace), `frontend/` (0 tests). Design: Slate Minimal (`--r0-*`).
**DB:** 45 tables (incl. `planner_variants`). **Frontend:** PlannerPage (Part B) ~380 lines layout, logic in `useCalculator` hook + 10 files in `components/calculator/` (Sidebar, FormFields, Result, HelpPanel, WizardHints, InlineResourcePanel, applyPlanToPositions, ui, types, helpers, useCalculator).

- **Calculator:** CZK/m³, `unit_cost_on_m3 = cost_czk / concrete_m3`, `kros_unit_czk = Math.ceil(x/50)*50`
- **Element Planner:** 23 types (12 bridge incl. `zaklady_oper` + 11 building), 7-engine pipeline, Gantt + XLSX export, SuggestionBadge + DocWarningsBanner via Core API
- **Resource Ceiling (v4.29):** `resource-ceiling.ts` — `ResourceCeiling` union (workforce per-profession + formwork sets/falsework/props/MSS + pumps/backup/cranes + deadline/shifts/night), per-element relevance maps (22 of 24 typů), `applyResourceCeilingDefaults()` merge (user 0.99 > KB 0.85, total-only scaling), `checkCeilingFeasibility()` returns ⛔ KRITICKÉ `CeilingViolation[]` + recovery hints. KB single source of truth = `B4_production_benchmarks/default_ceilings/<element>.yaml` (Phase 1: operne_zdi + mostovkova_deska; Phase 2-7 fills zbytek). Engine integration v orchestrator §8b builds `EngineeringDemand` (MAX-of-phases pro total) → feasibility check → `PlannerOutput.resource_ceiling` + `resource_violations[]` + warnings.
- **Element Subtypes:** beton, bednění, odbednění (Tesař), výztuž, zrání, podpěrná konstr., předpětí, jiné
- **OTSKP Catalog:** 11 regex patterns → element_type (confidence=1.0), metadata extraction (concrete class, prestress, prefab)
- **Position Linking:** `position-linking.ts` — links by OTSKP/URS code prefix (first 4 digits), 22 tests. `detectWorkType()` by 5th digit. `findLinkedPositions()` groups beton+výztuž+bednění.
- **NK Classification:** 8 bridge deck subtypes (deskový→spřažený), auto-detect from OTSKP name
- **Bridge Technology:** `bridge-technology.ts` — pevná/posuvná skruž/CFT recommendation, MSS cost+schedule, 20 tests. UI: radio buttons + recommendation card.
- **Křídla opěry:** separate element type `kridla_opery`, composite detection (opěra+křídla → dual formwork)
- **Lateral Pressure:** p = ρ×g×h×k (DIN 18218), per-záběr staging (`max_stage = sys.pressure/full_pressure × h`, min 1.5m), shape correction (×1.0–1.8)
- **Formwork Selector:** Horizontal → skip pressure, select by category+rental. Vertical → per-záběr pressure filter. Frami 80 kN/m² (max 3.0m), Framax 100 kN/m² (max 6.75m), 30 systems total
- **Props:** `selectPropSystem()` with `preferred_manufacturer` vendor match (DOKA formwork → DOKA props). `PropsCalculatorResult.labor_hours` exposed.
- **Ztracené bednění:** `lost_formwork_area_m2` — TP deducted from system formwork, props on full area. UI checkbox for horizontal elements only.
- **Manual záběry:** `use_manual_zabery` toggle + editable table (name+volume+area per záběr). Engine receives `num_tacts_override = count, tact_volume_m3_override = max(volumes)`.
- **Per-záběr scheduling (v4.0):** `tact_volumes: number[]` in PlannerInput → per-záběr `calculatePourTask()`. `per_tact_concrete_days[]`, `per_tact_rebar_days[]`, `per_tact_assembly_days[]` in scheduler. Validation: mismatch length → warning + ignore.
- **Aplikovat → TOV (v4.14):** `applyPlanToPositions.ts` helper. Splits 7 work types (Betonář, Tesař montáž/demontáž, Železář, Ošetřovatel, Specialista předpětí, Tesař podpěry) across positions: URL ID → linked via prefix/name → AUTO-CREATE new sibling Position (POST with metadata) → last-resort merge into beton. Each entry carries `source: 'calculator'` for per-entry [×] delete gate in FlatTOVSection. `NO_FORMWORK` set (pilota, podzemni_stena) skips bednění drafts. Backend POST /api/positions accepts metadata in INSERT.
- **Pile pipeline (v4.16):** `shared/src/calculators/pile-engine.ts` — `PILE_PRODUCTIVITY_TABLE` (Ø600/900/1200/1500 × cohesive/noncohesive/below_gwt/rock × cfa/cased/uncased), `calculatePileDrilling()` mid-range piles/shift, drilling → 7d pause → head adjustment → optional cap, costs (rig + crane + crew + head_adj). Off-catalog Ø interpolated 1/d². 48 tests. Orchestrator early-branches via `runPilePath()` when `element_type==='pilota'`: bypasses formwork/lateral-pressure/props, populates `plan.pile`, keeps `formwork.system='Tradiční tesařské'` sentinel + 0 days so `element-audit` test suite still passes for pilota. Frontend FormState gets `pile_diameter_mm/length_m/count/geology/casing_method/rebar_index/has_pile_cap+3 cap dims`. CalculatorFormFields renders pile geometry block in step 3 only when type=pilota; CalculatorResult hides Bednění card + adds 6 PileCards (Vrtání/Armokoše/Betonáž/Úprava hlavy/[Hlavice]/Náklady); CalculatorSidebar gates "Porovnat bednění". applyPlanToPositions routes to `buildPileWorkDrafts` (vrtání + armokoše + beton kontraktor + úprava_hlavy + optional hlavice). `WorkType` union extended with 'vrtání' + 'úprava_hlavy'.
- **Calculator UX A1-A7 (v4.15):** A1 default `num_sets` 2→1 (1 sada is standard for most prvků; obrátkovost path stays for `num_identical_elements>1`). A2 Směna/Mzda labels shortened so 1fr/1fr grid renders side-by-side in 300px sidebar. A3 per-profession wages behind `use_per_profession_wages` toggle (default OFF, pre-fills with base on enable, clears on disable; LS migration sets ON for returning users with non-empty wages). A4 "Uložit variantu" button mirrored in PlannerPage header next to "?"/"Průvodce". A5 active-variant tracking: `activeVariantId` state on save/load/delete, `activeVariantDirty` derived via JSON diff of form vs variant.form, "● Aktivní"/"● Upraveno" badges + orange left-border, "Porovnat" toggle reveals VariantsComparison (desktop horizontal table with ★ best green / mobile cards sorted cheapest first via `.vc-desktop`/`.vc-mobile` @media swap), Excel export merges variants into scenarios sheet. A6 SANITY_RANGES widened: rimsa 2-200→0.5-500, pilota 1-200→0.5-600, driky_piliru 5-400→1-800, mostni_zavirne_zidky 1-20→0.3-40; soft warning copy "Neobvykle velká/malá hodnota… ověřte zadání". A7 `getSuitableSystemsForElement('rimsa')` short-circuits to recommended `['Římsové bednění T','Římsový vozík TU','Římsový vozík T']` (was returning slab/universal systems because generic loop skips `unit==='bm'`); manufacturer dropdown filter added to ComparisonTable in PlannerPage with <2-system fallback banner.
- **Calculator UX audit fixes (v4.17):** C1 zaklady_piliru orientation vertical→horizontal + estimateFormworkArea foundation-block special case. C2 maturity.ts CuringParams.exposure_class + EXPOSURE_MIN_CURING_DAYS (XF1=5d,XF3/XF4=7d,XD3=7d). C3 RECOMMENDED_EXPOSURE widened for zaklady/opery/operne/prechodova. C4 pile-engine.concrete_class echo+warning. C5 pile overpouring_m default 0.5. C6 getHeadsPerShift diameter-dependent table Ø600=5,Ø900=3,Ø1200=2,Ø1500=1.5. E2 L×W×H block for horizontal foundations (zaklady/patka/pas/opery). D1 price_mode full/schedule_only toggle. D2 Pokročilé panel default open.
- **Curing class 2/3/4 (v4.18):** `CURING_DAYS_TABLE` expanded to 3 classes × 5 temp ranges × 3 concrete groups per TKP18 §7.8.3. Class 3+ abs min 5d. `DEFAULT_CURING_CLASS`: mostovka/rimsa/rigel→4, opery/driky/zaklady/kridla/zidky/podlozkovy/operne_zdi→3, rest→2. `PlannerInput.curing_class` auto-resolved via `getDefaultCuringClass(elementType)`. FormState+UI selects (exposure_class XC1-XA2, curing_class 2/3/4/auto) in Expertní panel. `wizardHint2` passes exposure+curing — was hardcoded class 2.
- **RECOMMENDED_EXPOSURE + rebar defaults (v4.18):** opery_ulozne_prahy +XF4, driky_piliru +XF2, zaklady_piliru +XA2, mostni_zavirne_zidky new [XF4,XF3,XD1,XC4], podlozkovy_blok [XF2,XF4,XC4]. Rebar: zaklady_piliru 100→120, opery_ulozne_prahy 100→140 kg/m³. Pile `getDefaultRebarIndex(diameter)`: Ø<800→40, 800-999→90, Ø≥1000→100 kg/m³. Framax Xlife pressure 100→120 kN/m². Column formwork (SL-1, QUATTRO) h≤8m → 1 záběr exemption in `suggestPourStages`. kridla_opery recommended_formwork duplicate removed. `driky_piliru` added to geomTypes L/W/H block.
- **Catalog gap fill (v4.18):** `podkladni_beton` (rebar=0, `needs_formwork=false`, horizontal) + `podlozkovy_blok` (rebar 180, horizontal, small precision block). ELEMENT_CATALOG+ELEMENT_DEFAULTS+SANITY_RANGES+REQUIRED_FIELDS+BRIDGE_ELEMENT_ORDER+BUILDING_ELEMENT_ORDER+ELEMENT_DIMENSION_HINTS all updated. Classifier OTSKP early-exit (line 734) was force-returning 'other' for `podkladn|podkl|vyplnov` → now routes to podkladni_beton with reinforced-concrete suppression (`zelezobet|vyztuz|armovan` → 'other').
- **UI 3-layer split (v4.18):** `getSmartDefaults(element_type)` in helpers.ts maps all 24 types to typical exposure+curing+concrete. useCalculator auto-fills empty FormState fields on element_type change (preserves user overrides). CalculatorFormFields: Quick layer (type+volume+concrete in always-visible), Standard (height/geom/season), Expert (exposure/curing/cement + crews + formwork + simulation) inside renamed "Expertní parametry" collapsible. Auto-badge shows "Prostředí: XF4 (auto) · Ošetřování: třída 3 (auto) · změnit ▸" with deeplink to Expert panel.
- **Cyrillic cleanup (v4.18):** Dropdown `Příčník (ригель)` → `Příčník / hlavice pilíře`. Pour-decision comment updated. Classifier internal keyword arrays retain Cyrillic (Russian input matching — not user-facing).
- **Prestress formula v2 (v4.18):** old `prestressDays = max(5, span/10)` → `waitForStrength + stressingDays + groutingDays`. Wait = max(7, curing_days). Stressing = ceil(num_cables / {6 jednostranné, 10 oboustranné}), default 2d. Grouting = ceil(num_cables / 8), default 2d. SO-202 (12 cables, jednostranné) → 7+2+2 = 11d. New PlannerInput fields: `prestress_cables_count`, `prestress_tensioning`.
- **TZ text extractor (v4.18):** `shared/src/parsers/tz-text-extractor.ts` — regex patterns for concrete_class, exposure_class, span pattern "15+4×20+15", width/length via normalized text, volume, height, Ø diameter, cables, strands, thickness, keywords (předpjatý, jednostranné, mostovka/pilota/římsa, dvoutrám). `ExtractedParam.confidence` 1.0 regex / 0.8 heuristic (multi-match) / 0.9 fuzzy. 18 tests in `tz-text-extractor.test.ts` (SO-202 mostovka/prestress/pile excerpts + edge cases). Exported via shared/index.ts.
- **TzTextInput component (v4.18):** `components/calculator/TzTextInput.tsx` collapsible textarea above AI panel. Debounced 500ms extraction. Checkboxes per extracted param with "(jiný typ)" dim label when `ELEMENT_SPECIFIC_PARAMS` map says current element_type doesn't match (is_prestressed/span_m/num_cables → mostovka+rigel only; pile_diameter_mm → pilota). Universal params (concrete/exposure/volume/height) always applicable. `tzText` persisted in `localStorage('planner-tz-text')` — project-level state survives position navigation.
- **AI advisor prompt v2 (v4.18):** `backend/src/routes/advisor-prompt.js` extracted (pure, no express dep, testable). Structured template with conditional sections: MOSTNÍ NK (when mostovkova_deska+span/spans), PŘEDPĚTÍ (when is_prestressed), PILOTA (when pilota), GEOMETRIE (h/fwArea), JIŽ SPOČÍTÁNO ENGINE (computed_results — prevents AI from overwriting curing_days/prestress_days), KONTEXT Z TZ (tz_excerpt truncated 2000ch + cite instruction), EXTRAHOVANÉ PARAMETRY. Response JSON extended: key_points[], risks[], norms_referenced[]. 5 Jest tests in backend/tests/routes/planner-advisor.test.js (mostovka/pilota/základ/backward compat/truncation). POST handler destructures 20+ enriched fields; KB research + multi-role context enriched with exposure/curing.
- **AI advisor frontend fixes (v4.18):** Raw prompt echo detection (keywords `ODPOVĚZ POUZE VALIDNÍM JSON`, `KONTEXT POZICE:`) → friendly error instead of template display. JSON parse with schema validation (must have pour_mode or klicove_body or reasoning). KB productivity norms `[object Object]` → nested objects via JSON.stringify instead of String(). AI button disabled when volume_m3=0 or type/concrete empty + hint text. `fetchAdvisor` payload includes `calculator_context` (20+ fields), `tz_excerpt`, `computed_results` (total_days/curing_days/prestress_days/num_tacts when result exists).
- **Cross-kiosk sync fix (v4.17):** Phase 11 migration adds portal_project_id+registry_project_id columns on bridges+monolith_projects with indexes. positions.js POST handler 5-step dedup lookup (exact bridge→portal+registry pair→portal only→registry only→auto-create). applyPlanToPositions forwards portal/registry ids in POST body. useCalculator reads portal_project/registry_project from URL params. Registry backendSync pushProjectToBackend simplified to POST UPSERT (no GET-first 404 noise), debounce 5→2s, beforeunload keepalive flush. Registry ImportModal duplicate-name dialog (Aktualizovat/Nový) on import. BackendSyncBadge component shows idle/pending/syncing/synced/offline/error next to "Projekty" title. Portal integration.js catch unwrapped: PG error codes → 409/400/500 with structured response body. Registry portalAutoSync parses structured error.
- **SO202 Calculator Audit (v4.17):** 24 bugs identified across mostovka+opěry+pilíře+piloty. Golden test data in `test-data/tz/SO-202_D6_most_golden_test.md`. Key finding: curing_class 2/3/4 not implemented (maturity.ts only has ~třída 2 values) → NK třída 4 @15°C returns 5d vs TZ 9d. XF4 missing from opery_ulozne_prahy RECOMMENDED_EXPOSURE, XF2 missing from driky_piliru. Pile rebar default 40 kg/m³ is 50% below real for bridge Ø900 (80-100).
- **Mostovka audit fix pack (v4.19):** 13 fixes across 6 categories from live SO-202 test on kalkulator.stavagent.cz. A1 split `height_m` (prop height 4–20 m) from new `deck_thickness_m` (cross-section 0.3–2.5 m) — `SanityRanges` + `PlannerInput` + `FormState` + UI field added; deck_thickness auto-derived from `volume/(span×num_spans×nk_width)` when omitted. B1 moved `calculateProps` to new section 7a0 BEFORE `scheduleElement`; `schedAssemblyDays = formwork_asm + props_asm` and `schedStrippingDays = formwork_str + props_str` (tesaři do both trades so the critical path reflects one crew, not two parallel tracks). B2 "Doporučeno ~X tesařů pro Y m² / 2 dny" derived hint in crew sidebar mirrors the rebar hint; 0.6 Nh/m² catalog avg. B3 "Betonáři / záběr: X doporučeno" Row in Betonáž card (rule of thumb `ceil(tact_vol/20)` floored 3 capped 10) + rostered/simultaneous split from `plan.resources.pour_*_headcount` when crew-relief active. C1 per-tact continuous-pour warning fires for mostovka even in sectional mode (záběr mostovky nesmí přerušit → crew relief + §116 ZP noční). C2 `pour_window_h` surfaced as Row in Betonáž card with "(nevejde se — více úseků)" suffix. D1 orchestrator warning for missing height on mostovka prefixed "🚨 KRITICKÉ:" + souhrn renders disabled "Podpěry — zadejte výšku" placeholder rows in amber. E2 trámový/dvoutrámový/vícetrámový subtype adds 6h technological pauza to concreteDays (2-fáze pour); warning quotes the delta. E3 prestress trace spells out wait(max{7,curing})+stressing(cables/method)+grouting decomposition. F1 "Parametry mostu" grid gets `alignItems:'end'` baseline. F2 "↳ Tesařské práce (bednění + podpěry)" subtotal row in souhrn groups the same-crew work. 10 new vitest cases cover A1 (5), B1 (3), E2 (2). 797 → 807 shared tests; frontend tsc clean. G (MSS whitelist + per-takt Nhod + rental=0) deferred to follow-up task.
- **MEGA pour engine fixes (v4.20):** 3 engine-level bug fixes from SO-203 (664 m³) live test. **Bug 3 (pump consistency):** `PourTaskInput` gains `num_pumps_available?: number`; orchestrator now forwards `pourDecision.pumps_required` (= `ceil(V / (q_eff × available_h))`) so both engines agree — was "4 čerpadel" in decision log + "1 čerpadlo, 20h" in pour trace. `pour-decision.ts` consolidates 3 legacy multi-pump warnings ("N čerpadel potřeba" + "PDK povinný" + "osvětlení") into one line with záložní suffix. Scenario label reflects real pump count via CS pluralization. **Bug 1 (crew by pumps, universal):** new `computePourCrewByPumps(n)` helper: `ukladani = 2n`, `vibrace = ceil(1.5n)`, `finiseri = ceil(1.0n)`, `rizeni = 3` (fixed: stavbyvedoucí + geodet + laborant). Matches spec table: 1 pump → 8, 2 → 12, 3 → 17, 4 → 21. Applied always (even 1-pump small pours get 8 people) per user decision. `effectivePourCrew` in orchestrator initialized from helper; both continuous-pour branches drop `Math.max(crew, ceil(crew × hours / shift))` recomputation. Breakdown exposed on `PlannerOutput.resources.pour_crew_breakdown`. **Bug 2 (multi-shift person-hours):** merged the legacy ≤12h "extended shift" + >12h "multi-shift" branches into a single path that flips to crew relief at `pour_hours > shift_h`. `numPourShifts = ceil(pour_hours / shift)`, `effectiveShift = shift` (no stretching), `nightHours = pour_hours − shift`. Cost formula split: continuous multi-shift uses person-hours (`crew × pour_hours × wage + night × crew × wage × 0.10`) matching user spec exactly; sectional keeps per-worker §114 ZP +25% overtime. Fixes old over-pay bug (2-shift billed as `2 × shift × crew`). 15 new vitest cases (3 Bug 3, 8 Bug 1, 4 Bug 2). 807 → 822 shared tests; frontend tsc clean. Bug 4 (warning severity refactor) + Bug 5 (NEÚPLNÉ label) deferred to follow-up UX session.
- **Rebar matrix + pour crew rework + operne_zdi factor (v4.24, 2026-04-20):** 3 engine-level calibration fixes from VP4 live test (2026-04-20). **BUG A — rebar h/t matrix:** old engine applied blanket `ElementProfile.rebar_norm_h_per_t` (45 h/t for walls — actually a stirrups rate, 3× reality). New `REBAR_RATES_MATRIX` in `element-classifier.ts` bucketed by `RebarCategory` (`slabs_foundations` | `walls` | `beams_columns` | `staircases`) × diameter (D6–D50 mm), rates from methvin.co April 2026 + RSMeans cross-validation. `ElementProfile` gains `rebar_category` + `rebar_default_diameter_mm` (24 entries filled). `getRebarNormForDiameter(element_type, diameter_mm?)` helper returns `{norm_h_per_t, source: 'matrix'|'legacy', category, used_diameter_mm}`. `calculateRebarLite` + `crewForTargetDays` consume the helper, keep legacy fallback for unusual diameters (D18 not in matrix). Pile armokoš bypasses matrix (prefab workflow not covered by methvin — stays on legacy 30 h/t). `PlannerInput.rebar_diameter_mm?` optional override; `FormState.rebar_diameter_mm` new string field + `<select>` in `CalculatorFormFields.tsx` Expert panel with live "auto — D12 (17.3 h/t)" label per current element_type. VP4 impact: 5.654 t × 45 h/t = 254 h → 5.654 × 17.3 = 97.8 h (2.6× reduction). **BUG C — pour crew rework:** v4.20 formula `2n+1.5n+1n+3 řízení` double-counted management (stavbyvedoucí/mistr are monthly-salaried + accounted separately in "Zařízení staveniště" VRN per ČSN 73 0212). New `computePourCrew(volume_m3, n_pumps, element_type)`: podkladní beton <20 m³ → 2, <50 m³ → 3; malé objemy <20 m³ → 3 (2 ukladka + 1 vibrace); střední 20–80 m³ → 4 (+finiš); velké 80+ m³ → pump-based formula WITHOUT `+3 řízení`. VP4 94 m³ 1 pump: 8 → 5 lidí. Legacy `computePourCrewByPumps(n)` retained as deprecated wrapper (forwards to new fn w/ volume=100, 'other'). `PourCrewBreakdown.rizeni` kept as field (always `0` post-v4.24) to avoid cascading UI break. Info note under Betonáž card in `CalculatorResult.tsx` explains direct-labor-only scope + ČSN 73 0212 ZS reference. **BUG D — operne_zdi complexity:** `difficulty_factor` 1.0 → 1.2 (inverted-T průřez + sklonité rubové hrany → vyšší pracnost bednění než rovná stěna budovy). **Scheduler precision fix:** `computeCriticalPath` tolerance 0.01 → 0.5 d; shorter rebar durations from matrix exposed floating-point drift (`round(9.05)` collapses to 9.0 via `Math.round(90.499…)=90` in JS) between forward-pass finish (rounded) and backward-pass LS (unrounded durations). Half-day slack is within scheduling noise, still meaningful as "critical". 10 new vitest (3 rebar-lite D12/D18/pile, 7 computePourCrew volume buckets + podkladní + VP4) + 8 orchestrator crew updates. 893 → 921 shared tests; tsc clean (shared + frontend).
- **Smart extractor — smeta-line parser (v4.23):** pull-based layer on top of existing CzechConstructionExtractor. New `extractSmetaLines()` + `parseCzechNumber()` + `SmetaLine` type in `shared/src/parsers/tz-text-extractor.ts`. Regex `SMETA_LINE_RE` matches 6-digit OTSKP / 9-digit URS code + description + unit + quantity; `(?=\s|$|[,;])` lookahead replaces `\b` (fails on Unicode `m²`/`m³`). Reuses `detectCatalog()` + `detectWorkType()` from `position-linking.ts` — no duplicate classification. `mapSmetaToField`: beton+m3 → `volume_m3`, bednění+m2 → `formwork_area_m2`, výztuž+t → `reinforcement_total_kg` (×1000). `ExtractedParam` gains optional `catalog` + `code` fields; `extractFromText(text, {element_type?})` now orchestrates smeta pass (conf=1.0) BEFORE free-text regex, smeta wins on collision via `smetaFieldNames` guard. ČJ number parser handles "94,231" / "547,400" / "1 456,78" / "1.456,78" / "1,456.78" / "1,234,567". Live bug (VP4 opěrná zeď, 2026-04-17): 3 → ≥5 params incl. 547.4 m² bednění + 5654 kg výztuž. 28 new vitest (Czech number 8, extractSmetaLines 12, integration 8). 865 → 893 shared tests; tsc clean. Deferred follow-ups: formula parser `(0,8*0,3)*156,4` cross-validation, UI catalog badges, server endpoint, RTS (stub only).
- **Input validation + MSS-6/7 fixes (v4.22 Phase 1):** 4 engine-level validations + 2 MSS bugs odhalené při live SO-207 testu (user zadal V=605 m³ místo ~4000 m³). **Volume-vs-geometry check**: new `estimateExpectedVolume()` + `checkVolumeGeometry()` in element-classifier.ts. Mostovka V_exp = span × num_spans × nk_width × subtype_eq_thickness (`DECK_SUBTYPE_EQ_THICKNESS_M` per subtype: deskovy 0.5, trám 1.0, komora 0.7, rámový 0.8, spřažený 0.25). Pilota V_exp = π(Ø/2)² × L × count. Ratio < 0.3 nebo > 3 → ⛔ KRITICKÉ + "nevkládáš objem jednoho pole?" hint. 0.3–0.7 / 1.5–3 → ⚠️ WARNING. Critical message pushed via `warnings.unshift()` → lands at top of `plan.warnings[]`. **Exposure allow-list** `RECOMMENDED_EXPOSURE` extracted to module-level + shared helper `pushExposureWarning()` s identickou logikou v main path i `runPilePath` (piloty teď correctly flag XF4 jako atypické). Added entries pro pilota (XA1–3, XC2), stropni_deska (XC1/XC3), stena (XC1/XC3/XF1), zakladova_* (XC2/XC4/XA1/XA2). Text: "Vyberte jednu z: XF2, XF4 …" místo generického "Doporučeno:". **Emoji prefix convention**: unified ⛔ (critical) / ⚠️ (warning) / ℹ️ (info). Earlier 🚨 prefix z v4.19 migrated. Parallel warnings_structured field deferred to Phase 2 (UI severity rendering). **MSS-6 hard lock**: mostovka + MSS → form disables `has_dilatation_joints` + `tacts_per_section_manual` inputs; sidebar shows read-only "N taktů (= N polí, MSS)" badge. Engine-level guard: pokud API caller still forces `num_tacts_override ≠ num_spans` → ⛔ KRITICKÉ warning + plán používá `mssSchedule.num_tacts` (correct). **MSS-7 label**: Bednění-card "Zrání: 21 d" was confused as ČSN 73 6244 curing — teď pro MSS rozloženo na "Zrání do napínání: max(7, curing) d" + "Injektáž + zrání: tact_days − wait d" + "Doba taktu MSS: tact_days d" (bold). Non-MSS path keeps single "Zrání" row. SO-207 golden test annotated with live-bug-replay expected warnings. 13 new vitest cases (8 volume/geometry, 3 exposure, 2 MSS-6). 852 → 865 shared tests; frontend tsc clean. **Phase 2 deferred**: warnings_structured parallel field + UI severity renderer + "Pokračovat přesto" gate + MSS-9 unification + MSS-10 XF context-aware extraction + golden test runner.
- **Formwork taxonomy + MSS engine (v4.21):** pour-layer split bednění / skruž / stojky + MSS integrated path. `FormworkSystemSpec` gains semantic `pour_role: 'formwork' | 'formwork_props' | 'falsework' | 'props' | 'mss_integrated'` (parallel to existing `formwork_category`) + `applicable_element_types` allow-list + `max_assembly_height_m` + MSS-only `mss_reuse_factor=0.35`. All 29 catalog entries reclassified: Top 50/VARIOKIT HD 200 = falsework; Dokaflex/MULTIFLEX/SKYDECK/CC-4 = formwork_props with allow-list EXCLUDING `mostovkova_deska` (building slabs, max ~5 m reach); Staxo 100/UP Rosett Flex = props; Framax/TRIO/MAXIMO/etc. = formwork. Two NEW MSS entries: **DOKA MSS + VARIOKIT Mobile** (both `pour_role='mss_integrated'`, `rental_czk_m2_month=0`). New helpers `getSystemsByPourRole(role)`, `isApplicableForElement(system, etype)`, `findMssSystem(vendor)`. Selector (`recommendFormwork` + `getSuitableSystemsForElement`) enforces allow-list + hard-skips `mss_integrated` from normal pool. Mostovka > 4 m now returns **Top 50 (falsework)** instead of Staxo (which was the wrong layer); `calculateProps` keeps adding Staxo separately. Orchestrator **MSS shortcut**: when `construction_technology='mss'` + `mostovkova_deska`, `fwSystem = findMssSystem(preferred_manufacturer)` before normal flow. **MSS cost wiring**: `isMssPath` derived from `fwSystem.pour_role`; per-tact Nhod × 0.35 (propagated through fwBase/threePhase/scheduler); `calculateProps` SKIPPED; `formworkRentalCZK=0` + `propsRentalCZK=0`; `formworkLaborCZK += mssCost.mobilization + mssCost.demobilization` (vlastní síly tesaři). New `PlannerOutput.costs` fields: `is_mss_path`, `mss_mobilization_czk`, `mss_demobilization_czk`, `mss_rental_czk`. **UI**: Bednění card title + icon branch on pour_role (🏗️ Skruž / 📦 Bednění + stojky / 🌉 Posuvná skruž MSS / 📦 Bednění); Props card renamed "🔩 Stojky" + gated by `!is_mss_path`. **Cost summary**: labels vary per pour_role — "Skruž (nosníky — práce)" + "Pronájem skruže" + "Stojky (práce)" + "Pronájem stojek" for bridge plans. MSS block adds mobilization/per-takt/demobilization rows + "Pronájem MSS (stroj)" + 3 italic "0 Kč (součást MSS)" rows for bundled components. **Warnings** prefix per pour_role ("Skruž Top 50 vyžaduje jeřáb (nosník …)"); mostovka missing-height message explicitly names skruž + stojky; new MSS "vlastní síly tesaři × dní = Kč" line. Golden tests (SO-202, SO-203, SO-207) annotated with v4.21 re-snapshot notes — SO-207 is the biggest delta (Dokaflex disappears, MSS rental replaces double-counted component rentals). 22 new vitest cases (15 catalog + 8 selector + 9 MSS orchestrator). 822 → 852 shared tests; frontend tsc clean.
- **AI classifier checkbox removed (v4.16):** the "Klasifikace podle názvu (AI)" checkbox in CalculatorSidebar was misleading — `classifyElement()` is regex+OTSKP keyword matching (not LLM) and runs unconditionally on position-context load. Checkbox + `element_name` text input + `use_name_classification`/`element_name` FormState fields all removed; ~30 `form.use_name_classification ? 'other' : form.element_type` ternaries collapsed across CalculatorSidebar/CalculatorFormFields/useCalculator. Position-context auto-classification path (`useCalculator.initialForm` → `classifyElement(part_name)`) untouched; OTSKP/keywords badge below the dropdown still surfaces source + confidence. PlannerPage `AI_CLASSIFIER_AUDIT` (DEV-only console.log) marked RESOLVED. AI_ADVISOR_AUDIT (B2) confirms `/api/planner-advisor` IS real LLM via Core `/api/v1/multi-role/ask` (concrete_specialist) + `/api/v1/kb/research` + methvin productivity norms; sees only form fields, no document context, no integration tests.
- **Planner Variants:** `planner_variants` table (position_id FK, input_params JSON, calc_result JSON, is_plan flag). REST: GET/POST/PUT/DELETE `/api/planner-variants`. Max 10/position. `setAsPlan()` clears others. Mode A: DB; Mode B: in-memory. Auto-restore plán on entry. Numbering: `Math.max(existingNums) + 1`.
- **Auto-calc (v4.1):** 1.5s debounce, pure preview (no save). `calcStatus` indicator above KPIs. No save prompt, no autosave checkbox. Variants created ONLY by explicit "Uložit variantu" click. Wizard guard: skip steps 1-4.
- **Průvodce (Wizard):** Inline sidebar mode (`wizardMode` + `wizardStep` 1-5). Same form state. `display:none` on sections. Steps: Element→Volume+Beton→Geometry→Rebar+Resources→Záběry. Engine-powered hints per step (maturity, lateral pressure, rebar PERT). `localStorage('planner_wizard_mode')`. Keyboard: Enter=next, Escape=back.
- **Calculator refactor (v4.13):** PlannerPage 4620→380 lines. State/logic in `useCalculator` hook (~1300 lines). Split: `CalculatorSidebar.tsx`, `CalculatorFormFields.tsx`, `CalculatorResult.tsx`, `ui.tsx`, `types.ts`, `helpers.ts`, `TzTextInput.tsx`. Design unified: stone palette, DM Sans body + JetBrains Mono numbers, KPI left-border tinted bg, responsive (mobile 1-col, tablet sidebar 300px, desktop 340px), inputs 16px on mobile.
- **Pilota formwork fix:** `recommendFormwork()` has special case for `pilota` — skip pressure filter, return `Tradiční tesařské` (bored pile uses pažnice/tremie). Special cases: rimsa → Římsové bednění T, mostovka >5m → Staxo 100, pilota → catalog recommendation.
- **Block A — hierarchy (v4.14):** FormState `has_dilatation_joints` + `num_dilatation_sections` + `tacts_per_section_mode/manual` replace legacy `tact_mode`/`has_dilatacni_spary`/`num_tacts_override` pair. Orchestrator pre-computes `totalTacts = numSections × tactsPerSection` before `decidePourMode`; routes through existing override path so Block D pump rebuild + Block C working_joints warnings compose. LS_FORM_KEY bumped `planner-form` → `planner-form-v2` (clean start). UI: one sequence "Členění konstrukce" replaces two tabs. Live preview "X celků × Y záběrů = Z celkem".
- **Pour mode (Block A-F, v4.14):** `has_dilatation_joints`+`num_dilatation_sections`+`tacts_per_section_mode` replace legacy tact_mode. Block C: `working_joints_allowed` default=unknown→sectional+warning; 'no'→monolithic. Block D: override recomputes pour_hours_per_tact. Block E: variants reuse labor verbatim, recompute rental only. Block F: crew>tacts warnings. Dual pump scenarios (actual + target). DIN 18218 `concrete_consistency` k-factor: standard=0.85, plastic=1.0, scc=1.5. Framax wins over short-panel on tall piers.
- **Manufacturer pre-filter (v4.14):** `preferred_manufacturer` dropdown (DOKA/PERI/ULMA/NOE/Místní). Auto path filters pool by vendor before pressure check; empty pool → fallback + warning.
- **Expert hints:** `WizardHintsPanel` with MissingFields+Sanity+Technology. `ReviewHint` above "Vypočítat plán" button. "Podpěry nelze spočítat" warning when supports needed but height_m≤0. PERT row under KPI. `HelpPanel.tsx` 3-column (pipeline/math/norms) auto-shown on first visit. Čety terminology (ne Brigády).
- **Two modes:** Monolit (ordinal days, auto-classify, TOV mapping) / Portal (calendar, manual)
- **Import:** XLSX + Registry — both work without pre-created project (backend auto-creates `bridges` + `monolith_projects`). Empty state shows 3 actions: Vytvořit/Nahrát Excel/Načíst z Rozpočtu. `metadata` column persisted (linked_positions from parser). `bridge_id` prefixed with `stavbaProjectId__` to prevent cross-file collision.
- **Registry Import Modal:** parallel fetch (Portal public endpoint `/api/integration/list-registry-projects` + Registry backend), search, debug info, refresh button, source badges (PORTAL/REGISTRY).
- **TOV sync:** tov_entries to Portal DOV via prefillTOVFromMonolit, formwork rental for bednění
- **Account Isolation:** `portal_user_id TEXT` (not INTEGER), Portal JWT via `JWT_SECRET`, 403 on cross-account
- **ErrorBoundary:** PositionsTable + KPIPanel wrapped; prevents white screen on React #310
- **KPI Panel CSS:** `.kpi-card` in `flat-design.css` — `overflow:visible`, `min-width:200px` (was 180px/hidden, clipped "lidí" and "Kč/m³")
- **Dual DB:** `monolith_projects` (listed via `/api/monolith-projects`, auth) + `bridges` (FK compat for `positions.bridge_id`); `bridgesAPI.getAll()` calls monolith-projects

### 4. Klasifikátor (URS_MATCHER_SERVICE repo, Kiosk)
Node.js/Express + SQLite. **~45 endpoints**, **159 tests**, **~10K LOC**, **12 tables**.
4-phase matching, dual search (36 seed + 17,904 OTSKP + Perplexity), VZ Scraper, 9 LLM providers.

### 5. Registr (rozpocet-registry repo, Kiosk)
React 19 + Vite + Vercel serverless. **12 endpoints**, **87 tests**, **~17K LOC**.
BOQ classification (11 groups), AI Classification (Cache→Rules→Memory→Gemini), TOV Modal, Formwork/Pump Calculators.
- **Import:** Fuzzy auto-detect (header keywords + normalize), per-sheet dataStartRow detection (code+MJ heuristic), reimport with skupiny preservation
- **Export:** "Vrátit do původního (ceny + skupiny)" — ZIP/XML patch, inline strings, autoFilter + sheetProtection patch. Per-sheet column mapping (each sheet reads own `config.columns.cenaJednotkova`).
- **Virtualization:** @tanstack/react-virtual for 2000+ row tables, overscan=20, `display:flex` on `<tr>` with explicit `width` per `<td>`/`<th>`
- **Undo/Redo:** `undoStore.ts` (in-memory, MAX_UNDO=50) + `useUndoableActions` hook wrapping skupina/role mutations; Ctrl+Z/Ctrl+Shift+Z; toolbar above table
- **UI:** Portal-rendered dropdowns (RowActionsCell, SkupinaAutocomplete) escape `overflow:auto`, resizable GroupManager (min 480px, localStorage persist)
- **Backend sync (v4.17):** `backendSync.ts` pushes IndexedDB projects to `rozpocet-registry-backend` PostgreSQL via UPSERT POST (no GET-first 404 noise). Debounce 2s + beforeunload keepalive flush for project header. `BackendSyncBadge.tsx` renders idle/pending/syncing/synced/offline/error pill next to "Projekty" title via module-level pub/sub (subscribeBackendSync). `portalAutoSync.ts` parses structured Portal error bodies (409/400/500 with error_type+constraint+column).
- **Import dedupe (v4.17):** `ImportModal.tsx` resolveDuplicate() checks existing projects by projectName (case-insensitive). Dialog "AKTUALIZOVAT existující / VYTVOŘIT NOVÝ" before addProject(). Prevents N× duplicate imports of same Excel.
- **Flat style tokens (v4.24.1):** Part A layer added to `tokens.css` alongside Digital Concrete. New `--stone-50..900`, `--orange-{100,200,500,600}`, `--flat-{bg,surface,header-bg,border,text,text-label,accent,hover,selected}`, `--flat-row-h 32px / --flat-header-h 36px`, `.flat-el-info__sep` utility. `--accent-orange` `#FF9F1C → #F97316` across tokens + AIPanel + PriceRequestPanel + RowActionsCell + ItemsTable.css resize handle. `--font-body` Inter → DM Sans. `.table th` 11px uppercase 0.05em letter-spacing stone-600, `.table td` 13px tabular-nums stone-900, padding `0 8px` (first cell 16px), height 32/36. Alternating rows removed, hover `#F5F3F0` warm, `.card` dropped 4-layer `--shadow-panel`. Icon scale **11 px** chevrons + 13 actions + 14 table-header chevrons. 24px `.flat-el-info__sep` between MoveUp/Down → role → Link2 groups in `RowActionsCell`. Ref `rozpocet-registry/AUDIT_Registry_FlatLayout.md` §2 + §5.3.1. PR 1/5 of Variant B rollout; PRs 2–5 (toolbar skupiny, detail panel, extended BulkActionsBar, click-cells) queued.
- **Lucide cross-browser fix (v4.24.1):** Every `<IconFromLucide size={N}>` in `ItemsTable.tsx` + `RowActionsCell.tsx` (19 usages) must pair the `size` prop with Tailwind `w-[Npx] h-[Npx]`. lucide-react emits `<svg width="11" height="11">` as HTML attributes, not CSS — Chrome treats as CSS size, Safari/Firefox treat as hints, and in a virtualized flex `<tr>` the SVG's flex-basis can collapse to 0 (chevron + row ordinal + role indicator disappear). Pre-existing bug, surfaced more after flat-style PR reduced chevron 12 → 11. Expansion logic (`expandedMainIds`, `toggleExpanded`) untouched — fix is cosmetic only.
- **PR 2 toolbar skupiny + compensation pack (v4.24.2):** Variant B rollout step 2 per `AUDIT_Registry_FlatLayout.md` §4.3.4 / §5.3.1. Final design: `<SkupinaToolbar>` renders **above** `ItemsTable` only when column-Skupina filter is pinned to exactly one group (`filterGroups.size === 1`) — no standalone picker. Surface is **management-only**: collapse-all chevron, active-skupina label, info badges (`N položek · Σ Kč`), inline rename (`Pencil` — calls `store.renameGroup`), two-step delete (`Trash2` — calls `store.deleteGroup`). Toolbar auto-hides when `activeSkupina=null`. Parent syncs `filterGroups` via `onSkupinaRenamed` / `onSkupinaDeleted` callbacks so filter follows rename/delete. `Sparkles` (`applyToSimilar`) and `Globe` (`applyToAllSheets`) **stayed on row-level** (reverted from the initial lift) — per-row is faster because each handler needs `item.kod + item.skupina` as template; column filter already is a picker; duplicate lift broke UX. `effectiveParentMap` in `ItemsTable.tsx:252` — proximity fallback that maps subordinate.id → nearest `main` above in source order when classifier left `parentItemId=null`. Used by both `subordinateCounts` (chevron visibility) and `visibleItems` (collapse filter). Classifier itself (`rowClassificationService.ts`) untouched; audit doc says the orphan-parentItemId bug has 6+ distinct causes — proper fix gated on format-aware rewrite per `docs/ROW_CLASSIFICATION_SPEC.md`. Row-level visual distinction for subordinates via `.row-subordinate` CSS class: `background: var(--stone-50)` + italic text + 2 px inset box-shadow on first cell as accent anchor (`ItemsTable.css`). `--flat-col-divider` token (aliased to `--flat-border`) + `.table td/th { border-right }` for light vertical grid; `:last-child` removes double-line at right edge. Checkbox column widened 20→36 px so it doesn't overflow the new border-right. Filter dropdown extracted to `<SkupinaFilterDropdown>` — renders via `createPortal` to `document.body` with `position: fixed` + auto-flip (pattern copied from `SkupinaAutocomplete`) to escape the virtualized scroll container clipping. Sticky thead fixed by moving `position: sticky; top: 0` from `<thead>` (ignored by Chrome on row-group) to each `<th>`. Poř. column **split** into two: `boqLineNumber` accessor (header "Poř. Č.", main-rows-only ordinal) + new display column `expand` (chevron/↳ toggle, no header). Monolit column gated on `hasAnyMonolitData = items.some(i => i.monolith_payload)` so sheets without Monolit integration don't show an empty 28 px strip. Page layout: outer root `min-h-screen` → `h-screen flex flex-col overflow-y-hidden`; `<main>` → `flex-1 min-h-0 overflow-y-auto` (auto kept after flex-1-chain experiment failed — see below). `<footer>` `flex-shrink-0`, `mt-12` dropped. ItemsTable scroll container keeps dynamic `maxHeight` via `useLayoutEffect` + `ResizeObserver(document.body)` — `window.innerHeight - containerTop - 80`, min 400 px. **Deliberately reverted** in this same compensation pack: the flex-1 chain from `<main>` down to the scroll container (commit `3106ab2` → revert `6ed4180`). Chain collapsed the card to 0 px when AI Klasifikace + GroupManager were both expanded (their natural height + `flex-1 min-h-0` on card = negative flex-basis, card shrinks to 0, `main overflow-hidden` clipped it entirely). Double scroll accepted as lesser-evil until AI panel + GroupManager get own `max-height + overflow-y` (tracked in `rozpocet-registry/next-session.md`). Baseline classifier audit + target spec written to `rozpocet-registry/docs/ROW_CLASSIFICATION_{CURRENT,SPEC}.md`. Store-migration for legacy items without `rowRole` drafted as `classifyMissingRowRoles` action — **stashed**, not merged, waiting for spec-driven classifier rewrite (stash is on branch `claude/registry-toolbar-group-Qophc`). Ref `AUDIT_Registry_FlatLayout.md` §5.3.1 PR 2; PRs 3–5 (detail panel, extended BulkActionsBar, click-cells) queued.
- **Classification round-trip (v4.26.0):** `services/classificationCodec.ts` packs 16 classifier fields (rowRole, parentItemId, sectionId, popisDetail, `_rawCells`, originalTyp, classification confidence/source, source_format/row_index, por, cenovaSoustava, varianta, boqLineNumber, classificationWarnings, subordinateType) into a versioned blob (`v: 1`) and stores it in the previously-idle `registry_items.sync_metadata TEXT` column accepted by `bulk INSERT` and returned by `GET`. `serializeClassification` returns the OBJECT (not JSON string) — server.js `JSON.stringify(item.sync_metadata)` is the single encoding step, double-stringify fixed. `loadFromBackend` calls `deserializeClassification` + `applyClassificationBlob` to re-hydrate `ParsedItem` on pull; `popisFull` rebuilt from `popis + popisDetail` when latter restored. **No DB migration required.** Defensive against future JSONB driver path (codec accepts string OR object). Schema-version forward-compat: unknown `v` returns `null` (legacy items render flat). Bonus: `App.tsx loadFromPortal` dedupe matches by `portalLink.portalProjectId` (not just `id`) — fixes duplicate import on Portal-linked projects after PortalAutoSync gave them a different ID. 16 vitest cases. Audit: `docs/SYNC_AUDIT_2026_04_29.md`.
- **Ribbon-only UI (v4.26.0):** `localStorage['registry-ribbon-enabled']` feature flag retired. `src/layout/{ribbonFeatureFlag.ts,ribbonFeatureFlag.test.ts,RibbonFlagToggle.tsx}` deleted; `App.tsx` shrunk 1517→871 lines (−646), production bundle −19 KB raw. `RibbonLayout` mounts unconditionally. Per-browser flag users land on ribbon automatically; obsolete localStorage key is harmless garbage. No data migration.
- **Row classifier v1.1 (v4.25.0, PR #1006 + #1008/#1009):** Universal column auto-detection + Typ-column fast-path + content-heuristic fallback replaces the 3-format-gated legacy classifier. Spec `rozpocet-registry/docs/ROW_CLASSIFICATION_ALGORITHM.md` v1.1. Public API `classifySheet(rows, {sheetName, templateHint?, preserveRawCells?}): ClassificationResult` in `services/classification/rowClassifierV2.ts` — orchestrates detectColumns → per-row classify (typColumnClassifier / contentHeuristicClassifier) → assignParentLinks. Integration via `importAdapter.ts`: `extractRawRows(workbook, sheetName)` (XLSX → 2D `unknown[][]`), `getTemplateHint(templateType)`, `mergeV2IntoParsedItems(parsedItems, v2)` (additive upgrade by `source.rowStart ↔ sourceRowIndex+1`). `ImportModal.tsx` runs legacy `classifyRows()` first as safety net, then v2 upgrades in place. Per-item `_rawCells` preserved so "Překlasifikovat" button (Wand2 in ItemsTable toolbar) can reconstruct without re-upload — `registryStore.reclassifySheet(projectId, sheetId)` action returns per-role stats. 2-row header support for EstiCon `Cena / Jednotková | Celkem` layout (`resolveHeaderPair`). Column-number placeholder row (`0|1|2|...`) skip via `isColumnNumberRow`. New ParsedItem fields (all optional, no Zustand persist version bump): `sectionId`, `source_format`, `source_row_index`, `originalTyp`, `por`, `cenovaSoustava`, `varianta`, `classificationSource`, `_rawCells`, and `classificationConfidence` relaxed to `number | 'high'|'medium'|'low'` union. 87 vitest tests (5 unit + 1 integration) — integration run on D6_202 (EstiCon) + Kyšice (Komplet OTSKP) + Veselí (Komplet ÚRS): **482 mains + 2097 subs + 70 sections + 0 orphans** across 2649 real items. Legacy `rowClassificationService.classifyRows()` retained as fallback — removal scheduled 2-3 weeks post-merge per `next-session.md` §17. Follow-ups §14-17: persist `ColumnMapping`/templateHint per Sheet (P1), add CI workflow for registry tests (P2), grep `classificationConfidence` consumers for string-compare paths (P3), remove legacy fallback (P3).

## Totals

| Service | Endpoints | Tests | LOC |
|---------|-----------|-------|-----|
| concrete-agent | 120 | 34 files | ~61K |
| stavagent-portal | ~82 | 1 file | ~26K |
| Monolit-Planner | 132 | 1088 | ~43K |
| URS_MATCHER_SERVICE | ~45 | 159 | ~10K |
| rozpocet-registry | 12 | 200 | ~16K |
| **TOTAL** | **~391** | **1425+** | **~152K** |

---

## Development Commands

```bash
cd concrete-agent && npm install && npm run dev:backend          # FastAPI :8000
cd stavagent-portal && npm install && npm run dev                # Express + React
cd Monolit-Planner/shared && npm i && npm run build && cd ../backend && npm run dev  # :3001
cd Monolit-Planner/frontend && npm run dev                      # React :5173
cd URS_MATCHER_SERVICE && npm install && npm run dev             # :3001
cd rozpocet-registry && npm install && npm run dev               # Vite :5173
```

---

## Conventions

**Commits:** `FEAT:`, `FIX:`, `REFACTOR:`, `DOCS:`, `STYLE:`, `TEST:`, `WIP:`
**Branches:** `claude/<task-description>-<random5chars>`
**Git Hooks (Husky):** Pre-commit: 34 formula tests (~470ms). Pre-push: branch + tests.

**Karpathy rules (anti-bloat):**
- Pokud lze 200 řádků napsat za 50 — napiš za 50.
- Nesahej na kód, který se zadáním nesouvisí.
- Nepřidávej "flexibilitu" a "konfigurovatelnost", o kterou nikdo nepožádal.
- Když si nejsi jistý — zeptej se, neháděj mlčky.
- Definuj kritéria úspěchu PŘED kódem, pak iteruj k jejich splnění.

## Session Setup — Effort & Thinking

**ОБЯЗАТЕЛЬНО в начале каждой сессии:**

1. Проверь effort level: должен быть `high` или `max`. Если `medium` / `low` → `/effort high`.
2. Adaptive thinking должен быть ОТКЛЮЧЁН (`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` в `~/.claude/settings.json` env).
3. Перед любым изменением кода — ПРОЧИТАЙ контекст. Мантра: «Сначала читаешь весь репо. Потом определяешь naming. Потом пишешь.»
4. Если не уверен в имени файла, SHA, API или пакете — ПРОВЕРЬ через Grep / Glob / Read. Никогда не фабрикуй пути, коммиты, имена.
5. Для STAVAGENT (1500+ commits, 24 element types, 7 engines) поверхностный анализ = баги в проде. Думай глубоко.

**Reference settings.json (user owns this file, не Claude Code):**
```json
{
  "effortLevel": "high",
  "env": {
    "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "400000"
  }
}
```
> ⚠️ Эти ключи не верифицированы против актуальной Claude Code docs — если харнес их игнорирует, проверь `/help` или попроси Claude настроить SessionStart hook вместо этого.

**Key rules:**
- Determinism > AI: if regex can do it, don't use LLM
- Confidence: never overwrite higher with lower
- Icons: `lucide-react` only, no emojis in JSX (per-service imports, no shared registry)
- Monolit subtypes: beton, bednění, odbednění (Tesař), výztuž, jiné
- Negative context: `_safe_search()` skips stávající/demolition matches
- Element classifier v3: 24 types (13 bridge + 11 building), bridge context, 5 early-exits, 7 BRIDGE_EQUIVALENT mappings
- Passport = structured tables; Shrnutí = narrative + topics + risks
- Construction sequence: bridge (pilota→římsa), building (pilota→schodiště)
- Scroll restoration: `sessionStorage('monolit-planner-return-part')` + 3s highlight
- Calculator suggestions: write-through `_PROJECT_FACTS` (memory + `calculator_facts` in project cache JSON)
- **Formwork orientation rule:** horizontal elements (strop, mostovka, základ) → skip lateral pressure, select by category+rental. Vertical (stěna, sloup, pilíř) → per-záběr pressure (`sys.pressure / full_pressure × height`, min 1.5m stage). Special (rimsa → římsový vozík, pilota → pažnice).
- **Calculator UX v4.1:** auto-calc = preview only (no auto-save). Variants created ONLY by "Uložit variantu" button. No save prompt, no autosave checkbox, no `pendingApplyPlan`.
- **Product naming:** App 1 (root `/`) = "Monolit Planner", App 2 (`/planner`) = "Kalkulátor betonáže". Never "Plánovač elementu" or "Kalkulátor monolitních prací"
- **SEO/noindex:** kalkulator.stavagent.cz has `<meta name="robots" content="noindex">` + `X-Robots-Tag` header in `vercel.json` (working app, not public page)

- Registry export ZIP/XML: JSZip + DOMParser, inline strings (`t="inlineStr"`), autoFilter via string replace after serialization
- Portal INSERTs: always explicit `gen_random_uuid()` for `position_instance_id` (Phase 8 NOT NULL constraint)
- Registry import: per-sheet `dataStartRow` via code+MJ heuristic; reimport via `replaceProjectSheets()` preserves manual skupiny by kod

**Stack decisions:** rozpocet-registry=Vercel+Zustand, Monolit=PostgreSQL prod/SQLite dev, URS=SQLite+per-request LLM fallback, CORE=Vertex AI primary+stateless, Portal=central `portal_project_id` linking.

### MCP Compatibility Check

After **EVERY** change to modules wrapped by MCP tools, verify the wrapper still works.

**MCP tool → module mapping:**
| MCP Tool | Module file(s) |
|----------|---------------|
| find_otskp_code | `pricing/otskp_engine.py`, KB XML |
| find_urs_code | `core/perplexity_client.py`, URS Matcher HTTP |
| classify_construction_element | MCP has own classifier (no external dep) |
| calculate_concrete_works | Monolit-Planner `/api/calculate` HTTP |
| parse_construction_budget | `parsers/xlsx_komplet_parser.py`, `xlsx_rtsrozp_parser.py`, `excel_parser.py` |
| analyze_construction_document | `parsers/pdf_parser.py`, pdfplumber |
| create_work_breakdown | MCP `otskp.py` + `classifier.py` (internal) |
| get_construction_advisor | MCP `classifier.py` + `calculator.py` (internal) |
| search_czech_construction_norms | `core/perplexity_client.py`, `core/kb_loader.py` |

**NO check needed if:**
- Bugfix inside a function (same signature, same return format)
- New enum value added (e.g., new element type with default behavior)
- New optional parameter with default value
- Text/description changes in response

**CHECK NEEDED if:**
- Function/module renamed or moved (import path breaks)
- Required parameter added, removed, or renamed
- Response structure changed (field removed, renamed, or type changed)
- New module added that should have its own MCP tool

**How to check:** `cd concrete-agent/packages/core-backend && python -m pytest tests/test_mcp_compatibility.py -v`

**If broken:** update MCP wrapper in `app/mcp/tools/`, not the backend module.

---

## Environment Variables

```env
# concrete-agent
DATABASE_URL=postgresql+asyncpg://...
MULTI_ROLE_LLM=gemini
GEMINI_MODEL=gemini-2.5-flash
# Monolit-Planner
VITE_API_URL=https://monolit-planner-api-1086027517695.europe-west3.run.app
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app
JWT_SECRET=<same as Portal>
# URS_MATCHER_SERVICE
STAVAGENT_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app
LLM_TIMEOUT_MS=90000
# stavagent-portal
VITE_DISABLE_AUTH=true  # local dev only
```

---

## Quick Debugging

| Problem | Check |
|---------|-------|
| URS empty results | LLM timeout (90s), AbortController per-provider |
| Monolit wrong calc | `concrete_m3`, `unit_cost_on_m3`, KROS rounding `Math.ceil(x/50)*50` |
| CORE unavailable | Cloud Run status, `/health`, Secret Manager |
| LLM 401/404 | SA `aiplatform.user`; use `gemini-2.5-flash` (not -lite) |
| CORE Cloud Run crash | `monolit_adapter.py` singletons — lazy-init with required args |
| Monolit 403 | `portal_user_id` mismatch; JWT_SECRET matches Portal; migration 012 |
| Portal "Failed to fetch" | headersTimeout=310s in server.js |
| Wrong izolant_tl_mm | `_safe_search()` skips stávající/odstraněno |
| Vertex AI empty | `response.text` raises ValueError when blocked; wrap in try/except |
| Vertex AI 429 | Exponential backoff 3 attempts in `gemini_client.py` |
| position_instance_id NULL | All portal_positions INSERTs must use `gen_random_uuid()` explicitly |
| Registry auto-detect 0% | Keywords in `structureDetector.ts` FIELD_PATTERNS; normalize removes [CZK] |
| klasifikator.stavagent.cz → Portal | Vercel Edge Middleware in `frontend/middleware.js` proxies by hostname |
| Monolit white screen #310 | ErrorBoundary deployed on PositionsTable+KPIPanel; check `componentStack` in console |
| FK/constraint "already exists" | Portal schema+migrations use `DO $ IF NOT EXISTS $` guards; never bare ALTER TABLE |
| Monolit /healthcheck 404 | Returns 200 without KEEP_ALIVE_KEY; only 404 on wrong key |
| "Jen problémy" shows wrong data | BUG: `include_rfi=false` filters OUT rfi rows; should filter IN (inverted logic in positions.js:150) |
| Monolit click no reaction | KPIPanel shows "Načítání KPI..." (not "Vyberte objekt") when bridge selected but API pending/failed |
| Registry columns misaligned | `display:flex` on `<tr>`, `width: cell.column.getSize()` + `flexShrink:0` on each `<td>` |
| Registry dropdown clipped | Must use `createPortal(…, document.body)` with `position:fixed`; scroll listener closes on scroll |
| Registry export wrong column | Was: `firstSheet.config` used for all sheets. Now: per-sheet `sheet.config.columns.cenaJednotkova` |
| KPI text clipped ("lidí") | `.kpi-card` overflow:hidden→visible, min-width 180→200px, no max-height |
| Aplikovat DNY wrong | Check shared/dist rebuilt (tsc), aggregateScheduleDays in formulas.ts |
| Formwork Frami for tall element | Per-záběr pressure: `filterFormworkByPressure()` stages automatically (min 1.5m). Frami 80kN/3m, Framax 100kN/6.75m |
| Sub-position missing after Aplikovat | ensurePosition checks GET before POST; check browser console for fetch errors |
| OTSKP not matching | OTSKP_RULES in element-classifier.ts; runs before KEYWORD_RULES; check normalize() |
| Křídla classified as opěra | Composite suppression: if both "opěr" + "křídl" → opery_ulozne_prahy, not kridla_opery |
| Registry modal empty | Debug banner shows Portal/Registry status. Portal 401 → use `/api/integration/list-registry-projects` (public). Registry 0 → startup push-sync in App.tsx |
| Aplikovat 500 error | Check curing_days Math.round (INTEGER column). Error logging in PUT handler shows exact field/type |
| Portal sync 0 items | Log misleading — `items_imported = newItems = total - updated`. On re-sync all items are UPDATES, so 0 new. Data IS synced. |
| XLSX overwrites old project | bridge_id prefixed with `stavbaProjectId__sheetBridgeId`. Each upload creates unique project via hash suffix. |
| Props missing normohodiny | `PropsCalculatorResult.labor_hours` field; check `fwSystem.manufacturer` passed to `calculateProps()` |
| NKB 429 console spam | fetchAuditStatus returns `'_rate_limited'` sentinel → polling triples delay (max 120s) |
| OTSKP search empty | Check `/api/otskp/stats/summary` for total_codes; response has `reason: 'db_empty'|'no_match'` |
| Wizard not showing hints | `wizardHint1-4` are `useMemo` — check deps array matches form fields; hint3 only for vertical elements |
| Wizard auto-calc fires early | Guard `wizardMode && wizardStep < 5` in auto-calc useEffect; check `skipNextAutoCalcRef` |
| firstRun shows wrong result | `firstRun` useMemo depends on `[initialForm]` — verify positionContext parsed correctly |
| Aplikovat plán applies wrong data | v4.1: `applyFnRef` + `pendingApplyPlan` removed. Aplikovat now applies current result directly |
| Variant V1 V1 duplicate | `existingNums.length === 0 ? 1 : Math.max(...existingNums) + 1` — check label parsing regex |

---

## CI/CD

**Cloud Build:** `cloudbuild-{concrete,monolit,portal,urs,registry,mineru}.yaml` + `triggers/*.yaml`
Guard step (git diff), Docker → Artifact Registry, Cloud Run deploy. Region: `europe-west3`. MinerU: `europe-west1`.
**GitHub Actions:** keep-alive, monolit-planner-ci, test-coverage, test-urs-matcher, **test-mcp-compatibility** (17 tests, triggers on concrete-agent/ changes), **rozpocet-registry-test** (200 vitest + `tsc -b && vite build`, triggers on rozpocet-registry/ changes).

---

## TODO / Backlog

### Manual Actions
- [ ] **MASTER_ENCRYPTION_KEY**: `openssl rand -hex 32` → GCP Secret Manager
- [ ] **LEMONSQUEEZY_WEBHOOK_SECRET**: set in GCP Secret Manager (Lemon Squeezy → Settings → Webhooks → Signing secret)
- [x] ~~**Change DB password** — `StavagentPortal2026!` leaked in git history~~ ✅ **Rotated** (Apr 2026). Historical string remains in git history but is no longer valid against any environment.

### TODO
- [ ] **P0: Resource Ceiling Phase 2 — Group A (pozemní vodorovné)** — B4 default_ceilings YAML pro `stropni_deska`, `zakladova_deska`, `zakladovy_pas`, `zakladova_patka`, `podkladni_beton`, `pruvlak`. Mirror TS constants v `RESOURCE_CEILING_DEFAULTS`. Golden test scenarios (low/medium/INFEASIBLE per typ) per task §6. Acceptance: každý typ vrátí `resource_ceiling.source` ≠ 'auto_derived' default.
- [ ] **P0: Resource Ceiling UI form (Expert panel)** — Q6 interview answer "Extend Expert panel" v `CalculatorFormFields.tsx`. Add inputs pro 6 professions (tesaři/železáři/betonáři/vibrátoři/finišéři/řízení) + cranes + vibrators + MSS-available + deadline_days + no_weekends. Auto-fill banner *"Použity typické zdroje pro <element>: X lidí, Y souprav, Z čerpadel. Upravit?"* na první otevření. Render `resource_violations[]` jako červený banner s ⛔ KRITICKÉ messages + ℹ️ recovery hints.
- [ ] **P0: Deploy MCP** — after merge, verify `/mcp` endpoint on Cloud Run, test with curl
- [ ] **P0: stavagent.cz/api-access page** — registration UI, API key display, credit balance, Lemon Squeezy checkout links
- [ ] **P0: AI advisor prompt v2 live validation** — after deploy, verify SO-202 mostovka returns TKP18 §7.8.3 + curing class 4 + prestress 11d citations. Gemini `response_mime_type: application/json` not yet enabled in Core `/api/v1/multi-role/ask` — if JSON parse fails repeatedly, add force-JSON on provider side.
- [ ] **P1: Lemon Squeezy webhook IDs** — set actual product_id mapping in `routes.py:PRODUCT_CREDITS`
- [ ] **P1: Custom GPT in GPT Store** — create GPT with Actions from `/openapi.json`, verify domain
- [ ] **P1: Fix "Jen problémy" filter** — `positions.js:150` inverted: `!p.has_rfi` should be `p.has_rfi`
- [ ] **P1: Per-záběr engine refactor** — element-scheduler uses max(tact_volumes) as bottleneck, should schedule per-záběr independently
- [ ] **P1: Migrate orphan projects** — `UPDATE monolith_projects SET portal_user_id='<admin_id>' WHERE portal_user_id IS NULL`
- [ ] **P1: E2E test FORESTINA SO.01** — stropní deska 125.559 m³, ztracené bednění 1325 m², manual záběry 4x, Aplikovat → verify TOV
- [ ] **P1: Prestress formula v2 refinement** — wait+stressing+grouting implemented for SO-202 (11d). Validate SO-203 (16 cables oboustranné) and SO-207 (spojkování per-takt MSS).
- [ ] **P1: Bridge formwork whitelist** — AI still recommends Dokaflex for mostovka in some cases. Add backend filter `BRIDGE_FORMWORK_WHITELIST` (Framax/Top 50/Staxo) applied when element_type∈{mostovkova_deska, rimsa}.
- [x] ~~**P1: Mostovka MSS category G (deferred from v4.19)**~~ ✅ **RESOLVED in v4.21.0.** `construction_technology='mss'` now routes to `findMssSystem()` returning DOKA MSS / VARIOKIT Mobile (pour_role='mss_integrated', reuse_factor=0.35). `formworkRentalCZK` + `propsRentalCZK` gated to 0 on `isMssPath`. Per-takt Nhod × 0.35. `calculateProps` skipped. `mssCost.mobilization + demobilization` flows into `formwork_labor_czk` as vlastní síly tesaři. New fields `is_mss_path`, `mss_mobilization_czk`, `mss_demobilization_czk`, `mss_rental_czk` on `PlannerOutput.costs`.
- [ ] **P1: Validation + warnings Phase 2 (deferred from v4.22)** — consolidates prior backlog item "MEGA pour Bug 4 warnings severity refactor" with the UI + engine bits deferred from Task 4 Phase 1. Scope: (1) introduce parallel `warnings_structured: Array<{severity: 'critical'|'warning'|'info'; message: string; category?: string}>` alongside legacy `warnings: string[]`. Migrate existing ⛔/⚠️/ℹ️ emoji-prefix messages → `severity` field (prefix parsing helper can auto-classify). (2) `CalculatorResult.tsx` Varování card renders red/orange/blue palette per severity instead of flat orange. (3) CRITICAL warnings gate the "Vypočítat plán" button with a "Pokračovat přesto" override link (per Task 4 AC 3). (4) Volume-vs-geometry, exposure + MSS-6 warnings get `severity` field populated from prefix. (5) MSS-9 verify: `formwork_rental_czk=0` + `mss_rental_czk=N × rental_months` is already the single source of truth — but add a test asserting `mss_rental_months === ceil((setup + spans×tact + teardown) / 30)` explicitly. (6) MSS-10 context-aware XF extraction in `tz-text-extractor.ts` — currently takes the highest-severity class found in the whole document; extend with per-element keyword patterns ("Nosná konstrukce …/X…", "Piloty …/X…") so SO-207 returns XF2 for mostovka (not XF1). (7) Golden test runner: `tools/golden_runner.py --object SO202` that feeds the markdown's `inputs:` block into `planElement()` and diffs against the `expected:` block. ~50 push sites for severity; ~4–5h for the entire pack.
- [ ] **P1: MEGA pour Bug 5 — NEÚPLNÉ total label (deferred from v4.20)** — when any computation step was skipped (props due to missing height, MSS bundled cost, etc.), PlannerOutput needs a structured `incomplete_reasons: Array<{reason: string; missing_field: string; estimated_range_czk?: [number, number]}>` field. UI "Celkem vše" row shows "X Kč — NEÚPLNÉ (chybí skruž, +1–3 M Kč)" with a quick-fix link. Currently the souhrn renders "Podpěry — zadejte výšku" placeholder rows (Mostovka D1) but the grand total silently omits the cost.
- [ ] **P1: Cross-kiosk sync Phase 3 remaining** — Portal 500 root cause (integration.js structured errors done, DB constraint unknown).
- [ ] **P1: Smart extractor Variant B (follow-up to v4.23)** — formula parser + UI catalog badges. (1) Safe-eval `(0,8*0,3+1,45*0,25)*156,4 = 94.231` + geometry decomposition (last multiplier = length, first group = cross-section). No `eval()` — use `expr-eval` or hand-rolled recursive parser. (2) Cross-validation formula vs smeta quantity: <1% OK, 1–5% INFO, 5–20% WARNING, >20% CRITICAL. (3) TzTextInput UI: catalog badges `[OTSKP]` blue / `[ÚRS]` green / `[regex]` gray / `[formula]` orange next to each param value. Hover tooltip shows `source + catalog + evidence`. (4) Section split: Základní / Rozměry / Materiál. (5) Per-element mapping expansion beyond the universal `volume_m3 / formwork_area_m2 / reinforcement_total_kg` (currently only `operne_zdi` mapping implemented fully). ~5 h total.
- [ ] **P1: Resource Ceiling Phase 3-4 — Group B+C+D+E+F** — zbývajících 16 element typů per task §6 (Group B pozemní svislé: stena, sloup, operne_zdi-pozemní variant, podzemni_stena; Group C speciální: nadrz, schodiste, pilota; Group D mostní spodní: driky_piliru, opery_ulozne_prahy, kridla_opery, zaklady_piliru, mostni operne_zdi; Group E NK: rigel, mostni_zavirne_zidky, prechodova_deska, podlozkovy_blok; Group F svršek: rimsa). Per skupina: B4 YAML + golden test scenarios + 1 PR + review checkpoint pre další skupinu.
- [ ] **P1: Resource Ceiling Foundation C2 — auto-recovery split** — když `pourDecision.pumps_required > ceiling.equipment.num_pumps` a `working_joints_allowed != 'no'`, engine auto-vypočítá forced section split (`num_tacts = ceil(volume / max_volume_per_pump_window)`) místo pouze ⛔ violation emit. Per Q4 interview "Extend pour-decision". Reuse existing `num_sections` infrastructure. Acceptance: SO-203 s 1 čerpadlem → engine vrací plán s 4 záběry, pracovní spárou v ose pole, žádné pump violation.
- [ ] **P3: Resource Ceiling cosmetic — zaklady_oper description_cs** — main's parallel PR copied zaklady_piliru template verbatim do zaklady_oper entry (`ELEMENT_DEFAULTS.zaklady_oper.description_cs = 'Základy pilířů — každý základ ...'`). Funkčně OK (description je jen UI hint), ale labeling inconsistency. Fix: change to `'Základy opěr — každý základ opěry = samostatná zachvatka, bez smejnosti'`.
- [ ] **P2: SmartInput PDF pipeline** — text extractor + TzTextInput component done (v4.18), smeta-line parser done (v4.23). Next: MinerU OCR integration for uploaded PDFs, chunked extraction for long docs, cross-document fusion.
- [ ] **P2: MCP listings** — PR to modelcontextprotocol/servers, register on mcp.so
- [ ] **P2: Výztuž B500B + Y1860** — split rebar for prestressed (dual RebarLiteResult)
- [ ] **P2: Landing page — visual QA + /register route + SEO subpages**
- [ ] **P2: Element field visibility map** — full ELEMENT_FIELD_VISIBILITY config for 24 element types
- [ ] **P3: Gantt calendar** — date axis in Portal mode
- [ ] **P3: SAFE cenový katalog** — add SAFE as 3rd vendor alongside DOKA/PERI

### Product Backlog
- [ ] Export Work Packages → PostgreSQL (currently SQLite in URS)
- [ ] IFC/BIM support (needs binaries)

---

**Per-service docs:** `concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`, `docs/STAVAGENT_CONTRACT.md`
