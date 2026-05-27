# TASK_Orchestrator_WorkOntology_SO250

**Target week:** Week 3 of Cemex CSC 2026 runway (Jun 10 — Jun 16, 2026)
**Estimated effort:** ~30 hours (extraction ~14h + calculator integration ~8h + validation ~4h + tests ~4h)
**Dependencies:** TASK_Orchestrator_StageGating_MVP (Week 2) must be complete — this task fills the WORK_ATOMIZATION stage with real implementation
**Demo role:** Simple case for Cemex demo video (30 seconds, fast/clean showcase of pipeline universality)

---

## Mantra (read this fully before ANY action)

Before writing a single line of code, do all of the following:

1. **Read the entire repo structure.** Identify where existing PDF parsers live, where the 23-element classifier lives, where the canonical calculator (atomic_calculate or calculate_concrete_works) lives, where test fixtures and golden outputs are stored.
2. **Read all 8 PDFs for SO 250 in Project Knowledge.** These are: the Technická zpráva (Příloha č. 1), Situace, Vzorový příčný řez, Rozvinutý pohled, Tvar konstrukce, Výztuž konstrukce, Detaily, Zábradlí, Statický výpočet. Note that you cannot extract DXF from these — they are PDF only. PDF-text path plus visual page rasterization (where needed for tables) is the available extraction channel.
3. **Read the Orchestrator Spec** in Project Knowledge, particularly §6.3 (universal work ontology item schema), §5.3 (Stage 1 XLSX schema), §5.4 (Stage 1 Definition of Done).
4. **Read the existing 23-element classifier code.** Understand how element types are enumerated, what input it expects, what output shape it produces.
5. **Read the canonical calculator code.** Understand inputs (geometry, concrete class, exposure, element type, etc.), outputs (volume, formwork area, formwork cycles, rebar mass, curing window, audit trail).
6. **Read the REBAR_NORMS_COMPREHENSIVE_AUDIT** (if it exists as a file in repo) for rebar norm matrix per element type and bar diameter.
7. **Read the HK212 baseline** (items_hk212_etap1.json or whatever it is called) to understand the existing golden output format for comparison.
8. Only then begin coding.

This task calibrates the orchestrator's WORK_ATOMIZATION stage on a real document set. Quality of extraction and calculator integration is the deliverable.

---

## Pre-Implementation Interview

Ask the user (via AskUserQuestion) before writing code — wait for all answers:

1. **Where does the existing 23-element classifier live?** Is it a single function, a module, an MCP tool wrapper, or something else?
2. **How is the canonical calculator invoked?** Function call, MCP tool call, REST endpoint, or all three?
3. **What is the existing format for items.json or sequential work list output?** This task should produce output in the same format for consistency with HK212 baseline.
4. **Is there an existing PDF text extraction utility** in the repo? If so, use it. If not, what is the preferred library (pdfplumber, PyMuPDF, etc.)?
5. **Where are test fixtures stored?** This task introduces SO 250 as a new test case — needs a location.
6. **Where does the existing HK212 baseline live?** Path to items_hk212_etap1.json or equivalent for regression test comparison.
7. **Is there an existing concept of confidence per work item?** This task produces items with confidence in the audit trail; needs to match existing convention.
8. **How is the existing calculator's audit trail structured?** This task chains calculator output into work item audit, needs alignment.
9. **Is the Stage 1 XLSX schema already implemented in any form?** Templates, helpers, etc.?
10. **What is the existing approach for "sequential order" of work items?** Hardcoded Fáze 1-11, derived from element predecessors, or other?

---

## Context

SO 250 D6 Olšová Vrata-Žalmanov, Zárubní zeď v km 6,500-7,000 vpravo is a real ŘSD highway infrastructure project. PDPS documentation is in Project Knowledge as 8 PDFs.

Key parameters from the TZ:

- Length: ~500m
- Construction: monolitic reinforced concrete retaining wall
- Concrete: C30/37 XC4 for main wall, C25/30 XF1 for foundation (typical), C12/15 X0 for podkladní beton
- Reinforcement: B500B, total mass 161 622 kg (≈161.6 tonnes per statický výpočet)
- 42 dilatation cells along 500m length (spacing ~12m)
- Anti-corrosion: protikorozní ochrana + ochrana proti bludným proudům (zvláštní zařízení)
- Hydroizolace
- Zábradlí ocelové
- Drainage (odvodnění)
- Normy: ČSN EN 1990, EN 1992, EN 1997, EN 206+A1, TKP 30 Speciální zemní konstrukce
- Stupeň PD: PDPS (Provádění Stavby)

