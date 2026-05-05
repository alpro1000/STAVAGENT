# Phase 3a Quality Scorecard — vnitřní dokončovací práce

**Generated:** Phase 3a step 5 (final)  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Mode:** Single-object D, vnitřní items only (Phase 3b/3c follow-up)  
**Items:** `items_phase_3a_vnitrni.json` (855,400 bytes)  

## Critical findings (persistent across phases)

### CRITICAL — 0.7 step 4 PROBE 1

**Summary:** starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's complaint that the VV is incomplete.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit

### CRITICAL — 3a — PSV-781 obklady

**Summary:** starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap of ~240 m² komplex hydroizolace under F06 obklad. Persistuje až do Phase 5.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit; verify F06 wall area against Tabulka skladeb step (F06 = obklad keramický + skladba pod ním uvedena samostatně)
**Parser D-side estimate:** 325.76 m²

## Items per kapitola

| Kapitola | Items | MJ totals | Item roles |
|----------|------:|-----------|------------|
| `HSV-611` | 104 | 2215.9 m2 | penetrace=37, omítka=37, špalety=30 |
| `HSV-612` | 134 | 4541.2 m2 | penetrace=49, omítka=49, špalety=36 |
| `HSV-631` | 312 | 3217.8 m2 | penetrace=104, potěr=104, kari síť=104 |
| `PSV-771` | 165 | 607.8 m2 · 871.5 kg · 250.3 m | penetrace=33, lepidlo=33, dlažba=33, spárovac=33, sokl=17 |
| `PSV-776` | 140 | 1470.1 m2 · 196.0 kg · 502.7 m | penetrace=28, stěrka=28, lepidlo=28, dlažba=28, sokl=28 |
| `PSV-781` | 128 | 1303.0 m2 · 485.6 m · 1075.0 kg | penetrace=32, hydroizolace=32, lepidlo=16, obklad=16, spárovac=16 |
| `PSV-784` | 360 | 10649.2 m2 | malba/nátěr=240, penetrace=120 |
| **Total** | **1343** | — | — |

## Sanity checks vs Phase 1 aggregates

| Check | Phase 1 (m²) | Phase 3a | Status |
|-------|------:|------:|---|
| HSV-631 potěr FF01 | 240.2 | 240.1 | ✅ OK |
| HSV-631 potěr FF03 | 84.5 | 84.5 | ✅ OK |
| HSV-631 potěr FF20 | 69.7 | 69.7 | ✅ OK |
| HSV-631 potěr FF21 | 163.8 | 163.8 | ✅ OK |
| HSV-631 potěr FF30 | 170.7 | 170.7 | ✅ OK |
| HSV-631 potěr FF31 | 326.2 | 326.3 | ✅ OK |
| HSV-611/612 omítka F04 (brutto vs netto) | 515.7 | 495.7 | ✅ OK (Δ -3.9 %) |
| HSV-611/612 omítka F05 (brutto vs netto) | 1841.4 | 1735.7 | ✅ OK (Δ -5.7 %) |
| HSV-611/612 omítka F19 (brutto vs netto) | 1204.4 | 1065.7 | ✅ OK (Δ -11.5 %) |

## Acceptance criteria

- ≥ 85 % sanity checks pass: **9 / 9 = 100 %** ✅
- Item count plausible (≥ 800): **1343** ✅
- No critical generation errors: **True** ✅

### ✅ READY FOR PHASE 3b (vnější + suterén)

## Known limitations / Phase 3b enhancements

- **Hydroizolace pod obklad výška** — currently uses světlá výška (full-height obklad). Spec says some rooms have 2.1 m or partial-height obklad. Phase 3b could refine using Tabulka skladeb F06 detail.
- **Špalety vs deeper opening jamb** — currently uses 200 mm depth uniformly. External wall espaginas often go 300-400 mm. Phase 3b can split fasádní vs vnitřní špalety.
- **Obklad area opening subtraction** — current PSV-781 ploché obkladu uses obvod × světlá výška; opening areas (door + window) NOT subtracted. Slight overestimate for koupelny with door (typical 0.8 × 2.1 = 1.68 m² door per koupelna). Acceptable for Phase 3a; refine in Phase 3b.
- **F06 wall finish** — currently treated as full obklad. If F06 is partial (only behind shower/tub), Phase 3a overestimates. Verify with Tabulka skladeb in Phase 3b.
- **Sokl on dlažba** — 80 mm height standard; ČSN says some rooms get 100 mm sokl. Default OK; refine per skladba spec in Phase 3b if needed.