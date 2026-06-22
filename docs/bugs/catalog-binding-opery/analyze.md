# Catalog-binding garbage codes for the опоры (abutment) family — Analyze

> **Bug ID:** `catalog-binding-opery`
> **Aliases:** BUGS#5(1) keyword-reclass-overrides-explicit-element_type · BUGS#5(2) template→code binding garbage
> **Status:** analyzed
> **Owner:** Claude Code session / Alexander
> **Prerequisites:** reproduced live on SO 206 element names (see §1.3)
> **Scope discipline:** READ-ONLY audit. No production code touched. Fix (`fix.md`) is pending Alexander's go-ahead on the revised scope flagged in §5.

---

## 1. Audit findings

### 1.1 Files examined

- `app/mcp/tools/breakdown.py` — `create_work_breakdown` + `_attach_catalog_codes` + `WORK_TEMPLATES`
- `app/mcp/tools/otskp.py` — `find_otskp_code` (good chain) + `_InMemoryOTSKP.search` (weak search) + `_get_catalog`
- `app/pricing/otskp_engine.py` — `OTSKPDatabase.search` (prod SQLite path)
- `app/mcp/tools/classifier.py` — `_classify` (the BUGS#5(3) single-source path) + `ELEMENT_TYPES` (`label_cs`)
- `app/services/stage_gating/workflow_definitions.yaml` + `recipe_runner.py` — how the recipe binds codes
- `app/services/catalog_matching.py` — `retrieve_candidates` + `match_catalog` (Work-First chain, reused by `find_otskp_code`)

### 1.2 Existing tests in scope

- `tests/test_mcp_compatibility.py` — MCP wrapper contract (does NOT assert binding correctness)
- No test asserts that `create_work_breakdown` codes are work-type-correct, nor that low-quality matches resolve to a blank code.

### 1.3 Reproduction (SO 206 element names supplied by Alexander)

Input names (the exact `create_work_breakdown` call): 4× `Dřík opěry O{1,2} {levý|pravý} (rámová stojka)`, 4× `Křídlo opěry č.{1..4}`, `Základ opěry pod dříky (pasy)`, `Základ opěry pod křídly (pasy)` → 10 elements → **50 work-strings** (default template ×5).

**Weak inline binding** (`_attach_catalog_codes` → `catalog.search(work_description, limit=1)`), top-1:

| work_description | code | catalog name | verdict |
|---|---|---|---|
| `Bednění Opěry / úložné prahy` | **18481** | OCHRANA STROMŮ BEDNĚNÍM | 🌳 tree code |
| `Výztuž Opěry / úložné prahy…` | 382365 | VÝZTUŽ … NÁDRŽÍ | tank (wrong) |
| `Beton Opěry / úložné prahy C30/37` | 333315 | MOSTNÍ OPĚRY A KŘÍDLA Z PROSTÉHO BETONU | ~ok (plain concrete) |
| `Beton Základy pilířů / patky C30/37` | **272315** | ZÁKLADY Z PROSTÉHO BETONU | ✓ the "nearly-right" code Alexander saw |
| `Bednění Základy pilířů / patky` | 741H21 | TELESKOPICKÝ JÍMACÍ STOŽÁR (0 Kč) | mast — cheapest-tie-break junk |

Reproduces the tree code (18481) **and** the 272315 from the report exactly.

---

## 2. Root cause

Two independent defects that **compound**:

### Bug A — explicit `element_type` is silently discarded; type is always re-derived from `name`
`breakdown.py:173` calls `_classify(name, …)` **unconditionally**. The element-dict contract (docstring lines 104-114) has **no `element_type` field**, so a caller-supplied type (e.g. `driky_piliru`) is never read. The work item's type — and therefore its `label_cs` and work-strings — is whatever the **name** classifies to.
- `Dřík opěry …` → `opery_ulozne_prahy` (genitive-`opěr` routing: shaft *of the abutment* → abutment family). This is **by-design** in the `_classify`/normalizer path, **not** an inherited BUGS#5(3) regression (`Dřík pilíře → driky_piliru` ✓). Per Alexander: leave genitive-routing as-is; the `Dřík opěry` vs `Dřík pilíře` distinction is a **separate gate #7**, out of scope here.
- `Křídlo opěry` → `kridla_opery` ✓ (does **not** collapse in current state — differs from the original report recollection).

### Bug B — the catalog binding is a stale, weak, label-poisoned top-1 search
`breakdown.py:69` binds via `otskp_catalog.search(work_description, limit=1)`:
1. **Weak matcher.** `search()` scores `matched_words / total_words` and **breaks ties by cheapest price** (`otskp.py:124` in-memory; `otskp_engine.py:104` SQLite = `WHERE nazev LIKE ? ORDER BY cena`). No work-type / element-family gate. → "Bednění…" hits `OCHRANA STROMŮ BEDNĚNÍM`; "Bednění Základy…" grabs a **0 Kč mast** on the cheapest-tie.
2. **Two matchers, not one.** `find_otskp_code` was hardened in Phase 1 to the Work-First chain `retrieve_candidates → match_catalog` (work-type/family signals, honest confidence, embeddings). `_attach_catalog_codes` was **left on the old raw search** — exactly the duplicate-matcher anti-pattern BUGS#5(3) removed for the classifier.
3. **Query poisoned by `label_cs`.** Work-strings are built from `tmpl["work"].format(element=profile["label_cs"])` (`breakdown.py:198-201`). The display labels are slash-joined (`Opěry / úložné prahy`, `Základy pilířů / patky`). The token **"prahy"** pulls in `ZPOMALOVACÍ PRAHY` (speed bumps); the correct `333365 VÝZTUŽ MOSTNÍCH OPĚR A KŘÍDEL` is **not even retrieved**. The clean term `výztuž opěr` *does* retrieve it. → query construction is an upstream root cause, independent of the matcher.

### Scope finding — the recipe is safe; the direct MCP call is the live breakage
`workflow_definitions.yaml:40` runs `create_work_breakdown` in `work_first` (no codes) and `:48` binds via `find_otskp_code` (good chain). So the **internal recipe never hits the tree codes.** They surface only on a **direct external call with `mode=work_with_catalog`** — which the docstring advertises as returning codes+prices, and which external MCP callers use.

### The decisive data (why a flat confidence floor is NOT the fix)

Routing the same 50 work-strings through `match_catalog` (the proposed single source) — confidence distribution:

```
0.0-0.1: ##### (5)        ← Odbednění * → no candidates (None)
0.5-0.6: ############################## (30)
0.6-0.7: ############### (15)
>=0.4: 45   <0.4: 5
```

Garbage and correct codes **overlap** in 0.55–0.71 — no flat threshold separates them:

| conf | code | catalog name | for work-string | verdict |
|---|---|---|---|---|
| 0.55 | 91797 | ZPOMALOVACÍ PRAHY Z PLASTŮ | Výztuž Opěry / úložné prahy | speed bumps ✗ |
| 0.57 | 18247 | OŠETŘOVÁNÍ TRÁVNÍKU | Ošetřování betonu … | lawn care ✗ |
| 0.56 | 36135 | BEDNĚNÍ PRIMÁRNÍHO OSTĚNÍ ŠTOL | Bednění … | tunnel lining ✗ |
| 0.65 | 347125 | STĚNY PROTIHLUKOVÉ | Beton Křídla opěry | noise walls ✗ |
| 0.67 | 631365 | VÝZTUŽ MAZANIN | Výztuž Křídla opěry | screed reinf ✗ |
| 0.68 | 334365 | VÝZTUŽ MOSTNÍCH PILÍŘŮ | Výztuž Základy pilířů | ✓ |
| 0.69 | 333315 | MOSTNÍ OPĚRY A KŘÍDLA | Beton Opěry / úložné prahy | ✓ |

Deeper-list probe (top-6) exposed the rest:
- `element_family` alignment is **unreliable** — speed bumps were tagged `fam=opery_ulozne_prahy` (the family detector also keys on "prahy").
- For several rows the **correct code is not retrieved at all** (label poisoning), and for `bednění`/`odbednění`/`ošetřování` of abutment sub-parts **OTSKP has no separate line** (formwork & curing are bundled into the concrete item) → the honest result is **`None`**, not a forced match.

---

## 3. Why it wasn't caught earlier

- [x] Missing unit test — no assertion that binding is work-type-correct or that a low-quality match blanks the code.
- [x] Design gap — when `find_otskp_code` was upgraded to `match_catalog` (Phase 1), the inline `_attach_catalog_codes` was not migrated (duplicate-matcher debt).
- [x] Recipe-only QA — the internal recipe path is `work_first` + `find_otskp_code`, so it looked correct; the `mode=work_with_catalog` direct-call surface was untested.
- [x] Query-construction blind spot — nobody verified that the slash display-label is a sane search query.

---

## 4. Confidence level in root cause

- [x] **High** — both bugs reproduced deterministically on the supplied SO 206 names; the data (§2) directly contradicts the flat-floor hypothesis and explains every garbage code.

---

## 5. Possible fix approaches

> Decisions already locked by Alexander: (B) single-source binding via `match_catalog`; (A.1) honor explicit `element_type`, name = fallback; (A.2) genitive-routing stays, `Dřík opěry/pilíře` split → separate gate #7. **The data forces an addition to (B)**, flagged below for go-ahead.

### 5.1 Approach A — single-source via `match_catalog` + flat conf floor (the literal initial plan)
- **Pros:** kills the duplicate matcher and the cheapest-tie absurdities (tree code, 0 Kč mast).
- **Cons:** **insufficient — proven by §2 data.** Speed bumps (0.55), lawn care (0.57), noise walls (0.65), screed (0.67) survive any floor low enough to keep the correct 0.68–0.69 codes. Ships garbage with a "low-confidence" label = the tree code wearing a hat.
- **Effort:** small, but does not actually fix the bug.

### 5.2 Approach B — single-source `match_catalog` + work-type gate + clean query + honest `None` (recommended)
1. Route `work_with_catalog` through `match_catalog` (single source) — as instructed.
2. **Build the binding query from a clean canonical term** (work-type verb + canonical element noun, e.g. `výztuž opěr`, `beton mostních opěr`), **not** the slash `label_cs`. This is what actually retrieves the correct codes.
3. **Work-type alignment gate:** drop candidates whose `work_type` ≠ query `work_type`; in particular drop `ostatni` when the query is `beton`/`vyztuz`/`bedneni`. (Kills speed bumps + lawn care, which are `ostatni`.) Do **not** gate on `element_family` — it is unreliable (§2).
4. **Accept `None` (honest-blank) as a valid result** for rows OTSKP doesn't itemize (`bednění`/`odbednění`/`ošetřování` of abutment sub-parts). Never force a match.
5. Apply a confidence floor only as the **last** gate on the survivors — set from the post-gate distribution, not as the primary discriminator.
- **Pros:** addresses all three data findings; produces correct codes where they exist (`333315`, `334365`, `333365`) and honest blanks where they don't.
- **Cons:** larger than "route + floor"; touches query construction in `breakdown.py` and adds a gate in/around the binding step.
- **Effort:** medium.

### 5.3 A.1 (orthogonal, agreed) — honor explicit `element_type`
Add `element_type` to the element-dict contract; when present and valid, use it and skip name re-derivation (`_classify` becomes the fallback). Small, isolated.

### 5.4 Doporučení
**Approach B + 5.3.** Approach A is documented only to record *why* the flat floor was rejected on data. **Open scope question for Alexander before `fix.md`:** is the work-type gate + clean-query construction (steps 2–4) in scope now, or do we ship 5.3 + step 1 + a strict "blank-unless-strong" rule first and open a follow-up for the gate?

---

## 6. Related risks

- Every other element family routed through `_attach_catalog_codes` has the same weak binding — опоры is just the loudest (the `prahy`/`ošetřování` collisions). Pilíře/základy partly "work" by luck of vocabulary.
- `mostovkova_deska`, `rimsa`, `pilota` templates emit їх own work-strings from `label_cs` → same query-poisoning risk.
- `MJ`/unit mismatch is unchecked — a `t` rebar work-string can bind to an `m`/`ks` code; a unit-consistency check is a natural sibling guard.
- Cheapest-price tie-break (`otskp_engine.py:104` `ORDER BY cena`) actively prefers 0 Kč placeholder codes anywhere the raw `search()` is used.

---

## 7. Affected steering / specs

- [ ] `docs/steering/domain.md` — note that OTSKP bundles formwork/curing into the concrete item for abutments; absence of a code is correct, not a gap.
- [x] Pattern 15 (Work-First, Catalog-Last) reinforced: catalog binding is one stage with one matcher; `mode=work_with_catalog` must use the same `match_catalog` chain as the `CATALOG_BINDING` recipe stage.
- [ ] `docs/bugs/catalog-binding-opery/fix.md` — to be written after scope sign-off.

---

## 8. Confidence rule check (STAVAGENT-specific)

- [x] **Related (not a classic fusion inversion).** Forcing a 0.55 speed-bump code is overwriting an honest "no real match" with a fabricated answer — the same spirit as "high confidence nepřepisuje nízký". Honest-blank `None` (Approach B step 4) is the correct discipline; a code must be earned by a work-type-aligned, sufficiently-confident match.

---

## 9. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-06-18 | 0.1 | Initial analysis — both bugs reproduced on SO 206; 50-string conf distribution; flat-floor rejected on data; Approach B recommended. No code touched. |
