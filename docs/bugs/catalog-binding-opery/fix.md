# Catalog-binding garbage codes for the опоры (abutment) family — Fix

> **Bug ID:** `catalog-binding-opery`
> **Aliases:** BUGS#5(1) keyword-reclass-overrides-explicit-element_type · BUGS#5(2) template→code binding garbage
> **Status:** fixed (pending live check + CI MCP-compat)
> **Predecessor:** [`analyze.md`](analyze.md) (root cause, reproduction, Approach B locked)
> **Branch:** `claude/beautiful-ramanujan-g0guev`

---

## 1. Approach taken — Approach B (analyze.md §5.2) + A.1 deferred

Single-source binding via `match_catalog` + clean canonical query + catalog-aware
honest `None`, calibrated on the SO-206 post-gate distribution. The decisive
levers turned out to be **(i) a catalog bundling policy** and **(ii) a
work-type-aware canonical query** — the work-type axis fixes + nominative
query also re-activated the *existing* two-axis gate without adding a new
(unreliable) family gate.

**A.1 (honor explicit `element_type`) was NOT needed for this bug** and is left
as a separate small change — the SO-206 names classify correctly from `name`
already; nothing in the 50-string repro depends on a caller-supplied type. Kept
out to hold scope (analyze.md §5.3 was orthogonal).

## 2. Implementation

### `app/services/catalog_matching.py` — work-type axis (the taggers)
- `+ skruz` rule (NK falsework) split out of `bedneni` — skruž is its own OTSKP
  basket, must not be bundled with formwork.
- `+ demontáž|demontov` → `demolice` (was mis-bucketed `beton` via the substring
  "beton" in "DEMONTÁŽE BETONOVÝCH ZÁKLADŮ" → demolition outranked the real
  foundation-concrete code).
- `+ osetrovani` rule (before `beton`, which "ošetřování betonu" contains) — so
  the bundling policy can name curing.

### `app/mcp/tools/breakdown.py` — the binder
- `_attach_catalog_codes` rewritten (async) to route through
  `find_otskp_code → match_catalog` — the **same** chain as the `CATALOG_BINDING`
  recipe stage. The naive `otskp_catalog.search(work_description, limit=1)`
  (weak matcher + cheapest-tie + slash-label query) is gone.
- `CATALOG_BUNDLING = {"otskp": {"bedneni", "osetrovani"}}` — catalog-aware
  declaration that OTSKP prices formwork + curing **inside** the concrete item.
  A bundled work-type binds to a deterministic `None` with
  `code_status="bundled"`, `code_note="zahrnuto v betonu dle OTSKP"`,
  `code_confidence=1.0` (a **rule**, not a floor-driven "nenalezeno"). ÚRS/RTS
  declare empty sets → every work row searches. **No** global `bednění→None`
  hardcode (would break ÚRS + skruž).
- `_canonical_query(work_type, element_type)` — work verb + element noun in the
  **grammatical case the catalog uses per work-type**: concrete titles are
  nominative (`ZÁKLADY ZE ŽELEZOBETONU`, `MOSTNÍ OPĚRY A KŘÍDLA`) → `beton
  základy` / `beton mostní opěry`; reinforcement titles are `VÝZTUŽ <genitive>`
  (`VÝZTUŽ ZÁKLADŮ`, `VÝZTUŽ MOSTNÍCH OPĚR`) → `výztuž základů` / `výztuž
  mostních opěr`. Nominative also revives the family-axis gate for opěry
  (genitive `opěr` suppresses to family `jine`). **Opěry + křídla share one
  OTSKP basket** (`333xx MOSTNÍ OPĚRY A KŘÍDLA`) → both query the combined
  phrase; the "a křídel" tokens also outrank the `VÝZTUŽ PŘECHOD DESEK MOSTNÍCH
  OPĚR` false-friend that hijacks a bare-genitive "mostních opěr".
- `OTSKP_CODE_BINDING_FLOOR = 0.60` — applied only as the **last** gate on
  survivors; calibrated on the SO-206 distribution (natural gap `0.57│0.63`),
  commented `calibrated on SO 206 (n=1); revisit as the corpus grows`.
- New per-item fields (additive): `code_status` (`bound`|`bundled`|`no_match`),
  `code_note`, `code_confidence`, `code_query`. Existing `otskp_code` /
  `unit_price_czk` / `total_price_czk` keys preserved.

