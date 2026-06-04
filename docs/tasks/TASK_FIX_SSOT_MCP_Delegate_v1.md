# TASK FIX: Jeden zdroj pravdy — MCP deleguje na kanonický TS engine

> **Verze:** v1
> **Datum:** 2026-06-03
> **Priorita:** P0 — FUNDAMENT. Řeší rozdvojení kalkulátoru (C5/C7/C8/C16 z auditu T0). Běží PŘED opravou uzlu opěry (dřík B) a před jakoukoli novou logikou prvků.
> **Affects:** Monolit-Planner backend (nové HTTP endpointy nad EXISTUJÍCÍM TS enginem) + concrete-agent MCP tools (classify / breakdown / calculate / advisor / recipe_runner)
> **Cíl:** MCP/agent surface vrací STEJNÝ výsledek jako UI. Konec „jeden prvek = dva výsledky".

-----

## Mantra

> Nejdřív potvrď přesný rozsah (recon + design), STOP. MCP musí zůstat funkční v KAŽDÉM kroku — nerozbít surface, který uživatel ukazuje. Cíl je PARITA, ne přepsání. Žádná nová výpočetní logika — jen vystavit existující TS engine přes HTTP a nechat MCP delegovat.

-----

## Pozadí (z auditu T0 + call-map reconu, potvrzeno čtením kódu)

Kalkulátor existuje ve dvou implementacích, které se rozešly:
- **Kanon:** TS engine `Monolit-Planner/shared` (`element-classifier.ts` + `planner-orchestrator.planElement`, 7 enginů, čte KB YAML). Tohle počítá v UI. Uživatel ho stavěl záměrně. Je správný.
- **Duplikát:** MCP Python v `concrete-agent` (`classifier.py` + `calculator.py` fallback + `breakdown.py`) — paralelní hardcoded ostrov, zaostalé rebar/curing/katalog.
- **Most je přerušený (C16):** `calculate_concrete_works` POSTuje na `{MONOLIT_API_URL}/api/calculate` (`calculator.py:792`), ale ten endpoint v `Monolit-Planner/backend/server.js` NENÍ → 404 → Python-fallback běží VŽDY. „Monolit API first" = dead code. Agent surface tedy tiše počítá zjednodušeným Pythonem s jinými konstantami.

**Důsledek:** uživatel používá a chce ukazovat MCP, ale MCP nedává stejné číslo jako reálný engine v UI. To je třeba opravit v kořeni.

## Rozhodnutí (Alexander, 2026-06-03): varianta A — jeden engine, MCP deleguje

TS engine = jediný zdroj pravdy. MCP přestane mít vlastní výpočet/katalog a bude tenký delegát na TS přes HTTP. Když TS není dostupný → MCP **selže nahlas** (fail-loud), NIKDY nevrací divergentní zjednodušený výsledek tiše.

> Varianta B (synchronizovat dva enginy a vědomě je nechat oba) zamítnuta: dva enginy se zase rozejdou; navíc zjednodušený MCP výpočet by se stejně nerovnal 7-enginovému TS pipeline.

-----

## Fáze 0 — Confirm + design (recon, STOP před kódem)

1. Potvrď, že `/api/calculate` (plný `planElement`) v Monolit backendu skutečně chybí; vypiš, které existující TS funkce je třeba vystavit přes HTTP: plný výpočet (`planElement`), klasifikace (`classifyElement`), work-breakdown.
2. Navrhni kontrakt delegátu: request/response pro každý endpoint tak, aby pokryl to, co dnes vrací MCP tooly (classify → type+confidence; breakdown → položky prací; calculate → objem/bednění/výztuž/harmonogram/četa).
3. Rozhodni fail-mode: když TS endpoint nedostupný (cold-start Cloud Run >10 s, výpadek) → MCP vrací jasnou chybu „engine unavailable", NE tichý fallback. (Volitelně: keep-warm / retry strategie.)
4. Vypiš MCP-only typy, které TS nezná (`zdivo_obklad, sachta, tunel_rampa, izolacni_stena, jine`) — rozhodni, zda je TS engine má převzít, nebo zda u nich MCP vrací „nepodporováno" (NE divergentní výpočet).
5. Plán parity testů: seznam reprezentativních prvků, na kterých se ověří „TS-direct == MCP-delegated".

