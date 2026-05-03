# Libuše inventory report — Phase 0.0

**Akce:** 185-01 Bytový soubor Libuše
**Klient:** VELTON REAL ESTATE
**Generální projektant:** ABMV world s.r.o.
**DPS revize:** 01 (30/11/2021)
**Session:** Feasibility (Phase 0.0 + 0.5 setup only)
**Date:** 2026-05-03

## Reorganizace souborů

Zdroj (před): `test-data/` (60 položek roztroušených v rootu)
Cíl (po): `test-data/libuse/inputs/{pdf,dwg,dxf}/` + `test-data/libuse/outputs/`

Operace: `git mv` (zachová git history pro každý soubor).

## Final layout

```
test-data/
├── TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md   (task spec, ponechán v rootu)
├── tz/                                            (jiný projekt: SO-202/203/207/VP4 — netýká se)
└── libuse/
    ├── inputs/
    │   ├── pdf/                       (33 PDF — DPS dokumentace)
    │   ├── dwg/                       (14 DWG — native CAD source)
    │   ├── dxf/                       (prázdný, vytvoří agent v Phase 0.5)
    │   ├── 185-01_*_R01-TZ.docx       (1 DOCX — TZ revize 01)
    │   ├── 185-01_*_TABULKA_*.xlsx    (9 XLSX tabulek)
    │   └── Vykaz_vymer_stary.xlsx     (přejmenováno z `unprotect_BS Libuše_Vykaz vymer R01_DMG Stav.xlsx`)
    └── outputs/                       (prázdný, doplní agent během Phases 0.5–6)
```

## Counts

| Kategorie | Počet | Umístění |
|-----------|------:|----------|
| PDF (DPS dokumentace, Libuše) | 33 | `inputs/pdf/` |
| DWG (native CAD, Libuše) | 14 | `inputs/dwg/` |
| DOCX (TZ revize 01) | 1 | `inputs/` |
| XLSX tabulky (místnosti, skladby, dveře, okna, prosklené příčky, zámečnické, klempířské, překlady, ostatní) | 9 | `inputs/` |
| Starý výkaz výměr (přejmenovaný) | 1 | `inputs/Vykaz_vymer_stary.xlsx` |
| **Σ Libuše inputs** | **58** | |

## DWG inventory (14 souborů)

| Soubor | Typ | Objekt |
|--------|-----|--------|
| `185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dwg` | Půdorys | spol. 1.PP |
| `185-01_DPS_D_SO01_100_4040_R00 - odvodneni teras.dwg` | Detail | suterén |
| `185-01_DPS_D_SO01_100_5000_R01 - ŘEZY 1-PP.dwg` | Řez | spol. 1.PP |
| `185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dwg` | Půdorys | D / 1.NP |
| `185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP.dwg` | Půdorys | D / 2.NP |
| `185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP.dwg` | Půdorys | D / 3.NP (podkroví) |
| `185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha.dwg` | Půdorys | D / střecha |
| `185-01_DPS_D_SO01_140_5400_R01 - OBJEKT D - ŘEZY.dwg` | Řez | D |
| `185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY.dwg` | Pohled | D |
| `185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP.dwg` | Podhledy | D / 1.NP |
| `185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. NP.dwg` | Podhledy | D / 2.NP |
| `185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. NP.dwg` | Podhledy | D / 3.NP |
| `185-01_DPS_D_SO01_140_ARS objekt D_desky.dwg` | ARS / desky | D |
| `18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dwg` | Koor. výkres jader | D / 2.NP |

**Pozorování:** DWG dataset pokrývá pouze **objekt D + společný 1.PP**. Objekty
**A, B, C** v DWG NEJSOU. Spec očekává cross-object validaci A/B/C/D — pro
A/B/C jsou k dispozici jen PDF zdroje. Toto je důležitý fact pro Phase 0.7
(per-objekt extrakce z DXF).

DWG version (sample): `DWG AutoDesk AutoCAD 2013-2017` — kompatibilní s ODA
File Converter target `ACAD2018` a ezdxf 1.4 readback.

## XLSX tabulky (9)

| Tabulka | Soubor |
|---------|--------|
| Místnosti | `185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx` |
| Skladby a povrchy | `185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx` |
| Dveří | `185-01_DPS_D_SO01_100_0041_TABULKA DVERI.xlsx` |
| Oken | `185-01_DPS_D_SO01_100_0042_TABULKA OKEN.xlsx` |
| Prosklených příček | `185-01_DPS_D_SO01_100_0043_TABULKA PROSKLENYCH PRICEK.xlsx` |
| Zámečnických výrobků | `185-01_DPS_D_SO01_100_0050_R01_TABULKA ZAMECNICKYCH VYROBKU.xlsx` |
| Klempířských prvků | `185-01_DPS_D_SO01_100_0060_R01_TABULKA KLEMPIRSKYCH PRVKU.xlsx` |
| Překladů | `185-01_DPS_D_SO01_100_0070_R01_TABULKA PREKLADU.xlsx` |
| Ostatních prvků | `185-01_DPS_D_SO01_100_0080_R02 - TABULKA OSTATNICH PRVKU.xlsx` |

## Open questions for next session

1. **DWG coverage gap (objekty A/B/C):** v DWG je jen objekt D + spol. 1.PP.
   Jak postupovat pro A/B/C? Měřit z PDF s tolerancí (±50–100 mm OCR), nebo
   požádat klienta o doplňující DWG?
2. **ODA install:** uživatel musí stáhnout ODA File Converter z opendesign.com
   (free + registrace) a poskytnout binární cestu. Bez toho je Phase 0.5
   conversion blocked. Detaily: `test-data/libuse/outputs/phase_0_5_poc.md`.
