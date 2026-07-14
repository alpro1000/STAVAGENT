# ADR-009 — Document→Worklist pipeline: the 6-stage spine, three ontology axes, and the canonical-artifact ledger

> **Status:** PROPOSED — awaiting Alexander's ratification. The **per-axis canon (D3)** and the
> **supersedes-ledger (D4)** are his merge-gate call; this ADR *recommends*, it does not enact.
> No `SUPERSEDED_BY:` / status header is stamped into any other file until ratified.
> **Date:** 2026-07-12 · **Rev 3** (axis-B canon de-graveyarded into the repo — see §"Revision note").
> **Sources:** **axis-B canon `docs/specs/document-to-worklist/SPEC.md`** (imported 2026-07-12 from the
> PK-only TaskSpec) · worklist-audit (`docs/handoff/2026-07-08_worklist-gate2-next-session.md`) · UWO spec
> (`docs/specs/universal-work-decomposer/`) · orchestrator task family
> (`docs/tasks/TASK_Orchestrator_WorkOntology_SO250.md`, `_SO202_Bridge.md`, `_KROS_Adapter_Wrap.md`) ·
> Pattern 15 + Pattern 16 (`docs/STAVAGENT_PATTERNS.md`) · recon this session (soul.md §9 2026-07-12).

---

## Revision note (why Rev 2)

Rev 1 collapsed **three** ontology axes into **two** and mislabeled the orchestrator-workflow family
as "element classification, done." A falsifiable check against the repo corrected it:

- `TASK_Orchestrator_WorkOntology_SO202_Bridge.md` = **orchestrator workflow** (end-to-end pipeline
  → Stage-1 work list for 9 element types → calculator → 10 validation rules), **not** element
  classification, **not** done.
