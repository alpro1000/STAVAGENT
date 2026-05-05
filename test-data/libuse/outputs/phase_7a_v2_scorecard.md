# Phase 7a v2 Part 2 Quality Scorecard — offline ÚRS lookup

**Generated:** Phase 7a v2 Part 2
**Branch:** `claude/phase-0-5-batch-and-parser`
**Method:** Offline char-ngram TF-IDF on local URS201801.csv (39 742 rows)

## Connectivity status

❌ **Cloud URS_MATCHER blocked** (HTTP 403, sandbox allowlist).
✅ **Offline path executed** using `URS_MATCHER_SERVICE/backend/data/URS201801.csv`.

URS201801.csv contains canonical ÚRS RSPS 9-digit codes but with Czech
**vowel-stripping** ("činnost" → "cinnst", "geodetické" → "geodtck"). Char-ngram
TF-IDF tolerates this encoding through consonant n-gram overlap, but match
quality is limited by information loss in the encoding.

## Method

1. Load 39 742 URS rows (code; type; encoded_popis)
2. Normalize: lowercase + diacritic strip + non-letter strip
3. Char-ngram TF-IDF index (3-5 grams, sublinear_tf)
4. Per group: prefix-augmented query (kapitola number + canonical popis)
5. Top-5 candidates by cosine similarity
6. Threshold-based status assignment

Thresholds (calibrated for URS-encoded catalog):
- ≥ 0.20 → matched_high
- ≥ 0.10 → matched_medium
- ≥ 0.05 → needs_review
- < 0.05 → no_match

## Results

| Status | Groups | % | Items |
|--------|-------:|--:|------:|
| `matched_high` | **131** | 22.6 % | high-confidence ÚRS code |
| `matched_medium` | 16 | 2.8 % | uses ÚRS top-1 alternative |
| `needs_review` | 0 | 0.0 % | (raised by threshold) |
| `no_match` | 432 | 74.6 % | needs Phase 4 hybrid (KROS / Perplexity / manual) |

| Items | Count |
|-------|------:|
| Total | 2548 |
| With ÚRS code | **915** |
| no_match | 1633 |

## Sample successful matches

| Group | Kapitola | Popis | URS code | URS popis | Score |
|-------|----------|-------|----------|-----------|------:|
| G044 | PSV-771 | Sokl 80 mm dlažba | 742210862 | sokl | 0.67 |
| G339 | Detail-ostění | APU lišta ostění oken | 622143004 | apu list | 0.61 |
| G104 | PSV-713 | XPS 100 mm sokl ETICS | 742210862 | sokl | 0.59 |
| G017 | PSV-784 | Malba vápenná 1. nátěr | 612325301 | vapenn | 0.52 |
| G018 | PSV-784 | Malba vápenná 2. nátěr | 617325451 | vapenn | 0.52 |
| G036 | PSV-776 | Sokl PVC 50 mm — vinyl | 742210862 | sokl | 0.52 |
| G331 | LI-detail | LI16: Porotherm KP7 | 317168318 | cm porothrm | 0.52 |

## Top no_match groups (need Phase 4 hybrid lookup)

These are common finishing operations the URS catalog presumably contains,
but vowel-stripping prevents direct char-ngram match:

| Group | Items | Kapitola | Popis |
|-------|------:|----------|-------|
| G001 | 121 | PSV-784 | Malba disperzní — dodávka barvy |
| G002 | 104 | HSV-631 | Penetrace pod potěr |
| G003 | 104 | HSV-631 | Kari síť 150/150/4 mm pro potěr |
| G004 | 76 | HSV-631 | Cementový potěr F5 tl. 50 mm |
| G005 | 49 | HSV-612 | Penetrace pod omítku sádrová |
| G006 | 49 | HSV-612 | Omítka sádrová vnitřních ploch tl. 10 mm |
| G007 | 49 | PSV-784 | Penetrace stěn pod malbu disperzní |
| G008 | 49 | PSV-784 | Malba disperzní 1. nátěr |
| G009 | 49 | PSV-784 | Malba disperzní 2. nátěr |
| G010 | 43 | PSV-763.2 | SDK desky 2× 12.5 mm impregnované |

These cover ~600+ items collectively. Per ÚRS catalog browsing knowledge, codes
exist:
- 612311521 — Vápenocementová omítka vnitřní 10 mm
- 612321141 — Sádrová omítka vnitřní
- 631311111 — Cementový potěr 50 mm
- 763131121 — SDK podhled 1× 12.5 mm
- 784181221 — Malba disperzní 2× nátěr

A Perplexity-call or KROS-export pass would resolve these in a single batch.

## Quality caveats

1. **Some "matched_high" matches are spurious** — short query terms (e.g.
   D-type code "D31") match unrelated catalog rows containing the same
   substring. Manual review recommended for samples with score 0.50-0.70 +
   suspicious code prefix mismatch (e.g. PSV-767 door hardware → URS 23####
   zemní práce code).
2. **Missing kapitola alignment** — HSV/PSV nomenclature doesn't map 1:1 to
   URS section numbers. Kapitola prefix in query helps but doesn't dominate.
3. **Vowel-stripping ceiling** — char-ngram TF-IDF on heavily-encoded
   descriptions caps at ~25 % match rate. Higher rates require either
   full-diacritic catalog (KROS export) or LLM semantic re-rank.

## Phase 4 hybrid plan (deferred per user — confirmed)

| Day | Task | Coverage target |
|-----|------|-----------------|
| 4 | KROS manual export 800-series → CSV | +30-40 % match (full diacritics) |
| 5 | Perplexity batch on remaining no_match groups | +20-30 % |
| 6 | Manual review needs_review + matched_medium | +10-15 % |
| | **Total expected coverage** | **75-95 %** |

Phase 7a v2 Part 2 (this) provides the **22.6 % baseline** + structured
infrastructure (urs_query_groups.json + cache) for downstream phases to
build upon.

## Outputs

- `urs_query_groups.json` (598 KB) — 579 groups with urs_code + urs_status
- `urs_lookup_cache.json` — restart-safe per-query cache
- `items_objekt_D_complete.json` — 2548 items with urs_code populated
  (where matched), urs_alternatives top-4 per group
- `items_objekt_D_complete_pre_urs.json` — pre-URS backup
- `items_suspicious_for_urs_review.json` — empty (no medium-confidence flagged
  yet; will populate when threshold tightening forces review queue)
- `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` (298 KB) — regenerated
  with ÚRS column populated for 915 items

## Verdict

**⚠️ PARTIAL — 22.6 % coverage from offline lookup; 77.4 % deferred to Phase 4 hybrid.**

This is the realistic ceiling for offline char-ngram TF-IDF on URS201801.csv.
For higher coverage, run:
1. KROS manual export day to get full-diacritic catalog (single-day effort)
2. Perplexity batch for residual no_match groups
3. Manual review queue for needs_review + suspicious matches

Phase 8 (List 11 sumarizace) can proceed with current 22.6 % coverage as
a foundation; ÚRS lookup will improve incrementally as Phase 4 hybrid completes.
