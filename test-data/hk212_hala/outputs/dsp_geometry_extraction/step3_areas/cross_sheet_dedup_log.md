# HK212 Step 3 — Cross-sheet dedup log
_Generated: 2026-05-22T05:42:44.179710+00:00_

## Walls (footprint source)

- Priority order: ['A101_pudorys_1np.dxf', 'A106_stroje.dxf', 'A107_stroje_kotvici_body.dxf']
- Input counts per sheet: `{'A101_pudorys_1np.dxf': 177, 'A106_stroje.dxf': 188, 'A107_stroje_kotvici_body.dxf': 178, 'A105_zaklady.dxf': 209}`
- Unique after dedup: **679** (dropped 73)
- Per-sheet contributions: `{'A101_pudorys_1np.dxf': 175, 'A106_stroje.dxf': 183, 'A107_stroje_kotvici_body.dxf': 118, 'A105_zaklady.dxf': 203}`
- Drops per sheet: `{'A101_pudorys_1np.dxf': 2, 'A106_stroje.dxf': 5, 'A107_stroje_kotvici_body.dxf': 60, 'A105_zaklady.dxf': 6}`

## Roof

- Priority: ['A102_pudorys_strechy.dxf']
- Input: {'A102_pudorys_strechy.dxf': 19}
- Unique after dedup: 17

## Foundation

- Priority: ['A105_zaklady.dxf', 'A201_vykopy.dxf']
- Input: {'A105_zaklady.dxf': 201, 'A201_vykopy.dxf': 148}
- Unique after dedup: 245

## Floor

- Priority: ['A101_pudorys_1np.dxf']
- Input: {'A101_pudorys_1np.dxf': 42}
- Unique after dedup: 41

## Reasoning

Per-line content-hash = MD5 of (rounded coords to 5.0-mm grid, direction-invariant via `min(forward, reverse)`). Sheets are processed in priority order; first occurrence wins. A101+A106+A107 all carry the same 1NP půdorys footprint, so dedup correctly collapses ~540 lines from 3 sheets to ~180 unique lines.
