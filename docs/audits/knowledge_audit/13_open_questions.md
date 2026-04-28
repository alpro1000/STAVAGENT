# Gate 6 — Open questions for the developer

Items where the audit hit ambiguity that only a human can resolve.

---

## Q1. The 5 externally-promised artefacts — were they ever produced?

The task appendix lists 5 documents created in earlier (chat-only) sessions:
- `STAVAGENT_klasifikator_betonovych_elementu.md`
- `B3_common.md` + `B3_common.yaml`
- `TTK_walls_extracted.yaml`
- `bibliography_concrete_construction.md`
- `TASK_NormsAudit_MonolitPlanner_CoreEngine.md`

**None are present in the repo.** Were they:
(a) produced and kept in local notes, never committed?
(b) produced and intentionally not added to STAVAGENT?
(c) never finalised — only conceptual?

**Why it matters:** if (a) or (b), they are valuable inputs to Variant D Phase 2 (bulk extraction). If (c), they need authoring during the migration.

---

## Q2. B5–B8 empty stubs — delete or repopulate?

`knowledge_base/B5_tech_cards/`, `B6_research_papers/`, `B7_regulations/`, `B8_company_specific/` each have a 9-line metadata stub and no content. Were they:
(a) namespace placeholders for content that never landed?
(b) accidentally committed without their data?
(c) deprecated buckets that should be removed?

**Recommendation if (a) or (c):** delete the 4 stubs. If (b), restore the data.

---

## Q3. Workflow B status — is GPT-4 Vision still alive?

Three CORE prompts (`generate_from_drawings.txt`, `scan_construction_drawings.txt`, `analyze_technical_drawings.txt`) have no live importer. Are they:
(a) still wired up via dynamic loading not detectable by grep?
(b) dead code from an abandoned Workflow B / GPT-4 Vision attempt?

**Why it matters:** if (b), `mark_legacy` → eventual delete. If (a), document the dynamic load path.

---

## Q4. `concrete_prices.json` in Registry — placeholder or orphan?

`rozpocet-registry/src/data/concrete_prices.json` exists but no grep importer found. Is it:
(a) a placeholder for the planned "catalog price" feature in `next-session.md` §2?
(b) an experimental file that was never wired up and should be deleted?

---

## Q5. URS 2018 CSVs — still actively used?

The 4 stale 2018-01 CSVs in `URS_MATCHER_SERVICE/backend/data/` (URS201801, TSP201801, CENEKON201801, TSKP_KROS_full — total 15.9 MB) have import scripts but no clear runtime call site found. Are:
(a) the import scripts run on a cron / deploy hook?
(b) the data already migrated to SQLite catalog DBs and CSVs are now archive-only?

---

## Q6. `MONOLIT_REGISTRY_INTEGRATION.md` references a non-existent file

The doc references `docs/ROW_CLASSIFICATION_ALGORITHM.md`, but that file does **not** exist at that path. The actual v1.1 spec lives at `rozpocet-registry/docs/ROW_CLASSIFICATION_ALGORITHM.md`. Should we:
(a) fix the reference in MONOLIT_REGISTRY_INTEGRATION.md to point to the rozpocet-registry path?
(b) move the algorithm spec to the docs/ root (since it spans both Monolit and Registry)?

---

## Q7. Two `STAVAGENT_CONTRACT.md` files — fork or mirror?

`docs/STAVAGENT_CONTRACT.md` (18 KB) and `stavagent-portal/docs/STAVAGENT_CONTRACT.md` (18 KB) — both exist with same name. Are they:
(a) byte-identical mirrors (delete one, symlink or remove)?
(b) divergent forks (need reconciliation)?

---

## Q8. `coreAPI.js` (Monolit) and `concreteAgentClient.js` (Portal) — should they merge?

Both are HTTP clients to CORE, each with own retry / timeout / auth logic. Could they converge to a shared `@stavagent/core-client` npm package?

**Trade-off:** shared package adds a workspace boundary; separate copies stay easy but drift on auth/retry conventions.

---

## Q9. Variant choice — A / B / C / D ?

The audit recommends **Variant B Phase 0 → Variant D**. But the developer may have constraints (time budget, deploy cadence, team size) that change the calculus. Confirm:

(a) accept the recommendation (start Phase 0 immediately, plan D for Q3 2026)?
(b) start with Variant B only and decide later about D?
(c) start directly with Variant D (skip Phase 0)?
(d) defer everything (do nothing, accept current drift)?

---

## Q10. Are Variant D-style codegen artefacts acceptable in PR review?

Variant D requires committing both the YAML source and the generated kiosk artefacts. PR review will see "extra noise" of generated files alongside source changes. Acceptable trade-off, or block?

**Mitigation if acceptable:** `.gitattributes linguist-generated=true` hides generated files in PR diffs by default; verify hook prevents drift.

---

## Q11. Catalog refresh cadence

Stale 2018 catalogs + 2024 vendor catalogs + 2026 productivity rates show no consistent refresh schedule. Should the team adopt:
(a) annual catalog refresh as a calendared task?
(b) per-catalog cadence (vendor catalogs quarterly, ČSN/TKP on amendment)?
(c) status quo (refresh when something breaks)?

---

End of open questions. Final summary in `99_summary.md`.
