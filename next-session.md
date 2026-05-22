# next-session.md — Říms Calibration Phase C (post-audit)

**Last updated:** 2026-05-21
**Current branch:** `claude/rimsa-calibration-phase-a`
**Production safety status:** ✅ (no freeze active — Cemex CSC opens 2026-06-21)

---

## What was completed in this session (Phase A)

Read-only audit of the entire říms workflow per `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md`. Single deliverable:

📄 **`docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`** (~400 lines)

Covers:
- **A.1** — Core Engine + MCP endpoints inventory (~35 surfaces across 5 services)
- **A.2** — Golden test inventory in `test-data/tz/` (SO-202, SO-203, SO-207, VP4-FORESTINA present; SO-250 misfiled at `test-data/SO_250/tz/`; SO-206 missing)
- **A.3** — UI component inventory (`CalculatorFormFields.tsx`, `useCalculator.ts`, `helpers.ts`, `element-classifier.ts`, `planner-orchestrator.ts`)
- **A.5** — Test inventory (Vitest shared, pytest concrete-agent, other repos)
- **A.6** — Field visibility audit per `element_type=rimsa` (✅/⚠️/❌/🔄/💀 classification per field)
- **A.7** — KB inventory (`B0`–`B13` bucket map + 12-row hardcoded-matrix table with file:line)
- **B** — Architecture analysis (DRY violations, scheduler shape, blast radius per element type)

Plus method changes for next sessions:
- Bootstrap done in prior session (skills + discipline infra in `.claude/skills/`)
- Audit synthesised from 5 parallel `Explore` subagents; pattern works for breadth-first audits

---

## Headline findings (full list in audit doc)

1. **3 independent sources of truth for rimsa values** (Python MCP `classifier.py`, TS `element-classifier.ts`, B4 YAML stubs). Rebar ratio diverges 130 vs 120 vs (task target 140). Difficulty 1.4 vs 1.15.
2. **Curing-class wiring bug suspected** — `DEFAULT_CURING_CLASS[rimsa]=4` is defined but `planner-orchestrator.ts:1652` does not thread the class to `getCuringDaysFor()`. Likely cause of ~5 d vs expected 9 d @ 15 °C for rimsa. **Needs 15-min direct repro before Phase C.**
3. **UI unit mismatch** — UI exposes `formwork_area_m2`; T-bednění is priced/rated in `bm`. Missing `length_per_rimsa_bm`, `cycle_length_bm`, `cross_section_*` widgets. `rental_czk_override` label is wrong unit.
4. **KB YAML missing for rimsa** — `B4_production_benchmarks/default_ceilings/rimsa.yaml`, `B5_tech_cards/formwork_vendor/doka_2024/T_bedneni.yaml`, `B7_regulations/tkp_18_rsd_2024/extracted.yaml` all absent.
5. **Scheduler refactor blast radius** — HIGH-risk for `mostovkova_deska` (MSS coupling), `stena`, `sloup`, `stropni_deska`; gated rollout recommended.
6. **No SO-250 Vitest fixture, no SO-206 fixture** — primary říms validation cases are markdown-only.
7. **MCP/Monolit boundary uncertain** — could not conclusively determine whether `mcp/tools/calculator.py` HTTP-forwards or computes locally.

---

## Open questions for Alexandra (block Phase C)

All 8 in audit §"Open questions". Headline 5:
- **Q1:** SO-250 path — relocate `test-data/SO_250/tz/SO-250.md` into `test-data/tz/`, or update task path?
- **Q3:** Single source of truth resolution for Phase C — (a) Python MCP wins, (b) TS catalog wins, (c) B4 YAML wins with CI drift check
- **Q4:** Curing-class bug — direct repro before Phase C, or trust subagent?
- **Q5:** Scheduler refactor — opt-in flag per element, or one clean refactor?
- **Q7:** 30-min directed read of `mcp/tools/calculator.py` to settle MCP/Monolit boundary?

---

## In-progress (interrupted)

None. Audit is self-contained. Branch pushed but not PR'd.

---

## Next session priorities

1. **P0** — Alexandra reviews audit, answers 8 open questions
2. **P0** — If Q4 answered "repro first": 15-min Vitest probe on `getCuringDaysFor(rimsa, …)` to confirm/deny the wiring bug
3. **P0** — Phase C kickoff per task spec §1 + §2: discrete shift scheduler + cyclic phase model for multi-tact elements. Branch: `claude/rimsa-phase-c-scheduler-XXXXX`
4. **P1** — Open `backlog/calc_hardcoded_to_kb.md` tracking issue for the 12 hardcoded matrices identified in §A.7.4 (do NOT migrate, just ticket)
5. **P2** — If Q1 = "relocate SO-250": move file + create skeleton Vitest fixture `golden-so250.test.ts` (only if Phase C green)

---

## Production safety status

✅ No active freeze.
- Cemex CSC pre-demo window opens **2026-06-21** (currently +31 days).
- Helsinki Pitch Day Pitch Day pre-window opens **2026-11-02** (+165 days).
- No active Lemon Squeezy webhook bug.

---

## Reference for next session

- **Audit:** `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md` ← start here
- **Task spec:** `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md`
- **Skills loaded automatically:** `.claude/skills/stavagent-session-discipline/SKILL.md`, `.claude/skills/stavagent-claude-code-tasks/SKILL.md`
- **Mantra:** `docs/STAVAGENT_ClaudeCode_Session_Mantra.md`
- **Patterns:** `docs/STAVAGENT_PATTERNS.md` (8 codified, esp. #2 audit trail + #3 triangulation)
- **KB placement:** `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` (for Phase D when YAML stubs created)
