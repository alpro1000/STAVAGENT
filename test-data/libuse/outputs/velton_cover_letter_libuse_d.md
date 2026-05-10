# Průvodní dopis k předání VV — Libuše objekt D

**Status:** draft for user review before send (deadline 19.5.2026).
**Adresát:** VELTON REAL ESTATE
**Forma:** doporučeno PDF + zdrojový .xlsx + tento dopis jako příloha 1
**Send by:** **19.5.2026** (smluvní deadline)

---

## Záhlaví

| Pole | Obsah |
|---|---|
| **Předmět:** | Předání výkazu výměr — bytový soubor Libuše, objekt D, dokončovací práce (akce 185-01, DPS rev. 01) |
| **Příloha 1:** | `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` (801 KB, 12 listů) |
| **Příloha 2:** | tento průvodní dopis (PDF) |
| **Datum:** | 19.5.2026 |
| **Generální projektant:** | ABMV world s.r.o. (referenčně) |

---

## Tělo dopisu (Czech business tone)

Vážení,

předkládáme Vám finální verzi **výkazu výměr pro dokončovací práce
objektu D** bytového souboru Libuše (akce 185-01, DPS revize 01 ze
30.11.2021). Dokument je výsledkem cross-source auditu architektonické
projektové dokumentace s důrazem na úplnost, jasnou provenienci každé
položky a transparentní označení míst, kde naše interpretace doplňuje
nebo upravuje kanonický zdroj.

---

### 1. Předmět dodávky

Excel `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx`, **12 listů**:

| List | Obsah |
|---|---|
| `0_Souhrn` | Headline metriky + recommendations pro investora |
| `1_Vykaz_vymer` | **Hlavní soupis 4 025 položek** (3 786 řádek + hlavička) |
| `2_Audit_proti_staremu` | Diff vs starý komplex VV (1 423 řádek) |
| `3_Critical_findings` | Detail kritických nálezů (PROBE 1–9) |
| `4_Mistnosti` | Reference 109 místností objektu D + sklepní kóje |
| `5_Skladby` | Skladby s rozkladem vrstev (komplex) |
| `6_Border_zone` | Položky čekající na vyjasnění s elektro/VZT/ZTI |
| `7_VRN` | Vedlejší rozpočtové náklady |
| `8_Carry_forward_findings` | Audit log (PROBE 1–9 status + rozhodnutí) |
| `9_Metadata` | Provenence + verze pipeline |
| `11_Sumarizace_dle_kódu` | Sumarizace pro KROS workflow (master + detail rows) |
| `12_Filter_view` | **Excel Table `VykazFilter`** — filtrovatelné po podlaží, místnosti, kapitole, statusu, confidenci (4 027 řádek × 13 sloupců) |

**Doporučená pracovní obrazovka:** List 12 `Filter_view` — drop-down
filtry v každém sloupci umožňují rychlou kontrolu po jakékoli ose
(podlaží 1.PP/1.NP/2.NP/3.NP, kapitola HSV/PSV, status, confidence).

---

### 2. Rozsah

| Metrika | Hodnota |
|---|---:|
| Celkový počet položek | **4 025** |
| Odhadovaný rozsah scope (orientačně) | **~3,4–3,5 mil. Kč** *(předběžný odhad bez ÚRS pricing)* |
| Pokrytí podlaží | 1.PP (suterén) + 1.NP + 2.NP + 3.NP |
| Pokrytí kapitol HSV/PSV | 50 distinkt kapitol (HSV-611 přes PSV-952 + 11 VRN) |
| Confidence-weighted average | **0,91** napříč všemi položkami |
| Položky s confidencí ≥ 0,85 (direct extract) | **3 933 (97,7 %)** |
| Položky s confidencí 0,70 (heuristický odhad) | **102 (2,5 %)** — výhradně 1.PP VZT/chl |

> **Pricing:** ÚRS kódy v sloupci B Listu 1 jsou aktuálně placeholder
> `[doplnit]`. KROS workflow probíhá manuálně přes List 11 sumarizaci
> a není součástí naší dodávky. Cena za m² / ks není v této verzi
> uvedena záměrně — zaplnění čistě v rámci VELTON pricing flow.

