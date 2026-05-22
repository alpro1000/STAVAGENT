# HK212 Session Handoff — 2026-05-22 (Step 3 polygonization + areas)

Branch: `claude/hk212-dilenska-ok-ut-dps-integration` (Step 3 merged in via no-ff at commit `43f7ba19`)
Status: **shipped + pushed + merged**. Step 3 branch `claude/hk212-step3-polygonization-areas` preserved on remote with 3 atomic commits (debug story).

## Full session arc — 2026-05-22 commits on dilenska branch

```
43f7ba19  Merge step3 → dilenska (no-ff, preserves debug story)
├── 5bdfa22e  step3: slope disambiguation (5.65°=vrata) + kapitola audit (P0 Kingspan missing)
├── 0065cae9  step3: handoff doc + acceptance scorecard
└── d1bbde80  step3: polygonization + 9 metrics + items_with_geometry.json
0b22136f  stage-d: 22 items dropped + HSV-3 _length_source + 4 ABMV closures
75221920  task2 step 2: full geometry extraction
a74c8ed2  task2 step 1.5: A-GENM dossier + dictionary ratification
5064753f  task2 step 1: layer dictionary auto-detect (100% coverage)
b23fff07  rename: dilenska→dsp_dxf housekeeping
2a6c9034  stage A/B/C: B5 catalog + UT discovery (prior session)
```

## What's new vs prior handoff

### 9 geometric metrics measured (from DSP DXF set, units verified mm)

| Metric | Value | Source | Confidence |
|---|---:|---|---:|
| `zastavena_plocha` | **538.5 m²** | polygonize(walls + foundation outlines, A101 + A106 + A107 + A105 deduped) → largest disjoint MultiPolygon part | 0.90 (cross-validated 100 % vs convex_hull 540.9 m²) |
| `obvod_budovy` | **103.5 m** | exterior of largest disjoint part | 0.88 |
| `strecha_brutto` | **556.5 m²** | polygonize(roof, A102) — overhang ≈ +18 m² vs footprint | 0.88 |
| `strecha_netto` | **558.8 m²** | brutto / cos(5.25°) | 0.85 |
| `fasada_brutto` | **623.3 m²** | obvod (103.5 m) × výška (6.0 m) | 0.85 |
| `fasada_netto` | **536.4 m²** | brutto − otvory (30 × 1 m² + 4 × 12 m² + 4 × 2.2 m²) = 86.8 m² | 0.85 |
| `vyska_budovy` | **6.02 m** | A104 pohledy bbox vertical extent (sane 3-15 m range) | 0.75 |
| `objem_vykopu` | **99.3 m³** | délka 103.5 m × šířka 0.8 m × hloubka 1.2 m | 0.60 ⚠ default w/d |
| `podlaha_total` | **538.5 m²** | footprint fallback (industrial hala = single open floor) | 0.75 ⚠ |

### DIMENSION mining harvest
- Sklon střechy: **5.25°** (15 hits on A102 pudorys střechy — canonical, used in `strecha_netto` calc ✓)
- 5.65° (12 hits on A101) — **úhel otevírání vrat sekčních** (gate opening angle for sectional doors, NOT a roof slope). Originally misidentified as "overhang slope". `strecha_netto` calc used the correct 5.25° — no recompute needed.
- 2174 TEXT/MTEXT/DIMENSION entities scanned across 8 sheets
- Výkop dims: 0 explicit "VÝKOP a×b" patterns → defaulted

### Items.json annotation (NO mnozstvi mutation)
- New file: `outputs/phase_1_etap1/items_hk212_etap1_with_geometry.json` — 79 items in HSV-1/HSV-2/PSV-71x/76x/77x/78x kapitoly annotated with `_geometric_source` field
- Keyword-routed (zastavěn/půdorys/střech/fasád/podlaha/výkop/základ → metric)
- Original `items_hk212_etap1.json` UNCHANGED

### Outputs (in `outputs/dsp_geometry_extraction/step3_areas/`)
- `polygonization_results.json` — per-category polygon details + union parts
- `area_aggregates.json` — 9 metrics canonical
- `cross_sheet_dedup_log.md` — dedup audit (752 → 679 walls; 19 → 17 roof; 349 → 245 fnd; 42 → 41 floor)
- `step3_summary_report.md` — acceptance scorecard

### project_header.json
- New `geometric_summary` block with all 9 metrics

## Acceptance criteria (per Step 3 spec)

| Criterion | Status |
|---|---|
| ≥ 5 area metrics measured | ✅ 5/5 |
| ≥ 80 % wall polygonization coverage | ✅ 100 % (footprint vs convex hull) |
| Objem výkopu computed | ✅ (with `_review_flag=True` per default w/d) |
| Items.json annotated, original nemodifikován | ✅ (separate `_with_geometry.json`) |
| project_header updated | ✅ |
| Commit + push to claude/hk212-step3-polygonization-areas | ✅ |
| Handoff doc updated | ✅ (this file) |

## STOP gates (none triggered)

