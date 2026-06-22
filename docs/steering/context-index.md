# STAVAGENT — Context Index (co číst kdy)

> **Účel:** Lehký index governance/paměťové vrstvy ve **3 tirech** — NE těžký router.
> Mapuje "který artefakt → jaký tier → kdy ho číst". Vznikl z knowledge-architecture
> auditu (`docs/audits/knowledge_architecture/2026-06-06_governance_rules_memory_audit.md`, §1 + G1).
>
> **Verze:** 1.0 — 06.06.2026

---

## Tier A — Governance, čte se VŽDY (každá session)

| Artefakt | Kdy | Pozn. |
|---|---|---|
| `CLAUDE.md` (root) | Start session (auto) | Master instrukce + mandatory-reading blok + changelog |
| `docs/steering/conventions.md` | Mandatory-read #1 | Mantra, naming, gates, komunikace |
| `docs/steering/product.md` | Mandatory-read #2 | Co stavíme a pro koho |
| `docs/steering/tech.md` | Mandatory-read #3 | Stack, AI tier, infra, MCP, settings (§13) |
| `docs/steering/structure.md` | Mandatory-read #4 | **Skutečný** repo layout, kam co patří |
| `docs/steering/domain.md` | Mandatory-read #5 | Construction rules, OTSKP/ÚRS, calculator philosophy §1 (kanonická) |
| `docs/soul.md` | Mandatory-read #6 | Living memory; §2 current state, §9 session log |
| `.claude/settings.json` | Load (auto) | Permissions (allow/deny) — committed |
| `.claude/skills/*` | Auto-trigger dle keywords | session-discipline + claude-code-tasks |
| `.claude/agents/cross-user-isolation-reviewer.md` | Před změnou owned-table | Read-only security review |
| `docs/STAVAGENT_PATTERNS.md` | Před pattern prací | Master registry (last_number v hlavičce) |

**Project Knowledge sync list (claude.ai online):** viz `.claude/skills/stavagent-session-discipline/SKILL.md` §7.

---

## Tier B — Doménový kontext (per-doména / on-demand)

| Artefakt | Kdy |
|---|---|
| `docs/steering/domain.md` §2–§12 | Doménové rozhodnutí (normy, terminologie, rebar, pour crew) |
| `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` | Před přidáním KB obsahu (B0–B13, search order, 4-file layout) |
| `kb/*.yaml` + `scripts/gen-knowledge.mjs` | Změna engine tabulek (codegen → `Monolit-Planner/shared/src/kb-generated/`) |
| `concrete-agent/.../classifiers/element_rules/element_types.yaml` | Element klasifikace (Python W3 + TS engine single-source) |
| `concrete-agent/.../app/knowledge_base/B0–B13/` | Core engine runtime KB |
| `docs/normy/{tkp,navody}/` | Norm PDFs + vendor manuály (doménová data) |

---

## Tier C — Projektový kontext (per-projekt / per-task)

| Artefakt | Kdy |
|---|---|
| `next-session.md` (root) | Start session — pending blockers + open questions |
| `rozpocet-registry/next-session.md` | Registry práce |
| `docs/soul.md §9` | Session continuity (decisions/blockers) |
| `docs/tasks/TASK_*.md` | Při převzetí konkrétního tasku |
| `docs/specs/{feature}/` | Aktivní feature (req/design/tasks) |
| `docs/bugs/{id}/` | Aktivní bug (report/analyze/fix/verify) |
| `docs/audits/{topic}/` | Audit kontext / prior findings |
| `test-data/{project}/` | Pilot práce (READ-denied pro AI dle settings) |

---

## Per-service governance

| Service | CLAUDE soubor |
|---|---|
| Core (concrete-agent) | `concrete-agent/CLAUDE.md` |
| Kalkulátor | `Monolit-Planner/CLAUDE.md` |
| Portal | `stavagent-portal/CLAUDE.md` (stub → root) |
| Klasifikátor | `URS_MATCHER_SERVICE/CLAUDE.md` (stub → root) |
| Registr | `rozpocet-registry/CLAUDE.md` (stub → root + next-session.md) |

---

## Loading mechanismus — stav

- Není router/hook; loading = dobrovolné dodržení mandatory-reading bloku v `CLAUDE.md` + auto-trigger skills.
- Drift-guard governance↔realita **zatím neexistuje** (na rozdíl od `gen:knowledge:check` pro KB) — viz audit §5 + Phase 3 (po Cemex).
