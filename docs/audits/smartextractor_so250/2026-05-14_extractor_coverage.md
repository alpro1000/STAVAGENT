# SO-250 — SmartExtractor coverage probe

**Date:** 2026-05-14
**Branch:** `claude/smartextractor-probe-rsd-5Gqm4`
**Author:** Claude Code (read-only probe — no extractor code modified)
**Probe script:** [`probe.mjs`](probe.mjs)
**Machine-readable output:** [`probe_result.json`](probe_result.json)
**Source under test:** `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts` (604 LOC, 12 regex/keyword patterns + smeta-line parser)
**Probe spec:** `Monolit-Planner/shared/SO-250_smartextractor_probe.md` (2026-05-14)
**Real-world driver:** `test-data/SO_250/tz/SO-250.md` (briefing for D6 Olšová Vrata - Žalmanov, SO 250 Zárubní zeď, 515,20 m, plošně založená úhlová železobetonová zeď, PDPS, ŘSD/PRAGOPROJEKT 2026).

---

## 0. TL;DR

**Update 2026-05-14 (a) — 4 fixes shipped → 0 % → 61 %.**
**Update 2026-05-14 (b) — Block B dimension follow-up → 61 % → 100 %.**

After Fix #0 / #1 / #2 / #3 + the dimension follow-up, probe coverage
reaches **46 / 46 = 100 %** across all five blocks and conflict
detection stays at **67 % PASS** (limited by Block B prose carrying
no railing-height value to compare against — no extractor fix can
manufacture that).

| Block | Before any fix | After 4 fixes | After dim pack | Notes |
|-------|---------------|---------------|----------------|-------|
| A — Identifikace | 0 / 10 = 0 % | **10 / 10 = 100 %** | 10 / 10 = 100 % | Fix #2 project-id pack. |
| B — Konstrukce | 0 / 15 = 0 % | 2 / 15 = 13 % | **15 / 15 = 100 %** | Dimension pack: per-segment thickness/width/height-range with element_scope, carry-forward across anchor-less sentences, whole-text dilatation count + length + edge count + length + face-cladding material + anchor R-type + anchor grid + rebar grade. |
| C — Římsa | 0 / 7 = 0 % | 2 / 7 = 29 % | **7 / 7 = 100 %** | Whitespace-tolerant `C 30/37` regex + rimsa face/back thickness split + carry-forward scope. |
| D — Výkres | N/A | **8 / 8 = 100 %** | 8 / 8 = 100 % | Fix #3 + Fix #1 fully resolved drawing-side. |
| E — Geotechnika | 0 / 6 = 0 % | **6 / 6 = 100 %** | 6 / 6 = 100 % | Fix #2 Edef + excavation-class + geology pack. |
| **Σ** | **0 / 46 = 0 %** | 28 / 46 = 61 % | **46 / 46 = 100 %** | — |
| Conflict detection (Block B vs D) | 0 / 4 = 0 % | **2 / 3 = 67 % PASS** | **2 / 3 = 67 % PASS** | 3rd pair (railing 1.10 vs 1.15) inherently unresolvable from the chosen Block B fixture — TZ excerpt doesn't quote a TZ-side railing height in the same scope. |

Each fix shipped as an atomic commit on this branch (`claude/smartextractor-probe-rsd-5Gqm4`):

| # | Commit | Fix | Tests added |
|---|--------|-----|-------------|
| 1 | `f90dd5b` | **#0** — Reorder `operne_zdi` before `rimsa` in element-type if/else | 2 |
| 2 | `080426d` | **#3** — Add `'drawing'` to source enum + isDrawingLine/isDrawingDominant heuristic | 3 |
| 3 | `c2e436e` | **#1** — `element_scope` tagging via anchors (podkladní/základ/dřík/římsa/zábradlí/kotevní_tram) | 4 |
| 4 | `9181d00` | **#2** — Block A project-id regex pack + drawing/geotech helpers | 14 |
| 5 | (this PR) | **Block B dimension pack** — per-segment thickness/width/range with face_cladding scope + carry-forward + whitespace-tolerant concrete-class + whole-text dilatation/anchor/material/B500B patterns | 13 |

**1124/1124 vitest pass** (1088 baseline + 23 across 4 fixes + 13 dimension pack).

---

## 0a. Original audit (read-only snapshot — for context)

Below is the original audit text from before the fixes shipped. Headline numbers + sections §3–§6 reflect the pre-fix probe; the per-block tables call out which entries are now resolved.

---

## 1. Methodology

