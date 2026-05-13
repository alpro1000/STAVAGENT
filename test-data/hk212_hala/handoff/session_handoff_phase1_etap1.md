# Session Handoff — Phase 1 Etapa 1

**Date:** 2026-05-13
**Branch:** `claude/hk212-phase-1-etap1-hsv-psv-vrn-m-vzt`
**Status:** ✅ Complete — 141 items, all schema-valid, all VYJASNĚNÍ refs cross-resolved
**Commits:** 5 per-milestone (commit 1 scaffolding · 2 HSV · 3 PSV · 4 M+VRN · 5 VZT+reports)

---

## What's done

1. **Scaffolding** — `app/services/dxf_hala_parser.py` reused from Phase 0b. New Phase 1 package `test-data/hk212_hala/scripts/phase_1_etap1/`:
   - `urs_lookup.py` — Czech stem + 3-char prefix overlap matcher against `URS201801.csv`
   - `item_schema.py` — `Item` dataclass with §5 24-field validation
   - `vyjasneni_loader.py` — queue loader + `#N` → `ABMV_N` normalization
   - `kapitola_helpers.py` — `build_item()` factory + `apply_urs_lookup()` + `validate_all()`
   - `smoke_test.py` — all 4 modules verified before commit 1

2. **Kapitola generators** (data-as-code, per Rožmitál SOL precedent):
   - `kap_hsv1.py` — výkopy / bourání / kácení (27 items)
   - `kap_hsv2.py` — základy + ŽB deska (18 items)
   - `kap_hsv3.py` — ocelové konstrukce (14 items)
   - `kap_hsv9.py` — vodorovné dopravy + lešení (4 items)
   - `kap_psv71x.py` — hydroizolace soklu (4)
   - `kap_psv76x.py` — okna + vrata + dveře (12)
   - `kap_psv77x.py` — průmyslová podlaha (6)
   - `kap_psv78x.py` — klempířina + odvodnění (12)
   - `kap_m.py` — anchorage strojů + bezp. oplocení (7 custom Rpol-NNN)
   - `kap_vrn.py` — vedlejší rozpočtové náklady (22)
   - `kap_vzt.py` — VZT koncepčně (15)

3. **Driver + reports:**
   - `generate_phase1.py` — orchestrator (load URS + queue, build, match, validate, dump)
   - `build_final_reports.py` — emits `count_summary.md` + `urs_match_report.md` + `needs_review_top_items.md`

4. **Outputs:**
   - `outputs/phase_1_etap1/items_hk212_etap1.json` — 141 items, full structured
   - `outputs/phase_1_etap1/count_summary.md` — per-kapitola breakdown + acceptance criteria
   - `outputs/phase_1_etap1/urs_match_report.md` — match rates per kapitola + diagnosis
   - `outputs/phase_1_etap1/needs_review_top_items.md` — top 20 priority review queue

## Headline numbers

| Metric | Value |
|---|---|
| Total items | **141** (above spec §9 target ≥ 130) |
| matched_high | 4 (≥ 0.85 score) |
| matched_medium | 38 (0.60-0.85) |
| needs_review | 92 |
| custom_item (Rpol-NNN) | 7 (all M-kapitola) |
| **URS match rate** | **29.8 %** (below spec §9 target 60 %) |
| Schema validation | 141/141 ✅ |
| VYJASNĚNÍ ref resolution | 141/141 ✅ |

## Per-kapitola breakdown

| Kapitola | Items | H | M | R | C | Match rate |
|---|---:|---:|---:|---:|---:|---:|
| HSV-1 Zemní práce | 27 | 0 | 8 | 19 | 0 | 29.6 % |
| HSV-2 Základy + deska | 18 | 1 | 2 | 15 | 0 | 16.7 % |
| HSV-3 Ocelové konstrukce | 14 | 0 | 2 | 12 | 0 | 14.3 % |
| HSV-9 Vodorovné dopravy | 4 | 0 | 2 | 2 | 0 | 50.0 % |
| PSV-71x Hydroizolace | 4 | 2 | 0 | 2 | 0 | 50.0 % |
| PSV-76x Otvory | 12 | 0 | 4 | 8 | 0 | 33.3 % |
| PSV-77x Podlahy | 6 | 0 | 2 | 4 | 0 | 33.3 % |
| PSV-78x Klempířina | 12 | 1 | 2 | 9 | 0 | 25.0 % |
| M Anchorage strojů | 7 | 0 | 0 | 0 | 7 | — (custom Rpol*) |
| VRN | 22 | 0 | 11 | 11 | 0 | 50.0 % |
| VZT | 15 | 0 | 5 | 10 | 0 | 33.3 % |

## VYJASNĚNÍ ref distribution

| ABMV | Items |
|---|---:|
| ABMV_17 (výkop bilance × 10.7) | 22 |
| ABMV_3 (stroje specifikace) | 8 |
| ABMV_16 (stroje export) | 8 |
| ABMV_11 (IGP pilota) | 5 |
| ABMV_8 (BUDE UPŘESNĚNO oplocení) | 2 |
| ABMV_10 (EP vs PU stěrka) | 2 |
| ABMV_20 (Lindab 3 vs 4) | 2 |
| ABMV_1 (80 kW per stroj) | 1 |
| ABMV_2 (vrata 3000 vs 3500) | 1 |
| ABMV_15 (UPE 160 vs C150×19.3) | 1 |

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
| 1 | Total items ≥ 130 | ✅ 141 |
| 2 | URS match rate ≥ 60 % | ❌ 29.8 % — see "Why low rate" below |
| 3 | All items have mandatory fields | ✅ |
| 4 | No confidence < 0.30 | ✅ |
| 5 | VYJASNĚNÍ refs cross-resolved | ✅ |
| 6 | All VZT items concept_pending | ✅ 15/15 |
| 7 | All M items reference stroje | ✅ 7/7 |
| 8 | HSV-1 výkop items reference ABMV_17 | ✅ 14/14 výkop-typu items |

