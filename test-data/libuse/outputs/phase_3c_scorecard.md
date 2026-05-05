# Phase 3c FINAL Quality Scorecard

**Generated:** Phase 3c step 3 (final)  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Mode:** Single-object D, all kapitoly complete  
**Combined dataset:** `items_objekt_D_complete.json` (1,335,904 bytes)  

## Critical findings (PERSISTENT — surface in EVERY scorecard until resolved)

### CRITICAL — 0.7 step 4 PROBE 1

**Summary:** starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's complaint that the VV is incomplete.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit

### CRITICAL — 3a — PSV-781 obklady

**Summary:** starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap of ~240 m² komplex hydroizolace under F06 obklad. Persistuje až do Phase 5.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit; verify F06 wall area against Tabulka skladeb step (F06 = obklad keramický + skladba pod ním uvedena samostatně)
**Parser D-side estimate:** 325.76 m²

## Items — totals

- **Total items: 2050**
- All `urs_code` null (ready for Phase 4 ÚRS lookup): **✅**
- Items with `skladba_ref` populated: **2050 / 2050** (100 %)
- Detail items (OP/LI/Detail-): **87**

## Items per source (Phase 3 split)

| Source | Items |
|---|---:|
| `items_phase_3a_vnitrni.json` | 1425 |
| `items_phase_3b_vnejsi_a_suteren.json` | 104 |
| `items_phase_3c_sdk.json` | 358 |
| `items_phase_3c_truhl_zamec.json` | 76 |
| `items_phase_3c_detaily.json` | 87 |
| **Total** | **2050** |

## Items per kapitola

| Kapitola | Items | MJ totals |
|---|---:|---|
| `Detail-dilatace` | 1 | 176.0 m |
| `Detail-ostení` | 1 | 147.0 m |
| `Detail-ostění` | 2 | 147.0 m · 7.3 kg |
| `Detail-parapet` | 2 | 84.0 m |
| `Detail-soklova-mrizka` | 2 | 32.0 ks |
| `Detail-spara` | 2 | 378.0 m |
| `HSV-611` | 134 | 2234.9 m2 |
| `HSV-612` | 170 | 4558.9 m2 |
| `HSV-622.1` | 4 | 1085.2 m2 · 4883.2 kg |
| `HSV-622.2` | 3 | 663.4 m2 |
| `HSV-622.3` | 2 | 60.0 m2 |
| `HSV-631` | 312 | 3217.8 m2 |
| `LI-detail` | 14 | 164.2 ks |
| `OP-detail` | 63 | 41.6 bm · 121.0 ks · 1.0 kpl |
| `PSV-711` | 2 | 177.4 m2 |
| `PSV-712` | 18 | 1645.5 m2 · 560.0 ks · 20.4 m3 |
| `PSV-713` | 17 | 2827.9 m2 · 9775.5 kg · 6034.5 ks · 533.9 m |
| `PSV-762` | 4 | 334.4 m2 · 1225.1 m · 152.0 kg |
| `PSV-763.1` | 136 | 757.7 m · 378.9 ks · 517.8 m2 |
| `PSV-763.2` | 215 | 314.5 m · 322.4 m2 · 255.0 ks |
| `PSV-763.3` | 7 | 1209.0 m2 · 585.0 m · 292.5 ks |
| `PSV-764` | 33 | 427.7 bm · 32.5 ks |
| `PSV-765` | 6 | 304.0 m2 · 10954.0 ks · 68.5 m |
| `PSV-766` | 45 | 357.0 ks |
| `PSV-767` | 31 | 330.1 bm · 117.5 ks · 1152.0 kg |
| `PSV-771` | 165 | 607.8 m2 · 871.5 kg · 250.3 m |
| `PSV-776` | 140 | 1470.0 m2 · 196.0 kg · 502.7 m |
| `PSV-781` | 144 | 1172.5 m2 · 485.6 m · 1075.0 kg |
| `PSV-783` | 15 | 3913.3 kg · 2599.4 m2 |
| `PSV-784` | 360 | 10649.2 m2 |

## Refinements (Phase 3c part D — all closed)

| Refinement | Status |
|---|---|
| Phase 3a items refined in-place | ✅ |
| Phase 3b items refined in-place | ✅ |
| D1 hydroizolace partial-height split | ✅ |
| D2 špalety fasádní 350 vs vnitřní 200 | ✅ |
| D3 obklad opening areas subtract | ✅ |
| D4 F06 verification | ✅ (full-height confirmed) |
| D5 klempíř D-share warnings | ✅ (33 items annotated) |
| D6 LP60-65 verify | ✅ (heuristic via W04+W83 count) |
| D7 F08 HATCH search | ✅ (none found, estimate retained) |
| D8 F10/F11 split verify | ✅ (already correct) |
| D9 RF11 vegetační střecha | ✅ (6 new items added) |

Diff log: `phase_3c_partD_diff_log.md`

## Acceptance criteria

- Items count ≥ 1700: **2050** ✅
- All Phase 3a/b refinements applied: **True** ✅
- Skladba coverage ≥ 95 %: **100 %** ✅
- All urs_code null (ready for Phase 4): **True** ✅

### ✅ READY FOR PHASE 4 (ÚRS lookup batch)

All 2050 items have `urs_code: null` + `status: 'to_audit'`. Phase 4 will batch-lookup against ÚRS RSPS database (Sborník popisů stavebních prací 800-) per Q6 prompt template, populate urs_code + urs_description, and surface low-confidence matches for HITL review.

## Phase 4 inputs ready

- `items_objekt_D_complete.json` — 2050 items with full popis, MJ, množství, místo, skladba_ref
- Per-item `popis` is generated to be ÚRS-LLM-friendly (uses standard Czech construction terminology + reference výrobce names where known).
- Critical findings carry-forward will surface in Phase 4 + Phase 5 scorecards until catalogued as VYNECHANE_KRITICKE in Phase 5 audit.

## Known limitations / Phase 4 / 5 work

- **Coverage gap A/B/C objekty** persists. DWG dataset covers only D + společný 1.PP. Komplex output for all 4 buildings will need either more DWG (if customer can provide) or a hybrid PDF-measurement path scaled by geometry-aware ratios. Current Phase 3 produces D-only quantities; cross-building extrapolation is Phase 4/5 manual scaling decision.
- **Klempíř + zámečnické 0.25 D-share is uniform**. Refinement requires DXF-side measurements per objekt; Phase 4 could use AI-vision on PDF půdorysy A/B/C to verify counts.
- **Roof horizontal poly reassembly** still deferred. A-ROOF-OTLN is LINEs not closed polylines. Phase 4 implementation: shapely.polygonize() + slope clustering via RF tags from roof drawing.
- **Per-room opening ownership**. Phase 1 step 2 stops at podlaží level; Phase 3a/b/c approximates via nearest-room. For high-precision per-room wall netto, use shapely.contains() on each room polygon × each opening position.
- **ÚRS confidence threshold**. Phase 4 will attach urs_code + confidence per Q6 prompt; items with confidence < 0.7 should auto-trigger HITL flag.
- **Carry-forward critical findings need Phase 5 audit**. PROBE 1 (cement screed gap) + PROBE 2 (hydroizolace gap) catalogued as VYNECHANE_KRITICKE in Phase 5 audit_report.md.