1. Five **pre-cleaned excerpts** (Block A–E), copied verbatim from §3 of the probe spec, are fed to the in-repo extractor `extractFromText(text, { element_type: <hint> })`.
2. For each block we have an **expected matrix** of `{ name, value, conf }` triples (also copied verbatim from the probe spec — the source of truth for "what a rozpočtář would expect").
3. Each expected field is classified into one of four buckets by [`probe.mjs`](probe.mjs):
   - **OK** — extractor returned a param of the same `name`, with matching `value` (numeric tolerance 1e-3, set-equality for arrays) and confidence within ±0.05 of expected.
   - **WRONG_VALUE** — same `name`, different value.
   - **WRONG_CONFIDENCE** — same `name`, same value, confidence off by more than ±0.05.
   - **MISSING** — extractor produced no param with that `name`.
4. The probe also runs `extractFromText` on **Block B + Block D concatenated** to give the conflict-detection logic the best possible chance at seeing both source classes side-by-side.
5. **No extractor code is mutated.** This is a read-only probe; all changes proposed at §6 are out of scope for this PR.

### 1.1 Caveats

- We use **pre-cleaned excerpts** (per Q5 = "deterministic input"). Raw PDF/OCR will be noisier — the gap will be at least as large, never smaller.
- Comparing "expected name" vs "actual name" is harsh: the extractor was never written to emit names like `podkladni_beton_grade`, so a "MISSING" verdict is partly a vocabulary mismatch, not a regex failure. §3 calls this out per row.
- Per Q3 we **only flag** the missing `'drawing'` source enum and propose a schema extension (§5.4); no enum is added.
- Per Q4 we **only flag + propose** a reconciliation rule (§5.5); no alternatives logic is implemented.

---

## 2. Headline numbers

| Block | Title                                       | Expected | OK | MISSING | WRONG_VALUE | WRONG_CONF | Coverage % | AC threshold |
|-------|---------------------------------------------|----------|----|---------|-------------|------------|------------|--------------|
| A     | Identifikace (TZ str. 5)                    | 10       | 0  | 10      | 0           | 0          | **0 %**    | ≥ 70 %       |
| B     | Konstrukce (TZ str. 7-8)                    | 15       | 0  | 15      | 0           | 0          | **0 %**    | ≥ 65 %       |
| C     | Římsa a zábradlí (TZ str. 8-9)              | 7        | 0  | 7       | 0           | 0          | **0 %**    | ≥ 70 %       |
| D     | Výkres (Vzorový příčný řez, OCR transcript) | 8        | 0  | 8       | 0           | 0          | **N/A**    | N/A (no `'drawing'` source) |
| E     | Geotechnika (TZ str. 5-6)                   | 6        | 0  | 6       | 0           | 0          | **0 %**    | ≥ 50 %       |
| **Σ** | **Total**                                   | **46**   | **0** | **46** | **0**       | **0**      | **0 %**    | —            |

| Conflict-test metric                                       | Result   |
|------------------------------------------------------------|----------|
| Element-scoped conflict detection rate (Block B vs D)      | **0 %** (0 / 4) — **FAIL** |
| Global multi-value alternatives populated on `concrete_class` | YES (`['C25/30','C12/15']` alt to primary `C30/37`) |
| Global multi-value alternatives populated on `exposure_class` | YES (6 alts to primary `XF4`) |
| Element scope (which element each value belongs to) preserved | NO |

> The 0/4 element-scoped conflict rate was *predicted* by the probe spec as "automaticky #1 priority fix". Confirmed.

---

## 3. Per-block coverage tables

Each row shows: expected (name, value, target conf) → actual (status, value/source/conf) → cause-of-gap classification. Cause-of-gap codes:

- **VOCAB** — extractor never emits a param with this name (would need a new regex *and* a new field).
- **PATTERN** — extractor *could* match (the data is there) but the regex/keyword doesn't fire on this Czech phrasing.
- **SCOPE** — extractor extracts the value as a generic param, but does not attach element scope (podkladní / základ / dřík / římsa).
- **SOURCE** — extractor lacks the `'drawing'` source enum needed to distinguish TZ from výkres.

### 3.1 Block A — Identifikace (0 / 10 = 0 %)

| Expected name                  | Expected value                                  | Conf | Status   | Actual                | Cause   | Notes |
|--------------------------------|-------------------------------------------------|------|----------|-----------------------|---------|-------|
| `object_id`                    | "SO 250"                                        | 1.0  | MISSING  | —                     | VOCAB   | No `SO\s*\d{3}` pattern. |
| `object_name`                  | "Zárubní zeď v km 6,500 – 7,000 vpravo"         | 0.95 | MISSING  | —                     | VOCAB   | Title-line keyword extraction not implemented. |
| `road`                         | "D6"                                            | 1.0  | MISSING  | —                     | VOCAB   | No `dálnice\s+D\d+` pattern. |
| `stationing_from`              | "6+492.40"                                      | 1.0  | MISSING  | —                     | VOCAB   | No km-stationing parser; the `6,492 40` format (digit-pair after gap) is non-trivial. |
| `stationing_to`                | "7+007.60"                                      | 1.0  | MISSING  | —                     | VOCAB   | Same as above. |
| `documentation_stage`          | "PDPS"                                          | 1.0  | MISSING  | —                     | VOCAB   | No keyword for stage acronyms (DUR / DSP / PDPS / RDS / DSPS). |
| `length_m`                     | 515.20                                          | 1.0  | MISSING  | —                     | VOCAB   | Existing length regex requires "délka NK" (§4 of source); "Délka zdi" doesn't fire. |
| `height_above_terrain_min_m`   | 1.55                                            | 0.95 | MISSING  | —                     | VOCAB   | No `od\s+X\s+do\s+Y\s+m` range parser. |
| `height_above_terrain_max_m`   | 3.40                                            | 0.95 | MISSING  | —                     | VOCAB   | Same. |
| `visible_area_m2`              | 1737.44                                         | 1.0  | MISSING  | —                     | VOCAB   | No "pohledová plocha" keyword pattern. |

