# Libuše Objekt D — Next Session Handoff

Last updated: 2026-05-04 (Phase 8 List 11 added)

## Status

Phase 8 List 11 Sumarizace complete. Excel ready for KROS manual ÚRS pricing.

## Project metadata

- Bytový soubor Libuše objekt D — sideline freelance
- Klient: VELTON REAL ESTATE
- Generální projektant: ABMV world s.r.o.
- Akce: 185-01, DPS revize 01 z 30/11/2021
- Deadline: 11.05.2026
- Hrubá stavba HOTOVÁ — předmětem zakázky dokončovací práce
- Geometrie komplex: 4 objekty A/B/C/D + společný 1.PP, 36 bytů,
  35 sklepů, 3 obchodní jednotky, 44 parkovacích stání
- Objekt D: 348.71 m², 3 NP + podkroví + společný suterén,
  sedlová střecha 30°-67°
- DWG dataset pokrývá pouze objekt D + spol. 1.PP (A/B/C only PDF)

## Branch

`claude/phase-0-5-batch-and-parser`

## Phase progression

- ✅ Phase 0.0–0.5  — file reorganization + DWG/DXF infrastructure
- ✅ Phase 0.7      — geometric validation (109 rooms 100 % match)
- ✅ Phase 1        — geometric extraction enriched
- ✅ Phase 2        — DXF parser
- ✅ Phase 3a-e     — 2277 base items generated
- ✅ Phase 5        — audit proti starému VV
- ✅ Phase 6        — Excel draft (10 sheets)
- ✅ Phase 6.1      — counts + osazení pairing
- ✅ Phase 6.2      — osazení reclassification
- ✅ Phase 6.3      — audit (10 HIGH gaps + 28 OP edge cases found)
- ✅ Phase 6.4      — fix gaps + +221 material dodávka items (final 2548 items)
- ✅ Phase 7a Part 1 — 579 query groups built (group-first approach)
- ⏸️ Phase 7a Part 2 — DEFERRED (manual KROS ÚRS pricing instead)
- ✅ Phase 8        — List 11 sumarizace added (manual KROS workflow)

## Critical findings (persistent in carry_forward_findings)

- **PROBE 1**: cement screed ~1.4 mil Kč missing (komplex)
- **PROBE 2**: hydroizolace pod obklad ~0.4 mil Kč missing
- **PROBE 3**: cihelné pásky Terca ~3.9 mil Kč missing material
  (Phase 6.4 newest)
- **Total under-booking**: ~5.8 mil Kč komplex / ~1.45 mil Kč objekt D

## Key files (all in `test-data/libuse/outputs/`)

- `items_objekt_D_complete.json` — 2548 items final state
- `urs_query_groups.json` (598 KB) — 579 groups (review-confirmed)
- `urs_groups_review.md` — human-readable groups report
- `phase_*_scorecard.md` — all progression scorecards
- `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` — current Excel
- Multiple backup `.xlsx` versions per phase

## Next phase: 7a Part 2

Approach: 2-stage lookup per group (group-first):

1. **Stage A** — catalog_only via local URS_MATCHER spin-up
   (`URS_MATCHER_SERVICE/backend`, SQLite from URS201801.csv ~12 K rows)
2. **Stage B** — LLM rerank via `PPLX_API_KEY` pro confidence < 0.85
   (drag-drop `.env.local` from user)

Cost projection: ~$1-2 (most queries resolved by catalog).

After 7a Part 2: **Phase 8** = final Excel s List 11 sumarizace
(Variant A: 1 ÚRS kód = 1 master row + collapsed details, Excel outline
groups for click+expand workflow).

## Future scope (objekty A/B/C)

Likely další subcontracts pro objekty A/B/C komplexu Libuše. Pipeline
z objektu D je reusable.

Reusable z této pipeline:

- Phase 0–5 framework: DWG/DXF parser, geometric extraction, item
  generation per kapitola
- Phase 6 fixes: integer rounding, paired osazení, materiál vs práce
- Phase 6.3 audit framework: HIGH/MEDIUM/LOW gap detection
- Phase 7a v2 group-first lookup approach
- Phase 8 List 11 sumarizace (Variant A)

Differences vs objekt D:

- A/B/C currently only PDF (no DWG dataset)
- Need DWG access from projektant ABMV before parsing
- Or: PDF-only pipeline (ChunkedExtractionAgent — untested but designed)

## Reusable patterns (potentially port to STAVAGENT main pipeline)

- Group-first ÚRS lookup with user review checkpoint
- 2-stage matcher (catalog → LLM rerank)
- Status flags (NOVE / SHODA / VYNECHANE_KRITICKE / VYNECHANE_DETAIL)
- PROBE finding system v `carry_forward_findings`
- Material/work paired items (Approach A)
- Per-W/D/OP type item completeness audit framework

## How to resume v new Claude chat

1. Read this file (`next-session-libuse.md`)
2. Check latest `test-data/libuse/outputs/phase_*_scorecard.md` for most
   recent state
3. Continue from "Next phase" section above

---

## Phase 8 — List 11 Sumarizace (KROS workflow ready) — 2026-05-04

### Status

✅ List 11 added to existing Excel (in-place, single file). All 11 sheets
preserved. Excel size 298 KB → 450 KB.

### List 11 structure

- **579 master rows** (one per group_id, sorted G001…G579)
- **2548 detail rows** (collapsed by default via Excel outline groups)
- Header columns: `# | ÚRS kód | Popis | MJ | Total množství | Components | Skladby | Kapitola | Status mix | Group ID | Note`
- Column B (ÚRS kód) — **empty placeholder, yellow highlight** (manual KROS entry needed per master row)
- AutoFilter on header
- Freeze pane row 1 + column A
- Outline summaryBelow=False (master row above details)

### Master row color coding (by status mix purity)

- Pure VYNECHANE_KRITICKE → red bg
- Pure NOVE → yellow bg
- Pure SHODA → light green bg
- Pure VYNECHANE_DETAIL → orange bg
- Mixed statuses → light blue bg

### Approach

**Manual ÚRS entry** via KROS programu — no automation. User workflow:

1. Open Excel List 11
2. For each master row (579 total):
   - Read `Popis` (col C), `Skladby` (col G), `Kapitola` (col H)
   - Lookup ÚRS code v KROS programu
   - Paste code into column B (yellow highlight)
3. KROS picks up unit prices from its catalog automatically
4. Total cost = sum across all 579 master rows

### Estimated user effort

~3-5 hours KROS pricing (~30-40 sec per master row at experienced pace).

### Files updated this phase (in-place)

- `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` — 11 sheets, 450 KB
  - List 11 added (new)
  - List 0 "Souhrn" — appended note about List 11 + manual KROS workflow
  - List 9 "Metadata" — appended Phase 8 info
- `Vykaz_vymer_pre_list11.xlsx` — single backup before destructive write (298 KB)
- `next-session-libuse.md` — this file (status updated, section appended)

### Verdict

✅ **Pipeline complete pro objekt D.** Excel ready k odeslání investorovi
+ KROS pricing.

### Future work — objekty A/B/C

A/B/C komplexu Libuše need separate run. Pipeline z objektu D je reusable
(see "Future scope" + "Reusable patterns" sections above).

### Repository hygiene

- ✅ NO new `.md` / `.json` / `.xlsx` files created (only in-place updates + 1 backup)
- ✅ Phase 8 scorecard NOT a separate file — appended to this section above
