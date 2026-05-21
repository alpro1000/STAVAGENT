# next-session.md — Říms Calibration (TASK_Rimsa_Calibration_FullStack_v1)

**Last updated:** 2026-05-21
**Current branch:** `claude/bootstrap-code-skills-ecPCE`
**Production safety status:** ✅ (no active freeze — Cemex CSC window opens 2026-06-21, Helsinki Pitch Day 2026-11-02)

---

## What was completed in this session (Bootstrap)

Phase 1 audit + Phase 2 bootstrap of project-local skills + documentation infrastructure per task `docs/tasks/2026-05-20-rimsa-mcp-agent/stavagent-session-discipline-SKILL.md`.

- ✅ `.claude/skills/stavagent-session-discipline/SKILL.md` (8 rules, verbatim from upload with paths corrected to `docs/`)
- ✅ `.claude/skills/stavagent-claude-code-tasks/SKILL.md` (codified from `docs/steering/conventions.md` §9-§10)
- ✅ `.claude/skills/README.md` (directory index)
- ✅ `CLAUDE.md` (root) — appended skill reference under "Mandatory reading at session start"
- ✅ `docs/soul.md` §9 — session log entry for this bootstrap
- ✅ `next-session.md` — overwritten with current handoff (this file)

**Confirmed canonical:** existing files at `docs/STAVAGENT_ClaudeCode_Session_Mantra.md`, `docs/STAVAGENT_PATTERNS.md`, `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` stay where they are — no root duplicates created. `docs/steering/conventions.md` is canonical for process/workflow content (no separate `process.md` created).

---

## In-progress (interrupted)

None. Bootstrap session was self-contained. No PR created (per no-PR-unless-asked policy). Commits pushed to `claude/bootstrap-code-skills-ecPCE`.

---

## Next session priorities

1. **P0 — Říms calibration** — start `TASK_Rimsa_Calibration_FullStack_v1.md`. The říms calibration is the immediate trigger for this skill bootstrap.
2. **P1 — Sync `.claude/skills/` to Project Knowledge** — manual upload on claude.ai (Alexandra's action, per skill §7 weekly cadence).
3. **P2 — Optional `stavagent-schema-designer` skill migration** — if Alexandra confirms scope, codify the schema-designer rules from Project Knowledge into `.claude/skills/stavagent-schema-designer/SKILL.md`.

---

## Open questions for user

- Confirm říms calibration kicks off in next session (or different priority?)
- Should `docs/STAVAGENT_PATTERNS.md` add a new entry codifying this bootstrap pattern (skill-from-steering distillation) as pattern #8?

---

## Reference for next session

- Skill: `.claude/skills/stavagent-session-discipline/SKILL.md` (load when running any Claude Code session)
- Skill: `.claude/skills/stavagent-claude-code-tasks/SKILL.md` (load when writing tasks/specs)
- Mandatory reading: `docs/steering/{conventions,product,tech,structure,domain}.md` + `docs/soul.md`
- Patterns: `docs/STAVAGENT_PATTERNS.md` (7 Žihle-validated patterns)
- Knowledge map: `docs/KNOWLEDGE_PLACEMENT_GUIDE.md`
