# TASK: Audit kalkulátoru betonáže — pole, výpočet, extrakce TZ, AI doporučení (RECON ONLY)

## MANTRA
Než cokoliv napíšeš: přečti celé relevantní části repa (kalkulátor / Monolit-Planner: formulář, klasifikátor elementu, výpočetní engine, extrakce z TZ, endpoint AI doporučení). **Tento task NIC nemění v kódu.** Výstup = jeden audit dokument. Žádný PR s úpravami logiky.

## KONTEXT
Kalkulátor betonáže běží v samostatném režimu. Uživatel volí typ elementu (~24 typů: pozemní + mostní) a engine spočítá objemy, výztuž, bednění, podpěrnou konstrukci, harmonogram a náklady. Formulář se snaží zobrazovat jen pole relevantní pro daný typ elementu. Ve formuláři je také pole pro volný text technické zprávy a tlačítko pro AI doporučení (postup / bednění / normy).

Před jakoukoliv opravou potřebujeme rozumět **stávajícímu stavu** (as-is) deterministicky, ne ručním klikáním. Proto: nejdřív audit.

## PRE-IMPLEMENTATION INTERVIEW
Než začneš, zeptej se (AskUserQuestion) na to, co není z repa jednoznačné. Minimálně:
1. Kde je autoritativní seznam typů elementů (zdroj pravdy pro dropdown)?
2. Jaký je vstupní bod enginu pro výpočet jednoho elementu (aby šel volat per-typ s fixturou)?
3. Existují vzorové texty TZ v repu k vyzkoušení extrakce? Pokud ne, vytvoř 2–3 minimální vzorky sám.

## CÍL — 4 AUDIT VÝSTUPY (popisné, „jak to JE")

### Výstup 1 — Matice viditelnosti polí (as-is)
Z logiky podmíněného renderování formuláře sestav tabulku: **řádek = typ elementu, sloupec = logický blok polí** (geometrie, plocha+systém bednění, výztuž, podpěrná konstrukce, členění/záběry, mostní parametry, výška nad terénem, tvar průřezu, čerpadlo, předpětí, beton/zrání, zdroje/čety, ceny). V buňce: zobrazeno / skryto / podmíněno (s jakou podmínkou). Cíl: aby šlo jedním pohledem vidět, který blok se kterému elementu reálně ukazuje.

### Výstup 2 — Per-element audit výpočtu
Pro KAŽDÝ typ elementu spusť engine s jedním realistickým minimálním vstupem a zaznamenej klíčové výstupy + označ anomálie:
- **Objem**: porovnej spočítaný objem s objemem z geometrie (rozměry × tloušťka). Nahlas rozdíl.
- **Sanity-check geometrie**: pokud engine hlásí „očekávaný objem", ověř, zda počítá ze zadané tloušťky, nebo z nějaké defaultní/typové hodnoty.
- **Výztuž**: spočítaná hmotnost ÷ objem = kg/m³; porovnej s typickým indexem daného elementu z katalogu.
- **Podpěrná konstrukce**: jaký typ engine zvolil (těžká skruž vs lehké stojky) a zda to odpovídá pravidlu „mostní nosná konstrukce → vždy skruž; pozemní vodorovné → stojky". Nahlas každý případ, kde se **lejbl technologie a skutečně použitý resource rozcházejí**.
- **Zrání / ošetřování**: kolik dní engine použil a zda u mostní NK aplikuje pravidlo MAX(mostní norma ~21 d, třída ošetřování).
- **Default expozice**: jakou třídu prostředí engine přiřadí automaticky a zda odpovídá normě pro daný element (např. mostní paluba/římsa → agresivnější třída).
- **Harmonogram**: základní sanity (nezáporné, řádově sedící doby).

Výstup = tabulka „element → výstupy → nalezené anomálie".

### Výstup 3 — Dokumentace extrakce z volného textu TZ
Z kódu popiš: co se z volného textu TZ parsuje, **kterými poli formuláře** se to naplní, a jakou metodou (regex / engine / LLM) + jaký confidence se přiřadí. Pak na 2–3 vzorových textech TZ ukaž konkrétně: vstupní text → co se vytáhlo → do kterých polí se to aplikovalo. Zvlášť zaznamenej, co se v textu zmíní, ale **NEvytáhne**.

