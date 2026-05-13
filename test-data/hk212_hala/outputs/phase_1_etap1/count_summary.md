# Phase 1 Etapa 1 — Count Summary

**Project:** hk212_hala  ·  **Date:** 2026-05-13  ·  **Phase:** 1 Etapa 1  ·  **Branch:** `claude/hk212-phase-1-etap1-hsv-psv-vrn-m-vzt`

**Catalog:** URS201801.csv (39 742 stemmed rows, 2018-01 vintage)  ·  **Export wrapper default:** KROS Komplet

## Cumulative
- **Total items:** 141
- ✅ matched_high: 4
- 🟡 matched_medium: 38
- ❓ needs_review: 92
- 🔧 custom_item (Rpol*): 7
- **Match rate (high + medium):** 29.8%

## Per-kapitola breakdown

| Kapitola | SO | Subdod | Items | matched_high | matched_medium | needs_review | custom |
|---|---|---|---:|---:|---:|---:|---:|
| HSV-1 | SO-01 | zemni_prace | 27 | 0 | 8 | 19 | 0 |
| HSV-2 | SO-01 | GD_zaklady_beton | 18 | 1 | 2 | 15 | 0 |
| HSV-3 | SO-01 | OK_dodavka_montaz | 14 | 0 | 2 | 12 | 0 |
| HSV-9 | SO-01 | GD_vodorovne_dopravy | 4 | 0 | 2 | 2 | 0 |
| PSV-71x | SO-01 | izolace | 4 | 2 | 0 | 2 | 0 |
| PSV-76x | SO-01 | zamecnik_vrata_okna | 12 | 0 | 4 | 8 | 0 |
| PSV-77x | SO-01 | podlahy_specialista | 6 | 0 | 2 | 4 | 0 |
| PSV-78x | SO-01 | klempir | 12 | 1 | 2 | 9 | 0 |
| M | SO-10 | specialista_anchorage_strojaru | 7 | 0 | 0 | 0 | 7 |
| VRN | SO-11 | GD_provoz | 22 | 0 | 11 | 11 | 0 |
| VZT | SO-05 | VZT_dodavatel | 15 | 0 | 5 | 10 | 0 |
| **TOTAL** | — | — | **141** | **4** | **38** | **92** | **7** |

## VYJASNĚNÍ ref distribution

| ABMV ID | Items referencing |
|---|---:|
| ABMV_17 | 22 |
| ABMV_16 | 8 |
| ABMV_3 | 8 |
| ABMV_11 | 5 |
| ABMV_10 | 2 |
| ABMV_20 | 2 |
| ABMV_8 | 2 |
| ABMV_1 | 1 |
| ABMV_15 | 1 |
| ABMV_2 | 1 |

## Status flag distribution

| _status_flag | Items |
|---|---:|
| concept_pending_vzt_drawings | 15 |
| specifikace_pending_strojaru | 7 |
| variant_pending_IGP | 4 |
| placeholder_engineering_estimate | 2 |
| working_assumption | 1 |

## Acceptance criteria (§9)

| # | Criterion | Status |
|---|---|---|
| 1 | Total items ≥ 130 | ✅ 141 ≥ 130 |
| 2 | URS match rate ≥ 60 % | ❌ 29.8% (below; per Q1 fallback in sep. task) |
| 3 | All items have mandatory fields | ✅ (validated at generation time) |
| 4 | No confidence < 0.30 | ✅ (schema validate enforces) |
| 5 | VYJASNĚNÍ refs cross-resolved | ✅ |
| 6 | All VZT items have concept_pending_vzt_drawings | ✅ (15/15) |
| 7 | All M-kapitola items reference stroje | ✅ (7/7) |
| 8 | All HSV-1 výkop items reference ABMV_17 | ✅ (14/14) |