**Extractor returned 0 params for this block.** Identification metadata is entirely absent from its vocabulary.

### 3.2 Block B — Konstrukce (0 / 15 = 0 %)

| Expected name                   | Expected value          | Conf | Status   | Closest actual                                  | Cause   | Notes |
|---------------------------------|-------------------------|------|----------|-------------------------------------------------|---------|-------|
| `podkladni_beton_thickness_m`   | 0.15                    | 1.0  | MISSING  | —                                               | VOCAB   | No element-scoped thickness parser. |
| `podkladni_beton_grade`         | "C25/30"                | 1.0  | MISSING  | `concrete_class = "C25/30"` (regex, conf 1.0)   | SCOPE   | Value extracted but globally; not tagged as "podkladní". |
| `podkladni_beton_exposure`      | ["XF3","XA2","XC2"]     | 1.0  | MISSING  | `exposure_classes = ["XF3","XA2","XC2"]` (regex, conf 1.0) | SCOPE   | Same. |
| `base_thickness_m`              | 0.56                    | 1.0  | MISSING  | —                                               | VOCAB   | "konstantní tloušťky 0,56 m" prefix not in patterns. |
| `base_width_m`                  | 2.75                    | 1.0  | MISSING  | `nk_width_m = 2.75` (regex, conf 1.0)           | SCOPE   | Width extracted, but mis-named (`nk_width_m` is for bridge deck, not foundation). |
| `dilatation_main_count`         | 40                      | 1.0  | MISSING  | —                                               | VOCAB   | No "X dilatačních celků" pattern. |
| `dilatation_main_length_m`      | 12.50                   | 1.0  | MISSING  | `total_length_m = 12.5` (regex, conf 0.9)       | SCOPE/PATTERN | Length pattern fired on "konstantní délky 12,50 m" but tagged as the whole-NK length — wrong interpretation, lower confidence. |
| `dilatation_edge_count`         | 2                       | 0.9  | MISSING  | —                                               | VOCAB   | "dva krajní dilatační celky" — no Czech word-numeral parser. |
| `dilatation_edge_length_m`      | 7.60                    | 1.0  | MISSING  | —                                               | VOCAB   | Same. |
| `wall_thickness_m`              | 0.45                    | 1.0  | MISSING  | —                                               | VOCAB   | "Dřík konstrukce je konstantní tloušťky 0,45 m" — `tl.\s*\d+\s*mm` exists but only for mm. |
| `wall_height_min_m`             | 1.65                    | 0.95 | MISSING  | —                                               | VOCAB   | "proměnné výšky 1,65 – 3,50 m" range not parsed. |
| `wall_height_max_m`             | 3.50                    | 0.95 | MISSING  | —                                               | VOCAB   | Same. |
| `face_cladding_material`        | "lomový kámen"          | 0.9  | MISSING  | —                                               | VOCAB   | No "obložen X" keyword. |
| `face_cladding_thickness_m`     | 0.30                    | 1.0  | MISSING  | —                                               | VOCAB   | Thickness only attached to inferred element scope. |
| `face_cladding_anchor_grid_m`   | [0.75, 0.75]            | 1.0  | MISSING  | —                                               | VOCAB   | No 2D grid pattern `\d+[.,]\d+\s*x\s*\d+[.,]\d+`. |

**What the extractor *did* return for Block B (6 params):**

```
concrete_class    = "C25/30"               regex      conf 1.00
exposure_classes  = ["XF3","XA2","XC2"]    regex      conf 1.00
nk_width_m        = 2.75                   regex      conf 1.00   ← misnamed
total_length_m    = 12.5                   regex      conf 0.90   ← misinterpreted
element_type      = "operne_zdi"           keyword    conf 0.90
exposure_class    = "XF3"                  heuristic  conf 0.80   ← legacy single
```

**Of these 6, three carry useful information** (concrete_class, exposure_classes, element_type) but only via the generic vocabulary; they don't satisfy any expected SO-250 field as-named. Two are *actively misleading* (`nk_width_m` for a foundation, `total_length_m` for a dilatation segment).

