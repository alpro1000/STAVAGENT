# HK212 Sequential Construction List

128 položek v logickém pořadí výstavby (fáze 1–11).
Žádné kódy, žádné ceny — jen popis + výměra ve správném pořadí.

**Použití:** user manually adds KROS/URS codes + ceny per row.

**Source:** `outputs/phase_1_etap1/items_hk212_etap1.json` (128 items)
**Branch:** `claude/hk212-sequential-list` (parallel — source branch `dilenska-ok-ut-dps-integration` not found in remote; generated from current main tip with HK212 work already integrated)
**Generated:** 2026-05-22

## Fáze
1. PŘÍPRAVA STAVENIŠTĚ + GEODÉZIE
2. ZEMNÍ PRÁCE
3. ZÁKLADY
4. NOSNÁ OCELOVÁ KONSTRUKCE
5. OPLÁŠTĚNÍ KINGSPAN
6. KLEMPÍŘSKÉ + ODVODNĚNÍ STŘECHY
7. VÝPLNĚ OTVORŮ
8. IZOLACE + SOKL
9. PODLAHA PRŮMYSLOVÁ
10. OSTATNÍ + PŘESUN HMOT
11. DOKONČENÍ + REVIZE + ODEVZDÁNÍ

## Soubory
- `hk212_sequential_list.xlsx` — single-sheet "Postup stavby", formatted, freeze row 1
- `hk212_sequential_list.csv` — flat CSV mirror pro grep / diff
- `hk212_sequential_list.json` — items.json fields + `_sequence_position` + `_phase` + `_krok`

## ABMV open (8)
ABMV_10, ABMV_11, ABMV_13, ABMV_15, ABMV_16, ABMV_17, ABMV_20, ABMV_3

## _review_qty flags (1)
PSV-OPL-005

## _review_concrete_class flags (1)
HSV-2-013

## Vizuální značení v XLSX
- oranžový fáze-separator (═══ FÁZE N: NÁZEV ═══)
- modrý krok-header (→ Krok)
- žluté pozadí: confidence < 0.70
- oranžové pozadí: aktivní `_review_*` flag
- alternující řádkové pruhování v rámci fáze
