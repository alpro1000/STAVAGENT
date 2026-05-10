# ABMV email — Libuše objekt D, žádost o vyjasnění dokumentace

**Status:** draft for user review before send (Outlook/Gmail).
**Subject:** Libuše objekt D — žádost o vyjasnění dokumentace pro finalizaci výkazu výměr
**To:** ABMV world s.r.o. (generální projektant) — adresa per existing project mailbox
**CC:** VELTON REAL ESTATE (klient)
**Send by:** 11.5.2026 doporučeno (deadline odpovědi ABMV: 14.5.2026; finální VELTON delivery 19.5.2026)

---

## Tělo zprávy (Czech, business tone)

Dobrý den,

při finalizaci výkazu výměr pro objekt D bytového souboru Libuše (akce 185-01)
jsme při křížové kontrole projektové dokumentace narazili na **10 dílčích
nesrovnalostí mezi tabulkami a výkresy**, které je vhodné vyjasnit před
odevzdáním VELTONu (deadline **19.5.2026**). Žádné z těchto bodů
samostatně nebrání předání — pro každý jsme zvolili pracovní interpretaci
a poznamenali ji v doprovodném auditu — ale potvrzení od vás by upevnilo
důvěru v kanonickou verzi pro budoucí komplexové ocenění (objekty A/B/C).

Děkujeme předem za reakci do **14.5.2026**, abychom stihli zapracovat
do finální verze.

---

### 1. Číslování F-kódů: XLSX vs PDF (Tabulka 0030)

Sheet `povrchy` v XLSX má 23 sekvenčních řádků F00–F22; PDF Tabulka 0030
má explicitní kódy F00–F23 s **vynechaným F20**. Od F20 výše se XLSX a PDF
neshodují (XLSX `F20` = obchodní podlaha, PDF `F21` = obchodní podlaha).

**Otázka:** která verze je kanonická?
**Zdroj:** `185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx`,
sheet `povrchy`, vs. `185-01_DPS_D_SO01_100_0030_01_Tabulka_specifikace_skladeb_a_povrchu.pdf`

---

### 2. F20 jako "obchodní podlaha" aplikováno na stěny/podhledy

V Tabulce místností je `F20` použito **16×** jako kód `F povrch stěn` nebo
`F povrch podhledu` u 8 obytných pokojů (D.3.1.02/06/07, D.3.2.03/04,
D.3.3.02/06/07). Sémanticky se zdá jako překlep — `F20` v XLSX znamená
"povrch podlahy obchodní jednotky", což na stěny ani podhled obytného
pokoje logicky nepatří.

**Pracovní interpretace:** překlep za `F17` (SDK + otěruvzdorná výmalba).
**Otázka:** potvrdíte F17, nebo má být jiný F-kód?
**Zdroj:** `185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx`,
sloupce `F povrch stěn` + `F povrch podhledu`, řádky pro pokoje uvedené výše.

---

### 3. F30 v WC bez prefixu FF — chybějící FF?

Místnosti D.2.1.03, D.2.4.03, D.3.1.03 a D.3.3.03 (4× WC) mají v sloupci
`FF` hodnotu `F30` namísto `FF30`. Holé `F30` neexistuje v Tabulce 0030
jako podlahový kód.

**Pracovní interpretace:** překlep za `FF30` (běžná podlaha dlažba 130 mm).
**Otázka:** potvrdíte?
**Zdroj:** Tabulka místností XLSX, sloupec `FF`, řádky D.2.1.03, D.2.4.03,
D.3.1.03, D.3.3.03.

---

### 4. F20 v sloupci FF u WC v 1.PP

Místnost D.1.4.03 (WC v 1. podzemním podlaží) má v sloupci `FF` hodnotu
`F20` — opět holé `F20` bez prefixu.

**Pracovní interpretace:** překlep za `FF20` (podlaha nad suterénem dlažba
130 mm).
**Otázka:** potvrdíte?
**Zdroj:** Tabulka místností XLSX, řádek D.1.4.03, sloupec `FF`.

---

### 5. Tištěný výpis Tabulka místností 1.NP — D.1.3.01 v sekci D.1.2

V tištěné legendě Tabulky místností pro 1.NP je místnost `D.1.3.01`
zařazena pod sekci bytu D.1.2; subtotaly **55,9 m² / 43,2 m²** by měly být
**49,59 m² / 49,59 m²**.

**Otázka:** mohli byste přegenerovat tištěný výpis pro VELTON delivery?
Nejde o problém v XLSX (ten je správně), pouze v PDF výpisu.
**Zdroj:** `185-01_DPS_D_SO01_100_0020_01_Tabulka_mistnosti.pdf`, strana
1.NP legend.

---

### 6. Sklepní kóje S.D.16 a S.D.42 v Tabulce, ne v DXF

`S.D.16 SKLEPNÍ KÓJE - C` (7,62 m²) a `S.D.42 SKLEPNÍ KÓJE - D` (2,99 m²)
jsou definovány v XLSX Tabulce místností, ale chybí v DXF geometric
datasetu — náš parser je možná přeskočil (malé kóje? pozice kódu mimo
detekované polygony?).

**Pracovní interpretace:** ručně injektovány do datasetu jako platné
místnosti; do položek se počítají standardně.
**Otázka:** potvrdíte, že existují fyzicky a mají být ve výkazu?
**Zdroj:** Tabulka místností XLSX (řádky 16 a 42 v sekci D),
vs. `185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dwg` (DXF parser výstup).

---

