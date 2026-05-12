# STAVAGENT — Session Handoff — Libuše objekt D

**Date saved:** 2026-05-11 (pre-restart for fresh context window)
**Branch:** `claude/velton-delivery-prep`
**Last commit:** `a6b17160` — PROBE 13 fix: bulk FF01 floor area pro všech sklepních kójí 1.PP (42 rooms, 126 items, 250.76 m² recovered)
**Commits ahead of `origin/main`:** **5**
**Working tree:** clean
**Deadline:** VELTON delivery 19.5.2026

---

## 1. Final state — Libuše D delivery

| Aspect | Value |
|---|---|
| Branch | `claude/velton-delivery-prep` |
| Last commit SHA | `a6b17160` |
| Last commit message | _PROBE 13 fix: bulk FF01 floor area pro všech sklepních kójí 1.PP (42 rooms, 126 items, 250.76 m² recovered)_ |
| Commits ahead of main | 5 |
| Working tree | clean (no untracked, no modified) |
| items SHA | `4dd8b3f5c234692501cc8c0e4683c66e6d5bf5bec22641be68dc814bcb979b1d` |
| Excel size | 1 105 227 bytes (1.05 MB) |
| Item count | **4 025** |

### The 5 commits on this branch (newest first)

```
a6b17160  PROBE 13 fix: bulk FF01 floor area pro všech sklepních kójí 1.PP (42 rooms, 126 items, 250.76 m² recovered)
f8339ff7  PROBE 10 fix: sklepní kóje S.D.16/27/42 wall area direct from DWG (67.64 m² recovered, 12 items, confidence 0.95)
5b057229  feat: List 13 Filter_view_plus s Subdodavatel + Discipline columns (preserves List 12)
6063431c  VELTON cover letter draft pro Libuše D delivery 19.5
158764b0  ABMV email content: 10 documentation items pro Libuše D
```

---

## 2. Cumulative PROBE recovery summary

Per `items_objekt_D_complete.json` metadata.carry_forward_findings (11 entries total).

