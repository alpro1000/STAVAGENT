# KOMPLETNI KATALOG MONOLITICKYCH ZB PRVKU — STAVAGENT kalkulator

**Verze:** 1.0
**Datum:** 2026-04-02
**Ucel:** Reference pro technologii kazdeho prvku + rozhodnuti co pridat do kalkulatoru

---

## LEGENDA

| Zkratka | Vyznam |
|---------|--------|
| **H** | Horizontalni (vodorovna) |
| **V** | Vertikalni (svisly) |
| **vyztuz** | Index vyztuzeni v kg/m3 |
| **bedneni** | Hlavni typ opalubkoveho systemu |
| **zabery** | Zda se betonuje po zaberech |
| **pump** | Zda typicky potrebuje cerpadlo |
| **podpery** | Zda potrebuje podpernou konstrukci (stojky/skruz) |

---

## A. POZEMNI STAVBY — ZAKLADY (4 typy)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 1 | **Zakladova deska** | H | 80-100 | Obvodove (minimalni) | Ne (cela plocha najednou) | Ano (vzdy) | Ne | BEZ PRERUSENI! Vibracni lista + hladicka. Dilatacni rezy 24-48h. Hydroizolace pod deskou. |
| 2 | **Zakladovy pas** | H/V | 50-80 | Ramove / tradicni | Ne (po usecich OK) | Ne (vysyp/zlab) | Ne | Jednoduchy, do vykopu. Casto jednostranne bedneni. |
| 3 | **Zakladova patka** | V | 80-120 | Ramove / tradicni | Ne | Ne (vysyp/badie) | Ne | Obratkovost! 10-50 stejnych. Kose predem. Kalichy pro prefab. sloupy. |
| 4 | **Zakladovy rost** | H/V | 60-100 | Ramove / tradicni | Ne | Zavisi na objemu | Ne | Mriz pasu. Technologicky = zakladovy pas, ale krizeni vyzaduje pozor. |

## B. POZEMNI STAVBY — SVISLE KONSTRUKCE (5 typu)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 5 | **Monoliticka stena** | V | 40-80 | Stenove (Framax/TRIO) | Ano (>3m vysky) | Ano (>3m) | Ne | Oboustranne/jednostranne. Lateral pressure! Vlozky (otvory, pruchody IS). |
| 6 | **Sloup** | V | 150-200 | Sloupove (SL-1/kruhove) | Ne (do 6m) | Zavisi | Ne | Maly prurez, husta vyztuz. Max pad 1.5m. Kruhovy -> x1.5 montaz. |
| 7 | **Operna zed (pozemni)** | V | 60-100 | Stenove | Ano (po usecich 10-20m) | Ano | Ne | Jednostranne (k zemine). Hydroizolace rubove strany. Odvodneni za zdi. |
| 8 | **Podzemni stena (milanska)** | V | 80-120 | Zadne (hloubeno v jilu) | Lamely 0.6-1.5m sirky | Trubkou (tremie) | Ne | Specialni: vykop v bentonitove suspenzi -> armovaci kos -> betonaz pod suspenzi. Bez klasickeho bedneni! |
| 9 | **Pilota / mikropilota** | V | 30-60 | Zadne (zemina) | Ne (pilota = 1 zaber) | Trubkou | Ne | Vrtani -> kos -> betonaz. SCC/S4. Hlavice = patka. |

