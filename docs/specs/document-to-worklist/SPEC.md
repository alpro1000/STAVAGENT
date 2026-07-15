# SPEC — document-to-worklist (Axis B canon)

**Status:** CANON (axis B — Orchestrator Workflow). Supersedes nothing in-repo; **imports** the authoritative spec that until now existed only in Project Knowledge.
**Origin:** `STAVAGENT_Orchestrator_WorkOntology_TaskSpec` (2026-05-22, "Ready for engineering handoff") — was PK-only, never committed. Text recovered verbatim-in-substance and merged here.
**Renamed from:** "Orchestrator + Work Ontology" → `document-to-worklist`. The word *WorkOntology* in the axis-B name was the source of a documented three-way collision (see §0.2) and is retired from this axis.
**Rev:** v1 (import + contract merge)

---

## 0. Why this file exists

### 0.1 The graveyard defect

The Definition of Done for STAVAGENT's core workflow — "read documentation, produce a work list" — existed **only in Project Knowledge**, never in the repository. Consequence: every agent session that could not see PK re-invented its own slice of the pipeline. A 2026-07-08 audit counted **four unconnected implementations of "seznam prací"**.

**Rule established by this file:** the critical path must not run through a store the implementing agent cannot read. Anything load-bearing lives in the repo.

### 0.2 Three axes, previously conflated

The name "WorkOntology" was used for three different things. They are now separated:

| Axis | Meaning | Canonical carrier | State |
|---|---|---|---|
| **A — Vocabulary + Adapters** | Catalog-agnostic work vocabulary (`DOMAIN.CATEGORY.SUBCATEGORY.VARIANT`) + per-market adapters. Pattern 16. | `docs/specs/universal-work-decomposer/` | alive, design/review |
| **B — Orchestrator Workflow** | The pipeline: documentation → work list → catalog binding → plan. Pattern 15. **This file.** | **this spec** + `SO202` + `KROS_Adapter_Wrap` | alive, **not done** |
| **C — Element typing** | Head-noun classification (`dřík ≠ pilíř`). | `element_types.yaml` + element-name-normalizer | **shipped** — a *component inside* stages 2/4, not a pipeline |

`TASK_UWO_Bridge_Ontology` is **superseded** (axis A) and additionally points at the wrong successor (it points at the Orchestrator family = axis B). To be corrected in the ledger.

`TASK_Orchestrator_WorkOntology_SO250.md` (in-repo) is **mis-scoped**: it carries axis-C content (head-noun acceptance criteria) under an axis-B family name. Flagged **reconcile**, not canon.

---

## 1. Principle

> **Physical construction work is universal. Catalogs, codes, prices, norm references and tender formats are local.**

Therefore: generate a catalog-agnostic, auditable work ontology from project evidence **first**. Bind to catalogs **later**, through market-specific adapters.

Five words, in order:

**Evidence-first · Work-first · Audit-always · Catalog-last · Market-adapter.**

---

## 2. Two axes of the same pipeline — do not renumber

Two numbering systems exist and both are load-bearing. They describe the same pipeline from different angles. **Neither replaces the other; a third numbering must not be invented.**

| Pipeline stage (what happens) | Policy stage (what is allowed) |
|---|---|
| **1 Extract** — document → structured facts | **Stage 1 — Work atomization** |
| **2 Structure** — facts → domain object (passport / object model) | Stage 1 |
| **3 Quantify** — attach quantities (soupis, geometry, formula) | Stage 1 |
| **4 Decompose** — element → atomic work items | Stage 1 (+ **Stage 2 — Decomposition on demand**, when a consolidated item is split) |
| **5 Bind** — work item → catalog code | **Stage 3 — Catalog binding** |
| **6 Plan** — work items → schedule + cost | **Pricing stage** |

Policy is enforced on the **policy stage**. Data flows through the **pipeline stage**.

---

## 3. Stage 1 — Work atomization

### 3.1 Required item fields

- `id`
- `popis` (description)
- `mj` (unit)
- `mnozstvi` (quantity)
- `_formula`
- `_source`
- `_audit_trail.journey`

### 3.2 Optional item fields

- `_review_flag`
- `_vyjasneni_ref`
- `_status_flag`

### 3.3 FORBIDDEN in Stage 1

- catalog code
- price
- catalog-driven grouping
- auto-catalog matching

### 3.4 Standard Stage 1 XLSX schema

`# | Krok | Fáze | Kapitola | ID | Popis | MJ | Množství | Vzorec / Zdroj | Pozn. (review/ABMV) | Code | Cena`

Rules:
- `Code` **must be empty** in Stage 1.
- `Cena` **must be empty** in Stage 1.
- `Vzorec / Zdroj` is **mandatory**.
- Every item must be traceable.

### 3.5 Definition of Done — Stage 1

Stage 1 is complete **only when**:

