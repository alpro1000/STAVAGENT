# Knowledge Architecture Audit — Governance · Rules · Memory

**Date:** 2026-06-06
**Branch:** `claude/audit-knowledge-architecture-yszXJ`
**Mode:** **Phase 1 — read-only.** Zero modifications outside this audit file. No governance changed. No product code touched.
**Author:** Claude Code (audit-first discipline, per `docs/steering/conventions.md §6`)

> **Remediation status (2026-06-06):** Phase 0 (P0: C1/C5/C6), Phase 1 (P1: C2/C3/C4/C7/C8/C9/C10/D1 + domain.md path) and Phase 2 (P2: archive 14 dead logs, governance context-index, per-service CLAUDE stubs, vision-doc dedup banner) **applied** on this branch — see commits `FIX(governance): …`. Phase 3 (drift-guard + steering update trigger + SessionStart decision) **deferred to post-Cemex** per maintainer. This document remains the point-in-time findings record; §3/§4 describe the pre-fix state.

---

## 0. Scope & relationship to prior audits

This audit covers the **AI-instruction / governance / rules / memory architecture** — i.e. everything an AI tool (Claude Code, claude.ai online) *reads for context* in order to know how to work on STAVAGENT. It is a **different axis** from two prior audits, which it cross-references rather than duplicates:

| Prior audit | Axis | This audit's relation |
|---|---|---|
| `docs/audits/knowledge_audit/` (2026-04-26) | **Domain knowledge** — ČSN/TKP norms, OTSKP/ÚRS catalogs, hardcoded engine constants → single-source KB | Out of scope here. The construction-domain KB is healthy (see §1-B). |
| `docs/handoff/2026-05-19-docs-audit-findings.md` | **Docs file-structure** — orphaned files, misnested folders, migration map | Builds on it; several of its open items are still open and re-confirmed below. |
| **This audit** | **Governance / rules / memory** — what AI auto-reads as instructions, how consistent it is, how it's loaded | — |

**Scope decision (recorded, not asked):** "Governance" = the set of artefacts that are read *as instructions about how to work*, automatically or by documented protocol. That is the always-on tier (CLAUDE.md family, `.claude/`, steering) plus the memory/handoff layer and the task/spec layer that sessions are told to consult. Pure product code, CI YAML, and raw norm PDFs are treated as *context sources referenced by* governance, not governance itself. This boundary is unambiguous enough that no clarifying question was raised; if the maintainer wants a narrower/wider boundary, Phase 2 adjusts trivially.

---

## 1. Knowledge map — three tiers

### Tier A — Governance read **always** (every session, every service)

| Artefact | Path | Size | Read when | Status |
|---|---|---|---|---|
| Root master instructions | `CLAUDE.md` | 576 ln / 113 KB | Every Claude Code session (auto) + claude.ai PK | ⚠️ over own 300-ln limit; changelog carries PR numbers it forbids |
| Conventions steering | `docs/steering/conventions.md` | 316 ln | Mandatory-read #1 | ✅ accurate, but frozen v1.0 19.05.2026 |
| Product steering | `docs/steering/product.md` | ~300 ln | Mandatory-read #2 | ✅ (not re-verified for drift) |
| Tech steering | `docs/steering/tech.md` | 332 ln | Mandatory-read #3 | ❌ multiple contradictions vs reality (§3) |
| Structure steering | `docs/steering/structure.md` | 269 ln | Mandatory-read #4 | ❌ describes a repo layout that does not exist (§3, C1) |
| Domain steering | `docs/steering/domain.md` | 368 ln | Mandatory-read #5 | ✅ canonical, self-declared conflict-winner |
| Living memory | `docs/soul.md` | 1710 ln / 143 KB | Mandatory-read #6 (header: "read at start of every session") | ⚠️ §2 snapshot stale; §9 entries oversized (§4) |
| Permissions | `.claude/settings.json` | 28 ln | Claude Code load (auto, enforced) | ⚠️ only `permissions`; the `env`/`effort` block documented in 2 places is absent (§3, C5) |
| Skill: session discipline | `.claude/skills/stavagent-session-discipline/SKILL.md` | 225 ln | Auto-triggered by keywords (session/мантра/soul/handoff…) | ✅ |
| Skill: task writing | `.claude/skills/stavagent-claude-code-tasks/SKILL.md` | 401 ln | Auto-triggered by keywords (task/spec/EARS/audit-first…) | ✅ |
| Skills index | `.claude/skills/README.md` | 104 ln | Reference | ✅ |
| Agent: isolation reviewer | `.claude/agents/cross-user-isolation-reviewer.md` | 86 ln | On-demand before owned-table changes | ✅ (depends on `docs/security/isolation_model.md` — present) |
| Session mantra (verbose) | `docs/STAVAGENT_ClaudeCode_Session_Mantra.md` | — | Referenced by skill rule #1 | ✅ exists |
| Pattern registry | `docs/STAVAGENT_PATTERNS.md` | 2299 ln / 49 patterns | Consulted before pattern work; 5 patterns promoted to CLAUDE.md "mandatory" | ✅ healthy registry, ⚠️ count drift vs CLAUDE.md (§3, C7) |

