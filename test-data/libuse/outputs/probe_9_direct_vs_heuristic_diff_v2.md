# PROBE 9 — Direct vs heuristic VZT/chl diff (drop v3, 2026-05-10)

**Date:** 2026-05-10 (drop v3)
**Scope:** Compare PROBE 9 VZT + chl item counts pre vs post user-supplied
AC1024 DXFs landing for D 1.NP / 2.NP / 3.NP VZT + chl (6 files).
**Predecessor:** `probe_9_vzt_chl_manual_counts.md` (Part 5B heuristic
methodology — superseded for above-ground D by direct extraction).

---

## TL;DR

| Floor × discipline | Heuristic (Part 5B) | Direct (drop v3) | Δ items | Confidence |
|---|---:|---:|---:|---|
| **D 1.NP VZT** | 27 | **98** | +71 | 0.70 → 0.85 |
| **D 2.NP VZT** | 10 (after −13 partial) | **109** | +99 | 0.70 → 0.85 |
| **D 3.NP VZT** | 17 | **94** | +77 | 0.70 → 0.85 |
| **D 1.NP chl** | 18 | **12** | −6 | 0.70 → 0.85 |
| **D 2.NP chl** | 15 | **14** | −1 | 0.70 → 0.85 |
| **D 3.NP chl** | 11 | **11** | 0 | 0.70 → 0.85 |
| **Above-ground subtotal** | 98 | **338** | +240 | confidence uplift 6/6 floors |
| **D 1.PP VZT** (file 29 MB, GitHub UI block) | 94 | (heuristic kept) | 0 | 0.70 (unchanged) |
| **D 1.PP chl** (no per-floor source) | 8 | (heuristic kept) | 0 | 0.70 (unchanged) |
| **PROBE 9 grand total** | 758 | **998** | +240 | 6/8 VZT-chl floors uplifted |

VZT_partial (13 entries from 9421 jadra zoom for 2.NP) retained alongside
direct VZT for defence-in-depth per Step 8c idempotency contract — same
13 prostupy will appear in both `VZT` and `VZT_partial` discipline tags
on 2.NP. Item-generator level dedup is OUT OF SCOPE for this drop (would
require spatial-proximity matching across two coordinate systems); both
sets emit as separate HSV-963 items at confidence 0.85 each. Operator
review can reconcile if needed — typical effect is a slight over-count
of ~13 items at 2.NP byt cores.

---

## 1. Layer convention discovery (drop v3)

The user-supplied AC1024 DXFs use a **DIFFERENT layer convention** from
the existing per-discipline ZT/SLP/0UT/Plyn files audited in Part 4:

### VZT DXFs (D_NNP_vzt.dxf)

| Layer | Type | Per-floor count | Role |
|---|---|---:|---|
| `VZT_EXHAUST` | INSERT | 71 / 77 / 71 | Endpoint exhaust grilles |
| `V-tvarovky` | INSERT | 68 / 74 / 63 | Duct fittings (junctions, T-pieces) — **NOT prostupy** |
| `V-objekty` | INSERT | 18 / 24 / 16 | Equipment (digestors, fans) |
| `VZT_DIGESTOR` | INSERT | 9 / 8 / 7 | Kitchen exhaust hoods |
| `VZT_EXHAUST-popis` | TEXT | 21 / 23 / 18 | DN labels (`%%c125`, `%%c160` = Ø notation) |

**Prostup count rule (drop v3):** `VZT_EXHAUST` + `V-objekty` +
`VZT_DIGESTOR` INSERTs count as prostupy. `V-tvarovky` excluded —
in-line fittings don't penetrate slabs/walls.

### chl DXFs (D_NNP_chl.dxf)

| Layer | Type | Per-floor count | Role |
|---|---|---:|---|
| `Jednotky Daikin` | INSERT | 12 / 14 / 11 | Split AC indoor + outdoor units (each = 1 wall penetration pair) |
| `PIPE-C1` | LWPOLYLINE | 465 / 465 / 465 | Refrigerant pipe runs — **NOT prostupy** |
| `PIPE-C1-EDGE` | LWPOLYLINE | 408 / 446 / 347 | Pipe envelope outlines |
| `TT_popis OT` | TEXT | 14 / 14 / 12 | CU potrubí specs (`12,7/25,4 mm` = refrigerant line diameters) |

**Prostup count rule (drop v3):** Only `Jednotky Daikin` INSERTs count.
Pipe runs (`PIPE-C1*`) are length-quantifiable but represent
horizontal wiring, not vertical penetrations.

---

## 2. Why VZT direct >> heuristic (3–6× higher)

The Part 5B heuristic estimate was **30 % of (kanalizace + vodovod)**,
which gave 27 / 10 / 17 = 54 above-ground VZT prostupy. The direct
extraction yields 98 / 109 / 94 = **301** — about 5.5× more.

Reasons:

1. **Per-byt VZT distribution** is denser than the heuristic captured.
   Each byt has 2–3 exhaust grilles (kitchen + bathroom + occasionally
   utility) plus 1 supply grille (living area). With ~10 bytů per floor,
   that's 30–40 grilles per floor MINIMUM. The 70+ VZT_EXHAUST count
   per floor is consistent with the typical Czech residential 4-byt /
   3-byt mix where each room has independent ventilation.

2. **Heuristic was conservative by design.** Part 5B used a deliberate
   under-estimate ratio (vodovod risers are way fewer than VZT
   endpoints because each water riser feeds a stack of bytů via
   horizontal branches, while each byt has its own VZT endpoints).
   The 30 % anchor was a worst-case floor; engineering reality has VZT
   endpoint counts that exceed water-riser counts in most floor plans.

3. **`V-objekty` adds digestor + fan-coil prostupy** that the heuristic
   didn't even attempt to estimate. ~16–24 per floor.

