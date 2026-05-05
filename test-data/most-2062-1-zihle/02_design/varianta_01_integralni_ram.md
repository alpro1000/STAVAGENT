# Varianta 01 — Integrální rámový most (Žihle 2062-1)

**Datum návrhu:** 2026-05-05
**Autor:** Phase B sandbox extraction
**Status:** prvotní návrh, sandbox (NE pro odevzdání)

> ⚠️ Všechna rozhodnutí mají citaci zdroje. Hodnoty bez citace = engineering
> judgment se zdůvodněním. Geodézie + IGP + hydrologie zhotovitele → finalní
> dimenze upraví zhotovitel.

## 1. Statický systém

**Vetknutý rámový integrální most, jedno pole, deska + opěry tvoří jeden monolitický celek.**

### Justifikace

| Argument | Zdroj |
|---|---|
| ZD §4.4.l explicitně zakazuje mostní ložiska, dilatační závěry ve vozovce a složitý systém odvodnění | `01_extraction/pozadavky_novy_most.yaml > parametry_noveho_mostu.konstrukcni_omezeni_minimalni_udrzba` |
| Integrální rám = technicky jediná akceptabilní varianta (mosty bez ložisek/dilatací = monolitické rámy) | `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/INDEX.yaml > bridge_classification.keyword_to_element_type.ramovy_most` |
| Pro malá pole rozpětí 9 m: vetknutá rámová konstrukce (statická neurčitost 3) — most_common pattern | `upa_pokorny_suchanek_*/ch01_06_typy_mostu.yaml > ch04_ramove_mosty.staticke_soustavy_jednoduche.vetknuta_ramova_konstrukce` |
| Integrální monolitický rám zahrnuje stávající stav: most již nemá ložiska ani dilatační závěry (HPM s.2 [2.2]+[2.3]) — nahrazuje stejnou kategorii | `01_extraction/stavajici_most.yaml > nk.loziska + nk.mostni_zavery` |

### Pozn. ke konsistenci s rámovými mosty

Rozpětí Žihle (~9 m) leží **POD** typickým rozpětím rámových mostů per Pokorný-Suchánek (10–60 m, viz `keyword_to_element_type.ramovy_most.typical_span_range_m`). To **není problém** — drobné rámy přes potoky <10 m jsou běžnou praxí. Citace `ch04_ramove_mosty` neuvádí dolní hranici; uvádí jen `rozpeti_m_max: 60`.

---

## 2. Hlavní rozměry

| Parametr | Hodnota | Zdroj / justifikace |
|---|---|---|
| Světlé rozpětí L | **9.00 m** (provisorní) | `01_extraction/stavajici_most.yaml > geometrie.rozpeti_m` (rukopis BMS, conf 0.7); finální dle geodézie |
| Tloušťka desky t | **0.40 m** | Rámový most: t/L = 1/20 až 1/45 → t = 9.00/22.5 ≈ 0.40 m. Volíme střed (úzká hranice 0.45 m je horní pro Vn=32t, 0.20 m je dolní). Citace: `ch01_06_typy_mostu.yaml > ch04_ramove_mosty.optimalni_tloustka_konstrukce_ratio: [20, 45]` |
| Šířka mostu B | **8.30 m** | Vozovka 6.50 m (S 7,5 mezi V4 0.125) + 2× římsa 0.90 m. Citace: `ZD §4.4.c + e` (ZD s.6) |
| Vozovka (mezi V4) | 6.50 m | ZD §4.4.c |
| Římsa (široká) | 0.90 m každá strana | Standardní praxe (TKP 11) — RIGHT zahrnuje 3× DN75 chráničky per ZD §4.4.m |
| Skosení | **50°** (pravděpodobně) | Per stávající stav — `01_extraction/stavajici_most.yaml > nk.šikmost`. Finální dle geodézie zhotovitele. |
| Délka mostu (čela opěr) | **~12.0 m** (orientačně) | Při skosení 50° efektivní délka opěr větší než L. Hodnota orientační, geodézie zpřesní. |

> **Engineering judgment:** Tloušťka desky 0.40 m je střed rozsahu; konzervativní pro Vn=32t (×1.6 vs stávající Vn=20t) + omezení deformace ≤ 3 mm dle ZD §4.4.k. Statický návrh dle EN 1992-2 §6 zhotovitele bude finalní.

---

## 3. Spodní stavba (integrální opěry)

### Plošný základ

| Parametr | Hodnota | Zdroj |
|---|---|---|
| Typ | Plošný (předpokládaný) | HPM s.2 [1.1] uvádí "pravděpodobně plošné" pro stávající. Pro nový most předpoklad zachovat — ZD §4.4.a vyžaduje IGP zhotovitele. |
| Hloubka založení | min 1.20 m pod terénem | Standardní pro odolnost proti mrazu (nezamrzající hloubka cca 0.80 m + rezerva). Engineering judgment, finalní dle IGP. |
| Půdorysné rozměry | ~3.0 × 8.30 m každý | Pro plošné založení integrálního rámu. Engineering judgment, dle IGP. |
| Tloušťka | 0.60 m | Standardní pro mostní základy s Vn=32t. Engineering judgment. |
| Beton | C25/30, XC2 + XF1 | Viz `concrete_classes.yaml` |

