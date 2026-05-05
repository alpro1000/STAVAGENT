# Libuše Objekt D — Next Session Handoff

Last updated: 2026-05-05 evening (Phase 0.10–0.20 complete + code review
fixes, PR #1066 ready for **full review** in next session)

## Status

**Excel deliverable feature-complete + interactive filter dashboard added.**
Pending: full review per-item (user request) → merge → delivery.

- 3 021 items (+ 11 deprecated D05 with mnozstvi=0)
- ~762 KB, **12 sheets** (incl. nový List 12 Filter_view)
- Branch: `claude/phase-0-5-batch-and-parser` @ `3b502fef`
- **PR #1066:** https://github.com/alpro1000/STAVAGENT/pull/1066

## ⭐ NEXT SESSION FOCUS — full Excel review (user request)

User: *"я хочу пройти в следующей сесси весь итоговый файл с работами
заново с проверкой"*

Plan: použij List 12 Filter_view (Excel Table s ▼ dropdowns) pro
per-column filtrování + procházej po řezech (podlaží / kapitola / F-kód
/ status). Detail v § "NEJBLIŽŠÍ SESSION" níže.

Total cumulative recovery this session ~599k Kč (PROBE 4 F15 134k +
Phase 0.15-0.18 465k). Plus Phase 0.19 cleanup −0 Kč (D05 zeroed but
no value previously counted).

⚠️ Pre-merge: all 6 PROBE findings logged in carry_forward_findings.
ABMV email draft ready (Phase 0.10 audit, 6 documentation otázek).

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
- ✅ Phase 0.8      — extract 26 WF skladeb from master XLSX (Bug #1 fix)
- ✅ Phase 0.9      — door ownership from Tabulka 0041 (Bug #2 + #3 fix)
- ✅ Phase 6.5 v2   — 5-bug fix pack (cluster, garage, fallback, popis, sources)
- ✅ Phase 6.5 v2 cross-check — WF22 + specifikum-aware thickness
- ✅ Phase 0.10     — documentation inconsistency audit (6 ABMV otázek)
- ✅ Phase 0.11     — manual inject S.D.16 + S.D.42 (DXF parser gap)
- ✅ Phase 0.12     — F15 tepelná izolace stropů 1PP (PROBE 4, ~134k Kč)
- ✅ Phase 0.13     — F14 + F11 inject + FF01 deprecate (PROBE 5)
- ✅ Phase 0.14     — full coverage audit (104/111 rooms gaps identified)
- ✅ Phase 0.14b    — 3-way triangulation (Tabulka × Starý VV × Pipeline)
- ✅ Phase 0.15     — SDK podhled D112 CF20+CF21 (+227k Kč, 34 items)
- ✅ Phase 0.16     — Kročejová izolace 25mm (+88k Kč, 56 items)
- ✅ Phase 0.17     — Keramický obklad gap fill (+9k Kč, 12 items)
- ✅ Phase 0.18     — Polystyrenbeton PSB 50 40mm (+141k Kč, 56 items)
- ✅ Phase 0.19     — D05 PROBE 6 cleanup (rolovací brána, S.C.02 scope)
- ✅ Phase 0.20 v1  — Filter view 6 stacked tables (later superseded)
- ✅ Phase 0.20 v2  — Excel Table `VykazFilter` s native column dropdowns
- ✅ Code review fixes (Qodo + Amazon Q) — conditional formatting
  absolute→relative, name-resolved cols, soft-warn dimensions, autofilter
  null-guard, scoped warning suppression
- ✅ Phase 7a Part 1 — 579 query groups built (group-first approach)
- ⏸️ Phase 7a Part 2 — DEFERRED (manual KROS ÚRS pricing instead)
- ✅ Phase 8        — List 11 sumarizace added (manual KROS workflow)

## Critical findings (persistent in carry_forward_findings)

- **PROBE 1**: cement screed ~1.4 mil Kč missing (komplex)
- **PROBE 2**: hydroizolace pod obklad ~0.4 mil Kč missing
- **PROBE 3**: cihelné pásky Terca ~3.9 mil Kč missing material
  (Phase 6.4 newest)
- **PROBE 4**: F15 tepelná izolace stropů 1PP missing — 278.61 m² ×
  ~480 Kč/m² ≈ ~134k Kč pod-fakturováno (Phase 0.12 fix). 43 D-rooms.
- **PROBE 5**: FF01 generator mismap (cementový potěr 50mm v 1.PP) —
  126 wrong items zeroed; F11 epoxidový + F14 bezprašný injected
  (Phase 0.13). Net ~+1k Kč.
- **PROBE 6**: D05 wrong template (= rolovací brána Hoermann
  5700×2100mm "Roleta z Rampy", ne klasické dveře) + scope (z=S.C.02
  patří objektu C). 11 items deprecated (Phase 0.19, no value impact —
  items already had qty=0 conditional).
- **Total under-booking**: ~5.8 mil Kč komplex (PROBE 1+2+3) /
  ~1.45 mil Kč objekt D + Phase 6.5 v2 fixes + Phase 0.12 134k +
  Phase 0.15-0.18 +465k Kč ≈ **~2.0 mil Kč total objekt D recovery**

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

---

## Phase 6.5 v2 — 5-bug fix pack (TASK_GATE2_FIX v2) — 2026-05-05

### Status

✅ All 5 bugs from VELTON spot-check resolved. Excel + List 11 regenerated.

### Bugs fixed

| # | Bug | Fix |
|---|-----|-----|
| 1 | Phase 0.x extracted 2/26 WF skladeb | New `phase_0_8_extract_master_skladby.py` parses Tabulka 0030 master XLSX → 26 WF entries with `kind` + `specifikum` |
| 2 | nearest-room cluster: 11 dveří → 4 m² S.D.27 | New `phase_0_9_extract_doors_ownership.py` reads Tabulka 0041 `z_místnoti`/`do_místnoti` columns → explicit per-room ownership |
| 3 | Garážová vrata D05 5700×2100 v HSV-612 | `is_garage_gate()` filter v ownership data (D05 OR width >3000mm); excluded z HSV-612 |
| 4 | PROJ_AVG_PRICKA = 50 mm (= WF32 podezdívka van bias) | `median_typical()` weighted median over generic příčky (specifikum=None) → 115 mm |
| 5 | Item popis "(hloubka 200 mm)" inherited z Phase 6.4 | Phase 6.5 v2 regeneruje popis s actual `tl_mm`; pro qty=0 → "žádný X otvor v místnosti" |

### Project fallback thicknesses (median typical, post-Bug #1+#4)

- obvodová (excluding atika): **487 mm** (was 485 from 1 skladba)
- vnitřní nosná: **250 mm** (was 220 hardcoded fallback)
- vnitřní příčka: **115 mm** (was 50 mm from WF32 only)
- SDK předstěna: **125 mm** (unchanged)

### Aggregate delta vs Phase 6.5 v1

| | v1 | v2 | Δ |
|---|---:|---:|---:|
| Σ fasádní špalety m² | 57.49 | 58.50 | +1.01 (+1.8 %) |
| Σ vnitřní špalety m² | 80.99 | 188.80 | **+107.81 (+133.1 %)** |

Vnitřní +133 % je spojený důsledek (a) přesunu dveří do správných chodeb
(z 1.PP klastru misclustered do sklepních kójí) a (b) opravy fallback
50→115 mm, tj. konečně realistická typická příčka.

### Spot-check (5 rooms vs Tabulka 0041 ground truth)

| Místnost | Spec očekává | v1 chyba | v2 výsledek | ✓ |
|----------|--------------|----------|-------------|---|
| **S.D.27** SKLEPNÍ KÓJE B | 1 dveře (D04 z S.D.20), ~1 m² | 7.40 m² (11 dveří × 50 mm) | **1.403 m²** (1 × 115 mm) | ✅ |
| **S.D.40** SKLEPNÍ KÓJE D | 1 dveře (D04 do S.D.32), ~1 m² | 5.28 m² (9 dveří × 50 mm) | **1.403 m²** (1 × 115 mm) | ✅ |
| D.1.4.07 POKOJ | 1 D + 1 W (485 mm obvod) | 4.85 m² fas + 0 vnt | 4.870 fas + 1.403 vnt | ✅ |
| D.2.1.07 POKOJ | 1 D + 1 W | 4.85 fas + 0 vnt | 4.870 fas + 1.403 vnt | ✅ |
| D.2.4.07 POKOJ | 1 D + 1 W | 4.85 fas + 0 vnt | 4.870 fas + 1.403 vnt | ✅ |

### Golden case D.1.1.01 chodba

- fasádní: **0.000 m²** ✅ (n_fasadni_openings = 0, unchanged)
- vnitřní: 7.560 m² (4 dveře × tl 150 mm — chodba má WF51 SDK předstěnu,
  preferred order nosná → příčka → SDK pulled SDK 150 mm)

### New scripts

- `concrete-agent/packages/core-backend/scripts/phase_0_8_extract_master_skladby.py`
  — reads Tabulka 0030 XLSX (`skladby sten` sheet) → patches geometric_dataset
  s 26 WF skladbami (kind + specifikum + vrstvy). Idempotent.
- `concrete-agent/packages/core-backend/scripts/phase_0_9_extract_doors_ownership.py`
  — reads Tabulka 0041 XLSX (`tab dvere` sheet) → produces
  `objekt_D_doors_ownership.json` (290 doors → ownership map per
  z_místnoti/do_místnoti, garage gate flagging).
- `concrete-agent/packages/core-backend/scripts/phase_6_5_v2_spalety.py`
  — orchestrator implementující všech 5 oprav. Idempotent (re-run
  vrátí stejné hodnoty + clean popis).

### Files updated this phase (in-place)

- `objekt_D_geometric_dataset.json` — skladby dict rozšířen o 24 WF entries
  (Bug #1 — Phase 0.x extracted only 2/26)
- `objekt_D_doors_ownership.json` — NEW: 104 D-rooms × ownership lists
- `items_objekt_D_complete.json` — 132 spalety items s aktualizovanou
  mnozstvi + popis + warnings + source_method=`L2.5_v2_per_room`
- `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` — 11 sheets, 457 KB
  (regenerated od Phase 6 → Phase 8 List 11 refreshed)
- `Vykaz_vymer_pre_phase6_5_v2.xlsx` — single backup před destructive write
  (450 KB)
- `next-session-libuse.md` — this file

### Garage gate exclusion stats

- 2 D05 garážová vrata (5700×2100 mm Hoermann) detekovány v Tabulce 0041
- Žádné z nich nejsou přiřazené k S.D./D. místnostem (jsou v S.B./S.C.
  garáží), takže Bug #3 filter nemusel firovat na D-objektu, ale je v
  místě pro budoucí A/B/C runs.

### Edge stops (12 rooms s fasádním otvorem ale bez obvodové WF tag)

Stejných 12 rooms jako v v1: D.1.1.03, D.1.2.03, D.1.3.03, D.1.4.05,
D.2.1.03, atd. — fallback 487 mm (median obvodová bez atik) místo
WF41/WF51 SDK tagů. Pro tyto rooms je tloušťka over-estimate o ~30 % —
vyžaduje L1 extrakce per-otvor `wall_thickness_mm` z Tabulky výplní.

### Verdict

✅ **All 5 bugs resolved. Pipeline ready pro VELTON delivery.**

Backlog (B-L1 + B-L2 v task spec §3) vyřešen v separátním tasku po
konfirmaci s ABMV (F20/F30 typo, broken code references audit).

---

## Phase 6.5 v2 cross-check (verifikace vůči Tabulce 0030 PDF + 11 XLSX)

### Cross-check audit results

Manuální cross-check v2 výpočtů proti master Tabulce 0030 PDF + 11 inputs
XLSX odhalil další 2 výpočetní bugy (kromě cosmetic WF22 misclass).

| Bug | Detail | Závažnost | Fix |
|-----|--------|-----------|-----|
| WF22 kind | XLSX label "obvodová stěna - nadezdívky" — Phase 0.8 KIND_BY_CODE měla v `vnitrni_nosna` (range-based) | Cosmetic — žádný room nemá WF22 v tags | Move to `obvodova` set |
| `resolve_room_thickness` neresp. specifikum | 6 POKOJŮ s `wall_segment_tags=['WF32']` (Ytong podezdívka van 50mm) → Phase 6.5 v2 returnoval 50mm jako celá vnitřní stěna pro dveře. 9 koupelen `(WF32, WF51)` resolvovalo na 50mm příčka místo 150mm SDK kvůli pořadí nosná→příčka→SDK. | **High** ~5–7 m² under-estimate | Skip skladby s `specifikum != None` v room thickness resolution; fallback to PROJ_PRICKA (115mm) |

### Aggregate delta po cross-check fix

| | v1 | v2 initial | v2 + xcheck | Δ od v1 |
|---|---:|---:|---:|---:|
| Σ fasádní m² | 57.49 | 58.50 | 58.50 | +1.8 % |
| Σ vnitřní m² | 80.99 | 188.80 | **222.33** | +174 % |

Vnitřní ještě více vzrostlo o +17.8 % od v2 initial — jde o 9 koupelen
(D.1.2.01, D.1.3.01, D.2.1.01, …) které předtím dostávaly 50mm Ytong
podezdívka, teď 150mm SDK předstěna. Plus ~6 jiných místností přes
PROJ_PRICKA fallback 115mm.

### Spot-check 5 rooms — všechny stále ✅ pass

| Room | Tags | tl_vnt po xcheck | qty m² |
|------|------|------:|-------:|
| S.D.27 | [] | 115 (fallback) | 1.403 |
| S.D.40 | [] | 115 (fallback) | 1.403 |
| D.1.4.07 | [] | 115 (fallback) | 1.403 |
| D.2.1.07 | [] | 115 (fallback) | 1.403 |
| D.2.4.07 | [] | 115 (fallback) | 1.403 |
| D.1.1.01 (golden) | ['WF51'] | 150 (SDK) | 7.560 |
| D.1.2.01 (koupelna) | ['WF32','WF51'] | 150 (SDK, was 50 wrong) | 7.560 |

### Foundational issue (logged for backlog, not fixed in this round)

Phase 1 spatial WF tagger detekuje **pouze 6 z 26 unique WF kódů** v
109 D-roomech: WF10, WF32, WF40, WF41, WF50, WF51 (= obvodová Porotherm
44 + Ytong podezdívka + 4× SDK předstěny).

Chybí především:
- **WF20** (250mm Porotherm 25 AKU mezi-bytová) — měla by být v
  každé bytové místnosti
- **WF30** (115mm Porotherm 11.5 příčka) — interních příček

71/109 rooms (65 %) má `wall_segment_tags=[]` → Phase 6.5 v2 spadne do
PROJ_PRICKA fallback 115mm což je pro většinu dveří v bytech správně,
ale pro fasádní špalety (WF20 + obvodové) by bylo přesnější mít explicit
tagy.

Backlog item: **Phase 1 spatial WF tagger upgrade** — improve shapely
spatial join to detect Porotherm walls (WF20/WF30) v DXF. Currently
detector matches only walls with explicit text annotations; Porotherm
walls v DXF jsou anonymous. Vyžaduje DXF block-name analysis nebo
šířka-based heuristic.

### Files updated by cross-check

- `concrete-agent/packages/core-backend/scripts/phase_0_8_extract_master_skladby.py`
  — WF22 reklasifikace (vnitrni_nosna → obvodova)
- `concrete-agent/packages/core-backend/scripts/phase_6_5_v2_spalety.py`
  — `resolve_room_thickness()` skip `specifikum != None`
- `objekt_D_geometric_dataset.json` — WF22 kind="obvodova"
- `items_objekt_D_complete.json` — 132 items s aktualizovanou tloušťkou
- `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` — regenerated 11 sheets
- `Vykaz_vymer_pre_xcheck.xlsx` — backup před xcheck regen

---

## Phase 0.10 — Documentation inconsistency audit (architectovy chyby)

### Status

✅ Comprehensive audit master Tabulky 0030 + Tabulky místností 0020 vůči
DXF dataset zachytil 6 inkonzistencí v projektové dokumentaci. Žádná
nemá výpočetní dopad na current pipeline (XLSX-based), ale **6 items
musí být potvrzeno s ABMV před VELTON delivery**.

### Audit findings (D1–D6)

| # | Issue | Detail | Impact |
|---|-------|--------|--------|
| **D1** | F-code numbering XLSX↔PDF rozpor | XLSX `povrchy` sheet má 23 sequential rows (F00–F22). PDF Tabulka 0030 má explicit codes F00–F23 s **F20 přeskočeno**. Od F20+ se XLSX a PDF NESHODUJÍ (XLSX F20 = obchodní podlaha, PDF F21 = obchodní podlaha). | Která verze je kanonická? |
| **D2** | 5× FF column typo (chybí FF prefix) | D.1.4.03 WC: FF="F20" → mělo být FF20. D.2.1.03/D.2.4.03/D.3.1.03/D.3.3.03 WC: FF="F30" → mělo být FF30. | XLSX neopravuje, ale Excel List 4 (Mistnosti) zobrazí raw hodnoty → auditor uvidí broken kódy. |
| **D3** | Master 0030 sequence gaps | Žádné gaps v XLSX (F00–F22 sequential). Ale PDF má F20 skipped. | Důsledek D1. |
| **D4** | 2× XLSX-only rooms missing v DXF | S.D.16 SKLEPNÍ KÓJE - C (7.62 m²), S.D.42 SKLEPNÍ KÓJE - D (2.99 m²). Phase 0.x DXF parser je nezachytil. | Tyto kóje chybí v geometric dataset → 0 items v Excel pro ně → potenciální under-billing ~10 m² podlaha + obvod. |
| **D5** | DXF-only rooms (none) | Žádný room v DXF mimo Tabulku místností. | Clean. |
| **D6** | Printed legend D.1.3.01 misfiling | PDF výkres Tabulka místností 1.NP řadí D.1.3.01 CHODBA pod sekci D.1.2 byt (subtotaly 55.9 / 43.2 m² místo správných 49.59 / 49.59 m²). XLSX má D.1.3.01 správně v D.1.3 byt → pipeline OK, ale printed deliverable broken. | Regenerovat printout pro VELTON. |

### F20 interpretation (semantic mismatch)

Pro 8 residential POKOJ + OBÝVACÍ POKOJ rooms v 3.NP (D.3.1.02, .06, .07,
D.3.2.03, .04, D.3.3.02, .06, .07):

```
Tabulka místností XLSX zápis:
  F povrch stěn = "F05, F20"
  F povrch podhledu = "F20"
```

- F05 = sádrová omítka 10mm (correct pro pokojové stěny)
- **F20** ⚠️ — per XLSX seq = "Povrch podlahy - obchodní jednotky" (PODLAHOVÝ
  kód aplikovaný na stěny/podhled je semantically wrong)
- Per PDF = F20 undefined (skipped)
- **Recommended interpretation**: F17 (SDK + otěruvzdorná výmalba) —
  3.NP má sedlovou střechu 30°-67°, část podhledu jde do šikminy
  potažená SDK; architekt pravděpodobně chtěl označit SDK
  treatment ale použil shorthand F20 místo F17.

### ABMV e-mail items (6 confirmation requests)

Plné details v `documentation_inconsistencies.json` → `abmv_email_required[]`.
Souhrn:
1. F-code numbering canonical: XLSX or PDF?
2. F20 v 8 residential POKOJ stěn/podhled = F17?
3. F30 v 4 WC FF column = FF30?
4. F20 v D.1.4.03 WC FF column = FF20?
5. Regenerate Tabulka místností 1.NP printout (D.1.3.01 misfile)
6. S.D.16, S.D.42 SKLEPNÍ KÓJE missing v DXF dataset — Phase 0.x parser gap

### Files

- New: `concrete-agent/packages/core-backend/scripts/phase_0_10_documentation_audit.py`
- New: `test-data/libuse/outputs/documentation_inconsistencies.json`
- Backlog B-L1 + B-L2 (původně v Phase 6.5 v2 sekci) → **resolved in this audit**.

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

---

## Session 2026-05-05 — kompletní summary

### Architectovi konvence (potvrzená user)

- **D-scope** = `D.*` (NP rooms) + `S.D.*` (ALL 1.PP pod budovou D),
  vč. kóje "SKLEPNÍ KÓJE - B" a "SKLEPNÍ KÓJE - C" — fyzicky leží pod
  D, construction work patří D, byty B/C mají jen užívací právo.
- **Total D-scope**: 111 rooms (68 NP + 43 1.PP).
- **NE % alokace** — všechny m² z reálných per-room hodnot Tabulky 0020
  sloupec `plocha_m2`. Per task hard requirement #2.

### Commits této session (20)

| # | Commit | Phase | Δ Kč |
|--:|--------|-------|-----:|
| 1 | `1c1c0ec` | 6.5 v1 (L2.5 měření špalet) | — |
| 2 | `7d0dba2c` | 6.5 v2 (5-bug fix pack) | — |
| 3 | `401225cc` | 6.5 v2 cross-check (WF22 + specifikum) | — |
| 4 | `ab0f5eb0` | 0.10 documentation audit | — |
| 5 | `a2172fd9` | 0.11 inject S.D.16 + S.D.42 | — |
| 6 | `ea9f26d5` | 0.12 F15 tepelná izolace (PROBE 4) | +134k |
| 7 | `0049adcf` | 0.13 F14 + F11 + FF01 (PROBE 5) | +1k |
| 8 | `adef6552` | 0.14 full coverage audit | — |
| 9 | `d4b0326e` | 0.14b 3-way triangulation | — |
| 10 | `9f...` | 0.15 SDK podhled D112 | +227k |
| 11 | `9a941bc2` | 0.16 Kročejová izolace 25mm | +88k |
| 12 | `3e847981` | 0.17 Keramický obklad gap | +9k |
| 13 | `d598706b` | 0.18 PSB beton 40mm m³ | +141k |
| 14 | `5c89a64d` | 0.15-0.18 final regen | — |
| 15 | `b6af780b` | 0.19 D05 cleanup (PROBE 6) | −0 (zeroed) |
| 16 | `4e345d7d` | docs(session) summary + handoff | — |
| 17 | `f00d6aa4` | 0.20 v1 Filter view 6 stacked tables | — |
| 18 | `dff0c29f` | 0.20 v2 Excel Table VykazFilter | — |
| 19 | `3b502fef` | code-review fixes (Qodo + Amazon Q) | — |
| 20 | (this) | docs update — full review plan | — |

**Total session recovery: +599k Kč** (PROBE 4 + Phase 0.15-0.18 fix pack)

### Verified items per F-code (post-merge ready)

- **F14** bezprašný nátěr ŽB stěn — 80 items (Phase 0.13 39 rooms × 2)
- **F15** tepelná izolace stropů 1PP — 86 items (Phase 0.12 43 rooms × 2)
- **F11** epoxidový nátěr podlahy 1PP — 129 items (Phase 0.13 43 × 3)
- **CF20/CF21** SDK podhled — 34 items (Phase 0.15)
- **FF20/21/30/31** kročejová izolace — 56 items (Phase 0.16)
- **FF20/21/30/31** PSB beton 40mm — 56 items (Phase 0.18, m³ unit)
- **F06** keramický obklad — 32 + 12 gap items
- D05 — 11 items DEPRECATED (rolovací brána, scope C)

### ABMV email — 6 documentation otázek (pending odeslání)

Draft ready v `documentation_inconsistencies.json` →
`abmv_email_required[]`. Souhrn:

1. F-code numbering canonical (XLSX vs PDF rozpor od F20)
2. F20 v 8 residential POKOJ stěn/podhled = F17?
3. F30 v 4 WC FF column = FF30?
4. F20 v D.1.4.03 WC FF column = FF20?
5. Regenerate Tabulka místností 1.NP printout (D.1.3.01 misfile)
6. S.D.16 + S.D.42 missing v DXF dataset (Phase 0.x parser gap)

---

## Pokračovací TASK pro budoucí sessions

### ⭐ NEJBLIŽŠÍ SESSION — full review výkazu (user request)

User explicit request:
> *"я хочу пройти в следующей сесси весь итоговый файл с работами
> заново с проверкой"*

**Strategy — interaktivní review s pomocí List 12 Filter_view:**

1. **Otevřít** `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx`,
   přejít na sheet `12_Filter_view`
2. **Použít column-header dropdowns** (▼ ikony) pro filtrování per řez
3. **Procházet 4 osy v sequenci:**

   #### Osa A — Per podlaží (5 řezů)
   - Filter Podlaží = `1.PP` → ~1 700 items (sklepní kóje + chodby)
   - Filter Podlaží = `1.NP` → ~430 items (byty + obchodní jednotky)
   - Filter Podlaží = `2.NP` → ~440 items (byty)
   - Filter Podlaží = `3.NP` → ~370 items (byty + sedlová střecha)
   - Filter Podlaží = `fasáda` / `ALL` / atd. → border zone items

   #### Osa B — Per kapitola (~21 řezů)
   - HSV-611 (Penetrace + omítka vápenocementová)
   - HSV-612 (Penetrace + omítka sádrová)
   - HSV-613 / HSV-622 / HSV-631 (cementové potěry)
   - HSV-642 (osazení zárubní)
   - PSV-713 (tepelná izolace stropů, kročejová)
   - PSV-763 (SDK podhled, prosklené příčky)
   - PSV-766 / PSV-767 (zámečnické dveře, kování)
   - PSV-781 / PSV-783 / PSV-784 (obklady, nátěry, malby)

   #### Osa C — Per F-kód (skladby cross-check)
   - FF01/FF03 (1.PP podlahy — pancéřová / hydroizolace radon)
   - FF20/21/30/31 (NP podlahy — potěr+kročejová+PSB skladby)
   - F02/F03/F11 (povrchy podlah — dlažba/vinyl/epoxid)
   - F04/F05/F19 (povrchy stěn — sádrová/vápenocementová omítka)
   - F06 (koupelny — keramický obklad)
   - F14 (bezprašný nátěr ŽB)
   - F15 (tepelná izolace stropů 1PP)
   - F17 (SDK otěruvzdorná výmalba)
   - CF20/CF21 (SDK podhled chodeb / koupelny)
   - WF20-32, WF40-51 (vnitřní stěny + SDK předstěny)

   #### Osa D — Per status (audit triage)
   - `no_match` (~1766) → potřeba KROS ÚRS pricing
   - `needs_review` (~611) → manual qty/price verify
   - `matched_high/medium` (~273) → OK, low priority
   - `VYNECHANE_KRITICKE/DETAIL` → Phase 5 audit findings
   - `OPRAVENO_OBJEM/POPIS` → track our corrections
   - `deprecated` (= 11 D05 items) → expected, scope-out

4. **Kontrolní body per item:**
   - [ ] Popis přesný + odpovídá master Tabulce 0030?
   - [ ] Mnozstvi sedí proti Tabulce místností 0020 `plocha_m2`?
   - [ ] Skladba_ref matches Tabulku 0020 sloupce FF / F povrch *?
   - [ ] Místo_kód v platném D-scope (D.* / S.D.*)?
   - [ ] Status logical (deprecated = D05 only, ostatní active)?

5. **Co najít / new PROBE candidates:**
   - **Wrong-template items** (jako D05 byl — special-type vs interior door)
   - **Out-of-scope items** (mimo objekt D — patří A/B/C)
   - **Missing categories** (nový PROBE 7+ pokud nějaký F-kód má 0 items)
   - **Quantity mismatches** vs Tabulka 0020 plocha_m2
   - **Duplikátní pairs** (Phase 6 montáž+materiál duplicate flag)

6. **Output session:**
   - User decisions per finding (DEPRECATE / FIX / KEEP)
   - PROBE 7+ logged v carry_forward_findings
   - Phase 0.21+ scripts pro každý fix
   - Updated Excel + commit per PROBE

### Bezprostřední (post-review, před delivery)

1. **Merge PR #1066** do main (zachová branch history)
2. **Pošli ABMV email** — 6 documentation otázek (draft ready)
3. **VELTON delivery** — Excel připraven, čeká na KROS manual ÚRS
   pricing (~3-5h experienced rate, 579 master rows v List 11)

### Pokračovat audit objektu D (low priority)

- **Phase 0.14 zbývající gaps** — coverage_audit.json má 104/111 rooms
  s gap. Phase 0.15-0.18 řeší top-4 (~465k Kč). Zbývající ~50 menších
  gap kategorií (~30-50k Kč), jednotlivé fix scripty.
- **L1 extract z Tabulky výplní** — per-opening wall_thickness pro
  reducovaný PROJ_AVG fallback (~30 % items currently)
- **Phase 0.x DXF parser fix** pro S.D.16 + S.D.42 (currently manual
  inject Phase 0.11)

### Komplex pricing (objekty A + B + C)

⚠️ **NOVÉ EXPANSION SCOPE.** Po dokončení D je pipeline reusable.

#### Strategy

- D-pipeline framework je generic — Phase 0.x až 6.5 + 0.10-0.18 scripts
  jsou parametrizované per-objekt přes:
  - Tabulka místností 0020 (filter rooms by `code.startswith("A.")` etc.)
  - Tabulka 0030 master skladby (shared)
  - Tabulka 0041 doors (shared)
  - DXF dataset per-objekt (need A/B/C DXF — currently jen D máme)

#### Differences proti D

| Aspekt | D (done) | A/B/C (todo) |
|--------|----------|--------------|
| DWG dataset | ✅ máme | ❌ jen PDF (need ABMV) |
| Tabulka místností XLSX | ✅ shared | ✅ shared |
| Pipeline framework | ✅ ready | ✅ reusable |
| Architektovo `1.PP` scope | S.D.* | S.A.* / S.B.* / S.C.* |
| Special gates | D05 (objekt C scope) | D06 mezi C+B, různé per objekt |
| Plocha komplexu | ~349 m² objekt D | ~1280 m² total |

#### Acceptance criteria komplex pricing

- 4× výkaz výměr (jeden per objekt A/B/C/D)
- D už hotovo — A/B/C novinka
- Cross-validation: suma 4× objektů ≈ starý VV komplex (~183 mil Kč),
  toleranciá ±5 %
- ABMV email vyřešený před začátkem (validace F-kódů)
- DWG/DXF dataset pro A/B/C dostupný (request to ABMV)

#### Proposed Phase plan pro komplex

1. **Phase Π.1** — request DWG/DXF od ABMV pro A/B/C
2. **Phase Π.2** — re-run Phase 0.x extraction per objekt (A/B/C)
3. **Phase Π.3** — re-run Phase 1-6 generators per objekt
4. **Phase Π.4** — re-run Phase 6.5 v2 + 0.10-0.18 fix pack per objekt
5. **Phase Π.5** — cross-objekt aggregation + sanity vs starý VV
6. **Phase Π.6** — 4× Excel deliverable + komplex souhrn

Estimated effort: ~30-40h (D took ~20h, A/B/C as parallel 3× repetition
s lessons learned = ~10-15h efficiency gain)

### Reusable artifacts od D

Tyto soubory + scripty jsou generic, reuse pro A/B/C:

- All `phase_0_*.py` + `phase_6_5_v2_*.py` v
  `concrete-agent/packages/core-backend/scripts/`
- `documentation_inconsistencies.json` audit framework
- `coverage_audit.json` template
- `triangulation_audit.json` 3-way pattern
- ABMV email template (in this file)

Žádné hardcoded "D"-specific. Filter via `is_objekt_X(room_kod)` switch.
