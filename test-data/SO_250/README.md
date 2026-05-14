# SO 250 — Briefing pro test kalkulátoru

**Datum:** 2026-05-14
**Účel:** Test calculator на reálném ŘSD projektu (Phase 1 Resource Ceiling validation).
**Zdroj:** 9 PDF v project knowledge (250_01 až 250_08).

---

## 1. Identifikace objektu

| Pole | Hodnota |
|------|---------|
| Stavba | D6 Olšová Vrata - Žalmanov, VD-ZDS |
| Zak.č. | 25-150-2 |
| Stupeň | PDPS |
| Objekt | **SO 250 — Zárubní zeď v km 6,500 – 7,000 vpravo** |
| Staničení | km 6,492 40 – 7,007 60 |
| Investor | ŘSD s.p. |
| Projektant | PRAGOPROJEKT, a.s. (Ing. Pavel Šlapa, Ing. Ladislav Terš) |
| Typ konstrukce | Úhlová železobetonová zárubní zeď, plošně založená |

## 2. Geometrie (vstup do kalkulátoru)

| Parametr | Hodnota |
|----------|---------|
| Délka celkem | **515,20 m** |
| Výška NK | **2,65 – 4,50 m** (proměnná) |
| Výška nad terénem | 1,55 – 3,40 m |
| Pohledová plocha | **1737,44 m²** |
| Tloušťka základu | 0,56 m konstantní |
| Šířka základu | 2,75 m konstantní |
| Tloušťka dříku | 0,45 m konstantní |
| Tloušťka podkladního betonu | 0,15 m, přesah 0,25 m |
| Římsa šířka | 0,85 m |
| Římsa tloušťka | 0,4 m líce / 0,36 m rubu |
| Lícové zdivo | žula 200–300 mm, tl. 0,30 m, kotvy R8 v rastru 0,75×0,75 m |

**Dilatace: 40 DC × 12,50 m + 2 krajní DC × 7,60 m = 42 celků (515,20 m).**

## 3. Materiály (4 betonáže)

| Element | Beton | Expozice | Pozn. |
|---------|-------|----------|-------|
| Podkladní beton | **C12/15** | X0 | (TKP18PK)-Cl 1,0-Dmax22-S2 |
| Základ | **C25/30** | XF3, XC2, XA2 | (TKP18PK)-Cl 0,4-Dmax22-S3 |
| Dřík | **C30/37** | XF4, XC4 | (TKP18PK)-Cl 0,4-Dmax22-S3 |
| Římsa + kotevní trám | **C30/37** | XF4, XD3, XC4 | (TKP18PK)-Cl 0,4-Dmax22-S3 |
| Výztuž | **B500B** | — | krytí dle TKP18 (TP 124 stupeň 3) |
| Spárovací malta | MC25 | XF4 | mezi řadami žuly |

## 4. ⚠️ Nesrovnalosti TZ ↔ výkres (zlatý kámen pro calculator/parser)

Toto jsou typické nesrovnalosti které rozpočtář ručně chytá. Calculator by je měl flagnout:

| Element | TZ str. 6 | Výkres 03 | Kdo má pravdu |
|---------|-----------|-----------|---------------|
| Podkladní beton | C25/30 XF3, XA2, XC2 | **C12/15 X0** | Výkres (TZ chyba copy-paste) |
| Dřík expozice | XF3, XD3, XC4 | **XF4, XC4** | Výkres (XF4 odpovídá soli z dálnice) |
| Zábradlí výška | 1,10 m | **1,15 m** (3-lankové kompozit) | Pravděpodobně 1,10 m nad NK = 1,15 m vč. patní desky |

**Implication pro SmartExtractor (post-CSC):** confidence layer musí umět zachytit konflikt "TZ vs výkres" a navrhnout reconciliation. Není to halucinace, je to realita projektové dokumentace.

## 5. Postup výstavby (TZ §4.1)

1. Výkop pro založení
2. Podkladní beton C12/15
3. Betonáž základu C25/30
4. Betonáž dříku C30/37
5. **Technologická přestávka**
6. Izolace + drenáže rubu (ALP+2×ALN, geokompozit 6mm)
7. Zásypy (Id=0,85, max. 300 mm vrstvy)
8. Římsa + osazení zábradlí

**Calculator demand check:** 42 DC × průměr 12,5 m × 0,45 m × 2,99 m ≈ 700 m³ betonu jen dřík.

## 6. Geotechnika