### 7. D10 v objektu D — STD nebo bezpečnostní pack?

V Tabulce dveří 0041 má D10 v objektu D pouze **STD interior treatment**,
zatímco pro objekty A/B je `D10` specifikováno s **bezpečnostním packem**
(rám + EMZ + ACS + SN2).

**Otázka:** je D10 v objektu D **záměrně downgraded** (jiný účel místnosti),
nebo má být specifikováno stejně jako A/B (a v tabulce je opomenutí)?
Podle odpovědi nasměrujeme cenovou kalkulaci EMZ + ACS + SN2 buď do, nebo
mimo položky.
**Zdroj:** `185-01_DPS_D_SO01_100_0041_TABULKA DVERI.xlsx`, řádky D10 napříč
objekty A/B/D.

---

### 8. Nesrovnalost počtu D-položek: Tabulka 0041 vs DWG (5 kódů)

Tabulka 0041 a architektonický DWG si neodpovídají v počtu kusů u 5 dveří
v objektu D:

| Kód | Tabulka 0041 | DWG | Poznámka |
|---|---:|---:|---|
| D10 | 0 ks | 1 ks | `In_FAS_1600x2350` 1.NP main entrance |
| D11 | 0 ks | 1 ks | 1.NP úniková dveř |
| D20 | 2 ks | 1 ks | |
| D42 | 2 ks | 1 ks | |
| D21 | 10 ks | 11 ks | |

**Pracovní interpretace:** pro položky jsme použili **DWG-počty** (přesnější
geometrický zdroj). Pro D10/D11 to znamená 1 ks místo 0 (jinak by hlavní
vchod neexistoval ve výkazu).
**Otázka:** potvrdíte DWG jako kanonický pro počet kusů, a opravíte
zdroj XLSX pro budoucí konzistenci napříč komplexem (A/B/C/D)?
**Zdroj:** `185-01_DPS_D_SO01_100_0041_TABULKA DVERI.xlsx` (sloupec počet)
vs. `185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1.NP.dwg` + 4420 +
4430 (DWG block-name extrakce).

---

### 9. Objekt A — chybějící výkres ARS desek

Pro objekt A chybí výkres ARS desek (`_110_0000_*`) — DWG i PDF. Objekty
B/C/D tento výkres standardně mají.

**Otázka:** která ze tří možností platí?
- **(a)** Objekt A nemá samostatný výkres desek (vůbec se neprodukuje;
  např. konstrukčně sloučen)?
- **(b)** ARS desky pro A jsou sloučené do jiného objektu (např. společný
  výkres pro A+B nebo s D-deskou) — pokud ano, který soubor je referenční?
- **(c)** Výkres existuje, ale byl zapomenut při uploadu — prosíme zaslat.

Není blokující pro D delivery, ale pro budoucí komplexové ocenění (A/B/C)
to potřebujeme znát.
**Zdroj:** chybí v `inputs/_UNSORTED/`; pro B `185-01_DPS_D_SO01_120_0000_*`,
pro C `185-01_DPS_D_SO01_130_0000_*`, pro D `185-01_DPS_D_SO01_140_ARS*`.

---

### 10. AutoCAD-export VZT/chlazení DWG — formátová poznámka

Při původním pokusu o automatickou konverzi VZT a chlazení DWG souborů
do DXF (libredwg 0.13.4) selhalo 7 souborů — 4× VZT (D 1.NP/2.NP/3.NP +
`1pp_VZT`) a 3× chlazení (D 1.NP/2.NP/3.NP). Chyby:
- **VZT:** `DXFStructureError: Invalid group code "125.00\n"` (line 53865 atd.)
- **chl:** `Object handle not found 37748/0x9374 in 4711 objects`

**Aktuální stav:** poté, co jste **6 z 7 souborů ručně re-exportovali jako
AC1024 DXF a poskytli nám**, máme přímou extrakci pokrytou pro D 1.NP/2.NP/3.NP
VZT + chl s confidencí 0,85. Tímto vám děkujeme — bylo to klíčové pro
finální confidence-weighted average 0,91 napříč 998 PROBE 9 položkami.

Zbývá `1pp_VZT.dxf` (29 MB), který se nepodařilo nahrát přes GitHub UI
(limit 25 MB) — pro D zatím držíme heuristický odhad 94 ks
(confidence 0,70). Pro D delivery to **neblokuje**; do budoucna
plánujeme nahrát ten soubor přes git CLI.

**Otázka pro budoucí komplex (A/B/C):** je možné u dalších objektů
**rovnou exportovat VZT a chlazení jako AC1024 DXF** (případně AC1024 DWG)?
Ušetřilo by to konverzní krok a předešlo známým libredwg-bugům na AC1027.
Není kritické (přepneme na AC1027 pokud bude nutné), ale **nice-to-have**.

**Zdroj failed conversions:** `dwg_conversion_log.md` (post-drop-v2 batch),
backlog ticket #1 v `probe_9_backlog.md`.

---

## Závěr

Děkujeme za pomoc při řešení a za včasnou reakci. Body 7, 8 a 9 jsou
nejvíce relevantní pro správné ocenění D-delivery 19.5.2026 — pokud byste
stihli alespoň ty do **14.5.2026**, velmi to pomůže. Body 1–6 a 10 jsou
spíše pro budoucí konzistenci komplexu.

S pozdravem,
[Jméno odesílatele]
[Funkce / firma]
[Kontakt]

---

_Generated by Claude Code, ABMV email content draft, 2026-05-10._
