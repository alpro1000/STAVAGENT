# HANDOFF — HK212 Sequential List

**Status:** generated, validated, ready for manual KROS/URS + price assignment.

**Branch:** `claude/hk212-add-vytapeni`
**Date:** 2026-05-26

## Counts
- 150 items v logickém stavebním pořadí (138 baseline + 12 M-UT vytápění)
- 12 fází (1–11, vč. nová 9.5 TZB Vytápění mezi Podlaha průmyslová a Ostatní + Přesun hmot)
- 12 items added (M-UT-001..012), 0 skipped, 0 invented
- 1 ABMV updated (ABMV_1 → resolved_authoritative, 60 kW DPS)

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

## Quality flags propagated (from items.json)
- `_vyjasneni_ref` open ABMV: 8 → ABMV_10, ABMV_11, ABMV_13, ABMV_15, ABMV_16, ABMV_17, ABMV_20, ABMV_3
- `_review_qty`: 1 → PSV-OPL-005
- `_review_concrete_class`: 1 → HSV-2-013
- confidence < 0.70: 80 items (yellow-tinted v XLSX)

## Validation (§6)
- ✔ row count = 150 (excl. separator rows)
- ✔ each items.json id appears exactly once
- ✔ no id missing from output
- ✔ phases ordered 1→9, 9.5, 10, 11 monotonically
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
