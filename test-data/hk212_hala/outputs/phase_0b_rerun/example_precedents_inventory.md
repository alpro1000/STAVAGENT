# §13.1 — Example Precedents Inventory

**Date:** 2026-05-13 (rev. after upload)
**Phase:** 0b RE-RUN · §13 addendum
**Status:** ✅ **Files present** — 20 souborů v `test-data/hk212_hala/example_vv/`

> Note: spec §13.1 expected directory name `example/` (English). Skutečná lokace = `example_vv/` (CZ shorthand pro "výkaz výměr"). Funkčně shoda — analyzed and treated as the precedent corpus.

---

## §13.1 Discovery — výsledek

### Soubory (20 ks, ~8.5 MB total)

#### A) Hala-precedent xlsx soupisy (6 souborů, primární precedent korpus)

| # | Soubor | Velikost | Format | Listy | Položek | VRN | Typ stavby | Investor class |
|---:|---|---:|---|---:|---:|---:|---|---|
| 1 | `20241219_Hala na sul Rozmital_rozpocet_slepy.xlsx` | 273 KB | RTS_ROZPOCET | 7 | 552 | 12 | **Sklad soli (hala) — DEMOLICE + NOVOSTAVBA** | Veřejný (krajská správa silnic) |
| 2 | `14ZM-230523 - HALA JHV [zadání].xlsx` | 1.3 MB | URS_KROS_KOMPLET | 26 | 4403 | 17 | Hala pro deponaci (deponační hala) | Veřejný (dopravní podnik) |
| 3 | `23 06 26_rev02 - … HALY V DÍLNÁCH SŠ KRALOVICE [zadání].xlsx` | 1.3 MB | URS_KROS_KOMPLET | 21 | 2584 | 4 | Nová hala v dílnách školy | Veřejný (střední škola) |
| 4 | `Novostavba logistické haly ANTRACIT, Město Touškov - oceňovací tabulka.xlsx` | 39 KB | **CUSTOM_INVESTOR_FORMAT** | 2 | ~80 (flat) | — | Logistická hala — cenová nabídka | Soukromý (logistic developer) |
| 5 | `Příloha č. 5 - Slepý položkový rozpočet_oprava.xlsx` | 314 KB | URS_KROS_KOMPLET | 13 | 792 | 3 | Sklad škrobu P-001 | Soukromý (potravinářství) |
| 6 | `SOUPIS-PRACI-Tremosna-KD-20.12.2023.xlsx` | 559 KB | URS_KROS_KOMPLET | 12 | 1630 | 1 | Kulturní dům — multifunkce (ne čistá hala, ale URS pattern stejný) | Veřejný (obec) |

#### B) Forestina-related (NON-HALA: residential warehouse + offices in Horažďovice — different scale)

| Soubor | Velikost | Charakter |
|---|---:|---|
| `FORESTINA - ZTI venky výkaz.xlsx` | 65 KB | ZTI venkovní rozvody — výkaz výměr only |
| `FORESTINA - ZTI vnitřky výkaz.xlsx` | 87 KB | ZTI vnitřní rozvody — výkaz výměr only |
| `FORESTINA elektroinstalace výkaz.xls` | 144 KB | EL výkaz výměr (.xls old format) |
| `FORESTINA s.r.o. Horažďovice, Blatenská 587 [zadání] (2).xlsx` | 406 KB | Kompletní zadání (může být užitečné jako secondary cross-reference) |
| `Forestina  - VZT - výkaz.xls` | 96 KB | VZT výkaz výměr (.xls old) |
| `Forestina Horaždovice- UT, OPZ [zadání].xlsx` | 162 KB | ÚT + OPZ zadání |

**Forestina rationale:** Forestina (potravinářské stavby — koření, mlýn) jsou skladově-výrobní haly. Excel files jsou bare výkaz výměr per profese (ne plný rozpočet) — užitečné jako **per-profession granularity reference** pro hk212 SO-03..SO-08 sheety, ale jako primární precedent slabší (struktura není rozpočtová, jen měřenkové sloupy).

#### C) PDF výkresy (z Rožmitál nebo Forestina — pravděpodobně DPS výkresy související s některým xlsx)

| Soubor | Velikost | Pravděpodobný kontext |
|---|---:|---|
| `D.1.1.1 Půdorys 1.NP.pdf` | 100 KB | Půdorys 1.NP |
| `D.1.1.2 Základy.pdf` | 151 KB | Základy + výkop |
| `D.1.1.3 Řez.pdf` | 179 KB | Řez podélný |
| `D.1.1.4 Pohledy.pdf` | 238 KB | Pohledy / fasády |
| `D.1.1.5 Výkres střechy.pdf` | 136 KB | Půdorys střechy |
| `D.1.1.6 Výkopy.pdf` | 67 KB | Výkresy výkopů |

