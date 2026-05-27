# TASK_Orchestrator_KROS_Adapter_Wrap

**Target week:** Week 4 of Cemex CSC 2026 runway (Jun 17 — Jun 23, 2026)
**Estimated effort:** ~22 hours (adapter abstraction ~4h + KROS adapter implementation ~12h + batch endpoint ~2h + explain_decision integration ~2h + tests ~2h)
**Dependencies:**
  - TASK_Orchestrator_StageGating_MVP (Week 2) — provides workflow state machine that gates this task's tools to CATALOG_BINDING
  - TASK_Orchestrator_WorkOntology_SO250 (Week 3) — Stage 1 output that this task binds
  - TASK_Orchestrator_WorkOntology_SO202_Bridge (Week 3-4) — Stage 1 output that this task binds
**Demo role:** Stage 3 of the Cemex demo video. Shows that orchestrator produces auditable catalog mapping with inclusion/exclusion semantics, not blind code matching.

---

## Mantra (read this fully before ANY action)

Before writing a single line of code, do all of the following:

1. **Read the entire repo structure.** Identify where the existing URS_MATCHER service lives, how it is invoked (HTTP Cloud Run, local subprocess, MCP tool wrapper), where KROS / URS catalog data is stored (urs_local_cache.jsonl, kros_catalog.db, etc.), where the existing find_urs_code MCP tool is implemented.
2. **Read the Orchestrator Spec §6.4** (Adapter architecture) and §7.6 (Catalog binding endpoint) in Project Knowledge.
3. **Read Pattern 16** sections in the updated Architecture Vision (from Week 1 docs task) to understand the formal contract.
4. **Read the existing find_urs_code implementation** to understand current input/output shapes, current confidence scoring, current catalog response structure.
5. **Read the SO 202 golden test** — the Stage 3 KROS bindings produced by this task are the test target for the demo. Catalog candidates produced for mostovka NK, piloty Ø900, opěry dříky, římsy must be correct or appropriately flagged for review.
6. **Read sample KROS / URS descriptions** to understand what inclusion / exclusion language typically appears (e.g., "Beton základových patek prostý" — implies includes concrete placement only, excludes formwork and reinforcement which are separate položky).
7. **Read the cross-user isolation P0 task** if running in parallel, because the adapter must comply with whatever isolation discipline is being enforced.
8. Only then begin coding.

---

## Pre-Implementation Interview

Ask the user (via AskUserQuestion) before writing code — wait for all answers:

1. **How is URS_MATCHER_SERVICE currently invoked?** HTTP to Cloud Run, local Python module import, MCP server within MCP server, or other?
2. **Where is the KROS catalog data physically stored?** Local SQLite, Cloud SQL, JSONL file, or external API?
3. **Is there existing logic that parses inclusion/exclusion semantics from KROS descriptions?** If yes, where? If no, this task introduces it.
4. **Where do CatalogMapping types live in code?** Pydantic models, dataclasses, JSON schema definitions?
5. **What is the existing convention for "candidate" representation?** Does find_urs_code return a list of candidates or a single best match?
6. **Is there existing batch processing infrastructure?** Async queue, parallel HTTP calls, or naive sequential?
7. **How are norm citations (TKP 18 §7.8.3, ČSN EN 1992) stored and looked up?** Inline strings, normalized citation table, or external knowledge base?
8. **Is explain_decision already stubbed from Week 2?** If yes, this task extends the stub with real citation logic. If no, this task introduces it as part of catalog binding.
9. **What confidence thresholds are already established elsewhere in the system?** 0.7, 0.85, others? This task introduces requires_review threshold and should align.
10. **Is there a known issue with KROS catalog vintage (URS 2018 vs current 2024-2025)?** If yes, this task must handle vintage gap honestly (lower confidence, explicit warning).

---

## Context

The current MCP server exposes find_urs_code and find_otskp_code as single-item search tools. They return code candidates without inclusion/exclusion semantics and without explicit confidence scoring suitable for Stage 3 gating.

Pattern 16 §6.4 specifies adapter architecture: a CatalogAdapter abstract interface that maps universal work ontology items to local catalog candidates, with each candidate carrying inclusion notes (what operations the code covers), exclusion notes (what operations the code does NOT cover), confidence, and a requires_review flag.

The orchestrator at Stage 3 (CATALOG_BINDING) needs:

- Per work ontology item, ask the adapter for candidate codes
- For each candidate, get explicit inclusion/exclusion (so the human reviewer knows whether they need additional codes for formwork, reinforcement, etc.)
- Confidence scoring so requires_review can be triggered automatically for low-confidence candidates
- Batch invocation for performance (a typical Stage 1 work list has 50-150 items)
- An explain_decision endpoint that justifies a binding with citation to a norm (TKP 18, ČSN EN, etc.)