| PROBE | Scope | Items | Status | Recovery |
|---|---|---:|:---:|---|
| **PROBE 1** | starý VV missing ~2000 m² cement screed (HSV-631 komplex) | — | critical (catalogued) | flagged as `VYNECHANE_KRITICKE` in Phase 5 audit; ~3 mil Kč komplex / ~750 k Kč D-side |
| **PROBE 2** | starý VV missing ~240 m² hydroizolace pod F06 obklad komplex (PSV-781) | — | critical (catalogued) | ~71 m² D-side; flagged as `VYNECHANE_KRITICKE` |
| **PROBE 3** | Cihelné pásky Terca — old VV missing material supply (HSV-622.1) | — | critical (catalogued) | ~970 k Kč D-side / ~3.9 mil Kč komplex |
| **PROBE 4** | F15 tepelná izolace stropů 1.PP missing (Phase 0.12 fix injected 86 items) | 86 | closed by Phase 0.12 | ~134 k Kč D-side |
| **PROBE 5** | FF01 generator mismap + F11/F14 inject (Phase 0.13) | ~209 | closed by Phase 0.13 | ~1 k Kč net |
| **PROBE 6** | D05 wrong template (rolovací brána, not interior) + scope C (Phase 0.19 deprecated 11 items qty=0) | 11 | closed by Phase 0.19 | 0 value impact (items had qty=0 conditional) |
| **PROBE 7** | Tabulka 0041 partial column extraction (RC/EMZ/ACS/SN2 cols missed) | — | closed by Π.0a Step 3 (PR #1095) | full 28-col absorption |
| **PROBE 8** | Specialty openings silent-drop (Phase 5 fuzzy score <0.30) — D06 fire gate, W81-84, CW11-12 | **6** | **FIXED** (PR #1095) | **~1.0 mil Kč material gap closed (45 DXF instances verified)** |
| **PROBE 9** | TZB prostupy + štroby HSV scope (Π.0a Step 8c + Part 5B heuristic) | **998** | **FIXED** (PR #1098 + #1101) | **~400–500 k Kč TZB scope** |
| **PROBE 10** | Sklepní kóje wall area S.D.16/27/42 (post-delivery audit, direct DWG measurement) | **12** | **FIXED** (commit `f8339ff7`) | **67.64 m² unique wall surface; 270.56 m² billing-line** |
| **PROBE 13** | Bulk FF01 floor area všech sklepních kójí 1.PP (post-delivery audit, Tabulka 0020 literal) | **126** | **FIXED** (commit `a6b17160`) | **250.76 m² unique floor area across 42 rooms; 752.28 m² billing-line** |

> PROBE 11, PROBE 12 numbers were skipped (no PROBE used those IDs during the session — PROBE 13 jumped from PROBE 10 directly).

### Totals

- **Items recovered (PROBE 8–13):** **1 142** items across 4 finally-FIXED PROBE classes (6 + 998 + 12 + 126)
- **PROBE 8 + PROBE 9 + PROBE 10 + PROBE 13 estimated value:** **~1.5–1.7 mil Kč** combined across material + TZB scope + floor/wall area
- **PROBE 1–4 carry_forward (pre-PROBE 8):** flagged historic critical findings, already documented in starý VV audit
- **D Excel grew:** 3 028 rows in List 1 (pre-PROBE-8) → **4 026 rows post-PROBE-13** (+998 net adds, 138 m²=0 in-place fixes)

### Source column distribution in List 1 (post-PROBE-13)

| Source category | Items |
|---|---:|
| (none) — original PR #1066 pipeline | 2 386 |
| PROBE_9 (Step 8c TZB) | 998 |
| subcontractor_required | 481 |
| **PROBE_13 (bulk FF01)** | **126** |
| general_site_overhead | 16 |
| **PROBE_10 (sklepní wall area)** | **12** |
| **PROBE_8 (specialty openings)** | **6** |
| **TOTAL** | **4 025** |

---

## 3. Excel state

| Sheet | Rows | Cols | Purpose |
|---|---:|---:|---|
| `0_Souhrn` | 60 | 4 | Headline metrics + recommendations |
| `1_Vykaz_vymer` | **4 026** | **12** | Main soupis (1 header + 4 025 items) |
| `2_Audit_proti_staremu` | 1 424 | 9 | Diff vs starý komplex VV |
| `3_Critical_findings` | 115 | 5 | PROBE detail |
| `4_Mistnosti` | 112 | 14 | Rooms reference |
| `5_Skladby` | 260 | 8 | Skladby s vrstvy |
| `6_Border_zone` | 3 | 7 | Items čekající na vyjasnění |
| `7_VRN` | 13 | 8 | Vedlejší rozpočtové náklady |
| `8_Carry_forward_findings` | 8 | 7 | Audit log (Excel-side, simplified) |
| `9_Metadata` | 37 | 2 | Provenence + pipeline verze |
| `11_Sumarizace_dle_kódu` | 3 128 | 11 | KROS-friendly grouped sumarizace |
| `12_Filter_view` | **4 027** | **13** | **Excel Table `VykazFilter`** (sortable po podlaží/místnost/kapitola/status) |
| `13_Filter_view_plus` | **4 027** | **15** | **Excel Table `VykazFilterPlus`** (= List 12 + Discipline + Subdodavatel) |

**File path:** `test-data/libuse/outputs/Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` (1 105 227 bytes)

### Backup files (audit trail, all committed)

| Backup | Size | Pre-state |
|---|---:|---|
| `Vykaz_vymer_pre_probe_8.xlsx` | 686 261 B | Pre-PROBE-8 fix |
| `Vykaz_vymer_pre_probe_9.xlsx` | 688 291 B | Pre-PROBE-9 (Part 5A+5B) |
| `Vykaz_vymer_pre_vzt_chl_direct_v2.xlsx` | 774 136 B | Pre-drop-v3 (VZT/chl direct) |
| `Vykaz_vymer_pre_list_13.xlsx` | 801 250 B | Pre-List-13 |
| `Vykaz_vymer_pre_probe_10.xlsx` | 1 093 955 B | Pre-PROBE-10 sklepní wall area |
| `Vykaz_vymer_pre_probe_13.xlsx` | 1 095 970 B | Pre-PROBE-13 bulk FF01 |

Older backups (`pre_phase_0_15/19/20`, `pre_6_4`, etc.) also present from earlier session work.

---

## 4. Critical files inventory

### Deliverables for VELTON

| File | Purpose |
|---|---|
| `test-data/libuse/outputs/Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` | **Final D Excel (1.05 MB, 13 sheets, 4 025 items)** |
| `test-data/libuse/outputs/items_objekt_D_complete.json` | Canonical items source (5.6 MB) |
| `test-data/libuse/outputs/velton_cover_letter_libuse_d.md` | Cover letter draft (Czech business style, 6 sekcí, 204 lines) |

### ABMV email queue

| File | Purpose |
|---|---|
| `test-data/libuse/outputs/abmv_email_libuse_objekt_d.md` | Markdown for review (10 numbered items) |
| `test-data/libuse/outputs/abmv_email_libuse_objekt_d.txt` | Paste-ready plain text |
| `test-data/libuse/outputs/documentation_inconsistencies.json` | Source queue (10 items in `abmv_email_required[]`) |

### PROBE audit docs

| File | Lines | Purpose |
|---|---:|---|
| `test-data/libuse/outputs/probe_8_candidates_audit.md` | ~140 | PROBE 8 specialty openings (6 codes) audit + cost estimates |
| `test-data/libuse/outputs/probe_9_source_audit.md` | ~300 | PROBE 9 source DXF audit (PARTIAL verdict pre-drop-v3) |
| `test-data/libuse/outputs/probe_9_full_audit_per_section.md` | ~510 | Per-discipline TZB audit baseline |
| `test-data/libuse/outputs/probe_9_vzt_chl_manual_counts.md` | ~265 | Heuristic methodology (Part 5B) |
| `test-data/libuse/outputs/probe_9_direct_vs_heuristic_diff_v2.md` | ~280 | Drop v3 direct vs heuristic diff |
| `test-data/libuse/outputs/probe_9_backlog.md` | ~210 | 4 PROBE 9 backlog tickets |
| `test-data/libuse/outputs/subdodavatel_breakdown_libuse_d.md` | ~280 | Per-subdodavatel report (29 categories, use cases) |

### Code added / changed this branch

| File | Purpose |
|---|---|
| `test-data/libuse/data/subdodavatel_mapping.json` | 110+ kapitola → trade mappings (v1.0) |
| `concrete-agent/packages/core-backend/scripts/phase_0_21_list13_filter_view_plus.py` | List 13 generator + items enrichment |

### Reference: pre-existing infrastructure (don't re-create)

| File | Note |
|---|---|
| `concrete-agent/packages/core-backend/scripts/pi_0/` | Π.0a Foundation Extraction Layer package (Steps 1–8c) |
| `concrete-agent/packages/core-backend/scripts/pi_0/extractors/dxf_tzb_prostupy.py` | Step 8c dual-mode VZT/chl extractor |
| `concrete-agent/packages/core-backend/scripts/pi_0/tests/test_dxf_tzb.py` | 15 acceptance tests |
| `concrete-agent/packages/core-backend/scripts/phase_6_generate_excel.py` | 10 sheets (0–9) |
| `concrete-agent/packages/core-backend/scripts/phase_8_list11_sumarizace.py` | List 11 in-place add |
| `concrete-agent/packages/core-backend/scripts/phase_0_20_filter_view_table.py` | List 12 in-place add |
| `concrete-agent/packages/core-backend/scripts/phase_0_21_list13_filter_view_plus.py` | List 13 in-place add (this branch) |

---

## 5. Pending backlog (priority order)

| # | PROBE | Scope | Estimated effort | Priority |
|---:|---|---|---|---|
| 1 | **PROBE 14a** — PSV-783 subdodavatel mapping fix | Currently mapped to `zámečník` (wrong); should be split into actual trades (epoxidář, PUR-mauklář, anti-graffiti specialist, zinkař). Edit `subdodavatel_mapping.json` + re-run `phase_0_21_list13_filter_view_plus.py`. | ~30 min | medium |
| 2 | **PROBE 14b** — F10 garáž 1.PP floor area | 4 PSV-783 items currently 0 m² with no `misto`. F10 = polyuretanový systém 1.PP garáž. Need garáž floor area (~200–350 m² expected from Tabulka or DXF). | ~30 min after area known | medium |
| 3 | **PROBE 15** — HSV-611 omítky in S.D.16/27/42 | 6 items × wall area (29.27/21.20/17.17 m²). Same as PROBE 10 but for HSV-611 instead of PSV-784. | ~15 min | low |
| 4 | **PROBE 16** — Missing HSV-611 omítky for 39 other sklepních kójí | **Generator-side gap** — Phase 3.x didn't emit HSV-611 items for those rooms at all. Requires deeper investigation: do F19 omítky apply to all sklepní walls? If yes, ~78 missing items × wall area. | ~2–4 h | high (largest potential recovery, but needs design decision first) |
| 5 | **58 komplex-shared OP/PSV items without misto** | D-share allocation artifact (TP##/LP##/OP##/LI## items × 0.25 share). Many likely intentional cross-references; needs case-by-case audit. | ~2 h to classify | low-medium |
| 6 | **1pp_VZT.dxf upload via git CLI** | 29 MB exceeds GitHub UI 25 MB limit. Closes remaining **102 heuristic VZT 1.PP items** → confidence 0.70 → 0.85. After upload: 30 min mechanical follow-through using drop v3 pattern. | ~30 min after upload | medium |
| 7 | **Cemex CSC 2026 submission** | Different project type (CSC = csv submission, not Excel BOQ). Mentioned in earlier session as future engagement. | TBD | informational |
| 8 | **Π.1 V1 generator for A/B/C komplex** | Per `TASK_PHASE_PI_1_SPEC.md` (merged main): 7–9 days work, **APPROVED + DEFERRED** until A/B/C order arrives. | 7–9 days | informational |

### Other m²=0 items remaining (Part 3 audit from PROBE 13)

| Bucket | Count | Decision needed |
|---|---:|---|
| 58 komplex-shared OP/PSV equipment | 58 | Audit each: real-zero vs missing-allocation |
| HSV-612 špalety (F04/F05) without fasáda | 15 | Likely legitimately 0 — exclude from filter |
| HSV-611 in S.D.16/27/42 | 6 | PROBE 15 candidate |
| Single-occurrence equipment | 2 | Spot-check |
| **TOTAL remaining m²=0** | **81** | (was 262 pre-PROBE-10/13) |

---

## 6. Tests + validation state

| Check | Status |
|---|---|
| **Step 8c tests** (`pi_0/tests/test_dxf_tzb.py`) | **15 / 15 PASS** |
| **Validation gate** (`run_validation_d`) | **373 MATCH / 0 MISSING / 0 CHANGED / 7 NEW = PASS** |
| **Idempotency** (3× `phase_0_21` re-run) | byte-identical (items SHA `4dd8b3f5c2346925`) |
| Item count | 4 025 (unchanged across PROBE 10 + 13 in-place updates) |
| **D Excel mtime** | deliberately updated by Phase 6/8/0.20/0.21 regen post-PROBE-13 (`Vykaz_vymer_pre_probe_13.xlsx` is the backup) |
| **List 12 byte-identical** through List 13 add | confirmed via contentSHA check (`3df1b5b78c53693d` pre = post) |

---

## 7. Reference docs for next session

| Doc | Path | Purpose |
|---|---|---|
| Π.0a SPEC | `test-data/libuse/TASK_PHASE_PI_0_SPEC.md` | 7-step Foundation Extraction Layer plan (merged in PR #1088) |
| Π.1 SPEC | branch `claude/phase-pi-1-generators` `test-data/libuse/TASK_PHASE_PI_1_SPEC.md` | V1 APPROVED + DEFERRED for A/B/C komplex |
| PROBE 8 audit | `test-data/libuse/outputs/probe_8_candidates_audit.md` | Specialty openings methodology |
| PROBE 9 source | `probe_9_source_audit.md` | Pre-drop-v3 PARTIAL verdict |
| PROBE 9 per-section | `probe_9_full_audit_per_section.md` | Step 8c design + layer convention |
| PROBE 9 heuristic | `probe_9_vzt_chl_manual_counts.md` | Density-ratio methodology |
| PROBE 9 direct vs heuristic | `probe_9_direct_vs_heuristic_diff_v2.md` | Drop v3 uplift quantification |
| PROBE 9 backlog | `probe_9_backlog.md` | 4 deferred tickets |
| Subdodavatel breakdown | `subdodavatel_breakdown_libuse_d.md` | 29 trade categories + use cases |
| ABMV email | `abmv_email_libuse_objekt_d.{md,txt}` | 10 documentation inquiries |
| VELTON cover letter | `velton_cover_letter_libuse_d.md` | Delivery cover letter Czech |
| **This handoff** | `test-data/libuse/STAVAGENT_Chat_Handoff_2026-05-11.md` | Session-restart state |

---

## 8. Critical context for next session

### DO NOT without explicit user instruction

- ❌ **DO NOT switch branches.** Branch `claude/velton-delivery-prep` is the active state with 5 commits ahead of main. Do not check out main or any other branch without user direction.
- ❌ **DO NOT regenerate the D Excel** without backing up first. Use the `Vykaz_vymer_pre_probe_13.xlsx` baseline as the most recent committed backup. Any new fix should follow the pattern: `cp Vykaz_vymer_...xlsx Vykaz_vymer_pre_probe_N.xlsx` → modify → commit backup + regen.
- ❌ **DO NOT modify** `items_objekt_D_complete.json` without preserving the carry_forward_findings array — 11 entries critical for audit trail.
- ❌ **DO NOT touch** PROBE 8/9/10/13 categories — they're filterable in Lists 12 + 13 via Source column (col 12) values `PROBE_8` / `PROBE_9` / `PROBE_10` / `PROBE_13`. Source column = category field per Phase 6 generator convention.

### Known gotchas / sharp edges

- **`subdodavatel_mapping.json` PSV-783 → "zámečník"** is WRONG. PSV-783 = anti-graffiti / PU / epoxid / zinek — multiple trades. PROBE 14a needs to split it. Currently 93 items affected (per subdodavatel_breakdown_libuse_d.md top-10). Don't trust PSV-783 column 15 of List 13 without verifying.
- **PROBE 16 is generator-side**, not data-side. The other 39 sklepní rooms have NO HSV-611 items emitted at all (not just m²=0). Fixing requires understanding why Phase 3a's room iteration skipped them. Possibly F19 wall surface only emits HSV-611 for rooms with `tabulka_match=True` and a specific FF/F skladba combination; sklepní rooms may have been filtered out by an early-exit. Needs read of `phase_3a_generate_items.py` before designing fix.
- **D-deliverable mtime baselines** were deliberately updated in PROBE 10 + PROBE 13 + List 13 commits. Previous "do not modify" pact ended when those PROBEs landed. The Vykaz_vymer_...xlsx in main IS the post-PROBE-13 version on the branch.
- **subdodavatel field is additive** on items — every item carries it post-Phase 0.21 enrichment. If user adds items post-handoff (e.g. PROBE 14a), enrichment must re-run via `python concrete-agent/packages/core-backend/scripts/phase_0_21_list13_filter_view_plus.py` to populate the new items.
- **Phase 0.20 List 12 + Phase 0.21 List 13** are IN-PLACE edits of the existing Excel. They both DELETE the sheet first if present, then recreate. Idempotent but stateful — if you regenerate from scratch via Phase 6, then Phase 8/0.20/0.21 must follow in that exact order.

### File path conventions

- All test data lives under `test-data/libuse/`.
- Outputs (deliverables + audits) under `test-data/libuse/outputs/`.
- Sources (DWG/DXF/PDF/XLSX) under `test-data/libuse/sources/{A,B,C,D,shared}/{dwg,dxf,pdf,xlsx,docx,_archives}/`.
- Scripts under `concrete-agent/packages/core-backend/scripts/`.
- Cwd for running scripts: **repo root** (`/home/user/STAVAGENT`). Scripts use relative paths from there.

---

## 9. Next session briefing template

Paste-ready briefing for the next Claude Code session:

```
CONTEXT RESUME — Libuše objekt D (PROBE 1-13 done, ready for PROBE 14+)

State as of 2026-05-11:

  Branch:        claude/velton-delivery-prep (5 commits ahead of main)
  Last commit:   a6b17160 — PROBE 13 fix bulk FF01 floor area
  Working tree:  clean
  D Excel:       Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx
                 1.05 MB, 13 sheets, 4025 items in List 1
  items SHA:     4dd8b3f5c234692501cc8c0e4683c66e6d5bf5bec22641be68dc814bcb979b1d
  Tests:         15/15 Step 8c passing, validation gate 373/0/0/7 PASS,
                 idempotency 3× byte-identical
  Deadline:      VELTON delivery 19.5.2026

Cumulative PROBE recovery (post-delivery audits 8-13):
  PROBE 8  : 6 items, ~1.0 mil Kč specialty openings
  PROBE 9  : 998 items, ~400-500 k Kč TZB prostupy + štroby
  PROBE 10 : 12 items, 67.64 m² sklepní wall area
  PROBE 13 : 126 items, 250.76 m² across 42 rooms (FF01 floor area)
  TOTAL    : 1142 items recovered, ~1.5-1.7 mil Kč combined value

For full state, read first:
  test-data/libuse/STAVAGENT_Chat_Handoff_2026-05-11.md

Optional follow-ups (pick by priority):
  PROBE 14a: PSV-783 subdodavatel split (zámečník is WRONG mapping)
  PROBE 14b: F10 garáž 1.PP floor area (4 items, ~200-350 m² expected)
  PROBE 15:  HSV-611 omítky v S.D.16/27/42 (6 items, ~67 m² same
             as PROBE 10 wall area)
  PROBE 16:  GENERATOR-SIDE — 39 sklepní rooms missing HSV-611 omítky
             items entirely (~78 missing items, requires Phase 3a audit
             before fix)
  1pp_VZT:   29 MB DXF upload via git CLI → closes 102 heuristic items

Critical context: see section 8 of handoff doc (DO NOTs + sharp edges,
especially PSV-783 mapping bug + PROBE 16 generator-side warning).

Branch state must remain on claude/velton-delivery-prep until VELTON
delivery 19.5.2026 is acknowledged.
```

---

## 10. When objekt B/C komplex work starts (Π.1 V1 phase)

**Read this before generating ANY items for objekty B nebo C.** This section
captures knowledge accumulated during D-side delivery (PROBE 6/14b/14c/17) that
applies cross-objekt.

### CRITICAL REMINDERS

#### 1. D05 = sekční vrata (NOT dveř)
- Read full template z `items_objekt_D_complete.json` →
  `metadata.carry_forward_findings` → entry `id=PROBE_6` →
  `next_action` field.
- Generate vrata items pro **S.C.02 + S.C.03 (objekt C) + S.B.02 (objekt B)**.
- **DO NOT** inherit D05 dveř pattern z objekt D items file
  (those items are `[DEPRECATED PROBE 6]` prefix, `mnozstvi=0`, audit trail only).
- Per-set items: sekční vrata kompletní set + elektrický pohon + montáž pohonu
  + bezpečnostní senzory + ovládání. Reference ~80 000–150 000 Kč per set.
- Cross-project pattern: see `docs/STAVAGENT_PATTERNS.md` "Pattern 8:
  Door-vs-Gate Classification Hazard".

#### 2. F10 PU garáž floors (PROBE 14b knowledge)
| Objekt | Místo | Floor area |
|---|---|---:|
| C | S.C.02 | 641.84 m² |
| C | S.C.03 |  68.80 m² |
| B | S.B.02 | 423.90 m² |
| **TOTAL komplex F10** | | **~1 134 m²** |

- Skladba: **FF01/FF03** (base) + **F10** (polyuretanový systém přímopojízdný)
  + **F14** walls (transparentní bezprašný nátěr).
- Wall height: **2.7 m**.
- Reference cena: ~700–900 Kč/m² (F10 PU) → ~800 000 – 1 000 000 Kč komplex
  F10 scope.
- Carry-forward: `id=PROBE_14b` / `status=VERIFIED_LEGITIMATE_ZERO` v
  `items_objekt_D_complete.json`.

#### 3. OP-detail items (PROBE 14c knowledge)
- 28 OP codes legitimately 0 v objektu D (verified — no garáže, per-window-SKU
  split, sparse komplex shared). Don't blindly copy D-side OP zeroing logic to
  B/C — recompute per-objekt.
- **Sharp edge for Π.1 V1:** DXF tag-text scanner missed **24 of 28** zero OP
  codes (symbol-only items invisible). Future generator must combine:
  - DXF tag-text scan (current `phase_6_1` logic)
  - Block / symbol detection (NEW — group by spec text + drawing block type)
- Per-window-SKU pattern: each `OP##` často corresponds k specific window
  dimension SKU. Group OP codes by `spec` text → assign per-objekt window
  dimensions to per-objekt OP codes. (D used OP86/87/89/90/96/98; A/B/C likely
  use other subsets.)
- Audit reference: `test-data/libuse/outputs/probe_14_op_items_audit.md`.

#### 4. ABMV F-code typos (PROBE 17 — pending 14.5.2026)
- 65 items v D s `category=PROBE_17` / `status=interpretace_pending_ABMV`
  s confidence 0.70 čekají na ABMV potvrzení.
- 3 buckets: F20→F17 (podhled 8 rooms 3.NP), F30→FF30 (4 WC), F20→FF20
  (1 WC 1.PP).
- **Po ABMV reply 14.5:** bulk-update status na `matched_ABMV_confirmed`
  + confidence 0.95, nebo targeted rerun s correct F-codes.
- Reference: `/tmp/probe_17_apply.py` (deletes after session — copy if needed)
  + carry_forward `id=PROBE_17`.

#### 5. F-code system general rules (cross-project)
- `F##` = povrch (stěn / podhledu / podlahy)
- `FF##` = skladba podlahy (base layer)
- `CF##` = typ podhledu (SDK konstrukce)
- Tabulky 0030 XLSX vs PDF má **vynechané F20** v PDF (XLSX má F00–F22
  sekvenční bez gap). Pokud F20 appears v projektu, suspect typo —
  cross-check s PDF Tabulky 0030.

### D Excel state at session-end

| Property | Value |
|---|---|
| Branch | `claude/libuse-delivery-continue-GEBr5` |
| Items SHA | `d3a68636162aea867cfcb297ce1731d28370c579732ede2564cf36e95ebbe650` |
| Items count | **4 090** (post-PROBE-17 state) |
| Excel sheets | 13 |
| Carry-forward entries | 15 |
| Last big commit | `747fba3` (PROBE 14c + PROBE 17) |

### Hand-off action checklist when starting Π.1 V1
- [ ] Read `items_objekt_D_complete.json` carry_forward entries:
      `PROBE_6`, `PROBE_14b`, `PROBE_14c`, `PROBE_17`.
- [ ] Read `docs/STAVAGENT_PATTERNS.md` Pattern 8 (door-vs-gate).
- [ ] Verify ABMV reply received (14.5 dependency) → update PROBE 17 status.
- [ ] Map B/C garáže → generate vrata items per PROBE_6 template.
- [ ] Map B/C F10 floors → generate FF01/FF03 + F10 PU + F14 walls items.
- [ ] Cross-check OP codes per-objekt (don't inherit D OP zeros).
- [ ] Combine DXF tag-text + block/symbol detection.

---

## Closeout

This handoff is the only artifact of this session-close action. No code changes, no item changes, no Excel changes. Branch `claude/velton-delivery-prep` is the canonical state and will receive the next session's continuation work.

Next session should:
1. Read this doc first
2. Verify branch + commit SHA match expectation (`a6b17160` on `claude/velton-delivery-prep`)
3. Verify items SHA matches `4dd8b3f5c234692501cc8c0e4683c66e6d5bf5bec22641be68dc814bcb979b1d`
4. Proceed with user-selected PROBE 14+ (or other directive)

---

_Generated by Claude Code, session handoff, 2026-05-11._
_§10 amended 2026-05-12 — PROBE 6/14b/14c/17 cross-objekt knowledge for Π.1 V1._