**Always-on de-facto set (claude.ai online):** the session-discipline skill §7 pins a 10-file "Project Knowledge sync list" — CLAUDE.md + 5 steering + soul.md + STAVAGENT_PATTERNS.md + KNOWLEDGE_PLACEMENT_GUIDE.md + Session_Mantra.md. This is the closest thing to a declared Tier-A manifest, but it is a manual mirror with no drift check (§5).

### Tier B — Domain context (read per-domain / on demand)

| Artefact | Path | Read when | Status |
|---|---|---|---|
| Domain rules | `docs/steering/domain.md` | Domain decisions | ✅ canonical (also Tier A) |
| Knowledge placement guide | `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` | Before adding KB content | ✅ operational (B0–B9 taxonomy, search order, 4-file layout) |
| KB single-source YAML | `kb/*.yaml` (5 files, 548 ln) | Codegen time (`gen-knowledge.mjs`) | ✅ single-source enforced |
| KB codegen + drift guard | `scripts/gen-knowledge.mjs` (515 ln) + `Monolit-Planner/shared/src/kb-generated/*` | Build + CI `gen:knowledge:check` | ✅ **exemplary** — the one place "what is canonical" is mechanically enforced |
| Element classification rules | `concrete-agent/.../app/classifiers/element_rules/element_types.yaml` | Python W3 (native) + TS engine (generated) | ✅ dual-runtime single source |
| Concrete-agent KB buckets | `concrete-agent/.../app/knowledge_base/B0–B13/` | Core engine runtime | ✅ structured (separately audited 2026-04-26) |
| Norms & vendor PDFs | `docs/normy/{tkp,navody}/` (46 files, 66 MB) | NormIngestionPipeline / extraction | ⚠️ misplaced (see §2 / §6) |

**Verdict for Tier B:** the **domain-knowledge & pattern axis is in good health** — single-source YAML→codegen with a CI drift guard, isolated pattern namespaces (master 1-49 / pilot-local 01-09 / ZS-cost A-G) with explicit cross-references and zero duplication. This stands in sharp contrast to Tier A (governance/memory), where the problems concentrate.

### Tier C — Project context (read per-project / per-task)

| Artefact | Path | Read when | Status |
|---|---|---|---|
| Root handoff | `next-session.md` | Start of next session | ✅ but dated 2026-05-26 (pre-dates last 6 soul sessions) |
| Registry handoff | `rozpocet-registry/next-session.md` | Registry work | ✅ 19 follow-ups (de-facto Registry governance — see gap G4) |
| Session log | `docs/soul.md §9` | Session start/end | ⚠️ 6 entries, ~1350 ln (oversized) |
| Task specs | `docs/tasks/TASK_*.md` (38) | When picking up a task | ⚠️ monolithic, not in SDD `requirements/design/tasks` form |
| SDD specs | `docs/specs/{feature}/` (2: knowledge-codegen-pipeline, element/) | Active feature | ✅ codegen spec is the canonical 3-file example |
| Bug specs | `docs/bugs/{id}/` (1: aplikovat-timeout) | Active bug | ⚠️ the 1 folder is template-text, not a real bug |
| Backlog | `BACKLOG.md` + `backlog/*.md` (2) | Planning | ⚠️ tiny; real backlog lives in CLAUDE.md TODO + soul §2 + next-session |
| Per-project corpora | `test-data/{project}/` incl. own patterns/handoff | Pilot work | ✅ (read-denied to AI by settings — intentional) |
| Prior handoff audits | `docs/handoff/2026-05-19-*` (4) | Reference | ✅ |

