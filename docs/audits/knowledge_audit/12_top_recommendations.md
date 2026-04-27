# Gate 6 — Top recommendations

Prioritised by **(severity × ease)**. Each recommendation is independently actionable; doing #1 alone makes the system safer than doing nothing.

---

## P0 — Critical (do regardless of variant choice)

### #1. Resolve `CLASSIFICATION_RULES` dual-write
**Problem:** `rozpocet-registry/src/services/classification/classificationRules.ts` (frontend, 386 lines) and `rozpocet-registry/api/agent/rules.ts` (serverless, 288 lines) contain **identical 11-skupiny rule arrays** with no enforcement. Drift will produce different classifications in UI vs server depending on which path runs.
**Fix:** extract rules to `rozpocet-registry/src/data/skupiny_rules.json` (or `kb/classification_rules/boq_skupiny_v1.yaml` if Variant D selected). Both .ts files import the JSON.
**Effort:** S — 4 hours.
**Severity:** **critical** (data correctness).

### #2. Verify `EXPOSURE_MIN_CURING_DAYS` (Monolit `maturity.ts:91–97`) against CORE `B2/csn_en_206.json`
**Problem:** unverified value-conflict B3. Monolit hardcodes 6 day-values; CORE may or may not have matching figures.
**Fix:** read both files; if matching → document the duplication and pick a single source. If not matching → escalate to domain expert (TKP18 §7.8.3 specifies authoritative values).
**Effort:** XS — 30 minutes.
**Severity:** medium (correctness if values differ).

---

## P1 — High (cleanup gates, no variant dependency)

### #3. Resolve Frami Xlife rental rate divergence
**Problem:** Monolit `formwork-systems.ts:127` says **507.20 CZK/m²/mo**; Registry `formwork_knowledge.json` says **531.52–730.60** (4 height variants). CORE `doka_cennik_2025-01-01.json` is third source.
**Fix:** treat CORE 2025-01-01 catalog as authoritative; both Monolit and Registry should derive from it (or pull at startup if Variant C/D shipped).
**Effort:** S — 2–4 hours.
**Severity:** medium (cost accuracy).

### #4. Verify productivity rates (Monolit REBAR_RATES_MATRIX vs CORE B4 norms)
**Problem:** Both encode rebar productivity but with different schemas. Monolit cites methvin.co + RSMeans (April 2026); CORE B4 source unclear.
**Fix:** confirm Monolit is fresher; archive CORE's older copy if so.
**Effort:** S — 2 hours.
**Severity:** medium.

### #5. Delete the 21 dangling files (per `07_dependencies.md`)
**Problem:** ~16 MB of orphan files clutter repo and confuse onboarding.
**Fix:** delete in batches:
- 4 empty B5–B8 stubs in CORE
- 5 orphan CORE prompts (after confirming Workflow B / GPT-4 Vision are dead)
- 3 URS legacy files (KROS.MDB, ImportDB.mdb, import_kros_urs.mjs)
- 1 Registry orphan (concrete_prices.json — confirm with developer first)
- 6 docs/archive duplicates / pre-v4 files
**Effort:** S — 4 hours (batch delete + verify).
**Severity:** low (code health).

### #6. Consolidate CORE-internal duplicates
**Problem:** three small duplicates inside CORE alone:
- `prompts/master_framework.txt` ↔ `prompts/resource_calculation/master_framework.txt`
- `prompts/claude/assistant/construction_expert.txt` ↔ `stav_expert_v2.txt`
- `B3_current_prices/all_pdf_extractions.json` ⊂ `all_pdf_knowledge.json`
- `docs/STAVAGENT_CONTRACT.md` ↔ `stavagent-portal/docs/STAVAGENT_CONTRACT.md`
**Fix:** verify byte-equality; pick canonical; delete the other.
**Effort:** S — 3 hours.
**Severity:** low.

### #7. Extract 8 CORE confidence-threshold constants to `app/core/config.py`
**Problem:** A10 — 8 numeric constants scattered across 5 service files (`so_merger.py:77`, `section_extraction_engine.py:30/31/34`, `document_search_router.py:26`, `work_classifier.py:90–100`, `pricing/otskp_engine.py:56`).
**Fix:** create `confidence_thresholds.yaml` (or section in `config.py`); replace inline constants.
**Effort:** S — 4 hours.
**Severity:** low (maintainability).

### #8. Mark legacy `rowClassificationService.ts` for deletion
**Problem:** 482-line legacy v1 classifier coexists with v1.1 `rowClassifierV2.ts` (216 lines). Per repo CLAUDE.md, removal scheduled "2–3 weeks post PR1006 merge" — that window has likely passed.
**Fix:** verify v1 has no live importer beyond backward-compat checks; delete + run full test suite.
**Effort:** S — 3 hours.
**Severity:** low.

---

## P2 — Medium (variant-dependent strategic moves)

### #9. Reconcile `UNIFIED_DATA_MODEL.ts` ↔ `POSITION_INSTANCE_ARCHITECTURE.ts`
**Problem:** A12 — 496-line summary vs 868-line detailed schema, both in `docs/`.
**Fix:** keep POSITION_INSTANCE_ARCHITECTURE.ts as canonical; reduce UNIFIED_DATA_MODEL.ts to summary that re-exports from POSITION_INSTANCE.
**Effort:** S — 4 hours.
**Severity:** low (dev experience).

### #10. Move stale URS 2018 catalogs to legacy/
**Problem:** ~16 MB of 2018 CSVs (URS201801, TSP201801, CENEKON201801, TSKP_KROS_full) potentially still imported. Market prices are 7+ years old.
**Fix:** move to `URS_MATCHER_SERVICE/backend/data/legacy/` + add deprecation notice; trigger annual catalog refresh task.
**Effort:** S — 2 hours (move + deprecation).
**Severity:** medium (price accuracy).

### #11. Compress `docs/archive/completed-sessions/` to tar.gz
**Problem:** 20 session files, 260 KB, all from Jan–Feb 2026 — historical only.
**Fix:** `tar czf sessions-q1-2026.tar.gz` + delete originals. Keep last 3 uncompressed for calibration reference.
**Effort:** XS — 30 minutes.
**Severity:** low (clutter).

### #12. Decide on Variant A / B / C / D + start migration
**Problem:** without a chosen target architecture, every refactor pulls in two directions.
**Fix:** developer picks one of the four variants. Recommendation: Variant B as Phase 0 (cleanup + B2 fix) → Variant D as architectural migration.
**Effort:** depends on variant — see `11_migration_plans.md`.
**Severity:** strategic.

---

## Suggested execution order

1. **Day 1** — #1 (B2 dual-write), #2 (verify EXPOSURE values), #11 (tar.gz archive). Highest signal-to-effort.
2. **Day 2–3** — #5 (delete 21 dangling), #6 (CORE-internal dedup), #11 (compress archive).
3. **Week 2** — #3 (Frami rate), #4 (productivity verify), #7 (CORE confidence consolidation), #8 (mark v1 legacy classifier dead), #10 (URS legacy move).
4. **Week 3+** — #9 (schema reconcile), #12 (variant decision + migration kickoff).

After step 3 the repo is materially cleaner without any architectural commitment. Step 4 is where the strategic decision starts.

---

End of recommendations. Continued in `13_open_questions.md`.
