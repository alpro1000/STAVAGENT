# Other Inventory — Part 2: repo root + active `docs/` files

**Scope:** files at `/home/user/STAVAGENT/` root and `docs/` (excluding `docs/normy/` PDFs in part 3 and `docs/archive/` in part 4).
**Source:** Gate 1+2 Explore agent E (repo root).

---

## Repo-root files

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `CLAUDE.md` | 69 KB | markdown | operational_reference_root | per-service CLAUDEs, `next-session.md`, `README.md` | 2026-04-24 | no | keep_in_place | ~60 KB of domain rules + calibration history (TKP18 curing, exposure classes, OTSKP confidence). Single most knowledge-dense file in repo |
| `README.md` | 16 KB | markdown | repo_overview | per-service READMEs | 2026-04-24 | no | keep_in_place | Monorepo overview + service listing. English (rewritten 2026-04-19) |
| `next-session.md` | 13 KB | markdown | session_handoff | task tracking | 2026-04-24 | no | keep_in_place | Current backlog + Gate 1–11 roadmap |
| `extract_all_pdfs.py` | 7 KB / 224 lines | python | scripts_utility, pdf_extraction | knowledge_base CI | 2026-04-24 | no | keep_in_place | pdfplumber + MinerU fallback; produces `all_pdf_knowledge.json` |
| `CLOUD_SHELL_COMMANDS.sh` | 23 KB | bash | infrastructure_scripts | none in code/docs | 2026-04-24 | no | move_to_central | GCP setup + Cloud Build triggers — recommend move to `gcp/` to declutter root |
| 7× `cloudbuild-*.yaml` | varies | CI/CD config | deployment | GitHub Actions / GCP | 2026-04-24 | no | excluded | Infrastructure config — not knowledge-bearing per audit definition |

---