---

## 2. Duplication & scattered knowledge → consolidation targets

| # | What | Where it lives (multiple) | Consolidate to |
|---|---|---|---|
| D1 | **Calculator philosophy** | `docs/CALCULATOR_PHILOSOPHY.md` + `docs/normy/navody/CALCULATOR_PHILOSOPHY.md` (**byte-identical**, both marked deprecated by CLAUDE.md) + canonical `docs/steering/domain.md §1` | Keep `domain.md §1`; delete the two deprecated copies (or replace each with a 1-line pointer). Triple source today. |
| D2 | **Memory / continuity** spread across 6 mechanisms | soul `§9` · `next-session.md` (root + registry) · `docs/handoff/` · `docs/sessions/` · root `SESSION_*.md`/`WEEK_*.md` (20 dead logs) · `test-data/*/handoff/` | The *layering* is defensible (log vs blockers vs task-handoff vs project-checkpoint). The **20 dead `SESSION_*`/`WEEK_*` logs at `docs/` root** are not — move to `docs/archive/`. |
| D3 | **Steering source material** | Root `STAVAGENT_Master_Brief.md`, `STAVAGENT_Architecture_Notes.md`, `STAVAGENT_Agent_First_Architecture_Vision.md`, `STAVAGENT_PROJECT_KNOWLEDGE_2026_05_07.md` overlap `docs/steering/*` | These pre-date steering and partially supersede/contradict it. Mark each "source material — superseded by steering/" or move to `docs/archive/`. |
| D4 | **Root TASK specs** | 6 `TASK_*.md` at `docs/` root vs 38 in `docs/tasks/` | Move root ones into `docs/tasks/` (or `docs/specs/`). |
| D5 | **Orphaned pattern doc** | `docs/STAVAGENT_Patterns_from_Conversation.md` (84 ln) superseded by master patterns 17-36 | Archive; it is pre-numbering raw capture. |
| D6 | **65 loose `docs/*.md`** | 13 session/week logs · 14 vision docs · 6 task specs · setup/deploy/strategy mix | Largest single sprawl surface; partial map already in `docs/audit_project_knowledge.md`. |

---

## 3. Rule contradictions (the core problem)

These are cases where one always-read governance file states something that **conflicts with another always-read file or with the actual repo**. Ranked by blast radius.