1. all items have `id`;
2. all items have description;
3. all items have `mj`;
4. all items have quantity **or an explicit missing-quantity flag**;
5. all items have formula;
6. all items have source;
7. all items have audit trail;
8. `Code` is empty;
9. `Cena` is empty;
10. logical execution order exists;
11. consolidated items are flagged for review.

---

## 4. Stage 2 — Decomposition on demand

A consolidated item may be split into atomic steps when granular catalog mapping is needed.

Each split item **must preserve**:
- parent item reference
- split rationale
- inherited sources
- audit trail

---

## 5. Stage 3 — Catalog binding

**Allowed:** targeted catalog search · candidate ranking · human/expert approval · inclusion/exclusion explanation.

**Forbidden:** blind auto-assignment · hidden catalog leakage · claiming a final code when confidence is weak.

> **Assisted catalog binding, not automatic catalog assignment.**

### 5.1 Bind is a mapping, not a search — CONTRACT ADDITION

Direct fuzzy text→code retrieval is the documented root cause of false matches. Live example: `dohloubky patek` matched `Bednění základů patek` on the shared token `{patek}` — excavation classified as formwork.

Therefore:

| | |
|---|---|
| Stage **4 Decompose** | emits an **axis-A vocabulary code** + params. The LLM chooses from a controlled vocabulary (~50–100 codes). |
| Stage **5 Bind** | **deterministic adapter**: `(vocabulary_code, params) → catalog candidates`. |

The LLM **never sees** the 17 904 OTSKP / ~39 000 ÚRS entries. This is what makes the confidence ladder (`catalog/regex = 1.0`, `AI = fallback`) technically enforceable rather than merely declared.

**Dependency:** the axis-A vocabulary is therefore a **blocking prerequisite** for stage 4 output, not a nice-to-have. See §11.

---

## 6. Data models

### 6.1 ProjectContext

```json
{
  "project": { "name": "", "type": "budova", "country": "CZ", "language": "cs" },
  "documents": [],
  "objects": [],
  "work_ontology_items": [],
  "sequential_work_items": [],
  "catalog_mappings": [],
  "assumptions": [],
  "missing_inputs": [],
  "tool_calls": []
}
```

### 6.2 SequentialWorkItem — original

```json
{
  "id": "HSV-1-028a",
  "step": 28,
  "phase": "Fáze 3",
  "chapter": "Základy",
  "description": "Betonáž dvoustupňových patek rámových",
  "unit": "m3",
  "quantity": 22.875,
  "formula": "...",
  "source": [],
  "review_flag": null,
  "status_flag": "documented",
  "code": null,
  "price": null,
  "audit_trail": { "journey": [] }
}
```

### 6.3 SequentialWorkItem — CONTRACT ADDITIONS

These fields are **new in v1** and are what make the honest-blank and coverage guarantees checkable. Marked separately so the implementing agent knows what is imported vs. added.

| Field | Rule |
|---|---|
| `vocabulary_code` | Axis-A code (`DOMAIN.CATEGORY.SUBCATEGORY.VARIANT`). **Inventing a code is forbidden** — an unknown work type becomes a registration proposal in a review queue, never a fabricated code. |
| `quantity_status` | `from_soupis` \| `computed` \| `assumed` \| `NEPOČÍTÁNO(reason)`. **Mixed provenance = the worse status:** `computed` requires EVERY factor of the formula to come from the input/document; any defaulted factor (a typical thickness, a default height) downgrades the row to `assumed` — a default must never ride a document value into looking computed. Tool-level refinement `from_input` (verbatim caller value) may be upgraded to `from_soupis` by the joiner that knows. |
| `status` | `exact` \| `candidate` \| `group_only` \| `not_verified` |
| `confidence` + `confidence_source` | catalog/regex 1.0 · human 0.99 · ÚRS-web 0.80–0.85 · AI 0.70–0.80 |
| `coverage` | `covered` \| `not_covered_branch` |
| `parent_id` | set when produced by Stage 2 split |

### 6.4 Invariants (test-enforced, not requested)

1. In Stage 1 there is **not one catalog code and not one price**. Enforced server-side (§8), not by prompt.
2. Every item is either `(quantity + formula + source)` **or** an explicit `NEPOČÍTÁNO` **with a reason**. Honest-blank is for genuinely absent evidence — **not** for values omitted by choice.
3. A branch that is not built returns `not_covered_branch`. It **must not** silently fall back to the concrete decomposition. (Otherwise: formwork on vinyl flooring.)
4. AI decomposition of an uncovered branch is permitted **only** as `status: candidate`, `confidence ≤ 0.75`, `review_flag: true`. Never `exact`.
5. **Replay:** same inputs + same engine version → identical output.
6. No automatic catalog binding exists. Assisted only, on explicit user action.

### 6.5 CatalogMapping