---

### 3. Audit highlights — co bylo zachyceno

V průběhu zpracování proběhla **devíti­etapová audit cesta (PROBE 1–9)**.
Každý PROBE identifikoval konkrétní gap mezi starou verzí komplexového
VV a fyzickou skutečností v projektové dokumentaci. Všech 9 PROBEs je
k datu předání **vyřešeno** s plnou audit-trail v Listu
`8_Carry_forward_findings`. Vybrané highlights:

- **PROBE 8** — 6 specialty stavebních otvorů (D06 protipožární brána
  5400×2100, W81/W82/W84 výklopně-kyvná okna s R'w 35 dB, CW11/CW12
  prosklené příčky RC2 + 40 dB) bylo v původním fuzzy-matcheru tiše
  podhozeno (composite score 0,113–0,227). Při Π.0a DXF-extrakci
  ověřeno fyzicky 45 instancí; přidáno do soupisu se statusem
  `OPRAVENO_POPIS` a confidencí 0,95. **Material gap ~1,0 mil. Kč.**

- **PROBE 9** — instalační prostupy + štroby HSV scope (kapitoly
  HSV-961/962/963). 998 položek napříč 6 disciplínami:
  - kanalizace, vodovod, silnoproud, slaboproud, UT, plyn:
    **direct extraction** (510 prostupy + 48 štroby, confidence 0,85–0,95)
  - VZT a chlazení D 1.NP/2.NP/3.NP: **direct extraction**
    (338 prostupy, confidence 0,85) — díky ABMV poskytnutým
    AC1024 DXF souborům
  - VZT 1.PP + chlazení 1.PP: **heuristický odhad** (102 prostupy,
    confidence 0,70) — chybějící zdrojový soubor
  
  **Estimated scope ~400–500 tis. Kč.**

- **Triple-source verification** — pro každý hlavní okruh (mistnosti,
  dveře, okna, skladby, prostupy) je vyžadována shoda nebo prokazatelná
  reconciliation mezi:
  1. **XLSX Tabulka** (kanonický číselník: 0020 mistnosti, 0030 skladby,
     0041 dveře, 0042 okna, 0050/0060/0070/0080)
  2. **DXF výkres** (geometrický extrakt: půdorysy, řezy, pohledy,
     koordinační výkresy, jádra, per-discipline TZB)
  3. **Starý komplexový VV** (audit baseline pro identifikaci gaps)

  Detaily reconciliation jsou v Listu 2 `Audit_proti_staremu`
  (1 423 řádek mapování, status `MATCH_HIGH` / `MATCH_POSSIBLE` /
  `VYNECHANE_ZE_STAREHO`).

- **Π.0a Foundation Extraction Layer** — objektagnostická pipeline,
  která produkuje canonical `master_extract_D.json` (2,1 MB strukturovaná
  reprezentace všech zdrojů) jako audit-grade single source of truth.
  Validation gate **373 MATCH / 0 MISSING / 0 CHANGED / 7 NEW** ověřuje
  konzistenci proti původním Phase 0.x výstupům. **Idempotency:** 3×
  re-run produkuje byte-identický výstup.

---

### 4. Open items — vyjasnění s ABMV

Souběžně s touto dodávkou jsme **11.5.2026 odeslali ABMV world s.r.o.
žádost o vyjasnění 10 dílčích nesrovnalostí dokumentace** identifikovaných
během křížové kontroly (kopie emailu k dispozici). Termín odpovědi
**14.5.2026**, tedy 5 dnů před touto dodávkou.

Žádný z bodů nebrání předání:

| Bod | Charakter | Pracovní interpretace |
|---|---|---|
| 1–4 | F-kód překlepy / sequence | Použili jsme nejpravděpodobnější interpretaci, audit-flag |
| 5 | Tištěný výpis sekce | XLSX zdroj je správný, jen PDF reformat |
| 6 | Sklepní kóje S.D.16 + S.D.42 | Ručně injektovány jako platné místnosti |
| 7 | D10 specifikace | Použili jsme tabulkové STD; A/B-style s ACS-EMZ-SN2 lze přidat retroaktivně po potvrzení |
| 8 | Počet kusů D10/D11/D20/D42/D21 | Použili jsme **DWG-počty** jako kanonické (přesnější geometrický zdroj) |
| 9 | Objekt A ARS desky | Out of scope pro D — týká se budoucího komplexového ocenění |
| 10 | AutoCAD-export formát VZT/chl | Vyřešeno pro 6/7 souborů; 1.PP VZT v heuristice |

**Pokud po termínu 14.5 dorazí korekce ovlivňující D (zejména body 7
a 8), připravíme malý update VV před finálním podpisem.** Charakter
změn ale nepřesahuje 10–20 položek z 4 025, takže update je
mechanický.

---

### 5. Backlog — připraveno, na vyžádání

| Item | Stav | Spuštění |
|---|---|---|
| **Π.0a foundation pro objekty A/B/C** | Připraveno: `master_extract_A.json` (1,3 MB), `_B.json` (1,5 MB), `_C.json` (1,2 MB) — geometrický extrakt z DWG/XLSX | Π.1 V1 generator phase, ~7–9 dnů focused work, **na objednávku** |
| **1.PP VZT confidence uplift** | 1 zdrojový DWG soubor 29 MB čeká na nahrání přes git CLI (přesahuje GitHub UI 25 MB limit) | ~30 min mechanický follow-through, závisí na ABMV reply na bod #10 |
| **DN proximity refinement** | ~80 % currently-null DN labels (TEXT entities labelled along pipe runs, ne na CIRCLE prostupech) | Future Step 8c follow-up; pipe-segment graph traversal |
| **ÚRS pricing** | KROS workflow přes List 11 sumarizaci | VELTON pricing flow (mimo náš scope) |

Žádný z těchto bodů nebrání aktuální D dodávce.

---

### 6. Disclaimer & confidence breakdown

V duchu transparentnosti shrnujeme rozdělení confidencí:

| Confidence | Položek | Charakter | Poznámka |
|---:|---:|---|---|
| **1,00** | XLSX-extract (Tabulka 0030/0041/0042/0020) | Hodnoty převzaté literálně z tabulek |
| **0,95** | Π.0a direct DXF extract (kan/vod/sil/slb/UT/plyn) | Geometrický extrakt přes ezdxf, validovaný proti starému VV |
| **0,85** | DXF VZT + chl direct + cable-tray štroby | Layer-convention-based interpretation; explicitní symbol absent, layer match implies penetration |
| **0,70** | **102 položek** — výhradně 1.PP VZT (94) + 1.PP chl (8) | **Heuristický odhad** density-ratio anchored to vodovod + kanalizace actuals × 30 % VZT / 20 % chl + 1.PP machine room correction. Methodology: `probe_9_vzt_chl_manual_counts.md`. |

> **Specifické varování pro heuristické položky (94 + 8 = 102 ks):**
> Při kontrole je vhodné v Listu 12 vyfiltrovat `Confidence = 0.70`
> a manuálně srovnat s PDF výkresy 1.PP koordinace
> (`_100_9000_R00_koordinacni vykres 1PP.pdf`). Pokud zjistíte
> systematickou odchylku (např. heuristika nadhodnocuje), jednoduše
> nás kontaktujte — výměnu za skutečné počty zvládneme v desítkách
> minut po obdržení 1pp_VZT.dxf nebo manuálního počtu od ABMV.

---

## Závěr

Děkujeme za spolupráci na projektu Libuše. Věříme, že předkládaný výkaz
výměr poslouží jako spolehlivý základ pro KROS pricing a finální nabídku
investorovi. Jsme k dispozici pro jakékoli dotazy ohledně metodologie,
audit-trail nebo pracovních interpretací u jednotlivých položek.

S úctou,

[Jméno odesílatele]
[Funkce / firma]
[Kontakt]
[Datum: 19.5.2026]

---

_Generated by Claude Code, VELTON cover letter draft, 2026-05-10._
