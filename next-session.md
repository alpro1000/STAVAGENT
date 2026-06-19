# next-session.md

**Last updated:** 2026-06-19
**Current branch:** `claude/phase5-steps1-2-handoff-p0og0u`
**Production safety status:** ✅ (no freeze active — Cemex CSC pre-demo window opens **2026-06-21**, +6 days)

---

## 🧭 RETRIEVAL MARATHON — PAUSED 2026-06-19 (freeze 21.06 LIFTED · token limit)

Phase-1 catalog retrieval (`find_otskp_code`) debugged across this marathon. Merged & live:
Fix1 #1364 (soft class-prefilter), Fix2 #1366 (family-match rank bonus), **#1390** (revert of
#1367 class-strip **+** query-time diagnostic log — C30/37 catalog-class restored to PASS;
**do NOT revert #1390**), **#1389** = this памятка. All MCP-compat green.

### 🔴 BLOCKER — root cause NOT found (paused, GATED)
**Symptom:** `beton mostních pilířů` (any class) → prod `find_otskp_code` returns ~24 tunnels
(36xxx); `_search` (the single embeddings path) logs piers (33432). Pier-vs-tunnel flips between
moments for the *same string*.

**Narrowed to ONE leading hypothesis — `embed_query` non-deterministic BETWEEN calls:**
- embed is **deterministic WITHIN a process**: two `embed_query` of the same text in one process →
  **identical vector** (hash `cddcea03a655`).
- but BETWEEN separate runs the `_SEARCH_SQL` result jumps: `vec_test2.py` → **TUNNELS** (36250,
  sim 0.784); `final_test.py` a minute later → **PIERS** (33432, sim 0.829). Same text, same SQL,
  same DB, same operator.

**EXCLUDED (all recon-proven, do not re-litigate):**
- **region** — `cosine(us,eu)=1.0` (2-region test).
- **strip / #1367** — bare query also fails; strip is a no-op → exonerated; now reverted (#1390).
- **re-embed** — corpus vectors healthy (piers top on direct cosine).
- **traffic-split** — both behaviours observed on a single revision (00421).
- **SQL operator / index** — `<=>`, `<#>`, `<->` all return piers.
- **code-path** — single `_search`, no 2nd embeddings site, no cache (grep-confirmed).

**NEXT STEP (NOT done):** run `hash_test.py` **3× consecutively**. If the vector hash changes
between runs → `embed_query` flickers = ROOT. If it stays constant → mechanism is downstream of
embed, re-open. **Root fix is GATED on this result — do NOT implement speculatively.**

### 🟡 Calendar — RESOLVED
`google-cloud-aiplatform==1.154.0` **already pinned** on main (requirements.txt:35; ships
`vertexai.*`; safe through 24.06 vertexai removal). No PR needed.

### 🟢 Next session (freeze 21.06 LIFTED)
- **BLOCKER first** — `hash_test.py` 3× → confirm/deny embed flicker → then (and only then) root fix.
- **Fix 3** — keyword `ORDER BY cena → relevance` + hardcoded `source:"OTSKP 1/2025"` → real `catalog_version`.
- **Fix 4** — rebake `otskp.db` → 2026 (version split: keyword 2025/17904 vs embeddings 2026/17940).
- **SO250 manual breakdown E2E** — demo-path insurance.
- **Phase 2 (MCP, short)** — carrier-shape `find_urs_code`, counts → 17 940, fix docstring example code.
- **Removed from scope this session:** freeze 21.06 (lifted), clean-`název` re-embed (vectors fine),
  DeepSeek from the ladder.

### ⚪ Post-Cemex
- **Phase 3** kiosk→thin: drop UI model selector; ladder Vertex(Gemini)→Bedrock(Claude), DeepSeek out;
  remove subsystem 4 (6-role); learned-mappings → Core (human-confirm 0.99 only); ÚRS BYOK (3 tiers).
- **SDK migration** `vertexai`→`google-genai` + `gemini-embedding-001` (late June, Friday-call). Clean-`název`
  re-embed rides this pass IF decided (currently OFF — vectors are fine).
- **Alembic debt** — reconcile startup raw-SQL vs Alembic journal.
- **Embeddings/Gemini region decoupling** — `vertexai.init` is process-global. (NOT the blocker root — region excluded via `cosine(us,eu)=1.0`; tracked separately as hygiene.)

