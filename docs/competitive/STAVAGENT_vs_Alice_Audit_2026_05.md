# STAVAGENT vs Alice Technologies — Competitive Engineering Audit

**Version:** 1.0
**Date:** 2026-05-07
**Author:** Claude Code (engineering audit pass)
**Audience:** Internal pitch preparation (CSC 2026, deadline 28.06.2026); investor share post-redaction.
**Status:** Audit deliverable. Not a roadmap commitment.
**Scope:** Alice Technologies only. Aitenders is mentioned only when it clarifies a stack-layer point; full Aitenders audit deferred to a separate task.

---

## TL;DR (one screen)

- Alice and STAVAGENT both ship products in the construction-tech bracket and both internally rely on a similar **operations-research math stack** (RCPSP, Monte Carlo, multi-objective optimisation, constraint solving). Surface impression: overlap.
- They sit on **different layers of the construction-tech stack**. Alice is a **schedule-optimisation layer** over a user-supplied P6/MSP baseline and user-supplied resource rates. STAVAGENT is an **engineering-input layer** that derives those rates and the technologically correct stack of formwork / falsework / props / curing / pour from the physics, the catalogue, and the Czech/Slovak norm system (ČSN, TKP, DIN, OTSKP, ÚRS).
- The math overlap is real but **descriptively misleading**. Same equations applied to different inputs solve different customer problems for different personas, with non-substitutable outputs.
- Alice's defensible advantage: **mature scheduling UX, P6/MSP integration, Pareto-frontier scenario explorer, conversational schedule agent**. Out of these, only the conversational agent and the multi-objective scenario explorer have direct upside for STAVAGENT's přípravář / rozpočtář persona within a 6-month window.
- STAVAGENT's defensible advantage: **deterministic, norm-grounded engineering inputs**; **DIN 18218 lateral-pressure derivation**; **Saul/Nurse-Saul curing** with TKP18 §7.8.3 class table; **OTSKP/ÚRS catalogue lookup**; **MCP server** (9 tools, Czech-construction-aware, billable per-tool); **Czech-language TZ-text-as-input** workflow (vs Alice's "upload a P6 file" workflow). None of these are reproducible by Alice within 6 months without a Czech-market push and a domain-engineer hire.
- The honest read for CSC 2026: **do not pitch as "we are doing what Alice is doing, in CZ"**. Pitch as "Alice optimises the schedule **after** the contractor has hand-built the inputs; STAVAGENT generates the technically correct inputs **before** the schedule is built — and Alice's optimisation only works if those inputs are right." Both products survive in the same market.

---

## Table of contents