This task implements one adapter (KROS), wraps existing URS_MATCHER infrastructure, adds inclusion/exclusion parsing, and integrates with the Stage 3 gating from Week 2.

OTSKP remains accessible via the existing find_otskp_code (Stage-gated). A full OTSKP adapter (with the same Pattern 16 contract) is a stretch goal for this week; if time tight, defer to post-Cemex.

DACH adapters (BKI, FIEBDC, Batiprix) are explicitly post-Cemex.

---

## Business Logic

### 1. Adapter abstraction

Define an abstract interface that any catalog adapter must implement. Single canonical contract so future BKI, FIEBDC, Batiprix adapters slot in without refactoring orchestrator code.

Interface methods (descriptive — actual method names from existing repo conventions):

- **map_item(work_ontology_item) → CatalogMapping**: given a Pattern 16 work ontology item, return a CatalogMapping with candidates list.
- **explain_mapping(work_ontology_item, candidate) → MappingExplanation**: given a chosen candidate, return structured explanation with norm citation, included operations, excluded operations, why this candidate over others.
- **validate_packaging(work_ontology_item, candidate) → PackagingCheck**: given a candidate, verify that the candidate's packaging (what it includes/excludes) is consistent with the work ontology item's intent. Returns issues if mismatched.

Each adapter declares its market and catalog identifiers (e.g., CZ + KROS, CZ + URS, DE + BKI).

### 2. KROS adapter implementation

KrosAdapter implements the abstract interface. Internally it wraps the existing URS_MATCHER pipeline (or directly queries KROS catalog if URS_MATCHER does not handle KROS; verify which catalog URS_MATCHER actually serves — KROS and URS are often used interchangeably in Czech market but have technical differences).

For each work ontology item:

1. Construct a search query from the work item's description, element_type, material, and key parameters
2. Call URS_MATCHER (or equivalent KROS query backend) to get raw candidates
3. For each raw candidate, parse the candidate's description to extract:
   - Included operations (e.g., "Beton základových patek prostý" → includes "concrete placement of unreinforced foundation pads")
   - Excluded operations (e.g., the same code typically EXCLUDES formwork, reinforcement, excavation — these are separate KROS položky and the adapter should know this from KROS conventions)
   - Packaging notes (any special handling, like "per m³ of finished structure" vs "per m³ of concrete consumed")
4. Score confidence per candidate based on:
   - Match quality between work ontology item description and candidate description (lexical + semantic)
   - Match between exposure class in work item and exposure mentioned in candidate
   - Match between element_type and candidate's intended element scope
   - Catalog vintage gap penalty if applicable (URS 2018 cache returning 2018-era codes for 2024+ project → lower confidence)
5. Set requires_review flag based on confidence threshold (initial default: confidence < 0.7 → requires_review = true)
6. Return CatalogMapping with all candidates ranked by confidence

### 3. Inclusion / exclusion parsing

KROS descriptions follow conventions. The adapter encodes these conventions:

- **Beton X prostý / nevyztužený** → includes concrete placement, EXCLUDES formwork, reinforcement, excavation
- **Beton X železobetonový** → includes concrete placement, INCLUDES reinforcement (sometimes), EXCLUDES formwork
- **Bednění pro X** → includes formwork only, EXCLUDES concrete and reinforcement
- **Výztuž X** → includes reinforcement only, EXCLUDES concrete and formwork
- **Výkop pro X** → includes excavation only
- Etc.

Implementation guidance: do not invent these conventions. They are documented in KROS / ÚRS official catalogs. The adapter should encode them as a lookup table or rule set, not infer them via LLM (LLM inference is too unreliable for legal-defensibility quantities).

When the adapter cannot determine inclusion/exclusion definitively, it must set the inclusion/exclusion fields to "unknown" and set requires_review = true. Never guess.

### 4. Stage 3 gating enforcement

The adapter's map_item method, when called through the MCP gateway, must respect the workflow state machine from Week 2:

- If session state != CATALOG_BINDING, refuse with STAGE_VIOLATION (Pattern 15 enforcement)
- Server-side, not adapter-side. The adapter trusts the gateway.

The adapter must also respect the side_effect_level=none property declared in its manifest. No persistent writes. Candidates are returned to the caller; binding is finalized only when the orchestrator transitions the session to COMMIT_PENDING after user confirmation.

### 5. Batch invocation

A batch endpoint accepts an array of work ontology items and returns aligned CatalogMappings. Performance is critical: a typical Stage 1 output has 50-150 items. Sequential calls would be too slow for interactive workflows.

Implementation guidance:

- Parallelize where the underlying URS_MATCHER allows
- Respect rate limits if URS_MATCHER is an external service
- Aggregate results in deterministic order (same input order = same output order, for replay)
- If any item fails, return per-item error in its slot rather than failing the entire batch

