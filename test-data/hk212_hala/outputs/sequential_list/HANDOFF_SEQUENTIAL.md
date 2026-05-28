# HANDOFF — HK212 Sequential List

**Status:** generated, validated, ready for manual KROS/URS + price assignment.

**Branch:** `claude/hk212-vk-final-minimal`
**Date:** 2026-05-28

## Counts
- 171 active items (138 baseline + 12 M-UT vytápění + 21 M-VK venkovní úpravy — minimal scope + okapní chodník complete layer stack)
- 13 fází (1–12, vč. 9.5 TZB Vytápění + nová 12 Venkovní úpravy po Dokončení)
- 33 active items added (12 M-UT + 21 M-VK = 14 kept + 7 okapní layers), 5 dropped per user decision, 0 invented
- 1 ABMV updated + 3 ABMV opened (ABMV_23/24/25 from PR #1235) + 5 ABMV resolved + 1 new (ABMV_26..31 from this PR)

## Per-phase distribution
- FÁZE 1: 20 items
- FÁZE 2: 16 items
- FÁZE 3: 27 items
- FÁZE 4: 16 items
- FÁZE 5: 13 items
- FÁZE 6: 12 items
- FÁZE 7: 13 items
- FÁZE 8: 4 items
- FÁZE 9: 6 items
- FÁZE 9.5: 12 items
- FÁZE 10: 2 items
- FÁZE 11: 9 items
- FÁZE 12: 21 items

## Quality flags propagated (from items.json)
- `_vyjasneni_ref` open ABMV: 12 → ABMV_10, ABMV_11, ABMV_13, ABMV_15, ABMV_16, ABMV_17, ABMV_20, ABMV_23, ABMV_24, ABMV_3, ABMV_31, ABMV_32
- `_review_qty`: 1 → PSV-OPL-005
- `_review_concrete_class`: 1 → HSV-2-013
- confidence < 0.70: 81 items (yellow-tinted v XLSX)

## Validation (§6)
- ✔ row count = 168 (excl. separator rows + dropped items)
- ✔ each items.json id appears exactly once
- ✔ no id missing from output
- ✔ phases ordered 1→9, 9.5, 10, 11, 12 monotonically
- ✔ within phase: výztuž → bednění → beton; doprava → montáž; dodávka → instalace

## Sidecar files
- `outputs/sequential_list/hk212_sequential_list.xlsx`
- `outputs/sequential_list/hk212_sequential_list.csv`
- `outputs/sequential_list/hk212_sequential_list.json`
- `outputs/sequential_list/README.md`

## NOT in scope (per task §5)
- žádné KROS/URS code matching
- žádné nové položky
- žádná price assignment
- žádná modifikace `items.json`

## Next steps (user manual)
1. Otevři `hk212_sequential_list.xlsx` v Excelu / LibreOffice.
2. Iteruj řádek po řádku, doplň KROS/URS kód + J.cena.
3. Pro řádky se žlutým / oranžovým pozadím nejdřív vyřeš ABMV / review flag.

## Notes for next session
- Source branch `dilenska-ok-ut-dps-integration` was NOT found in remote (`git branch -r` empty for it).
  Generated from current main tip (`82b7cab2` — HK212 memory consolidation), which has the
  items.json checked in at `test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json`.
- If `dilenska-ok-ut-dps-integration` later appears with newer items.json, re-run
  `scripts/build_sequential_list.py` (deterministic — same items in = same order out, since
  SEQUENCE is hard-coded by ID).
