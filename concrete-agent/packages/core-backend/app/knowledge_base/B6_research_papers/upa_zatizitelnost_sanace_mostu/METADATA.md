# UPa Zatížitelnost a sanace mostů — Knowledge Base Entry

```yaml
title: Zatížitelnost a sanace mostů (přednáška 09)
authors: Katedra dopravního stavitelství, Dopravní fakulta Jana Pernera, Univerzita Pardubice
year: ~2020-2024
type: university_lecture_slides
language: cs
total_slides: 31
source_file: 09_zatizitelnost__sanace.pdf
slug: upa_zatizitelnost_sanace_mostu
recommended_bucket: B6_research_papers
```

## Topics covered

| Téma | Slidy | Zdroj/norma |
|---|---|---|
| Definice zatížitelnosti silniční (Vn / Vr / Ve) | 1-3 | ČSN 73 6222, TP 200 |
| Tabulka stavebních stavů s α koeficienty | 4 | ČSN 73 6222 |
| Tabulka skupin pozemních komunikací | 4 | ČSN EN 1991-2 |
| Schémata vozidel pro Vn / Vr / Ve | 5-7 | ČSN 73 6222 |
| Vzorce kombinovaného statického výpočtu | 8-9 | ČSN 73 6222, MP |
| Železniční zatížitelnost (kategorie A-D, traťové třídy) | 10-15 | SŽ S5/1, ČSN EN 15528 |
| Návrhová životnost (Ed ≤ Rd, partial factors) | 16-19 | ČSN EN 1990 |
| Tabulka životnosti per element | 19 | praxe |
| Sanace silničních mostů (TKP 31, VL 0, ČSN EN 1504) | 20-31 | TKP 31, ČSN EN 1504 |

## Applies to elements (STAVAGENT classifier)

**Assessment of existing bridges:**
- All bridge element types — když HPM určí stavební stav (I-VII)
- Old bridge static reassessment per ČSN 73 6222

**Lifecycle / durability:**
- `mostovkova_deska` (NK) — 60-100 let
- `opery_ulozne_prahy`, `driky_piliru`, `zaklady_*` (spodní stavba) — 60-100 let
- `rimsa` — 30-50 let
- `prechodova_deska` — implicit lifecycle součást NK
- vozovka, izolace, svodidla, mostní závěry — sub-NK lifespans

**Sanace work types (NOT applicable for Žihle — demolice, ne sanace):**
- Reference for repair-style projects (různý workflow než nová stavba)

## Relevance for STAVAGENT

🔥 **High priority data extracted:**

1. **Skupiny komunikací → Vn/Vr/Ve** — confirms ZD §4.4.h Žihle (skupina 1 → 32/80/180 t)
2. **Stavební stavy s α** — input для assessment старых мостов (HPM Žihle dala stav VI)
3. **Návrhová životnost table** — zatím nový capability, lifecycle cost analysis (future calculator engine)

🟡 **Medium priority:**

4. Schémata vozidel — visual reference, не direct input pro engine
5. Vzorce M_Ed, M_Vk,c — для přepočtu zatížitelnosti (zhotovitel responsibility per čl. 4.3.j ZD)

🔵 **Reference for other workflows:**

6. Sanace methods — pro projekty typu rekonstrukce/repair, ne demolice

## Known limitations

- Slides format → high-level summary, žádné detailní výpočty
- Tabulka životnosti je rozsah (min-max), bez doporučení pro konkrétní agresivní prostředí
- Sanace section pokrývá obecné principy ČSN EN 1504, detaily vyžadují plný text normy

## Cross-references

- `B7_regulations/csn_73_6222_zatizitelnost_mostu/` — primary norm, paid (UPa slides = stand-in)
- `B7_regulations/en_1992_2_concrete_bridges/` — Eurocode 2 mosty (full PDF available)
- `B7_regulations/csn_en_206_beton/` — beton, exposure classes
- `B9_validation/lifecycle_durability/` — extracted lifecycle table jako structured data
