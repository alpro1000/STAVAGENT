# TASK_Orchestrator_PatternsSection_DocsUpdate

**Target week:** Week 1 of Cemex CSC 2026 runway (May 27 — Jun 2, 2026)
**Estimated effort:** ~8 hours
**Dependencies:** None (this is the architecture-defining task that other Week 2-4 tasks reference)
**Scope:** Documentation only — no code changes

---

## Mantra (read this fully before ANY action)

Before writing a single line, do all of the following:

1. **Read the entire repo structure** — `ls -R`, identify where docs live, where patterns are catalogued, where the Architecture Vision document is stored, where soul.md and next-session.md live.
2. **Find existing convention** for how patterns are numbered, how new sections are added to the Architecture Vision, how cross-references between docs are written.
3. **Read the current Architecture Vision document end-to-end.** Do not skim. Identify section §3.3 (determinism ladder), §3.4 (the 8 codified operational patterns), §11.5 (MCP security), §11.6 (Pattern Enforcement), §15 (final decisions map), §16 (Pipeline Spec phases). If section numbering differs in the actual repo, use whatever numbering the repo actually uses — adapt this task description accordingly.
4. **Read the existing STAVAGENT_PATTERNS.md** (or whatever the actual filename is — the file documenting product patterns). Note the format of existing pattern entries.
5. **Read soul.md and next-session.md** to understand current handoff format.
6. **Read TASK_UWO_Bridge_Ontology.md** to understand what supersession is being applied (Pattern 16 absorbs part of its scope).
7. Only then begin editing.

Do not invent new section numbering schemes. Do not move existing sections. Surgical edits only.

---

## Pre-Implementation Interview

Before making any changes, ask the user (via AskUserQuestion) the following — wait for answers before proceeding:

1. **Where does the Architecture Vision document live?** (Likely `docs/STAVAGENT_Agent_First_Architecture_Vision.md` or similar.) Is it under version control in the main repo?
2. **Where does STAVAGENT_PATTERNS.md live** and what is the exact filename?
3. **Where does soul.md live** and what is the current session log format?
4. **Where does next-session.md live** and what is the current handoff format?
5. **Are existing Patterns 1-8 documented as a single list in §3.4, or as individual sub-sections (§3.4.1 through §3.4.8)?** This determines how Pattern 15 and Pattern 16 should be structured.
6. **Is there a local "v2" of the Architecture Vision that is not yet committed?** The user has referenced a "v2" in conversation — confirm whether this exists locally or is only conceptual.
7. **What is the current state of Patterns 9-14?** Are they reserved, partially defined, or fully unused? This affects how to introduce Pattern 15 numbering.

---

## Context

The Architecture Vision document currently codifies 8 operational discipline patterns (file_swap_detection, tz_validator_iterative, multi_view_items_json, workflow_gate_vs_catalog, honest_detail_fallback, exhaustive_dxf_extraction, subdodavatel_granular, per_objekt_chunking — exact names may differ in the actual document).

Two new patterns need to be added that are of a **different conceptual order** than 1-8:

- **Pattern 15 (Work-First, Catalog-Last):** a three-stage workflow discipline (work atomization → optional decomposition → catalog binding). Stage 1 forbids catalog tools and pricing. Defined in the Orchestrator Spec uploaded to Project Knowledge.
- **Pattern 16 (Universal Work Ontology + Market Adapters):** a cross-cutting architectural principle (physical work is universal across EU markets, catalog representation is local). Schema defined in Orchestrator Spec §6.3.

These two patterns are **architectural**, not operational. Patterns 1-8 are per-tool-call enforcement points; Patterns 15-16 are state-level and cross-cutting. Mixing them in a single numbered list breaks the §11.6 enforcement matrix.

In parallel, the **Architecture Doctrine v2** (uploaded as `architecture.md`) introduces a three-layer separation (Core Engine = truth, MCP = capabilities, ADK = behavior) with six principles, boundary enforcement rules, workflow state machine, tool metadata registry, and replay guarantee contract. This doctrine extends the existing Architecture Vision; it does not replace it.

TASK_UWO_Bridge_Ontology.md is currently marked `POST-SUBMISSION QUEUE / Target July 2026`. Pattern 16 absorbs part of its scope (universal ontology schema, adapter pattern with inclusion/exclusion notes). The 50+ category vocabulary, HK212-HSV-1-002 empirical proof, and Czech MJ normalization remain as implementation details under Pattern 16, not as a standalone task.

---

## Business Logic

### Edit 1 — New section for Architecture Doctrine v2 layers

Add a new section in the Architecture Vision that documents the three-layer separation. Content sources:

- Three layers (Core Engine = truth, MCP = capabilities, ADK = behavior, Persistent Project State at the bottom).
- Six principles (P1: Core owns truth; P2: MCP exposes capabilities not intelligence; P3: ADK owns behavior not state; P4: all mutations via explicit commit tools; P5: no direct DB access outside Core; P6: all clients use same canonical contracts).
- Boundary enforcement rules — ADK must not / MCP must not / Core must not lists.
- Single enforced rule: "ADK may only access STAVAGENT through MCP contracts. No exceptions."

### Edit 2 — New section for workflow state machine

Add a new section documenting the 8-state machine: DOCUMENT_ANALYSIS → WORK_ATOMIZATION → DECOMPOSITION → CATALOG_BINDING → PRICING → REVIEW → COMMIT_PENDING → COMMITTED → EXPORTED. Each state has an allow-list of tools. State transitions are server-enforced, logged, and replayable.

This is a separate section from the patterns list because state machine is infrastructure, not a pattern.

### Edit 3 — Determinism ladder extension

The existing 13-source determinism ladder needs three new rows for the Pattern 15/16 integration:

- Pattern memory hit with stored confidence ≥0.9 → ladder confidence 0.95
- Pattern memory hit with stored confidence 0.7–0.9 → ladder confidence 0.85
- Adapter candidate matched-high (with inclusion/exclusion verified) → ladder confidence 0.85

Insert these rows at appropriate places in the existing ladder (between regex sources and AI sources by magnitude).

### Edit 4 — Patterns footnote in operational patterns section

Add a footnote at the end of the operational patterns list (§3.4 or equivalent) clarifying:

> Patterns 1-8 are operational discipline (per-tool enforcement). Patterns 15-16 are architectural workflow and ontology, documented in [new section reference]. Numbering gap 9-14 is reserved for future operational patterns.

### Edit 5 — MCP security section: tool metadata registry

Extend the existing MCP security section with a sub-section documenting the tool metadata registry schema. Every MCP tool ships with a manifest declaring: category, side_effect_level (enum: none / session_only / draft_only / persistent_mutation / reversible_mutation / external_io), requires_session, writes_state, policy_stage (allow-list of states), audit_required, replayable, billable, credits, requires_confirmation, version.

The registry is server-validated at startup. Tools without manifest are refused.

### Edit 6 — Pattern Enforcement matrix extension

The existing 4-layer Pattern Enforcement matrix (Layer 1 Prompt / Layer 2 Tool description / Layer 3 Server policy / Layer 4 Audit) needs three new rows:

- Stage 1 (work_atomization): catalog tools blocked at Layer 3, audit logs at Layer 4
- Stage 2 (decomposition): parent reference required at Layer 3, schema reject otherwise
- Stage 3 (catalog_binding): inclusion/exclusion notes required at Layer 3, adapter response validator at Layer 4

### Edit 7 — New section for replay guarantee contract

Add a new section documenting the formal replay guarantee:

> Given the same inputs, same tool versions, same Core Engine version, and same policy version → outputs must be identical.

This is the legal defensibility property. Implementation: every tool call logs tool name, version, inputs hash, outputs hash, policy hash, core version, timestamp. Core Engine version is pinned per project (no silent algorithm upgrade mid-project). LLM responses inside ADK are never treated as truth, only as proposed tool invocations.

### Edit 8 — Final decisions map: 4 new rows

Add to the final decisions map four new locked decisions:

- Pattern 15 (Work-First, Catalog-Last) — locked for Cemex submission demo
- Pattern 16 (Universal Work Ontology core) — partial scope (Czech adapter only) for Cemex window
- Single Orchestrator endpoint exposed in submission demo
- Pattern memory MCP — DEFER post-Cemex (read endpoints only for submission)

### Edit 9 — New section for PR architectural enforcement checklist

Add a new section documenting the PR review checklist that enforces the doctrine:

- No new direct DB access outside Core Engine
- No new calculator logic outside Core Engine
- If new MCP tool: tool metadata manifest provided
- If new MCP tool: side_effect_level declared
- If persistent_mutation: explicit confirmation flow + undo path
- If touching ADK runtime: no business state held in ADK
- Replay test for affected golden cases still green
- Policy stage allow-list updated if new state was added

### Edit 10 — STAVAGENT_PATTERNS.md additions

Add two new pattern entries in the existing patterns document, following the existing entry format:

- **Pattern 15** — Work-First, Catalog-Last. Three-stage workflow. Stage 1 forbids catalog tools and pricing. Stage 1 Definition of Done. Standard Stage 1 XLSX schema. Validation rules.
- **Pattern 16** — Universal Work Ontology + Market Adapters. Universal item schema. Market matrix (CZ/DE/ES/FR). Adapter architecture with inclusion/exclusion notes. Confidence scoring. requires_review flag.

### Edit 11 — soul.md session log update

Add a new session log entry documenting:

- Date of session
- Architecture Doctrine v2 adoption decision
- Pattern 15 and Pattern 16 introduction
- Calibrated MCP surface decision (approximately 38 endpoints, calibrated by Cemex window scope)
- Demo case selection (SO 250 simple + SO 202 complex, HK212 as internal CI)
- 33-day Cemex roadmap milestone

### Edit 12 — next-session.md handoff update

Update handoff state to reflect:

- Current architecture milestone (Doctrine v2 documented, patterns 15-16 codified)
- Active task queue (this Week 1 docs task complete, Week 2 StageGating MVP next)
- Open questions still pending
- Blockers (cross-user isolation P0 if not yet resolved)

### Edit 13 — TASK_UWO_Bridge_Ontology.md status change

Remove the `POST-SUBMISSION QUEUE / Target July 2026` header. Replace with a note that this task is now a sub-component of Pattern 16 implementation, specifically:

- Category vocabulary (50+ UWO categories) → input to Pattern 16 universal schema work_type and element_type fields
- HK212-HSV-1-002 empirical proof → preserved as motivation for Pattern 15
- Adapter pattern (catalog binding registry) → superseded by Pattern 16 adapter architecture

The skeleton modules for non-CZ markets remain post-Cemex.

---

## Domain Rules

- Patterns 1-8 are **operational discipline** (per-tool enforcement points). Do not mix with Patterns 15-16.
- Patterns 15-16 are **architectural workflow/ontology**. They live in a separate section from operational patterns.
- Numbering gap 9-14 is **explicit reserve** for future operational patterns. Do not renumber Pattern 15 to Pattern 9.
- Architecture Doctrine v2 **extends** the existing Architecture Vision. It does not replace existing sections.
- Surgical edits only. Do not rewrite sections that already exist.
- All new sections must have stable section numbers that can be referenced from other documents.
- Existing decision rows in the final decisions map are not edited — only additions.
- Existing patterns 1-8 are not edited — they remain as documented.

---

## Acceptance Criteria

1. Architecture Vision has a new section documenting Doctrine v2 layers (Core Engine / MCP / ADK / Persistent State) with six principles and boundary enforcement rules.
2. Architecture Vision has a new section documenting the 8-state workflow state machine with tool allow-lists per state.
3. Determinism ladder section has three new rows for pattern memory hits and adapter candidates, inserted at correct confidence ranges.
4. Operational patterns section has a footnote clarifying numbering and pointing to the architectural patterns section.
5. MCP security section has a new sub-section documenting tool metadata registry with side_effect_level enum.
6. Pattern Enforcement matrix has three new rows for Stage 1, Stage 2, Stage 3 policies.
7. A new section documents the replay guarantee contract with formal statement and implementation notes.
8. Final decisions map has four new rows (Pattern 15, Pattern 16, Orchestrator endpoint, Pattern memory MCP defer).
9. A new section documents the PR architectural enforcement checklist.
10. STAVAGENT_PATTERNS.md has Pattern 15 (Work-First, Catalog-Last) entry following existing format.
11. STAVAGENT_PATTERNS.md has Pattern 16 (Universal Work Ontology + Market Adapters) entry following existing format.
12. soul.md has a new session log entry summarizing this session's architectural decisions.
13. next-session.md is updated with the current handoff state and active task queue.
14. TASK_UWO_Bridge_Ontology.md has POST-SUBMISSION QUEUE header removed and is marked as Pattern 16 implementation detail.
15. No broken cross-references between any of these documents.
16. Existing patterns 1-8 are untouched (verify diff shows no changes to those entries).
17. Existing final decisions are untouched (verify diff shows only additions to decisions map).
18. All new section numbering is stable and consistent with existing numbering scheme.

---

## What Is NOT Included

- Implementation of the orchestrator endpoint (separate task: TASK_Orchestrator_StageGating_MVP).
- Implementation of the state machine in code (separate task: TASK_Orchestrator_StageGating_MVP).
- Implementation of pattern memory MCP endpoints (post-Cemex).
- Implementation of the adapter pattern (separate task: TASK_Orchestrator_KROS_Adapter_Wrap).
- Implementation of work ontology extraction (separate tasks: TASK_Orchestrator_WorkOntology_SO250 and SO202).
- Any code changes whatsoever. This task is documentation only.
- New patterns 9-14. Numbering gap stays explicit.
- Renumbering of existing patterns.

---

## Naming Determination

All file paths, section numbers, identifier names, and document references mentioned in this task are **descriptive of business intent only**. Determine actual naming from existing repo conventions:

- If the Architecture Vision is named differently than this task implies, use the actual filename.
- If section numbering differs from this task's §X.Y references, use the actual repo's numbering.
- If patterns are documented with different naming conventions (e.g., kebab-case vs PascalCase, separate files vs single document), follow the existing convention.

Do not invent new naming where existing conventions apply. When in doubt about format, match the most recently committed pattern entry's format exactly.
