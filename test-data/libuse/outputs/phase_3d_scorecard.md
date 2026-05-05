# Phase 3d Quality Scorecard — lešení + pomocné práce + zařízení staveniště

**Generated:** Phase 3d step 3 (final)  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Items:** `items_phase_3d_leseni_pomocne.json` (16,553 bytes)  

## Critical findings (PERSISTENT — surface in EVERY scorecard)

### CRITICAL — 0.7 step 4 PROBE 1

**Summary:** starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's complaint that the VV is incomplete.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit

### CRITICAL — 3a — PSV-781 obklady

**Summary:** starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap of ~240 m² komplex hydroizolace under F06 obklad. Persistuje až do Phase 5.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit; verify F06 wall area against Tabulka skladeb step (F06 = obklad keramický + skladba pod ním uvedena samostatně)
**Parser D-side estimate:** 325.76 m²

## Items per kapitola

| Kapitola | Items | MJ totals | Category split |
|----------|------:|---|---|
| `HSV-941` | 10 | 8181.0 m2 · 484.0 ks | subcontractor_required=10 |
| `HSV-944` | 4 | 32.0 ks-měs · 116.0 m · 971.1 m2 | subcontractor_required=4 |
| `HSV-997` | 3 | 147.5 t · 74.7 m3 | subcontractor_required=3 |
| `HSV-998` | 3 | 176.0 m · 7073.9 m2 | subcontractor_required=3 |
| `PSV-925` | 5 | 4.0 kpl-měs · 8.0 ks-měs · 1.0 kpl · 800.0 m-měs · 4.0 ks | general_site_overhead=5 |
| **Total Phase 3d** | **25** | — | sub_required=20 · overhead=5 |

## Category distinction

- **Subcontractor required** (firmly in scope of dokončovacích prací subdodavatele): **20** items
  - HSV-941 lešení (fasádní + vnitřní)
  - HSV-944 pomocné konstrukce (žebříky, zábrany, sítě, krytí)
  - HSV-997 přesun hmot
  - HSV-998 pomocné práce (drážky, broušení, ochrana)

- **General site overhead** (typicky s hlavním dodavatelem — k dořešení): **5** items
  - PSV-925 zařízení staveniště (WC + sklad + el/voda + oplocení + tabule)
  - All carry warning: 'k dořešení s hlavním dodavatelem'

## Ground-truth used

| Quantity | Value |
|---|---:|
| facade_brutto_m2 | 838.0 |
| roof_total_m2 | 443.0 |
| interior_total_m2 | 1056.16 |
| FF_total_m2 | 730.4 |
| ETICS_m2 | 786.59 |
| SDK_total_m2 | 1230.1599999999999 |
| Harmonogram (rental duration) | 4 měsíce |

## Notable totals

- Σ přesun hmot ručně: **124.5 t** pro objekt D
- Σ lешеní (postavění + pronájem) m²: **8181.0** m²-měs (incl. 4 měs pronájmu)

## Cumulative state — items_objekt_D_complete.json

- **Total items: 2075**

| Source | Items |
|---|---:|
| `items_phase_3a_vnitrni.json` | 1425 |
| `items_phase_3b_vnejsi_a_suteren.json` | 104 |
| `items_phase_3c_sdk.json` | 358 |
| `items_phase_3c_truhl_zamec.json` | 76 |
| `items_phase_3c_detaily.json` | 87 |
| `items_phase_3d_leseni_pomocne.json` | 25 |
| **Total** | **2075** |

## Acceptance

- Items count ≥ 20: **25** ✅
- Category split present (both subcontractor_required + overhead): **True** ✅

### ✅ READY FOR PHASE 5 (audit + diff against starý VV)

## Phase 5 inputs ready

- `items_objekt_D_complete.json` — **2075 items** with full popis, MJ, množství, místo, skladba_ref, category (where applicable), and `urs_code: null` placeholder (Phase 4 hybrid lookup deferred).
- Carry-forward critical findings (PROBE 1 cement screed + PROBE 2 hydroizolace) will be CATALOGUED as VYNECHANE_KRITICKE in Phase 5 audit_report.md.

## Phase 4 plan recap (hybrid)

Per user decision (this session):
- Day 4: KROS manual extraction top 30 kapitol (uživatel)
- Day 5: Perplexity batch pro zbytek
- Day 6: Manual review low-confidence items
- Phase 6 Excel draft will produce výkaz BEZ ÚRS sloupce (placeholder column ready for fill-in once Phase 4 hybrid lookup completes).