## C. POZEMNI STAVBY — VODOROVNE KONSTRUKCE (5 typu)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 10 | **Stropni / podlahova deska** | H | 80-120 | Stropni (Dokaflex/Skydeck) | Ne (cela plocha) | Ano | **Ano (stojky!)** | Podperne stojky + nosniky + preklizka. Reshore (ponechani stojek po odbedneni). Pruvlaky soucasne. |
| 11 | **Pruvlak / tram** | H | 120-180 | Stropni + boky | Ne | Ano | **Ano (stojky)** | Soucast stropu. Husta vyztuz. Betonaz spolecne s deskou. |
| 12 | **Schodiste** | sikme | 100-150 | Tradicni (vzdy!) | Ne | Male objemy -> badie | **Ano (stojky)** | 3D geometrie, sikma deska + stupne. Vzdy tradicni bedneni (custom). Slozita armatura. |
| 13 | **Konzola / balkon** | H | 120-160 | Stropni + celni | Ne | Ano | **Ano (podpery!)** | Vykonzolovana deska. ISO nosnik (tepelny most). Podpery zustavaji dlouho (velke momenty). |
| 14 | **Venec** | H | 40-60 | Tradicni (rezivo) | Ne (po celem obvodu) | Ne (male objemy) | Ne | Obvodovy prvek na korune zdiva. Maly prurez (~0.25x0.25m). Jednoduche armovani. Ztuzujici funkce. |

## D. POZEMNI STAVBY — SPECIALNI (4 typy)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 15 | **Nadrz / jimka / bazen** | H+V | 80-120 | Stenove + dno | Steny po zaberech | Ano | Ne | Vodonepropustny beton (bila vana). Tesnene spary. Min. tl. 300mm. Max trhlina 0.2mm. |
| 16 | **Prumyslova podlaha** | H | 30-60 (dratky) | Obvodove (minimalni) | Sachovnicove pole 6x6m | Ano (vzdy) | Ne | Dratkobeton nebo sitova vyztuz. Strojni hlazeni (power trowel). Dilatacni rezy. Velke plochy (100-5000 m2). |
| 17 | **Podkladni beton** | H | **0 (prosty!)** | **Zadne** | Ne | Ne (vysyp) | Ne | C8/10-C16/20. Prosty beton BEZ vyztuze. Tl. 50-150mm. Primo do vykopu/na podlozi. Minimalni vypocet: objem x cena = hotovo. |
| 18 | **Strikany beton (torkret)** | V/sikme | 50-100 (site) | **Zadne** | Po vrstvach 30-50mm | Strikaci stroj | Ne | Specialni stroj (suche/mokre torketovani). Svahovani, sanace, tunely. Bez klasickeho bedneni. |

## E. MOSTNI PRVKY — SPODNI STAVBA (5 typu)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 19 | **Zaklady piliru** | H | 80-120 | Ramove | Ne | Ano | Ne | Masivni. Jako zaklad (deska/patka) ale v mostnim kontextu. |
| 20 | **Driky piliru** | V | 120-180 | Stenove / splhaci / kruhove | Ano (>6m -> splhaci) | Ano | Ne | Stihle, vysoke. Lateral pressure -> auto-filtr. Max pad 1.5m. Geodezie po kazdem zaberu. |
| 21 | **Opery, ulozne prahy** | V | 80-120 | Stenove | Ano (zabery 1.5-3m) | Ano | Ne | Masivni. Kotvy pro loziska (+/-2mm). Kridla (sikme). Rubova izolace. |
| 22 | **Operne zdi (mostni)** | V | 60-100 | Stenove | Ano (po usecich) | Ano | Ne | Gravitacni nebo uhlove. Zavisi na vysce. |
| 23 | **Pilota (mostni)** | V | 30-60 | Zadne | Ne | Trubkou | Ne | Jako pozemni pilota ale vetsi O (900-1500mm), delka 15-30m. |