```json
{
  "work_item_id": "HSV-1-028a",
  "market": "CZ",
  "catalog": "KROS",
  "candidate_code": "273313811",
  "candidate_description": "Beton základových patek prostý",
  "confidence": 0.82,
  "included": [],
  "excluded": [],
  "requires_review": true,
  "approved_by": null
}
```

Adapter output **must** include: candidate code · description · confidence · included operations · excluded operations · packaging notes · review requirement.

---

## 7. Endpoints required

| Endpoint | Purpose |
|---|---|
| `POST /orchestrate` | Executes a workflow to completion. Not a single tool call. |
| `POST /extract_work_ontology_from_document` | Documentation → work items, sources preserved, **no catalog mapping**. |
| `POST /generate_sequential_work_list` | Context/ontology → Fáze-ordered list, Stage-1 XLSX rows, Code/Cena empty. |
| `POST /decompose_work_item` | Split consolidated item; preserve parent ref + audit. |
| `POST /bind_catalog_candidates` | Map to local catalog candidates. **Does not auto-finalize.** |
| `POST /validate_stage1_work_list` | DoD check (§3.5). |
| `POST /validate_catalog_mapping`, `POST /validate_boq` | Downstream validation. |
| `POST /patterns/{search,get,write,update_score,apply}` | Pattern memory — currently not exposed via MCP at all. |
| `POST /find_{urs,otskp,bki,fiebdc,batiprix}_codes_batch` | Batch is required for orchestration performance. |

### 7.1 Orchestrator target architecture

```
User request
  → Intent classifier
  → File/document classifier
  → Pattern retrieval
  → Project context extraction
  → Workflow planner
  → Tool router
  → Endpoint calls
  → Result merger
  → Validator
  → Gap resolver
  → Formatter/exporter
```

### 7.2 File handling

Every file-consuming endpoint accepts `file_id` **or** `file_url` **or** `content_base64` (+ `filename`, `mime_type`). **Base64-only is a known usability failure** — large PDFs do not fit through the tool-call argument (Pattern 40 barrier).

---

## 8. Policy enforcement — server-side, not prompt-only

### 8.1 Stage 1 (`work_atomization`)
- **block** `find_urs_code`
- **block** `find_otskp_code`
- **block** catalog adapters
- **block** price calculation
- **require** `Code` empty, `Cena` empty
- **require** formula + source

### 8.2 Stage 2 (`decomposition`)
- require parent item reference · split rationale · inherited sources · preserved audit trail

### 8.3 Stage 3 (`catalog_binding`)
- allow catalog adapters
- require inclusion/exclusion notes · confidence · human review below threshold

### 8.4 Pricing
- allow unit prices
- require price source · price date · currency
- mark estimates vs verified prices

---

## 9. Tool routing

**Stage 1 allowed:** `analyze_construction_document` · `parse_construction_budget` (extraction only, no code finalization) · pattern search/apply · work ontology extraction · sequential list generation.

**Stage 1 blocked:** `find_urs_code` · `find_otskp_code` · `create_work_breakdown` *if it auto-generates catalog codes or prices*.

**Stage 3 allowed:** `find_urs_code` · `find_otskp_code` · market catalog adapters · pricing lookup.

### 9.1 The `create_work_breakdown` defect — BLOCKING

`create_work_breakdown` currently **mixes structural decomposition with catalog/pricing**. Until it is split, invariant §6.4.1 is unenforceable.

Refactor into either two tools —

```
create_structural_work_breakdown_without_catalog
map_structural_breakdown_to_catalog
```

— or one tool with an explicit mode:

```json
{ "mode": "work_first", "include_catalog": false, "include_prices": false }
```

It is additionally **concrete-only**. Non-concrete branches must return `not_covered_branch` (§6.4.3), not a concrete decomposition.

---

## 10. Gates — CONTRACT ADDITION

| Gate | Check | Blocks |
|---|---|---|
| **G0 Recon** | document coverage matrix | proceeding silently when critical documents are absent → emit RFI |
| **G1 Structure** | share of elements carrying `source` | ungrounded structure |
| **G2 Quantify** | no number without formula + source | "the AI invented a quantity" |
| **G3 Decompose** | anchor checklist (~40 typical works: přesun hmot, lešení, odvoz suti, VRN…) → gap list | adding gap items **without approval** (HK212 Stage 1A/1B model) |
| **G4 Catalog** | explicit user action | premature Bind |

---

## 11. Quality metrics

```json
{
  "quality": {
    "coverage_score": 0.0,
    "quantity_completeness": 0.0,
    "source_traceability": 0.0,
    "catalog_code_coverage": 0.0,
    "pricing_completeness": 0.0,
    "review_flag_count": 0,
    "assumption_count": 0
  }
}
```

---

## 12. Golden tests

