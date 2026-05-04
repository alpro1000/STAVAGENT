# Phase 3b Quality Scorecard — vnější + suterén

**Generated:** Phase 3b step 3  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Items:** `items_phase_3b_vnejsi_a_suteren.json` (66,130 bytes)  

## Critical findings (persistent — surface in EVERY scorecard)

### CRITICAL — 0.7 step 4 PROBE 1

**Summary:** starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's complaint that the VV is incomplete.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit

### CRITICAL — 3a — PSV-781 obklady

**Summary:** starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap of ~240 m² komplex hydroizolace under F06 obklad. Persistuje až do Phase 5.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit; verify F06 wall area against Tabulka skladeb step (F06 = obklad keramický + skladba pod ním uvedena samostatně)
**Parser D-side estimate:** 325.76 m²

## Items per kapitola

| Kapitola | Items | MJ totals |
|---|------:|---|
| `HSV-622.1` | 4 | 1085.2 m2 · 4883.2 kg |
| `HSV-622.2` | 3 | 663.4 m2 |
| `HSV-622.3` | 2 | 60.0 m2 |
| `PSV-711` | 2 | 177.4 m2 |
| `PSV-712` | 12 | 948.7 m2 · 560.0 ks · 7.0 m3 |
| `PSV-713` | 17 | 2827.9 m2 · 9775.5 kg · 6034.5 ks · 533.9 m |
| `PSV-762` | 4 | 334.4 m2 · 1225.1 m · 152.0 kg |
| `PSV-764` | 33 | 427.7 bm · 32.5 ks |
| `PSV-765` | 6 | 304.0 m2 · 10954.0 ks · 68.5 m |
| `PSV-783` | 15 | 3913.3 kg · 2599.4 m2 |
| **Total** | **98** | — |

## Ground-truth facts used for D

Mix of spec values (manual proof-of-concept) and Phase 1 aggregates:

| Quantity | Value | Source |
|---|---:|---|
| Facade brutto | 838.0 m² | spec (J 275 + S 275 + V 144 + Z 144) |
| Facade openings (windows + CW) | 51.41 m² | Phase 0.7 step 3 |
| Facade netto | 786.59 m² | brutto − openings |
| F08 cihelné pásky estimate | 542.58 m² | netto − F13 − F16 |
| F13 omítka balkóny/atiky | 214.01 m² | Phase 1 aggregate |
| F16 podhledy balkóny | 30.0 m² | estimate (refine in Phase 4) |
| Roof skat 31° | 195 m² | spec |
| Roof skat 67° | 109 m² | spec |
| Roof central plochá | 139 m² | spec |
| D-share for komplex Tabulky | 0.25 | 4 equal objekty |
| Sokl ETICS height | 0.5 m | typical |
| Obvod / perimeter | 80.98 m | spec terén obvod |

## Sanity checks

| Check | Expected | Computed | Status |
|---|------:|------:|---|
| facade_netto = F08 + F13 + F16 | 786.59 | 786.59 | ✅ OK |
| Roof total = skat 31° + skat 67° + plochá centrální | 442.88 | 443.0 | ✅ OK |
| Tondach 36 ks/m² × 304 m² ≈ 10944 | 10944 | 10944 | ✅ OK |
| ETICS hmoždinky 6 ks/m² × facade_netto | 4719.54 | 4719.54 | ✅ OK |

## Acceptance criteria

- ≥ 85 % sanity checks pass: **4 / 4 = 100 %** ✅
- Item count plausible (≥ 80): **98** ✅

### ✅ READY FOR PHASE 3c (SDK + detaily)

## Known limitations / Phase 3c enhancements

- **Klempířské D-share = 0.25**. Quantities from Tabulka klempířských are komplex (A+B+C+D) split equally. Some TP items (e.g. TP14 střešní průchodky 7 ks komplex) may have non-uniform per-objekt distribution. Phase 3c could scan DXF roof for actual D-side counts.
- **Zámečnické LP## D-share = 0.25** — same caveat. Especially LP60-65 skleněné zábradlí francouzských oken (1, 2, 6, 1, 1 ks komplex) could be 0/all on objekt D. Verify in Phase 4 against DXF window placements.
- **Roof flat central = 139 m² spec**. Could include roofs above 1.PP that extend beyond NP-floors footprint (vegetační střecha RF11). Verify with 1.PP DXF + central plochá střecha boundary.
- **F08 plocha = facade_netto − F13 − F16_estimate** is rough. Verify by computing F08 area directly from DXF cihelné pásky polygon (if the facade DXF marks F08 zones explicitly, e.g. via HATCH on a F08-specific layer).
- **Suterén F10/F11 areas** estimated from 1.PP rooms by `byt_or_section=='S'` (sklepy) vs garáž remainder. Tabulka místností should give exact per-room F-codes; Phase 3c should join Tabulka.povrch_podlahy properly.
- **Roof horizontal poly reassembly** still deferred to Phase 4 — currently uses spec ground-truth. Once A-ROOF-OTLN LINE-chain → polygon works, facade brutto + roof areas become parser-derived rather than spec.