# TASK_Orchestrator_StageGating_MVP

**Target week:** Week 2 of Cemex CSC 2026 runway (Jun 3 — Jun 9, 2026)
**Estimated effort:** ~45 hours (state machine ~24h + session model ~12h + policy enforcement ~6h + tests ~8h)
**Dependencies:** TASK_Orchestrator_PatternsSection_DocsUpdate (Week 1) must be complete so architectural decisions are codified
**Scope:** Foundation for all subsequent orchestrator work. No work ontology extraction yet (that comes in Week 3 tasks).

---

## Mantra (read this fully before ANY action)

Before writing a single line of code, do all of the following:

1. **Read the entire repo structure.** Identify where the existing MCP server lives, how tools are registered, what framework is used (FastAPI, MCP Python SDK, etc.), where Cloud SQL migrations live, where Pydantic models live, where audit logs are currently written.
2. **Read the Architecture Vision document end-to-end**, especially the newly added sections from Week 1 (Doctrine v2 layers, workflow state machine, tool metadata registry, replay guarantee). Your implementation must match what is documented.
3. **Read the Orchestrator Spec PDF** in Project Knowledge (`STAVAGENT_Orchestrator_WorkOntology_TaskSpec.pdf`). Sections 3, 7.1, 8, 9, 10, 12 are most relevant.
4. **Read all 9 existing MCP tool implementations** to understand how they are currently invoked, what their inputs/outputs are, and which workflow stage each belongs to.
5. **Read existing Cloud SQL schema** for any tables that already capture session-like state. Do not create duplicate tables.
6. **Read existing audit logging code** if any exists. Extend rather than replace.
7. Only then begin coding.

This is foundation work. Other Week 3 and Week 4 tasks build on top. Stability and correctness here matter more than speed.

---

## Pre-Implementation Interview

Ask the user (via AskUserQuestion) before writing code — wait for all answers:

1. **How are MCP tools currently registered?** Decorator pattern, central manifest file, automatic discovery from filesystem, or something else?
2. **Where do Cloud SQL migrations live** and what is the naming convention (timestamp prefix, sequential numbering, etc.)?
3. **Is there an existing session model** in the codebase? If yes, what fields does it have? This task should extend it, not create a parallel one.
4. **Is there an existing audit log table?** Schema? Append-only constraint already in place?
5. **How is the MCP server currently deployed?** Cloud Run service name, port, container entrypoint?
6. **Are there existing Pydantic models for ProjectContext or similar?** This task introduces session state; needs to integrate with existing project state, not replace it.
7. **How are users authenticated?** JWT? Session cookie? Cloud IAM? The session model needs user_id.
8. **Is there an existing concept of workflow_stage anywhere in the codebase?** Even informal (string field, comment, etc.)?
9. **What is the rate limiting / billing infrastructure?** Tool calls need to integrate with whatever billing model exists.
10. **Is there existing cross-user isolation work in progress?** The session model must include tenant/project isolation from day one — confirm scope of the parallel cross-user isolation P0 task.

---

## Context

The current MCP server exposes approximately 9 tools as independent capabilities:

- read_project_documentation (or analogous document reader)
- analyze_construction_document
- parse_construction_budget
- classify_construction_element
- calculate_concrete_works
- create_work_breakdown
- find_urs_code
- find_otskp_code
- search_czech_construction_norms

Each is callable independently. There is no orchestration above them. A user request like "read this PDF and create a work list" cannot be solved by one tool call; it requires a chain of calls. There is no server-side mechanism that prevents calling find_urs_code before work atomization is complete (Pattern 15 violation).

This task introduces the orchestration layer:

1. A single canonical orchestrator endpoint that drives multi-step workflows
2. A workflow state machine that tracks which stage a session is in
3. A tool metadata registry with side_effect_level and policy_stage declarations
4. Server-side policy enforcement that refuses tools not allowed in current state
5. A session model in Cloud SQL that persists workflow state across HITL pauses and resumes
6. A HITL pause/resume mechanism for when orchestrator needs user input

This task does NOT implement the work ontology extraction itself (next week). It builds the rails on which extraction will run.

---

## Business Logic

### 1. Workflow State Machine

A single canonical primitive that tracks workflow stage per session. Eight states:

- DOCUMENT_ANALYSIS
- WORK_ATOMIZATION
- DECOMPOSITION (optional, not all workflows enter this state)
- CATALOG_BINDING
- PRICING
- REVIEW
- COMMIT_PENDING
- COMMITTED
- EXPORTED

Each state has an allow-list of tools that can be invoked in that state. State transitions are explicit (orchestrator triggers them after validation passes). All transitions are logged.

Implementation guidance: state machine should be implemented as a deterministic primitive, not a class with hidden state. Given a current state and a desired transition, the primitive should return either (a) the new state, or (b) a violation error explaining why the transition is not allowed.

### 2. Tool Metadata Registry

Every MCP tool ships with a manifest. The registry is server-validated at startup — tools without a manifest are refused (server fails to start, with clear error).

Manifest fields:

- tool_name
- category (deterministic_calculation / document_processing / catalog_binding / commit / session / decision / render / policy_meta)
- side_effect_level (enum: none / session_only / draft_only / persistent_mutation / reversible_mutation / external_io)
- requires_session (boolean)
- writes_state (boolean)
- policy_stage (array of states in which this tool is allowed to be invoked)
- audit_required (boolean)
- replayable (boolean)
- billable (boolean)
- credits (integer)
- requires_confirmation (boolean)
- version (semantic version string)

The registry is queryable by orchestrator: "what tools are allowed in state X?" returns the filtered list.

### 3. Server-Side Policy Enforcement

When any tool is invoked through the MCP gateway, the gateway validates before calling the tool:

- If the tool is not registered: refuse with error code UNKNOWN_TOOL
- If the tool requires_session but no session_id is in the request: refuse with error code SESSION_REQUIRED
- If the current session state is not in the tool's policy_stage allow-list: refuse with error code STAGE_VIOLATION, log the attempt to the audit table including tool name, attempted state, current session state, user_id, timestamp
- If the tool requires_confirmation but no confirmation_token in request: refuse with error code CONFIRMATION_REQUIRED
- If the tool writes_state and the session is in a terminal state (COMMITTED, EXPORTED) and the tool is not in the explicit re-export allow-list: refuse with error code SESSION_TERMINAL

Critical: enforcement is in the gateway, not inside individual tools. A tool's own code must not contain stage-checking logic — that creates duplication and is error-prone. The gateway is the single enforcement point. Tools are dumb and trust the gateway.

### 4. Session Model

A Cloud SQL table that tracks workflow runs. Per-session state machine position. Schema fields (descriptive only — actual column names from existing convention):

- Primary key (UUID)
- User reference (foreign key to users)
- Project reference (foreign key to projects)
- Current workflow state (enum matching the 8 states above)
- Created timestamp
- Last updated timestamp
- TTL / expiry timestamp (configurable per project, default 7 days)
- Status (active / committed / abandoned / undone)
- Partials (JSONB — accumulated calculation results within the session)
- Aggregates (JSONB — cross-element rollups)
- Drafts (JSONB — draft commits awaiting confirmation)
- Decisions (JSONB — explicit decision records with confidence, source, reasoning)
- Conversation log (JSONB — for replay)
- Tool calls log (JSONB — for audit and replay)

Resume capability: any session in a non-terminal state can be resumed. Resume returns full session state to the caller (UI or MCP client) so they can continue the workflow from where it paused.

Critical: this table must include both user_id and project_id with proper isolation. If the parallel cross-user isolation P0 task introduces row-level security or similar, this table must comply.

### 5. Orchestrator Endpoint

A single REST endpoint that drives workflows. Input shape:

- user_request (free-text intent)
- files (array of file references — file_id, file_url, or content_base64)
- options (target_output, country, market, language, include_codes, include_prices, allow_assumptions)
- session_id (optional — if continuing an existing session)
- confirmation_token (optional — if confirming a draft commit)
- user_response (optional — if responding to a previous HITL pause)

Output shape:

- status (completed / completed_with_gaps / paused_for_input / paused_for_confirmation / failed)
- session_id
- intent (classified)
- workflow_stage (current state)
- result (structure varies by intent)
- assumptions (array)
- missing_inputs (array — for HITL pauses)
- warnings (array)
- tool_calls (array — for transparency)
- quality (coverage_score, quantity_completeness, source_traceability, catalog_code_coverage, pricing_completeness, review_flag_count, assumption_count)