**C1 — Repo layout in steering is fiction (HIGH).**
`docs/steering/structure.md §1` (mandatory-read #4, the "where to put new code" authority) and `tech.md §2/§3.1/§4` describe a layout that **does not exist**:

| Steering says | Reality |
|---|---|
| `app/` (Core at repo root), `app/parsers/…`, `app/engines/…`, `app/ai/…` | `concrete-agent/packages/core-backend/app/…` |
| `apps/portal`, `apps/registry`, `apps/monolit-planner`, `apps/klasifikator` | `stavagent-portal/`, `rozpocet-registry/`, `Monolit-Planner/`, `URS_MATCHER_SERVICE/` |
| `catalogs/urs_local_cache.jsonl`, top-level `tests/` | absent |
| `app/knowledge_base/B7_regulations/` | `concrete-agent/packages/core-backend/app/knowledge_base/` |

This **also contradicts CLAUDE.md's own Quick Reference**, which *is* accurate. A session that obeys mandatory-read #4 would place files at non-existent `app/parsers/…` paths. structure.md §4/§7 cheat-sheets inherit the same wrong roots. Most damaging contradiction in the repo.

**C2 — DB names disagree (MED).** `tech.md §4.1`: `stavagent_portal / stavagent_registry / stavagent_calculator`. `CLAUDE.md`: `stavagent_portal / monolit_planner / rozpocet_registry`.

**C3 — MCP URL disagrees (MED).** `tech.md §7`: `concrete-agent-3uxelthc4q-ey.a.run.app/mcp`. `CLAUDE.md`: `concrete-agent-1086027517695.europe-west3.run.app`.

**C4 — AI tier / credits disagree (MED).** `tech.md §5.2`: Bedrock = "Claude Sonnet 4, $1,000 AWS Activate"; §5.5 "NEPOUŽÍVÁ OpenAI / direct Anthropic". `CLAUDE.md`: Bedrock = "Claude 3 Haiku/Sonnet/Opus, $20 + $84 Free Tier"; LLM chain explicitly ends "…→ Claude API → OpenAI". The $1,000 figure is attached to Vertex/GCP in CLAUDE.md but to Bedrock/AWS in tech.md.

**C5 — `.claude/settings.json` documented ≠ actual (MED).** Both `CLAUDE.md` (Session Setup) and `tech.md §13` show a settings file with `effortLevel` + an `env` block. The **actual `.claude/settings.json` contains neither** — only a `permissions` allow/deny list. Within the docs the env key name even differs: CLAUDE.md `CLAUDE_CODE_AUTO_COMPACT_WINDOW` vs tech.md §13 `AUTO_COMPACT_WINDOW`; and effort: CLAUDE.md "high **or max**" vs tech.md "high (**not max** — too expensive)". Three-way disagreement about settings that don't exist.

**C6 — Monolit-Planner has two memory files, neither auto-loadable (HIGH).**
`Monolit-Planner/claude.md` (143 KB / 3006 ln) **and** `Monolit-Planner/CLAUDE.MD` (39 KB / 1024 ln) both open with "источник истины для AI-ассистента". On a case-sensitive filesystem **neither is `CLAUDE.md`**, so Claude Code auto-loads **no** per-service memory there — while two divergent "source of truth" copies sit side by side. CLAUDE.md's "Per-service docs" line points at `Monolit-Planner/CLAUDE.MD` (the smaller, older-looking one).

**C7 — Pattern count drift (LOW).** CLAUDE.md changelog (v4.33) says "36 patterns, 1727 lines". Actual `STAVAGENT_PATTERNS.md`: `last_number: 49`, 2299 ln. Patterns 37-49 shipped without a CLAUDE.md note.

**C8 — concrete-agent/CLAUDE.md self-stale (LOW/MED).** Header `Version 2.5.0, Last updated 2026-03-26`, body "Current Status (2025-11-20)". Separate `2.x` scheme vs root `4.x`. Misses Phase 0a audit's later revisions, OAuth, resource ceiling, element codegen — though parts were updated 2026-05-29 per root changelog, so the header date itself is wrong.

**C9 — soul.md current-state frozen (MED).** `§2 Current state snapshot (19.05.2026)` → "v4.24 в продакшне". Reality: CLAUDE.md v4.34 (2026-06-05); soul `§9` itself runs to 2026-06-05. The living-memory *header* is ~2.5 weeks and 10 minor versions behind its own session log.

**C10 — Husky claim (LOW).** CLAUDE.md: "Pre-commit: 34 formula tests". Actual `.husky/pre-commit` runs only `src/formulas.test.ts`.

**C11 — normy/ placement rule vs reality (LOW).** structure.md §4 + the 2026-05-19 handoff both say norms belong in `app/knowledge_base/B7_regulations/`; they remain in `docs/normy/` (66 MB).

---

## 4. Gaps (rules reference things that don't exist / are missing)

- **G1 — No context router / index / SessionStart hook.** `.claude/settings.json` has only permissions (no `hooks`). Context loading is a **voluntary prose list** in CLAUDE.md ("Mandatory reading at session start"). The only *automated* trigger layer is the 2 keyword-skills, which cover task-writing and session-discipline — **not** domain/project context selection. Nothing detects whether a session actually read the mandatory files, nor whether they're fresh.
- **G2 — `docs/reference/` is a broken pointer target.** structure.md §1/§7 and `domain.md` reference `docs/reference/{golden_tests,architecture,audits,findings,playbooks,marketing,competitive}/`. Actual `docs/reference/` contains **one** file (`formwork_catalog_2025.md`). All the subdir pointers dangle; the real content still sits at `docs/architecture/`, `docs/audits/`, `docs/competitive/` (migration recommended 2026-05-19, never executed).
- **G3 — Steering never updated despite the rule to do so.** All 5 steering docs are stamped `v1.0, 19.05.2026` and unchanged since. Session-discipline skill rule #4 *mandates* steering updates on architectural decisions; many shipped since (MCP OAuth, Postgres migration, resource ceiling, element-classification codegen, DXF takeoff, SSOT MCP delegate). The update mechanism exists on paper but **is not being exercised** — which is *why* §3's contradictions accumulated.
- **G4 — Uneven per-service governance.** Only `concrete-agent` and `Monolit-Planner` have a CLAUDE file (and Monolit's is broken, C6). `stavagent-portal`, `URS_MATCHER_SERVICE`, `rozpocet-registry`, `rozpocet-registry-backend`, `mineru_service` have none; Registry's de-facto governance is buried in its `next-session.md`.
- **G5 — `soul.md §2` has no refresh trigger.** Discipline rules touch §2.3/§2.4 (freelance/KB sources) but no rule refreshes §2.1 production version → it rots (C9). No owner, no cadence.
- **G6 — Project Knowledge sync is unverifiable.** The 10-file sync list (skill §7) is mirrored to claude.ai by hand, weekly, with no drift check. Online sessions can silently run on stale governance.
- **G7 — soul.md §9 entries are oversized for their purpose.** 6 entries over ~1350 lines; the file's own header says "read at start of every session," but entries have grown into full session transcripts (largest single entry > 1000 lines). This works against the "letter to the next session" intent and inflates every session's read cost.

---

## 5. Context-loading mechanism — assessment

**Is there a router?** No. There is a **protocol** (CLAUDE.md mandatory-read list → steering → soul → per-service CLAUDE → specs/tasks) plus a thin **automated trigger layer** (2 keyword skills + on-demand `.claude/agents`). There is **no index, manifest, or SessionStart hook** that loads, orders, or freshness-checks context. Loading therefore depends on the model voluntarily following prose — and on that prose being correct, which §3 shows it currently is not.

**Is context applied consistently?** Partially. The skills fire reliably on keywords. But the always-read tier is **internally inconsistent** (C1–C5) and **partly stale** (C8, C9, G3), so even a perfectly obedient session is loaded with contradictory facts. The healthy part — the KB codegen drift guard — is exactly the pattern missing everywhere else: *a mechanical check that the source of truth and its consumers agree.*

**Does a router need building?** Not a heavy one, and **not yet.** A router that faithfully loads contradictory governance just distributes the contradictions faster. Sequence matters:

1. **First** fix the always-read tier (it is actively misleading — C1 especially).
2. **Then** add a *proportional* loading aid: a small **context index** (one table: artefact → tier → "read when" → last-verified-against) plus an optional **SessionStart hook** that prints the mandatory-read list and flags freshness (e.g. "soul §2 version ≠ CLAUDE.md version"). This mirrors the existing `gen:knowledge:check` philosophy applied to governance.

A full dynamic router/RAG over docs would be over-engineering for a single-maintainer repo — it contradicts the Karpathy anti-bloat rules in CLAUDE.md. The cheapest high-value mechanism is a **drift check between the governance tier and reality**, not a smarter loader.

---

## 6. Prioritized recommendations (Phase 2 candidates — apply only after OK)

All are **minimal, surgical rule edits**; none moves/deletes files without separate sign-off. Grouped by priority.

### P0 — Stop the active misdirection (always-read tier is wrong)
1. **Fix `structure.md §1/§4/§7` + `tech.md §2/§3.1/§4` repo layout** to the real monorepo (`concrete-agent/packages/core-backend/app/…`, the 5 service dirs, no `app/`/`apps/`/`catalogs/` at root). Or, if the `app/apps` layout is a deliberate *target*, mark §1 explicitly "TARGET STATE — current layout is the monorepo in CLAUDE.md Quick Reference" so it stops being read as current. (C1, C11, G2)
2. **Resolve Monolit's dual CLAUDE file.** Pick one canonical body, name it `Monolit-Planner/CLAUDE.md` (exact case), reconcile the two, retire the other. Fix CLAUDE.md's "Per-service docs" pointer. (C6)
3. **Reconcile `.claude/settings.json` with its docs.** Either add the documented `env`/`effort` block to the real file (with one consistent key name) or strike the fictional block from CLAUDE.md + tech.md §13. (C5)

### P1 — Re-true the facts & restart the update loop
4. **Refresh `soul.md §2` snapshot** to current version/state, and add a one-line maintenance rule (or replace §2.1 with a pointer to CLAUDE.md's version) so it can't silently rot. (C9, G5)
5. **Reconcile the scattered infra facts** — DB names (C2), MCP URL (C3), AI-tier/credits (C4) — to a single canonical statement; tech.md is self-declared canonical for infra, so make CLAUDE.md defer to it (or vice-versa) and fix the loser.
6. **Bump steering version/date** and add steering to the post-session checklist with teeth (the discipline skill rule #4 exists; add a visible "steering last-synced @ CLAUDE.md vX" stamp so drift is obvious). (G3)
7. **De-duplicate `CALCULATOR_PHILOSOPHY.md`** — delete/stub the two deprecated copies, leave `domain.md §1` canonical. (D1)
8. **Refresh `concrete-agent/CLAUDE.md` header** (date + "Current Status") and decide one version scheme. (C8)

### P2 — Reduce sprawl & add a proportional loader
9. **Sync small facts:** CLAUDE.md pattern count 36→49 (C7); Husky "34 tests"→actual (C10).
10. **Archive dead memory:** move root `SESSION_*.md` + `WEEK_*.md` (20 files) to `docs/archive/`; archive `STAVAGENT_Patterns_from_Conversation.md`; relocate 6 root `TASK_*.md` into `docs/tasks/`. (D2, D4, D5)
11. **Add a governance context index** (`docs/steering/` or `.claude/`): one table mapping each Tier-A/B/C artefact → "read when" → "last verified". Optionally a `SessionStart` hook printing the mandatory-read list + a freshness flag (soul §2 vs CLAUDE.md version). (G1)
12. **Per-service governance stubs** for portal/URS/registry (even a 20-line `CLAUDE.md` pointing at the relevant root sections) so Registry's rules stop living only in `next-session.md`. (G4)
13. **Trim `soul.md §9`** to "letter to next session" length; push verbose transcripts to per-session files under `docs/sessions/`. (G7)

---

## 7. Headline numbers

| Metric | Count |
|---|---|
| Governance/instruction files inventoried (Tier A) | 14 |
| Per-service CLAUDE files | 4 (incl. 2 broken-by-casing in Monolit) |
| Rule contradictions found | 11 (2 HIGH, 6 MED, 3 LOW) |
| Gaps found | 7 |
| Duplication / scatter groups | 6 |
| Loose `docs/*.md` at root | 65 |
| Total `docs/**.md` | 230 |
| Dead session/week logs at docs root | 20 |
| Context router / index / SessionStart hook | **0** |
| Mechanical drift guard for governance | **0** (vs 1 excellent one for the KB codegen) |

**One-paragraph verdict.** The **domain-knowledge and pattern axis is genuinely well-built** — single-source YAML → codegen with a CI drift guard, clean pattern namespaces, a clear placement guide. The **governance / rules / memory axis is where the debt sits**: the two infra steering docs (`structure.md`, `tech.md`) — both *mandatory reading* — describe a repo layout, DB set, MCP URL, AI-tier and settings file that contradict CLAUDE.md and the actual tree; Monolit's per-service memory is split into two case-colliding copies that Claude Code won't auto-load; and the living-memory header froze 2.5 weeks / 10 versions behind its own session log. The root cause is structural, not cosmetic: **there is no mechanical check that governance agrees with reality**, even though the project already proved (in `gen-knowledge.mjs`) that it knows how to build one. Fix the always-read tier first, then add a small governance drift-check; defer any heavyweight context router as over-engineering.

---

*End of Phase 1. No further changes pending explicit approval of these findings (Phase 2 = surgical rule edits per §6).*