### 6. explain_decision integration

The explain_decision tool, when called for a Stage 3 binding decision, returns a structured citation:

- Norm cited (TKP 18, ČSN EN 1992, ČSN EN 206+A2, ÚRS / KROS convention, etc.)
- Section / paragraph reference
- Brief paraphrase of why this candidate matches (NOT a quote — paraphrase to avoid copyright issues)
- Inclusion/exclusion summary
- Confidence score
- requires_review flag and reason if set

The citation must be structured, not free text. Schema:

- citation_norm (string identifier)
- citation_section (string)
- citation_url (optional, if the norm is publicly accessible)
- citation_paraphrase (string, in Czech for Czech market)
- reasoning (string, in Czech)

This is the "every decision is replayable, auditable, and traceable to a Czech or EU norm" property from the Cemex pitch line. It must actually work.

### 7. Integration with SO 250 and SO 202 outputs

This task does not produce work ontology items — Week 3 tasks do that. This task consumes them at Stage 3.

For SO 250: monolitic wall, foundation, římsa (if applicable), drainage, joints. All standard Czech catalog elements. Expected candidate confidence reasonable for established KROS codes.

For SO 202: 9 element types. Some are technically subtle:

- Piloty Ø900 with overpouring → KROS code for piloty pažené Ø900, but inclusion/exclusion must note that overpouring loss is in volume calculation, not a separate položka
- Mostovka prestressed → typically multiple KROS codes (concrete + reinforcement + prestressing + formwork separately). The adapter must return candidates for each component, with packaging notes that NK is decomposed across multiple códů.
- Římsy with curing class 4 → KROS code for římsy, inclusion/exclusion confirms separate položka for formwork (T-system).

These are the test cases. If the adapter returns candidates that pass the SO 202 golden test §11 validation rules (specifically Rules 6 and 7 about formwork and curing), it is working correctly.

### 8. Known vintage gap

The user has documented a known issue: URS201801.csv cache is from 2018 vintage, while many SO 250 / SO 202 codes are from 2024-2025 KROS catalog. The adapter must handle this honestly:

- If the cache returns no good match for a 2024+ code, do not silently return a 2018 best-guess. Set confidence low, set requires_review = true, and explicitly note "catalog vintage gap" in the audit.
- If the cache has 29.8% match rate (as documented for HK212), this is a known limitation. The adapter must surface it, not hide it.

### 9. Catalog routing per project type

Per the user's existing project-type routing convention:

- veřejná zakázka (public tender) → OTSKP primary (ZZVZ legally required for transport infrastructure)
- privátní projekt (private investor) → URS / KROS primary, OTSKP irrelevant
- D&B tender → URS + OTSKP both relevant

SO 250 and SO 202 are public ŘSD projects (veřejné zakázky for transport infrastructure). However, the goal of this task is the KROS/URS adapter, not OTSKP. The user accepted in the OQ decisions that OTSKP remains via existing find_otskp_code (Stage-gated). KROS adapter is the new Pattern 16-compliant interface.

For the Cemex demo, KROS adapter is the showcase. OTSKP can be mentioned as also available via legacy find_otskp_code but does not need adapter wrapping in this submission window.

---

## Domain Rules

- Stage 3 binding produces **candidates with explanations**, never auto-finalized codes. Pattern 15 forbids blind auto-match.
- requires_review flag is the gatekeeper for the COMMIT_PENDING transition. Items with requires_review=true must be explicitly approved by a user before commit.
- Confidence < 0.7 → requires_review = true (default, configurable).
- Confidence 0.7 - 0.85 → requires_review = false (auto-bind allowed) but item still goes to draft, never directly committed.
- Confidence ≥ 0.85 → auto-bind allowed, still draft, still requires explicit commit transition.
- Inclusion/exclusion semantics are looked up from KROS conventions, not inferred via LLM. Hardcoded rules table is acceptable and preferred over LLM inference.
- Norm citations must be real and traceable. If the adapter cannot cite a specific norm section for a binding decision, the binding is incomplete and must be flagged.
- KROS vintage gap is surfaced, not hidden. If the cache is 2018 and the code looks like 2024+, lower confidence and add warning.
- Czech terminology in candidate descriptions (Beton X, Bednění pro X, Výztuž X, Výkop, etc.). English in audit reasoning is acceptable.
- Per-batch determinism: same input batch + same KROS catalog version + same adapter version → same output batch (for replay).

---

## Acceptance Criteria

