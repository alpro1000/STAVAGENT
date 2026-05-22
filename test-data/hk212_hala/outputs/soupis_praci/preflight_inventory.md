# HK212 Soupis prací — Pre-flight Inventory

**Generated:** 2026-05-24 · **Phase A** of soupis_praci pipeline

---

## 1. KROS catalog (test-data/kros_catalog.db)

- **Total items:** 9,173
- **FTS5 index rows:** 9,173 (full-text search ready)
- **Vintage range:** 2018–2026

### TSKP třída distribution (1st digit of kód):
| Třída | Items | Název |
|---|---:|---|
| 0 | 7 | ? |
| 1 | 1,153 | HSV-1 zemní práce |
| 2 | 2,117 | HSV-2-3 zakládání + svislé konstrukce |
| 3 | 1,946 | HSV-3 svislé konstrukce + zdivo |
| 4 | 297 | HSV-4 vodorovné konstrukce |
| 5 | 4 | HSV-5 komunikace |
| 6 | 68 | HSV-6 úpravy povrchů |
| 7 | 3,326 | PSV (71x-78x) řemesla |
| 9 | 247 | HSV-9 přesun hmot + ostatní |
| O | 8 | ? |

### Top MJ (měrná jednotka):
| MJ | Count |
|---|---:|
| m2 | 3,360 |
| m | 2,349 |
| kus | 1,679 |
| m3 | 1,342 |
| t | 313 |
| % | 45 |
| hod | 38 |
| soubor | 15 |
| den | 15 |
| kg | 11 |
| ha | 4 |
| kpl | 2 |

### Vintage years:
| Year | Count |
|---|---:|
| None | 784 |
| 2018 | 6,679 |
| 2024 | 2 |
| 2025 | 106 |
| 2026 | 1,602 |

### FTS sanity check — HK212 keywords:

**`beton patky`** — 0 hits:

**`Kingspan`** — 0 hits:

**`sendvičový panel`** — 0 hits:

**`Lindab`** — 3 hits:
- `764011611.LND` (m) — Podkladní plech LINDAB FOP/PLX - plastizol rš 150 mm
- `764011612.LND` (m) — Podkladní plech LINDAB FOP/PLX - plastizol rš 200 mm
- `764011613.LND` (m) — Podkladní plech LINDAB FOP/PLX - plastizol rš 250 mm

**`hloubení figury`** — 0 hits:

**`KARI síť`** — 0 hits:

**`atika oplechování`** — 0 hits:

**`vrata sekční`** — 0 hits:

---

## 2. example_vv reference corpus

| # | File | Ext | Size kB | Sheets / Note |
|---|---|---|---:|---|
| 1 | 1 |  | 0 | ? |
| 2 | 14ZM-230523 - HALA JHV (zadání).xml | .xml | 3001 | UNIXML KROS export (skipped for sniff) |
| 3 | 14ZM-230523 - HALA JHV [zadání].xlsx | .xlsx | 1237 | 26 sheets: Rekapitulace stavb, SO-02-1 - ASŘ, SO-02-2 - KSŘ, SO-02-4.1-1 - VODA... |
| 4 | 20241219_Hala na sul Rozmital_rozpocet_slepy.xlsx | .xlsx | 266 | 7 sheets: Pokyny pro vyplněn, Stavba, VzorPolozky, SO01 01 Pol... |
| 5 | 23 06 26_rev02 - PROJEKTOVÁ DOKUMENTACE PRO VÝSTAVBU NOVÉ HA | .xlsx | 1305 | 21 sheets: Rekapitulace stavb, D.1.1.1 - ARCHITEK, D.2.1 - Komunikace, 000 - VON - Vedlěj... |
| 6 | D.1.1.1 Půdorys 1.NP.pdf | .pdf | 97 | drawing PDF (not parsed) |
| 7 | D.1.1.2 Základy.pdf | .pdf | 147 | drawing PDF (not parsed) |
| 8 | D.1.1.3 Řez.pdf | .pdf | 175 | drawing PDF (not parsed) |
| 9 | D.1.1.4 Pohledy.pdf | .pdf | 232 | drawing PDF (not parsed) |
| 10 | D.1.1.5 Výkres střechy.pdf | .pdf | 132 | drawing PDF (not parsed) |
| 11 | D.1.1.6 Výkopy.pdf | .pdf | 65 | drawing PDF (not parsed) |
| 12 | FORESTINA - ZTI venky výkaz.xlsx | .xlsx | 63 | 4 sheets: Stavební rozpočet, Stavební rozpočet , Krycí list rozpočt, VORN |
| 13 | FORESTINA - ZTI vnitřky výkaz.xlsx | .xlsx | 85 | 4 sheets: Stavební rozpočet, Stavební rozpočet , Krycí list rozpočt, VORN |
| 14 | FORESTINA elektroinstalace výkaz.xls | .xls | 140 | 1 sheets: vv |
| 15 | FORESTINA s.r.o. Horažďovice, Blatenská 587 [zadání] (2).xls | .xlsx | 396 | 9 sheets: Rekapitulace stavb, 010 - Administrati, 020 - Hala, 021 - Hala - marký... |
| 16 | Forestina  - VZT - výkaz.xls | .xls | 94 | 1 sheets: Rozpiska |
| 17 | Forestina Horaždovice- UT, OPZ [zadání].xlsx | .xlsx | 158 | 7 sheets: Rekapitulace stavb, 01 - 01-Vytápění-K, 02 - Vytápění- oto, 04 - OPZ-hala... |
| 18 | Novostavba logistické haly ANTRACIT, Město Touškov - ocen | .xlsx | 38 | 2 sheets: Krycí list CZK, Položkový rozpočet |
| 19 | Příloha č. 5 - Slepý položkový rozpočet_oprava.xlsx | .xlsx | 306 | 13 sheets: Rekapitulace stavb, 2023-003-a - SO-21, 2023-003-b - SO-21, 2023-003-c - SO-21... |
| 20 | SOUPIS-PRACI-Tremosna-KD-20.12.2023.xlsx | .xlsx | 545 | 12 sheets: Rekapitulace stavb, 01 - Architektonic, 02 - Zdravotní ins, 03 - Vytápění... |

