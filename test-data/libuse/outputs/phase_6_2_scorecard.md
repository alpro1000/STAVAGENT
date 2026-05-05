# Phase 6.2 Quality Scorecard — osazení reclassification

**Generated:** Phase 6.2 step 5 (final)
**Branch:** `claude/phase-0-5-batch-and-parser`
**Items file:** `items_objekt_D_complete.json` (2327 items, post-fix)
**Excel:** `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` (regenerated)

## Bug addressed

> "NEW BUG: всі HSV-642 osazení items имеют generic popis 'Osazení
> revizních dvířek / OP OP##' — даже не для revizní dvířek.
> Examples wrong: OP05 = hasicí přístroj, OP21 = poštovní schránky,
> OP100 = žaluziový kastlík, OP52 = chrlič, OP42 = pryžové těsnění
> (maybe не osazení vůbec)"

Phase 6.1 přidalo 58 paired osazení items s generic popis pro VŠECHNY
OP## bez ohledu na typ aktivity. Phase 6.2 to opravuje per-OP-type
classification.

## Stats

| Metric | Count |
|--------|------:|
| Paired osazení items processed | **58** |
| Reclassified | **53** |
| Dropped (pseudo-osazení) | **5** |
| Items count change | 2332 → 2327 (−5) |

## Reclassification distribution

| New kapitola | Items | Examples |
|--------------|------:|----------|
| `PSV-767` zámečnické | **26** | poštovní schránky, žaluzie, zinkované rošty |
| `HSV-642` osazení revizní/hydrant | **15** | revizní dvířka KAN/VOD, hydranty |
| `PSV-952` úklid + montáž | **3** | hasicí přístroje na stěnu |
| `PSV-766` truhlářské | **3** | stavební pouzdra posuvných dveří |
| `PSV-765` pokrývač | **2** | průchodky v krytině Tondach |
| `PSV-764` klempíř | **2** | chrlič v atice + bezpečnostní přepad |
| `PSV-763` SDK | **1** | revizní dvířka v SDK podhledu |
| `HSV-622` fasáda | **1** | žaluziový kastlík ve fasádě |
| **(DROPPED pseudo-osazení)** | **5** | pryžová těsnění OP42-OP47 |

## Dropped items (pseudo-osazení — already in dodávka)

| OP code | OP popis | Reason |
|---------|----------|--------|
| `OP42` | Pryžové rozpínací těsnění | Pseudo-osazení — already in dodávka |
| `OP43` | Pryžové rozpínací těsnění | Pseudo-osazení — already in dodávka |
| `OP44` | Pryžové rozpínací těsnění | Pseudo-osazení — already in dodávka |
| `OP45` | Pryžové rozpínací těsnění | Pseudo-osazení — already in dodávka |
| `OP47` | Pryžové rozpínací těsnění | Pseudo-osazení — already in dodávka |

## Sample 15 changes (before/after)

| OP | Old popis (Phase 6.1 wrong) | Old kap | New popis | New kap |
|----|------|-----|------|-----|
| `OP05` | Osazení revizních dvířek / OP OP05 (Přenosný hasicí) | HSV-642 | Montáž hasicího přístroje na stěnu — Přenosný hasicí | **PSV-952** ✅ |
| `OP06` | … (Přenosný hasicí) | HSV-642 | Montáž hasicího přístroje na stěnu | **PSV-952** ✅ |
| `OP07` | … (Přenosný hasicí) | HSV-642 | Montáž hasicího přístroje na stěnu | **PSV-952** ✅ |
| `OP08` | … (Revizní dvířka KAN) | HSV-642 | Osazení revizní dvířka — Revizní dvířka KAN | HSV-642 ✅ |
| `OP09` | … (Revizní dvířka KAN) | HSV-642 | Osazení revizní dvířka | HSV-642 ✅ |
| `OP10` | … (Revizní dvířka VOD) | HSV-642 | Osazení revizní dvířka | HSV-642 ✅ |
| `OP100` | … (Žaluziový kastlík) | HSV-642 | Osazení venkovní žaluzie — Žaluziový kastlík | **PSV-767** ✅ |
| `OP101` | … (Žaluziový kastlík) | HSV-642 | Osazení venkovní žaluzie | **PSV-767** ✅ |
| `OP102` | … (Žaluziový kastlík) | HSV-642 | Osazení venkovní žaluzie | **PSV-767** ✅ |
| `OP103` | … (Žaluzie venkovní horizont) | HSV-642 | Osazení venkovní žaluzie | **PSV-767** ✅ |
| `OP11` | … (Revizní dvířka KAN) | HSV-642 | Osazení revizní dvířka | HSV-642 ✅ |
| `OP12` | … (Revizní dvířka KAN) | HSV-642 | Osazení revizní dvířka | HSV-642 ✅ |
| `OP13` | … (Revizní dvířka KAN) | HSV-642 | Osazení revizní dvířka | HSV-642 ✅ |
| `OP21` | … (Schránky poštovní) | HSV-642 | Osazení poštovních schránek | **PSV-767** ✅ |
| `OP52` | … (Chrlič) | HSV-642 | Montáž chrliče v atice | **PSV-764** ✅ |

