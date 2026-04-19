# ЗАДАНИЕ: Pipeline генерации soupisu prací из проектной документации (TZ + výkresy)

**Версия:** 3.0
**Приоритет:** высокий
**Зависит от:** Work Packages DB (из TASK_VZ_Scraper_WorkPackages)
**Обновлено:** принцип универсальности — система работает для ЛЮБОГО типа stavebních prací

---

## 0. Обязательное правило для агента

> Сначала читаешь весь репо целиком. Потом определяешь naming по существующему коду. Потом пишешь.

Особое внимание:
- Существующим парсерам TZ (detect_document_type, FILENAME/CONTENT_TYPE_MARKERS)
- NormIngestionPipeline и его слоям (regex → Gemini → Perplexity)
- URS_MATCHER_SERVICE — API, формат запросов/ответов
- Endpoint `/api/urs-catalog/:code/detail` (если уже реализован — использовать)
- Структуре DocumentSummary и project.json

---

## ⚠️ PRINCIP UNIVERZÁLNOSTI — nejdůležitější část tohoto zadání

### Proč to tu je

Příklady v tomto zadání jsou **pouze ilustrace**. Jsou z reálné smetы na sanaci fasády (ETICS, hydroizolace, bourání). Ale systém NESMÍ být omezen na tyto příklady.

### Co systém MUSÍ umět

Systém musí umět navrhnout položky pro **jakýkoliv typ stavebních prací**, včetně ale neomezeně na:

**Pozemní stavby (bytové domy, školy, haly, nemocnice):**
- Zemní práce (výkopy, rýhy, násypy, piloty, štětovnice, mikropiloty)
- Základy (pasy, patky, desky, milánské stěny)
- Svislé konstrukce (zdění, ŽB sloupy/stěny, SDK příčky, obezdívky)
- Vodorovné konstrukce (ŽB stropy, průvlaky, schodiště, překlady)
- Beton + výztuž + bednění (VŽDY jdou společně — tři neoddělitelné položky!)
- Střechy (krovy, laťování, krytiny, klempířské, hydroizolace, tepelné izolace)
- Podlahy (mazaniny, stěrky, dlažby, povlaky, lité podlahy, sportovní podlahy)
- ETICS (penetrace, lepení, kotvení, armování, omítky — 8+ položek)
- Okna a dveře (demontáž + montáž + parapety + začištění + těsnění)
- Klempířské výrobky (parapety, atiky, žlaby, svody, oplechování)
- Zámečnické konstrukce (zábradlí, žebříky, ocelové konstrukce)
- SDK (podhledy, předstěny, příčky — profily + desky + tmel + páska)
- Obklady a dlažby (penetrace + lepidlo + obklad + spárování)
- Omítky vnější i vnitřní (penetrace + postřik + jádro + štuk NEBO strojní)
- Malby a nátěry (oprášení + penetrace + malba, nebo odrezivění + základ + nátěr)
- Hydroizolace (spodní stavba, střechy, koupelny)
- Tepelné izolace (fasáda, střecha, podlaha, sokl)
- Instalace ZTI (kanalizace + vodovod + zařizovací předměty)
- Instalace VZT (potrubí + jednotky + regulace)
- Instalace ÚT (kotel + rozvody + radiátory + armatury)
- Elektroinstalace silnoproud (kabely + rozvaděče + svítidla + hromosvod)
- Elektroinstalace slaboproud (EPS, EZS, kamery, strukturovaná kabeláž)
- MaR (čidla, regulátory, servopohony, řídicí systém)
- Lešení (montáž + příplatek/den + demontáž + sítě + dovoz)
- Přesuny hmot (HSV i PSV — vždy na konci každého dílu!)
- Bourání + likvidace (bourání + odvoz + skládkovné)
- Dopravní stavby (vozovky, chodníky, obrubníky, dopravní značení)
- VRN (vedlejší rozpočtové náklady — zařízení staveniště, koordinace BOZP)