This is a simpler structure than SO 202 bridge but provides a full concrete-heavy showcase: foundation patky + monolitic wall + římsy + drainage + joints. All major calculator engines run (concrete, formwork, rebar, curing windows).

The goal: end-to-end pipeline runs from the 8 PDF documents through extraction, calculator integration, and produces a validated Stage 1 work list that passes Definition of Done. This becomes the "30-second fast case" in the Cemex demo video.

---

## Business Logic

### 1. Document ingestion

The orchestrator workflow for SO 250 begins by reading all 8 PDFs from the project document store. Document classification identifies which is the Technická zpráva (primary source of textual parameters), which are výkresy (drawings), and which is the statický výpočet (load calculations and rebar masses).

PDF text extraction produces structured page-level text. For pages containing tables (e.g., concrete class lists, rebar quantity tables in statický výpočet), use visual extraction or table-aware parsing where pure text extraction loses structure.

### 2. Project context extraction

From the TZ, extract:

- Project identification (anonymized — do not preserve specific projektant or investor names in the output)
- Object identification (SO 250, retaining wall, km range)
- Geometry hints (length, height profile if available)
- Material specifications (concrete classes per element, exposure classes, reinforcement grade)
- Norm references (the explicit list of ČSN/EN/TKP norms cited in the TZ)
- Construction technology (monolitic, work joints allowed/not, construction sequence)
- Special requirements (anti-corrosion against stray currents, drainage system, etc.)

Output is a ProjectContext structure populated with these fields and source citations (TZ section, page number, quote).

### 3. Work ontology extraction

For each major structural element identified in the documents, generate a work ontology item per the Pattern 16 universal schema (Orchestrator Spec §6.3):

- id (sequential, e.g., WO-0001)
- work_type (e.g., concrete_placement, reinforcement_installation, formwork_setup, joint_installation, waterproofing, railing_installation)
- element_type (from the 23-element classifier vocabulary)
- object_ref (SO 250)
- location_ref (km range, axis identification if available from drawings)
- material (primary type, class, exposure)
- quantity (value, unit, formula, status: documented / computed / estimated / missing)
- source (array of references with type, ref, confidence)
- execution (phase, sequence, predecessors)
- audit (journey of how this item was derived, review_flags if any)

Major elements to extract from SO 250:

- Výkop pro založení (excavation)
- Podkladní beton C12/15 X0
- Foundation patky / pas (depending on what TZ specifies — verify)
- Monolitic vertical wall (the main structure) — C30/37 XC4
- Reinforcement for foundation and wall — B500B
- Dilatation joints (42 cells along 500m)
- Hydroizolace (waterproofing)
- Drainage (odvodnění)
- Cathodic protection (against stray currents — zvláštní zařízení)
- Římsy (if applicable to this structure type)
- Zábradlí ocelové
- Zásyp (backfill)

If the TZ mentions an element but does not specify quantity, the work ontology item must include the element with quantity status="missing" and a missing_inputs entry triggering HITL or marking for review.

### 4. Calculator integration

For each concrete element with sufficient geometry input, invoke the calculator stack:

1. **classify_construction_element** with the element name and context. Returns one of the 23 element types (e.g., retaining_wall_monolitic, foundation_pad, foundation_strip, rimsa_with_railing).
2. **atomic_calculate** (canonical Core Engine primitive) with element type, geometry, concrete class, exposure class, reinforcement requirements. Returns:
   - volume (m³)
   - formwork area (m²)
   - formwork cycles (count, technology-dependent)
   - rebar mass (kg) and rebar norm hours per tonne (per the REBAR_NORMS matrix)
   - curing window (days, dependent on exposure class and temperature)
   - audit trail (formula, inputs, intermediate values, source confidence per ladder)

The calculator audit trail must be embedded in the work ontology item's audit.journey field. This is the legal-defensibility property: every quantity has a traceable formula.

For SO 250 specifically:

