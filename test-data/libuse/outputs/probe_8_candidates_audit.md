# PROBE 8 — Π.0a NEW segment_count entries vs PR #1066 cross-check

**Date**: 2026-05-08
**Step**: Π.0a Step 7b audit
**Source**: validation_report_D.json `segment_counts.NEW` after Step 7b filter
**Goal**: For each code Π.0a found that legacy missed, determine if it
represents a REAL gap in PR #1066 deliverable or a FALSE_ALARM.

---

## Summary

After Step 7b (OS noise filter) the validation report shows **7 NEW
codes**. Cross-checking against PR #1066 `Vykaz_vymer_..._dokoncovaci_prace.xlsx`:

| Status | Count | Codes |
|---|---:|---|
| **🚨 REAL_GAP** (omitted from new VV, verified in DXF) | **6** | D06, W81, W82, W84, CW11, CW12 |
| **PARTIAL_GAP** (in main soupis but count differs) | 1 | F08 |
| **FALSE_ALARM** (cosmetic count delta only) | 0 | — |

Estimated D-objekt material gap: **~1.0 mil Kč** in items physically
present but missing from PR #1066 soupis (per rough unit-price estimates;
KROS pricing required for exact figures).

---

## REAL_GAP — 6 codes confirmed missing from main soupis

All 6 carry status `VYNECHANE_ZE_STAREHO` in PR #1066 Excel sheet
`2_Audit_proti_staremu` — meaning the legacy starý VV had these items
but the regenerated soupis omitted them. The fuzzy matcher (Phase 5)
landed best-match scores 0.113–0.227 (very low, no real match found).

Π.0a INDEPENDENTLY confirms these items physically exist via DXF block
detection — closing the gap loop:

```
old VV says    → item exists
PR #1066 says  → no match in new soupis
Π.0a DXF says  → item physically present in drawings
                 → verified gap, not just a documentation mismatch
```

| Code | Item | DXF instances (D) | Status (legacy audit) | Best new match score | Rough D estimate |
|---|---|---:|---|---:|---:|
| **D06** | Protipožární posuvná brána s integrovanými dveřmi, 5400×2100 mm | 1× | VYNECHANE_ZE_STAREHO | OP09 (0.227) | **~150–300 k Kč** (1× specialty fire-rated sliding gate) |
| **W81** | Jednokřídlové výklopně kyvné, 942×1398 mm, R'w 35 dB | 21× | VYNECHANE_ZE_STAREHO | LP64 (0.218) | **~250 k Kč** (21 × ~12k Kč) |
| **W82** | Jednokřídlové výklopně kyvné, 550×778 mm, R'w 35 dB | 10× | VYNECHANE_ZE_STAREHO | LP64 (0.218) | **~60 k Kč** (10 × ~6k Kč) |
| **W84** | Jednokřídlové výklopně kyvné, 942×1178 mm, R'w 35 dB | 2× | VYNECHANE_ZE_STAREHO | LP64 (0.218) | **~25 k Kč** |
| **CW11** | Pevné zasklení + otevíravé-sklopné, 1400×2400 mm, RC2 + 40 dB | 4× | VYNECHANE_ZE_STAREHO | LP34 (0.113) | **~120 k Kč** (4 × ~30k Kč) |
| **CW12** | Pevné zasklení + otevíravé-sklopné, 2200×2400 mm, RC2 + 40 dB | 7× | VYNECHANE_ZE_STAREHO | LP34 (0.113) | **~350 k Kč** (7 × ~50k Kč) |
| **TOTAL** | | **45×** | | | **~1.0 mil Kč** D-objekt material gap |

> Unit prices are rough domain heuristics. RC2-class glass partitions
> typically run 15–80k Kč each depending on size; specialty doors
> (D06 fire-rated sliding) are ≥150k Kč; specialty windows W8x with
> 35 dB acoustic 6–20k Kč each.

### Why the legacy fuzzy matcher missed these

All 6 are **specialty items** with verbose Czech descriptions in old VV
that don't tokenize well. The 35 dB / RC2 / 40 dB qualifiers are
material to the actual product spec but get treated as noise by
generic fuzzy similarity. The best-match suggestions (LP64 zábradlí,
LP34 ztužení příček, OP09 revizní dvířka) are wildly off-target —
indicating the new soupis genuinely lacks these line items.

---

## PARTIAL_GAP — F08 (cihelné pásky Terca)

`F08` IS present in the main soupis (`1_Vykaz_vymer`), 7 cells in
HSV-622.1 chapter, MJ=m². Π.0a found 5 DXF instances; the soupis
already documents **542.6 m² estimate** with a calculator note
(`F08 plocha = facade_netto 786.6 − F13 214.0 − F16_podhledy 30.0`).

**Already covered** by PROBE 3 (cihelné pásky Terca material gap,
~3.9 mil Kč komplex / ~970 k Kč D-objekt material flagged in
carry_forward_findings #3). Π.0a's 5 DXF tag instances are sub-area
annotations on the 542.6 m² total — not new gaps, just confirms
PROBE 3 finding.

| Code | Already in soupis? | Π.0a delta | Action |
|---|---|---|---|
| F08 | ✅ Yes (7 cells, HSV-622.1, 542.6 m²) | 5 DXF tag instances | **No further action** — PROBE 3 already in carry_forward |

---

## Recommended actions

### Per-code

1. **D06 + W81 + W82 + W84 + CW11 + CW12 → ABMV email items #10–15**
   - 6 specialty items missing from PR #1066 soupis but present in
     old VV + verified in DXF.
   - Two parallel actions:
     - **(a) Generate Excel sections** — add 6 rows to working soupis
       with proper specs (size, RC class, R'w, hardware) sourced from
       Tabulka 0042 (W codes) / Tabulka 0043 (CW codes) / Tabulka 0041
       (D06).
     - **(b) ABMV email** — confirm these spec lines are correct (match
       current architectural intent) before billing — D06 specifically
       (5400 mm wide protipožární gate is unusual; ABMV may want to
       verify it's not deprecated like D05 was).
   - Estimated material recovery: **~1.0 mil Kč** for D-objekt alone.

2. **F08 → no action**
   - Already in soupis at full 542.6 m² area.
   - PROBE 3 already covers any pricing gap.

### Process improvement

3. **Improve Phase 5 fuzzy matcher** — score < 0.30 should auto-trigger
   "could not match" rather than returning a low-confidence false match.
   Current behavior (returning best score even at 0.113) hides real
   omissions because the report shows "matched" status semantically.

4. **Cross-objekt application** — same audit should run on A/B/C once
   their items are generated. If the same 6 specialty items also exist
   physically in A/B/C drawings, the komplex gap is ~4 mil Kč
   (4 buildings × ~1 mil Kč each).

---

## Provenance

- master_extract_D.json: 1abd1781 (post Step 7) → 4a6b8.. (post Step 7b
  filter, NEW=11→7)
- validation_report_D.json: 7 NEW codes after E-LITE-EQPM-IDEN exclusion
- 2_Audit_proti_staremu rows: 931 (D06), 944 (W81), 945 (W82),
  947 (W84), 967 (CW11), 968 (CW12)
- Tabulka 0042 OKEN row indices for W81/W82/W84: 88, 89, 91 (wait —
  re-verify; pi_0/extractors/xlsx_okna.py iterated row 8+ and found 17
  windows incl. W81-W86)
- Tabulka 0043 PROSKLENÉ for CW11/CW12: not yet wired into Π.0a
  (Tabulka 0043 absorption is post-Π.0a-Part-3 task).

---

_Generated by Claude Code Π.0a Step 7b audit, 2026-05-08._
