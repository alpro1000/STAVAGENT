# Claude Code Plugins — Setup + Automation Audit

**Date:** 2026-05-31
**Scope:** READ-ONLY tooling audit + plugin install. **No product code changed.**
**Branch:** `claude/code-plugins-audit-setup-paw6S`
**Constraint context:** Google for Startups review in progress + Cemex demo pending →
no auto-push / auto-deploy automation enabled; prod `stavagent.cz` untouched; no new
branches in Branch-Tracking kiosk repos.

---

## 0. PRE-IMPLEMENTATION INTERVIEW — recorded answers

| # | Question | Answer |
|---|----------|--------|
| **1** | Monorepo or polyrepo? | **One git tree** (`alpro1000/STAVAGENT`, no submodules). Core (`concrete-agent/`, Python/FastAPI) + 4 kiosks (Node/React) are subdirectories but deploy independently (separate Cloud Run / Vercel projects). ⇒ monorepo *working tree*, polyrepo *deployment*. A browser/Playwright frontend-MCP therefore belongs to the kiosk apps, **not** this Core-rooted audit → DEFER. |
| **2** | Claude Code version? | **`2.1.158`** — modern, full `claude plugin` + marketplace support. Proceed. |
| 3 | Where are large committed data files? | See §5. Headline: `test-data/` = **459 MB / 1 332 files**. |
| 4 | Pre-existing plugins / conflicting hooks? | No plugins installed before this session. Only hook = `~/.claude/stop-hook-git-check.sh` (reminder-only, does **not** auto-push). No project-level `.claude/settings.json`, no `.claude/agents`, no `.claude/commands`. Project skills exist: `stavagent-session-discipline`, `stavagent-claude-code-tasks`. |
| **5** | Confirm: no auto-push/deploy hooks during Google review? | **Confirmed by user (2026-05-31).** All auto-push / auto-deploy automation → ОТЛОЖИТЬ bucket. The reminder-only Stop hook stays as-is. Nothing of that class enabled. |

> Gate questions **1, 2, 5** all answered before any install. ✅

---

## 1. What was installed

| Plugin | Marketplace | Version | Status | Maps to task plugin |
|--------|-------------|---------|--------|---------------------|
| `code-review` | `claude-code-plugins` (`anthropics/claude-code`) | 1.0.0 | enabled (user scope) | **Plugin 2 (code-review)** — exact match |

Marketplace added: `claude plugin marketplace add anthropics/claude-code` → registered as
`claude-code-plugins`. Network access to GitHub works under the current policy.

### Plugin 1 ("automation analyzer") — does not exist in the official marketplace

The task's plugin 1 is described as a read-only tool that *"scans the codebase and
recommends hooks / skills / MCP / subagents / slash-commands."* **No such plugin exists**
in `anthropics/claude-code`. All 13 plugins were enumerated:

`agent-sdk-dev · claude-opus-4-5-migration · code-review · commit-commands ·
explanatory-output-style · feature-dev · frontend-design · hookify ·
learning-output-style · plugin-dev · pr-review-toolkit · ralph-wiggum · security-guidance`

Closest relatives, both rejected as the analyzer:
- **`plugin-dev`** — a plugin *authoring* toolkit. Its `/plugin-dev:create-plugin` Phase 2
  ("Component Planning — determine needed skills/commands/agents/hooks/MCP") plans what to
  build for *one new plugin*; it is not a repo auditor.
- **`hookify`** — analyzes conversation patterns → produces *hooks only* (no skills/MCP/
  subagents/commands).

**User decision (2026-05-31):** do not install a mismatched plugin. The
recommendation-generating analysis is performed directly against Core in §3–4 of this report
(that *is* the "raw recommendations" deliverable). `code-review` remains the only installed
plugin.

---

## 2. `code-review` — actual composition (recorded, may differ from marketing copy)

Source: `commands/code-review.md` in the plugin. The plugin ships **one slash command**
(`/code-review`); the "multiple agents" are spawned at runtime, not declared as plugin
agent components (`claude plugin details code-review` → Agents: 0).

**Actual agent pipeline:**
1. **Haiku** — eligibility gate: skip if PR is closed / draft / automated / trivial / already
   Claude-commented.
2. **Haiku** — collect relevant `CLAUDE.md` file paths (root + dirs touched by the diff).
3. **Sonnet** — summarize the PR.
4. **4 parallel reviewers:** Agents 1+2 = **Sonnet** CLAUDE.md-compliance; Agent 3 = **Opus**
   bug agent (diff-only); Agent 4 = **Opus** bug/security/logic agent (introduced code).
5. **Per-issue validator subagents** — re-check every flagged issue (Opus for bugs/logic,
   Sonnet for CLAUDE.md); unconfirmed issues are dropped.