Internally, the orchestrator:

1. Classifies intent from user_request (or uses target_output if specified)
2. Looks up the workflow definition for that intent
3. Executes workflow steps in sequence, calling tools through the gateway
4. After each step, validates results and decides next action (proceed, pause for HITL, request confirmation, terminate)
5. Updates session state in Cloud SQL after each tool call
6. Returns final or paused status

The orchestrator code is thin — it loops over a workflow definition. The workflow definition itself lives in a config (YAML or JSON) so it can be modified without redeploying.

### 6. HITL Pause/Resume

When the orchestrator detects a condition that requires user input:

- Coverage gap > threshold (default: quantity_completeness < 0.5 for critical phase)
- Confidence below threshold (default: < 0.7 for Stage 3 catalog binding decisions, < 0.5 for Stage 1 element classification)
- File swap or ambiguity detected (per existing file_swap_detection pattern)
- Stage 1 Definition of Done failure (missing formula or source on a work item)
- Conflicting source signals (TZ says X, drawing says Y for same parameter)

When this happens, the orchestrator:

1. Updates session state with the specific pause condition and what input is needed
2. Returns status=paused_for_input with a question structure to the caller
3. The caller (UI or MCP client) presents the question to the user
4. User responds, the caller calls the orchestrator again with user_response in the input
5. Orchestrator validates the response, integrates it into session state, resumes the workflow

The pause/resume mechanism must be replayable — same paused state plus same user response plus same versions must produce same continuation.

### 7. Existing Tool Migration

The 9 existing MCP tools must be wrapped with manifests. Initial classification:

- read_project_documentation → policy_stage: all stages, side_effect_level: none
- analyze_construction_document → policy_stage: DOCUMENT_ANALYSIS, WORK_ATOMIZATION; side_effect_level: none
- parse_construction_budget → policy_stage: all stages; side_effect_level: none (this is parsing, not catalog binding)
- classify_construction_element → policy_stage: WORK_ATOMIZATION; side_effect_level: none
- calculate_concrete_works → policy_stage: WORK_ATOMIZATION, DECOMPOSITION; side_effect_level: none (this is the canonical calculator)
- create_work_breakdown → policy_stage: WORK_ATOMIZATION when invoked with mode=work_first; otherwise refuse (Pattern 15 violation). Mode parameter must be added.
- find_urs_code → policy_stage: CATALOG_BINDING only; side_effect_level: none
- find_otskp_code → policy_stage: CATALOG_BINDING only; side_effect_level: none
- search_czech_construction_norms → policy_stage: all stages; side_effect_level: none

create_work_breakdown specifically needs refactoring to accept a mode parameter (work_first vs work_with_catalog). In work_first mode it must not auto-attach catalog codes or prices. Pattern 15 enforcement.

---

## Domain Rules

- Workflow stage is **per session**, not global. Different concurrent sessions for the same project can be in different stages.
- Tool invocations must include session_id when the tool requires_session.
- State transitions are orchestrator-initiated, not tool-initiated. Tools do not change session state.
- Pattern 15 Stage 1 forbidden tools: any find_*_code, any catalog adapter, any price calculation.
- Pattern 15 Stage 1 required work item fields: formula, source, audit_trail. Tools that produce work items must guarantee these fields.
- Audit trail is append-only at the DB level (constraint, not application logic).
- Confidence thresholds (initial defaults, configurable):
  - < 0.5 for any critical Stage 1 decision → HITL pause
  - < 0.7 for Stage 3 catalog binding → requires_review flag, do not auto-bind
  - < 0.85 even with auto-bind → still goes to draft, not direct commit
- Resume from any non-terminal state preserves all session data. No data loss on pause.
- Single canonical /orchestrate endpoint. UI calls it. MCP clients call it (through MCP gateway). Future ADK calls it. No parallel orchestration in any client.
- No business logic in orchestrator endpoint code itself. Workflow definitions are data (YAML or JSON), not code.
- The orchestrator must support replay: given the same session inputs and same tool versions, the same workflow run produces the same outputs.

---

## Acceptance Criteria