- Monolitic wall: classify as retaining_wall_monolitic. Calculator runs concrete volume from cross-section × length, formwork on both faces, rebar mass from statický výpočet (verify aggregates to 161.6t ± 5%).
- Foundation: classify per actual foundation type from drawings (strip vs pad). Calculator runs accordingly.
- Římsy if applicable: classify as rimsa_with_railing, calculator runs with curing class per TKP 18 §7.8.3.
- Dilatation joints: not a calculator element per se, but the joint count (42) and spacing logic must be captured in the work ontology as a separate joint installation work item.

### 5. Sequential work list generation

Order work items in logical construction execution sequence:

1. Výkop / earthworks
2. Podkladní beton
3. Foundation patky / pas with reinforcement
4. Foundation concrete placement
5. Foundation curing (per exposure class)
6. Vertical wall reinforcement
7. Vertical wall formwork
8. Vertical wall concrete placement
9. Vertical wall curing (curing class 3 for XC4, ≥7 days at 15°C per TKP 18 §7.8.3)
10. Dilatation joint installation (interspersed with wall placement per joint location)
11. Hydroizolace (after wall cured)
12. Anti-corrosion / stray current protection
13. Drainage installation
14. Backfill
15. Římsy if applicable
16. Zábradlí ocelové
17. Final finishes and tests

Sequence numbers, Fáze (if Fáze structure applies to this objekt), and predecessors are populated per Pattern 16 schema execution field.

### 6. Stage 1 Definition of Done validation

After work list generation, invoke validate_stage1_work_list (from Week 2 task). It must pass all checks:

- Every item has ID
- Every item has popis
- Every item has MJ
- Every item has mnozstvi OR explicit quantity_status=missing with HITL flag
- Every item has formula (or explicit reason if formula not applicable, e.g., joint count from drawing count)
- Every item has source
- Every item has audit_trail
- Code column is empty (Pattern 15 Stage 1 enforcement)
- Cena column is empty (Pattern 15 Stage 1 enforcement)
- Logical execution order exists
- No catalog mapping has leaked into work item descriptions

### 7. Output generation

Two output artifacts:

- **items.json (or equivalent existing convention)**: full Pattern 16 work ontology with all audit trails. Machine-readable, used downstream by Stage 3 catalog binding.
- **Stage 1 XLSX export**: human-readable table per Pattern 15 §5.3 schema. Columns: #, Krok, Fáze, Kapitola, ID, Popis, MJ, Mnozstvi, Vzorec / Zdroj, Pozn. (review/clarification queue), Code (empty), Cena (empty).

### 8. HK212 regression test

Running the same pipeline on the existing HK212 inputs must continue to produce the existing HK212 baseline output (items_hk212_etap1.json or equivalent). This validates that adding SO 250 support did not break HK212 extraction.

Comparison must be tolerant of minor float drift in calculator outputs (within 0.1%) but strict on item count (138 ± 0), Fáze assignment, and Pattern 15 DoD properties.

---

## Domain Rules

- SO 250 is a **monolitic retaining wall**, not a bridge superstructure. Classifier must not misclassify as bridge components.
- Beton C30/37 XC4 → curing class 3 per TKP 18 §7.8.3 → minimum curing 7 days at 15°C surface temperature.
- B500B reinforcement total ≈161.6 t per statický výpočet. Calculator aggregate over all reinforced elements must match within ±5%. Discrepancy above 5% is a red flag and must be raised as a HITL.
- 42 dilatation cells along 500m means average spacing ≈12m, well under ČSN EN 1992 maximum 30m. Calculator must not contradict this spacing.
- Exposure class XC4 means "cyclic wet and dry" — implications for curing and waterproofing. Calculator audit must cite ČSN EN 206+A1 for exposure semantics.
- Anti-corrosion against stray currents (bludné proudy) is a special requirement for highway structures near rails — it is a real element, not a curiosity. Work ontology must include it.
- Statický výpočet is the authoritative source for reinforcement mass. TZ may give summaries; statický výpočet has the per-element breakdown. Calculator should cross-check against statický výpočet, not just TZ summary.
- All output must use Czech construction terminology (zárubní zeď, dilatační celek, podkladní beton, výztuž, římsa, etc.). English terms in audit comments are acceptable, but the work item popis field must be in Czech for downstream KROS binding.
- Anonymization: remove references to specific projektant company names from the output. Geographic identifiers (D6 km 6,500-7,000) can stay — this is public ŘSD information.
- If a piece of information is in a drawing but not the TZ, the work item source must cite the drawing (not the TZ). Cross-document evidence integration matters.

