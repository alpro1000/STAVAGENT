# HK212 Sequential Construction List

174 active položek v logickém pořadí výstavby (fáze 1–12, vč. 9.5 TZB Vytápění + 12 Venkovní úpravy). 5 items dropped per user decision 2026-05-27 (M-VK-013..017 asfalt/parkoviště) preserved s _status_flag. Okapní chodník complete 7-layer stack (M-VK-020..026).
Žádné kódy, žádné ceny — jen popis + výměra ve správném pořadí.

**Použití:** user manually adds KROS/URS codes + ceny per row.

**Source:** `outputs/phase_1_etap1/items_hk212_etap1.json` (179 entries, 174 active)
**Branch:** `claude/hk212-vk-final-minimal` (12 M-UT items added per investor scope change 2026-05-26)
**Generated:** 2026-05-28

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
9.5. TZB INSTALACE — VYTÁPĚNÍ (M-UT, 12 items, DPS D.1.4.2)
10. OSTATNÍ + PŘESUN HMOT
11. DOKONČENÍ + REVIZE + ODEVZDÁNÍ
12. VENKOVNÍ ÚPRAVY (SO-13, M-VK, 24 active items — minimal scope + okapní chodník complete 10-layer stack, DPS 06/2026)

## Soubory
- `hk212_sequential_list.xlsx` — single-sheet "Postup stavby", formatted, freeze row 1, includes Vzorec / Zdroj výměry column
- `hk212_sequential_list.csv` — flat CSV mirror pro grep / diff
- `hk212_sequential_list.json` — items.json fields + `_sequence_position` + `_phase` + `_krok` + `_vzorec_display`

## Sloupec "Vzorec / Zdroj výměry"
Každý řádek nese stručný výpočet kvantity + zdrojové reference (výkres / TZ / statika / Step3 / phase ref) extrahované z `items_hk212_etap1.json` field `audit_trail.formula` + `audit_trail.reference`. Pokud zdroj nelze odvodit, řádek nese `(zdroj nenalezen — manual verify)`. Text je truncated na ~220 znaků; plné detaily (vstupy + krok-za-krok + analytical_journey) zůstávají v `items.json` audit_trail.

## ABMV open (12)
ABMV_10, ABMV_11, ABMV_13, ABMV_15, ABMV_16, ABMV_17, ABMV_20, ABMV_23, ABMV_24, ABMV_3, ABMV_31, ABMV_32

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
