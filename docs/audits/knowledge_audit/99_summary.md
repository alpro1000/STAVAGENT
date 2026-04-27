# Knowledge Audit — Executive summary + Table of Contents

**Date:** 2026-04-26
**Branch:** `claude/cleanup-cloud-portal-onbNd`
**Mode:** read-only inventory (zero file modifications outside this audit folder).

---

## Headline numbers

| Metric | Count |
|--------|-------|
| Knowledge-bearing files inventoried | **~430** |
| Files with hardcoded numeric norms (file:line:value tracked) | **28** (8 CORE + 20 Monolit) |
| Critical findings | **1** (CLASSIFICATION_RULES dual-write) |
| Topic-duplication groups | **15** |
| Value-conflict cases | **8** (1 critical, 3 medium unverified, 4 low) |
| Dangling files (zero importers) | **21** |
| Externally-promised artefacts missing from repo | **5** |
| Architecture variants designed | **4** (A centralised, B distributed, C hybrid cache, D codegen) |
| Recommended action items | **12** |
| Open questions for developer | **11** |

---

## One-paragraph verdict

STAVAGENT's knowledge is **structured but uneven**. CORE has a reasonable B1–B9 catalog scaffold; B1/B2/B3/B4/B9 are fleshed out, B5–B8 are empty. Monolit-Planner is the heaviest source of hardcoded norms (20 hotspots) — by design, since the calculator engines must run synchronously. The single **critical** finding is the `CLASSIFICATION_RULES` dual-write between Registry frontend and serverless backend — same array in two files with no enforcement. Beyond that, the audit found ~15 topic-duplication groups (concrete classes/exposure in 4 places, formwork systems in 4 places, productivity in 3, etc.). Recommended path: **Variant B Phase 0** (1 week, low-risk cleanup that resolves the critical issue + deletes 21 dangling files) → **Variant D** (~3 weeks, single-source `kb/` + Python+TS codegen) for the architectural target.

---

## Table of contents

| # | File | Gate | Lines |
|---|------|------|-------|
| 0 | [`00_plan.md`](00_plan.md) | Discovery plan | 101 |
| 1a | [`01_inventory_core_part1_kb.md`](01_inventory_core_part1_kb.md) | Inventory — CORE knowledge_base/ B0–B9 | 105 |
| 1b | [`01_inventory_core_part2_prompts.md`](01_inventory_core_part2_prompts.md) | Inventory — CORE prompts/ | 64 |
| 1c | [`01_inventory_core_part3_engines.md`](01_inventory_core_part3_engines.md) | Inventory — CORE services/classifiers/parsers + 8 hotspots | 64 |
| 1d | [`01_inventory_core_part4_models_db.md`](01_inventory_core_part4_models_db.md) | Inventory — CORE models/db/dangling/notes | 108 |
| 2a | [`02_inventory_monolit_part1_engines.md`](02_inventory_monolit_part1_engines.md) | Inventory — Monolit shared/src engines | 57 |
| 2b | [`02_inventory_monolit_part2_hotspots.md`](02_inventory_monolit_part2_hotspots.md) | Inventory — Monolit backend/frontend + 20 hotspots | 94 |
| 3 | [`03_inventory_portal.md`](03_inventory_portal.md) | Inventory — Portal | 64 |
| 4a | [`04_inventory_registry_part1_frontend.md`](04_inventory_registry_part1_frontend.md) | Inventory — Registry frontend + dual-write finding | 83 |
| 4b | [`04_inventory_registry_part2_backend.md`](04_inventory_registry_part2_backend.md) | Inventory — Registry backend | 53 |
| 5a | [`05_inventory_other_part1_urs.md`](05_inventory_other_part1_urs.md) | Inventory — URS_MATCHER + MinerU | 99 |
| 5b | [`05_inventory_other_part2_repo_root.md`](05_inventory_other_part2_repo_root.md) | Inventory — repo root + active docs/ | 64 |
| 5c | [`05_inventory_other_part3_normy_pdfs.md`](05_inventory_other_part3_normy_pdfs.md) | Inventory — TKP + vendor PDFs + test data | 66 |
| 5d | [`05_inventory_other_part4_archive.md`](05_inventory_other_part4_archive.md) | Inventory — docs/archive + missing artefacts | 81 |
| 6a | [`06_duplicates_conflicts.md`](06_duplicates_conflicts.md) | Gate 3 — topic duplicates (15 groups) | 114 |
| 6b | [`06_duplicates_conflicts_part2_value_conflicts.md`](06_duplicates_conflicts_part2_value_conflicts.md) | Gate 3 — value conflicts (B1–B8) | 117 |
| 7 | [`07_dependencies.md`](07_dependencies.md) | Gate 4 — dependency graph + 21 dangling files | 145 |
| 8 | [`08_variant_centralized.md`](08_variant_centralized.md) | Variant A — centralised HTTP | 91 |
| 9 | [`09_variant_distributed.md`](09_variant_distributed.md) | Variant B — distributed cleanup | 86 |
| 10a | [`10_variant_hybrid.md`](10_variant_hybrid.md) | Variant C — hybrid cache | 83 |
| 10b | [`10_variant_hybrid_part2_codegen.md`](10_variant_hybrid_part2_codegen.md) | Variant D — single source + codegen (RECOMMENDED) | 105 |
| 11 | [`11_migration_plans.md`](11_migration_plans.md) | Per-variant migration plans | 133 |
| 12 | [`12_top_recommendations.md`](12_top_recommendations.md) | Top-12 prioritised recommendations | 111 |
| 13 | [`13_open_questions.md`](13_open_questions.md) | 11 open questions for developer | 114 |

**Total report:** 23 files, ~2,200 lines.

---

## Where to start reading

**For 5-minute scan:** read this summary + `12_top_recommendations.md` + `13_open_questions.md`.

**For decision on variant choice:** read `08`, `09`, `10`, `10_part2`, `11_migration_plans.md`, then `13_open_questions.md` Q9.

**For specific service deep-dive:** jump to inventory file for that service.

**For drift audit / value-conflict check:** read both parts of `06_*`.

---

## Constraints honoured

✅ No file moved, deleted, or edited outside this audit folder.
✅ No code changed.
✅ No new sources downloaded.
✅ No new top-level folder created (only `docs/audits/knowledge_audit/`).
✅ Single audit deliverable: this multi-file report.
✅ Per-file commits, ≤ ~120 lines each, individual `git push` after each commit.

---

## Next session

The developer reads this report, picks one of the four variants, and answers `13_open_questions.md`. After that, a separate session can begin Phase 0 (per-recommendation actions in `12_top_recommendations.md`).