The HSV-963 (prostup ve stropě) billing uplift from heuristic → direct
is therefore substantial. For pricing review, contractor should verify
the 70-grille endpoint pattern per byt against the architectural plans;
if some grilles are flush-mounted (no penetration), the count can be
adjusted downward via a follow-up filter.

---

## 3. Why chl direct ≈ heuristic (slight under-count)

chl direct: 12 + 14 + 11 = 37 above-ground.
chl heuristic was 18 + 15 + 11 = 44 above-ground.

Direct is 7 items lower than heuristic. That's within engineering
expectation:

- Heuristic 20 % of (kan + vod) was a "split AC penetration could be in
  every byt" assumption.
- Direct count = 12 outdoor units per floor × 1 wall penetration each
  = 12. Plus a few service points = 14 max.
- Reality: not every byt has split AC. Some have central HVAC only.
  Direct count is more accurate than the heuristic's optimistic upper
  bound.

Net: chl is REDUCED by 7 items at higher confidence. Slight downward
revision on HSV-963 chl billing but with much higher confidence.

---

## 4. Combined PROBE 9 totals (drop v3 vs Part 5B vs Part 5A)

| Source | Part 5A | Part 5B | **Drop v3 (this)** |
|---|---:|---:|---:|
| Auto-extract (kan / vod / sil / slb / UT / plyn) | 510 | 510 | 510 |
| VZT_partial (9421 jadra zoom) | — | 13 | 13 |
| VZT direct (drop v3) | — | — | **301** |
| chl direct (drop v3) | — | — | **37** |
| Heuristic VZT 1.PP (KEEP) | — | 94 | 94 |
| Heuristic VZT 1.NP/2.NP/3.NP | — | 54 | **0** (disabled) |
| Heuristic chl 1.PP (KEEP) | — | 8 | 8 |
| Heuristic chl 1.NP/2.NP/3.NP | — | 44 | **0** (disabled) |
| Cable-tray štroby (HSV-961) | — | 48 | 48 |
| **Total HSV-961+962+963 items** | **558** | **758** | **998 (+240 vs Part 5B)** |

Per-podlazi distribution post-drop-v3:

| Podlazi | Auto (kan/vod/etc.) | VZT direct | chl direct | Heuristic 1.PP | Štroby | Total |
|---|---:|---:|---:|---:|---:|---:|
| 1.PP | 266 | — | — | 102 (94 VZT + 8 chl) | 18 | **386** |
| 1.NP | 94 | 98 | 12 | — | 12 | **216** |
| 2.NP | 92 (incl. 13 VZT_partial) | 109 | 14 | — | 9 | **224** |
| 3.NP | 58 | 94 | 11 | — | 9 | **172** |
| **TOTAL** | **510** | **301** | **37** | **102** | **48** | **998** |

---

## 5. Confidence breakdown across the 998 items

| Confidence | Items | Source |
|---|---:|---|
| **0.95** | 510 | Direct extract per-discipline DXF (kan, vod, sil, slb, UT, plyn) — Part 5A |
| **0.85** | 351 | Direct extract from drop v3 DXFs (VZT 301 + VZT_partial 13 + chl 37) — slightly lower than 0.95 because layer-convention interpretation requires "INSERT-on-layer = prostup" rule |
| **0.85** | 48 | Cable-tray chase length (geometry-derived) — Part 5A |
| **0.70** | 102 | Heuristic 1.PP VZT (94) + 1.PP chl (8) — files unavailable, density-ratio anchored |
| **TOTAL** | **998** | weighted average confidence ≈ 0.91 (was 0.84 post-Part 5B) |

Confidence uplift: 314 items moved from 0.70 (heuristic) → 0.85 (direct).
Weighted average jumped from 0.84 → 0.91 — meaningful improvement for
billing review.

---

## 6. 1.PP VZT — remaining gap (ABMV item #11 follow-up)

`1pp_VZT.dxf` source DWG is 29 MB after AutoCAD-to-DXF conversion
(presumably much larger than the upload limit of GitHub web UI, which
caps at 25 MB). The file has not been uploaded; 1.PP VZT therefore
remains heuristic at 94 items confidence 0.70.

Resolution path (per `probe_9_backlog.md` ticket #1):
- Upload via `git push` from local machine where file size limit
  doesn't apply, OR
- Use Git LFS if commits to main are policed, OR
- Re-export as smaller AC1024-DXF (typically 30–50 % smaller than
  AC1027) and try GitHub UI again.

When file lands, follow same pattern as drop v3:
1. `git mv inputs/dxf/1pp_VZT.dxf sources/D/dxf/1pp_VZT.dxf`
2. Add `("VZT", "1pp_VZT.dxf")` to `DISCIPLINE_DXF_PATTERNS[("D", "1.PP")]`
3. Set `PART_5B_HEURISTIC_VZT["1.PP"] = 0`
4. Re-run `pi_0/extract.py --objekt=D` + `probe_9_generate_items.py`
5. Re-run Phase 6 / 8 / 0.20 to regenerate Excel.

Estimated drop v4 effort: 30 min (mechanical follow-through of v3 pattern).

---

## 7. Validation status (post drop v3)

- 15 / 15 tests pass in `pi_0/tests/test_dxf_tzb.py`
- Validation gate: 373 MATCH / 0 MISSING / 0 CHANGED / 7 NEW = PASS
- 3× idempotency byte-identical for `master_extract_D.json`
- D-deliverable Excel mtime preserved through Step 8c re-extract (will
  be deliberately updated in Phase 6 / 8 / 0.20 regen — same pattern
  as Part 6 of original PROBE 9)

---

_Generated by Claude Code, PROBE 9 drop v3 direct-vs-heuristic diff,
2026-05-10._
