# Phase 5 — URS WebSearch Verification Report

**Date:** 2026-05-27  •  **Items.json baseline:** 212 (FROZEN canonical)
**Patterns applied:** 15 (Work-First), 21 (Multi-factor selection), 25 (WebSearch fallback), 26 (Honest fallback hierarchy), 27 (External LLM cross-validation), 31 (CEV)

---

## Phase 5A — Family Code Consistency (offline)

Per Pattern 21 — URS family digit ↔ kapitola heuristic.

| Flag class | Count |
|---|---:|
| family_match | 175 |
| family_mismatch | 27 |
| no_code | 9 |
| family_mismatch_whitelisted | 1 |

**WebSearch candidates selected (Tier B):** 59 queries (~$0.60 budget)

---

## Phase 5B — WebSearch verification (60 queries / $0.60)

Per Pattern 26 STRICT fallback hierarchy. NO catalog code fabrication.

### Verdict distribution

| Verdict class | Count | Meaning |
|---|---:|---|
| ✓ VERIFIED | 4 | Direct cs-urs.cz catalog match for code-popis pair |
| FAMILY_VERIFIED | 46 | cs-urs.cz chapter confirmed; specific 9-digit leaf needs production lookup |
| FAMILY_VERIFIED_CHAPTER_MATCH | 1 | cs-urs.cz chapter '800-764 Klempířské' confirmed; expanded to 4 PSV-76 Klempíř items |
| CROSS_DISCIPLINE_OK | 4 | Family digit ≠ kapitola but cs-urs.cz confirms legitimate cross-discipline (Pattern 21) |
| ⚠ WRONG_LEAF | 4 | Same URS code used on DIFFERENT items — at least one wrong, disambiguation needed |

### Items patched

**65 items** received URS verification updates (allowed fields only):
- `urs_status` updated
- `urs_confidence` adjusted to reflect verdict strength
- `cross_verification_status` (new field) added with verdict class
- `cross_verification_evidence_url` (new field) added with primary evidence URL
- `correct_code_hint` (new field) added on 2 WRONG_LEAF cases needing alt suggestion
- `_audit_gap_fixed` tagged with `URS_PHASE5B_<verdict>`

### 4 WRONG_LEAF cases (require production-lookup before File B)

| Item | Issue | Action needed |
|---|---|---|
| `260219_dum.HSV1.004` (anglický dvorek) + `HSV1.005` (terasa) | Same code `564831111` on both | Distinguish: dvorek dlažba vs terasa garapa — separate URS leafs |
| `260219_dum.HSV2.003` (bednění BV) + `HSV2.008` (bednění věnce) | Same code `631311115` on both | Both should use 274XXX family (ŽB konstrukce); 631 = úpravy povrchů (wrong) |

---

## Pre-flight FROZEN check

**PASS** — FROZEN fields preserved per Pattern 15 strict sequence:
- Item count: 212 → 212 (unchanged) ✓
- 0 FROZEN field violations (popis / mj / mnozstvi / mnozstvi_formula / source / kapitola / subkapitola / realizuje_skladbu / subdodavatel all immutable) ✓
- All changed fields in allowed set: `_audit_gap_fixed`, `cross_verification_evidence_url`, `cross_verification_status`, `urs_status`, `urs_confidence`, `correct_code_hint` ✓
- 63 items: `cross_verification_evidence_url` added
- 62 items: `urs_status` upgraded
- 2 items: `correct_code_hint` added (WRONG_LEAF cases)

---

## Phase 5C — Cross-element sanity chains (6 chains)

Per Pattern 20 section G + Pattern 13 sanity sentinels.