**Inženýrské stavby (mosty, silnice, železnice):**
- Mostní konstrukce (spodní stavba → nosná konstrukce → římsy → ložiska → závěry)
- Zemní těleso (násypy, zářezy, odvodnění, zpevnění svahů)
- Vozovky (podkladní vrstvy → ložní vrstva → obrusná vrstva)
- Železniční svršek (kolejnice + pražce + štěrk + výhybky)
- Železniční spodek (zemní práce + odvodnění + propustky)
- Inženýrské sítě (vodovod, kanalizace, plynovod, kabelovody)

### Jak to systém zajistí

**Balíčky prací se NEHARCODE-UJÍ v kódu.** Берутся из Work Packages DB, která je naplněna automaticky z co-occurrence analýzy 48K+ reálných smluv (viz TASK_VZ_Scraper_WorkPackages).

```
TZ text → keyword extraction → query Work Packages DB → matching balíčky
                                         ↑
                                   naplněno z dat
                                   (ne z tohoto dokumentu!)
```

Pokud Work Packages DB zatím není naplněna, systém použije **AI fallback**: odešle text TZ do Gemini/Claude s instrukcí "rozlož na dílčí stavební práce a navrhni ÚRS kódy". Ale to je fallback s confidence=0.70, ne hlavní cesta.

### Co to znamená pro implementaci

1. **Žádný hardcoded seznam balíčků** v kódu. Všechny balíčky z DB.
2. **Žádný hardcoded seznam trigger_keywords.** Keywords z DB.
3. **Příklady v tomto zadání** (ETICS, HI, bourání) jsou TESTY, ne šablony. Systém musí projít test na ETICS i na ZTI i na SDK i na mosty.
4. **Pokud DB je prázdná** → AI fallback funguje pro jakýkoliv typ TZ.
5. **Nový typ prací** = nový balíček v DB (ne nový kód v systému).

---

## 1. Kontekst — co existuje a co chybí

### Co funguje
- Parsery xlsx_komplet a xlsx_rtsrozp
- Detekce typu TZ dokumentu
- NormIngestionPipeline: PDF → regex → Gemini → Perplexity
- URS_MATCHER_SERVICE
- OTSKP-báze (17 904 záznamů)
- DocumentSummary → project.json

### Co chybí (toto zadání)
- **Reverzní proces**: text TZ → dílčí práce → ÚRS kódy z katalogu
- **Dekompozice**: 1 fráze TZ = N položek (práce + materiály + příplatky + přesuny)
- **Work Package matching**: keyword z TZ → balíček z DB → kompletní sada položek
- **Multivariantní návrh**: detailní ÚRS rozklad vs souhrnná R-položka

---

## 2. Hlavní scénář

1. Uživatel nahraje TZ (PDF) + výkresy (PDF) do projektu
2. Systém extrahuje popisy prací z TZ (regex + AI)
3. Pro každý popis:
   - Hledá matching Work Package v DB (keyword match)
   - Pokud nalezen: navrhne kompletní sadu položek z balíčku
   - Pokud nenalezen: AI fallback (Gemini → rozklad na dílčí práce → URS matching)
4. Systém nabídne varianty (detailní vs souhrnný)
5. Uživatel potvrdí/upraví
6. Výstup: soupis prací

### Klíčová hodnota: "co tam ještě patří"

Rozpočtář-začátečník napíše "zateplení fasády". Systém ví z dat (ne z hardcoded pravidel), že k tomu vždy patří: penetrace, lepení, kotvení, armování, omítka, příplatky, a lešení jako companion. A taky přesuny hmot.

Stejně tak pro "ŽB strop tl. 250mm" systém ví že potřebujete: bednění + výztuž + betonáž + ošetření + odbednění. Nikoliv proto že to někdo naprogramoval, ale proto že v 95% reálných smět tyto položky jdou vždy společně.

---

## 3. Pipeline — 4 fáze

### Fáze 1: Extraction (TZ → Work Requirements)

