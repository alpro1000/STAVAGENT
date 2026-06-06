# Session 2026-03-28: Full Codebase Audit & Documentation Inventory

**Date:** 2026-03-28
**Scope:** All 5 services + infrastructure + all documentation files
**Method:** 6 parallel agents analyzing code, then cross-referenced with .md documentation

---

## 1. SERVICE ANALYSIS SUMMARY

### 1.1 concrete-agent (CORE)
- **Code:** ~56,877 lines Python, 92+ files
- **Endpoints:** 119 API routes across 25+ route files
- **Services:** 65+ service modules
- **Tests:** 28 test files (~97% pass rate)
- **Database:** PostgreSQL 16+ (async, SQLAlchemy 2.0 + asyncpg), 10 tables
- **Cache:** Redis 5.0 + Celery 5.4

**Key subsystems:**
- Workflows A (import/audit), B (drawings), C (hybrid) — all functional
- Multi-Role Expert System: 4 roles (SME, ARCH, ENG, SUP) — NOT 6 as docs say
- Document Processing: 4-tier classification (filename → regex → keywords → AI)
- NKB: 3-layer normative knowledge base (Registry → Rules → Advisor)
- NormIngestionPipeline: L1→L2→L3a→L3b with confidence tracking
- Knowledge Base: B1-B9 categories (42 JSON files, 4.3MB consolidated)
- Price Parser: 7 sub-parsers (betony, malty, doprava, cerpadla, priplatky, laborator, source)
- LLM providers: Vertex AI (primary) → Bedrock → Gemini API → Claude API → OpenAI
- Feature flags: 8 configurable flags in config.py

**Undocumented in CLAUDE.md:**
- Betonárny Discovery (3 endpoints) — concrete supplier search
- Norms Scraper (6 endpoints) — web scraping ÚRS/OTSKP/ČSN
- Agents system (3 endpoints) — agent management
- Document Accumulator (20 endpoints) — only briefly mentioned
- Google Drive OAuth2 (7 endpoints) — only briefly mentioned
- Vertex AI Search — multi-endpoint
- Chat system — message management
- LLM Status endpoint

### 1.2 stavagent-portal (Dispatcher)
- **Code:** Node.js/Express + React 18
- **Endpoints:** ~80+ API endpoints across 15 route groups
- **Frontend:** 20 pages/routes, 40+ components
- **Database:** PostgreSQL/SQLite, 20+ tables, auto-migrations
- **Auth:** JWT (24h), 5 org roles, email/phone verification

**Key subsystems:**
- Auth: 15 endpoints (register, login, verify, forgot/reset password, phone verify)
- Portal Projects: 10 endpoints (CRUD + send-to-core)
- Portal Files: 9 endpoints (upload 50MB, parse, analyze)
- Admin panel: 17 endpoints (users, feature flags, usage, audit logs, anti-fraud)
- Organizations: 10 endpoints (CRUD + invites + roles)
- Service Connections: 8 endpoints (AES-256-GCM encrypted API keys)
- Pump Calculator: 15 endpoints (suppliers, models, accessories, calculate)
- OTSKP codes: 4 endpoints (search, lookup)
- Position Instances: 8 endpoints (unified position identity)
- Integration: 3 endpoints (batch sync Monolit ↔ Registry)
- CORE Proxy: 3 routes (300s timeout)
- Documents: 4 endpoints (save/load analyses)
- Debug: 4 endpoints (dev only)

**Undocumented in CLAUDE.md:**
- Pump Calculator (15 endpoints) — not mentioned in portal section
- OTSKP routes (4 endpoints) — not mentioned
- Phone verification — not mentioned
- IP anti-fraud — not mentioned
- Parse Preview routes — not mentioned

### 1.3 Monolit-Planner (Kiosk)
- **Code:** 3 packages (shared + backend + frontend)
- **Endpoints:** 125 backend API routes
- **Tests:** 342 shared + 60 backend = 402 total
- **Database:** PostgreSQL/SQLite, 20+ tables, 11 migrations
- **Shared:** 43 TypeScript files, 7-engine pipeline + 5 supporting engines

**7-Engine Pipeline:**
1. Element Classifier → 20+ types (9 bridge + 11 building)
2. Pour Decision Tree → sectional vs monolithic
3. Formwork Engine → 3-phase strategies (A/B/C)
4. Rebar-Lite → duration estimation
5. Pour Task Engine → pump scheduling, night shift premium
6. Element Scheduler (RCPSP) → DAG, critical path, Gantt
7. PERT + Monte Carlo → p50/p75/p90/p95 percentiles

**Supporting engines:** Maturity, Props, Calendar, Pump, Tariff Versioning

**Undocumented in CLAUDE.md:**
- Snapshot system (SHA256 versioning + delta tracking) — only briefly mentioned
- R0 Deterministic Core routes (Phase 6) — not mentioned
- 125 total endpoints — docs say less
- Normsets (4 defined: ÚRS 2024, RTS 2023, KROS 2024, Internal) — not detailed

