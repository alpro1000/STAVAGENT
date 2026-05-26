# Session Retrospective — 2026-05-22 HK212 Stage A→E + Step 3 Polygonization

**Branch:** `claude/hk212-dilenska-ok-ut-dps-integration` (also `claude/hk212-step3-polygonization-areas` preserved on remote)
**Scope:** Full HK212 hala pipeline from DXF housekeeping → discovery → geometry → item composition → P0 Kingspan resolution
**Duration:** Long session (~30K LOC modifications, 12 atomic commits)
**Outcome:** items.json 141 → 127, P0 blocker resolved, Stage E benchmark unblocked.

---

## Commits (12)

| # | SHA | Topic |
|---|---|---|
| 1 | `2a6c9034` | Stage A/B/C: B5 steel-profile catalog + UT_HALAHK_DPS DSP discovery |
| 2 | `b23fff07` | Housekeeping rename: dilenska → dsp_dxf (DSP-grade confirmed) |
| 3 | `5064753f` | Task 2 Step 1: layer dictionary auto-detect (39.6 % → 100 % coverage) |
| 4 | `a74c8ed2` | Task 2 Step 1.5: A-GENM dossier (Lindab + MEARIN) + dictionary ratification |
| 5 | `75221920` | Task 2 Step 2: full geometry extraction across 8 DSP DXFs (29 categories) |
| 6 | `0b22136f` | Stage D: 22 items dropped (15 VZT + 7 Rpol) + HSV-3 _length_source + 4 ABMV closures |
| 7 | `d1bbde80` | Step 3: polygonization + 9 area metrics + items.json annotation (separate file) |
| 8 | `0065cae9` | Step 3: handoff doc + acceptance scorecard |
| 9 | `5bdfa22e` | Step 3: slope disambiguation (5.25° roof vs 5.65° gate angle) + kapitola coverage audit (P0 blocker found) |
| 10 | `43f7ba19` | Merge step3 → dilenska (no-ff, debug story preserved) |
| 11 | `2a02bff5` | Handoff doc finalized post-merge |
| 12 | `af55d317` | **Stage E: P0 Kingspan resolved** — 8 PSV-OPL + ABMV_2 vrata 3500mm + Pattern 8 |

---

## What worked

1. **Per-stage atomic commits with idempotency locks** — every script (`stage_d_apply_updates.py`, `stage_e_add_opl.py`, `step1_layer_dictionary.py`, etc.) checks for an applied flag in metadata before mutating. Allows safe re-runs and rollback via backup files (`.pre_stage_d.json`). No accidental double-application.

2. **3-strategy convergence test for polygonization** — when A101 walls alone gave 9 tiny polygons (4.1 m²), didn't just hard-fail STOP gate. Tried A105 walls+fnd (537.2 m²), A101 convex_hull (540.9 m²), and combined A101+A105 (538.5 m²). All within 1 %. Cross-validated footprint with high confidence (0.90).

3. **Largest disjoint MultiPolygon part as canonical footprint** — instead of taking `union.length` (counts interior partitions = 284 m) or all polygon parts, took only the largest disjoint MultiPolygon part. Slivers (41.9 m² across 4 thin pieces from foundation overhang) reported in audit but excluded from canonical area. Result: clean 103.5 m perimeter matching axes geometry 2×(19.3+28).

4. **Annotate-before-mutate discipline** — Step 3 created `items_hk212_etap1_with_geometry.json` as a separate annotated file. Original `items_hk212_etap1.json` UNCHANGED during Step 3. User can review `_geometric_source` annotations before any qty mutation. Same principle for Stage E: `_price_source: "user_skipped_pricing"` flag instead of forcing prices.

5. **Layer dictionary 3-step ratification (auto → user → finalize)** — Step 1 auto-classify (coverage 39.6 % initial → 100 % after rule expansion). Step 1.5 targeted scan of A-GENM ambiguous layer (revealed Lindab + MEARIN concrete products, not generic geometry). Step 1c user ratification of reclassifications. Coverage gate enforced before Step 2 aggregation.

6. **Branch separation for debug story** — Step 3 work isolated on `claude/hk212-step3-polygonization-areas` branch (3 atomic commits showing the debug arc: tiny polygons → investigation → convergence fix). Merged via `git merge --no-ff` to dilenska branch — debug history preserved on remote for audit traceability.

7. **TZ-derived specs over generic placeholders (Stage E)** — when user provided full TZ ARS DPZ text, regenerated all 8 PSV-OPL items with concrete TZ details (Kingspan KS1000 AWP, tl. 200 mm, MW, bílá+modrá, EW 15 DP1, EPDM podložka) instead of audit doc placeholders. Confidence jumped from 0.50 → 0.90.

---

## What failed