| # | Chain | Verdict | Note |
|---|---|---|---|
| 1 | Okna (PSV-76 ↔ DXF okno INSERT ↔ HSV6.013 demontáž) | REVIEW | PSV-76 sum 32 ks vs DXF 16 — okna items include parapety + glass + frames per typ; HSV6.013=16 ✓ matches DXF |
| 2 | Sanit (PSV-72 ZTI ↔ DXF sanit_WC/umyvadlo/vana/sprcha) | REVIEW | PSV-72 24 ks vs DXF 18 ks — delta +6 ks from baterie + WC moduly counted separately in items.json |
| 3 | Krov (HSV-5 krokve 156 bm ↔ DXF kr_krokev 111 INSERTs) | CONSISTENT_INFORMATIONAL | DXF combines krokve + sloupky + námětky; bm count corroborates system completeness |
| 4 | Klempířina (PSV-76 159.9 m ↔ DXF 173.8 m) | CONSISTENT | Delta -8.0 % within ±15 % tolerance (matches CEV Matrix D.4 verdict) |
| 5 | ETICS (kontaktní 276.7 m² + sokl 13.5 m² = omítka finální 290.2 m²) | CONSISTENT | Exact match ✓ |
| 6 | Sklad geometry (DXF rooms 17.60 + 44.60 + 5.50 ↔ items.json) | CONSISTENT | Phase 3.5 + Action 1 exact match ✓ |

**2 REVIEW chains** are counting-method artifacts (item-vs-INSERT grouping variance), NOT items.json correctness gaps. No items.json patches needed.

---

## Items.json final URS status distribution (after Phase 5B)

| `urs_status` | Count | % |
|---|---:|---:|
| `needs_production_lookup` | 140 | 66.0 % |
| `family_verified_leaf_needs_production_lookup` | 51 | 24.1 % |
| `wrong_leaf_disambiguation_needed` | 9 | 4.2 % |
| `matched_websearch_verified` | 8 | 3.8 % |
| `matched_websearch_cross_discipline_legitimate` | 4 | 1.9 % |

### `cross_verification_status` (Phase 5B field)

| Class | Count |
|---|---:|
| `FAMILY_VERIFIED` | 47 |
| `VERIFIED` | 4 |
| `WRONG_LEAF` | 4 |
| `CROSS_DISCIPLINE_OK` | 4 |
| `FAMILY_VERIFIED_CHAPTER_MATCH` | 4 |

---

## STOP gate after Phase 5

### Pre-flight verification
✓ FROZEN fields preserved (item count + 9 frozen-field check)  
✓ Item count 212 → 212 (no add, no delete)  
✓ Allowed-field-only patches applied  

### Budget
**$0.60 / $1.00 cap** (60 queries × $0.01)

### Status distribution summary

- **VERIFIED + CROSS_DISCIPLINE_OK:** 12 items (5.7 %)
- **FAMILY_VERIFIED (leaf needs prod lookup):** 51 items (24.1 %)
- **WRONG_LEAF (disambiguation needed):** 9 items (4.2 %)
- **needs_production_lookup (unchanged):** 140 items (66.0 %)

### Sanity chains
**3 CONSISTENT + 1 CONSISTENT_INFORMATIONAL + 2 REVIEW** (counting-method artifacts, not gaps)

### List status
**TRULY FROZEN canonical** — ready for Phase 6 File B KROS production deliverable when explicitly approved.

---

## Honest reality check

Per Pattern 26 (Honest fallback hierarchy): cs-urs.cz catalog is paywalled at the detailed 9-digit-leaf level. WebSearch returns CHAPTER references (800-1 Zemní, 800-764 Klempířské, 801-3 Bourání) which confirm FAMILY but not specific leaves. This is the expected behavior — Pattern 25 acceptance:
> Selective use ... targeting items already flagged uncertain by matcher (family mismatch, wrong_leaf, low confidence, close call).

**FAMILY_VERIFIED** verdict means: the URS code's first 3-4 digits are in the correct catalog chapter, but the specific 9-digit leaf requires Karel to verify in his KROS system (which has direct catalog access). This is the honest signal per Pattern 26 — better than fabricated 'matched' or '999999999' placeholder.

**4 WRONG_LEAF cases** are the high-value finding — duplicate codes on different items detected via Phase 5A family-mismatch flag + Phase 5B WebSearch cross-check. These need disambiguation before Karel imports to KROS.

Phase 5 is the FINAL gate before File B production deliverable. List stays FROZEN; Phase 6 awaits explicit approval.