1. Orchestrator endpoint exists and accepts the documented input shape (user_request, files, options, optional session_id, confirmation_token, user_response).
2. Workflow state machine is implemented with the 8 documented states as an enum. State transitions are explicit and validated.
3. Tool metadata registry exists with all required manifest fields. The side_effect_level enum has all 6 values.
4. Registry is validated at server startup. A tool without a manifest causes the server to refuse to start with a clear error message.
5. All 9 existing MCP tools have manifests assigned with correct policy_stage values per the migration plan above.
6. Server-side policy enforcement is in the MCP gateway, not in individual tools. Verified by code review: no stage-checking logic inside any tool body.
7. Stage 1 policy violation: attempting to call find_urs_code when session state is WORK_ATOMIZATION returns error code STAGE_VIOLATION and creates an audit log entry.
8. Tool without session_id when requires_session=true returns error code SESSION_REQUIRED.
9. Session model exists in Cloud SQL with all documented fields, including user_id and project_id for tenant isolation.
10. Session model has TTL (default 7 days, configurable per project).
11. Session can be resumed from any non-terminal state — verified by integration test that creates a session, advances it to WORK_ATOMIZATION, "pauses" it, then resumes and verifies state is identical.
12. HITL pause/resume flow works: orchestrator returns status=paused_for_input with a question structure; client calls back with user_response; orchestrator integrates and continues.
13. Audit log append-only constraint is enforced at the DB level (DB constraint or RLS rule, not application code).
14. Audit log entries include: tool name, tool version, inputs hash, outputs hash, policy hash, core engine version, session_id, user_id, project_id, timestamp.
15. Workflow definitions live in a config file (YAML or JSON), not hardcoded in orchestrator endpoint code.
16. State transitions are logged to the audit table with the transition source (tool name or orchestrator decision rule that triggered it).
17. End-to-end integration test: a stubbed workflow PDF → work list → KROS binding (stub) → XLSX (stub) runs through the orchestrator without errors. No actual document parsing required at this stage — test fixtures simulate tool outputs.
18. Cross-user isolation test: session created by user A cannot be read or modified by user B. Verified by integration test using two users.
19. create_work_breakdown refactored to accept mode parameter. mode=work_first does not attach catalog codes or prices.
20. Replay test: same session inputs + same tool versions produce same final session state. Verified by replaying a recorded session.

---

## What Is NOT Included

- Actual work ontology extraction implementation. That is Week 3 (TASK_Orchestrator_WorkOntology_SO250 and SO202).
- KROS adapter implementation. That is Week 4 (TASK_Orchestrator_KROS_Adapter_Wrap).
- ADK runtime. DEFER post-Cemex.
- Pattern memory write/score endpoints. DEFER post-Cemex. Only stub read endpoints can be included if trivial.
- Multi-tenant isolation hardening beyond basic user_id/project_id checks. The parallel cross-user isolation P0 task handles deeper hardening.
- Frontend integration. The Web UI calls the orchestrator, but UI-side wiring is a separate task.
- Performance optimization beyond functional correctness. Correctness first, performance later if needed.
- Voice or streaming responses.
- Knowledge acquisition pipeline (Perplexity / OpenAlex / Crossref). Separate workstream, post-Cemex.
- Monte Carlo or probabilistic schedule layer. Post-Cemex.
- Takt planning beyond concept mention in Architecture Vision. Post-Cemex.
- Render-to-form-template integration beyond stub. Post-Cemex polish.
- explain_decision implementation. Stub returning placeholder is acceptable for this week; real implementation is part of Week 4.
- Quality metrics computation beyond placeholder values. Real computation is part of Week 3/4 tasks.

---

## Naming Determination

All endpoint paths, table names, column names, type names, file paths, and module names mentioned in this task are **descriptive of business intent only**. Determine actual naming from existing repo conventions:

- If the existing MCP server uses snake_case for tool names, use snake_case. If PascalCase, use PascalCase.
- If existing Cloud SQL tables use plural names, use plural. If singular, use singular.
- If existing migrations use timestamp prefixes, use timestamp prefixes.
- If there is an existing session table or workflow run table that this task should extend rather than duplicate, extend it.
- If "agent_sessions" is the existing convention, use that. If "workflow_runs" or "orchestrator_sessions", use that instead.

Do not invent new naming where existing conventions apply. When in doubt, look at the most recent commits and match their style exactly.
