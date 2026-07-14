# Universal Work Decomposer (UWO) — Tasks (vocab v1 increment)

> **Spec ID:** `universal-work-decomposer` (axis-A canon per ADR-009 D3)
> **Status:** Gate 0–4 DONE (2026-07-14; vocab **v1.3** — 85 codes, HK212 100 % work-item
> coverage; retrofit: coverage contract test-enforced) · Gate 5 (create_work_breakdown split) next
> **Prerequisites:** ADR-009 Accepted · axis-B canon `docs/specs/document-to-worklist/SPEC.md`
> **Scope GO:** Alexander 2026-07-14 — three-tier plan + 3 market-proofing schema fixes
> (lang-map labels/keywords · `unit_canonical` + adapter render · market-typed params).
> **Invariant test:** adding a German label = filling an empty slot, NEVER a schema migration.

---

## Gate 0 — Recon: bottom-up atom inventory (DONE 2026-07-14)

Three real sources, no armchair taxonomy:

| Source | What it yielded |
|---|---|
| `app/mcp/tools/breakdown.py` `WORK_TEMPLATES` (live concrete branch) | Tier-1 atoms: bednění/odbednění/výztuž/beton/ošetřování + skruž + římsový vozík + předpětí Y1860 + piloty |
| HK212 hall domains — **Pattern 15/16 REGISTRY REFERENCES only**; the 138-item corpus is under `test-data/` READ-deny → these codes are **UNVERIFIED against HK212** until the Gate-3 harness runs | Hall domains (seed): zemní, ocel montáž, opláštění (Kingspan), střecha, lešení, přesun hmot, doprava/suť |
| interiér: `interier_psv/malba.yaml` (shipped MVP — the only built section) + `sandbox/uwo-interier-mezonet/src/templates.mjs` S1–S10 (**sandbox ≠ branch**; port = UWO F2, zbývá) | Interiér: demontáže, štuk/perlinka/malba, SDK, hydroizolace, obklad/dlažba, vinyl/parkety, ZTI, elektro+revize, kotel/spalinová cesta, okna/dveře |

Recon insight folded into the schema: **Eurocode params are market-neutral by EN-unification**
(C30/37 = C30/37, B500B, Y1860, IPE 400) → only NATIONAL-scheme params need the `{market, scheme,
value}` shape (`soil_class`, `surface_class`, `curing_class`, `inspection_regime`).

## Gate 1 — Vocabulary v1 DATA (DONE 2026-07-14; **v1.1 corrections same day**)

`app/knowledge_base/B5_tech_cards/technological_postupy/uwo_vocabulary.yaml`
— sibling of the branch templates that consume it (breakdown.py already loads from this tree;
`element_rules/` is the classifier axis, deliberately not overloaded).