6. Filter to validated high-signal set → terminal summary; `--comment` optionally posts inline
   GitHub comments.

**Honest discrepancies vs documentation:**
- The marketed *"confidence-based scoring"* is implemented as a **binary validation-pass
  filter** (step 5–6), **not** a literal 0–100 numeric score with a tunable cutoff. There is
  no exposed threshold knob.
- The command is wired to the **`gh` CLI** (`allowed-tools: Bash(gh ...)`) plus a
  `mcp__github_inline_comment__create_inline_comment` MCP. **Neither is available in this
  remote environment** (only the `mcp__github__*` toolset is). The command would need a
  thin port to run here.

---

## 3. Code-review trial run — status

**READY, NOT TEST-RUN.** Three concrete reasons (not a skip out of laziness):
1. The plugin's slash command loads only in a **fresh session**; it is not invokable in the
   session that installed it.
2. It depends on **`gh` CLI + `github_inline_comment` MCP**, both absent in this remote env.
3. All **24 open PRs are Dependabot** automated bumps — the command's step 1 is explicitly
   designed to **skip automated PRs**, so a faithful run would self-abort. There is **no human
   feature PR** to review, and the task forbids creating one for a test.

When a real human non-draft PR exists and the command is ported to `mcp__github__*`, it is
ready to run.

---

## 4. Automation analysis of Core (`concrete-agent/`) — raw recommendations

Performed manually in lieu of the non-existent analyzer plugin. Grounding facts:
- Core is Python/FastAPI, ~61K LOC, 120 endpoints, own MCP server (product).
- **`black` / `ruff` / `mypy` are listed in `requirements.txt` but ALL commented out.** No
  Python lint/format runs anywhere — not in the Husky hooks (which only run Monolit-Planner
  JS formula tests), not in any CI workflow (`test-coverage.yml` has no Python lint step).
- `docs/security/isolation_model.md` exists → the cross-user isolation P0 (GDPR) is documented.
- No project-level `.claude/agents`, `.claude/commands`, or `.claude/settings.json` → greenfield.
- CLAUDE.md already documents a **manual** "MCP compatibility check" discipline (tool→module map).

### Raw recommendation list (pre-bucketing)

| ID | Type | Recommendation |
|----|------|----------------|
| R1 | settings (context) | `permissions.deny: Read(...)` for the large committed data corpus (see §5) so Claude never slurps a 24 MB DXF / 13 MB `.db` / catalog CSV into context. |
| R2 | hook | Python lint/format gate (`ruff` + `black`, optionally `mypy`) on `Edit`/`Write` of `concrete-agent/**/*.py` — activate the already-declared-but-commented tools. |
| R3 | subagent | Security / cross-user-isolation reviewer grounded in `docs/security/isolation_model.md` + the `portal_user_id` isolation rules. |
| R4 | hook | MCP-compatibility guard: run `pytest tests/test_mcp_compatibility.py` after editing any module in the CLAUDE.md MCP tool→module map. |
| R5 | slash-command | `/code-review` with its validation-pass filter (already installed). |
| R6 | hook | Secret-scan / no-commit-secrets pre-commit (DB password leaked in git history once). |
| R7 | slash-command | `/session-log` to append the mandatory `docs/soul.md` §9 session entry. |
| R8 | subagent | Browser/Playwright frontend MCP agent for kiosk UI work. |
| R9 | hook/cmd | Auto-push branch + auto-trigger Vercel/Cloud Run preview deploy. |
| R10 | MCP | Any external-access MCP server (browser, web, third-party). |
| R11 | plugins | `frontend-design`, `ralph-wiggum`, `learning-output-style`, `explanatory-output-style`, marketplace `commit-commands` push/PR automation. |
| R12 | skills | New skills duplicating existing steering docs / project skills. |

---

## 5. Large committed data — context-exclusion proposed? **YES**

