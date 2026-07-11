# ADR-007: Monolith Classification — Signal Ladder, Grouping, and the Single Shared Classifier

**Status:** Accepted
**Date:** 2026-07-11
**Deciders:** Alexander (founder — 5 interview answers, «Согласен с рекомендациями»), Claude (Gate 0 audit)
**Spec:** `docs/specs/monolith-classification/` (requirements + design + tasks)

---

## Context

Monolit-Planner classifies budget rows into computable concrete elements on
TWO import paths (Excel upload, Registry/Portal import) with THREE divergent
`determineSubtype` copies and contradictory defaults (beton / jiné / beton).
The Gate 0 audit (design.md §2.2) found the "strong" Excel-side logic is
itself holed: the prefab filter is skipped by the primary grade-search path,
pairing exists only on the Excel side, the Registry-import INSERT cannot even
carry a user override (no `metadata` column), and the richer signals Portal
already returns (`row_role`, `skupina`) are ignored. m³ as a unit proved to be
a WEAK signal (Alexander's live observation: green ✓ without a «Vypočítat»
button, #1470), while the concrete grade (marka) proved strong.

## Decision

### 1. Definition of a monolith (the boundary)

A row is a **computable monolith** when it carries at least one STRONG signal
and no prefab veto:

```
override (user)                                  — absolute, both directions
   ↓
prefab veto (prefa|díl|prefab vocabulary)        — beats EVERYTHING below,
                                                   including a present marka
   ↓
marka betonu (C xx/yy incl. LC/UHPC forms)       — strong, ~0.95
   ↓
concrete catalog code (OTSKP monolithic prefixes) — strong, ~0.9
   ↓
m³ + concrete keyword (beton/železobet/monolit…) — WEAK third signal, ~0.6
   ↓
unit alone                                        — NEVER classifies;
                                                   tie-break only
```

- Aggregates (kamenivo/štěrk/písek…) stay a hard reject before the code check
  (existing behavior).
- **Podkladní prostý beton (§451x, „prostý beton C…/…") IS a computable
  monolith** — engine type `podkladni_beton` (rebar=0, no formwork) exists and
  computes honestly. The 451-prefix moves out of the non-monolithic list when
  the marka/keyword confirms plain concrete.
- Conflict rule: **prefab veto wins over marka** («PATKY Z DÍLCŮ C25/30» is
  NOT a monolith — the grade describes the precast part's material).

### 2. Sub-role assignment (per row)

`beton | bednění | výztuž | jiné` — deterministic ladder: explicit text
signals (výztuž/ocel/B500…; bedn/odbedň…) → catalog code semantics → unit as
tie-break only. One implementation; the three existing copies are replaced by
calls into it.

### 3. Bednění montáž/demontáž — ONE sub-role, TWO phases

ÚRS layouts carry montáž and demontáž as separate rows. They map onto the
ONE `bednění` sub-role with two phases (assembly before pour, stripping after
curing) — matching how the engine already schedules formwork. Two separate
sub-roles would double TOV rows for one resource.

### 4. Grouping (rows → computable element) and catalog layouts

Pairing výztuž/bednění to their beton parent is promoted from the Excel-only
`findPairedRows` into the shared layer, serving four catalog layouts:

1. **OTSKP** — beton row includes formwork («vč. bednění») + výztuž separate;
2. **ÚRS** — everything separate, formwork as montáž+demontáž pair;
3. **all-in-one** — single row per element;
4. **all-separate** — beton + bednění + výztuž each on its own row.

Pairing policy (interview answer 3): **automatic on the strong signal**
(catalog-code prefix match), **suggest-with-visible-badge on the weak signal**
(name overlap ≥2 significant words only), always detachable by the user.
The existing `formwork_included` / `rebar_included` flags keep their shape and
gate whether the calculator generates the sub-work or shows it as «v ceně».

### 5. Where the code lives

- **Extend `Monolit-Planner/shared/src/monolith-classifier.ts`** — the result
  grows from a bare boolean to a structured object (is_monolith + sub_role +
  confidence + ordered signals + is_prefab); `isMonolithicElement()` remains
  as a thin backward-compatible wrapper.
- Marka regex + prefab vocabulary become shared constants there (single
  source); `concreteExtractor.js`, `import-from-registry.js` and `coreAPI.js`
  call the shared classifier instead of their local copies.
- The Registry-import path starts consuming Portal's `row_role`/`skupina` and
  its bulk INSERT gains the `metadata` column (override + linked_positions
  become possible there).
- **Budget import stays whole-table** (interview answer 4, re-affirming
  #1454); visibility is the «Jen monolity» filter's job, not the importer's.
- MCP `classify_construction_element` gains the monolith/prefab axis
  **additively** (new output fields; the pinned compat fields stay untouched).

## Reasoning

- One source of truth ends the observed drift (three defaults, one dead
  filter) — the same row must classify identically via Excel and via Registry
  (spec acceptance Krit. 4).
- The prefab-veto-over-marka rule encodes the real-world failure the user
  caught live (#1470 trigger): precast parts quote a grade but are not
  poured on site.
- Determinism-first per `domain.md §1`: regex + vocabularies + catalog
  prefixes; no LLM anywhere in this path.
- Confidence tiers mirror the element-classifier's proven ladder
  (1.0 code / ≤0.9 keyword / ≤0.7 tie) so the two axes read consistently.

## What we keep / what we drop

**Keep:** `isMonolithicElement()` signature (wrapper); aggregate keywords and
OTSKP prefix tables (as data inside the new ladder); `findPairedRows`' pairing
heuristics (≥2 words / 4-char code prefix) and its `metadata.linked_positions`
+ `formwork_included`/`rebar_included` output shape; whole-table budget
import; #1470 frontend gate.

**Drop:** the three local `determineSubtype` copies; the beton-by-default
fallbacks; prefab checking limited to the legacy keyword path; the
Registry-import INSERT's metadata-less column list.

## Consequences

- Gate 2 implements the ladder + sub-roles in the shared classifier with
  golden + negative tests (marka→beton, prefab→ne, kamenivo→ne, m³-alone→ne,
  override wins, prostý beton→monolit).
- Gate 3 builds the shared grouping for the four layouts.
- Gate 4 rewires both import paths (and deletes the local copies) with a
  parity test.
- Gate 6 verifies MCP parity at family level (`test_mcp_compatibility.py`).
- Rollback: per-gate PRs; the wrapper keeps old callers working if a gate
  must be reverted.