- Granit karlovarského plutonu, místy zvětralá žula
- Třída těžitelnosti **I–III, lokálně IV** (ČSN 73 6133)
- Edef,2 ≥ **60 MPa** základová spára, Edef,2/Edef,1 ≤ 2,5
- Edef,2 ≥ **45 MPa** zásyp
- TP 124 **stupeň 3** ochrana proti bludným proudům (proto Cl-0,4)

## 7. Bednění (důležité pro Phase 1 demo)

- **Pohledové** (dřík líc, římsa): **C2d** — vícevrstvé desky se strukturou dřeva, pečetící pryskyřice
- **Neviditelné** (rub, půdorys základu): **C1d**
- Hrany všech konstrukcí: zkoseny **15/15 mm**
- Třída přesnosti **10** dle TKP PK kap. 1

**Implication:** calculator pro `operne_zdi` musí umět rozlišit C1d/C2d a počítat pohledovou plochu zvlášť (1737 m² je vstup).

## 8. Co tento objekt **testuje** v kalkulátoru

| Test point | Co kalkulátor musí zvládnout |
|------------|------------------------------|
| Element type | `operne_zdi` nebo nový `zarubni_zed` (záleží na klasifikátoru — viz Q níže) |
| Multi-element rollup | 4 betony × 42 DC = 168 záběrů celkem (po dilatačních celcích) |
| Pohledová plocha | 1737 m² → C2d bednění → vyšší cena/náročnost |
| Lícový obklad | Žula 200-300 mm × 0,30 m × 1737 m² — toto NENÍ v current calculator scope |
| Resource ceiling | "12 lidí, 7 měsíců" — feasibility check |
| Zimní pauza | 42 DC nelze dokončit za jedno léto, calculator musí navrhnout etapizaci |

## 9. ⛔ Co tento objekt **NETESTUJE** (nemíchat scope)

- ❌ NENÍ to mostní římsa (i když má římsu navrchu) → mostní element rozhodování z handoff Q1 zůstává otevřeno
- ❌ NEMÁ pilíře, mostovku, ani předpětí
- ❌ NENÍ SmartExtractor regression test — to je deferred post-CSC per handoff

## 10. Otevřené otázky pro tebe

**Q-A: Klasifikace.** Chceš aby calculator klasifikoval `zárubní zeď` jako:
- **(a)** existing `operne_zdi` (konstrukčně podobné, výhoda — Phase 1 už funguje)
- **(b)** nový element type `zarubni_zed` (přesnější, ale +1 type → 24)

**Q-B: Co testovat první.**
- **(1)** Manual smoke test — zadat parametry SO 250 ručně, vidět co kalkulátor vrátí
- **(2)** Zlatý test scénář — uložit SO 250 jako 7. golden test (vedle VP4, SO-202, SO-203, SO-207)
- **(3)** Použít SO 250 jako vstup pro pitch deck demo (Layer-2 evidence "real ŘSD project")

**Q-C: Co s mostním elementem (handoff Q1).**
- (a) příčník | (b) MSS mostovka | (c) variable height pilíř | (d) Ø1200 pilota | (e) jiné — odložit

---

## 11. Inventář PDF v project knowledge

| Soubor | Stran | Stav |
|--------|-------|------|
| 250_01_Technická_zpráva.pdf | 13 | ✅ Plně přečteno |
| 250_02_Situace.pdf | 1 | ⚠️ Plán situace, nezpracováno (pro geo kontext) |
| 250_03_Vzorový_příčný_řez.pdf | 1 | ✅ Geometrie + materiály potvrzeno |
| 250_04_Rozvinutý_pohled.pdf | 1 | ⚠️ Dilatace 42 DC — vizuálně potvrdit |
| 250_05_Tvar_konstrukce.pdf | 1 | ⚠️ Souhrnný tvar |
| 250_06_Výztuž_konstrukce.pdf | 1 | ⚠️ Pro výpočet kg výztuže |
| 250_07_Detaily.pdf | 1 | ⚠️ Detail rohů, drenáží |
| 250_08_Statický_výpočet.pdf | 23 | ⛔ MIMO scope kalkulátoru (pro statika) |
| 250_08_Zábradlí.pdf | 1 | ⚠️ Pro doplnění (kompozitní 3-lankové, h=1,15) |

**Chybí:** 250_00_rozpiska_desky.pdf (nedodáno).

---

**Created:** 2026-05-14
**Branch suggestion:** žádný commit yet — toto je briefing, ne task.