**Vstup:** Text z TZ + poznámky z výkresů

**Postup:**
- Regex (confidence=1.0): betony (C25/30), tloušťky (tl. 180mm), normy (ČSN), DN, kW, m³/h
- AI (confidence=0.70): rozklad odstavců na dílčí work requirements
- 1 odstavec TZ = typicky 3-8 work requirements

**Výstup:** `WorkRequirement[]` — popis + parametry + zdroj + confidence

### Fáze 2: Package Matching (Requirements → Work Packages)

**Vstup:** Work requirements z Fáze 1 + Work Packages DB

**Postup:**
```
Pro každý work requirement:
  1. Extrahovat keywords z popisu
  2. Query Work Packages DB: 
     SELECT * FROM work_packages 
     WHERE trigger_keywords && ARRAY[keywords]
     ORDER BY confidence DESC
  3. Pokud nalezen balíček (confidence > threshold):
     → Rozbalit: anchor + companion + conditional items
     → Vyhodnotit conditions (tloušťka, materiál)
     → Připojit companion packages (lešení, přesuny)
     → Nabídnout alternativní variantu (souhrnná)
  4. Pokud NENALEZEN:
     → AI fallback: Gemini Flash "rozlož tuto práci na ÚRS položky"
     → URS_MATCHER_SERVICE pro každou navrženou položku
     → confidence = 0.70 (AI)
```

**Výstup:** `MatchedPackage[]` — seznam ÚRS položek + alternativy + confidence

### Fáze 3: URS Lookup (Packages → konkrétní kódy)

**Vstup:** Matched packages

**Postup:**
- Pro každou roli v balíčku → hledat konkrétní ÚRS kód
- Kaskáda: URS_MATCHER → regex pattern → AI fallback
- Validace: MJ musí odpovídat, parametrický rozsah musí matchovat
- PP detail z podminky.urs.cz (cache)

**Výstup:** `EnrichedItem[]` s kódy, popisy, MJ, warnings

### Fáze 4: Assembly (→ Soupis prací)

- Seřadit dle HSV/PSV dílů
- Přenést množství z TZ/výkresů
- VV formule
- Export xlsx (KROS kompatibilní)

---

## 4. Work Packages — DATOVÁ struktura, ne hardcoded

### Jak vypadá Work Package v DB

```json
{
  "package_id": "WP-xxx",
  "name": "automaticky z dat",
  "trigger_keywords": ["automaticky z dat"],
  "confidence": 0.92,
  "source_stats": {"detected_in": 847, "total_analyzed": 2847},
  
  "items": {
    "anchor": [{"dil_pattern": "...", "role": "...", "frequency": 0.97}],
    "companion": [{"dil_pattern": "...", "role": "...", "frequency": 0.85}],
    "conditional": [{"dil_pattern": "...", "frequency": 0.45, "condition_hint": "..."}]
  },
  
  "companion_packages": ["WP-LESENI-001", "WP-PRESUNY-PSV-001"],
  "alternative_variant": {"description": "...", "detected_in": 312}
}
```

### Kde balíčky berou data

**PRIORITA 1:** Work Packages DB (naplněná z co-occurrence analýzy 48K+ smluv)
**PRIORITA 2:** AI fallback (Gemini Flash + URS_MATCHER_SERVICE)

Systém NIKDY nezávisí na tom, jestli konkrétní typ prací "zná". Pokud balíček neexistuje v DB, AI to rozloží.

### Příklady balíčků (POUZE PRO ILUSTRACI — nehardcodovat!)

Tyto příklady ukazují jak by mohly vypadat automaticky vytvořené balíčky. Neimplementovat je jako hardcoded pravidla!

**Příklad 1: ETICS** (z reálné smetы HEAT-TECH)
- anchor: montáž KZS (622211*), frequency=0.97
- companion: penetrace (622131*), omítka (6225*), příplatek (62225*)
- companion_package: lešení, přesuny hmot PSV

