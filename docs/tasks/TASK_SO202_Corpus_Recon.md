# TASK: SO202 corpus — enumerate, classify, parse, recon (Core Engine, RECON ONLY)

## MANTRA
Než cokoliv napíšeš: přečti relevantní části repa (Core Engine document pipeline — parsery/rozpoznávání typů dokumentů, ne kalkulátorový browser-parser). **Tento task NEMĚNÍ produkční kód a NEPÍŠE golden testy.** Výstup = jeden recon dokument. Golden testy jsou samostatný, navazující task (gated na revizi tohoto reconu).

## KONTEXT
Kompletní sada dokumentů mostu SO202 (D6 Olšová Vrata – Žalmanov, přes Lomnický potok) je nahrána v `test-data/SO_202_D6_OV_Z/`. Než postavíme golden testy a opravíme parsery, potřebujeme deterministicky vědět, **co tam je** a **co současné parsery z toho vytáhnou**. Psát golden testy teď = zabetonovat současné chyby jako „etalon" (parsery mají známé chyby). Proto: nejdřív recon.

**Pozor — toto je Core Engine pipeline, NE kalkulátorový browser-parser „Text z TZ"** (ten řeší samostatný audit kalkulátoru).

## PRE-IMPLEMENTATION INTERVIEW
Než začneš, zeptej se (AskUserQuestion) na to, co není z repa jednoznačné. Minimálně:
1. Které parsery Core Engine jsou autoritativní pro které typy dokumentů (TZ, soupis/rozpočet, výkres, statický výpočet)?
2. Jaký je vstupní bod pro spuštění rozpoznání typu + extrakce na jednom souboru?
3. Jak se dnes ukládá/reprezentuje výsledek extrakce (aby šel porovnat napříč dokumenty)?

## CÍL — 3 RECON VÝSTUPY (popisné, „jak to JE")

### Výstup 1 — Inventář a klasifikace složky
Projdi `test-data/SO_202_D6_OV_Z/`. Pro každý soubor: název, formát, velikost, a **jaký typ dokumentu to je** (TZ / soupis-rozpočet / výkres [jaký: situace, vzorový řez, podélný řez, výztuž, tvar, detaily, zábradlí] / statický výpočet / jiné). Pokud existuje automatické rozpoznání typu v enginu, spusť ho a uveď, zda se trefí.

### Výstup 2 — Per-dokument: co současný parser vytáhne
Pro každý dokument spusť odpovídající existující parser Core Engine a zaznamenej:
- co se vytáhlo (klíčové pole/hodnoty),
- metodu (regex / engine / LLM) a přiřazený confidence,
- **co dokument obsahuje, ale parser pominul** (zejména geometrie a technologie u TZ — viz golden níže),
- selhání (nečitelné, špatně rozpoznaný typ, prázdný výstup).

### Výstup 3 — Křížová konzistence dokumentů
Porovnej fakta napříč dokumenty a nahlas rozpory:
- objemy v soupisu vs geometrie v TZ/výkresech,
- třídy betonu: TZ (skutečná, např. NK = C35/45) vs název položky soupisu (katalogová mez „do C40/50"),
- expozice per prvek vs to, co je v soupisu/TZ,
- prvky zmíněné v TZ, které v soupisu chybí (a naopak).

## VALIDOVANÝ GOLDEN SEED (už doménově ověřeno — použij jako referenci, NE jako test v tomto tasku)

**TZ §4.1.6 Nosná konstrukce — co MUSÍ jít vytáhnout:** C35/45 – XF2+XD1+XC4 (všechny tři kategorie); dvoutrámová předpjatá; 3 pole 32,0+44,5+32,0 m; konstrukční výška trámů 2,40 m; šířka NK 13,65 m; pevná skruž ve 3 etapách; kabely Y1860-S7-A 22-lanové, 150 mm², PL2.

**Soupis — betonové prvky (reálné výměry + indexy výztuže):**

| Kód | Prvek | Typ | Objem m³ | Výztuž kg/m³ |
|---|---|---|---|---|
| 272325 | Základy | Základy pilířů | 867.136 | 150 |
| 317325 | Římsy | Římsa | 266.328 | 113 |
| 333325 | **Opěry A KŘÍDLA** | Opěry (bundled!) | 557.851 | 115 |
| 334326 | Pilíře | Dříky pilířů | 361.384 | 173 |
| 420324 | Přechodové desky | Přechodová deska | 81.900 | 151 |
| 422336 | NK trám předpjatá | Mostovková deska | 2697.941 | 174 měkká + 31 předpín. |

→ Recon má zjistit, **nakolik se k těmto reálným hodnotám současné parsery přiblíží** (zejména pominutí geometrie u TZ a podhodnocené indexy výztuže).

## ACCEPTANCE CRITERIA
1. Inventář pokrývá VŠECHNY soubory ve složce s určeným typem dokumentu.
2. Per-dokument recon má pro každý dokument reálně spuštěný parser (ne odhad), s vytaženo/pominuto/selhání.
3. Křížová konzistence vypisuje konkrétní rozpory mezi dokumenty.
4. Pominutí oproti golden seedu (geometrie TZ, indexy výztuže) je explicitně vypsané.
5. **Žádný golden test napsán, žádná produkční logika změněna.** Pouze čtení + dočasné recon skripty mimo produkční cesty.

## OUT OF SCOPE
- **Žádné golden testy** (samostatný navazující task po revizi tohoto reconu).
- Žádné opravy parserů.
- Kalkulátorový browser-parser „Text z TZ" (řeší samostatný audit kalkulátoru).

## NAMING & STRUKTURA
Naming a strukturu odvoď z konvencí v repu. Recon dokument umísti do složky pro audity. Nezakládej paralelní strukturu.