1. **TZ re-read missed in initial Stage E generation** ⚠️ **Forced user correction.** When kapitola coverage audit identified P0 Kingspan blocker, initial plan was to use the audit doc's generic placeholder template ("Kingspan K-roc tl. 150 mm RAL šedá"). User had to explicitly say "STOP, re-read TZ ARS DPZ first" and paste full TZ text. Symptom of Phase 0b context decay across long session.
   - **Lesson:** Pattern 8 codified in `STAVAGENT_PATTERNS.md` — re-read TZ as MANDATORY step before any new položka generation.

2. **5.65° initially misclassified as roof slope** — DIM_SLOPE_RE regex matched any angle. 5.65° appeared 12× on A101 (vrata sekční úhel otevírání) and was reported as "secondary overhang slope" in initial Step 3 summary. User caught it.
   - **Fix:** Slope picker now filters DIMENSION matches to A102_pudorys_strechy.dxf only (authoritative roof source).
   - **Lesson:** Sheet-scope filter on every regex extraction, not just regex pattern.

3. **First polygonize pass returned 4.1 m² of tiny polygons** — Walls don't form closed loops (door gaps + inner/outer face split). Would have triggered STOP gate. Required 3 iterations + foundation merge to recover. Cost ~2 hours.
   - **Lesson:** When walls insufficient, include foundation outer outline (A105 has clean 27.89m edge). Document multi-sheet fallback strategy in Step 3 spec for future projects.

4. **ABMV queue patch initially returned 0 items** — `stage_d_apply_updates.py` used `abmv_doc.get("queue", [])` but actual JSON key is `"items"`. Silent failure (no error, just no patches). Required restore from `.pre_stage_d.json` + re-run.
   - **Lesson:** When patching JSON with multiple possible schema versions, log expected vs actual keys at runtime. Or use a defensive `or` chain: `abmv_doc.get("items") or abmv_doc.get("queue") or []`.

5. **UT kW field name guess wrong** — `stage_d_apply_updates.py` used `d.get("vykon_kw", 0)` but actual field is `topny_kw_total`. Produced 0.0 kW in ABMV_1 resolution note. Required inspection of `ut_zarizeni_list.json` structure.
   - **Lesson:** `jq` or `python -m json.tool | head` the source JSON before writing field-accessor code. Don't guess from semantic field names.

6. **Initial perimeter computation used `union.length`** — counted interior partition boundaries → 284 m (wrong). Should have been ~103 m.
   - **Lesson:** For perimeter of footprint, use `polygon.exterior.length` on the largest disjoint MultiPolygon part. Never `union.length` from polygonize output.

---

## Lessons for future sessions

### Process
1. **Long-session context decay is real** — sessions > 30K LOC outputs / > 8 commits reliably forget Phase 0b TZ extraction details. Build a mandatory consolidation checkpoint at session end (this retrospective is exactly that). Trigger: any PR exceeding 20K LOC modifications → run memory consolidation skill.

2. **TZ re-read is non-negotiable** before any new položka generation in Stage E or later. The audit doc identifies WHAT is missing; only TZ tells you the actual specs (tl., material, RAL, fire class, fasteners).

3. **Annotate-before-mutate** for both ceny (price layer) and geometrie (Step 3 area mapping). Never auto-mutate `mnozstvi` or `cena_jednotkova` from derived sources. Add `_*_source` annotation, surface for user review, then apply.

4. **3-source matrix for any DXF/TZ disagreement** — HK212 had ABMV_2 (vrata 3000 DXF block vs 3500 TZ) where TZ ARS D.1.1 + PBŘ p.18 vs DXF block name = 2:1. TZ wins. Same matrix applied to ABMV_15 UPE160 vs C150×19.3 (22:2 ratio).

### Technical
5. **DXF block names ARE the product schedule** — `OKNO_1k 1000×1000`, `M_Vrata_sekční 3500×4000`, `Lindab Round 150/100 Antique White`, `MEA Mearin Plus 3000 NW300`. ATTRIB fill is typically empty (HK212: 0 ATTRIB harvest). Build block-name parser as primary product spec source. Block-name pseudo-schedule parser = P3 backlog ticket.

6. **DSP DXF can have DPS-level detail** — don't confuse drawing complexity with PD stage. Razítka declare stage; trust razítka, classify confidence by declared stage (DSP = 0.85, DPS = 0.95), not by INSERT count.

7. **Layer dictionary needs user ratification gate** — auto-detect at <50 % coverage = STOP, request user OK on ambiguous prefixes (A-GENM, user_custom_numbered, NETISK). Don't proceed to Step 2 aggregation with low-confidence classifications.

8. **Sheet-scope filter on every regex extraction** — DIMENSION text patterns match across all sheets. Always restrict by authoritative source sheet (slope → A102, výkop → A201, height → A104 řezy).

