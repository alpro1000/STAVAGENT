# DXF Parser Quality Scorecard

**Generated:** Phase 2 step 5  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Parser:** `concrete-agent/packages/core-backend/app/services/dxf_parser.py`  
**Source:** 14 DXF files in `test-data/libuse/inputs/dxf/`  

## Per-drawing summary

| # | DXF | Role | Rooms / w-code / w-area | Doors / w-code | Wins / w-code | Curt | Tags | Verdict |
|---|---|---|---|---|---|---:|---:|---|
| 1 | `185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP` | primary_pudorys | 72 / 72 / 70 | 71 / 57 | 0 / 0 | 0 | 121 | ✅ pass  |
| 2 | `185-01_DPS_D_SO01_100_4040_R00 - odvodneni teras` | SKIP | — | — | — | — | — | skipped |
| 3 | `185-01_DPS_D_SO01_100_5000_R01 - ŘEZY 1-PP` | section | 0 / 0 / 0 | 8 / 0 | 0 / 0 | 0 | 5 | ✅ pass  |
| 4 | `185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP` | primary_pudorys | 20 / 20 / 20 | 28 / 22 | 11 / 11 | 6 | 97 | ✅ pass  |
| 5 | `185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP` | primary_pudorys | 25 / 25 / 25 | 26 / 20 | 17 / 15 | 6 | 83 | ✅ pass  |
| 6 | `185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP` | primary_pudorys | 23 / 23 / 23 | 22 / 19 | 20 / 9 | 3 | 67 | ⚠️ review windows_w_code 45% < 70% |
| 7 | `185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha` | roof_plan | 0 / 0 / 0 | 0 / 0 | 19 / 3 | 0 | 40 | ✅ pass  |
| 8 | `185-01_DPS_D_SO01_140_5400_R01 - OBJEKT D - ŘEZY` | section | 0 / 0 / 0 | 13 / 0 | 0 / 0 | 0 | 27 | ✅ pass  |
| 9 | `185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY` | elevation | 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 | 38 | ✅ pass  |
| 10 | `185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. ` | podhledy_plan | 20 / 20 / 20 | 28 / 0 | 11 / 0 | 6 | 54 | ✅ pass  |
| 11 | `185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. ` | podhledy_plan | 21 / 21 / 21 | 26 / 0 | 15 / 0 | 6 | 50 | ✅ pass  |
| 12 | `185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. ` | podhledy_plan | 20 / 20 / 20 | 22 / 0 | 14 / 0 | 3 | 44 | ✅ pass  |
| 13 | `185-01_DPS_D_SO01_140_ARS objekt D_desky` | SKIP | — | — | — | — | — | skipped |
| 14 | `18501_DPS_D_SO01_140_9421_R00_jadra D 2NP` | coordination | 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 | 0 | ✅ pass  |

## Drawing roles

Drawing types have different expected content; the verdict applies role-specific thresholds (e.g. podhledy don't need opening tags, sections don't need rooms).

| Role | Drawings | Threshold (rooms_w_code / poly_match / doors / windows) |
|---|---:|---|
| `coordination` | 1 | — / — / — / — |
| `elevation` | 1 | — / — / — / — |
| `podhledy_plan` | 3 | 95% / 90% / — / — |
| `primary_pudorys` | 4 | 95% / 90% / 70% / 70% |
| `roof_plan` | 1 | — / — / — / 10% |
| `section` | 2 | — / — / — / — |

## Aggregated headline metrics

### Rooms (deduped by code)

- Unique room codes parsed (with area): **138**
- Tabulka místností has **318** total (111 D-related)
- Coverage of D-related codes: **109 / 111** (98.2 %)

### Openings (raw, across all drawings — same opening counted once per drawing)

- Doors: **244** total — with type code: **118** (48.4 %)
- Windows: **107** total — with type code: **38** (35.5 %)
- Curtain walls: **30**

_Note:_ each room/opening is exported into both the půdorys and the podhledy drawing of the same floor (same model exported twice). Door/window tag extraction by design only succeeds on půdorysy (podhledy show outlines but no D##/W## tags). The per-drawing verdict above is the accurate gauge; this aggregate dilutes the signal across drawing types.

### Segment tags by prefix (across all valid drawings)

| Prefix | Count | Drawings | Category | Notes |
|---|---:|---:|---|---|
| `OP##` | 183 | 11 | other_product |  |
| `LI##` | 164 | 5 | lista_or_internal | Broad — disambiguate via Tabulka klempířských in Phase 3 |
| `OS##` | 85 | 3 | lighting | Lighting — out of finishing scope |
| `LP##` | 58 | 7 | zamecnik_railing |  |
| `TP##` | 49 | 4 | klempir |  |
| `CF##` | 42 | 3 | ceiling_finish_skladba |  |
| `WF##` | 29 | 3 | wall_finish_skladba |  |
| `CW##` | 11 | 4 | unknown |  |
| `F##` | 5 | 3 | floor_or_facade_finish | Disambiguate facade vs floor in Phase 3 via Tabulka skladeb |

## Cross-validation against Tabulka místností

Compares parser-extracted room areas against the official Tabulka. Tolerance ±2 % per task spec.

- Tabulka D-related codes: **111**
- DXF unique D-related codes (with area): **109**
- Codes in BOTH: **109**
- Within ±2 %: **109 / 109** (100.0 %)
- Outside ±2 %: **0**

- Codes in Tabulka but NOT in DXF: **2**
  By floor: {'sklep / 1.PP': 2}
- Codes in DXF but NOT in Tabulka: **0**

## Verdict

Acceptance criteria (drawing-type aware):

- Primary půdorysy + podhledy without ⚠️: **6 pass / 1 review** ❌
- Tabulka cross-check ≥ 95 % within ±2 %: **100.0 %** ✅
- No critical parser errors: **errors detected** ❌

### ⚠️ NEEDS REVIEW
- 1 primary drawing(s) flagged — see per-drawing verdict

### Known caveats

- DWG dataset covers only **objekt D + společný 1.PP**. A/B/C půdorysy exist only as PDFs. Cross-validation can only assess D-related codes; coverage gap for A/B/C is expected per Session 1 inventory.
- F## tag prefix is ambiguous (facade Terca F08 vs floor finish F0x). Parser flags with a warning; Phase 3 disambiguates via Tabulka skladeb.
- Some doors on Půdorys 1.NP are `ABMV_CW_Single_Swing_Generic` INSERTs (operable curtain-wall sklopná křídla) registered on `A-DOOR-OTLN` — they have no D## tag because they're parts of a curtain wall, not standalone doors. The 78.6 % door-tag rate on 1.NP D reflects this and is correct.
- Sklepy / 1.PP suterén use a third room-code format `S.{objekt}.{NN}` (distinct from byt-podlaží `D.1.4.02` and společné NP `D.1.S.01`). Parser regex was extended to match all three patterns.