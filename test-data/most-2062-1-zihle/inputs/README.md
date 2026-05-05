# `inputs/` — raw bidder dokumenty (Most 2062-1 Žihle)

Stav: nahráno 2026-05-05.

## Struktura

```
inputs/
├── pdf/      ← oficiální dokumenty tendru (ZD + Vysvětlení)
├── docx/     ← šablony příloh nabídky (SOD + Prohlášení o ceně)
└── photos/   ← snímek mostního listu + 6 fotek z osmotky 2026-04-21
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

## Co dál

1. Extrakce strukturovaných dat z PDF + photos → `01_extraction/`
2. Doplnit chybějící pole v `metadata.yaml` (staničení, okres, hydrologie detail)