**Výstup:** design report + seznam endpointů + fail-mode + parity plán. **STOP, čekej na review.** Žádný kód.

-----

## Fáze 1 — TS backend: vystavit kanonický engine přes HTTP

- Přidej do Monolit backendu HTTP endpointy, které volají EXISTUJÍCÍ TS engine (žádná nová výpočetní logika): `/api/calculate` (plný `planElement`), `/api/classify`, `/api/work-breakdown`.
- Endpointy jen tenká obálka nad `planner-orchestrator` / `element-classifier` / breakdown logikou, která už v shared existuje.
- Testy: endpoint vrací totéž co přímé volání engine v bundle.

-----

## Fáze 2 — MCP: přepnout na delegaci

- `classify_construction_element`, `create_work_breakdown`, `calculate_concrete_works`, `get_construction_advisor`, `recipe_runner` → volají TS HTTP endpointy z Fáze 1.
- MCP musí zůstat funkční po celou dobu (parita, ne výpadek).
- Divergentní Python výpočet/katalog: retire — buď smazat, nebo ponechat jen jako fail-loud „unavailable", NIKDY jako tichý jiný výsledek.
- Pozn.: po delegaci se MCP normalizer/klasifikátor přestane používat pro klasifikaci → uzel dřík opěry (C1–C3) se opravuje JEDNOU v TS kanonu (následný task), MCP to zdědí.

-----

## Fáze 3 — Parity + úklid

- **Parity testy:** pro seznam prvků z Fáze 0 platí `classify/calculate via TS-direct` == `via MCP-delegated`. Žádný prvek nedává dvě čísla.
- Golden testy podpěr (SO-202/203/207) zelené přes obě cesty.
- Po potvrzení parity: odstranit zaostalé MCP konstanty/katalog (C5/C7/C9 zmizí, protože MCP už je nemá).
- Regrese: žádný dosavadní test nespadne.

-----

## Kritéria přijetí (pokračování GLOBÁLNÍHO počítadla — najdi poslední číslo v repu)

- `#N` — `/api/calculate` (+ classify + work-breakdown) existuje v Monolit backendu a vrací výstup existujícího TS enginu (ověřeno testem proti přímému volání).
- `#N+1` — MCP tooly (classify/breakdown/calculate/advisor/recipe_runner) delegují na TS endpointy; vlastní divergentní výpočet odstraněn nebo převeden na fail-loud.
- `#N+2` — když TS nedostupný, MCP vrací jasnou chybu, NE tiché jiné číslo.
- `#N+3` — **parita:** reprezentativní prvky dávají identický výsledek přes UI (TS) i přes MCP. C16 uzavřen.
- `#N+4` — zaostalé MCP konstanty/katalog odstraněny (C5/C7/C9 neaktuální → pryč).
- `#N+5` — regrese zelená; MCP surface funkční (ukazatelný) po celou dobu.

-----

## Mimo rozsah (následné tasky, NE zde)

- **Oprava uzlu opěry (dřík opěry / křídlo / závěrná zídka, varianta B)** — až po konsolidaci, JEDNOU v TS kanonu. `TASK_BridgeSupport_Concreting_Recon_v1.md`.
- Záběry / četa / výběr bednění + normy (T2).
- DOKA/PERI konsolidace + ingesce (T3/T4).
- UI cleanup režimů expert/průvodce + mrtvá pole (#1145 zbytky).
- Migrace hardcoded matic do KB (C12).

-----

## Naming (zafixovat, ať zmizí slovní zmatek)

- **„Engine kalkulátoru" = TS** v `Monolit-Planner/shared` (jeden engine; dva vstupy: souhrnná tabulka → element, a samostatný kalkulátor; dva režimy UI: expert / průvodce).
- **`concrete-agent` = MCP wrapper** — po tomto tasku tenký delegát, ne druhý engine.

**Confidence:** 0.85 — kořen (přerušený most C16) potvrzen čtením kódu; rozsah HTTP endpointů a fail-mode se finalizuje ve Fázi 0. Riziko: latence/cold-start TS služby — řešit v designu, ne důvod nedělat A.
