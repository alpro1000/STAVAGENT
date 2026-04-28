# Other Inventory — Part 4: `docs/archive/` + externally-promised missing artifacts

**Scope:** `docs/archive/{analyses,completed-fixes,completed-projects,completed-sessions,future-planning,legacy}/` + check for missing artifacts mentioned in CLAUDE.md / earlier sessions.
**Source:** Gate 1+2 Explore agent E (repo root, archive bulk).

---

## `docs/archive/` — bulk grouped (47 files, ~640 KB)

Fully expanded inventory would inflate this file beyond budget; bulk-grouped instead.

| subfolder | count | total size | last_modified range | bulk verdict | representative files |
|---|---|---|---|---|---|
| `analyses/` | 10 | 100 KB | 2025-12 → 2026-04 | mostly **mark_legacy** + 1 `move_to_central` (SECRETS_AUDIT) | `AUDIT_Monorepo_Architecture.md` (30 KB), `COMPLETE_SYSTEM_AUDIT_REPORT.md` (18 KB), `SECRETS_AUDIT_19042026.md` (4.5 KB — recent, scan for active issues) |
| `completed-fixes/` | 6 | 38 KB | 2026-01 → 2026-02 | all **mark_legacy** | `SCHEMA_FIX_2026-01-19.md`, `MONOLIT_XLSX_IMPORT_DEBUG.txt`, `PORTAL_TABS_MODAL_PATCH.txt` |
| `completed-projects/` | 2 | 24 KB | 2026-01 → 2026-02 | **mark_legacy** | `MULTI_ROLE_OPTIMIZATION_COMPLETE.md` (14 KB), `PR_DESCRIPTION.md` (9.7 KB) |
| `completed-sessions/` | 20 | 260 KB | 2026-01-29 → 2026-02-24 | all **mark_legacy** → recommend `tar.gz` | `SESSION_2026-01-16_MODAL_WORK_NAMES.md` (23 KB), `DAY3_RESULTS.md` (16 KB), `SESSION_2026-02-10_PASSPORT_PRODUCTION_FIX.md` (16 KB) |
| `future-planning/` | 8 | 76 KB | 2026-04 | mostly **mark_legacy** + 2 active duplicates | `PLAN_CABINETS_ROLES_BILLING.md` (24 KB — superseded by PRODUCT_VISION Phase 4), `TASK_VZ_Scraper_WorkPackages_v3.md` (23 KB — duplicate of `docs/TASK_VZ_SCRAPER_…`), `TASK_TZ_to_Soupis_Pipeline_v3.md` (17 KB — duplicate of `docs/TASK_TZ_TO_SOUPIS_…`) |
| `legacy/` | 8 | 150 KB | 2026-01 → 2026-04 | **mark_legacy or delete** | `stavagent_architecture_spec.json` (38 KB pre-v4 spec), `UNIFIED_ARCHITECTURE.md` (19 KB), `UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md` (20 KB), `SECURITY_HARDENING_PLAN.md` (20 KB), `SUPPLEMENT_VZ_Sources_vvz_nipez.md` (4 KB) |

**Aggregate verdict for `docs/archive/`:** ~600 KB of historical material. Compression candidate for storage hygiene; not blocking development.

**Recommended action:**
1. Delete the 2 future-planning duplicates (active versions live in `docs/` root).
2. Delete `legacy/stavagent_architecture_spec.json` (pre-v4, superseded by ARCHITECTURE.md).
3. Tar.gz `completed-sessions/` to `docs/archive/sessions-q1-2026.tar.gz` (keep last 3 sessions uncompressed for calibration reference).
4. Keep `analyses/` (audit reports retain reference value).

---

## Externally-promised artifacts — present-or-missing check

The task's appendix lists 5 artefacts produced by earlier sessions. Verified via `find`:

| artifact | promised_in | path search result | status |
|---|---|---|---|
| `STAVAGENT_klasifikator_betonovych_elementu.md` | task appendix, implied in CLAUDE.md | not found anywhere in repo | **MISSING** |
| `B3_common.md` / `B3_common.yaml` | task appendix | not found | **MISSING** |
| `TTK_walls_extracted.yaml` | task appendix | not found | **MISSING** |
| `bibliography_concrete_construction.md` | task appendix | not found | **MISSING** |
| `TASK_NormsAudit_MonolitPlanner_CoreEngine.md` | task appendix | not found | **MISSING** |
| `STAVAGENT_Complete_Element_Catalog.md` | `INVENTORY_BEFORE_WORKS_PIPELINE.md` (Gate 0 blocker) | not found | **MISSING — awaiting user paste** (locked decision 2026-04-24) |
| `BRIEFING_NextChat_ElementTechSheets.md` | INVENTORY (Gate 0 blocker) | not found | **MISSING — awaiting user paste** |
| `docs/ROW_CLASSIFICATION_ALGORITHM.md` (referenced from `MONOLIT_REGISTRY_INTEGRATION.md`) | inline cross-ref | not found at that path; v1.1 spec exists at `rozpocet-registry/docs/ROW_CLASSIFICATION_ALGORITHM.md` | **MISLOCATED** — broken link in MONOLIT_REGISTRY_INTEGRATION.md |

**Observation:** all 5 task-appendix artefacts are missing from the repo. They were either produced in chat-only sessions and never landed, or kept in the developer's local notes. Treat as "external knowledge that should be brought into the new architecture" — captured for `13_open_questions.md`.

---

## Dangling files (large + unreferenced)

Files >10 KB whose name does not appear in any active code/docs grep:

| path | size | recommendation |
|---|---|---|
| `docs/archive/legacy/stavagent_architecture_spec.json` | 38 KB | **delete** — pre-v4 spec, superseded by ARCHITECTURE.md |
| `docs/archive/future-planning/PLAN_CABINETS_ROLES_BILLING.md` | 24 KB | **delete or archive deeper** — superseded by PRODUCT_VISION Phase 4 |
| `docs/archive/future-planning/TASK_VZ_Scraper_WorkPackages_v3.md` | 23 KB | **delete** — duplicate of active `docs/TASK_VZ_SCRAPER_…` |
| `docs/archive/future-planning/TASK_TZ_to_Soupis_Pipeline_v3.md` | 17 KB | **delete** — duplicate |
| `docs/archive/legacy/UNIFIED_ARCHITECTURE.md` | 19 KB | **delete** — pre-v4 |
| `docs/archive/legacy/UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md` | 20 KB | **delete** — pre-v4 |
| `docs/archive/analyses/AUDIT_Monorepo_Architecture.md` | 30 KB | compress (still has reference value) |
| `docs/archive/completed-sessions/*` (20 files) | 260 KB total | tar.gz to `sessions-q1-2026.tar.gz` |

---

## Counts (Other inventory total: parts 1+2+3+4)

| Bucket | Count |
|--------|-------|
| URS_MATCHER + MinerU files (part 1) | 34 |
| Repo root + active docs (part 2) | ~30 |
| TKP + vendor PDFs + extracted (part 3) | 33 + 6 + 3 + 3 + 2 = 47 |
| docs/archive/ (part 4 grouped) | 47 |
| Externally-promised missing | 8 |
| Dangling files >10 KB | 8 |
| **Total inventoried in "Other"** | **~150** |

---

End of inventory phase (Gates 1+2 complete across all 11 inventory files). Continued in `06_duplicates_conflicts.md` (Gate 3).
