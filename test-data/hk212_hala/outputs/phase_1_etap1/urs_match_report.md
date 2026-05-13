# Phase 1 Etapa 1 — URS Match Report

**Catalog:** URS201801.csv (39 742 stemmed rows, 2018-01 vintage)
**Matcher:** local Python port — 3-char prefix overlap + max(Jaccard, OverlapCoeff) + kapitola/dim/coverage boosts
**Threshold ladder:** ≥0.85 matched_high · 0.60-0.85 matched_medium · <0.60 needs_review · Rpol-* custom_item

## Headline

- **Total items:** 141
- **Match rate (high + medium):** 29.8%  (42/141)
- spec §9 target was ≥ 60 %; per Q1 user pre-decision, low rate is acknowledged signal that local URS201801 (2018-01) lacks coverage for modern Czech BoQ descriptions. **Fallback handled in separate task** (online URS_MATCHER + Perplexity rerank when outbound is available).

## Match rate per kapitola

| Kapitola | Items | matched_high | matched_medium | match rate | needs_review |
|---|---:|---:|---:|---:|---:|
| HSV-1 | 27 | 0 | 8 | 29.6% | 19 |
| HSV-2 | 18 | 1 | 2 | 16.7% | 15 |
| HSV-3 | 14 | 0 | 2 | 14.3% | 12 |
| HSV-9 | 4 | 0 | 2 | 50.0% | 2 |
| PSV-71x | 4 | 2 | 0 | 50.0% | 2 |
| PSV-76x | 12 | 0 | 4 | 33.3% | 8 |
| PSV-77x | 6 | 0 | 2 | 33.3% | 4 |
| PSV-78x | 12 | 1 | 2 | 25.0% | 9 |
| M | 7 | 0 | 0 | 0.0% | 0 |
| VRN | 22 | 0 | 11 | 50.0% | 11 |
| VZT | 15 | 0 | 5 | 33.3% | 10 |

## Why is the rate low?

URS201801 is the 2018-01 catalog vintage. Modern Czech BoQ (Rožmitál SOL precedent, 2024 RTS) uses fresher item numbering that overlaps with 2018 catalog only on the most common base codes. Cross-check: 1 of 13 Rožmitál precedent codes (`113107222` Odstranění podkladu z kameniva drceného) exists in URS201801; the other 12 (`131201112`, `161101101`, `273321311`, `741421811`, `764321240`, `998273102`, …) do not appear.

The local fuzzy matcher therefore only finds matches against generic / common-stem URS rows (geodet, doprava, revize, hydroizolace) where the catalog vocabulary has not changed. Specialized 27x (železobeton), 76x (zámečnické), and Rpol-style custom items mostly fall to `needs_review` with top-3 alternatives populated for future re-rank.

## High-confidence (matched_high) items

| ID | Kapitola | Score | popis | URS code | URS tokens |
|---|---|---:|---|---|---|
| HSV-2-018 | HSV-2 | 0.957 | Hydroizolace plošná pod podlahovou desku — 1× SBS modifikova | `62852673` | asfaltv bitulst design hydrzlcn modifkvn pas sbs |
| PSV-71x-001 | PSV-71x | 0.850 | Penetrace soklu — penetrační nátěr pod hydroizolaci | `24618218` | austs hydrzlcn izolcn kg laky nater peny pro |
| PSV-71x-002 | PSV-71x | 0.933 | Hydroizolace svislá soklu — SBS modifikovaný asfaltový pás,  | `62852674` | asfaltv bitulst hydrzlcn modifkvn pas sbs |
| PSV-78x-012 | PSV-78x | 0.900 | Doprava klempířiny + materiálu na stavbu — paušál | `55349383` | cast doplnt klemprsk materl mm nutn odvodnn predzv |