**Explicitly proposed (this is the AC#6 item — it is the big-data corpus, not just secrets).**
Recommended `permissions.deny` read-patterns for a project `.claude/settings.json`
(recommendation only — **not created** in this task):

| Path / pattern | Tracked size | Why exclude from context |
|----------------|--------------|--------------------------|
| `test-data/**` | **459 MB / 1 332 files** | Golden fixtures + DXF/PDF/XML corpora; biggest single bloat source. |
| `**/*.dxf` | e.g. `A104_pohledy.dxf` 24 MB | Binary-ish CAD, useless as raw context. |
| `**/*.db`, `**/*.MDB` | `kros_catalog.db` 13 MB, `KROS.MDB` 12 MB | Catalog DBs; query via tools, never read raw. |
| `**/knowledge_base/**/*.{json,xml}` | KB ≈ 40 MB (213 files) | e.g. `2025_03_otskp.xml` 16 MB. |
| `docs/normy/**/*.pdf` | ≈ 40 MB (46 files) | Norm PDFs (TKP17 13 MB, …). |
| `URS_MATCHER_SERVICE/backend/data/*.csv` | `CENEKON…csv` 5.8 MB, `TSP…csv` 5.7 MB | Catalog dumps. |
| `Monolit-Planner/2025_03 OTSKP.xml`, `concrete-agent/.../2025_03_otskp.xml` | 17 MB / 16 MB | Duplicated OTSKP catalog XML. |

`.gitignore` already excludes *derived* caches and generated DXF, but the **committed** corpus
above is still tracked and thus context-readable — that is what R1 addresses.

---

## 6. Final bucketed recommendations

### 🟢 БРАТЬ СЕЙЧАС (take now — hits current work)

| ID | Recommendation | One-line justification |
|----|----------------|------------------------|
| R1 | Context read-deny for the large data corpus (§5) | Direct context-budget saving on a 459 MB corpus; zero product-code risk. |
| R3 | Security / cross-user-isolation reviewer subagent | Serves the GDPR cross-user-isolation P0 before Cemex; grounded in `docs/security/isolation_model.md`. |
| R5 | `/code-review` confidence-validated command | Installed; its validate-then-filter design matches the project's "determinism + confidence" principle. |
| R2 | Python `ruff`+`black` lint/format hook | Tools already declared (commented) in `requirements.txt`; **no CI conflict** (no Python lint exists today). |
| R4 | MCP-compatibility guard hook | Automates a discipline CLAUDE.md already mandates manually; fast, low-risk. |
| R6 | Secret-scan pre-commit hook | Defensive; relevant during the Google review (history had a leaked DB password). |

### 🟡 ОТЛОЖИТЬ (defer — useful but not during the review / not under this Core scope)

| ID | Recommendation | One-line justification |
|----|----------------|------------------------|
| R9 | Auto-push branch / auto-trigger preview deploy | **Q5-confirmed deferral** — Vercel overage + prod-safety risk during Google review. |
| R8 | Browser/Playwright frontend-MCP agent | Belongs to the kiosk React repos, not the Python Core (Q1). |
| R7 | `/session-log` (soul.md §9) command | Nice ergonomic win, but pure dev-convenience; queue after the review. |
| R11 (`commit-commands`) | Marketplace git push/PR automation, *if* used as auto-hook | Manual commands fine later; auto-hook form falls under the R9 deferral. |

### 🔴 НЕ БРАТЬ (skip — wrong architecture or duplicates existing)

| ID | Recommendation | One-line justification |
|----|----------------|------------------------|
| R10 | External-access MCP servers | **Flagged, not enabled** — external data egress is a user decision, never auto-added; product already runs its own MCP. |
| R11 | `frontend-design`, `ralph-wiggum`, `learning/explanatory-output-style` plugins | Irrelevant to a Python Core audit; output-style plugins change interaction mode, not needed. |
| R12 | New skills cloning steering docs | Repo already distills steering → 2 project skills; duplicates would drift from canonical. |

---

## 7. Acceptance criteria check

1. ✅ Interview answers recorded (1, 2, 5 + 3, 4) — §0.
2. ✅ Plugins installed from the official marketplace; `code-review` v1.0.0 actual composition
   recorded — §1–2. (Plugin 1 documented as non-existent; user chose manual analysis.)
3. ✅ Automation analysis run from Core root; raw recommendations saved — §4.
4. ✅ Code-review command available; **"ready, not test-run — no human PR + gh-CLI/MCP gap + next-session load"** — §3.
5. ✅ All recommendations bucketed БРАТЬ / ОТЛОЖИТЬ / НЕ БРАТЬ with one-line justifications — §6.
6. ✅ Large-data context-exclusion **proposed = YES**, with explicit paths — §5.
7. ✅ No product code / schema / test changed. No new branch in Branch-Tracking kiosk repos.
8. ✅ No auto-push / auto-deploy hooks enabled.
9. ✅ Report filed under existing audits convention `docs/audits/<topic>/<date>_<name>.md`.

---

## 8. What was NOT done (out of scope, by design)

- ❌ No recommended automation was *implemented/enabled* — that is a separate user decision.
- ❌ No PR created for a code-review test.
- ❌ No external MCP server added.
- ❌ No product code, schema, or test touched.

**Reproduce the install:**
```bash
claude plugin marketplace add anthropics/claude-code   # → marketplace "claude-code-plugins"
claude plugin install code-review@claude-code-plugins  # v1.0.0, user scope
```
Repo HEAD at audit time: `c23980b`.
