# docs/

Documentation, domain knowledge, and historical archives.

## Layout

```
docs/
├── ARCHITECTURE.md          — Top-level system architecture
├── *.md (43 files)          — Setup guides, integration notes, reference docs
├── normy/                   — Czech construction standards (read-only)
│   ├── tkp/                 — TKP01..TKP33 ČSN PDFs (~60 MB)
│   └── navody/              — Supplier prospekty + návody (DOKA, etc.)
└── archive/                 — Historical artifacts, post-mortems, planning notes
    ├── analyses/            — Audit reports + deep-dive analyses
    ├── completed-fixes/     — Closed bug investigations + patch notes
    ├── completed-projects/  — Finished feature/project notes
    ├── completed-sessions/  — Per-session handoff summaries
    ├── future-planning/     — Backlog, TASK_*, PLAN_* (not yet executed)
    └── legacy/              — Stale docs superseded or no longer relevant
```

## Active vs. archived

If a file is here, it is either:
- **Active reference** (top of `docs/`, e.g. `ARCHITECTURE.md`, `DEPLOYMENT.md`)
- **Domain knowledge** (`normy/` — input for the AI pipeline)
- **Historical record** (`archive/` — kept for context, not maintained)

For current state of the system, see `/CLAUDE.md` at the repo root.
