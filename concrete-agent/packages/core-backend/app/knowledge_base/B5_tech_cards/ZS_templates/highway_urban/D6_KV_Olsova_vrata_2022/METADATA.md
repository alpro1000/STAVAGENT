# D6 Karlovy Vary — Olšova vrata (2022) ZS templates

**Project type:** highway / urban
**Project scope:** D6 dálnice úprava, různé SO (estakáda, mosty, opěrná stěna, nadjezd)
**Source year:** 2022-02-23
**Atelier:** ATELIÉR PROJEKTANTU 2022-2023

## Reference templates (3 souborů)

| Soubor | Zaměření | Project scope | Měs | ZS poměr |
|---|---|---:|---:|---:|
| `26_02_23_-_ZS_-_Operna_stena_-_SO_254_-_JP.xls` | SO 254 opěrná stěna | 76 M | 12 | 9.9 % |
| `ZS_-_vzor_rev22_02_23_-_IK_-_SO_205.xls` | SO 205 | 21.8 M | 4.25 | 7.2 % |
| `ZS_-_vzor_rev22_02_23_-_SO_211_2.xls` | SO 211/2 | 5.6 M | 2.5 | 26.0 % |

## Source files

**XLS files NOT in this directory** — uploaded by user during Žihle Session 3 retrofit
work, kept in user's local archive. Current status: extracted unit prices documented
v `../../PATTERNS.md` Pattern B/C/F. Anonymization needed before commit.

When ready to commit:
- Strip ATELIÉR PROJEKTANTU header / project ID
- Replace project tag with "D6_HIGHWAY_TEMPLATE_2022"
- Drop in `original/` subdirectory
- Add cross-validation note in this METADATA

## Extracted unit prices (cross-validated 3 souborů)

Per Žihle Session 3 retrofit + KB Pattern extraction:

| Položka | D6 cena | Source confidence |
|---|---:|---:|
| Buňky kanceláře pronájem | 1 000 Kč/ks/měs | 0.9 (3 souborů identical) |
| Buňky šatny pronájem | 1 800 Kč/ks/měs | 0.9 |
| Buňky sklady pronájem | 1 500 Kč/ks/měs | 0.9 |
| WC TOI-TOI | 2 400 Kč/ks/měs | 0.9 |
| Oplocení MTŽ+DMTŽ | 48 Kč/m | 0.9 |
| Oplocení nájem | 25 Kč/m/měs | 0.9 |
| Oplocení folie neprůhledná | 54 Kč/m | 0.9 — urban privacy, NOT for mostovy |
| Polír | 90 000 Kč/měs full-time | 0.9 |
| Reklamní cedule velká | 75 000 Kč/kpl | 0.9 |
| Doprava buněk | 4 000 Kč/cesta | 0.85 (Kfely má 4 400 — drift) |
| Autojeřáb (bez obsluhy) | 1 250 Kč/h | 0.85 |
| Autojeřáb (s obsluhou) | 1 500 Kč/h | 0.85 |
| BOZP zabezpečení | **200 000 Kč/kpl** | 0.9 (urban over-scoped pre mostovy — Pattern B) |
| Mycí linka čištění | 105 000 Kč/kpl | 0.9 |
| DSPS dokumentace | 370 000 Kč/kpl | 0.85 (scaled per project) |
| Pojištění stavby CAR | ~0.4 % z ceny | 0.85 |
| Vybavení buněk total | 84 209 Kč/kpl | 0.9 (3 souborů identical) |

## Žihle application notes

D6 highway/urban template was used as **starting point** for Žihle Session 3 retrofit
(`master_soupis_SO_801.yaml`). Session 4 recalibration:
- BOZP 200k → **80k** (Kfely mostovy benchmark — Pattern B)
- Polír 50% × 90k = 495k → **30% × 30k = 330k** part-time (Pattern C)
- Doprava buněk 4 000 → **4 400** (Pattern F — Kfely floor)

D6 templates remain authoritative source pre highway/urban projects. NOT applicable
verbatim k mostovy without recalibration via Pattern B/C/F.
