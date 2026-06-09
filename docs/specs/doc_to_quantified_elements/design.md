# Design — Document → quantified-`elements[]` (front-half, monolit/most-doména)

**Date:** 2026-06-08
**Type:** DESIGN PROPOSAL → APPROVED 2026-06-09. **P1 (pure join) LANDED** (§12). P2/P3 = separate gated tasks.
**Scope:** concrete-agent stage-gating recipe — closing the **primary manual seam** (recon §3.1)
for the **monolit/bridge domain only** (where the back-half already runs end-to-end).
**Based on:** `docs/audits/pipeline_state_recon/2026-06-08_pipeline_recon.md` (the seam + exact loci).
**Review pins folded in:** **B** — single-source the divergence bands/formula against the canonical TS
engine, never hardcode in Python (§5.6, §8.1, §12). **A** — the divergence-flag carriage to the
deliverable is *traced*, not just claimed, and *asserted* in the offline golden (§6, §8.2).

---

## 0. TL;DR

The orchestrator recipe runs **detect → classify → nuance → work-breakdown → calculate →
export**, but it consumes `options["elements"]` with **quantities already filled by a human**.
The two tools that would fill them already exist and are already allow-listed — they are just
**not wired to each other**:

- **`extract_tz_fields`** already returns the **exact `elements[]` shape** the recipe consumes,
  with `volume_m3=None` (honest stage-2 blank) + a top-level `geometry` block.
- **`parse_construction_budget`** already returns soupis `items[]` with `quantity` + `unit` + `code`.

