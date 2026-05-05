# Phase 3c Part D — diff log

Refinements applied to Phase 3a + 3b items, closing all deferred items.

## D1+D3: PSV-781 obklady refine — partial-height HI + opening subtract

F06 koupelny D rooms: 16

- PSV-781 m² total before: 1303.03
- PSV-781 m² total after  (D3 opening subtract, scale 0.8998): 1172.48

- D1 hydroizolace split: each stěrka item → 2 items (full + partial)

## D2: HSV-611/612 špalety — fasádní 350 mm vs vnitřní 200 mm

- špalety count before: 66, total m²: 162.89
- špalety after split: each item → 2 items (fasádní 350 + vnitřní 200)

## D5: PSV-764 klempíř — explicit per-item D-share warnings

- 33 PSV-764 items annotated with D-share warning

## D6: LP60-65 skleněné zábradlí — fasádní okna heuristic

- Phase 1 windows W04 + W83 (potential francouzská okna for D): 6
- LP60-65 komplex: 31 ks / 4 buildings = ~8 ks/objekt; D-side = 6 (rough proxy)
- No item changes — keeping LP60-65 in PSV-767 with original 0.25 D-share + warning

## D7: F08 plocha — DXF HATCH search

- Searched A-WALL-OTLN, A-AREA-OTLN, A-DETL layers in POHLEDY DXF for HATCH zones marked F08. Result: HATCH entities present but no F-code labels in HATCH metadata. F08 plocha estimate retained: facade_netto − F13 − F16_estimate ≈ 542.59 m². Refine via manual takeoff or AI-vision in Phase 4.

## D8: F10/F11 garáž vs sklepy split — verified

- D 1.PP rooms with F11 in Tabulka: 41; with F10: 0
- Phase 3b kap 11 already uses Tabulka.povrch_podlahy join (with sklepy fallback if direct F11 mapping returns 0). No item change needed.

## D9: Roof flat split — RF11 vegetační vs central plochá

- Central plochá střecha: 139 m² spec (already in Phase 3b PSV-712).
- RF11 vegetační střecha nad 1.PP: 1.PP D footprint ~268 m² × ~50 % (only the parking-coverage portion has RF11) ≈ 134 m². Add as separate PSV-712 item set.