---

## 🟢 ACTIVE — Fáze 5 Step 3 (calculator legacy/dead-field cleanup) — PR1+PR2 READY, čeká merge+live

**Větev:** `claude/phase5-steps1-2-handoff-p0og0u` (Step 1 #1353 + Step 2 #1357 už v main).
**Handoff:** `docs/handoff/2026-06-14_phase5-step3-next-session.md` · **recon:** `docs/audits/calculator_field_map/2026-06-13_recon.md` · plný stav `docs/soul.md §9` (2026-06-15).

**Hotové a zelené na větvi (NEsmergováno — merge calc PR = Alexander, po jednom):**
- **PR1** (dead-code): smazány `price_crane_czk_shift`+`price_pump_czk_h` (přišelci → TOV) + orphan `tact_volume_m3_override`.
- **PR2** (orphan + redirect + bugfix): smazán orphan `CalculatorWizard.tsx` (692 ř., 0 importérů); advisor + WizardHints redirect na live dilataci (`has_dilatation_joints`/`dilatation_spacing_m`); **FIX silent tact-loss** (apply-recommended psal mrtvý `num_tacts_override` → teď mapuje N=total záběry přes shared `tactsPerSectionForRecommendedTotal`); smazána legacy FormState pole `tact_mode`/`has_dilatacni_spary`/`spara_spacing_m`/`num_tacts_override`+`TactMode`; nový shared helper + 5 testů (N invariant). **shared 1322 / frontend tsc clean.**
- **KEEP (přeřazeno, NEsmazáno):** `rebar_norm_kg_m3`, `include_kridla`/`kridla_height_m` — živé (engine pole / render karta), ne přišelci.

**Alexander akce:** review grep-důkazů → merge po jednom PR → **live-check advisor/WizardHints na kalkulator.stavagent.cz** (PENDING — mění živé AI; nepovažovat za hotové bez webu).
**Dál (až po live PR2):** PR3 low-risk cleanup (duplicitní smart-defaults `useCalculator.ts:244-264`+`:712-738`; fyzický dedup duplicitních length-polí) → **multiplicity-redesign** (`num_identical_elements`⊥`num_dilatation_sections`⊥`manual_zabery` → list elementů Step 1) jako SAMOSTATNÉ interview → **Step 3.5** degradation class. **NEzačínat Step 4 před merge Step 3.**
**Flag:** handoff odkazuje `Monolit-Planner/CLAUDE.md §0` (architektura cen 3 režimy) — sekce NEEXISTUJE; doplnit nebo opravit odkaz.

---

## 🔵 ACTIVE TASK — Classifier Kiosk Full Fix (Frontend + MCP + Backend)

**Where we are:** Phase 0 recon DONE · §2 interview DONE · **Phase 1 (1a+1b) MERGED** (#1343,
CI green `487 passed`) · **startup-wiring follow-up MERGED** (#1344) · **ops-hardening MERGED**
(#1354: migration id ≤32, ingest sys.path/local-path/retry, token-aware batching, embed retry,
landing 17 940 · OTSKP 2026). **Phase 2 is GATED on the live #4 proof** (user decision 2026-06-13).

**NEXT (user-driven ops — Phase 2 does NOT start until this passes):**
1. Cloud Build auto-redeploys Core on the #1354 merge. After any force rebuild: restore VPC
   connector + REDIS_URL.
2. Re-run ingest with the fixes (runbook recon §8.4): `alembic -c ../../alembic.ini upgrade head`
   (stamp `orch_sg_pr3b_audit` first if the DB pre-dates Alembic) → ingest `--index` (now token-safe).
3. Live MCP probe `beton mostních pilířů C35/45`: pier-concrete code top-N, honest confidence,
   `obklad`/`přechod desky` filtered = **acceptance #4 proven** → THEN Phase 2.

**Phase 2 (when unblocked):** make `find_urs_code` + siblings return the carrier shape
(candidates+confidence+provenance, honest-blank, confidence ladder — AC#8); fix the `113472111`
docstring example with a **verified** 2026 OTSKP code (deferred to live catalog — user decision);
update MCP tool-desc counts 17 904 → 17 940; rebake `otskp.db` to 2026 (exact-lookup prices).

**Phase 3:** kiosk→thin migration · learned-mappings Core table (human-confirm 0.99, #11) ·
ÚRS BYOK 3-tier seam (#12 + BYOK scope, recon §8.5). **Post-Cemex debt:** startup-SQL↔Alembic align.
**Before 21.06:** 1× manual SO250 breakdown E2E (demo-path insurance on the new code).

**Recon report:** `docs/audits/classifier_kiosk_fullfix/2026-06-11_phase0_recon.md`
(updated with corrections 1–3 + model verification + acceptance #11/#12).
**Task file:** `TASK_Classifier_Kiosk_FullFix_Frontend_MCP_Backend_1.md` (uploaded)

**Interview decisions:** merge-per-CI (land before ~21.06) · pgvector in Cloud SQL ·
migrate kiosk engine to Core (Phase 3) · keep subsystem 3 / remove subsystem 4.
**Corrections (user, before Phase 1):** (1) learned-mappings migrate to Core, human-confirm
0.99 ONLY, no AI auto-learn (acceptance #11); (2) local ÚRS ~39K — migrate to Core fallback
or record web-only, never silent (acceptance #12); (3) **gecko@003 RETIRED 2025-05-24** →
use **gemini-embedding-001 @ output_dimensionality=768**, pgvector cosine, `EMBEDDING_DIM` const.

**Phase 1a DONE (this branch):** `app/services/catalog_matching.py` — work-type axis +
UWO gate + param prefilter + honest confidence (keyword ≤0.9, embeddings 0.70–0.80, never
1.0) + pluggable audited/replayable ranking seam + embeddings retrieve seam
(`_EMBEDDINGS_PROVIDER`, monkeypatchable). `find_otskp_code` fulltext path rewired through
the chain; exact code lookup stays 1.0. `tests/test_catalog_matching.py` (19 hermetic, green).
NB: MCP compat suite unrunnable locally (no `fastmcp` — Debian PyJWT blocks install) → confirm on CI.

**Phase 1b DONE (code, this branch):**
- `vertex_embeddings.py` rewritten → **text-multilingual-embedding-002 @ 768** (gecko@003
  RETIRED 2025-05-24; gemini-embedding-001@768 = post-google-genai upgrade, same dim).
  SDK reason: repo only has vertexai (removed 2026-06-24) — don't build on a new SDK mid-freeze.
- `EMBEDDING_MODEL`/`EMBEDDING_DIM`/`OTSKP_CATALOG_VERSION`/`CATALOG_GCS_BUCKET` in config.py.
- Alembic `2026_06_11_otskp_embeddings_pgvector` (down=orch_sg_pr3b_audit): `CREATE EXTENSION
  vector` + `otskp_embeddings(code,popis,unit,price,embedding vector(EMBEDDING_DIM))` HNSW cosine.
- `app/services/catalog_embeddings.py`: pgvector provider + `register_embeddings_provider()`.
- `scripts/ingest_otskp_catalog.py`: GCS SFDI XML → otskp.db (+ `--index` pgvector). XML not committed.
- `tests/test_catalog_embeddings.py` (8 hermetic). Data Store answer: **separate bucket
  `gs://stavagent-catalogs`** (norms bucket is whole-bucket console-synced, no prefix filter).

**Ops/deploy (runbook §8.4 in recon doc):** create catalogs bucket + upload SFDI XML →
`alembic upgrade head` → run ingestion `--index` → call `register_embeddings_provider()` at
startup → confirm CI green. **CI to confirm:** MCP compat (no local fastmcp) + goldens SO250/SO202.

**Deferred:** learned-mappings Core table + human-confirm-0.99 (acceptance #11, lands Phase 3
w/ kiosk migration) · local ÚRS-2018 fallback 0.60–0.65 + "ověřit…" UI flag (acceptance #12,
Phase 3) · **Phase 2:** fix `find_otskp_code` docstring example `113472111` (malformed 9-digit;
real OTSKP codes are 6-char) → verified code.

---

## What was completed (Týden 3 + Phase C + Phase A docs, all merged)

Three PRs landed atomically across two sessions:

**PR #1223 — Týden 3 KB codegen + Phase C Rimsa scheduler (consolidated)** ✅ merged

**Týden 3 Knowledge Integration top-5:**

📄 `docs/specs/knowledge-codegen-pipeline/{requirements,design,tasks}.md`
📄 `docs/architecture/knowledge_codegen_pipeline.md` (1-page reference)
🛠 `scripts/gen-knowledge.mjs` (codegen tool, ~350 LOC)
📁 `kb/` (5 YAML sources: tkp18_maturity, ucebnice_mostu_pour, doka_frami_catalog, lateral_pressure, urs_otskp_routing)
📁 `Monolit-Planner/shared/src/kb-generated/` (5 generated TS + index + 38 round-trip tests)
🔌 Engine wire-ups: `maturity.ts`, `lateral-pressure.ts`, `formwork-systems.ts` import from KB
✅ CI drift check wired into `.github/workflows/monolit-planner-ci.yml`

**Phase C Rimsa Calibration (G0–G6 + G-final):**

📄 G1 calibration: `kb/tkp18_maturity.yaml` `C30+ × class 4` row → `[30, 18, 13, 9, 5]` (cold→hot)
🛠 G2 + G3: `SchedulerMode`, `SCHEDULER_MODE_DEFAULTS`, `getSchedulerMode()`, `toShifts()`, `scheduleCyclic()` in `element-scheduler.ts`
🔌 G4: orchestrator threads `scheduler_mode` + T-bednění productivity (h/bm × bm)
🧪 G5: 23 new cyclic tests in `scheduler-cyclic.test.ts`
📄 G6: `backlog/calc_hardcoded_to_kb.md` + `docs/architecture/mcp_calculator_boundary.md`

**Test count: 1136 baseline → 1197 (+61).** All green; tsc clean; codegen drift check clean.

**PR #1224 — Phase A Rimsa audit + Claude Code skills infrastructure + KB backlog** ✅ merged

📁 `.claude/skills/{stavagent-session-discipline, stavagent-claude-code-tasks}/SKILL.md` + README
📄 `docs/audits/rimsa_fullstack/2026-05-20_phase_a_{discovery,closing}.md` (audit + decisions log, 8 questions answered)
📄 `backlog/kb_norms_extraction.md` (Týden 3 norm extraction queued: TKP18 + ČSN EN 13670 + DIN 18218)
📄 `docs/architecture/mcp_calculator_boundary.md` (initial; PR #1223 G6 expanded with Gap 1 fix snippet)
🔧 `.gitignore` carve-out: `.claude/*` ignored, `!.claude/skills/` tracked
🔧 `CLAUDE.md` mandatory-reading block updated with skills reference

---

## Headline impact

1. **rimsa @ 15°C now returns 9d curing** (was 5d) — Phase A finding #2 closed via G1 + G3 wiring. Single source of truth for curing tables is `kb/tkp18_maturity.yaml`.
2. **Cyclic scheduler is rimsa-only**; mostovkova_deska and 21 others keep legacy DAG. Mode dispatch via `SCHEDULER_MODE_DEFAULTS` is the lever for future per-element opt-in.
3. **5 of 13 hardcoded matrices migrated** to kb/ pipeline (CURING_DAYS_TABLE, DEFAULT_CURING_CLASS, getConsistencyKFactor, FORMWORK_SYSTEMS-DOKA, plus pour sequences). 8 remain — tracked in `backlog/calc_hardcoded_to_kb.md`.
4. **MCP→Monolit silent drop of exposure_class + curing_class** documented at `docs/architecture/mcp_calculator_boundary.md`. P2 post-CSC fix (2 lines + Vitest).
5. **`.claude/skills/` infrastructure** loads automatically in every Claude Code session opening the repo — session-discipline + task-writing rules now project-versioned, not just Project Knowledge.

---

## Open questions for Alexandra (block Phase D)

- **Q1 — rimsa end-to-end behavior validation.** Before Phase C: cyclic mode was inactive; rimsa scheduled via legacy DAG with the buggy 5d curing. After: cyclic mode active with 9d cure. **The actual computed day count for rimsa has shifted.** Existing element-audit smoke test passes (output shape OK) but no SO-250 / SO-206 Vitest fixture asserts specific day counts. **Should we add a `golden-rimsa.test.ts` with reference values from DOKA nabídka 540045359 first, or skip the golden + accept legacy-vs-cyclic drift as expected behavior?**
- **Q2 — Cold-end calibration aggressiveness.** Phase C G1 raised `C30+ × class 4` cold-end values significantly (e.g. `-5..5°C` band: 14d → 30d). Spec said "match production Python MCP" — but Python MCP source PDF reference is **TKP 18 06/2025** which isn't fully extracted into the YAML citation. Should we verify against the PDF independently (~30 min direct read), or trust spec?
- **Q3 — DOKA Frami catalog completeness.** 10 DOKA entries migrated to YAML. PERI/ULMA/NOE/traditional formwork systems still inline in `formwork-systems.ts`. Open separate Wave 2 PR (`kb/peri_catalog.yaml`)?
- **Q4 — `kb/` schema versioning.** Each YAML carries `source_citation:` block but no `schema_version:` field. If we ever rename a key, generated TS breaks at codegen → CI catches but no migration path. Add version field now (cheap insurance) or wait for first break?
- **Q5 — Python kb_generated parity.** Týden 3 explicitly TS-only (no Core consumer today). If Phase D adds a `/api/curing-table` REST endpoint that Core needs to honor, Python codegen becomes necessary. Pre-emptive design now or defer?

---

## Next session priorities

### Option A — Phase D (T-bednění productivity calibration, **P0 if rimsa golden test desired**)

1. **P0** — Open `golden-rimsa.test.ts` Vitest fixture with reference values from DOKA nabídka č. 540045359 (SO 206 mostovka). 4-6 test cases: n=4 záběry / n=8 / variable shift_h / variable num_rebar_crews. Anchor expected days from real-world cornice work.
2. **P0** — Calibrate `relocate_h_per_bm` per system. Current scheduler heuristic is 0.5 × setup; real T-bednění Vozík TU relocate is closer to 0.3 × setup (per DOKA TI). Add `relocate_h_per_bm` to `kb/doka_frami_catalog.yaml`; thread through orchestrator G4.
3. **P1** — Open `kb/peri_catalog.yaml` (~17 PERI entries from `formwork-systems.ts`); regenerate. Counterpart to DOKA migration.
4. **P2** — MCP boundary fix (Gap 1 from `mcp_calculator_boundary.md`) post-CSC. 2-line payload extension + 1 Vitest case.

### Option B — Phase E (UI cross-section + length_per_rimsa_bm widget, **P0 if rimsa UX takes priority**)

1. **P0** — Add `length_per_rimsa_bm` + `cycle_length_bm` + `cross_section_width_m` + `cross_section_height_m` widgets to `CalculatorFormFields.tsx` per Phase A §A.6 audit (rimsa field visibility classification).
2. **P0** — Fix UI unit mismatch: `formwork_area_m2` widget label is wrong for T-bednění (unit=bm). Add per-system unit-aware label rendering.
3. **P1** — Wire `cycle_length_bm` → `formwork_area_m2` mapping in `useCalculator` hook so cyclic productivity passes correctly to backend.

### Option C — Wave 2 KB migration (8 remaining hardcoded matrices)

Per `backlog/calc_hardcoded_to_kb.md`. Estimated 3-5 dev days total. Sub-steerage decisions (per-element vs monolithic YAML granularity) need 1-hour design session first.

---

## In-progress (interrupted)

None. All work merged. `main` is clean; no active feature branch.

---

## Production safety status

✅ No active freeze.
- Cemex CSC pre-demo window opens **2026-06-21** (+26 days from today).
- No active Lemon Squeezy webhook bug.
- Týden 3 codegen pipeline: zero runtime cost (build-time only); no production behavior change beyond the rimsa curing recalibration (intended).

---

## Reference for next session

- **Skills loaded automatically:** `.claude/skills/stavagent-session-discipline/SKILL.md` + `.claude/skills/stavagent-claude-code-tasks/SKILL.md`
- **Phase A audit:** `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`
- **Phase A closing decisions:** `docs/audits/rimsa_fullstack/2026-05-20_phase_a_closing.md`
- **Phase C closing entry:** `docs/soul.md` §9 (top entry — 2026-05-26 Phase C closing)
- **Codegen architecture:** `docs/architecture/knowledge_codegen_pipeline.md`
- **MCP→Monolit contract:** `docs/architecture/mcp_calculator_boundary.md`
- **Hardcoded matrix backlog:** `backlog/calc_hardcoded_to_kb.md`
- **Norm extraction backlog:** `backlog/kb_norms_extraction.md`
- **Branch:** start from `main` (PRs #1223 + #1224 both merged)
