# ADR-009 — Document→Worklist pipeline: the 6-stage spine, UWO as the semantic Bind layer, and the canonical-artifact ledger

> **Status:** PROPOSED — awaiting Alexander's ratification. The **canon selection (D3)** and the
> **supersedes-ledger (D4)** are his merge-gate call; this ADR *recommends*, it does not enact.
> No `SUPERSEDED_BY:` header is stamped into any other file until ratified.
> **Date:** 2026-07-12
> **Sources:** worklist-audit (`docs/handoff/2026-07-08_worklist-gate2-next-session.md`) · UWO spec
> (`docs/specs/universal-work-decomposer/`) · Pattern 15 + Pattern 16 (`docs/STAVAGENT_PATTERNS.md`) ·
> recon this session (soul.md §9 2026-07-12).

---

## Context

Several efforts turn a document (TZ / výkres / soupis) into a **list of works**, each built in a
different service, at a different maturity, and unconnected. The worklist-audit already named
**"four unconnected `seznam prací` implementations."** Underneath them is **one** conceptual
pipeline; it fragmented because a canonical spine was never *declared*, so each UI/spec reinvented
a slice.

Two aggravating defects surfaced while reconstructing the map:

1. **The Project-Knowledge graveyard defect.** PK holds ~100+ `TASK_*.md` with **no status field**;
   live and dead specs sit intermixed and are indistinguishable from PK alone. A spec cited from PK
   is untrustworthy until status-checked against the repo. *Concrete instance:*
   `TASK_UWO_Bridge_Ontology.md` reads as a live spec in PK, but the repo marks it
   **SUPERSEDED / neimplementovat**.

2. **The "WorkOntology" name-collision.** Two unrelated concerns share the name and were conflated:
   - **UWO / UCWO (Pattern 16)** = Universal *Construction Work* Ontology — a **catalog-agnostic
     work vocabulary** (`DOMAIN.CATEGORY.SUBCATEGORY.VARIANT` + params) with per-market adapters.
     Live carrier: `docs/specs/universal-work-decomposer/`.
   - **"Orchestrator WorkOntology" (SO250 / SO202 tasks)** = element **head-noun classification
     normalization** ("dřík ≠ pilíř"). A *different axis*, already **SHIPPED** as
     `Monolit-Planner/shared/src/classifiers/element-name-normalizer.ts` + `element_types.yaml`
     (v4.34, TASK_2b).
   The dead `TASK_UWO_Bridge_Ontology.md` even points at the **wrong** successor (the Orchestrator
   tasks), cementing the confusion.

---

## Decision

### D1 — The document→worklist pipeline is a declared **6-stage spine**

Each stage is a Core capability returning a **carrier** (data + confidence + provenance). Domain
specializations (bridge / monolit) are **profiles of stages 2–3**, not parallel pipelines.

| # | Stage | What it does | Implemented by (today) | Maturity |
|---|-------|--------------|------------------------|----------|
| 1 | **Extract** | document → structured facts | `extract_tz_fields`, `parse_construction_budget`, UEP (`uep_run_extraction`), MinerU OCR | **A** live |
| 2 | **Structure** | facts → domain object | `build_bridge_passport` (bridge profile) | **A** live |
| 3 | **Quantify** | attach quantities (soupis qty → element volume) | `doc_to_quantified_elements` join (monolit profile) | **B** P1 landed, P2/P3 gated |
| 4 | **Decompose** | element → work atoms, **emitting `uwo_code`** | `create_work_breakdown` (`breakdown.py`, Pattern 15) — concrete branch only | **A** live (concrete-only) |
| 5 | **Bind** | `uwo_code + params → catalog code` (per market) | `catalog_matching.py` chain + `find_otskp_code` / `find_urs_code`; `CodeStatus` enum | **B** honest chain live; UWO-keyed adapter not built |
| 6 | **Plan** | works → schedule + cost | `calculate_from_passport`, Kalkulátor 7-engine | **A** live |

*Maturity key: A = in prod · B = partial/gated · C = spec-only · D = vision.*

### D2 — UWO is the semantic layer **between Decompose (4) and Bind (5)**

- **Stage 4 Decompose emits `uwo_code`** from a controlled vocabulary (~50–100 codes) — **never** a
  catalog code.
- **Stage 5 Bind is a deterministic adapter** `uwo_code + params → catalog code` (per market),
  **not** a fuzzy text→code search.
- **`not_covered_branch` is a first-class router output**: domain declared in the ontology, branch
  not yet built → honest flag. It is never a silent monolith default (no "bednění on vinyl").

This **corrects the informal framing used earlier** (Bind = fuzzy retrieval):

| Prior (informal) | Ratified (this ADR) |
|---|---|
| Stage 4 → work_item with free-text `description` | Stage 4 → work_item **emits `uwo_code`** (controlled vocab) |
| Stage 5 → fuzzy code search over the catalog text | Stage 5 → **deterministic adapter** `uwo_code + params → catalog code` |