**Příklad 2: ŽB konstrukce** (očekávaný výstup co-occurrence)
- anchor: betonáž (27*, 28*, 41*), frequency=0.95
- companion: bednění (35*, 36*), výztuž (41*), frequency=0.93
- vždy trojice: beton + výztuž + bednění

**Příklad 3: Podlahy** (očekávaný)
- anchor: mazanina/potěr/dlažba (63*, 771*)
- companion: penetrace (771121*), izolace (713*), přesuny
- conditional: hydroizolace (711*) — jen mokré provozy

**Příklad 4: Instalace ZTI** (očekávaný)
- anchor: rozvody kanalizace (721*) + vodovod (722*)
- companion: zařizovací předměty (725*), armatury (734*), přesuny
- conditional: přípojky, revize, zkoušky

---

## 5. Pravidla předmětné oblasti

### 5.1 Jeden typ práce v TZ = N položek v katalogu

Toto platí UNIVERZÁLNĚ, ne jen pro ETICS:

| TZ popis (příklad) | Kolik reálně položek | Proč |
|---|---|---|
| "zateplení fasády ETICS" | 8-12 | penetrace + lepení + kotvení + armování + omítka + příplatky + materiál |
| "ŽB strop tl. 250mm" | 3-5 | bednění + výztuž + betonáž + ošetření + odbednění |
| "SDK příčka tl. 150mm" | 4-6 | profily CW+UW + desky 2x + tmel + páska + izolace |
| "keramický obklad" | 3-4 | penetrace + lepidlo + obklad + spárování |
| "plastová okna" | 4-6 | demontáž starých + montáž nových + parapety + začištění + těsnění |
| "vnitřní omítka štuková" | 2-3 | postřik + jádrová + štuková (nebo strojní 1 vrstva) |
| "asfaltová vozovka" | 4-6 | podklad + ložní vrstva + obrusná + postřiky + obrubníky |
| "kanalizační přípojka" | 5-8 | výkop + podsyp + potrubí + obsyp + zásyp + zkoušky + přesuny |

### 5.2 Companion items — vždy kontrolovat

Nezávisle na typu práce, systém vždy kontroluje:

| Práce | Companion (automaticky přidat) |
|---|---|
| Jakékoliv HSV práce | Přesun hmot HSV (998*) |
| Jakékoliv PSV práce | Přesun hmot PSV (998*) |
| Fasádní práce ve výšce | Lešení (941*) + ochranné sítě (944*) |
| Bourání čehokoliv | Odvoz suti (997*) + skládkovné |
| Betonáž | Bednění + výztuž (pokud ŽB) |
| Výkopy | Přemístění + uložení/odvoz + zásyp |

### 5.3 Cenová soustava

- Výchozí: CS ÚRS nejnovější (ověřit aktuální verzi na podminky.urs.cz)
- Pro infrastrukturu: OTSKP
- Systém pracuje s KÓDY a POPISY — ne s cenami

### 5.4 Cross-document kontrola

Informace z různých TZ jednoho projektu se doplňují:
- Statika říká jaký beton → ovlivňuje kód betonáže
- PBŘS říká požární požadavky → ovlivňuje typ konstrukce
- Geologie říká agresivitu → ovlivňuje třídu betonu
- TZ elektro říká FVE na střeše → statika musí řešit přitížení

---

## 6. Pre-implementation interview (povinné!)

1. **URS_MATCHER_SERVICE**: Umí fulltext search nebo jen lookup by code?
2. **Work Packages DB**: Existuje už tabulka? Nebo vytvořit v rámci tohoto zadání?
3. **AI fallback prompt**: Jaký model pro rozklad TZ? Gemini Flash nebo Claude Sonnet?
4. **UI flow**: Existuje komponent pro "vybírání z návrhů"?
5. **Scope v1**: Celý pipeline nebo jen Fáze 1+2?
6. **Fallback kvalita**: Pokud DB je prázdná, jak kvalitní je AI-only rozklad?