### Code format samples per file (first 8 unique 8-12 digit codes):

- **14ZM-230523 - HALA JHV [zadání].xlsx** → 00005886, 04598555
- **23 06 26_rev02 - PROJEKTOVÁ DOKUMENTACE PRO VÝSTAVBU NOVÉ HA** → 00077704, 61169111
- **FORESTINA - ZTI venky výkaz.xlsx** → 42200730, 69370510, 286134121, 59224346, 55340325
- **FORESTINA - ZTI vnitřky výkaz.xlsx** → 631547116, 631547013, 55147033, 631547114, 55231082, 642938205, 286967611, 631547115
- **Novostavba logistické haly ANTRACIT, Město Touškov - ocen** → 775615054
- **SOUPIS-PRACI-Tremosna-KD-20.12.2023.xlsx** → 49194852

### Top 3 references most similar to HK212 (ocelová hala + Kingspan):
1. **HALA JHV (zadání)** — ocelová hala, KROS export, primární reference
2. **Hala na sul Rozmital_rozpocet_slepy** — slepý rozpočet, podobná velikost
3. **ANTRACIT logistická hala Touškov — oceňovací tabulka** — logistická hala, sendvičové opláštění

---

## 3. items_hk212_etap1.json (current state)

- **Total items:** 128
- **Items with existing urs_code:** 37
- **Items needing Tier 1/2 match:** 91

### Per kapitola:
| Kapitola | Count |
|---|---:|
| HSV-1 | 28 |
| HSV-2 | 18 |
| HSV-3 | 14 |
| HSV-9 | 4 |
| PSV-71x | 4 |
| PSV-76x | 12 |
| PSV-77x | 6 |
| PSV-78x | 12 |
| PSV-OPL | 8 |
| VRN | 22 |

### Confidence distribution:
| Range | Count |
|---|---:|
| 0.75-0.90 | 43 |
| 0.50-0.75 | 77 |
| <0.50 | 3 |
| 0.90+ | 5 |

### Top MJ in items.json:
| MJ | Count |
|---|---:|
| m³ | 27 |
| m² | 22 |
| ks | 18 |
| bm | 17 |
| paušál | 15 |
| kg | 12 |
| kpl | 5 |
| měsíc | 5 |
| t | 4 |
| t·km | 3 |

---

## 4. Matching strategy decision

- **Primary tool:** SQLite FTS5 on `kros_fts.popis_normalized` (faster + better than TF-IDF for Czech text)
- **MJ filter:** narrow candidates to matching mj (m³/m²/kg/ks/bm/paušál)
- **Třída filter:** narrow to TSKP first-digit consistent with HK212 kapitola:
  - HSV-1 → třída 1 (zemní + bourání)
  - HSV-2 → třída 2 (zakládání)
  - HSV-3 → třída 1+5 (ocelová konstrukce: 13xxxx montáž OK; 553xxx dodávka profily)
  - HSV-9 → třída 9 (přesun hmot + lešení)
  - PSV-71x → třída 711+713 (izolace)
  - PSV-76x → třída 762-767 (truhlář + zámečník + nátěr)
  - PSV-77x → třída 776+781 (podlahy)
  - PSV-78x → třída 764 (klempíř)
  - PSV-OPL → třída 342 (montáž opláštění) + 553 (dodávka panelů)
  - VRN → třída 0 nebo 9 (VRN nemá KROS code typicky → Tier 2 custom)

## 5. Environment notes

- ✅ `openpyxl` available (for .xlsx read/write)
- ✅ `xlrd 2.0.2` available (for old .xls Forestina files)
- ✅ `sqlite3` stdlib
- ❌ `pandas` NOT installed — using openpyxl+sqlite3 directly
- ❌ `reportlab` NOT installed — **PDF rekapitulace dropped** from §5 deliverables. Excel + JSON will be the primary outputs; PDF flagged in handoff as P3.

## 6. Acceptance gates (re-stated)

- [ ] ≥ 60 % items get Tier 1 KROS match (confidence ≥ 0.70)
- [ ] ~40 % flagged Tier 2 custom with nearest KROS ref
- [ ] Excel hk212_soupis_praci.xlsx renders, 12 sheets (PDF dropped)
- [ ] JSON twin preserves audit_trail
- [ ] ABMV unresolved listed
- [ ] Original items.json UNMODIFIED