### Memory anchors
- **HK212 dimensions:** 28.18 × 19.59 m, zastavěná 538.5 m², obvod 103.5 m, výška 6.02 m
- **HK212 Kingspan:** KS1000 AWP obvodový tl. 200 mm (alt. 150 mm), střecha pro šikmé střechy MW EW 15 DP1, sklon 5.25°
- **HK212 vrata:** 4× sekční 3500 × 4000 mm (TZ wins over DXF block 3000)
- **HK212 items.json journey:** 141 (initial Phase 0b) → 119 (Stage D drop 22 concept-only VZT+Rpol) → 127 (Stage E add 8 PSV-OPL Kingspan)
- **HK212 P0 resolution:** PSV-OPL kapitola = ~30–40 % typického bid value. Without this, Stage E benchmark vs example_vv corpus would have shown HK212 as "fundamentally incomplete" instead of the actual issue.

---

## File map (this session)

```
test-data/hk212_hala/
├── scripts/
│   ├── dsp_geometry_extraction/
│   │   ├── step1_layer_dictionary.py       ← NEW (auto-detect, 100% coverage)
│   │   ├── step1b_scan_a_genm.py           ← NEW (Lindab + MEARIN dossier)
│   │   ├── step1c_finalize_dictionary.py   ← NEW (user ratification)
│   │   ├── step2_extract.py                ← NEW (full geometry, 29 categories)
│   │   └── step3_polygonization.py         ← NEW (9 area metrics, 965 LOC)
│   └── phase_1_etap1/
│       ├── stage_d_apply_updates.py        ← MODIFIED (idempotent batch update)
│       └── stage_e_add_opl.py              ← NEW (P0 Kingspan resolution)
├── outputs/
│   ├── dsp_dxf_ut_integration/             ← RENAMED from dilenska_ut_integration/
│   │   ├── ut_zarizeni_list.json
│   │   ├── ut_razitka.{json,md}
│   │   ├── dsp_dxf_kusovnik.json
│   │   └── energetical_balance_update.{json,md}
│   ├── dsp_geometry_extraction/
│   │   ├── layer_inventory.json
│   │   ├── layer_dictionary_{proposed,ratified}.json
│   │   ├── dictionary_decisions.md
│   │   ├── extraction_{raw,aggregated}.json
│   │   ├── paperspace_inventory.json
│   │   ├── block_attributes.json (empty — 0 ATTRIB)
│   │   ├── agenm_targeted_scan.json
│   │   └── step3_areas/
│   │       ├── polygonization_results.json
│   │       ├── area_aggregates.json
│   │       ├── cross_sheet_dedup_log.md
│   │       └── step3_summary_report.md
│   ├── phase_1_etap1/
│   │   ├── items_hk212_etap1.json          ← MODIFIED (Stage D + Stage E, 141→127 items)
│   │   ├── items_hk212_etap1_with_geometry.json  ← NEW (Step 3 annotated copy)
│   │   ├── kapitola_coverage_audit.md      ← NEW (P0 blocker identified)
│   │   └── project_header.json             ← NEW (geometric_summary block)
│   └── abmv_email_queue.json               ← MODIFIED (ABMV_2 resolved)
└── handoff/
    └── session_handoff_2026-05-22_step3.md ← MODIFIED (Stage E status added)

docs/
├── STAVAGENT_PATTERNS.md                   ← MODIFIED (Pattern 8 added)
├── soul.md                                 ← MODIFIED (§6.6a 8 patterns + §9 session log)
├── steering/structure.md                   ← MODIFIED (hk212 sub-folders)
└── sessions/2026-05-22_HK212_StageABCD_Step3.md  ← NEW (this file)
```

---

## Acceptance scorecard

| Criterion | Status |
|---|---|
| Stage A discovery (razítka + UT zařízení + kusovník) | ✅ |
| Stage B B5 steel-profile catalog | ✅ |
| Stage C ÚT integration (84 kW heating bilance) | ✅ |
| Stage D batch update (22 items dropped, HSV-3 length source, 4 ABMV closures) | ✅ |
| Task 2 Step 1: layer dictionary 100 % coverage | ✅ |
| Task 2 Step 1.5: ambiguous-layer dossier (A-GENM) | ✅ |
| Task 2 Step 2: full geometry extraction (29 categories) | ✅ |
| Step 3: ≥ 5 area metrics measured | ✅ (9/5) |
| Step 3: ≥ 80 % wall polygonization coverage | ✅ (100 % via foundation-merge) |
| Step 3: cross-sheet dedup audit | ✅ |
| Step 3: items annotated, original unmodified | ✅ |
| Kapitola coverage audit | ✅ (P0 found + resolved) |
| Stage E: P0 Kingspan 8 PSV-OPL items added | ✅ |
| ABMV_2 vrata resolved (TZ 3500mm wins) | ✅ |
| Pattern 8 documented (Re-read TZ rule) | ✅ |
| Memory consolidation (soul.md + structure.md + this retrospective) | ✅ |
