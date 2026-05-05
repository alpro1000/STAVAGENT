# Phase 6.4 Quality Scorecard

**Generated:** Phase 6.4 step H (final)
**Items file:** `items_objekt_D_complete.json`

## Stats

- Items before: **2327**
- Items after:  **2548**  (Δ +221)
- Material dodávka items added (Part A): **205**
- OP edge items zeroed (Part B): **54**
- Window per-W-type parapet items added (Part C1): **20**
- Rooflight items added (Part C2): **0** (of expected 4, found 4)
- NEW PROBE 3 flagged in carry_forward_findings: **YES**

## New items per kapitola

| Kapitola | Items added |
|---|---:|
| `PSV-784` | 121 |
| `PSV-771` | 33 |
| `PSV-776` | 28 |
| `PSV-781` | 16 |
| `PSV-766` | 15 |
| `PSV-764` | 5 |
| `PSV-713` | 2 |
| `PSV-762` | 2 |
| `HSV-622.1` | 1 |
| `PSV-712` | 1 |
| `PSV-765` | 1 |

## Cost impact updated (carry-forward findings)

| Finding | Objekt D | Komplex (× 4) |
|---|---:|---:|
| PROBE 1 (cement screed gap) | ~350 tis Kč | ~1.4 mil Kč |
| PROBE 2 (hydroizolace pod obklad) | ~125 tis Kč | ~500 tis Kč |
| PROBE 3 (cihelné pásky Terca dodávka) — **NEW** | **~976 tis Kč** | **~3.9 mil Kč** |
| **Total under-booking** | **~1.45 mil Kč** | **~5.8 mil Kč** |

## NEW PROBE 3 detail

**Title:** Cihelné pásky Terca — chybějící materiál (HSV-622.1)
**Severity:** CRITICAL
**Discovered in:** Phase_6.3_audit
**Summary:** Old VV obsahuje POUZE kladení cihelných pásků Terca, NE dodávku materiálu. Objekt D plocha F08 = 542 m² × ~1800 Kč/m² = ~975 600 Kč gap pro D. Komplex × 4 ≈ 3.9 mil Kč. Phase 6.4 part A přidalo explicit dodávka řádek; Phase 7a ÚRS lookup ověří jestli ÚRS kladení m² cena obsahuje material — pokud ne, je to kritická chybějící položka.
**Cost impact (D):** ~975,600 Kč
**Cost impact (komplex):** ~3,902,400 Kč
**Next action:** Investor should verify with contractor whether quoted m² price for kladení includes Terca pásky material. If labor+lepidlo only, this 976 tis Kč material cost is missing from old VV.

## Sample of new items (15)

| # | Kapitola | Popis | MJ | Množství |
|---|---|---|---|---:|
| 1 | `PSV-784` | Malba disperzní — dodávka barvy (paired with Malba vápenná 1. nát | m2 | 76.71 |
| 2 | `PSV-784` | Malba disperzní — dodávka barvy (paired with Malba vápenná 1. nát | m2 | 23.21 |
| 3 | `PSV-784` | Malba disperzní — dodávka barvy (paired with Malba vápenná 1. nát | m2 | 23.92 |
| 4 | `PSV-784` | Malba disperzní — dodávka barvy (paired with Malba vápenná 1. nát | m2 | 23.99 |
| 5 | `PSV-784` | Malba disperzní — dodávka barvy (paired with Malba vápenná 1. nát | m2 | 25.08 |
| 6 | `PSV-784` | Malba disperzní — dodávka barvy (paired with Malba vápenná 1. nát | m2 | 24.86 |
| 7 | `PSV-766` | Vnitřní parapet umělý kámen Technistone — okno W03 | m | 17.0 |
| 8 | `PSV-766` | Lepení parapetu PUR pěnou + komprimační páska — okno W03 | m | 17.0 |
| 9 | `PSV-766` | Spárování boků parapetu silikonem — okno W03 | m | 6.8 |
| 10 | `PSV-764` | Vnější parapet pozinkovaný plech 0.7 mm s povlakem — okno W03 | m | 20.4 |
| 11 | `PSV-766` | Vnitřní parapet umělý kámen Technistone — okno W05 | m | 5.625 |
| 12 | `PSV-766` | Lepení parapetu PUR pěnou + komprimační páska — okno W05 | m | 5.625 |

## Verdict

✅ **READY FOR PHASE 7a (ÚRS lookup)**

All HIGH severity gaps from Phase 6.3 audit closed:
- Material dodávka items emitted per Approach A
- OP edge cases zeroed s transparency warning
- Window parapets split per W-type for KROS-detail
- Rooflight items verified
- PROBE 3 (cihelné pásky) flagged + persisted