## F. MOSTNI PRVKY — NOSNA KONSTRUKCE (3 typy)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 24 | **Mostovkova deska** | H | 80-130 (B500B) + 25-40 (predpinaci) | Preklizka na skruzi | Cele pole / dilatace | Ano (MEGA!) | **Ano (SKRUZ!)** | Nejslozitejsi. Pevna skruz / vysuvna / letma. Predpeti po zrani. Dve faze (tramy+deska). MEGA pour >=500m3. |
| 25 | **Pricnik (rigel)** | H | 120-160 | Specialni (v prurezu NK) | Soucast NK nebo samostatne | Ano | **Ano (skruz)** | Pricne ztuzeni mostovky. Betonaz s NK nebo po ni. |
| 26 | **Predpjaty nosnik** | H | 80-130 + 25-40 (lana) | Ocelova forma (prefab) NEBO na skruzi | Na skruzi: cele pole | Ano | **Ano** | Predpeti = klicova operace. B500B + Y1860S7 ODDELENE. Napinani -> injektaz -> odriznuti. |

## G. MOSTNI PRVKY — SVRSEK (4 typy)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 27 | **Rimsa** | H | 120-180 | Rimsove konzoly / vozik | **Vzdy! (20-30m)** | Ano (shora) | **Ne (konzoly na NK!)** | Po mostovce + predpeti. XF4+XD3. Male objemy (1-4 m3/zaber). 2 takty/tyden. |
| 28 | **Zaverne zidky** | V | 60-100 | Tradicni / ramove | Ne (male) | Male objemy | Ne | Tenka stenka na opere. Jednoducha. |
| 29 | **Prechodova deska** | H | 80-100 | Obvodove | Ne | Zavisi na objemu | Ne | Na rozhrani most/nasyp. Sikma. Specificke ulozeni. |
| 30 | **Mostni lozyskove bloky** | -- | 60-80 | Tradicni | Ne | Ne (male) | Ne | Presne osazeni kotev. Male objemy. Geodezie. |

## H. INZENYRSKE STAVBY (3 typy)

| # | Prvek | Orient. | Vyztuz kg/m3 | Bedneni | Zabery | Pump | Podpery | Klicova technologie |
|---|-------|---------|-------------|---------|--------|------|---------|---------------------|
| 31 | **Tunel / osteni** | klenbovy | 80-140 | Ocelova skruz (posuvna) | **Vzdy! (po prstencich 10-12m)** | Ano (za bedneni) | **Ano (skruz = bedneni)** | Specialni: ocelova posuvna skruz = bedneni i podpera. Betonaz za skruz (shora, po stranach, do klenby). SCC pro klenbu. 2 prstence/tyden. |
| 32 | **Propustek** | H+V | 60-100 | Ramove / tradicni | Dno -> steny -> strop | Zavisi | Ne | Jednoduchy ramovy prurez (maly most). Deska + 2 steny + strop. 4 faze betonaze. |
| 33 | **Retencni nadrz / vodojem** | H+V | 80-120 | Stenove + dno | Steny po zaberech | Ano | Ne | Vodonepropustny (bila vana). Velke objemy. Kruhovy nebo pravouhly. |

---

## TECHNOLOGIE KTERE NEJSOU TYP ELEMENTU (property/flag)

| Technologie | Co to je | Jak v kalkulatoru | Na ktere elementy |
|-------------|----------|-------------------|-------------------|
| **Bila vana** | Vodonepropustny beton + tesnene spary | Flag `waterproof: true` -> jine spary, delsi osetreni (min 7d, odbedneni 36h), max trhlina 0.2mm | Zakl. deska, stena, nadrz, tunel |
| **SCC (samozhutnitelny)** | Beton bez vibrovani | Flag `self_compacting: true` -> zadna vibrace, rychlejsi, drazsi | Piloty, huste armovani, tunel klenba |
| **Dratkobeton** | Beton s ocelovymi vlakny misto vyztuze | Flag `fiber_reinforced: true` -> jiny index, bez vazani (jen vlakna ve smesi) | Prum. podlahy, strikany beton |
| **Pohledovy beton** | Specialni kvalita povrchu | Flag `exposed_concrete: true` -> prisnejsi bedneni, bez kaverny | Steny, sloupy, schodiste |
| **Predpeti** | Predpinaci lana Y1860 | Flag `prestressed: true` -> operace napinani + injektaz v harmonogramu | Mostovka, nosniky, desky |
| **Zimni betonaz** | Teploty < 5C | Flag `winter: true` -> ohrev, zatepleni, prodlouzeni zrani | Vsechny |

