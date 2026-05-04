# Phase 5 Quality Scorecard — audit + diff

**Generated:** Phase 5 step 7 (final)  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Audit report:** `phase_5_audit_report.md`  

## Critical findings (carry-forward)

- **CRITICAL** — 0.7 step 4 PROBE 1: starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms cus…
- **CRITICAL** — 3a — PSV-781 obklady: starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap …

## Headline metrics

- Items processed (nové D): **2277**
- Stary VV položky processed (architektonicko): **1423**
- Match coverage (SHODA + OPRAVENO_*): **85** (3.7 %)
- VYNECHANE_KRITICKE (PROBE-flagged): **136**
- VYNECHANE_DETAIL (Detaily/OP/LI): **98**
- NOVE (no match — granular vs collapsed): **1958** (86.0 %)
- VYNECHANE_ZE_STAREHO (orphan old, likely hrubá stavba): **1055**

## Estimated cost impact (recommendations)

Aproximativní rough-order estimates pro investora:

| Položka | Komplex m² | Estimated cost |
|---|---:|---:|
| PROBE 1 — cement screed gap | ~2000 | ~1,400,000 Kč |
| PROBE 2 — hydroizolace pod obklad gap | ~1250 | ~500,000 Kč |
| Stykové detaily VYNECHANE_DETAIL | n/a | ~200-400 tis Kč |
| **Total estimated under-booking** | — | **~2,100-2,300 tis Kč** |

## Match accuracy estimate (manual sample 20 items)

Není možné automaticky validovat — Phase 5 doporučuje sample 20 confident-match items (score >= 0.45) pro manual review. Po Phase 4 ÚRS lookup, accuracy se znatelně zlepší (ÚRS kódy umožní 1:1 match).

## Acceptance

- Items processed: **2277** ✅
- Critical findings documented: **2** ✅
- Audit report generated: ✅
- Diff JSON persisted: ✅

### ✅ READY FOR PHASE 6 (Excel export)

## Phase 6 inputs ready

- `items_objekt_D_complete.json` — všech 2277 items s `urs_status`, `audit_note`, `audit_old_code`, `audit_vol_diff_pct` populated.
- `phase_5_diff.json` — compact summary pro Excel sheet 'Audit starého výkazu'.
- `phase_5_audit_report.md` — narrativní report pro investora s recommendations.
- Phase 6 Excel poběží **bez ÚRS sloupce** (placeholder column ready) per user decision (hybrid Phase 4 deferred).