1. [Stack framing — four layers and where each tool sits](#1-stack-framing)
2. [Q1: Functional overlap (Alice feature → STAVAGENT mapping)](#2-q1-functional-overlap)
3. [Q2: Gap inward (Alice has, STAVAGENT does not)](#3-q2-gap-inward)
4. [Q3: Gap outward (STAVAGENT has, Alice does not)](#4-q3-gap-outward)
5. [Q4: Same-but-different — OR constructs side-by-side](#5-q4-same-but-different)
6. [Recommendations — 5–10 features worth adopting](#6-recommendations)
7. [Sources & traceability](#7-sources)

---

<a id="1-stack-framing"></a>

## 1. Stack framing — four layers and where each tool sits

Construction-tech is not one product category. It is a stack of layers, each with a different persona and a different definition of "correctness". Conflating them is the most common cause of bad competitive analyses. The four layers used throughout this document:

| # | Layer | Persona | Output | Definition of "correct" |
|---|-------|---------|--------|-------------------------|
| 1 | Tender / RFP analysis | Bid manager | Requirements register, response draft | Coverage of contractual asks, audit trail |
| 2 | Engineering inputs | Přípravář / rozpočtář / structural engineer | Rates, m², m³, h/t, pour stages, formwork system, curing days | Conformance with norms (ČSN, TKP, DIN), physical correctness |
| 3 | Operations-research optimisation | Planner / scheduler | Schedule, resource histograms, Pareto frontier of scenarios | Mathematical optimum over given inputs and constraints |
| 4 | UI / UX presentation | Project manager / consumer of plan | Gantt, dashboards, exports, conversational answers | Comprehensibility, decision support |

Mapping the products studied:

- **Aitenders** — pure layer 1 (tender ingestion, requirements extraction, validation, Q&A). Out of scope for the body of this audit but mentioned where the boundary matters.
- **Alice Technologies** — primarily layer 3 (RCPSP-style optimisation over a baseline schedule), with strong layer 4 (Pareto explorer, Schedule Insights Agent, BIM-overlay 4D), and a thin layer 2 footprint that depends entirely on user-provided rates and crew norms (no derivation from physics or norms).
- **STAVAGENT** — primarily layer 2 (the calculator pipeline derives formwork choice, lateral pressure, curing days, pour stages, rebar h/t, pump count from element type + geometry + concrete + season), with a real but smaller layer 3 (`element-scheduler.ts` does RCPSP with formwork-set + rebar-crew constraints, `pert.ts` does Monte Carlo on the critical path), a layer 1 surface (TZ text extractor, smeta-line parser, MCP `parse_construction_budget`, OTSKP/ÚRS lookups), and a layer 4 surface (PlannerPage, Wizard, Variants comparison, Aplikovat → TOV).

Two principles follow:

- **Layer-2 inputs trump layer-3 optimisation.** If Alice optimises a schedule that uses a user-typed `40 m³/day per pump` rate and the physically correct rate is 23 m³/day at this pour height under DIN 18218 + the user's actual line length, the schedule is wrong even when the optimisation is mathematically optimal. Garbage in, optimal garbage out.
- **Layer-3 optimisation trumps layer-2 single-scenario calculation.** If STAVAGENT computes one technically-correct schedule per element and ignores the multi-objective frontier of "this many cranes × this many shifts × this sequence", it leaves money on the table that Alice would harvest. The deterministic-first calculator does not eliminate the need for an OR layer above it.

The right mental model is **complementary stack, not substitution**. Alice is what runs above the layer 2 outputs that STAVAGENT produces; STAVAGENT is what feeds Alice the rates that Alice currently asks the user to type in by hand. This is also the right slide for CSC 2026.

---

<a id="2-q1-functional-overlap"></a>

## 2. Q1: Functional overlap — Alice feature → STAVAGENT mapping

Six modules and eight sub-features extracted from the inline Alice research dump 2026-05-06 (sections "ALICE PLAN / OPTIMIZE / MODEL", "Generative Scheduling", "DCMA 14-Point Check", "Optimization Presets", "Analytics & Reporting", "Risk Management", "Construction Sequencing", "Multi-Objective Optimization", "CSP Solver", "Construction Simulation", "Resource Management", "Schedule Insights Agent"). For each: brief Alice description, equivalent in STAVAGENT, file/module path, layer, and the diff if partial.

### 2.1 ALICE Plan — canvas-based schedule editor with 2D drawing overlay

- **Alice does**: imports P6 / MSP / Cloud P6 file, generates a 2D layout from the schedule, lets the user adjust sequences and links visually on a canvas, plays the construction sequence as a timelapse, exports for stakeholders. Layer: 3 + 4. Source: inline research dump 2026-05-06, "ALICE PLAN" section.
- **STAVAGENT equivalent**: **partial, different intent.** STAVAGENT has Gantt rendering for a single element's záběr-by-záběr schedule (`Monolit-Planner/shared/src/calculators/element-scheduler.ts:409` — `renderGantt` ASCII Gantt that shows ASM/REB/CON/CUR/STR per tact per set). The `gantt` field in `ElementScheduleOutput` is delivered to UI in `Monolit-Planner/frontend` `CalculatorResult.tsx`. There is no canvas, no drag-and-drop sequencing, no 2D overlay over a site drawing.
- **Layer**: 3 + 4 (matches Alice).
- **Gap**: STAVAGENT operates **per element** (one bridge deck, one wall, one pile group); Alice operates over the **whole project schedule**. STAVAGENT has no project-level visual editor, no drag-the-arrow workflow, no "play the sequence" timelapse. The Wizard inline-sidebar mode is the closest UX pattern but it is a parameter-elicitation flow, not a sequence editor.
- **Verdict**: Partial overlap on per-element scheduling output; no overlap on whole-project canvas editing.

### 2.2 ALICE Optimize — parametric what-if scenario engine

- **Alice does**: takes existing P6/MSP schedule, lets user define ranges for variables (crew size, productivity, equipment count, shift mode), runs millions of scenarios, plots time-vs-cost scatterplot of the Pareto frontier, exports the chosen plan back to P6/MSP. Layer: 3.
- **STAVAGENT equivalent**: **partial.** Several pieces exist:
  - `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` accepts `PlannerInput` with the equivalent of variable ranges (`num_pumps_available`, `num_formwork_crews`, `num_rebar_crews`, `crew_size`, `shift_h`, manufacturer preference) and returns a single deterministic `PlannerOutput`.
  - The frontend variant system (`planner_variants` Postgres table, `useCalculator` hook in `Monolit-Planner/frontend`) lets the user save 2–10 variants per position and compare them side-by-side via `VariantsComparison` component — desktop horizontal table with `★ best` highlighting, mobile card stack sorted cheapest-first. CLAUDE.md §"Calculator UX A1-A7 (v4.15)" describes the contract.
  - Excel export merges variants into a "scenarios" sheet.
- **Layer**: 3 (variant selection) + 4 (comparison UI).
- **Gap (real, large)**: STAVAGENT requires the user to **manually save each variant**. There is no automated combinatorial sweep over the parameter cube ("try all combinations of 1-3 cranes × 1-2 shifts × 4-8 záběry"), no Pareto-frontier plot, no scatterplot of time vs cost across the family. The user produces 3 variants by hand; Alice produces ~10⁶ and shows the frontier.
- **Verdict**: Partial. The data structures and the comparison surface exist; the **scenario generator** does not.

### 2.3 ALICE Model — BIM (Revit / IFC) ingest with construction recipes

- **Alice does**: imports 3D BIM models, attaches "construction methods" (recipes) per element class, generates a baseline schedule from model + recipes, lets user run what-if. Layer: 2 + 3.
- **STAVAGENT equivalent**: **none.** No IFC parser, no Revit ingest. The TZ text extractor (`Monolit-Planner/shared/src/parsers/tz-text-extractor.ts`) and the smeta-line parser fill the same role from a fundamentally different input substrate (text + Excel rows, not 3D geometry). The `analyze_construction_document` MCP tool ingests PDFs but extracts text features, not geometry.
- **Layer**: 2 + 3 (Alice).
- **Gap**: Architectural. Adding IFC ingest is not a small task — the Czech market also overwhelmingly works from 2D PDFs and Excel BOQs, not from BIM, so there is a separate question of whether this is a useful gap to close. The CLAUDE.md "Product Backlog" already lists "IFC/BIM support (needs binaries)" as an explicit P3.
- **Verdict**: No equivalent. Strategically: low priority for the přípravář persona, high priority for moving up-market to designers.

### 2.4 Generative Scheduling — automated baseline schedule generation

- **Alice does**: instead of asking the user to type a Gantt chart, generates a baseline schedule from BIM model + recipes (or from a P6 import that gets reinterpreted as a recipe library), then lets the user explore variants on top. Layer: 3.
- **STAVAGENT equivalent**: **partial, single-element-grained.** `scheduleElement()` in `element-scheduler.ts:139` does generate a complete schedule from `(num_tacts, num_sets, assembly_days, rebar_days, concrete_days, curing_days, stripping_days, prestress_days?, num_formwork_crews?, num_rebar_crews?)` — the user provides the inputs once and the engine builds the DAG, runs greedy list scheduling with priority rules (earliest start, STR before ASM to free sets, lower tact wins ties), and returns a complete tact-by-tact schedule with critical path and Gantt. This is structurally a generative scheduler. The Wizard (Průvodce) takes the user through 5 steps and auto-fills sensible defaults from `getSmartDefaults(element_type)` so almost no manual entry is required.
- **Layer**: 3.
- **Gap**: STAVAGENT generates the schedule **for one element at a time** and then `applyPlanToPositions.ts` projects the result back into the project's TOV (technologický postup výstavby) as work entries split across positions (Betonář / Tesař montáž / Tesař demontáž / Železář / Ošetřovatel / Specialista předpětí / Tesař podpěry per CLAUDE.md §"Aplikovat → TOV (v4.14)"). This is generative at the element level. There is no whole-project cross-element scheduler that takes 200 elements and produces one combined Gantt with shared resources.
- **Verdict**: Partial — generative at element level, missing at project level.

### 2.5 DCMA 14-Point Check — schedule quality validator

- **Alice does**: runs the US Defense Contract Management Agency's standard 14 quality tests against an imported schedule (logic completeness, hard constraints count, BEI/CEI metrics, missed activities, etc.), reports pass/fail per test. Layer: 3 (validator).
- **STAVAGENT equivalent**: **none.** STAVAGENT has internal validators in the orchestrator (`element-audit.test.ts`, sanity-range checks per element type via `SANITY_RANGES`, volume-vs-geometry cross-check `checkVolumeGeometry()` in `element-classifier.ts` — see `planner-orchestrator.test.ts` and the v4.22 changelog entry in CLAUDE.md), but they validate the **engineering input** ("is the volume sane for this element type's geometry?"), not the **schedule structure** ("does the schedule have hard constraints, are there negative lags, what is the BEI?").
- **Layer**: 3 (validator over a P6-style schedule).
- **Gap**: We have no concept of validating an externally-supplied P6 schedule. The whole DCMA frame assumes the customer brings a project-level schedule and asks for a quality grade. STAVAGENT's customers do not bring P6 schedules; they bring a TZ document and a BOQ.
- **Verdict**: Not relevant to current persona. Would become relevant only if STAVAGENT moves up-market to enterprise GC-side.

### 2.6 Optimization Presets — pre-baked objective weight bundles

- **Alice does**: ships preset objective weights for "minimize cost", "minimize duration", "maximize resource utilisation", "balance" so the user does not have to dial in W₁..W₇ themselves. Layer: 3.
- **STAVAGENT equivalent**: **partial, implicit.** `pour-decision.ts` encodes default behaviours per element type via `ELEMENT_DEFAULTS` (e.g. `rimsa` defaults to `adjacent_chess` mode with 20 m spáry; `kridla_opery` defaults to a separate záběr; `mostovkova_deska` is `'depends'` and forces a question). The formwork sort key in `lateral-pressure.ts:319` already balances pure rental cost against záběr count via `getStageCountPenalty()` (1.0 for ≤2 záběry, 1.5 for 6+). `pour-task-engine.ts` lets the user pass a `target_window_h` to compute an alternative pump scenario. But there is no top-level "optimisation preset" toggle the user picks once and watches all sub-engines re-balance.
- **Layer**: 3 (Alice) → currently embedded heuristics in our case (Layer 2 + 3).
- **Gap**: We have **the levers** (preferred manufacturer, num_sets, num_formwork_crews, num_pumps_available, scheduling_mode, has_dilatation_joints, manual záběry override, target_window_h) but no preset bundle that flips them coherently. A user who wants "min duration" has to set them all by hand.
- **Verdict**: Partial. Adding a preset selector that re-targets the existing levers is a small task (S, days).

### 2.7 Analytics & Reporting — utilisation curves, cost histograms, exports

- **Alice does**: tracks crew utilisation, equipment utilisation, idle time, cost over time, resource consumption, exports PDF/CSV/comparison reports. Layer: 4.
- **STAVAGENT equivalent**: **partial.**
  - Crew + set utilisation per element returned from `element-scheduler.ts` in the `utilization` field of `ElementScheduleOutput` (formwork crew %, rebar crew %, per-set %).
  - Bottleneck analysis returned in `bottleneck` field (string, e.g. "rebar crew 100% utilised, add second crew") — see `analyzeBottleneck()` call at `element-scheduler.ts:406`.
  - Cost breakdown is structured in `PlannerOutput.costs` per CLAUDE.md §"Formwork taxonomy + MSS engine (v4.21)": `formwork_labor_czk`, `mss_mobilization_czk`, `mss_demobilization_czk`, `mss_rental_czk`, `props_rental_czk`, etc.
  - Excel export of variants exists.
  - Per-tact breakdown of `pour_crew_breakdown` (ukladka, vibrace, finišéři) per CLAUDE.md §"MEGA pour engine fixes (v4.20)" and §"Rebar matrix + pour crew rework (v4.24)".
- **Layer**: 4.
- **Gap**: We do not produce a project-wide PDF report; Excel export is per-element. We do not track utilisation over calendar time across all elements — only per-element.
- **Verdict**: Partial. Single-element analytics mature; project-roll-up missing.

### 2.8 Risk Management — constraint modelling and delay impact simulation

- **Alice does**: lets the user attach risks to activities, simulates delay propagation, finds alternative sequences that avoid bottlenecks, runs Monte Carlo on completion dates. Layer: 3.
- **STAVAGENT equivalent**: **partial, single-element.**
  - `pert.ts` does Monte Carlo (10,000 iterations default, triangular distribution sampled per critical-path activity, returns P50/P80/P90/P95 + histogram + std_dev).
  - Integration with `element-scheduler.ts` at line 411–448 — when `input.pert_params` is provided, the scheduler builds three-point estimates per critical-path activity (curing uses the maturity-based three-point from `curingThreePoint(temperature ± 5/-8 °C)`, work activities use the standard PERT factors 0.75 / 1.50) and runs `runMonteCarlo()` on the critical-path sum.
  - Warnings include orchestrator-level severity tags (⛔ critical / ⚠️ warning / ℹ️ info) per CLAUDE.md §v4.22 Phase 1.
- **Layer**: 3.
- **Gap**: No user-facing risk register, no project-level delay propagation across elements, no "what if pile drilling slips by 5 days, what does the deck schedule look like".
- **Verdict**: Partial — the math primitive exists (Monte Carlo on critical path), the project-level UI does not.

### 2.9 Construction Sequencing — intelligent ordering with constraint resolution

- **Alice does**: solves the sequencing problem given complex constraints (precedence, space, crews, equipment, dependencies). Layer: 3.
- **STAVAGENT equivalent**: **yes, narrow scope.**
  - Within an element, sequencing is handled by `decidePourMode()` in `pour-decision.ts` (sectional vs monolithic; if sectional then `independent` / `adjacent_chess` / `vertical_layers` / `manual_override`).
  - Chess-mode sequencing is implemented at `element-scheduler.ts:188` — odd tact indices get poured first, then even ones with a 24-h cure gap. The DAG enforces this through chess-mode predecessor injection at lines 220–234.
  - Set-reuse precedence (record at `element-scheduler.ts:243`): tact `t` cannot start ASM until `t - num_sets` has finished STR. This is the formwork-set capacity constraint expressed as edges.
  - `applyPlanToPositions.ts` projects work types into TOV in the construction-correct construction order (per the BRIDGE_ELEMENT_ORDER / BUILDING_ELEMENT_ORDER in `element-classifier.ts`).
- **Layer**: 3.
- **Gap**: The construction-correct order is encoded **across elements at project level** only as a static ordering list (BRIDGE_ELEMENT_ORDER: pilota → základ → dřík → příčník → uložení → mostovka → římsa). It is not a dynamic constraint solver that schedules 200 positions against each other.
- **Verdict**: Partial. Within an element the constraint resolution is real and DAG-based; across elements it is a sort key.

### 2.10 Multi-Objective Optimization — Pareto frontier with weighted objectives

- **Alice does**: minimises a weighted sum of duration, cost, idle time, labour cost, equipment cost, risk score, carbon emissions; presents the Pareto frontier; user picks. Layer: 3.
- **STAVAGENT equivalent**: **partial, single-objective with secondary cost penalty.** `filterFormworkByPressure()` in `lateral-pressure.ts:319` sorts by `rental_czk_m2_month × getStageCountPenalty(stages)` — this is a two-objective scalarisation (cost + practicality) but with a fixed penalty weighting, not a frontier exploration. Similarly `pour-decision.ts` produces dual scenarios (actual vs target), but the user picks between two endpoints, not from a frontier.
- **Layer**: 3.
- **Gap**: No genuine Pareto-frontier explorer. The combinatorial generator that would produce the population (see Q3.2.2 above on Optimize) is the prerequisite.
- **Verdict**: Partial. Scalarised in places, no frontier UI.

### 2.11 CSP Solver — constraint satisfaction over the schedule

- **Alice does**: domain-reduction style search over schedule variables with backtracking when conflicts surface. Layer: 3.
- **STAVAGENT equivalent**: **yes, narrow domain.** The formwork pre-filter (`filterFormworkByPressure()`) is a literal CSP step — it runs the constraint `sys.pressure_kn_m2 ≥ required_pressure` (with per-záběr staging recovery) over the catalogue and reduces the candidate set to the suitable systems. The greedy list scheduler in `scheduleElement()` is technically a constructive RCPSP heuristic, not a backtracking CSP, but the **edges-as-constraints** model is identical (FS predecessors + SS-with-lag + cross-tact set-reuse + chess-mode neighbour cure).
- **Layer**: 3.
- **Gap**: STAVAGENT's "CSP" is on a small, structured domain (formwork systems, ~30 catalogue entries; per-element scheduling, ~5 × num_tacts nodes); Alice's runs over the whole project schedule. The math is the same; the scale and the variable space are different.
- **Verdict**: Partial. Same algorithmic family, narrower domain.

### 2.12 Construction Simulation — generate millions of variants and rank

- **Alice does**: combinatorial explosion (their numbers from the inline research dump: 5 × 5 × 3 × 3 × 2 × 2 × 3 = 1,800 base × micro-optimisations → 10⁶+ variants), filters infeasible, ranks Pareto. Layer: 3.
- **STAVAGENT equivalent**: **none.** Closest: the manual variant system per position (max 10 saved variants per `planner_variants` row).
- **Layer**: 3.
- **Gap**: Architectural. We do not have a generator over the parameter cube. We **do** have the orchestrator (`planElement()` / `planner-orchestrator.ts`) that can be called repeatedly with different inputs — a sweep harness on top would produce the population.
- **Verdict**: No equivalent. Buildable on existing primitives; medium effort.

### 2.13 Resource Management — automatic levelling, utilisation tracking, conflict detection

- **Alice does**: detects resource over-allocation per day, suggests redistribution, computes utilisation rate per resource, computes idle cost. Layer: 3.
- **STAVAGENT equivalent**: **partial.**
  - Within an element the scheduler levels two resource pools (formwork crews, rebar crews) by greedy earliest-free-unit assignment (`element-scheduler.ts:322` — finds earliest free crew slot before scheduling a node).
  - Utilisation per crew + per set is computed by `computeUtilization()` and returned in `ElementScheduleOutput.utilization`.
  - `analyzeBottleneck()` returns the single most-constrained resource as a string hint.
  - Pour-crew composition is sized by pumps and volume via `computePourCrew()` per CLAUDE.md §"Rebar matrix + pour crew rework + operne_zdi factor (v4.24)" with element-type-aware rules (podkladní beton ≤20 m³ → 2 people, 20–80 m³ → 4, 80+ → pump-driven).
- **Layer**: 3.
- **Gap**: No project-level resource levelling across all positions / elements. Idle-cost analysis is not surfaced. No multi-day calendar of resource over-allocation across elements.
- **Verdict**: Partial. Element-internal levelling done well; cross-element levelling absent.

### 2.14 Schedule Insights Agent — natural-language Q&A over the schedule

- **Alice does**: lets the user ask "What is the cost breakdown by crew?", "What are the main risks to milestone X?", "What strategies cut total duration?" in natural language and answers with sources/justification. Layer: 4.
- **STAVAGENT equivalent**: **partial, different scope.** The `/api/planner-advisor` endpoint (`Monolit-Planner/backend/src/routes/advisor-prompt.js`) takes the form state + computed result + TZ text excerpt and asks the LLM (via Core `/api/v1/multi-role/ask`, `concrete_specialist` role) to produce structured advice (`pour_mode`, `klicove_body`, `reasoning`, `key_points`, `risks`, `norms_referenced`). Per CLAUDE.md §"AI advisor prompt v2 (v4.18)" the prompt has structured sections (MOSTNÍ NK / PŘEDPĚTÍ / PILOTA / GEOMETRIE / JIŽ SPOČÍTÁNO ENGINE / KONTEXT Z TZ / EXTRAHOVANÉ PARAMETRY) and explicitly tells the LLM not to overwrite engine-computed values like `curing_days`. JSON parse with schema validation, raw-prompt-echo detection, friendly error fallback.
- The MCP server's `get_construction_advisor` tool also exposes a similar surface to external LLM clients (ChatGPT plugins, Claude.ai, etc.).
- **Layer**: 4.
- **Gap**: Alice's agent answers questions about the **whole project schedule** and does cross-schedule comparison ("compare scenario A vs B", "what changed between v2 and v3"). STAVAGENT's advisor answers questions about **a single element's calculation** with the engine's results as ground truth. Different scope.
- **Verdict**: Partial. Conceptually closest of all Alice features; STAVAGENT scope is narrower.

### 2.15 Summary table

| Alice feature | STAVAGENT? | File / module | Layer | Notes |
|--------------|-----------|---------------|-------|-------|
| ALICE Plan (canvas + 2D overlay) | partial | `element-scheduler.ts` Gantt | 3+4 | per-element only |
| ALICE Optimize (variant explorer) | partial | `planner_variants` + `useCalculator` | 3+4 | manual save, no generator |
| ALICE Model (BIM ingest) | no | — | 2+3 | TZ text + smeta-line parser instead |
| Generative Scheduling | partial | `scheduleElement()` | 3 | element level, not project |
| DCMA 14-Point Check | no | — | 3 | not relevant to persona |
| Optimization Presets | partial | scattered defaults | 3 | levers exist, no preset bundle |
| Analytics & Reporting | partial | `PlannerOutput.costs` + `utilization` | 4 | per-element, no project rollup |
| Risk Management | partial | `pert.ts` Monte Carlo | 3 | per-element critical path only |
| Construction Sequencing | partial | `pour-decision.ts` + chess mode | 3 | within-element, static between |
| Multi-Objective Optimization | partial | `getStageCountPenalty()` | 3 | scalarised, no frontier |
| CSP Solver | partial | `filterFormworkByPressure()` | 3 | small domain |
| Construction Simulation | no | — | 3 | generator missing |
| Resource Management (levelling) | partial | greedy crew assignment | 3 | element-internal only |
| Schedule Insights Agent | partial | `/api/planner-advisor` + MCP `get_construction_advisor` | 4 | element scope, not project |

---

<a id="3-q2-gap-inward"></a>

## 3. Q2: Gap inward — Alice has, STAVAGENT does not

For each capability: applicability to STAVAGENT's persona (přípravář / SMB construction firm) vs enterprise-only, effort estimate, dependencies, strategic rating.

### 3.1 Project-level RCPSP across all elements

- **Alice has**: solves a project-wide schedule with ~hundreds-thousands of activities, shared resources, calendar constraints, milestones. Source: inline research dump 2026-05-06, "ALGORITHMIC PROCESS" section.
- **STAVAGENT has**: per-element RCPSP, project-level integration only via `applyPlanToPositions.ts` flat projection.
- **Persona fit**: **medium.** A přípravář who calculates 50 elements per project does want a roll-up Gantt, even if approximate. It is also the natural surface for Alice-style multi-objective exploration.
- **Effort**: **L (months).** Requires a project-level scheduler, project-level resource pool model, calendar-aware date arithmetic (the existing `calendar-engine.ts` already exists at 366 lines but its scope is limited). The cross-element data substrate exists in the Postgres `bridges` + `monolith_projects` + `positions` schema. Designing a UI that does not collapse under 200-position projects is its own task.
- **Dependencies**: project-level resource catalogue (currently per-element), calendar with public holidays + weather seasons.
- **Strategic rating**: **must-have within 12 months** if the goal is to compete on optics with Alice. **nice-to-have within 6 months** because the per-element accuracy is a stronger differentiator and bigger immediate sell.

### 3.2 Combinatorial scenario generator (Construction Simulation engine)

- **Alice has**: parameter cube → millions of feasible scenarios → Pareto rank. Source: research dump.
- **STAVAGENT has**: manual variants (1–10 saved per position).
- **Persona fit**: **medium-high.** Přípravář would benefit from "show me 1 vs 2 cranes vs MSS for this deck" automatically. Works well with the existing variant comparison UI.
- **Effort**: **M (weeks).** A sweep harness on top of `planElement()` that iterates over a parameter grid (num_sets ∈ {1, 2, 3}, num_formwork_crews ∈ {1, 2}, num_pumps_available ∈ {1, 2, 3}, season ∈ {leto, podzim_jaro, zima}, manufacturer ∈ {DOKA, PERI}) and returns a population of `PlannerOutput` results. Filtering: each output already carries `warnings` with severity prefix (⛔/⚠️/ℹ️ per CLAUDE.md §v4.22) — drop scenarios with critical warnings. Ranking: existing cost fields. UI: scatterplot of `total_days` vs `total_cost_czk`, Pareto-frontier extraction is `O(n²)` on the population.
- **Dependencies**: none architectural — `planElement()` is already pure-ish. Need to surface a "Scenarios" tab next to "Variants" in PlannerPage.
- **Strategic rating**: **must-have within 6 months.** This is the single Alice feature with the highest demo-value-per-week-of-work ratio. Closes the optics gap while reusing existing engines.

### 3.3 Conversational schedule agent (project scope)

- **Alice has**: ChatGPT-style Q&A over the full project schedule with cited sources from the schedule itself.
- **STAVAGENT has**: per-element advisor (planner-advisor + MCP `get_construction_advisor`).
- **Persona fit**: **high.** Přípravář would ask "kolik měsíců pronájmu bednění čeká na D6 SO-202?" or "co se změní pokud pilíř P2 protáhne o týden?". MCP toolset is the natural backbone: a project-scoped advisor would call `find_otskp_code`, `calculate_concrete_works`, `analyze_construction_document` on demand.
- **Effort**: **M-L (weeks-months).** The element-scoped advisor exists; broadening it to project scope means context window budgeting (a 50-element project will not fit in one prompt), summarisation strategy (probably retrieval over the per-element results), and a chat UI in PlannerPage. The MCP server is already set up for streaming/tool-calling so the agent stack is largely there.
- **Dependencies**: completed project-level RCPSP would help but is not strictly required (the agent can work over the per-element population already).
- **Strategic rating**: **must-have within 12 months.** Pitches well, fits MCP roadmap, distinct angle (a Czech-construction-norm-grounded agent vs Alice's general schedule agent).

### 3.4 P6 / MSP / Cloud P6 import + export

- **Alice has**: round-trip integration with Oracle Primavera P6, Microsoft Project, Oracle Primavera Cloud (`.xer`, `.xml`, `.mpp`).
- **STAVAGENT has**: nothing — no P6 ingestion, no MSP export. Output is XLSX or push to TOV in own DB.
- **Persona fit**: **low for SMB CZ przípravář; high for enterprise CZ GC.** Czech SMBs largely do not run P6. Enterprise contractors (Metrostav, Skanska, Eurovia) do. Expanding to enterprise without P6 export is a sales blocker.
- **Effort**: **M (weeks)** for read-only XML import (P6 has a documented XML schema), **L (months)** for round-trip with custom-field preservation. The `.mpp` binary format is significantly harder than `.xml`.
- **Dependencies**: none.
- **Strategic rating**: **nice-to-have for current persona, must-have if upmarket move.** Defer until upmarket move is a deliberate strategic decision.

### 3.5 BIM (IFC / Revit) ingest

- **Alice has**: ALICE Model — drag in a Revit model, attach recipes, generate schedule.
- **STAVAGENT has**: nothing.
- **Persona fit**: **low.** CZ approach to BOQ is text + Excel; BIM penetration is rising but the přípravář still works from PDF + XLSX. The TZ text extractor + smeta-line parser cover the substrate that actually exists.
- **Effort**: **L (months).** IFC parsing is a non-trivial library binding (IfcOpenShell, native binaries). Already in CLAUDE.md backlog as P3 ("IFC/BIM support (needs binaries)").
- **Dependencies**: native binaries on Cloud Run.
- **Strategic rating**: **ignore for next 12 months.** Upmarket move would re-evaluate.

### 3.6 DCMA 14-Point Check

- **Alice has**: validates externally-supplied schedules against the 14 quality tests.
- **STAVAGENT has**: nothing equivalent (validates engineering inputs, not external schedules).
- **Persona fit**: **near-zero.** STAVAGENT users do not bring P6 schedules to be graded.
- **Effort**: **S-M (days-weeks)** if we ever ingest P6 — the rules themselves are publicly documented.
- **Strategic rating**: **ignore.**

### 3.7 4D BIM overlay (sequence playback over 3D model)

- **Alice has**: timelapse of construction sequence visualised over the 3D model.
- **STAVAGENT has**: nothing.
- **Persona fit**: **low for přípravář; high for client-presentation.** Useful for pitches to investors, less for daily préparation work.
- **Effort**: **L+ (months).** Requires BIM ingest (3.5) plus a 3D viewer. Three.js + IFC.js could carry it but it is not a side project.
- **Strategic rating**: **ignore for 12 months.**

### 3.8 Calendar with public holidays, weather, shifts

- **Alice has**: rich calendar engine with shifts, holidays, weather seasons, working time per resource.
- **STAVAGENT has**: `Monolit-Planner/shared/src/calculators/calendar-engine.ts` (366 lines) — exists but limited; PERT integrates a weather term via the optimistic/pessimistic factors; `season` enum on pour decision. Days are ordinal (1, 2, 3) in Monolit mode and only become calendar dates in Portal mode.
- **Persona fit**: **medium-high.** Calendar dates are the lingua franca of construction schedules.
- **Effort**: **M (weeks).** Extend `calendar-engine.ts`, add a project-level `start_date`, render Gantt with calendar dates instead of ordinal days, propagate weekends and CZ public holidays.
- **Strategic rating**: **must-have within 12 months.** Already in CLAUDE.md TODO as "P3: Gantt calendar — date axis in Portal mode".

### 3.9 Project-level cost roll-up + reports

- **Alice has**: project-wide cost histograms over time, comparison reports, PDF/CSV exports.
- **STAVAGENT has**: per-element cost in `PlannerOutput.costs`; Excel export merges variants; no project-wide roll-up.
- **Persona fit**: **high.** A přípravář compiles 50 element calculations into one bid; the roll-up is the actual deliverable.
- **Effort**: **M (weeks).** Iterate over `monolith_projects → bridges → positions → calculator_results`, sum, export to PDF/Excel via existing exporters.
- **Strategic rating**: **must-have within 12 months.**

### 3.10 Risk register at project level

- **Alice has**: tag risks per activity, simulate delay propagation across the project.
- **STAVAGENT has**: per-element warnings (⛔/⚠️/ℹ️), per-element Monte Carlo on critical path. No risk register, no project-level propagation.
- **Persona fit**: **medium.** SMB přípravář is unlikely to maintain a risk register; enterprise will demand one.
- **Effort**: **M (weeks)** for a register schema + UI; **L** for delay propagation across the project network.
- **Strategic rating**: **nice-to-have, defer 12 months.**

### 3.11 Equipment fleet + utilisation across projects

- **Alice has**: equipment fleet view, utilisation across the project, idle-cost analysis.
- **STAVAGENT has**: per-element equipment selection (formwork system, props, pumps, MSS) with rentals; no fleet-wide view.
- **Persona fit**: **medium-high.** A SMB stavebnictví firma has 3 cranes, 2 pumps, X bednící sady — they really do want to know utilisation across projects.
- **Effort**: **L (months).** A new domain object (Equipment Fleet) with cross-project usage tracking.
- **Strategic rating**: **nice-to-have, defer 12 months.** Strong upsell vector once project-level RCPSP exists.

### 3.12 Summary

| Alice gap inward | Persona fit | Effort | Strategic |
|------------------|-------------|--------|-----------|
| Project-level RCPSP | medium | L | must-have 12mo |
| Combinatorial scenario generator | medium-high | M | **must-have 6mo** |
| Conversational project agent | high | M-L | must-have 12mo |
| P6/MSP import/export | low (SMB) / high (enterprise) | M-L | defer until upmarket |
| BIM (IFC/Revit) ingest | low | L | ignore 12mo |
| DCMA 14-point check | near-zero | S-M | ignore |
| 4D BIM overlay | low | L+ | ignore 12mo |
| Calendar (dates, holidays, weather) | medium-high | M | must-have 12mo |
| Project-level cost roll-up + reports | high | M | must-have 12mo |
| Project risk register + propagation | medium | M-L | defer 12mo |
| Equipment fleet utilisation | medium-high | L | defer 12mo |

---

<a id="4-q3-gap-outward"></a>

## 4. Q3: Gap outward — STAVAGENT has, Alice does not

For each: real advantage or just-different-layer? defensible moat or temporary? could Alice add this in 6 months if motivated?

### 4.1 Norm-grounded engineering input derivation

- **STAVAGENT has**: deterministic derivation of formwork system, lateral pressure, curing days, pour stages, props requirements, rebar h/t — from element type + concrete class + temperature + exposure class + geometry — as the **first step** before any scheduling. Documents: ČSN EN 12812, DIN 18218, ČSN EN 13670, TKP18 §7.8.3. Concrete code excerpts:
  - `lateral-pressure.ts:155` `calculateLateralPressure()` — DIN 18218 with k-factor by ConcreteConsistency (`'standard'` 0.85, `'plastic'` 1.00, `'scc'` 1.50).
  - `maturity.ts:239` `calculateCuring()` — ČSN EN 13670 Table NA.2 lookup by (curing_class 2/3/4, temperature band, concrete class group), Cement-type speed factor (CEM_I 1.0 / CEM_II 0.85 / CEM_III 0.6), exposure-class minimum floor `EXPOSURE_MIN_CURING_DAYS` per TKP18 §7.8.3 (XF1 5d, XF3/XF4 7d).
- **Alice has**: nothing in this layer. Alice asks the user to type the activity duration in days.
- **Real advantage or just-different-layer**: **real advantage AND different layer.** The advantage is real because the inputs are objectively more correct than user-typed numbers (e.g. SO-202 mostovka XF4 curing class 4 at 15 °C → STAVAGENT correctly returns 9 days; user-typed default would likely be 7 days, propagating an underestimate through the rest of the schedule). The "different layer" framing is also true: Alice does not claim this layer.
- **Defensible moat**: **yes, durable.** The moat is the union of (a) the Czech/Slovak norm catalogue knowledge, (b) the 1000+ tests that lock the values down, (c) the per-element edge cases (composite křídla detection, MSS pour-role, prestress wait+stressing+grouting decomposition). Replicating this is a domain hire + 6–12 months even with a clear spec.
- **Could Alice add in 6 months**: **no, not without a Czech-market push.** Their current product does not need norm-grounded inputs because their persona is the Anglosphere enterprise GC who does have an in-house engineer to type the rates.

### 4.2 OTSKP / ÚRS catalogue integration

- **STAVAGENT has**: OTSKP catalogue lookup with regex-based classification rules at confidence 1.0 (`element-classifier.ts:580`, `OTSKP_RULES`), 17,904 verified OTSKP items in MCP `find_otskp_code`, 39,000+ ÚRS items in `find_urs_code`. Catalogue match overrides keyword scoring per `classifyElement()` early-exit at `element-classifier.ts:877`.
- **Alice has**: nothing — they are catalogue-agnostic.
- **Real advantage**: **real, because OTSKP/ÚRS is the Czech contractual reality.** The whole tender process runs on these codes. A schedule activity that does not link to an OTSKP code is unbilled work.
- **Defensible moat**: **yes, regional.** The catalogues themselves are publicly available; the 1.0-confidence regex rules and the integration into the calculator pipeline are not. Alice would need to scrape, normalise, and integrate; 3–6 months minimum, no business reason for them to do so unless they enter CZ/SK.
- **Could Alice add in 6 months**: **no business reason.** Their TAM is not Czech. If they enter CZ, yes — but Czech construction is ~1% of EU GDP, low priority.

### 4.3 Deterministic-first / confidence-scored architecture

- **STAVAGENT has**: explicit confidence ladder per CLAUDE.md "Conventions" — regex 1.0, OTSKP DB 1.0, drawing_note 0.90, Perplexity 0.85, URS 0.80, AI 0.70. Higher confidence never overwritten by lower (CLAUDE.md "Key rules"). Implementation visible in `element-classifier.ts:877` (early-exits with 1.0 confidence run before the keyword scorer at 0.7), `extraction_to_facts_bridge` in concrete-agent (regex extracts before LLM), the smeta-line parser running before free-text regex (CLAUDE.md §v4.23).
- **Alice has**: not architecturally — Alice is generative-first (the math runs over user-supplied inputs without an evidence ladder).
- **Real advantage**: **real for engineering correctness, neutral for scheduling optimisation.** A regex match for "C30/37" is more reliable than an LLM guess; that is good. But the optimisation layer does not have an analogous scale.
- **Defensible moat**: **temporary (1–2 years).** This is a design philosophy more than a feature. Anyone can copy it, but the discipline to actually maintain a confidence ladder over 1500 commits is the moat. Not Alice's natural play, but reproducible.
- **Could Alice add in 6 months**: **yes if they wanted to, but they don't.** Generative-first is faster to demo; deterministic-first is slower to build but more correct.

### 4.4 MCP server with 9 Czech-construction-aware tools

- **STAVAGENT has**: FastMCP-based MCP server mounted at `/mcp` on `concrete-agent` Cloud Run, exposing 9 tools (`find_otskp_code`, `find_urs_code`, `classify_construction_element`, `calculate_concrete_works`, `parse_construction_budget`, `analyze_construction_document`, `create_work_breakdown`, `get_construction_advisor`, `search_czech_construction_norms`). Auth via bcrypt + per-thread SQLite + API keys (`sk-stavagent-{hex48}`), credit billing per-tool 0–20 credits, OAuth 2.0 client_credentials for ChatGPT, REST wrappers at `/api/v1/mcp/tools/*` auto-generating OpenAPI for GPT Actions, Lemon Squeezy webhook integration. CLAUDE.md "Subsystems → MCP Server v1.0".
- **Alice has**: nothing. No MCP server, no OpenAPI for GPT Actions, no Czech construction norms search.
- **Real advantage**: **real, distribution moat.** MCP gives STAVAGENT zero-friction integration into Claude.ai, ChatGPT (via Actions), Cursor, Continue, every MCP-enabled IDE/agent shipping in 2026. This is a customer acquisition channel that does not depend on stavagent.cz traffic.
- **Defensible moat**: **partial.** The protocol is open; anyone can ship an MCP server. The 9-tool composition + Czech-norm + OTSKP/ÚRS database is what is hard to replicate.
- **Could Alice add in 6 months**: **yes technically, no commercially.** They could write a wrapper around their own API — but their tools are P6-import / scenario-explorer, not norm-search / catalogue-lookup. Different demand-side.

### 4.5 Saul / Nurse-Saul maturity model with TKP18 §7.8.3 class table

- **STAVAGENT has**: `maturity.ts:399` `calculateMaturityIndex()` implementing M = Σ (T_i − T_datum) × Δt_i with T_datum = −10 °C (standard for OPC). `maturity.ts:351` `estimateStrengthPct()` implements Plowman log-maturity relation. Lookup table at `maturity.ts:168` `CURING_DAYS_TABLE` with 5 temperature bands × 3 concrete-class groups × 3 curing classes (TKP18 §7.8.3). Default curing class per element type at `maturity.ts:611` `DEFAULT_CURING_CLASS` (mostovka/římsa/rigel = 4, opěry/dříky/základy/křídla/závěrné zídky/podložiskový blok/opěrné zdi = 3, rest = 2).
- **Alice has**: nothing — their schedule asks the user "how many days for curing" and does not derive it from concrete class + temperature.
- **Real advantage**: **real and large.** Curing days drive the critical path of every concrete element. Getting them physically right by 2 days × 50 elements × 3 sets = 300 element-days of error in a project schedule. Alice's optimisation cannot recover this — it is in the input.
- **Defensible moat**: **yes, regional + technical.** The TKP18 §7.8.3 class table is a Czech regulatory document; the implementation maps cement type, exposure class array (`getExposureMinCuringDays` at `maturity.ts:110` is array-aware so a bridge deck XF2 + XD1 + XC4 returns 5 d via XF2 max), element type → curing class — this is a body of decisions, not a single function.
- **Could Alice add in 6 months**: **no, not without a Czech engineer hire.** ČSN EN 13670 is harmonised across EU; the TKP18 layer is Czech-specific. Eurocodes-based equivalents in other countries would need parallel work.

### 4.6 DIN 18218 lateral pressure with formwork-system filtering and pour-stage suggestion

- **STAVAGENT has**: `lateral-pressure.ts:155` `calculateLateralPressure()` implementing p = ρ × g × h × k with three k resolution paths (explicit override > consistency-class > pour-method legacy). `lateral-pressure.ts:263` `filterFormworkByPressure()` returning `{suitable, rejected, pressure, has_suitable}` with per-záběr staging recovery: when a system's pressure is below required, the engine computes `effectiveMaxH = sys.pressure / pressure × pour_height` capped at `max_pour_height_m`, and if `≥ 1.5 m` it accepts the system with implicit záběry. `lateral-pressure.ts:390` `suggestPourStages()` returns `{needs_staging, num_stages, stage_height_m, stage_pressure_kn_m2, max_system_pressure_kn_m2, cure_between_stages_h, decision_log}` with the column-formwork exemption (h ≤ 8 m → 1 záběr) at line 410 and a 24-h cure between vertical stages.
- **Alice has**: nothing. Their model accepts "this many m³ takes this many days" without checking whether the pour stages are physically achievable for the chosen formwork.
- **Real advantage**: **real.** Without DIN 18218 you can specify Frami 80 kN/m² for an 8 m wall and produce a schedule that says it takes 2 days; physically the wall must be poured in 4 záběry of 2 m each with 24 h cure between, taking 8 days. Alice's optimisation cannot fix this.
- **Defensible moat**: **yes.** The formula is public; the formwork catalogue + the per-záběr staging logic + the recovery rule are domain work.
- **Could Alice add in 6 months**: **no business reason.** Same demand-side mismatch as 4.5.

### 4.7 Czech / Slovak language and TZ-text-as-input pipeline

- **STAVAGENT has**: full Czech UI, Czech terminology preserved (bednění, skruž, stojky, záběr, pracovní spára, četa, římsa, příčník), `TzTextInput.tsx` collapsible textarea with debounced 500 ms regex extraction (`tz-text-extractor.ts`), per-extracted-param checkbox + element-specific applicability ("(jiný typ)" greyed), tzText persisted in `localStorage('planner-tz-text')`, 18 vitest fixtures + 28 tests for smeta-line parser at v4.23, OTSKP/ÚRS catalogue badges in extracted params.
- **Alice has**: English UI, schedule-file ingest. No TZ-text workflow.
- **Real advantage**: **real for the persona.** A přípravář in CZ/SK does not have a P6 schedule; they have a TZ document and a BOQ Excel. STAVAGENT meets that input substrate; Alice does not.
- **Defensible moat**: **regional + linguistic.** Czech is a small language with construction-specific terminology that does not directly transliterate.
- **Could Alice add in 6 months**: **technically yes, commercially no.** Czech is 0.1% of their TAM.

### 4.8 Construction-correct ordering knowledge baked in

- **STAVAGENT has**: `BRIDGE_ELEMENT_ORDER` (pilota → základy_pilířů → dříky_pilířů → příčník/rigel → opery/uložné_prahy → křídla → mostovka → římsy) and `BUILDING_ELEMENT_ORDER` (pilota → základová_deska/patka/pas → stěna → sloup → průvlak → stropní_deska → schodiště) in `element-classifier.ts`. Used by `applyPlanToPositions.ts` to sequence work entries. Pile pipeline is its own branch (`runPilePath` at `pile-engine.ts`) bypassing formwork/lateral-pressure/props because pile workflow is fundamentally different (drilling → 7 d pause → head adjustment → optional cap).
- **Alice has**: not as construction-domain knowledge — Alice expects the user (or BIM model + recipes) to provide the sequencing. Their "Construction Sequencing" feature is the constraint solver, not the construction-order knowledge.
- **Real advantage**: **real but narrow.** This is engineering common sense encoded as data, not algorithms. Useful, but the moat is small.
- **Defensible moat**: **temporary (1 year).** Anyone can encode construction-correct order from a textbook.

### 4.9 Multi-engine pipeline with explicit engine boundaries

- **STAVAGENT has**: 7-engine pipeline per CLAUDE.md "Calculator" — element-classifier → lateral-pressure → formwork-selector → maturity → element-scheduler → pour-decision/pour-task → props-calculator → rebar-lite → pile-engine (when applicable) → planner-orchestrator. Each engine is a pure-ish function with typed inputs/outputs and its own test suite (1036 tests as of v4.27, including 11 Phase 1 golden tests). Engine boundaries enable per-engine improvement without cross-engine breakage.
- **Alice has**: monolithic from outside; internals not public.
- **Real advantage**: **real for development velocity.** New engineer can land a fix in `lateral-pressure.ts` without touching `maturity.ts`. The 1036 tests give regression safety.
- **Defensible moat**: **internal, not customer-facing.**
- **Could Alice add**: **already have or not, irrelevant — internal organisation, not a customer feature.**

### 4.10 Cost transparency by sub-component (formwork rental, MSS rental, props rental, labour with §114 ZP overtime accounting)

- **STAVAGENT has**: `PlannerOutput.costs` with structured fields per CLAUDE.md §"Formwork taxonomy + MSS engine (v4.21)": `formwork_labor_czk`, `mss_mobilization_czk`, `mss_demobilization_czk`, `mss_rental_czk`, `props_rental_czk`, `is_mss_path` flag. CalculatorResult.tsx renders cost rows with explicit "0 Kč (součást MSS)" for bundled components. Pour cost split into person-hours formula for continuous multi-shift (`crew × pour_hours × wage + night × crew × wage × 0.10` per CLAUDE.md §v4.20 Bug 2) vs sectional with §114 ZP +25% overtime per worker.
- **Alice has**: cost breakdown but at activity-aggregate level (direct + indirect + idle), not at the engine-component level.
- **Real advantage**: **real.** A přípravář defending a bid must trace each Kč to a line item; STAVAGENT structures that.
- **Defensible moat**: **moderate.** Replicable but a body of decisions about what fields to expose.

### 4.11 Summary table

| STAVAGENT-only capability | Real / different-layer | Moat | Alice could replicate in 6mo? |
|---------------------------|------------------------|------|-------------------------------|
| Norm-grounded engineering inputs | real + different layer | durable | no |
| OTSKP/ÚRS catalogue integration | real | regional | no business reason |
| Deterministic-first + confidence ladder | real for engineering | temporary 1-2y | yes, won't |
| MCP server + 9 Czech-construction tools | real, distribution moat | partial | yes technically, no commercially |
| Saul maturity + TKP18 §7.8.3 class table | real, large | regional + technical | no |
| DIN 18218 lateral pressure + formwork filter + pour-stage suggestion | real | yes | no business reason |
| Czech/Slovak language + TZ-text input | real for persona | regional | no |
| Construction-correct ordering knowledge | real but narrow | temporary 1y | yes |
| 7-engine modular pipeline + 1036 tests | real for dev velocity | internal | irrelevant |
| Cost breakdown by engine component | real | moderate | yes |

---

<a id="5-q4-same-but-different"></a>

## 5. Q4: Same-but-different — five OR constructs side-by-side

The most important section. Both products use the same operations-research math; the math overlap is mistaken for product overlap. For each of five common constructs, the Alice description (from the inline research dump 2026-05-06), the STAVAGENT implementation with a real code excerpt, and the analysis of why it is the same equation solving a different customer problem.

### 5.1 RCPSP — Resource-Constrained Project Scheduling Problem

#### Alice usage

Per the research dump section "ALGORITHMIC PROCESS", Alice ingests a P6/MSP schedule, treats it as the activity DAG, and runs project-wide scheduling with shared resource pools (cranes, pumps, crews, equipment). The user-supplied resource rates (e.g. "10 m³/day per pump") become the activity durations. Resource conflicts are detected and resolved by either delaying activities (pushing late) or recommending more resources (e.g. "add 2nd crane → 45 days saved"). The optimisation runs forward and backward to derive critical path and float. The variable space is enormous: every activity × every resource assignment × every shift mode.

The customer problem solved: **given a baseline schedule and a fleet, find the schedule that minimises duration / cost / idle time while respecting precedence and resource caps.**

#### STAVAGENT usage

Implemented in `Monolit-Planner/shared/src/calculators/element-scheduler.ts`. Per-element only. Activities are 5 per tact (ASM, REB, CON, CUR, STR), plus optional PRE (prestress) between CUR and STR. Resources are formwork crews and rebar crews (capacity-constrained), plus formwork sets (also capacity-constrained, shared across tacts). The DAG edges encode FS predecessors, SS-with-lag (rebar starts when assembly is X% done — `rebar_lag_pct`, default 50), and cross-tact set reuse (tact `t` cannot start ASM until tact `t − num_sets` finishes STR). Solved by greedy list scheduling (priority list heuristic), backward pass for critical path, optional Monte Carlo on the critical path via `pert.ts`.

The customer problem solved: **given a single concrete element with N záběry and M sets, what is the minimum-duration schedule respecting curing, formwork-set reuse, and crew capacity?**

```ts
// Monolit-Planner/shared/src/calculators/element-scheduler.ts:289-359 (excerpt)
// Greedy list scheduling — pick the ready node with earliest feasible start,
// breaking ties in favour of STR (which frees a set) over ASM (which consumes one).

while (remaining.size > 0) {
  let bestNode: Node | null = null;
  let bestES = Infinity;
  let bestCrew = -1;

  for (const node of nodes) {
    if (!remaining.has(node.id)) continue;

    // FS predecessors must all be scheduled and finished
    let ready = true;
    let es = 0;
    for (const p of node.fs_preds) {
      const s = sched.get(p);
      if (!s) { ready = false; break; }
      const lag = node.fs_lags?.get(p) ?? 0;
      es = Math.max(es, s.finish + lag);
    }
    if (!ready) continue;

    // SS source (rebar-with-assembly overlap)
    if (node.ss_source) {
      const ss = sched.get(node.ss_source);
      if (!ss) continue;
      es = Math.max(es, ss.start + (node.ss_lag ?? 0));
    }

    // Resource constraint: pick earliest-free crew unit
    let crewUnit = -1;
    if (node.crew === 'formwork') {
      let minT = Infinity;
      for (let i = 0; i < fwFree.length; i++) {
        if (fwFree[i] < minT) { minT = fwFree[i]; crewUnit = i; }
      }
      es = Math.max(es, minT);
    } else if (node.crew === 'rebar') {
      let minT = Infinity;
      for (let i = 0; i < rbFree.length; i++) {
        if (rbFree[i] < minT) { minT = rbFree[i]; crewUnit = i; }
      }
      es = Math.max(es, minT);
    }

    // Priority: earliest start → STR before ASM (frees sets) → lower tact wins
    const isBetter =
      es < bestES ||
      (es === bestES && node.type === 'stripping' && bestNode?.type !== 'stripping') ||
      (es === bestES && node.type === bestNode?.type && node.tact < (bestNode?.tact ?? Infinity));

    if (isBetter) {
      bestNode = node;
      bestES = es;
      bestCrew = crewUnit;
    }
  }

  if (!bestNode) throw new Error('Scheduling deadlock — cycle in DAG?');
  // ...
}
```

#### Why these are different solutions to different problems

- **Variable space**: Alice's RCPSP variable space is `O(activities × resources × shifts × sequences)` for an entire project — millions of free variables; their generator covers ~10⁶ scenarios. STAVAGENT's RCPSP variable space is `O(5 × num_tacts)` per element with 2 resource pools and a fixed sequencing rule (linear or chess); a typical element has 25 nodes, deterministic in one pass. Same problem family, three orders of magnitude different in scale.
- **Input source**: Alice's activity durations come from the imported schedule (user-supplied). STAVAGENT's activity durations come from `assembly_days`, `rebar_days`, `concrete_days`, `curing_days`, `stripping_days`, `prestress_days` — themselves derived by `props-calculator`, `rebar-lite`, `pour-task-engine`, `maturity` (Saul + TKP18). The optimisation is downstream of physics-grounded inputs.
- **Customer**: Alice's customer is the project-level scheduler / planner who already has a schedule. STAVAGENT's customer is the přípravář who must produce the engineering inputs that **become** that schedule.
- **Output composability**: STAVAGENT's per-element schedule is **a building block** that gets projected into the project TOV via `applyPlanToPositions.ts` — multiple elements compose into a project. Alice's project schedule **is** the composition.
- **Net: same algorithm family, perpendicular customer problems.** The right pitch is "STAVAGENT generates the activity durations that an Alice-style optimiser would otherwise ask the user to type."

### 5.2 Monte Carlo simulation

#### Alice usage

Per the research dump section "OPTIMIZATION & RANKING", Alice uses Monte Carlo for risk simulation: vary activity durations against probability distributions, simulate completion-date distribution, report P50/P80/P90 milestones. The activities and their distributions come from the user (with optimistic/pessimistic factors).

The customer problem solved: **what is the probability the project finishes by date X?**

#### STAVAGENT usage

Implemented in `Monolit-Planner/shared/src/calculators/pert.ts`. Triangular distribution per activity (chosen over beta because it is bounded, intuitive, and "sufficient for construction" per the source comment). 10,000 iterations default. `runMonteCarlo()` operates on the critical-path activities of a single element. Curing-activity distributions are not generic ±X% — they come from `curingThreePoint(temperature ± 5 °C / − 8 °C)` so the optimistic/pessimistic legs are physically grounded in expected weather variability.

```ts
// Monolit-Planner/shared/src/calculators/pert.ts:140-210 (excerpt, condensed)
export function sampleTriangular(o: number, m: number, p: number, rng: () => number): number {
  const u = rng();
  const range = p - o;
  if (range === 0) return m;
  const fc = (m - o) / range;
  if (u < fc) {
    return o + Math.sqrt(u * range * (m - o));
  } else {
    return p - Math.sqrt((1 - u) * range * (p - m));
  }
}

export function runMonteCarlo(
  activities: ThreePointEstimate[],
  iterations = 10000,
  seed?: number,
): MonteCarloResult {
  const rng = seed !== undefined ? seededRng(seed) : Math.random;
  const totals: number[] = new Array(iterations);

  for (let i = 0; i < iterations; i++) {
    let total = 0;
    for (const act of activities) {
      total += sampleTriangular(act.optimistic, act.most_likely, act.pessimistic, rng);
    }
    totals[i] = total;
  }

  totals.sort((a, b) => a - b);
  // P50/P80/P90/P95, mean, std_dev, histogram of 10 bins...
}
```

And the integration with maturity-aware curing distribution from `element-scheduler.ts:411-448`:

```ts
// element-scheduler.ts:411-448 (excerpt)
let monte_carlo: MonteCarloResult | undefined;
if (input.pert_params) {
  const pp = input.pert_params;
  const optFactor = pp.optimistic_factor ?? 0.75;
  const pesFactor = pp.pessimistic_factor ?? 1.50;
  const iterations = pp.monte_carlo_iterations ?? 10000;

  const criticalActivities: ThreePointEstimate[] = [];
  for (const nodeId of critical_path) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    if (node.type === 'curing' && input.maturity_params) {
      // Curing uses physics-grounded three-point: warm (+5°C) / planned / cold (-8°C)
      const mp = input.maturity_params;
      const tp = curingThreePoint(
        mp.concrete_class,
        mp.element_type ?? 'slab',
        mp.temperature_c,
        mp.cement_type ?? 'CEM_I',
      );
      criticalActivities.push({
        optimistic: tp.optimistic_hours / 24,
        most_likely: tp.most_likely_hours / 24,
        pessimistic: tp.pessimistic_hours / 24,
      });
    } else {
      // Work activities use generic PERT factors
      criticalActivities.push(toThreePoint(node.duration, optFactor, pesFactor));
    }
  }

  if (criticalActivities.length > 0) {
    monte_carlo = runMonteCarlo(criticalActivities, iterations, pp.seed);
  }
}
```

#### Why these are different solutions

- **Distribution source**: Alice's distributions are user-supplied (the user types optimistic / most likely / pessimistic, or accepts defaults). STAVAGENT's distributions for curing are **derived from physics**: ±5 °C warm spell vs −8 °C cold spell are concrete-specific weather variabilities, and `getStripWaitHours()` is re-evaluated at each leg. Work-activity distributions fall back to generic factors.
- **Scope**: Alice runs Monte Carlo on the project-level critical path (potentially hundreds of activities). STAVAGENT runs it on the per-element critical path (typically 5–25 activities).
- **Customer use**: Alice answers "is the project on time with 80% confidence". STAVAGENT answers "is THIS element schedulable in N days with 80% confidence given the weather risk". Both are valuable; they answer different questions.
- **Net: same algorithm, physics-grounded distribution for curing is a STAVAGENT differentiator.** A user-supplied "curing pessimistic = 1.5×" misses the fact that a cold snap pushes XF4 curing class 4 from 9 d to 18 d (per the `CURING_DAYS_TABLE`).

### 5.3 Pareto multi-objective optimisation

#### Alice usage

Per the research dump section "MULTI-OBJECTIVE OPTIMIZATION (Многокритериальная оптимизация)", Alice minimises a weighted sum f₁..f₇ (duration, cost, idle time, labour cost, equipment cost, risk score, carbon emissions) subject to CSP constraints, then enumerates the Pareto frontier and lets the user pick. The user can choose preset weight bundles or custom weights.

The customer problem solved: **out of the family of feasible schedules, which ones are on the optimality frontier and which trade-off do I want?**

#### STAVAGENT usage

Implemented in `Monolit-Planner/shared/src/calculators/lateral-pressure.ts:319-332` as a **scalarised two-objective sort** (cost × stage-count penalty), not a frontier explorer. The objectives are `rental_czk_m2_month` (cost) and `getStageCountPenalty(stages)` (practicality). The sort is applied after the CSP filter (`filterFormworkByPressure()`); systems with 0 rental (tradiční tesařské) go last regardless of penalty, which is itself a meta-rule.

```ts
// lateral-pressure.ts:319-332 (excerpt)
// BUG-5: Sort by score = rental × stage_count_penalty.
// Balances pure cost against practicality (fewer záběry = less work).
suitable.sort((a, b) => {
  const aZero = a.rental_czk_m2_month === 0;
  const bZero = b.rental_czk_m2_month === 0;
  if (aZero && !bZero) return 1;
  if (bZero && !aZero) return -1;

  const aStages = computeStageCount(a, pressure_kn_m2, pour_height_m);
  const bStages = computeStageCount(b, pressure_kn_m2, pour_height_m);
  const aScore = a.rental_czk_m2_month * getStageCountPenalty(aStages);
  const bScore = b.rental_czk_m2_month * getStageCountPenalty(bStages);
  if (aScore !== bScore) return aScore - bScore;
  return aStages - bStages; // tiebreaker: fewer stages wins
});

// And the penalty function:
export function getStageCountPenalty(stageCount: number): number {
  if (stageCount <= 2) return 1.0;
  if (stageCount === 3) return 1.1;
  if (stageCount <= 5) return 1.3;
  return 1.5;
}
```

Additionally `pour-task-engine.ts` produces a **two-scenario output** when `target_window_h` is supplied: `pumps_for_actual_window` (current scenario) and `pumps_for_target_window` (alternative for a faster window). This is a Pareto sample of size 2 along the duration-cost tradeoff, not a frontier.

#### Why these are different solutions

- **Output cardinality**: Alice produces a Pareto frontier (a set, typically tens to hundreds of points). STAVAGENT produces a sorted candidate list (the formwork case) or a 2-scenario compare (the pump case).
- **Objectives**: Alice has 7 generic objectives. STAVAGENT's scalarised pair (cost, stage-count penalty) is **domain-specific** — stage count is a construction-practicality proxy that Alice does not have natively.
- **User control**: Alice exposes weight tuning. STAVAGENT's penalty is a fixed engineering judgment baked into the engine.
- **Net: same conceptual family (multi-objective optimisation), different cardinality and different objective vocabulary.** Adopting Alice-style frontier exploration is an explicit recommendation in §6.

### 5.4 CSP — Constraint Satisfaction Problem

#### Alice usage

Per the research dump section "CONSTRAINT SATISFACTION PROBLEM (CSP)", Alice's CSP layer enforces logical, resource, temporal, spatial, and financial constraints over the schedule, with backtracking when conflicts surface. The variables are activity start times and resource assignments; the domain is the project timeline.

The customer problem solved: **eliminate impossible schedules from the population before ranking.**

#### STAVAGENT usage

Multiple distinct CSP-style layers, each on a small, structured domain:

1. **Formwork pre-filter** (`lateral-pressure.ts:263` `filterFormworkByPressure()`) — runs the constraint `sys.pressure_kn_m2 ≥ required_pressure` (with per-záběr staging recovery `effectiveMaxH = sys.pressure / required × pour_height`) over the catalogue of ~30 systems and reduces to suitable ones. Slab-category systems are excluded from vertical elements (orthogonal constraint). Systems without defined pressure (tradiční tesařské) pass unconditionally.

2. **Sanity ranges** in `element-classifier.ts` `SANITY_RANGES` — per-element volume / height bounds that emit warnings when violated (e.g. rimsa 0.5–500 m³, pilota 0.5–600 m³, driky_piliru 1–800 m³ per CLAUDE.md §"Calculator UX A1-A7 (v4.15)").

3. **Volume-vs-geometry check** at `element-classifier.ts` `checkVolumeGeometry()` (CLAUDE.md §v4.22 Phase 1) — verifies `V_user / V_expected ∈ [0.3, 3.0]`, emits ⛔ KRITICKÉ outside or ⚠️ in 0.3–0.7 / 1.5–3 bands, with a "you may be entering one span instead of total" hint for mostovka.

4. **Exposure-class allow-list** `RECOMMENDED_EXPOSURE` per element type — emits "Vyberte jednu z: XF2, XF4 …" warning when user chooses an off-list class.

5. **MSS hard lock** (CLAUDE.md §v4.22) — when `construction_technology = 'mss'` for mostovkova_deska, the form disables `has_dilatation_joints` + `tacts_per_section_manual` inputs. The orchestrator emits ⛔ KRITICKÉ warning if API caller still tries to override.

6. **DAG cycle check** in `scheduleElement()` — throws `'Scheduling deadlock — cycle in DAG?'` when the greedy scheduler runs out of ready nodes with non-empty remaining set.

```ts
// lateral-pressure.ts:263-314 (excerpt) — formwork CSP
export function filterFormworkByPressure(
  pressure_kn_m2: number,
  systems: FormworkSystemSpec[],
  orientation: 'vertical' | 'horizontal' = 'vertical',
  pour_height_m?: number,
): FormworkFilterResult {
  const suitable: FormworkSystemSpec[] = [];
  const rejected: FormworkSystemSpec[] = [];

  for (const sys of systems) {
    // Horizontal: lateral pressure is irrelevant — concrete sits ON the formwork
    if (orientation === 'horizontal') { suitable.push(sys); continue; }

    // Slab systems excluded for vertical elements
    if (sys.formwork_category === 'slab') { rejected.push(sys); continue; }

    // No pressure limit → unlimited (tradiční, special)
    if (sys.pressure_kn_m2 == null) { suitable.push(sys); continue; }

    if (sys.pressure_kn_m2 < pressure_kn_m2) {
      // Recovery: can záběrová betonáž save the system?
      if (pour_height_m && pour_height_m > 0) {
        const sysMaxStageH = (sys.pressure_kn_m2 / pressure_kn_m2) * pour_height_m;
        const catalogMaxH = sys.max_pour_height_m ?? Infinity;
        const effectiveMaxH = Math.min(sysMaxStageH, catalogMaxH);
        if (effectiveMaxH >= 1.5) {
          // System works with ≥1.5 m záběry
          suitable.push(sys);
          continue;
        }
      }
      rejected.push(sys);
      continue;
    }
    suitable.push(sys);
  }
  // ...sort by cost × penalty (see §5.3)
  return { suitable, rejected, pressure_kn_m2, has_suitable: suitable.length > 0 };
}
```

#### Why these are different solutions

- **Variable space**: Alice's CSP is over the project schedule (large, unstructured). STAVAGENT's CSPs are over small structured domains (catalogue, parameter ranges, exposure classes).
- **Algorithm**: Alice uses backtracking search (per the research dump's algorithmic description). STAVAGENT uses constructive filtering — apply the constraint once, drop infeasible candidates, no backtracking needed because the candidate set is enumerable in `O(n)`.
- **Recovery**: STAVAGENT's formwork CSP has a **domain-specific recovery rule** (per-záběr staging) that is not a generic CSP technique — it is engineering knowledge that "if a 100 kN/m² system cannot handle full-height pressure, you can pour in stages and the system handles per-stage pressure". Alice's generic CSP cannot invent staging rules.
- **Net: same algorithmic family, very different domains.** STAVAGENT's CSPs are more like "validators with recovery" than the textbook backtracking-search CSP that Alice describes.

### 5.5 Parametric modelling — variables vs fixed values

#### Alice usage

Per the research dump section "PARAMETRIC SCHEDULE MODEL", Alice's core innovation is converting the static P6/MSP schedule (where activity durations are fixed numbers) into a parametric model where each duration is a function of crew size, productivity, weather, equipment count, etc. `Duration = Base / (Crew × Productivity × Weather × Skill)`. The user defines ranges on each parameter; the engine sweeps the parameter cube.

The customer problem solved: **convert a static schedule into an explorable family.**

#### STAVAGENT usage

STAVAGENT is **already parametric all the way down** — there is no "static schedule" to convert. The pipeline is:

1. `PlannerInput` carries the parameters: `volume_m3`, `height_m`, `concrete_class`, `exposure_class`, `temperature_c`, `season`, `num_sets`, `num_formwork_crews`, `num_rebar_crews`, `num_pumps_available`, `crew_size`, `shift_h`, `preferred_manufacturer`, `construction_technology`, `is_prestressed`, `prestress_cables_count`, `prestress_tensioning`, `pile_diameter_mm`, `pile_count`, `pile_geology`, etc.
2. Each engine derives intermediate values: `lateral-pressure.ts` derives `p` from `(h, k)`, `maturity.ts` derives `curing_days` from `(concrete_class, temperature, exposure, curing_class)`, `pour-task-engine.ts` derives `effective_rate` from `MIN(pump, plant, mixer, site, element)` and `pumping_hours = volume / effective_rate`, `rebar-lite` derives `h/t` from `(category, diameter)` per `REBAR_RATES_MATRIX`.
3. `element-scheduler.ts` consumes the derived per-tact durations and runs the RCPSP.
4. The orchestrator (`planner-orchestrator.ts`) sequences all of this into one `PlannerOutput`.

```ts
// pour-task-engine.ts:165-198 (excerpt) — effective rate is parametric on multiple bottlenecks
const rates: Array<{ source: PourTaskResult['rate_bottleneck']; rate: number }> = [
  { source: 'element', rate: profile.max_pour_rate_m3_h },
  { source: 'plant', rate: input.plant_rate_m3_h ?? DEFAULTS.plant_rate_m3_h },
  { source: 'mixer', rate: input.mixer_delivery_m3_h ?? DEFAULTS.mixer_delivery_m3_h },
];
if (input.pump_capacity_m3_h !== undefined) {
  rates.push({ source: 'pump', rate: input.pump_capacity_m3_h });
}
if (input.site_constraint_m3_h !== undefined) {
  rates.push({ source: 'site', rate: input.site_constraint_m3_h });
}

const pump_needed = profile.pump_typical || input.volume_m3 > 5;
// Pump count from caller (orchestrator forwards pourDecision.pumps_required)
const pumps_required = Math.max(1, Math.floor(input.num_pumps_available ?? 1));

rates.sort((a, b) => a.rate - b.rate);
const effective = rates[0];
const single_pump_rate = effective.rate;
const effective_rate_m3_h = single_pump_rate * pumps_required;
const rate_bottleneck = effective.source;

const pumping_hours = input.volume_m3 / effective_rate_m3_h;
const total_pour_hours = setup + pumping_hours + washout;
const pour_days = roundTo(total_pour_hours / shift, 2);
```

And the rebar matrix lookup at `element-classifier.ts:1732`:

```ts
// element-classifier.ts:1732-1753
export function getRebarNormForDiameter(
  element_type: StructuralElementType,
  diameter_mm?: number,
): RebarNormLookup {
  const profile = getElementProfile(element_type);
  // Pile armokoš is prefab — different workflow, falls back to legacy 30 h/t
  if (element_type === 'pilota') {
    return { norm_h_per_t: profile.rebar_norm_h_per_t, source: 'legacy' };
  }
  const category = profile.rebar_category;
  const d = diameter_mm ?? profile.rebar_default_diameter_mm;
  const matrix = REBAR_RATES_MATRIX[category];
  const rate = matrix ? matrix[d] : undefined;
  if (rate !== undefined) {
    return { norm_h_per_t: rate, source: 'matrix', category, used_diameter_mm: d };
  }
  // Unusual diameter → legacy per-element rate
  return { norm_h_per_t: profile.rebar_norm_h_per_t, source: 'legacy' };
}
```

#### Why these are different solutions

- **Starting point**: Alice converts a **static** schedule into parametric. STAVAGENT is **born parametric** — there is no static input to begin with.
- **Parameter scope**: Alice's parameters are mostly schedule-shape parameters (crew size, productivity, shifts). STAVAGENT's parameters extend to **physics parameters** (concrete class, exposure class, temperature, geometry, formwork pressure capacity) — these have no analogue in Alice's model because Alice does not derive durations from physics.
- **Sweep cardinality**: Alice's combinatorial generator (Construction Simulation, §2.12) explores ~10⁶ scenarios automatically. STAVAGENT explores 1 deterministic scenario per call; the user can save up to 10 variants but each is a manual call. Adopting an Alice-style sweep is the highest-impact recommendation in §6.
- **Net: STAVAGENT is parametric in a deeper sense (physics-grounded) but explores a thinner population (deterministic single-shot). Alice is parametric in a shallower sense (no physics) but explores a fatter population (combinatorial sweep).** The two are genuinely orthogonal capabilities; combining them is the strategic play.

### 5.6 Honest summary of the math comparison

| OR construct | Alice scope | STAVAGENT scope | Customer problem |
|--------------|-------------|-----------------|------------------|
| RCPSP | Project (10² activities × shared resources) | Per-element (10¹ activities × 2 crew pools + sets) | Different scale, same family |
| Monte Carlo | Project critical path, user distributions | Per-element critical path, physics-grounded curing distribution | Different scope, STAVAGENT distribution is deeper |
| Pareto multi-objective | Frontier of ~10²-10³ feasible points | Scalarised 2-objective sort + 2-scenario compare | Different cardinality |
| CSP | Backtracking search over project schedule | Constructive filter + recovery on small structured domains | Different algorithm despite same family name |
| Parametric modelling | P6 schedule → parametric, sweep cube | Born parametric (incl. physics), single-shot evaluation | Different starting point and population |

The two products end up in the same OR-textbook chapter and on different shelves of the same hardware store. The math is genuinely shared; the customer problem is not.

---

<a id="6-recommendations"></a>

## 6. Recommendations — 5–10 features worth adopting

Prioritised list. Each item: what it is, why it matters for STAVAGENT specifically, effort sizing (S = days, M = weeks, L = months), prerequisites, and rationale. Roadmap-lite — no sprint mapping.

### 6.1 P0 — Combinatorial scenario generator on top of `planElement()`

- **What**: a thin sweep harness that iterates over a parameter grid (default: `num_sets × num_formwork_crews × num_pumps_available × scheduling_mode × season × preferred_manufacturer`), calls `planElement()` per cell, drops scenarios with ⛔ KRITICKÉ warnings, returns a `ScenarioPopulation` with per-scenario `(total_days, total_cost_czk, warnings_count, breakdown)`.
- **Why**: largest demo-value-per-week ratio. Closes the most visible Alice gap (Pareto-frontier exploration). Reuses 100 % of the existing engines. The `planner_variants` table and the `VariantsComparison` component already give us the storage and the comparison surface; we just need the generator and a scatter plot.
- **Effort**: **M (2-3 weeks).** Generator: ~200 LOC + tests. UI: scatter plot of `total_days` vs `total_cost_czk` with Pareto-frontier highlighting (`O(n²)` extraction, fine for n < 1000). Variant import button to save selected frontier points as named variants.
- **Prerequisites**: none. `planElement()` is already pure-ish.
- **Rationale**: this is the single highest-ROI item in the entire audit. The engine work is already done; we ship the consumer of it.

### 6.2 P0 — Calendar-aware Gantt with CZ public holidays + weekends

- **What**: extend `calendar-engine.ts` (currently 366 LOC) to support project start date, CZ public holiday calendar, weekend skipping, optional shift modes. Render the per-element Gantt with calendar dates instead of ordinal day numbers.
- **Why**: every realistic plan needs calendar dates. CLAUDE.md TODO already lists this as P3 ("Gantt calendar — date axis in Portal mode"). Promote to P0 because it is a prerequisite for project-level features in 6.3 and 6.4.
- **Effort**: **M (1-2 weeks).** Extend `calendar-engine.ts` + replace ordinal-day rendering in `CalculatorResult.tsx` Gantt + add CZ holiday list + working-day arithmetic helpers.
- **Prerequisites**: none.
- **Rationale**: cheap, foundational, unblocks everything else.

### 6.3 P0 — Optimisation presets bundle (cost / duration / balanced / resource-light)

- **What**: top-level radio-group in PlannerPage that bundles a coherent set of input lever values:
  - "Min cost" → `num_sets = num_tacts` (no reuse, no parallelism), `num_formwork_crews = 1`, `num_pumps_available = 1`, prefer cheapest manufacturer, accept longer schedule.
  - "Min duration" → `num_sets = 1` (max reuse), `num_formwork_crews = 2`, `num_pumps_available = 2-3`, accept higher cost.
  - "Balanced" → midpoint.
  - "Resource-light" (small SMB) → `num_formwork_crews = 1`, `num_pumps_available = 1`, longer durations OK.
- **Why**: lowers the cognitive overhead for a přípravář meeting STAVAGENT for the first time. Mirrors Alice's preset bundles. Foundational input to the scenario generator (P0 6.1).
- **Effort**: **S (3-5 days).** UI radio group + preset application logic in `useCalculator`.
- **Prerequisites**: none, but pairs naturally with 6.1.
- **Rationale**: trivial work, real UX uplift, alignment with Alice convention.

### 6.4 P1 — Project-level cost roll-up + PDF/Excel export

- **What**: aggregate `PlannerOutput.costs` across all positions in a `monolith_projects` row, render a project summary view (totals, per-element breakdown, CSV/Excel/PDF export). Ride on the existing Excel exporter.
- **Why**: the project bid is the actual deliverable. Without a roll-up the přípravář is stitching 50 element exports together by hand.
- **Effort**: **M (2-3 weeks).** SQL roll-up query + view + export wiring. PDF rendering is the longest part (likely Puppeteer or a server-side templating library).
- **Prerequisites**: none. Builds on existing `monolith_projects → bridges → positions` schema.
- **Rationale**: long-overdue. Shifts STAVAGENT from "calculator" to "bid tool".

### 6.5 P1 — Conversational project agent (extend planner-advisor + MCP `get_construction_advisor` to project scope)

- **What**: a chat surface in PlannerPage / Portal that answers questions across a whole project (50 elements). Backed by retrieval over per-element results + TZ excerpts + KB. Uses MCP toolset for on-demand calculations.
- **Why**: matches Alice's Schedule Insights Agent on the surface; differentiates by being Czech-construction-norm-grounded with citations to ČSN / TKP / DOKA. Strong pitch element for CSC 2026.
- **Effort**: **M-L (4-8 weeks).** Retrieval architecture (per-element summaries → vector store), context-window budgeting, chat UI, conversation state, citation rendering.
- **Prerequisites**: 6.4 (project roll-up gives the data substrate); MCP server is already set up for tool-calling.
- **Rationale**: distinctive, demo-friendly, uses existing MCP investment.

### 6.6 P1 — DCMA-lite schedule quality report (focused on what matters for engineering)

- **What**: not the full DCMA 14, but a STAVAGENT-flavoured schedule-quality check that runs on the assembled project schedule: missing curing days, missing prestress wait, formwork choices that violate per-záběr pressure, props-when-no-height warnings, unrealistic crew sizes.
- **Why**: differentiated take on Alice's DCMA — ours validates **engineering correctness**, not P6 hygiene. Each rule already exists somewhere as a per-element warning; the value-add is the **project-level summary report**.
- **Effort**: **M (2-3 weeks).** Aggregator over all-element warnings, severity classifier (already partly done per CLAUDE.md §v4.22 Phase 1 deferred work), summary view.
- **Prerequisites**: 6.4.
- **Rationale**: low-cost differentiator, leverages existing warnings infrastructure.

### 6.7 P1 — Equipment-fleet view (single-firm, cross-project)

- **What**: domain object `EquipmentFleet` representing the firm's owned cranes / pumps / formwork sets / props. Per-project planning consumes from the fleet; per-fleet view shows utilisation across projects, idle costs, conflicts.
- **Why**: differentiates from Alice (their fleet view is per-project). Czech SMBs have limited fleets and care deeply about utilisation.
- **Effort**: **L (2-3 months).** New domain model, new UI surface, cross-project queries, conflict-detection logic.
- **Prerequisites**: 6.2 (calendar dates) + 6.4 (project roll-up).
- **Rationale**: vertical-specific feature that Alice will not chase. Long-term, defensible.

### 6.8 P2 — Project-level RCPSP (cross-element scheduler)

- **What**: take per-element schedules from `applyPlanToPositions.ts` and combine into a project Gantt with shared crews and equipment. Resolve cross-element resource conflicts.
- **Why**: completes the optics-parity with Alice. But STAVAGENT's per-element accuracy is a stronger story; project-level aggregation can wait until 6.4 + 6.7 land.
- **Effort**: **L (3-4 months).** Project-level scheduler engine, cross-element resource pool, calendar arithmetic, UI.
- **Prerequisites**: 6.2, 6.4, 6.7.
- **Rationale**: necessary at some point for Alice optics-parity; the engineering value is real but the unit economics depend on landing 6.1 + 6.4 + 6.5 first.

### 6.9 P2 — Parametric BIM (read-only IFC ingest, no Revit)

- **What**: minimal IFC ingest that pulls element geometry + material spec + element-type and feeds it into the existing classifier + calculator pipeline. Skip 4D overlay; focus on the engineering pipeline.
- **Why**: catches the upmarket signal. Does not commit to BIM-as-product.
- **Effort**: **L (2-4 months).** IFC parsing library binding (IfcOpenShell or web-ifc), element-mapping logic to STAVAGENT's element types, geometry extraction.
- **Prerequisites**: native binaries on Cloud Run.
- **Rationale**: defer until upmarket move is a deliberate decision. Per CLAUDE.md backlog already P3.

### 6.10 P3 — P6/MSP XML export (read-only round-trip)

- **What**: emit Primavera P6 XML for a project schedule (after 6.8 lands) so enterprise customers can ingest into their existing P6 deployment.
- **Why**: enterprise sales blocker if STAVAGENT ever moves up-market.
- **Effort**: **M (3-6 weeks).** P6 XML schema mapping; round-trip is much harder, defer.
- **Prerequisites**: 6.8.
- **Rationale**: only valuable post-upmarket decision. Until then, do not build.

### 6.11 Summary roadmap

| Priority | Item | Effort | Prereqs | Pitch value |
|----------|------|--------|---------|-------------|
| P0 | Combinatorial scenario generator | M (2-3w) | none | very high |
| P0 | Calendar-aware Gantt + CZ holidays | M (1-2w) | none | foundational |
| P0 | Optimisation presets bundle | S (3-5d) | none | medium |
| P1 | Project cost roll-up + exports | M (2-3w) | none | high |
| P1 | Conversational project agent | M-L (4-8w) | 6.4, MCP | very high |
| P1 | DCMA-lite engineering quality report | M (2-3w) | 6.4 | medium-high |
| P1 | Equipment-fleet view | L (2-3mo) | 6.2, 6.4 | high (CZ-specific) |
| P2 | Project-level RCPSP | L (3-4mo) | 6.2, 6.4, 6.7 | medium (parity) |
| P2 | Read-only IFC ingest | L (2-4mo) | binaries | defer |
| P3 | P6/MSP XML export | M (3-6w) | 6.8 | enterprise-only |

The minimum coherent slice for CSC 2026 (deadline 28.06.2026): **6.1 + 6.2 + 6.3** in 4–6 weeks, plus 6.4 if calendar slips give us a buffer. That set demos the Alice overlap (scenarios + presets), keeps the engineering-correctness story (the scenarios are physics-grounded), and shows roll-up movement (project totals).

---

<a id="7-sources"></a>

## 7. Sources & traceability

### 7.1 STAVAGENT references

All file paths relative to repository root. Line numbers stable as of branch `claude/competitive-audit-stavagent-hfgwP` head, 2026-05-07.

| Topic | File | Lines |
|-------|------|-------|
| Calculator philosophy | `docs/CALCULATOR_PHILOSOPHY.md` | full document |
| RCPSP greedy list scheduling | `Monolit-Planner/shared/src/calculators/element-scheduler.ts` | 139–457 (main `scheduleElement`), 289–359 (priority loop) |
| RCPSP critical path (backward pass) | `Monolit-Planner/shared/src/calculators/element-scheduler.ts` | 461–500 (`computeCriticalPath`) |
| RCPSP chess scheduling mode | `Monolit-Planner/shared/src/calculators/element-scheduler.ts` | 188–235 |
| RCPSP Gantt rendering | `Monolit-Planner/shared/src/calculators/element-scheduler.ts` | 409 (`renderGantt`) |
| PERT three-point + Monte Carlo (triangular) | `Monolit-Planner/shared/src/calculators/pert.ts` | 69–105 (`calculatePert`/`toThreePoint`), 140–210 (`runMonteCarlo`/`sampleTriangular`) |
| PERT integration with maturity-aware curing distribution | `Monolit-Planner/shared/src/calculators/element-scheduler.ts` | 411–448 |
| DIN 18218 lateral pressure | `Monolit-Planner/shared/src/calculators/lateral-pressure.ts` | 155–194 (`calculateLateralPressure`) |
| Formwork CSP filter + recovery | `Monolit-Planner/shared/src/calculators/lateral-pressure.ts` | 263–340 (`filterFormworkByPressure`) |
| Pour-stage suggestion | `Monolit-Planner/shared/src/calculators/lateral-pressure.ts` | 390–477 (`suggestPourStages`) |
| Stage-count penalty (multi-objective scalarisation) | `Monolit-Planner/shared/src/calculators/lateral-pressure.ts` | 256–261 (`getStageCountPenalty`), 319–332 (sort) |
| ConcreteConsistency k-factor (DIN 18218) | `Monolit-Planner/shared/src/calculators/lateral-pressure.ts` | 49–59 |
| Saul/Nurse-Saul maturity index | `Monolit-Planner/shared/src/calculators/maturity.ts` | 399–408 (`calculateMaturityIndex`) |
| ČSN EN 13670 Table NA.2 lookup | `Monolit-Planner/shared/src/calculators/maturity.ts` | 168–203 (`CURING_DAYS_TABLE`) |
| TKP18 §7.8.3 exposure-class minimum | `Monolit-Planner/shared/src/calculators/maturity.ts` | 89–122 (`EXPOSURE_MIN_CURING_DAYS`, `getExposureMinCuringDays`) |
| Default curing class per element | `Monolit-Planner/shared/src/calculators/maturity.ts` | 611–631 (`DEFAULT_CURING_CLASS`, `getDefaultCuringClass`) |
| Plowman log-maturity strength estimation | `Monolit-Planner/shared/src/calculators/maturity.ts` | 351–368 (`estimateStrengthPct`) |
| Three-point curing distribution (±5/-8 °C) | `Monolit-Planner/shared/src/calculators/maturity.ts` | 416–436 (`curingThreePoint`) |
| Pour decision tree (sectional vs monolithic) | `Monolit-Planner/shared/src/calculators/pour-decision.ts` | 76–250+ (`PourDecisionInput`/`Output`/`ELEMENT_DEFAULTS`) |
| Pour task engine (effective rate = MIN of bottlenecks) | `Monolit-Planner/shared/src/calculators/pour-task-engine.ts` | 156–198 |
| Pour crew composition (`computePourCrew`) | `Monolit-Planner/shared/src/calculators/pour-task-engine.ts` | full file (CLAUDE.md §v4.24 changelog) |
| Element classifier (early-exits + OTSKP rules + keyword fallback) | `Monolit-Planner/shared/src/classifiers/element-classifier.ts` | 580 (`OTSKP_RULES`), 654 (`KEYWORD_RULES`), 847–960 (`classifyElement`) |
| Rebar matrix (h/t by category × diameter) | `Monolit-Planner/shared/src/classifiers/element-classifier.ts` | 1688–1705 (`REBAR_RATES_MATRIX`), 1732–1753 (`getRebarNormForDiameter`) |
| Volume-vs-geometry consistency check | `Monolit-Planner/shared/src/classifiers/element-classifier.ts` | `checkVolumeGeometry` (cf. CLAUDE.md §v4.22 Phase 1) |
| Sanity ranges per element | `Monolit-Planner/shared/src/classifiers/element-classifier.ts` | `SANITY_RANGES` |
| MCP server v1.0 | `concrete-agent/packages/core-backend/app/mcp/server.py` | full file |
| MCP `calculate_concrete_works` tool | `concrete-agent/packages/core-backend/app/mcp/tools/calculator.py` | full file (esp. lines 116–306 docstring) |
| Apply plan → TOV projection | `Monolit-Planner/frontend/.../applyPlanToPositions.ts` (cf. CLAUDE.md §"Aplikovat → TOV (v4.14)") |  |
| TZ text + smeta-line extractor | `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts` | full file (CLAUDE.md §v4.18 + §v4.23) |
| Variant comparison UI | `Monolit-Planner/frontend/.../VariantsComparison.tsx` (CLAUDE.md §v4.15 A5) |  |
| Variant storage schema | `monolit_planner.planner_variants` table |  |
| Wizard inline-sidebar mode | `Monolit-Planner/frontend/.../WizardHintsPanel.tsx` (CLAUDE.md §"Průvodce (Wizard)") |  |
| AI advisor prompt v2 | `Monolit-Planner/backend/src/routes/advisor-prompt.js` (CLAUDE.md §v4.18) |  |
| Confidence ladder convention | `CLAUDE.md` "Conventions" section |  |
| Construction-correct ordering | `Monolit-Planner/shared/src/classifiers/element-classifier.ts` | `BRIDGE_ELEMENT_ORDER`, `BUILDING_ELEMENT_ORDER` |
| MSS (movable scaffolding) integrated path | `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` (CLAUDE.md §v4.21) |  |
| Pile pipeline (`runPilePath`) | `Monolit-Planner/shared/src/calculators/pile-engine.ts` (CLAUDE.md §v4.16) |  |
| Test count baseline | `CLAUDE.md` "Totals" table — Monolit-Planner 921+5 shared tests, total 1258+ |  |

### 7.2 Alice references

All Alice references are to the inline research dump appended to the audit task prompt of 2026-05-06 (the conversation context labelled "ПОЛНЫЙ АНАЛИЗ СЕРВИСА ALICE TECHNOLOGIES" + the technical breakdown labelled "ТЕХНИЧЕСКИЙ АНАЛИЗ: КАК ALICE СЧИТАЕТ РЕСУРСЫ И ОПТИМИЗИРУЕТ ГРАФИКИ" + the focused breakdown of Construction Simulation and Resource Management). Per the Q1 interview decision, no `docs/competitive/alice_research_2026_05.md` source file exists in the repository; quotations and feature descriptions in this document are paraphrases of those dumps with attribution to the appropriate section header.

Section headers referenced:

- "ALICE PLAN (Планирование на холсте)" — §2.1 above.
- "ALICE OPTIMIZE (Оптимизация графиков)" — §2.2.
- "ALICE MODEL (BIM интеграция)" — §2.3.
- "Generative Scheduling (Генеративное планирование)" — §2.4.
- "DCMA 14-Point Check (Проверка качества расписания)" — §2.5.
- "Optimization Presets (Предустановки оптимизации)" — §2.6.
- "Analytics and Reporting" — §2.7.
- "Risk Management" — §2.8.
- "Construction Sequencing" — §2.9.
- "Multi-Objective Optimization" — §2.10, §5.3.
- "CONSTRAINT SATISFACTION PROBLEM (CSP)" — §2.11, §5.4.
- "Construction Simulation" — §2.12.
- "Resource Management" — §2.13.
- "Schedule Insights Agent (Агент аналитики расписания)" — §2.14.
- "PARAMETRIC SCHEDULE MODEL (Параметрическое моделирование)" — §5.5.
- "MULTI-OBJECTIVE OPTIMIZATION (Многокритериальная оптимизация)" — §5.3, §2.10.
- "АРХИТЕКТУРА АЛГОРИТМА ALICE" / "ALGORITHMIC PROCESS" — §5.1, §5.4.

Public Alice surface (alicetechnologies.com): named customers cited in the dumps include SCS JV (HS2 Copthall Green Tunnel), Suffolk Construction, Build Group, Zachry Construction, Parsons, Andrade Gutierrez. Funding stage: $47M Series B per the audit task brief (not independently verified in this audit). Top 50 Contech Startups 2026 listing (Cemex Ventures) per the audit task brief.

### 7.3 Out of scope for this audit

- **Aitenders** — referenced once in §1 to clarify the layer-1 boundary. Full audit deferred.
- **Alice pricing / business model / GTM** — explicitly out of scope per the task spec. This audit treats Alice as a technical capability, not a commercial entity.
- **Pitch-deck-ready phrasings** — this is an engineer-honest audit, not a pitch. The §1 TL;DR carries the slide angle but the body of the document is for internal calibration.
- **STAVAGENT v5.0 sprint-by-sprint mapping** — the recommendation list in §6 is a roadmap-lite (priority + effort + prereqs only) per the Q5 interview decision. Sprint mapping is a separate task.

---

## Appendix A — version history

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-05-07 | Claude Code | Initial engineering audit. Branch `claude/competitive-audit-stavagent-hfgwP`. Alice source: inline research dump in audit-task prompt of 2026-05-06. STAVAGENT source: code on branch head. No new files outside `docs/competitive/`. |

---
