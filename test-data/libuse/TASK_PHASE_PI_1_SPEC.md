# TASK Π.1 — Work List Generator (per-objekt Excel deliverable for A/B/C)

**Status:** **V1 APPROVED — implementation DEFERRED** (await trigger conditions)
**Date:** 2026-05-09 (drafted) · 2026-05-09 (V1 approved + deferred)
**Branch:** `claude/phase-pi-1-generators`
**Predecessors:** Π.0.0 (#1088 merged) → Π.0a Part 3 (#1095 merged) → **this**

---

## TL;DR — current state

After Part 1 discovery, three variants were offered (V1 full parity ~7–9 days,
V2 redistribution ~2–3 days, V3 foundation MVP ~1–2 days). User decision
**2026-05-09**:

- ✅ **V1 Full parity** — APPROVED as the only acceptable quality level for
  any future A/B/C deliverable.
- ❌ **V2 Redistribution** — DROPPED (insufficient quality for user
  requirements; share-key approximation is not engineering-grade).
- ❌ **V3 Foundation MVP** — DROPPED (not a true work-list).

**Implementation is DEFERRED — no Π.1 work proceeds until trigger conditions
below are met.** Currently there is no order for A/B/C, the D-deliverable
(PR #1066 + PROBE 8 self-correction) is the active focus, and starting V1
now would be ~7–9 days of speculative work that may go stale before any
A/B/C client appears.

The V1 specification (architecture, coverage matrix, effort breakdown, test
plan, prerequisites) is preserved below as the canonical reference for the
day implementation IS triggered.

---

## Trigger conditions for Π.1 V1 implementation

Π.1 V1 starts ONLY when **at least one** of the following is true:

1. **VELTON confirms delivery acceptance for objekt D** (PR #1066 + PROBE 8
   recovery accepted; D is locked as the reference) AND VELTON or another
   stakeholder requests A/B/C pricing in the same komplex.

2. **A new client engagement** (not VELTON) requests A/B/C work-list
   regeneration with explicit pricing intent — pricing may still be out of
   Π.1 scope, but the request must be real, not exploratory.

3. **No deadline pressure exists at trigger time** — Π.1 V1 needs ~7–9 days
   of focused work; do not start under deadline duress because the Phase 3.x
   port is the kind of work where corner-case bugs accumulate when rushed.

If a prospective client asks for a quick A/B/C estimate AND a deadline is
short, the answer is "we can produce a foundation snapshot (V3 equivalent)
in 1–2 days, then commit to V1 in ~9 days for the engineering-grade
deliverable" — NOT "we'll start V1 today and hope for the best."

---

## Pre-implementation checklist when triggered

Before starting any Π.1 V1 code on the trigger date, run this checklist
end-to-end. Time-box: **half a day**. Findings determine whether the V1
estimate below still holds or needs refresh.

### Foundation freshness

- [ ] `master_extract_{A,B,C}.json` still present in
      `test-data/libuse/outputs/` and parseable.
- [ ] Per-objekt counts match the values recorded in this SPEC's
      "Context recap" section (A: 80/224/75/17/70, B: 68/372/61/17/70,
      C: 59/221/58/17/70, D: 111/381/102/17/70). Any drift means
      master_extract was regenerated since 2026-05-09 — investigate
      before proceeding.
- [ ] Re-run Π.0a validation gate on D:
      `cd concrete-agent/packages/core-backend/scripts && \
       python -m pi_0.validation.diff_vs_legacy --objekt=D`
      Result must still be **373 MATCH / 0 MISSING / 0 CHANGED / 7 NEW**
      (matching post-Step-7b state). Any regression must be diagnosed
      before Π.1 begins — Π.1 builds on this guarantee.
- [ ] Re-run Π.0a tests:
      `python -m pi_0.tests.test_skeleton`,
      `python -m pi_0.tests.test_dxf_openings`,
      `python -m pi_0.tests.test_xlsx_dvere`,
      `python -m pi_0.tests.test_xlsx_skladby`,
      `python -m pi_0.tests.test_xlsx_okna`,
      `python -m pi_0.tests.test_step5_dxf_full`,
      `python -m pi_0.tests.test_step6_consolidation`.
      All 80 must pass. Any failure means foundation drifted.

### Phase 3.x stability check

- [ ] `git log --oneline concrete-agent/packages/core-backend/scripts/phase_1_*.py concrete-agent/packages/core-backend/scripts/phase_3*.py concrete-agent/packages/core-backend/scripts/phase_0_1[1-9]_*.py concrete-agent/packages/core-backend/scripts/phase_6_generate_excel.py concrete-agent/packages/core-backend/scripts/phase_8_list11_sumarizace.py concrete-agent/packages/core-backend/scripts/phase_0_20_filter_view_table.py`
      since 2026-05-09 — list every commit that touched them.
- [ ] For each commit found, classify as:
      - **NEUTRAL** (refactor, comment, formatting): no V1 estimate impact
      - **DOMAIN DRIFT** (rule changed, kapitola added/removed, hot-fix
        added): re-run D pipeline locally and confirm Phase 6/8/0.20
        Excel still matches the PR #1066 + PROBE 8 reference; if not,
        Π.1 V1 estimate gains 1–3 days for re-port of changed rules.
      - **STRUCTURAL** (file renamed, function signature changed,
        input/output JSON shape changed): SPEC's reuse policy table
        must be re-validated; estimate may need fundamental revisit.
- [ ] Document drift findings inline in this SPEC under a new "Drift
      audit YYYY-MM-DD" subsection.

### Tabulky 0050/0060/0070/0080 prerequisite (see next section)

- [ ] Decide: do Π.0a Step 8 first (clean foundation) or read Tabulky
      directly in Π.1 V1 (faster but bypasses canonical layer). User
      preference recorded 2026-05-09: **Π.0a Step 8 is a prerequisite**
      (clean data foundation). Add ~4–6h to total estimate.

### Constants verification

- [ ] A/B/C `facade_brutto_m²`, `roof_skat_31_m²`, `obvod_m`, `n_bytů`,
      `harmonogram_měsíce` — ABMV email confirmation OR derive
      heuristically from master_extract polygons. If derived, flag low
      confidence and email ABMV for sign-off before final delivery.

### Estimate refresh

- [ ] Recompute V1 effort = base 8 days + Π.0a Step 8 (0.5 day) + drift
      premium (0–3 days from previous step) = **expected 8.5–11.5 days
      band**. If recomputed estimate exceeds 14 days, escalate to user
      before any code is written.

---

## Π.0a Step 8 (Tabulky 0050/0060/0070/0080 absorption) — prerequisite

User decision **2026-05-09**: Π.0a Step 8 IS a prerequisite for Π.1 V1.
This keeps every per-objekt item carrying clean Π.0a-canonical
provenance, instead of having TP/LP/OP/LI items bypass the foundation.

### Scope of Π.0a Step 8

Absorb the four remaining Tabulky into `master_extract_{A,B,C,D}.json`:

| Tabulka | Sheet | Codes | Phase 3 consumer | Π.0a section to populate |
|---|---|---|---|---|
| 0050 | TABULKA ZAMECNICKYCH VYROBKU | LP## (locksmith) | phase_3c_partB, phase_3e | `locksmith[]` |
| 0060 | TABULKA KLEMPIRSKYCH PRVKU | TP## (sheet metal) | phase_3b, phase_3c_partD | `sheet_metal_TP[]` |
| 0070 | TABULKA PREKLADU | LI## (lintels) | phase_3c_partC | `lintels[]` |
| 0080 | TABULKA OSTATNICH PRVKU | OP## (others) | phase_3c_partC | `others_OP[]` |

These four arrays are present in master_extract schema today but **empty**.
Step 8 populates them, following the same `{value, source, confidence}`
triple convention as Tabulka 0041 (doors) and Tabulka 0042 (windows).

### Implementation pattern (mirrors Steps 3 + 7)

- New extractor module: `pi_0/extractors/xlsx_other_tabulky.py`
- Per-Tabulka function: `extract_locksmith()`, `extract_sheet_metal()`,
  `extract_lintels()`, `extract_others_OP()`
- Each reads the canonical XLSX once via openpyxl read-only mode, returns
  a list of dicts with full-row absorption (every column → field with
  XLSX-cell provenance).
- Wire into `pi_0/extract.py` to populate the four arrays.
- Tests: `tests/test_xlsx_other_tabulky.py` mirroring `test_xlsx_dvere.py`
  pattern (full-row schema test + spot-check known codes + per-objekt
  coverage test where applicable — note: TP/LP/OP/LI are komplex-shared
  like windows + skladby, so identical across A/B/C/D after extraction).
- Re-run `diff_vs_legacy` for D — these new entries will show as NEW (no
  legacy counterpart in current Phase 0.x outputs); audit them as REAL
  vs FALSE_ALARM following the Step 7b precedent.

### Effort estimate

~4–6h (one focused half-day session). Should land in its own PR ahead of
Π.1 V1, so Π.1 V1 starts on a clean foundation.

### Deferred items in Step 8

- `Tabulka 0043 PROSKLENE PRICKY` (curtain walls / glass partitions) —
  current master_extract has `glass_partitions[]: empty` and PROBE 8
  recovery added CW11 + CW12 manually to the Excel. Step 8 should also
  absorb 0043 to close that loop properly. Treat as Step 8b if scope
  pressure forces a split.

---

## Context recap (from prior work)

- **Π.0a Part 3** (PR #1095) shipped `master_extract_{A,B,C,D}.json` —
  the canonical per-objekt foundation:
  - A: 80 rooms / 224 openings / 75 doors / 17 windows / 70 skladby
  - B: 68 rooms / 372 openings / 61 doors / 17 windows / 70 skladby
  - C: 59 rooms / 221 openings / 58 doors / 17 windows / 70 skladby
  - D: 111 rooms / 381 openings / 102 doors / 17 windows / 70 skladby
  - skladby (70) and windows (17) are komplex-shared, identical across all 4
  - every field is a `{value, source, confidence}` triple with full provenance

- **D-deliverable** (PR #1066, plus Π.0a PROBE 8 self-correction) is the
  reference Excel. **Read-only — must not be regenerated by Π.1.**
  - 12 sheets: `0_Souhrn`, `1_Vykaz_vymer` (3027 rows), `2_Audit_proti_staremu`,
    `3_Critical_findings`, `4_Mistnosti` (109 rooms), `5_Skladby` (31
    skladby × layers), `6_Border_zone`, `7_VRN`, `8_Carry_forward_findings`,
    `9_Metadata`, `11_Sumarizace_dle_kódu` (3134 rows incl. master+detail),
    `12_Filter_view` (Excel Table `VykazFilter`, 3023 rows × 13 cols)

- **D pipeline** that produced the Excel (read-only audit reference):
  - Phase 1 step 1–4: load Tabulky → enrich rooms → decompose skladby → aggregates
    → produces `objekt_D_geometric_dataset.json`
  - Phase 3a/3b/3c/3d/3e: 13 generator scripts, ~2500 LOC, emit 7 items JSONs
  - Phase 0.11/0.12/0.13/0.15/0.16/0.17/0.18/0.19: 8 reactive hot-fix scripts
  - Phase 3c_combine: merges 7 items JSONs → `items_objekt_D_complete.json`
    (3021 items)
  - Phase 5 step 2/3: TF-IDF audit vs starý VV → `match_candidates.json`
  - Phase 6: `items_objekt_D_complete.json` + dataset + audit + match_candidates
    → 10-sheet Excel (`0_Souhrn`..`9_Metadata`)
  - Phase 8: append List 11 `Sumarizace_dle_kódu`
  - Phase 0.20: append List 12 `Filter_view` Excel Table

---

## Critical discoveries that shape Π.1

### D1 — `items[]` is the contract; not master_extract

The Phase 6/8/0.20 Excel generators consume `items_objekt_D_complete.json`,
NOT `master_extract_D.json`. Their input contract is a flat list of
`{item_id, kapitola, popis, MJ, mnozstvi, misto:{objekt,podlazi,mistnosti},
skladba_ref, urs_code, urs_status, confidence, status, poznamka, …}` —
plain values, no triples. Π.1 must produce the same shape per A/B/C.

### D2 — `master_extract.rooms` lacks the surface enrichment that Phase 3 needs

Phase 3 generators iterate `dataset["rooms"]` expecting per-room fields:
`F_povrch_sten`, `F_povrch_podlahy`, `FF`, `CF`, `F_povrch_podhledu`,
`nazev`, `podlazi`, `mistnost_num`, `byt_or_section`, `wall_segment_tags`,
`ceiling_segment_tags`, `other_segment_tags`, `plocha_sten_brutto_m2`,
`tabulka_match`, …

`master_extract.rooms` carries ONLY DXF-derived geometry (`code`,
`area_m2`, `centroid`, `perimeter_m`, `polygon`, `source_drawing`).

**Implication:** Π.1 must re-do Phase 1 step 2 / step 3 / step 4 against
master_extract — or extend Π.0a with a Step 8 enrichment pass.
Recommendation: **adopt as a Π.1 transform** (`pi_1.enrich.build_dataset`)
rather than retrofit Π.0a. master_extract stays canonical foundation.

### D3 — D-share `= 0.25` is fragile

Phase 3b/3c allocate `TP##` (sheet metal), `LP##` (locksmith), `OP##`
(other prvky), `LI##` (lintels) by multiplying komplex Tabulka counts ×
0.25. The Tabulka itself is komplex-wide; per-objekt counts come from this
flat division.

`master_extract.{sheet_metal_TP, locksmith, lintels, others_OP}` is
EMPTY in current master_extract output (Π.0a Part 3 didn't absorb these
tables — they're listed as future-work tables 0050/0060/0070/0080).

**Implication for Π.1:**
- Either complete Π.0a with Step 8 to absorb Tabulky 0050/0060/0070/0080
  (estimated 4–6h, follows the 0041/0042 pattern)
- Or read those Tabulky directly in Π.1 (smaller scope but circumvents
  the canonical foundation idea)

The user explicitly said "DO NOT modify Π.0a master_extract files" — so
Π.1 reads Tabulky 0050/0060/0070/0080 directly. **Note this trade-off:**
TP/LP/OP/LI items will not be Π.0a-traceable in A/B/C deliverables.

### D4 — Suterén (1.PP) is geometrically shared

Per-objekt 1.PP rooms in master_extract:
- A: 0 rooms in 1.PP (A has no basement claim)
- B: 0 rooms in 1.PP
- C: 0 rooms in 1.PP
- D: 43 rooms in 1.PP — D's master_extract claims **all** 1.PP

This matches Phase 3b's behaviour (`MISTO_D_PP` for all suterén items).
Per ABMV documentation review (PROBE 1, PROBE 2, PROBE 4, F11/F14
hot-fixes in Phase 0.13/0.16), D is intentionally the bookkeeping owner
of 1.PP komplex. **Decision:** A/B/C deliverables emit ZERO 1.PP items.
D-deliverable retains full suterén scope.

### D5 — Spec constants are D-specific

Phase 3b/3d hardcode: `FACADE_BRUTTO_M2 = 838`, `ROOF_SKAT_31_M2 = 195`,
`OBVOD_M = 80.98`, `N_BYTU_D = 11`, `HARMONOGRAM_MESICE = 4`. A/B/C
need their own values. master_extract carries `footprint_areas` but it's
EMPTY in Π.0a output (deferred). For Π.1:
- Roof area: derive from rooms with `nazev` LIKE "STŘECHA" or from polygon
  union of top-floor rooms (heuristic)
- Facade brutto: derive from `perimeter_m` × clear height of each podlazi
- N_bytů per objekt: derive by counting rooms with `byt_or_section` ≠ "S"
- Harmonogram: keep 4 měsíce as komplex constant (dohoda s investorem)

These derivations need the surface enrichment from D2.

### D6 — No starý VV per A/B/C; Phase 5 audit is N/A

`Vykaz_vymer_stary.xlsx` is **komplex-wide**. Phase 5 fuzzy match was
already run against the komplex starý VV when D was generated; no new
match runs are possible per-objekt. Therefore for A/B/C:
- Sheet `2_Audit_proti_staremu` is N/A → either remove, or fill with a
  one-row banner ("Audit proti staremu byl proveden komplex-wide v rámci
  D-deliverable; per-objekt audit nemá smysl bez per-objekt starého VV").
- Sheet `3_Critical_findings` (PROBE detail) is empty for A/B/C.
- Sheet `8_Carry_forward_findings` carries ABMV documentation_inconsistencies
  shared with D, plus any Π.1 verification findings discovered during run.

### D7 — User explicitly said "no pricing"

ÚRS code lookup (Phase 4 / Phase 7a / Phase 6.4) is NOT in scope for Π.1.
Sheet `1_Vykaz_vymer` column "ÚRS kód" stays as `[doplnit]` placeholder
(same as D before Phase 7a). Sheet `11_Sumarizace_dle_kódu` master rows
keep yellow-highlighted empty ÚRS column. This drops ~30% of the original
D pipeline scope for A/B/C.

---

## Architecture decision

Per Explore agent recommendation (Option ii), endorsed: **build a clean
`pi_1/` package that reads `master_extract_{A,B,C,D}.json` and reuses
Phase 3.x domain rules via extracted helpers**, NOT a parameter-flag
retrofit of the existing Phase 3.x scripts (too much D-entanglement).

```
pi_1/
├── __init__.py
├── enrich.py           # master_extract triples → dataset (D2)
├── allocate.py         # komplex Tabulka → per-objekt items (D3)
├── transform.py        # ports of Phase 3.x rules → emit items per kapitola
├── generate.py         # items[] + dataset → Excel (12 sheets)
├── tests/
│   ├── test_enrich.py
│   ├── test_allocate.py
│   ├── test_transform.py
│   ├── test_generate_a.py
│   ├── test_generate_b.py
│   └── test_generate_c.py
└── (no main.py; CLI exposed via __main__.py: `python -m pi_1 --objekt={A|B|C}`)
```

### Reuse policy

| Existing module | Π.1 strategy |
|---|---|
| `phase_1_step1_load_tabulky.py` | **Read-only call** — use as library to load shared XLSX |
| `phase_1_step2_enrich_rooms.py` | **Logic ported into `pi_1.enrich`** — adapted to read master_extract |
| `phase_1_step3/4` (skladby_decomp + aggregates) | **Logic ported** — same |
| `phase_3a..3e_generate_items.py` | **Helpers extracted** to `pi_1.transform.{kap_HSV611, kap_HSV631, …}` |
| `phase_3c_partD_refinements.py` | **Logic ported** — D1/D2/D5/D6/D9 refinements per-objekt |
| `phase_0_1{1..9}` hot-fixes | **Each evaluated** for A/B/C applicability — most won't apply (S.D.16 carryforward is D-only; F11/F14 1.PP is D-only) |
| `phase_6_generate_excel.py` | **Wrapped, NOT modified** — Π.1 calls it via objekt-parameterised dispatcher |
| `phase_8_list11_sumarizace.py` | **Wrapped, NOT modified** — same |
| `phase_0_20_filter_view_table.py` | **Wrapped, NOT modified** — same |

The user's "DO NOT change Phase 6 generator unless absolutely necessary"
constraint is honoured by the wrapping pattern: Π.1 builds a per-objekt
working directory with the right input filenames, runs Phase 6/8/0.20 in
it, then renames outputs. Concretely:

```python
# pi_1/generate.py (sketch)
def build_excel(objekt: str) -> Path:
    workdir = OUT / f"_pi_1_objekt_{objekt}_workdir"
    # stage inputs with the names Phase 6 expects
    (workdir / "items_objekt_D_complete.json").write_text(items_json)
    (workdir / "objekt_D_geometric_dataset.json").write_text(dataset_json)
    (workdir / "phase_5_diff.json").write_text(stub_audit_for_AB_C(objekt))
    …
    run_phase_6_in(workdir)
    run_phase_8_in(workdir)
    run_phase_0_20_in(workdir)
    final = OUT / f"Vykaz_vymer_Libuse_objekt_{objekt}_dokoncovaci_prace.xlsx"
    (workdir / "Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx").rename(final)
    return final
```

Phase 6/8/0.20 stay D-named on disk during the run; Π.1 renames at the
end. **Trade-off:** mild ugliness, but zero risk to D scripts.

---

## Variant V1 — Full parity (7–9 days)

### Scope

Reproduce for A/B/C the same item-coverage that D has — every kapitola
emits items derived from master_extract per the Phase 3.x rules.

### Coverage matrix (per kapitola)

| Kapitola | D items | Source rule | A/B/C status |
|---|---:|---|---|
| HSV-611 omítky | 142 | per room with F04/F05/F17/F19 walls | port verbatim |
| HSV-612 špalety | 170 | opening perimeter × depth (D2 split 30%/70%) | port verbatim |
| HSV-622.1 cihelné pásky | 5 | facade F08 area = facade_netto − F13 − F16 | needs A/B/C facade_brutto + F13/F16 areas |
| HSV-622.2 tenkovrstvá | 3 | F13 area | needs A/B/C F13 area |
| HSV-622.3 betonová stěrka | 2 | F16 area (~est. 30 m²) | derive from podhledy area |
| HSV-631 mazaniny | 503 | per FF code per room | port verbatim |
| HSV-642/643 osazení dveří | 99 | per door D## type count × N | port; door counts from master_extract.doors |
| HSV-941 lešení | 10 | facade brutto × pronájem 4 měsíce | needs A/B/C facade_brutto |
| HSV-944 pomocné | 4 | žebříky / zábrany / sítě / zakrytí | port; quantities scale to facade |
| HSV-997 přesun hmot | 3 | 80t cement + 18t SDK + … | recompute from per-objekt items |
| HSV-998 pomocné práce | 5 | drážky / broušení / prach | port |
| PSV-711 hydroizolace | 2 | FF03 area | A/B/C unlikely (no 1.PP claim) |
| PSV-712 střechy | 19 | RF13/RF20 + RF11 vegetační (D9) | needs A/B/C roof skladba |
| PSV-713 ETICS | 17 | EPS 200 facade + sokl XPS | needs A/B/C facade_brutto |
| PSV-762 tesařské | 6 | latě + difuzní fólie pod Tondach | needs A/B/C roof |
| PSV-763.1 SDK podhled | 136 | per CF20/CF21 room | port |
| PSV-763.2 SDK předstěny | 215 | per WF segment | port (segment_tags must come from enrich) |
| PSV-763.3 SDK podkroví | 7 | 3.NP skat 31° | needs A/B/C top-floor scope |
| PSV-763.4 SDK nadezdívky | 13 | WF11/WF22 in 3.NP | port |
| PSV-764 klempířské | 41 | TP## × 0.25 D-share | **D3 issue** — re-derive A/B/C share or load Tabulka 0060 directly |
| PSV-765 Tondach | 9 | bobrovka krytina | needs A/B/C roof |
| PSV-766 truhlářské | 91 | per D## door type | port; counts from master_extract |
| PSV-767 zámečnické | 97 | LP## × 0.25 | **D3 issue** — Tabulka 0050 |
| PSV-768 spec dveře | 8 | garážová + EI60 + revizní | komplex-shared decisions |
| PSV-771 dlažby | 202 | per F01/F02/F18/F21/F22 floor | port |
| PSV-776 vinyl | 168 | per F03 floor | port |
| PSV-781 obklady | 172 | per F06 koupelny + D1/D3 refinements | port |
| PSV-783 zinkování | 93 | LP## + F11/F10/F00/F14 1.PP | A/B/C: LP only (no 1.PP) |
| PSV-784 malby | 491 | per F04/F05/F17/F19 walls + ceilings | port |
| PSV-925 zařízení staveniště | 5 | sociální zázemí | komplex-shared, allocate per-objekt |
| PSV-952 úklid | 13 | hrubý + průběžný + závěrečný | port; m² scales |
| OP-detail | 63 | OP## × 0.25 | **D3 issue** — Tabulka 0080 |
| LI-detail | 14 | LI## × 0.25 | **D3 issue** — Tabulka 0070 |
| Detail-parapet/ostění/spara/dilatace/soklová-mřížka | 8 | window count × spec multipliers | port |
| VRN-010..027 | 11 | komplex VRN structure | komplex-shared, allocate per-objekt |

### Effort breakdown V1

| Phase | Effort | Deliverable |
|---|---|---|
| Step 1 — `pi_1.enrich` | 1.5 day | `dataset_{objekt}.json` from master_extract + Tabulka 0020 join |
| Step 2 — `pi_1.allocate` (D3) | 1 day | per-objekt allocator for Tabulky 0050/0060/0070/0080 |
| Step 3 — Port Phase 3a (6 kapitola, 1425 D items) | 1.5 day | items_phase_3a_{A,B,C}.json + tests |
| Step 4 — Port Phase 3b (8 kapitola, 104 D items) | 1 day | …3b… |
| Step 5 — Port Phase 3c partA/B/C/D (10 kapitola, 521 D items) | 1.5 day | …3c… |
| Step 6 — Port Phase 3d/3e + 0.1x (4 kapitola + VRN, 227 D items) | 0.5 day | …3d/e… |
| Step 7 — Phase 6/8/0.20 wrapper + tests | 0.5 day | per-objekt Excel produced |
| Step 8 — Cross-objekt validation + idempotency | 0.5 day | verify A vs B vs C consistency, 3× re-run identical |
| **Total** | **8 days** (≈ 7–9 day band) | |

### Risks V1

| Risk | Severity | Mitigation |
|---|---|---|
| A/B/C surface codes (F_povrch_*) absent in master_extract | **HIGH** | Tabulka 0020 has them per-room komplex-wide; enrich step joins by code |
| A/B/C roof / facade brutto unknown | **HIGH** | Compute heuristically OR ABMV email to confirm spec |
| Phase 0.1x hot-fixes (8 of them) — applicability per A/B/C unclear | MEDIUM | Each evaluated case-by-case; flag uncertain ones for ABMV review |
| TP/LP/OP/LI Tabulka direct-load bypasses Π.0a canonical foundation | MEDIUM | Document explicitly; consider Π.0a Step 8 follow-up |
| 5 000 LOC port introduces transcription bugs | MEDIUM | Per-step golden test against D items[] (port should regenerate D items[] within 1% tolerance) |
| User wants this "in days, not weeks" | HIGH | This SPEC honest about scope; user picks variant |

---

## Variant V2 — Redistribution (DROPPED 2026-05-09)

User decision **2026-05-09**: V2 is **insufficient quality** for any
A/B/C deliverable. Share-key redistribution from D items produces
illustrative-only quantities (confidence 0.5–0.7) and per-room codes that
don't exist in A/B/C — both are unacceptable for engineering-grade work.

V2 is preserved as historical context only and **must not be implemented**.
Any future "quick redistribution" request reverts to V3-shaped foundation
snapshot, never V2.

---

## Variant V3 — Foundation MVP (DROPPED 2026-05-09)

User decision **2026-05-09**: V3 is **not a deliverable** — it's a
structural data snapshot, not a work-list. If someone needs "just the
rooms and skladby for A/B/C", they can read `master_extract_{A,B,C}.json`
directly; no Excel wrapper adds value.

V3 is preserved as historical context only and **must not be implemented**
as a Π.1 product.

---

## Test plan (V1)

| Test | Asserts |
|---|---|
| `test_master_extract_loads_all_4_objekty` | A/B/C/D all load, schema-version 1 |
| `test_dataset_enrich_idempotent_3x` | Π.1 dataset is byte-identical 3× run |
| `test_room_count_matches_master_extract` | dataset.rooms count == master_extract.rooms count per objekt |
| `test_skladby_identical_across_objekty` | A/B/C/D all carry the same 70 skladby (komplex-shared) |
| `test_windows_identical_across_objekty` | A/B/C/D all carry the same 17 windows |
| `test_d_pipeline_unchanged` | D Excel still matches PROBE 8 reference (no regression) |
| `test_pi_1_d_regression` | Π.1 run for `--objekt=D` produces an Excel within 1% item-count tolerance vs reference |
| `test_a_excel_has_12_sheets` | Output Excel has all 12 sheets |
| `test_a_filter_view_table_present` | Sheet 12 has `VykazFilter` Excel Table |
| `test_a_no_d_misto_leakage` | No item in A/B/C carries `misto.objekt == "D"` or `misto.mistnosti` starting with `S.D.` |
| `test_a_no_1pp_items_for_abc` | A/B/C deliverables emit 0 items in 1.PP (suterén is D-only) |
| `test_step8_tabulky_populated` | Π.0a Step 8 prerequisite — locksmith / sheet_metal_TP / lintels / others_OP arrays non-empty in master_extract |

---

## Cross-objekt verification report (Part 2 deliverable)

After Part 2, generate `pi_1_cross_objekt_report.md`:

| Metric | A | B | C | D (ref) | Notes |
|---|---:|---:|---:|---:|---|
| Total items | TBD | TBD | TBD | 3021 | |
| Per-kapitola coverage | TBD | TBD | TBD | 50 | |
| Total floor area m² | TBD | TBD | TBD | … | from master_extract aggregates |
| Total wall surface m² | TBD | TBD | TBD | … | |
| Doors count | 75 | 61 | 58 | 102 | from master_extract |
| Windows count | 17 | 17 | 17 | 17 | shared catalogue |
| 1.PP items | 0 | 0 | 0 | 1100+ | D-only by design |

---

## Out-of-scope (deliberately deferred)

- **ÚRS code lookup** — Phase 4 / Phase 7a; user said "no pricing"
- **Phase 5 audit vs starý VV per A/B/C** — N/A (komplex-wide audit only)
- **PROBE detail per A/B/C** — no PROBE history; Sheet 3 minimal
- **A/B/C extrapolation of D's PROBE 8 specialty items** — explicitly
  deferred to per-objekt verification at Π.1 trigger time (do NOT assume
  the same 6 codes are missing in A/B/C without DXF confirmation)

---

## Status — recorded decisions and open commitments

### Decisions recorded 2026-05-09

- ✅ **V1 Full parity** is the only acceptable Π.1 quality level for any
  future A/B/C deliverable.
- ❌ V2 Redistribution and V3 Foundation MVP are **DROPPED** — neither is
  a valid Π.1 product.
- ⏸ Π.1 V1 implementation is **DEFERRED** — no work proceeds until a
  trigger condition is met (see "Trigger conditions" section).
- ✅ Π.0a Step 8 (absorb Tabulky 0050/0060/0070/0080 — locksmith /
  sheet-metal / lintels / others) is a **prerequisite** for Π.1 V1 — the
  foundation must be clean before generators consume it.
- ✅ D-deliverable on disk (`Vykaz_vymer_..._objekt_D_dokoncovaci_prace.xlsx`
  + `items_objekt_D_complete.json` + `objekt_D_doors_ownership.json`)
  MUST stay byte-identical post-Π.1. No Π.1 code path may write into
  D-named outputs except in throwaway workdirs cleaned up before exit.

### Open commitments to revisit at trigger time

These are NOT decided now; they're parked until pre-implementation
checklist day (see that section above).

- A/B/C `facade_brutto_m²`, `roof_skat_31_m²`, `obvod_m`, `n_bytů` —
  derive heuristically from master_extract polygons OR ABMV email for
  spec confirmation. Decide at trigger time based on (a) how many spec
  constants Phase 3.x actually consumes after the drift audit, (b) ABMV
  responsiveness window vs project timeline.
- Phase 0.1x hot-fix applicability per A/B/C — each of the 8 hot-fixes
  (S.D.16/S.D.42 inject, F15 izolace, F11/F14 inject, SDK podhled,
  kročejová, keramický obklad, PSB beton, D05 cleanup) is evaluated
  case-by-case during the port; a decision matrix is produced as part
  of Π.1 V1 Step 3–6.
- Π.0a Step 8b (Tabulka 0043 PROSKLENE PRICKY absorption) — split off
  Step 8 if scope pressure forces it, otherwise bundle into the same PR.

---

## Next action

**No code is written for Π.1 until a trigger condition fires.** When one
does:

1. Run the Pre-implementation checklist (half-day, time-boxed).
2. Land Π.0a Step 8 in its own PR (~4–6h) so master_extract carries
   complete TP/LP/OP/LI absorption.
3. Implement Π.1 V1 per the Effort breakdown table in the
   "Variant V1 — Full parity" section, refreshed by the checklist's
   estimate-refresh step.
4. Generate A, B, C Excels.
5. Run cross-objekt verification report (template in
   "Cross-objekt verification report" section).
6. Idempotency check (3× re-run, byte-identical per Π.0a contract).
7. Open Π.1 V1 PR.

Code surface estimate: ~3500 LOC of new code in `pi_1/`, zero changes
to existing Phase 1/3.x/6/8/0.20 scripts (wrapping pattern, per the
user's "DO NOT change Phase 6 generator unless absolutely necessary"
constraint).

---

_Generated by Claude Code Π.1 Part 1 SPEC, 2026-05-09. V1 selected +
deferred 2026-05-09._
