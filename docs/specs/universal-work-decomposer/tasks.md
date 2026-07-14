# Universal Work Decomposer (UWO) — Tasks (vocab v1 increment)

> **Spec ID:** `universal-work-decomposer` (axis-A canon per ADR-009 D3)
> **Status:** Gate 0–1 DONE (2026-07-14) · Gate 2+ pending
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
| HK212 Stage-1 corpus (Pattern 15/16 registry; items under `test-data/` READ-deny → coverage check is a CI-side script, not by-eye) | Tier-2 hall domains: zemní, ocel montáž, opláštění (Kingspan), střecha, lešení, přesun hmot, doprava/suť |
| interiér branch: `interier_psv/malba.yaml` (shipped MVP) + `sandbox/uwo-interier-mezonet/src/templates.mjs` S1–S10 | Tier-2 interiér: demontáže, štuk/perlinka/malba, SDK, hydroizolace, obklad/dlažba, vinyl/parkety, ZTI, elektro+revize, kotel/spalinová cesta, okna/dveře, VRN |

Recon insight folded into the schema: **Eurocode params are market-neutral by EN-unification**
(C30/37 = C30/37, B500B, Y1860, IPE 400) → only NATIONAL-scheme params need the `{market, scheme,
value}` shape (`soil_class`, `surface_class`, `curing_class`, `inspection_regime`).

## Gate 1 — Vocabulary v1 DATA (DONE 2026-07-14)

`app/knowledge_base/B5_tech_cards/technological_postupy/uwo_vocabulary.yaml`
— sibling of the branch templates that consume it (breakdown.py already loads from this tree;
`element_rules/` is the classifier axis, deliberately not overloaded).

- **47 codes · 22 domains** (deep 4 / working 15 / declared 3: MASONRY, INSULATION, LOW_VOLTAGE).
- Schema: `label`/`keywords` = lang maps (cs filled, de/es empty slots) · `unit_canonical` ∈
  m|m2|m3|t|ks|kpl|h · `params[].kind` ∈ scalar | eurocode_class | market_scheme · `coverage` ∈
  covered | declared.
- Registration rule in header: inventing a code is FORBIDDEN — unknown work → registration proposal
  (human approval = PR), per SPEC document-to-worklist §6.3.
- Hermetic YAML invariant check ran green at authoring (lang-map keys, unit whitelist, unique codes,
  param kinds).

## Gate 2 — Python loader + invariant tests (NEXT)

- Loader beside the existing branch-template loader in the decomposition tool module (lazy, cached,
  honest-empty on malformed file — mirror `_load_interier_psv_templates`).
- Hermetic pytest: the invariant set from Gate 1 (lang-map shape, unit whitelist, unique codes,
  param kinds, declared domains carry no covered codes) + the **market-proofing test**: injecting a
  `de` label into a fixture copy passes schema unchanged.
- No consumer change yet (additive).

## Gate 3 — Retrofit: concrete branch emits `vocabulary_code`

- Every atom the decomposition tool emits carries `vocabulary_code` (additive field per SPEC §6.3).
- Existing goldens byte-stable except the added field; MCP compat suite green
  (response shape gains an optional field → CHECK NEEDED per root CLAUDE.md rules).
- Interiér branch atoms (malba) get codes from the same vocabulary.

## Gate 4 — Coverage harness (HK212 + discrimination case)

- CI-side script (not by-eye — corpus is READ-denied to agents) classifies each HK212 Stage-1 item
  to a v1 code or an explicit flag; acceptance = 100 % coded-or-flagged, 0 silently dropped.
- Unit: `dohloubky patek` → `EARTHWORK.EXCAVATION.*`, never `FORMWORK.*` (the token-overlap case
  from SPEC §5.1).

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