---

## Acceptance Criteria

1. Orchestrator workflow runs end-to-end on the 8 SO 250 PDFs without errors. Workflow state transitions DOCUMENT_ANALYSIS → WORK_ATOMIZATION → (REVIEW or terminal).
2. ProjectContext is populated with object identification, geometry summary, material specifications, norm references, construction technology, and special requirements. Each field has a source citation (TZ section/page).
3. Work ontology items are generated for at least 8 element types: excavation, podkladní beton, foundation, monolitic wall, joints, hydroizolace, drainage, railing.
4. Every work ontology item conforms to Pattern 16 universal schema with all required fields populated or explicitly marked missing.
5. Every work item has a formula in audit.journey OR an explicit reason that formula does not apply (e.g., direct count from drawing).
6. Every work item has at least one source reference (TZ section + page, drawing reference, or statický výpočet section).
7. Calculator (classify_construction_element + atomic_calculate) runs for at least the monolitic wall and the foundation. Audit trails visible per element.
8. Calculator outputs respect TKP 18 §7.8.3 curing rules: XC4 → curing class 3 → minimum 7 days at 15°C reported.
9. Calculator total reinforcement mass aggregates to within ±5% of the statický výpočet stated 161.6 t. If outside this range, an HITL warning is raised.
10. 42 dilatation joints are detected from drawings or TZ and represented as 42 joint installation work items (or one work item with quantity 42).
11. Sequential work list ordering follows logical construction sequence (foundation before wall before římsa before railing).
12. validate_stage1_work_list passes all Pattern 15 DoD checks. Code column empty, Cena column empty, formula+source on every item.
13. items.json (or equivalent) output is produced in a format consistent with existing HK212 baseline.
14. Stage 1 XLSX export is produced per Pattern 15 §5.3 schema with all required columns.
15. HK212 regression test passes: same pipeline on HK212 inputs produces output identical to existing baseline (item count exact match 138, calculator values within 0.1% drift).
16. Anonymization: output does not contain projektant company names. Specific identifying data is removed or generalized.
17. Replay test: re-running the workflow on the same SO 250 PDFs with the same tool versions produces identical work ontology items (verified by deterministic comparison of items.json content).
18. Test fixtures are deterministic. AI-based extraction calls in test mode return cached responses (no live LLM calls in CI).
19. All Czech terminology used in popis fields is correct per existing STAVAGENT terminology conventions.
20. Cross-document evidence: at least 3 work items have source citations from drawings (not just TZ), demonstrating multi-document integration.

---

## What Is NOT Included

- Stage 3 catalog binding. That is Week 4 (TASK_Orchestrator_KROS_Adapter_Wrap).
- Pricing. Post-Cemex.
- DXF parsing. No DXF available for SO 250 per the user — PDF-only path.
- Monte Carlo or probabilistic duration. Post-Cemex.
- Takt planning beyond basic Fáze sequencing. Post-Cemex.
- Web UI integration. Separate workstream.
- Multi-user concurrent test of SO 250 pipeline. Cross-user isolation handled by parallel P0 task.
- BIM/IFC integration. Post-Cemex.
- Real-time progress tracking. Post-Cemex.
- Crew sizing simulation. Post-Cemex.
- Statický výpočet automated reading via ML. Reading TZ-section quotes is acceptable; full structural calculation parsing is post-Cemex.
- Polish on visual presentation of XLSX (formatting, column widths, conditional formatting). Functional XLSX output is enough for this week.

---

## Naming Determination

All paths, identifiers, type names, function names, and module names mentioned are **descriptive of business intent only**. Determine actual naming from existing repo conventions:

- If the existing items output is named items.json, use that. If it's items_etap1.json or sequential_list.json, match the existing convention.
- If the existing classifier is invoked as a function vs an MCP tool, follow the existing invocation pattern.
- If the existing calculator returns a structured object with specific field names, use those names in audit chaining.
- If existing test fixtures are organized by project ID (test-data/hk212_hala/, test-data/so250/), follow that pattern.

Do not invent new naming where existing conventions apply. When in doubt, match the format of the most recently merged calibration test case.
