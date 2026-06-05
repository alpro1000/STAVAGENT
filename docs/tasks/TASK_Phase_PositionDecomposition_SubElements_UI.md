# TASK_Phase_PositionDecomposition_SubElements_UI

**Phase:** Next after 2b (decomposition / breakdown). Sits on the same KB rule-data plate that 2b establishes.
**Estimated effort:** large — runs across multiple gates and likely several sequential PRs (recon ~4h · decomposition templates as KB ~6h · agent decomposition + two-mode geometry ~10h · UI master-detail + rollup ~12h · tests ~6h). Gates 4–5 (UI) can be split into their own session/PR if they grow.
**Dependencies:** **Phase 2b must be done first.** You cannot decompose a position into correctly-typed sub-elements until the element classifier types parent and sub-elements reliably. The decomposition templates and the typical-share ratios are stored on the **same shared rule-data plate** introduced in 2b.
**Demo role:** This is the "agent splits one bundled position into its real construction parts, calculates each, and assembles the picture" capability — a strong narrative (replayable, audited), but only after 2b makes typing honest.

---

## Core idea (the thing this phase exists to build)

A smeta **position** is a **commercial** unit (one catalog code + one billed quantity). But physically it often **bundles several construction sub-elements**. Example: one position "opěra a křídla" contains, in reality, **dřík + křídla + závěrná zídka** — three different constructions, each with its own rebar ratio, formwork, exposure, and **its own záběr (pour)**. The foreman's mental model *is* this decomposition.

So: **one position = a container of sub-elements**, and those sub-elements are instances of the **same concrete-element catalog** the classifier already knows (Pattern 15 Work-First, Pattern 16 universal ontology). Accurate resources / schedule / cost require calculating **per sub-element** and rolling the result back **up** into the one position row.

The previous flat-row calculator could not express this (one position = one calc). This phase changes the model: **position becomes a container, not a leaf.**

---

## The dimension dilemma — solved by two modes, not by choosing

Per-sub-element geometry (dimensions) is usually **not in the TZ** — it is on the výkres and requires manual measurement, which is not always wanted. Do **not** block on this. Support **both** modes; they produce the **same shape** of output, differing only in precision and confidence:

- **Exact mode** — dimensions entered (from výkres / statika) → precise V, F, h per sub-element → precise rebar / formwork / záběry. High confidence.
- **Approximate mode** — no dimensions → split the position's **total concrete volume** across sub-elements by **typical-share ratios** (KB data per parent-element-type) → approximate V per sub-element → approximate F, h, rebar. Lower confidence (engineering estimate).

Graceful degradation: default to approximate when dimensions are absent, flag the lower confidence, and let the user (or, later, a drawing-reading capability) **upgrade** to exact by entering measured dimensions. Never a hard stop.

**Key point for value:** the decomposition's **primary value — záběry / takty / crew / schedule — comes from the template alone, without exact dimensions.** "opěra → dřík + křídla + závěrná zídka = 3 záběry; a large dřík splits into further záběry" is a **schedule structure** derived from the parent type, not from measurements. Dimensions improve **cost and rebar** precision; the **takt plan exists immediately** in approximate mode.

---

## Division of labor (same loop as everything else: agent proposes → human confirms → engine computes)

- **Agent (MCP)** does the **decomposition**: parent position → sub-elements via the KB template, using TZ / výkres context; proposes the breakdown, picks the **mode** (exact if dimensions were found, else approximate), assigns **confidence**, and raises **HITL** for ambiguous splits or missing dimensions. The agent decomposes well because it has context + templates + reasoning — the calculator must **not** try to auto-guess the decomposition.
- **UI calculator** is where the user **reviews / edits** the proposed breakdown, **enters or corrects dimensions** (upgrading approximate → exact), and sees the **rollup**.
- **Engine (canonical, from Phase 2a)** computes each sub-element leaf (V / F / h / rebar / formwork / záběry / cost). It already does per-element calc — this phase adds "hold a list of children → run engine per child → aggregate."

---

## Mantra (read fully before ANY action)

