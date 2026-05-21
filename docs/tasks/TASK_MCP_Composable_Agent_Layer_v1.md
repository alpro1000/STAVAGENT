# TASK: MCP Composable Agent Layer — Full Agent-First Orchestration

> **Verze:** v1 (expanded after Alexander's review 2026-05-20)
> **Datum:** 2026-05-20
> **Priorita:** P1 (post-říms calibration, pre-Cemex CSC pitch)
> **Effort estimate:** ~11-12 dnů Claude Code session (rozdělené do 5 phases)
> **Depends on:** `TASK_Rimsa_Calibration_FullStack_v1.md` (atomic_calculate must be cleaned first)
> **Affects:** MCP server + Core Engine atomic API + Monolit-Planner + Registry + SmartExtractor

---

## Why this task exists (problem statement)

UI Calculator a MCP mají **fundamentálně různé UX paradigmy**:

| Aspect | UI Calculator | MCP Agent |
|---|---|---|
| User | Human estimator | LLM agent |
| Cognitive model | Guided form, opinionated | Composable atomic tools |
| Sborné pozice | ❌ UI struggles to decompose | ✅ Natural — N tool calls |
| Memory | Form state | Cross-call session context |
| Output | 1 row → Monolit-Planner | 1 agg → Planner + N detail → Registry TOV |

**Concrete pain points:**

1. **Sborná pozice problem:** "ZÁKLADY ŽB 350 m³" může obsahovat OP1+OP2+P1 s různými exposures. UI form to nezvládne, agent decompose přirozeně.

2. **Frontend patterns nefungují:** 8 patterns z `STAVAGENT_PATTERNS.md` jsou defined ale **nepracují správně v UI** (silent failures, špatné summary, missed extractions). Agent layer s server-side policy enforcement musí je VYNUTIT.

3. **Form templates rigidity:** Monolit-Planner tabulka, Registry TOV, krycí list, soupis prací — každý má **přesný formát**. Agent musí render output IDENTICKY s těmito templates, ne free-form JSON.

4. **End-to-end gap:** Agent dnes vrátí výsledek a stop. Reálný estimator dělá workflow: čte TZ → klasifikuje → počítá → rozhoduje → ptá se na nejasnosti → finalizuje → ukládá. Agent musí to samé.

5. **Knowledge bypass:** Hardcoded matrices v engine kódu místo lookup do `B*` (per KNOWLEDGE_PLACEMENT_GUIDE). Decision-making bez normativní citace.

---

## Architecture vision (expanded)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORE ENGINE (single source of truth)         │
│   atomic_calculate(element_type, volume, ...) → CalcResult      │
│   ← used by both UI and agent orchestrators                     │
└───────────────┬──────────────────────────┬──────────────────────┘
                │                          │
                ↓                          ↓
   ┌────────────────────────┐   ┌──────────────────────────────┐
   │ UI orchestrator        │   │ Agent orchestrator (THIS)    │
   │ (Monolit-Planner UI)   │   │                              │
   │                        │   │ ATOMIC TOOLS (P0):           │
   │ • Single guided form   │   │  • calculate_partial         │
   │ • Field visibility     │   │  • aggregate_partials        │
   │ • Smart defaults       │   │  • commit_to_planner         │
   │ • Inline AI hints      │   │  • commit_to_registry_tov    │
   │                        │   │  • draft_commit              │
   │                        │   │  • undo_commit               │
   │                        │   │                              │
   │ → 1 calc → 1 row       │   │ DOCUMENT TOOLS (P1):         │
   │                        │   │  • read_project_documentation│
   │                        │   │  • decompose_position        │
   │                        │   │  • apply_document_pattern    │
   │                        │   │  • request_document_or_input │
   │                        │   │                              │
   │                        │   │ DECISION TOOLS (P1):         │
   │                        │   │  • explain_decision          │
   │                        │   │  • request_human_review      │
   │                        │   │  • compare_partials          │
   │                        │   │  • replay_session            │
   │                        │   │                              │
   │                        │   │ ADVISOR TOOLS (P2):          │
   │                        │   │  • consult_rozpoctar         │
   │                        │   │  • consult_stavbyvedouci     │
   │                        │   │  • consult_projektant        │
   │                        │   │                              │
   │                        │   │ FORM RENDERING (P2):         │
   │                        │   │  • render_to_form_template   │
   │                        │   │  • list_form_templates       │
   │                        │   │                              │
   │                        │   │ SESSION (P0):                │
   │                        │   │  • session memory (Cloud SQL)│
   │                        │   │  • policy enforcement layer  │
   └────────┬───────────────┘   └────────┬─────────────────────┘
            │                            │
            └────────┬───────────────────┘
                     ↓
          ┌────────────────────────┐
          │  project.json          │  ← Monolit-Planner aggregate
          │  Registry TOV rows     │  ← Detailed partials
          │  Form output templates │  ← Krycí list, soupis, etc.
          └────────────────────────┘
```

---

## PRE-IMPLEMENTATION INTERVIEW (mandatory)

### Phase A — Discovery (must run first)

1. **Map current MCP tool surface** — všechny tool functions, signatures, response shapes
2. **Identify atomic vs orchestrated** — které tools jsou pure, které mají side effects
3. **Map UI ↔ Core duplication** — kde je calculator logic duplicated (TypeScript v Monolit-Planner vs Python v Core)
4. **Map project.json schema** — current positions[], sub-elements support?
5. **Map Registry TOV API** — REST endpoints, schema, batch insert support
6. **Identify session storage option** — Cloud SQL table vs Redis vs project.json embed
7. **Identify existing form templates** — kde v repo jsou definované Monolit-Planner table schema, Registry TOV schema, krycí list, soupis prací format?
8. **Identify document patterns** — z STAVAGENT_PATTERNS.md 8 patterns, where in code, what's broken
9. **Identify SmartExtractor state** — current capabilities, known gaps
10. **Identify hardcoded matrices** — per říms task Phase A7 findings

Output: Markdown report + user confirmation BEFORE any code.

---

## Phase P0 — Atomic primitives + Session memory (foundation)

### P0.1 — `atomic_calculate` as canonical primitive

**Current:** Calculator logic distribuováno mezi `concrete-agent/packages/core-backend/app/calculator/...` (Python) a `Monolit-Planner/shared/src/calculators/...` (TypeScript).

**Target:** Single canonical implementation v Core Engine.
- Pure function, no side effects
- Returns: schedule, formwork, rebar, cost, audit_trail, sources, warnings
- UI a MCP volají **stejný primitive** přes API

**Acceptance:** Identical input → mathematically identical output via UI i MCP.

### P0.2 — `calculate_partial` (atomic, session-aware)

Single sub-element calculation, stored v session memory.

```yaml
calculate_partial:
  inputs:
    session_id: str (auto-generated if missing)
    position_code: str (OTSKP/URS)
    sub_element_label: str (free text, e.g. "OP1 základ pravý")
    element_type: str (canonical)
    volume_m3: float
    ... atomic_calculate params
  outputs:
    partial_id: str (UUID)
    session_id: str (echoed)
    result: CalcResult (full audit + sources + warnings)
    stored: bool
```

### P0.3 — `aggregate_partials`

Combine N partials → 1 aggregate.

```yaml
aggregate_partials:
  inputs:
    session_id: str
    partial_ids: list[str]
    mode: enum {summary | parallel_max | sequential_sum}
    position_total_check: float? (validation)
  outputs:
    aggregate_id: str
    totals: {volume_m3, cost_czk, days_calendar}
    weighted_avg_curing_class: int
    union_of_exposures: list[str]
    breakdown: list[PartialSummary] (no info loss)
    warnings: list[str] (incl. mismatch warning)
```

### P0.4 — `draft_commit` (NEW per Alexander)

**Purpose:** Agent může držet **draft** v session před okončitelným commit. User schvaluje.

```yaml
draft_commit:
  inputs:
    session_id: str
    aggregate_id: str
    target: enum {monolit_planner | registry_tov | both | local_only}
    notes: str?
  outputs:
    draft_id: str
    preview: dict (what would be written)
    expires_at: timestamp (+24h default)
    requires_confirmation: bool
```

Draft je viditelný v UI Monolit-Planner jako "pending agent suggestion" — user klikne "Accept" → real commit.

### P0.5 — `commit_to_monolit_planner` + `commit_to_registry_tov`

Po draft → finální commit s idempotency token. Detail v původním task draftu.

### P0.6 — `undo_commit` (NEW per Alexander)

```yaml
undo_commit:
  inputs:
    commit_id: str (from previous commit response)
    reason: str?
  outputs:
    success: bool
    rolled_back_fields: list[str]
    audit_log_entry: str
```

**Behavior:** Reverts the specific commit. Possible only within commit_undo_window (default 7 days). Logs reason. Cannot undo if subsequent commits depend on this one (cascade detection).

### P0.7 — Session memory layer

**Storage:** Cloud SQL table `agent_sessions` (per říms task already setup).

```yaml
agent_sessions:
  session_id: uuid PK
  project_id: str FK
  user_id: str FK
  created_at: timestamp
  expires_at: timestamp (+7 days)
  status: enum {active | committed | abandoned | undone}
  partials: jsonb (list of partial results)
  aggregates: jsonb (list of aggregates)
  drafts: jsonb (pending commits)
  commits: jsonb (executed commits with undo refs)
  decisions: jsonb (NEW — log of decisions with citations)
  conversation_log: jsonb (NEW — user-agent dialog history)
```

### P0.8 — Server-side policy enforcement

Per `STAVAGENT_Agent_First_Architecture_Vision.md` §3.4: patterns must be enforced **server-side**, ne jen prompt-suggested.

Implement `app/policies/` module which physically prevents:
- Pattern bypass (e.g. partial DXF extraction when full required)
- Resource cap violations (from říms task)
- Position total mismatch without explicit confirmation
- Skip mandatory phases (Phase 0b discipline)

Each tool call goes through policy check before execution. Audit logged.

---

## Phase P1 — Document workflow + Decision tools

### P1.1 — `read_project_documentation`

Agent reads TZ + výkresy + statika z project.json or uploaded files. Uses existing SmartExtractor + 8 codified patterns from `STAVAGENT_PATTERNS.md`.

```yaml
read_project_documentation:
  inputs:
    project_id: str
    document_types: list[str] {tz | vykres | statika | geologie | soupis}
    focus_position: str? (optional — focus extraction on specific code)
  outputs:
    extracted_params: list[ExtractedParam]
    coverage_report: CoverageReport
    patterns_applied: list[str]
    patterns_skipped: list[{name, reason}]
    needs_user_input: list[str] (gaps)
```

**Critical:** Uses EXISTING patterns, but **server-side enforced** (not prompt-based skip allowed).

### P1.2 — `decompose_position`

Reads TZ context → suggests sub-elements pro sborná pozice.

```yaml
decompose_position:
  inputs:
    session_id: str
    project_id: str
    position_code: str
    position_total_m3: float
  outputs:
    suggested_decomposition: list[
      {sub_element_label, element_type, estimated_volume_m3, evidence, confidence}
    ]
    coverage_check: {sum, expected, delta_pct}
    needs_user_input: list[str]
    warnings: list[str]
```

### P1.3 — `apply_document_pattern` (NEW per Alexander)

**Why:** Frontend has patterns implemented but **broken** (per Alexander's analysis). Agent must execute them correctly server-side.

```yaml
apply_document_pattern:
  inputs:
    session_id: str
    pattern_name: enum {
      file_swap_detection,
      tz_validator_iterative_refinement,
      multi_view_items_json,
      workflow_gate_vs_catalog_grouping,
      honest_detail_fallback_DSP_scope,
      exhaustive_dxf_extraction,
      subdodavatel_granular_mapping,
      per_objekt_chunking
    }
    input_files: list[str] (paths or refs)
    config: dict (pattern-specific)
  outputs:
    pattern_output: dict (pattern-specific schema)
    warnings: list[str]
    audit_trail: list[str]
```

Each pattern enforces its own discipline (e.g. exhaustive_dxf_extraction MUST extract ALL entity types — agent cannot request partial).

### P1.4 — `request_document_or_input` (NEW per Alexander)

When agent lacks data: ask user for TZ, výkres, or manual entry.

```yaml
request_document_or_input:
  inputs:
    session_id: str
    requesting_for: str (what's needed and why)
    options: list[
      {type: upload_pdf | manual_entry | skip},
      ...
    ]
    blocking: bool (does workflow stop until response?)
  outputs:
    request_id: str
    waiting_for_user: bool
    timeout_seconds: int
```

UI displays request as modal/notification, user responds, response stored in session.

### P1.5 — `explain_decision` (NEW — MANDATORY per Alexander)

```yaml
explain_decision:
  inputs:
    session_id: str
    decision_ref: str (e.g. partial_id, aggregate_id, commit_id)
  outputs:
    decision_summary: str
    rationale: str (why this decision)
    citations: list[
      {source_type: enum {norm | research | tech_card | productivity | calibration | judgement},
       source_id: str (e.g. "TKP 18 §7.8.3", "methvin.co D12"),
       quote: str (relevant excerpt),
       confidence: float}
    ]
    alternatives_considered: list[
      {option, reason_not_chosen, score}
    ]
    confidence_overall: float
```

**Critical:** Every decision MUST have either norm citation OR explicit "based on professional judgement because X". No silent defaults.

### P1.6 — `request_human_review` (NEW per Alexander)

```yaml
request_human_review:
  inputs:
    session_id: str
    decision_ref: str
    risk_level: enum {low | medium | high | critical}
    reason: str
    proposed_action: str
    alternatives: list[str]
  outputs:
    review_id: str
    notification_sent: bool (UI badge + optional email)
    waiting_for_response: bool
    blocking: bool
```

Triggers UI notification (badge on calculator + project), optional email/Slack. Workflow may pause if blocking=true.

### P1.7 — `compare_partials` (NEW per Alexander)

```yaml
compare_partials:
  inputs:
    session_id: str
    partial_ids: list[str]
    comparison_aspects: list[
      enum {cost | days | formwork | rebar | curing | exposure | element_type}
    ]
  outputs:
    comparison_matrix: dict (per aspect per partial)
    significant_differences: list[
      {aspect, partial_a, partial_b, delta, significance}
    ]
    insights: list[str] (auto-generated observations)
    recommendations: list[str]
```

Used for "what if all foundations were XF4 vs current mix" analysis.

### P1.8 — `replay_session` (NEW per Alexander)

```yaml
replay_session:
  inputs:
    base_session_id: str
    overrides: dict (params to change)
    new_session_id: str? (auto-generated if missing)
  outputs:
    new_session_id: str
    diff_summary: dict (what changed vs original)
    full_results: SessionState
```

Replays all partials with new parameters, useful for what-if scenarios.

---

## Phase P2 — Multi-persona Advisor + Form Templates

### P2.1 — Multi-persona advisor tools (NEW per Alexander)

Three perspectives, each callable independently:

```yaml
consult_rozpoctar:  # Estimator perspective
  inputs:
    session_id: str
    decision_ref: str | aggregate_id
  outputs:
    perspective: "rozpoctar"
    observations: list[str] (focus: OTSKP coverage, ZZVZ compliance, krycí list completeness, VRN/ZS, ceny)
    flags: list[
      {severity, message, suggested_fix}
    ]
    suggested_additions: list[str] (items potentially missing)
```

```yaml
consult_stavbyvedouci:  # Site manager perspective
  inputs: (same as above)
  outputs:
    perspective: "stavbyvedouci"
    observations: list[str] (focus: pour sequence, harmonogram realism, doprava, lešení, šablony, weather window, koordinace s jinými objekty)
    flags: list[...]
    suggested_additions: list[str] (pomocné práce, mezisklad, dočasné konstrukce)
```

```yaml
consult_projektant:  # Designer perspective
  inputs: (same)
  outputs:
    perspective: "projektant"
    observations: list[str] (focus: TZ compliance, norms adherence, technical solutions, dilatace, kotvy, izolace)
    flags: list[...]
    suggested_additions: list[str] (technical details often forgotten)
```

**Triangulation:** Each persona's findings get fed into `explain_decision` with their citation source clearly tagged.

### P2.2 — Form template rendering (NEW per Alexander — CRITICAL)

System has **specific output forms** that agent must match identically:

```yaml
list_form_templates:
  outputs:
    templates: list[
      {template_id, name, description, schema, example}
    ]

  Templates include:
    - "monolit_planner_table_row" — exact column schema for project.json positions[]
    - "registry_tov_row" — Registry TOV row format
    - "kryci_list_v2025" — krycí list rozpočtu format
    - "soupis_praci_xc4" — exported XC4 soupis format
    - "gantt_export" — Gantt chart export format
    - "audit_trail_pdf" — PDF audit trail layout
    - ... additional forms as discovered in repo
```

```yaml
render_to_form_template:
  inputs:
    session_id: str
    template_id: str
    source_refs: list[str] (partial_ids, aggregate_ids, etc.)
    overrides: dict (custom fields)
  outputs:
    rendered_output: dict (matches template schema exactly)
    validation: {valid: bool, errors: list[str]}
    preview_url: str (if applicable)
```

**Critical:** Outputs must match templates **byte-for-byte** where possible (same field names, same casing, same units). Agent cannot freelance JSON structure.

---

## Phase P3 — End-to-end orchestrator workflows (the "smart user")

### P3.1 — Workflow templates

Pre-defined agent workflows that compose tools into end-to-end tasks:

```yaml
workflow: "estimate_position_from_tz"
  steps:
    1. read_project_documentation(types=[tz, vykres], focus=position_code)
    2. decompose_position(position_code, total_m3)
    3. for each sub_element:
         calculate_partial(...)
         if missing_input → request_document_or_input(...)
         if high_risk → request_human_review(...)
    4. aggregate_partials(all partial_ids)
    5. consult_rozpoctar + consult_stavbyvedouci + consult_projektant
    6. explain_decision(aggregate_id)
    7. draft_commit(target=user_choice)
    8. wait_for_user_confirmation
    9. commit_to_monolit_planner + optionally commit_to_registry_tov
```

```yaml
workflow: "what_if_analysis"
  steps:
    1. replay_session(base_session, overrides={exposure_class: XF4})
    2. compare_partials(original_partials, new_partials)
    3. explain_decision (each difference)
    4. render_to_form_template (comparison report)
```

```yaml
workflow: "review_existing_position"
  steps:
    1. read existing position from project.json
    2. consult_rozpoctar (audit)
    3. consult_stavbyvedouci (feasibility check)
    4. consult_projektant (technical correctness)
    5. flag issues for human review if high severity
```

### P3.2 — Conversational protocol

Agent can interleave tool calls with user-facing messages:

- "Začínám s analýzou pozice ZÁKLADY ŽB. Načítám TZ..."
- "Našel jsem 3 sub-elementy. Souhlasíš s decomposition? [Yes/Modify]"
- "OP1 a OP2 vypadají s XF3, ale P1 by mohl být XF1 — nejsem si jist. Můžeš mi ukázat výkres D.1.4 nebo upřesnit?"
- "Dokončil jsem 3 partial calculations. Aggregate je 350 m³, 2.25M Kč. Chceš committed do Monolit-Planneru jako jeden řádek + do Registry TOV jako 3 detailní řádky?"

UI must support this conversational flow (chat-style overlay or sidebar).

### P3.3 — Decision audit + replay

Every workflow stores complete decision trail:

- What was input
- What patterns were applied
- What citations were used
- What user confirmations occurred
- What alternatives were considered

Replay reconstructs entire decision tree, useful for:
- Code review of agent decisions
- Training data for future improvements
- Compliance / audit requirements

---

## Phase P4 — Advanced agent features (productionization)

### P4.1 — `agent_dry_run` mode (NEW)

**Purpose:** Run full workflow **without commit** to persistent stores. Useful for testing, demo, what-if exploration.

```yaml
agent_dry_run:
  inputs:
    workflow_name: enum (any from P3.1)
    parameters: dict (workflow-specific)
    dry_run_mode: bool = true
    output_format: enum {chat_markdown | rich_preview | both}
  outputs:
    session_id: str (TTL=24h instead of 7 days)
    full_results: WorkflowResults
    preview_md: str (chat-formatted)
    preview_url: str? (rich preview if requested)
    would_have_committed_to: list[str] (e.g. ["monolit_planner", "registry_tov"])
    cost_in_credits: int (actual cost — dry_run still uses tools)
```

**What "commit" means (clarification):**

In normal mode, commit means **persistent write** to:
- `project.json` — Monolit-Planner table (visible to all users opening project)
- Cloud SQL Registry TOV rows (visible in Registry kiosk)
- GCS Cloud Storage — generated PDF/XLSX outputs (downloadable)

In dry_run:
- All tools execute (credits still used — tools really run)
- Session memory keeps results (TTL=24h instead of 7 days)
- Output is **only in chat** as markdown OR as rich preview overlay in UI
- Watermark "DRY RUN" on any rendered forms
- After 24h, dry_run session auto-expires

**User can convert dry_run → real run:**
```yaml
convert_dry_run_to_real:
  inputs:
    dry_run_session_id: str
  outputs:
    new_session_id: str (real run, TTL=7d)
    committed_to: list[str]
```

### P4.2 — Cross-session learning (semantic fingerprints) (NEW)

**Problem (per Alexander):** Project/element names are unreliable for similarity matching. "Pilíř P1" can mean completely different elements across projects. Must use **structural fingerprints**, not text matching.

**Fingerprint schemas:**

```yaml
project_fingerprint:
  project_type: enum {most_silnicni, most_zelezni, estakada, opera_zed, propustek, tunel, ...}
  scale_bucket: enum {S | M | L | XL}              # by total_volume_m3
  span_bucket: enum {0-10 | 10-25 | 25-50 | 50-100 | 100+}
  num_spans: int (bucketed)
  nk_subtype: str (categorical)
  is_prestressed: bool
  exposure_profile: dict                            # {XF3: 0.4, XF4: 0.3, XA2: 0.2, XC2: 0.1}
  geology_class: str
  has_gwt: bool
  construction_technology: enum {fixed_scaffolding | MSS | cantilever | lifting}
  fingerprint_hash: str
  feature_vector: list[float]                       # embedding for cosine similarity

element_fingerprint:
  element_type: str (canonical)
  size_bucket: enum {S | M | L | XL}                # by volume
  geometry_signature: dict                          # bucketed dimensions
  concrete_class: str
  exposure_set: frozenset                           # canonical sorted
  rebar_class: str
  technology_type: str
  cycle_length_bucket: enum {short | std | long}
  difficulty_modifiers: frozenset                   # e.g. {anchors, surface_C2d}
  fingerprint_hash: str
  feature_vector: list[float]
```

**Storage:** Cloud SQL table `decision_fingerprints` — every committed result stored with fingerprint.

**Tool: `find_similar_decisions`:**

```yaml
find_similar_decisions:
  inputs:
    target_fingerprint: dict
    similarity_threshold: float = 0.8
    max_results: int = 5
    scope: enum {own_projects | organization | all_anonymized}
  outputs:
    matches: list[
      {
        decision_ref: str,
        similarity_score: float,
        matched_features: list[str],     # what made it similar
        differing_features: list[str],    # what differs
        outcome_summary: dict,            # cost, days, quality
        confidence_in_match: float
      }
    ]
    aggregate_insights: list[str]
```

**Critical safeguards:**
- Similarity match is **suggestion**, not auto-apply
- User sees evidence (which projects, what differs)
- Confidence shown explicitly
- Only matches from same user OR same organization (privacy)
- Can be disabled per project ("treat as unique")

### P4.3 — Confidence threshold gating with smart batching (NEW)

**Problem (per Alexander):** "Confidence < 0.7 → request review" sounds blocking. Need maximally convenient UX.

**Solution:** Tiered configurable thresholds + smart batching + quick-approve patterns.

#### Configurable thresholds per decision type

```yaml
confidence_thresholds:
  global_default: 0.7
  per_decision_type:
    pricing_decision: 0.8           # money — stricter
    quantity_decision: 0.75
    geometry_decision: 0.6           # geometry often approximate
    technology_decision: 0.7
    schedule_decision: 0.65
    norm_compliance: 0.85            # legal — strictest
  per_user_override:
    profile: enum {conservative | default | liberal | auto_approve_high}
```

#### Smart batching (key UX improvement)

**Non-blocking accumulation:** Low-confidence decisions don't pause workflow. They accumulate in `session.pending_reviews[]`. At workflow end → single batched dialog with one-click options:
- Accept all
- Approve highlighted
- Postpone — review later
- Cancel workflow

#### Quick-approve learning

After 5 same approvals → bot suggests auto-approve rule:
```
🤖 Vidím že posledních 5× jsi přijal default crew_size=4 pro říms.
   Chceš to nastavit jako auto-approve?
   [Apply for říms only] [Apply for all] [Decline]
```

**Implementation:** Non-blocking by default. Workflow completes even with pending reviews. User notified after.

### P4.4 — `estimate_workflow_cost` + billing context (NEW)

**Problem (per Alexander):** Current billing confusion + multi-tool workflows could exhaust credits silently.

```yaml
estimate_workflow_cost:
  inputs:
    workflow_name: enum (from P3.1)
    parameters: dict (workflow-specific)
    user_api_key: str? (or from auth context)
  outputs:
    estimated_tool_calls:
      - {tool: read_project_documentation, count: 1, cost_per: 10, subtotal: 10}
      - {tool: decompose_position, count: 1, cost_per: 5, subtotal: 5}
      - {tool: calculate_partial, count: 3, cost_per: 5, subtotal: 15}
      - {tool: aggregate_partials, count: 1, cost_per: 3, subtotal: 3}
      - {tool: consult_rozpoctar, count: 1, cost_per: 4, subtotal: 4}
      - {tool: consult_stavbyvedouci, count: 1, cost_per: 4, subtotal: 4}
      - {tool: consult_projektant, count: 1, cost_per: 4, subtotal: 4}
      - {tool: explain_decision, count: 1, cost_per: 1, subtotal: 1}
      - {tool: render_to_form_template, count: 1, cost_per: 2, subtotal: 2}
      - {tool: commit_to_monolit_planner, count: 1, cost_per: 0, subtotal: 0}
    estimated_total_credits: 48
    estimated_duration_seconds: 45-60
    current_user_balance: 47
    advisory_warnings:
      - "Estimated cost (48) slightly exceeds current balance (47). Consider top-up."
    optional_optimizations:
      - {action: "skip consult_*", savings: 12, impact: "no third-party perspective audit"}
      - {action: "skip render_to_form_template", savings: 2, impact: "no PDF generation"}
      - {action: "use cached SmartExtractor", savings: 8, impact: "if TZ already analyzed"}
    user_can_proceed: bool
```

**Critical: 3 billing enforcement modes** (per Alexander "не блокируй меня"):

```yaml
billing_enforcement_modes:
  off:       # dev mode
    user_balance_required: false
    deducts_credits: false
    cost_estimate_shown: true (informational only)

  advisory:  # default for trusted users (admin, beta testers, Alexander himself)
    user_balance_required: false
    deducts_credits: true (logged but not enforced)
    cost_estimate_shown: true (warning if exceeds balance)
    can_proceed_with_insufficient: true (allows negative balance)

  strict:    # standard production for paying users
    user_balance_required: true
    deducts_credits: true
    cost_estimate_shown: true
    can_proceed_with_insufficient: false (HTTP 402 error)
```

**Default mode determined by user role:**
- Admin / internal / beta tester → `off` or `advisory` (Alexander stays here)
- Standard user → `strict`
- Configurable via env var `BILLING_ENFORCEMENT`

**Integration with existing infrastructure** (per `TASK_MCP_Deploy_Auth_Billing_Listings.md` + `TASK_MCP_PricingSync_FastMCPMount.md`):
- `/api/v1/mcp/auth/credits` — read balance
- `/api/v1/mcp/billing/webhook` — Lemon Squeezy top-ups (secret: `stavagent_lmsq_wh_2026`)
- `/api/v1/mcp/pricing` — tool prices (now synced: 11/55/220 Kč)
- `/api/v1/mcp/oauth/token` — OAuth for ChatGPT

**Workflow integration:** Agent workflows automatically call `estimate_workflow_cost` BEFORE starting. User can proceed in advisory mode without blocking.

---

## Knowledge base integration

Every decision MUST cite knowledge sources from `B*`:

- **B7 norms** (TKP, ČSN, EN, DIN) — primary citations
- **B6 research** (Pokorný-Suchánek, Nečas, fib Bulletins) — academic backing
- **B5 tech cards** (DOKA/PERI vendor manuals) — practical methods
- **B4 productivity** (methvin.co, internal benchmarks) — quantitative norms
- **B9 validation** (conflict rules) — sanity checks

Server-side enforcement: if decision is made without traceable citation, log as `unsourced_decision` flag — visible in audit trail.

---

## Resource caps re-use

Inherits from říms task:
- Each `calculate_partial` validates per-call against caps
- `aggregate_partials` validates Σ across partials (max parallel crews, etc.)
- Multi-position workflow validates project-level (total workers on site, etc.)

---

## Acceptance criteria (organized by phase)

### Phase P0 — Atomic foundation
- ✅ `atomic_calculate` is single canonical implementation (no UI duplication)
- ✅ `calculate_partial` + `aggregate_partials` work with session memory
- ✅ `draft_commit` holds preview until user confirmation
- ✅ `commit_to_monolit_planner` + `commit_to_registry_tov` work
- ✅ `undo_commit` rollback works within window
- ✅ Session memory persists in Cloud SQL with TTL
- ✅ Server-side policy enforcement layer prevents pattern bypass

### Phase P1 — Documents & Decisions
- ✅ `read_project_documentation` uses existing patterns server-side enforced
- ✅ `decompose_position` correctly suggests sub-elements for sborné pozice
- ✅ `apply_document_pattern` executes all 8 patterns correctly (fixes broken frontend implementation)
- ✅ `request_document_or_input` shows UI modal, blocks workflow if needed
- ✅ `explain_decision` ALWAYS returns citation OR explicit "judgement" tag
- ✅ `request_human_review` triggers UI notification
- ✅ `compare_partials` highlights significant differences
- ✅ `replay_session` reconstructs with overrides

### Phase P2 — Advisor & Forms
- ✅ 3 advisor tools callable independently, each with own perspective
- ✅ Triangulation visible in audit trail
- ✅ All system form templates discoverable via `list_form_templates`
- ✅ `render_to_form_template` produces byte-identical output to native forms
- ✅ Validation catches schema mismatches

### Phase P3 — End-to-end workflows
- ✅ "estimate_position_from_tz" runs end-to-end
- ✅ "what_if_analysis" produces actionable diff
- ✅ "review_existing_position" flags issues correctly
- ✅ Conversational protocol works (user can interleave with tool calls)
- ✅ Decision trails fully reproducible

### Phase P4 — Advanced productionization
- ✅ `agent_dry_run` runs full workflow without persistent writes (TTL=24h)
- ✅ `convert_dry_run_to_real` migrates dry_run results to real commits
- ✅ Semantic fingerprints stored on every commit
- ✅ `find_similar_decisions` returns matches by structural similarity (not name)
- ✅ Smart batching: low-confidence decisions accumulate, single batched dialog at workflow end
- ✅ Quick-approve learning suggests rules after 5 same approvals
- ✅ `estimate_workflow_cost` shown BEFORE workflow start (not blocking)
- ✅ Billing enforcement mode `advisory` keeps Alexander unblocked while billing logic is wired

### Cross-phase: Use case test
**SO 206 sborná decomposition:**
- Agent reads TZ for SO 206 D6 km 4,720
- Identifies sub-elements (OP1 + OP2 + P1 + ...)
- Calculates each separately
- Aggregates correctly
- Consults all 3 personas
- Drafts commit, shows in UI
- User confirms → commits to both Monolit-Planner (1 row) and Registry TOV (N rows)
- All decisions cited
- Audit trail complete

---

## Out of scope

- Vision MCP for drawings (DWG → 2D vision LLM) — separate task
- L5 RAG semantic search of textbooks — separate task
- Multi-project agent (single-project scope)
- Real-time collaboration (multiple agents on same project)
- Mobile UI for agent workflows
- Voice interface

---

## Naming rule

> Naming a strukturu souborů určuj podle existujících konvencí v repo.
> Nevytvářej paralelní struktury. Rozšiřuj existující kód.
> Existing references: `STAVAGENT_PATTERNS.md`, `STAVAGENT_Agent_First_Architecture_Vision.md`, `app/policies/` module pattern.

---

## Connect to other tasks

| Task | Dependency direction | Why |
|---|---|---|
| `TASK_Rimsa_Calibration_FullStack_v1.md` | **Before this** | Cleans atomic_calculate primitive |
| `TASK_Scenario_Generator_v1.md` | **After this** | Builds on composable tools |
| `TASK_Knowledge_L5_RAG_v1.md` | Parallel possible | Enriches citations in `explain_decision` |
| `TASK_DocumentExtraction_Universal_Pipeline_v3.md` | **Parallel — coordinate** | `read_project_documentation` should leverage UEP if available |

---

## Session execution plan (estimated)

| Day | Phase | Output |
|---|---|---|
| Day 1 | Phase A discovery + audit report + user confirmation | Markdown audit |
| Day 2 | P0.1-0.3 atomic_calculate + partial + aggregate | Code + tests |
| Day 3 | P0.4-0.7 draft_commit + commit + undo + session memory + policy enforcement | Code + tests |
| Day 4 | P1.1-1.4 documentation tools (read_doc + decompose + apply_pattern + request_input) | Code + tests |
| Day 5 | P1.5-1.8 decision tools (explain + review + compare + replay) | Code + tests |
| Day 6 | P2.1 multi-persona advisor tools | Code + tests |
| Day 7 | P2.2 form templates + render_to_form_template | Code + tests |
| Day 8 | P3 workflow templates + conversational protocol + e2e tests | Tests + docs |
| Day 9 | P4.1 dry_run + P4.2 cross-session fingerprints | Code + tests |
| Day 10 | P4.3 confidence gating (smart batching) + P4.4 estimate_workflow_cost | Code + tests |
| Day 11-12 | SO 206 end-to-end use case test + bug fixes + PR | Green build + PR description |

---

## Inspirations (mental models)

- **OpenAI Function Calling** — agent composes multiple tools, aggregates
- **LangChain Agents with Memory** — session context across calls
- **Anthropic MCP composable tools philosophy** — small, atomic, well-described
- **Excel-style estimator workflow** — calc N cells, sum to total, copy to summary sheet
- **Bot-as-smart-estimator narrative:** *"Agent acts as a very smart estimator who reads project documentation, decomposes sborné pozice, calculates each sub-element separately, consults estimator + site manager + designer perspectives, asks for human input when uncertain, cites every decision with norm reference, and finally inserts results into both Monolit-Planner (1 row) and Registry TOV (N rows) — exactly as a human estimator would do over multiple Excel sheets."*

---

## Trigger conversation

This task scope was expanded in conversation with Alexander on 2026-05-20:

- UI vs MCP UX paradigm difference (sborné pozice problem)
- All 5 additional tools confirmed (undo, compare, explain, review, replay)
- Each endpoint must be standalone callable
- Multi-persona advisor required (rozpočtář + stavbyvedoucí + projektant)
- Draft commit + user choice where to commit
- Form templates must match system exactly
- Document patterns broken in frontend must work server-side
- End-to-end workflow: bot takes work → makes decisions → asks if needed → completes
- Rules for reading project documentation use existing (incomplete) patterns

**Author:** STAVAGENT MCP/UI separation + Agent-First Architecture, 2026-05-20