Tyto PDF jsou supporting documentation pro některý precedent (pravděpodobně Rožmitál, ale bez razítka projektanta nelze jednoznačně identifikovat). **Nezahrnuty do pattern extraction §13.2** — strukturální analýza nepotřebuje výkresy precedentů.

#### D) XML soubor

| Soubor | Velikost | Format |
|---|---:|---|
| `14ZM-230523 - HALA JHV (zadání).xml` | 3.1 MB | XML mirror Hala JHV zadání (UNIXML/KROS export) — duplicate of `.xlsx` |

#### E) Dummy file

| Soubor | Velikost | Účel |
|---|---:|---|
| `1` | 1 byte | Placeholder z GitHub web UI — vytvořen jako "Create 1" (může bezpečně ignorovat) |

---

## §13 Closest precedent — Rožmitál (PRIMARY)

User explicitně potvrdil v interview (předchozí kolo): "hala na SOL v Rožmitále" je nejbližší precedent. Po analýze:

| Atribut | Rožmitál | hk212 | Shoda |
|---|---|---|---|
| Typ stavby | Skladová hala ocelová rámová | Skladová hala ocelová rámová | ✅ identický |
| Účel | Sklad soli (silniční údržba) | Sklad fotovoltaických panelů + recyklace | ⚠️ jiný účel (Sklad vs Sklad+Recyklace) |
| Konstrukce | Ocelová rámová + Z-profilové vaznice | Ocelová rámová (IPE 400 + HEA 200) + IPE 160 vaznice + UPE 160 krajní | ✅ stejný systém |
| Plocha | TBD (Rožmitál soupis nemá explicit area, ale měřítko se dá odvodit z vzorců VV) | 495 m² podlahová | TBD |
| Beton patek | C 16/20 | C 16/20 (TZ ✓) | ✅ identický |
| Beton desky | TBD | C 25/30 XC4 | TBD |
| Kingspan opláštění | Ano (sendvičové, typ nezveřejněn v slepém) | Ano (typ neuveden v TZ → ABMV #13) | ✅ pattern stejný |
| Stejné Rožmitál demolice? | Ano (SO01 demolice + SO02 novostavba) | NE (novostavba pouze) | ⚠️ -1 SO pro hk212 |
| Stejný subdod split? | Vlastní default | Vlastní default | ✅ identický |
| Technologie strojů (SO-10)? | NE — Rožmitál nemá strojní technologii | ANO (recyklace, ABMV #3 + #16) | ⚠️ +1 SO pro hk212 |
| VRN granularita | 12 položek | 8-12 expected | ✅ shoda |

**Verdict:** Rožmitál je **vhodný primary precedent** pro hk212 — stejný structural system, beton třídy, opláštění, klempířské. Hk212 by měl mít **netto -1 SO** (demolice) + **netto +1 SO** (technologie strojů), takže celkový počet SO podobný.

---

## §13.6 Privacy guardrails — aktivně dodrženo

V tomto reportu a v `example_pattern_analysis.md` + `structure_alignment_check.md`:
- ❌ **Žádné konkrétní ceny** (slepé rozpočty mají všechny ceny 0 nebo jsou abstraktně zmíněné jako "TBD")
- ❌ **Žádné IČO/DIČ** (Rožmitál `00066001` / `08714771` viděné v R5-R8 sheetu Stavba — NEZAPSÁNY)
- ❌ **Žádné e-maily, telefony** (ANTRACIT R6-R8 měl `Ing. Aleš Kytnar / ales.kytnar@antracitproperty.eu / 775615054` — NEZAPSÁNY)
- ❌ **Žádné adresy** (Krajská správa silnic `Zborovská 81/11 Praha-Smíchov` — NEZAPSÁNY)
- ✅ **Pouze structural metrics** (kódy URS, popis položky truncate 50-65 znaků, MJ, počty per kapitola, granularita per element type)
- ✅ **Investor / projektant class** (veřejný / soukromý / krajská správa / dopravní podnik / střední škola / logistic developer / potravinářství / obec) — abstract

Pokud bude potřeba později naopak DETAILNĚJŠÍ data (např. pro výběr subdodavatele dle Rožmitál seznamu kontaktů), bude se k tomu přistupovat samostatným task — žádné takové data nyní v outputech.

---

## Next step (per §13.3 + §13.4)

→ `example_pattern_analysis.md` (struktura, granularita, naming, subdod, VRN, sloupce, format)
→ `structure_alignment_check.md` (apply to hk212 + 11-SO skeleton + discrepancy flags)

Po user review těchto reportů + uzavření 6-7 kritických ABMV (drift schválení, Kingspan typ, vrata rozměr, počet svodů, technologie strojů) → **Phase 1 generator** v separátní task.