1. **Read the whole repo.** Locate: how the calculator currently models a position (confirm it is flat: one position = one calc), where the geometry calculator lives, where the per-element engine calc lives (the Phase 2a canonical path), where záběr / takt / pour-sequence logic lives, where formwork and rebar per-element logic lives, and whether any parent↔child concept exists anywhere already.
2. **Read the shared rule-data plate from 2b** — the decomposition templates and typical-share ratios will live alongside it (same data discipline, language-neutral core + per-language labels).
3. **Read the existing UI table** for positions — how rows render, how a row's values are computed and stored, whether rows can expand, how edits persist.
4. **Read the existing audit-trail / confidence conventions** — every computed sub-element value must carry formula + source + confidence, and the rollup must carry its own audit.
5. Only then begin, and only after the interview + a fresh recon STOP.

This phase needs a **fresh recon** of the calculator's current position model (2b's recon covered classification, not the calculator's data model). Do that recon first and STOP.

---

## Pre-Implementation Interview (AskUserQuestion — ask, then wait)

1. **How is a position currently represented** in the calculator state and in the results table — confirm it is a flat leaf (one position = one calc), and identify exactly where its values are produced and stored.
2. **Where does per-element geometry → V/F/h computation live**, and is it already callable per arbitrary element instance (which is what per-child calc needs)?
3. **Where do záběr / takt / pour-sequence rules live**, and are the thresholds (when a dřík splits into multiple záběry: height / volume) already encoded?
4. **Do decomposition templates exist anywhere** (parent type → sub-element list), even implicitly, or is this net-new KB data?
5. **Are there typical-share ratios anywhere** (how the volume of an opěra typically divides across dřík / křídla / zídka), or is this net-new and to be seeded with the user?
6. **How should the parent row display the rollup** — totals only with an expand-to-children, or inline? And how should commercial quantity (the billed unit on the parent) relate to the summed construction volume of the children?
7. **Where should the agent's proposed decomposition be handed to the UI** (the contract between the MCP decomposition and the calculator), and how does a user-confirmed/edited breakdown get persisted back?
8. **What is the existing convention for "estimate" vs "measured" provenance** so the two modes map onto it cleanly (confidence + source)?

Then present a gated plan and **STOP** before any code.

---

## Business Logic

### 1. Position as container
A position gains a list of sub-element children. Each child is an instance of the concrete-element catalog (typed by the 2b classifier), with its own geometry-or-share, exposure, rebar, formwork, and záběr profile. The parent keeps its commercial identity (catalog code + billed quantity); the children carry the construction detail.

### 2. Decomposition templates (KB data)
Per parent-element-type, a template lists the sub-elements (opěra → dřík + křídla + závěrná zídka; a pier → základ + dřík + hlavice; etc.). Stored as **rule-data** on the 2b plate, language-neutral core + per-language labels. The agent applies the template; the user can add/remove/edit children.

### 3. Two-mode geometry
Per the dilemma section. Exact (dimensions) or approximate (volume split by KB typical-share ratios). Same output shape, confidence differs. Default approximate when dimensions absent; upgradeable to exact.

### 4. Záběr / takt from the template
The schedule structure (which children are separate záběry, when a child sub-splits into more záběry by height/volume thresholds) is derived from the parent template + per-type thresholds — available in **both** modes. This is the decomposition's primary deliverable.

### 5. Rollup (master-detail aggregation)
The parent row's displayed totals are the **aggregate of its children**: volume = Σ child volumes; cost = Σ child costs; schedule = the sequenced/combined záběry of the children; rebar = Σ; formwork = Σ (with system-compatibility respected — suppliers/systems not mixed within one sub-element). The parent carries its own audit (how the rollup was formed) and the **lowest child confidence** surfaces as the parent's confidence (a single approximate child makes the parent approximate).

### 6. Provenance & confidence
Every child value carries formula + source + confidence (measured vs estimate vs catalog). The rollup is replayable: re-running with the same inputs yields the same breakdown and totals.

---

## Domain Rules

- One commercial position can bundle multiple physical sub-elements; the billed quantity on the parent need not equal the summed construction volume of children (e.g. shared interfaces, rounding) — surface any large mismatch as a HITL, do not silently force equality.
- A foreman-standard decomposition is the ground truth for templates (e.g. opěra = dřík + křídla + závěrná zídka, each a záběr).
- A large dřík (height / volume over the existing thresholds) sub-divides into multiple záběry — reuse the existing záběr threshold logic, do not invent new numbers.
- Approximate mode is **valid output**, not a failure state — it is flagged with lower confidence and is upgradeable.
- Exact mode requires real dimensions (from výkres / statika); never fabricate dimensions to manufacture precision — absent dimensions ⇒ approximate, not invented numbers.
- Formwork systems / suppliers are never mixed within a single sub-element (incompatible connection systems); respect the existing formwork-selection rule per child.
- Czech construction terminology in human-facing labels; type-core identifiers language-neutral (consistent with 2b).