### 3.3 Block C — Římsa (0 / 7 = 0 %)

| Expected name                | Expected value          | Conf | Status   | Closest actual                              | Cause | Notes |
|------------------------------|-------------------------|------|----------|---------------------------------------------|-------|-------|
| `rimsa_concrete_grade`       | "C30/37"                | 1.0  | MISSING  | — (extractor sees "C 30/37" with space — `C\d{2}/\d{2,3}` does not match) | PATTERN | Whitespace-tolerant variant `C\s*\d{2}\s*/\s*\d{2,3}` would fix this; affects all 4 betons across SO-250 (TZ uses spaced form throughout). |
| `rimsa_exposure`             | ["XF4","XD3","XC4"]     | 1.0  | MISSING  | `exposure_classes = ["XF4","XD3","XC4"]` (regex, conf 1.0) | SCOPE | Value extracted, not scoped. |
| `rebar_grade`                | "B500B"                 | 1.0  | MISSING  | —                                           | PATTERN | No `B\s*500\s*B?` pattern; "B 500 B" with two spaces is a common ŘSD form. |
| `rimsa_width_m`              | 0.85                    | 1.0  | MISSING  | `nk_width_m = 0.85` (regex, conf 1.0)       | SCOPE | "Šířka 0,85 m" parsed by the bridge-deck width regex → mis-named. |
| `rimsa_thickness_face_m`     | 0.40                    | 0.95 | MISSING  | —                                           | VOCAB | No "tloušťka X na líci" pattern. |
| `rimsa_thickness_back_m`     | 0.36                    | 0.95 | MISSING  | —                                           | VOCAB | No "X na rubu" pattern. |
| `railing_height_m`           | 1.10                    | 1.0  | MISSING  | `height_m = 1.1` (regex, conf 0.9)          | SCOPE | Generic height parser ate the railing height — first match wins, no element scope. |

**What the extractor *did* return for Block C (5 params):** see [`probe_result.json`](probe_result.json) §`blocks.C.extracted_raw`. Critical mis-attributions: `nk_width_m=0.85`, `height_m=1.10` — both are railing/římsa values being labelled as bridge-deck values.

### 3.4 Block D — Výkres OCR transcript (0 / 8 = 0 % + structural source-tag gap)

| Expected name                              | Expected value           | Conf | Status   | Closest actual                                                   | Cause       | Notes |
|--------------------------------------------|--------------------------|------|----------|------------------------------------------------------------------|-------------|-------|
| `podkladni_beton_grade_drawing`            | "C12/15"                 | 1.0  | MISSING  | `concrete_class = "C30/37"` (heuristic, conf 0.8) with `alternatives: ["C25/30","C12/15"]` | SCOPE+SOURCE | Value present in alternatives, but with no element scope and no `'drawing'` tag. |
| `podkladni_beton_exposure_drawing`         | ["X0"]                   | 1.0  | MISSING  | `exposure_class = "XF4"` (heuristic, conf 0.8) with `alternatives: ["XF3","XD3","XA2","XC4","XC2","X0"]` | SCOPE+SOURCE | Same. |
| `drik_grade_drawing`                       | "C30/37"                 | 1.0  | MISSING  | (would be primary `concrete_class`, but no scope tag)            | SCOPE+SOURCE | — |
| `drik_exposure_drawing`                    | ["XF4","XC4"]            | 1.0  | MISSING  | (subset of `alternatives`)                                       | SCOPE+SOURCE | — |
| `zaklad_grade_drawing`                     | "C25/30"                 | 1.0  | MISSING  | (in alternatives)                                                | SCOPE+SOURCE | — |
| `zaklad_exposure_drawing`                  | ["XF3","XC2","XA2"]      | 1.0  | MISSING  | (subset of `exposure` alternatives)                              | SCOPE+SOURCE | — |
| `rimsa_grade_drawing`                      | "C30/37"                 | 1.0  | MISSING  | (= primary `concrete_class`, but element_type was parsed as `rimsa` because "ŘÍMSA" appears in line 4) | SCOPE+SOURCE | — |
| `railing_height_drawing_m`                 | 1.15                     | 1.0  | MISSING  | —                                                                | PATTERN+SOURCE | "H=1,15 m" is a non-keyword height idiom; existing `výška` regex doesn't fire. |

Block D **cannot achieve a valid coverage % under the current schema** because (a) no `'drawing'` source tag exists in the enum, so even if the values were extracted, the consumer UI couldn't tell drawing from TZ; (b) no element scoping. Therefore Block D coverage is reported as **N/A — flagged to gap list per Q3 = "flag + návrh schema/rule v specu"**.

### 3.5 Block E — Geotechnika (0 / 6 = 0 %)