---

## SROVNANI: STAVAJICI vs. NAVRHOVANY KATALOG

### Co UZ MAME (21 typu):

```
POZEMNI (11):
  Zakladova deska            Schodiste
  Zakladovy pas              Nadrz / jimka / bazen
  Zakladova patka            Podzemni stena (milanska)
  Stropni / podlahova deska  Pilota / mikropilota
  Monoliticka stena
  Sloup
  Pruvlak / tram

MOSTNI (9 + Jiny typ):
  Zaklady piliru              Rimsa
  Driky piliru                Pricnik (rigel)
  Operne zdi                  Opery, ulozne prahy
  Mostovkova deska            Zaverne zidky
  Prechodova deska
```

### Co PRIDAT (doporuceni):

| Prvek | Priorita | Skupina | Proc |
|-------|----------|---------|------|
| **Venec** | VYSOKA | Pozemni | Velmi casty, jednoduchy, maly prurez |
| **Prumyslova podlaha** | VYSOKA | Pozemni | Jina technologie (dratky, hlazeni, pole) |
| **Podkladni beton** | STREDNI | Pozemni | Casta pozice v smetach, zjednoduseny vypocet |
| **Konzola / balkon** | STREDNI | Pozemni | Specificke podpery, ISO nosnik |
| **Operna zed (pozemni)** | STREDNI | Pozemni | Oddelit od mostni operne zdi |
| **Tunel / osteni** | STREDNI | Inzenyrske | Specialni technologie, velke projekty |
| **Propustek** | NIZKA | Inzenyrske | Jednoduchy, jako ram |
| **Retencni nadrz** | NIZKA | Inzenyrske | Pokryva "Nadrz" v pozemnich |
| **Predpjaty nosnik** | NIZKA | Mostni | Pokryva "Mostovkova deska" s flag prestressed |

### CELKEM po doplneni: 21 + 6 novych = **27 typu** (+ properties)

Nebo minimalne: **21 + 3 = 24 typu** (Venec, Prumyslova podlaha, Podkladni beton)

---

## GRUPOVANI V DROPDOWN UI

```
Pozemni stavby -- Zaklady
  Zakladova deska
  Zakladovy pas
  Zakladova patka
  Pilota / mikropilota

Pozemni stavby -- Svisle
  Monoliticka stena
  Sloup
  Operna zed
  Podzemni stena (milanska)

Pozemni stavby -- Vodorovne
  Stropni / podlahova deska
  Pruvlak / tram
  Venec                         <- NOVY
  Konzola / balkon              <- NOVY
  Schodiste

Pozemni stavby -- Specialni
  Nadrz / jimka / bazen
  Prumyslova podlaha            <- NOVY
  Podkladni beton               <- NOVY
  Strikany beton (torkret)      <- NOVY (byl "other")

Mostni prvky -- Spodni stavba
  Zaklady piliru
  Driky piliru
  Opery, ulozne prahy
  Operne zdi

Mostni prvky -- Nosna konstrukce
  Mostovkova deska
  Pricnik (rigel)

Mostni prvky -- Svrsek
  Rimsa
  Zaverne zidky
  Prechodova deska

Inzenyrske stavby
  Tunel / osteni                <- NOVY
  Propustek                     <- NOVY (volitelne)

Jiny typ
```

---

## DALSI KROKY

Pro kazdy novy typ (Venec, Prumyslova podlaha, Podkladni beton, Konzola, Operna zed pozemni, Tunel) bude potreba:
1. Profil v element-classifier (difficulty, rebar, formwork, flags)
2. Keywords pro autoklasifikaci
3. Specificke warnings
4. Test case z realneho projektu

Toto je referencni dokument. Implementace po schvaleni rozsahu.