### 12.1 HK212 sequential list (Stage 1 — primary DoD test)
- 138 items
- logical order Fáze 1–11
- `HSV-1-028` split into `028a–f`
- formula present on every item
- source present on every item
- `Code` empty · `Cena` empty

### 12.2 Stage 1 policy test
Input: user asks for a work list; system attempts `find_urs_code`.
Expected: **call blocked by policy** · warning logged · Stage 1 continues without a catalog code.

### 12.3 Adapter test
Input: `Beton patek rámových C16/20 XC0, dvoustupňové, 22.875 m³`
Expected: CZ adapter → KROS/ÚRS candidates; DE → BKI; ES → FIEBDC; FR → Batiprix. **All mappings include included/excluded operations.**

### 12.4 Domain fixtures (repo-grounded at import, 2026-07-12)
`SO-250` (zárubní zeď) · `SO-202` (most, 6 polí, předpjatá NK) · `VP4 FORESTINA` (opěrná zeď).
These are **Plan-stage (stage 6) fixtures** — hand-verified geometry, volumes, formwork areas, rebar, pour windows. They validate the calculator, **not** the Stage-1 DoD. Stage-1 DoD is validated by HK212 (§12.1). Do not conflate.

> **Repo paths (verified at import — the PK package was itself part-stale):**
> - `test-data/tz/SO-250_golden_test.md` — imported with this spec (was genuinely missing; named
>   per the neighbor `_golden_test` convention — `SO-250.md` stays free for the source TZ).
> - `test-data/tz/SO-202_D6_most_golden_test.md` — **already in repo and RICHER than the PK copy**
>   (28 KB with v4.17+ audit annotations vs 12 KB PK snapshot). Repo version is canonical; the PK
>   copy was NOT imported.
> - `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` — already in repo, byte-identical.
>
> This is the graveyard defect in miniature: of the three "fixtures to import", one was missing,
> one was a stale PK copy of a richer repo file, one was a duplicate. Verify against the repo, always.

---

## 13. Roadmap

| Phase | Content |
|---|---|
| A — Discovery | map MCP endpoints, repo structure, pattern file, steering docs, parser paths, catalog matching code |
| B — Docs/memory | Pattern 15 + Pattern 16 registered; soul.md + next-session.md updated |
| C — Schema | `work_ontology.schema.json` · `sequential_work_item.schema.json` · `catalog_mapping.schema.json` |
| D — Orchestrator skeleton | `/orchestrate`, workflow state machine, tool registry metadata, file input normalization |
| E — Policy enforcement | block catalog tools in Stage 1; validate Code/Cena empty; require formula/source/audit |
| F — Pattern memory | search/get/write/update/apply; success/failure scoring; apply during parsing |
| G — Work ontology extraction | extraction endpoint; sequential list; **HK212 golden test green** |
| H — Catalog adapters | Czech first; adapter interface; candidate explanations; review flags |
| I — International adapters | BKI (DE) · FIEBDC (ES) · Batiprix (FR) |

**Do not start Phase I until schema and Czech golden tests are stable.**

---

## 14. Acceptance criteria

1. User can ask: *"Read documentation and create a work list."*
2. Orchestrator produces a Stage 1 sequential list **without codes or prices**.
3. Every item has formula/source/audit **or** an explicit review flag.
4. Catalog tools are **blocked** during Stage 1.
5. Pattern memory can be searched and applied.
6. Stage 3 can bind catalog candidates through adapters.
7. Adapter output includes inclusion/exclusion notes.
8. HK212 golden test passes.
9. Existing tools remain available but are **routed by workflow stage**.
10. Output can be exported as a Stage 1 XLSX sequential list.
11. **(added)** A non-concrete branch returns `not_covered_branch` — never a concrete decomposition.
12. **(added)** Replay: identical inputs + identical engine version → identical output.

---

## 15. Follow-up backlog (from source spec)

1. Register Pattern 15 + Pattern 16.
2. Extract the work-ontology JSON schema from the HK212 `items.json`.
3. Implement Stage 1 policy enforcement.
4. **Split `create_work_breakdown`** into work-only and catalog-binding modes. *(blocking — §9.1)*
5. Add pattern memory MCP endpoints.
6. Build Czech catalog adapters.
7. Add the HK212 golden test.
8. DACH adapter exploration.
9. Pitch-deck slide: *"Universal Work Ontology, Local Catalog Adapters."*

---

## 16. Product positioning

> STAVAGENT does not estimate directly from local catalog codes. It extracts a universal, auditable construction work ontology from project documentation, then binds that ontology to local market catalogs through adapters. This makes the engine internationally scalable **by design**.

---

## 17. Naming rule for implementers

All identifiers, paths, table names, class names and field names in this document describe **business intent only**. Determine actual naming from existing repo conventions. **Do not create a parallel structure — integrate into the existing code.**