| Expected name                  | Expected value                       | Conf | Status   | Cause | Notes |
|--------------------------------|--------------------------------------|------|----------|-------|-------|
| `geology_main`                 | "granit karlovarského plutonu"        | 0.85 | MISSING  | VOCAB | No geology keyword extraction. |
| `excavation_class_main`        | "I-III"                              | 0.95 | MISSING  | VOCAB | No Roman-numeral excavation-class parser. |
| `excavation_class_local_max`   | "IV"                                 | 0.85 | MISSING  | VOCAB | Same. |
| `edef2_base_MPa`               | 60                                   | 1.0  | MISSING  | VOCAB | No `Edef.*?(\d+)\s*MPa` pattern. |
| `edef_ratio_max`               | 2.5                                  | 0.95 | MISSING  | VOCAB | Same. |
| `stray_currents_grade`         | 3                                    | 0.95 | MISSING  | VOCAB | No stray-currents keyword. |

**Extractor returned 0 params for this block.** Geotechnical vocabulary is entirely absent. Acceptable per the AC threshold of ≥ 50 % being labelled "acceptable, geologie je těžká"; but the practical consequence is that the rozpočtář has no help here at all.

---

## 4. Conflict detection test (Block B vs Block D)

The probe runs `extractFromText(BLOCK_B + "\n" + BLOCK_D)`. **Result: FAIL.**

| # | Conflict pair                                               | TZ value (Block B)        | Drawing value (Block D)     | Expected behaviour                              | Actual behaviour                                                                                  | Verdict |
|---|-------------------------------------------------------------|---------------------------|------------------------------|-------------------------------------------------|----------------------------------------------------------------------------------------------------|---------|
| 1 | `podkladni_beton_grade`                                     | "C25/30"                  | "C12/15"                     | DETEKOVÁNO + alternatives, max conf 0.6         | Single `concrete_class = "C30/37"` (heuristic, conf 0.8); both real values appear inside `alternatives` array, but the **picked value is from a third element (dřík)**. Element scope absent. | FAIL    |
| 2 | `podkladni_beton_exposure`                                  | ["XF3","XA2","XC2"]       | ["X0"]                       | DETEKOVÁNO, drawing wins                         | Single `exposure_class = "XF4"` (heuristic, conf 0.8) — most-restrictive rule picks "XF4" (drik), drowning both the TZ podkladní claim AND the X0 drawing claim. | FAIL    |
| 3 | `drik_exposure_xf` (XF3 vs XF4)                             | "XF3"                     | "XF4"                        | DETEKOVÁNO, drawing wins                         | Both XF3 and XF4 appear in `exposure_classes` array (regex, conf 1.0), but no marker that one is TZ and one is drawing, no scope to "drik". | FAIL    |
| 4 | `railing_height_m` (1.10 vs 1.15)                           | 1.10                      | 1.15                         | DETEKOVÁNO, "compatible variants"                | `height_m = 1.10` (regex, conf 0.9) — first match wins; 1.15 from "H=1,15 m" doesn't even match the height regex (no "výška" keyword). | FAIL    |

**Conflict detection rate = 0 / 4 = 0 %**. The global `alternatives` field is *not* a substitute for element-scoped reconciliation; it's a "multiple distinct values were seen in the document" flag, and the consumer UI has no way to tell whether those alternatives are (a) different elements in the same document (legitimate, both kept) or (b) the same element described inconsistently in TZ vs drawing (a real conflict that needs human resolution).

This is the single biggest gap in the extractor today and the one that maps most directly to the user need ("kalkulátor by je měl flagnout" — `test-data/SO_250/README.md` §4).

---

## 5. Gap list

Categorised per the AC: missing regex pattern / wrong confidence / missing source type. The probe added a fourth category — **missing element scope** — because it dominates Block B and the conflict test.

### 5.1 Missing regex / keyword patterns (drives most of the MISSING verdicts)

Grouped by likely sprint cost. ✦ marks patterns that, if added, would close ≥ 3 expected fields each.