### Výstup 4 — Dokumentace tlačítka „AI doporučení (postup / bednění / normy)"
Z kódu vystopuj celý řetězec: co tlačítko volá (endpoint), jaký model/poskytovatel, jaký prompt/vstup mu jde, jaký tvar má odpověď, jak se zobrazí uživateli. Urči: je výstup deterministický nebo LLM? Přiřazuje se mu nějaký confidence? Co konkrétně doporučuje (postup, systém bednění, normy)? Liší se podle typu elementu?

## ACCEPTANCE CRITERIA
1. Existuje jeden audit dokument se 4 výstupy výše.
2. Matice viditelnosti pokrývá VŠECHNY typy elementů a všechny bloky polí.
3. Per-element audit výpočtu má řádek pro každý typ elementu s reálně spuštěným enginem (ne odhadem).
4. Každá nalezená vnitřní nekonzistence (lejbl vs resource, default vs zadané, varování vs výpočet) je explicitně vypsaná s elementem, kde nastává.
5. Extrakce TZ je doložená na konkrétních vzorcích (vstup → vytaženo → aplikováno → nevytaženo).
6. Řetězec AI doporučení je popsán od tlačítka po odpověď.
7. **Žádná změna produkční logiky.** Pouze čtení + případné dočasné audit skripty/fixtury (mimo produkční cesty).
8. Testy/audit běží bez sítě/DB/AI tam, kde to jde; pokud AI doporučení vyžaduje LLM, popiš to, ale neposílej reálné placené volání bez potvrzení.

## OUT OF SCOPE
- Žádné opravy nalezených chyb (to bude samostatný fix-task po revizi).
- Žádná UX rozhodnutí (co skrýt/přidat) — to rozhoduje vlastník + poradce.
- Žádné nové typy elementů.

## NAMING & STRUKTURA
Naming a strukturu odvoď z konvencí v repu. Audit dokument umísti do složky pro audity. Nezakládej paralelní strukturu.

---

## PŘÍLOHA A — POZOROVANÉ SYMPTOMY (najdi root-cause každého)

Toto jsou reálně pozorované chyby z ručního běhu. Audit má u každého vysvětlit **příčinu v kódu**, ne jen popsat mechaniku.

