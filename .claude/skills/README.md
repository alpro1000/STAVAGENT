# STAVAGENT — Claude Code Skills

Project-local skills for the STAVAGENT monorepo. These are loaded by
Claude Code when working in this repo. They are also synced into
claude.ai Project Knowledge weekly for parity between online and
offline workflows.

> **Skills vs. Project Knowledge:** Skills live in this repo and are
> versioned with the code. Project Knowledge on claude.ai is a manual
> upload of selected docs (see [`stavagent-session-discipline`](stavagent-session-discipline/SKILL.md)
> §7 for the sync list).

---

## Available skills

### `stavagent-session-discipline`

**8 правил дисциплины Alexandra** для работы с Claude Code:

1. Pre-session — wait for mantra acknowledgment
2. Post-session — verify `docs/soul.md` §9 update
3. Post-session — verify `next-session.md` handoff
4. Architectural decisions → update `docs/steering/*`
5. New project / case → update `docs/soul.md` §2
6. Branch hygiene — `claude/` prefix mandatory (Vercel overage prevention)
7. Sync to Project Knowledge weekly
8. Production safety windows (Cemex CSC, Helsinki Pitch Day, etc.)

**Триггеры:** Claude Code session, перед сессией, после сессии,
session log, soul.md, steering, sync, claude branch, Vercel overage,
production safety, next-session.md, handoff, мантра, дисциплина.

→ [`stavagent-session-discipline/SKILL.md`](stavagent-session-discipline/SKILL.md)

---

### `stavagent-claude-code-tasks`

**Правила написания заданий** для Claude Code:

- Никогда не указывай конкретные имена переменных, файлов, классов, таблиц
- Описывай бизнес-логику в plain language
- PRE-IMPLEMENTATION INTERVIEW через AskUserQuestion (5-7 вопросов)
- Acceptance criteria EARS-style + range-based (±10-15%, не exact)
- Универсальность по разделам D.1.2 / D.1.3 / D.1.4
- Cross-domain связи (Silnoproud ↔ PBŘS, ZTI ↔ Statika)
- Audit-first discipline (Phase A read-only перед Phase B+)
- Gates per commit (granularity > monolith)

**Триггеры:** задание, task, spec, requirements, design, acceptance,
criteria, naming, EARS, universalita, обор, профессия, D.1.2, D.1.3,
D.1.4, audit-first, PRE-IMPLEMENTATION INTERVIEW.

→ [`stavagent-claude-code-tasks/SKILL.md`](stavagent-claude-code-tasks/SKILL.md)

---

## How skills compose with the rest of the repo

```
Repo                                       Role
──────────────────────────────────────────────────────────────────────
CLAUDE.md (root)                           Master instructions, version,
                                           mandatory reading block
docs/steering/conventions.md               Canonical source — task
                                           writing rules §9, workflow §11
docs/steering/{tech,structure,             Architecture decisions,
  product,domain}.md                       domain rules
docs/soul.md                               Living memory (§9 = session log)
docs/STAVAGENT_ClaudeCode_Session_         Mantra (verbose form)
  Mantra.md
docs/STAVAGENT_PATTERNS.md                 7 Žihle-validated patterns
docs/KNOWLEDGE_PLACEMENT_GUIDE.md          Where to put what knowledge
docs/templates/                            Spec + bug templates
.claude/skills/ (this directory)           Skills loaded by Claude Code
next-session.md (root)                     Handoff for next session
```

Skills here are **action-oriented summaries** of the steering docs.
Steering docs are the canonical source — if something contradicts,
the steering doc wins. Edit steering, then re-distill the skill.

---

## Adding a new skill

1. Create directory `.claude/skills/<skill-name>/`
2. Add `SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: <skill-name>
   description: >-
     <description of when to use, what triggers it>
   ---
   ```
3. Update this README with a new section
4. Update [`stavagent-session-discipline`](stavagent-session-discipline/SKILL.md)
   §7 sync list if the skill should be mirrored to Project Knowledge

---

**Author:** Bootstrap session 2026-05-20.