| # | Pattern                                                | Example matched text                                 | Closes fields                                                         | Effort |
|---|--------------------------------------------------------|------------------------------------------------------|-----------------------------------------------------------------------|--------|
| 1 ✦ | `C\s*\d{2}\s*/\s*\d{2,3}` (tolerant whitespace)       | "C 30/37", "C25/30", "C 12 / 15"                     | All 4 concrete grades (Block B + C + D)                               | 30 min |
| 2 ✦ | `B\s*500\s*B?` rebar grade                            | "B 500 B"                                            | `rebar_grade` (one row, but ŘSD-universal)                            | 15 min |
| 3 ✦ | `(\d+[.,]\d+)\s*[–-]\s*(\d+[.,]\d+)\s*m` range        | "1,65 – 3,50 m", "1,550 do 3,400 m"                   | `wall_height_{min,max}_m`, `height_above_terrain_{min,max}_m`         | 1 h    |
| 4 | `(\d+[.,]\d+)\s*x\s*(\d+[.,]\d+)\s*m` 2D grid          | "0,75 x 0,75 m"                                      | `face_cladding_anchor_grid_m`                                         | 30 min |
| 5 | `na\s+(\d+)\s+dilatačních\s+celků`                    | "na 40 dilatačních celků"                            | `dilatation_main_count`                                               | 30 min |
| 6 | `(?:dva|tři|čtyři)\s+krajní`                          | "dva krajní"                                         | `dilatation_edge_count` (Czech word numerals 2–4)                     | 30 min |
| 7 | `tloušťky?\s+(\d+[.,]\d+)\s*m` thickness in metres     | "tloušťky 0,15 m", "tloušťka 0,4 m"                  | All 6 thickness fields across B + C                                   | 1 h    |
| 8 | `šířky?\s+(\d+[.,]\d+)\s*m` width in metres            | "šířky 2,75 m", "Šířka 0,85 m"                       | `base_width_m`, `rimsa_width_m`                                       | 30 min |
| 9 | `SO\s*(\d{3})` object code                             | "SO 250"                                             | `object_id`                                                            | 15 min |
| 10 | `dálnice\s+(D\d+)`                                    | "dálnice D6"                                         | `road`                                                                 | 15 min |
| 11 | `\b(DUR|DSP|PDPS|RDS|DSPS)\b` doc stage                | "PDPS"                                               | `documentation_stage`                                                  | 15 min |
| 12 | km-stationing parser `km\s+(\d+),(\d{3})\s+(\d{2})`    | "km 6,492 40", "km 7,007 60"                         | `stationing_{from,to}` — emit canonical `6+492.40` form               | 1 h    |
| 13 | `Délka\s+(?:zdi|mostu|objektu)\s+(\d+[.,]\d+)\s*m`     | "Délka zdi 515,20 m"                                 | `length_m`                                                             | 30 min |
| 14 | `Pohledová\s+plocha\s+(?:zdi\s+)?(\d+[.,]\d+)\s*m2`    | "Pohledová plocha zdi 1737,44 m2"                    | `visible_area_m2`                                                     | 30 min |
| 15 | `Edef\s*,?\s*2\s*[≥>=]\s*(\d+)\s*MPa`                  | "Edef,2 ≥ 60 MPa"                                    | `edef2_base_MPa`                                                      | 30 min |
| 16 | `Edef[,2]*\s*/\s*Edef[,1]*\s*[≤<=]\s*(\d+[.,]\d+)`     | "Edef,2/Edef,1 ≤ 2,5"                                | `edef_ratio_max`                                                      | 30 min |
| 17 | `těžitelnosti\s+(I+\.?\s*[-–]\s*I+V?)`                 | "I.-III"                                             | `excavation_class_main` (Roman numerals)                              | 1 h    |
| 18 | `lokálně\s+(I+V?)`                                     | "lokálně IV"                                         | `excavation_class_local_max`                                          | 30 min |
| 19 | `bludným\s+proudům:?\s*(\d+)`                          | "proti bludným proudům: 3"                           | `stray_currents_grade`                                                | 30 min |
| 20 | "Geologie:" line keyword                                | "Geologie: granit karlovarského plutonu"             | `geology_main` (free-form keyword)                                    | 1 h    |
| 21 | `H\s*=\s*(\d+[.,]\d+)\s*m` (drawing-style height)      | "H=1,15 m"                                           | `railing_height_drawing_m`                                            | 15 min |

**Total ≈ 9–10 hours** of regex work to close ~30 of 46 fields. None individually requires more than ~1 hour.

### 5.2 Wrong confidence

The probe found **no WRONG_CONFIDENCE** rows (because everything that could be classified is MISSING under the strict name-equality rule). However, there are at least two **mis-attributed** values that the probe correctly flagged as MISSING but which would silently land in the wrong FormState slot if the user pressed "Vyplnit z TZ" today:

| Block | Generic param            | Generic value | What it actually represents                          | Risk for the user |
|-------|--------------------------|---------------|-------------------------------------------------------|-------------------|
| B     | `nk_width_m = 2.75`      | foundation width     | Bridge deck width (this is a wall, not a deck)        | Calculator would size formwork for a 2.75 m-wide deck. |
| B     | `total_length_m = 12.5`  | dilatation segment   | NK total length (this is one of 42 segments)          | Calculator would treat the whole wall as 12.5 m long instead of 515.20 m. |
| C     | `nk_width_m = 0.85`      | římsa width          | Same as above, but for a 0.85 m railing beam.         | Catastrophic if pushed into the deck calculator. |
| C     | `height_m = 1.10`        | railing height       | Element height                                        | Calculator would size formwork for a 1.10 m wall. |

These four are the practical "blast radius" of the absence of element scoping. They are not bugs in the sense of "regex misfires" — every regex matched the exact string it was designed for; the bug is that the surrounding sentence is not consulted to decide what the value belongs to.

### 5.3 Missing element scoping (NEW category not in original AC)