1. **Typ se extrahuje, ale nikdy neaplikuje.** I když je vybrán „Mostovková deska", extrahovaný „Typ: mostovková deska" se označí „Parametr není relevantní pro 'Mostovková deska'" → konflikt/ignor. Logika relevance parametru „Typ" je rozbitá i když se shoduje.
2. **Změna typu elementu smaže rozparsovanou TZ panel** (rozparsované-ale-neaplikované výsledky se zahodí). Rozbíjí pořadí „vlož TZ → vyber typ".
3. **Pominutá extrakce geometrie/technologie, která JE explicitně v TZ:** rozpětí 32,0+44,5+32,0; šířka NK 13,65 m (formulář měl 12!); konstrukční výška trámů 2,40 m; výstavba na pevné skruži ve 3 etapách; 22-lanové kabely Y1860-S7-A.
4. **Expozice extrahována dvakrát** — správně „XF2, XD1, XC4" a chybně „XF2 (nejpřísnější z 3)". XC/XD/XF jsou doplňující kategorie → aplikovat všechny, ne vybírat jednu „nejpřísnější".
5. **AI normy — LLM hedguje** („nemám přístup k textům norem"), místo deterministické NKB.
6. **AI bednění — doporučil Dokaflex** (stropní systém pro budovy) pro mostovku na skruži; protiřečí TZ („pevná skruž, 3 etapy") i vlastnímu deterministickému selektoru technologie („pevná skruž DOPORUČENO").
7. **Surový JSON** (methvin.co) vypsán uživateli do UI.

---

## PŘÍLOHA B — REÁLNÝ KORPUS SO202 (validace + kalibrace)

**Vstupy:** reálná technická zpráva mostu SO202 (D6 přes Lomnický potok) + reálný soupis prací (100 položek). Zajisti, aby je agent měl jako fixtury (commit do test dat nebo z Project Knowledge).

### B.1 Soupis — betonové prvky → mapování na typy elementů (s reálnými výměrami)

| Kód | Prvek (soupis) | Typ elementu | Objem m³ | Výztuž t | = kg/m³ | Pozn. |
|---|---|---|---|---|---|---|
| 272325 | Základy ŽB do C30/37 | Základy pilířů | 867.136 | 129.877 | 150 | default katalogu (80–120) NÍZKÝ |
| 317325 | Římsy ŽB do C30/37 | Římsa | 266.328 | 30.074 | 113 | |
| 333325 | **Mostní opěry A KŘÍDLA** ŽB C30/37 | Opěry úložné prahy | 557.851 | 64.164 | 115 | **JEDNA položka = bundled (opěry+křídla)** |
| 334326 | Mostní pilíře a stativa C40/50 | Dříky pilířů | 361.384 | 62.577 | 173 | |
| 420324 | Přechodové desky C25/30 | Přechodová deska | 81.900 | 12.348 | 151 | default (80–100) NÍZKÝ |
| 422336 | Mostní nosná trám. konstr. PŘEDPJ C40/50 | Mostovková deska | 2697.941 | 468.886 | 174 | měkká výztuž; default (80–130) VÝRAZNĚ NÍZKÝ |
| 42237 | Výztuž NK předpínací | (flag předpětí) | 2697.941 | 82.840 | 31 | předpínací ✓ v normě (25–40) |
| 434125 | Schodišťové stupně ŽB C30/37 | Schodiště | 20.088 | — | | |
| 451312–45131A | Podkladní beton C12/15…C25/30 | Podkladní beton | viz soupis | 0 | 0 | **prostý — bez výztuže/bednění** |
| 461314 | Patky z prostého betonu C25/30 | Patky | 12.733 | 0 | 0 | prostý |

**Kalibrační závěr:** reálné indexy výztuže jsou u několika prvků nad defaulty engine (NK 174 vs ~100–130; základy 150 vs 80–120; přechodové 151 vs 80–100). Per-element audit výpočtu (Výstup 2) MUSÍ porovnat default engine s těmito reálnými hodnotami a označit podhodnocení.

**Pozor na třídu betonu:** kód soupisu „do C40/50" je katalogová horní mez OTSKP, ne skutečná třída. Skutečná třída NK dle TZ = **C35/45**. Extrakce musí brát třídu z TZ, ne z názvu položky.

### B.2 TZ §4.1.6 Nosná konstrukce — očekávaná extrakce (golden)

Z reálné TZ MUSÍ parser vytáhnout (toto je golden, proti kterému se měří Výstup 3):
- Třída + prostředí: **C35/45 – XF2+XD1+XC4** (všechny tři kategorie)
- Spojitá monolitická **dvoutrámová** konstrukce z **předpjatého** betonu
- **3 pole, rozpětí 32,0+44,5+32,0 m**
- Konstrukční výška trámů **2,40 m**; celková šířka NK **13,65 m**
- Výstavba na **pevné skruži ve 3 etapách**, směr O1→O4
- Předpětí: **22-lanové kabely Y1860-S7-A, plocha 150 mm²**, kanálky korugované plastové, ochrana PL2; injektáž po každém napínání (do 14 dní / do 1 měsíce)
- Odskružení taktu až po napnutí všech kabelů v taktu

Zaznamenej, co z tohoto parser vytáhne a co pomine (geometrie a technologie jsou hlavní podezřelí — viz Příloha A, bod 3).

### B.3 Per-element exposice z TZ
Z plné TZ vytáhni třídy prostředí pro KAŽDÝ prvek (opěry, římsy, pilíře, NK, přechodové desky) — zejména ověř, zda římsy mají agresivnější třídu (XF4+XD3, posyp) vs NK (XF2+XD1+XC4). Toto je golden pro default expozice (Výstup 2).

---

## ROZŠÍŘENÉ ACCEPTANCE CRITERIA (k Příloze A+B)
9. Každý ze 7 symptomů Přílohy A má v auditu uvedenou root-cause v kódu.
10. Výstup 3 (extrakce) je spuštěn na REÁLNÉ TZ SO202 a porovnán s goldenem B.2 (co vytaženo / co pominuto).
11. Klasifikace je ověřena na reálných položkách soupisu B.1, včetně **bundled položky „opěry a křídla"** (jak ji systém zpracuje — jako jeden prvek, nebo rozpozná potřebu rozpadu?).
12. Per-element audit výpočtu porovnává default index výztuže engine s reálnými kg/m³ z B.1 a označuje podhodnocení.

## POZNÁMKA K FIX-TASKU (mimo rozsah tohoto auditu)
AI doporučení se NEbude „ladit promptem". Směr opravy (samostatný task po auditu): normy → NKB; bednění → deterministický selektor (po opravě skruž logiky pro mostní NK); LLM jen jako označený fallback 0.70. Audit má jen zdokumentovat současný stav, aby fix byl informovaný.
