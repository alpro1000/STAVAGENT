# Universal Work Decomposer (UWO) — Tasks (vocab v1 increment)

> **Spec ID:** `universal-work-decomposer` (axis-A canon per ADR-009 D3)
> **Status:** Gate 0–2 DONE (2026-07-14, vocab v1.2 post domain-review) · Gate 3+ pending
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

## Gate 3 — Coverage harness (BEFORE retrofit — order flipped per Alexander 2026-07-14)

> The hall/interiér tiers were derived from registry references and the sandbox, NOT from the
> HK212 corpus itself (READ-denied). Bolting the engine to an unverified dictionary is backwards —
> the harness validates the vocabulary FIRST; the retrofit consumes a verified one.

- CI-side script (not by-eye) classifies each HK212 Stage-1 item to a v1 code or an explicit flag;
  acceptance = 100 % coded-or-flagged, 0 silently dropped. Findings → vocabulary v1.2 data-fix.
- Unit: `dohloubky patek` → `EARTHWORK.EXCAVATION.*`, never `FORMWORK.*` (the token-overlap case
  from SPEC §5.1).

## Gate 4 — Retrofit: concrete branch emits `vocabulary_code` (AFTER the harness)

- Every atom the decomposition tool emits carries `vocabulary_code` (additive field per SPEC §6.3).
- Existing goldens byte-stable except the added field; MCP compat suite green
  (response shape gains an optional field → CHECK NEEDED per root CLAUDE.md rules).
- Interiér branch atoms (malba) get codes from the same vocabulary.

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
