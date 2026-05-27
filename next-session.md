# next-session.md — Phase D / Phase E (post Phase C + Phase A docs ship)

**Last updated:** 2026-05-26
**Current branch:** `main` (no active feature branch — both PR #1223 and #1224 merged)
**Production safety status:** ✅ (no freeze active — Cemex CSC pre-demo window opens **2026-06-21**, +26 days)

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