### 1.4 URS_MATCHER_SERVICE (Kiosk)
- **Code:** Node.js/Express + SQLite
- **Endpoints:** ~45 API endpoints
- **Tests:** 159 tests (2,359 lines)
- **Database:** SQLite, 12 tables
- **LLM providers:** 9 (not 8 as docs say)

**4-Phase Matching Pipeline:**
1. File Parsing & Text Matching (Excel/ODS/CSV)
2. Document Analysis (PDF/DOCX via concrete-agent)
3. URS Matching: TSKP Classification → Candidate Generation → KB Lookup → LLM Re-ranking
4. Composite Works Detection & Tech Rules

**9 LLM Providers:** Claude, Gemini, OpenAI, Bedrock, DeepSeek, Grok, Qwen, GLM, Brave Search

**Undocumented in CLAUDE.md:**
- Unified Pipeline (/api/pipeline/*) — 7 endpoints
- Batch Processing — 6 endpoints (create, start, pause, resume, status, export)
- Technology Calculations — 3 endpoints (concrete, reinforcement, formwork estimation)
- Pricing endpoints — 3 endpoints
- Project Analysis (Multi-Role BOQ) — 3 endpoints
- Catalog management + versioning — 7 endpoints
- Settings endpoints (runtime LLM switching)

### 1.5 rozpocet-registry (Kiosk)
- **Code:** React 19 + TypeScript + Vite SPA
- **Backend:** 12 Vercel serverless functions
- **State:** Zustand + localStorage/IndexedDB
- **Tests:** NONE (no test suite)

**Key features:**
- 7-step Import Modal (Excel)
- AI Classification Pipeline: Cache → Rules → Memory → Gemini (50+ rules)
- TOV Modal (Labor/Machinery/Materials breakdown)
- Formwork Rental Calculator (35KB component, ČSN EN 13670)
- Pump Rental Calculator (39KB, multi-supplier)
- Monolit price comparison (variance thresholds: 5%/15%/30%)
- Portal auto-sync (debounced 5s)
- DOV write-back to Portal

**Undocumented in CLAUDE.md:**
- 7-step Import Modal workflow
- TOV Modal details (3 tabs, resource breakdown)
- Formwork Rental details (35KB, curing by element type)
- Pump Rental details (39KB, real supplier data)
- Portal deep-linking via query params
- Monolit polling service (30s foreground, 2min background)
- Classification rules priority system (200→50)
- Memory/learning system for user corrections

### 1.6 Infrastructure
- **Cloud Build:** 7 YAML configs (per-service + deploy-all + mineru)
- **Triggers:** 6 YAML configs (5 auto + 1 manual)
- **GitHub Actions:** 5 workflows (keep-alive, monolit-ci, test-coverage, test-shared, test-urs)
- **Dockerfiles:** 6 (one per service + mineru)
- **Secrets:** 24 in Secret Manager
- **MinerU:** Standalone Cloud Run microservice (4GB RAM, scale-to-zero, europe-west1)

---

## 2. CODE vs DOCUMENTATION DISCREPANCIES

### Critical Discrepancies
| # | Item | CLAUDE.md says | Code actually has | Severity |
|---|------|---------------|-------------------|----------|
| 1 | Multi-Role roles | "6 roles" | 4 roles (SME, ARCH, ENG, SUP) | Medium |
| 2 | LLM providers (URS) | "8 LLM providers" | 9 providers (added Bedrock) | Low |
| 3 | Service Connections | "schema only" | Fully implemented (8 endpoints + AES-256-GCM) | High |
| 4 | concrete-agent endpoints | Not counted | 119 endpoints | Info |
| 5 | Portal endpoints | Not counted | ~80+ endpoints | Info |
| 6 | Monolit endpoints | Not counted | 125 endpoints | Info |
| 7 | URS endpoints | Not counted | ~45 endpoints | Info |

### Features Missing from CLAUDE.md
| Service | Feature | Endpoints |
|---------|---------|-----------|
| concrete-agent | Betonárny Discovery | 3 |
| concrete-agent | Norms Scraper | 6 |
| concrete-agent | Agents system | 3 |
| concrete-agent | Document Accumulator (detail) | 20 |
| Portal | Pump Calculator | 15 |
| Portal | OTSKP codes | 4 |
| Portal | Phone verification | 2 |
| URS | Unified Pipeline | 7 |
| URS | Batch Processing | 6 |
| URS | Technology Calculations | 3 |
| URS | Pricing | 3 |
| URS | Project Analysis | 3 |
| URS | Catalog versioning | 7 |
| Registry | 7-step Import Modal | — (frontend) |
| Registry | TOV Modal details | — (frontend) |
| Registry | Formwork/Pump calculators details | — (frontend) |

---

## 3. DOCUMENTATION FILE INVENTORY

### By File Type

| Type | Count | Total Size | Location |
|------|-------|-----------|----------|
| .md (root) | 61 | ~330KB | Root directory |
| .md (services) | 34 | ~200KB | Monolit (19), URS (20), docs/ (33) |
| .txt | 15 | ~110KB | Root (6), concrete-agent (2+), Monolit (4), Registry (3) |
| .docx | 1 | 20KB | Root |
| .sql | 22 | ~200KB | Portal (4), Monolit (12), URS (1), Registry (1), GCP (3), Root (1) |
| .json (KB) | 42 | ~40MB | concrete-agent/knowledge_base/ B1-B9 |
| .txt (prompts) | 21 | ~50KB | concrete-agent/prompts/ |
| .pdf (projects) | 100+ | ~600MB | concrete-agent/data/projects/ |
| all_pdf_knowledge.json | 1 | 4.3MB | concrete-agent/knowledge_base/ |

### Knowledge Base Structure (B1-B9)

```
B1_otskp_codes/     — OTSKP classification codes
B1_rts_codes/       — RTS price database
B1_urs_codes/       — URS construction codes (3 files)
B2_csn_standards/   — ČSN/TKP standards (6 files: EN 206, TKP 03/17/18/22/24)
B3_current_prices/  — Market prices (14 files: DOKA, PERI, Berger, Frischbeton)
B4_production_benchmarks/ — Productivity rates (8 files: norms, tariffs, formwork)
B5_tech_cards/      — Technical procedures (~300 cards)
B6_research_papers/ — Academic research
B7_regulations/     — Legal/regulatory docs
B8_company_specific/ — Company rules
B9_Equipment_Specs/ — Equipment specs (3 files: cranes, pumps, excavators)
```

### AI Prompt Files (21)

```
claude/assistant/   — construction_expert.txt, stav_expert_v2.txt
claude/analysis/    — quick_preview.txt
claude/audit/       — audit_position.txt
claude/generation/  — generate_from_drawings.txt
claude/parsing/     — parse_kros_table_xml.txt, parse_vykaz_vymer.txt, parse_kros_unixml.txt
claude/vision/      — analyze_construction_drawing.txt
gpt4/vision/        — analyze_technical_drawings.txt
gpt4/ocr/           — scan_construction_drawings.txt
resource_calculation/ — master_framework.txt, concrete_work.txt, masonry_work.txt
```

### SQL Migrations & Schemas

**concrete-agent (2):** google_drive_tables, nkb_tables
**Portal (4):** schema-postgres (33KB), position-instance, unified-project, pump-suppliers
**Monolit (12):** schema-postgres (14KB), migrations 004-011 (r0 core = 21KB)
**URS (1):** schema.sql (13KB)
**Registry (1):** schema.sql (2.4KB)
**GCP prod init (3):** Portal (16KB), Monolit (32KB), Registry (2.6KB)

### Large/Notable Files

| File | Size | Description |
|------|------|-------------|
| all_pdf_knowledge.json | 4.3MB | Consolidated KB from all parsed PDFs |
| cennik_doka_extracted_content_markdown.txt | 43KB | DOKA price catalog (extracted) |
| gcp/sql/02-init-monolit-planner.sql | 32KB | Full Monolit prod initialization |
| schema-postgres.sql (Portal) | 33KB | Full Portal DB schema |
| concrete-agent PDF projects | ~600MB | 100+ real project drawings/docs |

---

## 4. ENDPOINT TOTALS BY SERVICE

| Service | Endpoints | Tests | LOC (approx) |
|---------|-----------|-------|--------------|
| concrete-agent | 119 | 28 files | ~57K Python |
| stavagent-portal | ~80 | 1 file | ~15K JS + ~10K TSX |
| Monolit-Planner | 125 | 402 (342+60) | ~20K TS + ~10K JS |
| URS_MATCHER_SERVICE | ~45 | 159 | ~10K JS |
| rozpocet-registry | 12 (serverless) | 0 | ~15K TSX |
| MinerU | 3 | 0 | ~500 Python |
| **TOTAL** | **~384** | **590+** | **~137K** |

---

## 5. RECOMMENDATIONS

### Documentation Updates Needed
1. Fix Multi-Role "6 roles" → "4 roles" (SME, ARCH, ENG, SUP)
2. Fix URS "8 providers" → "9 providers" (added Bedrock)
3. Fix Service Connections "schema only" → "fully implemented"
4. Add endpoint counts per service
5. Document Knowledge Base B1-B9 structure
6. Document AI prompt files
7. Add Betonárny Discovery, Norms Scraper, Agents to concrete-agent section
8. Add Pump Calculator, OTSKP to Portal section
9. Add Unified Pipeline, Batch, Technology, Pricing to URS section
10. Add Import Modal, TOV, Formwork/Pump calculator details to Registry section

### Cleanup Opportunities
1. **~60 root .md files** — mostly obsolete session summaries and PR descriptions
2. **6 root .txt files** — debug/patch notes, can be archived
3. **1 root .docx** — architecture task, already superseded by CLAUDE.md
4. **Registry has 0 tests** — needs test suite

### Architecture Observations
- Total ~384 API endpoints across 6 services
- concrete-agent is the largest (119 endpoints, 57K LOC)
- Monolit has the most tests (402)
- Registry has the least infrastructure (no tests, no auth, Vercel serverless)
- All services now use Vertex AI ADC (GCP credits)