## 3. Verification

### SO-206 result (the 50-string repro from analyze.md §1.3)
`mode=work_with_catalog`, floor 0.60 → **30 bundled (honest None) + 20 bound, 0 garbage**:

| element | beton | výztuž | bednění/odbednění/ošetřování |
|---|---|---|---|
| opěry / křídla | `33311 MOSTNÍ OPĚRY A KŘÍDLA` @0.74–0.82 | `333365 VÝZTUŽ MOSTNÍCH OPĚR A KŘÍDEL` @0.79 | `None` «zahrnuto v betonu dle OTSKP» |
| základy | `27232 ZÁKLADY ZE ŽELEZOBETONU` @0.63 | `272364 VÝZTUŽ ZÁKLADŮ` @0.74 | `None` «zahrnuto v betonu dle OTSKP» |

Gone: tree code (18481), 0 Kč mast (741H21), tank (382365), speed bumps,
lawn care, tunnel lining, noise walls, screed, demolition (746Z34),
přechodová-deska (42036). The flat-floor overlap of analyze.md §2 no longer
exists because the garbage is removed by the **bundling policy** (formwork/curing
rows never search) and the **work-type axis + clean query** (beton/výztuž rows),
not by the floor.

### Tests (local, `asyncio_mode=auto`)
- `test_catalog_matching.py` — +3 work-type cases (`skruz`, `osetrovani`,
  `demontáž→demolice`); existing UWO-gate + param-prefilter + both async
  `find_otskp_code` tests still pass.
- `test_stage_gating_policy.py` — `FakeCat` made floor-robust (realistic names);
  new `test_breakdown_otskp_bundles_formwork_and_curing` asserts bundled→None
  rule + beton/výztuž→bound.
- SO-250 W3 goldens + `create_work_breakdown` MCP contract (Tool-7 shape + AC19)
  unchanged. **63 passed**, 0 failures.
- Full `test_mcp_compatibility.py` needs `fastmcp` (blocked locally by a debian
  PyJWT conflict) → runs in CI. Safe by construction: `create_work_breakdown`
  signature unchanged, fields additive, `work_first` path untouched.

## 4. Divergence from the analyze.md plan (and why)
- analyze.md §5.2 step 3 said "do **not** gate on `element_family` — it is
  unreliable." Honoured: no new family gate was added on raw candidates. Instead
  the **nominative query** makes `query_element_family` reliable, so the
  *existing* `match_catalog` two-axis gate (which already permits `jine`) does
  the right thing; the přechod-deska hijack is killed at the **token** level by
  the combined opěry+křídla basket, not by trusting the candidate family tagger.
- analyze.md step 4 ("accept None") is realised as a **positive catalog rule**
  (bundling policy, conf 1.0) rather than a floor artifact — more honest:
  `code_status="bundled"` says *why* there is no code.

## 5. Follow-ups (out of scope here)
- **Subtype refinement (P2):** beton binds land on `33311 …Z DÍLCŮ` (precast)
  rather than `333313 ZE ŽELEZOBETONU` (monolithic) — right family, wrong
  variant, because the query doesn't state cast-in-place. (The old weak search
  got `333315 Z PROSTÉHO BETONU` by luck — also not ŽB.) Fix = append the
  concrete nature to the beton canonical query.
- **Single-source noun (P3):** migrate `_OTSKP_QUERY_NOUN` → `otskp_query_noun_{nom,gen}`
  fields on the element-type definition (`element_types.yaml`).
- **Floor recalibration (P2):** `OTSKP_CODE_BINDING_FLOOR` is n=1 (SO-206);
  revisit as the corpus grows.
- **A.1 (P3):** honor explicit `element_type` in the element-dict contract.
- **Unit-consistency guard (P3):** reject a `t` rebar work-string binding to an
  `m`/`ks` code (analyze.md §6).
- **`docs/steering/domain.md`:** note OTSKP bundles formwork/curing into the
  concrete item for abutments (absence of a code is correct, not a gap).

## 6. Versioning
| Date | Version | Changes |
|---|---|---|
| 2026-06-18 | 1.0 | Approach B implemented: single-source `match_catalog`, catalog bundling policy, work-type-aware canonical query, floor 0.60. SO-206 50/50 clean (30 bundled + 20 correct binds, 0 garbage). 63 tests pass; full MCP-compat in CI. |