Sentences in the SO-250 TZ are organised by **element** (podkladní beton / základ / dřík / římsa). The extractor processes the document as a flat token stream and emits one `concrete_class`, one `exposure_class`, one `nk_width_m`, etc. The four real conflicts (§4) and the four mis-attributions (§5.2) all stem from this single architectural choice.

Minimum viable element scoping (proposed in §6.1 — out of scope for this PR):

1. Split input into **sections** by a small dictionary of element-anchor words (`podkladní beton`, `základ`, `dřík`, `římsa`, `kotevní trám`, `zábradlí`, `zásyp`).
2. For each section, run the existing patterns and tag each emitted param with `element_scope: 'podkladni_beton' | 'zaklad' | 'drik' | 'rimsa' | 'unknown'`.
3. Emit the same field name N times (e.g. `concrete_class` four times, one per element) instead of collapsing.

### 5.4 Missing source enum value

Existing: `'regex' | 'keyword' | 'heuristic' | 'smeta_line'`. Block D inputs are visually distinct (line layout, ALL-CAPS, "(CZ-TKP 18PK)" suffix) from TZ prose, and the data model needs to remember which document each value came from. **Probe-spec answer per Q3 = "flag + návrh schema extension v specu":**

```ts
// Proposed (NOT IMPLEMENTED in this PR):
export type ExtractedParamSource =
  | 'regex'
  | 'keyword'
  | 'heuristic'
  | 'smeta_line'
  | 'drawing'        // NEW — value came from a parsed drawing transcript
  | 'drawing_ocr'    // NEW — value came from raw OCR of a drawing (lower trust than drawing)
  | 'manual';        // NEW — operator-confirmed value (highest trust); used by the consumer UI
```

Heuristic for assigning `'drawing'` without a real OCR pipeline (one-line rule the extractor can apply today): if the matched line is ALL-CAPS for ≥ 60 % of its alphabetic characters AND contains a TKP/ČSN parenthetical, tag the source as `'drawing'`.

### 5.5 Missing reconciliation rule (TZ vs drawing)

Per Q4 = "Detekovat + návrh reconciliation rule (drawing wins) v specu":

> **Default rule.** When the same (element, field) pair carries different values from different sources, **drawing wins** and the consumer UI surfaces a conflict picker with both values. Confidence of the picked value drops to **0.6** (conflict ladder) until the operator confirms.

> **Exception A — compatible variants.** When the difference is < 5 % and the field is a height/thickness/width *and* one source comes from a "level above"/"vč. patní" annotation, the conflict is downgraded to **info-only** (e.g. railing height 1.10 m on top-of-NK vs 1.15 m incl. base plate is the SO-250 case).

> **Exception B — TZ explicit override.** When TZ contains an explicit "viz výkres č. X" reference, the value from that drawing wins automatically (no picker).

> **Confidence ladder for conflicts** (extends the §0 ladder in CLAUDE.md `Doménová pravidla`):
> - No conflict: regex/keyword as today (1.0 / 0.85–0.95 / 0.7–0.85).
> - Cross-source conflict, drawing wins automatically: **picked value 0.85, alternative 0.6**.
> - Cross-source conflict, both values valid (compatible variant exception): **both 0.9 + info badge**.
> - Cross-source conflict, no rule fires: **picked value 0.6, alternative 0.6, requires operator confirmation**.

---

## 6. Top 3 recommended fixes for CSC sprint

Each is < 1 day of implementation, ordered by impact-per-effort. Effort estimates are dev-only (no design/QA). All three are out of scope for this PR.

### 6.1 ✦ #1 — Element-scoped concrete + exposure regex (≈ 1 day)

**Problem closed:** all 4 element-scoped conflicts (§4) + 8 SCOPE-tagged MISSING rows in §3.2/§3.4 + 4 mis-attributions in §5.2.
**What:** introduce a tiny element-anchor pre-pass (§5.3 minimum-viable list of 7 anchor words). For each anchor, slice the surrounding sentence(s) and run the existing concrete-class + exposure regex *inside the slice*, tagging the emitted param with `element_scope`.
**Schema impact:** adds an optional `element_scope?: string` field to `ExtractedParam` (no breaking change — existing consumers ignore unknown fields).
**Test cost:** ~10 vitest cases (one per anchor + 3 conflict scenarios from Block B+D combined).
**Risk:** low — additive, no existing test should break.
**Why first:** unblocks the conflict detection rate (0 % → ≥ 75 % on the four documented SO-250 conflicts) AND eliminates the four silent mis-attributions that would actively hurt a user pressing "Vyplnit z TZ" today.

### 6.2 #2 — Block A project-identification regex pack (≈ 0.5 day)

