# next-session.md — Říms Calibration Phase C (kickoff)

**Last updated:** 2026-05-21
**Current branch:** `claude/rimsa-calibration-phase-a` (Phase A closed, gate GREEN)
**Production safety status:** ✅ (no freeze — Cemex CSC opens 2026-06-21)

---

## What was completed in this session (Phase A closing)

Alexandra answered 8 open questions; this session closed the gate by running the two blocking actions (Q4 + Q7) and shipping doc updates (Q1 + Q6 + Q8).

📄 New deliverables:
- `docs/audits/rimsa_fullstack/2026-05-20_phase_a_closing.md` (~200 lines — decisions + Q4 repro + Q8 finding)
- `docs/architecture/mcp_calculator_boundary.md` (~120 lines — Q7 boundary read output)
- `backlog/kb_norms_extraction.md` (Q6 Týden 3 ticket, 3-PR split for TKP 18 / ČSN EN 13670 / DIN 18218)
- `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md` (Q1 SO-250 path corrected in 2 places)
- `docs/soul.md` §9 + this `next-session.md`

### Headline findings from Q4 + Q7

**Q4 repro flipped the bug story:**
- Audit subagent claimed `curing_class` was not threaded through orchestrator → **WRONG.**
- Direct source read of `planner-orchestrator.ts:1535–1576` confirms `effectiveCuringClass` IS threaded via `getDefaultCuringClass(elementType)` to BOTH `calculateCuring` call sites.
- BUT a deeper bug surfaced: TS `CURING_DAYS_TABLE` (`maturity.ts:168–203`) and Python MCP `CURING_DAYS_TABLE` (`calculator.py:48–55`) **disagree on class 4 values** at 15-25 °C × C30+: TS=5 days, Python=9 days, task expects 9 days. Same calculation pipeline gives different answers depending on which branch fires.

**Q7 boundary clarified:**
- MCP `calculate_concrete_works` is a **soft-fallback wrapper**, not a duplicate engine.
- Primary path: HTTP POST `MONOLIT_API_URL/api/calculate` (10s timeout). Returns full TS 7-engine pipeline result. `source: monolit_planner_api`.
- Fallback path: local Python simplified calc when API unavailable. Smaller catalog tables, no concrete-group axis in curing. `source: mcp_simplified`.
- Side finding: MCP→Monolit payload **drops `exposure_class` and `curing_class`** on the wire (`calculator.py:766–786`). TS engine then auto-derives them, so the default behaviour is OK, but explicit user overrides via MCP silently disappear. Phase F item.

---

## In-progress (interrupted)

None. Phase A is fully closed. Gate GREEN.

---

## Next session priorities (Phase C)

**Branch:** `claude/rimsa-phase-c-scheduler-discrete-XXXXX`

### P0 (Phase C deliverables per task §1 + §2 + decisions Q4/Q5)

1. **Introduce `scheduler_mode` opt-in flag per element.** Add to `PlannerInput`. Default rimsa → `'discrete_cyclic'`; everything else → `'legacy'`. Wire through orchestrator + element-scheduler. Per Q5 — preserves backward compat for 22 other element types until each has its own golden fixture.

2. **Fix `CURING_DAYS_TABLE` divergence (Phase C fix #1).** Reconcile TS and Python tables. Verification source = TKP 18 §7.8.3 PDF — until KB extraction PR ships (`backlog/kb_norms_extraction.md` PR 1), inline the agreed values in both files and add a `// TODO(codegen, KB:tkp_18_rsd_2024)` marker pointing at the future YAML.

3. **Discrete-shift scheduler.** Replace `round(x*100)/100` at `element-scheduler.ts:260` with `Math.ceil(hours_per_phase_per_tact / shift_h)` returning integer shifts. Per task §1. Wire `shift_length_h` UI input (default 8, error >12 per Zákoník práce §83).

4. **Cyclic phase model for multi-tact elements.** `setup × 1 + relocate × (n-1) + strip × 1`. Last tact has no relocate. Final curing tail = 1 × curing_days on last tact only, no accumulation. Per task §2 (rimsa, operne_zdi, mostovkova_deska MSS, izolacni_stena >6 m).

5. **Crew parallelism wiring.** Confirm `crew_size_formwork`, `crew_size_rebar`, `crew_size_concrete` flow from UI through `useCalculator` → `PlannerInput` → engines. Per task §4. Read-pass first; rebar-lite already divides by crew per Phase B note, but the UI wiring may not surface the values.

### P1

6. **Open backlog tracker** for hardcoded matrices migration: `backlog/calc_hardcoded_to_kb.md` (12 sites, file:line table from Phase A §A.7.4). Do NOT migrate now — just ticket.
7. **Phase F note (do not implement in Phase C):** forward `exposure_class` + `curing_class` in MCP→Monolit HTTP payload.

### P2

8. **If Phase C green and time permits:** relocate `test-data/SO_250/tz/SO-250.md` → `test-data/tz/` AND create skeleton `golden-so250.test.ts` (Phase G work pulled forward; per Q1 the task spec is already corrected to the current path, so the move is cosmetic).

---

## Open questions for Alexandra

None blocking Phase C. Phase C should ask new questions interactively via `AskUserQuestion` per the `stavagent-claude-code-tasks` skill (5–7 pre-implementation questions, e.g. "minimum shift length floor — 1 shift even for 1-hour work, or threshold?").

---

## Production safety status

✅ No active freeze.
- Cemex CSC pre-demo window opens **2026-06-21** (+31 days).
- Helsinki Pitch Day pre-window opens **2026-11-02** (+165 days).
- No active Lemon Squeezy webhook bug.

---

## Reference for next session

- **Closing addendum** ⭐ (start here): `docs/audits/rimsa_fullstack/2026-05-20_phase_a_closing.md`
- **Main audit:** `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`
- **MCP boundary doc:** `docs/architecture/mcp_calculator_boundary.md`
- **Task spec (corrected):** `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md`
- **Backlog ticket (Q6):** `backlog/kb_norms_extraction.md`
- **Skills loaded automatically:** `.claude/skills/stavagent-session-discipline/SKILL.md`, `.claude/skills/stavagent-claude-code-tasks/SKILL.md`
- **Mantra:** `docs/STAVAGENT_ClaudeCode_Session_Mantra.md`
- **Patterns:** `docs/STAVAGENT_PATTERNS.md` (esp. #2 audit trail + #3 triangulation)
- **KB placement:** `docs/KNOWLEDGE_PLACEMENT_GUIDE.md`
