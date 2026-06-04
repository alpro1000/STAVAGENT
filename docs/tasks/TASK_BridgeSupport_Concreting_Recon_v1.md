# TASK: Betonáž mostních podpěr (opěra / pilíř) — záběry, četa, výběr bednění

> **Verze:** v1
> **Datum:** 2026-06-03
> **Priorita:** P1 (zvýšit na P0, pokud Cemex 28.06 je mostní objekt)
> **Affects:** classify_construction_element + ELEMENT_TYPES + create_work_breakdown + calculator (záběry/četa/bednění) + KB B4/B5
> **Reference real case:** SO 202 Most přes Lomnický potok (D6), SO 203, SO 207 estakáda — golden testy už v repu

-----

## Mantra

> Nejdřív přečti celý repo. Pojmenování urči z existujících konvencí kódu. Nevytvářej paralelní strukturu.
> Recon první. Nic neměň. Ukaž zjištění. Čekej na potvrzení. Teprve potom kód.

-----

## Proč tento task vznikl (problém hlášený uživatelem)

Uživatel (rozpočtář, specializace mosty) hlásí dvě věci k ověření:

1. **Klasifikace plete opěru s pilířem.** Holé „dřík" se možná klasifikuje jako dřík pilíře, i když jde o dřík opěry. Opěra (krajní podpěra u násypu) a pilíř (mezilehlá podpěra) jsou **různé konstrukce** s různou geometrií, výztuží a bedněním. Jejich dříky nejsou zaměnitelné.
2. **Opěra je víceprvková.** Skládá se ze základu, dříku, závěrné zídky, křídel a úložného prahu. Nesmí se zhroutit do jednoho prvku (a zejména ne do „dřík pilíře").

Sekundárně: ověřit, zda systém u podpěr správně počítá rozdělení na záběry, velikost čety a výběr bednění — a zda **nemíchá bednicí systémy různých výrobců** v rámci jednoho prvku.

-----

## RECON HOTOVO (2026-06-03) — bug potvrzen empiricky

Recon prokázal spuštěním kódu:
- `classify("dřík opěry", bridge)` == `classify("dřík pilíře", bridge)` == `driky_piliru` (rebar 150 místo správných ~130). **Bug potvrzen.**
- **Kořen:** normalizer `element_name_normalizer.py`, `_canonical_head` blok 3 (řádky ~145–148) — v bridge kontextu přepíše JAKÝKOLI „dřík" na „dřík pilíře", signál „opěr" zahodí. **NE keyword tabulka** — oprava keyword pravidel by bug neopravila.
- Bug **odporuje vlastnímu docstringu** klasifikátoru (ř. 347: `'Dřík opěry OP1' → opery_ulozne_prahy`). Tedy poškození, ne záměr.
- **Dva sousední bugy ve stejném uzlu:** `křídlo opěry` → `opery_ulozne_prahy` (chamtivé pravidlo ř. 227, má být `kridla_opery`); `závěrná zídka` → `jine` conf 0.3 (nemá typ ani pravidlo).
- Rimsa bugem NEzasažena (samostatný uzel).

## ROZHODNUTÍ (Alexander, 2026-06-03): varianta B — bohatá

Opěra je víceprvková → samostatné typy, NE slévání do `opery_ulozne_prahy`:
- Nový typ pro **dřík opěry** (vlastní rebar/bednění/difficulty — hodnoty potvrdí uživatel/golden, NEhádat).
- Nový typ pro **závěrnou zídku** + keyword pravidlo.
- Oprava chamtivého pravidla pro **křídlo opěry** → `kridla_opery`.
- Oprava v kořeni: normalizer blok 3 zkontroluje „opěr" PŘED bridge-defaultem, ne keyword tabulka.
- Red→green golden testy na každou část (jako W3); plný regresní běh, aby změna normalizeru nesdvihla klasifikaci jiných elementů.
- **Pozor:** rebar/bednění/difficulty per část = doménové hodnoty od uživatele/golden, ne odhad.

> **Závislost:** tato oprava (T1) běží AŽ PO T0 baseline auditu — aby zásah do normalizeru proběhl se znalostí celé klasifikační mapy a nesdvihl jiné elementy.

-----

## REFERENCE — domain fakta (z odborné literatury, jako podklad, NE k slepému přepisu)

Toto je orientační rámec ověřený z odborných zdrojů (učebnice Betonové mosty II, Dopravní fakulta Jana Pernera UPCE; ČSN 73 0042 / DIN 18218; případové studie ASB / iMateriály / silnice-železnice; PERI / Doka). Slouží Claude Code jako kontext k posouzení správnosti, NE jako hodnoty k natvrdo zapsání. Skutečné hodnoty pro testy ber z golden testů v repu.

**Dekompozice spodní stavby:**
- **Opěra:** základ → dřík opěry → závěrná zídka → křídla → úložný práh. Pět samostatných částí, různé bednění/výztuž.
- **Pilíř:** základ → dřík pilíře → hlavice / úložný práh. Geometrie a bednění odlišné od opěry.
- Dřík opěry ≠ dřík pilíře. Klasifikace „dřík" bez znalosti rodiče (opěra/pilíř) je chyba.

**Záběry (svislé takty):**
- Vysoké podpěry/pilíře se betonují po svislých záběrech, typicky ~4–5 m na záběr (limitováno tlakem čerstvého betonu a bednicím systémem).
- Zárodek nad podpěrou se často dělí na samostatné takty (např. dno / stěny / horní deska).
- Samošplhací bednění je ekonomické zhruba od deseti záběrů výše; pod tím se používá jeřábem překládané rámové/nosníkové bednění.

**Výběr bednění — řízeno:** výškou prvku (jednorázové vs. šplhací), tvarem průřezu, požadavkem na pohledový beton a tlakem čerstvého betonu (ČSN 73 0042 / DIN 18218: tlak roste s rychlostí stoupání betonu, klesá s teplotou).

**Četa:** odvozená z objemu záběru a tempa betonáže (betonáři + železáři + tesaři/bednáři + obsluha jeřábu/čerpadla), NE konstantní číslo. Hmotnost pracovníků na bednění vstupuje do zatížení formy.

**Pravidlo jednoho výrobce (DŮLEŽITÉ):**
- Není to zákonný zákaz, ale reálné inženýrské omezení: spojovací kování (zámky panelů, táhla, šplhací lišty) je u různých výrobců nekompatibilní; tabulky únosnosti a tlaku čerstvého betonu jsou systémově specifické (každý výrobce ručí za svůj systém); montáž dle návodu výrobce — smíchání nesertifikované kombinace ruší jeho záruku → bezpečnost.
- ⇒ Systém má vybírat **jeden bednicí systém jednoho výrobce na prvek / bednicí sestavu**. Míchat panely různých výrobců v JEDNOM prvku je chyba.
- ⚠️ Nuance: různým PRVKŮM stavby smí systém přiřadit různé systémy (pilíř šplhací PERI, opěra rámová Doka — to je v pořádku). Zákaz se týká míchání UVNITŘ jednoho prvku, ne mezi prvky.

-----

## PRE-IMPLEMENTATION INTERVIEW — Fáze A (recon, povinné, STOP před jakýmkoli kódem)

Claude Code skenuje repo a vrátí markdown report. **Nic nemění.** Po reportu STOP a čeká na review.

### A1 — Klasifikace dříku (ověř hlášenou chybu)
- Jak `classify_construction_element` / ELEMENT_TYPES zpracovává řetězec „dřík"? Podle jakých pravidel mapuje na typ pilíře?
- Bere v úvahu rodiče (opěra vs pilíř)? Reprodukuj a ukaž skutečný výstup pro: klasifikaci „dřík opěry" s kontextem objektu = most, a klasifikaci „dřík pilíře" s kontextem objektu = most. Vrací stejný typ (= potvrzená chyba) nebo různé?
- Existují v ELEMENT_TYPES samostatné typy pro opěru a její části (dřík opěry, závěrná zídka, křídla, úložný práh, základ opěry), nebo se vše slévá?

### A2 — Dekompozice opěry + samostatné etapy + běh po částech
- `create_work_breakdown` pro opěru: vrací rozklad na části (základ / dřík / závěrná zídka / křídla / úložný práh), nebo jediný řádek?
- Mapuje se počet ELEMENT_TYPES na počet WORK_TEMPLATES, nebo je tam drift (víc typů než šablon)? Které části opěry NEMAJÍ vlastní šablonu?
- **Etapy:** závěrná zídka se betonuje v JINÉ etapě než dřík opěry (potvrzeno uživatelem z praxe). Modeluje calculator části opěry jako samostatné etapy se svým bedněním/výztuží/harmonogramem, nebo je slévá do jednoho objemu? Slévání opěra+závěrná zídka je chyba.
- **Běh po částech (hlavní hodnota):** umí agent/orchestrator vzít víceprvkovou opěru, rozložit ji na jednotlivé části, spočítat KAŽDOU samostatně a výsledky agregovat — bez ručního zadávání každé části zvlášť? (V běžném kalkulátoru to uživatel dělá ručně = pomalé.) Existuje k tomu primitiv (atomic_calculate / composable) nebo plánovaný task? Pozn.: pokud existuje `TASK_MCP_Composable_Agent_Layer_v1.md`, NEduplikovat — odkázat na něj a jen ověřit, zda pokrývá dekompozici podpěr.

### A3 — Záběry a četa
- Kde a jak calculator rozděluje svislou podpěru na záběry? Existuje vůbec logika svislých taktů, nebo se podpěra počítá jako jeden objem?
- Jak se odvozuje velikost čety — z objemu/tempa, nebo konstanta? Kde je to v kódu (resource-ceiling / orchestrator)?
- Bere se v úvahu tlak čerstvého betonu / rychlost stoupání při omezení výšky záběru?

### A4 — Výběr bednění a pravidlo jednoho výrobce
- Jak se vybírá bednicí systém pro podpěru/pilíř? Je tam vazba na výšku (šplhací vs jednorázové), tvar, tlak?
- Může současný výběr vrátit kombinaci panelů/komponent od víc výrobců v rámci jednoho prvku? Je někde uplatněno pravidlo „jeden výrobce na prvek"?
- Co je v KB: které bednicí systémy pokrývá `B5_tech_cards` (PERI / Doka), a které svislé / šplhací systémy chybí pro podpěry?

### A5 — KB pokrytí (B4 / B5)
- `B4_production_benchmarks/default_ceilings/`: mají dřík opěry, dřík pilíře, závěrná zídka, úložný práh, křídla své defaults, nebo padají na auto-derived?
- `B5_tech_cards`: existují tech karty pro svislé/šplhací bednicí systémy podpěr (např. rámové stěnové, nosníkové, šplhací)?

### A6 — Golden testy (inventář, bez čtení test-data vstupů)
- Které golden testy pokrývají podpěry: SO-202 (Most přes Lomnický potok), SO-203, SO-207 (estakáda)? Jaké prvky podpěr a jaké třídy betonu očekávají (dříky pilířů, opěry, úložné prahy, římsy)?
- Mapuj, který test je vhodný jako referenční pro „opěra víceprvková" a který pro „dřík pilíře vs dřík opěry".
- (Pozor R1: vstupy v `test-data/**` lokálně nečíst. Ground-truth ber z golden fixtures v `tests/`, ne ze vstupních PDF/DXF.)

### A7 — Filozofie kalkulátoru + existující logika výpočtu bednění
- Najdi a shrň `CALCULATOR_PHILOSOPHY.md` (a `calculator_element_logic_v4_FINAL.md`, `calculator_complete_pipeline.md`) — jaké principy platí pro orientační výpočet bednění? Jeden ze směrů kalkulátoru je právě přibližný výpočet bednění — co už k tomu existuje?
- Jak dnes calculator počítá bednění (plocha, počet sad / obrátkovost, produktivita montáž/přesun/odbednění)? Kde jsou tyto normy — v kódu natvrdo, nebo v `B5_tech_cards`?
- **Sverka s normami:** je výpočet vázán na tlak čerstvého betonu podle ČSN 73 0042 / DIN 18218 (tlak vs rychlost stoupání vs teplota), nebo to ignoruje? Omezuje tlak výšku záběru?

### A8 — Inventář dat Doka / PERI (repo + Google Drive) — INVENTÁŘ, ne ingesce
- Uživatel má hodně podkladů k bednění Doka a PERI v knowledge a v Google Drive / cloud storage. Cíl této fáze je **zjistit co existuje a kde**, NE to teď celé zpracovat.
- V repu: co je v `B5_tech_cards/formwork_vendor/` (doka / peri) — které systémy, jaké hodnoty (produktivita, únosnost, tlakové tabulky)?
- V Google Drive: udělej INVENTÁŘ souborů Doka/PERI (katalogy, nabídky, tlakové tabulky, montážní návody) — názvy, formáty, hrubý objem. Nestahuj a neparsuj vše.
- Výstup: seznam zdrojů + doporučení, zda systematizaci napojit na existující KB pipeline (tří­průchodový extraktor do `B5`), nebo zda je to samostatný task. **Ingesci/systematizaci NEDĚLAT v tomto tasku** — je to vlastní effort (viz Mimo rozsah).

-----

## Výstup Fáze A (co ukázat před review)

Markdown report:
1. **Potvrzení/vyvrácení chyby klasifikace** — skutečné výstupy classify pro dřík opěry vs dřík pilíře, se závěrem (plete / neplete).
2. **Stav dekompozice opěry** — rozkládá / nerozkládá; modeluje samostatné etapy (závěrná zídka vs dřík); umí běh po částech nebo jen ručně.
3. **Stav záběrů / čety / výběru bednění** — existuje logika, nebo chybí; míchá výrobce / nemíchá.
4. **Filozofie + výpočet bednění** — co říká CALCULATOR_PHILOSOPHY, jak se počítá bednění, je vázáno na tlakovou normu ČSN 73 0042/DIN 18218 nebo ne.
5. **Inventář Doka/PERI** — co je v repu (B5) a co v Google Drive; doporučení napojení (existující KB pipeline vs samostatný task).
6. **KB gapy** — chybějící B4 defaults a B5 tech karty pro části podpěr.
7. **Golden test mapping** — který test pokrývá co.
8. **Doporučení rozsahu implementace** — co opravit teď (P0/P1) a co odložit. NEIMPLEMENTOVAT v této fázi.

**STOP. Čekej na review. Teprve po potvrzení rozsahu se píše kód.**

-----

## Kritéria přijetí (pokračování GLOBÁLNÍHO počítadla)

> Najdi v repu poslední použité číslo kritéria a pokračuj od něj (NEhádej). Čísla níže jsou placeholdery `#N…` — nahraď skutečnými.

- `#N` — classify rozlišuje dřík opěry od dřík pilíře (s kontextem objektu = most vrací různé typy, ne stejný).
- `#N+1` — opěra se v breakdown rozkládá na své části (základ, dřík opěry, závěrná zídka, křídla, úložný práh), neslévá se do jednoho prvku ani do pilíře.
- `#N+2` — svislá podpěra se dělí na záběry; výška záběru je odvozená (ne pevná), velikost čety odvozená z objemu/tempa.
- `#N+3` — výběr bednění vrací JEDEN systém jednoho výrobce na prvek; test pokrývá, že se nemíchají výrobci uvnitř jednoho prvku (a že různé prvky smí mít různé systémy).
- `#N+4` — chybějící B4 defaults / B5 tech karty pro části podpěr doplněny (pokud review potvrdí rozsah), s source attribution.
- `#N+5` — výpočet bednění podpěry je vázán na tlakovou normu (ČSN 73 0042 / DIN 18218): výška záběru / rychlost stoupání respektuje tlakový limit, ne libovolná konstanta. Ověřeno proti golden testu (SO-202 nebo SO-207).
- `#N+6` — běh po částech: orchestrator/agent rozloží víceprvkovou opěru a spočítá části samostatně + agreguje, bez ručního zadávání každé části (nebo: ověřeno, že to pokrývá composable-layer task).
- `#N+7` — regrese: všechny golden testy podpěr (SO-202/203/207) zelené; žádný dosavadní test nespadne.

-----

## Mimo rozsah (nedělat v tomto tasku)

- **Systematizace/ingesce dat Doka/PERI z Google Drive** — v tomto tasku jen INVENTÁŘ (A8). Vlastní zpracování do KB napojit na existující KB pipeline jako samostatný effort.
- **Composable agent layer** (běh po částech jako primitiv) — pokud existuje `TASK_MCP_Composable_Agent_Layer_v1.md`, patří tam; zde jen ověřit pokrytí, neduplikovat.
- Letmá betonáž / vozíky / výsuvná skruž jako samostatný výpočetní modul.
- Statický přepočet podpěr.
- Ocenění ložisek, mostních závěrů, izolací — samostatné položky.
- Plný DXF takeoff podpěr z výkresů (řeší DXF větev).

-----

## Naming rule

> Pojmenování a strukturu urči z existujících konvencí repa. Nevytvářej paralelní strukturu, nevymýšlej nové cesty / názvy proměnných / tabulek / tříd. Nejdřív přečti celý repo, ukaž zjištění Fáze A, počkej na potvrzení, teprve pak kód.

**Confidence:** 0.8 — domain rámec ověřen z odborných zdrojů; skutečné chování systému a rozsah opravy se potvrdí až reconem (Fáze A).