---

## 7. Acceptance Criteria

### 7.1 Extraction (UNIVERZÁLNÍ)

- **Z jakéhokoliv odstavce TZ systém extrahuje regex parametry (betony, tloušťky, normy) s confidence=1.0.**
- **AI rozloží odstavec na dílčí práce — funguje pro ETICS i pro ZTI i pro SDK.**
- **Test na 3 různé typy TZ: fasáda (zateplení), interiér (SDK+obklady), instalace (ZTI).**

### 7.2 Package Matching (DATOVÝ)

- **Pokud Work Package existuje v DB → systém ho najde a rozbalí.**
- **Pokud Work Package NEEXISTUJE → AI fallback vrátí rozumný rozklad (ne prázdný výsledek).**
- **Companion packages se připojí automaticky (přesuny, lešení, odvoz).**
- **Test: pro trigger "ŽB strop" systém navrhne bednění + výztuž + betonáž jako skupinu (ne jen betonáž).**

### 7.3 URS Lookup

- **Pro nalezenou roli systém najde konkrétní ÚRS kód přes URS_MATCHER nebo pattern.**
- **Parametrová validace: tloušťka z TZ vs rozsah v katalogu → warning pokud nesedí.**
- **PP detail se cachuje.**

### 7.4 Assembly

- **Export: PČ, Typ, Kód, Popis, MJ, Množství, Cenová soustava.**
- **Položky seskupeny po HSV/PSV dílech.**
- **Zdroj u každé položky: odkud (TZ odstavec nebo companion balíček).**

### 7.5 Univerzálnost

- **Systém zpracuje TZ pro zateplení fasády. ✓**
- **Systém zpracuje TZ pro ŽB skelet novostavby. ✓**
- **Systém zpracuje TZ pro rekonstrukci interiéru (SDK, obklady, podlahy). ✓**
- **Systém zpracuje TZ pro ZTI (vodovod + kanalizace). ✓**
- **Systém zpracuje TZ pro dopravní stavbu (vozovka + chodníky). ✓**
- **Pro neznámý typ prací systém nepadne — vrátí AI fallback rozklad.**

---

## 8. Reálný testovací případ (1 z minimálně 3)

**Test 1: Sanace fasády** (TZ HEAT-TECH — příloha)
- "penetrace + postřik + jádrová omítka + zateplení KZS"
- Očekávaný rozklad: 15+ položek včetně lešení a přesunů

**Test 2: Interiérové práce** (vymyslený ale realistický)
- "SDK příčka tl. 150mm, keramický obklad v koupelně, plovoucí podlaha"
- Očekávaný rozklad: SDK (profily+desky+tmel), obklad (penetrace+lepidlo+obklad+spáry), podlaha (izolace+podložka+lamely)

**Test 3: ZTI** (vymyslený)
- "Vnitřní kanalizace PP DN 110, vodovod PPR DN 25, zařizovací předměty"
- Očekávaný rozklad: rozvody (721*+722*), předměty (725*), armatury, přesuny

---

## 9. Co NENÍ součástí

- Oceňování (ceny za MJ)
- Plný KROS export (.ksi) — pouze xlsx
- Automatické výpočty z DWG/CAD
- Napojení na živý ÚRS REST API
- **Hardcoded seznam balíčků — balíčky jsou v DB nebo z AI**

---

## 10. Finální připomínka

**Systém je UNIVERZÁLNÍ.** Příklady v tomto zadání jsou testy, ne šablony. Implementace nesmí záviset na konkrétním typu prací.

**Data-driven.** Balíčky z Work Packages DB (automaticky z co-occurrence). AI fallback pro neznámé typy.

**Determinismus před AI.** Regex → 1.0. DB match → z dat. URS Matcher → 0.80. AI → 0.70.

Naming a strukturu souborů určuj podle existujících konvencí v repozitáři. Nevytvářej paralelní strukturu.