- `TASK_Orchestrator_KROS_Adapter_Wrap.md` = **Bind (stage 5) adapter**, "binds Stage-1 output."
- The authoritative axis-B spec (top-level `STAVAGENT_Orchestrator_WorkOntology_TaskSpec`, the
  SO-202 golden test, Orchestrator Spec §6.4/§7.6/§9.3 including *"split `create_work_breakdown` into
  work_only / catalog_binding"*) is cited by those files as living **"in Project Knowledge"** — it is
  **not in the repo**. That is the graveyard defect, on the exact spec we are building around.
- `TASK_Orchestrator_WorkOntology_SO250.md` **as it sits in the repo** carries element-classification
  acceptance criteria (#63–70 head-noun) under the axis-B family name — a mis-scoped / stale snapshot
  vs the family that references it as "Stage 1 output." Itself an instance of the collision.

**Rev 3 (2026-07-12, later the same day):** the axis-B canon was **recovered and imported into the
repo** as `docs/specs/document-to-worklist/SPEC.md`. Provenance: the PK "PDF"
`STAVAGENT_Orchestrator_WorkOntology_TaskSpec` is actually a ZIP of page rasters + a text layer —
which is *why* `find`/grep never saw it and why the repo grep for `validate_stage1_work_list` was
empty **correctly** (the string exists — §7.8 of the source, now SPEC §7). Text recovered from the
archive's text layer, merged with explicitly-marked `CONTRACT ADDITION` sections. Axis B is
simultaneously **renamed** `document-to-worklist` (D5 enacted by the SPEC itself). Import
verification also caught the graveyard defect *inside the import package*: of 3 fixtures, SO-250 was
genuinely missing (imported → `test-data/tz/SO-250.md`), SO-202 was a **stale PK copy** of a richer
repo file (NOT imported), VP4 was byte-identical (skipped).

---

## Context

Several efforts turn a document (TZ / výkres / soupis) into a **list of works**, each in a different
service, at a different maturity, unconnected — the worklist-audit named **"four unconnected
`seznam prací` implementations."** Underneath is **one** pipeline; it fragmented because a canonical
spine was never *declared*.

Two aggravating defects:

1. **Project-Knowledge graveyard.** PK holds ~100+ `TASK_*.md` with **no status field**; live and
   dead specs are indistinguishable from PK alone. Any PK citation is untrustworthy until
   status-checked against the repo. *This ADR was itself nearly poisoned by it* (see Revision note).
2. **The "WorkOntology" name-collision.** The name is worn by **three unrelated concerns** (below).
   The dead `TASK_UWO_Bridge_Ontology.md` even points at the wrong successor.

---

## Decision

### D1 — The document→worklist pipeline is a declared **6-stage spine** (= the axis-B workflow)

Each stage is a Core capability returning a **carrier** (data + confidence + provenance). Domain
specializations (bridge / monolit) are **profiles of stages 2–3**, not parallel pipelines.

| # | Stage | What it does | Implemented by (today) | Maturity |
|---|-------|--------------|------------------------|----------|
| 1 | **Extract** | document → structured facts | `extract_tz_fields`, `parse_construction_budget`, UEP, MinerU OCR | **A** live |
| 2 | **Structure** | facts → domain object | `build_bridge_passport` (bridge profile) | **A** live |
| 3 | **Quantify** | attach quantities (soupis qty → element volume) | bridge profile: passport-path soupis join (#1502–#1507, live-verified 14/14 vs manual etalon on SO-202) · monolit profile: `doc_to_quantified_elements` join | **A** bridge / **B** monolit (P1 landed, P2/P3 gated) |
| 4 | **Decompose** | element → work atoms, **emitting `uwo_code`** | `create_work_breakdown` (`breakdown.py`, Pattern 15) — concrete branch only | **A** live (concrete-only) |
| 5 | **Bind** | `uwo_code + params → catalog code` (per market) | `catalog_matching.py` + `find_otskp_code`/`find_urs_code`; `KROS_Adapter_Wrap` (task) | **B** honest chain live; UWO-keyed adapter not built |
| 6 | **Plan** | works → schedule + cost | `calculate_from_passport`, Kalkulátor 7-engine | **A** live |

*Maturity: A = in prod · B = partial/gated · C = spec-only · D = vision.*

### D2 — UWO (axis A) is the semantic layer **between Decompose (4) and Bind (5)**

- **Stage 4 emits `uwo_code`** from a controlled vocabulary (~50–100 codes) — **never** a catalog code.
- **Stage 5 Bind is a deterministic adapter** `uwo_code + params → catalog code`, **not** fuzzy
  text→code search.
- **`not_covered_branch` is a first-class router output** (domain declared, branch not built →
  honest flag; never a silent monolith default).

This corrects the informal "Bind = fuzzy retrieval" framing:

| Prior (informal) | Ratified |
|---|---|
| Stage 4 → work_item with free-text `description` | Stage 4 → work_item **emits `uwo_code`** (controlled vocab) |
| Stage 5 → fuzzy code search over catalog text | Stage 5 → **deterministic adapter** `uwo_code + params → catalog code` |

Failure this fixes: `dohloubky patek` ∩ `Bednění základů patek` = {patek} → old path binds
**FORMWORK** to an **EXCAVATION** line. With UWO, `dohloubka → EARTHWORK.EXCAVATION.…` is decided in
Decompose; Bind maps the code, never the shared word.

### D3 — **Three axes, three canons** *(recommended, pending ratification)*

The "WorkOntology" name hides three separate concerns. Each gets its own canon:

| Axis | Concern | Canonical carrier | Status |
|---|---|---|---|
| **A — Vocabulary + Adapters** | catalog-agnostic work vocab (`DOMAIN.CATEGORY…`) + per-market adapters (Pattern 16) | `docs/specs/universal-work-decomposer/` | alive (review → Accepted) |
| **B — document-to-worklist (Orchestrator Workflow, Stage 1→6)** | the pipeline that runs D1, produces the frozen Stage-1 work list (Pattern 15: code-empty, formula+source, golden tests HK212, replay) and binds it | **`docs/specs/document-to-worklist/SPEC.md`** (canon, imported 2026-07-12) + `_SO202_Bridge` + `_KROS_Adapter_Wrap` | **alive, NOT done** — canon now IN-REPO (de-graveyarded) |
| **C — Element typing** | head-noun classification (`dřík ≠ pilíř`), status/grounding | `element_types.yaml` + `element-name-normalizer.ts` | **shipped** (v4.34) — a **component inside stages 2/4**, not a pipeline |

Canon of axis A is scoped to **vocabulary + adapters only** — it is **not** the workflow canon.
Pattern 16 stays the *principle* (registry), not a competing spec.

### D4 — Supersedes-ledger *(recommended, pending ratification — the cure for the graveyard defect)*

One in-repo place stating alive vs dead **per axis**. Enacting = stamping headers post-ratification.

| Artifact | Axis | Recommended status | Successor / note |
|---|---|---|---|
| **`docs/specs/document-to-worklist/SPEC.md`** | B | **CANON (new — imported 2026-07-12)** | replaces the PK-only TaskSpec; fixtures repo-grounded (SPEC §12.4) |
| `docs/specs/universal-work-decomposer/` | A | **CANON** for vocabulary + adapters (review → Accepted) | **not** the workflow canon |
| `docs/TASK_UWO_Bridge_Ontology.md` | A | Superseded (fix its **wrong** pointer) | → `universal-work-decomposer` |
| `docs/tasks/TASK_Orchestrator_WorkOntology_SO202_Bridge.md` | B | **alive, not done** (Stage-1 bridge) | add header link → SPEC canon; SO-202 golden already in repo (richer than PK copy) |
| `docs/tasks/TASK_Orchestrator_KROS_Adapter_Wrap.md` | B (stage 5 / policy Stage 3) | **alive, not done** | add header link → SPEC canon |
| `docs/tasks/TASK_Orchestrator_WorkOntology_SO250.md` | B name / **C content** | **RECONCILE — open decision (Alexander)** | re-title as element-typing acceptance doc **or** re-scope to Stage-1 intent |
| `element_types.yaml` + `element-name-normalizer.ts` | C | **Shipped / done** | component of stages 2/4, not a pipeline |
| `docs/STAVAGENT_PATTERNS.md` Pattern 16 | principle | Principle (registry) | referenced by axis-A canon |

### D5 — Rename axis B off "WorkOntology" *(enacted by the imported canon)*

"WorkOntology" in the orchestrator family's name **was** the collision source (it collided with
axis-A UWO and axis-C element ontology). Axis B is now named **`document-to-worklist`** — the
imported canon carries the rename in its own header ("Renamed from: Orchestrator + Work Ontology").
Remaining follow-up: header links from the `_SO202_Bridge` / `_KROS_Adapter_Wrap` tasks to the canon
(post-ratification).

---

## Reasoning

- **Physical work is universal; catalogs/codes/prices/formats are local** (Pattern 16). One vocab →
  N adapters = one engine, N markets.
- **Controlled vocab (~50–100) removes the primary hallucination source** — the LLM never sees
  17 904 OTSKP / 39 000 ÚRS — making "regex/catalog = 1.0, AI = fallback" *technically enforceable*.
- **Deterministic Bind** kills the token-overlap mis-binding class (D2).
- **Three axes, not two:** axis B (workflow) holds the real Definition-of-Done and golden tests
  (SO250/SO202/HK212) and defines the very tool the vocab feeds. Burying it as "done element
  classification" would (a) drop the canon DoD from view, (b) send us to build a vocab with no
  acceptance criteria for its consumer, (c) breed a *fifth* worklist implementation — now
  ADR-blessed. The falsifiable check caught this before it was ratified.
- **The graveyard is on the critical path:** axis-B's authoritative spec is PK-only. It must be
  brought into the repo *before* it can be canonical.

## What we KEEP

- Every existing stage tool as the spine's implementation (no rewrite).
- Axis A canon `universal-work-decomposer`; axis B family (SO250/SO202/KROS_Adapter_Wrap + TaskSpec);
  axis C `element_types.yaml` + `element-name-normalizer.ts` (shipped, a component).
- Domain profiles `tz-passport` (bridge) + `doc_to_quantified` (monolit) as branches of stages 2–3.

## What we DROP / RELABEL (post-ratification, separate change)

- `TASK_UWO_Bridge_Ontology.md` → `SUPERSEDED_BY: universal-work-decomposer` (fix wrong pointer).
- ~~Bring axis-B TaskSpec into the repo~~ **DONE 2026-07-12** (`docs/specs/document-to-worklist/SPEC.md`
  + `test-data/tz/SO-250.md`; SO-202 golden was already in repo, richer than the PK copy).
- Reconcile the mis-scoped repo `SO250.md` vs the family's Stage-1 intent — **open decision**.
- ~~Rename axis B off "WorkOntology"~~ **DONE** — `document-to-worklist` (D5); header links from the
  two family tasks = post-ratification follow-up.
- No new UI for `/api/v1/work-packages`; kill orphan `ContextEditor.html`; verify/strip
  `DocumentUpload.html` (separate ticket).

## Consequences

- **Sequencing (per Alexander + SPEC package, do not reorder):**
  1. ~~bring axis-B DoD into the repo~~ **DONE 2026-07-12**;
  2. **reconcile `SO250.md`** — the one open decision;
  3. **then** axis-A vocabulary v1, built *against* the SPEC's DoD (§3.5) and contract
     (`vocabulary_code`, `not_covered_branch`, SPEC §6.3);
  4. **then** the `create_work_breakdown` split (SPEC §9.1 — **BLOCKING** for the Stage-1 invariant
     "no catalog code, no price", server-enforced not prompt-enforced).
  Vocabulary work does **not** start before steps 1–2. A vocabulary built without the acceptance
  criteria of its only consumer is how a fifth implementation gets born.
- `uwo_code` (axis A) + the workflow DoD (axis B) are joint prerequisites of stage 4/5; neither is
  built against the other's absence.
- **Stage-1 vs Plan-stage fixtures must not be conflated** (SPEC §12.4): SO-250/SO-202/VP4 validate
  the *calculator* (stage 6); the Stage-1 DoD test is **HK212** (138 items, Code/Cena empty).
- **Vocab as codegen single-source** (`DOMAIN.CATEGORY.…` YAML → generated + drift-guarded, mirror
  `element_types.yaml`).
- The Klasifikátor kiosk's honest Bind = `popis → uwo_code → adapter → catalog code`.

---

## Open ratification points (for Alexander)

1. **Three-axis model (D3):** confirm A = `universal-work-decomposer` (vocab/adapters only),
   B = `document-to-worklist` SPEC + family (alive, not done, canon now in-repo), C = element typing
   (shipped component).
2. **Ledger (D4):** approve the per-axis statuses + post-ratification stamps (`SUPERSEDED_BY` on
   `TASK_UWO_Bridge_Ontology`, header links on the two family tasks).
3. **`SO250.md` reconcile — the one open decision:** (a) re-title as an element-typing acceptance doc
   (axis C, content stays), or (b) re-scope/rewrite to the Stage-1 worklist intent its family assumes.
4. **Sequencing confirmed:** SO250 reconcile → vocab v1 → `create_work_breakdown` split (§9.1).
   Vocab NOT started yet.