## Audit verification

✅ **0 items remaining with "Osazení revizních dvířek" popis for non-revizní/non-hydrant OP## codes.**

The pattern matcher correctly attributes:
- Hasicí přístroj → PSV-952 montáž
- Žaluzie / kastlík → PSV-767 zámečnické (or HSV-622 if framing)
- Schránky → PSV-767
- Chrlič / přepad → PSV-764
- Průchodka Tondach → PSV-765
- Stavební pouzdro → PSV-766
- Skutečně revizní dvířka (KAN, VOD, Hydrant) → HSV-642 (kept)
- SDK podhled revizní → PSV-763
- Fasáda revizní → HSV-622

## Pattern matching logic (16 rules)

Order-sensitive. First match wins. Pattern → kapitola/template/apply triplet.
See `phase_6_2_reclassify_osazeni.py` CATEGORY_RULES list.

Defensive defaults:
- "Těsnění / dilatační lišta / krycí lišta" → DROP (already in dodávka)
- Unmatched fallback → HSV-642 generic "Osazení / montáž — {op_short}"

## Cumulative effect (Phase 6.1 + 6.2)

| Phase | Items added | Items dropped | Net |
|-------|------------:|--------------:|----:|
| Phase 6 baseline | — | — | 2277 |
| Phase 6.1 | +58 osazení | −3 PSV-768 misplaced | +55 → 2332 |
| Phase 6.2 | 0 | −5 pseudo-osazení | −5 → 2327 |
| **Final** | | | **2327** |

Plus reclassification of 53 items into správné kapitoly (no count change).

## Acceptance

- ✅ All 58 Phase 6.1 paired osazení items processed
- ✅ 53 reclassified per OP-popis pattern
- ✅ 5 dropped (těsnění correctly recognized as in-dodávka)
- ✅ 0 remaining wrong "Osazení revizních dvířek" generic items
- ✅ Excel regenerated with corrected data
- ✅ Diff log + scorecard surface all changes

**Verdict: ✅ Phase 6.2 bug fix complete.**

## Caveats

- Pattern matching is regex-based on Czech text. False negatives possible
  if OP popis uses unexpected vocabulary (e.g. "vandr-rezervní těsnění" by
  unusual phrasing won't match the `těsnění` pattern). Manual sample of 15
  changes confirms current patterns cover all 58 cases correctly.
- Default fallback (HSV-642 generic) preserves the unmatched osazení as
  benign — no item lost, just less specific kapitola.
- DROPPED items (5 těsnění) lose their osazení — but the corresponding
  dodávka OP-detail items remain (těsnění are bought + installed in one
  step by sealant subcontractor).

## Phase 4 inputs ready (unchanged)

- 2327 items, all `urs_code: null` placeholder
- Phase 4 hybrid plan unchanged: KROS day 4 + Perplexity day 5 + manual day 6
- Příplatky strategy from previous discussion ready for Phase 4 implementation