## `docs/` active root files (architecture / contracts / vision)

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `docs/ARCHITECTURE.md` | 13 KB | markdown | architecture_doc | per-service READMEs | 2026-04-19 | no | keep_in_place | Monorepo architecture + service graph + Cloud Run/Vercel topology |
| `docs/STAVAGENT_CONTRACT.md` | 18 KB | markdown | architecture_doc, mcp_contract | concrete-agent CLAUDE.md, `UNIFICATION_PLAN.md`, task specs | 2026-04-19 | partial (`stavagent-portal/docs/STAVAGENT_CONTRACT.md` is same name — verify) | keep_in_place | MCP contract: 9 tools schemas — load-bearing |
| `docs/UNIFICATION_PLAN.md` | 28 KB | markdown | architecture_doc, migration_roadmap | `POSITION_INSTANCE_ARCHITECTURE.ts`, `INVENTORY_BEFORE_WORKS_PIPELINE.md` | 2026-04-19 | no | keep_in_place | Unified data model migration plan (Phases 1–5) |
| `docs/UNIFIED_DATA_MODEL.ts` | 13 KB / 496 lines | TypeScript | schema_definition | Monolit shared, CORE models | 2026-04-19 | partial (`POSITION_INSTANCE_ARCHITECTURE.ts` overlaps) | keep_in_place | TS source-of-truth: ConstructionContext / Element / ConstructionPosition |
| `docs/POSITION_INSTANCE_ARCHITECTURE.ts` | 35 KB / 868 lines | TypeScript | schema_definition, detailed | `UNIFICATION_PLAN.md`, Monolit | 2026-04-19 | partial (`UNIFIED_DATA_MODEL.ts`) | refactor_split | Detailed instance arch — recommend keep + reduce `UNIFIED_DATA_MODEL.ts` to summary |
| `docs/PRODUCT_VISION_AND_ROADMAP.md` | 9.5 KB | markdown | roadmap | `CLAUDE.md`, `next-session.md` | 2026-04-19 | no | keep_in_place | 18-month vision; Phase 1 → 5 |
| `docs/STAVAGENT_ClaudeCode_Session_Mantra.md` | 5 KB | markdown | operational_checklist | `CLAUDE.md` | 2026-04-24 | no | keep_in_place | Pre-/during-/post-session checklist (v4.25.0) |
| `docs/MULTI_LLM_CONFIG.md` | 7.5 KB | markdown | configuration_doc | concrete-agent config | 2026-04-19 | no | keep_in_place | Multi-LLM provider setup (Gemini / OpenAI / Perplexity / Claude) |
| `docs/MONOLIT_REGISTRY_INTEGRATION.md` | 11 KB | markdown | integration_spec | CLAUDE.md, Monolit CLAUDE | 2026-04-19 | partial (references `docs/ROW_CLASSIFICATION_ALGORITHM.md` which doesn't exist at that path — algorithm details are inline here AND in `rozpocet-registry/docs/ROW_CLASSIFICATION_ALGORITHM.md` v1.1) | keep_in_place | Registry ↔ Monolit sync; classifier v1.1 |
| `docs/REGISTRY_MULTIUSER_ARCHITECTURE.md` | 8 KB | markdown | architecture_doc, future | `next-session.md`, RBAC spec | 2026-04-19 | no | keep_in_place | Multi-user roles; not yet shipped — Phase 4 |
| `docs/TZ_v4_ACTUAL.md` | 13 KB | markdown | schema_definition, tz_fields | Monolit `next-session.md`, Smart Extractor | 2026-04-19 | no | keep_in_place | TZ v4 — 12 fields mapped to FormState |
| `docs/INVENTORY_BEFORE_WORKS_PIPELINE.md` | 20 KB | markdown | audit_report | PRODUCT_VISION roadmap, TASK_Unified_Project_Works_Pipeline.md | 2026-04-24 | no | keep_in_place | Gate 1 audit for works-list pipeline; sibling to this audit |
| `docs/document-bridge-architecture.md` | 13 KB | markdown | architecture_doc | future Portal integration | 2026-04-19 | partial (UNIFICATION_PLAN Phase 2) | keep_in_place | Document bridge spec — overlaps UNIFICATION_PLAN |
| `docs/document-bridge-architecture.json` | 11 KB | JSON schema | architecture_schema | sibling .md | 2026-04-19 | partial (companion to .md) | merge_with | Companion JSON Schema — consider embedding in .md |
| `docs/TASK_Calculator_UISimplification_StrategicSplit.md` | 7.5 KB | markdown | task_spec | Monolit CLAUDE, `next-session.md` | 2026-04-19 | no | keep_in_place | Calculator UI Simple+Expert refactor task |
| `docs/TASK_TZ_TO_SOUPIS_PIPELINE_v3.md` | 10 KB | markdown | task_spec | `next-session.md`, PRODUCT_VISION | 2026-04-19 | yes (duplicate at `docs/archive/future-planning/TASK_TZ_to_Soupis_Pipeline_v3.md`) | keep_in_place | Active spec — superseded by INVENTORY_BEFORE_WORKS_PIPELINE.md but kept |
| `docs/TASK_VZ_SCRAPER_WORKPACKAGES_v3.md` | 11 KB | markdown | task_spec, vz_scraper | `INVENTORY_BEFORE_WORKS_PIPELINE.md` | 2026-04-19 | yes (archive duplicate) | keep_in_place | VZ scraper spec — Layer 4 deferred |
| `docs/FORMWORK_RENTAL_*.md` (3 files) | 12 KB combined | markdown | feature_doc | Monolit CLAUDE | 2026-04-19 | no | keep_in_place | Formwork rental calculator docs (shipped) |
| `docs/GOOGLE_CREDITS_STRATEGY.md` | 6 KB | markdown | financial_doc | budget tracking | 2026-04-19 | no | keep_in_place | GCP credits allocation |

---

## Setup / deployment guides — `mark_legacy` candidates

| path | size | reason for legacy | category |
|------|------|-------|----------|
| `docs/GOOGLE_DRIVE_API_ARCHITECTURE.md` | 46 KB | Shipped feature 2026-01-14 | mark_legacy |
| `docs/DESIGN_SYSTEM.md` | 10 KB | Mostly shipped, no active dev | mark_legacy |
| `docs/LOCAL_SETUP.md` | 15 KB | Superseded by per-service READMEs | mark_legacy |
| `docs/GOOGLE_CLOUD_SETUP.md` | 10 KB | Should move to `gcp/` | move_to_central |
| `docs/GOOGLE_SETUP_MANUAL.md` | 10 KB | Should move to `gcp/` | move_to_central |
| `docs/TESTING_SETUP.md` | 9 KB | Per-service test configs supersede | mark_legacy |
| `docs/DEPLOYMENT.md`, `DEPLOY_AFTER_MERGE.md`, `DEPLOYMENT_READY.md` | 22 KB | Duplicates across docs/ + concrete-agent/ | move_to_central |
| `docs/GOOGLE_INTEGRATION_HOWTO.md` | 7 KB | Mostly shipped | mark_legacy |
| `docs/CI_STATUS.md`, `CURRENT_STATUS_2026-03-21.md`, `BUGFIX_2026_03_09.md` | 4.5 KB combined | Snapshot files | mark_legacy or delete |
| 6× `WEEK_*_PROGRESS.md` + 4× `SESSION_2026-*.md` | 20 KB combined | Past session reports | mark_legacy → move to `docs/archive/completed-sessions/` |

---

End of part 2. Continued in `05_inventory_other_part3_normy_pdfs.md` (TKP + vendor PDFs).