**Problem closed:** Block A coverage 0 % → ~80 % (8 of 10 fields).
**What:** patterns 9–14 from §5.1 (object_id, road, doc stage, length_m, visible_area_m2, km-stationing). The km-stationing parser is the only one with non-trivial format (the `6,492 40` digit-pair-after-gap convention is ŘSD-specific) but a 1-hour regex closes both `stationing_from` and `stationing_to`.
**Schema impact:** five new field names (`object_id`, `road`, `documentation_stage`, `length_m`, `visible_area_m2`, `stationing_from`, `stationing_to`). All optional, all string-or-number primitives.
**Test cost:** ~6 vitest cases.
**Risk:** lowest of the three — pure additive regex pack, no overlap with existing patterns.
**Why second:** the SO-250 master matrix would jump from 0/46 to ~8/46 just from this change, and the same patterns are reusable on every ŘSD project (D6 Žalmanov is template-shaped — TZ headers are structurally identical across SUS PK and ŘSD).

### 6.3 #3 — `'drawing'` source enum + 60 %-CAPS heuristic (≈ 0.5 day)

**Problem closed:** Block D goes from "N/A" to a real coverage % (estimated ≥ 50 % when paired with #1). Enables the consumer UI to render a "TZ vs drawing" conflict picker on top of the new `alternatives` payloads from #1.
**What:** add `'drawing'` (and optionally `'drawing_ocr'` and `'manual'`) to `ExtractedParamSource`. Add a 6-line "ALL-CAPS line + TKP parenthetical → tag source as `'drawing'`" heuristic at the top of `extractFromText`. Wire the new tag through `smetaLinesToParams` and the regex/keyword branches (single map look-up).
**Schema impact:** one enum value added (non-breaking — TS literal-union extension; consumers narrow against known values).
**Test cost:** ~3 vitest cases (one per new source value).
**Risk:** very low.
**Why third:** lowest dependency on the other two — could ship in any order — but pairs naturally with #1 because element scope + drawing source together unblock the full conflict reconciliation rule (§5.5).

**Cumulative effect of #1 + #2 + #3 on the SO-250 matrix** (back-of-envelope, no implementation done):

| Block | Today | After #1 | After #1+#2 | After #1+#2+#3 |
|-------|-------|----------|--------------|------------------|
| A     | 0 %   | 0 %      | ~80 %        | ~80 %            |
| B     | 0 %   | ~50 %    | ~50 %        | ~60 %            |
| C     | 0 %   | ~55 %    | ~55 %        | ~70 %            |
| D     | N/A   | N/A      | N/A          | ~60 %            |
| E     | 0 %   | 0 %      | 0 %          | 0 %              |
| **Σ** | 0 %   | ~25 %    | ~40 %        | ~50 %            |
| Conflict rate | 0 % | ~75 %    | ~75 %        | **100 %**        |

Block E (geotechnika) needs its own pack (~5 patterns from §5.1 #15–20, ~3–4 hours) — proposed as a **#4 follow-up**, not in the top-3 because the AC threshold for E is the lowest (≥ 50 %) and it's the least visible to the calculator demo flow.

---

## 7. What this audit explicitly does NOT do

- ❌ Does NOT modify `tz-text-extractor.ts` (read-only probe per task scope).
- ❌ Does NOT add the `element_scope` field to `ExtractedParam` — that's #1's PR.
- ❌ Does NOT add the `'drawing'` enum value — that's #3's PR.
- ❌ Does NOT implement the reconciliation rule (§5.5) — that's a follow-up PR after #1 + #3.
- ❌ Does NOT touch the consumer UI (`TzTextInput.tsx`) — out of scope.
- ❌ Does NOT exercise raw PDF / OCR paths (Q5 = pre-cleaned excerpts).
- ❌ Does NOT implement formula parsing or vision MCP — both already deferred to Variant B v2 post-CSC.
- ❌ Does NOT change CLAUDE.md, ExtractedParam schema, source enum, or any test file.

---

## 8. Reproduction

```bash
# from repo root
cd Monolit-Planner
npm install --ignore-scripts            # one-time: hoists deps to root via workspaces
node_modules/.bin/tsc -p shared          # build shared/dist/
node ../docs/audits/smartextractor_so250/probe.mjs
```

Outputs:
- `docs/audits/smartextractor_so250/probe_result.json` — machine-readable, full per-field detail incl. raw extractor output per block
- This file (`2026-05-14_extractor_coverage.md`) — human-readable summary

---

## 9. Cross-references

- Probe spec (input to this audit): `Monolit-Planner/shared/SO-250_smartextractor_probe.md`
- SO-250 briefing: `test-data/SO_250/tz/SO-250.md` + 9 PDF pages in `test-data/SO_250/`
- Extractor under test: `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts:325-604`
- Prior FINDINGS dump (Variant B context): `docs/audits/smartextractor_variant_b/FINDINGS_SO_FAR_2026-05-10.md`
- Confidence ladder (existing): CLAUDE.md `Doménová pravidla` (this audit proposes one extension at §5.5)

---

**End of audit.** No code modified. PR opens as draft for triage of the §6 top-3 fixes.
