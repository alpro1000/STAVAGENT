# Bug: build_bridge_passport — honest gaps ✅ but under-extracts (live SO-202)

**Reported:** 2026-07-13 (Alexander, live run of `build_bridge_passport` against the
real SO-202 D6 Olšová Vrata–Žalmanov TZ, no soupis).
**Severity:** ⛔⛔⚠️⚠️⚠️ — invariant (honesty) holds, extraction incomplete; two
defects hit the exact money-path fields the exposure- and height-skruž fixes just
repaired (+51 % aggregate).

## What works (invariant holds — no fabrication)
- `_meta.gaps` honest + detailed («no soupis provided — all elements NEPOČÍTÁNO»). No
  invented numbers.
- SO-code + name extracted; geometry `spans [32.0, 44.5, 32.0]`, `spans_count 3`,
  `width_per_deck_m 13.65` — all correct from TZ.
- honest-ignore works: a prose fragment mis-classified as `schodiste` was skipped
  with an explanation, did not break the passport.

## The 5 defects (all EXTRACTION layer, not logic)

### ⛔ 1. Element duplicates — deck ×3 (PRIORITY 1)
`quantities.items` = 10 rows for 5 unique elements: `superstructure_deck` ×3,
`foundations_piers` ×2, `pier_shafts` ×2, `abutments` ×2, `rims` ×1. One element
extracted from several text spans, not deduplicated by passport key. With a real
soupis this would triple the deck in the calc. Manual example = 9 UNIQUE keys.
**Target:** the assembler emits ONE item per passport key (merge quantities on
collision, never repeat the key).

### ⛔ 2. Exposure classes dropped (PRIORITY 2)
TZ carries `C30/37-XF4+XD3+XC4`, `C35/45-XF2+XD1+XC4`, `C30/37-XF1+XA2+XC2`; the
passport keeps only `C30/37` / `C35/45`. The `-XF..+XD..+XC..` suffix is discarded
by `_CONCRETE_RE` (grade-only `C\d+/\d+`). This is a regress vs the manual example
(full strings) and breaks the just-shipped exposure→curing path: XF4 ⇒ min 7 d
curing (TKP18 §7.8.3). **Target:** `materials_and_standards.concretes[].class`
carries the full grade+exposure string (fixture ground truth:
`example_SO202_zalmanov.json` → `C35/45-XF2+XD1+XC4`, `C30/37-XF4+XD3+XC4`, …).

### ⚠️ 3. deck_pour_stages + falsework declared a vision gap although they are in the TZ TEXT (PRIORITY 3)
Gap says «construction_process … stage 2 vision — not extracted», but TZ §4.1.6:
«na pevné skruži **ve třech etapách**». The most calc-critical fact (3 tacts +
pevná skruž) is deterministic in the text; half-B leaves it for vision. **Target:**
regex-extract `deck_pour_stages` (`_CZ_NUMERALS`: «třech/3 etapách/taktech») +
`falsework_technology` (`_FALSEWORK_STEMS`: «pevná skruž» → fixed_scaffolding,
«posuvná» → mss) from the TZ text at stage 1; vision stays fallback/corroboration.
Reuse the `walk_drawings.py` notes-gate stems (already built). Source tag = TZ
section ref.

### ⚠️ 4. Deck heights declared a drawing gap although they are in the TZ TEXT (PRIORITY 4)
Gap says «geometry.decks … stage 2 drawings», but TZ §2 «Výška mostu nad terénem»:
8,10 / 14,90 / 9,90 m — exactly the values that feed `height_m=14.9` → skruž →
+3,2 M Kč. **Target:** extract the heights into `geometry.decks[].deck_height_over_terrain_m`
(fixture: dict `{road_III_00625: 8.1, stream: 14.9, field_road: 9.9}`; a first cut
emitting the MAX number is sufficient for half-A, which takes max anyway).

### ⚠️ 5. «Úložné prahy / záv. zdi / křídla» collapse into a dup `abutments` (PRIORITY 5)
Manual has `abutment_seatings_and_wings` as its own concrete-use; here it folded into
`abutments`. Architectural: the element map's own comment says the
W3-classifier→passport-key roll-up axis is «NOT here yet» — needs a new passport key
+ the roll-up axis. **Gate-3 follow-up**, not a quick regex.

## Blocker for #2–#5 regex fidelity
The real SO-202 TZ text lives under `test-data/**`, which `.claude/settings.json`
DENIES reading — so extraction regex must be written/verified against the real
prose, not a synthetic guess (the exact trap that let these ship past golden). Cure
per the v4.36/v4.37 `_tz_facts.md` convention: commit a readable TZ digest (verbatim
lines for materials / §2 heights / §4.1.6 stages) to a non-denied path so the regex
targets a real document. #2/#3 are low-risk against standard Czech notation + the
verbatim quotes above; #4 medium; #5 architectural.

## Meta lesson
All 5 found ONLY by the live run on a real document; the golden (keys ⊆ example)
passed because it checked STRUCTURE, not WHAT was extracted. New golden tests must
assert CONTENT (exposure suffix present, no duplicate keys, stages/heights populated),
not just shape.