| Gate | Threshold | Actual |
|---|---|---|
| Polygonize < 30 % closed walls | 30 % | 100 % coverage (after foundation-merge fix) ✓ |
| Zastavěná outside [500, 5000] m² | range | 538.5 m² ∈ range ✓ |
| Cross-sheet inconsistency > 15 % | 15 % | 0.4 % (538.5 vs 540.9 m²) ✓ |
| shapely import fail | env | shapely 2.1.2 OK ✓ |

## Debug story (committed in commit message for traceability)

1. **1st pass** — polygonize(walls A101) → 9 tiny polys totalling 4.1 m². Wall outlines have door gaps + inner/outer face split → no continuous closed loop. Would have triggered STOP gate.
2. **Investigated** — A101 walls bbox = 19.3 × 28.0 m (~540 m² expected). A105 zaklady has 8 wall lines BUT 201 foundation lines forming clean outer outline (longest line = 27.89 m = full hala edge).
3. **Convergence test** of 3 strategies — all within 1 %:
   - A105 walls+fnd → 537.2 m²
   - A101 walls convex_hull → 540.9 m²
   - Combined A101+A105 → 538.5 m² (largest poly) + 41.9 m² (4 thin slivers from foundation overhang)
4. **Fix applied** — include foundation lines along with walls; take **largest disjoint MultiPolygon part** as canonical footprint; secondary parts (slivers) reported in audit.
5. **Perimeter fix** — initial 284 m was union.length (counts interior partition boundaries). Taking exterior of largest part = 103.5 m (matches 2×(19.3+28)=94.6 m + concavity).

## Remaining gaps (deferred — outside Step 3 boundary)

- **Per-room floor breakdown** — floor LINEs don't form closed polylines; per-room split needs cluster-by-bbox + MTEXT room-label proximity match. Defer to dedicated task.
- **Foundation polygon hierarchy** — outer footings vs inner connecting strips not separated; raw line length + union area only.
- **DIMENSION-derived výkop hloubka** — řezů A201 should have explicit VÝKOP a×b dims; manual probe needed. `_review_flag=True` set on `objem_vykopu` so reviewer is alerted.
- **Facade height vs řezů** — A104 pohledy gave 6.02 m; should cross-check against řezů (A104 too — same sheet) DIMENSION values. Within sane range, used as-is.
- **HSV-3 mass reconciliation** (deferred from Stage D) — still open. 10263 kg IPE 400 from statika vs kusovník 2 schedule INSERTs vs structural_columns 141 real cols.
- **Bonus follow-ups** (separate tasks per chat ratification):
  - `dedup_dxf_replicas.py` standalone util — inline-implemented this stage (within `step3_polygonization.py:dedup_lines`), util extraction deferred
  - shapely.polygonize() for per-room floors — partially deferred (no per-room split, but total floor = footprint fallback)
  - Block-name pseudo-schedule parser — separate task

## Where it goes from here

### Immediate blocker (P0 — must resolve before Stage E)

🚨 **Kingspan/sendvičové opláštění chybí entirely in items.json.** Audit doc `outputs/phase_1_etap1/kapitola_coverage_audit.md` defines 8 návrh PSV-OPL-001..008 položek with quantities derived from Step 3 metrics:
- střecha 558.8 m² × ~1500 Kč/m² ≈ 837 tis CZK
- fasáda 537 m² × ~1500 Kč/m² ≈ 805 tis CZK
- + kotvící prvky + lemy + dilatace + doprava + statika
- ≈ 2.0–2.5 mil CZK = 30–40 % typického bid value

TZ explicitly mentions Kingspan (ABMV_13 = `closed_fabricated`), HSV-9-004 mentions "lešení pro montáž opláštění (Kingspan)" — but actual položky were lost between TZ parse and Phase 1 etap1 composition. Stage E benchmark vs example_vv corpus = meaningless until this resolved.

### After P0 resolved

- **Stage E** — benchmark proti example_vv corpus (7 výkazů + 6 PDF výkresů). Options (a) schema-only, (b) coverage, (c) full fuzzy — recommended (b).
- **HSV-3 mass reconciliation** — use Step 3 perimeter 103.5 m × foundation cross-section to refine kg/m³ vs statika-sourced 10263 kg IPE 400.
- **HSV-1 výkop figura** — currently 222.75 m³ from RE-RUN §3.10 formula `495 m² × 0.45 m`. Step 3 says zastavěná = 538.5 m². Either update HSV-1-001 → 538.5 × 0.45 ≈ 242 m³, OR keep RE-RUN value + add ABMV pro 538 vs 495 reconciliation. Defer to user.

### Bonus follow-ups (separate tasks)
- `dedup_dxf_replicas.py` standalone util — currently inlined in step3
- shapely.polygonize() per-room floor breakdown — partially deferred (total = footprint fallback)
- Block-name pseudo-schedule parser — separate task

## File map (this session adds)
```
outputs/dsp_geometry_extraction/step3_areas/
├── polygonization_results.json
├── area_aggregates.json
├── cross_sheet_dedup_log.md
└── step3_summary_report.md

outputs/phase_1_etap1/
├── items_hk212_etap1_with_geometry.json   ← NEW (annotated copy)
└── project_header.json                     ← NEW (geometric_summary block)

scripts/dsp_geometry_extraction/
└── step3_polygonization.py
```
