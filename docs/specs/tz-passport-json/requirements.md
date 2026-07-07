# tz-passport-json — requirements

**Status:** polovina A RATIFIKOVÁNA (interview 2026-07-07); polovina B čeká na
vlastní B-interview (otázky 2+3 níže explicitně deferred).
**Vznik:** 2026-07-07, z živého MCP E2E testu SO 202 Žalmanov (výkres 202/17
Tvar NK + soupis E_Soupis_skupiny_MOSTY_PHS.xlsx). Alexander ručně sestavil
passport-JSON z TZ — uložen jako kanonický příklad
`example_SO202_zalmanov.json` (s `_meta` blokem: provenance + 2 nalezené
konflikty TZ↔soupis).

## Problém

Kalkulátor umí správně počítat, jen když dostane správné vstupy. Dnes je
extrakce z dokumentace roztříštěná: `extract_tz_fields` (stage 1 text, bez
výměr), frontend `tz-text-extractor` (regex nad vloženým textem),
`tz_facts` (technologie + počet taktů), UEP (výkresy). E2E test ukázal, co se
ztrácí: přesné třídy betonu per prvek («C30/37-XF4+XD3+XC4» — plný expoziční
řetězec), počet taktů z poznámky NA VÝKRESE, tonáže výztuže ze soupisu,
geometrie (pole, šířky, výšky pilířů).

## Cíl

Jeden strukturovaný **passport objektu (JSON)** extrahovaný z dokumentace
(TZ + výkresy + soupis), který kalkulátor konzumuje deterministicky — bez
ručního přepisování parametrů.

## EARS-style acceptance (návrh k ratifikaci)

1. WHEN uživatel předá passport-JSON validní proti schématu, THE SYSTEM SHALL
   vyrobit `PlannerInput[]` pro všechny betonové prvky (NK, opěry, pilíře,
   základy, přechodové desky, římsy, podkladní beton) bez dalších dotazů.
2. WHEN passport nese `construction_process.deck_pour_stages`, THE SYSTEM
   SHALL počítat NK s tímto počtem taktů (num_tacts_override) A ZÁROVEŇ nést
   zdroj citace (tz_facts) pro validační pravidlo.
3. WHEN pole v passportu chybí, THE SYSTEM SHALL postupovat honest-blank
   (Pattern 26) — NIKDY nefabrikovat; prvek bez objemu = NEPOČÍTÁNO.
4. WHEN se passport a soupis rozcházejí (třída betonu, množství), THE SYSTEM
   SHALL zobrazit oba údaje s provenancí (Pattern 29/53) — konflikt je VIDITELNÝ
   FLAG, ne tichá volba.
5. Extrakční strana (TZ→JSON): každé pole nese `_source` anchor (sekce+strana
   / výkres+poznámka / soupis pozice). Fabrikace = defekt.

## Rozsah — dvě poloviny (stavět v tomto pořadí)

- **A. Konzumace (malá, deterministická):** mapper passport → `PlannerInput[]`
  ve shared engine. Testovatelné hned proti `example_SO202_zalmanov.json` +
  goldenům z E2E (3 takty × 449,7 m³; opěry TRIO; pilíře 3 záběry DIN 18218).
- **B. Extrakce (velká, fázovaná):** stage 1 TZ text (rozšířit
  `extract_tz_fields`), stage 2 výkresy (vision — poznámky typu «V 3 TAKTECH
  NA SKRUŽI» jsou NA VÝKRESE, ne v TZ!), stage 3 join množství ze soupisu.

## Interview — RATIFIKOVÁNO 2026-07-07 (Alexander)

1. **Governance schématu:** Pydantic-model v Core = SINGLE SOURCE
   (`app/models/bridge_passport.py`); `example_SO202_zalmanov.json` = golden
   fixture, která MUSÍ projít validací schématu v CI (drift-guard, stejný
   princip jako YAML→W3→TS). Schéma žije u konzumenta (A) — A se stabilizuje
   první, B se podřizuje. `schema_version` povinné.
2. **Kde běží extrakce:** → **DEFERRED do B-interview** (A konzumuje hotový
   passport, původ ji nezajímá). Směr: concrete-agent Core (`app/parsers/`).
3. **LLM vs regex:** → **DEFERRED do B-interview.** Rámec ratifikován:
   soupis = deterministický parser; TZ text = regex-first, LLM-fallback;
   výkresové poznámky («V 3 TAKTECH») = vision povinně.
4. **Konflikty TZ↔soupis (AC pro A):** NIKDY neřešit tiše — passport nese OBĚ
   hodnoty + `_meta.conflicts[]`. Default pro výpočet = **TZ hodnota**
   (projektová dokumentace > soupis, confidence-лестница) + VIDITELNÝ warning.
   **Pattern 53:** soupis «DO Cxx/yy» = OTSKP cenové pásmo, NE marka → to NENÍ
   konflikt marky; mapper značí `informativní`, ne `konflikt`.
5. **Granularita:** passport = **per-SO** (jednotka výpočtu); stavba =
   KOLEKCE paspportů + společné VRN/ZS (samostatná agregace, ne passport).

**Dodatečné AC (ratifikováno tamtéž):**
- **Honest-ignore:** passport-pole, která engine (zatím) nekonzumuje, se
  ignorují BEZ chyby (graceful degrade — mapper nesmí spadnout, když seam/#7
  ještě není v enginu; dnes `deck_pour_stages` → `num_tacts_override`+`tz_facts`).
- **Backward-compat:** jedno-elementový vstup bez passportu funguje beze změny.
- Chybějící množství (passport bez `quantities` položky) = element se PŘESTO
  emituje a engine ho poctivě označí NEPOČÍTÁNO (`UncalculatedError`, v4.38) —
  nikdy fabrikace objemu.

## Polovina A — realizace (gate 1, 2026-07-07)

- Schéma: `concrete-agent/.../app/models/bridge_passport.py` (Pydantic v2;
  přísné na polích, která A čte; `extra="allow"` jinde) + CI test validující
  example.
- Mapper: `Monolit-Planner/shared/src/parsers/bridge-passport.ts` —
  `mapPassportToPlannerInputs(passport)` → `{ elements[], warnings[] }` +
  `planPassport(passport)` (map → `planProject`). Join množství přes
  `quantities.items[].element` ↔ `materials_and_standards.concretes[].use`.
  Třída betonu: plný řetězec «C30/37-XF4+XD3+XC4» → `concrete_class` +
  primární `exposure_class` = první token (řazení dle CZ praxe).
- Konzument-wiring (MCP tool / backend route / UI import) = **gate 2**,
  samostatný ticket v BACKLOG.md.