This design adds **one deterministic join** — soupis quantity → `element.volume_m3` keyed on
`element_type` — inside an **extended DOCUMENT_ANALYSIS step**, producing quantified `elements[]`
that WORK_ATOMIZATION consumes with **no manual stitching**. Provenance + confidence ride each
filled volume and reach the deliverable through the **already-shipped calc/confidence passthrough**
(PR #1319). The `elements[]` shape is **reused verbatim, not forked**.

---

## 1. The seam (code-grounded, from recon §2–§4)

| Fact | Locus |
|---|---|
| Recipe reads elements (+volumes) straight from the request | `recipe_runner.py:166` `elements = [dict(e) for e in (opts.get("elements") or [])]` |
| Deck volume read off caller element, default 0 | `recipe_runner.py:240` `calculate_concrete_works(volume_m3=deck.get("volume_m3", 0), …)` |
| Work items with no caller volume silently skipped | `breakdown.py` qty≤0 skip; *"Stage-1 extract ships volume_m3=None (volumes are stage 2)"* |
| `extract_tz_fields` **emits the element list** but `volume_m3=None` | `extract_tz_fields.py:633` `return {"object": obj, "elements": elements}`; per-element `volume_m3=None` (`:314, :337`) |
| TZ NK geometry exists (Gate 3) | `extract_tz_fields.py:629` `obj["geometry"] = _extract_geometry(text)` → `num_spans, span_lengths_m, nk_height_m, nk_width_m, cross_section_type, structural_system` |
| `parse_construction_budget` **emits quantities** | `budget.py:117-122` per item `{code, description, unit, quantity, unit_price, total_price}` |
| **No consumer** maps budget → `elements[].volume_m3` | recon §2 (grep: only the tool's own definition) |
| `extract_tz_fields` already allow-listed in DOCUMENT_ANALYSIS, **unwired** | `workflow_definitions.yaml:34`; `_detect_step` calls only `detect_object_type` (`recipe_runner.py:146`) |
| `parse_construction_budget` allow-listed in `_all_stages` | `workflow_definitions.yaml:26` |

**Conclusion:** the skeleton (`elements[]` identity + `concrete_class` + `geometry`), the
honest-blank contract (`volume_m3=None`), and the deliverable-side number/confidence carriage
(PR #1319) all already exist. The single missing artifact is the **join** + its **wiring** into
DOCUMENT_ANALYSIS.

---

## 2. Decisions (Phase B interview + domain rules §6)

| # | Decision | Source |
|---|---|---|
| D1 | **Step location:** extend DOCUMENT_ANALYSIS; documents arrive via `options` (`tz_text` / `soupis_file_base64`) — additive, **no `/orchestrate` signature change**. | interview Q1 |
| D2 | **Join key:** classify both the soupis-line `description` and the TZ element `name` with the existing `classify_construction_element`; **beton+m3** lines summed into `element.volume_m3`; **M soupis-položky → 1 element** (group). Mirrors Monolit `mapSmetaToField`. | interview Q2 |
| D3 | **TZ geometry = cross-check only.** Soupis authoritative for volume; geometry yields an *expected* volume → **divergence flag**, never auto-resolve, never overwrite. No soupis match → element stays **honest-blank** (geometry does **not** fabricate a volume). | interview Q3 + §6 |
| D4 | **Honest-blank is an explicit state** (not a missing field): unmatched element keeps `volume_m3=None` + a flag; never disappears, never a fabricated number. | §6 + extract_tz contract |
| D5 | **Divergence = flag, not auto-resolution.** Full reconciler is a later increment. | §6 |
| D6 | **Test strategy:** hermetic offline unit for the join + offline recipe golden mocking the delegation seam; the **true live e2e** (`/orchestrate` needs Postgres+Monolit+JWT) is an **env-gated, outside-CI** smoke — designed in from the start. | interview Q4 + §8 |
| D7 | **Reuse, not fork** — the existing `elements[]` shape, `_source` provenance mechanics, classifier, and the calc-passthrough carriage. Extend in **one** place (DOCUMENT_ANALYSIS). | §9 |

---

## 3. The element contract (reused verbatim)

`extract_tz_fields` already emits exactly what WORK_ATOMIZATION reads. The join **fills fields on
the same dict** — no new shape:

```jsonc
{
  "name": "NK mostovka",
  "object_code": "SO-202",
  "concrete_class": "C35/45",          // from TZ materials section (extract_tz)
  "volume_m3": 605.0,                  // ← FILLED by the join (was None / stage-2)
  "span_m": 20, "num_spans": 6,        // ← from object.geometry (deck only)
  "is_prestressed": true,              // ← from geometry.structural_system.prestress
  "_source": {
    "name": {...}, "concrete_class": {...},
    "volume_m3": {                     // ← NEW provenance leaf on the quantity
      "source": "soupis",
      "evidence": "27 33-… Mostovka … m3 qty=605.0",
      "matched_by": "element_type:mostovkova_deska",
      "confidence": 0.9
    }
  },
  "quantity_status": "extracted",      // ← explicit honest-blank flag (extracted | missing)
  "quantity_divergence": null          // ← or { soupis: 605, geometry_expected: 660, ratio: 1.09, severity: "info" }
}
```

`volume_m3` and the geometry fields (`span_m`, `num_spans`, `is_prestressed`) are the deck inputs
`calculate_concrete_works` already reads (`recipe_runner.py:240-243`). **No field is renamed or
removed.**

---

## 4. The new step — extended DOCUMENT_ANALYSIS

### 4.1 Data flow

```
options.documents (tz_text? + soupis_file_base64?)         options.object / options.elements (legacy)
        │                                                              │
        ▼                                                              │
 DOCUMENT_ANALYSIS (_detect_step, extended)                           │
   ├─ detect_object_type            (EXISTING — unchanged)            │
   ├─ extract_tz_fields(text=tz)    → { object{geometry}, elements[ volume_m3=None ] }
   ├─ parse_construction_budget(soupis) → { items[ {code,desc,unit,quantity} ] }
   └─ JOIN  (§5)  soupis.quantity ──element_type──▶ element.volume_m3 (+ _source +confidence)
                                   geometry ──cross-check──▶ quantity_divergence flag
        │
        ▼  partials[DOCUMENT_ANALYSIS]["elements"] = quantified elements[]   (+ object_type, object_code)
        ▼
 WORK_ATOMIZATION (_atomize_step)
   elements = partials[DOCUMENT_ANALYSIS]["elements"]  ?? options["elements"]   ← back-compat fallback
   (classify → nuance → create_work_breakdown → calculate deck → carry calc+confidence → export)
```

### 4.2 Contract details

- **Input transport (D1):** `options["documents"] = {"tz_text"|"tz_file_base64": …, "soupis_file_base64": …, "soupis_filename": …}`. All optional — when absent, the step degrades to today's behaviour (object-only detect; WORK_ATOMIZATION falls back to `options["elements"]`). **Zero break** to existing callers / `test_thin_hybrid_recipe.py`.
- **Step boundary (D1):** stays inside `_detect_step` (rename → `_document_analysis_step`), reusing its `loader`/`saver`/object-type cache. No new workflow state, **no `sequence`/edge/YAML change** — the allow-list already permits both tools.
- **Output:** `partials[DOCUMENT_ANALYSIS]` gains `elements` (quantified) + `quantification_summary` (counts: extracted / missing / divergent). `object_type` + `object_code` keys unchanged.
- **WORK_ATOMIZATION read (D7):** `_atomize_step` sources `elements` from the DA partials, **falling back** to `options["elements"]` (one-line change at `recipe_runner.py:166`). Everything downstream (classify, breakdown, deck calc, the PR #1319 passthrough) is untouched.

---

## 5. The join — `soupis položka → element` (deterministic)

A pure function (no I/O), the implementable unit of Phase 1:

```
map_soupis_to_elements(parsed_budget, tz_elements, geometry, *, classify) -> elements[]
```

**Algorithm (D2 / D3 / D4 / D5):**

1. **Filter soupis to concrete-volume lines:** keep `items` whose `unit` ∈ {m3, m³} *and* whose
   `description`/`code` classify (via `classify_construction_element` + the OTSKP/work-type
   detectors already used by `position-linking`) as **beton**. Non-beton lines (bednění m2,
   výztuž t, …) are out of scope for `volume_m3` this increment (they map to other fields in a
   later phase — noted, not built).
2. **Element-type key:** classify each kept soupis line `description` → `element_type`; classify
   each `tz_element.name` → `element_type` (object-type threaded for bridge context, as the
   recipe already does). Match on `element_type`.
3. **Group (M→1):** sum `quantity` of all soupis beton-lines sharing an `element_type` into that
   element's `volume_m3`. (Multiple beton pours of one deck → one deck volume.)
4. **Provenance + confidence (§6):** stamp `_source.volume_m3 = {source:"soupis",
   evidence:"<code> <desc> qty=<q> <unit>", matched_by:"element_type:<t>", confidence}`. Confidence
   ladder mirrors the classifier: code-driven element_type match = high (≤1.0); keyword/description
   match = ≤0.9; a same-`element_type` ambiguity across several elements (e.g. two opěry) → lower +
   `candidates[]`, **not** a silent pick.
5. **Honest-blank (D4):** a `tz_element` with **no** matched soupis line keeps `volume_m3=None`,
   `quantity_status="missing"`. It is **kept** in the list (never dropped), flows to
   WORK_ATOMIZATION, and is surfaced (it will read honest-blank in the export exactly like the
   PR #1319 `NEPOČÍTÁNO` marker).
6. **Divergence cross-check (D3/D5 + pin B):** when both a soupis volume and `geometry` exist for the
   deck, compute `expected = f(geometry)` and ratio-check. **Pin B — the bands + the formula are NOT
   hardcoded in Python.** They live once in the canonical TS engine (`DECK_SUBTYPE_EQ_THICKNESS_M`,
   `estimateExpectedVolume`, `checkVolumeGeometry` — `<0.3 / >3` critical, `0.3–0.7 / 1.5–3` warning,
   `0.7–1.5` OK). The Python side is a deterministic *mirror* (`volume_geometry.py`) whose constants,
   thickness table, and formula shape are **asserted equal to the TS source by a parsing parity test**
   (`test_volume_geometry_parity.py`) — a TS change that isn't mirrored goes RED. This keeps the two
   nets (this soupis↔TZ flag + the engine's own `checkVolumeGeometry`) on **one set of numbers**. On
   drift set `quantity_divergence = {soupis, geometry_expected, ratio, severity}`. **Never** overwrite
   the soupis volume; **never** auto-resolve.

**Reuse anchors:** Monolit already does steps 1–4 on the TS side — `mapSmetaToField` (beton+m3 →
`volume_m3`) + `detectWorkType`/`detectCatalog` in `tz-text-extractor.ts` / `position-linking.ts`,
and steps 6 via `estimateExpectedVolume`/`checkVolumeGeometry` (`element-classifier.ts`). This
design ports the **same deterministic rules** to the Python join (W3 parity), it does not invent
new ones.

---

## 6. Provenance, confidence, honest-blank, divergence — all reach the deliverable

The numeric chain becomes end-to-end **document → element → calc → deliverable**, every hop sourced:

- **Quantity provenance:** `_source.volume_m3` traces each volume to its soupis line — the same
  `_source` discipline the work items already carry (`breakdown.py:233`), and the grounding-gate
  already validates.
- **Confidence:** the join stamps a confidence on each volume; this is **separate** from the
  classification confidence the breakdown already carries (PR #1319) — both are real scalars, not
  composited.
- **Carriage to deliverable (already built):** filled `volume_m3` → deck `calculate_concrete_works`
  → PR #1319 carries the calc subset + warnings onto the work-items + into `calc_summary` /
  `calc_warnings` + fills the visible `Zdroj`/`Důvěra` columns. **Nothing new is needed on the
  export side** — this design only fills the *input* the passthrough already propagates.
- **Honest-blank:** `quantity_status="missing"` element → `volume_m3=None` → deck calc skipped →
  PR #1319 honest-blank path → export `NEPOČÍTÁNO` marker. **One consistent honest-blank semantics**
  across both gates.
- **Divergence flag — carriage TRACED, not assumed (pin A):** the lesson of #1319 was that a value
  computed early evaporates unless its path to the deliverable is explicit. The join sets
  `element.quantity_divergence` (structured). P2 must carry it via **two existing channels, no new
  plumbing**: (1) the DA step folds divergent elements into `quantification_summary{extracted,
  missing, divergent}` in `partials[DOCUMENT_ANALYSIS]` (audit record, lands in the committed
  session state); (2) for each divergent element the DA step pushes one `⚠️ soupis X m³ vs geometrie
  ~Y m³` line into the **same `warnings[]` channel** that PR #1319 already routes to `calc_warnings`
  and renders in the export. So the flag reaches the deliverable on the identical rails the calc
  warnings ride. **No auto-resolution.** §8.2 asserts the divergence signal is present at the
  deliverable (committed `quantification_summary` + a divergence `warnings` line), not just at the
  join output — closing the same gap #1319 had to retrofit for calc numbers.

---

## 7. Phased implementation plan (gated; each additive, golden-paired)

| Phase | Deliverable | Test | Wiring | Risk |
|---|---|---|---|---|
| **P1 — the join (pure)** ✅ **LANDED** | `map_soupis_to_elements(...)` + `volume_geometry.py` (TS mirror): filter→classify→group→provenance→honest-blank→divergence-flag. **No recipe wiring.** | **Hermetic unit** (§8.1) + **TS-parity drift guard** (pin B) — 14 tests, fully offline | none (standalone module) | low — pure fn, no I/O |
| **P2 — wire into DOCUMENT_ANALYSIS** | extend `_detect_step`→`_document_analysis_step`: call `extract_tz_fields` + `parse_construction_budget` from `options.documents`, run P1 join, cache quantified `elements[]` + `quantification_summary` + push divergence `warnings`; `_atomize_step` reads DA partials (fallback `options["elements"]`). | **Offline recipe golden** (§8.2) mocking `monolit_delegate._http_post` (as PR #1319) — **asserts the divergence flag reaches the deliverable (pin A)** | one step + one read line; YAML untouched | low-med — back-compat fallback keeps `test_thin_hybrid_recipe.py` green |
| **P3 — live e2e seal (env-gated)** | documented runbook + an env-gated smoke through `/orchestrate` (real Postgres+Monolit+JWT) | **env-gated** (§8.3), skipped in CI | marker only | n/a (out of CI gate) |

**Out of this plan (later increments, recon §3):** non-beton field mapping (bednění m2 →
`formwork_area`, výztuž t → rebar); non-monolit width (renovation/professions); CATALOG_BINDING /
PRICING wiring; in-flow reconciler across the 12 rules; multi-element-instance disambiguation
(two opěry) beyond the `candidates[]` flag.

---

## 8. Test strategy (designed-in, per D6)

### 8.1 Hermetic unit (P1) — fully offline, no network/DB/AI ✅ DONE (§12)
`test_soupis_quantity_join.py` (9 tests) — parsed-budget dict (beton+m3 line + bednění m2 + výztuž t
+ noise výkop m3) + `tz_elements` (`volume_m3=None`) + a `geometry` dict, injected stub classifier:
- matched elements get summed `volume_m3` with `_source.volume_m3` + confidence (≤0.9 keyword cap);
- M→1 grouping (two beton lines, one element_type → summed, `n_lines=2`);
- unmatched element → `volume_m3=None`, `quantity_status="missing"` (honest-blank, still present);
- same-type ambiguity → both `quantity_status="ambiguous"` + `candidates[]`, **never** a silent split;
- divergence: geometry far from soupis → `quantity_divergence` set, soupis volume **unchanged**;
- non-beton (m2/t) + unmatched m3 (výkop) never land in `volume_m3`; inputs not mutated.

**Pin B — TS-parity drift guard:** `test_volume_geometry_parity.py` (5 tests) parses
`element-classifier.ts` and asserts the Python mirror's deck-thickness table, default fallback,
`0.3/0.7/1.5/3` bands, and formula shape are identical — a TS-only change goes RED. Negatively
verified: perturbing a Python constant makes the guard fail (proven, not assumed).

### 8.2 Offline recipe golden (P2) — mirrors the PR #1319 harness
Drive the in-process recipe with `options.documents = {tz_text: <SO-202 excerpt>,
soupis_file_base64: <tiny xlsx fixture>}` and **mock `monolit_delegate._http_post`** (sentinel
PlannerOutput, `raise AssertionError` on any other path → live leak fails, never skips). Assert:
- `partials[DOCUMENT_ANALYSIS]["elements"]` carries the quantified deck (`volume_m3` from the soupis fixture);
- WORK_ATOMIZATION computes the deck from the **extracted** volume (not a caller-supplied one);
- the deliverable carries the number + `_source.volume_m3` provenance + honest-blank for an unmatched element;
- **pin A — divergence reaches the deliverable:** with a geometry fixture that diverges from the soupis
  volume, assert the **committed** `quantification_summary.divergent > 0` AND a `⚠️ … vs geometrie …`
  line is present in the deliverable's `warnings`/`calc_warnings` — i.e. the flag survives the whole
  pipeline, not just the join. (A consistent-geometry control asserts no false divergence warning.)
Wired into `.github/workflows/test-mcp-compatibility.yml` (runs, not skipped).

### 8.3 Live e2e (P3) — env-gated, outside CI (the part that needs the live stack)
`/orchestrate` needs a Postgres session store (`DATABASE_URL`), a reachable Monolit `/api/calculate`,
and a Portal JWT — none offline/deterministic. **Designed in from the start** as an env-gated smoke:
a test guarded by e.g. `STAGEGATING_LIVE_E2E=1` (skip-by-default), plus a short runbook (`docs/…/
e2e_runbook.md`) — stand up Postgres + point at a Monolit URL + mint a JWT, POST a real SO-202
soupis+TZ, assert a rendered `.xlsx` with quantities. **Not** a CI gate; the offline golden (8.2)
covers the recipe path deterministically, this is the manual/staged seal.

---

## 9. Scope boundaries / explicit non-goals (task §7)

- **P1 = the pure join only.** P2 (recipe wiring) + P3 (env-gated e2e) are separate gated tasks.
- **Monolit/bridge first.** No non-monolit width (renovation/professions) here.
- **No `elements[]` fork** — fields are filled on the existing shape.
- **No Monolit/calculator/delegation change** — this is about *filling* `elements[]`, not computing.
- **No CATALOG_BINDING / PRICING / in-flow reconciler** — later increments.
- **Catalog routing by procurement mode** (privátní→ÚRS, veřejná→OTSKP) noted for the future; **not**
  wired here.

---

## 10. Open questions / residuals (for review)

1. **Multi-instance elements** (two opěry, three dříky): P1 emits `candidates[]` + lower confidence
   on a same-`element_type` ambiguity rather than guessing. Is per-instance splitting (by soupis
   sub-code or position order) wanted in P1, or deferred? *(Recommendation: defer; flag in P1.)*
2. **Soupis transport size:** `soupis_file_base64` in `options` inflates the `/orchestrate` body for
   large books (SO-202 = 3373 položek). Acceptable for P2, or prefer a project-cache handle the
   caller pre-uploads? *(Recommendation: base64 for P2 fixtures; handle-based transport is a P3
   concern.)*
3. ~~**Where the divergence band lives**~~ **RESOLVED by pin B.** The bands/formula live once in the
   canonical TS engine; the Python join uses a mirror (`volume_geometry.py`) guarded by a parsing
   parity test. The two nets (soupis↔TZ flag + the engine's own `checkVolumeGeometry`) share one set
   of numbers, drift-guarded.

---

## 11. Review pins — disposition

| Pin | Ask | Disposition |
|---|---|---|
| **B** | Don't hardcode divergence bands/formula in Python; single-source or parity-test vs TS engine. | ✅ **Done in P1.** `volume_geometry.py` mirrors the TS; `test_volume_geometry_parity.py` parses `element-classifier.ts` and asserts equality (table, default, `0.3/0.7/1.5/3` bands, formula shape). Negatively verified to bite. |
| **A** | Divergence-flag carriage to deliverable is claimed but not traced — trace it + assert in golden 8.2. | ✅ **Traced + designed into P2** (§6, §7, §8.2): carried via `quantification_summary` (committed) + a `⚠️` line on the existing `warnings`→`calc_warnings` rail; 8.2 asserts the flag at the **deliverable**, not just the join. Implemented when P2 lands. |
| honest-blank | keep, never fabricate. | ✅ kept (`quantity_status="missing"`, element retained), unit-tested. |
| ambiguity | flag + `candidates[]`, never silent split; multi-instance deferred. | ✅ as agreed; unit-tested; open question #1 deferred. |

---

## 12. Implementation status

**P1 — LANDED** (this branch). Pure join + TS-mirrored cross-check, no recipe wiring, no behaviour
change to any existing path.

| Artifact | Path |
|---|---|
| Join (pure fn) | `concrete-agent/.../app/services/stage_gating/soupis_quantity_join.py` |
| Cross-check (TS mirror, pin B) | `concrete-agent/.../app/services/stage_gating/volume_geometry.py` |
| Hermetic unit (§8.1) | `concrete-agent/.../tests/test_soupis_quantity_join.py` (9) |
| TS-parity drift guard (pin B) | `concrete-agent/.../tests/test_volume_geometry_parity.py` (5) |

**14/14 new tests green; `test_thin_hybrid_recipe.py` baseline still 11/11** (additive, no
regression). The join is wired into nothing yet — `_atomize_step` still reads `options["elements"]`;
P2 is the wiring task.

**Next (separate gated tasks):** P2 — extend DOCUMENT_ANALYSIS to call `extract_tz_fields` +
`parse_construction_budget`, run the join, cache `elements[]` + `quantification_summary`, push
divergence warnings; `_atomize_step` reads DA partials (fallback `options["elements"]`); offline
recipe golden asserting pins A. P3 — env-gated live e2e runbook.