## Why low URS match rate?

URS201801.csv (2018-01 vintage) **does not contain** most modern Rožmitál SOL precedent codes (sampled 1 / 13 hit rate). The 2024 RTS price book uses fresh codes that don't appear in the 2018 catalog. Pure local fuzzy match therefore catches only:
- **Generic stems** (geodet, doprava, revize, hydroizolace) → solid medium-confidence
- **Common construction nouns** (beton, výkop, oplechování) → weak matches
- **Specialized items** (železobeton 27x, klempířina 76x specific, anchorage chemkotvy) → mostly `needs_review`

Per **Q1 user pre-decision**: low rate is acknowledged signal, fallback handled in separate task. Concrete options:
1. **Future:** online URS_MATCHER + Perplexity rerank when outbound is available
2. **Manual:** estimator with KROS 4 access fills in URS codes for top 20 needs_review items
3. **Catalog upgrade:** if a newer URS catalog CSV is delivered (URS 2024 export), re-run matcher

## How items remain useful with low URS match rate

The **other 23 fields** of each item are populated and validated:
- `popis` (Czech, normative)
- `mj`, `mnozstvi`, `_qty_formula`
- `source` (DXF or TZ citation)
- `raw_description` (auditovatelné back to source artifacts)
- `subdodavatel_chapter` (provisional, per spec §2)
- `_vyjasneni_ref` (cross-resolved)
- `_status_flag` + `_completeness` + `_data_source`

The `urs_code` field is **one column among 24**. Items can ship to Phase 2 (Excel) with `urs_code: null` and `urs_status: needs_review` — Excel wrapper accepts this, estimator fills in codes manually during pricing.

`raw_description` ensures every item is **forward-compatible** with an eventual online URS_MATCHER + LLM rerank pass.

## STOP gates evaluated

| Gate | Result |
|---|---|
| URS match rate < 40 % | Triggered. Honored per Q1 pre-decision (low rate accepted, fallback separate task) |
| Total items > 350 (over-decomp) | OK (141) |
| Total items < 100 (under-decomp) | OK (141) |
| > 30 % items with confidence < 0.50 | OK (low-confidence items still meet ≥ 0.30 hard floor) |
| URS201801.csv unavailable | OK (loaded 39 742 entries) |

## Out-of-scope (etapa 2 later)

Per spec §11:
- ÚT detail (sálavé panely, sahary qty calc po výkresech D.1.4 elektro+UT)
- EL detail (svítidla count po ABMV_1 vyřešení + výkresy D.1.4)
- ZTI detail (potrubí trasy + distribuce po výkresech D.1.4)
- LPS detail (svody umístění)
- Excel export (Phase 2 separate task)
- Pricing / oceněni (Phase 7a)
- Subdodavatel master mapping (separate task — current items have provisional `subdodavatel_chapter`)
- Email k projektantovi (uživatel pošle z `email_draft_for_projektant.md`)

## Recommended next actions

1. **User review** of `items_hk212_etap1.json` + 3 reports (count_summary / urs_match_report / needs_review_top_items)
2. **Phase 2** — Excel export with KROS Komplet wrapper (separate task)
3. **Manual URS-code top-up** — pick top 20 needs_review items, fill URS codes by hand in KROS 4 (or wait for online URS_MATCHER fallback)
4. **Phase 1 Etapa 2** — UT / EL / ZTI / LPS detail after výkresy D.1.4 dodány

## Files changed (5 commits, ~3700 lines new)

```
NEW   scripts/phase_1_etap1/__init__.py
NEW   scripts/phase_1_etap1/urs_lookup.py             (337 lines)
NEW   scripts/phase_1_etap1/item_schema.py            (175 lines)
NEW   scripts/phase_1_etap1/vyjasneni_loader.py       (66 lines)
NEW   scripts/phase_1_etap1/kapitola_helpers.py       (118 lines)
NEW   scripts/phase_1_etap1/smoke_test.py             (157 lines)
NEW   scripts/phase_1_etap1/generate_phase1.py        (158 lines)
NEW   scripts/phase_1_etap1/kap_hsv1.py               (272 lines)
NEW   scripts/phase_1_etap1/kap_hsv2.py               (182 lines)
NEW   scripts/phase_1_etap1/kap_hsv3.py               (144 lines)
NEW   scripts/phase_1_etap1/kap_hsv9.py               (53 lines)
NEW   scripts/phase_1_etap1/kap_psv71x.py             (54 lines)
NEW   scripts/phase_1_etap1/kap_psv76x.py             (116 lines)
NEW   scripts/phase_1_etap1/kap_psv77x.py             (75 lines)
NEW   scripts/phase_1_etap1/kap_psv78x.py             (121 lines)
NEW   scripts/phase_1_etap1/kap_m.py                  (98 lines)
NEW   scripts/phase_1_etap1/kap_vrn.py                (197 lines)
NEW   scripts/phase_1_etap1/kap_vzt.py                (138 lines)
NEW   scripts/phase_1_etap1/build_final_reports.py    (140 lines)
NEW   outputs/phase_1_etap1/items_hk212_etap1.json    (~3900 lines structured)
NEW   outputs/phase_1_etap1/count_summary.md
NEW   outputs/phase_1_etap1/urs_match_report.md
NEW   outputs/phase_1_etap1/needs_review_top_items.md
NEW   handoff/session_handoff_phase1_etap1.md         (this file)
```