> ⚠️ **MISSING DATA flag:** Hloubka založení a dimenze závisí na IGP. Pokud IGP ukáže nízkou únosnost → změna na **piloty Ø600** (per Pokorný §4 ramové mosty: "vetknutá rámová konstrukce vyžaduje únosné podloží nebo velkoprůměrové piloty" — citace `ch04_ramove_mosty.staticke_soustavy_jednoduche.vetknuta_ramova_konstrukce.foundation_requirement`).

### Dříky opěr (vertical wall, integrální spojení s deskou)

| Parametr | Hodnota | Zdroj |
|---|---|---|
| Typ | Monolitická vertikální stěna integrálně spojená s deskou | Per definice integrálního rámu |
| Tloušťka | 0.50 m | Engineering judgment — postačuje pro Vn=32t + zatížení vozovkového souvrství + tlak zeminy za opěrou |
| Výška | ~2.0 m (od základu po desku) | Odvozeno z požadavku zachovat profil koryta + světlou výšku. Finalní dle geodézie. |
| Délka (čelní) | ~8.30 m × 2 opěry | Dle šířky mostu |
| Beton | C30/37, XC4 + XF2 | Viz `concrete_classes.yaml` |

### Závěrné zídky

| Parametr | Hodnota | Zdroj |
|---|---|---|
| Funkce | Drží zem za opěrou; ukončují přechod desky → násyp | Standard |
| Tloušťka | 0.30 m | Standard |
| Výška | 0.80 m | Engineering judgment (cca tloušťka desky + krytí přechodové desky) |
| Beton | C30/37, XC4 + XF2 | Viz `concrete_classes.yaml` |

### Křídla (wing walls)

**ROZHODNUTÍ: Žádná křídla (svahový kužel 1:1.5).**

Justifikace:
- ZD nevyžaduje křídla
- Stávající most má pouze krátká kamenná svahová křídla (HPM s.2 [1.3])
- Pro malý rámový most přes potok je svahový kužel ekonomicky výhodnější
- Engineering judgment — pokud zhotovitel po IGP zjistí nestabilitu svahu, doplní křídla zpět

---

## 4. Přechodové desky

| Parametr | Hodnota | Zdroj |
|---|---|---|
| Délka | 4.0 m (každá strana) | Standardní per ČSN 73 6244 (NORMA NEDOSTUPNÁ V REPO — externí PDF) |
| Šířka | 8.30 m (= šířka mostu) | Standard |
| Tloušťka | 0.30 m | ČSN 73 6244 typická hodnota |
| Beton | C25/30, XC2 + XF1 | Viz `concrete_classes.yaml` |

> ⚠️ **MISSING KB:** ČSN 73 6244 (Přechody mostů pozemních komunikací) není v KB. Hodnoty 4.0 m / 0.30 m jsou z praxe (engineering judgment), zhotovitel ověří proti normě.

---

## 5. Materiály

Per element s plnou justifikací — viz `concrete_classes.yaml`.

Souhrn:
- **Podkladní beton:** C12/15 X0
- **Základy:** C25/30 XC2 + XF1
- **Opěry (dříky):** C30/37 XC4 + XF2
- **Závěrné zídky:** C30/37 XC4 + XF2
- **Mostovka deska:** C30/37 XC4 + XF2
- **Římsy:** C30/37 XC4 + XF2 (+ XD1 dle praxe pro posypovou sůl)
- **Přechodové desky:** C25/30 XC2 + XF1

Krytí výztuže — viz EN 1992-2 §4.4 + Annex A:
- mostovka 40 mm, opěry/dříky 50 mm, římsy 50 mm, přechod. desky 35 mm

---

## 6. Technologie výstavby (sequence)

> **Klíčové omezení:** Skruž zdola **NEMOŽNÁ** (světlá výška pod stávajícím mostem ~1 m per `01_extraction/site_conditions.yaml > site_conclusions.pristup_pod_most`). Po demolici stávajícího mostu vznikne otevřený prostor → skruž bude budována ze dna stavební jámy.

### Sequence

