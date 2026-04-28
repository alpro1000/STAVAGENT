# Gate 0 — Discovery Plan

**Audit:** Knowledge Audit & Consolidation Plan
**Date:** 2026-04-26
**Branch:** `claude/cleanup-cloud-portal-onbNd`
**Mode:** Read-only inventory. Zero file modifications, zero deletions, zero moves outside this audit folder.

---

## Goal

Locate and classify every knowledge-bearing artefact in the STAVAGENT monorepo before any consolidation work. Output is a multi-file report under `docs/audits/knowledge_audit/`. No new folder structure for KB itself; no migration. Single deliverable: this report.

## What counts as "knowledge"

Per the task spec (concrete-construction domain, ČSN/TKP/EN norms, OTSKP/URS catalogs, productivity, formwork, prestress):

- YAML / JSON / CSV / TOML / DB / SQLite catalog files
- Markdown describing domain rules (`B*_*.md`, README chapters with norm logic)
- Engine code with hardcoded numeric norms (cover, removal strengths, vibrator parameters, formwork pressure, rebar h/t)
- Pydantic / TS schemas with Literal types over concrete grades or exposure
- Golden test fixtures with reference norm values
- AI prompts encoding domain rules
- Architecture / contract docs that codify domain rules
- Raw norm PDFs (TKP01–TKP33) and vendor manuals — they ARE knowledge sources

Excluded: tsconfig, package.json, CI scripts, pure-UI components, `node_modules`, `.venv`, `dist`, `build`, `.git`, `__pycache__`, `logs/`.

## Categories assigned per file

| Category | Meaning |
|----------|---------|
| `keep_in_place` | File is in correct location, no action |
| `move_to_central` | Should move to centralised KB |
| `merge_with` | Duplicates another file |
| `mark_legacy` | Outdated reference, keep but stop using |
| `delete` | Dead, no value |
| `refactor_split` | Mixes multiple concerns |
| `extract_constants` | Engine with hardcoded numeric norms — move numbers to YAML |
| `unclear` | Needs human input |

## Walk order

5 parallel `Explore` sub-agents, each scoped to one zone, each producing a markdown table per the schema below. Parallel execution chosen to (a) protect main context window from raw greps and (b) finish discovery in <8 min wall-clock.

| Agent | Scope |
|-------|-------|
| 1 — CORE | `concrete-agent/packages/core-backend/app/` — knowledge_base, prompts, classifiers, parsers, services, models, db, validators, pricing |
| 2 — Monolit | `Monolit-Planner/` — shared/src calculators+classifiers+parsers, backend routes/services, frontend constants, migrations |
| 3 — Other backends | `stavagent-portal/`, `URS_MATCHER_SERVICE/`, `rozpocet-registry-backend/`, `mineru_service/` |
| 4 — Registry frontend | `rozpocet-registry/` — classification services, JSON catalogs, spec docs |
| 5 — Repo root + docs | repo root, `docs/`, `data/peri-pdfs/`, `test-data/`, `scripts/`, archived sessions, TKP and vendor PDFs |

## Per-file output schema

Each agent emits a markdown table with columns:

| path (rel to repo root) | size (lines or KB) | content_type | theme | importers (top 3) | last_modified (git) | dup_hint (yes/no/partial) | category | justification (≤140 chars) |

Methods: `wc -l` for text, `du -h` for binary, `git log -1 --format='%cs'` for last_modified, recursive grep (excluding `node_modules`/`.venv`/`dist`/`__pycache__`) for importers.

## Acceptance for Gate 0

This file exists and pins the methodology. Subsequent gates 1–6 produce one file each (or `_partN.md` if a section exceeds ~400 lines). Naming convention: `NN_<section>.md`, zero-padded for sort order.

## Map of subsequent files

| File | Gate | Source |
|------|------|--------|
| `01_inventory_core.md` | 1+2 | Agent 1 output |
| `02_inventory_monolit.md` | 1+2 | Agent 2 output |
| `03_inventory_portal.md` | 1+2 | Agent 3 (Portal portion) |
| `04_inventory_registry.md` | 1+2 | Agent 4 + Agent 3 (Registry-backend portion) |
| `05_inventory_other.md` | 1+2 | Agent 3 (URS + MinerU) + Agent 5 (repo root, docs, data) |
| `06_duplicates_conflicts.md` | 3 | Cross-zone synthesis |
| `07_dependencies.md` | 4 | Importer graph + dangling files |
| `08_variant_centralized.md` | 5 | Architecture variant A |
| `09_variant_distributed.md` | 5 | Architecture variant B |
| `10_variant_hybrid.md` | 5 | Architecture variant C + bonus variant D (codegen) |
| `11_migration_plans.md` | 6 | Per-variant migration effort |
| `12_top_recommendations.md` | 6 | Prioritised action list |
| `13_open_questions.md` | 6 | Items needing human decision |
| `99_summary.md` | — | Exec summary + ToC, references files above |

## Constraints honoured

- No file moved, created (other than this report), or deleted
- No code edited
- No new sources downloaded from bibliography
- No new top-level folder created (only `docs/audits/knowledge_audit/` per user's resumed instruction)
- No clarifying questions during inventory — `unclear` category + entry in `13_open_questions.md` instead

## What this audit will NOT answer

- Whether the centralised KB should be Python-first or TS-first (architectural decision deferred to user post-report)
- Whether the 5 externally-promised artefacts (`STAVAGENT_klasifikator…`, `B3_common.{md,yaml}`, `TTK_walls_extracted.yaml`, `bibliography_concrete_construction.md`, `TASK_NormsAudit_MonolitPlanner_CoreEngine.md`) were ever created — only whether they exist in the repo today
- Whether stale 2018 catalogs (URS201801.csv, TSP201801.csv, CENEKON201801.csv) are still needed — flagged for human review

---

End of Gate 0. Proceeding to Gate 1+2 inventory files.