---

## Gated execution (STOP between gates)

- **Gate 0 — Fresh recon of the calculator's position model + interview.** Confirm flat-leaf today; locate per-element calc, záběr logic, geometry calc, UI row rendering. **STOP** with plan.
- **Gate 1 — Decomposition templates + typical-share ratios as KB rule-data** (on the 2b plate). Seed Czech, with the user, for the demo parent types. **STOP.**
- **Gate 2 — Agent (MCP) decomposition**: parent position → sub-elements via template + context, mode selection (exact/approximate), confidence, HITL for ambiguous/missing dims. Output is a proposed breakdown contract. **STOP.**
- **Gate 3 — Two-mode geometry + per-child engine calc + rollup (backend)**: run the canonical engine per child; aggregate to the parent; záběr/takt from template in both modes; audit + confidence on children and rollup. **STOP.**
- **Gate 4 — UI master-detail**: position becomes a container row; expand reveals editable children (type, dimensions-or-share, exposure …); user can add/remove/edit; enter dimensions to upgrade a child approximate → exact. **STOP.**
- **Gate 5 — UI rollup + persistence**: parent row shows aggregated totals derived from children; edits persist; confirmed breakdown is saved and replayable.

---

## Acceptance Criteria

1. A position can hold a list of **typed sub-element children**; the data model is container-not-leaf.
2. **Decomposition templates** exist as KB rule-data (on the 2b plate), language-neutral core + Czech labels, seeded for at least the demo parent types (incl. opěra → dřík + křídla + závěrná zídka).
3. The **agent** produces a proposed breakdown for a bundled position using template + context, selects mode, assigns confidence, and raises HITL for ambiguous splits / missing dimensions.
4. **Approximate mode** works: with no dimensions, the position's total concrete volume splits across children by KB typical-share ratios, producing approximate per-child V/F/h/rebar at lower confidence, **and a correct záběr/takt structure**.
5. **Exact mode** works: with dimensions entered, per-child V/F/h/rebar are precise at high confidence; the same breakdown shape as approximate.
6. A child can be **upgraded** approximate → exact by entering dimensions, without re-doing the whole position.
7. **Rollup** is correct: parent totals = aggregate of children (volume, cost, rebar, formwork, schedule); parent confidence = the lowest child confidence; parent carries a rollup audit.
8. Záběr/takt for a parent (e.g. opěra) reflects the children as separate záběry, and a large dřík sub-divides per the existing thresholds — in **both** modes.
9. **UI master-detail**: the position row expands to editable children; user can add/remove/edit children and enter dimensions; the parent row shows the rolled-up totals.
10. Edits **persist** and the confirmed breakdown is **replayable** (same inputs → same breakdown + totals).
11. No dimensions are ever fabricated to fake precision; absent dimensions ⇒ approximate + flagged, never invented numbers.
12. Large parent-vs-children quantity mismatch surfaces as HITL, not silently equalized.
13. Per-child and rollup values carry formula + source + confidence consistent with existing conventions.
14. Tests cover: template application, approximate split, exact calc, upgrade, rollup aggregation, záběr structure — with no live LLM/network/DB; deterministic.
15. After each gate, a short report (what changed / what next / acceptance covered).

---

## What Is NOT Included

- **Vision / drawing dimension extraction** (auto-reading dimensions off výkresy). Deferred capability; this phase relies on user-entered dimensions for exact mode.
- **MCP classify-delegation** and any change to the January work_classifier.
- **Pricing, Monte Carlo, full takt-planning layer** beyond the per-parent záběr sequence the template yields. Post-Cemex.
- **Restoring the general kb generator.** Post-Cemex tail.
- **Net-new element types** beyond what the 2b classifier supports.
- **BIM/IFC, DXF parsing.** Out of scope.

---

## Naming Determination

All component, file, field, function, and type names above are **descriptive of business intent only**. Determine real names from existing repo conventions:
- Extend the existing calculator state model, geometry calc, engine calc, and záběr logic — do not build a parallel position model.
- Match the existing UI table / row components and the existing edit-persistence pattern; the master-detail expansion should look like it was written by the same hand.
- Store templates and share-ratios in the same rule-data form and location established in 2b.
- Match existing audit-trail, confidence, and provenance field names.
- When in doubt, match the most recently merged calculator code, and ask rather than guess.
