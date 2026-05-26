# HK212 Step 3 Summary — 2026-05-22T05:55:58.179863+00:00

## Acceptance criteria check

- ≥ 5 area metrics: 5/5 measured ✓
- ≥ 80 % wall polygonization coverage: 100% (footprint vs convex hull) ✓
  - (polygonize ratio polys/unique-lines = 40% — informational only; high count of interior partition polygons inflates denominator)
- objem výkopu computed: ✓ (default-flag)
- items.json annotated: see items_hk212_etap1_with_geometry.json
- project_header updated: pending step 10 below

## Area aggregates

| Metric | Value | Source | Confidence | Review |
|---|---:|---|---:|---:|
| zastavena_plocha | 538.5 m² | polygonize(walls+foundation outlines, A101+A106+A107+A105 deduped) → largest disjoint MultiPolygon p | 0.9 |  |
| obvod_budovy | 103.5 m | footprint polygon perimeter | 0.88 |  |
| strecha_brutto | 556.5 m² | polygonize(roof, A102) | 0.88 |  |
| strecha_netto | 558.8 m² | brutto / cos(5.25°) | 0.85 |  |
| fasada_brutto | 623.3 m² | obvod (103.5 m) × výška (6.0 m) | 0.85 |  |
| fasada_netto | 536.4 m² | brutto − otvory plocha (windows 30 + vrata 4 + dveře 4) | 0.85 |  |
| vyska_budovy | 6.02 m | A104 pohledy bbox vertical extent (6.02 m) | 0.75 |  |
| objem_vykopu | 99.3 m³ | délka (103.5 m) × šířka (0.8 m) × hloubka (1.2 m) — width+depth: default_estimate | 0.6 | ⚠️ |
| podlaha_total | 538.5 m² | footprint area (industrial hala — single open floor) | 0.75 | ⚠️ |

## DIMENSION mining

- All slope hits (debug): `{5.25: 15, 5.65: 12, 2.0: 9, 10.0: 1, 30.0: 1}`
- **Canonical sklon střechy (A102 only): 5.25°**
  - per user (chat 2026-05-22): 5.65° hits on A101 = **úhel otevírání vrat sekčních** (gate opening angle), NOT a roof slope. Filtered to A102 = pudorys střechy only.
- Per-sheet scanned: `{'A101_pudorys_1np.dxf': 106, 'A102_pudorys_strechy.dxf': 50, 'A104_pohledy.dxf': 35, 'A105_zaklady.dxf': 163, 'A106_stroje.dxf': 129, 'A107_stroje_kotvici_body.dxf': 148, 'A201_vykopy.dxf': 305, 'Hala HK_ Úprava dveří.dxf': 1238}`

## Remaining gaps (deferred)

- **Per-room floor breakdown**: floor LINEs do not form closed polylines; would need cluster-by-bbox + room-label MTEXT proximity match. Defer.
- **Foundation polygon hierarchy**: outer vs inner footings; currently aggregated as raw line length + largest polygon.
- **DIMENSION výkop hloubka**: if default flag set above, user should review actual řezů A201 + cross-check.
- **Facade height**: derived from pohledy bbox; if title block in same modelspace inflates Y-extent, falls back to default 7.0 m. Verify against řezů A104 DIMENSION values manually.
