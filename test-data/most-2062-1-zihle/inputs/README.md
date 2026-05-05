# `inputs/` — raw bidder dokumenty (Most 2062-1 Žihle)

Stav: nahráno 2026-05-05.

## Struktura

```
inputs/
├── pdf/         ← oficiální dokumenty tendru Žihle (ZD + Vysvětlení)
├── docx/        ← šablony příloh nabídky Žihle (SOD + Prohlášení o ceně)
├── photos/      ← snímek mostního listu + 6 fotek z osmotky 2026-04-21
└── reference/   ← cizí projekt Kfely jako structurální vzor (NE čísla!)
```

## Soubory

### `pdf/`
| Soubor | Popis |
|--------|-------|
| `ZD - Most ev.č. 2062-1 u obce Žihle - DaB.pdf` | Zadávací dokumentace, č.j. 3967/26/SÚSPK-P, 2026-04-01, 26 stran |
| `Vysvětlení ZD č. 1 - Most u obce Žihle.pdf` | První kolo dotazů a vysvětlení k ZD |

### `docx/`
| Soubor | Popis |
|--------|-------|
| `Příloha č. 2 - SOD - Design and Build Most u obce Žihle.docx` | Smlouva o dílo (šablona) |
| `Příloha č. 3 - Prohlášení o výši Nabídkové ceny a Době provádění Díla.docx` | Formulář pro vyplnění nabídky |

### `photos/`
| Soubor | Popis |
|--------|-------|
| `Příloha č. 1 - snímek mostního listu.png` | Skenovaný mostní list (zastupuje HPM tabulku) |
| `20260421_13xxxx.jpg` (6 ks) | Terénní fotodokumentace, pořízeno 2026-04-21 |

## Poznámky

- **Plný 6-stránkový HPM PDF z 2025-09-24** (zmíněný v původním zadání tasku)
  v inputs/ zatím **NENÍ**. Místo něj zde je kolekce *snímek mostního listu
  + fotky*, která pokrývá obsah HPM pro účely extrakce.
- Pokud HPM PDF dorazí později, založit pod `inputs/pdf/HPM_2025-09-24.pdf`
  a doplnit do `metadata.yaml → zdrojove_dokumenty.hpm_pdf:`.

### `reference/` — cizí projekt Kfely (NE Žihle, jen jako vzor)
| Soubor | Popis |
|--------|-------|
| `20 Rekonstrukce mostu Kfely (zadání).xml` | UNIXML soupis prací z KROS, 153 položek ve 4 SO objektech (SO 001 demolice, SO 180 objízdná, SO 201 most, ZS) |
| `4106639-A02_OR_SP_Zadavaci dokumentace_GB.docx` | ZD jiného mostu — pro porovnání struktury kapitol |
| `4106641-A05_OR_Technicka specifikace_GB.docx` | TKP specifikace Kfely — Část I tabulka aplikovatelných TKP kapitol (1, 2, 3, 4, 5, 7, 11, 16, 18, 21, 22, 23, 26, 31) |

> **POZOR:** Kfely je ~17× větší most s prefab nosníky a OBJÍZDNOU. Žihle je
> integrální rám s POVINNÝM PROVIZORIEM. Z Kfely se přebírá jen
> *struktura* (decomposition na SO, formát soupisu, seznam TKP), nikdy
> hodnoty m³ / Kč / délky. Pro Žihle platí ZD §4.4, ne Kfely SO 201.

## Co dál

1. Extrakce strukturovaných dat z ZD + Vysvětlení + photos → `01_extraction/`
2. Doplnit chybějící pole v `metadata.yaml` (staničení, okres, hydrologie detail)