- **47 codes · 22 domains** — honest coverage per the **coverage contract** (Alexander audit fix):
  `covered` = THE DECOMPOSER BRANCH IS BUILT, not "code exists in YAML". Built today: branch
  `monolit` (4 domains' atoms) + branch `interier_psv` section `malba` only → **13 covered /
  34 declared**; domains: 4 `branch: monolit` + 1 partial `interier_psv` (FINISHES) + 17
  `branch: none`. ELECTRICAL/PLUMBING/HVAC/ROOFING/MASONRY/TILING verified: no branch → declared.
- Schema: `label`/`keywords` = lang maps (cs filled, de/es empty slots) · `unit_canonical` ∈
  m|m2|m3|**m2_day**|t|ks|kpl|h · `params[].kind` ∈ scalar | eurocode_class | market_scheme ·
  `coverage` ∈ covered | declared.
- **v1.1 domain corrections (Alexander):** SCAFFOLDING split ERECTION (m2) / RENTAL (m2_day —
  schedule-dependent physics) / DISMANTLING (m2); `přesun hmot` is TWO-dimensional → `distance_m`
  mandatory param (CZ catalogs band distance into the item; adapter picks the band), same on
  DEBRIS.REMOVE; **VRN codes removed** (koordinace/administrativa/hodinové sazby = cost articles
  per ČSN 73 0212, billing constructs — never vocabulary; SITE domain kept declared-empty for
  future physical site works).
- Registration rule in header: inventing a code is FORBIDDEN — unknown work → registration proposal
  (human approval = PR), per SPEC document-to-worklist §6.3.
- Hermetic YAML invariant check green (lang-map keys, unit whitelist, unique codes, param kinds,
  coverage-contract prefixes, no SITE/VRN codes).
- **v1.2 (domain review Alexander, 8 fixes + rule 4):** (A) FALSEWORK.ERECT unit m²→**m³**
  (obestavěný prostor podpěrné konstrukce — OTSKP kánon, skruž ≠ bednění) + new
  `FORMWORK.FALSEWORK.STRIP` (own položka; zrání ≥ 21 d ČSN 73 6244 lives in the calculator);
  rough-ins kpl→**m** (kpl degenerates quantity to 1 → G2 Quantify passes vacuously). (B) 5 gaps
  proven by OUR OWN fixtures (SO-250/SO-202/VP4 did not pass the dictionary):
  `WATERPROOFING.MEMBRANE.APPLY` · `EARTHWORK.DRAINAGE.INSTALL` · `STEEL.RAILING.INSTALL` (m +
  mass_kg_per_m; m×kg/m→t deterministic, t→m = review_flag) · `CONCRETE.JOINT.DILATATION` (SO-250
  42 DC) · `TRANSPORT.SPOIL.REMOVE` (výkopek ≠ suť) + recommended `CONCRETE.POUR.BLINDING`
  (adapter determinism). (C) **Header rule 4** (three-case-confirmed): ONE canonical unit per code
  = primary physical dimension; the catalog's second dimension is ALWAYS a mandatory param,
  conversion = adapter, never a second unit (přesun t+distance · pronájem m2_day+duration ·
  zábradlí m+mass). `weak_seed: true` on TRANSPORT.DELIVERY.MATERIAL; OPENINGS domain gap noted.
  → **54 codes (13 covered / 41 declared) · 22 domains.**

## Gate 2 — Python loader + hermetic tests (DONE 2026-07-14)

- `app/services/uwo_vocabulary.py`: `load_vocabulary()` (lru_cache; unreadable OR
  invariant-violating file → honest-EMPTY + loud log — a broken controlled vocab is never served),
  `validate_vocabulary()` (pure, shared by tests/CI), accessors `get_code` (None, never invented) /
  `is_covered` (coverage contract) / `domain_of`.
- `tests/test_uwo_vocabulary.py` — **39 hermetic tests green**: invariants (incl. negative tests —
  validator FIRES on broken copies, not a rubber stamp) · **market-proofing test** (German
  label/keyword = slot fill, zero violations) · rule-4 trio · falsework m³+STRIP · rough-ins=m ·
  no-VRN · **fixture smoke** (Alexander's process requirement): 27 curated works from
  SO-250/SO-202/VP4 goldens each map to an existing code with a declared domain (honest
  not_covered_branch path guaranteed), corpus spans BOTH coverage states.

## Gate 3 — Coverage harness (DONE 2026-07-14; verdict table = the deliverable)

> Order flipped per Alexander: harness BEFORE retrofit — never bolt the engine to an unverified
> dictionary. Mechanics constraint (ratified): the harness judges by a **hand-curated verdict map**,
> NEVER keyword matching (seed keywords are uncalibrated; token overlap gives false gaps AND false
> hits — the `{patek}` case). The matcher is calibrated BY this corpus later, it is not its own judge.

- Corpus reality: **244 items**, not the historical 138 (full sequential list; ~43 % MEP tail:
  M-ZTI 56 + M-VK 38 + M-UT 12).
- `scripts/uwo_hk212_verdicts.yaml` — hand-curated calibration map, all 244 assigned; sixth verdict
  `needs_decomposition` added for consolidated packs (SPEC Stage-2 split, not a vocab gap).
- `scripts/uwo_hk212_coverage_harness.py` — validates bijection corpus↔map, code-exists +
  domain-declared for exact/keyword verdicts, proposed-code-must-NOT-exist for needs_new_code
  (stale-map guard: after a v1.3 add, the verdict must flip to exact). Exit ≠ 0 only on
  CONSISTENCY errors — gaps are findings, not failures.
- **Result (zero consistency errors):** exact_code 108 · needs_keyword 15 · needs_new_code 86 ·
  needs_decomposition 2 · not_work 33 · not_covered_ok 0. Of 209 real work items: 59 % covered by
  v1.2, 41 % gaps — above the 10–15 % estimate BECAUSE of the MEP/PSV tail; every qualitative
  prediction from the domain review confirmed (nátěry OK, kotvení, klempířina, vrata).
- **30 proposed codes, 2 proposed domains (LANDSCAPING, PAVING)** — aggregated in the report;
  the `dohloubky patek` items verdict to `EARTHWORK.EXCAVATION.PIT` (discrimination case pinned).
- Report: `docs/audits/uwo_vocabulary/2026-07-14_hk212_coverage.md` (per-item table).
- **v1.3 ratified over the table (Alexander) and shipped same day:**
  1. **Supply vs montáž = param `scope`** (`supply | install | supply_install`, default install) —
     rule 4 with a COMMERCIAL second dimension; header **rule 5** documents the boundary (scope on
     every product/material-installing code; pure process works carry none, so «code without
     scope» keeps ONE meaning). SUPPLY code proposals absorbed → their items map to existing
     ERECT/INSTALL with scope=supply. 39 codes carry scope.
  2. **28 new codes** (30 − 2 absorbed SUPPLY) + **2 new domains (LANDSCAPING, PAVING)**;
     `PLUMBING.FIREWATER.HYDRANT` stays under PLUMBING (FIRE_PROTECTION = future domain at the
     PBŘS branch); `ELECTRICAL.LIGHTNING.INSPECT` noted: the montáž pair is a CORPUS gap, not a
     vocabulary gap. One-hit codes kept deliberately — cutting by hits of one corpus = overfitting
     to HK212 (kotvení/pažení/nátěry are every-hall works).
  3. **SCAFFOLDING.SPATIAL trio** (m³ / **m3_day** / m³) — prostorové vs fasádní lešení are two
     physics (volume-fill vs plane-cover), same principle as skruž ≠ bednění; pojízdné/plošina =
     `mobility` param. HSV-9 + M-UT-009 remapped.
  4. 7 keyword fixes → all 15 `needs_keyword` flipped; all 86 `needs_new_code` flipped (stale-map
     guard enforced). **Final table: exact 209 / split 2 / not_work 33 — 100 % of work items
     covered; harness zero errors; 39 hermetic tests green.**
  → **85 codes (13 covered / 72 declared) · 24 domains.**
- ⚠️ **§5.1 ceiling note (Alexander):** 85 codes nears the ~50–100 controlled-vocab limit. The NEXT
  expansion is NOT flat-list growth — it is **domain sublists for LLM choice** (the scope-router
  narrows to a domain → the LLM sees 5–15 codes). Not now, but the ceiling must stay visible.

## Gate 4 — Retrofit: concrete branch emits `vocabulary_code` (DONE 2026-07-14)

Three ratified checks (Alexander GO), all shipped:

1. **Static mapping** — every `WORK_TEMPLATES` atom (breakdown.py) and every malba.yaml atom
   carries an inline `vocabulary_code` (STATIC data, deterministic, never an LLM pick; an
   unmapped atom = vocabulary HOLE → tests fail loudly, file a registration proposal).
   Both emission sites (monolit item + interiér item) forward the field additively.
2. **Coverage-contract closure as an ASSERTION** — `tests/test_uwo_vocabulary_retrofit.py`:
   `set(emitted codes) == set(covered codes)` EXACTLY (13 == 13); honesty pin that
   `FORMWORK.FALSEWORK.STRIP` stays declared and unemitted (retrofit did not "pull it in");
   totality tests over both branches; live `create_work_breakdown` run — every item carries a
   covered code.
3. **Golden byte-stability** — existing atomizer goldens (`test_uwo_atomizer_t1.py`, per-field
   tuples) green untouched alongside. Local run: **55 passed** (retrofit 6 + atomizer + vocab 39).
   MCP compat via CI (local fastmcp blocked by Debian PyJWT — documented blocker); both new test
   files registered in `test-mcp-compatibility.yml` (push paths + PR paths + pytest list).

## Gate 5 — pointer: `create_work_breakdown` split

Blocking defect per SPEC document-to-worklist §9.1 (mixes decompose with catalog/pricing) — own
gate AFTER the vocabulary is consumable; Stage-1 invariant «no code, no price» becomes
server-enforceable only then.

---

## Out of scope (v1)

- DE/ES/FR label filling + adapters (slots exist; filling = data, not schema).
- Deep param schemas (grow with adapters).
- Kiosk UI badges.
- Keyword calibration (seed lists → data-swap from pilots).

## Versioning

| Date | Change |
|---|---|
| 2026-07-14 | Gate 0 recon + Gate 1 vocabulary v1 (47 codes / 22 domains) shipped; Gates 2–5 planned |
| 2026-07-14 | Gate 2 harness + Gate 3 HK212 verdict table (v1.2 → v1.3, 85 codes) + Gate 4 retrofit (coverage contract closed, 13 emitted == 13 covered, test-enforced) |