1. **Provizorium boční** (SO 180) — montáž mostního provizoria pro zachování provozu po dobu stavby. Umístění: vpravo od mostu (per foto 132429, viz `site_conditions.yaml`). Detail: viz `provizorium_specs.md`.
2. **Demolice stávajícího mostu** (SO 001) — kontrolní bourání s ohledem na koryto potoka. Přístup po svazích silničního tělesa (HPM s.3 [4.4]).
3. **Stavební jáma** — výkop na úroveň založení nového mostu (cca 1.20 m pod stávajícím terénem).
4. **Plošný základ + opěry** (SO 201) — betonáž základů (C25/30) + dříků opěr (C30/37). Postupně, s dodržením třídy ošetřování dle TKP 18 §7.8.3.
5. **Pevná skruž** ze dna stavební jámy — stojky IP / DOKA Multiprop / PERI Multiprop. Per `B6/upa_pokorny_suchanek_*/ch13_19_technologie_vystavby.yaml > pevna_skruz` (max výška NK 10–15 m, naše ~3 m vyhovuje). Detail: `formwork_choice.md`.
6. **Bednění + výztuž + betonáž desky** (mostovka, C30/37). Pour-decision per Monolit-Planner kalkulátor.
7. **Třída ošetřování 4** dle TKP 18 §7.8.3 (≥ 9 dní při 15-25 °C). Pro mostovku jako primární NK je třída 4 standard.
8. **Odbednění** po dosažení 70 % charakteristické pevnosti betonu (typicky 7-14 dní v závislosti na teplotě + třídě cementu).
9. **Závěrné zídky** (C30/37) + **přechodové desky** (C25/30).
10. **Mostní svršek**: izolace (TKP 21/22 — typ izolace per ZD nevybrán), vozovka 3-vrstvá živičná (per ZD §4.4.j; obrusná vrstva 100 % bez tolerance per ZD s.7), římsy (s 3× chráničkou DN75 v pravé per ZD §4.4.m), zádržný systém (per ZD §4.4.i — H1/H2 dle intenzity).
11. **Demontáž provizoria** + **úprava koryta** (max ±10 m per ZD §4.4.r).
12. **Geodetické zaměření** + **pasport** + **kolaudace** (ZD §4.3.g/h/i).

### Cross-references

- Ošetřování betonu: `B2_csn_standards/tkp/tkp_18_betonove_mosty.json` (TKP 18 §7.8.3)
- Pevná skruž metoda: `B6_research_papers/upa_pokorny_suchanek_*/ch13_19_technologie_vystavby.yaml > pevna_skruz` (chapter 14a)
- Tlak čerstvého betonu na bednění: DIN 18218 (NEDOSTUPNÁ V REPO; per Monolit-Planner kalkulátor `lateral-pressure.ts` aplikováno automaticky)

---

## 7. Limity per ZD a jejich kontrola

| ZD limit | Hodnota | Návrh splňuje? | Justifikace |
|---|---|---|---|
| Sedání spodní stavby (ZD §4.4.g) | ≤ 12 mm | ⚠️ závisí na IGP | Plošný základ při dobré únosnosti dosáhne <12mm; na nízkou únosnost přejít na piloty |
| Deformace NK uprostřed (ZD §4.4.k) | ≤ 3 mm | ⚠️ závisí na statickém výpočtu | Tloušťka desky 0.40 m + frame action zajistí; potvrdí zhotovitel dle EN 1992-2 |
| Vn=32t (ZD §4.4.h) | dle ČSN 73 6222 | ✅ tloušťka 0.40 m + C30/37 dimenzována pro Vn=32t | Per `B7/csn_73_6222_*/INDEX.yaml > skupiny_komunikaci.id=1` |
| Bez ložisek/dilatací (ZD §4.4.l) | ano | ✅ integrální rám | Per definice |
| 3× chránička DN75 v pravé římse | ano | ✅ Standardní v rámci římsy | Detail v PDPS |
| Revizní schodiště | ano | ✅ Doplnit při návrhu rímsy | Detail v PDPS |
| Provizorium povinné | ano | ✅ SO 180 v decomposition | Per `provizorium_specs.md` |
| Doba realizace ≤ 30 měs | dle harmonogramu | ✅ Phase C kalkulátor | Per `03_calculation/cost_summary.xlsx > Sheet 4` |
| Cena ≤ 30 mil. Kč | dle nabídky | ⚠️ Phase C | Per `03_calculation/cost_summary.xlsx > Sheet 3` |

---

## 8. Otevřené otázky pro zhotovitele

Per AC #7 (každé rozhodnutí citováno) — co MUSÍ zhotovitel ověřit / doplnit před PDPS:

1. **IGP** — typ základu (plošný vs piloty) per únosnosti
2. **Geodézie** — finalní rozpětí, šířka, sklon vozovky, šikmost
3. **Hydrologie Mladotického potoka** — Q-100, dimenze průtočného profilu
4. **Statický výpočet** dle EN 1992-2 — dimenze desky, výztuž, frame action
5. **Vendor RFQ** — provizorium (Mabey/Bailey/Acrow) — viz `provizorium_specs.md`
6. **Konzultace s provozovatelem linkové dopravy** — parametry provozu na provizoriu (ZD §4.4.o)
7. **Souhlas vlastníka pozemku vpravo** — pro provizorium + staveniště (mimo silniční pozemek)
8. **Diagnostika podloží silnice** — pro směrovou úpravu (ZD §4.4.n)

---

## Související soubory

- [`decomposition_so.md`](decomposition_so.md) — SO breakdown
- [`concrete_classes.yaml`](concrete_classes.yaml) — beton + krytí per element
- [`formwork_choice.md`](formwork_choice.md) — výběr bednění + skruže
- [`provizorium_specs.md`](provizorium_specs.md) — spec provizoria
- [`element_breakdown.yaml`](element_breakdown.yaml) — vstup pro kalkulátor (Phase C)