The token-overlap failure this fixes (from the UWO spec):
`dohloubky patek` {dohloubky, patek} ∩ `Bednění základů patek` {bednění, základů, patek} = {patek}
→ old path binds **FORMWORK** to an **EXCAVATION** line. With UWO, `dohloubka →
EARTHWORK.EXCAVATION.…` is decided in Decompose; Bind maps the code, never the shared word.

### D3 — Canonical UWO carrier = `docs/specs/universal-work-decomposer/`  *(recommended, pending ratification)*

It is the catalog-agnostic decomposer (scope-router → branch-decomposer → catalog-binding adapter)
— **Pattern 16 verbatim**. Promote status `review → Accepted` on ratification. **Pattern 16 stays
the principle** (registry entry), not a competing spec.

### D4 — Supersedes-ledger  *(recommended, pending ratification — the cure for the PK-graveyard defect)*

One in-repo place stating which artifact is **alive vs dead** in the UWO lineage. Enacting it =
stamping `SUPERSEDED_BY:` / `STATUS:` headers on the listed files (post-ratification, separate PR).

| Artifact | Lineage | Recommended status | Canonical successor |
|---|---|---|---|
| `docs/specs/universal-work-decomposer/` | UWO (Pattern 16) | **CANON** (review → Accepted) | — |
| `docs/TASK_UWO_Bridge_Ontology.md` | UWO (Pattern 16) | Superseded (fix its **wrong** pointer) | → `universal-work-decomposer` |
| `docs/STAVAGENT_PATTERNS.md` Pattern 16 | principle | Principle (registry) | — (referenced by canon) |
| `docs/tasks/TASK_Orchestrator_WorkOntology_SO250.md` | **element classification** (≠ UWO) | Done / shipped | `element-name-normalizer.ts` + `element_types.yaml` |
| `docs/tasks/TASK_Orchestrator_WorkOntology_SO202_Bridge.md` | **element classification** (≠ UWO) | Done / shipped | same |

---

## Reasoning

- **Physical work is universal; catalogs / codes / prices / formats are local** (Pattern 16). One
  ontology → N market adapters = one engine, N markets (DACH/ES expansion = new adapter, not new
  engine).
- **Controlled vocab (~50–100) removes the primary hallucination source.** The LLM never sees
  17 904 OTSKP / 39 000 ÚRS. This makes the STAVAGENT invariant "regex/catalog = 1.0, AI = fallback"
  **technically enforceable**, not merely declarative.
- **Deterministic Bind** eliminates the token-overlap class of mis-binding (D2 example).
- **Resolving the name-collision** collapses the apparent 4-way canon tie into a clear single winner
  (`universal-work-decomposer`) plus one mislabeled pointer to fix.
- **The ledger** is a structural fix for the PK-graveyard defect: a single authoritative in-repo
  place that says what is alive.

## What we KEEP

- Every existing stage tool as the spine's implementation (no rewrite): `extract_tz_fields`,
  `parse_construction_budget`, UEP, `build_bridge_passport`, `doc_to_quantified` join,
  `create_work_breakdown`, `catalog_matching`, `calculate_from_passport`.
- `universal-work-decomposer` as canon.
- `element-name-normalizer.ts` + `element_types.yaml` (the Orchestrator-WorkOntology axis) — separate,
  **DONE**.
- Domain profiles: `tz-passport` (bridge) + `doc_to_quantified` (monolit) as branches of stages 2–3.

## What we DROP / RELABEL (post-ratification, separate change)

- `TASK_UWO_Bridge_Ontology.md` → `SUPERSEDED_BY: universal-work-decomposer` (and fix its wrong
  successor pointer).
- Stop conflating "Orchestrator WorkOntology" with UWO in prose / soul.
- No new UI for `/api/v1/work-packages` — feed it into UWO as raw material.
- Orphan cleanup (separate ticket): `ContextEditor.html` delete; `DocumentUpload.html` verify/strip.

## Consequences

- **`uwo_code` becomes blocking dependency #1**, not a "third item": the vocabulary must exist
  before stages 4/5 can function. → **UWO vocab v1 is gated on this ADR** (the "1 → 2 → 3" order).
- **Vocab as codegen single-source**: `DOMAIN.CATEGORY.…` vocab in YAML → generated + drift-guarded
  (mirror `element_types.yaml`), so it never diverges between Core and kiosks.
- The **Klasifikátor kiosk's** honest Bind stage becomes `popis → uwo_code (controlled vocab) →
  adapter → catalog code` (see the kiosk design discussion, soul.md §9 2026-07-12).
- This ADR **supersedes the informal "Bind = fuzzy retrieval"** framing used in prior chat.
- **Sequencing:** ADR-009 (this) → UWO vocab v1 → rewrite the `work_item` contract to carry
  `uwo_code` + `not_covered_branch`.

---

## Open ratification points (for Alexander)

1. **Canon (D3):** confirm `universal-work-decomposer` is THE canonical UWO carrier (vs keeping it
   ambiguous, or elevating a different artifact).
2. **Ledger (D4):** approve stamping the `SUPERSEDED_BY:` / `Done` headers as listed.
3. **Vocab home:** confirm YAML-codegen single-source (mirror `element_types.yaml`) before vocab v1.