1. Abstract CatalogAdapter interface is defined with the three documented methods (map_item, explain_mapping, validate_packaging). Defined in a way that future BKI/FIEBDC/Batiprix adapters can implement without orchestrator code changes.
2. KrosAdapter class implements the CatalogAdapter interface. Wraps the existing URS_MATCHER or KROS query backend (whichever serves KROS data per the existing repo).
3. KrosAdapter declares market=CZ, catalog=KROS.
4. Adapter returns CatalogMapping per Pattern 16 §6.4 schema: item_id, market, catalog, candidates list. Each candidate has code, description, confidence, included, excluded, packaging_notes, requires_review.
5. find_urs_codes_batch endpoint exists and accepts batch input, returns aligned batch output preserving input order.
6. Stage 3 gating enforced via MCP gateway: attempting to invoke find_urs_code or the adapter when session state != CATALOG_BINDING returns STAGE_VIOLATION error and audit log entry.
7. Inclusion/exclusion parsing works for standard KROS conventions (Beton prostý, Beton železobetonový, Bednění pro X, Výztuž X, Výkop pro X, etc.). At least 6 KROS naming conventions are encoded as rules.
8. requires_review flag is set correctly per confidence threshold. Verified by integration test with one high-confidence and one low-confidence case.
9. Catalog vintage gap is surfaced: when a query returns no good match against the local cache, confidence is reduced and the audit explicitly notes "catalog vintage gap" instead of silently returning a stale 2018 code.
10. explain_decision endpoint returns structured citation (norm, section, paraphrase in Czech, reasoning in Czech, inclusion/exclusion summary). NOT free text.
11. Norm citations in explain_decision are real (TKP 18 §X.Y, ČSN EN 1992 §X, ČSN EN 206+A2 §X, etc.). Test cases verify the citation exists in the actual norm.
12. Performance: a 50-item batch completes in under 30 seconds (target, not strict). Larger batches scale linearly or sub-linearly.
13. Test: SO 250 monolitic wall (C30/37 XC4) is mapped to a candidate that includes "concrete placement of reinforced retaining wall" and excludes "formwork", "reinforcement", "excavation", "waterproofing". Verified by inclusion/exclusion field values.
14. Test: SO 202 mostovka NK (C35/45 XF2, prestressed) is mapped to a set of candidates that decompose across multiple KROS codes (concrete + reinforcement + prestressing + formwork). Packaging notes explicitly document this decomposition.
15. Test: SO 202 piloty Ø900 with C30/37 XA2 is mapped to a candidate that notes "overpouring +0.5m is included in volume" (or equivalent).
16. Test: SO 202 římsy (C30/37 XF4, curing class 4) is mapped to a candidate that EXCLUDES formwork (formwork is separately bound to a T-system rim formwork code).
17. Test: attempting to call find_urs_code from Stage 1 (WORK_ATOMIZATION) returns STAGE_VIOLATION and creates audit entry. Same for the adapter.
18. Replay test: same SO 202 work ontology input + same KROS catalog version + same adapter version → identical CatalogMapping output.
19. Cross-user isolation: a user querying the adapter cannot see another user's session-bound candidates. Verified by integration test.
20. SO 250 and SO 202 regression: the Week 3 baselines are unaffected (Stage 1 outputs unchanged). This task only adds Stage 3 outputs.

---

## What Is NOT Included

- OTSKP adapter implementation. Existing find_otskp_code remains with Stage gating only. Adapter wrapping is post-Cemex.
- BKI / FIEBDC / Batiprix adapters. Post-Cemex.
- Pricing integration. Post-Cemex.
- Pattern memory write/score endpoints for new KROS patterns. Post-Cemex.
- Auto-finalize Stage 3 binding without human review. Forbidden by Pattern 15.
- Cross-catalog disambiguation (deciding when to use KROS vs OTSKP for a given item). Post-Cemex.
- Bulk approval UI integration. Post-Cemex.
- Real-time catalog sync to KROS publishers. Cache-based for this submission.
- Voice or copilot interaction.
- Adapter performance optimization beyond functional acceptance. Sub-30-second batches are sufficient.
- New KROS data ingestion pipeline. Use whatever catalog data the existing URS_MATCHER serves.

---

## Naming Determination

All paths, identifiers, type names, method names, and JSON field names mentioned are **descriptive of business intent only**. Determine actual naming from existing repo conventions:

- If existing find_urs_code uses certain field names in its response, the adapter should align.
- If the abstract interface in the repo uses Pythonic method names (snake_case) or Java-style (camelCase), follow the existing convention.
- If existing CatalogMapping types live in a specific module, define new types alongside, not in a new module.
- If existing tests use specific fixture file patterns (test-data/kros/, test-fixtures/catalog/), follow the existing pattern.

Do not invent new naming where existing conventions apply. The Pattern 16 schema is the formal contract; field names in code should map to that schema but may use the existing repo's casing convention.

When in doubt, match the most recent merged commit's style exactly.
