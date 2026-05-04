# Libuše Objekt D — Next Session Handoff

Last updated: 2026-05-04 (Phase 6.5 špalety actual measurement)

## Status

Phase 6.5 špalety actual measurement complete (L2.5 project-aware per-room).
Phase 8 List 11 regenerated. Excel ready for KROS manual ÚRS pricing.

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
- ✅ Phase 6.5      — špalety actual measurement L2.5 (replaces 30/70 heuristika)
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

---

## Phase 6.5 — Špalety actual measurement (L2.5) — 2026-05-04

### Status

✅ Replaces Phase 6.4 Part D2 global 30/70 heuristic with L2.5 project-aware
per-room actual measurement. 132 items recalculated using
`obvod × tloušťka × faktor` formula (fasádní × 1, vnitřní × 2 — both špalety).

### Source method used

**L2.5_project_aware_per_room** — uses per-room `wall_segment_tags` from
`objekt_D_geometric_dataset.json` mapped to WF skladba thicknesses, with
project-wide WF averages as fallback when room has no tags.

WF prefix → category mapping:
- `WF03/10–22/90` → obvodová (project avg 485 mm, from 1 detected skladba)
- `WF20–25` → vnitřní nosné (fallback 220 mm — 0 skladeb detected)
- `WF30–32` → vnitřní příčky (project avg 50 mm, from 1 skladba)
- `WF40/41/50/51` → SDK předstěny (125 mm)

Per-opening assignment via nearest-room distance (Phase 6.4 pattern,
`is_fasadni` flag from `objekt_D_per_podlazi_aggregates.json`).

### Results

- Items affected: **132** (HSV-611 + HSV-612 špalety)
- Items zeroed (kept w/ warning): **63** (rooms with 0 fasádních openings
  previously assigned 30 % share by heuristic)
- Items confidence < 0.7: **0** (all matched to L2.5 path or documented fallback)
- Edge stops (room w/ fasádní opening but no obvodový WF tag): **12 rooms**
  (e.g. D.1.1.03, D.1.2.03, D.1.3.03, D.1.4.05, D.2.1.03 — fallback
  PROJ_AVG_OBVODOVA applied)

### Aggregate delta

| | Před (Phase 6.4 30/70) | Po (Phase 6.5 L2.5) | Δ |
|---|---:|---:|---:|
| Σ fasádní špalety m² | 85.52 | 57.49 | **−28.02 (−32.8 %)** |
| Σ vnitřní špalety m² | 114.02 | 80.99 | **−33.03 (−29.0 %)** |

### Golden case verification — D.1.1.01 chodba

| Metric | Hodnota |
|---|---|
| Fasádních špalet m² | **0.000** ✅ (expected ~0) |
| Vnitřních špalet m² | 2.950 |
| Fasádních openings | 0 |
| Vnitřních openings | 2 |
| tl. obvodová | 0 mm (room has 0 obvod. WF tags) |
| tl. vnitřní | 125.0 mm (SDK předstěna) |

Match confirmed — chodba se 0 fasádními otvory teď returnuje 0 m² fasádních
špalet (Phase 6.4 heuristika dávala 1.24 m²).

### Sample 5 fixed items (variety)

| Item | Popis | Před → Po | Δ % |
|------|-------|-----------|-----|
| S.D.09 | Špalety vnitřní (chodba) | 1.218 → 0.000 m² | −100 % |
| S.D.09 | Špalety vápeno hl. 200 mm | 1.624 → 1.160 m² | −28.6 % |
| S.D.10 | Špalety vnitřní (chodba) | 1.869 → 0.000 m² | −100 % |
| S.D.10 | Špalety vápeno hl. 200 mm | 2.492 → 1.780 m² | −28.6 % |
| S.D.11 | Špalety vnitřní (chodba) | 0.609 → 0.000 m² | −100 % |

### Items s L2.5 measurement (confidence 0.80) — top 5 by mnozstvi for spot-check

| # | Item | Popis | Po m² | Detail |
|---|------|-------|------:|--------|
| 1 | S.D.27 | Špalety vápenocementová | 7.400 | tl. 50 mm × 11 otvorů (PROJ_AVG_PRICKY fallback) |
| 2 | S.D.40 | Špalety vápenocementová | 5.280 | tl. 50 mm × 9 otvorů (PROJ_AVG_PRICKY fallback) |
| 3 | D.1.4.07 | Špalety sádrová | 4.850 | tl. 485 mm × 2 otvorů (PROJ_AVG_OBVODOVA — room sans wall_segment_tags) |
| 4 | D.2.1.07 | Špalety sádrová | 4.850 | tl. 485 mm × 2 otvorů (PROJ_AVG_OBVODOVA fallback) |
| 5 | D.2.4.07 | Špalety sádrová | 4.850 | tl. 485 mm × 2 otvorů (PROJ_AVG_OBVODOVA fallback) |

⚠️ Spot-check note: WF skladby v `geometric_dataset.json` jsou sparse
(jen 1 obvodová a 1 příčka detected), proto mnoho miestností spadá do
PROJ_AVG fallback. Pro vyšší přesnost je nutné Phase L1 extrakce
(Tabulka výplní → per-opening tloušťka).

### Edge case handling

- Room w/ fasádní opening but no obvodový WF tag → recorded v `EDGE_STOPS`
  + fallback `PROJ_AVG_OBVODOVA` (485 mm)
- Room w/ `wall_segment_tags=[]` → fallback `PROJ_AVG_OBVODOVA` /
  `PROJ_AVG_VNITRNI` + warning v item.note
- Room w/ pouze SDK předstěny → `PROJ_AVG_SDK` (125 mm) + warning

### Files updated this phase (in-place)

- `items_objekt_D_complete.json` — 132 items s novou `mnozstvi` + `note`
  (carry_forward_findings appended s Phase 6.5 source_method)
- `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` — 11 sheets
  (regenerated od Phase 6 → Phase 8 List 11 refreshed s novými hodnotami,
  450 KB)
- `Vykaz_vymer_pre_phase6_5.xlsx` — single backup před destructive write
  (450 KB pre-regen)
- `next-session-libuse.md` — this file (status + section appended)

### Verdict

✅ **L2.5 measurement applied successfully.** D.1.1.01 chodba golden case
verified 0 m² fasádních (was 1.24 m² under heuristics). Net reduction
−61 m² across 132 items reflects realistic stripping of fictitious
fasádní share from interior-only rooms.

### Backlog — Phase L1 extract (post-submission)

Detected sparse WF coverage v `geometric_dataset.json`: jen 1 obvodová +
1 příčka skladba má parsed thickness. Per-opening L1 extract from
**Tabulka výplní** by reduced PROJ_AVG fallback share (currently affects
~30 % items). Schedule for follow-up session — not blocker pro KROS
manual pricing.

Acceptance criteria pro L1 extract:
- Per-opening `wall_thickness_mm` populated from Tabulka výplní
- Fallback path (L2.5) zachovat pro rooms not covered by Tabulka
- Re-run Phase 6.5 → expect Δ < 5 % od current L2.5 baseline (sanity)
